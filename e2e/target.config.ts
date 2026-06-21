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
// LOCAL vs REMOTE target:
//   • Local (default): previewOrigin is localhost — Playwright boots the
//     momsco dev server, and the dev-only VITE_ALLOW_PREVIEW_ORIGIN_OVERRIDE
//     pins the iframe at it.
//   • Remote (staging/prod): set E2E_PREVIEW_ORIGIN to the merchant's already-
//     deployed storefront origin. Playwright then does NOT boot a local
//     storefront (`isLocalTarget` is false → see playwright.config.ts), and
//     the editor loads that origin from the BE merchant record (the localhost-
//     only override no longer applies). Pair with E2E_REAL_MID / E2E_REAL_TOKEN
//     for the merchant and E2E_SKIP_SAVE=1 to stay read-only.
const previewOrigin = process.env.E2E_PREVIEW_ORIGIN ?? "http://localhost:4344";

export const target = {
  /** Origin the editor iframes — also the webServer healthcheck URL. */
  previewOrigin,
  /** True when the storefront is a localhost dev server Playwright should
   *  (re)start. False for a remote (staging/prod) origin that's already up. */
  isLocalTarget: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
    previewOrigin,
  ),
  /** How Playwright (re)starts the target storefront if it isn't running.
   *  Only used when isLocalTarget. */
  storefrontCmd: process.env.E2E_STOREFRONT_CMD ?? "bun run dev",
  storefrontCwd: process.env.E2E_STOREFRONT_CWD ?? "../momsco",
} as const;
