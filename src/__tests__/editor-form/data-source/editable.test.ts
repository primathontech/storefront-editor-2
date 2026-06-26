import { describe, it, expect } from "vitest";
import {
  resolveEditableDataSource,
  getSectionEditableDataSources,
} from "../../../editor-form/data-source/editable";

describe("data-source editable", () => {
  describe("resolveEditableDataSource", () => {
    it("resolves a pinned single COLLECTION", () => {
      const r = resolveEditableDataSource("c1", {
        type: "COLLECTION",
        params: { handle: "best-sellers", productLimit: 8 },
      });
      expect(r).toMatchObject({
        key: "c1",
        type: "COLLECTION",
        value: "best-sellers",
        entry: { mode: "single", paramKey: "handle", optionSource: "collections" },
      });
    });

    it("resolves a pinned multi COLLECTION_BY_HANDLES", () => {
      const r = resolveEditableDataSource("c2", {
        type: "COLLECTION_BY_HANDLES",
        params: { handles: ["a", "b"], productLimit: 8 },
      });
      expect(r?.entry.mode).toBe("multi");
      expect(r?.value).toEqual(["a", "b"]);
    });

    it("resolves PRODUCT to the products catalog", () => {
      const r = resolveEditableDataSource("p1", {
        type: "PRODUCT",
        params: { handle: "shampoo" },
      });
      expect(r?.entry.optionSource).toBe("products");
    });

    it("locks route-driven handles ({{…}} interpolation)", () => {
      expect(
        resolveEditableDataSource("p1", {
          type: "PRODUCT",
          params: { handle: "{{params.handle}}" },
        }),
      ).toBeNull();
    });

    it("locks empty params (route-resolved PDP/PLP)", () => {
      expect(
        resolveEditableDataSource("p1", { type: "PRODUCT", params: {} }),
      ).toBeNull();
      expect(
        resolveEditableDataSource("c1", {
          type: "COLLECTION",
          params: { productLimit: 12 },
        }),
      ).toBeNull();
    });

    it("ignores non-editable types (COLLECTIONS, STATIC)", () => {
      expect(
        resolveEditableDataSource("x", {
          type: "COLLECTIONS",
          params: { first: 50 },
        }),
      ).toBeNull();
      expect(
        resolveEditableDataSource("x", {
          type: "STATIC",
          params: { foo: "bar" },
        }),
      ).toBeNull();
    });

    it("drops empty/interpolation entries from a multi value", () => {
      const r = resolveEditableDataSource("c2", {
        type: "COLLECTION_BY_HANDLES",
        params: { handles: ["a", "", "{{x}}", "b"] },
      });
      expect(r?.value).toEqual(["a", "b"]);
    });

    it("keeps an emptied COLLECTION_BY_HANDLES editable (so chips can be re-added)", () => {
      const r = resolveEditableDataSource("c2", {
        type: "COLLECTION_BY_HANDLES",
        params: { handles: [] },
      });
      expect(r).not.toBeNull();
      expect(r?.entry.mode).toBe("multi");
      expect(r?.value).toEqual([]);
    });

    it("keeps a COLLECTION_BY_HANDLES with no handles param editable", () => {
      const r = resolveEditableDataSource("c2", {
        type: "COLLECTION_BY_HANDLES",
        params: {},
      });
      expect(r?.value).toEqual([]);
    });
  });

  describe("getSectionEditableDataSources", () => {
    it("returns editable sources referenced by a section's widgets, deduped", () => {
      const dataSources = {
        ds1: { type: "COLLECTION_BY_HANDLES", params: { handles: ["a"] } },
        ds2: { type: "PRODUCT", params: {} }, // route-driven -> excluded
      };
      const section = {
        widgets: [
          { dataSourceKey: "ds1" },
          { dataSourceKey: "ds1" }, // dup -> deduped
          { dataSourceKey: "ds2" }, // locked -> excluded
          { dataSourceKey: null },
          {},
        ],
      };
      const result = getSectionEditableDataSources(section, dataSources);
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("ds1");
    });
  });
});
