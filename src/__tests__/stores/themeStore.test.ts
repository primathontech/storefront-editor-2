// Layer 3 — Unit. Merchant-scoped theme store. Focus on the non-trivial
// bit: setCurrentTemplate's language coercion.
import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "../../stores/themeStore";
import type {
  ThemeStructure,
  ThemeStructureTemplate,
} from "../../editor-form/services/api";

const THEME: ThemeStructure = {
  id: "momsco",
  name: "Momsco",
  templateStructure: [],
};

const tmpl = (
  over: Partial<ThemeStructureTemplate> = {},
): ThemeStructureTemplate => ({
  id: "home",
  name: "Home",
  isDynamic: true,
  supportedLanguages: ["en", "fr"],
  ...over,
});

describe("themeStore", () => {
  beforeEach(() => {
    useThemeStore.setState({
      theme: null,
      schemas: {},
      sections: {},
      currentTemplate: null,
      language: "en",
      assetsStatus: "idle",
    });
  });

  it("setTheme stores the structure", () => {
    useThemeStore.getState().setTheme(THEME);
    expect(useThemeStore.getState().theme).toEqual(THEME);
  });

  it("setAssets stores schemas + sections and flips status to ready", () => {
    const schemas = { Heading: { type: "Heading" } } as never;
    const sections = { hero: { id: "hero" } } as never;
    useThemeStore.getState().setAssets(schemas, sections);
    const s = useThemeStore.getState();
    expect(s.schemas).toBe(schemas);
    expect(s.sections).toBe(sections);
    expect(s.assetsStatus).toBe("ready");
  });

  it("setLanguage updates the active language", () => {
    useThemeStore.getState().setLanguage("fr");
    expect(useThemeStore.getState().language).toBe("fr");
  });

  describe("setCurrentTemplate language coercion", () => {
    it("keeps the current language when the new template supports it", () => {
      useThemeStore.setState({ language: "fr" });
      useThemeStore.getState().setCurrentTemplate(tmpl({ supportedLanguages: ["en", "fr"] }));
      expect(useThemeStore.getState().language).toBe("fr");
    });

    it("coerces to the first supported language when current is unsupported", () => {
      useThemeStore.setState({ language: "de" });
      useThemeStore.getState().setCurrentTemplate(tmpl({ supportedLanguages: ["en", "fr"] }));
      expect(useThemeStore.getState().language).toBe("en");
    });

    it("falls back to 'en' when a template declares no supported languages", () => {
      useThemeStore.setState({ language: "de" });
      useThemeStore
        .getState()
        .setCurrentTemplate(tmpl({ supportedLanguages: undefined }));
      expect(useThemeStore.getState().language).toBe("en");
    });

    it("clearing the template (null) leaves language untouched", () => {
      useThemeStore.setState({ language: "fr" });
      useThemeStore.getState().setCurrentTemplate(null);
      const s = useThemeStore.getState();
      expect(s.currentTemplate).toBeNull();
      expect(s.language).toBe("fr");
    });
  });

  it("clear resets every slice", () => {
    useThemeStore.getState().setTheme(THEME);
    useThemeStore.getState().setLanguage("fr");
    useThemeStore.getState().clear();
    const s = useThemeStore.getState();
    expect(s.theme).toBeNull();
    expect(s.currentTemplate).toBeNull();
    expect(s.language).toBe("en");
    expect(s.assetsStatus).toBe("idle");
  });
});
