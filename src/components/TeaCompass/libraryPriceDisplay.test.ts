import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEmptyEntry } from './types';
import { DEFAULT_LIBRARY_PRICE, LIBRARY_PRICE_KEY, libraryEntryTransferred, libraryQuotePrice, readLibraryPricePreference } from './libraryPriceDisplay';

const quote = { ...createEmptyEntry(), priceAmount: 70, priceCurrency: 'Yuan' as const, pricePerUnitGrams: 100 };
const rates = [{ currency: 'Yuan', rateToUSD: 7 }, { currency: 'NT', rateToUSD: 30 }];
afterEach(() => vi.unstubAllGlobals());

describe('Library source price display', () => {
  it('defaults to USD per gram and converts aliases through the live rate table', () => {
    expect(DEFAULT_LIBRARY_PRICE).toEqual({ currency: 'USD', basis: 'gram' });
    expect(libraryQuotePrice(quote, DEFAULT_LIBRARY_PRICE, rates).text).toBe('$0.10/g');
    expect(libraryQuotePrice({ ...quote, priceCurrency: 'CNY' as any }, { currency: 'TWD', basis: '100g' }, rates).text).toBe('NT$300.00/100g');
  });
  it('keeps a small nonzero gram price distinct from a free tea', () => {
    expect(libraryQuotePrice({ ...quote, priceAmount: 0.7 }, DEFAULT_LIBRARY_PRICE, rates).text).toBe('$0.001/g');
  });
  it('leaves source quote data unchanged and converts quoted quantities without normalizing weight', () => {
    const original = { ...quote };
    expect(libraryQuotePrice(quote, { currency: 'USD', basis: 'quote' }, rates).text).toBe('$10.00/100g');
    expect(quote).toEqual(original);
  });
  it('honors explicit zero and keeps missing money distinct', () => {
    expect(libraryQuotePrice({ ...quote, priceAmount: 0 }, DEFAULT_LIBRARY_PRICE, rates).text).toBe('$0.00/g');
    expect(libraryQuotePrice({ ...quote, priceAmount: undefined }, DEFAULT_LIBRARY_PRICE, rates).text).toBe('Price not recorded');
  });
  it('shows the original currency and quantity when a source or destination rate is absent', () => {
    const source = libraryQuotePrice(quote, DEFAULT_LIBRARY_PRICE, []);
    expect(source.text).toBe('CN¥70.00/100g');
    expect(source.title).toContain('Conversion unavailable');
    expect(source.converted).toBe(false);
    expect(libraryQuotePrice(quote, { currency: 'NT', basis: 'gram' }, rates.slice(0, 1)).text).toBe(source.text);
  });
  it('refuses to invent quoted weights, currencies, and free prices', () => {
    expect(libraryQuotePrice({ ...quote, pricePerUnitGrams: undefined }, DEFAULT_LIBRARY_PRICE, rates).text).toBe('CN¥70.00/quote');
    expect(libraryQuotePrice({ ...quote, priceCurrency: 'UNK' }, DEFAULT_LIBRARY_PRICE, rates).text).toBe('Currency unrecorded 70.00/100g');
    expect(libraryQuotePrice({ ...quote, priceCurrency: 'unknown' as any }, DEFAULT_LIBRARY_PRICE, rates).text).toBe('UNKNOWN 70.00/100g');
  });
  it('keeps teaware pricing per piece under every display basis', () => {
    expect(libraryQuotePrice({ ...quote, category: 'teaware' }, DEFAULT_LIBRARY_PRICE, rates).text).toBe('$10.00/piece');
  });
  it('uses changing rates rather than a copied conversion', () => {
    expect(libraryQuotePrice(quote, DEFAULT_LIBRARY_PRICE, [{ currency: 'Yuan', rateToUSD: 14 }]).text).toBe('$0.05/g');
  });
});

describe('Library browser display preference', () => {
  it('recovers the remembered currency and quantity basis', () => {
    const getItem = vi.fn(() => JSON.stringify({ currency: 'CNY', basis: '100g' }));
    vi.stubGlobal('localStorage', { getItem });
    expect(readLibraryPricePreference()).toEqual({ currency: 'Yuan', basis: '100g' });
    expect(getItem).toHaveBeenCalledWith(LIBRARY_PRICE_KEY);
  });
  it('handles unavailable or corrupt browser storage', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('disabled'); } });
    expect(readLibraryPricePreference()).toEqual(DEFAULT_LIBRARY_PRICE);
    vi.stubGlobal('localStorage', { getItem: () => '{bad' });
    expect(readLibraryPricePreference()).toEqual(DEFAULT_LIBRARY_PRICE);
  });
});

describe('Library transfer evidence', () => {
  it('moves only records with durable inventory linkage, independent of receipt or source status', () => {
    expect(libraryEntryTransferred(quote, new Map())).toBe(false);
    expect(libraryEntryTransferred({ ...quote, draftProductId: 'product' }, new Map())).toBe(true);
    expect(libraryEntryTransferred(quote, new Map([[quote.id, 'sample']]))).toBe(true);
  });
});
