// Layer 3 — Unit. templateStore edit actions: pageConfig mutations,
// section/widget CRUD, data-source refcounting, selection, translations.
//
// The edit actions fire preview-bridge commits (commitClient*/commitServer).
// With no bridge registered those are safe no-ops; afterEach cancels the
// commitServer debounce timer so it can't fire after teardown.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useTemplateStore } from "../../stores/templateStore";
import { useThemeStore } from "../../stores/themeStore";
import { unregisterPreviewBridge } from "../../editor-form/preview-bridge";

const section = (id: string, widgets: unknown[] = [], extra: object = {}) => ({
  id,
  type: "ContentSection",
  settings: {},
  widgets,
  ...extra,
});
const widget = (id: string, extra: object = {}) => ({
  id,
  type: "Heading",
  settings: {},
  ...extra,
});

const setConfig = (sections: unknown[], dataSources: object = {}) =>
  useTemplateStore.getState().setPageConfig({ sections, dataSources });

beforeEach(() => {
  useTemplateStore.getState().reset();
  useThemeStore.setState({
    theme: null,
    schemas: {},
    sections: {},
    currentTemplate: null,
    language: "en",
    assetsStatus: "idle",
  });
});

afterEach(() => {
  // Cancel any pending commitServer() debounce timer scheduled by a structural edit.
  unregisterPreviewBridge();
});

describe("selection", () => {
  it("setSelectedSection opens the settings drawer and clears widget selection", () => {
    useTemplateStore.setState({ selectedWidgetId: "w1" });
    useTemplateStore.getState().setSelectedSection("s1");
    const s = useTemplateStore.getState();
    expect(s.selectedSectionId).toBe("s1");
    expect(s.selectedWidgetId).toBeNull();
    expect(s.showSettingsDrawer).toBe(true);
  });

  it("setSelectedSection(null) closes the drawer", () => {
    useTemplateStore.getState().setSelectedSection(null);
    expect(useTemplateStore.getState().showSettingsDrawer).toBe(false);
  });

  it("toggleSectionExpansion flips membership in the expanded set", () => {
    const { toggleSectionExpansion } = useTemplateStore.getState();
    toggleSectionExpansion("s1");
    expect(useTemplateStore.getState().expandedSections.has("s1")).toBe(true);
    toggleSectionExpansion("s1");
    expect(useTemplateStore.getState().expandedSections.has("s1")).toBe(false);
  });
});

describe("settings edits", () => {
  it("updateSectionSettings sets a key without mutating other sections", () => {
    setConfig([section("a"), section("b")]);
    useTemplateStore.getState().updateSectionSettings("a", "padding", 8);
    const secs = useTemplateStore.getState().pageConfig.sections;
    expect(secs[0].settings.padding).toBe(8);
    expect(secs[1].settings).toEqual({});
  });

  it("updateWidgetSettings sets a nested widget key", () => {
    setConfig([section("a", [widget("w1")])]);
    useTemplateStore.getState().updateWidgetSettings("a", "w1", "text", "Hi");
    const w = useTemplateStore.getState().pageConfig.sections[0].widgets[0];
    expect(w.settings.text).toBe("Hi");
  });

  it("setSectionVisibility records per-breakpoint visibility", () => {
    setConfig([section("a")]);
    useTemplateStore.getState().setSectionVisibility("a", "mobile", false);
    // Visibility lives at `settings.responsive[bp].visible` (where both the
    // sidebar and the iframe read it), not on a separate `section.visibility`
    // key — see setSectionVisibility in templateStore.ts.
    expect(
      useTemplateStore.getState().pageConfig.sections[0].settings.responsive
        .mobile.visible,
    ).toBe(false);
  });

  it("settings edits on an unknown section are a no-op", () => {
    setConfig([section("a")]);
    const before = useTemplateStore.getState().pageConfig;
    useTemplateStore.getState().updateSectionSettings("missing", "x", 1);
    expect(useTemplateStore.getState().pageConfig).toBe(before);
  });
});

