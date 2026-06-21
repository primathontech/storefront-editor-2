// Real-platform e2e — cases 11-20 from temp-end-to-endtestcase (lines 34-43).
//
// These tests run against the live visual-editor-be deployment and the live
// momsco storefront at http://localhost:4344. NOTHING in /api/v1 is mocked
// — the editor authenticates with a real Bearer token, fetches the real
// theme structure (dawn), pulls the real pageConfig, and the iframe renders
// the actual storefront's hydrated DOM. The only piece the editor is told
// about is the `?previewOrigin=http://localhost:4344` override, gated by
// the dev-only VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE flag (already true in the
// repo's .env), which redirects the iframe at the local store instead of
// the deployed momsco-qa.primathontech.co.in URL.
//
// Each test below explains:
//   • What spec case it covers (line number in temp-end-to-endtestcase)
//   • The logic — what it asserts and why
//   • Why it can't be (easily) faked with a mock
//
// Read-only by design: no test calls Save against the real backend, so the
// suite never mutates production state. Cases that the spec describes as
// requiring a persisted edit (e.g. 37) are reduced to the verifiable
// invariant in the editor (the same widget identity across templates).
import {
  realTest as test,
  expect,
  realEnv,
  waitForUpstream,
} from "../support/real-test";
// Same predicate the dropdown uses to gate unhydrated templates — imported
// here as the oracle so the test asserts the UI reflects the BE's real path
// shape, rather than re-deriving (and drifting from) the rule. See case 12.
import { isUnhydratedPath } from "../../src/editor-form/utils/preview-route";

test.describe.configure({ mode: "serial" });

// Real-platform suite depends on (a) the deployed visual-editor-be and (b)
// the local momsco storefront. If either is unreachable the suite is
// SKIPPED — not failed — because there's nothing the editor can do about
// an upstream outage. The preflight test below makes the cause explicit.
const BE_URL = "https://visual-editor-be.primathontech.co.in";

// Mirror of TemplateSwitchDropdown.tsx `isChromeTemplate`: header/footer
// templates exist in the theme structure but the picker hides them (they're
// edited inline on every page, not standalone). Cases that walk the dropdown
// options must skip them.
const CHROME_TYPES = new Set(["header", "footer"]);

let backendUp = false;
let storefrontUp = false;

test.beforeAll(async ({ request }) => {
  // Retry both upstreams (see waitForUpstream) — a single-shot ping skipped
  // whole files when the storefront dev server was cold-compiling its first
  // route. Only declare "down" after the full retry budget.
  backendUp = await waitForUpstream(request, `${BE_URL}/api/v1/themes/dawn`);
  storefrontUp = await waitForUpstream(request, realEnv.previewOrigin);
});

test.beforeEach(() => {
  test.skip(
    !backendUp,
    `visual-editor-be at ${BE_URL} is unreachable — skipping real-platform suite. ` +
      `Wait for the service to come back or run the mocked suite instead.`,
  );
  test.skip(
    !storefrontUp,
    `momsco storefront at ${realEnv.previewOrigin} is not running — start it ` +
      `with \`cd apps/momsco && bun run dev\` (it listens on :4344).`,
  );
});

