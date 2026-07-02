# How the Editor Works

This is the **map** of the storefront visual editor: what the pieces are, how an edit travels
from a form field to the live preview, and how work is previewed, shared, and published. Read
this file first, then open the module for the layer you're actually touching.

> **Audience:** engineers on `apps/visual-editor`, `packages/editor-bridge`, `packages/builder`,
> or any merchant storefront app that embeds the editor.

## The doc set

| Read this for… | Doc |
|---|---|
| The whole system + end-to-end flows (**start here**) | this file |
| The editor SPA — boot machines, stores, layout, forms, AI, backend API | [docs/editor-app.md](docs/editor-app.md) |
| The `postMessage` bridge — protocol, security, the two lanes, preview cache | [docs/bridge.md](docs/bridge.md) |
| The render side — builder pipeline, templates/chrome, storefront wiring, data model | [docs/builder-storefront.md](docs/builder-storefront.md) |
| The app operating manual (rules, gotchas, commands) | [CLAUDE.md](CLAUDE.md) |
| Bridge **package** internals (deep) | [../../packages/editor-bridge/ARCHITECTURE.md](../../packages/editor-bridge/ARCHITECTURE.md) |

---

## 1. The big picture

The editor is a **standalone React SPA** ([apps/visual-editor](.)) that embeds the merchant's
**live storefront in an `<iframe>`** and drives it over a **typed `postMessage` protocol**
([@shopkit/editor-bridge](../../packages/editor-bridge)). The merchant edits sections and widgets
in the editor's chrome; those edits are pushed into the iframe and rendered by the storefront's
own engine ([@shopkit/builder](../../packages/builder)) — so **the preview is the real
storefront**, not a mock.

```
┌───────────────────────────────────────────────────────────────────────┐
│  apps/visual-editor  (React SPA, editor.example.com)                    │
│                                                                         │
│   ┌──────────┬──────────────────────────────┬────────────────────┐     │
│   │  Header  │  Section list (left sidebar)  │  Settings drawer   │     │
│   ├──────────┴──────────────────────────────┴────────────────────┤     │
│   │        <iframe src="https://store.example.com/?editor=true">   │     │
│   │   ┌───────────────────────────────────────────────────────┐   │     │
│   │   │  The REAL merchant storefront (Next.js + @shopkit/…)   │   │     │
│   │   │  renders pageConfig via @shopkit/builder.              │   │     │
│   │   │  @shopkit/editor-bridge EditorHost runtime listens.    │   │     │
│   │   └───────────────────────────────────────────────────────┘   │     │
│   └────────────────────────────────────────────────────────────────┘   │
│            ▲   postMessage (editor:*)   │                               │
└────────────┼────────────────────────────┼───────────────────────────────┘
             │                            ▼
      select / ready / assets      patchWidget / patchSection /
      rendering / commitFailed      applyConfig / focusSection
```

**Two data planes cross the bridge** (mechanics in [docs/bridge.md](docs/bridge.md)):

- **Fast lane** — per-keystroke `patchWidget` / `patchSection`. The iframe applies them to an
  in-memory override store and re-renders **that widget only** — no network, no navigation.
- **Commit lane** — structural changes (add/remove/move section, data-source edits) send
  `applyConfig { pageConfig }`. The iframe caches the config same-origin and **soft-navigates** so
  the storefront re-renders the full server tree (re-fetching commerce data).

