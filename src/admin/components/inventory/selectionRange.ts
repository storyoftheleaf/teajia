export interface SelectionGroup {
  key: string;
  items: ReadonlyArray<{ id: string }>;
}

/** Ids of the rows actually drawn, top to bottom: group order, collapsed groups left out. */
export function renderedRowIds(
  groups: ReadonlyArray<SelectionGroup> | null | undefined,
  collapsed: ReadonlySet<string>,
  flat: ReadonlyArray<{ id: string }>,
): string[] {
  if (!groups) return flat.map(p => p.id);
  return groups.filter(g => !collapsed.has(g.key)).flatMap(g => g.items.map(p => p.id));
}

/**
 * The ids a shift-click selects: every drawn row between the anchor and the
 * target, inclusive. If either end is not drawn (collapsed or filtered out),
 * there is no visible range and only the target is returned.
 */
export function shiftRangeIds(rendered: ReadonlyArray<string>, anchorId: string | null, targetId: string): string[] {
  if (anchorId === null) return [targetId];
  const a = rendered.indexOf(anchorId);
  const t = rendered.indexOf(targetId);
  if (a < 0 || t < 0) return [targetId];
  return rendered.slice(Math.min(a, t), Math.max(a, t) + 1);
}
