"use client";

import { clsx } from "clsx";
import * as React from "react";
import { Button } from "../Button/Button";
import styles from "./Modal.module.css";

export type ModalSize = "sm" | "md" | "lg";

export interface ModalProps {
  /**
   * Whether the modal is visible
   */
  isOpen: boolean;
  /**
   * Called when the user requests to close the modal (overlay click, ESC, Cancel button, etc)
   */
  onClose: () => void;
  /**
   * Optional title shown in the header
   */
  title?: string;
  /**
   * Optional aria-label for accessibility when no visible title is provided
   */
  "aria-label"?: string;
  /**
   * Optional content rendered below the header, above the footer
   */
  children: React.ReactNode;
  /**
   * Optional node rendered in the header to the right of the title (e.g. actions)
   */
  headerActions?: React.ReactNode;
  /**
   * Footer content. If not provided, a default Cancel/Primary button row is rendered.
   */
  footer?: React.ReactNode;
  /**
   * Label for the primary action button in the default footer
   */
  primaryActionLabel?: string;
  /**
   * Handler for the primary action in the default footer
   */
  onPrimaryAction?: () => void;
  /**
   * If true, hides the default footer entirely
   */
  hideDefaultFooter?: boolean;
  /**
   * Size of the modal content area (controls max width)
   */
  size?: ModalSize;
  /**
   * Additional className for the outer container
   */
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  "aria-label": ariaLabel,
  children,
  headerActions,
  footer,
  primaryActionLabel = "Confirm",
  onPrimaryAction,
  hideDefaultFooter = false,
  size = "md",
  className,
}) => {
  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const modalClasses = clsx(
    styles.modalContainer,
    styles[`modalContainer-${size}`],
    className
  );

  return (
    <div
      className={styles.modalOverlay}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className={modalClasses}>
        {(title || headerActions) && (
          <div className={styles.modalHeader}>
            {title && <h3 className={styles.modalTitle}>{title}</h3>}
            {headerActions && (
              <div className={styles.modalHeaderActions}>{headerActions}</div>
            )}
          </div>
        )}

        <div className={styles.modalContent}>{children}</div>

        <div className={styles.modalFooter}>
          {footer}
          {!footer && !hideDefaultFooter && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={onClose}
              >
                Cancel
              </Button>
              {onPrimaryAction && (
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={onPrimaryAction}
                  className={styles.modalPrimaryButton}
                >
                  {primaryActionLabel}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
