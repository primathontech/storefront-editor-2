// SOURCE: apps/visual-editor/src/editor-form/components/ui/MediaInput.tsx
//
// Behavioral test for the unified image/video media picker. The component is
// the SUT and runs for real, including the real useMediaSelector hook and the
// real design-system Input/Button it composes. The only "heavy" dependency is
// the parent-frame messaging: useMediaSelector posts OPEN_MEDIA_SELECTOR to
// window.parent and resolves when a MEDIA_SELECTED message arrives. We drive
// that by spying on window.parent.postMessage and dispatching the response
// event the module-scoped listener expects.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { MediaInput } from "../../../../editor-form/components/ui/MediaInput";

const VALUE = { src: "", alt: "" };

// Find a labeled text input within the rendered tree by its visible label.
const inputByLabel = (label: string) =>
  screen.getByText(label).closest("div")?.querySelector("input") as
    | HTMLInputElement
    | undefined;

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("MediaInput — rendering", () => {
  it("renders the optional label and image URL field for kind=image", () => {
    render(
      <MediaInput
        kind="image"
        value={VALUE}
        onChange={vi.fn()}
        label="Hero image"
      />,
    );
    expect(screen.getByText("Hero image")).toBeInTheDocument();
    expect(screen.getByText("Image URL")).toBeInTheDocument();
    expect(screen.getByText("Alt text")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Browse Library/i }),
    ).toBeInTheDocument();
  });

  it("uses the Video URL label for kind=video", () => {
    render(<MediaInput kind="video" value={VALUE} onChange={vi.fn()} />);
    expect(screen.getByText("Video URL")).toBeInTheDocument();
  });

  it("renders an <img> preview when src is set on an image input", () => {
    const { container } = render(
      <MediaInput
        kind="image"
        value={{ src: "http://x/p.png", alt: "cat" }}
        onChange={vi.fn()}
      />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("http://x/p.png");
    expect(img.getAttribute("alt")).toBe("cat");
  });

  it("falls back to a default alt on the preview when alt is empty", () => {
    const { container } = render(
      <MediaInput
        kind="image"
        value={{ src: "http://x/p.png", alt: "" }}
        onChange={vi.fn()}
      />,
    );
    expect(container.querySelector("img")?.getAttribute("alt")).toBe("Preview");
  });

  it("renders a <video> preview when src is set on a video input", () => {
    const { container } = render(
      <MediaInput
        kind="video"
        value={{ src: "http://x/v.mp4", alt: "" }}
        onChange={vi.fn()}
      />,
    );
    const vid = container.querySelector("video") as HTMLVideoElement;
    expect(vid).toBeTruthy();
    expect(vid.getAttribute("src")).toBe("http://x/v.mp4");
  });

  it("renders no preview block when src is empty", () => {
    const { container } = render(
      <MediaInput kind="image" value={VALUE} onChange={vi.fn()} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
  });
});

describe("MediaInput — URL/alt editing", () => {
  it("emits the updated src while preserving alt", () => {
    const onChange = vi.fn();
    render(
      <MediaInput
        kind="image"
        value={{ src: "", alt: "keep" }}
        onChange={onChange}
      />,
    );
    const srcInput = inputByLabel("Image URL")!;
    fireEvent.change(srcInput, { target: { value: "http://new/img.png" } });
    expect(onChange).toHaveBeenCalledWith({
      src: "http://new/img.png",
      alt: "keep",
    });
  });

  it("emits the updated alt while preserving src", () => {
    const onChange = vi.fn();
    render(
      <MediaInput
        kind="image"
        value={{ src: "http://x/p.png", alt: "" }}
        onChange={onChange}
      />,
    );
    const altInput = inputByLabel("Alt text")!;
    fireEvent.change(altInput, { target: { value: "new alt" } });
    expect(onChange).toHaveBeenCalledWith({
      src: "http://x/p.png",
      alt: "new alt",
    });
  });

  it("disables both fields and the browse button when disabled", () => {
    render(
      <MediaInput kind="image" value={VALUE} onChange={vi.fn()} disabled />,
    );
    expect(inputByLabel("Image URL")).toBeDisabled();
    expect(inputByLabel("Alt text")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Browse Library/i })).toBeDisabled();
  });
});

describe("MediaInput — Browse Library", () => {
  it("posts OPEN_MEDIA_SELECTOR with image filter when browsing an image", () => {
    const postSpy = vi.spyOn(window.parent, "postMessage");
    render(<MediaInput kind="image" value={VALUE} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Browse Library/i }));

    expect(postSpy).toHaveBeenCalledWith(
      {
        type: "OPEN_MEDIA_SELECTOR",
        options: { multiple: false, allowedTypes: "image/*" },
      },
      "*",
    );
  });

  it("posts a video/* filter when browsing a video", () => {
    const postSpy = vi.spyOn(window.parent, "postMessage");
    render(<MediaInput kind="video" value={VALUE} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Browse Library/i }));

    expect(postSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({ allowedTypes: "video/*" }),
      }),
      "*",
    );
  });

  it("applies the selected media's url and altText via onChange", () => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    const onChange = vi.fn();
    render(<MediaInput kind="image" value={VALUE} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Browse Library/i }));

    // The module listener responds to a MEDIA_SELECTED window message.
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "MEDIA_SELECTED",
            media: [{ url: "http://lib/photo.png", src: "", altText: "Lib alt" }],
          },
        }),
      );
    });

    expect(onChange).toHaveBeenCalledWith({
      src: "http://lib/photo.png",
      alt: "Lib alt",
    });
  });

  it("falls back to media.src and the existing alt when fields are missing", () => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    const onChange = vi.fn();
    render(
      <MediaInput
        kind="image"
        value={{ src: "", alt: "old" }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Browse Library/i }));

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            type: "MEDIA_SELECTED",
            media: [{ url: "", src: "http://lib/fallback.png", altText: null }],
          },
        }),
      );
    });

    expect(onChange).toHaveBeenCalledWith({
      src: "http://lib/fallback.png",
      alt: "old",
    });
  });

  it("does nothing when the selection is empty / cancelled", () => {
    vi.spyOn(window.parent, "postMessage").mockImplementation(() => {});
    const onChange = vi.fn();
    render(<MediaInput kind="image" value={VALUE} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Browse Library/i }));

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "MEDIA_SELECTED", media: [] },
        }),
      );
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
