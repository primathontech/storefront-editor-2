"use client";

import * as React from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { useMediaSelector } from "../../hooks/useMediaSelector";
import { cn } from "../../utils/utils";
import { remapExpandedOnMove } from "../../utils/reorder";
import type { BaseComponentProps } from "../types";
import { Button, Input } from "./design-system";
import { MediaIcon } from "./icons/MediaIcon";
import { SortableItemCard } from "./SortableItemCard";
import { SortableList } from "./SortableList";
import styles from "./ObjectArrayInput.module.css";

type ObjectArrayItem = Record<string, unknown>;

type FieldMediaType = "image" | "video" | false;

interface ParsedField {
  name: string;
  mediaType: FieldMediaType;
}

function parseFields(fields: string[]): ParsedField[] {
  return fields.map((f) => {
    if (f.startsWith("image:")) {
      return { name: f.slice(6), mediaType: "image" };
    }
    if (f.startsWith("video:")) {
      return { name: f.slice(6), mediaType: "video" };
    }
    return { name: f, mediaType: false };
  });
}

export interface ObjectArrayInputProps extends BaseComponentProps {
  label?: string;
  value: ObjectArrayItem[];
  onChange: (value: ObjectArrayItem[]) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  fields: string[];
  showControls?: boolean;
}

interface ObjectFieldProps {
  fieldName: string;
  value: string;
  mediaType: FieldMediaType;
  disabled: boolean;
  error: boolean;
  onUpdate: (value: string, altTextFromMedia?: string) => void;
  openMediaSelector: ReturnType<typeof useMediaSelector>["openMediaSelector"];
}

const ObjectField: React.FC<ObjectFieldProps> = ({
  fieldName,
  value,
  mediaType,
  disabled,
  error,
  onUpdate,
  openMediaSelector,
}) => {
  const handleBrowse = React.useCallback(() => {
    openMediaSelector(
      (media) => {
        if (media?.length) {
          onUpdate(media[0].url || media[0].src, media[0].altText ?? undefined);
        }
      },
      {
        multiple: false,
        allowedTypes: mediaType === "image" ? "image/*" : "video/*",
      }
    );
  }, [openMediaSelector, onUpdate, mediaType]);

  return (
    <div key={fieldName}>
      <Input
        label={fieldName}
        labelVariant="subtle"
        type="text"
        size="md"
        value={value}
        onChange={(e) => onUpdate(e.target.value)}
        disabled={disabled}
        placeholder={`Enter ${fieldName}`}
        fullWidth
        className={error ? styles.inputError : undefined}
      />
      {mediaType && (
        <Button
          variant="outline"
          size="xs"
          leftIcon={<MediaIcon width={14} height={14} />}
          onClick={handleBrowse}
          disabled={disabled}
          className={styles.mediaBrowseBtn}
        >
          Browse Library
        </Button>
      )}
    </div>
  );
};

const ObjectArrayInput = React.forwardRef<
  HTMLDivElement,
  ObjectArrayInputProps
>(
  (
    {
      className,
      label,
      value = [],
      onChange,
      disabled = false,
      error = false,
      helperText,
      fields,
      showControls = true,
      ...props
    },
    ref
  ) => {
    const parsedFields = React.useMemo(() => parseFields(fields), [fields]);
    const rawFieldNames = React.useMemo(
      () => parsedFields.map((f) => f.name),
      [parsedFields]
    );
    const { openMediaSelector } = useMediaSelector();
    // Ensure value is always an array
    const safeValue = Array.isArray(value) ? value : [];

    // Track which items are expanded (open state) by index
    const [expandedItems, setExpandedItems] = React.useState<Set<number>>(
      () => new Set()
    );

    const toggleItem = (index: number) => {
      setExpandedItems((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
    };

    const addItem = () => {
      const newItem: ObjectArrayItem = {};
      rawFieldNames.forEach((fieldName) => {
        newItem[fieldName] = "";
      });
      onChange([...safeValue, newItem]);

      // Newly added items open by default for easier editing
      setExpandedItems((prev) => {
        const next = new Set(prev);
        next.add(safeValue.length);
        return next;
      });
    };

    const removeItem = (index: number) => {
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

    const updateItem = (
      index: number,
      fieldName: string,
      fieldValue: unknown,
      altTextFromMedia?: string
    ) => {
      const newValue = [...safeValue];
      newValue[index] = { ...newValue[index], [fieldName]: fieldValue };
      // When the value came from the media picker (image or video),
      // opportunistically copy its altText into a sibling "alt" field if the
      // schema has one.
      if (
        altTextFromMedia &&
        fieldName !== "alt" &&
        rawFieldNames.includes("alt")
      ) {
        newValue[index] = { ...newValue[index], alt: altTextFromMedia };
      }
      onChange(newValue);
    };

    const handleReorder = (from: number, to: number) => {
      onChange(arrayMove(safeValue, from, to));
      setExpandedItems((prev) => remapExpandedOnMove(prev, from, to));
    };

    const canReorder = showControls && !disabled && safeValue.length > 1;

    return (
      <div className={cn(styles.root, className)} ref={ref} {...props}>
        {label && <span className={styles.label}>{label}</span>}

        <SortableList itemCount={safeValue.length} onReorder={handleReorder}>
          <div className={styles.items}>
            {safeValue.map((item, index) => (
              <SortableItemCard
                key={index}
                index={index}
                expanded={expandedItems.has(index)}
                onToggle={() => toggleItem(index)}
                disabled={disabled}
                canReorder={canReorder}
                showRemove={showControls}
                onRemove={() => removeItem(index)}
              >
                {parsedFields.map(({ name: fieldName, mediaType }) => {
                  const fieldValue = String(item?.[fieldName] ?? "");

                  return (
                    <ObjectField
                      key={fieldName}
                      fieldName={fieldName}
                      value={fieldValue}
                      mediaType={mediaType}
                      disabled={disabled}
                      error={error}
                      onUpdate={(v, altText) =>
                        updateItem(index, fieldName, v, altText)
                      }
                      openMediaSelector={openMediaSelector}
                    />
                  );
                })}
              </SortableItemCard>
            ))}
          </div>
        </SortableList>

        {showControls && (
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

        {helperText && (
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

ObjectArrayInput.displayName = "ObjectArrayInput";

export { ObjectArrayInput };
