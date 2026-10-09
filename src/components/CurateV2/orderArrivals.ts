/**
 * What a confirmed purchase tells the shop about each tea on it, so the tea
 * arrives with its cost.
 *
 * Promoting a tea to the shelf never carries a price: a quote is a unit price,
 * not what was paid for the batch, so the shop's promote writes the cost as
 * unknown. The only door that fills it is a receipt proposal keyed
 * `order:<purchase order id>:<tea id>`, accepted when the tea arrives, against
 * a purchase order whose line for that tea names its grams, its total and its
 * money. Until this existed Curate wrote the order without any of those three
 * and never proposed a receipt, so a tea bought at the table reached the shelf
 * with no cost, no stock and no currency, which prices as nothing.
 */
import type { LedgerLineItem, LedgerTransaction } from '../../lib/ledgerStore';
import { ledgerItemAmount } from './curatePricing';

export interface ArrivalLine {
  entryId: string;
  name: string;
  type?: string;
  /** What was bought, in grams: the receipt is accepted for exactly this. */
  grams: number;
  /** What the batch cost, in the order's own money, to the cent. */
  total: number;
  currency: string;
}

/** The grams a line stands for, or null when they are not known. */
export function lineGrams(item: LedgerLineItem): number | null {
  const grams = item.priceIsPerGram
    ? item.quantityGrams
    : item.quantityUnits != null && item.unitWeightGrams != null ? item.quantityUnits * item.unitWeightGrams : undefined;
  return typeof grams === 'number' && Number.isFinite(grams) && grams > 0 ? Math.round(grams * 100) / 100 : null;
}

/**
 * The lines of an order that can arrive with a cost: a tea (teaware is counted
 * in pieces, and the shop prices it per piece), priced, with a known weight.
 * Any other line is still ordered; it simply arrives without a cost, as before,
 * rather than with an invented one.
 */
export function orderArrivalLines(tx: Pick<LedgerTransaction, 'items'>): ArrivalLine[] {
  const lines: ArrivalLine[] = [];
  for (const item of tx.items) {
    if (!item.compassEntryId || item.unpriced || item.type === 'Teaware') continue;
    const grams = lineGrams(item);
    if (grams == null || !item.currency) continue;
    lines.push({
      entryId: item.compassEntryId,
      name: item.name || 'Unnamed',
      type: item.type,
      grams,
      total: Math.round(ledgerItemAmount(item) * 100) / 100,
      currency: item.currency,
    });
  }
  return lines;
}

/** The purchase order's line for a tea: what the shop reads back when the tea arrives. */
export function arrivalFields(item: LedgerLineItem): { compass_entry_id?: string; quantity_grams?: number; line_total?: number } {
  const line = item.compassEntryId ? orderArrivalLines({ items: [item] })[0] : undefined;
  return {
    ...(item.compassEntryId ? { compass_entry_id: item.compassEntryId } : {}),
    ...(line ? { quantity_grams: line.grams, line_total: line.total } : {}),
  };
}

/** The key that ties a receipt to its order line. The shop reads the order id and tea id back out of it. */
export const arrivalKey = (purchaseOrderId: string, entryId: string) => `order:${purchaseOrderId}:${entryId}`;
