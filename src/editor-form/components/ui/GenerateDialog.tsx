import React, { useState } from "react";
import styles from "./GenerateDialog.module.css";
import { SparkleIcon } from "./SectionLibraryDialog";
import {
  useImageAttachment,
  ImageUploadIcon,
  ImagePreview,
  ImageFileInput,
  handleImageValidationError,
} from "./useImageAttachment";
import { PromptTextarea } from "./PromptTextarea";

interface GenerateDialogProps {
  onGenerate: (intent: string, imageFile?: File | null) => void;
}

const ActionButton: React.FC<{
  label: string;
  onGenerate: (intent: string) => void;
}> = ({ label, onGenerate }) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const trimmed = label.trim();
    if (!trimmed) return;
    // Fixed buttons send only the intent, no image attachment
    onGenerate(trimmed);
  };

  return (
    <button
      type="button"
      className={styles["action-button"]}
      onClick={handleClick}
    >
      {label}
    </button>
  );
};

export const GenerateDialog: React.FC<GenerateDialogProps> = ({
  onGenerate,
}) => {
  const [prompt, setPrompt] = useState("");

  const {
    file: imageFile,
    previewUrl: imagePreviewUrl,
    fileInputRef,
    openFilePicker,
    handleFileChange,
    clearImage,
  } = useImageAttachment({
    onValidationError: handleImageValidationError,
  });

  const handlePromptSend = () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    onGenerate(trimmed, imageFile);
  };

  const handlePromptKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to submit, Shift+Enter for newline (simple, stable UX)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePromptSend();
    }
  };

  return (
    <div className={styles["generate-content"]}>
      <div className={styles["title-container"]}>
        <div className={styles["sparkle-icon"]}>
          <SparkleIcon className={styles["sparkle-main"]} />
          <SparkleIcon
            className={`${styles["sparkle-small"]} ${styles["sparkle-top-left"]}`}
          />
          <SparkleIcon
            className={`${styles["sparkle-small"]} ${styles["sparkle-bottom-right"]}`}
          />
        </div>
        <h2>What's on your mind, Write Here</h2>
      </div>

      {/* Action buttons */}
      <div className={styles["action-buttons"]}>
        <ActionButton label="Create Header" onGenerate={onGenerate} />
        <ActionButton label="Create Hero Section" onGenerate={onGenerate} />
        <ActionButton label="Create Banner" onGenerate={onGenerate} />
      </div>

      {/* Design area */}
      <div className={styles["design-area"]}>
        <div className={styles["prompt-wrapper"]}>
          {imagePreviewUrl && (
            <ImagePreview
              previewUrl={imagePreviewUrl}
              fileName={imageFile?.name}
              onRemove={clearImage}
              containerClassName={styles["image-preview-container"]}
              wrapperClassName={styles["image-preview-wrapper"]}
              imageClassName={styles["image-preview"]}
              removeButtonClassName={styles["image-remove-button"]}
            />
          )}
          <PromptTextarea
            value={prompt}
            onChange={setPrompt}
            imagePreviewUrl={imagePreviewUrl ?? undefined}
            rows={3}
            onKeyDown={handlePromptKeyDown}
          />
        </div>
        <div className={styles["design-controls"]}>
          <button
            type="button"
            className={styles["add-button"]}
            aria-label="Upload image"
            onClick={openFilePicker}
          >
            <ImageUploadIcon />
          </button>
          <ImageFileInput
            inputRef={fileInputRef}
            onChange={handleFileChange}
            className={styles["file-input"]}
          />
          <button
            type="button"
            className={styles["arrow-button"]}
            aria-label="Generate"
            onClick={(e) => {
              e.stopPropagation();
              handlePromptSend();
            }}
            disabled={!prompt.trim()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="17"
              viewBox="0 0 12 17"
              fill="none"
            >
              <path
                d="M4.99262 0.2197C5.28551 -0.0731945 5.76039 -0.0731945 6.05328 0.2197L10.8262 4.99267C11.1191 5.28556 11.1191 5.76044 10.8262 6.05333C10.5334 6.34622 10.0585 6.34622 9.76559 6.05333L5.52295 1.81069L1.28031 6.05333C0.987415 6.34622 0.512541 6.34622 0.219648 6.05333C-0.0732457 5.76044 -0.0732457 5.28556 0.219648 4.99267L4.99262 0.2197ZM5.52295 16.2183L4.77295 16.2183L4.77295 0.75003L5.52295 0.75003L6.27295 0.75003L6.27295 16.2183L5.52295 16.2183Z"
                fill="white"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};
