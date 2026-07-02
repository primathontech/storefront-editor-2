# Claude Code Instructions for the Visual Editor

`apps/visual-editor` is a **standalone React SPA** (Vite + React 18 + XState 5 + Zustand) that
embeds a merchant's **live storefront in an `<iframe>`** and drives it over a typed `postMessage`
bridge. The preview *is* the real storefront — not a mock. This file is the operating manual for
working in this app; read the linked docs before non-trivial work.

---

## Required Reading Before Any Task

1. **[EDITOR.md](EDITOR.md)** — the doc-set map + end-to-end flows (boot → edit → preview →
   publish). **Start here**, then open the module for your layer: [docs/editor-app.md](docs/editor-app.md)
   (boot machines / stores / forms / backend API), [docs/bridge.md](docs/bridge.md) (protocol /
   lanes / preview cache), [docs/builder-storefront.md](docs/builder-storefront.md) (render pipeline
   / storefront wiring / data model).
2. **[packages/editor-bridge/ARCHITECTURE.md](../../packages/editor-bridge/ARCHITECTURE.md)** — the
   bridge **package** internals (deeper than `docs/bridge.md`).
3. **[AGENTS.md](../../AGENTS.md)** (repo root) — package APIs (`@shopkit/*`) and common patterns.
4. **[packages/builder](../../packages/builder)** — the rendering engine that turns a `pageConfig`
   into the storefront DOM the iframe shows.

> Use **`bun`** for everything (never `pnpm`/`npm`). This is a workspace app — most commands run
> from this directory, but package builds go through Turbo at the repo root.

---

## Quick Reference