describe("structural edits", () => {
  it("addSection inserts at the given index and selects it", () => {
    setConfig([section("a"), section("c")]);
    useTemplateStore.getState().addSection(section("b"), 1);
    const s = useTemplateStore.getState();
    expect(s.pageConfig.sections.map((x: { id: string }) => x.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(s.selectedSectionId).toBe("b");
    expect(s.expandedSections.has("b")).toBe(true);
  });

  it("moveSection reorders the sections array", () => {
    setConfig([section("s1"), section("s2"), section("s3")]);
    useTemplateStore.getState().moveSection("s1", "s3");
    expect(
      useTemplateStore.getState().pageConfig.sections.map((x: { id: string }) => x.id),
    ).toEqual(["s2", "s3", "s1"]);
  });

  it("removeWidget drops one widget and clears widget selection", () => {
    setConfig([section("a", [widget("w1"), widget("w2")])]);
    useTemplateStore.getState().removeWidget("a", "w1");
    const s = useTemplateStore.getState();
    expect(s.pageConfig.sections[0].widgets.map((w: { id: string }) => w.id)).toEqual([
      "w2",
    ]);
    expect(s.selectedWidgetId).toBeNull();
  });
});

describe("removeSection — data-source refcounting", () => {
  it("drops a data source no other section references", () => {
    setConfig(
      [section("a", [widget("w1", { dataSourceKey: "ds1" })])],
      { ds1: { type: "products", params: {} } },
    );
    useTemplateStore.getState().removeSection("a");
    const pc = useTemplateStore.getState().pageConfig;
    expect(pc.sections).toHaveLength(0);
    expect(pc.dataSources.ds1).toBeUndefined();
  });

  it("keeps a data source still referenced by another section", () => {
    setConfig(
      [
        section("a", [widget("w1", { dataSourceKey: "ds1" })]),
        section("b", [widget("w2", { dataSourceKey: "ds1" })]),
      ],
      { ds1: { type: "products", params: {} } },
    );
    useTemplateStore.getState().removeSection("a");
    const pc = useTemplateStore.getState().pageConfig;
    expect(pc.sections.map((x: { id: string }) => x.id)).toEqual(["b"]);
    expect(pc.dataSources.ds1).toBeDefined();
  });
});

describe("data sources", () => {
  it("addDataSource / updateDataSource / removeDataSource", () => {
    setConfig([], {});
    const store = useTemplateStore.getState();
    store.addDataSource("ds1", "collections", { handle: "all" });
    expect(useTemplateStore.getState().pageConfig.dataSources.ds1.type).toBe(
      "collections",
    );
    store.updateDataSource("ds1", { required: true });
    expect(
      useTemplateStore.getState().pageConfig.dataSources.ds1.required,
    ).toBe(true);
    store.removeDataSource("ds1");
    expect(
      useTemplateStore.getState().pageConfig.dataSources.ds1,
    ).toBeUndefined();
  });
});

describe("addSectionFromLibrary", () => {
  it("clones a library section with fresh unique ids", () => {
    setConfig([], {});
    useThemeStore.setState({
      sections: {
        hero: {
          id: "hero",
          name: "Hero",
          type: "HeroSection",
          isCommon: true,
          settings: {},
          widgets: [{ id: "heading", type: "Heading", settings: {} }],
        },
      } as never,
    });
    useTemplateStore.getState().addSectionFromLibrary("hero");
    const s = useTemplateStore.getState();
    expect(s.pageConfig.sections).toHaveLength(1);
    const added = s.pageConfig.sections[0];
    expect(added.id).toMatch(/^hero-/);
    expect(added.widgets[0].id).toMatch(/^heading-/);
    expect(s.selectedSectionId).toBe(added.id);
  });

  it("provisions a data source for widgets with a dataSourceTemplate", () => {
    setConfig([], {});
    useThemeStore.setState({
      currentTemplate: { id: "home", isDynamic: true },
      sections: {
        grid: {
          id: "grid",
          name: "Grid",
          type: "GridSection",
          isCommon: true,
          settings: {},
          widgets: [
            {
              id: "list",
              type: "ProductGrid",
              settings: {},
              dataSourceTemplate: { type: "products", params: { first: 8 } },
            },
          ],
        },
      } as never,
    });
    useTemplateStore.getState().addSectionFromLibrary("grid");
    const pc = useTemplateStore.getState().pageConfig;
    const keys = Object.keys(pc.dataSources);
    expect(keys).toHaveLength(1);
    expect(pc.dataSources[keys[0]].type).toBe("products");
    expect(pc.sections[0].widgets[0].dataSourceKey).toBe(keys[0]);
  });

  it("is a no-op for an unknown library key", () => {
    setConfig([section("a")], {});
    useTemplateStore.getState().addSectionFromLibrary("does-not-exist");
    expect(useTemplateStore.getState().pageConfig.sections).toHaveLength(1);
  });
});

describe("read helpers", () => {
  it("getSelectedSection / getSelectedWidget resolve the current selection", () => {
    setConfig([section("a", [widget("w1")])]);
    const store = useTemplateStore.getState();
    store.setSelectedSection("a");
    store.setSelectedWidget("w1");
    expect(useTemplateStore.getState().getSelectedSection().id).toBe("a");
    expect(useTemplateStore.getState().getSelectedWidget().id).toBe("w1");
  });

  it("getSelectedSection returns null when nothing is selected", () => {
    setConfig([section("a")]);
    expect(useTemplateStore.getState().getSelectedSection()).toBeNull();
  });
});

describe("translations", () => {
  it("setTranslationData populates slices and the source map", () => {
    useTemplateStore.getState().setTranslationData({
      common: { header: { title: "C" } },
      template: { hero: { cta: "Buy" } },
    });
    const s = useTemplateStore.getState();
    expect(s.commonTranslations).toEqual({ header: { title: "C" } });
    expect(s.translationSourceMap.get("header.title")).toBe("common");
    expect(s.translationSourceMap.get("hero.cta")).toBe("template");
  });

  it("updateTranslation routes to the correct slice and flags unsaved", () => {
    useTemplateStore.getState().setTranslationData({
      common: { header: { title: "C" } },
      template: {},
    });
    useTemplateStore.getState().updateTranslation(["header", "title"], "Edited");
    const s = useTemplateStore.getState();
    expect(s.commonTranslations.header.title).toBe("Edited");
    expect(s.hasUnsavedTranslations).toBe(true);
  });
});
