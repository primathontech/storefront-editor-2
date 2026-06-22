// Layer 3 — Unit (heavy: wraps html-validate + eslint browser linters).
// Verifies the validateHtmlContent contract: empty/valid → no errors,
// structurally broken HTML → an [HTML]-tagged error.
import { describe, it, expect } from "vitest";
import { validateHtmlContent } from "../../editor-form/utils/htmlValidation";

describe("validateHtmlContent", () => {
  it("returns no errors for empty / whitespace-only input", async () => {
    expect(await validateHtmlContent("")).toEqual([]);
    expect(await validateHtmlContent("   \n  ")).toEqual([]);
  });

  it("returns no errors for well-formed HTML", async () => {
    expect(await validateHtmlContent("<p>Hello</p>")).toEqual([]);
  });

  it("flags mis-nested / out-of-order closing tags with an [HTML] error", async () => {
    const errors = await validateHtmlContent("<div><span></div></span>");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.startsWith("[HTML]"))).toBe(true);
    // each error carries a 1-based line/column
    expect(errors[0].line).toBeGreaterThanOrEqual(1);
    expect(errors[0].column).toBeGreaterThanOrEqual(1);
  });
});
