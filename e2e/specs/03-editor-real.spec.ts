// Real-platform e2e — cases 21-30 from temp-end-to-endtestcase
// (lines 44-53). Pairs with 07-editor-real.spec.ts (cases 11-20) and uses
// the same realTest harness — no /api/v1 mocks, deployed visual-editor-be,
// real momsco storefront at http://localhost:4344.
//
// Theme of this batch: selection-sync, the right-side settings drawer,
// nested/repeatable items, iframe reload recovery, and per-section
// visibility (the eye toggle). Every assertion either reads the editor's
// own DOM (sidebar row state, drawer header) OR reaches into the iframe
// to read the editor-bridge's PreviewOverlay (the absolutely-positioned
// outline div appended to the storefront's body) — the things a user
// would actually see.
//
// Read-only: the visibility cases (29, 30) toggle the eye icon, which
// mutates the editor's in-memory templateStore. Nothing here calls Save,
// so the backend never persists the toggle. The pair is balanced — 29
// hides, 30 un-hides — so even if a flake leaves the store dirty the next
// test boots a fresh editor session and re-fetches the canonical config.
import {
  realTest as test,
  expect,
  realEnv,
  waitForUpstream,
} from "../support/real-test";

test.describe.configure({ mode: "serial" });

// Same upstream-availability preflight as 07-editor-real.spec.ts. The two
// suites SHOULD run together — duplicating the skip logic locally keeps
// each file self-explanatory and lets you cherry-pick one without losing
// the safety net.
const BE_URL = "https://visual-editor-be.primathontech.co.in";
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

// The CSS colour `#1e40af` (Tailwind blue-800) is applied inline by the
// sidebar to a selected widget's <h2>. Computed values become rgb(...).
const SELECTED_BLUE = "rgb(30, 64, 175)";

