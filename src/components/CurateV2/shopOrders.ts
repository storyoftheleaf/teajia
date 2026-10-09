/**
 * The shop's purchase orders, read back into Curate.
 *
 * A purchase confirmed in Curate is recorded at the shop, but the Orders tab
 * used to read only this device's ledger, so a laptop or a fresh browser said
 * "No orders yet" about orders the shop holds. This is the one place those
 * records are read and turned into what Curate shows:
 *
 *   - `shopOrderOf` reads one record. The shop keeps `items_json` as written by
 *     whichever door recorded the order (Curate writes name / quantity /
 *     pricePerUnit / priceIsPerGram / currency; the admin's order builder writes
 *     product_name / quantity_grams and no price), so a line is read for what it
 *     says and a price nobody wrote is left out, never read as nothing.
 *   - `mergeOrders` lays the shop's orders beside this device's own, one row per
 *     order: a local order the shop already recorded (it keeps the shop's id) is
 *     not shown twice.
 *   - `useShopOrders` is the read, once, with the states a screen has to say.
 *
 * A dollar total the shop could not work out is stored as NULL (migration
 * 0040; before it the column was NOT NULL DEFAULT 0) and is shown as a dash,
 * never as $0. Every door that writes the column now writes NULL for unknown,
 * so a stored 0 is a real $0 and is kept: nothing entered is NULL, anything
 * entered is the number, zero included.
 */
import { useQuery } from '@tanstack/react-query';
import { api, type PurchaseOrder } from '../../lib/api';
import { usePrivateQueryScope } from '../../admin/hooks/usePrivateQueryScope';
import type { Currency } from '../../admin/types';
import type { LedgerLineItem, LedgerTransaction } from '../../lib/ledgerStore';
import { orderMoney } from './curatePricing';

export interface ShopOrder {
  id: string;
  vendorName: string;
  vendorId: string | null;
  /** The shop's own word: confirmed, sent, ordered, received, cancelled, pending. */
  status: string;
  /** The money the order was placed in. */
  currency: Currency;
  /** What the shop recorded in dollars, or null when it recorded nothing it can stand behind. */
  totalUsd: number | null;
  createdAt: string;
  updatedAt: string;
  /** The lines, in the same shape a local order holds them, so one set of money arithmetic reads both. */
  items: LedgerLineItem[];
  /** The record held lines that could not be read at all. */
  unreadableLines: boolean;
  notes: string | null;
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/** One recorded line read back as a ledger line. A price nobody wrote makes the line `unpriced`. */
function lineOf(raw: unknown, index: number, orderCurrency: Currency, at: string): LedgerLineItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = text(r.name) ?? text(r.product_name) ?? 'Unnamed';
  const legacyGrams = num(r.quantity_grams);
  // Curate's own lines say whether the quantity is grams (a price per gram) or pieces;
  // the admin builder's lines are always grams.
  const perGram = typeof r.priceIsPerGram === 'boolean' ? r.priceIsPerGram : true;
  const quantity = num(r.quantity) ?? legacyGrams ?? 0;
  const price = num(r.pricePerUnit);
  const currency = (text(r.currency) ?? orderCurrency) as Currency;
  return {
    id: `shop-line-${index}`,
    name,
    chineseName: text(r.chineseName),
    type: text(r.type),
    form: text(r.form),
    year: num(r.year),
    quantityGrams: perGram ? quantity : legacyGrams,
    quantityUnits: perGram ? undefined : quantity,
    pricePerUnit: price ?? 0,
    priceIsPerGram: perGram,
    currency,
    ...(price === undefined ? { unpriced: true } : {}),
    compassEntryId: text(r.compass_entry_id),
    productId: text(r.product_id),
    addedAt: at,
  };
}

export function shopOrderOf(po: PurchaseOrder): ShopOrder {
  const currency = (text(po.display_currency) ?? 'USD') as Currency;
  const createdAt = text(po.created_at) ?? '';
  let rawLines: unknown[] = [];
  let unreadableLines = false;
  try {
    const parsed = JSON.parse(po.items_json || '[]');
    if (Array.isArray(parsed)) rawLines = parsed;
    else unreadableLines = true;
  } catch {
    unreadableLines = true;
  }
  const items: LedgerLineItem[] = [];
  rawLines.forEach((raw, index) => {
    const line = lineOf(raw, index, currency, createdAt);
    if (line) items.push(line); else unreadableLines = true;
  });
  const usd = num(typeof po.total_usd === 'string' ? Number(po.total_usd) : po.total_usd);
  return {
    id: po.id,
    vendorName: text(po.vendor_name) ?? 'Vendor',
    vendorId: text(po.vendor_id) ?? null,
    status: text(po.status) ?? 'pending',
    currency,
    // NULL is "the shop could not say" (see the header); a recorded 0 is $0.
    totalUsd: usd ?? null,
    createdAt,
    updatedAt: text(po.updated_at) ?? createdAt,
    items,
    unreadableLines,
    notes: text(po.notes) ?? null,
  };
}

