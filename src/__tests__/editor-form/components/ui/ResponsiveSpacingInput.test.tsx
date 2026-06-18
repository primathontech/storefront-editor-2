// SOURCE: apps/visual-editor/src/editor-form/components/ui/ResponsiveSpacingInput.tsx
//
// Behavioral test for the per-breakpoint spacing input. The component is the
// SUT and runs for real, composing the real design-system SpacingFields (whose
// labeled number inputs we drive directly). The active breakpoint is derived
// from the real editorUiStore (zustand) — we set it via setDevice rather than
// mocking the store, exercising the desktop/tablet/mobile + fullscreen->desktop
// mapping. We assert the onChange payloads written into the correct breakpoint
// slot and the showMargin branch.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "@testing-library/react";
import { ResponsiveSpacingInput } from "../../../../editor-form/components/ui/ResponsiveSpacingInput";
import { useEditorUiStore } from "../../../../stores/editorUiStore";
import type { Device } from "../../../../stores/editorUiStore";

const setDevice = (device: Device) =>
  act(() => useEditorUiStore.getState().setDevice(device));

// SpacingFields renders one labeled <input type=number> per side. Target by
// the visible side-label text, walking up to the wrapping field div.
const sideInput = (label: string) =>
  screen.getByText(label).closest("div")?.querySelector("input") as
    | HTMLInputElement
    | undefined;

beforeEach(() => {
  // Reset device to the default before each test.
  setDevice("desktop");
});

describe("ResponsiveSpacingInput — rendering", () => {
  it("shows both margin and padding fields by default", () => {
    render(<ResponsiveSpacingInput value={{}} onChange={vi.fn()} />);
    expect(screen.getByText("Section margin")).toBeInTheDocument();
    expect(screen.getByText("Section padding")).toBeInTheDocument();
  });

  it("hides margin fields when showMargin is false", () => {
    render(
      <ResponsiveSpacingInput value={{}} onChange={vi.fn()} showMargin={false} />,
    );
    expect(screen.queryByText("Section margin")).toBeNull();
    expect(screen.getByText("Section padding")).toBeInTheDocument();
  });

  it("renders the values for the active (desktop) breakpoint", () => {
    setDevice("desktop");
    render(
      <ResponsiveSpacingInput
        value={{
          desktop: {
            padding: { top: 11, right: 22, bottom: 33, left: 44 },
            margin: { top: 1, right: 2, bottom: 3, left: 4 },
          },
        }}
        onChange={vi.fn()}
      />,
    );
    expect((sideInput("Top padding") as HTMLInputElement).value).toBe("11");
    expect((sideInput("Left margin") as HTMLInputElement).value).toBe("4");
  });

  it("defaults missing breakpoint values to zero", () => {
    setDevice("desktop");
    render(<ResponsiveSpacingInput value={{}} onChange={vi.fn()} />);
    expect((sideInput("Top padding") as HTMLInputElement).value).toBe("0");
    expect((sideInput("Bottom margin") as HTMLInputElement).value).toBe("0");
  });
});

describe("ResponsiveSpacingInput — editing", () => {
  it("writes a padding change into the desktop slot, preserving other sides", () => {
    setDevice("desktop");
    const onChange = vi.fn();
    render(
      <ResponsiveSpacingInput
        value={{
          desktop: {
            padding: { top: 5, right: 6, bottom: 7, left: 8 },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(sideInput("Top padding")!, { target: { value: "99" } });

    expect(onChange).toHaveBeenCalledWith({
      desktop: {
        padding: { top: 99, right: 6, bottom: 7, left: 8 },
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    });
  });

  it("writes a margin change into the desktop slot", () => {
    setDevice("desktop");
    const onChange = vi.fn();
    render(<ResponsiveSpacingInput value={{}} onChange={onChange} />);

    fireEvent.change(sideInput("Right margin")!, { target: { value: "12" } });

    expect(onChange).toHaveBeenCalledWith({
      desktop: {
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        margin: { top: 0, right: 12, bottom: 0, left: 0 },
      },
    });
  });

  it("targets the tablet slot when device is tablet", () => {
    setDevice("tablet");
    const onChange = vi.fn();
    render(<ResponsiveSpacingInput value={{}} onChange={onChange} />);

    fireEvent.change(sideInput("Left padding")!, { target: { value: "3" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tablet: expect.objectContaining({
          padding: { top: 0, right: 0, bottom: 0, left: 3 },
        }),
      }),
    );
  });

  it("targets the mobile slot when device is mobile", () => {
    setDevice("mobile");
    const onChange = vi.fn();
    render(<ResponsiveSpacingInput value={{}} onChange={onChange} />);

    fireEvent.change(sideInput("Bottom padding")!, { target: { value: "7" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        mobile: expect.objectContaining({
          padding: { top: 0, right: 0, bottom: 7, left: 0 },
        }),
      }),
    );
  });

  it("maps the fullscreen device to the desktop breakpoint", () => {
    setDevice("fullscreen");
    const onChange = vi.fn();
    render(<ResponsiveSpacingInput value={{}} onChange={onChange} />);

    fireEvent.change(sideInput("Top padding")!, { target: { value: "1" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        desktop: expect.objectContaining({
          padding: { top: 1, right: 0, bottom: 0, left: 0 },
        }),
      }),
    );
  });

  it("does not throw when no onChange handler is provided", () => {
    setDevice("desktop");
    render(<ResponsiveSpacingInput value={{}} />);
    expect(() =>
      fireEvent.change(sideInput("Top padding")!, { target: { value: "5" } }),
    ).not.toThrow();
  });

  it("merges into existing other-breakpoint values without clobbering them", () => {
    setDevice("mobile");
    const onChange = vi.fn();
    render(
      <ResponsiveSpacingInput
        value={{
          desktop: {
            padding: { top: 100, right: 0, bottom: 0, left: 0 },
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
          },
        }}
        onChange={onChange}
      />,
    );

    fireEvent.change(sideInput("Top padding")!, { target: { value: "9" } });

    const payload = onChange.mock.calls[0][0];
    // Untouched desktop slot is preserved.
    expect(payload.desktop.padding.top).toBe(100);
    // New mobile slot reflects the edit.
    expect(payload.mobile.padding.top).toBe(9);
  });
});
