# The render side (`@shopkit/builder` + the storefront)

The preview **is** the real storefront, so understanding the editor means understanding how the
storefront renders a `pageConfig` and how it wires the editor in. Overview is in
[../EDITOR.md](../EDITOR.md); the editor SPA and bridge have their own modules
([editor-app.md](editor-app.md), [bridge.md](bridge.md)).

## Contents

- [The render pipeline](#the-render-pipeline)
- [Templates, variants, dynamic vs. static](#templates-variants-dynamic-vs-static)
- [How a storefront wires the editor in](#how-a-storefront-wires-the-editor-in)
- [Data layer](#data-layer)
- [Data model reference](#data-model-reference)

---

## The render pipeline

`PageBuildingEngine.renderPage()` ([engine.ts](../../../packages/builder/src/core/engine.ts)) runs a
pipeline:

```
pageConfig (+ routeContext, locale, messages)
   │
   1. TemplateResolver   ─ load the PageConfig for this route/variant (skipped if pageConfig passed in)
   2. TranslationService ─ resolve "t:" keys in settings using `messages`
   3. DataFetcher        ─ collect pageConfig.dataSources, fetch in parallel via ICommerceClient
   4. StyleProcessor     ─ merge theme + page style overrides
   5. WidgetFactory      ─ look up each widget type in IWidgetRegistry, inject resolved data + settings
   6. LayoutRenderer     ─ compose sections → widgets into a React tree via the SectionRenderer
   → React tree (SSR'd by Next.js)
```

When the editor commits a config, the storefront passes it straight into `renderPage`, which skips
step 1 (template resolution) and renders the given `pageConfig` directly.

`WidgetFactory` ([widget-factory.ts](../../../packages/builder/src/core/widget-factory.ts)) maps a
widget `type` string to a React component via `IWidgetRegistry`
([widget-registry.ts](../../../packages/builder/src/interfaces/widget-registry.ts)) and passes
standardized `WidgetProps` `{ id, data, settings, locale, routeContext }`.

---

## Templates, variants, dynamic vs. static

A merchant theme is a set of template files, e.g.
[dawn/templates](../../../apps/storefront-starter/src/themes/dawn/templates) (`home/default.ts`,
`products/default.ts`, `header/default.ts`, …). Each file exports a `PageConfig`. A **variant
registry** ([variant-registry.ts](../../../apps/storefront-starter/src/themes/dawn/templates/variant-registry.ts))
maps `templateType → variantName → lazy loader`.

- **Template** — the `PageConfig` for a page type.
- **Variant** — an alternative layout for the same type (`default`, `v2`, …).
- **Dynamic template** — the variant is chosen at runtime from API data (e.g. a collection handle
  selects a "featured" variant). These are the fully-editable pages in the editor.
- **Static template** — always the `default` variant, no runtime logic (e.g. policy pages) — these
  route to the deprecated translation-only lane (see [bridge.md](bridge.md#deprecated-translation-lane)).

`header` and `footer` are **chrome** templates: they live in the theme structure so the editor can
find them, but the template picker hides them (they aren't standalone pages). The editor merges
chrome into `pageConfig.sections` for preview and **splits it back out on save** — and only rewrites
a chrome template if it actually changed from the loaded baseline. On the storefront, `renderChrome`
renders header/footer, and chrome sections are stripped from page bodies so they don't double-render.

---

## How a storefront wires the editor in

Using [apps/storefront-starter](../../../apps/storefront-starter) as the reference:

| Integration point | Where | What it does |
|-------------------|-------|--------------|
| Mount `EditorHost` | [EditorHostMount.tsx](../../../apps/storefront-starter/src/editor-integration/EditorHostMount.tsx) (from `app/layout.tsx`) | Mounts the bridge gate **unconditionally**; passes `allowedEditorOrigins`, the `widgetSchemas` + `availableSections` (published to the editor via `assets`), `fetchDataSourceOptions`, and `previewCodeSync`. |
| Wrap sections | [SectionWrapperEditor.tsx](../../../packages/editor-bridge/src/client/SectionWrapperEditor.tsx) | Adds click-to-select data attributes (always) and merges override-store patches (editor only). |
| Preview cache route | [app/api/editor-preview/cache/route.ts](../../../apps/storefront-starter/src/app/api/editor-preview/cache/route.ts) | `export const { POST } = createPreviewCacheRoute()`. |
| Read preview state | [app/page.tsx](../../../apps/storefront-starter/src/app/page.tsx) | `readEditorPreviewState(searchParams)` → `{ isEditor, pageConfig }`; the cached config (if any) is passed straight into `renderPage`, skipping template load. |
| Editor widget manifest | [bootstrap/builder.ts](../../../apps/storefront-starter/src/bootstrap/builder.ts) `getPageBuilder({ isEditor })` | In editor mode uses a manifest where every widget is `"use client"`, so fast-lane overrides reach them. |
| CSP | [bootstrap/next-config.js](../../../apps/storefront-starter/src/bootstrap/next-config.js) `buildFrameAncestorsHeaders()` | `frame-ancestors 'self' <editorOrigins>` — only the editor may iframe the storefront. |
| Draft/shareable preview loader | [editor-integration/template-load-pipeline.ts](../../../apps/storefront-starter/src/editor-integration/template-load-pipeline.ts) | When `NEXT_PUBLIC_ENABLE_EDITOR_CHANGES=true` + Next Draft Mode, loads a saved draft snapshot from `visual-editor-be` using `PREVIEW_ID_COOKIE`/`PREVIEW_VERSION_COOKIE`. |

**Zero cost to customers.** `EditorHost` and `SectionWrapperEditor` mount on *all* traffic, but on
customer requests `EditorHost` never lazy-loads its runtime (no `?editor=true`) and the override
store is empty, so the wrapper's merges are no-ops. The unconditional mount is what lets the editor
attach without a separate build. (Runtime detail: [bridge.md → the two lanes](bridge.md#the-two-lanes).)

---

## Data layer

`@shopkit/builder` never talks to a commerce backend directly — it depends on `ICommerceClient`
([interface.ts](../../../packages/data-layer/src/core/interface.ts)): `getProduct(s)`,
`getCollection(s)`, recommendations, etc., each returning `{ success, message, data, … }`. A template
declares `dataSources: { featured: { type: "PRODUCTS", params: {…}, required } }`; `DataFetcher`
fetches all sources in parallel and `WidgetFactory` hands each widget the data named by its
`dataSourceKey`.

---

## Data model reference

Types live in [page-config.ts](../../../packages/builder/src/types/page-config.ts):

- **`PageConfig`** — `{ id, dataSources, sections[], theme?, responsive?, … }`. A template *is* a
  `PageConfig`.
- **`SectionConfig`** — `{ id, name, type, settings, widgets[] }`. Settings include `layout`
  (`"page"` = constrained width vs `"full"` = viewport) and responsive padding/margin/visibility.
- **`WidgetConfig`** — `{ id, name, type, dataSourceKey?, settings, responsive? }`. `settings` values
  may use the `"t:"` prefix for translations; `dataSourceKey` references a key in
  `pageConfig.dataSources`.
- **Schema types** (`SectionSchema`, `WidgetSchema`, registries) describe the **editor form fields**
  for each type — these are what the storefront publishes to the editor via `assets`.
- **`ThemeStructure`** — `{ id, name, templateStructure: group[] }`, each group has `templates[]`. A
  **`ThemeStructureTemplate`** is `{ id, name?, variant?, isDynamic?, supportedLanguages?, routeContext? }`,
  where `routeContext` carries `{ templateName, type ("header"/"footer" = chrome), path, params, query }`.
  (Defined in [editor-form/services/api.ts](../src/editor-form/services/api.ts).)
- **`SelectionTarget`** — `{ sectionId, sectionType?, widgetId?, widgetType? }`, the shape used by
  `select` / `focusSection`.

**Translations & `t:` refs.** Widget/section settings can hold `"t:some.key"`. There are two
translation files per template — `common` (shared) + template-specific — and the editor keeps both
and derives a `translationService`. Resolution happens in two places: the builder's
`TranslationService` resolves `t:` keys at render time (pipeline step 2), and the editor resolves
them to literals **before** sending fast-lane patches (`translateObject`) so the iframe doesn't need
the message table for a keystroke. Backend drafts store **both** the resolved `pageConfig` and an
unresolved `rawPageConfig` so resume keeps the refs (see the draft precedence in
[editor-app.md](editor-app.md#boot-is-a-cascade-of-xstate-machines)).
