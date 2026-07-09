// Hand-written (not ATS): resolveAssetUrl rebases merchant public/ asset paths
// onto the storefront preview origin for editor-origin DOM. Kept in its own file
// so a regenerate of the auto-generated preview-route.test.ts can't clobber it.
import { describe, it, expect } from "vitest";
import { resolveAssetUrl } from "../../editor-form/utils/preview-route";

const ORIGIN = "http://localhost:4344";

describe("resolveAssetUrl", () => {
  it("prefixes a root-relative path with the preview origin", () => {
    expect(resolveAssetUrl(ORIGIN, "/assets/momsco/hero.webp")).toBe(
      "http://localhost:4344/assets/momsco/hero.webp",
    );
  });

  it("strips a trailing slash on the origin so it can't double up", () => {
    expect(resolveAssetUrl("http://localhost:4344/", "/a/b.webp")).toBe(
      "http://localhost:4344/a/b.webp",
    );
  });

  it("leaves absolute URLs (library/CDN images) untouched", () => {
    expect(resolveAssetUrl(ORIGIN, "https://cdn.example/x.png")).toBe(
      "https://cdn.example/x.png",
    );
  });

  it("leaves data: and blob: URIs untouched", () => {
    expect(resolveAssetUrl(ORIGIN, "data:image/png;base64,AAAA")).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(resolveAssetUrl(ORIGIN, "blob:http://x/abc")).toBe("blob:http://x/abc");
  });

  it("returns the path unchanged when there is no preview origin", () => {
    expect(resolveAssetUrl(undefined, "/a/b.webp")).toBe("/a/b.webp");
  });

  it("passes through empty/undefined values", () => {
    expect(resolveAssetUrl(ORIGIN, "")).toBe("");
    expect(resolveAssetUrl(ORIGIN, undefined)).toBeUndefined();
  });
});
