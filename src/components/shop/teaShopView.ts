import type { InventoryItem } from '../../types';

export type TeaShopView = 'all' | 'selection' | 'find';
export type TeaFinderIntent = 'light-fragrant' | 'grounding-deep' | 'clear-focused' | 'all';

export const TEA_SHOP_VIEWS = [
  { id: 'all' as const, label: 'All teas' },
  { id: 'selection' as const, label: 'My selection' },
  { id: 'find' as const, label: 'Find a tea' },
];

const saleReady = (item: InventoryItem) => Number(item.price_per_gram) > 0;

export const selectAvailableTeas = (items: InventoryItem[]) =>
  items.filter(item => item.stock_g > 0 && saleReady(item));
export const selectCuratedTeas = (items: InventoryItem[]) =>
  selectAvailableTeas(items).filter(item => item.isCurated);
export const selectPastTeas = (items: InventoryItem[]) =>
  items.filter(item => item.stock_g <= 0 && saleReady(item));

export function applyFinderIntent(intent: TeaFinderIntent) {
  if (intent === 'light-fragrant') return { categoryId: 'flavor' as const, termId: 'floral' };
  if (intent === 'grounding-deep') return { categoryId: 'feeling' as const, termId: 'grounding' };
  if (intent === 'clear-focused') return { categoryId: 'feeling' as const, termId: 'clarifying' };
  return null;
}
