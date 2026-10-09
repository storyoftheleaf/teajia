/**
 * Buy on a tea: it goes onto the open DRAFT order for its vendor (one draft per
 * vendor, a new one when there is none), the tea is marked Selected and is now
 * being ordered. Returns the order's id so the screen can open it.
 *
 * A tea without a vendor goes on the draft for "No vendor yet". A tea that is
 * already on a draft is never added twice: that draft is the one that opens.
 * Quantity is one piece for a price quoted per piece (a cake, brick, tuo, teaware);
 * for a loose tea priced per weight it is the grams the price was quoted for (a
 * jin is 500 g).
 */
import type { Currency } from '../../admin/types';
import { canonicalCurrency } from '../../lib/currency';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { DEFAULT_GRAMS, type TeaForm } from './types';
import { orderLinePrice, pieceWeightGrams } from './curateV2Model';

export const NO_VENDOR_YET = 'No vendor yet';

/** Two spellings of one money ("Yuan", "CNY") are the same money. */
export const sameMoney = (a: string | undefined, b: string | undefined) => (canonicalCurrency(a) ?? a) === (canonicalCurrency(b) ?? b);

/**
 * The open draft for a vendor IN ONE CURRENCY, or a new one. An order has a
 * single currency (its total, its freight and its purchase order are all
 * written in it), so a tea priced in another money opens its own draft for the
 * same vendor instead of being added up into this one as if it were the same
 * money. A tea with no price yet has no money of its own and joins whichever
 * draft the vendor has.
 */
export function draftOrderFor(vendor: { name: string; id?: string }, currency: Currency | undefined, fallback: Currency): string {
  const ledger = useLedgerStore.getState();
  const name = vendor.name.trim() || NO_VENDOR_YET;
  const drafts = ledger.transactions.filter((tx) =>
    tx.status === 'draft' && tx.direction === 'purchase'
    && (vendor.id ? tx.counterpartyId === vendor.id || (!tx.counterpartyId && tx.counterpartyName === name) : tx.counterpartyName === name));
  const draft = currency ? drafts.find((tx) => sameMoney(tx.currency, currency)) : drafts[0];
  return draft?.id ?? ledger.createTransaction('purchase', name, currency ?? fallback, vendor.id);
}

/** What a line carries for a tea: its price in the ORDER's money, or a marked blank. */
export function orderLineMoney(entry: Parameters<typeof orderLinePrice>[0], orderCurrency: Currency) {
  const priced = entry.priceAmount != null;
  return { ...orderLinePrice(entry), currency: orderCurrency, ...(priced ? {} : { unpriced: true as const }) };
}

export function addTeaToDraftOrder(entryId: string): string | null {
  const compass = useTeaCompassStore.getState();
  const entry = compass.getEntry(entryId);
  if (!entry) return null;
  const ledger = useLedgerStore.getState();
  const priced = entry.priceAmount != null;
  const tableMoney = (compass.lastCurrency || 'Yuan') as Currency;
  const ownMoney = priced ? ((entry.priceCurrency || tableMoney) as Currency) : undefined;

  // Already on a draft order: open that one, add nothing. The one exception is
  // a line that was added before the tea had a price: it takes the price now,
  // so the order is not confirmed with a blank that has since been filled in.
  let holding = ledger.transactions.find((tx) =>
    tx.status === 'draft' && tx.direction === 'purchase' && tx.items.some((item) => item.compassEntryId === entryId));
  const heldLine = holding?.items.find((item) => item.compassEntryId === entryId);
  if (holding && heldLine?.unpriced && priced) {
    if (sameMoney(holding.currency, ownMoney)) {
      ledger.updateLineItem(holding.id, heldLine.id, { ...orderLinePrice(entry), currency: holding.currency, unpriced: undefined });
    } else {
      ledger.removeLineItem(holding.id, heldLine.id);
      holding = undefined;
    }
  }

  let txId = holding?.id;
  if (!txId) {
    txId = draftOrderFor({ name: entry.vendorName ?? '', id: entry.vendorId }, ownMoney, tableMoney);
    const target = useLedgerStore.getState().transactions.find((tx) => tx.id === txId);
    const orderCurrency = (target?.currency ?? ownMoney ?? tableMoney) as Currency;
    // A price per piece is ordered by the piece; a price per gram by the gram.
    const piece = !orderLinePrice(entry).priceIsPerGram;
    const grams = entry.pricePerUnitGrams && entry.pricePerUnitGrams > 0 ? entry.pricePerUnitGrams : 100;
    useLedgerStore.getState().addLineItem(txId, {
      name: entry.name || 'Unnamed',
      chineseName: entry.chineseName,
      type: entry.category === 'teaware' ? 'Teaware' : entry.type,
      form: entry.form,
      year: entry.year,
      quantityGrams: piece ? undefined : grams,
      quantityUnits: piece ? 1 : undefined,
      unitWeightGrams: piece && entry.form && entry.category !== 'teaware' ? (pieceWeightGrams(entry) ?? DEFAULT_GRAMS[entry.form as TeaForm]) : undefined,
      ...orderLineMoney(entry, orderCurrency),
      compassEntryId: entry.id,
    });
  }
  useLedgerStore.getState().setActiveTransaction(txId);

  // Selected, and now being ordered: it shows under "On the way" as ordering.
  const patch: Record<string, unknown> = { decision: 'selected' };
  if (entry.status !== 'in_stock' && entry.status !== 'incoming') patch.status = 'buying';
  compass.updateEntry(entryId, patch);
  return txId;
}

/**
 * A tea that is no longer being bought: it stops being "Selected" and stops
 * being "ordering". Without this, a tea taken off its order is neither on the
 * order, nor waiting to be decided, nor on the way: it falls off Today.
 * Does nothing to a tea whose order is confirmed.
 */
export function releaseTeaFromOrder(entryId: string): void {
  const compass = useTeaCompassStore.getState();
  const entry = compass.getEntry(entryId);
  if (!entry) return;
  const stillOnDraft = useLedgerStore.getState().transactions.some((tx) =>
    tx.status === 'draft' && tx.direction === 'purchase' && tx.items.some((item) => item.compassEntryId === entryId));
  if (stillOnDraft) return;
  const patch: Record<string, unknown> = {};
  if (entry.status === 'buying') patch.status = 'noted';
  if (entry.decision === 'selected') patch.decision = null;
  if (Object.keys(patch).length) compass.updateEntry(entryId, patch);
}

/** Pass or Sample after Buy: the tea comes off its draft order (an order left empty goes too). */
export function removeTeaFromDraftOrders(entryId: string): void {
  const ledger = useLedgerStore.getState();
  for (const tx of ledger.transactions) {
    if (tx.status !== 'draft' || tx.direction !== 'purchase') continue;
    const held = tx.items.filter((item) => item.compassEntryId === entryId);
    if (held.length === 0) continue;
    for (const item of held) ledger.removeLineItem(tx.id, item.id);
    if (held.length === tx.items.length) ledger.removeTransaction(tx.id);
  }
  releaseTeaFromOrder(entryId);
}
