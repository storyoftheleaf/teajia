import type { PurchaseOrder } from '../../lib/api';
import type { InventoryReceipt } from '../types';
import { rateToUsd, type RateRow } from '../../lib/currency';

/** Exact fields returned by GET /api/customers/:id/products. */
export interface VendorProductRow {
  id: string;
  product_name: string;
  given_name: string | null;
  chinese_name: string | null;
  type: string | null;
  image_url: string | null;
  origin_country: string | null;
  origin_region: string | null;
  stock_grams: number | null;
  status: string | null;
  cost_amount: number | null;
  cost_currency: string | null;
}

/** Relevant fields from the account-scoped /api/products pricing response. */
export interface PricedProductRow {
  id: string;
  type: string | null;
  cost_amount: number | null;
  cost_currency: string | null;
  cost_currency_source: string | null;
  cost_per_gram_usd: number | null;
  quantity_purchased: number | null;
  quantity_units: number | null;
  stock_grams: number | null;
}

export interface VendorEconomics {
  totalCostUsd: number | null;
  avgCostPerGramUsd: number | null;
  stockValueUsd: number | null;
}

/** Decline a metric if any linked row would make the sum or average misleading. */
export function vendorEconomics(
  supplied: VendorProductRow[],
  priced: PricedProductRow[] | undefined,
  rates: readonly RateRow[] | null | undefined,
): VendorEconomics {
  if (!priced) return { totalCostUsd: null, avgCostPerGramUsd: null, stockValueUsd: null };
  const byId = new Map(priced.map(row => [row.id, row]));
  const costUsd = (row: VendorProductRow): number | null => {
    const full = byId.get(row.id);
    if (!full || !full.cost_currency_source || full.cost_amount == null || !Number.isFinite(Number(full.cost_amount))) return null;
    const rate = rateToUsd(rates, full.cost_currency);
    return rate ? Number(full.cost_amount) / rate : null;
  };
  const perUnitUsd = (row: VendorProductRow): number | null => {
    const full = byId.get(row.id);
    if (!full || costUsd(row) == null) return null;
    const quantity = Number(full.type === 'Teaware' ? full.quantity_units ?? full.quantity_purchased : full.quantity_purchased);
    const perUnit = Number(full.cost_per_gram_usd);
    if (!Number.isFinite(quantity) || quantity <= 0 || full.cost_per_gram_usd == null || !Number.isFinite(perUnit) || perUnit < 0) return null;
    // The Worker returns zero when a positive cost has no usable price.
    if (perUnit === 0 && Number(full.cost_amount) > 0) return null;
    return perUnit;
  };
  const active = supplied.filter(row => row.status !== 'Archived');
  const sumKnown = (values: Array<number | null>): number | null => values.every(value => value !== null)
    ? values.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;

  const totalCostUsd = sumKnown(supplied.map(costUsd));
  const tea = active.filter(row => byId.get(row.id)?.type !== 'Teaware');
  const teaCosts = tea.map(perUnitUsd);
  const avgCostPerGramUsd = teaCosts.length && teaCosts.every(value => value !== null)
    ? teaCosts.reduce<number>((sum, value) => sum + (value ?? 0), 0) / teaCosts.length
    : null;
  const stockValueUsd = sumKnown(active.map(row => {
    const full = byId.get(row.id);
    const cost = perUnitUsd(row);
    const quantity = full?.type === 'Teaware' ? full.quantity_units : row.stock_grams;
    if (cost === null || quantity == null || !Number.isFinite(Number(quantity)) || Number(quantity) < 0) return null;
    return Number(quantity) * cost;
  }));

  return { totalCostUsd, avgCostPerGramUsd, stockValueUsd };
}

const normalizedName = (name: string | null | undefined) => name?.trim().toLocaleLowerCase() || '';

/** A vendor ID is authoritative. Older purchase orders only recorded the name. */
export function vendorPurchaseOrders(orders: PurchaseOrder[], vendorId: string, vendorName: string): PurchaseOrder[] {
  const name = normalizedName(vendorName);
  return orders.filter(order => order.vendor_id
    ? order.vendor_id === vendorId
    : !!name && normalizedName(order.vendor_name) === name);
}

/** Receipts have a vendor name, but no vendor ID. Require an exact name match. */
export function vendorReceipts(receipts: InventoryReceipt[], vendorName: string): InventoryReceipt[] {
  const name = normalizedName(vendorName);
  return name ? receipts.filter(receipt => normalizedName(receipt.vendor_name) === name) : [];
}

export function recordedCost(product: VendorProductRow): string | null {
  if (product.cost_amount == null || !product.cost_currency || product.cost_currency === 'UNK') return null;
  return `${Number(product.cost_amount).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${product.cost_currency}`;
}
