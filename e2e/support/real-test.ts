// Real-backend test harness — opposite of support/test.ts.
//
//   support/test.ts        → mocked visual-editor-be (deterministic, fast,
//                            but synthetic data).
//   support/real-test.ts   → live visual-editor-be + live storefront at
//                            localhost:4344. No /api/v1 mocks. The editor
//                            authenticates, fetches the real theme, loads
//                            the real pageConfig, and the iframe renders
//                            against the actual merchant DOM.
//
// Why two harnesses:
//   - The mocked harness covers boot / auth / save plumbing the real
//     backend can't safely exercise (e.g. wrong-token 401, save failure).
//   - The real harness covers UI behavior the mock can't reproduce — the
//     dropdown's "set sample params" gating, the real section order, the
//     iframe ↔ sidebar bidirectional bridge over the actual storefront.
//
// Auth: the dev backend accepts any Bearer token, so a literal "e2e-real"
// works without a login round-trip. Override via env if a different
// merchant or token is needed.
//
// Preview origin: the BE returns the deployed storefront URL
// (https://momsco-qa.primathontech.co.in). The editor supports a dev-only
// `?previewOrigin=` override gated by VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE
// AND a localhost regex — both true in this repo's .env — so we redirect
// the iframe at http://localhost:4344 without touching the BE response.
import {
  test as base,
  expect,
  type APIRequestContext,
  type FrameLocator,
  type Locator,
  type Page,
} from "@playwright/test";

export interface RealEnv {
  readonly mid: string;
  readonly token: string;
  readonly previewOrigin: string;
}

export const realEnv: RealEnv = {
  mid: process.env.E2E_REAL_MID ?? "19arhposfw3y",
  token: process.env.E2E_REAL_TOKEN ?? "e2e-real",
  // The origin the iframe loads — must match what the editor resolves the
  // merchant's storefront to. E2E_REAL_PREVIEW_ORIGIN overrides just the
  // harness; otherwise it follows E2E_PREVIEW_ORIGIN (the same var the
  // webServer/target config uses) so ONE var points the whole run at a
  // staging/prod storefront. Defaults to local momsco.
  previewOrigin:
    process.env.E2E_REAL_PREVIEW_ORIGIN ??
    process.env.E2E_PREVIEW_ORIGIN ??
    "http://localhost:4344",
};

/** Poll a URL until it responds OK, instead of a single fragile ping.
 *
 *  WHY: the Next.js storefront dev server cold-compiles routes on the FIRST
 *  request after boot/restart, which can take well over a single-shot 5s
 *  timeout. A one-attempt preflight therefore skipped whole spec files
 *  (whichever ran first) on a cold or briefly-restarting server. Retrying
 *  across a generous budget rides out cold-compile and transient blips, so
 *  `beforeAll` only declares an upstream "down" when it's genuinely down.
 *
 *  Returns true as soon as a response is ok(); false if every attempt within
 *  the budget failed. Each failed attempt already consumes up to
 *  `perTryTimeout`, so retries naturally space out; a small gap is added on
 *  fast non-ok/exception responses. */
export async function waitForUpstream(
  request: APIRequestContext,
  url: string,
  opts: {
    attempts?: number;
    perTryTimeout?: number;
    gapMs?: number;
    headers?: Record<string, string>;
  } = {},
): Promise<boolean> {
  const { attempts = 6, perTryTimeout = 8_000, gapMs = 1_500, headers } = opts;
  for (let i = 0; i < attempts; i++) {
    try {
      const r = await request.get(url, { timeout: perTryTimeout, headers });
      if (r.ok()) return true;
    } catch {
      // unreachable / timed out this attempt — fall through to retry
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, gapMs));
    }
  }
  return false;
}

/** Page-object scoped to the real-backend flow. Discovers sidebar section
 *  IDs at runtime (the mocked harness gets these from a worker fixture; we
 *  read them from the live DOM instead). */
export class RealEditor {
  constructor(public readonly page: Page) {}

  /** The root grid; mounts only after auth+theme load succeed. */
  get root(): Locator {
    return this.page.getByTestId("editor-root");
  }

  /** The iframe element wrapping the live storefront. */
  get previewFrame(): Locator {
    return this.page.getByTestId("preview-iframe");
  }

