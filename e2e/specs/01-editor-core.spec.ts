// Editor core — cases 1-10, real-platform.
//
// These run against the live visual-editor-be deployment and the live
// storefront at http://localhost:4344. NOTHING about the theme/template/
// merchant DATA is mocked — the editor authenticates with a real Bearer
// token, fetches the real `dawn` theme, pulls the real pageConfig, and the
// iframe renders the actual storefront DOM. Every expectation (store name,
// template labels, route paths, option count) is DERIVED at runtime from the
// same `GET /api/v1/themes/dawn` response the editor consumes — see the
// beforeAll preflight. There are no hardcoded theme fixtures.
//
// The ONLY interception in this file is a minimal HTTP-status override on the
// `/api/v1/merchants/` call for cases 5 and 6b: the real dev backend accepts
// any Bearer token (see support/real-test.ts) so it can never return 401, and
// the Unauthorized screen would otherwise be untestable. That override forces
// ONLY the status code — it invents no theme or merchant body. This is the
// documented "failure-mode the real BE can't safely produce" exception.
//
// Each test explains its Logic (numbered steps) and Why real-only.
//
// Read-only by design: no test clicks Save, so the suite never mutates real
// merchant state.
import {
  realTest as test,
  expect,
  realEnv,
  waitForUpstream,
} from "../support/real-test";

test.describe.configure({ mode: "serial" });

// The real-platform suite depends on (a) the deployed visual-editor-be and
// (b) the local storefront. If either is unreachable the suite is SKIPPED —
// not failed — because there is nothing the editor can do about an upstream
// outage. The preflight below makes the cause explicit AND captures the live
// theme so the data-driven cases assert against real values.
const BE_URL = "https://visual-editor-be.primathontech.co.in";

// A port guaranteed to have no listener (RFC 6335 reserves <=1023 for system
// services; nothing legitimate binds :1 in dev/CI). Drives the unreachable-
// previewOrigin case without mocking the merchant response.
const UNREACHABLE_ORIGIN = "http://127.0.0.1:1";

// Mirror of src/editor-form/utils/preview-route.ts `isUnhydratedPath`: a path
// is unhydrated (placeholder, not previewable) if it carries a Next bracket
// (/products/[handle]) or colon (/products/:handle) segment. Replicated here
// — not imported — to keep the e2e build decoupled from editor source.
const isUnhydratedPath = (path: unknown): boolean =>
  typeof path === "string" &&
  (/\[[^\]]+\]/.test(path) || /:[A-Za-z]/.test(path));

interface LiveTemplate {
  label: string;
  path: string | undefined;
}

let backendUp = false;
let storefrontUp = false;
// Live values derived from the real dawn theme (populated in beforeAll).
let themeName = "";
let allTemplates: LiveTemplate[] = [];
// Templates with a concrete, non-root path — the ones case 10 can switch to
// and verify a distinct iframe URL for.
let walkTemplates: LiveTemplate[] = [];

test.beforeAll(async ({ request }) => {
  // Retry both upstreams — a single-shot ping skipped whole files when the
  // storefront dev server was cold-compiling its first route (see
  // waitForUpstream). Only declare "down" after the full retry budget.
  backendUp = await waitForUpstream(request, `${BE_URL}/api/v1/themes/dawn`);
  storefrontUp = await waitForUpstream(request, realEnv.previewOrigin);

  if (backendUp) {
    try {
      const r = await request.get(`${BE_URL}/api/v1/themes/dawn`, {
        timeout: 8_000,
      });
      const body = (await r.json()) as {
        data?: { theme?: { name?: string; id?: string; templateStructure?: Array<{ templates?: Array<{ id: string; name?: string; routeContext?: { path?: string } }> }> } };
      };
      const theme = body?.data?.theme;
      themeName = theme?.name || theme?.id || "";
      allTemplates = (theme?.templateStructure ?? []).flatMap((g) =>
        (g.templates ?? []).map((t) => ({
          label: t.name ?? t.id,
          path: t.routeContext?.path,
        })),
      );
      walkTemplates = allTemplates.filter(
        (t) =>
          typeof t.path === "string" &&
          t.path !== "/" &&
          !isUnhydratedPath(t.path),
      );
    } catch {
      // reachable a moment ago but the body fetch hiccuped — leave the
      // derived lists empty; the dependent cases assert length>0 and fail
      // loudly rather than silently passing.
    }
  }
});

test.beforeEach(() => {
  test.skip(
    !backendUp,
    `visual-editor-be at ${BE_URL} is unreachable — skipping real-platform suite. ` +
      `Wait for the service to come back or try again later.`,
  );
  test.skip(
    !storefrontUp,
    `storefront at ${realEnv.previewOrigin} is not running — start it ` +
      `with \`cd apps/momsco && bun run dev\` (it listens on :4344).`,
  );
});

