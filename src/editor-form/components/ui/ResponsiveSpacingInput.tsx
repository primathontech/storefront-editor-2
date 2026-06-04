"use client";

import * as React from "react";
import { useEditorUiStore } from "../../../stores/editorUiStore";
import {
  SpacingFields,
  type SpacingValue as SpacingFieldsValue,
} from "./design-system";

export interface ResponsiveSpacingValue {
  mobile?: {
    padding?: { top: number; right: number; bottom: number; left: number };
    margin?: { top: number; right: number; bottom: number; left: number };
  };
  tablet?: {
    padding?: { top: number; right: number; bottom: number; left: number };
    margin?: { top: number; right: number; bottom: number; left: number };
  };
  desktop?: {
    padding?: { top: number; right: number; bottom: number; left: number };
    margin?: { top: number; right: number; bottom: number; left: number };
  };
}

export interface ResponsiveSpacingInputProps {
  label?: string;
  value?: ResponsiveSpacingValue;
  onChange?: (value: ResponsiveSpacingValue) => void;
  disabled?: boolean;
  className?: string;
  /** Whether to show margin inputs alongside padding (default: true) */
  showMargin?: boolean;
}

type FourSideSpacing = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

const ZERO_SPACING: FourSideSpacing = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

const toFieldsValue = (source?: FourSideSpacing): SpacingFieldsValue => ({
  top: source?.top ?? 0,
  right: source?.right ?? 0,
  bottom: source?.bottom ?? 0,
  left: source?.left ?? 0,
});

const fromFieldsValue = (value: SpacingFieldsValue): FourSideSpacing => ({
  top: typeof value.top === "number" ? value.top : 0,
  right: typeof value.right === "number" ? value.right : 0,
  bottom: typeof value.bottom === "number" ? value.bottom : 0,
  left: typeof value.left === "number" ? value.left : 0,
});

const ResponsiveSpacingInput = React.forwardRef<
  HTMLDivElement,
  ResponsiveSpacingInputProps
>(
  (
    {
      label: _label,
      value = {},
      onChange,
      disabled = false,
      className,
      showMargin = true,
    },
    ref
  ) => {
    const device = useEditorUiStore((state) => state.device);

    // Map device to breakpoint: desktop/fullscreen → desktop, tablet → tablet, mobile → mobile
    const breakpoint: "mobile" | "tablet" | "desktop" =
      device === "fullscreen" ? "desktop" : device;

    const breakpointValue = value[breakpoint] || {};
    const padding =
      (breakpointValue.padding as FourSideSpacing) || ZERO_SPACING;
    const margin = (breakpointValue.margin as FourSideSpacing) || ZERO_SPACING;

    const paddingValue = toFieldsValue(padding);
    const marginValue = toFieldsValue(margin);

    const updateBreakpoint = (updates: {
      padding?: SpacingFieldsValue;
      margin?: SpacingFieldsValue;
    }) => {
      if (!onChange) {
        return;
      }

      const nextPadding = updates.padding
        ? fromFieldsValue(updates.padding)
        : padding;
      const nextMargin = updates.margin
        ? fromFieldsValue(updates.margin)
        : margin;

      onChange({
        ...value,
        [breakpoint]: {
          padding: nextPadding,
          margin: nextMargin,
        },
      });
    };

    const handlePaddingChange = (next: SpacingFieldsValue) => {
      updateBreakpoint({ padding: next });
    };

    const handleMarginChange = (next: SpacingFieldsValue) => {
      updateBreakpoint({ margin: next });
    };

    return (
      <div ref={ref} className={className}>
        {showMargin && (
          <SpacingFields
            title="Section margin"
            labels={{
              left: "Left margin",
              top: "Top margin",
              right: "Right margin",
              bottom: "Bottom margin",
            }}
            value={marginValue}
            onChange={handleMarginChange}
            disabled={disabled}
          />
        )}
        <SpacingFields
          title="Section padding"
          labels={{
            left: "Left padding",
            top: "Top padding",
            right: "Right padding",
            bottom: "Bottom padding",
          }}
          value={paddingValue}
          onChange={handlePaddingChange}
          disabled={disabled}
        />
      </div>
    );
  }
);

ResponsiveSpacingInput.displayName = "ResponsiveSpacingInput";

export { ResponsiveSpacingInput };
