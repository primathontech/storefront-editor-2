// Global test setup — registered via vitest.config.ts `setupFiles`.
//
// Mirrors packages/cart/src/__tests__/setup.ts (real-backing-store
// localStorage mock) and adds:
//   - @testing-library/jest-dom matchers (toBeInTheDocument, etc.)
//   - sessionStorage parity
//   - RTL cleanup() after every test
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const createStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  };
};

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: sessionStorageMock,
  writable: true,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorageMock.clear();
  sessionStorageMock.clear();
});
