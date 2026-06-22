// Provider + hook test — the resizable right-sidebar width context.
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  RightSidebarWidthProvider,
  useRightSidebarWidth,
} from "../../../editor-form/context/RightSidebarWidthContext";

describe("useRightSidebarWidth", () => {
  it("returns the default width (360) outside any provider", () => {
    const { result } = renderHook(() => useRightSidebarWidth());
    expect(result.current.width).toBe(360);
    expect(typeof result.current.setWidth).toBe("function");
  });

  it("setWidth updates the width within the provider", () => {
    const { result } = renderHook(() => useRightSidebarWidth(), {
      wrapper: RightSidebarWidthProvider,
    });
    expect(result.current.width).toBe(360);
    act(() => result.current.setWidth(500));
    expect(result.current.width).toBe(500);
  });
});