// Console-error collector for the EDITOR frame only. The editor is the SUT;
// the live storefront in the iframe is third-party merchant content whose
// own console hygiene (broken review APIs, duplicate React keys, etc.) is
// out of scope — a momsco bug must not fail an editor test. So we drop any
// message whose source is the preview origin or the storefront's Next.js
// bundle, then apply the usual infra-noise filter (favicon, fonts, HMR,
// sourcemaps, resource 404s). Inlined so the real spec needs no page-object.
function collectConsoleErrors(page: import("@playwright/test").Page): () => string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const src = msg.location()?.url ?? "";
    // Skip anything emitted from the storefront iframe.
    if (src.startsWith(realEnv.previewOrigin) || /app-pages-browser/.test(src)) {
      return;
    }
    errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    // Uncaught errors originating in the storefront iframe are NOT editor
    // regressions — e.g. momsco's axios calls to the GoKwik backend reject
    // as "Network Error" when that host is unreachable in the test env,
    // surfacing as a pageerror. Drop anything whose stack points at the
    // storefront bundle or preview origin.
    const stack = err.stack ?? "";
    if (/app-pages-browser/.test(stack) || stack.includes(realEnv.previewOrigin)) {
      return;
    }
    errors.push(err.message);
  });
  return () =>
    errors.filter(
      (e) =>
        !/favicon|font|hot[- ]?reload|websocket|HMR|sourcemap/i.test(e) &&
        // Any resource-load failure (404, net::ERR_FAILED, blocked third-
        // party requests) is environment/network noise, not an editor logic
        // regression — the storefront pulls assets/APIs the test env may not
        // reach.
        !/Failed to load resource/i.test(e) &&
        // axios network noise — the EDITOR uses ky, not axios, so a bare
        // "Network Error" / AxiosError always comes from the merchant
        // storefront's data fetches (e.g. GoKwik DNS unresolved in CI).
        !/^Network Error$|AxiosError/i.test(e),
    );
}

