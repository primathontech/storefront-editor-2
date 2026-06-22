// SOURCE: apps/visual-editor/src/editor-form/components/ui/SectionLibraryDialog.tsx
//
// Behavioral test for the "Add New Section" picker. SectionLibraryDialog is
// the SUT and runs for real, including the real Dialog shell and the real
// GenerateDialog it swaps in. We seed the real themeStore (the section list)
// and authStore (previewOrigin used to resolve preview image URLs), and mock
// only the network boundary: the htmlChatService singleton (setPendingPrompt
// / setPendingImage). URL.createObjectURL is stubbed because the nested
// GenerateDialog mounts the image hook.
//
// We assert: closed renders nothing; the section list comes from the store
// (custom-html is hidden); selecting an option shows its preview and the
// image URL is resolved against previewOrigin; clicking the preview confirms
// the key; the Generate flow opens GenerateDialog, the Back button returns,
// and generating routes through onConfirm("custom-html") + the chat service
// and closes the dialog.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../../../editor-form/services/chat/chat-service", () => ({
  htmlChatService: {
    setPendingPrompt: vi.fn(),
    setPendingImage: vi.fn(),
  },
}));

import { SectionLibraryDialog } from "../../../../editor-form/components/ui/SectionLibraryDialog";
import { htmlChatService } from "../../../../editor-form/services/chat/chat-service";
import { useThemeStore } from "../../../../stores/themeStore";
import { useAuthStore } from "../../../../stores/authStore";
import { useTemplateStore } from "../../../../stores/templateStore";

const SECTIONS = {
  hero: {
    name: "Hero",
    previewImage: "/previews/hero.png",
    previewAlt: "Hero preview",
  },
  banner: { name: "Banner" }, // no preview image -> "No preview image" branch
  "custom-html": { name: "Custom HTML" }, // hidden from the list
} as never;

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock");
  globalThis.URL.revokeObjectURL = vi.fn();
  useThemeStore.setState({ sections: SECTIONS });
  useAuthStore.setState({
    merchant: {
      id: "m1",
      themeId: "t1",
      previewOrigin: "https://store.test",
    },
  });
  useTemplateStore.setState({ selectedSectionId: "sec-1" } as never);
});

describe("SectionLibraryDialog — visibility", () => {
  it("renders nothing when closed", () => {
    render(
      <SectionLibraryDialog open={false} onConfirm={vi.fn()} onClose={vi.fn()} />,
    );
    expect(screen.queryByText("Add New Section")).toBeNull();
  });

  it("lists store sections and hides custom-html", () => {
    render(<SectionLibraryDialog open onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText("Add New Section")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hero" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Banner" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Custom HTML" })).toBeNull();
  });

  it("shows the empty-state prompt before a section is selected", () => {
    render(<SectionLibraryDialog open onConfirm={vi.fn()} onClose={vi.fn()} />);
    expect(
      screen.getByText("Select a section on the left to see its preview."),
    ).toBeInTheDocument();
  });
});

describe("SectionLibraryDialog — selection + confirm", () => {
  it("shows the preview image (resolved against previewOrigin) when selected", () => {
    render(<SectionLibraryDialog open onConfirm={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Hero" }));

    const img = screen.getByAltText("Hero preview") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe(
      "https://store.test/previews/hero.png",
    );
  });

  it("shows the no-preview message for a section without an image", () => {
    render(<SectionLibraryDialog open onConfirm={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Banner" }));
    expect(
      screen.getByText("No preview image configured yet."),
    ).toBeInTheDocument();
  });

  it("confirms the selected key when the preview image is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <SectionLibraryDialog open onConfirm={onConfirm} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Hero" }));
    fireEvent.click(screen.getByAltText("Hero preview"));
    expect(onConfirm).toHaveBeenCalledWith("hero");
  });

  it("calls onClose from the Dialog close button", () => {
    const onClose = vi.fn();
    render(<SectionLibraryDialog open onConfirm={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("SectionLibraryDialog — generate flow", () => {
  it("opens GenerateDialog from the Generate button and returns via Back", () => {
    render(<SectionLibraryDialog open onConfirm={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    // GenerateDialog content is now showing.
    expect(screen.getByText("What's on your mind, Write Here")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Back to section/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Back to section/i }));
    // Back to the section list.
    expect(screen.getByRole("button", { name: "Hero" })).toBeInTheDocument();
  });

  it("generating confirms custom-html, queues the prompt, and closes", () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <SectionLibraryDialog open onConfirm={onConfirm} onClose={onClose} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    // Use a preset action button to submit a known intent.
    fireEvent.click(screen.getByRole("button", { name: "Create Header" }));

    expect(onConfirm).toHaveBeenCalledWith("custom-html");
    expect(htmlChatService.setPendingPrompt).toHaveBeenCalledWith(
      "sec-1",
      "Create Header",
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
