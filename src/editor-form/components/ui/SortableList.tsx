import * as React from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

interface SortableListProps {
  /** Number of items; sortable ids are their indices [0..itemCount-1]. */
  itemCount: number;
  /** Called with the drag source and destination indices on drop. */
  onReorder: (from: number, to: number) => void;
  children: React.ReactNode;
}

/**
 * Drag context for an index-keyed sortable list. Wraps children in a @dnd-kit
 * DndContext + vertical SortableContext with the editor's standard pointer
 * sensor, and surfaces drops as (from, to) index pairs. Pair with
 * <SortableItemCard> rows. Shared by the repeatable field inputs (ArrayInput /
 * ObjectArrayInput / FAQInput).
 */
export const SortableList: React.FC<SortableListProps> = ({
  itemCount,
  onReorder,
  children,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    onReorder(Number(active.id), Number(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={Array.from({ length: itemCount }, (_, i) => i)}
        strategy={verticalListSortingStrategy}
      >
        {children}
      </SortableContext>
    </DndContext>
  );
};