/** The words the shop's status is shown in. */
export function shopStatusWords(status: string): string {
  return ({ pending: 'pending', confirmed: 'confirmed', sent: 'sent', ordered: 'ordered', received: 'received', cancelled: 'cancelled' } as Record<string, string>)[status] ?? status;
}

/** The order as a ledger purchase, so the same arithmetic reads both. Confirmed: the shop only holds orders that were. */
export function shopOrderAsTransaction(order: ShopOrder): LedgerTransaction {
  return {
    id: `shop-${order.id}`,
    direction: 'purchase',
    counterpartyName: order.vendorName,
    counterpartyId: order.vendorId ?? undefined,
    items: order.items,
    photos: [],
    status: 'confirmed',
    currency: order.currency,
    purchaseOrderId: order.id,
    purchaseOrderSent: order.status === 'sent',
    createdAt: order.createdAt,
    updatedAt: order.updatedAt || order.createdAt,
  };
}

export interface ShopOrderTotals {
  /** What the lines come to in the order's own money, or null when any line has no price (a total with blanks would read cheaper than the order is). */
  own: Array<{ currency: Currency; amount: number }> | null;
  /** The dollars the shop recorded, or null. */
  usd: number | null;
}

export function shopOrderTotals(order: ShopOrder): ShopOrderTotals {
  const complete = order.items.length > 0 && order.items.every((item) => !item.unpriced) && !order.unreadableLines;
  const own = complete ? orderMoney({ items: order.items, currency: order.currency }).parts : null;
  return { own, usd: order.totalUsd };
}

/** Whether a shop order counts as money spent: not cancelled, and past the builder's "pending". */
export const shopOrderIsSpend = (order: ShopOrder) => !['cancelled', 'pending'].includes(order.status);

export type OrderRow =
  | { kind: 'local'; tx: LedgerTransaction; at: number }
  | { kind: 'shop'; order: ShopOrder; at: number };

const time = (iso: string | undefined) => {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
};

/**
 * This device's orders and the shop's, one row per order, newest first. A local
 * order carries the id the shop gave it (`purchaseOrderId`), and that order is
 * ONE row: the local one, which can still be edited or sent.
 */
export function mergeOrders(local: readonly LedgerTransaction[], shop: readonly ShopOrder[]): OrderRow[] {
  const held = new Set(local.map((tx) => tx.purchaseOrderId).filter((id): id is string => !!id));
  const rows: OrderRow[] = [
    ...local.map((tx): OrderRow => ({ kind: 'local', tx, at: time(tx.updatedAt || tx.createdAt) })),
    ...shop.filter((order) => !held.has(order.id)).map((order): OrderRow => ({ kind: 'shop', order, at: time(order.createdAt || order.updatedAt) })),
  ];
  return rows.sort((a, b) => b.at - a.at);
}

/** Whether an order belongs to a vendor: by the vendor's id, else by name in any case. */
export function isVendorOrder(who: { counterpartyId?: string | null; counterpartyName?: string | null }, vendor: { id?: string; name: string }): boolean {
  if (vendor.id && who.counterpartyId && who.counterpartyId === vendor.id) return true;
  return (who.counterpartyName ?? '').trim().toLowerCase() === vendor.name.trim().toLowerCase();
}

/** A vendor's purchase orders, this device's and the shop's, one row per order, newest first. */
export function vendorOrderRows(local: readonly LedgerTransaction[], shop: readonly ShopOrder[], vendor: { id?: string; name: string }): OrderRow[] {
  const mine = local.filter((tx) => tx.direction === 'purchase' && isVendorOrder(tx, vendor));
  const theirs = shop.filter((order) => isVendorOrder({ counterpartyId: order.vendorId, counterpartyName: order.vendorName }, vendor));
  return mergeOrders(mine, theirs);
}

export const SHOP_ORDERS_KEY = ['curate', 'purchase-orders'] as const;

/**
 * The shop's purchase orders: one read, kept for half a minute. `loading` is
 * the first read only; `failed` is a read that did not come back, in which case
 * what is shown is this device's own orders and the screen says so.
 */
export function useShopOrders() {
  const scope = usePrivateQueryScope();
  const query = useQuery({
    queryKey: [...SHOP_ORDERS_KEY, ...scope.key],
    enabled: scope.ready,
    staleTime: 30_000,
    queryFn: async () => (await api.purchaseOrders.list()).map(shopOrderOf),
  });
  const orders = scope.ready ? query.data : undefined;
  return {
    orders: orders ?? [],
    loading: scope.ready && query.isLoading,
    failed: scope.ready && query.isError && !orders,
    retry: () => { void query.refetch(); },
  };
}
