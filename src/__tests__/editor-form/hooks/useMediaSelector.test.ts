// Hook test — cross-frame media picker. openMediaSelector posts
// OPEN_MEDIA_SELECTOR to the parent; the module-level listener resolves
// the pending callback when the parent posts MEDIA_SELECTED back.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useMediaSelector, type MediaObject } from "../../../editor-form/hooks/useMediaSelector";

const media = (id: string): MediaObject => ({
  id,
  src: `https://cdn/${id}.jpg`,
  url: `https://cdn/${id}.jpg`,
  altText: null,
  width: 100,
  height: 100,
  position: 0,
  isMain: true,
});

// Drive the module-level window "message" listener.
const postFromParent = (data: unknown) =>
  window.dispatchEvent(new MessageEvent("message", { data }));

let postSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  postSpy = vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
});
afterEach(() => postSpy.mockRestore());

describe("useMediaSelector", () => {
  it("posts OPEN_MEDIA_SELECTOR to the parent with the options", () => {
    const { result } = renderHook(() => useMediaSelector());
    result.current.openMediaSelector(vi.fn(), { multiple: true });
    expect(postSpy).toHaveBeenCalledWith(
      { type: "OPEN_MEDIA_SELECTOR", options: { multiple: true } },
      "*",
    );
  });

  it("resolves the callback with the chosen media on MEDIA_SELECTED", () => {
    const { result } = renderHook(() => useMediaSelector());
    const onSelect = vi.fn();
    result.current.openMediaSelector(onSelect);

    const chosen = [media("a"), media("b")];
    postFromParent({ type: "MEDIA_SELECTED", media: chosen });
    expect(onSelect).toHaveBeenCalledWith(chosen);
  });

  it("resolves with null when the picker is cancelled (no media)", () => {
    const { result } = renderHook(() => useMediaSelector());
    const onSelect = vi.fn();
    result.current.openMediaSelector(onSelect);

    postFromParent({ type: "MEDIA_SELECTED" });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("ignores unrelated message types", () => {
    const { result } = renderHook(() => useMediaSelector());
    const onSelect = vi.fn();
    result.current.openMediaSelector(onSelect);

    postFromParent({ type: "SOMETHING_ELSE" });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("fires the pending callback only once (cleared after response)", () => {
    const { result } = renderHook(() => useMediaSelector());
    const onSelect = vi.fn();
    result.current.openMediaSelector(onSelect);

    postFromParent({ type: "MEDIA_SELECTED", media: [media("a")] });
    postFromParent({ type: "MEDIA_SELECTED", media: [media("b")] }); // no pending cb now
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
