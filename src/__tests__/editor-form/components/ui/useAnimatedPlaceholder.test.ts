// Hook test — the typewriter placeholder. Uses fake timers to advance the
// type-on animation deterministically.
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimatedPlaceholder } from "../../../../editor-form/components/ui/useAnimatedPlaceholder";

afterEach(() => vi.useRealTimers());

describe("useAnimatedPlaceholder", () => {
  it("starts empty and types the text out one character at a time", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnimatedPlaceholder(["Hi"]));
    expect(result.current).toBe("");

    act(() => void vi.advanceTimersByTime(70));
    expect(result.current).toBe("H");

    act(() => void vi.advanceTimersByTime(70));
    expect(result.current).toBe("Hi");
  });

  it("never returns more characters than the current text holds", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAnimatedPlaceholder(["Go"]));
    act(() => void vi.advanceTimersByTime(1000));
    expect("Go".startsWith(result.current)).toBe(true);
  });
});
