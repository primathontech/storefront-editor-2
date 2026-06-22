// SOURCE: apps/visual-editor/src/editor-form/components/ui/RichTextInput.tsx
//
// Behavioral test for the rich-text sidebar field. The component is the SUT
// and runs for real — including its preview/HTML-stripping logic, the
// open/save/cancel modal flow (rendered through the real design-system Modal
// into a portal), and the change-deduplication in handleChange.
//
// react-quill is the only heavy dependency: it is loaded lazily via the
// next-dynamic-shim (React.lazy + Suspense). We mock the `react-quill` module
// with a lightweight <textarea> stub that still calls the onChange prop, so
// the SUT's own modal-value wiring and save logic are exercised for real.
// The editor mounts asynchronously, so we await it with findBy* queries.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

// Stub ReactQuill: a textarea whose changes forward the raw string to
// onChange, mirroring the real component's (value, onChange) contract.
vi.mock("react-quill", () => ({
  default: ({
    value,
    onChange,
    readOnly,
    placeholder,
  }: {
    value: string;
    onChange: (v: string) => void;
    readOnly?: boolean;
    placeholder?: string;
  }) => (
    <textarea
      data-testid="quill"
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

import { RichTextInput } from "../../../../editor-form/components/ui/RichTextInput";

beforeEach(() => {
  document.body.innerHTML = "";
});

const openModal = () =>
  fireEvent.click(screen.getByRole("button", { name: "Edit Content" }));

describe("RichTextInput — sidebar preview", () => {
  it("shows the placeholder text when value is empty", () => {
    render(
      <RichTextInput value="" onChange={vi.fn()} placeholder="Nothing yet" />,
    );
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
  });

  it("renders the default label when none is provided", () => {
    render(<RichTextInput value="" onChange={vi.fn()} />);
    expect(screen.getByText("Full Text")).toBeInTheDocument();
  });

  it("renders a custom label", () => {
    render(<RichTextInput value="" onChange={vi.fn()} label="Body copy" />);
    expect(screen.getByText("Body copy")).toBeInTheDocument();
  });

  it("strips HTML tags for the preview text", () => {
    render(
      <RichTextInput value="<p>Hello <b>world</b></p>" onChange={vi.fn()} />,
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
  });

  it("truncates long preview text to 100 chars + ellipsis", () => {
    const long = "x".repeat(150);
    render(<RichTextInput value={`<p>${long}</p>`} onChange={vi.fn()} />);
    const preview = screen.getByText(/x{100}\.\.\.$/);
    expect(preview.textContent).toHaveLength(103);
  });

  it("hides the Edit button when disabled", () => {
    render(<RichTextInput value="" onChange={vi.fn()} disabled />);
    expect(
      screen.queryByRole("button", { name: "Edit Content" }),
    ).toBeNull();
  });
});

describe("RichTextInput — modal editing", () => {
  it("opens the modal with the editor seeded from value", async () => {
    render(<RichTextInput value="<p>start</p>" onChange={vi.fn()} />);
    openModal();
    const quill = (await screen.findByTestId("quill")) as HTMLTextAreaElement;
    expect(quill.value).toBe("<p>start</p>");
  });

  it("saves edited content via Update, calling onChange with the new value", async () => {
    const onChange = vi.fn();
    render(<RichTextInput value="<p>old</p>" onChange={onChange} />);
    openModal();
    const quill = (await screen.findByTestId("quill")) as HTMLTextAreaElement;

    fireEvent.change(quill, { target: { value: "<p>new content</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Update" }));

    expect(onChange).toHaveBeenCalledWith("<p>new content</p>");
    // Modal closes after save.
    expect(screen.queryByTestId("quill")).toBeNull();
  });

  it("does not call onChange when the saved content is unchanged", async () => {
    const onChange = vi.fn();
    render(<RichTextInput value="<p>same</p>" onChange={onChange} />);
    openModal();
    await screen.findByTestId("quill");

    // Save without editing.
    fireEvent.click(screen.getByRole("button", { name: "Update" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("discards edits on Cancel and leaves onChange untouched", async () => {
    const onChange = vi.fn();
    render(<RichTextInput value="<p>keep</p>" onChange={onChange} />);
    openModal();
    const quill = (await screen.findByTestId("quill")) as HTMLTextAreaElement;

    fireEvent.change(quill, { target: { value: "<p>throwaway</p>" } });

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("quill")).toBeNull();

    // Reopening shows the original value, proving the edit was discarded.
    openModal();
    const reopened = (await screen.findByTestId("quill")) as HTMLTextAreaElement;
    expect(reopened.value).toBe("<p>keep</p>");
  });

  it("passes readOnly=false through to the editor when not disabled", async () => {
    render(<RichTextInput value="" onChange={vi.fn()} />);
    openModal();
    const quill = (await screen.findByTestId("quill")) as HTMLTextAreaElement;
    expect(quill.readOnly).toBe(false);
  });
});
