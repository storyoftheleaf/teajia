import type { Product } from '../../../types';
import { INVENTORY_STAGE_LABELS, INVENTORY_STAGE_ORDER, deriveInventoryStage, type IncomingInventorySummary } from '../domain';

// The phone's stock list groups by who the tea was bought from, because that is
// how Adrian looks for it in the field: he knows the supplier before the name.
// Kind and no grouping stay one tap away. Pure, so what a group line says can be
// asked directly rather than read off the component.

export type PhoneGroupBy = 'vendor' | 'type' | 'stage' | 'none';

export const PHONE_GROUP_LABELS: Record<PhoneGroupBy, string> = {
  vendor: 'Supplier',
  type: 'Kind',
  stage: 'Stage',
  none: 'None',
};

export type PhoneStockGroup = {
  key: string;
  label: string;
  products: Product[];
  count: number;
  /** Grams for tea, pieces for teaware, summed as stored. */
  onHand: number;
  /** Stock times selling price, in USD. Teas with no price add nothing. */
  retailValueUsd: number;
  low: number;
  unchecked: number;
};

const NO_SUPPLIER = 'No supplier recorded';
const NO_KIND = 'No kind recorded';

export function isTeaware(product: Product): boolean {
  return product.type === 'Teaware';
}

/** What is on the shelf, in the unit the shelf counts it in. */
export function onHand(product: Product): number {
  return isTeaware(product) ? Number(product.quantityUnits) || 0 : Number(product.stockGrams) || 0;
}

export function sellingPricePerGram(product: Product): number | null {
  const price = product.fixedRetailPriceUSD ?? product.pricePerGramUSD;
  return price == null || !Number.isFinite(price) ? null : price;
}

/** In stock and at or under its own warning line. Empty is sold out, not low. */
export function isLow(product: Product): boolean {
  const qty = onHand(product);
  return qty > 0 && qty <= (Number(product.lowStockThreshold) || 0);
}

/** On the shelf and never physically counted. */
export function isUnchecked(product: Product): boolean {
  return onHand(product) > 0 && !product.stockVerifiedAt;
}

type IncomingMap = Readonly<Record<string, IncomingInventorySummary>>;

function rawLabel(product: Product, by: PhoneGroupBy, incoming?: IncomingMap): string {
  if (by === 'stage') return INVENTORY_STAGE_LABELS[deriveInventoryStage(product, incoming?.[product.id])];
  if (by === 'vendor') return (product.vendor || '').trim().replace(/\s+/g, ' ') || NO_SUPPLIER;
  if (by === 'type') return (product.type || '').trim().replace(/\s+/g, ' ') || NO_KIND;
  return 'All';
}

// "Lidia" and "lidia" are one supplier typed twice, and splitting them hides
// half her teas from the other half. The key ignores case; the label is the
// spelling most of the group's teas use.
function keyFor(product: Product, by: PhoneGroupBy, incoming?: IncomingMap): string {
  return rawLabel(product, by, incoming).toLowerCase();
}

/**
 * Groups keep the order of the list they are given within each group, so the
 * sort the operator chose still holds inside a supplier. Groups themselves run
 * by how many teas they hold, then by name, so the suppliers you buy most from
 * come first; the "nothing recorded" bucket always goes last.
 */
/** Stage runs in the shop's own lifecycle order, the same sections the laptop shows. */
export function groupStock(products: readonly Product[], by: PhoneGroupBy, incoming?: IncomingMap): PhoneStockGroup[] {
  const map = new Map<string, Product[]>();
  for (const product of products) {
    const key = keyFor(product, by, incoming);
    const list = map.get(key);
    if (list) list.push(product);
    else map.set(key, [product]);
  }
  const groups: PhoneStockGroup[] = [...map.entries()].map(([key, list]) => {
    let onHandTotal = 0;
    let value = 0;
    let low = 0;
    let unchecked = 0;
    for (const p of list) {
      const qty = onHand(p);
      onHandTotal += qty;
      const price = sellingPricePerGram(p);
      if (price != null && qty > 0) value += qty * price;
      if (isLow(p)) low += 1;
      if (isUnchecked(p)) unchecked += 1;
    }
    const spellings = new Map<string, number>();
    for (const p of list) { const l = rawLabel(p, by, incoming); spellings.set(l, (spellings.get(l) ?? 0) + 1); }
    const label = [...spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    return { key, label, products: list, count: list.length, onHand: onHandTotal, retailValueUsd: value, low, unchecked };
  });
  const last = new Set([NO_SUPPLIER.toLowerCase(), NO_KIND.toLowerCase()]);
  if (by === 'stage') {
    const rank = (g: PhoneStockGroup) => INVENTORY_STAGE_ORDER.findIndex(st => INVENTORY_STAGE_LABELS[st] === g.label);
    return groups.sort((a, b) => rank(a) - rank(b));
  }
  return groups.sort((a, b) => {
    if (last.has(a.key) !== last.has(b.key)) return last.has(a.key) ? 1 : -1;
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

/** What Adrian usually takes for a tasting: the − on Stock and Samples opens with this typed. */
export const DEFAULT_TASTE_GRAMS = 5;
