// Layer 3 — Unit. Pure object/key helpers, no store refs, no side effects.
import { describe, it, expect } from "vitest";
import {
  isTranslationKey,
  getTranslationPath,
  createTranslationKey,
  setValueByPath,
  deepMerge,
  flattenPaths,
  processSectionWidgets,
  createSectionTranslations,
  buildTranslationService,
} from "../../editor-form/utils/translation-utils";

describe("translation key helpers", () => {
  it("isTranslationKey is true only for 't:'-prefixed strings", () => {
    expect(isTranslationKey("t:hero.title")).toBe(true);
    expect(isTranslationKey("hero.title")).toBe(false);
    expect(isTranslationKey(42)).toBe(false);
    expect(isTranslationKey(null)).toBe(false);
  });

  it("getTranslationPath strips the 't:' prefix and splits on dots", () => {
    expect(getTranslationPath("t:sections.hero.title")).toEqual([
      "sections",
      "hero",
      "title",
    ]);
  });

  it("createTranslationKey joins a path back into a 't:' ref", () => {
    expect(createTranslationKey(["sections", "hero", "title"])).toBe(
      "t:sections.hero.title",
    );
  });

  it("getTranslationPath and createTranslationKey round-trip", () => {
    const key = "t:common.header.cta";
    expect(createTranslationKey(getTranslationPath(key))).toBe(key);
  });
});

describe("setValueByPath", () => {
  it("sets a top-level key without mutating the input", () => {
    const input = { a: 1 };
    const out = setValueByPath(input, ["b"], 2);
    expect(out).toEqual({ a: 1, b: 2 });
    expect(input).toEqual({ a: 1 }); // immutable
  });

  it("sets a nested key, creating intermediate objects", () => {
    const out = setValueByPath({}, ["sections", "hero", "title"], "Hi");
    expect(out).toEqual({ sections: { hero: { title: "Hi" } } });
  });

  it("preserves sibling keys at each level", () => {
    const input = { sections: { hero: { title: "old" }, footer: { x: 1 } } };
    const out = setValueByPath(input, ["sections", "hero", "title"], "new");
    expect(out.sections.hero.title).toBe("new");
    expect(out.sections.footer).toEqual({ x: 1 });
  });
});

describe("deepMerge", () => {
  it("recursively merges nested objects", () => {
    const target = { a: { x: 1 }, b: 2 };
    const source = { a: { y: 3 } };
    expect(deepMerge(target, source)).toEqual({ a: { x: 1, y: 3 }, b: 2 });
  });

  it("source scalar values override target values", () => {
    expect(deepMerge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it("arrays are replaced wholesale, not merged element-wise", () => {
    expect(deepMerge({ list: [1, 2, 3] }, { list: [9] })).toEqual({
      list: [9],
    });
  });

  it("does not mutate the target", () => {
    const target = { a: { x: 1 } };
    deepMerge(target, { a: { y: 2 } });
    expect(target).toEqual({ a: { x: 1 } });
  });
});

describe("flattenPaths", () => {
  it("returns one path array per leaf value", () => {
    const paths = flattenPaths({ a: { b: 1, c: 2 }, d: 3 });
    expect(paths).toEqual([["a", "b"], ["a", "c"], ["d"]]);
  });

  it("treats arrays as leaves (does not descend into them)", () => {
    const paths = flattenPaths({ list: [1, 2], name: "x" });
    expect(paths).toEqual([["list"], ["name"]]);
  });

  it("returns an empty list for an empty object", () => {
    expect(flattenPaths({})).toEqual([]);
  });
});

describe("processSectionWidgets (template-scoped key remap)", () => {
  it("remaps t:sections.<old>.* refs to the new section key and collects them", () => {
    const widgets = [
      { id: "w1", settings: { title: "t:sections.hero.title" } },
    ];
    const { remappedWidgets, translationKeys, oldSectionPattern } =
      processSectionWidgets(widgets, "hero_abc123", "home", false);

    expect(remappedWidgets[0].settings.title).toBe(
      "t:sections.hero_abc123.title",
    );
    expect(translationKeys).toContain("t:sections.hero.title");
    expect(oldSectionPattern).toBe("hero");
  });

  it("passes common keys (t:common.*) through unchanged", () => {
    const widgets = [{ id: "w1", settings: { label: "t:common.header.cta" } }];
    const { remappedWidgets } = processSectionWidgets(
      widgets,
      "hero_abc123",
      "home",
      false,
    );
    expect(remappedWidgets[0].settings.label).toBe("t:common.header.cta");
  });

  it("does not remap when the section is common (isCommon=true)", () => {
    const widgets = [{ id: "w1", settings: { title: "t:sections.hero.title" } }];
    const { remappedWidgets, oldSectionPattern } = processSectionWidgets(
      widgets,
      "hero_abc123",
      "home",
      true,
    );
    expect(remappedWidgets[0].settings.title).toBe("t:sections.hero.title");
    expect(oldSectionPattern).toBeNull();
  });

  it("leaves widgets without settings untouched", () => {
    const widgets = [{ id: "w1" }];
    const { remappedWidgets } = processSectionWidgets(
      widgets,
      "x",
      "home",
      false,
    );
    expect(remappedWidgets[0]).toEqual({ id: "w1" });
  });
});

describe("createSectionTranslations (default-value builder)", () => {
  it("builds a sections.<newKey> subtree from the language defaults", () => {
    const out = createSectionTranslations(
      ["t:sections.hero.title"],
      { en: { "sections.hero.title": "Welcome" } },
      "en",
      "hero",
      "hero_abc123",
    );
    expect(out).toEqual({ sections: { hero_abc123: { title: "Welcome" } } });
  });

  it("falls back to 'en' defaults when the language has no entry", () => {
    const out = createSectionTranslations(
      ["t:sections.hero.title"],
      { en: { "sections.hero.title": "Welcome" } },
      "fr",
      "hero",
      "hero_abc123",
    );
    expect(out.sections.hero_abc123.title).toBe("Welcome");
  });

  it("uses an empty-string default when no matching default exists", () => {
    const out = createSectionTranslations(
      ["t:sections.hero.title"],
      { en: {} },
      "en",
      "hero",
      "hero_abc123",
    );
    expect(out.sections.hero_abc123.title).toBe("");
  });

  it("skips keys that don't match the old section pattern", () => {
    const out = createSectionTranslations(
      ["t:common.header.cta", "t:sections.other.title"],
      { en: {} },
      "en",
      "hero",
      "hero_abc123",
    );
    expect(out).toEqual({});
  });
});

describe("buildTranslationService", () => {
  it("returns null when common + template are both empty", () => {
    expect(buildTranslationService({}, {}, "en")).toBeNull();
  });

  it("returns a TranslationService when there are translations to serve", () => {
    const ts = buildTranslationService(
      { common: { hi: "Hello" } },
      { hero: { title: "Welcome" } },
      "en",
    );
    expect(ts).not.toBeNull();
    expect(typeof ts!.translateObject).toBe("function");
  });
});
