import { useCallback } from "react";

export interface MediaObject {
  id: string;
  src: string;
  url: string;
  altText: string | null;
  width: number;
  height: number;
  position: number;
  isMain: boolean;
}

interface OpenOptions {
  multiple?: boolean;
  allowedTypes?: string;
}

type MediaCallback = (media: MediaObject[] | null) => void;

/**
 * Communicates with the parent Admin frame to open its media selector modal.
 *
 * Flow:
 *  1. iframe sends  OPEN_MEDIA_SELECTOR  → parent opens modal
 *  2. parent sends  MEDIA_SELECTED       → iframe receives chosen media (or null if cancelled)
 *
 * The pending callback and the message listener are module-scoped: the parent
 * modal is single-instance, so only the most recent open should receive the
 * response, and we want exactly one window listener regardless of how many
 * MediaInputs are mounted.
 *
 * Security (origin verification) is handled by useIframeAuth, not here.
 */
let pendingCallback: MediaCallback | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.data?.type !== "MEDIA_SELECTED") {
      return;
    }
    const cb = pendingCallback;
    pendingCallback = null;
    cb?.(event.data.media ?? null);
  });
}

export function useMediaSelector() {
  const openMediaSelector = useCallback(
    (onSelect: MediaCallback, options?: OpenOptions) => {
      pendingCallback = onSelect;
      window.parent.postMessage({ type: "OPEN_MEDIA_SELECTOR", options }, "*");
    },
    [],
  );

  return { openMediaSelector };
}