| I want to… | Look at |
| --- | --- |
| Understand the whole system | [EDITOR.md](EDITOR.md) |
| Understand the boot/auth/save flows | `src/machines/*` (XState) + [docs/editor-app.md](docs/editor-app.md#boot-is-a-cascade-of-xstate-machines) |
| Change what a setting-edit does to the preview | [src/editor-form/preview-bridge.ts](src/editor-form/preview-bridge.ts) |
| Change a backend call | [src/editor-form/services/api.ts](src/editor-form/services/api.ts) (`EditorAPI`) |
| Change the bridge message shapes | [packages/editor-bridge/src/protocol.ts](../../packages/editor-bridge/src/protocol.ts) (bump `PROTOCOL_VERSION` only on breaking changes) |
| Add/adjust a settings-form field type | `src/editor-form/components/ui/` (`DynamicForm` + `*Input`) |
| Change the editor layout | [src/Editor.tsx](src/Editor.tsx) (4-region grid) |
| Change the section-list / add-section UI | `src/editor-form/components/ui/BuilderToolbar.tsx`, `SectionLibraryDialog.tsx` |
| Touch AI HTML generation | `src/editor-form/services/chat/` + `html-ai-prompt.ts` |

---

## Essential Commands

```bash
# From apps/visual-editor/
bun run dev              # Vite dev server (the editor SPA)
bun run typecheck        # tsc -b --noEmit
bun run lint             # eslint .
bun run test             # vitest run (unit + machine + store + contract tests)
bun run test:watch       # vitest watch
bun run test:coverage    # vitest run --coverage
bun run test:e2e         # Playwright (needs the BE + a storefront running — see below)

# From the repo root (Turbo)
bun run dev:visual-editor    # turbo run dev --filter=visual-editor
```

**To run the editor locally you also need a storefront to preview.** Start one (e.g.
`cd apps/momsco && bun run dev`, listens on `:4344`) and open the editor with the dev preview
override (below). E2E specs in `e2e/` run against the **live** `visual-editor-be` and a local
storefront, and skip (not fail) if either is down.

---

## How It Boots (mental model)

Async orchestration is **XState**, not `useEffect` chains: three nested machines — `appBoot` →
`themeSession` → `templateSession` — each resetting the scope below it. `canBoot` needs `mid`
**and** (iframe-embedded **or** `VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE=true`); the token is **not** a
boot gate. `templateSession` runs parallel `preview` (iframe render lifecycle) and `save`
(validate → publish) regions. Full cascade, states, guards, and the Zustand stores →
**[docs/editor-app.md](docs/editor-app.md#boot-is-a-cascade-of-xstate-machines)**.

---

## The Two Bridge Lanes (know which you're touching)

Edits reach the iframe two ways ([src/editor-form/preview-bridge.ts](src/editor-form/preview-bridge.ts)):
the **fast lane** (`patchWidget`/`patchSection`, per-keystroke, no debounce → the iframe re-renders
just that widget, no network) for setting values; the **commit lane** (`applyConfig`, debounced
150ms → same-origin cache + soft-nav, full re-render) for structural changes (add/move/remove
section, data-source edits). Mechanics, `t:` resolution, and channel security →
**[docs/bridge.md](docs/bridge.md#the-two-lanes)**.

---

## Architecture Rules (this app)

1. **XState for orchestration, hooks for render.** Boot/auth/bridge/save/commit flows are state
   machines. Don't reach for `useEffect` chains to sequence async work. Keep machine bodies pure —
   provide `actors`/`actions`/`guards` at the React layer (see `App.tsx`, `ThemeSession.tsx`,
   `TemplateEditor.tsx`).
2. **Machine file layout.** Each machine is a folder: `machine.ts` (pure orchestration) +
   `types.ts` + `index.ts` (+ actors/actions where present). No inline actor/action bodies in
   `machine.ts`.
3. **Tailwind for new components.** New UI uses Tailwind utilities. Do **not** migrate the legacy
   ported `*.module.css` components (in `editor-form/`) to Tailwind without asking — match their
   look by eye.
4. **`@shopkit/*` packages take config as params.** Only this app reads `import.meta.env`
   (`VITE_*`). Never add consumer-specific env reads or hardcoded fallbacks inside a package.
5. **Protocol discipline.** The bridge contract is
   [packages/editor-bridge/src/protocol.ts](../../packages/editor-bridge/src/protocol.ts). Additive
   changes (new messages, optional fields) keep the same `PROTOCOL_VERSION`; only rename/remove/
   restructure bumps it. Both sides must agree — the iframe announces its version in `ready`.
6. **Single React instance.** `vite.config.ts` dedupes `react`/`react-dom` because workspace
   packages can drag in their own copy — don't undo that.
7. **`editor-form/` is ported legacy code.** ~90% of the form UI (`DynamicForm`, inputs,
   `section-registry`, `schema-converter`, `htmlValidation`, `ai-utils`) came from the legacy
   embedded editor ([apps/storefront-starter/src/app/editor](../../apps/storefront-starter/src/app/editor)).
   When porting more, **drop flags/checks that only existed for the shared-app context** — this app
   is standalone.

---

## Gotchas

- **Preview cache POST is unauthenticated.** Same-origin, 10-min TTL bounds it — don't
  rely on it for auth'd state.
- **Dev preview override:** with `VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE=true`, add
  `?previewOrigin=http://localhost:4344` to point the iframe at a local storefront (gated to
  `localhost`/`127.0.0.1`). Off in prod — the preview uses the merchant's deployed URL.
- **Bridge registration races the iframe.** The channel is attached in the iframe **ref callback**,
  before the iframe's own React effects fire — keep it that way or you'll miss `ready`/`assets`.
- **`header`/`footer` are "chrome"** templates, merged into `pageConfig.sections` for preview and
  split back out on save. They're hidden from the template picker.
- **Static/translation lane is deprecated.** `TranslationEditor`, `translationSessionMachine`,
  `patchTranslations`/`focusTranslationKey`, and `@shopkit/editor-bridge/static` are on the
  retirement path. Don't build new features on them.

---

## Key Files

| Path | Role |
| --- | --- |
| [src/App.tsx](src/App.tsx) | appBoot machine + auth screens |
| [src/ThemeSession.tsx](src/ThemeSession.tsx) | theme load + dynamic/static lane routing |
| [src/Editor.tsx](src/Editor.tsx) | persistent 4-region grid shell |
| [src/machines](src/machines) | `appBoot` / `themeSession` / `templateSession` / `translationSession` |
| [src/stores](src/stores) | Zustand: auth / theme / template / translation / ui |
| [src/editor-form/containers/TemplateEditor.tsx](src/editor-form/containers/TemplateEditor.tsx) | dynamic lane + iframe + bridge wiring |
| [src/editor-form/preview-bridge.ts](src/editor-form/preview-bridge.ts) | editor-side channel, fast/commit lanes, `t:` resolution |
| [src/editor-form/services/api.ts](src/editor-form/services/api.ts) | `EditorAPI` — `ky` client for `visual-editor-be` |
| [src/editor-form/components/ui/](src/editor-form/components/ui) | `EditorHeader`, `BuilderToolbar`, `SettingsSidebar`, `DynamicForm`, field inputs, dialogs |
| [src/editor-form/services/chat/](src/editor-form/services/chat) | AI custom-HTML generation |
| [e2e/](e2e) | Playwright specs against the real BE + a local storefront |

---

## Before You Code

- [ ] Read [EDITOR.md](EDITOR.md) for the relevant flow.
- [ ] Is this orchestration (→ a machine) or render state (→ a hook/store)?
- [ ] Fast lane or commit lane? (setting value vs. structural change)
- [ ] If touching the protocol, does it belong in `protocol.ts`, and does the version need to move?
- [ ] Am I following the existing machine folder layout and Tailwind-for-new-code rule?
- [ ] Run `bun run typecheck` and `bun run test` before committing.
