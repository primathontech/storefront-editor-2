import { defineConfig } from "vitest/config";
import path from "path";

// Mirrors the per-package vitest setup used across packages/* (jsdom +
// globals + v8 coverage with an honest-floor threshold). The editor app
// is mostly untested UI today, so the global thresholds are deliberately
// low floors — raise them as coverage grows, never lower them.
//
// JSX: esbuild's automatic runtime (matches tsconfig `jsx: react-jsx`) so
// `.tsx` tests need no `import React`. We don't wire @vitejs/plugin-react
// here — vitest's esbuild transform is enough for tests, and the plugin's
// Fast-Refresh transform isn't needed (and mis-transforms under this
// vite/vitest pairing). Same approach as packages/app-shell.
export default defineConfig({
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    // Workspace packages can drag in their own React; force one copy so
    // hooks dispatch through a single instance (matches vite.config.ts).
    dedupe: ["react", "react-dom"],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    testTimeout: 10000,
    hookTimeout: 10000,
    pool: "forks",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.d.ts",
        "**/*.test.ts",
        "**/*.test.tsx",
        "src/__tests__/**",
        "src/main.tsx",
      ],
      thresholds: {
        statements: 0.5,
        branches: 5,
        functions: 3,
        lines: 0.5,
      },
    },
  },
});
