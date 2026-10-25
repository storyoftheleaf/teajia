import { isoCurrencyCode, rateToUsd, sameCurrency, type RateRow } from '../../lib/currency';
import type { LibraryPurchaseState } from '../../lib/libraryPurchaseState';
import type { TeaCompassEntry } from './types';

export type LibraryInlineField = 'name' | 'year' | 'priceAmount' | 'pricePerUnitGrams';

export function libraryIdentity(entry: TeaCompassEntry) {
  const prefix = entry.name.match(/^((?:18|19|20)\d{2}s?)\s+(.+)$/);
  return {
    name: prefix ? prefix[2] : entry.name,
    year: entry.ageQuoted || (entry.year != null ? String(entry.year) : prefix?.[1]) || '',
    inferredYear: !entry.ageQuoted && entry.year == null ? prefix?.[1] : undefined,
  };
}

export function libraryInlinePatch(entry: TeaCompassEntry, field: LibraryInlineField, raw: string): Partial<TeaCompassEntry> {
  const value = raw.trim();
  const identity = libraryIdentity(entry);
  if (field === 'name') {
    if (!value) throw new Error('Enter a tea name.');
    return { name: value, ...(identity.inferredYear ? { ageQuoted: identity.inferredYear } : {}) };
  }
  if (field === 'year') {
    if (value && !/^(?:18|19|20)\d{2}s?$/.test(value)) throw new Error('Use a year or decade, such as 2008 or 1980s.');
    return { year: value && !value.endsWith('s') ? Number(value) : undefined, ageQuoted: value.endsWith('s') ? value : null, ...(identity.inferredYear ? { name: identity.name } : {}) };
  }
  if (!value) return { [field]: undefined };
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (field === 'pricePerUnitGrams' && number === 0)) {
    throw new Error(field === 'pricePerUnitGrams' ? 'Enter a weight greater than zero.' : 'Enter zero or a positive price.');
  }
  // The original quote currency deliberately never crosses this boundary.
  return { [field]: number };
}

export function libraryCardAmounts(entry: TeaCompassEntry, displayCurrency: string, rates: readonly RateRow[] = []) {
  const currency = displayCurrency === 'source' ? entry.priceCurrency : displayCurrency;
  let quote = entry.priceAmount;
  if (quote != null && !sameCurrency(entry.priceCurrency, currency)) {
    const from = sameCurrency(entry.priceCurrency, 'USD') ? 1 : rateToUsd(rates, entry.priceCurrency);
    const to = sameCurrency(currency, 'USD') ? 1 : rateToUsd(rates, currency);
    quote = from && to ? quote / from * to : undefined;
  }
  const format = (value: number | undefined, perGram = false) => value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('en-US', {
    minimumFractionDigits: perGram || isoCurrencyCode(currency) === 'IDR' ? 0 : 2,
    maximumFractionDigits: perGram ? 4 : isoCurrencyCode(currency) === 'IDR' ? 0 : 2,
  });
  const unit = entry.category === 'teaware' ? quote : quote != null && entry.pricePerUnitGrams && entry.pricePerUnitGrams > 0 ? quote / entry.pricePerUnitGrams : undefined;
  return { quote: format(quote), perGram: format(unit, true), currency: isoCurrencyCode(currency), sourceCurrency: isoCurrencyCode(entry.priceCurrency) };
}

export function libraryChosen(entry: TeaCompassEntry, purchaseState?: LibraryPurchaseState) {
  return entry.decision === 'selected' || ['incoming', 'in_stock', 'depleted'].includes(entry.status)
    || (!!purchaseState && ['ordered', 'partially_received', 'received'].includes(purchaseState.status));
}
