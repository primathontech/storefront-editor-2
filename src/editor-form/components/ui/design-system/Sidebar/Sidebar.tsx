import React from "react";
import styles from "./Sidebar.module.css";

type SidebarSide = "left" | "right";

export interface SidebarProps {
  children: React.ReactNode;
  side?: SidebarSide;
  width?: number | string;
  variant?: "solid" | "ghost";
  className?: string;
  style?: React.CSSProperties;
}

export const Sidebar: React.FC<SidebarProps> = ({
  children,
  side = "right",
  width = 300,
  variant = "solid",
  className,
  style,
}) => {
  const resolvedWidth =
    typeof width === "number" ? `${width}px` : (width ?? "300px");

  const rootClasses = [
    styles.sidebar,
    side === "left" ? styles.sidebarLeft : styles.sidebarRight,
    variant === "ghost" ? styles.sidebarGhost : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside
      className={rootClasses}
      style={{ width: resolvedWidth, ...style }}
      aria-label="Editor sidebar"
    >
      {children}
    </aside>
  );
};

export interface SidebarHeaderProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Really simple, dumb sidebar header container.
 * Just a padded row with bottom border matching the Figma sidebar headers.
 */
export const SidebarHeader: React.FC<SidebarHeaderProps> = ({
  children,
  className,
  style,
}) => {
  const classes = [styles.sidebarHeader, className].filter(Boolean).join(" ");

  return (
    <div className={classes} style={style}>
      {children}
    </div>
  );
};
