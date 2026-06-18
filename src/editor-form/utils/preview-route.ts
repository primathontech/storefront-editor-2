/**
 * Pure helpers for turning a template's `routeContext.path` into the
 * iframe URL the editor previews against.
 *
 * A template's path is either concrete (`/products/blue-tshirt`) or an
 * unhydrated template (`/products/:handle`). The editor can't preview
 * unhydrated paths — it routes through the real storefront, and Next
 * can't render a dynamic route without a value for the param. Two
 * call-sites care:
 *
 *  - TemplateEditor's `buildPreviewUrl` derives the iframe URL.
 *  - TemplateSwitchDropdown disables unhydrated options.
 *
 * Both go through the same predicate so the gate and the URL builder
 * can't drift.
 */

export function isUnhydratedPath(path: string | undefined): boolean {
  if (typeof path !== "string") return false;
  // An unhydrated path still carries a route placeholder the editor can't
  // resolve to a real page. Merchants author paths in either convention:
  //   - Next bracket:  /products/[handle], /blog/[...slug]
  //   - colon style:   /products/:handle
  // A concrete preview path (e.g. /products/natural-baby-shampoo-200ml) has
  // neither. `:[A-Za-z]` (not a bare `:`) so a stray "://" can't false-positive.
  return /\[[^\]]+\]/.test(path) || /:[A-Za-z]/.test(path);
}

export function buildPreviewUrl(
  origin: string,
  path: string | undefined,
  draft?: { previewId?: string | null; version?: number | null },
): string {
  const safePath = isUnhydratedPath(path) ? "/" : path || "/";
  const params = new URLSearchParams({ editor: "true" });
  // When a "Save and Preview" draft exists, ask the storefront to resolve it
  // for the INITIAL render so the iframe shows the draft directly instead of
  // flashing the live (published) page first. The middleware forwards this as
  // the preview header for ?editor=true requests only (transient, no cookies);
  // the editor-bridge then drives subsequent live edits via ?previewKey.
  if (draft?.previewId) {
    params.set("editorPreview", "true");
    params.set("previewId", draft.previewId);
    if (draft.version != null) params.set("version", String(draft.version));
  }
  return `${origin}${safePath}?${params.toString()}`;
}

/**
 * Build the initial iframe URL for the static-template editor preview
 * lane. Used ONCE when TranslationEditor mounts; subsequent template
 * switches go through `switchStaticTemplate` (postMessage →
 * router.replace inside the iframe) so the iframe document stays alive
 * across switches.
 *
 * Unlike `buildPreviewUrl`, this does NOT consume a template's
 * `routeContext.path` — static templates are mounted by a single
 * registry-driven route on the storefront (`/editor-preview/static`),
 * with `templateId` carried in the query string so it's swappable via
 * `router.replace` from inside the iframe. Each merchant's per-page
 * layout (e.g. `(policies)/`) is irrelevant; the registry IS the seam.
 */
export function buildStaticPreviewUrl(
  origin: string,
  templateId: string,
  language?: string,
): string {
  const params = new URLSearchParams();
  params.set("editor", "true");
  params.set("templateId", templateId);
  if (language) {
    params.set("lang", language);
  }
  return `${origin}/editor-preview/static?${params.toString()}`;
}
