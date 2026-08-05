/**
 * Reorder helpers for the repeatable field inputs (ArrayInput / ObjectArrayInput
 * / FAQInput). Those inputs key their per-item UI state (which cards are
 * expanded) by array index, so when @dnd-kit reorders the underlying array we
 * must remap that state to keep it pinned to the items as they move.
 */

/**
 * Where does an old index end up after an item is moved from `from` to `to`
 * (splice-out then splice-in — the same semantics as @dnd-kit's `arrayMove`)?
 */
export function remapIndexAfterArrayMove(
  index: number,
  from: number,
  to: number
): number {
  if (index === from) {
    return to;
  }
  if (from < to) {
    // Items between the old and new slot shift one toward the start.
    return index > from && index <= to ? index - 1 : index;
  }
  // from > to: items between the new and old slot shift one toward the end.
  return index >= to && index < from ? index + 1 : index;
}

/** Remap a set of expanded indices through an `arrayMove(from, to)`. */
export function remapExpandedOnMove(
  expanded: Set<number>,
  from: number,
  to: number
): Set<number> {
  const next = new Set<number>();
  expanded.forEach((i) => next.add(remapIndexAfterArrayMove(i, from, to)));
  return next;
}
