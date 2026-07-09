# The editor app (`apps/visual-editor`)

The standalone editor SPA: how it boots, holds state, lays out, and talks to the backend.
Overview and end-to-end flows are in [../EDITOR.md](../EDITOR.md); the bridge and render sides
have their own modules ([bridge.md](bridge.md), [builder-storefront.md](builder-storefront.md)).

## Contents

- [Legacy vs. standalone](#legacy-vs-standalone)
- [Boot is a cascade of XState machines](#boot-is-a-cascade-of-xstate-machines)
- [Stores (Zustand)](#stores-zustand)
- [The 4-region layout](#the-4-region-layout)
- [The editor-form subtree](#the-editor-form-subtree)
- [Adding, removing, reordering sections](#adding-removing-reordering-sections)
- [How the form handles translations](#how-the-form-handles-translations)
- [AI features](#ai-features)
- [Backend API (`visual-editor-be`)](#backend-api-visual-editor-be)

---

## Legacy vs. standalone

There are **two** editor codebases in this repo. They share ~90% of their *form UI* but differ
fundamentally in how they host the preview.

| | **Legacy embedded editor** | **Standalone visual editor** |
|---|---|---|
| Location | [apps/storefront-starter/src/app/editor](../../../apps/storefront-starter/src/app/editor) (submodule, v2.2.0) | [apps/visual-editor](..) (Vite SPA, v0.0.x) |
| Hosting | Runs **inside** the storefront Next.js app at `/editor/[id]` | Separate SPA on its own origin |
| Preview | `react-frame-component` `<Frame>` — same-origin, storefront React tree rendered **directly** into it | Cross-origin `<iframe>` at the merchant's deployed URL, driven by the **`postMessage` bridge** |
| State → preview | Zustand change → synchronous re-render inside the Frame | Store change → `postMessage` patch → iframe's override store re-renders independently |
| Orchestration | `useEffect` chains + debounced render | **XState** machines (`appBoot` → `themeSession` → `templateSession`) |
| Auth | iframe handshake + `merchant-validation` route | `mid` + bearer token, validated against `visual-editor-be` |

**Relationship:** the legacy editor is the origin of the shared editing UI. Ported almost verbatim
into `src/editor-form/`: `DynamicForm` and every field input (`HtmlInput`, `RichTextInput`,
`MediaInput`, `ObjectArrayInput`, `ArrayInput`, `FAQInput`, `DataSourceEditor`), `section-registry`,
`schema-converter`, `htmlValidation`, `ai-utils`, `html-ai-prompt`, `SettingsSidebar`,
`SectionLibraryDialog`, and the dual-translation store. What was **swapped**: `react-frame-component`
direct rendering → `@shopkit/editor-bridge` `postMessage`; `useEffect` orchestration → XState.

> When porting more from the legacy editor, **drop flags/checks that only existed for the
> shared-app context** — this app is standalone.

---

## Boot is a cascade of XState machines

Async orchestration (auth, theme load, template load, save, commit) is modeled as **state
machines**, not `useEffect` chains. React components own render-time concerns and *provide* the
machines' actors/actions; the machine bodies stay pure. Each machine is a folder — `machine.ts`
(pure orchestration) + `types.ts` + `index.ts` (+ `errors.ts`/actors where present); no inline
actor/action bodies in `machine.ts`.

```
App.tsx           appBootMachine        auth (mid + token) → merchant { themeId, previewOrigin }
 └ ThemeSession   themeSessionMachine   fetch theme structure → pick default (Home) template
    └ TemplateEditor / TranslationEditor
                  templateSession /     load pageConfig + translations + draft + chrome;
                  translationSession    edit → commit-to-preview; validate → save/publish
```

Each layer resets the scope below it.

**`appBootMachine`** — [src/machines/appBoot](../src/machines/appBoot), wired in
[App.tsx](../src/App.tsx):

- `booting` → (`canBoot`) → `authenticating` → `authenticated` | `unauthenticated.{missingToken,invalidToken,networkError,serverError,unknown}`.
- Input comes from the URL: `?mid=…&token=…`, plus `isEmbedded = window.self !== window.top`.
- `canBoot` requires `mid` **and** (iframe-embedded **or** the dev flag
  `VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE=true`). Token is intentionally **not** a boot gate — the real
  "only the dashboard may embed" restriction is the storefront's `frame-ancestors` CSP.
- `authenticate` actor → `EditorAPI.authenticate` → `{ token, merchant: { id, themeId, previewOrigin } }`;
  on success `persistSession` writes [authStore](../src/stores/authStore.ts). Errors map to full-page
  screens via `bootScreen()`; `RETRY` re-enters `authenticating`.

**`themeSessionMachine`** — [src/machines/themeSession](../src/machines/themeSession), wired in
[ThemeSession.tsx](../src/ThemeSession.tsx):

- `bootingTheme` → `fetchThemeStructure(themeId)` → `ready` | `errorLoadingTheme`. On success
  `setTheme` → [themeStore](../src/stores/themeStore.ts); `selectDefaultTemplate` picks the Home template.
- `SWITCH_TEMPLATE` resets all template-scoped state (`clearTemplateScopedState`) then sets the new
  current template — which the child machine's watcher observes to re-boot the template lane.
- Routes to **`TemplateEditor`** when `currentTemplate.isDynamic`, else the deprecated
  **`TranslationEditor`** (see [bridge.md → deprecated translation lane](bridge.md#deprecated-translation-lane)).

**`templateSessionMachine`** — [src/machines/templateSession](../src/machines/templateSession),
wired in [editor-form/containers/TemplateEditor.tsx](../src/editor-form/containers/TemplateEditor.tsx).
The workhorse. It has **two parallel regions** under `editing`:

- **`preview` region** — the iframe render lifecycle: `waitingForIframe` → (`IFRAME_LOADED`) →
  `committingInitial` → `idle` ⇄ `committing` (each `applyConfig` round-trip) → `commitFailed`
  (on `COMMIT_FAILED` or an **8s timeout** on either committing state).
- **`save` region** — publish: `idle` → (`SAVE_REQUESTED`) → `validating` (HTML validation) →
  `savingTemplate` → `savingTranslations` → `saved` (auto-returns to `idle` after **2s**) |
  `saveFailed` | `validationFailed`.

The two regions are independent — a save can validate while the preview region is mid-commit.
A `currentTemplateWatcher` actor subscribes to `themeStore`; a template **or language** change
fires `TEMPLATE_CHANGED`, which re-runs `fetchTemplateData`.

`fetchTemplateData` loads everything needed to edit **in parallel**: common + template translations,
the live `pageConfig`, the **latest draft** (to resume unsaved work — see
[../EDITOR.md §4](../EDITOR.md#4-preview-vs-draft-vs-publish)), and the header/footer "chrome"
templates. Draft precedence: draft `metadata.rawPageConfig` (unresolved `t:` refs) → draft
`pageConfig` → live `pageConfig`.

---

## Stores (Zustand)

| Store | Scope | Holds |
|-------|-------|-------|
| [authStore](../src/stores/authStore.ts) | session | `token`, `merchant` (`{ id, themeId, previewOrigin }`) |
| [themeStore](../src/stores/themeStore.ts) | theme | `theme` structure, `currentTemplate`, `language`, `schemas`/`sections` (published by the iframe via `assets`), `dataSourceEditingSupported` / `previewCodeSync` capabilities |
| [templateStore](../src/stores/templateStore.ts) | template (reset on switch) | `pageConfig`, selection (`selectedSectionId`/`selectedWidgetId`), `expandedSections`, `hasUnsavedChanges`, translations + derived `translationService`, chrome baseline/configs, `htmlValidationErrors`. Its mutators (`updateSection`, `updateWidget`, `addSection`, `moveSection`, `removeSection`, data-source ops) are what push patches over the bridge. |
| [translationStore](../src/stores/translationStore.ts) | template (static lane) | translations only — simpler; **deprecated** lane |
| [editorUiStore](../src/stores/editorUiStore.ts) | session | `device` (desktop/tablet/mobile/fullscreen), `mode` (edit/preview) |

---

## The 4-region layout

[Editor.tsx](../src/Editor.tsx) is a persistent CSS-grid shell that stays mounted across template
and lane switches (so nothing flickers):

```
┌───────────────────────────────────────────────────────────┐
│ header  (theme name · template dropdown · device · Save)   │  ← EditorHeader
├──────────────┬──────────────────────────┬──────────────────┤
│ left sidebar │  preview                  │ right sidebar    │
│ section list │  <iframe> or PreviewMsg   │ settings drawer  │
│ (BuilderTool)│                           │ (mounts on       │
│              │                           │  selection)      │
└──────────────┴──────────────────────────┴──────────────────┘
```

The iframe `src` is built by `buildPreviewUrl(previewOrigin, routeContext.path, …)` and carries
`?editor=true` (plus `previewId`/`version` for shareable previews). Switching templates recomputes
the path and re-points the iframe.

> **Bridge registration races the iframe.** The channel is attached in the iframe **ref callback**,
> before the iframe's own React effects fire — keep it that way or you'll miss `ready`/`assets`.

---

## The editor-form subtree

[src/editor-form](../src/editor-form) is the ported editing UI:

- **containers** — `TemplateEditor` (dynamic lane) and `TranslationEditor` (static lane) provide
  their respective machines and wire the bridge.
- **preview-bridge.ts** / **translation-preview-bridge.ts** — the editor-side wrappers over the
  bridge channel (fast-lane vs commit-lane debouncing, `t:`-ref resolution). See
  [bridge.md](bridge.md#the-two-lanes).
- **services/api.ts** — `EditorAPI`, the `ky` HTTP client for `visual-editor-be` (below).
- **components/ui** — `EditorHeader`, `BuilderToolbar` (section list + add-section), `SettingsSidebar`
  (renders `DynamicForm` from the selected section/widget schema), the field inputs, and dialogs
  (`SectionLibraryDialog`, `GenerateDialog`, `PreviewLinkModal`).
- **services/chat** — the AI HTML generator (below).

---

## Adding, removing, reordering sections

All three are **structural** edits — they mutate `pageConfig` and go through the **commit lane**
(`commitServer` → debounced `applyConfig` → soft-nav re-render), never the fast lane:

```
Add     → "Add Section" chip → SectionLibraryDialog → addSectionFromLibrary(key, afterIndex)
          inserts the section (+ its dataSources) into pageConfig and seeds its translations
          from the section's defaultTranslations
Remove  → SettingsSidebar "Remove section" → removeSection(id) drops it from pageConfig
          (+ removeSectionTranslations)
Reorder → BuilderToolbar drag-and-drop → moveSection(fromId, toId) reorders pageConfig.sections
```

Each mutator ends with `commitServer(pageConfig)`, so the iframe re-renders the full tree with
fresh data (see [../EDITOR.md §3.3](../EDITOR.md#33-structural-change-commit-lane)).

---

## How the form handles translations

Translatability isn't a schema flag — it's decided at **runtime by the value's shape**: a setting
whose value starts with `"t:"` is a translation reference (`isTranslationKey`), anything else is a
plain literal.

- **Display** — `DynamicForm` resolves every `t:` ref to the active-language string via
  `translationService.translateObject()` before handing it to the input, so the merchant edits
  "Welcome", not `t:sections.hero.heading`.
- **Editing a translatable field** — the `t:` key **stays in `pageConfig`**; the new text is written
  to the *translation file* via `updateTranslation()`, which routes it to the `common` or template
  slice using a source map recorded at load time.
- **Editing a plain field** (number, toggle, select, spacing, media URL) — the literal is written
  straight into `settings` (`updateWidgetSettings` / `updateSectionSettings`).
- **New keys** are minted only when a section is added from the library: existing `t:` keys are
  remapped into the new section's scope and backed by entries copied from the section's
  `defaultTranslations`. There's no "make this field translatable" toggle — a field is translatable
  because its section definition seeded it with a `t:` default.

(The render-time and fast-lane sides of `t:` resolution live in
[builder-storefront.md → data model](builder-storefront.md#data-model-reference).)

---

## AI features

The **Generate** dialog lets a merchant author a custom-HTML widget from a prompt (and optionally
an image). The client (`editor-form/services/chat`) builds a system prompt
([html-ai-prompt.ts](../src/editor-form/services/html-ai-prompt.ts): no `<html>/<head>/<body>`, CSS
scoped under `#<sectionId>`, vanilla JS wrapped in try/catch, must pass validation) and calls
`EditorAPI.anthropicMessages` → `visual-editor-be` `POST /api/v1/ai/generate`, which proxies
Anthropic (model pinned client-side as `HTML_AI_MODEL = "claude-sonnet-4-5"`) with structured output
`{ explanation, html }`. Voice input is transcribed via `POST /api/v1/ai/transcribe` (Whisper).
Conversations persist in `localStorage` (key prefix `html-ai-conversation:`).

---

## Backend API (`visual-editor-be`)

`EditorAPI` ([src/editor-form/services/api.ts](../src/editor-form/services/api.ts)) is a `ky` client.
Base URL: `VITE_EDITOR_API_URL`. It attaches `Authorization: Bearer <token>` after boot; **no
retries** (`retry: 0`).

| Purpose | Method (`EditorAPI.*`) | Verb + path |
|---------|------------------------|-------------|
| Authenticate / merchant mapping | `authenticate` | `GET /api/v1/merchants/{mid}` |
| Theme structure | `getThemeStructure` | `GET /api/v1/themes/{themeId}` |
| Template (live pageConfig) | `getTemplate` | `GET /api/v1/themes/{themeId}/templates/{templateId}` |
| Translations | `getTranslation` | `GET /api/v1/themes/{themeId}/translations/{templateId}/{language}` |
| Publish template | `saveTemplate` | `PUT /api/v1/themes/{themeId}/templates/{templateId}` |
| Publish translations | `saveTranslation` | `PUT /api/v1/themes/{themeId}/translations/{templateId}/{language}` |
| Create shareable draft | `getPreviewLink` | `POST /api/v1/getPreviewLink` |
| Read latest draft (resume) | `getLatestPreview` | `GET /api/v1/getPreviewLink?themeId=&templateId=` |
| Delete one draft session | `deletePreview` | `DELETE /api/v1/getPreviewLink/{previewId}` |
| Purge all merchant drafts (on publish) | `deleteMerchantPreviews` | `DELETE /api/v1/getPreviewLink?themeId=` |
| Nav-menu options (menu-handle picker) | `getNavMenuOptions` | `POST /api/v1/merchants/nav-menus` |
| AI generate (Anthropic) | `anthropicMessages` | `POST /api/v1/ai/generate` |
| AI transcribe (Whisper) | `transcribeAudio` | `POST /api/v1/ai/transcribe` |

> **Nav-menus is a backend proxy.** The gokwik nav-menu **list** endpoint sends no CORS headers, so
> the browser can't call it directly. `getNavMenuOptions` posts `{ merchantId }` to
> `visual-editor-be`, which calls gokwik server-side. Best-effort: returns `[]` on failure so the
> field falls back to the saved handle.

> The **legacy** editor instead proxies through same-origin Next routes under
> [apps/storefront-starter/src/app/editor/api](../../../apps/storefront-starter/src/app/editor/api)
> (`templates`, `themes`, `translations`, `anthropic`, `whisper`, `merchant-validation`,
> `data-source-options`).

**Dev preview override:** when `VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE=true`,
`?previewOrigin=http://localhost:4344` points the iframe at a local store (gated to
`localhost`/`127.0.0.1`). Off in production, where the preview always uses the merchant's deployed
URL.
