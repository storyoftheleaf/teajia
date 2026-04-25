import { useMemo } from 'react';
import type { InventoryItem, TastingData } from '../types';
import { getCommonTastingForType } from '../data/commonTastingByStyle';

export type ResolvedTastingSource = 'owner' | 'community' | 'common';

export interface ResolvedTasting {
  tasting: TastingData;
  source: ResolvedTastingSource;
}

/**
 * Resolves which tasting data to show on a product surface.
 *
 * Order:
 *   1. Owner-confirmed tasting on the product (tastingSource === 'owner')
 *   2. Community-aggregated tasting (tastingSource === 'community')
 *   3. Style-level common profile (falls back for everything else)
 *
 * Returns null only if the product has no style match *and* no saved tasting —
 * in which case no tasting strip should render.
 */
export function useProductTasting(item: Pick<InventoryItem, 'type' | 'tasting' | 'tastingSource'> | null | undefined): ResolvedTasting | null {
  return useMemo(() => {
    if (!item) return null;

    const itemHasTerms = !!(item.tasting && hasAnyTerms(item.tasting));

    // 1. Owner-authored data — Adrian's voice.
    if (item.tastingSource === 'owner' && itemHasTerms) {
      return { tasting: item.tasting!, source: 'owner' };
    }

    // 2. Community-aggregated data saved on the product.
    if (item.tastingSource === 'community' && itemHasTerms) {
      return { tasting: item.tasting!, source: 'community' };
    }

    // 3. Explicit "common" stamp on this product — use the product's own
    //    tasting data but label it as style-typical (not owner-authored).
    if (item.tastingSource === 'common' && itemHasTerms) {
      return { tasting: item.tasting!, source: 'common' };
    }

    // 4. Type-level fallback — baseline for the style, when no product-level
    //    data exists. Currently empty; populate commonTastingByStyle.ts to enable.
    const common = getCommonTastingForType(item.type);
    if (common && hasAnyTerms(common)) {
      return { tasting: common, source: 'common' };
    }

    return null;
  }, [item]);
}

function hasAnyTerms(t: TastingData): boolean {
  return Boolean(
    (t.flavor && t.flavor.length) ||
    (t.feeling && t.feeling.length) ||
    (t.body && t.body.length) ||
    (t.finish && t.finish.length)
  );
}