test.describe("editor real-platform — cases 21-30", () => {
  // ──────────────────────────────────────────────────────────────────────
  // 21. (line 44) Clicking a widget in the sidebar highlights / outlines
  //     the matching widget in the iframe.
  //
  //   Logic:
  //     1. Boot Home and wait for the iframe to hydrate.
  //     2. Confirm the bridge's PreviewOverlay select box starts HIDDEN
  //        (display === "none") — no selection on boot.
  //     3. Pick a body section (not Header — Header is sticky and might
  //        be obscured at the top of the iframe scroll).
  //     4. Click that section's widget-title <h2> in the sidebar.
  //     5. The editor sends `focusSection({ sectionId })` over the bridge;
  //        the iframe's EditorHostInner resolves the matching
  //        [data-section-id="…"] element, scrolls it into view, and the
  //        PreviewOverlay paints a 2px solid #2563eb outline by positioning
  //        the select box at the element's page coordinates.
  //     6. Poll the select box's inline style until display flips from
  //        "none" → "block" AND a non-empty transform is set (the bridge
  //        also writes a width/height; we use that as an extra anchor).
  //     7. Cross-check: the matching iframe section is now in the viewport,
  //        confirming the bridge scrolled it into view per
  //        EditorHostInner.tsx:233.
  //
  //   Why real-only: the bridge's outline element only exists in editor
  //   mode (`?editor=true`), and only when the deployed @shopkit/editor-
  //   bridge package is loaded. A unit test can stub a click handler; only
  //   the real iframe proves the postMessage → overlay chain end-to-end.
  // ──────────────────────────────────────────────────────────────────────
  test("21. clicking a sidebar widget outlines the matching iframe widget", async ({
    editor,
  }) => {
    await editor.open();
    await editor.waitForIframeReady();

    expect(
      (await editor.iframeOverlaySelectStyle()).display,
      "select overlay starts hidden on boot",
    ).toBe("none");

    const id = await editor.firstBodySectionId();
    await editor.widgetTitle(id).click();

    await expect
      .poll(
        () => editor.iframeOverlaySelectStyle().then((s) => s.display),
        { message: "select overlay should mount after clicking the sidebar row" },
      )
      .toBe("block");

    const style = await editor.iframeOverlaySelectStyle();
    expect(style.transform, "overlay positioned over the selected section").not.toBe("");
    expect(style.width, "overlay has non-zero width").not.toBe("0px");
    expect(style.height, "overlay has non-zero height").not.toBe("0px");

    // Confirms the bridge scrolled the matching iframe element into view.
    await expect(editor.iframeSection(id)).toBeInViewport({ ratio: 0.1 });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 22. (line 45) Clicking a widget INSIDE the iframe highlights the
  //     matching sidebar row.
  //
  //   Logic:
  //     1. Boot, wait for the iframe.
  //     2. Pick a body section ID and confirm its sidebar title starts
  //        UN-selected (computed color is NOT the selected-blue).
  //     3. Click the iframe-side [data-section-id="<id>"] element. The
  //        bridge's window-level `pointerdown` capture handler
  //        (EditorHostInner.tsx:169) calls setSelected() and posts
  //        `select` back to the editor with that section's id.
  //     4. The editor's `onSelect` (TemplateEditor.tsx:174) writes the id
  //        into templateStore.selectedSection.
  //     5. The sidebar row's <h2> inline style flips to color #1e40af
  //        (blue-800) — the same anchor case 18 uses for sidebar-side
  //        selection.
  //     6. Poll the computed colour until it matches.
  //
  //   Why real-only: tests the iframe→editor leg of the bridge. The two
  //   legs share no code; case 21 covers the other direction.
  // ──────────────────────────────────────────────────────────────────────
  test("22. clicking an iframe widget selects its sidebar row", async ({
    editor,
  }) => {
    await editor.open();
    await editor.waitForIframeReady();

    const id = await editor.firstBodySectionId();
    expect(
      await editor.titleColor(id),
      "sidebar title starts un-selected",
    ).not.toBe(SELECTED_BLUE);

    // Click the iframe-side section element. The bridge consumes the
    // pointerdown in capture phase so the storefront's own click handlers
    // don't run — the click coordinate doesn't need to be over any
    // particular widget.
    await editor.iframeSection(id).click();

    await expect
      .poll(() => editor.titleColor(id), {
        message: "sidebar title turns blue after iframe-side selection",
      })
      .toBe(SELECTED_BLUE);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 23. (line 46) In BOTH selection directions, the right-side config
  //     panel opens with the widget's settings.
  //
  //   Logic:
  //     • Direction A — sidebar click:
  //         1. Boot, pick a section.
  //         2. Click its sidebar title.
  //         3. settings-drawer becomes visible AND its header shows the
  //            widget's name (the same name the sidebar row displays).
  //         4. Read the drawer's heading text and pin it.
  //
  //     • Direction B — iframe click on a DIFFERENT section:
  //         5. Click the iframe element for a second section.
  //         6. The drawer stays visible (it doesn't unmount across
  //            selection changes — selection state swap re-renders).
  //         7. Drawer header now shows that section's name. Reading the
  //            "name" field requires a stable anchor: the drawer header
  //            inside [data-testid="settings-drawer"] renders the widget
  //            name as a text node (SettingsSidebar.tsx:161). We match it
  //            against the sidebar's title for the same id — that pair
  //            MUST agree if the drawer is bound to the same widget.
  //
  //   Why real-only: the widget name string is from the real BE; a mock
  //   wouldn't catch a regression where the drawer binds to the wrong
  //   widget (e.g. shows section A's name while iframe selected B).
  // ──────────────────────────────────────────────────────────────────────
  test("23. config panel opens with the widget's settings in both directions", async ({
    editor,
  }) => {
    await editor.open();
    await editor.waitForIframeReady();

    const ids = await editor.sectionIds();
    const bodyIds = ids.filter(
      (i) => !/header/i.test(i) && !/announcement/i.test(i),
    );
    expect(
      bodyIds.length,
      "need at least two body sections to test both directions",
    ).toBeGreaterThan(1);

    const a = bodyIds[0];
    const b = bodyIds[1];

    // Direction A — sidebar click opens the drawer with A's name.
    const nameA = (await editor.widgetTitle(a).textContent())?.trim();
    expect(nameA, "section A has a non-empty sidebar title").toBeTruthy();
    await editor.widgetTitle(a).click();
    await expect(editor.settingsDrawer).toBeVisible();
    await expect(
      editor.settingsDrawer.getByText(nameA!, { exact: false }).first(),
      "drawer header reflects section A's widget name",
    ).toBeVisible();

    // Direction B — iframe click switches the drawer to B's name.
    const nameB = (await editor.widgetTitle(b).textContent())?.trim();
    await editor.iframeSection(b).click();
    await expect(editor.settingsDrawer).toBeVisible();
    await expect
      .poll(
        async () =>
          (await editor.settingsDrawer.textContent())?.includes(nameB ?? "") ??
          false,
        { message: "drawer body updates to show section B's name" },
      )
      .toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 24. (line 47) Selecting a different widget updates the highlight in
  //     BOTH places (sidebar row + iframe overlay) and swaps the config
  //     panel content.
  //
  //   Logic:
  //     1. Boot, pick two body sections A and B.
  //     2. Click A in the sidebar.
  //     3. Snapshot the SELECT overlay's transform (A's position).
  //     4. Confirm A's title is blue, B's is not.
  //     5. Click B in the sidebar.
  //     6. After the bridge round-trip:
  //         • A's title flips back to its base colour (not blue).
  //         • B's title becomes blue.
  //         • The overlay's transform changes — it now sits over B, not A.
  //           (We don't need to know the exact y; merely that the transform
  //           string changed proves the bridge moved it.)
  //         • The drawer header now mentions B's widget name.
  //
  //   Why real-only: catches a regression where one of the two legs falls
  //   out of sync (e.g. sidebar updates but the iframe overlay stays put,
  //   or the drawer header lags).
  // ──────────────────────────────────────────────────────────────────────
  test("24. switching widgets swaps highlight and panel content in both places", async ({
    editor,
  }) => {
    await editor.open();
    await editor.waitForIframeReady();

    const ids = await editor.sectionIds();
    const bodyIds = ids.filter(
      (i) => !/header/i.test(i) && !/announcement/i.test(i),
    );
    expect(bodyIds.length, "need at least two body sections").toBeGreaterThan(1);
    const [a, b] = bodyIds;

    await editor.widgetTitle(a).click();
    // The overlay is positioned via a cross-frame postMessage round-trip, so
    // poll until it mounts before reading its transform. (waitForIframeReady
    // already gated on the section markers, so the click isn't lost.)
    await expect
      .poll(() => editor.iframeOverlaySelectStyle().then((s) => s.display), {
        message: "select overlay should mount after selecting A",
      })
      .toBe("block");
    await expect.poll(() => editor.titleColor(a)).toBe(SELECTED_BLUE);
    const transformA = (await editor.iframeOverlaySelectStyle()).transform;
    expect(transformA, "overlay positioned for A").not.toBe("");

    const baseColorB = await editor.titleColor(b);

    await editor.widgetTitle(b).click();
    await expect.poll(() => editor.titleColor(b)).toBe(SELECTED_BLUE);
    expect(
      await editor.titleColor(a),
      "A's title reverts when B becomes the new selection",
    ).not.toBe(SELECTED_BLUE);

    await expect
      .poll(
        async () => (await editor.iframeOverlaySelectStyle()).transform,
        { message: "overlay transform moves from A to B" },
      )
      .not.toBe(transformA);

    expect(
      await editor.titleColor(b),
      `B's base colour was ${baseColorB} — it should now be selected-blue`,
    ).toBe(SELECTED_BLUE);

    // Drawer reflects B.
    const nameB = (await editor.widgetTitle(b).textContent())?.trim();
    await expect(
      editor.settingsDrawer.getByText(nameB!, { exact: false }).first(),
    ).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 25. (line 48) Clicking an empty / non-widget area in the iframe
  //     deselects (or retains, per spec) CONSISTENTLY.
  //
  //   Implementation reality (EditorHostInner.tsx:169-179):
  //     The window-level `pointerdown` capture handler does
  //       `target.closest('[data-section-id]')` — and RETURNS EARLY if
  //     that's null. Empty areas (anything not inside a section wrapper)
  //     produce no selection event, so the existing selection RETAINS.
  //     The spec acknowledges either behaviour is acceptable as long as
  //     it's consistent. We assert "retain".
  //
  //   Logic:
  //     1. Boot, select a body section. Verify the overlay is visible.
  //     2. Dispatch a synthetic pointerdown on the iframe's document.body
  //        (no section ancestor) via frame.evaluate. We use a synthesised
  //        event rather than a coordinate click because section wrappers
  //        often cover the full page width — there's no reliable empty
  //        pixel to click in the live storefront.
  //     3. Wait a beat for any listener to run.
  //     4. Selection retains:
  //         • The overlay is still visible.
  //         • The sidebar title is still blue.
  //         • The drawer is still open.
  //
  //   Why real-only: confirms the documented "retain" behaviour against
  //   the real bridge handler, not a mock.
  // ──────────────────────────────────────────────────────────────────────
  test("25. clicking empty iframe area retains the current selection", async ({
    editor,
  }) => {
    await editor.open();
    await editor.waitForIframeReady();

    const id = await editor.firstBodySectionId();
    await editor.widgetTitle(id).click();
    await expect
      .poll(() => editor.iframeOverlayIsVisible())
      .toBe(true);
    await expect(editor.settingsDrawer).toBeVisible();

    // Synthetic event on body — guaranteed to lack a [data-section-id]
    // ancestor. The bridge's capture-phase handler runs, computes
    // closest(SECTION_SELECTOR) === null, and bails. State must NOT
    // change as a result.
    const frame = editor.page.frame({
      url: (u) => u.href.startsWith(realEnv.previewOrigin),
    });
    expect(frame, "iframe frame is reachable").not.toBeNull();
    await frame!.evaluate(() => {
      document.body.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          button: 0,
        }),
      );
    });

    // Give the bridge a generous beat to (not) act.
    await editor.page.waitForTimeout(300);

    expect(
      await editor.iframeOverlayIsVisible(),
      "overlay still visible after empty-area click",
    ).toBe(true);
    expect(
      await editor.titleColor(id),
      "sidebar title still blue after empty-area click",
    ).toBe(SELECTED_BLUE);
    await expect(
      editor.settingsDrawer,
      "drawer still open after empty-area click",
    ).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 26. (line 49) Selection sync survives an editor-driven preview reload.
  //
  //   The editor reloads the preview by re-navigating the iframe through its
  //   OWN mechanism — `<iframe src={buildPreviewUrl(...)}>` recomputes when
  //   currentTemplate changes (TemplateEditor.tsx:285), so switching template
  //   away and back drives a real iframe navigation. (An in-iframe
  //   `location.reload()` is deliberately NOT used: the editor registers the
  //   bridge in a ref callback at iframe-ELEMENT creation, which an in-place
  //   reload can't re-trigger, so the editor never re-handshakes — a known
  //   limitation, not what this case is about.) Through an editor-driven
  //   switch the parent's message listener persists and the re-navigated
  //   storefront re-posts `ready`/`assets`, so the bridge rebuilds.
  //
  //   Logic:
  //     1. Boot Home, pick two body sections A and B; capture the Home label.
  //     2. Select A from the sidebar → overlay paints A.
  //     3. Switch to another enabled template (read dynamically from the
  //        dropdown), then switch back to Home — an editor-driven preview
  //        reload that re-navigates the iframe twice.
  //     4. Selection is cleared by the switch (case 13). Verify the channel
  //        is alive again in BOTH directions:
  //          • editor → iframe: clicking B repaints the overlay over B.
  //          • iframe → editor: clicking iframe-side A selects A's row.
  //
  //   Why real-only: both ends of the bridge must rebuild against the live
  //   storefront across a real navigation — unmockable.
  // ──────────────────────────────────────────────────────────────────────
  test("26. selection sync survives an editor-driven preview reload", async ({
    editor,
  }) => {
    await editor.open();
    await editor.waitForIframeReady();

    const homeLabel = (await editor.templateTrigger.textContent())?.trim();
    expect(homeLabel, "current (Home) template label is readable").toBeTruthy();

    const ids = await editor.sectionIds();
    const bodyIds = ids.filter(
      (i) => !/header/i.test(i) && !/announcement/i.test(i),
    );
    expect(bodyIds.length, "need two body sections").toBeGreaterThan(1);
    const [a, b] = bodyIds;

    // Pre-reload: prove sync works once.
    await editor.widgetTitle(a).click();
    await expect.poll(() => editor.iframeOverlayIsVisible()).toBe(true);

    // Pick a second ENABLED template to switch to, read live from the
    // dropdown (no hardcoded label). Unhydrated templates render disabled.
    await editor.openDropdown();
    const otherLabel = (
      await editor.listbox.getByRole("option").evaluateAll((els) =>
        els
          .filter(
            (el) =>
              !(el as HTMLButtonElement).disabled &&
              el.getAttribute("aria-disabled") !== "true",
          )
          .map((el) => el.textContent?.trim() ?? ""),
      )
    ).find((label) => label && label !== homeLabel);
    await editor.closeDropdownWithEscape();
    expect(
      otherLabel,
      "a second enabled template exists to switch to",
    ).toBeTruthy();

    // Editor-driven preview reload: away and back.
    await editor.switchTemplate(otherLabel!);
    await editor.switchTemplate(homeLabel!);
    await editor.waitForIframeReady();

    // Editor → iframe leg still alive: clicking B paints the overlay over B.
    await editor.widgetTitle(b).click();
    await expect
      .poll(
        () => editor.iframeOverlaySelectStyle().then((s) => s.display),
        { message: "overlay paints after preview reload + new selection" },
      )
      .toBe("block");

    // Iframe → editor leg still alive: clicking iframe-side A selects its
    // sidebar row.
    await editor.iframeSection(a).click();
    await expect.poll(() => editor.titleColor(a)).toBe(SELECTED_BLUE);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 27. (line 50) Selection sync for nested / repeatable items
  //     (e.g. slides inside HeroSlideshow).
  //
  //   Architecture note:
  //     The editor does NOT expose repeatable items as separate sidebar
  //     rows — repeats live inside the right-side settings drawer's
  //     ArrayInput (see editor-form/components/ArrayInput.tsx). The
  //     "selection sync" for nested items thus means: the parent section
  //     becomes selected (overlay + sidebar row + drawer), and the drawer
  //     surfaces the repeatable array control with each item expandable.
  //
  //   Logic:
  //     1. Boot, find a section whose id mentions slideshow/hero/carousel
  //        (Dawn home's HeroSlideshow is the canonical case). Skip the
  //        test cleanly if none — we shouldn't fail the suite when the
  //        live merchant's theme doesn't include a repeatable section.
  //     2. Click it in the sidebar.
  //     3. Drawer opens, overlay paints, sidebar row goes blue.
  //     4. The drawer contains at least one role="button" element whose
  //        accessible name matches `/slide|item/i` — the per-item header
  //        of an ArrayInput's accordion (ArrayInput.tsx:58-98). This is
  //        the read-only proof that "nested items are surfaced".
  //
  //   Why real-only: only the live theme decides whether HeroSlideshow's
  //   schema declares Slides as a repeatable; mocks would lie.
  // ──────────────────────────────────────────────────────────────────────
  test("27. selecting a section with repeatables surfaces its nested items", async ({
    editor,
  }) => {
    await editor.open();
    await editor.waitForIframeReady();

    const ids = await editor.sectionIds();
    const repeatable = ids.find((id) =>
      /slideshow|hero|carousel|slides/i.test(id),
    );
    test.skip(
      !repeatable,
      `no repeatable-bearing section found in this theme — got ids ${ids.join(", ")}. ` +
        `If the merchant's theme adds HeroSlideshow this test re-engages.`,
    );

    await editor.widgetTitle(repeatable!).click();
    await expect(editor.settingsDrawer).toBeVisible();
    await expect.poll(() => editor.titleColor(repeatable!)).toBe(SELECTED_BLUE);
    await expect.poll(() => editor.iframeOverlayIsVisible()).toBe(true);

    // ArrayInput renders each slide as a button-style accordion header.
    // The accessible name varies by widget schema (could be "Slide 1",
    // "Item 1", "Slides", etc.) — we match liberally.
    const nestedHeader = editor.settingsDrawer
      .getByRole("button", { name: /slide|item|\d+/i })
      .first();
    await expect(
      nestedHeader,
      "drawer exposes at least one repeatable item control",
    ).toBeVisible({ timeout: 10_000 });
  });

  // ──────────────────────────────────────────────────────────────────────
  // 28. (line 51) Rapid selection switching between widgets does NOT
  //     desync the highlight and the panel.
  //
  //   Logic:
  //     1. Boot, pick three body sections A, B, C.
  //     2. Click A → B → C in immediate succession (no awaits between
  //        clicks — that's the "rapid" of the test name). The bridge
  //        debounces overlay refresh via requestAnimationFrame; multiple
  //        focusSection messages can queue.
  //     3. Wait for the dust to settle:
  //         • Sidebar: C's title is blue; A and B are NOT.
  //         • Overlay: transform corresponds to C (best proxy — the
  //           transform string changes per element; we compare against
  //           the recorded transform when only A was selected to prove
  //           the overlay didn't stop on an intermediate state).
  //         • Drawer: header text shows C's widget name.
  //
  //   Why real-only: catches focusSection ordering bugs (e.g. a stale
  //   queued message overwriting the final selection).
  // ──────────────────────────────────────────────────────────────────────
  test("28. rapid switching settles on the LAST selection in all three places", async ({
    editor,
  }) => {
    await editor.open();
    await editor.waitForIframeReady();

    const ids = await editor.sectionIds();
    const bodyIds = ids.filter(
      (i) => !/header/i.test(i) && !/announcement/i.test(i),
    );
    expect(
      bodyIds.length,
      "need three body sections for the rapid-switch test",
    ).toBeGreaterThanOrEqual(3);
    const [a, b, c] = bodyIds;

    // Establish a baseline overlay position by selecting A first.
    await editor.widgetTitle(a).click();
    await expect.poll(() => editor.iframeOverlayIsVisible()).toBe(true);
    const transformA = (await editor.iframeOverlaySelectStyle()).transform;

    // Rapid burst — no intermediate awaits.
    await Promise.all([
      editor.widgetTitle(a).click(),
      editor.widgetTitle(b).click(),
      editor.widgetTitle(c).click(),
    ]);

    // Final state: C is selected, overlay moved off A.
    await expect.poll(() => editor.titleColor(c)).toBe(SELECTED_BLUE);
    expect(
      await editor.titleColor(a),
      "A should not still appear selected after rapid burst ending on C",
    ).not.toBe(SELECTED_BLUE);
    expect(
      await editor.titleColor(b),
      "B should not still appear selected after rapid burst ending on C",
    ).not.toBe(SELECTED_BLUE);

    await expect
      .poll(
        () => editor.iframeOverlaySelectStyle().then((s) => s.transform),
        { message: "overlay transform settles to C, not stuck on A" },
      )
      .not.toBe(transformA);

    const nameC = (await editor.widgetTitle(c).textContent())?.trim();
    await expect(
      editor.settingsDrawer.getByText(nameC!, { exact: false }).first(),
      "drawer header shows C — the final click target",
    ).toBeVisible();
  });

  // ──────────────────────────────────────────────────────────────────────
  // 29. (line 52) Clicking the eye icon hides the widget in the iframe
  //     and updates the icon to the hidden state.
  //
  //   Logic:
  //     1. Boot Home.
  //     2. Pick a body section. Find its visibility button (aria-label
  //        "Hide section" because it's currently visible — see
  //        SidebarSectionGroup.tsx:136). Pin its initial label.
  //     3. Confirm the iframe-side <section data-section-id="…"> does NOT
  //        carry any `hidden-mobile|tablet|desktop` class yet.
  //     4. Click the eye. The store sets
  //        section.settings.responsive[breakpoint].visible = false; the
  //        editor sends `patchSection` to the iframe; SectionWrapperEditor
  //        recomputes its className from the merged settings and applies
  //        `hidden-desktop` (the default device mode at boot).
  //     5. Assert:
  //         • The button's aria-label flips to "Show section".
  //         • The iframe-side section's class attribute now contains
  //           `hidden-` (matches mobile/tablet/desktop — covers any
  //           future default-device change without rewriting the test).
  //
  //   Why real-only: confirms the patch round-trip and the storefront's
  //   wrapper actually emits the visibility class.
  // ──────────────────────────────────────────────────────────────────────
  test("29. clicking the eye hides the widget and flips the icon state", async ({
    editor,
  }) => {
    await editor.open();
    await editor.waitForIframeReady();

    const id = await editor.firstBodySectionId();
    const btn = editor.visibilityButton(id);
    await expect(btn).toHaveAttribute("aria-label", "Hide section");

    // Iframe section currently lacks any hidden-* class.
    const sectionEl = editor.iframeSection(id);
    const initialClass = (await sectionEl.getAttribute("class")) ?? "";
    expect(
      /hidden-(mobile|tablet|desktop)/.test(initialClass),
      `section started with no hidden-* class (class="${initialClass}")`,
    ).toBe(false);

    await btn.click();

    // Icon state flips synchronously with the store update.
    await expect(btn).toHaveAttribute("aria-label", "Show section");

    // The class arrives after the patchSection round-trip + iframe re-render.
    await expect
      .poll(
        async () => (await sectionEl.getAttribute("class")) ?? "",
        { message: "iframe section gains a hidden-* class after toggling off" },
      )
      .toMatch(/hidden-(mobile|tablet|desktop)/);
  });

  // ──────────────────────────────────────────────────────────────────────
  // 30. (line 53) Clicking the eye AGAIN un-hides the widget and restores
  //     it in the iframe.
  //
  //   Logic:
  //     1. Boot Home, pick a body section.
  //     2. Click the eye once to enter the hidden state (same as case 29).
  //     3. Verify the hidden-* class arrived.
  //     4. Click the eye a second time.
  //     5. Assert:
  //         • Button's aria-label flips back to "Hide section".
  //         • The iframe section's class no longer matches hidden-*.
  //
  //   Why real-only: covers the reverse patch — proves the round-trip
  //   isn't write-once and the storefront's SectionWrapperEditor correctly
  //   drops the hidden-* class when the override switches back to visible.
  //
  //   Note on state hygiene:
  //     This test pair (29 + 30) is balanced — at the end the section is
  //     back to visible. We never call Save, so even if the test errors
  //     between 29 and 30 the next session boots a fresh editor that
  //     re-fetches the canonical config. No risk of leaving a hidden
  //     section in production state.
  // ──────────────────────────────────────────────────────────────────────
  test("30. clicking the eye a second time un-hides the widget", async ({
    editor,
  }) => {
    await editor.open();
    await editor.waitForIframeReady();

    const id = await editor.firstBodySectionId();
    const btn = editor.visibilityButton(id);
    const sectionEl = editor.iframeSection(id);

    // First click → hidden.
    await btn.click();
    await expect(btn).toHaveAttribute("aria-label", "Show section");
    await expect
      .poll(async () => (await sectionEl.getAttribute("class")) ?? "")
      .toMatch(/hidden-(mobile|tablet|desktop)/);

    // Second click → visible again.
    await btn.click();
    await expect(btn).toHaveAttribute("aria-label", "Hide section");
    await expect
      .poll(
        async () => (await sectionEl.getAttribute("class")) ?? "",
        { message: "hidden-* class is dropped after second toggle" },
      )
      .not.toMatch(/hidden-(mobile|tablet|desktop)/);
  });
});
