import type { TastingData } from '../types';

/**
 * Style-level baseline tasting profiles.
 *
 * Intentionally empty — no default suggestions are pre-populated.
 * Products only show a tasting description once the owner has saved one
 * (tastingSource === 'owner') or community aggregation has produced one.
 *
 * If you want to provide a per-style starting point later, add entries
 * here keyed by `InventoryItem.type` with a TastingData value. Keep them
 * conservative: 2–4 flavor terms, 1–2 feeling terms. Overclaiming here
 * undermines the owner's voice when they review.
 */
export const COMMON_TASTING_BY_STYLE: Record<string, TastingData> = {};

export function getCommonTastingForType(type: string | undefined): TastingData | null {
  if (!type) return null;
  return COMMON_TASTING_BY_STYLE[type] ?? null;
}
