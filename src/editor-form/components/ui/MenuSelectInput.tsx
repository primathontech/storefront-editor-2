"use client";

import * as React from "react";
import { useMenuOptions } from "../../hooks/useMenuOptions";
import { Dropdown } from "./design-system";

export interface MenuSelectInputProps {
  label?: string;
  /** The saved menu handle (e.g. "main-menu"). */
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * Dropdown for the Header/Footer `menuHandle` setting, populated from the
 * merchant's published nav menus (the list endpoint). The menu CONTENT stays
 * managed in admin — this only picks WHICH menu feeds the nav.
 *
 * Resilience: the saved handle is always kept selectable even if the list
 * failed to load or no longer contains it, so editing never silently drops a
 * configured value.
 */
export function MenuSelectInput({
  label,
  value,
  onChange,
  disabled,
}: MenuSelectInputProps) {
  const { options, status } = useMenuOptions();

  const mergedOptions = React.useMemo(() => {
    if (!value || options.some((o) => o.value === value)) {
      return options;
    }
    // Saved handle isn't in the fetched list (custom/renamed/offline) — surface
    // it so the field shows the real current value instead of going blank.
    return [{ value, label: value }, ...options];
  }, [options, value]);

  const placeholder =
    status === "loading"
      ? "Loading menus…"
      : status === "error"
        ? "Couldn't load menus"
        : "Select a menu";

  return (
    <Dropdown
      label={label}
      labelPlacement="inline"
      options={mergedOptions}
      value={value}
      onChange={onChange}
      disabled={disabled || status === "loading"}
      placeholder={placeholder}
      fullWidth
    />
  );
}
