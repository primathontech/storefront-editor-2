// SOURCE: apps/visual-editor/src/editor-form/components/ui/ObjectArrayInput.tsx
//
// Behavioral test for the controlled ObjectArrayInput: a list of object rows,
// each row exposing one editable field per entry in `fields`. Fields may carry
// an "image:"/"video:" prefix that strips to a bare field name and renders a
// Browse Library button (parseFields). The component is the SUT and runs for
// real, including the internal ObjectField subcomponent and the expanded-state
// Set. It is controlled, so add/remove/edit each surface as an onChange payload
// of the *whole* array — that is what we assert. Rows render collapsed, so we
// click "Toggle item N" to reveal the field inputs (labelled by field name, so
// we can target them with getByLabelText). useMediaSelector runs unmocked; we
// spy on window.parent.postMessage for the media branch.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ObjectArrayInput } from "../../../../editor-form/components/ui/ObjectArrayInput";

const expand = (index: number) =>
  fireEvent.click(screen.getByRole("button", { name: `Toggle item ${index}` }));

describe("ObjectArrayInput — rendering", () => {
  it("renders one card per object and its fields once expanded", () => {
    render(
      <ObjectArrayInput
        value={[{ title: "Hi", subtitle: "there" }]}
        onChange={vi.fn()}
        fields={["title", "subtitle"]}
      />,
    );
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    expand(1);
    expect(screen.getByLabelText("title")).toHaveValue("Hi");
    expect(screen.getByLabelText("subtitle")).toHaveValue("there");
  });

  it("renders the label and helperText", () => {
    render(
      <ObjectArrayInput
        value={[]}
        onChange={vi.fn()}
        fields={["title"]}
        label="Slides"
        helperText="hint here"
      />,
    );
    expect(screen.getByText("Slides")).toBeInTheDocument();
    expect(screen.getByText("hint here")).toBeInTheDocument();
  });

  it("coerces missing field values to empty strings", () => {
    render(
      <ObjectArrayInput
        value={[{ title: "only" }]}
        onChange={vi.fn()}
        fields={["title", "subtitle"]}
      />,
    );
    expand(1);
    expect(screen.getByLabelText("subtitle")).toHaveValue("");
  });

  it("treats a non-array value as empty", () => {
    render(
      <ObjectArrayInput
        value={undefined as never}
        onChange={vi.fn()}
        fields={["title"]}
      />,
    );
    expect(screen.queryByText("Item 1")).toBeNull();
  });
});

describe("ObjectArrayInput — editing", () => {
  it("emits the array with the edited field merged into the row", () => {
    const onChange = vi.fn();
    render(
      <ObjectArrayInput
        value={[{ title: "a" }, { title: "b" }]}
        onChange={onChange}
        fields={["title"]}
      />,
    );
    expand(2);
    fireEvent.change(screen.getByLabelText("title"), {
      target: { value: "B!" },
    });
    expect(onChange).toHaveBeenCalledWith([{ title: "a" }, { title: "B!" }]);
  });
});

describe("ObjectArrayInput — add / remove", () => {
  it("adds a blank row with all field keys initialised to ''", () => {
    const onChange = vi.fn();
    render(
      <ObjectArrayInput
        value={[]}
        onChange={onChange}
        fields={["title", "subtitle"]}
        label="Slide"
      />,
    );
    fireEvent.click(screen.getByText("+ Add Slide"));
    expect(onChange).toHaveBeenCalledWith([{ title: "", subtitle: "" }]);
  });

  it("uses '+ Add Item' when no label is given", () => {
    render(
      <ObjectArrayInput value={[]} onChange={vi.fn()} fields={["title"]} />,
    );
    expect(screen.getByText("+ Add Item")).toBeInTheDocument();
  });

  it("removes a row and emits the shortened array", () => {
    const onChange = vi.fn();
    render(
      <ObjectArrayInput
        value={[{ title: "a" }, { title: "b" }]}
        onChange={onChange}
        fields={["title"]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove item 1" }));
    expect(onChange).toHaveBeenCalledWith([{ title: "b" }]);
  });

  it("hides add/remove controls when showControls is false", () => {
    render(
      <ObjectArrayInput
        value={[{ title: "a" }]}
        onChange={vi.fn()}
        fields={["title"]}
        showControls={false}
      />,
    );
    expect(screen.queryByText(/\+ Add/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove item 1" })).toBeNull();
  });
});

describe("ObjectArrayInput — media field inference", () => {
  it("strips the 'image:' prefix and renders Browse Library for that field", () => {
    render(
      <ObjectArrayInput
        value={[{ photo: "" }]}
        onChange={vi.fn()}
        fields={["image:photo"]}
      />,
    );
    expand(1);
    // The prefix is stripped, so the field label is the bare name.
    expect(screen.getByLabelText("photo")).toBeInTheDocument();
    expect(screen.getByText("Browse Library")).toBeInTheDocument();
  });

  it("posts OPEN_MEDIA_SELECTOR when Browse is clicked on a media field", () => {
    const postSpy = vi.spyOn(window.parent, "postMessage");
    render(
      <ObjectArrayInput
        value={[{ clip: "" }]}
        onChange={vi.fn()}
        fields={["video:clip"]}
      />,
    );
    expand(1);
    fireEvent.click(screen.getByText("Browse Library"));
    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: "OPEN_MEDIA_SELECTOR" }),
      "*",
    );
    postSpy.mockRestore();
  });

  it("renders no Browse Library for plain (non-prefixed) fields", () => {
    render(
      <ObjectArrayInput
        value={[{ title: "" }]}
        onChange={vi.fn()}
        fields={["title"]}
      />,
    );
    expand(1);
    expect(screen.queryByText("Browse Library")).toBeNull();
  });
});
