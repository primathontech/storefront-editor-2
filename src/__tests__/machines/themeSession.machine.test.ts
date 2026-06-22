// Layer 2 — machine wiring. themeSessionMachine: fetch theme structure →
// ready, with template switching. Real bodies live in ThemeSession.tsx.
import { describe, it, expect, vi } from "vitest";
import { createActor, fromPromise, waitFor } from "xstate";
import {
  themeSessionMachine,
  type ThemeStructure,
  type ThemeStructureTemplate,
} from "../../machines/themeSession";
import type { Merchant } from "../../stores/authStore";

const MERCHANT: Merchant = {
  id: "m1",
  themeId: "momsco",
  previewOrigin: "http://localhost:4344",
};

const THEME: ThemeStructure = { id: "momsco", name: "Momsco", templateStructure: [] };
const TEMPLATE: ThemeStructureTemplate = { id: "about", name: "About", isDynamic: true };

function boot(fetchTheme: () => Promise<ThemeStructure>) {
  const setTheme = vi.fn();
  const selectDefaultTemplate = vi.fn();
  const clearTemplateScopedState = vi.fn();
  const setCurrentTemplate = vi.fn();
  const machine = themeSessionMachine.provide({
    actors: {
      fetchThemeStructure: fromPromise<ThemeStructure, { themeId: string }>(() =>
        fetchTheme(),
      ),
    },
    actions: {
      setTheme,
      selectDefaultTemplate,
      clearTemplateScopedState,
      setCurrentTemplate,
    },
  });
  const actor = createActor(machine, { input: { merchant: MERCHANT } });
  actor.start();
  return {
    actor,
    setTheme,
    selectDefaultTemplate,
    clearTemplateScopedState,
    setCurrentTemplate,
  };
}

describe("themeSessionMachine", () => {
  it("starts in bootingTheme", () => {
    const { actor } = boot(async () => THEME);
    expect(actor.getSnapshot().matches("bootingTheme")).toBe(true);
  });

  it("on successful fetch → ready, calling setTheme then selectDefaultTemplate", async () => {
    const { actor, setTheme, selectDefaultTemplate } = boot(async () => THEME);
    await waitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    expect(setTheme).toHaveBeenCalledTimes(1);
    expect(selectDefaultTemplate).toHaveBeenCalledTimes(1);
  });

  it("on fetch error → errorLoadingTheme, and RETRY can recover", async () => {
    let attempt = 0;
    const { actor } = boot(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("network down");
      return THEME;
    });
    await waitFor(actor, (s) => s.matches("errorLoadingTheme"), { timeout: 2000 });
    actor.send({ type: "RETRY" });
    await waitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    expect(actor.getSnapshot().matches("ready")).toBe(true);
  });

  it("SWITCH_TEMPLATE from ready clears scoped state then sets the new template", async () => {
    const { actor, clearTemplateScopedState, setCurrentTemplate } = boot(
      async () => THEME,
    );
    await waitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    actor.send({ type: "SWITCH_TEMPLATE", template: TEMPLATE });
    expect(clearTemplateScopedState).toHaveBeenCalledTimes(1);
    expect(setCurrentTemplate).toHaveBeenCalledTimes(1);
  });
});
