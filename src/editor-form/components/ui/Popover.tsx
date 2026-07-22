"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Position {
  top: number;
  left: number;
  width: number;
}

interface PopoverProps {
  /** Controlled open state — the parent owns it. */
  open: boolean;
  /** Requested close (outside click). Parent flips `open` to false. */
  onClose: () => void;
  /** Element the popover anchors under. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Floating content. */
  children: React.ReactNode;
  /** Classes applied to the floating surface. */
  className?: string;
  /** Minimum surface width in px (defaults to the anchor's width). */
  minWidth?: number;
  /** Vertical gap between the anchor and the surface (px). */
  gap?: number;
  /** ARIA role for the surface (e.g. "menu", "listbox"). */
  role?: string;
}

/**
 * Controlled floating popover.
 *
 * Renders `children` in a portal on `<body>` so it escapes any transformed /
 * overflow-clipping ancestor (e.g. the editor header's `translateX` container),
 * and stays anchored under `anchorRef` across scroll/resize. Because it's
 * `position: fixed`, coordinates are viewport-relative and read straight from
 * `getBoundingClientRect()` — no scroll-offset math.
 *
 * Open state is fully controlled: the parent passes `open` and reacts to
 * `onClose` (fired on an outside click). The parent still owns the anchor/
 * trigger and its click handling.
 */
export const Popover: React.FC<PopoverProps> = ({
  open,
  onClose,
  anchorRef,
  children,
  className,
  minWidth,
  gap = 4,
  role,
}) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Position | null>(null);

  // Keep the surface anchored under the trigger on open + scroll/resize.
  // No reset on close — the render guard below hides a stale position, and
  // `update()` re-measures on the next open (the trigger doesn't move here).
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Clamp horizontally so a surface anchored near the right edge (e.g. the
      // ⋮ menu) doesn't overflow off-screen — shift it left to fit, effectively
      // right-aligning it under the anchor.
      const width = Math.max(rect.width, minWidth ?? 0);
      const margin = 8;
      const maxLeft = window.innerWidth - width - margin;
      const left = Math.max(margin, Math.min(rect.left, maxLeft));
      setPos({ top: rect.bottom + gap, left, width });
    };
    update();
    // capture:true so scrolling inside nested containers (the editor has inner
    // scroll areas) repositions too, not just window scroll.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchorRef, gap, minWidth]);

  // Close on outside click (ignore the anchor and the surface itself).
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || surfaceRef.current?.contains(t)) {
        return;
      }
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, anchorRef, onClose]);

  if (!open || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={surfaceRef}
      role={role}
      className={className}
      style={{
        position: "fixed",
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        width: `${pos.width}px`,
      }}
    >
      {children}
    </div>,
    document.body,
  );
};
