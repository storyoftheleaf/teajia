import type { PurchaseOrder } from '../../lib/api';
import type { InventoryReceipt } from '../types';

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
