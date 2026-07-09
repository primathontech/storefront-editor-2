# The bridge (`@shopkit/editor-bridge`)

The typed `postMessage` contract between the editor SPA and the storefront iframe, plus the
iframe-side runtime and the same-origin preview cache. This is the working summary; the package's
own deep docs are in
[../../../packages/editor-bridge/ARCHITECTURE.md](../../../packages/editor-bridge/ARCHITECTURE.md).
Overview is in [../EDITOR.md](../EDITOR.md).

## Contents

- [Protocol](#protocol)
- [Channel security](#channel-security)
- [The two lanes](#the-two-lanes)
- [Preview cache (server side)](#preview-cache-server-side)
- [Deprecated translation lane](#deprecated-translation-lane)

---

## Protocol

One source of truth — [protocol.ts](../../../packages/editor-bridge/src/protocol.ts). Every message
is `{ type: "editor:<name>", payload }` over `window.postMessage`. `PROTOCOL_VERSION = 1`; the iframe
announces it in `ready` and the editor stalls on mismatch.

**Editor → iframe**

| Message | Payload | Lane |
|---------|---------|------|
| `patchWidget` | `{ sectionId, widgetId, settings }` | Fast (per-keystroke) |
| `patchSection` | `{ sectionId, settings }` | Fast |
| `focusSection` | `{ sectionId: string \| null, widgetId? }` | Immediate (highlight + scroll; `null` clears) |
| `applyConfig` | `{ pageConfig }` | Commit (triggers soft-nav) |
| `requestDataSourceOptions` | `{ requestId, source: "collections"\|"products" }` | Request/reply |
| `patchTranslations` | `{ language, translations }` | **Deprecated** (static lane) |
| `focusTranslationKey` | `{ key }` | **Deprecated** |

**Iframe → editor**

| Message | Payload |
|---------|---------|
| `ready` | `{ version, capabilities?: { dataSourceOptions?, previewCodeSync? } }` |
| `assets` | `{ widgetSchemas, availableSections }` (the editor's form schemas + section library) |
| `select` | `{ target: SelectionTarget \| null }` |
| `rendering` | `{ pending: boolean }` (soft-nav progress) |
| `commitFailed` | `{ reason }` |
| `dataSourceOptions` | `{ requestId, source, items, error? }` |
| `selectTranslationKey` | `{ key: string \| null }` (**deprecated**) |

`capabilities` lets the editor gate additive features **per-storefront without bumping the protocol
version**: `dataSourceOptions` (merchant wired `fetchDataSourceOptions` → show the data-source
pickers) and `previewCodeSync` (storefront has the preview code → enable the shareable-preview
button). Un-migrated storefronts simply omit the flag. Additive changes (new messages, optional
fields) keep the same version; only rename/remove/restructure bumps it.

---

## Channel security

`createChannel` filters **inbound** on *both* `event.source === opts.source` **and**
`allowedOrigins.includes(event.origin)` (either alone is leakable), and pins **outbound**
`targetOrigin` — it **never** falls back to `"*"`, so `pageConfig`/schemas can't leak to a malicious
embedder. This is the same channel used on both sides; the editor-side wrapper is
[preview-bridge.ts](../src/editor-form/preview-bridge.ts).

---

## The two lanes

The iframe side is `EditorHost` — a tiny gate (~500 B) mounted **once** in the storefront layout
that only lazy-loads the real runtime (`EditorHostInner`) when `?editor=true`. On normal customer
traffic the runtime never loads **and** the override store below stays empty, so the section wrapper
is inert — customers pay effectively nothing for the editor being wired in. The runtime:

- **Fast lane:** `patchWidget`/`patchSection` → a Zustand **override store** keyed
  `sectionId[:widgetId]`, read through per-key selectors → only the patched widget re-renders.
  `SectionWrapperEditor` shallow-merges the override on top of `section.settings`. No navigation,
  no fetch.
- **Commit lane:** on `applyConfig`, `EditorHostInner` mints a `previewKey`, `POST`s
  `{ previewKey, pageConfig }` same-origin to `/api/editor-preview/cache`, then
  `router.replace(?editor=true&previewKey=…)` — a soft-nav so the RSC re-renders with the cached
  config (re-fetching commerce data). It reports progress back via `rendering { pending }` and
  failure via `commitFailed`. In-flight commits are aborted when a newer one starts.

`SectionWrapperEditor` also stamps `data-section-id`/`data-section-type` and
`data-widget-id`/`data-widget-type` on the DOM; the runtime's capture-phase pointer listeners read
those to implement click-to-select (`select`) and the hover/selection overlay. (Wiring on the
storefront side — mounting the wrapper, the "use client" editor manifest — is in
[builder-storefront.md](builder-storefront.md#how-a-storefront-wires-the-editor-in).)

---

## Preview cache (server side)

`createPreviewCacheRoute()` (writer) and `readEditorPreviewState()` (reader) share an **in-memory
singleton** inside the package (**TTL 10 min, max 1000 entries, FIFO eviction**) — no merchant
wiring needed beyond exporting the route. The route path `/api/editor-preview/cache` is part of the
contract (`EditorHostInner` hardcodes it).

> **Auth gap:** the cache `POST` is currently **unauthenticated** — non-browser clients can `POST`
> to it. Same-origin + the 10-minute TTL bound the blast radius.

---

## Deprecated translation lane

Static templates route to `TranslationEditor` + `translationSessionMachine`
([src/machines/translationSession](../src/machines/translationSession)) — a simpler flow: no HTML
validation, no commit/soft-nav. Translation patches are fire-and-forget (`patchTranslations`) with
two-way key focus (`focusTranslationKey` ⇄ `selectTranslationKey`). The messages, the
`translations`/`focusedTranslationKey` override-store slices, and `@shopkit/editor-bridge/static` are
all `@deprecated` and remain only until static templates are removed from the product. **Don't build
new features on this lane.**
