import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "../../utils/utils";
import { ChevronDownIcon } from "./icons/ChevronDownIcon";
import { ChevronUpIcon } from "./icons/ChevronUpIcon";
import { DragDotsIcon } from "./icons/DragDotsIcon";
import { LayoutIcon } from "./icons/LayoutIcon";
import { TrashRedIcon } from "./icons/TrashIcon";
import { useConfirm } from "./useConfirm";
import styles from "./SortableItemCard.module.css";

export interface SortableItemCardProps {
  /** Zero-based position; also the @dnd-kit sortable id and the "Item N" label. */
  index: number;
  expanded: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** Render the drag grip and make the row draggable. */
  canReorder: boolean;
  /** Render the remove (trash) button. */
  showRemove: boolean;
  onRemove: () => void;
  /** Error styling on the card border. */
  error?: boolean;
  /** Noun used in aria-labels ("item", "FAQ item", …). Default "item". */
  itemNoun?: string;
  /** Expanded body content (the per-input field editors). */
  children: React.ReactNode;
}

/**
 * The collapsible, sortable row shell shared by the repeatable field inputs
 * (ArrayInput / ObjectArrayInput / FAQInput). Owns the @dnd-kit sortable node,
 * the drag grip (LayoutIcon at rest → DragDotsIcon on hover), the "Item N"
 * header with expand + remove controls, and the expandable body. Callers supply
 * the body fields as children and drive open/remove/reorder from their own value
 * state. Wrap the list in <SortableList> for the drag context.
 */
export const SortableItemCard: React.FC<SortableItemCardProps> = ({
  index,
  expanded,
  onToggle,
  disabled = false,
  canReorder,
  showRemove,
  onRemove,
  error = false,
  itemNoun = "item",
  children,
}) => {
  const { confirm, dialog } = useConfirm();

  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: index });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: "relative",
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 1 : undefined,
  };

  const handleToggle = () => {
    if (!disabled) {
      onToggle();
    }
  };

  const handleRemove = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (disabled) {
      return;
    }
    confirm(
      {
        title: `Remove ${itemNoun}?`,
        message: `This ${itemNoun} will be removed. This can't be undone.`,
      },
      onRemove
    );
  };

  return (
    <>
      <div ref={setNodeRef} style={style}>
        <div className={cn(styles.itemCard, error && styles.itemCardError)}>
          <div
            className={cn(
              styles.itemHeader,
              expanded && styles.itemHeaderExpanded
            )}
            role="button"
            tabIndex={0}
            aria-expanded={expanded}
            aria-label={`Toggle ${itemNoun} ${index + 1}`}
            onClick={handleToggle}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleToggle();
              }
            }}
          >
            {canReorder && (
              <span
                ref={setActivatorNodeRef}
                className={styles.dragHandle}
                aria-label={`Drag to reorder ${itemNoun} ${index + 1}`}
                onClick={(event) => event.stopPropagation()}
                {...attributes}
                {...listeners}
              >
                <LayoutIcon className={styles.layoutIcon} />
                <DragDotsIcon className={styles.dragIcon} />
              </span>
            )}

            <span className={styles.itemTitle}>Item {index + 1}</span>

            {showRemove && (
              <button
                type="button"
                onClick={handleRemove}
                disabled={disabled}
                className={styles.removeButton}
                aria-label={`Remove ${itemNoun} ${index + 1}`}
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
              <div className={styles.fields}>{children}</div>
            </div>
          )}
        </div>
      </div>
      {dialog}
    </>
  );
};
