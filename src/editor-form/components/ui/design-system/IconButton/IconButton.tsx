"use client";

import * as React from "react";
import { clsx } from "clsx";
import styles from "./IconButton.module.css";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Icon to display
   */
  icon: React.ReactNode;
  /**
   * Button variant
   */
  variant?: "ghost" | "outline" | "solid";
  /**
   * Button size
   */
  size?: "xs" | "sm" | "md" | "lg";
  /**
   * Button shape
   */
  shape?: "square" | "circle";
  /**
   * Active state (for toggle buttons)
   */
  active?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Accessibility label (required for icon-only buttons)
   */
  "aria-label": string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = "ghost",
      size = "md",
      shape = "square",
      active = false,
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const iconButtonClasses = clsx(
      styles["icon-button"],
      styles[`icon-button-${size}`],
      styles[`icon-button-${shape}`],
      active ? styles["icon-button-active"] : styles[`icon-button-${variant}`],
      className
    );

    return (
      <button
        ref={ref}
        className={iconButtonClasses}
        disabled={disabled}
        aria-pressed={active ? "true" : undefined}
        {...props}
      >
        {icon}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

export { IconButton };
