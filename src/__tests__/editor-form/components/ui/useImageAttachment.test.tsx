// Hook test — attach-image UX: File state + validation (Anthropic image
// rules) + preview-URL lifecycle. URL.createObjectURL is stubbed (jsdom
// doesn't implement it) and react-hot-toast is mocked.
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { toast } from "react-hot-toast";
import {
  useImageAttachment,
  handleImageValidationError,
  IMAGE_ACCEPT_ATTRIBUTE,
  type ImageValidationError,
} from "../../../../editor-form/components/ui/useImageAttachment";

vi.mock("react-hot-toast", () => ({ toast: { error: vi.fn() } }));

// Build a fake <input> change event carrying the given file (or none).
const changeEvent = (file: File | null) =>
  ({ target: { files: file ? [file] : [] } }) as unknown as React.ChangeEvent<HTMLInputElement>;

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe("IMAGE_ACCEPT_ATTRIBUTE", () => {
  it("lists the Anthropic-supported image mime types", () => {
    expect(IMAGE_ACCEPT_ATTRIBUTE).toBe(
      "image/jpeg,image/jpg,image/png,image/gif,image/webp",
    );
  });
});

describe("handleImageValidationError", () => {
  it("fires a single error toast with the error message", () => {
    const err: ImageValidationError = { type: "not_an_image", message: "Please select an image file." };
    handleImageValidationError(err);
    expect((toast.error as Mock)).toHaveBeenCalledWith("Please select an image file.", {
      duration: 5000,
    });
  });
});

describe("useImageAttachment", () => {
  it("accepts a valid image and produces a preview URL", () => {
    const onValidationError = vi.fn();
    const { result } = renderHook(() => useImageAttachment({ onValidationError }));

    const png = new File([new Uint8Array(16)], "ok.png", { type: "image/png" });
    act(() => result.current.handleFileChange(changeEvent(png)));

    expect(result.current.file).toBe(png);
    expect(result.current.previewUrl).toBe("blob:mock-url");
    expect(URL.createObjectURL).toHaveBeenCalledWith(png);
    expect(onValidationError).not.toHaveBeenCalled();
  });

  it("rejects a non-image and reports a not_an_image error", () => {
    const onValidationError = vi.fn();
    const { result } = renderHook(() => useImageAttachment({ onValidationError }));

    const txt = new File(["x"], "a.txt", { type: "text/plain" });
    act(() => result.current.handleFileChange(changeEvent(txt)));

    expect(result.current.file).toBeNull();
    expect(onValidationError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "not_an_image" }),
    );
  });

  it("rejects an unsupported image format", () => {
    const onValidationError = vi.fn();
    const { result } = renderHook(() => useImageAttachment({ onValidationError }));

    const bmp = new File([new Uint8Array(8)], "a.bmp", { type: "image/bmp" });
    act(() => result.current.handleFileChange(changeEvent(bmp)));

    expect(result.current.file).toBeNull();
    expect(onValidationError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "unsupported_format", fileType: "image/bmp" }),
    );
  });

  it("rejects an image over the 3.75 MB limit", () => {
    const onValidationError = vi.fn();
    const { result } = renderHook(() => useImageAttachment({ onValidationError }));

    const big = new File([new Uint8Array(4 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    act(() => result.current.handleFileChange(changeEvent(big)));

    expect(result.current.file).toBeNull();
    expect(onValidationError).toHaveBeenCalledWith(
      expect.objectContaining({ type: "file_too_large" }),
    );
  });

  it("clearImage resets the file back to null", () => {
    const { result } = renderHook(() => useImageAttachment());
    const png = new File([new Uint8Array(16)], "ok.png", { type: "image/png" });
    act(() => result.current.handleFileChange(changeEvent(png)));
    expect(result.current.file).toBe(png);
    act(() => result.current.clearImage());
    expect(result.current.file).toBeNull();
  });

  it("openFilePicker clicks the underlying file input", () => {
    const { result } = renderHook(() => useImageAttachment());
    const click = vi.fn();
    act(() => {
      (result.current.fileInputRef as { current: unknown }).current = { click };
    });
    act(() => result.current.openFilePicker());
    expect(click).toHaveBeenCalledTimes(1);
  });
});
