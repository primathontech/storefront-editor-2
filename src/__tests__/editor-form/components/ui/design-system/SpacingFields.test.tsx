// SOURCE: apps/visual-editor/src/editor-form/components/ui/design-system/SpacingFields/SpacingFields.tsx
//
// SpacingFields is the SUT and runs for real; it composes the real Input
// sibling (not mocked) for each of the four sides. We cover title/subtitle,
// default vs custom labels, the controlled value -> input value mapping, the
// onChange contract (immutably patches the changed side: numeric string ->
// number, empty -> "", non-numeric -> retains prior value), unit suffix, and
// disabled state. data-side on each input lets us target the four fields.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import {
  SpacingFields,
  type SpacingValue,
} from "../../../../../editor-form/components/ui/design-system/SpacingFields/SpacingFields";

const baseValue: SpacingValue = { top: 1, right: 2, bottom: 3, left: 4 };

const inputForSide = (side: string) =>
  document.querySelector(`input[data-side="${side}"]`) as HTMLInputElement;

describe("SpacingFields — header and labels", () => {
  it("renders the title and subtitle", () => {
    render(
      <SpacingFields
        title="Section padding"
        subtitle="in pixels"
        value={baseValue}
        onChange={() => {}}
      />
    );
    expect(screen.getByText("Section padding")).toBeInTheDocument();
    expect(screen.getByText("in pixels")).toBeInTheDocument();
  });

  it("renders default side labels", () => {
    render(<SpacingFields title="t" value={baseValue} onChange={() => {}} />);
    expect(screen.getByText("Top")).toBeInTheDocument();
    expect(screen.getByText("Right")).toBeInTheDocument();
    expect(screen.getByText("Bottom")).toBeInTheDocument();
    expect(screen.getByText("Left")).toBeInTheDocument();
  });

  it("renders custom labels when provided, falling back per-side", () => {
    render(
      <SpacingFields
        title="t"
        labels={{ top: "T", left: "L" }}
        value={baseValue}
        onChange={() => {}}
      />
    );
    expect(screen.getByText("T")).toBeInTheDocument();
    expect(screen.getByText("L")).toBeInTheDocument();
    // Unspecified sides fall back to defaults.
    expect(screen.getByText("Right")).toBeInTheDocument();
    expect(screen.getByText("Bottom")).toBeInTheDocument();
  });

  it("forwards the ref to the root div", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <SpacingFields ref={ref} title="t" value={baseValue} onChange={() => {}} />
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

describe("SpacingFields — values and unit", () => {
  it("maps each value onto its input", () => {
    render(<SpacingFields title="t" value={baseValue} onChange={() => {}} />);
    expect(inputForSide("top")).toHaveValue(1);
    expect(inputForSide("right")).toHaveValue(2);
    expect(inputForSide("bottom")).toHaveValue(3);
    expect(inputForSide("left")).toHaveValue(4);
  });

  it("renders the unit suffix on each field", () => {
    render(
      <SpacingFields title="t" unit="rem" value={baseValue} onChange={() => {}} />
    );
    expect(screen.getAllByText("rem")).toHaveLength(4);
  });
});

describe("SpacingFields — onChange contract", () => {
  // Note: inputs are type=number, so jsdom rejects non-numeric strings and
  // reports "" for them; the empty-string branch covers the cleared case.
  it("patches only the changed side with a numeric value", () => {
    const onChange = vi.fn();
    render(
      <SpacingFields title="t" value={baseValue} onChange={onChange} />
    );
    fireEvent.change(inputForSide("top"), { target: { value: "9" } });
    expect(onChange).toHaveBeenCalledWith({ ...baseValue, top: 9 });
  });

  it("sets the side to empty string when cleared", () => {
    const onChange = vi.fn();
    render(
      <SpacingFields title="t" value={baseValue} onChange={onChange} />
    );
    fireEvent.change(inputForSide("right"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith({ ...baseValue, right: "" });
  });
});

describe("SpacingFields — disabled", () => {
  it("disables all four inputs", () => {
    render(
      <SpacingFields title="t" disabled value={baseValue} onChange={() => {}} />
    );
    expect(inputForSide("top")).toBeDisabled();
    expect(inputForSide("right")).toBeDisabled();
    expect(inputForSide("bottom")).toBeDisabled();
    expect(inputForSide("left")).toBeDisabled();
  });
});
