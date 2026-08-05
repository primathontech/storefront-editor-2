import React, { useState } from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { Input } from "./design-system";
import { remapExpandedOnMove } from "../../utils/reorder";
import { SortableItemCard } from "./SortableItemCard";
import { SortableList } from "./SortableList";
import styles from "./FAQInput.module.css";

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

  const handleReorder = (from: number, to: number) => {
    const newItems = arrayMove(items, from, to);
    setItems(newItems);
    onChange(newItems);
    setExpandedItems((prev) => remapExpandedOnMove(prev, from, to));
  };

  const canReorder = showControls && !disabled && items.length > 1;

  return (
    <div className={styles.root}>
      {label && <span className={styles.label}>{label}</span>}

      <SortableList itemCount={items.length} onReorder={handleReorder}>
        <div className={styles.items}>
          {items.map((item, index) => (
            <SortableItemCard
              key={index}
              index={index}
              expanded={expandedItems.has(index)}
              onToggle={() => toggleItem(index)}
              disabled={disabled}
              canReorder={canReorder}
              showRemove={showControls}
              onRemove={() => removeItem(index)}
              itemNoun="FAQ item"
            >
              <Input
                label="Question"
                labelVariant="subtle"
                type="text"
                size="md"
                value={item.question}
                onChange={(e) => updateItem(index, "question", e.target.value)}
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
                onChange={(e) => updateItem(index, "answer", e.target.value)}
                disabled={disabled}
                placeholder="Enter Answer"
                fullWidth
              />
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
            + Add FAQ Item
          </button>
        </div>
      )}
    </div>
  );
};
