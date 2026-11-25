import { describe, expect, it } from 'vitest';
import type { Product } from '../../../types';
import { needLabelFor } from './StockRowEditing';

const tea = (overrides: Partial<Product> = {}): Product => ({
  id: 't', type: 'Oolong', givenName: '', productName: 'Mountain tea', originCountry: 'Taiwan', originRegion: 'Alishan',
  pricePerGramUSD: .4, costPerGramUSD: .1, costAmount: 100, stockGrams: 100, lowStockThreshold: 50,
  description: '', tastingNotes: [], imageUrl: '', status: 'Active', costCurrency: 'USD',
  quantityPurchased: 1000, isPersonal: false, canReorder: true, isPublic: false, shownInShop: false,
  inventoryPurpose: 'working', stockKnownAt: '2026-11-01', ...overrides,
} as Product);

describe('the needs mark beside an unfinished tea', () => {
  it('names the first thing a tea in Needs preparation is missing', () => {
    expect(needLabelFor(tea({ costAmount: null as unknown as number, pricePerGramUSD: null as unknown as number, costPerGramUSD: null as unknown as number }))).toBe('needs a cost');
  });

  it('says nothing for a tea that is published', () => {
    expect(needLabelFor(tea({ description: 'Ready.', isPublic: true, shownInShop: true }))).toBeUndefined();
  });
});
