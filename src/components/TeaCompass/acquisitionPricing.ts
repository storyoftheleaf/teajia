import type { ReceiptAcquisitionKind } from '../../types';
import type { LedgerLineItem } from '../../lib/ledgerStore';
import { DEFAULT_GRAMS, type TeaCompassEntry } from './types';

export function acquisitionUsesUnits(entry: Pick<TeaCompassEntry, 'category' | 'form'>): boolean {
  return entry.category === 'teaware' || ['cake', 'brick', 'tuo'].includes(String(entry.form || '').toLowerCase());
}

/** A quote always carries the quantity its amount buys. Ledger money is per g or per piece. */
export function acquisitionPrice(entry: Pick<TeaCompassEntry, 'priceAmount' | 'pricePerUnitGrams' | 'category' | 'form' | 'buyTotal' | 'buyQuantityGrams' | 'buyQuantityUnits'>): Pick<LedgerLineItem, 'pricePerUnit' | 'priceIsPerGram'> {
  const actual = entry.buyTotal != null;
  const amount = actual ? entry.buyTotal : entry.priceAmount;
  if (amount == null || !Number.isFinite(Number(amount)) || amount < 0) throw new Error('Record the purchase price first. Enter 0 for a free sample.');
  const unitBased = acquisitionUsesUnits(entry);
  const basis = actual ? (unitBased ? entry.buyQuantityUnits : entry.buyQuantityGrams) : unitBased ? 1 : entry.pricePerUnitGrams;
  if (actual && Number(amount) === 0) return { pricePerUnit: 0, priceIsPerGram: !unitBased };
  if (!(Number(basis) > 0)) throw new Error(unitBased ? 'Record how many pieces the purchase total buys.' : 'Record how many grams the quoted price buys.');
  return { pricePerUnit: Number(amount) / Number(basis), priceIsPerGram: !unitBased };
}

export function acquisitionLine(entry: TeaCompassEntry, quantity: number, acquisitionKind?: ReceiptAcquisitionKind): Omit<LedgerLineItem, 'id' | 'addedAt'> {
  const unitBased = acquisitionUsesUnits(entry);
  const form = Object.keys(DEFAULT_GRAMS).find(key => key.toLowerCase() === String(entry.form).toLowerCase()) as keyof typeof DEFAULT_GRAMS | undefined;
  return {
    name: entry.name || 'Unnamed', chineseName: entry.chineseName,
    type: entry.category === 'teaware' ? 'Teaware' : entry.type, form: entry.form, year: entry.year,
    quantityGrams: unitBased ? undefined : quantity, quantityUnits: unitBased ? quantity : undefined,
    unitWeightGrams: unitBased && entry.category !== 'teaware' ? (entry.pricePerUnitGrams || (form ? DEFAULT_GRAMS[form] : undefined)) : undefined,
    ...acquisitionPrice(acquisitionKind === 'free_sample' || acquisitionKind === 'gift'
      ? { ...entry, buyTotal: 0 } : entry), currency: entry.priceCurrency, compassEntryId: entry.id, productId: entry.draftProductId,
  };
}

export function ledgerLineTotal(item: Pick<LedgerLineItem, 'priceIsPerGram' | 'pricePerUnit' | 'quantityGrams' | 'quantityUnits'>): number {
  return item.pricePerUnit * (item.priceIsPerGram ? (item.quantityGrams ?? 0) : (item.quantityUnits ?? 1));
}

/** Incomplete captures can join a draft without becoming a zero-cost purchase. */
export function acquisitionDraftLine(entry: TeaCompassEntry, quantity: number, acquisitionKind?: ReceiptAcquisitionKind): Omit<LedgerLineItem, 'id' | 'addedAt'> {
  try { return acquisitionLine(entry, quantity, acquisitionKind); }
  catch {
    const units = acquisitionUsesUnits(entry);
    return { name: entry.name || 'Unnamed', chineseName: entry.chineseName,
      type: entry.category === 'teaware' ? 'Teaware' : entry.type, form: entry.form, year: entry.year,
      quantityGrams: units ? undefined : quantity, quantityUnits: units ? quantity : undefined,
      unitWeightGrams: units && entry.category !== 'teaware' ? entry.pricePerUnitGrams : undefined,
      pricePerUnit: 0, priceIsPerGram: !units, unpriced: true,
      currency: entry.priceCurrency, compassEntryId: entry.id, productId: entry.draftProductId };
  }
}
