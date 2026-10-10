import { useTeaCompassStore } from '../../../../lib/teaCompassStore';
import { useLedgerStore } from '../../../../lib/ledgerStore';
import { useAppStore } from '../../../../lib/store';
import { hydrateCompassEntries } from '../../../../lib/teaCompassSync';
import { addTeaToDraftOrder } from '../../../../components/CurateV2/orderBuy';
import { orderLinePrice } from '../../../../components/CurateV2/curateV2Model';
import type { TeaCompassEntry } from '../../../../components/CurateV2/types';

// What a sample row can decide, written through Curate's own store so it syncs
// to the server the way every Curate edit does (useCompassSync pushes unsynced
// entries within seconds). Nothing here stores a new kind of fact:
//   rating   -> tasting.quality (1 to 10; five dots are 2, 4, 6, 8, 10). Adrian,
//               2026-10-10: "how much I like it" is the same as the tasting score.
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

/** Dots shown for a tasting score: 1 to 10 becomes 1 to 5, rounding up. */
export function dotsFor(quality: number | null | undefined): number {
  return quality == null ? 0 : Math.max(1, Math.min(5, Math.ceil(Number(quality) / 2)));
}

export async function rateSample(id: string, dots: number): Promise<void> {
  const entry = await ensureLoaded(id);
  if (!entry) throw new Error('This sample could not be loaded. Refresh and try again.');
  const same = dotsFor(entry.tasting?.quality) === dots;
  useTeaCompassStore.getState().updateEntry(id, { tasting: { ...(entry.tasting ?? {}), quality: same ? undefined : dots * 2 } });
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
