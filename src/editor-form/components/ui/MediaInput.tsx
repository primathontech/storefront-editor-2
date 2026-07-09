"use client";

import React, { useCallback } from "react";
import {
  useMediaSelector,
  type MediaObject,
} from "../../hooks/useMediaSelector";
import { useAuthStore } from "../../../stores/authStore";
import { resolveAssetUrl } from "../../utils/preview-route";
import { Input as DesignInput, Button } from "./design-system";
import { MediaIcon } from "./icons/MediaIcon";
import styles from "./MediaInput.module.css";

export type MediaKind = "image" | "video";

export interface MediaInputProps {
  /** What media type to filter the picker to and what preview tag to render. */
  kind: MediaKind;
  value: { src: string; alt: string };
  onChange: (value: { src: string; alt: string }) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * Unified media picker — renders either an image or video preview plus a
 * "Browse Library" button that opens the parent admin's content library
 * filtered to the appropriate media type. The picked media's `altText` is
 * automatically copied into `value.alt` (without overwriting an existing
 * non-empty alt with empty).
 */
export const MediaInput: React.FC<MediaInputProps> = ({
  kind,
  value,
  onChange,
  label,
  disabled,
}) => {
  const { openMediaSelector } = useMediaSelector();
  // Merchant themes reference public/ assets by root-relative path, which only
  // resolves against the storefront origin — rebase for the editor-origin
  // thumbnail so it loads the same asset the iframe shows. Display-only: the
  // stored value + URL field keep the raw relative path.
  const previewOrigin = useAuthStore((s) => s.merchant?.previewOrigin);
  const previewSrc = resolveAssetUrl(previewOrigin, value.src);

  const handleBrowse = useCallback(() => {
    openMediaSelector(
      (media: MediaObject[] | null) => {
        if (!media?.length) return;
        const selected = media[0];
        onChange({
          src: selected.url || selected.src,
          alt: selected.altText || value.alt || "",
        });
      },
      {
        multiple: false,
        allowedTypes: kind === "image" ? "image/*" : "video/*",
      }
    );
  }, [openMediaSelector, onChange, value.alt, kind]);

  const urlLabel = kind === "image" ? "Image URL" : "Video URL";

  return (
    <div className={styles.root}>
      {label && <span className={styles.label}>{label}</span>}

      {value.src && (
        <div className={styles.preview}>
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={value.alt || "Preview"}
              className={styles.previewMedia}
            />
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={previewSrc}
              controls
              muted
              preload="metadata"
              className={styles.previewMedia}
            />
          )}
        </div>
      )}

      <div className={styles.fields}>
        <DesignInput
          label={urlLabel}
          labelVariant="subtle"
          type="text"
          size="md"
          value={value.src}
          onChange={(e) => onChange({ ...value, src: e.target.value })}
          disabled={disabled}
          placeholder={urlLabel}
          fullWidth
        />
        <DesignInput
          label="Alt text"
          labelVariant="subtle"
          type="text"
          size="md"
          value={value.alt}
          onChange={(e) => onChange({ ...value, alt: e.target.value })}
          disabled={disabled}
          placeholder="Alt text"
          fullWidth
        />
      </div>

      <Button
        variant="outline"
        size="xs"
        leftIcon={<MediaIcon />}
        onClick={handleBrowse}
        disabled={disabled}
        className={styles.browseBtn}
      >
        Browse Library
      </Button>
    </div>
  );
};
