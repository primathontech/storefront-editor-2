// Layer 3 — Unit. Static-lane translation store: merged view + per-leaf
// source map drives write-back routing.
import { describe, it, expect, beforeEach } from "vitest";
import { useTranslationStore } from "../../stores/translationStore";

const reset = () =>
  useTranslationStore.setState({
    commonTranslations: {},
    templateTranslations: {},
    translations: {},
    translationSourceMap: new Map(),
    hasUnsavedChanges: false,
  });

describe("translationStore", () => {
  beforeEach(reset);

  it("setTranslationData merges common + template into the view", () => {
    useTranslationStore.getState().setTranslationData({
      common: { header: { title: "Common" } },
      template: { hero: { cta: "Buy" } },
    });
    const s = useTranslationStore.getState();
    expect(s.translations).toEqual({
      header: { title: "Common" },
      hero: { cta: "Buy" },
    });
    expect(s.hasUnsavedChanges).toBe(false);
  });

  it("builds a source map tagging each leaf path's origin", () => {
    useTranslationStore.getState().setTranslationData({
      common: { header: { title: "Common" } },
      template: { hero: { cta: "Buy" } },
    });
    const map = useTranslationStore.getState().translationSourceMap;
    expect(map.get("header.title")).toBe("common");
    expect(map.get("hero.cta")).toBe("template");
  });

  it("updateTranslation writes back to the 'common' slice for common keys", () => {
    useTranslationStore.getState().setTranslationData({
      common: { header: { title: "Common" } },
      template: {},
    });
    useTranslationStore.getState().updateTranslation(["header", "title"], "Edited");
    const s = useTranslationStore.getState();
    expect(s.commonTranslations).toEqual({ header: { title: "Edited" } });
    expect(s.translations).toEqual({ header: { title: "Edited" } });
    expect(s.hasUnsavedChanges).toBe(true);
  });

  it("updateTranslation defaults unknown paths to the 'template' slice", () => {
    useTranslationStore.getState().setTranslationData({ common: {}, template: {} });
    useTranslationStore.getState().updateTranslation(["new", "key"], "Value");
    const s = useTranslationStore.getState();
    expect(s.templateTranslations).toEqual({ new: { key: "Value" } });
    expect(s.commonTranslations).toEqual({});
  });

  it("markSaved clears the unsaved flag", () => {
    useTranslationStore.getState().setTranslationData({ common: {}, template: {} });
    useTranslationStore.getState().updateTranslation(["a"], "b");
    expect(useTranslationStore.getState().hasUnsavedChanges).toBe(true);
    useTranslationStore.getState().markSaved();
    expect(useTranslationStore.getState().hasUnsavedChanges).toBe(false);
  });

  it("reset returns the store to its initial empty state", () => {
    useTranslationStore.getState().setTranslationData({
      common: { a: "1" },
      template: { b: "2" },
    });
    useTranslationStore.getState().reset();
    const s = useTranslationStore.getState();
    expect(s.commonTranslations).toEqual({});
    expect(s.templateTranslations).toEqual({});
    expect(s.translations).toEqual({});
    expect(s.translationSourceMap.size).toBe(0);
    expect(s.hasUnsavedChanges).toBe(false);
  });
});
