# ATS v2.1 — Known Patterns (visual-editor scope)

Curated mock + test patterns for the visual-editor app. Mirrors the
root `.ats/patterns.md` but adapted to this app's dependencies (Zustand
stores, XState machines, the editor-bridge channel, @shopkit/i18n).

## Mock Patterns — Pure Functions (used by /ats-generate)

- `localStorage` / `sessionStorage` → handled globally in
  `src/__tests__/setup.ts` (real-backing-store mock). No per-test wiring.
- `@shopkit/i18n` `TranslationService` → use the **real** class. It's a
  pure in-memory lookup (no network), so `buildTranslationService` and
  `translateObject` can be exercised directly.

## Mock Patterns — Stores / Machines / Bridge

| Source Import | Mock Strategy | Example |
|--------------|---------------|---------|
| `zustand` store (`useXStore`) | Direct `getState()` / `setState()`; reset all fields in `beforeEach` | `editorUiStore.test.ts` |
| `xstate` machine | `createActor(machine.provide({ actors, guards }))`; feed events, assert `state.value` / tags | machine tests |
| `@shopkit/editor-bridge` `createChannel` | `vi.mock("@shopkit/editor-bridge")` returning a stub channel (`on`/`send`/`close` = `vi.fn()`) | preview-bridge tests |
| `next/*` | not used in this app (Vite SPA) — N/A | — |

## React Test Type → Template

| File Type | Detection | Test Approach |
|-----------|-----------|--------------|
| **Hook** (`useXxx`) | export starting `use` | `renderHook()` (+ wrapper if a context is required) |
| **Provider** (`XxxProvider`) | component + `useXxx` pair | `render()` for tree + `renderHook()` for context value |
| **Component** (`.tsx`) | JSX-returning export | `render()` with required props; query by role/text |
| **Zustand store** | imports from `zustand` | `getState()` / `setState()`, reset in `beforeEach` |

## Zustand Store Reset Pattern

```ts
beforeEach(() => {
  useXxxStore.setState({ /* all fields → initial values */ });
});
```

## XState Machine Pattern

```ts
import { createActor } from "xstate";
const actor = createActor(
  machine.provide({ actors: { fetchX: fromPromise(async () => stub) } }),
);
actor.start();
actor.send({ type: "EVENT" });
expect(actor.getSnapshot().value).toBe("expectedState");
```

## RTL Best Practices (enforced in generated tests)

- `.toBeInTheDocument()` — never `.toBeDefined()` for DOM queries
- query by role/text/label; reserve `data-testid` for non-semantic nodes
- wrap state updates in `act()`; `vi.waitFor()` for effect-driven state
- clean up in `afterEach` (handled globally by `setup.ts`)

## NEVER Auto-Fix

- `expected X received Y` → assertion mismatch — human decides.
- `Cannot read properties of undefined` → mock gap vs missing null-guard — human decides.
- Snapshot mismatch after first run → API may have changed intentionally — human decides.
