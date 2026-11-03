import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const COMMERCE_CHANGED_EVENT = 'teajia:commerce-changed';

export interface CommerceChange {
  accountId?: string | null;
  queriesInvalidated?: boolean;
}

/** Private queries remain scoped by their existing keys. Invalidating a key
 * never transfers its data into another account; active readers revalidate. */
export function isCommerceQuery(key: QueryKey): boolean {
  const family = String(key[0] ?? '');
  return /^(products|admin-products|orders|invoices|my-orders|customer-orders|order|purchase_orders|stock_ledger|inventory-summary|inventory-receipts|shop-freight-default|rates|public-catalogue|vendor-products|vendor-priced-products|product-impressions|customers|activity_logs|admin-inquiries|inquiries-new-count|attention)$/.test(family)
    || /^(invoice-|invoices-|order-|inventory-|purchase-|stock-)/.test(family)
    || family === 'storefront'
    || family === 'network'
    || /^(dashboard-|panel-attention)/.test(family)
    || (family === 'me' && key[1] === 'orders');
}

export function notifyCommerceChanged(accountId?: string | null, queriesInvalidated = false): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<CommerceChange>(COMMERCE_CHANGED_EVENT, {
      detail: { accountId, queriesInvalidated },
    }));
  }
}

export async function refreshCommerceQueries(client: QueryClient, accountId?: string | null): Promise<void> {
  // Local readiness summaries also subscribe; the bootstrap listener ignores
  // this acknowledged event so a refresh cannot recursively trigger itself.
  notifyCommerceChanged(accountId, true);
  await client.invalidateQueries({ predicate: query => isCommerceQuery(query.queryKey) });
}
