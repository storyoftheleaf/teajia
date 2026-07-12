import { describe, expect, it } from 'vitest';

import type { Product } from '../../types';
import {
  MOVEMENT_REASON_LABELS,
  effectivePurpose,
  getEffectivePublication,
  getTeaReadiness,
  isMovementDirectionValid,
  legacyPurposeConflict,
} from './domain';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'tea-1',
  type: 'Red',
  givenName: 'Ruby 18',
  productName: 'Ruby 18',
  originCountry: 'Taiwan',
  originRegion: 'Sun Moon Lake',
  pricePerGramUSD: 0.42,
  costPerGramUSD: 0.12,
  costAmount: 120,
  stockGrams: 0,
  lowStockThreshold: 50,
  description: 'A structured Taiwanese red tea.',
  tastingNotes: [],
  imageUrl: '',
  status: 'Active',
  costCurrency: 'USD',
  quantityPurchased: 1000,
  isPersonal: false,
  canReorder: true,
  isPublic: false,
  shownInShop: false,
  inventoryPurpose: 'working',
  stockKnownAt: '2026-07-12T00:00:00.000Z',
  ...overrides,
});

describe('effectivePurpose', () => {
  it('prefers a canonical purpose over contradictory legacy flags', () => {
    expect(effectivePurpose(product({ inventoryPurpose: 'personal', isSample: true }))).toBe('personal');
  });

  it('maps legacy sample and personal flags while defaulting ordinary stock to working', () => {
    expect(effectivePurpose(product({ inventoryPurpose: null, isSample: true }))).toBe('sample');
    expect(effectivePurpose(product({ inventoryPurpose: null, isPersonal: true }))).toBe('personal');
    expect(effectivePurpose(product({ inventoryPurpose: null }))).toBe('working');
  });

  it('uses sample as the deterministic legacy fallback when both old flags conflict', () => {
    expect(effectivePurpose(product({ inventoryPurpose: null, isSample: true, isPersonal: true }))).toBe('sample');
    expect(legacyPurposeConflict(product({ inventoryPurpose: null, isSample: true, isPersonal: true }))).toBe(true);
  });

  it('reports canonical-to-legacy disagreement during migration', () => {
    expect(legacyPurposeConflict(product({ inventoryPurpose: 'working', isSample: true }))).toBe(true);
    expect(legacyPurposeConflict(product({ inventoryPurpose: 'sample', isSample: true }))).toBe(false);
  });
});

describe('getTeaReadiness', () => {
  it('is not applicable to teaware or non-working holdings', () => {
    expect(getTeaReadiness(product({ type: 'Teaware' }))).toEqual({ state: 'not_applicable', missing: [] });
    expect(getTeaReadiness(product({ inventoryPurpose: 'sample' }))).toEqual({ state: 'not_applicable', missing: [] });
    expect(getTeaReadiness(product({ inventoryPurpose: 'personal' }))).toEqual({ state: 'not_applicable', missing: [] });
  });

  it('names every exact missing development requirement in display order', () => {
    expect(getTeaReadiness(product({
      description: '  ',
      fixedRetailPriceUSD: 0,
      pricePerGramUSD: 0,
      type: 'Misc',
      stockKnownAt: null,
    }))).toEqual({
      state: 'not_ready',
      missing: ['description', 'retail_price', 'classification', 'stock_amount'],
    });
  });

  it('accepts a positive fixed or calculated effective retail price', () => {
    expect(getTeaReadiness(product({ fixedRetailPriceUSD: 0.5, pricePerGramUSD: 0 }))).toEqual({ state: 'ready', missing: [] });
    expect(getTeaReadiness(product({ fixedRetailPriceUSD: null, pricePerGramUSD: 0.5 }))).toEqual({ state: 'ready', missing: [] });
  });

  it('treats known zero stock as ready and unknown positive stock as incomplete', () => {
    expect(getTeaReadiness(product({ stockGrams: 0 }))).toEqual({ state: 'ready', missing: [] });
    expect(getTeaReadiness(product({ stockGrams: 50, stockKnownAt: null }))).toEqual({
      state: 'not_ready',
      missing: ['stock_amount'],
    });
  });

  it('rejects non-finite stock even when the quantity has a known-at timestamp', () => {
    expect(getTeaReadiness(product({ stockGrams: Number.NaN })).missing).toContain('stock_amount');
    expect(getTeaReadiness(product({ stockGrams: Number.POSITIVE_INFINITY })).missing).toContain('stock_amount');
  });
});

describe('publication', () => {
  it('requires both existing publication gates', () => {
    expect(getEffectivePublication(product({ isPublic: true, shownInShop: true }))).toEqual({
      state: 'published', operatorGate: true, locationGate: true,
    });
    expect(getEffectivePublication(product({ isPublic: true, shownInShop: false }))).toEqual({
      state: 'hidden', operatorGate: true, locationGate: false,
    });
  });

  it('allows a ready working tea to remain deliberately hidden', () => {
    const hiddenReady = product({ isPublic: false, shownInShop: true });
    expect(getTeaReadiness(hiddenReady).state).toBe('ready');
    expect(getEffectivePublication(hiddenReady).state).toBe('hidden');
  });
});

describe('movement reasons', () => {
  it('provides concise labels for every supported physical movement', () => {
    expect(MOVEMENT_REASON_LABELS).toEqual({
      receipt: 'Receipt', sale: 'Sale', sample_use: 'Sample use', gift: 'Gift',
      waste: 'Waste', transfer: 'Transfer', recount: 'Recount / correction', return: 'Return',
    });
  });

  it('validates the balance direction implied by each reason', () => {
    expect(isMovementDirectionValid('receipt', 'increase')).toBe(true);
    expect(isMovementDirectionValid('return', 'increase')).toBe(true);
    expect(isMovementDirectionValid('sale', 'decrease')).toBe(true);
    expect(isMovementDirectionValid('sample_use', 'increase')).toBe(false);
    expect(isMovementDirectionValid('recount', 'set')).toBe(true);
    expect(isMovementDirectionValid('transfer', 'increase')).toBe(true);
    expect(isMovementDirectionValid('transfer', 'decrease')).toBe(true);
    expect(isMovementDirectionValid('receipt', 'decrease')).toBe(false);
  });
});
