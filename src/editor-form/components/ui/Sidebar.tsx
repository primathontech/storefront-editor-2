"use client";

import * as React from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Utility function
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Base component props
export interface BaseComponentProps {
  className?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "success"
    | "warning"
    | "error"
    | "info"
    | "ghost"
    | "outline"
    | "link";
  disabled?: boolean;
  "aria-label"?: string;
  "data-testid"?: string;
}

// Sidebar Root Component
export interface SidebarProps extends BaseComponentProps {
  style?: React.CSSProperties;
  width?: string | number;
  collapsed?: boolean;
  borderSide?: "left" | "right";
  children: React.ReactNode;
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  (
    {
      className,
      width = "320px",
      collapsed = false,
      borderSide = "right",
      children,
      style,
      ...props
    },
    ref
  ) => {
    const sidebarStyles = React.useMemo(() => {
      return {
        width: collapsed
          ? "60px"
          : typeof width === "number"
            ? `${width}px`
            : width,
        transition: "width 0.2s ease-in-out",
      };
    }, [width, collapsed]);

    const borderClass = borderSide === "left" ? "border-l" : "border-r";

    return (
      <div
        ref={ref}
        className={cn(
          "h-full flex flex-col overflow-hidden bg-white border-gray-200",
          borderClass,
          className
        )}
        style={{ ...sidebarStyles, ...style }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Sidebar.displayName = "Sidebar";

// Sidebar Header Component
export interface SidebarHeaderProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const SidebarHeader = React.forwardRef<HTMLDivElement, SidebarHeaderProps>(
  ({ className, title, subtitle, children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex-shrink-0 border-b border-gray-200 pb-4 mb-4",
          className
        )}
        style={style}
        {...props}
      >
        {children || (
          <>
            {title && (
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </>
        )}
      </div>
    );
  }
);
SidebarHeader.displayName = "SidebarHeader";

// Sidebar Content Component
export interface SidebarContentProps extends BaseComponentProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const SidebarContent = React.forwardRef<HTMLDivElement, SidebarContentProps>(
  ({ className, children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex-1 overflow-auto flex flex-col min-h-0", className)}
        style={style}
        {...props}
      >
        {children}
      </div>
    );
  }
);
SidebarContent.displayName = "SidebarContent";

// Sidebar Scroll Area Component
export interface SidebarScrollAreaProps extends BaseComponentProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const SidebarScrollArea = React.forwardRef<
  HTMLDivElement,
  SidebarScrollAreaProps
>(({ className, children, style, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn("flex-1 overflow-y-auto", className)}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
});
SidebarScrollArea.displayName = "SidebarScrollArea";

export { Sidebar, SidebarHeader, SidebarContent, SidebarScrollArea };
