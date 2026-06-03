import { clsx } from "clsx";
import dynamic from "../../utils/next-dynamic-shim";
import React, { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal as DesignModal } from "./design-system";
import styles from "./RichTextInput.module.css";

// Import ReactQuill CSS
import "react-quill/dist/quill.snow.css";

// Dynamically import ReactQuill to avoid SSR issues
const ReactQuill = dynamic(() => import("react-quill"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading ReactQuill...</div>,
});

export interface RichTextInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  placeholder?: string;
}

export const RichTextInput: React.FC<RichTextInputProps> = ({
  value,
  onChange,
  label,
  disabled = false,
  placeholder = "Enter content...",
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalValue, setModalValue] = useState(value);

  // Quill modules configuration - memoized to prevent recreation
  const modules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ["bold", "italic", "underline"],
        [{ list: "ordered" }, { list: "bullet" }],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        ["link"],
        ["clean"],
      ],
    }),
    []
  );

  // Quill formats configuration - memoized to prevent recreation
  const formats = useMemo(
    () => [
      "header",
      "bold",
      "italic",
      "underline",
      "list",
      "bullet",
      "color",
      "background",
      "align",
      "link",
      "clean",
    ],
    []
  );

  // Keep track of the last value to detect actual changes
  const lastValueRef = useRef<string>(value);

  // Only call onChange when content actually changes
  const handleChange = useCallback(
    (newValue: string) => {
      // Normalize the values for comparison (trim whitespace)
      const normalizedNewValue = newValue.trim();
      const normalizedLastValue = lastValueRef.current.trim();

      // Only update if the content has actually changed
      if (normalizedNewValue !== normalizedLastValue) {
        lastValueRef.current = newValue;
        onChange(newValue);
      }
    },
    [onChange]
  );

  // Update the ref when the value prop changes (from external updates)
  React.useEffect(() => {
    lastValueRef.current = value;
    setModalValue(value);
  }, [value]);

  // Handle modal open
  const handleOpenModal = useCallback(() => {
    setModalValue(value);
    setIsModalOpen(true);
  }, [value]);

  // Handle modal save
  const handleSaveModal = useCallback(() => {
    handleChange(modalValue);
    setIsModalOpen(false);
  }, [handleChange, modalValue]);

  // Handle modal cancel
  const handleCancelModal = useCallback(() => {
    setModalValue(value);
    setIsModalOpen(false);
  }, [value]);

  // Memoize the modal change handler to prevent re-renders
  const handleModalChange = useCallback((newValue: string) => {
    setModalValue(newValue);
  }, []);

  // Strip HTML tags for preview
  const getPreviewText = useCallback(
    (html: string) => {
      if (!html) {
        return placeholder;
      }
      const div = document.createElement("div");
      div.innerHTML = html;
      const text = div.textContent || div.innerText || "";
      return text.length > 100 ? text.substring(0, 100) + "..." : text;
    },
    [placeholder]
  );

  return (
    <>
      {/* Sidebar preview block */}
      <div className={styles.sidebarBlock}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarLabel}>{label || "Full Text"}</span>

          {!disabled && (
            <button
              type="button"
              onClick={handleOpenModal}
              className={styles.sidebarEditButton}
            >
              Edit Content
            </button>
          )}
        </div>

        {/* Compact preview */}
        <div
          className={clsx(
            styles.sidebarPreview,
            !value && styles.sidebarPreviewEmpty,
            disabled
              ? styles.sidebarPreviewDisabled
              : styles.sidebarPreviewClickable
          )}
          onClick={disabled ? undefined : handleOpenModal}
        >
          {getPreviewText(value)}
        </div>
      </div>

      {/* Modal rendered at document body level */}
      {isModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <DesignModal
            isOpen={isModalOpen}
            onClose={handleCancelModal}
            title={label || "Full Text"}
            primaryActionLabel="Update"
            onPrimaryAction={handleSaveModal}
            size="lg"
          >
            <div className={styles.modalEditorWrapper}>
              <ReactQuill
                value={modalValue}
                onChange={handleModalChange}
                modules={modules}
                formats={formats}
                placeholder={placeholder}
                readOnly={disabled}
                theme="snow"
              />
            </div>
          </DesignModal>,
          document.body
        )}
    </>
  );
};
