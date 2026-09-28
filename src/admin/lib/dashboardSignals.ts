import type { Product } from '../types';

/** Only recorded stock facts become tasks. A missing count is not low stock. */
export function dashboardStockSignals(products: readonly Product[]) {
  const holdings = products.filter(p => p.status !== 'Archived');
  return {
    recheck: holdings.filter(p => p.recheckStock || !p.stockKnownAt),
    low: holdings.filter(p => p.status === 'Active' && p.type !== 'Teaware' && !p.recheckStock && !!p.stockKnownAt && p.stockGrams > 0 && p.lowStockThreshold > 0 && p.stockGrams <= p.lowStockThreshold),
    incoming: holdings.filter(p => p.inTransit),
  };
}
