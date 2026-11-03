import type { QueryClient, QueryKey } from '@tanstack/react-query';

export const COMMERCE_CHANGED_EVENT = 'teajia:commerce-changed';

export interface CommerceChange {
  accountId?: string | null;
  queriesInvalidated?: boolean;
  /** The write changed exactly these teas and no others (see authedFetch). */
  productIds?: readonly string[];
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

export function notifyCommerceChanged(accountId?: string | null, queriesInvalidated = false, productIds?: readonly string[]): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<CommerceChange>(COMMERCE_CHANGED_EVENT, {
      detail: { accountId, queriesInvalidated, ...(productIds?.length ? { productIds } : {}) },
    }));
  }
}

/** The admin shell's full shelf, `['products', account, user]` (useProducts). */
export function isAdminProductList(key: QueryKey): boolean {
  return key[0] === 'products' && key.length === 3 && key[1] !== 'detail' && key[1] !== 'public';
}

export interface RefreshCommerceOptions {
  /**
   * The caller has already put the changed rows into the shelf (the product
   * reconciler reads just those teas), so refetching the whole shelf again
   * only repeats the most expensive read in the admin. Everything else that
   * depends on the change still refreshes.
   */
  shelfRowsReconciled?: boolean;
  /**
   * The write changed exactly these teas. A shelf with a registered row
   * reconciler reads just them instead of rereading every tea in the shop; a
   * shelf with none (nothing on screen holds it) is invalidated as before.
   */
  changedProductIds?: readonly string[];
}

type ShelfReconciler = (ids: readonly string[]) => Promise<boolean>;
const shelfReconcilers = new Map<string, Set<ShelfReconciler>>();
const shelfKey = (key: QueryKey) => JSON.stringify(key);

/** useProducts registers the reconciler for the shelf it reads, so a write that
 * names its teas can refresh those rows without rereading the whole shelf. */
export function registerShelfReconciler(queryKey: QueryKey, reconcile: ShelfReconciler): () => void {
  const key = shelfKey(queryKey);
  const set = shelfReconcilers.get(key) ?? new Set<ShelfReconciler>();
  set.add(reconcile);
  shelfReconcilers.set(key, set);
  return () => {
    set.delete(reconcile);
    if (set.size === 0 && shelfReconcilers.get(key) === set) shelfReconcilers.delete(key);
  };
}

export async function refreshCommerceQueries(client: QueryClient, accountId?: string | null, options: RefreshCommerceOptions = {}): Promise<void> {
  // Local readiness summaries also subscribe; the bootstrap listener ignores
  // this acknowledged event so a refresh cannot recursively trigger itself.
  notifyCommerceChanged(accountId, true, options.changedProductIds);
  const ids = options.changedProductIds?.length ? [...new Set(options.changedProductIds)] : [];
  const reconciled: Array<{ shelf: string; reconcile: ShelfReconciler }> = [];
  const rowsOnly = (key: QueryKey) => {
    if (!ids.length || !isAdminProductList(key)) return false;
    const shelf = shelfKey(key);
    const reconcile = shelfReconcilers.get(shelf)?.values().next().value;
    if (!reconcile) return false;
    reconciled.push({ shelf, reconcile });
    return true;
  };
  await client.invalidateQueries({
    predicate: query => isCommerceQuery(query.queryKey)
      && !(options.shelfRowsReconciled && isAdminProductList(query.queryKey))
      && !rowsOnly(query.queryKey),
  });
  await Promise.all(reconciled.map(({ shelf, reconcile }) => readRows(shelf, reconcile, ids)));
}

// A save reaches here twice (the write's own signal and the screen's explicit
// refresh), both after the write has landed. While one read of these rows is
// still in flight, the second joins it instead of reading the same teas again.
const inFlightRows = new Map<string, Promise<boolean>>();
function readRows(shelf: string, reconcile: ShelfReconciler, ids: readonly string[]): Promise<boolean> {
  const key = `${shelf}\u0000${[...ids].sort().join('\u0000')}`;
  const pending = inFlightRows.get(key);
  if (pending) return pending;
  const read = reconcile(ids).finally(() => { if (inFlightRows.get(key) === read) inFlightRows.delete(key); });
  inFlightRows.set(key, read);
  return read;
}
