// SOURCE: apps/visual-editor/src/editor-form/components/ui/design-system/Switch/Switch.tsx
//
// Switch is the SUT and runs for real (role="switch" toggle button). We cover
// both controlled and uncontrolled modes, the onChange callback contract
// (boolean of the next state), keyboard toggling (Space/Enter), disabled
// gating, label/helper/error wiring, sizes, and label position. No mocks.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Switch } from "../../../../../editor-form/components/ui/design-system/Switch/Switch";

const getSwitch = () => screen.getByRole("switch");

describe("Switch — uncontrolled", () => {
  it("defaults to unchecked and toggles on click", () => {
    render(<Switch />);
    const sw = getSwitch();
    expect(sw).toHaveAttribute("aria-checked", "false");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
  });

  it("honors defaultChecked", () => {
    render(<Switch defaultChecked />);
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("fires onChange with the next boolean state", () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange} />);
    fireEvent.click(getSwitch());
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Switch — controlled", () => {
  it("reflects the checked prop and does not self-update", () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onChange={onChange} />);
    const sw = getSwitch();
    fireEvent.click(sw);
    // Stays false because parent controls it; only callback fires.
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders a checked controlled switch", () => {
    render(<Switch checked onChange={() => {}} />);
    expect(getSwitch()).toHaveAttribute("aria-checked", "true");
  });
});

describe("Switch — keyboard", () => {
  it("toggles on Space", () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange} />);
    fireEvent.keyDown(getSwitch(), { key: " " });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("toggles on Enter", () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange} />);
    fireEvent.keyDown(getSwitch(), { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("ignores other keys", () => {
    const onChange = vi.fn();
    render(<Switch onChange={onChange} />);
    fireEvent.keyDown(getSwitch(), { key: "a" });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("Switch — disabled", () => {
  it("does not toggle or fire onChange when disabled", () => {
    const onChange = vi.fn();
    render(<Switch disabled onChange={onChange} />);
    const sw = getSwitch();
    expect(sw).toBeDisabled();
    expect(sw).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(sw);
    fireEvent.keyDown(sw, { key: " " });
    expect(onChange).not.toHaveBeenCalled();
    expect(sw).toHaveAttribute("aria-checked", "false");
  });
});

describe("Switch — label, helper, error, sizes", () => {
  it("renders a label linked via htmlFor", () => {
    render(<Switch label="Enabled" />);
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(getSwitch()).toHaveAttribute("id");
  });

  it("renders helper text and links aria-describedby", () => {
    render(<Switch helperText="hint" />);
    expect(screen.getByText("hint")).toBeInTheDocument();
    expect(getSwitch()).toHaveAttribute("aria-describedby");
  });

  it("shows error over helper text", () => {
    render(<Switch helperText="hint" error="bad" />);
    expect(screen.getByText("bad")).toBeInTheDocument();
    expect(screen.queryByText("hint")).toBeNull();
  });

  const sizes = ["sm", "md", "lg"] as const;
  it.each(sizes)("renders the %s size", (size) => {
    render(<Switch size={size} label={size} />);
    expect(screen.getByText(size)).toBeInTheDocument();
  });

  const positions = ["top", "left"] as const;
  it.each(positions)("renders with labelPosition=%s", (pos) => {
    render(<Switch labelPosition={pos} label="L" />);
    expect(screen.getByText("L")).toBeInTheDocument();
  });

  it("forwards the ref to the button", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Switch ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
