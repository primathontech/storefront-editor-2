import { defineConfig, devices } from "@playwright/test";
import { target } from "./e2e/target.config";

// E2E config for the visual editor.
//
// Two servers must be up: the editor (Vite) and the preview storefront
// (momsco by default, :4344). Both are started here if not already running
// (reuseExistingServer locally; in CI we always boot fresh).
//
// The editor port is configurable via E2E_EDITOR_PORT so this config matches
// whatever NEXT_PUBLIC_EDITOR_ORIGIN the target storefront's bridge expects.
// Default is 5173 (vite's default); set the env var to align with a
// storefront that allowlists a different port.
const EDITOR_PORT = Number(process.env.E2E_EDITOR_PORT ?? 5173);
const EDITOR_URL = `http://localhost:${EDITOR_PORT}`;

export default defineConfig({
  testDir: "./e2e/specs",
  // Some bridge state (postMessage origin allowlists, the editor's preview
  // mode marker) is effectively page-global. Keep the suite serial until we
  // explicitly redesign for parallelism — the runtime is < 30s today.
  fullyParallel: false,
  workers: 1,
  // Hard cap per test. 45s covers the slowest path (boot + iframe load +
  // template switch chain in case 10) with comfortable headroom.
  timeout: 45_000,
  // Default expect() poll timeout. Individual assertions can extend this
  // when they wait on cross-frame events (bridge handshake, iframe nav).
  expect: { timeout: 10_000 },
  // CI flake budget — never re-run locally so timing bugs surface fast.
  retries: process.env.CI ? 2 : 0,
  // Fail loud if a spec accidentally drifts to .only or hangs on an open
  // handle. CI-only — locally these slow the dev loop.
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "e2e/.report" }], ["github"]]
    : [["list"], ["html", { open: "never", outputFolder: "e2e/.report" }]],
  use: {
    baseURL: EDITOR_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Tighten action waits so a hung locator can't burn the full test
    // timeout silently. expect() still controls polling timeouts.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // --strictPort makes vite fail loudly if the port is taken rather
      // than silently bumping to the next free one (which would leave
      // baseURL pointing at nothing).
      command: `bun run dev -- --port ${EDITOR_PORT} --strictPort`,
      url: EDITOR_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    // The preview target storefront — only booted for a LOCAL target (momsco
    // on :4344 by default). When E2E_PREVIEW_ORIGIN points at a remote
    // (staging/prod) storefront it's already deployed, so we don't start one
    // and don't health-check a local port that will never come up.
    ...(target.isLocalTarget
      ? [
          {
            command: target.storefrontCmd,
            cwd: target.storefrontCwd,
            url: target.previewOrigin,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            stdout: "ignore" as const,
            stderr: "pipe" as const,
          },
        ]
      : []),
  ],
});
