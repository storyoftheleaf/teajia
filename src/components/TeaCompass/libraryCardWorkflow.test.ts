import { describe, expect, it } from 'vitest';
import { createEmptyEntry } from './types';
import { libraryCardAmounts, libraryChosen, libraryIdentity, libraryInlinePatch } from './libraryCardWorkflow';
const tea = { ...createEmptyEntry(), name: '1980s Oil-Paper Tea Brick', priceAmount: 500, priceCurrency: 'Yuan' as const, pricePerUnitGrams: 250 };
describe('Library inline workflow', () => {
  it('separates a historical name prefix without losing it on rename', () => {
    expect(libraryIdentity(tea)).toMatchObject({ name: 'Oil-Paper Tea Brick', year: '1980s' });
    expect(libraryInlinePatch(tea, 'name', 'Oil-Paper Brick')).toEqual({ name: 'Oil-Paper Brick', ageQuoted: '1980s' });
    expect(libraryInlinePatch(tea, 'year', '1990s')).toEqual({ year: undefined, ageQuoted: '1990s', name: 'Oil-Paper Tea Brick' });
  });
  it('writes the source quote unchanged even when viewing another currency', () => {
    expect(libraryCardAmounts(tea, 'USD', [{ currency: 'Yuan', rateToUSD: 5 }])).toMatchObject({ quote: '100.00', perGram: '0.4', sourceCurrency: 'CNY' });
    expect(libraryInlinePatch(tea, 'priceAmount', '600')).toEqual({ priceAmount: 600 });
    expect(tea.priceCurrency).toBe('Yuan');
    expect(libraryCardAmounts(tea, 'USD')).toMatchObject({ quote: '—', perGram: '—' });
  });
  it('distinguishes blank from zero and rejects invalid weight', () => {
    expect(libraryInlinePatch(tea, 'priceAmount', '0')).toEqual({ priceAmount: 0 });
    expect(libraryInlinePatch(tea, 'priceAmount', '')).toEqual({ priceAmount: undefined });
    expect(() => libraryInlinePatch(tea, 'pricePerUnitGrams', '0')).toThrow();
    expect(() => libraryInlinePatch(tea, 'priceAmount', '-1')).toThrow();
    expect(() => libraryInlinePatch(tea, 'name', '')).toThrow();
  });
  it('regards ordered WhatsApp tea as chosen without requiring a purchase order', () => {
    expect(libraryChosen({ ...tea, status: 'incoming' })).toBe(true);
    expect(libraryChosen({ ...tea, status: 'noted', decision: 'selected' })).toBe(true);
    expect(libraryChosen({ ...tea, status: 'buying', decision: 'considering' })).toBe(false);
  });
});
