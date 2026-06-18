import { useState } from "react";
import { Modal, Button } from "./design-system";

interface PreviewLinkModalProps {
  isOpen: boolean;
  url: string;
  version: number | null;
  onClose: () => void;
}

/**
 * Shown after "Save and Preview" — surfaces the shareable preview link with
 * two actions: open it in a new tab, or copy it to the clipboard. Uses the
 * editor design-system Modal/Button so it matches the rest of the chrome.
 */
export const PreviewLinkModal: React.FC<PreviewLinkModalProps> = ({
  isOpen,
  url,
  version,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the field is selectable as a fallback.
    }
  };

  const handleOpen = () => window.open(url, "_blank", "noopener,noreferrer");

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={version != null ? `Preview ready (v${version})` : "Preview ready"}
      size="md"
      footer={
        <>
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            Close
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleOpen}
          >
            Open in new tab
          </Button>
          <Button type="button" variant="primary" size="md" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </>
      }
    >
      <p style={{ margin: "0 0 12px", fontSize: 14, color: "#444" }}>
        Your draft is saved. Share this preview link:
      </p>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        aria-label="Preview link"
        style={{
          width: "100%",
          padding: "10px 12px",
          fontSize: 13,
          border: "1px solid #dfdfdf",
          borderRadius: 6,
          background: "#f7f7f7",
          color: "#111",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        }}
      />
    </Modal>
  );
};

export default PreviewLinkModal;
