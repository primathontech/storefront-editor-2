// SOURCE: apps/visual-editor/src/editor-form/components/ui/PromptTextarea.tsx
//
// Behavioral test for the prompt textarea. The component is the SUT and runs
// for real, including its useAnimatedPlaceholder hook (timer-driven, left
// unmocked — we only assert behavior that does not depend on the animation
// state). We exercise typing -> onChange, the rows prop, the
// image-preview-dependent className branch, and onKeyDown forwarding.
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PromptTextarea } from "../../../../editor-form/components/ui/PromptTextarea";

const getTextarea = (c: HTMLElement) =>
  c.querySelector("textarea") as HTMLTextAreaElement;

describe("PromptTextarea", () => {
  it("renders the current value and forwards typed input to onChange", () => {
    const onChange = vi.fn();
    const { container } = render(
      <PromptTextarea value="hello" onChange={onChange} />,
    );
    const ta = getTextarea(container);
    expect(ta.value).toBe("hello");

    fireEvent.change(ta, { target: { value: "hello world" } });
    expect(onChange).toHaveBeenCalledWith("hello world");
  });

  it("defaults to 3 rows and honours an explicit rows prop", () => {
    const { container, rerender } = render(
      <PromptTextarea value="" onChange={vi.fn()} />,
    );
    expect(getTextarea(container).rows).toBe(3);

    rerender(<PromptTextarea value="" onChange={vi.fn()} rows={6} />);
    expect(getTextarea(container).rows).toBe(6);
  });

  it("applies the image className branch only when imagePreviewUrl is set", () => {
    const { container, rerender } = render(
      <PromptTextarea value="" onChange={vi.fn()} />,
    );
    const withoutImage = getTextarea(container).className;

    rerender(
      <PromptTextarea
        value=""
        onChange={vi.fn()}
        imagePreviewUrl="blob:preview"
      />,
    );
    const withImage = getTextarea(container).className;

    // The with-image variant adds an extra class token over the base.
    expect(withImage.length).toBeGreaterThan(withoutImage.length);
    expect(withImage).not.toBe(withoutImage);
  });

  it("forwards onKeyDown events", () => {
    const onKeyDown = vi.fn();
    const { container } = render(
      <PromptTextarea value="" onChange={vi.fn()} onKeyDown={onKeyDown} />,
    );
    fireEvent.keyDown(getTextarea(container), { key: "Enter" });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});
