import { canonicalCurrency, isoCurrencyCode, rateToUsd, sameCurrency, type RateRow } from '../../lib/currency';
import type { TeaCompassEntry } from './types';

export type LibraryPriceBasis = 'gram' | '100g' | 'quote';
export interface LibraryPricePreference { currency: string; basis: LibraryPriceBasis }
export const LIBRARY_PRICE_KEY = 'teajia.library.price-display.v1';
export const DEFAULT_LIBRARY_PRICE: LibraryPricePreference = { currency: 'USD', basis: 'gram' };

export function readLibraryPricePreference(): LibraryPricePreference {
  try {
    const saved = JSON.parse(localStorage.getItem(LIBRARY_PRICE_KEY) || 'null');
    if (saved && typeof saved.currency === 'string' && ['gram', '100g', 'quote'].includes(saved.basis)) {
      return { currency: saved.currency === 'source' ? 'source' : canonicalCurrency(saved.currency) || 'USD', basis: saved.basis };
    }
  } catch { /* Browser storage may be disabled. */ }
  return { ...DEFAULT_LIBRARY_PRICE };
}

function money(amount: number, currency: string, precision = 2): string {
  const iso = isoCurrencyCode(currency);
  // Unknown labels must stay attached to their own amount, never become USD.
  if (canonicalCurrency(currency) !== 'UNK' && iso === 'USD' && canonicalCurrency(currency) !== 'USD') {
    return `${currency || 'Currency unrecorded'} ${amount.toFixed(2)}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: iso, currencyDisplay: 'symbol', minimumFractionDigits: 2, maximumFractionDigits: precision }).format(amount);
}

export function libraryQuotePrice(entry: TeaCompassEntry, preference: LibraryPricePreference, rates: readonly RateRow[] = []): { text: string; title: string; converted: boolean } {
  if (entry.priceAmount == null || !Number.isFinite(entry.priceAmount)) return { text: 'Price not recorded', title: 'Source price not recorded', converted: false };
  const source = canonicalCurrency(entry.priceCurrency);
  const sourceLabel = source && source !== 'UNK' ? source : 'Currency unrecorded';
  const quoteUnit = entry.category === 'teaware' ? 'piece' : entry.pricePerUnitGrams && entry.pricePerUnitGrams > 0 ? `${entry.pricePerUnitGrams}g` : 'quote';
  const original = `${money(entry.priceAmount, sourceLabel)}/${quoteUnit}`;
  const target = preference.currency === 'source' ? source : canonicalCurrency(preference.currency);
  let amount = entry.priceAmount;
  if (!source || source === 'UNK' || !target || target === 'UNK') return { text: original, title: 'Source currency not recorded; conversion unavailable', converted: false };
  const converting = !sameCurrency(source, target);
  if (converting) {
    const from = source === 'USD' ? 1 : rateToUsd(rates, source);
    const to = target === 'USD' ? 1 : rateToUsd(rates, target);
    if (from == null || to == null) return { text: original, title: `Source quote: ${original}. Conversion unavailable.`, converted: false };
    amount = amount / from * to;
  }
  let unit = quoteUnit;
  if (entry.category !== 'teaware' && preference.basis !== 'quote') {
    if (!entry.pricePerUnitGrams || entry.pricePerUnitGrams <= 0) return { text: original, title: `Source quote: ${original}. Quoted weight not recorded.`, converted: false };
    const grams = preference.basis === 'gram' ? 1 : 100;
    amount = amount / entry.pricePerUnitGrams * grams;
    unit = grams === 1 ? 'g' : '100g';
  }
  return { text: `${money(amount, target, unit === 'g' ? 4 : 2)}/${unit}`, title: `Source quote: ${original}${converting ? '. Converted using the current shop rate.' : ''}`, converted: converting };
}

export function libraryEntryTransferred(entry: Pick<TeaCompassEntry, 'id' | 'draftProductId'>, linkedEntries: ReadonlyMap<string, unknown>): boolean {
  return Boolean(entry.draftProductId || linkedEntries.has(entry.id));
}
