// SOURCE: apps/visual-editor/src/editor-form/components/ui/FAQInput.tsx
//
// Behavioral test for FAQInput: a list of {question, answer} pairs rendered as
// collapsible cards with add/remove/edit. The component is the SUT and runs for
// real. NOTE the key difference from the sibling Array/Object inputs: FAQInput
// keeps its own internal `items` state seeded from the initial `value` prop and
// does NOT re-sync when `value` later changes (it is effectively uncontrolled
// after mount). So we assert behaviour against that internal state plus the
// onChange payload it emits — both are kept in lockstep by the component. Rows
// render collapsed; we click "Toggle FAQ item N" to reveal the Question/Answer
// inputs, which carry real <label>s targetable via getByLabelText.
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FAQInput } from "../../../../editor-form/components/ui/FAQInput";

const toggle = (index: number) =>
  fireEvent.click(
    screen.getByRole("button", { name: `Toggle FAQ item ${index}` }),
  );

describe("FAQInput — rendering", () => {
  it("renders a card per FAQ and reveals fields on expand", () => {
    render(
      <FAQInput
        value={[{ question: "Q1", answer: "A1" }]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Item 1")).toBeInTheDocument();
    toggle(1);
    expect(screen.getByLabelText("Question")).toHaveValue("Q1");
    expect(screen.getByLabelText("Answer")).toHaveValue("A1");
  });

  it("renders the default label and a custom one", () => {
    const { rerender } = render(<FAQInput value={[]} onChange={vi.fn()} />);
    expect(screen.getByText("FAQ Items")).toBeInTheDocument();

    rerender(<FAQInput value={[]} onChange={vi.fn()} label="Questions" />);
    expect(screen.getByText("Questions")).toBeInTheDocument();
  });

  it("renders nothing for an empty list", () => {
    render(<FAQInput value={[]} onChange={vi.fn()} />);
    expect(screen.queryByText("Item 1")).toBeNull();
  });
});

describe("FAQInput — editing", () => {
  it("emits the array with the edited question merged into the row", () => {
    const onChange = vi.fn();
    render(
      <FAQInput
        value={[
          { question: "Q1", answer: "A1" },
          { question: "Q2", answer: "A2" },
        ]}
        onChange={onChange}
      />,
    );
    toggle(2);
    fireEvent.change(screen.getByLabelText("Question"), {
      target: { value: "Q2!" },
    });
    expect(onChange).toHaveBeenCalledWith([
      { question: "Q1", answer: "A1" },
      { question: "Q2!", answer: "A2" },
    ]);
  });

  it("edits the answer field independently of the question", () => {
    const onChange = vi.fn();
    render(
      <FAQInput value={[{ question: "Q", answer: "A" }]} onChange={onChange} />,
    );
    toggle(1);
    fireEvent.change(screen.getByLabelText("Answer"), {
      target: { value: "A new" },
    });
    expect(onChange).toHaveBeenCalledWith([{ question: "Q", answer: "A new" }]);
  });
});

describe("FAQInput — add / remove (showControls)", () => {
  it("hides the add button unless showControls is set", () => {
    render(<FAQInput value={[]} onChange={vi.fn()} />);
    expect(screen.queryByText("+ Add FAQ Item")).toBeNull();
  });

  it("appends a blank FAQ pair and emits it", () => {
    const onChange = vi.fn();
    render(
      <FAQInput
        value={[{ question: "Q", answer: "A" }]}
        onChange={onChange}
        showControls
      />,
    );
    fireEvent.click(screen.getByText("+ Add FAQ Item"));
    expect(onChange).toHaveBeenCalledWith([
      { question: "Q", answer: "A" },
      { question: "", answer: "" },
    ]);
    // Internal state updated too: a second card now exists.
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("removes a FAQ and emits the shortened array", () => {
    const onChange = vi.fn();
    render(
      <FAQInput
        value={[
          { question: "Q1", answer: "A1" },
          { question: "Q2", answer: "A2" },
        ]}
        onChange={onChange}
        showControls
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove FAQ item 1" }));
    expect(onChange).toHaveBeenCalledWith([{ question: "Q2", answer: "A2" }]);
    expect(screen.queryByText("Item 2")).toBeNull();
  });
});

describe("FAQInput — disabled", () => {
  it("does not expand a card when disabled", () => {
    render(
      <FAQInput
        value={[{ question: "Q", answer: "A" }]}
        onChange={vi.fn()}
        disabled
      />,
    );
    toggle(1);
    expect(screen.queryByLabelText("Question")).toBeNull();
  });

  it("does not remove when disabled even if the control is shown", () => {
    const onChange = vi.fn();
    render(
      <FAQInput
        value={[{ question: "Q", answer: "A" }]}
        onChange={onChange}
        showControls
        disabled
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Remove FAQ item 1" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("FAQInput — keyboard toggle", () => {
  it("expands a card via Space on the header", () => {
    render(
      <FAQInput value={[{ question: "Q", answer: "A" }]} onChange={vi.fn()} />,
    );
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Toggle FAQ item 1" }),
      { key: " " },
    );
    expect(screen.getByLabelText("Question")).toBeInTheDocument();
  });
});
