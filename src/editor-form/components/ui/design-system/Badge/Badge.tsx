"use client";

import * as React from "react";
import { clsx } from "clsx";
import styles from "./Badge.module.css";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /**
   * Badge variant
   */
  variant?: "draft" | "published" | "error" | "warning" | "info" | "neutral";
  /**
   * Badge size
   */
  size?: "sm" | "md" | "lg";
  /**
   * Badge content
   */
  children: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { variant = "neutral", size = "md", className, children, ...props },
    ref
  ) => {
    const badgeClasses = clsx(
      styles.badge,
      styles[`badge-${variant}`],
      styles[`badge-${size}`],
      className
    );

    return (
      <span ref={ref} className={badgeClasses} {...props}>
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

export { Badge };
