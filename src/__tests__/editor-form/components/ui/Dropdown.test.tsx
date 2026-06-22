// SOURCE: apps/visual-editor/src/editor-form/components/ui/dropdown/Dropdown.tsx
//
// Behavioral test for the portal dropdown. The component is the SUT and runs
// for real (portal to document.body, click-outside listener, keyboard nav).
// jsdom doesn't implement Element.prototype.scrollIntoView (the open effect
// scrolls the selected option into view), so we stub just that one DOM gap.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { Dropdown } from "../../../../editor-form/components/ui/dropdown/Dropdown";

const OPTIONS = [
  { value: "a", label: "Apple" },
  { value: "b", label: "Banana" },
  { value: "c", label: "Cherry", disabled: true },
];

const GROUPS = [
  { label: "Fruit", options: [{ value: "a", label: "Apple" }] },
  { label: "Veg", options: [{ value: "z", label: "Carrot" }] },
];

beforeEach(() => {
  // Open effect calls selectedEl.scrollIntoView — absent in jsdom.
  Element.prototype.scrollIntoView = vi.fn();
});

// The trigger is the only button until the menu opens; identify it by its
// listbox popup role so it stays unambiguous once option buttons exist.
const getTrigger = () =>
  document.querySelector('[aria-haspopup="listbox"]') as HTMLButtonElement;

describe("Dropdown — display", () => {
  it("shows the placeholder when no value is selected", () => {
    render(<Dropdown options={OPTIONS} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("shows the selected option's label", () => {
    render(<Dropdown options={OPTIONS} value="b" />);
    expect(screen.getByText("Banana")).toBeInTheDocument();
  });

  it("renders the label and helper text", () => {
    render(
      <Dropdown options={OPTIONS} label="Choice" helperText="some hint" />,
    );
    expect(screen.getByText("Choice")).toBeInTheDocument();
    expect(screen.getByText("some hint")).toBeInTheDocument();
  });

  it("renders the error message and flags aria-invalid", () => {
    render(<Dropdown options={OPTIONS} error="Required" helperText="hint" />);
    // error wins over helperText.
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.queryByText("hint")).toBeNull();
    expect(getTrigger()).toHaveAttribute("aria-invalid", "true");
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
    // Menu stays open since nothing was selected.
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("renders grouped options", () => {
    render(<Dropdown groups={GROUPS} />);
    fireEvent.click(getTrigger());
    expect(screen.getByRole("option", { name: "Apple" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Carrot" })).toBeInTheDocument();
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

  it("ArrowDown moves the selection to the next option when open", () => {
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} value="a" onChange={onChange} />);
    const trigger = getTrigger();
    fireEvent.click(trigger); // open
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("ArrowUp moves the selection to the previous option when open", () => {
    const onChange = vi.fn();
    render(<Dropdown options={OPTIONS} value="b" onChange={onChange} />);
    const trigger = getTrigger();
    fireEvent.click(trigger); // open
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("does nothing on keydown when disabled", () => {
    render(<Dropdown options={OPTIONS} disabled />);
    fireEvent.keyDown(getTrigger(), { key: "Enter" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
