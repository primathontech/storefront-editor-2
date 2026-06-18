// SOURCE: apps/visual-editor/src/editor-form/components/ui/GenerateDialog.tsx
//
// Behavioral test for the AI generate prompt panel. GenerateDialog is the SUT
// and runs for real, along with its small siblings (useImageAttachment hook,
// PromptTextarea, ImageFileInput). We stub only DOM gaps jsdom lacks:
// URL.createObjectURL/revokeObjectURL (preview-URL lifecycle in the image
// hook). We assert the fixed action buttons fire onGenerate with their intent,
// the textarea submit path (Enter / arrow button) sends the trimmed prompt
// plus any attached image, empty prompts are ignored, and the arrow button
// is disabled until the prompt is non-empty.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GenerateDialog } from "../../../../editor-form/components/ui/GenerateDialog";

beforeEach(() => {
  // Image hook creates/revokes object URLs for the preview — absent in jsdom.
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
  globalThis.URL.revokeObjectURL = vi.fn();
});

const getTextarea = () => screen.getByRole("textbox") as HTMLTextAreaElement;

describe("GenerateDialog — fixed action buttons", () => {
  it("renders the three preset prompt buttons", () => {
    render(<GenerateDialog onGenerate={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Create Header" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Hero Section" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create Banner" }),
    ).toBeInTheDocument();
  });

  it("calls onGenerate with the preset label (no image) when clicked", () => {
    const onGenerate = vi.fn();
    render(<GenerateDialog onGenerate={onGenerate} />);
    fireEvent.click(screen.getByRole("button", { name: "Create Banner" }));
    expect(onGenerate).toHaveBeenCalledWith("Create Banner");
  });
});

describe("GenerateDialog — prompt submit", () => {
  it("disables the arrow button until the prompt is non-empty", () => {
    render(<GenerateDialog onGenerate={vi.fn()} />);
    const arrow = screen.getByRole("button", { name: "Generate" });
    expect(arrow).toBeDisabled();

    fireEvent.change(getTextarea(), { target: { value: "make a hero" } });
    expect(arrow).toBeEnabled();
  });

  it("submits the trimmed prompt when the arrow button is clicked", () => {
    const onGenerate = vi.fn();
    render(<GenerateDialog onGenerate={onGenerate} />);
    fireEvent.change(getTextarea(), { target: { value: "  build a footer  " } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(onGenerate).toHaveBeenCalledWith("build a footer", null);
  });

  it("submits on Enter (without Shift)", () => {
    const onGenerate = vi.fn();
    render(<GenerateDialog onGenerate={onGenerate} />);
    const ta = getTextarea();
    fireEvent.change(ta, { target: { value: "a marquee" } });
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(onGenerate).toHaveBeenCalledWith("a marquee", null);
  });

  it("does NOT submit on Shift+Enter (newline)", () => {
    const onGenerate = vi.fn();
    render(<GenerateDialog onGenerate={onGenerate} />);
    const ta = getTextarea();
    fireEvent.change(ta, { target: { value: "a marquee" } });
    fireEvent.keyDown(ta, { key: "Enter", shiftKey: true });
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("ignores submit when the prompt is whitespace only", () => {
    const onGenerate = vi.fn();
    render(<GenerateDialog onGenerate={onGenerate} />);
    const ta = getTextarea();
    fireEvent.change(ta, { target: { value: "   " } });
    // Arrow stays disabled; pressing Enter is a no-op too.
    fireEvent.keyDown(ta, { key: "Enter" });
    expect(onGenerate).not.toHaveBeenCalled();
  });
});

describe("GenerateDialog — image attachment", () => {
  it("shows a preview and submits the prompt with the attached file", () => {
    const onGenerate = vi.fn();
    const { container } = render(<GenerateDialog onGenerate={onGenerate} />);

    const fileInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const png = new File(["x"], "pic.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [png] } });

    // Preview image appears (alt = file name).
    expect(screen.getByAltText("pic.png")).toBeInTheDocument();

    fireEvent.change(getTextarea(), { target: { value: "with image" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    expect(onGenerate).toHaveBeenCalledWith("with image", png);
  });
});
