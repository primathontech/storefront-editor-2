/**
 * Store Shape Contracts (machines/bridge ↔ stores)
 *
 * The XState machines (App.tsx, ThemeSession.tsx, TemplateEditor.tsx) and
 * the preview bridge reach into these stores by name via getState(). If a
 * store renames a field or drops an action, those call sites break silently
 * — the editor still compiles but a lane stops working at runtime.
 *
 * THIS IS A MANUAL TEST — it encodes the cross-module contract between the
 * machines and the Zustand stores. Mirrors the package-level *.contract.test
 * convention (e.g. discounts ↔ cart).
 */
import { describe, it, expect } from "vitest";
import { useAuthStore } from "../../stores/authStore";
import { useThemeStore } from "../../stores/themeStore";
import { useTemplateStore } from "../../stores/templateStore";

const isFn = (v: unknown) => typeof v === "function";

describe("authStore shape (appBootMachine ↔ authStore)", () => {
  const s = useAuthStore.getState();
  it.each(["setSession", "clear"])("exposes %s()", (k) => {
    expect(isFn((s as unknown as Record<string, unknown>)[k])).toBe(true);
  });
  it.each(["token", "merchant"])("has field %s", (k) => {
    expect(k in s).toBe(true);
  });
});

describe("themeStore shape (themeSessionMachine ↔ themeStore)", () => {
  const s = useThemeStore.getState();
  it.each(["setTheme", "setAssets", "setCurrentTemplate", "setLanguage", "clear"])(
    "exposes %s()",
    (k) => {
      expect(isFn((s as unknown as Record<string, unknown>)[k])).toBe(true);
    },
  );
  it.each(["theme", "schemas", "sections", "currentTemplate", "language", "assetsStatus"])(
    "has field %s",
    (k) => {
      expect(k in s).toBe(true);
    },
  );
});

describe("templateStore shape (templateSessionMachine + bridge ↔ templateStore)", () => {
  const s = useTemplateStore.getState();
  // Actions the machine actors / preview-bridge invoke by name.
  it.each([
    "setPageConfig",
    "setSelectedSection",
    "setSelectedWidget",
    "setTranslationData",
    "updateWidgetSettings",
    "updateSectionSettings",
    "addSectionFromLibrary",
    "removeSection",
    "moveSection",
    "validateAllHtml",
    "reset",
  ])("exposes %s()", (k) => {
    expect(isFn((s as unknown as Record<string, unknown>)[k])).toBe(true);
  });

  it("pageConfig starts null", () => {
    expect(useTemplateStore.getState().pageConfig).toBeNull();
  });
});

describe("stores are subscribable zustand stores", () => {
  it.each([
    ["auth", useAuthStore],
    ["theme", useThemeStore],
    ["template", useTemplateStore],
  ])("%s store has getState/setState/subscribe", (_name, store) => {
    expect(isFn(store.getState)).toBe(true);
    expect(isFn(store.setState)).toBe(true);
    expect(isFn(store.subscribe)).toBe(true);
  });
});
