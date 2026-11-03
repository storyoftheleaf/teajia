export interface AsyncResultGuard {
  isCurrent: () => boolean;
  cancel: () => void;
}

export function createAsyncResultGuard(): AsyncResultGuard {
  let current = true;
  return {
    isCurrent: () => current,
    cancel: () => { current = false; },
  };
}

export type TrackingResult<T> =
  | { status: 'found'; inquiry: T }
  | { status: 'missing' }
  | { status: 'unavailable' };

/** The API returns null only for 404. A failed connection cannot prove absence. */
export async function loadTrackingRequest<T>(load: () => Promise<T | null>): Promise<TrackingResult<T>> {
  try {
    const inquiry = await load();
    return inquiry === null ? { status: 'missing' } : { status: 'found', inquiry };
  } catch { return { status: 'unavailable' }; }
}

export function trackingItemQuantity(item: { category?: string; quantityGrams?: number; packGrams?: number; packs?: number }): string {
  if (item.category !== 'tea') return `×${item.quantityGrams}`;
  const packs = Number(item.packs);
  const grams = Number(item.packGrams);
  if (Number.isInteger(packs) && packs > 0 && Number.isFinite(grams) && grams > 0) {
    return `${packs > 1 ? `${packs} × ` : ''}${grams}g`;
  }
  return `${item.quantityGrams}g`;
}

export interface AgreedOrderItem {
  id: string;
  product_id?: string | null;
  name: string;
  quantity: number;
  quantity_unit?: 'g' | 'unit';
  unit_price_usd: number;
  line_total_usd: number;
}

export function agreedItemForDisplay(item: AgreedOrderItem) {
  return {
    id: item.product_id || item.id,
    lineKey: item.id,
    name: item.name,
    category: item.quantity_unit === 'unit' ? 'ware' as const : 'tea' as const,
    quantityGrams: Number(item.quantity),
    pricePerGram: Number(item.unit_price_usd),
    totalPrice: Number(item.line_total_usd),
  };
}

/** Original intent remains evidence; the accepted invoice is what is sold. */
export function orderDisplayItems(inquiry: {
  items_json?: string;
  invoice_items?: AgreedOrderItem[];
  order?: { status?: string } | null;
} | null | undefined): (ReturnType<typeof agreedItemForDisplay> & { packGrams?: number; packs?: number; variant?: string })[] {
  if (inquiry?.order?.status !== 'Draft' && Array.isArray(inquiry?.invoice_items)) {
    return inquiry.invoice_items.map(agreedItemForDisplay);
  }
  try {
    const items = JSON.parse(inquiry?.items_json || '[]');
    return Array.isArray(items) ? items : [];
  } catch { return []; }
}

export function refundProgress(order: { status?: string; refund_required?: boolean | number; refunded_usd?: number } | null | undefined): string | null {
  if (order?.status !== 'Void') return null;
  if (order.refund_required) return Number(order.refunded_usd) > 0 ? 'Cancelled · refund in progress' : 'Cancelled · refund due';
  return Number(order.refunded_usd) > 0 ? 'Cancelled · refunded' : 'Cancelled';
}
