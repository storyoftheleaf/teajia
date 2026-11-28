// A tea's stock in Manage: its movements through the stock ledger
// (api.stockMovements) and where it is kept, the shop's own places and one
// tea's split (api.stockPlaces, worker/src/stockPlaces.ts).

/** One tea's stock split by place, as the worker reads it: the total, each place, and what is not placed yet. */
export interface StockPlacesSplit { total: number; unit: 'g' | 'pieces'; places: Array<{ id: string; name: string; amount: number }>; not_placed: number }
export interface StockPlace { id: string; name: string; position: number }

interface StockPlacesApiDependencies {
  apiUrl: string;
  authedFetch: (url: string, init?: RequestInit & { retryTimeouts?: boolean; callerRefreshesCommerce?: boolean }) => Promise<any>;
}

export interface StockMovementBody {
  movement_type: 'receipt' | 'sale' | 'sample_use' | 'gift' | 'waste' | 'return' | 'recount' | 'transfer';
  unit: 'g' | 'unit'; expected_balance: number; idempotency_key: string;
  quantity?: number; balance?: number; destination_product_id?: string;
  note?: string; batch_id?: string; source_invoice_id?: string; source_invoice_number?: string; source_compass_entry_id?: string;
  /** Where it happened; with a recount, place_balance is what that place holds now. */
  place_id?: string; place_balance?: number;
}

export function createStockMovementsApi({ apiUrl, authedFetch }: StockPlacesApiDependencies) {
  return {
    create: (productId: string, body: StockMovementBody, options: { callerRefreshesCommerce?: boolean } = {}) =>
      authedFetch(`${apiUrl}/api/products/${productId}/movements`, { method: 'POST', body: JSON.stringify(body), retryTimeouts: true, ...options }),
  };
}

export function createStockPlacesApi({ apiUrl, authedFetch }: StockPlacesApiDependencies) {
  const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
  return {
    list: (): Promise<{ places: StockPlace[] }> => authedFetch(`${apiUrl}/api/stock-places`),
    create: (name: string): Promise<{ place: StockPlace }> => authedFetch(`${apiUrl}/api/stock-places`, json('POST', { name })),
    update: (id: string, patch: { name?: string; position?: number; archived?: boolean }) =>
      authedFetch(`${apiUrl}/api/stock-places/${encodeURIComponent(id)}`, json('PUT', patch)),
    forProduct: (productId: string): Promise<{ product_id: string; stock_places: StockPlacesSplit }> =>
      authedFetch(`${apiUrl}/api/products/${encodeURIComponent(productId)}/stock-places`),
    setForProduct: (productId: string, body: { amounts: Array<{ place_id: string; amount: number }>; expected_total: number; note?: string }): Promise<{ product_id: string; stock_places: StockPlacesSplit }> =>
      authedFetch(`${apiUrl}/api/products/${encodeURIComponent(productId)}/stock-places`, json('PUT', body)),
  };
}
