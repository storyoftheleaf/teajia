/**
 * Placing a draft purchase: the one path every screen that buys uses, Curate's
 * order screen and the buying basket on Stock alike. Two doors to one purchase
 * order would be two ways of recording the same money, which is how this shop
 * once had four freight rates at once.
 *
 *   confirmPurchase   the draft becomes a confirmed order here, and its teas
 *                     wait under "On the way" (status incoming).
 *   recordPurchase    the shop's books: one purchase order (in dollars, only
 *                     when every line has a price) and one receipt waiting per
 *                     tea, so accepting it on arrival shelves the tea with its
 *                     cost. Safe to call again: it reuses the order it made.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { ExchangeRate } from '../../admin/types';
import { api } from '../../lib/api';
import { useLedgerStore, type LedgerTransaction } from '../../lib/ledgerStore';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { purchaseSpendInUsd } from './curatePricing';
import { SHOP_ORDERS_KEY } from './shopOrders';
import { arrivalFields, arrivalKey, orderArrivalLines } from './orderArrivals';
import { AGENT_KEYS } from './AgentInbox';
import { NO_VENDOR_YET } from './orderBuy';

/**
 * One order per supplier per route: a parcel and its tracking number belong to
 * one order. A draft holding air and boat lines becomes two drafts before it is
 * placed; Both travels with the air order (its line says Both, so the supplier
 * message can say so). Returns the drafts to place, each with its route.
 */
export function splitDraftByRoute(txId: string): LedgerTransaction[] {
  const ledger = useLedgerStore.getState();
  const tx = ledger.getTransaction(txId);
  if (!tx) return [];
  const byBoat = tx.items.filter((item) => item.shipBy === 'boat');
  const byAir = tx.items.filter((item) => item.shipBy !== 'boat');
  if (byBoat.length === 0 || byAir.length === 0) {
    ledger.updateTransaction(tx.id, { shipMode: byBoat.length ? 'sea' : 'air' });
    return [useLedgerStore.getState().getTransaction(tx.id)!];
  }
  const boatId = ledger.createTransaction('purchase', tx.counterpartyName, tx.currency, tx.counterpartyId);
  for (const item of byBoat) {
    const { id: _id, addedAt: _at, ...line } = item;
    useLedgerStore.getState().addLineItem(boatId, line);
    useLedgerStore.getState().removeLineItem(tx.id, item.id);
  }
  useLedgerStore.getState().updateTransaction(tx.id, { shipMode: 'air' });
  useLedgerStore.getState().updateTransaction(boatId, { shipMode: 'sea' });
  const after = useLedgerStore.getState();
  return [after.getTransaction(tx.id)!, after.getTransaction(boatId)!];
}

/** An order for "No vendor yet" cannot be placed: someone has to be named first. */
export function purchaseNeedsVendor(tx: Pick<LedgerTransaction, 'direction' | 'counterpartyId' | 'counterpartyName'>): boolean {
  const name = tx.counterpartyName?.trim() ?? '';
  // ("Unknown Vendor" is the older placeholder, left on drafts made before this one.)
  return tx.direction === 'purchase' && !tx.counterpartyId && (!name || name === NO_VENDOR_YET || /^unknown vendor$/i.test(name));
}

export function confirmPurchase(tx: LedgerTransaction): void {
  useLedgerStore.getState().confirmTransaction(tx.id);
  const compass = useTeaCompassStore.getState();
  for (const item of tx.items) {
    const e = item.compassEntryId ? compass.getEntry(item.compassEntryId) : undefined;
    if (e && e.status !== 'in_stock') compass.updateEntry(e.id, { status: 'incoming' });
  }
}

/** Throws when the shop could not record it; the caller marks the order and offers it again. */
export async function recordPurchase(tx: LedgerTransaction, rates: readonly ExchangeRate[] | undefined, queryClient: QueryClient): Promise<void> {
  const ledger = useLedgerStore.getState();
  // total_usd is dollars: the order's own money is converted at the shop's
  // rates, and left out when a currency has no rate (never read at 1, which
  // would store ¥2,400 as $2,400). A total is only written when every line has
  // a price: a total with blanks counted as zero records the order cheaper.
  const complete = tx.items.length > 0 && tx.items.every((item) => !item.unpriced);
  const totalAmount = complete ? purchaseSpendInUsd([tx], rates ?? []).priced[0]?.usd : undefined;
  // Recorded once: a retry after a failed receipt picks the same order up.
  let purchaseOrderId = tx.purchaseOrderId;
  if (!purchaseOrderId) {
    const created = await api.purchaseOrders.create({
      po_number: `PO-${tx.id.slice(0, 8).toUpperCase()}`,
      vendor_name: tx.counterpartyName || 'Unknown',
      vendor_id: tx.counterpartyId || undefined,
      items_json: JSON.stringify(tx.items.map(item => ({
        name: item.name,
        chineseName: item.chineseName,
        type: item.type,
        form: item.form,
        year: item.year,
        quantity: item.priceIsPerGram ? (item.quantityGrams ?? 0) : (item.quantityUnits ?? 1),
        // No price yet is no price, not a price of nothing.
        pricePerUnit: item.unpriced ? null : item.pricePerUnit,
        priceIsPerGram: item.priceIsPerGram,
        currency: item.currency,
        ...(item.shipBy ? { shipBy: item.shipBy } : {}),
        // What the shop reads back when the tea arrives, so it comes in with
        // its cost (see orderArrivals.ts).
        ...arrivalFields(item),
      }))),
      total_usd: totalAmount === undefined ? undefined : Math.round(totalAmount * 100) / 100,
      display_currency: tx.currency,
      status: 'confirmed',
      ...(tx.shipMode ? { ship_mode: tx.shipMode } : {}),
    });
    purchaseOrderId = created?.id;
    // Kept so "Mark as sent" can name the order the shop recorded.
    if (purchaseOrderId) ledger.updateTransaction(tx.id, { purchaseOrderId });
    // The shop's list of orders was read before this one existed.
    void queryClient.invalidateQueries({ queryKey: SHOP_ORDERS_KEY });
  }
  // One receipt waiting per tea: accepting it on arrival puts the tea on the
  // shelf's books with what it cost and what came. The same key answers with
  // the same receipt, so trying again adds nothing.
  if (purchaseOrderId) {
    try {
      for (const line of orderArrivalLines(tx)) {
        await api.compass.proposeReceipt(line.entryId, {
          purpose: 'working',
          quantity: line.grams,
          unit: 'g',
          acquisition_kind: 'purchase',
          idempotency_key: arrivalKey(purchaseOrderId, line.entryId),
          product_name: line.name,
          ...(line.type ? { product_type: line.type } : {}),
        });
      }
    } finally {
      // Today's list of receipts was read before these existed. Left as it was,
      // "Arrived" on a tea just ordered would not find its receipt and would
      // shelve the tea with no cost.
      void queryClient.invalidateQueries({ queryKey: AGENT_KEYS.arriving });
    }
  }
  ledger.updateTransaction(tx.id, { recordFailed: false });
}