  /** The settings drawer; mounts on selection. */
  get settingsDrawer(): Locator {
    return this.page.getByTestId("settings-drawer");
  }

  /** Template dropdown trigger (ARIA-anchored — design-system safe). */
  get templateTrigger(): Locator {
    return this.page.locator('button[aria-haspopup="listbox"]').first();
  }

  /** The dropdown's open listbox (portal-mounted on document.body). */
  get listbox(): Locator {
    return this.page.getByRole("listbox");
  }

  /** Sidebar chrome heading — shows the active template's name. Filter
   *  by text rather than role because Tailwind ships a <span> here, not a
   *  semantic heading. */
  sidebarTitle(text: string | RegExp): Locator {
    return this.page
      .locator("span.text-base.font-semibold.leading-5")
      .filter({ hasText: text });
  }

  /** A sidebar section row keyed by its pageConfig id. */
  sectionRow(id: string): Locator {
    return this.page.getByTestId(`section-${id}`);
  }

  /** All rendered sidebar section rows, in DOM order. */
  get allSectionRows(): Locator {
    return this.page.locator('[data-testid^="section-"]');
  }

  /** Read the sidebar's section IDs in render order. */
  async sectionIds(): Promise<string[]> {
    const rows = await this.allSectionRows.all();
    const ids: string[] = [];
    for (const row of rows) {
      const testid = await row.getAttribute("data-testid");
      if (testid) ids.push(testid.replace(/^section-/, ""));
    }
    return ids;
  }

  /** Read the iframe's section IDs in render order (via the editor-bridge
   *  `data-section-id` markers the storefront stamps in editor mode). */
  async iframeSectionIds(): Promise<string[]> {
    const frame = this.page.frameLocator('[data-testid="preview-iframe"]');
    const ids = await frame
      .locator("[data-section-id]")
      .evaluateAll((els) =>
        els.map((el) => (el as HTMLElement).dataset.sectionId ?? ""),
      );
    return ids.filter(Boolean);
  }

  /** Wait for the iframe to be ready for editor interaction. NOT just
   *  `body.children > 0`, and NOT even `data-section-id` markers — both go
   *  true BEFORE the editor-bridge finishes connecting. The bridge appends a
   *  single `[data-preview-overlay]` container to the iframe body once the
   *  handshake completes and it can position selection overlays; until then
   *  a `select` message posts into a not-yet-wired iframe and the overlay
   *  never mounts. Gate on that container (which appears after the markers)
   *  — it's the definitive "ready for selection" signal. */
  async waitForIframeReady(timeout = 20_000): Promise<void> {
    await expect
      .poll(
        async () => {
          const frame = this.page.frame({
            url: (u) => u.href.startsWith(realEnv.previewOrigin),
          });
          if (!frame) return 0;
          return frame.evaluate(
            () =>
              document.querySelectorAll("[data-section-id]").length > 0 &&
              document.querySelectorAll("[data-preview-overlay]").length > 0
                ? 1
                : 0,
          );
        },
        { timeout, message: "iframe bridge should mount the overlay container" },
      )
      .toBe(1);
  }

  /** Boot the editor against the real backend, with the iframe redirected
   *  at localhost:4344. Resolves when the editor root + at least one
   *  sidebar row are visible. */
  async open(): Promise<void> {
    const params = new URLSearchParams({
      mid: realEnv.mid,
      token: realEnv.token,
      previewOrigin: realEnv.previewOrigin,
    });
    await this.page.goto(`/?${params.toString()}`);
    await expect(this.root).toBeVisible({ timeout: 30_000 });
    await expect(this.allSectionRows.first()).toBeVisible({ timeout: 30_000 });
  }

  /** Open the template dropdown if not already open. */
  async openDropdown(): Promise<void> {
    if ((await this.templateTrigger.getAttribute("aria-expanded")) === "true") {
      return;
    }
    await this.templateTrigger.click();
    await expect(this.listbox).toBeVisible();
  }

  /** Close the dropdown via Escape (deterministic, no layout dependency). */
  async closeDropdownWithEscape(): Promise<void> {
    if ((await this.templateTrigger.getAttribute("aria-expanded")) === "false") {
      return;
    }
    await this.page.keyboard.press("Escape");
    await expect(this.templateTrigger).toHaveAttribute("aria-expanded", "false");
  }

