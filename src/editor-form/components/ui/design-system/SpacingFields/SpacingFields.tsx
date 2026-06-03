"use client";

import { clsx } from "clsx";
import * as React from "react";
import { Input } from "../Input/Input";
import styles from "./SpacingFields.module.css";

export type SpacingSide = "top" | "right" | "bottom" | "left";

export interface SpacingValue {
  top: number | "";
  right: number | "";
  bottom: number | "";
  left: number | "";
}

export interface SpacingFieldsProps {
  /**
   * Section title shown above the grid, e.g. "Section margin" or "Section padding"
   */
  title: string;
  /**
   * Optional subtitle or helper text under the title
   */
  subtitle?: string;
  /**
   * Labels for each side. If omitted, sensible defaults should be provided by the caller.
   */
  labels?: Partial<Record<SpacingSide, string>>;
  /**
   * Current spacing values for all four sides
   */
  value: SpacingValue;
  /**
   * Callback fired when any side changes
   */
  onChange: (value: SpacingValue) => void;
  /**
   * Unit suffix displayed at the right of each input (e.g. "px")
   */
  unit?: string;
  /**
   * Disabled state for all inputs
   */
  disabled?: boolean;
  /**
   * Additional CSS classes for the root element
   */
  className?: string;
}

const DEFAULT_LABELS: Record<SpacingSide, string> = {
  left: "Left",
  top: "Top",
  right: "Right",
  bottom: "Bottom",
};

const SpacingFields = React.forwardRef<HTMLDivElement, SpacingFieldsProps>(
  (
    {
      title,
      subtitle,
      labels,
      value,
      onChange,
      unit = "px",
      disabled = false,
      className,
      ...rest
    },
    ref
  ) => {
    const mergedLabels: Record<SpacingSide, string> = {
      left: labels?.left || DEFAULT_LABELS.left,
      top: labels?.top || DEFAULT_LABELS.top,
      right: labels?.right || DEFAULT_LABELS.right,
      bottom: labels?.bottom || DEFAULT_LABELS.bottom,
    };

    const handleSideChange = (side: SpacingSide, next: string) => {
      const numericValue =
        next === ""
          ? ""
          : Number.isNaN(Number(next))
            ? value[side]
            : Number(next);

      const nextValue: SpacingValue = {
        ...value,
        [side]: numericValue,
      };

      onChange(nextValue);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const side = event.currentTarget.dataset.side as SpacingSide | undefined;
      if (!side) {
        return;
      }
      handleSideChange(side, event.target.value);
    };

    const renderField = (side: SpacingSide) => {
      const label = mergedLabels[side];
      const fieldValue = value[side] ?? "";

      return (
        <div key={side} className={styles.field}>
          <label className={styles.fieldLabel}>{label}</label>
          <Input
            type="number"
            size="md"
            value={fieldValue}
            onChange={handleInputChange}
            disabled={disabled}
            fullWidth
            data-side={side}
            rightIcon={<span className={styles.unit}>{unit}</span>}
          />
        </div>
      );
    };

    return (
      <div ref={ref} className={clsx(styles.root, className)} {...rest}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
        </div>

        <div className={styles.grid}>
          <div className={styles.column}>
            {renderField("left")}
            {renderField("right")}
          </div>
          <div className={styles.column}>
            {renderField("top")}
            {renderField("bottom")}
          </div>
        </div>
      </div>
    );
  }
);

SpacingFields.displayName = "SpacingFields";

export { SpacingFields };
