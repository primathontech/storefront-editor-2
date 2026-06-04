"use client";

import * as React from "react";
import { ChevronDownIcon } from "./icons/ChevronDownIcon";
import { ChevronUpIcon } from "./icons/ChevronUpIcon";
import { useMediaSelector } from "../../hooks/useMediaSelector";
import { Button, Input } from "./design-system";
import type { BaseComponentProps } from "../types";
import { cn } from "../../utils/utils";
import { MediaIcon } from "./icons/MediaIcon";
import { TrashRedIcon } from "./icons/TrashIcon";
import styles from "./ArrayInput.module.css";

export interface ArrayInputProps extends BaseComponentProps {
  label?: string;
  value: any[];
  onChange: (value: any[]) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  placeholder?: string;
  minItems?: number;
  maxItems?: number;
  showControls?: boolean;
  fields?: string[];
}

const ArrayInput = React.forwardRef<HTMLDivElement, ArrayInputProps>(
  (
    {
      className,
      label,
      value = [],
      onChange,
      disabled = false,
      error = false,
      helperText,
      placeholder = "Enter value",
      minItems = 0,
      maxItems = 10,
      showControls = false,
      fields,
      ...props
    },
    ref
  ) => {
    const firstField = fields?.[0];
    const isMedia = firstField === "image" || firstField === "video";
    const allowedTypes =
      firstField === "image"
        ? "image/*"
        : firstField === "video"
          ? "video/*"
          : undefined;
    const { openMediaSelector } = useMediaSelector();
    const safeValue = Array.isArray(value) ? value : [];

    const [expandedItems, setExpandedItems] = React.useState<Set<number>>(
      () => new Set()
    );

    const addItem = () => {
      if (safeValue.length >= maxItems) {
        return;
      }
      const nextValue = [...safeValue, ""];
      onChange(nextValue);

      // Newly added item opens by default
      setExpandedItems((prev) => {
        const next = new Set(prev);
        next.add(nextValue.length - 1);
        return next;
      });
    };

    const removeItem = (index: number) => {
      if (safeValue.length <= minItems) {
        return;
      }
      onChange(safeValue.filter((_, i) => i !== index));

      // Keep expanded state indexes in sync after removal
      setExpandedItems((prev) => {
        const next = new Set<number>();
        prev.forEach((i) => {
          if (i === index) {
            return;
          }
          if (i > index) {
            next.add(i - 1);
          } else {
            next.add(i);
          }
        });
        return next;
      });
    };

    const updateItem = (index: number, itemValue: string) => {
      const newValue = [...safeValue];
      newValue[index] = itemValue;
      onChange(newValue);
    };

    const canAdd = safeValue.length < maxItems && !disabled;
    const canRemove = safeValue.length > minItems && !disabled;

    return (
      <div className={cn(styles.root, className)} ref={ref} {...props}>
        {label && (
          <span className={styles.label}>
            {label}
            {minItems > 0 && (
              <span className={styles.labelMeta}>
                (min: {minItems}, max: {maxItems})
              </span>
            )}
          </span>
        )}

        <div className={styles.items}>
          {safeValue.map((item, index) => {
            const expanded = expandedItems.has(index);

            const handleToggle = () => {
              if (!disabled) {
                setExpandedItems((prev) => {
                  const next = new Set(prev);
                  if (next.has(index)) {
                    next.delete(index);
                  } else {
                    next.add(index);
                  }
                  return next;
                });
              }
            };

            return (
              <div
                key={index}
                className={cn(styles.itemCard, error && styles.itemCardError)}
              >
                <div
                  className={cn(
                    styles.itemHeader,
                    expanded && styles.itemHeaderExpanded
                  )}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  aria-label={`Toggle item ${index + 1}`}
                  onClick={handleToggle}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleToggle();
                    }
                  }}
                >
                  <span className={styles.itemTitle}>Item {index + 1}</span>

                  {showControls && canRemove && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeItem(index);
                      }}
                      disabled={disabled}
                      className={styles.removeButton}
                      aria-label={`Remove item ${index + 1}`}
                    >
                      <TrashRedIcon />
                    </button>
                  )}

                  <span className={styles.itemChevron}>
                    {expanded ? (
                      <ChevronUpIcon width={16} height={16} />
                    ) : (
                      <ChevronDownIcon width={16} height={16} />
                    )}
                  </span>
                </div>

                {expanded && (
                  <div className={styles.itemBody}>
                    <div className={styles.fields}>
                      <Input
                        type="text"
                        labelVariant="subtle"
                        size="md"
                        value={item || ""}
                        onChange={(e) => updateItem(index, e.target.value)}
                        disabled={disabled}
                        placeholder={placeholder}
                        fullWidth
                        helperText={!error ? helperText : undefined}
                        error={error ? helperText : undefined}
                      />
                      {isMedia && (
                        <Button
                          variant="outline"
                          size="xs"
                          leftIcon={<MediaIcon width={14} height={14} />}
                          onClick={() => {
                            openMediaSelector(
                              (media) => {
                                if (media?.length) {
                                  updateItem(
                                    index,
                                    media[0].url || media[0].src
                                  );
                                }
                              },
                              { multiple: false, allowedTypes }
                            );
                          }}
                          disabled={disabled}
                          className={styles.mediaBrowseBtn}
                        >
                          Browse Library
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showControls && canAdd && (
          <div className={styles.addRow}>
            <button
              type="button"
              onClick={addItem}
              disabled={disabled}
              className={styles.addButton}
            >
              + Add {label || "Item"}
            </button>
          </div>
        )}

        {helperText && safeValue.length === 0 && (
          <p
            className={cn(
              styles.helperText,
              error ? styles.helperTextError : styles.helperTextNormal
            )}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

ArrayInput.displayName = "ArrayInput";

export { ArrayInput };