test.describe("editor core — cases 1-10", () => {
  // ──────────────────────────────────────────────────────────────────────
  // 1. Editor boots with real creds and the four-region layout is present:
  //    header (Save), left sidebar (section rows), preview (iframe), and the
  //    right settings drawer (mounts only on selection).
  //
  //   Logic:
  //     1. Boot the editor against the real BE → editor-root mounts.
  //     2. Header Save button + first sidebar section row + preview iframe
  //        are all visible (three of four regions).
  //     3. Click the first non-header body section → settings drawer mounts
  //        (the fourth region).
  //
  //   Why real-only: proves the full boot wiring against the real auth +
  //   theme round-trip, not a synthetic fixture.
  // ──────────────────────────────────────────────────────────────────────
  test("1. loads with valid credentials and renders all four regions", async ({
    editor,
    page,
  }) => {
    await editor.open();
    await expect(editor.root).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^(save|saving|saved)/i }),
    ).toBeVisible();
    await expect(editor.allSectionRows.first()).toBeVisible();
    await expect(editor.previewFrame).toBeVisible();

    const bodyId = await editor.firstBodySectionId();
    await editor.sectionRow(bodyId).click();
    await expect(editor.settingsDrawer).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 2. The merchant/theme name renders in the top-left of the header. The
  //    editor displays `theme.name || theme.id`; we assert it equals the
  //    name the BE actually returned (captured in beforeAll) — not a literal.
  //
  //   Logic:
  //     1. Boot → header renders.
  //     2. The live theme name is visible inside <header>.
  //     3. Its x-position sits in the left half of the header (a regression
  //        can't silently move it to the right side).
  //
  //   Why real-only: asserts the editor surfaces the merchant's real theme
  //   name, proving the value flows from the live BE.
  // ──────────────────────────────────────────────────────────────────────
  test("2. theme name displays in the top-left", async ({ editor, page }) => {
    await editor.open();
    expect(themeName, "BE returned a theme name").toBeTruthy();

    const header = page.locator("header").first();
    const nameLocator = header.getByText(themeName, { exact: true });
    await expect(nameLocator).toBeVisible();

    const headerBox = await header.boundingBox();
    const nameBox = await nameLocator.boundingBox();
    expect(headerBox, "header is laid out").not.toBeNull();
    expect(nameBox, "theme name is laid out").not.toBeNull();
    expect(
      nameBox!.x,
      "theme name sits in the left half of the header",
    ).toBeLessThan(headerBox!.x + headerBox!.width / 2);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 3. The default template is "Home" and its real widget list renders.
  //
  //   Logic:
  //     1. Boot → the dropdown trigger and sidebar chrome both read Home.
  //     2. The live pageConfig has sections; the first few rows are visible.
  //
  //   Why real-only: the section rows come from the merchant's real Home
  //   pageConfig.
  // ──────────────────────────────────────────────────────────────────────
  test("3. default 'Home' template is selected and its widget list renders", async ({
    editor,
  }) => {
    await editor.open();
    await expect(editor.templateTrigger).toHaveText(/home/i);
    await expect(editor.sidebarTitle(/home/i)).toBeVisible();

    const ids = await editor.sectionIds();
    expect(ids.length, "real Home pageConfig has sections").toBeGreaterThan(0);
    for (const id of ids.slice(0, 3)) {
      await expect(editor.sectionRow(id)).toBeVisible();
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // 4. The iframe loads real merchant content (non-empty body) and produces
  //    no app-level console errors.
  //
  //   Logic:
  //     1. Start collecting console errors before navigation.
  //     2. Boot → iframe src points at the real previewOrigin.
  //     3. Wait for the storefront document body to render content.
  //     4. No meaningful console errors were emitted.
  //
  //   Why real-only: only the real storefront can prove its own DOM renders
  //   cleanly inside the editor iframe.
  // ──────────────────────────────────────────────────────────────────────
  test("4. iframe loads merchant content with no console errors", async ({
    editor,
    page,
  }) => {
    const errors = collectConsoleErrors(page);

    await editor.open();
    await expect(editor.previewFrame).toBeVisible();
    const src = (await editor.previewFrame.getAttribute("src")) ?? "";
    expect(src, "iframe points at the real previewOrigin").toContain(
      realEnv.previewOrigin,
    );

    await editor.waitForIframeReady();

    const meaningful = errors();
    expect(
      meaningful,
      `unexpected console errors:\n${meaningful.join("\n")}`,
    ).toEqual([]);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 5. A rejected token renders the Unauthorized screen and the editor
  //    chrome is NOT mounted.
  //
  //   Logic:
  //     1. Force a 401 on the merchant auth call (status only — no body
  //        invented; the real BE never 401s on any token).
  //     2. Open the editor with a real mid + a bad token.
  //     3. The Unauthorized screen + "session is not valid" copy show.
  //     4. editor-root and preview-iframe are absent.
  //
  //   Why injected: the dev BE accepts any Bearer token, so the 401 path is
  //   unreachable without forcing the status. No theme/merchant data is faked.
  // ──────────────────────────────────────────────────────────────────────
  test("5. invalid token renders the Unauthorized screen, not a broken UI", async ({
    page,
  }) => {
    await page.route("**/api/v1/merchants/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthorized" }),
      }),
    );
    await page.goto(`/?mid=${realEnv.mid}&token=bad-token`);

    await expect(page.getByText("Unauthorized")).toBeVisible();
    await expect(
      page.getByText("Your session is not valid.", { exact: false }),
    ).toBeVisible();
    await expect(page.getByTestId("editor-root")).toBeHidden();
    await expect(page.getByTestId("preview-iframe")).toBeHidden();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 6. Missing/invalid mid is handled gracefully.
  //
  //   Logic:
  //     a) Open with no params → the boot machine's hasCredentials guard
  //        short-circuits before any network call → "session not started".
  //        (No interception — this is pure client behavior.)
  //     b) A bogus mid → backend returns 401 → same Unauthorized screen as
  //        case 5. The 401 is forced (status only) for the same reason.
  //
  //   Why mixed: 6a needs no backend at all; 6b needs the same minimal
  //   status-injection as case 5.
  // ──────────────────────────────────────────────────────────────────────
  test("6. missing or invalid mid is handled gracefully", async ({ page }) => {
    // a) Completely missing credentials.
    await page.goto("/");
    await expect(page.getByText("Editor session not started")).toBeVisible();
    await expect(page.getByTestId("editor-root")).toBeHidden();

    // b) Bogus mid → forced 401 → Unauthorized screen.
    await page.route("**/api/v1/merchants/**", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "unauthorized" }),
      }),
    );
    await page.goto("/?mid=does-not-exist&token=anything");
    await expect(page.getByText("Unauthorized")).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 7. When the previewOrigin points at a dead port, the iframe element
  //    still mounts but its document can't load — and the editor chrome
  //    stays fully usable.
  //
  //   Logic:
  //     1. Boot with a real mid+token but override previewOrigin to a dead
  //        local port (the dev-only override is gated to localhost, which
  //        127.0.0.1 satisfies). Auth + theme still hit the real BE, so the
  //        sidebar populates from real data; only the iframe target is dead.
  //     2. editor-root, Save, and the Mobile device toggle remain visible.
  //     3. The iframe element exists but renders none of the real sidebar
  //        sections (no matching data-section-id markers).
  //
  //   Why real-only: exercises the real boot + sidebar against live data
  //   while isolating the iframe failure — no merchant body is faked.
  // ──────────────────────────────────────────────────────────────────────
  test("7. unreachable previewOrigin keeps the editor chrome working", async ({
    editor,
    page,
  }) => {
    const params = new URLSearchParams({
      mid: realEnv.mid,
      token: realEnv.token,
      previewOrigin: UNREACHABLE_ORIGIN,
    });
    await page.goto(`/?${params.toString()}`);

    await expect(editor.root).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("button", { name: /^(save|saving|saved)/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Switch to Mobile view" }),
    ).toBeVisible();

    await expect(editor.previewFrame).toBeVisible();
    const ids = await editor.sectionIds();
    expect(ids.length, "sidebar still populates from real theme").toBeGreaterThan(
      0,
    );
    // The iframe target is dead, so the storefront's section markers are absent.
    await expect(
      editor.iframe.locator(`[data-section-id="${ids[0]}"]`),
    ).toHaveCount(0);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 8. Hard refresh re-boots into the same editor state.
  //
  //   Logic:
  //     1. Boot → Home selected, first section visible.
  //     2. page.reload() (URL params persist).
  //     3. Editor re-boots: root visible, Home chrome, first section row,
  //        Save button back to idle.
  //
  //   Why real-only: proves the boot is idempotent against the real BE,
  //   including the full theme + pageConfig refetch.
  // ──────────────────────────────────────────────────────────────────────
  test("8. hard refresh re-boots into the same editor state", async ({
    editor,
    page,
  }) => {
    await editor.open();
    const firstId = (await editor.sectionIds())[0];
    await expect(editor.sectionRow(firstId)).toBeVisible();

    await page.reload();

    await expect(editor.root).toBeVisible({ timeout: 30_000 });
    await expect(editor.sidebarTitle(/home/i)).toBeVisible();
    await expect(editor.sectionRow(firstId)).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 9. The template dropdown lists exactly the templates the BE returned.
  //
  //   Logic:
  //     1. Boot and open the dropdown.
  //     2. The number of rendered options equals the number of templates in
  //        the live theme (allTemplates, captured in beforeAll) — one option
  //        per template, including disabled/unhydrated ones.
  //     3. Escape closes the menu without changing the selection.
  //
  //   Why real-only: proves the dropdown reflects the merchant's real theme
  //   structure 1:1, not a fixed fixture count.
  // ──────────────────────────────────────────────────────────────────────
  test("9. clicking the template dropdown lists every live template", async ({
    editor,
  }) => {
    await editor.open();
    expect(allTemplates.length, "live theme has templates").toBeGreaterThan(1);

    await editor.openDropdown();
    const options = editor.listbox.getByRole("option");
    await expect(options.first()).toBeVisible();
    expect(
      await options.count(),
      "dropdown renders one option per live template",
    ).toBe(allTemplates.length);

    const before = (await editor.templateTrigger.textContent())?.trim();
    await editor.closeDropdownWithEscape();
    expect((await editor.templateTrigger.textContent())?.trim()).toBe(before);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 10. Selecting each concrete-path template updates the sidebar title and
  //     the iframe URL.
  //
  //   Logic:
  //     1. Boot Home.
  //     2. For every live template with a concrete (hydrated, non-root)
  //        route path (walkTemplates, derived in beforeAll):
  //          a) Switch to it via the dropdown.
  //          b) The sidebar chrome title updates to its label.
  //          c) The iframe src reflects its route path
  //             (<iframe src={buildPreviewUrl(origin, path)}> in
  //             TemplateEditor.tsx).
  //
  //   Why real-only: walks the merchant's actual templates and route
  //   bindings — a regression in any one route fails loudly. Unhydrated
  //   (disabled) templates are correctly excluded by the path filter.
  // ──────────────────────────────────────────────────────────────────────
  test("10. selecting each template updates the title and the iframe URL", async ({
    editor,
  }) => {
    test.setTimeout(120_000); // walking several real templates, each refetches
    await editor.open();
    expect(
      walkTemplates.length,
      "live theme has concrete-path templates to walk",
    ).toBeGreaterThan(0);

    for (const t of walkTemplates) {
      await editor.switchTemplate(t.label);

      await expect(
        editor.sidebarTitle(t.label),
        `sidebar title updates to ${t.label}`,
      ).toBeVisible();

      await expect
        .poll(() => editor.previewFrame.getAttribute("src"), {
          message: `iframe src should reflect ${t.path}`,
        })
        .toContain(t.path!);
    }
  });
});
