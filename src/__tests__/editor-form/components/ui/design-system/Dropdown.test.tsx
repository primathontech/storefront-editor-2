// SOURCE: apps/visual-editor/src/editor-form/components/ui/design-system/Dropdown/Dropdown.tsx
//
// This is the design-system Dropdown (NOT the portal dropdown under ui/dropdown).
// It renders inline (no portal), uses a flat options array, role="listbox" with
// role="option" buttons, and a click-outside mousedown listener on document.
// The SUT runs for real. The open effect calls scrollIntoView on the selected
// option — absent in jsdom — so we stub just that DOM gap in beforeEach.
// We cover: placeholder vs selected label, label/helper/error precedence and
// aria-invalid, open/close (click, outside-click, disabled gate), selection +
// disabled-option ignore, and keyboard nav (Enter/Space/Escape/Arrows).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Dropdown } from "../../../../../editor-form/components/ui/design-system/Dropdown/Dropdown";

const OPTIONS = [
  { value: "a", label: "Apple" },
  { value: "b", label: "Banana" },
  { value: "c", label: "Cherry", disabled: true },
];

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const getTrigger = () =>
  document.querySelector('[aria-haspopup="listbox"]') as HTMLButtonElement;

describe("Dropdown — display", () => {
  it("shows the placeholder when no value is selected", () => {
    render(<Dropdown options={OPTIONS} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("shows the default placeholder when none provided", () => {
    render(<Dropdown options={OPTIONS} />);
    expect(screen.getByText("Select...")).toBeInTheDocument();
  });

  it("shows the selected option's label", () => {
    render(<Dropdown options={OPTIONS} value="b" />);
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("renders the label and helper text", () => {
    render(<Dropdown options={OPTIONS} label="Choice" helperText="some hint" />);
    expect(screen.getByText("Choice")).toBeInTheDocument();
    expect(screen.getByText("some hint")).toBeInTheDocument();
  });

  it("renders the error message and flags aria-invalid", () => {
    render(<Dropdown options={OPTIONS} error="Required" helperText="hint" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText("hint")).toBeNull();
    expect(getTrigger()).toHaveAttribute("aria-invalid", "true");
  });

  it("supports fullWidth and inline label placement without error", () => {
    render(
      <Dropdown
        options={OPTIONS}
        fullWidth
        labelPlacement="inline"
        label="L"
        containerClassName="cc"
        className="trig"
      />
    );
    expect(screen.getByText("L")).toBeInTheDocument();
    expect(getTrigger()).toHaveClass("trig");
  });
});

describe("Dropdown — open / close", () => {
  it("is closed by default and opens on trigger click", () => {
    render(<Dropdown options={OPTIONS} />);
    expect(screen.queryByRole("listbox")).toBeNull();
    fireEvent.click(getTrigger());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
    expect(getTrigger()).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles closed on a second trigger click", () => {
    render(<Dropdown options={OPTIONS} />);
    fireEvent.click(getTrigger());
    fireEvent.click(getTrigger());
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes when clicking outside", () => {
    render(<Dropdown options={OPTIONS} />);
    fireEvent.click(getTrigger());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not open when disabled", () => {
    render(<Dropdown options={OPTIONS} disabled />);
    const trigger = getTrigger();
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Dropdown — selection", () => {
  it("calls onChange and closes when an option is picked", () => {
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} onChange={onChange} />);
    fireEvent.click(getTrigger());
    const listbox = screen.getByRole("listbox");
    fireEvent.click(within(listbox).getByRole("option", { name: "Banana" }));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("ignores clicks on a disabled option", () => {
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} onChange={onChange} />);
    fireEvent.click(getTrigger());
    const listbox = screen.getByRole("listbox");
    fireEvent.click(within(listbox).getByRole("option", { name: "Cherry" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes without throwing when no onChange is supplied", () => {
    render(<Dropdown options={OPTIONS} />);
    fireEvent.click(getTrigger());
    fireEvent.click(screen.getByRole("option", { name: "Apple" }));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("marks the selected option with aria-selected", () => {
    render(<Dropdown options={OPTIONS} value="a" />);
    fireEvent.click(getTrigger());
    expect(screen.getByRole("option", { name: "Apple" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});

describe("Dropdown — keyboard", () => {
  it("toggles open with Enter and closes with Escape", () => {
    render(<Dropdown options={OPTIONS} />);
    const trigger = getTrigger();
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens with Space", () => {
    render(<Dropdown options={OPTIONS} />);
    fireEvent.keyDown(getTrigger(), { key: " " });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("ArrowDown opens the menu when closed", () => {
    render(<Dropdown options={OPTIONS} />);
    fireEvent.keyDown(getTrigger(), { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("ArrowDown moves selection to the next option when open", () => {
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} value="a" onChange={onChange} />);
    const trigger = getTrigger();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("ArrowUp moves selection to the previous option when open", () => {
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} value="b" onChange={onChange} />);
    const trigger = getTrigger();
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("ArrowUp does nothing when closed", () => {
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} value="b" onChange={onChange} />);
    fireEvent.keyDown(getTrigger(), { key: "ArrowUp" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does nothing on keydown when disabled", () => {
    render(<Dropdown options={OPTIONS} disabled />);
    fireEvent.keyDown(getTrigger(), { key: "Enter" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
