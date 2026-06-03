import React from "react";
import { htmlChatService } from "../../services/chat/chat-service";
import { useAuthStore } from "../../../stores/authStore";
import { useThemeStore } from "../../../stores/themeStore";
import { useTemplateStore } from "../../../stores/templateStore";
import Dialog from "./Dialog";
import { GenerateDialog } from "./GenerateDialog";
import generateStyles from "./GenerateDialog.module.css";
import styles from "./SectionLibraryDialog.module.css";

// previewImage paths come from the merchant's section library as
// relative paths into their public/ dir (e.g. `/common/section-
// previews/custom-html.png`). Resolved against the preview origin
// here at the <img> site — the API layer keeps the data shape pristine.
const resolvePreviewImage = (
  previewOrigin: string | undefined,
  path: string | undefined,
): string | undefined =>
  typeof path === "string" && path.startsWith("/") && previewOrigin
    ? `${previewOrigin}${path}`
    : path;

// SparkleIcon is also exported for HtmlInput's own AI-edit affordance —
// kept here at the old import path so its consumer doesn't have to move.
export const SparkleIcon: React.FC<{ className?: string }> = ({
  className,
}) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 12 12"
    fill="none"
  >
    <path
      d="M5.23879 0.359651C5.37903 -0.119888 6.05835 -0.11989 6.19859 0.359649L7.22578 3.87203C7.27365 4.03572 7.40164 4.16372 7.56533 4.21159L11.0777 5.23877C11.5573 5.37901 11.5573 6.05833 11.0777 6.19857L7.56533 7.22576C7.40164 7.27363 7.27365 7.40163 7.22578 7.56531L6.19859 11.0777C6.05835 11.5572 5.37903 11.5572 5.23879 11.0777L4.2116 7.56532C4.16373 7.40163 4.03573 7.27363 3.87205 7.22576L0.359667 6.19857C-0.119873 6.05833 -0.119875 5.37901 0.359665 5.23877L3.87205 4.21159C4.03573 4.16372 4.16373 4.03572 4.2116 3.87203L5.23879 0.359651Z"
      fill="white"
    />
  </svg>
);

// Generate button component
const GenerateButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={styles["generate-button"]}
    >
      <div className={styles["sparkle-icon"]}>
        <SparkleIcon className={styles["sparkle-main"]} />
        <SparkleIcon
          className={`${styles["sparkle-small"]} ${styles["sparkle-top-left"]}`}
        />
        <SparkleIcon
          className={`${styles["sparkle-small"]} ${styles["sparkle-bottom-right"]}`}
        />
      </div>
      Generate
    </button>
  );
};

type SectionOption = {
  value: string;
  label: string;
  previewImage?: string;
  previewAlt?: string;
};

interface SectionLibraryDialogProps {
  open: boolean;
  onConfirm: (selectedKey: string | null) => void;
  onClose: () => void;
}

const useAvailableSectionOptions = (): SectionOption[] => {
  const entries = useThemeStore((s) => s.sections);

  // Hide the internal "custom-html" section from the visible list.
  // We still use "custom-html" behind the scenes when GenerateDialog runs.
  return Object.entries(entries)
    .filter(([key]) => key !== "custom-html")
    .map(([key, section]: [string, any]) => ({
      value: key,
      label: section.name,
      previewImage: section.previewImage,
      previewAlt: section.previewAlt ?? section.name,
    }));
};

export const SectionLibraryDialog: React.FC<SectionLibraryDialogProps> = ({
  open,
  onConfirm,
  onClose,
}) => {
  const previewOrigin = useAuthStore((s) => s.merchant?.previewOrigin);
  const options = useAvailableSectionOptions();
  const [selectedLibraryKey, setSelectedLibraryKey] = React.useState<
    string | null
  >(null);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = React.useState(false);

  const selected =
    (selectedLibraryKey &&
      options.find((option) => option.value === selectedLibraryKey)) ||
    null;

  const handleGenerate = () => {
    setIsGenerateDialogOpen(true);
  };

  const handleBackFromGenerate = () => {
    setIsGenerateDialogOpen(false);
  };

  const handleGenerateCustomHtml = (
    intent: string,
    imageFile?: File | null,
  ) => {
    // Reuse the existing add-section flow: treat as if "custom-html" was chosen and Done clicked
    onConfirm("custom-html");

    const { selectedSectionId } = useTemplateStore.getState();
    if (selectedSectionId && intent.trim()) {
      htmlChatService.setPendingPrompt(selectedSectionId, intent.trim());
      if (imageFile) {
        htmlChatService.setPendingImage(selectedSectionId, imageFile);
      }
    }

    // Close both GenerateDialog and SectionLibraryDialog
    setIsGenerateDialogOpen(false);
    onClose();
  };

  return (
    <div
      className={[
        styles["section-dialog-surface"],
        isGenerateDialogOpen ? generateStyles["gradient-dialog-surface"] : "",
      ].join(" ")}
    >
      <Dialog
        open={open}
        onClose={onClose}
        title={
          isGenerateDialogOpen ? (
            <div className={generateStyles["header-content"]}>
              <button
                type="button"
                onClick={handleBackFromGenerate}
                className={generateStyles["back-button"]}
              >
                <svg
                  className={generateStyles["back-arrow"]}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to section
              </button>
            </div>
          ) : (
            "Add New Section"
          )
        }
        size="xl"
        headerAction={
          !isGenerateDialogOpen ? (
            <GenerateButton onClick={handleGenerate} />
          ) : null
        }
      >
        <div className={styles["dialog-content"]}>
          {isGenerateDialogOpen ? (
            <GenerateDialog onGenerate={handleGenerateCustomHtml} />
          ) : (
            <div className={styles["content-container"]}>
              {/* Left: section list */}
              <div className={styles["section-list"]}>
                {options.map((option) => {
                  const isSelected = option.value === selectedLibraryKey;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedLibraryKey(option.value)}
                      className={[
                        styles["section-option"],
                        isSelected ? styles["section-option-active"] : "",
                      ].join(" ")}
                    >
                      <span className={styles["section-option-label"]}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Right: preview – only the inner preview box is clickable */}
              <div className={styles["preview-container"]}>
                {selected ? (
                  <>
                    <div className={styles["preview-label"]}>
                      {selected.label}
                    </div>
                    <div className={styles["preview-content"]}>
                      {selected.previewImage ? (
                        <div
                          className={styles["preview-image-wrapper"]}
                          onClick={() => {
                            if (selectedLibraryKey) {
                              onConfirm(selectedLibraryKey);
                            }
                          }}
                        >
                          <img
                            src={resolvePreviewImage(previewOrigin, selected.previewImage)}
                            alt={selected.previewAlt}
                            className={styles["preview-image"]}
                          />
                        </div>
                      ) : (
                        <div className={styles["no-preview-text"]}>
                          No preview image configured yet.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={styles["empty-state-text"]}>
                    Select a section on the left to see its preview.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
};
