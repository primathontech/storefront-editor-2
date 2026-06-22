// SOURCE: apps/visual-editor/src/editor-form/components/ui/ArrayInput.tsx
//
// Behavioral test for the controlled ArrayInput (a list of single string
// values rendered as collapsible cards with add/remove/edit). The component is
// the SUT and runs for real, including its internal expanded-state Set and the
// design-system Input/Button it composes. ArrayInput is controlled, so each
// add/remove/edit must surface as an onChange payload — that is what we assert.
// Items render collapsed by default, so we click the "Toggle item N" header to
// reveal the editable <input>. The useMediaSelector hook is lightweight
// (postMessage only) and runs unmocked; we spy on window.parent.postMessage to
// exercise the media-browse branch without a real parent frame.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { ArrayInput } from "../../../../editor-form/components/ui/ArrayInput";

const expand = (index: number) =>
  fireEvent.click(screen.getByRole("button", { name: `Toggle item ${index}` }));

describe("ArrayInput — rendering", () => {
  it("renders an item card per value", () => {
    render(<ArrayInput value={["a", "b", "c"]} onChange={vi.fn()} />);
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
    expect(screen.getByText("Item 3")).toBeInTheDocument();
  });

  it("renders the label and the min/max meta when minItems > 0", () => {
    render(
      <ArrayInput
        value={[]}
        onChange={vi.fn()}
        label="Tags"
        minItems={1}
        maxItems={5}
      />,
    );
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("(min: 1, max: 5)")).toBeInTheDocument();
  });

  it("shows helperText only when the list is empty", () => {
    const { rerender } = render(
      <ArrayInput value={[]} onChange={vi.fn()} helperText="add some" />,
    );
    expect(screen.getByText("add some")).toBeInTheDocument();

    rerender(
      <ArrayInput value={["x"]} onChange={vi.fn()} helperText="add some" />,
    );
    expect(screen.queryByText("add some")).toBeNull();
  });

  it("treats a non-array value as empty", () => {
    // safeValue guards against bad input; nothing should render and no crash.
    render(<ArrayInput value={null as unknown as string[]} onChange={vi.fn()} />);
    expect(screen.queryByText("Item 1")).toBeNull();
  });

  it("items start collapsed; the input appears only after expanding", () => {
    render(<ArrayInput value={["hello"]} onChange={vi.fn()} />);
    expect(screen.queryByDisplayValue("hello")).toBeNull();
    expand(1);
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });
});

describe("ArrayInput — editing", () => {
  it("emits the full array with the edited entry on input change", () => {
    const onChange = vi.fn();
    render(<ArrayInput value={["a", "b"]} onChange={onChange} />);
    expand(2);
    fireEvent.change(screen.getByDisplayValue("b"), {
      target: { value: "B!" },
    });
    expect(onChange).toHaveBeenCalledWith(["a", "B!"]);
  });
});

describe("ArrayInput — add / remove (showControls)", () => {
  it("hides the add button unless showControls is set", () => {
    render(<ArrayInput value={[]} onChange={vi.fn()} label="Tag" />);
    expect(screen.queryByText("+ Add Tag")).toBeNull();
  });

  it("appends an empty string when Add is clicked", () => {
    const onChange = vi.fn();
    render(
      <ArrayInput value={["a"]} onChange={onChange} showControls label="Tag" />,
    );
    fireEvent.click(screen.getByText("+ Add Tag"));
    expect(onChange).toHaveBeenCalledWith(["a", ""]);
  });

  it("falls back to '+ Add Item' label when no label is provided", () => {
    render(<ArrayInput value={[]} onChange={vi.fn()} showControls />);
    expect(screen.getByText("+ Add Item")).toBeInTheDocument();
  });

  it("does not add past maxItems (no add button shown)", () => {
    render(
      <ArrayInput
        value={["a", "b"]}
        onChange={vi.fn()}
        showControls
        maxItems={2}
      />,
    );
    expect(screen.queryByText(/\+ Add/)).toBeNull();
  });

  it("removes an item and emits the shortened array", () => {
    const onChange = vi.fn();
    render(
      <ArrayInput value={["a", "b", "c"]} onChange={onChange} showControls />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove item 2" }));
    expect(onChange).toHaveBeenCalledWith(["a", "c"]);
  });

  it("hides the remove control when at minItems", () => {
    render(
      <ArrayInput
        value={["only"]}
        onChange={vi.fn()}
        showControls
        minItems={1}
      />,
    );
    expect(screen.queryByRole("button", { name: "Remove item 1" })).toBeNull();
  });
});

describe("ArrayInput — media branch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("offers a Browse Library button when the first field is 'image'", () => {
    render(
      <ArrayInput value={["x"]} onChange={vi.fn()} fields={["image"]} />,
    );
    expand(1);
    expect(screen.getByText("Browse Library")).toBeInTheDocument();
  });

  it("posts OPEN_MEDIA_SELECTOR to the parent when Browse is clicked", () => {
    const postSpy = vi.spyOn(window.parent, "postMessage");
    render(
      <ArrayInput value={["x"]} onChange={vi.fn()} fields={["image"]} />,
    );
    expand(1);
    fireEvent.click(screen.getByText("Browse Library"));
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "OPEN_MEDIA_SELECTOR" }),
      "*",
    );
  });

  it("does not render Browse Library for a plain text field", () => {
    render(<ArrayInput value={["x"]} onChange={vi.fn()} />);
    expand(1);
    expect(screen.queryByText("Browse Library")).toBeNull();
  });
});

describe("ArrayInput — keyboard toggle", () => {
  it("expands a card via Enter on the header", () => {
    render(<ArrayInput value={["v"]} onChange={vi.fn()} />);
    const header = screen.getByRole("button", { name: "Toggle item 1" });
    fireEvent.keyDown(header, { key: "Enter" });
    expect(screen.getByDisplayValue("v")).toBeInTheDocument();
  });
});
