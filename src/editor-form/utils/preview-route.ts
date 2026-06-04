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
  return typeof path === "string" && path.includes(":");
}

export function buildPreviewUrl(
  origin: string,
  path: string | undefined,
): string {
  const safePath = isUnhydratedPath(path) ? "/" : path || "/";
  return `${origin}${safePath}?editor=true`;
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
