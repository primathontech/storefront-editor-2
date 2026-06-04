import { clsx } from "clsx";
import * as React from "react";
import styles from "./Dialog.module.css";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  headerAction,
  size = "md",
}) => {
  if (!open) {
    return null;
  }

  const sizeClass =
    size === "sm"
      ? styles["size-sm"]
      : size === "lg"
        ? styles["size-lg"]
        : size === "xl"
          ? styles["size-xl"]
          : styles["size-md"];

  const handleOverlayClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={clsx(
          styles["dialog-surface"],
          "dialog-surface-root",
          sizeClass
        )}
      >
        <div className={styles.header}>
          <div className={styles["header-main"]}>
            {title &&
              (typeof title === "string" ? (
                <h2 className={styles["title-text"]}>{title}</h2>
              ) : (
                <div className={styles["title-wrapper"]}>{title}</div>
              ))}
            {headerAction && (
              <div className={styles["header-action"]}>{headerAction}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles["close-button"]}
            aria-label="Close dialog"
          >
            <svg
              className={styles["close-icon"]}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className={styles.content}>{children}</div>

        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
};

export default Dialog;
