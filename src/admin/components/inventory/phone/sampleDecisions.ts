import { useTeaCompassStore } from '../../../../lib/teaCompassStore';
import { useLedgerStore } from '../../../../lib/ledgerStore';
import { useAppStore } from '../../../../lib/store';
import { hydrateCompassEntries } from '../../../../lib/teaCompassSync';
import { addTeaToDraftOrder } from '../../../../components/CurateV2/orderBuy';
import { orderLinePrice } from '../../../../components/CurateV2/curateV2Model';
import { createEmptyEntry, type TeaCompassEntry } from '../../../../components/CurateV2/types';
import type { Currency, Product } from '../../../types';

// What a sample row can decide, written through Curate's own store so it syncs
// to the server the way every Curate edit does (useCompassSync pushes unsynced
// entries within seconds). Nothing here stores a new kind of fact:
//   rating   -> tasting.quality, 1 to 10, the tasting score's own steps (Adrian,
//               2026-10-10: "how much I like it" is the same as the tasting score;
//               2026-10-11: same scale, same number of steps).
//   reject   -> decision 'passed_on'; restore clears it.
//   cost     -> priceAmount for pricePerUnitGrams, the quote as entered.
//   want     -> Curate's Buy (addTeaToDraftOrder), then the amount he typed.
// Plan: todo/plans/samples-to-orders.md (build 1).

/** The live Curate entry for a sample, or null while the store has not loaded it. */
export function useLiveEntry(id: string): TeaCompassEntry | null {
  return useTeaCompassStore((s) => s.entries.find((e) => e.id === id) ?? null);
}

async function ensureLoaded(id: string): Promise<TeaCompassEntry | null> {
  const found = useTeaCompassStore.getState().getEntry(id);
  if (found) return found;
  await hydrateCompassEntries(useAppStore.getState().activeAccountId ?? undefined);
  return useTeaCompassStore.getState().getEntry(id) ?? null;
}

/** Sets the tasting score, 1 to 10. Null clears it: not rated is not a score of zero. */
export async function rateSample(id: string, quality: number | null): Promise<void> {
  if (quality != null && !(Number.isInteger(quality) && quality >= 1 && quality <= 10)) throw new Error('A score is a whole number from 1 to 10.');
  const entry = await ensureLoaded(id);
  if (!entry) throw new Error('This sample could not be loaded. Refresh and try again.');
  useTeaCompassStore.getState().updateEntry(id, { tasting: { ...(entry.tasting ?? {}), quality: quality ?? undefined } });
}

/**
 * The Curate record for a shelf product bought to sample, made the first time
 * it is rated, rejected or wanted, and linked both ways (the record names the
 * product, which is how Curate already knows a tea reached the shelf). It is
 * made through Curate's own store, so it syncs like any Curate edit. Nothing is
 * made just by looking at a row. What it cost and in what money are copied as
 * the product records them; a cost nobody recorded stays unknown.
 */
export async function linkProductToCurate(product: Product): Promise<string> {
  const store = useTeaCompassStore.getState();
  const known = product.sourceCompassEntryId ?? store.entries.find((e) => e.draftProductId === product.id)?.id;
  if (known) return known;
  const currency = product.costCurrency && product.costCurrency !== 'UNK' ? (product.costCurrency as Currency) : undefined;
  const base = createEmptyEntry('tea', { vendorName: product.vendor, vendorId: product.vendorId, priceCurrency: currency });
  const year = Number(product.year);
  const entry: TeaCompassEntry = {
    ...base,
    name: product.productName || product.givenName || '',
    shopName: product.givenName || null,
    chineseName: product.chineseName,
    type: (product.type || undefined) as TeaCompassEntry['type'],
    form: (product.form || undefined) as TeaCompassEntry['form'],
    year: Number.isFinite(year) && year > 0 ? year : undefined,
    priceAmount: product.costAmount == null ? undefined : Number(product.costAmount),
    pricePerUnitGrams: product.quantityPurchased ? Number(product.quantityPurchased) : undefined,
    sampleState: 'received',
    draftProductId: product.id,
    touchedFields: currency ? ['priceCurrency', 'priceAmount'] : ['priceAmount'],
  } as TeaCompassEntry;
  store.addEntry(entry);
  return entry.id;
}

export async function setSampleRejected(id: string, rejected: boolean): Promise<void> {
  const entry = await ensureLoaded(id);
  if (!entry) throw new Error('This sample could not be loaded. Refresh and try again.');
  useTeaCompassStore.getState().updateEntry(id, { decision: rejected ? 'passed_on' : null });
}

/** Sets the quote. An empty field is unknown, a typed 0 is free: never one for the other. */
export async function setSampleQuote(id: string, field: 'amount' | 'grams', text: string): Promise<void> {
  const entry = await ensureLoaded(id);
  if (!entry) throw new Error('This sample could not be loaded. Refresh and try again.');
  const t = text.trim();
  const n = t === '' ? undefined : Number(t);
  if (n !== undefined && (!Number.isFinite(n) || n < 0)) throw new Error('Enter a number, or leave it empty.');
  useTeaCompassStore.getState().updateEntry(id, field === 'amount' ? { priceAmount: n } : { pricePerUnitGrams: n });
}

/** True when the quote is per piece (a cake, a brick), so Want asks for pieces, not grams. */
export function wantsPieces(entry: Pick<TeaCompassEntry, 'priceAmount' | 'pricePerUnitGrams' | 'form' | 'category'>): boolean {
  return !orderLinePrice(entry).priceIsPerGram;
}

/** Puts the sample on its supplier's draft order with the amount asked for. */
export async function wantSample(id: string, amount: number): Promise<void> {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Say how much you want.');
  const entry = await ensureLoaded(id);
  if (!entry) throw new Error('This sample could not be loaded. Refresh and try again.');
  const txId = addTeaToDraftOrder(id);
  if (!txId) throw new Error('This sample could not be added to an order.');
  const ledger = useLedgerStore.getState();
  const line = ledger.transactions.find((tx) => tx.id === txId)?.items.find((item) => item.compassEntryId === id);
  if (line) ledger.updateLineItem(txId, line.id, wantsPieces(entry) ? { quantityUnits: amount } : { quantityGrams: amount });
}

/** The draft-order amount already wanted, for showing "In order · 2 cakes". */
export function wantedAmount(id: string): { amount: number; unit: 'pc' | 'g' } | null {
  for (const tx of useLedgerStore.getState().transactions) {
    if (tx.status !== 'draft' || tx.direction !== 'purchase') continue;
    const line = tx.items.find((item) => item.compassEntryId === id);
    if (line) return line.quantityUnits != null ? { amount: Number(line.quantityUnits), unit: 'pc' } : { amount: Number(line.quantityGrams ?? 0), unit: 'g' };
  }
  return null;
}

/** Any change to a Curate tea from a Stock row (its name, house name or quote), through Curate's store. */
export async function updateCurateTea(id: string, patch: Partial<TeaCompassEntry>): Promise<void> {
  const entry = await ensureLoaded(id);
  if (!entry) throw new Error('This sample could not be loaded. Refresh and try again.');
  useTeaCompassStore.getState().updateEntry(id, patch);
}
