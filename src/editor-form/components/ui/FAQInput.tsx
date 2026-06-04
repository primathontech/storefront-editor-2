import { ChevronDownIcon } from "./icons/ChevronDownIcon";
import { ChevronUpIcon } from "./icons/ChevronUpIcon";
import React, { useState } from "react";
import { Input } from "./design-system";
import styles from "./FAQInput.module.css";
import { TrashRedIcon } from "./icons/TrashIcon";

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQInputProps {
  value: FAQItem[];
  onChange: (value: FAQItem[]) => void;
  label?: string;
  disabled?: boolean;
  showControls?: boolean;
}

export const FAQInput: React.FC<FAQInputProps> = ({
  value = [],
  onChange,
  label = "FAQ Items",
  disabled = false,
  showControls = false,
}) => {
  const [items, setItems] = useState<FAQItem[]>(value);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(
    () => new Set()
  );

  const addItem = () => {
    const newItems = [...items, { question: "", answer: "" }];
    setItems(newItems);
    onChange(newItems);

    // Newly added FAQ opens by default
    setExpandedItems((prev) => {
      const next = new Set(prev);
      next.add(newItems.length - 1);
      return next;
    });
  };

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    onChange(newItems);

    // Keep expanded indexes in sync after removal
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
    field: "question" | "answer",
    value: string
  ) => {
    const newItems = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    setItems(newItems);
    onChange(newItems);
  };

  return (
    <div className={styles.root}>
      {label && <span className={styles.label}>{label}</span>}

      <div className={styles.items}>
        {items.map((item, index) => {
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
            <div key={index} className={styles.itemCard}>
              <div
                className={`${styles.itemHeader} ${
                  expanded ? styles.itemHeaderExpanded : ""
                }`}
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label={`Toggle FAQ item ${index + 1}`}
                onClick={handleToggle}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleToggle();
                  }
                }}
              >
                <span className={styles.itemTitle}>Item {index + 1}</span>

                {showControls && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!disabled) {
                        removeItem(index);
                      }
                    }}
                    disabled={disabled}
                    className={styles.removeButton}
                    aria-label={`Remove FAQ item ${index + 1}`}
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
                      label="Question"
                      labelVariant="subtle"
                      type="text"
                      size="md"
                      value={item.question}
                      onChange={(e) =>
                        updateItem(index, "question", e.target.value)
                      }
                      disabled={disabled}
                      placeholder="Enter Question"
                      fullWidth
                    />
                    <Input
                      label="Answer"
                      labelVariant="subtle"
                      type="text"
                      size="md"
                      value={item.answer}
                      onChange={(e) =>
                        updateItem(index, "answer", e.target.value)
                      }
                      disabled={disabled}
                      placeholder="Enter Answer"
                      fullWidth
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showControls && (
        <div className={styles.addRow}>
          <button
            type="button"
            onClick={addItem}
            disabled={disabled}
            className={styles.addButton}
          >
            + Add FAQ Item
          </button>
        </div>
      )}
    </div>
  );
};
