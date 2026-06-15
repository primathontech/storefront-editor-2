# Visual Editor — End-to-End Tests

Playwright e2e tests for the visual editor. They drive the **real editor** against the
**real `visual-editor-be` backend** and a **real storefront** rendered in the preview
iframe — no `/api/v1` mocks. The only stubbed things are a few documented failure paths
(see [Documented mocks](#documented-mocks)).

- **97 tests** across 7 spec files in [`specs/`](./specs).
- Test harness + page object: [`support/real-test.ts`](./support/real-test.ts).
- Target/boot config: [`target.config.ts`](./target.config.ts) and [`../playwright.config.ts`](../playwright.config.ts).
- Source-of-truth case list: [`../../../temp-end-to-endtestcase`](../../../temp-end-to-endtestcase) (repo root).

---

## 1. Prerequisites — three moving parts

The editor loads a merchant's storefront inside an iframe and talks to a backend, so a
run needs **all three** reachable:

| Part | Default | Who starts it |
|------|---------|---------------|
| **Editor** (Vite app, the thing under test) | `http://localhost:5173` | Playwright's `webServer` auto-starts it (reuses an existing one locally) |
| **Storefront** (the merchant site shown in the iframe) | `http://localhost:4344` (momsco) | Playwright `webServer` auto-starts it, or run it yourself |
| **Backend** (`visual-editor-be`) | `https://visual-editor-be.primathontech.co.in` | Already deployed — nothing to start |

> The storefront is a **Next.js dev server** and **cold-compiles its routes on the first
> request**, which can take 10–30s. The suite's preflight retries (see
> [Why tests skip](#5-why-tests-skip)), so this is handled — but a full 97-test sweep puts
> real load on that single dev server.

Start the storefront manually if you prefer:
```bash
cd apps/momsco && bun run dev   # listens on :4344
```

---

## 2. How to run

All commands run from `apps/visual-editor`.

```bash
# Full suite (all 97 tests). webServer auto-boots editor + storefront if needed.
bun run test:e2e

# A single batch — RECOMMENDED for day-to-day (lighter load, faster, more reliable)
bun run test:e2e -- e2e/specs/03-editor-real.spec.ts

# A single test by line number
bun run test:e2e -- e2e/specs/01-editor-core.spec.ts:243

# Watch it run in a real browser
bun run test:e2e:headed

# Interactive UI mode (pick/replay tests, time-travel)
bun run test:e2e:ui

# Step-through debugger (Playwright Inspector)
bun run test:e2e:debug

# Open the HTML report from the last run
bun run test:e2e:report
```

Notes:
- Tests run **serially** (`workers: 1`) — the bridge state is page-global, so parallelism is off.
- Per-test timeout is **45s**; `expect()` polls default to **10s**.
- Locally `retries: 0`; in CI `retries: 2`.

> **Tip:** for routine work, run **one file at a time** (10–20 tests). The full
> `bun run test:e2e` stresses the single storefront dev server hardest and is best saved
> for a final check.

---

## 3. Setting the merchant / storefront website

The editor is **multi-tenant**: it has **no merchant id in its env** — it reads `mid` from
the URL at runtime ([`src/App.tsx`](../src/App.tsx)). An e2e test simply opens the editor
as a merchant session: `/?mid=<X>&token=<Y>&previewOrigin=<Z>`.

So **the test run** chooses which merchant to verify, via these env vars (all optional —
they override defaults baked into [`support/real-test.ts`](./support/real-test.ts) and
[`target.config.ts`](./target.config.ts)):

| Env var | What it sets | Default |
|---------|--------------|---------|
| `E2E_REAL_MID` | **Which merchant** the test drives (`?mid=`) | `19arhposfw3y` (momsco QA) |
| `E2E_REAL_TOKEN` | Auth bearer (dev BE accepts any) | `e2e-real` |
| `E2E_REAL_PREVIEW_ORIGIN` | Storefront URL the iframe loads (`?previewOrigin=`) | `http://localhost:4344` |
| `E2E_PREVIEW_ORIGIN` | URL the `webServer` boots/health-checks | `http://localhost:4344` |
| `E2E_STOREFRONT_CMD` | Command to start the storefront | `bun run dev` |
| `E2E_STOREFRONT_CWD` | Working dir for that command | `../momsco` |
| `E2E_EDITOR_PORT` | Editor (Vite) port | `5173` |
| `E2E_SKIP_SAVE` | Skip the destructive Save tests (files 05–07) | unset |

### You do NOT have to use env at all
If you set nothing, the suite uses the **default merchant `19arhposfw3y`** hardcoded in
`support/real-test.ts`. Env vars only *override* that constant. To permanently change the
target merchant, edit that one constant — the editor deployment is never touched.

### Point at a merchant's LOCAL storefront
```bash
E2E_REAL_MID=<merchant_id> \
E2E_REAL_PREVIEW_ORIGIN=http://localhost:3001 \
E2E_PREVIEW_ORIGIN=http://localhost:3001 \
E2E_STOREFRONT_CWD=../<that-app> \
bun run test:e2e
```

### Point at a merchant's DEPLOYED storefront
```bash
E2E_REAL_MID=<merchant_id> \
E2E_REAL_PREVIEW_ORIGIN=https://shop.example.com \
E2E_PREVIEW_ORIGIN=https://shop.example.com \
bun run test:e2e
```

> ⚠️ **Security gate:** the `?previewOrigin=` override is honored **only for
> `localhost`/`127.0.0.1`** ([`api.ts` `pickPreviewOrigin`](../src/editor-form/services/api.ts)).
> For a **deployed** URL the override is ignored and the editor uses the **backend-registered
> `merchant.url` for that `mid`** — so for remote stores you really select the merchant by
> **`mid`**, not by injecting a raw URL.

> ⚠️ **Theme assumptions:** files 05–07 (and parts of 02–03) hardcode the **`dawn`** theme
> (`THEME_ID`, `"Products (Default)"`, `HeroSlideshow`, `"Autoplay interval (ms)"`, …). A
> merchant on `dawn` works; a different theme makes those tests fail or `test.skip`. `BE_URL`
> is also hardcoded per file.

---

## 4. How to check the results

**Live output** — the `list` reporter prints a ✓/✘ line per test and a summary
(`X passed / Y failed / Z skipped`).

**HTML report** (screenshots, traces, step timeline) — written to `e2e/.report/`:
```bash
bun run test:e2e:report          # opens the last report
# or directly:
npx playwright show-report e2e/.report
```

**Failure artifacts** — on a failed test, Playwright writes to `test-results/<test>/`:
- `test-failed-1.png` — screenshot at failure
- `video.webm` — full run video
- `error-context.md` — the error + a page snapshot (great for "what was on screen")
- a trace (when `retries > 0`, e.g. in CI) — view with `npx playwright show-trace <trace.zip>`

> `e2e/.report/` and `test-results/` are **gitignored** and regenerated every run — safe to
> delete anytime.

---

## 5. Why tests skip

Each spec's `beforeAll` checks the backend + storefront are reachable using
**`waitForUpstream`** (retries ~6×8s, riding out Next.js cold-compile / restarts). If an
upstream is genuinely down after the full budget, `beforeEach` calls `test.skip(...)` with a
clear "bring this back up" message for **every test in that file** — so an outage produces
**SKIPPED, not FAILED**.

Other intentional skips:
- `test.skip(!heroId, "no hero/slideshow section")` — a case needs a slideshow the merchant
  doesn't have.
- `E2E_SKIP_SAVE=1` — opts out of the destructive Save block (files 05–07).
- One permanent placeholder: **case 73 "(Future) Preview shows unsaved edits"** — a feature
  not yet implemented.

If a **whole batch** skips, the storefront or BE was unreachable at that file's preflight —
not a code problem.

---

## 6. Test layout & conventions

| File | Cases | Focus |
|------|-------|-------|
| [`01-editor-core.spec.ts`](./specs/01-editor-core.spec.ts) | 1–10 | Boot, auth, theme name, template dropdown, console health |
| [`02-editor-real.spec.ts`](./specs/02-editor-real.spec.ts) | 11–20 | Template switching, sidebar, section ordering |
| [`03-editor-real.spec.ts`](./specs/03-editor-real.spec.ts) | 21–30 | Selection sync (sidebar ↔ iframe), drawer, visibility |
| [`04-editor-real.spec.ts`](./specs/04-editor-real.spec.ts) | 31–50 | Visibility per device, drag reorder, config-panel fields |
| [`05-editor-real.spec.ts`](./specs/05-editor-real.spec.ts) | 51–70 | Field boundaries, device modes, **destructive Save** round-trips |
| [`06-editor-real.spec.ts`](./specs/06-editor-real.spec.ts) | 71–81 | Preview, propagation, end-to-end happy path, multi-device save |
| [`07-editor-real-ai.spec.ts`](./specs/07-editor-real-ai.spec.ts) | 82–97 | AI-generated sections flow |

Conventions (match these when adding cases):
- Use the `realTest` harness from `support/real-test.ts`; reuse its `RealEditor` page object.
- Each test opens with a comment block: **`Logic:`** (numbered steps) and **`Why real-only:`**.
- Boot with `await editor.open()` then `await editor.waitForIframeReady()` (the latter waits
  for the editor↔iframe bridge to actually mount — don't interact before it).
- **No hardcoded mutation literals** in Save tests — compute values relative to the captured
  baseline, or a crashed revert poisons the real merchant data on the next run.
- Per-device spacing baselines are **theme-defined** (e.g. dawn mobile padding = 11px), not 0.

### Destructive Save tests (files 05–07)
These actually **persist to the live merchant** via the editor's Save. Every such test follows
**mutate → Save → assert → revert → Save**, and an `afterAll` re-fetches a fingerprint to flag
any state a crashed test left dirty. To skip them entirely: `E2E_SKIP_SAVE=1`.

### <a name="documented-mocks"></a>Documented mock exceptions
Only failure paths the real backend can't safely produce are stubbed (each justified in-test):
- **Cases 5 & 6b** — force a `401` on `/api/v1/merchants/**` (the dev BE accepts any token).
- **Case 7** — point `previewOrigin` at a dead port (`http://127.0.0.1:1`) to test a broken iframe.
- **Case 67** — one-shot `500` on the Save `PUT` to test the failed-Save UI.
- **File 07** — a deterministic stub on `api.anthropic.com` so the AI flow is reproducible.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| A whole file (e.g. "first 10") **skipped** | Storefront/BE was down at preflight. Ensure `:4344` and the BE respond, then re-run. The retrying preflight handles cold-compile; a hard skip means it was truly unreachable. |
| `EADDRINUSE` on `:4344` / flaky storefront | A second storefront instance is fighting for the port. Kill duplicates: `lsof -ti :4344` then `kill`, leaving one. |
| Failure mentions `Network Error` / `Failed to load resource` / `app-pages-browser` | Storefront-side noise (its own API/asset calls failing in the test env). Case 4 already filters these to the **editor frame**; if you see it elsewhere it's the merchant store, not the editor. |
| `waitForIframeReady` times out | Storefront slow/unreachable, or the editor↔iframe bridge didn't connect. Confirm the storefront renders the editor-bridge markers in editor mode. |
| Full `test:e2e` flaky but single files pass | The 97-test sweep overloads the storefront dev server. Run per-file (see §2). |

---

## 8. TL;DR

```bash
# from apps/visual-editor — uses default momsco QA merchant on localhost:4344
bun run test:e2e -- e2e/specs/01-editor-core.spec.ts   # one batch
bun run test:e2e                                        # everything
bun run test:e2e:report                                 # view results

# target a different merchant (same dawn theme):
E2E_REAL_MID=<mid> E2E_REAL_PREVIEW_ORIGIN=<storefront-url> \
E2E_PREVIEW_ORIGIN=<storefront-url> bun run test:e2e
```
