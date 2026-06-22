# Visual Editor — Unit Test Coverage Report

**Project:** storefront-builder / `apps/visual-editor`
**Branch:** `unit-end-to-end-testcases`
**Date:** 2026-06-21
**Tooling:** Vitest 1.6 + v8 coverage provider

---

## Headline numbers

| Metric | Coverage | Covered / Total |
|---|---:|---:|
| **Statements** | **87.6%** | 10,065 / 11,489 |
| **Branches** | **84.0%** | 1,219 / 1,452 |
| **Functions** | **84.3%** | 274 / 325 |
| **Lines** | **87.6%** | — |

**Test suite:** 62 test files · **665 tests** · **100% passing** · ~8s runtime.

Coverage is measured across 93 source files (`src/**/*.ts`, `src/**/*.tsx`);
test files, type declarations, and the app entrypoint are excluded.

---

## Coverage by module

| Module | Files | Stmts % | Branch % | Funcs % |
|---|---:|---:|---:|---:|
| editor-form/context | 1 | 100.0 | 100.0 | 100.0 |
| editor-form/hooks | 1 | 100.0 | 100.0 | 100.0 |
| editor-form/models | 1 | 100.0 | 100.0 | 100.0 |
| editor-form/schemas | 2 | 100.0 | 100.0 | 100.0 |
| editor-form (top) | 2 | 98.0 | 80.0 | 100.0 |
| editor-form/services | 5 | 97.9 | 86.4 | 100.0 |
| machines (state machines) | 9 | 94.9 | 100.0 | 45.5 |
| editor-form/components | 50 | 92.2 | 88.0 | 94.1 |
| components | 4 | 89.7 | 95.0 | 100.0 |
| editor-form/utils | 8 | 85.1 | 83.1 | 95.2 |
| stores | 5 | 84.6 | 68.2 | 85.1 |
| editor-form/containers | 2 | 59.6 | 72.9 | 20.0 |
| src (app root) | 3 | 27.5 | 75.0 | 33.3 |
| **Total** | **93** | **87.6** | **84.0** | **84.3** |

---

## Highlights

- **Core business logic is well covered.** The API/HTTP boundary
  (`editor-form/services`, 97.9%), schemas, models, hooks, and context
  providers are at or near 100%.
- **UI component library** (50 files) sits at 92% statements, including the
  full design-system primitives (Button, Input, Modal, Dropdown, etc.).
- **State machines** (XState boot/session machines) are at 94.9% statements
  with 100% branch coverage. The lower "functions" figure is an artifact:
  the machine files define stub guards/actions that are provided real bodies
  at the `App.tsx` layer, so those bodies are exercised in app-level tests
  rather than counted against the machine file.

## Known gaps (tracked for follow-up)

These are pre-existing areas, not regressions, and are candidates for the next
testing iteration:

| Area | Stmts % | Note |
|---|---:|---|
| `src` app root (`App.tsx`, `Editor.tsx` wiring) | 27.5 | Top-level composition/bootstrap wiring |
| `editor-form/containers` (Template/Translation editors) | 59.6 | Large container components; partial path coverage |
| `editor-form/utils/htmlValidation.ts` | ~53 | Validation edge cases |
| `editor-form/utils/ai-utils.ts` | ~71 | AI helper branches |
| `stores/templateStore.ts` | ~80 | Some store actions/edge paths |

---

## How this was generated

```bash
cd apps/visual-editor
npm run test:coverage        # vitest run --coverage
```

A full, browsable HTML report (line-by-line highlighting) is generated at
`apps/visual-editor/coverage/index.html`.

A minimum-coverage threshold gate is configured in `vitest.config.ts` and the
suite runs automatically on every commit via the pre-commit hook.
