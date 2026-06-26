"use client";

import * as React from "react";

/**
 * Checkbox-list multi-select. Unlike a chip-based picker, selected items stay
 * in the list with a checkmark (they don't vanish into chips), the menu stays
 * open across picks, and a search box filters long catalogs. Built on Tailwind
 * + the editor design tokens (see index.css), styled to match the design-system
 * Dropdown so it sits naturally beside the single-select fields.
 */

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  /** Currently-selected values. */
  value: string[];
  onChange: (next: string[]) => void;
  /** Trigger text when nothing is selected. */
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedSet = React.useMemo(() => new Set(value), [value]);

  const labelOf = React.useCallback(
    (val: string) => options.find((o) => o.value === val)?.label ?? val,
    [options],
  );

  // Trigger summary: joined labels (CSS truncates), or the placeholder.
  const summary = value.length
    ? value.map(labelOf).join(", ")
    : placeholder;

  const visibleOptions = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  React.useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [isOpen]);

  const openMenu = () => {
    setQuery("");
    setIsOpen(true);
  };

  const toggle = (val: string) => {
    onChange(
      selectedSet.has(val)
        ? value.filter((v) => v !== val)
        : [...value, val],
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (disabled) return;
            if (isOpen) setIsOpen(false);
            else openMenu();
          }}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          className={[
            "flex items-center justify-between w-full px-3 py-2 text-left",
            "border-[0.5px] rounded bg-white text-[12px] leading-[1.4]",
            "text-[#4b5563] outline-none transition-colors",
            disabled
              ? "opacity-50 cursor-not-allowed bg-[#f9fafb] border-[#d7d7d7]"
              : "cursor-pointer hover:border-[#999]",
            isOpen ? "border-[#999]" : "border-[#d7d7d7]",
          ].join(" ")}
        >
          <span
            className={[
              "flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
              value.length ? "" : "text-[#9ca3af]",
            ].join(" ")}
          >
            {summary}
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className={[
              "shrink-0 text-editor-text transition-transform",
              isOpen ? "rotate-180" : "",
            ].join(" ")}
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {isOpen && (
          <div
            role="listbox"
            aria-multiselectable
            className="absolute top-[calc(100%+4px)] left-0 right-0 z-1000 bg-white border border-editor-canvas rounded-md shadow-[0px_0px_6px_0px_rgba(0,0,0,0.09)] overflow-hidden"
          >
            <div className="p-1.5 border-b border-editor-canvas">
              <input
                // Search input remounts on each open (it lives behind
                // `{isOpen && …}`), so autoFocus focuses it every time — no
                // focus effect / ref needed.
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
                placeholder={searchPlaceholder}
                className="w-full px-2 py-1.5 border-[0.5px] border-[#d7d7d7] rounded bg-white text-[12px] leading-[1.4] text-editor-text outline-none transition-colors focus:border-[#999] placeholder:text-[#9ca3af]"
              />
            </div>

            <div className="flex flex-col gap-0.5 p-1 max-h-75 overflow-y-auto">
              {visibleOptions.length === 0 ? (
                <div className="px-2 py-2 text-[12px] text-[#9ca3af] text-center">
                  No matches
                </div>
              ) : (
                visibleOptions.map((opt) => {
                  const checked = selectedSet.has(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={checked}
                      onClick={() => toggle(opt.value)}
                      className="flex items-center gap-2 w-full px-2 py-1 rounded-md text-[12px] leading-5 text-editor-text text-left cursor-pointer transition-colors hover:bg-[rgba(29,74,136,0.05)]"
                    >
                      <span
                        className={[
                          "shrink-0 w-3.5 h-3.5 rounded-[3px] border flex items-center justify-center transition-colors",
                          checked
                            ? "border-[#1d4a88] bg-[#1d4a88] text-white"
                            : "border-[#d7d7d7] bg-white",
                        ].join(" ")}
                      >
                        {checked && (
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                          >
                            <path
                              d="M2.5 6L5 8.5L9.5 3.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                        {opt.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
    </div>
  );
}