  /** Switch to a template by visible label, wait for the chrome to update. */
  async switchTemplate(label: string): Promise<void> {
    await this.openDropdown();
    await this.listbox.getByRole("option", { name: label, exact: true }).click();
    await expect(this.templateTrigger).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    // The new template's pageConfig refetches; wait for sidebar to repopulate.
    await expect(this.allSectionRows.first()).toBeVisible({ timeout: 20_000 });
  }

  /** Switch to whatever ENABLED template the live dropdown currently offers,
   *  other than the active one (and any label in `avoid`). Returns the chosen
   *  label so callers can assert the chrome heading.
   *
   *  WHY data-driven, not a hard-coded label: which templates are hydrated
   *  (enabled) vs. carry a route placeholder (disabled "— set sample params")
   *  and what they're named both drift on the QA backend — e.g. "Products
   *  (Default)" became unhydrated and "Account (Default)" was renamed. Picking
   *  from the live, enabled options keeps these switches green across theme
   *  changes. Disabled (unhydrated) and chrome-hidden (header/footer) options
   *  are never selected — see TemplateSwitchDropdown.tsx. */
  async switchToOtherTemplate(
    opts: { avoid?: readonly string[] } = {},
  ): Promise<string> {
    await this.openDropdown();
    const current = (await this.templateTrigger.textContent())?.trim() ?? "";
    const avoid = new Set<string>([current, ...(opts.avoid ?? [])]);
    const options = this.listbox.getByRole("option");
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const option = options.nth(i);
      if (await option.isDisabled()) continue;
      const label = (await option.textContent())?.trim() ?? "";
      if (!label || avoid.has(label)) continue;
      await option.click();
      await expect(this.templateTrigger).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(this.allSectionRows.first()).toBeVisible({ timeout: 20_000 });
      return label;
    }
    throw new Error(
      `no enabled template option to switch to (avoiding: ${[...avoid].join(", ")})`,
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helpers used by the case-21+ specs. The earlier suite (cases 11-20)
  // doesn't need iframe-level locators — it only walks chrome / sidebar.
  // The selection-sync, visibility, and rapid-click cases below DO need
  // access to the storefront iframe's `data-section-id` / `data-widget-id`
  // markers and the bridge's PreviewOverlay overlay element.
  // ──────────────────────────────────────────────────────────────────────

  /** FrameLocator into the storefront iframe. */
  get iframe(): FrameLocator {
    return this.page.frameLocator('[data-testid="preview-iframe"]');
  }

  /** The iframe-side <section data-section-id="<id>"> for the given id. */
  iframeSection(id: string): Locator {
    return this.iframe.locator(`[data-section-id="${id}"]`);
  }

  /** The bridge's selection overlay — a single absolutely-positioned
   *  <div data-preview-overlay> appended to the iframe's body. Its second
   *  child is the SELECT box (the first is HOVER); when the editor has a
   *  selection, that box has `display: block` and a transform sitting at
   *  the selected section's page coordinates. */
  get iframeOverlaySelectBox(): Locator {
    return this.iframe.locator("[data-preview-overlay] > div:nth-child(2)");
  }

  /** Read the SELECT overlay's inline style snapshot. Polled by tests to
   *  detect when the bridge has applied / cleared a selection. */
  async iframeOverlaySelectStyle(): Promise<{
    display: string;
    transform: string;
    width: string;
    height: string;
  }> {
    return this.iframeOverlaySelectBox.evaluate((el) => {
      const s = (el as HTMLElement).style;
      return {
        display: s.display,
        transform: s.transform,
        width: s.width,
        height: s.height,
      };
    });
  }

  /** True iff the SELECT overlay is rendered (display !== "none"). */
  async iframeOverlayIsVisible(): Promise<boolean> {
    return (await this.iframeOverlaySelectStyle()).display !== "none";
  }

  /** The clickable widget-title <h2> inside a sidebar row. Selection state
   *  is announced by an inline `color: #1e40af` (rgb(30,64,175)) on this
   *  element — see test 18 for the same anchor. */
  widgetTitle(id: string): Locator {
    return this.sectionRow(id).locator("h2").first();
  }

  /** Read the current selected-widget colour for a row. */
  async titleColor(id: string): Promise<string> {
    return this.widgetTitle(id).evaluate((el) => getComputedStyle(el).color);
  }

  /** A sidebar row's visibility button (eye icon). aria-label flips between
   *  "Hide section" (currently visible) and "Show section" (currently
   *  hidden) — see SidebarSectionGroup.tsx:136. */
  visibilityButton(id: string): Locator {
    return this.sectionRow(id).getByRole("button", {
      name: /(Hide|Show) section/,
    });
  }

  /** Return the first non-Header sidebar section id (Header is sticky and
   *  often overlapped by the editor chrome — body sections are reliably
   *  clickable in both the sidebar AND iframe at the default viewport). */
  async firstBodySectionId(): Promise<string> {
    const ids = await this.sectionIds();
    const body = ids.find((id) => !/header/i.test(id) && !/announcement/i.test(id));
    if (!body) {
      throw new Error(
        `expected at least one non-header section; got ${ids.join(", ")}`,
      );
    }
    return body;
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helpers for cases 31-50 (visibility, reorder/drag, config panel, fields).
  //
  // The earlier specs (cases 11-30) walk chrome + selection. This batch adds:
  //   - drag-and-drop over the dnd-kit drag handle
  //   - read/write the right-side config panel's fields
  //   - exercise repeatable items (Slides) via the ObjectArrayInput
  //   - flip the Save-button-disabled / device-mode state
  //
  // All helpers below are pure DOM affordances — no test-only data injection,
  // no fixtures, no /api mocks. Anchors are aria-labels or stable CSS module
  // class fragments ([class*="…"]) where ARIA is not available; never on
  // generated hashes.
  // ──────────────────────────────────────────────────────────────────────

  /** Sidebar row's drag handle (cursor:grab; PointerSensor anchored).
   *  The `dragHandle` CSS class fragment survives CSS-modules hashing. */
  dragHandle(id: string): Locator {
    return this.sectionRow(id).locator('[class*="dragHandle"]').first();
  }

  /** Drag section A's row onto section B's row using real pointer events.
   *  @dnd-kit's PointerSensor has activationConstraint.distance = 5, so the
   *  sequence MUST include an intermediate move ≥5px BEFORE the move to
   *  the target — otherwise dnd-kit never starts the drag and moveSection
   *  is never called.
   *
   *  Robustness:
   *  After a previous reorder, the applyConfig soft-nav briefly detaches
   *  rows from the DOM. Wait for both handles to be visible (their
   *  layout settled) before reading boundingBox — otherwise `boundingBox`
   *  returns null and we throw early. */
  async dragSectionTo(fromId: string, toId: string): Promise<void> {
    const fromHandle = this.dragHandle(fromId);
    const toRow = this.sectionRow(toId);
    await expect(fromHandle).toBeVisible({ timeout: 10_000 });
    await expect(toRow).toBeVisible({ timeout: 10_000 });

    // Poll for a STABLE boundingBox on both anchors. Right after an
    // applyConfig soft-nav (a previous reorder / a fresh boot) the row
    // can briefly exist with width=0 / height=0 — toBeVisible passes,
    // but mouse.move(NaN,NaN) would do nothing. Wait for measurable
    // geometry before reading coordinates.
    const readBox = async (loc: Locator) => {
      let box: { x: number; y: number; width: number; height: number } | null =
        null;
      await expect
        .poll(
          async () => {
            box = await loc.boundingBox();
            return !!(box && box.width > 1 && box.height > 1);
          },
          {
            timeout: 10_000,
            message: `boundingBox stable for ${await loc.evaluate((el) => (el as HTMLElement).outerHTML?.slice(0, 60))}`,
          },
        )
        .toBe(true);
      return box!;
    };

    const fromBox = await readBox(fromHandle);
    const toBox = await readBox(toRow);
    const fromX = fromBox.x + fromBox.width / 2;
    const fromY = fromBox.y + fromBox.height / 2;
    const toX = toBox.x + toBox.width / 2;
    const toY = toBox.y + toBox.height / 2;

    await this.page.mouse.move(fromX, fromY);
    await this.page.mouse.down();
    // Activation move — must exceed PointerSensor's 5px threshold so the
    // sortable lifecycle (dragStart → dragOver → dragEnd) actually fires.
    await this.page.mouse.move(fromX + 10, fromY + 10, { steps: 5 });
    // Travel to the drop target in steps so dragOver mid-flight registers
    // the right `over` id for closestCenter collision detection.
    await this.page.mouse.move(toX, toY, { steps: 15 });
    await this.page.mouse.up();
  }

  /** Cancel an in-flight drag by pressing Escape while the pointer is down.
   *  dnd-kit listens for keydown on `window` and aborts the active drag
   *  without firing onDragEnd. Used by case 40 (cancelled drag leaves
   *  order unchanged). */
  async cancelDragHalfway(fromId: string, toId: string): Promise<void> {
    const fromBox = await this.dragHandle(fromId).boundingBox();
    const toBox = await this.sectionRow(toId).boundingBox();
    if (!fromBox || !toBox) {
      throw new Error(`drag handles not in DOM for ${fromId} → ${toId}`);
    }
    const fromX = fromBox.x + fromBox.width / 2;
    const fromY = fromBox.y + fromBox.height / 2;
    const midX = (fromX + toBox.x) / 2;
    const midY = (fromY + toBox.y) / 2;

    await this.page.mouse.move(fromX, fromY);
    await this.page.mouse.down();
    await this.page.mouse.move(fromX + 10, fromY + 10, { steps: 5 });
    await this.page.mouse.move(midX, midY, { steps: 10 });
    await this.page.keyboard.press("Escape");
    // Release at the cancel point — dnd-kit ignores the up after abort.
    await this.page.mouse.up();
  }

  /** The right-side drawer's CLOSE button (CloseIcon, aria-label is fixed). */
  get drawerCloseButton(): Locator {
    return this.settingsDrawer.getByRole("button", { name: "Close settings" });
  }

  /** The drawer's <h3> title — renders selectedWidget.name (or its schema
   *  name; for HeroSlideshow it matches the sidebar's row title). */
  get drawerTitle(): Locator {
    return this.settingsDrawer.locator("h3").first();
  }

  /** The Save button in the header. We never click this in cases 31-50 —
   *  the assertions read its disabled state / label to prove changes are
   *  unsaved without firing a write. */
  get saveButton(): Locator {
    return this.page.getByRole("button", { name: /^(save|saving|saved|validating|retry save)/i });
  }

  /** Switch device mode (Desktop / Tablet / Mobile / Fullscreen). The
   *  buttons are aria-anchored and toggle `[aria-pressed="true"]`. */
  async switchDevice(label: "Desktop" | "Tablet" | "Mobile" | "Fullscreen"): Promise<void> {
    await this.page.getByRole("button", { name: `Switch to ${label} view` }).click();
    await expect(
      this.page.getByRole("button", { name: `Switch to ${label} view` }),
    ).toHaveAttribute("aria-pressed", "true");
  }

  /** Find a slide / repeatable-item card by its 1-indexed position inside
   *  the drawer's ObjectArrayInput. Each card has a `[aria-label="Toggle
   *  item N"]` header. The returned locator is the WHOLE item card so
   *  callers can drill into its inputs / trash button. */
  arrayItem(oneBasedIndex: number): Locator {
    return this.settingsDrawer
      .getByRole("button", { name: `Toggle item ${oneBasedIndex}` })
      .locator('xpath=ancestor::*[contains(@class, "itemCard")][1]');
  }

  /** Per-item trash button (aria-label="Remove item N"). */
  arrayItemRemove(oneBasedIndex: number): Locator {
    return this.settingsDrawer.getByRole("button", {
      name: `Remove item ${oneBasedIndex}`,
    });
  }

  /** Per-item expand/collapse toggle. */
  arrayItemToggle(oneBasedIndex: number): Locator {
    return this.settingsDrawer.getByRole("button", {
      name: `Toggle item ${oneBasedIndex}`,
    });
  }

  /** The "+ Add Slides" (or "+ Add Item") button at the bottom of an
   *  ObjectArrayInput. Matched as a relaxed regex because the suffix
   *  depends on the array's `label` prop. */
  get arrayAddButton(): Locator {
    return this.settingsDrawer
      .getByRole("button", { name: /^\+ Add / })
      .first();
  }

  /** Count of repeatable items currently rendered in the drawer. */
  async arrayItemCount(): Promise<number> {
    return this.settingsDrawer
      .getByRole("button", { name: /^Toggle item \d+$/ })
      .count();
  }

  /** A text/number input rendered by ObjectArrayInput under its label.
   *  Each field is a `<div>` containing a `<label>` followed by an Input.
   *  We find the label, then the next sibling's `<input>`. */
  arrayItemField(itemIndex: number, fieldLabel: string): Locator {
    // Anchor: inside the expanded itemBody. labels are real <label> nodes
    // whose text matches exactly (case-sensitive — schema-provided names
    // like "href", "alt", "desktopImage").
    return this.arrayItem(itemIndex)
      .locator(`label:has-text("${fieldLabel}")`)
      .locator("..")
      .locator("input")
      .first();
  }

  /** A SpacingFields side input ("Left margin", "Top margin", etc.). The
   *  side label is rendered as a `<label class="fieldLabel">` inside the
   *  spacing grid; its sibling holds the numeric Input. */
  spacingInput(sideLabel: string): Locator {
    return this.settingsDrawer
      .locator(`label:has-text("${sideLabel}")`)
      .locator("..")
      .locator('input[type="number"]')
      .first();
  }

  /** Iframe-side <img alt="…"> inside the storefront's Hero slideshow —
   *  used to verify text-field edits (alt) reflect into the rendered DOM.
   *
   *  Note: a single slide's alt field is mirrored onto BOTH the
   *  desktopImage and mobileImage <img> elements, so callers commonly see
   *  ≥2 matches. Helpers below return `.first()` and `count()` separately
   *  so spec assertions can be precise without strict-mode flakes. */
  iframeAltImg(altText: string): Locator {
    return this.iframe.locator(`img[alt="${altText}"]`);
  }

  /** First iframe <img alt="…"> match — safe for `toBeVisible()` checks. */
  iframeAltImgFirst(altText: string): Locator {
    return this.iframeAltImg(altText).first();
  }

  // ──────────────────────────────────────────────────────────────────────
  // Helpers for cases 51-70 (config persistence, validation, device modes,
  // Save round-trips). Save-related helpers are deliberately verbose so
  // the destructive contract — mutate, save, assert, revert, save —
  // is visible at the call site.
  // ──────────────────────────────────────────────────────────────────────

  /** Bounding-box width of the preview iframe ELEMENT (parent page side). */
  async iframeBoxWidth(): Promise<number> {
    const box = await this.previewFrame.boundingBox();
    if (!box) throw new Error("preview-iframe not laid out");
    return box.width;
  }

  /** window.innerWidth read INSIDE the storefront iframe. This is what
   *  CSS media queries see — it equals the simulated device width (375
   *  on Mobile, 768 on Tablet, the available area on Desktop /
   *  Fullscreen). */
  async iframeInnerWidth(): Promise<number> {
    const frame = this.page.frame({
      url: (u) => u.href.startsWith(realEnv.previewOrigin),
    });
    if (!frame) throw new Error("preview iframe frame not reachable");
    return frame.evaluate(() => window.innerWidth);
  }

  /** The currently active device-mode label, read from the aria-pressed
   *  state of the four header buttons. */
  async currentDeviceLabel(): Promise<"Desktop" | "Tablet" | "Mobile" | "Fullscreen"> {
    for (const label of ["Desktop", "Tablet", "Mobile", "Fullscreen"] as const) {
      const pressed = await this.page
        .getByRole("button", { name: `Switch to ${label} view` })
        .getAttribute("aria-pressed");
      if (pressed === "true") return label;
    }
    throw new Error("no device button is aria-pressed");
  }

  /** Settings-drawer numeric/text input addressed by its visible label.
   *  The label is rendered by SpacingFields / Input as a <label> element;
   *  the input lives inside the same wrapper. */
  drawerField(label: string): Locator {
    return this.settingsDrawer
      .locator(`label:has-text("${label}")`)
      .locator("..")
      .locator('input[type="number"], input[type="text"]')
      .first();
  }

  /** Commit a value to a controlled number/text input. `.fill()` alone
   *  can leave React's onChange un-fired for some controls — Tab forces
   *  the blur/change that does. */
  async setField(label: string, value: string): Promise<void> {
    const input = this.drawerField(label);
    await input.fill(value);
    await input.press("Tab");
    await expect(input).toHaveValue(value);
  }

  /** Read the current Save button label. Cycles
   *  Save → Validating… → Saving… → Saved → Save (per
   *  EditorHeader.tsx:40-46 SAVE_LABEL map). */
  async saveButtonLabel(): Promise<string> {
    return (await this.saveButton.textContent())?.trim() ?? "";
  }

  /** Click Save and wait for the network PUT to resolve. Returns
   *  "saved" (PUT ok) or "failed" (PUT non-ok).
   *
   *  Why the PUT response, not the button label or toast: under iframe
   *  re-render load, the "Saved" label and the success toast can both
   *  appear AND auto-dismiss faster than a 75ms poll catches. The
   *  network response is the unambiguous signal — Playwright awaits it
   *  directly without polling. The 30s timeout covers slow networks.
   *
   *  We match on the templates PUT URL prefix; the 401/500-forcing
   *  route in case 67 fulfills with a synthetic response that still
   *  surfaces here as a non-ok status, so the helper reports "failed"
   *  consistently. */
  async clickSaveAndWaitForResult(): Promise<"saved" | "failed"> {
    // Save button is in the top-right header. If a prior test left a
    // toast in the top-center region, it can OVERLAP the button briefly
    // and block actionability. Wait for any pending toast to clear, then
    // click.
    await this.page
      .getByText(/successfully/i)
      .first()
      .waitFor({ state: "hidden", timeout: 5_000 })
      .catch(() => undefined);

    // Race two signals:
    //   • The PUT response (definitive — covers the validating → saving
    //     → saved/failed happy paths).
    //   • The Save button flipping to "Retry save" (failure path where
    //     validation rejects BEFORE saving, so no PUT ever fires —
    //     e.g. an AI section with HTML validation errors).
    const putPromise = this.page
      .waitForResponse(
        (res) =>
          /\/api\/v1\/themes\/.+\/templates\/.+$/.test(res.url()) &&
          res.request().method() === "PUT",
        { timeout: 30_000 },
      )
      .then((r) => ({ kind: "put" as const, ok: r.ok() }))
      .catch(() => ({ kind: "put" as const, ok: false, timedOut: true }));

    const retryPromise = this.page
      .getByRole("button", { name: /^retry save$/i })
      .first()
      .waitFor({ state: "visible", timeout: 30_000 })
      .then(() => ({ kind: "retry" as const }))
      .catch(() => null);

    await this.saveButton.first().click();
    const result = await Promise.race([putPromise, retryPromise]);
    if (!result) {
      throw new Error("Save did not settle within 30s (no PUT and no Retry save)");
    }
    if (result.kind === "retry") return "failed";
    return result.ok ? "saved" : "failed";
  }

  /** GET the live BE pageConfig for a given template id. Used by Save
   *  tests as the source of truth for assertions and for the
   *  beforeAll/afterAll fingerprint. */
  async fetchTemplateFromBe(
    themeId: string,
    templateId: string,
  ): Promise<{ sections: Array<{ id: string; settings?: unknown; widgets?: unknown }> } | null> {
    const url = `https://visual-editor-be.primathontech.co.in/api/v1/themes/${themeId}/templates/${templateId}`;
    const r = await this.page.request.get(url, {
      headers: { Authorization: `Bearer ${realEnv.token}` },
    });
    if (!r.ok()) return null;
    const json = await r.json();
    // The BE returns the template under data.template or data directly —
    // sections live at the well-known key in either case.
    const data = (json?.data?.template ?? json?.data ?? json) as {
      sections?: Array<{ id: string; settings?: unknown }>;
    };
    return data?.sections ? { sections: data.sections as never } : null;
  }
}

type RealFixtures = {
  editor: RealEditor;
};

/** Playwright fixtures for real-backend tests. Does NOT inject any mock —
 *  every /api/v1 request reaches the deployed visual-editor-be. */
export const realTest = base.extend<RealFixtures>({
  editor: async ({ page }, use) => {
    const editor = new RealEditor(page);
    await use(editor);
  },
});

export { expect } from "@playwright/test";
