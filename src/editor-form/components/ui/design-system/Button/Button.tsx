"use client";

import * as React from "react";
import { clsx } from "clsx";
import styles from "./Button.module.css";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Button variant
   */
  variant?: "primary" | "secondary" | "success" | "ghost" | "outline";
  /**
   * Button size
   */
  size?: "xs" | "sm" | "md" | "lg";
  /**
   * Loading state - shows spinner and disables button
   */
  loading?: boolean;
  /**
   * Icon to display before the button text
   */
  leftIcon?: React.ReactNode;
  /**
   * Icon to display after the button text
   */
  rightIcon?: React.ReactNode;
  /**
   * If true, button will only show icon (square shape)
   */
  iconOnly?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      leftIcon,
      rightIcon,
      iconOnly = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    const buttonClasses = clsx(
      styles.button,
      styles[`button-${size}`],
      styles[`button-${variant}`],
      loading && styles["button-loading"],
      iconOnly && styles["button-icon-only"],
      className
    );

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={isDisabled}
        {...props}
      >
        {loading && (
          <span className={styles["button-spinner"]} aria-hidden="true" />
        )}
        {!loading && leftIcon && (
          <span className={styles["button-icon-left"]} aria-hidden="true">
            {leftIcon}
          </span>
        )}
        {!iconOnly && children}
        {!loading && rightIcon && (
          <span className={styles["button-icon-right"]} aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
