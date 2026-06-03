"use client";

import { clsx } from "clsx";
import * as React from "react";
import styles from "./Switch.module.css";

export interface SwitchProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> {
  /**
   * Whether the switch is checked (on) or unchecked (off)
   */
  checked?: boolean;
  /**
   * Default checked state (uncontrolled)
   */
  defaultChecked?: boolean;
  /**
   * Callback fired when the switch state changes
   */
  onChange?: (checked: boolean) => void;
  /**
   * Switch size
   */
  size?: "sm" | "md" | "lg";
  /**
   * Label text displayed next to the switch
   */
  label?: string;
  /**
   * Helper text displayed below the switch
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
   * Additional CSS classes
   */
  className?: string;
  /**
   * Container className (for label + switch wrapper)
   */
  containerClassName?: string;
  /**
   * Label position - "top" (default) or "left"
   */
  labelPosition?: "top" | "left";
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  (
    {
      checked: controlledChecked,
      defaultChecked,
      onChange,
      size = "sm",
      label,
      helperText,
      error,
      disabled = false,
      className,
      containerClassName,
      labelPosition = "top",
      id,
      ...props
    },
    ref
  ) => {
    const [internalChecked, setInternalChecked] = React.useState(
      defaultChecked ?? false
    );
    const isControlled = controlledChecked !== undefined;
    const checked = isControlled ? controlledChecked : internalChecked;

    const hasError = !!error;
    const generatedId = React.useId();
    const switchId = id || `switch-${generatedId}`;
    const helperId = `${switchId}-${error ? "error" : "helper"}`;

    const handleToggle = () => {
      if (disabled) {
        return;
      }

      const newChecked = !checked;
      if (!isControlled) {
        setInternalChecked(newChecked);
      }
      onChange?.(newChecked);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleToggle();
      }
    };

    const switchClasses = clsx(
      styles.switch,
      disabled && styles["switch-disabled"],
      className
    );

    const containerClasses = clsx(
      styles.container,
      labelPosition === "left" && styles["container-horizontal"],
      containerClassName
    );

    const trackClasses = clsx(
      styles.track,
      styles[`track-${size}`],
      checked && styles["track-checked"],
      disabled && styles["track-disabled"]
    );

    const handleClasses = clsx(
      styles.handle,
      styles[`handle-${size}`],
      checked && styles["handle-checked"]
    );

    const contentWrapperClasses = clsx(
      labelPosition === "left" && styles["content-wrapper"]
    );

    return (
      <div className={containerClasses}>
        <div className={contentWrapperClasses}>
          {label && (
            <label
              htmlFor={switchId}
              className={clsx(
                styles.label,
                styles[`label-${size}`],
                hasError && styles["label-error"],
                disabled && styles["label-disabled"]
              )}
            >
              {label}
            </label>
          )}

          <div className={styles["switch-wrapper"]}>
            <button
              ref={ref}
              id={switchId}
              type="button"
              role="switch"
              aria-checked={checked}
              aria-disabled={disabled}
              aria-describedby={error || helperText ? helperId : undefined}
              className={switchClasses}
              disabled={disabled}
              onClick={handleToggle}
              onKeyDown={handleKeyDown}
              {...props}
            >
              <div className={trackClasses}>
                <div className={handleClasses} />
              </div>
            </button>
          </div>
        </div>

        {(error || helperText) && (
          <div
            id={helperId}
            className={clsx(
              styles["helper-text"],
              styles[`helper-text-${size}`],
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

Switch.displayName = "Switch";

export { Switch };
