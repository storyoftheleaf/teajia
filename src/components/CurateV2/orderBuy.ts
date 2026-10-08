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
import { useLedgerStore } from '../../lib/ledgerStore';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { DEFAULT_GRAMS, type TeaForm } from './types';
import { orderLinePrice } from './curateV2Model';

export const NO_VENDOR_YET = 'No vendor yet';

export function addTeaToDraftOrder(entryId: string): string | null {
  const compass = useTeaCompassStore.getState();
  const entry = compass.getEntry(entryId);
  if (!entry) return null;
  const ledger = useLedgerStore.getState();

  // Already on a draft order: open that one, add nothing.
  const holding = ledger.transactions.find((tx) =>
    tx.status === 'draft' && tx.direction === 'purchase' && tx.items.some((item) => item.compassEntryId === entryId));

  let txId = holding?.id;
  if (!txId) {
    const vendorName = entry.vendorName?.trim() || NO_VENDOR_YET;
    const currency = (entry.priceCurrency || compass.lastCurrency || 'Yuan') as Currency;
    const draft = ledger.transactions.find((tx) =>
      tx.status === 'draft' && tx.direction === 'purchase'
      && (entry.vendorId ? tx.counterpartyId === entry.vendorId || (!tx.counterpartyId && tx.counterpartyName === vendorName) : tx.counterpartyName === vendorName));
    txId = draft?.id ?? ledger.createTransaction('purchase', vendorName, currency, entry.vendorId);
    const target = useLedgerStore.getState().transactions.find((tx) => tx.id === txId);
    const orderCurrency = (target?.currency ?? currency) as Currency;
    const priced = orderLinePrice(entry);
    // A price per piece is ordered by the piece; a price per gram by the gram.
    const piece = !priced.priceIsPerGram;
    const grams = entry.pricePerUnitGrams && entry.pricePerUnitGrams > 0 ? entry.pricePerUnitGrams : 100;
    useLedgerStore.getState().addLineItem(txId, {
      name: entry.name || 'Unnamed',
      chineseName: entry.chineseName,
      type: entry.category === 'teaware' ? 'Teaware' : entry.type,
      form: entry.form,
      year: entry.year,
      quantityGrams: piece ? undefined : grams,
      quantityUnits: piece ? 1 : undefined,
      unitWeightGrams: piece && entry.form && entry.category !== 'teaware' ? DEFAULT_GRAMS[entry.form as TeaForm] : undefined,
      ...priced,
      currency: (entry.priceCurrency || orderCurrency) as Currency,
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
