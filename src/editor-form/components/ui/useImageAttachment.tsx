import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";

// Anthropic Claude API image requirements
const MAX_FILE_SIZE_BYTES = 3.75 * 1024 * 1024; // 3.75 MB (accounts for base64 encoding overhead)
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

// Derived constant for file input accept attribute
export const IMAGE_ACCEPT_ATTRIBUTE = ALLOWED_IMAGE_TYPES.join(",");

// Type guard for allowed image types
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

function isAllowedImageType(type: string): type is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);
}

export type ImageValidationError =
  | { type: "not_an_image"; message: string }
  | { type: "unsupported_format"; message: string; fileType: string }
  | {
      type: "file_too_large";
      message: string;
      fileSize: number;
      maxSize: number;
    };

export interface ImageAttachmentState {
  file: File | null;
  previewUrl: string | null;
  fileInputRef: React.RefObject<HTMLInputElement>;
  openFilePicker: () => void;
  handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  clearImage: () => void;
  setFile: (file: File | null) => void;
}

export interface UseImageAttachmentOptions {
  onValidationError?: (error: ImageValidationError) => void;
}

/**
 * Shared validation error handler — fires a single toast per failure.
 * Plain message; no title/description split. Image errors are already
 * self-explanatory ("Image is too large (4.2 MB). Maximum is 3.8 MB.").
 */
export function handleImageValidationError(error: ImageValidationError): void {
  toast.error(error.message, { duration: 5000 });
}

/**
 * Small shared hook for "attach image" UX:
 * - Owns File state
 * - Manages preview URL lifecycle
 * - Validates image format and size (Anthropic Claude API requirements)
 * - Exposes helpers for opening the picker and clearing the image
 *
 * Used by both HtmlInput and GenerateDialog so the logic lives in one place.
 */
export function useImageAttachment(
  options?: UseImageAttachmentOptions
): ImageAttachmentState {
  const { onValidationError } = options || {};
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Keep preview URL in sync with the current file
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const validateImageFile = useCallback(
    (file: File): ImageValidationError | null => {
      // Check if it's an image
      if (!file.type.startsWith("image/")) {
        return {
          type: "not_an_image",
          message: "Please select an image file.",
        };
      }

      // Check if format is supported
      if (!isAllowedImageType(file.type)) {
        return {
          type: "unsupported_format",
          message: `Unsupported image format. Please use JPEG, PNG, GIF, or WebP.`,
          fileType: file.type,
        };
      }

      // Check file size (accounting for base64 encoding overhead)
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const maxSizeMB = (MAX_FILE_SIZE_BYTES / (1024 * 1024)).toFixed(1);
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
        return {
          type: "file_too_large",
          message: `Image is too large (${fileSizeMB} MB). Maximum size is ${maxSizeMB} MB.`,
          fileSize: file.size,
          maxSize: MAX_FILE_SIZE_BYTES,
        };
      }

      return null;
    },
    []
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.files?.[0] ?? null;
      if (!next) {
        setFile(null);
        return;
      }

      // Validate the file
      const validationError = validateImageFile(next);
      if (validationError) {
        setFile(null);
        // Reset file input so user can select the same file again after fixing it
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        // Notify parent component about validation error
        onValidationError?.(validationError);
        return;
      }

      // File is valid, set it
      setFile(next);
    },
    [validateImageFile, onValidationError]
  );

  const clearImage = useCallback(() => {
    setFile(null);
  }, []);

  return {
    file,
    previewUrl,
    fileInputRef,
    openFilePicker,
    handleFileChange,
    clearImage,
    setFile,
  };
}

/**
 * Image upload icon component (SVG)
 */
export const ImageUploadIcon: React.FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
  >
    <path d="M0 0h24v24H0V0z" fill="none" />
    <path d="M18 20H4V6h9V4H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-9h-2v9zm-7.79-3.17l-1.96-2.36L5.5 18h11l-3.54-4.71zM20 4V1h-2v3h-3c.01.01 0 2 0 2h3v2.99c.01.01 2 0 2 0V6h3V4h-3z" />
  </svg>
);

/**
 * Image preview component with remove button
 */
export interface ImagePreviewProps {
  previewUrl: string;
  fileName?: string | null;
  onRemove: () => void;
  containerClassName?: string;
  wrapperClassName?: string;
  imageClassName?: string;
  removeButtonClassName?: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  previewUrl,
  fileName,
  onRemove,
  containerClassName,
  wrapperClassName,
  imageClassName,
  removeButtonClassName,
}) => (
  <div className={containerClassName}>
    <div className={wrapperClassName}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewUrl}
        alt={fileName || "Attached image"}
        className={imageClassName}
      />
      <button
        type="button"
        onClick={onRemove}
        className={removeButtonClassName}
        aria-label="Remove attached image"
      >
        ✕
      </button>
    </div>
  </div>
);

/**
 * Hidden file input component for image uploads
 */
export interface ImageFileInputProps {
  inputRef: React.RefObject<HTMLInputElement>;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
}

export const ImageFileInput: React.FC<ImageFileInputProps> = ({
  inputRef,
  onChange,
  disabled = false,
  className,
}) => (
  <input
    ref={inputRef}
    type="file"
    accept={IMAGE_ACCEPT_ATTRIBUTE}
    className={className}
    disabled={disabled}
    onChange={onChange}
  />
);