Everything else — auth, theme/template/translation data, drafts, publish, shareable preview links
— is HTTP against the editor backend, **`visual-editor-be`** (API reference in
[docs/editor-app.md](docs/editor-app.md#backend-api-visual-editor-be)).

---

## 2. The moving parts

| Piece | Location | Role | Detail |
|-------|----------|------|--------|
| **Editor app** | [apps/visual-editor](.) | The editor UI. Vite + React 18 + XState 5 + Zustand. Boots, authenticates, loads theme, renders the 4-region editor, drives the preview iframe. | [editor-app.md](docs/editor-app.md) |
| **Editor bridge** | [packages/editor-bridge](../../packages/editor-bridge) | The typed `postMessage` contract + iframe-side runtime (`EditorHost`) + same-origin preview cache + Next.js CSP helpers. | [bridge.md](docs/bridge.md) |
| **Builder** | [packages/builder](../../packages/builder) | The storefront rendering engine. Turns a `pageConfig` into a React tree. | [builder-storefront.md](docs/builder-storefront.md) |
| **Merchant storefront** | [apps/storefront-starter](../../apps/storefront-starter), [apps/momsco](../../apps/momsco), … | A Next.js app that renders with `@shopkit/builder` and mounts `EditorHost`. In dev the iframe points at one of these (e.g. momsco on `:4344`). | [builder-storefront.md](docs/builder-storefront.md#how-a-storefront-wires-the-editor-in) |
| **Data layer** | [packages/data-layer](../../packages/data-layer) | `ICommerceClient` — the commerce backend abstraction the builder fetches products/collections through. | [builder-storefront.md](docs/builder-storefront.md#data-layer) |
| **`visual-editor-be`** | External (`https://visual-editor-be.primathontech.co.in`) | Persists theme structures, templates, translations, draft/preview snapshots. Also proxies AI (Anthropic generate + Whisper transcribe) and the nav-menu list. | [editor-app.md](docs/editor-app.md#backend-api-visual-editor-be) |
| **Legacy editor** | [apps/storefront-starter/src/app/editor](../../apps/storefront-starter/src/app/editor) | The **original** editor (v2.2.0), embedded inside the storefront app (git submodule). The *source* most of `apps/visual-editor`'s form UI was ported from. | [editor-app.md](docs/editor-app.md#legacy-vs-standalone) |

---

## 3. End-to-end flows

These tie the modules together; each arrow crosses a boundary documented in a module above.

### 3.1 Boot

```
/editor?mid=M&token=T
 → appBoot.authenticate → EditorAPI.authenticate → { token, merchant{themeId, previewOrigin} }
 → themeSession.fetchThemeStructure(themeId) → templateStructure[]  (pick Home)
 → TemplateEditor mounts; templateSession.fetchTemplateData loads pageConfig + translations
   + latest draft + chrome
 → iframe mounts at previewOrigin/<path>?editor=true; bridge registered before iframe effects fire
 → iframe sends `assets` (→ themeStore) then `ready` (→ IFRAME_LOADED)
 → requestInitialCommit sends `applyConfig` → iframe caches + soft-navs → `rendering{pending:false}`
   → COMMIT_SETTLED → editor idle, ready to edit
```

### 3.2 Editing a setting (fast lane)

```
type in a field → templateStore.updateWidget(...)
 → preview-bridge resolves "t:" refs → channel.send("patchWidget", { …, settings: resolved })
 → iframe override store patches that widget → re-renders instantly (no fetch, no nav)
```

### 3.3 Structural change (commit lane)

```
add/move/remove section, or edit a data source → templateStore mutator
 → preview-bridge (debounced 150ms) channel.send("applyConfig", { pageConfig })
 → iframe: POST /api/editor-preview/cache { previewKey, pageConfig } → router.replace(?previewKey=…)
 → storefront page.tsx readEditorPreviewState → renderPage(pageConfig) → full re-render w/ fresh data
 → iframe `rendering{pending:false}` → COMMIT_SETTLED   (or `commitFailed` / 8s timeout → commitFailed)
```

### 3.4 Publish

```
click Save → SAVE_REQUESTED → validating (validateAllHtml over CustomHtml widgets)
 → saving: EditorAPI.saveTemplate (PUT …/templates/{id})   ← chrome split out & saved separately if changed
          + EditorAPI.saveTranslations (PUT …/translations/{id}/{lang}, common + template)
          + EditorAPI.deleteMerchantPreviews (purge drafts)
 → saved (auto → idle after 2s); hasUnsavedChanges=false
```

### 3.5 Template switch

```
pick a template → themeSession SWITCH_TEMPLATE → clearTemplateScopedState + setCurrentTemplate
 → currentTemplateWatcher fires TEMPLATE_CHANGED → templateSession re-boots (fetchTemplateData)
 → iframe src recomputed for the new route path → fresh bridge registration
```

---

## 4. Preview vs. draft vs. publish

Three distinct mechanisms — easy to conflate:

1. **Live in-editor preview** (the iframe the merchant edits in). Backed by the **same-origin,
   in-memory** preview cache in `@shopkit/editor-bridge`. Ephemeral (10-min TTL), fast, used on
   every commit-lane change. Never leaves the storefront origin. See
   [bridge.md → preview cache](docs/bridge.md#preview-cache-server-side).

2. **Shareable preview link** ("Save & Preview"). Persists a **draft snapshot** to
   `visual-editor-be` (`POST /api/v1/getPreviewLink` → URL + `previewId` + `version`). Opening that
   URL renders the draft because the storefront's
   [template-load-pipeline.ts](../../apps/storefront-starter/src/editor-integration/template-load-pipeline.ts)
   (Draft Mode + `PREVIEW_ID_COOKIE`) fetches the snapshot. The **same** backend draft is what
   `fetchTemplateData` reads (via `getLatestPreview`) to **resume unsaved work** on reopen.

3. **Publish** (§3.4) writes the template + translations to the live theme and **purges all
   drafts** for the merchant.

So: live preview = ephemeral local cache; draft/shareable = persisted backend snapshot; publish =
live theme write.

---

## 5. Security model

| Threat | Mitigation |
|--------|-----------|
| Malicious page forges bridge messages | `createChannel` requires `event.source === source` **and** origin in `allowedOrigins` |
| `pageConfig`/schemas leak to an unknown embedder | outbound `targetOrigin` is always pinned; `"*"` is never used |
| Clickjacking (someone iframes the storefront) | `frame-ancestors 'self' <editorOrigins>` CSP via `buildFrameAncestorsHeaders` |
| Cache poisoning via the unauthenticated cache POST | **open gap**; 10-min TTL bounds impact |
| Editor boot by non-dashboard origins | prod relies on the storefront's `frame-ancestors` CSP (token is not a boot gate) |

Details: channel filtering in [bridge.md](docs/bridge.md#channel-security), CSP + cache in
[builder-storefront.md](docs/builder-storefront.md#how-a-storefront-wires-the-editor-in) and
[bridge.md](docs/bridge.md#preview-cache-server-side).

---

## 6. Key files

**Editor app** ([editor-app.md](docs/editor-app.md))
- [src/App.tsx](src/App.tsx) — appBoot + auth
- [src/ThemeSession.tsx](src/ThemeSession.tsx) — theme load + lane routing
- [src/Editor.tsx](src/Editor.tsx) — 4-region grid shell
- [src/machines](src/machines) — appBoot / themeSession / templateSession / translationSession
- [src/stores](src/stores) — auth / theme / template / translation / ui
- [src/editor-form/containers/TemplateEditor.tsx](src/editor-form/containers/TemplateEditor.tsx) — dynamic lane + bridge wiring
- [src/editor-form/preview-bridge.ts](src/editor-form/preview-bridge.ts) — editor-side channel + lanes
- [src/editor-form/services/api.ts](src/editor-form/services/api.ts) — `EditorAPI`

**Bridge** ([bridge.md](docs/bridge.md))
- [packages/editor-bridge/src/protocol.ts](../../packages/editor-bridge/src/protocol.ts) — protocol + channel
- [packages/editor-bridge/src/client/EditorHostInner.tsx](../../packages/editor-bridge/src/client/EditorHostInner.tsx) — iframe runtime
- [packages/editor-bridge/src/client/SectionWrapperEditor.tsx](../../packages/editor-bridge/src/client/SectionWrapperEditor.tsx) — select attrs + override merge
- [packages/editor-bridge/src/server/cache-route.ts](../../packages/editor-bridge/src/server/cache-route.ts) / [read-editor-preview-state.ts](../../packages/editor-bridge/src/server/read-editor-preview-state.ts)
- [packages/editor-bridge/ARCHITECTURE.md](../../packages/editor-bridge/ARCHITECTURE.md) — full package docs

**Builder / storefront** ([builder-storefront.md](docs/builder-storefront.md))
- [packages/builder/src/core/engine.ts](../../packages/builder/src/core/engine.ts) — render pipeline
- [packages/builder/src/types/page-config.ts](../../packages/builder/src/types/page-config.ts) — PageConfig / Section / Widget / schemas
- [apps/storefront-starter/src/bootstrap/builder.ts](../../apps/storefront-starter/src/bootstrap/builder.ts) — composition root + editor manifest
- [apps/storefront-starter/src/app/page.tsx](../../apps/storefront-starter/src/app/page.tsx) — `readEditorPreviewState` → `renderPage`
- [apps/storefront-starter/src/editor-integration](../../apps/storefront-starter/src/editor-integration) — `EditorHostMount`, template-load-pipeline, config

**Legacy editor**
- [apps/storefront-starter/src/app/editor](../../apps/storefront-starter/src/app/editor) — embedded v2.2.0 editor (submodule)
