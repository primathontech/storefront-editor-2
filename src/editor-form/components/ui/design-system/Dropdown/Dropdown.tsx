"use client";

import { clsx } from "clsx";
import * as React from "react";
import styles from "./Dropdown.module.css";

export interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface DropdownProps {
  /**
   * Selected value
   */
  value?: string;
  /**
   * Change handler
   */
  onChange?: (value: string) => void;
  /**
   * Options array
   */
  options: DropdownOption[];
  /**
   * Placeholder text
   */
  placeholder?: string;
  /**
   * Label text displayed above the dropdown
   */
  label?: string;
  /**
   * Helper text displayed below the dropdown
   */
  helperText?: string;
  /**
   * Error message (shows error state)
   */
  error?: string;
  /**
   * Disabled state
   */
  disabled?: boolean;
  /**
   * Full width dropdown
   */
  fullWidth?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Container className (for label + dropdown wrapper)
   */
  containerClassName?: string;
  /**
   * Label placement: "stacked" (above) or "inline" (left of dropdown)
   */
  labelPlacement?: "stacked" | "inline";
}

const Dropdown = React.forwardRef<HTMLButtonElement, DropdownProps>(
  (
    {
      value,
      onChange,
      options = [],
      placeholder = "Select...",
      label,
      helperText,
      error,
      disabled = false,
      fullWidth = false,
      className,
      containerClassName,
      labelPlacement = "stacked",
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const menuRef = React.useRef<HTMLDivElement>(null);

    const selectedOption = React.useMemo(
      () => options.find((opt) => opt.value === value),
      [options, value]
    );

    const hasError = !!error;

    React.useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener("mousedown", handleClickOutside);
      }

      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    React.useEffect(() => {
      if (isOpen && menuRef.current) {
        const selectedEl = menuRef.current.querySelector(
          `[data-value="${value}"]`
        ) as HTMLElement;
        if (selectedEl) {
          selectedEl.scrollIntoView({ block: "nearest" });
        }
      }
    }, [isOpen, value]);

    const handleSelect = (optionValue: string) => {
      if (onChange) {
        onChange(optionValue);
      }
      setIsOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (disabled) {
        return;
      }

      switch (e.key) {
        case "Enter":
        case " ":
          e.preventDefault();
          setIsOpen(!isOpen);
          break;
        case "Escape":
          setIsOpen(false);
          break;
        case "ArrowDown":
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            const currentIndex = options.findIndex(
              (opt) => opt.value === value
            );
            const nextIndex = Math.min(currentIndex + 1, options.length - 1);
            if (onChange && options[nextIndex]) {
              onChange(options[nextIndex].value);
            }
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (isOpen) {
            const currentIndex = options.findIndex(
              (opt) => opt.value === value
            );
            const prevIndex = Math.max(currentIndex - 1, 0);
            if (onChange && options[prevIndex]) {
              onChange(options[prevIndex].value);
            }
          }
          break;
      }
    };

    const containerClasses = clsx(
      styles.container,
      fullWidth && styles["container-full-width"],
      labelPlacement === "inline" && styles["container-inline"],
      containerClassName
    );

    const triggerClasses = clsx(
      styles.trigger,
      isOpen && styles["trigger-open"],
      disabled && styles["trigger-disabled"],
      hasError && styles["trigger-error"],
      className
    );

    return (
      <div ref={containerRef} className={containerClasses}>
        {label && (
          <label
            className={clsx(
              styles.label,
              hasError && styles["label-error"],
              labelPlacement === "inline" && styles["label-inline"]
            )}
          >
            {label}
          </label>
        )}

        <div className={styles["dropdown-wrapper"]}>
          <button
            ref={ref}
            type="button"
            className={triggerClasses}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-invalid={hasError}
          >
            <span className={styles["trigger-text"]}>
              {selectedOption?.label || placeholder}
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className={clsx(styles.chevron, isOpen && styles["chevron-open"])}
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {isOpen && (
            <div ref={menuRef} className={styles.menu} role="listbox">
              <div className={styles["menu-content"]}>
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={clsx(
                      styles["menu-item"],
                      value === option.value && styles["menu-item-selected"],
                      option.disabled && styles["menu-item-disabled"]
                    )}
                    onClick={() =>
                      !option.disabled && handleSelect(option.value)
                    }
                    disabled={option.disabled}
                    data-value={option.value}
                    role="option"
                    aria-selected={value === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {(error || helperText) && (
          <div
            className={clsx(
              styles["helper-text"],
              hasError && styles["helper-text-error"]
            )}
          >
            {error || helperText}
          </div>
        )}
      </div>
    );
  }
);

Dropdown.displayName = "Dropdown";

export { Dropdown };
