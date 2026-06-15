// Single source of truth for the E2E "preview target" — the storefront the
// editor loads inside its iframe, and how Playwright (re)starts it.
//
// Used only by playwright.config.ts's webServer block. The tests themselves
// run fully against the real platform: the editor authenticates with a real
// token, fetches the real theme, and the iframe renders the real storefront.
// Per-test credentials (mid / token / previewOrigin) live in
// support/real-test.ts (`realEnv`), derived from env. Nothing here hardcodes
// a merchant's section structure or theme — that all comes from the live BE.
//
// The editor is app-agnostic: it can preview ANY storefront that integrates
// @shopkit/editor-bridge. momsco on :4344 is only the DEFAULT target and is
// fully overridable via env, so the same suite runs against bblunt,
// wellversed, storefront-starter, or a purpose-built fixture app.
//
// NOTE: today the editor's preview-origin override pins the iframe to :4344
// (the dev-only VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE path), so the chosen
// target must serve on :4344.
export const target = {
  /** Origin the editor iframes — also the webServer healthcheck URL. */
  previewOrigin: process.env.E2E_PREVIEW_ORIGIN ?? "http://localhost:4344",
  /** How Playwright (re)starts the target storefront if it isn't running. */
  storefrontCmd: process.env.E2E_STOREFRONT_CMD ?? "bun run dev",
  storefrontCwd: process.env.E2E_STOREFRONT_CWD ?? "../momsco",
} as const;
