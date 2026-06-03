/**
 * Common types for UI components
 */

export type ComponentSize = "xs" | "sm" | "md" | "lg" | "xl";

export type ComponentVariants =
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

export interface BaseComponentProps {
  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Component size
   */
  size?: ComponentSize;

  /**
   * Component variant
   */
  variant?: ComponentVariants;

  /**
   * Whether the component is disabled
   */
  disabled?: boolean;

  /**
   * Accessibility label
   */
  "aria-label"?: string;

  /**
   * Test ID for testing
   */
  "data-testid"?: string;
}
