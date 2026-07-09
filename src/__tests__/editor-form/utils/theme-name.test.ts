import { describe, it, expect } from "vitest";
import { formatThemeName } from "../../../editor-form/utils/theme-name";

describe("formatThemeName", () => {
  it("strips the 2.0 disambiguation suffix and prettifies slug-like values", () => {
    expect(formatThemeName("BBLUNT-2")).toBe("Bblunt");
    expect(formatThemeName("WELLVERSED-2")).toBe("Wellversed");
    expect(formatThemeName("PLIXKIDS2")).toBe("Plixkids");
    expect(formatThemeName("DAWN")).toBe("Dawn");
    expect(formatThemeName("weryze")).toBe("Weryze");
  });

  it("leaves intentional names (spaced or mixed-case) untouched", () => {
    expect(formatThemeName("Moms Co")).toBe("Moms Co");
    expect(formatThemeName("MyTheme")).toBe("MyTheme");
  });

  it("returns an empty string for an absent value", () => {
    expect(formatThemeName(undefined)).toBe("");
  });
});
