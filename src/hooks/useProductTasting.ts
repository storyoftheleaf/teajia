import type { InventoryItem } from '../types';

interface ResolvedTasting {
  tasting?: unknown;
  source?: unknown;
}

export function useProductTasting(_item: InventoryItem): ResolvedTasting | null {
  return null;
}