test.describe("editor real-platform — cases 11-20", () => {
  // ──────────────────────────────────────────────────────────────────────
  // 11. (line 34) Verify the sidebar title updates to match the selected
  //     template.
  //
  //   Logic:
  //     1. Boot the editor with real creds → default template is "Home".
  //     2. Open the dropdown, pick the first enabled non-Home template the
  //        live theme offers (data-driven — see switchToOtherTemplate).
  //     3. The sidebar chrome heading (rendered from
  //        themeStore.currentTemplate.name) must update to that label.
  //     4. Pick a second, different enabled template → heading flips again.
  //
  //   Why real-only: the chrome heading reflects the BE's actual
  //   template.name. A mock can prove "any string flows through", but the
  //   real test proves the string is the one the merchant authored.
  // ──────────────────────────────────────────────────────────────────────
  test("11. sidebar title updates per selected template", async ({
    editor,
  }) => {
    await editor.open();
    await expect(editor.sidebarTitle(/home/i)).toBeVisible();

    const first = await editor.switchToOtherTemplate();
    await expect(editor.sidebarTitle(first)).toBeVisible();

    const second = await editor.switchToOtherTemplate({ avoid: [first] });
    await expect(editor.sidebarTitle(second)).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 12. (line 35) Verify the "— set sample params" gating matches each
  //     template's REAL routeContext.path.
  //
  //   The dropdown appends " — set sample params" and disables an option
  //   exactly when its path is unhydrated — i.e. still carries a route
  //   placeholder (`/products/:handle`, `/blog/[slug]`) the editor can't
  //   preview. A concrete path (`/collections/bestsellers`) or no path is
  //   left enabled and unsuffixed. See isUnhydratedPath +
  //   TemplateSwitchDropdown.tsx.
  //
  //   Logic:
  //     1. Boot the editor → real dawn theme is fetched.
  //     2. Pull the same theme structure straight from the BE so we know
  //        each template's authored path. (The QA backend's sample paths
  //        change over time — e.g. Collection has been both
  //        `/collections/:handle` and a concrete `/collections/bestsellers`
  //        — so the case must read the live data, not hard-code a winner.)
  //     3. For EVERY option, assert the rendered suffix + disabled state
  //        agree with isUnhydratedPath(path).
  //     4. If any template is unhydrated, clicking it must NOT change the
  //        trigger (disabled options are inert).
  //
  //   Why real-only: this is data-shape behavior. The mock would have to
  //   reproduce the BE's exact route patterns; cheaper and more honest to
  //   exercise the real path strings the merchant authored.
  // ──────────────────────────────────────────────────────────────────────
  test("12. dropdown 'set sample params' gating matches each template's real path", async ({
    editor,
  }) => {
    await editor.open();

    // Source of truth: the live theme structure (template → authored path).
    const res = await editor.page.request.get(`${BE_URL}/api/v1/themes/dawn`, {
      headers: { Authorization: `Bearer ${realEnv.token}` },
    });
    expect(res.ok(), "BE returns the dawn theme structure").toBeTruthy();
    const json = await res.json();
    const data = json?.data ?? json;
    const structure =
      data?.templateStructure ?? data?.theme?.templateStructure ?? [];
    const templates: Array<{ name: string; path?: string; type?: string }> = [];
    for (const group of structure) {
      for (const t of group?.templates ?? []) {
        templates.push({
          name: t.name ?? t.id,
          path: t.routeContext?.path,
          type: t.routeContext?.type ?? t.routeContext?.templateName,
        });
      }
    }
    expect(templates.length, "theme exposes at least one template").toBeGreaterThan(0);

    await editor.openDropdown();

    // Every NON-CHROME option's UI state must mirror its real path shape.
    // Header/footer chrome is hidden by the picker, so skip it here (it would
    // never render an option — see TemplateSwitchDropdown.tsx).
    for (const t of templates) {
      if (CHROME_TYPES.has(t.type ?? "")) continue;
      const unhydrated = isUnhydratedPath(t.path);
      const label = unhydrated ? `${t.name} — set sample params` : t.name;
      const option = editor.listbox.getByRole("option", {
        name: label,
        exact: true,
      });
      await expect(option, `option "${label}" is rendered`).toBeVisible();
      if (unhydrated) {
        await expect(
          option,
          `"${t.name}" (path ${t.path}) is unhydrated → disabled`,
        ).toBeDisabled();
      } else {
        await expect(
          option,
          `"${t.name}" (path ${t.path ?? "—"}) is concrete → enabled`,
        ).toBeEnabled();
      }
    }

    // A disabled (unhydrated) option, if the live theme has one, must be
    // inert — clicking it leaves the current selection untouched.
    const firstUnhydrated = templates.find((t) => isUnhydratedPath(t.path));
    if (firstUnhydrated) {
      const labelBefore = (await editor.templateTrigger.textContent())?.trim();
      await editor.listbox
        .getByRole("option", {
          name: `${firstUnhydrated.name} — set sample params`,
          exact: true,
        })
        .click({ force: true })
        .catch(() => {});
      const labelAfter = (await editor.templateTrigger.textContent())?.trim();
      expect(labelAfter).toBe(labelBefore);
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // 13. (line 36) Verify switching templates closes/clears the open
  //     right-side config panel.
  //
  //   Logic:
  //     1. Boot Home → sidebar lists Home sections.
  //     2. Click the first sidebar section row → settings drawer mounts.
  //     3. Confirm drawer is visible.
  //     4. Switch template via dropdown (e.g. Products).
  //     5. The drawer must collapse — the new template starts with no
  //        selection. (TemplateEditor's `key={currentTemplate.id}` forces
  //        the BuilderToolbar tree to remount on switch, dropping local
  //        selection state.)
  //
  //   Why real-only: confirms the drawer-close behavior on a real
  //   pageConfig switch, including the refetch round-trip.
  // ──────────────────────────────────────────────────────────────────────
  test("13. switching templates closes the right-side settings drawer", async ({
    editor,
  }) => {
    await editor.open();
    const firstSectionId = (await editor.sectionIds())[0];
    await editor.sectionRow(firstSectionId).click();
    await expect(editor.settingsDrawer).toBeVisible();

    await editor.switchToOtherTemplate();
    await expect(editor.settingsDrawer).toBeHidden();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 14. (line 37) Verify a common/shared widget reflects everywhere.
  //
  //   Logic (read-only variant):
  //     The Header is a "common" section — it lives in every template's
  //     pageConfig because the storefront shares one header across pages.
  //     We don't mutate-and-save (would dirty real BE state); instead we
  //     prove the identity invariant the "reflects everywhere" property
  //     depends on:
  //       1. Open Home → record the `data-testid` of the header section
  //          row (e.g. `section-header-section`).
  //       2. Switch to another live template → the SAME section id present.
  //       3. Switch to a second template → ditto.
  //     If the section id were per-template, an edit on Home could never
  //     "reflect" elsewhere. The identity check is the minimum invariant.
  //
  //   Why real-only: only the real BE knows which sections are common.
  // ──────────────────────────────────────────────────────────────────────
  test("14. the common Header section is shared across templates", async ({
    editor,
  }) => {
    await editor.open();

    const homeIds = await editor.sectionIds();
    const headerId = homeIds.find((id) => /header/i.test(id));
    expect(headerId, "dawn home pageConfig has a header section").toBeTruthy();

    const firstLabel = await editor.switchToOtherTemplate();
    const firstIds = await editor.sectionIds();
    expect(
      firstIds,
      `${firstLabel} shares the same Header section id as Home`,
    ).toContain(headerId);

    const secondLabel = await editor.switchToOtherTemplate({
      avoid: [firstLabel],
    });
    const secondIds = await editor.sectionIds();
    expect(
      secondIds,
      `${secondLabel} shares the same Header section id as Home`,
    ).toContain(headerId);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 15. (line 38) Verify the dropdown closes on Escape and outside-click
  //     without changing the selection.
  //
  //   Logic:
  //     1. Boot and record current dropdown label.
  //     2. Open the dropdown via the trigger.
  //     3. Press Escape → listbox hidden, aria-expanded=false, label
  //        unchanged.
  //     4. Re-open the dropdown.
  //     5. Click outside the listbox AND outside the trigger
  //        (the store-name span in the header's left container).
  //     6. Listbox hidden, label unchanged.
  //
  //   Why real-only: covers the actual Dropdown.tsx click-outside handler
  //   wired against `document.mousedown`.
  // ──────────────────────────────────────────────────────────────────────
  test("15. dropdown closes on Escape and outside-click without changing selection", async ({
    editor,
    page,
  }) => {
    await editor.open();
    const initialLabel = (await editor.templateTrigger.textContent())?.trim();

    // Escape path.
    await editor.openDropdown();
    await page.keyboard.press("Escape");
    await expect(editor.templateTrigger).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(editor.listbox).toBeHidden();
    expect((await editor.templateTrigger.textContent())?.trim()).toBe(
      initialLabel,
    );

    // Outside-click path. The header's <header> wrapper sits at the top
    // and is safely outside the portal-mounted listbox.
    await editor.openDropdown();
    await page.locator("header").first().click({ position: { x: 5, y: 5 } });
    await expect(editor.templateTrigger).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(editor.listbox).toBeHidden();
    expect((await editor.templateTrigger.textContent())?.trim()).toBe(
      initialLabel,
    );
  });

  // ──────────────────────────────────────────────────────────────────────
  // 16. (line 39) Verify all sections render in the correct order matching
  //     the iframe.
  //
  //   Logic:
  //     1. Boot Home.
  //     2. Read sidebar section IDs in DOM order (`sectionIds()`).
  //     3. Wait for iframe to fully render the storefront.
  //     4. Read iframe section IDs in DOM order (data-section-id).
  //     5. The iframe set is the storefront's body markers — Header may
  //        be rendered in a different DOM root (sticky / portal) so we
  //        compare the iframe order against the sidebar order RESTRICTED
  //        to the sidebar ids that exist in the iframe. The relative
  //        order must match exactly.
  //
  //   Why real-only: the assertion is about the deployed storefront's
  //   actual render tree.
  // ──────────────────────────────────────────────────────────────────────
  test("16. sections render in iframe order matching the sidebar", async ({
    editor,
  }) => {
    await editor.open();
    await editor.waitForIframeReady();

    const sidebar = await editor.sectionIds();
    const iframe = await editor.iframeSectionIds();

    expect(sidebar.length, "sidebar has sections").toBeGreaterThan(0);
    expect(iframe.length, "iframe has sections").toBeGreaterThan(0);

    // Project sidebar order onto the iframe set; orders must match.
    const restricted = sidebar.filter((id) => iframe.includes(id));
    expect(
      iframe.filter((id) => restricted.includes(id)),
      "iframe section order matches sidebar relative order",
    ).toEqual(restricted);

    // Sanity: the canonical first/last sections from the spec are
    // present and in the right relative position.
    expect(
      sidebar[0],
      "Home's first section is the announcement bar",
    ).toMatch(/announcement/i);
    expect(
      sidebar[sidebar.length - 1],
      "Home's last section is the bottom bar",
    ).toMatch(/bottom-bar/i);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 17. (line 40) Verify each sidebar row shows the widget name, a drag
  //     handle, and a visibility (eye) toggle.
  //
  //   Logic:
  //     1. Boot Home → at least 9 section rows render (real Dawn count).
  //     2. For each of the first 5 rows (anchored set; rest are identical):
  //        a) The widget name <h2> is visible and non-empty.
  //        b) A drag handle is present (Layout + Drag icons in
  //           `.dragHandle`; we anchor on the CSS module suffix that
  //           survives the build).
  //        c) The visibility toggle ("Hide section"/"Show section") is
  //           present for HIDEABLE body sections, and absent for pinned
  //           chrome (header/announcement) — the editor only renders the
  //           eye when `onToggleVisibility` is wired (SidebarSectionGroup
  //           .tsx:135), which pinned sections don't get. Mirrors the same
  //           header/announcement split the harness uses in
  //           firstBodySectionId.
  //
  //   Why real-only: tests the actual sidebar against the real pageConfig
  //   data (widget names sourced from BE).
  // ──────────────────────────────────────────────────────────────────────
  test("17. each sidebar row has a widget name, drag handle, and eye toggle", async ({
    editor,
  }) => {
    await editor.open();
    const ids = await editor.sectionIds();
    expect(ids.length, "Home has at least 5 sections").toBeGreaterThanOrEqual(
      5,
    );

    for (const id of ids.slice(0, 5)) {
      const row = editor.sectionRow(id);

      const title = row.locator("h2").first();
      await expect(title, `row ${id} renders a widget name`).toBeVisible();
      expect(
        (await title.textContent())?.trim(),
        `row ${id} widget name is non-empty`,
      ).toBeTruthy();

      const dragHandle = row.locator('[class*="dragHandle"]');
      await expect(dragHandle, `row ${id} has a drag handle`).toBeVisible();

      // Pinned chrome (header/announcement) can't be hidden, so the editor
      // renders no eye toggle for it (SidebarSectionGroup.tsx:135). Hideable
      // body sections must have one.
      const isPinned = /header/i.test(id) || /announcement/i.test(id);
      const eye = row.getByRole("button", { name: /(Hide|Show) section/ });
      if (isPinned) {
        await expect(
          eye,
          `pinned row ${id} has no visibility toggle`,
        ).toHaveCount(0);
      } else {
        await expect(eye, `row ${id} has a visibility toggle`).toBeVisible();
      }
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // 18. (line 41) Verify clicking a widget name selects it (row highlights).
  //
  //   Logic:
  //     1. Boot Home.
  //     2. Pick the second section row (skip Header to avoid sticky
  //        layout interference).
  //     3. Read its <h2>'s computed `color` before any selection.
  //     4. Click the <h2>.
  //     5. The widget's selected state applies an inline `color: #1e40af`
  //        (blue) AND a font-weight bump — both observable from the
  //        computed style. Wait for the color to flip.
  //     6. The settings drawer must also be visible (selection side-effect).
  //
  //   Why real-only: confirms the click→selection→highlight bridge end-
  //   to-end on the real widget tree.
  // ──────────────────────────────────────────────────────────────────────
  test("18. clicking a widget name selects and highlights the row", async ({
    editor,
  }) => {
    await editor.open();
    const ids = await editor.sectionIds();
    expect(ids.length, "need at least two sections").toBeGreaterThan(1);
    const target = ids[1]; // skip the first to avoid sticky-header overlap

    const title = editor.sectionRow(target).locator("h2").first();
    const colorBefore = await title.evaluate(
      (el) => getComputedStyle(el).color,
    );

    await title.click();

    // Selected widgets get `color: #1e40af` inline. Computed value is
    // `rgb(30, 64, 175)`.
    await expect
      .poll(
        async () => title.evaluate((el) => getComputedStyle(el).color),
        { message: "selected widget title turns blue" },
      )
      .toBe("rgb(30, 64, 175)");

    expect(
      await title.evaluate((el) => getComputedStyle(el).color),
    ).not.toBe(colorBefore);

    await expect(
      editor.settingsDrawer,
      "settings drawer opens on selection",
    ).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 19. (line 42) Verify "Add Section" opens the add-section flow and
  //     dismissing it leaves the section list unchanged.
  //
  //   Logic:
  //     1. Boot Home and record the section count.
  //     2. Click the sidebar's "Add Section" button (label-anchored).
  //     3. The section-library dialog opens (aria-anchored close button
  //        "Close dialog" becomes visible — same anchor 05-add-section
  //        already proves with mocks; here we verify against real data).
  //     4. Dismiss the dialog via the close button.
  //     5. Section count is unchanged — no destructive write occurred.
  //
  //   Why we don't add: completing the add flow goes through the AI
  //   generate path, which writes to the BE and would mutate real
  //   merchant state. The dialog open/close lifecycle is the responsibly-
  //   testable portion of this case against production data.
  // ──────────────────────────────────────────────────────────────────────
  test("19. Add Section opens the add-section flow without mutating state", async ({
    editor,
    page,
  }) => {
    await editor.open();
    const before = (await editor.sectionIds()).length;

    await page.getByRole("button", { name: /add section/i }).first().click();
    const close = page.getByRole("button", { name: "Close dialog" });
    await expect(close).toBeVisible();

    await close.click();
    await expect(close).toBeHidden();

    const after = (await editor.sectionIds()).length;
    expect(after, "section list unchanged after dialog dismissal").toBe(before);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 20. (line 43) Verify the sidebar scrolls correctly when the list
  //     exceeds the viewport height.
  //
  //   Logic:
  //     1. Boot Home (real Dawn pageConfig has 9 sections).
  //     2. Shrink the browser viewport vertically (300px tall) so the
  //        sidebar can't fit all rows — guarantees overflow without
  //        depending on a particular merchant having 30+ sections.
  //     3. Find the sidebar's scroll container (the inner div with
  //        overflow-y in BuilderToolbar). Read scrollHeight vs
  //        clientHeight to confirm overflow.
  //     4. Scroll to the bottom programmatically; the LAST sidebar row
  //        must now be in view (Playwright's `toBeInViewport`).
  //     5. Scroll back to the top; the FIRST row is in view again.
  //
  //   Why real-only: verifies CSS layout against real content count.
  // ──────────────────────────────────────────────────────────────────────
  test("20. sidebar scrolls when the list exceeds the viewport", async ({
    editor,
    page,
  }) => {
    await editor.open();
    // Force overflow regardless of merchant section count.
    await page.setViewportSize({ width: 1280, height: 300 });

    const ids = await editor.sectionIds();
    expect(ids.length, "need at least 3 sections").toBeGreaterThan(2);

    const firstRow = editor.sectionRow(ids[0]);
    const lastRow = editor.sectionRow(ids[ids.length - 1]);

    // Resolve the nearest ancestor whose contentHeight exceeds its
    // clientHeight — that IS the scroll container.
    const scroller = page.evaluateHandle(() => {
      const rows = document.querySelectorAll('[data-testid^="section-"]');
      if (rows.length === 0) return null;
      let el: HTMLElement | null = rows[0] as HTMLElement;
      while (el) {
        const cs = getComputedStyle(el);
        if (
          (cs.overflowY === "auto" || cs.overflowY === "scroll") &&
          el.scrollHeight > el.clientHeight + 1
        ) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    });
    const handle = await scroller;
    const scrollerEl = handle.asElement();
    expect(
      scrollerEl,
      "found a scrollable ancestor around the section list",
    ).not.toBeNull();

    // Scroll to the bottom; last row should be in view.
    await scrollerEl!.evaluate((el) => {
      (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
    });
    await expect(lastRow).toBeInViewport({ ratio: 0.2 });

    // Scroll back to the top; first row should be in view.
    await scrollerEl!.evaluate((el) => {
      (el as HTMLElement).scrollTop = 0;
    });
    await expect(firstRow).toBeInViewport({ ratio: 0.2 });
  });
});

