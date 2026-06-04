"use client";

import { clsx } from "clsx";
import * as React from "react";
import styles from "./Input.module.css";

export interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  /**
   * Input size
   */
  size?: "xs" | "sm" | "md" | "lg";
  /**
   * Label text displayed above the input
   */
  label?: string;
  /**
   * Helper text displayed below the input
   */
  helperText?: string;
  /**
   * Error message (shows error state)
   */
  error?: string;
  /**
   * Left icon (displayed before the input)
   */
  leftIcon?: React.ReactNode;
  /**
   * Right icon (displayed after the input)
   */
  rightIcon?: React.ReactNode;
  /**
   * Full width input
   */
  fullWidth?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Container className (for label + input wrapper)
   */
  containerClassName?: string;
  /**
   * Label visual variant
   * - "default": prominent label (darker, more spacing)
   * - "subtle": lighter label (used inside cards like FAQ/ObjectArray)
   */
  labelVariant?: "default" | "subtle";
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = "md",
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className,
      containerClassName,
      disabled,
      id,
      labelVariant = "default",
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    const generatedId = React.useId();
    const inputId = id || `input-${generatedId}`;
    const helperId = `${inputId}-${error ? "error" : "helper"}`;

    const inputClasses = clsx(
      styles.input,
      styles[`input-${size}`],
      hasError && styles["input-error"],
      disabled && styles["input-disabled"],
      leftIcon && styles["input-with-left-icon"],
      rightIcon && styles["input-with-right-icon"],
      fullWidth && styles["input-full-width"],
      className
    );

    const containerClasses = clsx(
      styles.container,
      fullWidth && styles["container-full-width"],
      containerClassName
    );

    return (
      <div className={containerClasses}>
        {label && (
          <label
            htmlFor={inputId}
            className={clsx(
              styles.label,
              styles[`label-${size}`],
              labelVariant === "subtle" && styles["label-subtle"],
              hasError && styles["label-error"]
            )}
          >
            {label}
          </label>
        )}

        <div className={styles["input-wrapper"]}>
          {leftIcon && (
            <span className={styles["input-icon-left"]} aria-hidden="true">
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={error || helperText ? helperId : undefined}
            {...props}
          />

          {rightIcon && (
            <span className={styles["input-icon-right"]} aria-hidden="true">
              {rightIcon}
            </span>
          )}
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

Input.displayName = "Input";

export { Input };
