import { describe, expect, it } from 'vitest';
import type { InventoryItem } from '../../types';
import {
  TEA_SHOP_VIEWS,
  applyFinderIntent,
  isSaleReadyTea,
  selectAvailableTeas,
  selectCuratedTeas,
  selectPastTeas,
} from './teaShopView';

const tea = (overrides: Partial<InventoryItem> = {}): InventoryItem => ({
  id: 'tea-1', category: 'tea', type: 'White', name: 'Tea', year: '2024',
  origin: 'Fujian', variant: '', stock_g: 100, cost_price: '0', price_per_gram: '0.2',
  description: '', tags: [], image: '', ...overrides,
});

describe('tea shop views', () => {
  it('keeps the approved order', () => {
    expect(TEA_SHOP_VIEWS.map(view => view.id)).toEqual(['all', 'selection', 'find']);
  });

  it('separates available, curated, and past tea', () => {
    const items = [
      tea({ id: 'available' }),
      tea({ id: 'curated', isCurated: true }),
      tea({ id: 'past', stock_g: 0, isCurated: true }),
      tea({ id: 'invalid-price', price_per_gram: '0' }),
    ];
    expect(selectAvailableTeas(items).map(item => item.id)).toEqual(['available', 'curated']);
    expect(selectCuratedTeas(items).map(item => item.id)).toEqual(['curated']);
    expect(selectPastTeas(items).map(item => item.id)).toEqual(['past']);
  });

  it('rejects non-finite sale prices', () => {
    const items = [
      tea({ id: 'infinity', price_per_gram: 'Infinity' }),
      tea({ id: 'negative-infinity', price_per_gram: '-Infinity' }),
      tea({ id: 'not-a-number', price_per_gram: 'not-a-number' }),
      tea({ id: 'overflow', price_per_gram: '1e309' }),
      tea({ id: 'finite' }),
    ];

    expect(selectAvailableTeas(items).map(item => item.id)).toEqual(['finite']);
  });

  it('only marks positive finite prices as sale ready', () => {
    expect(isSaleReadyTea(tea({ price_per_gram: 'NaN' }))).toBe(false);
    expect(isSaleReadyTea(tea({ price_per_gram: '-0.2' }))).toBe(false);
    expect(isSaleReadyTea(tea({ price_per_gram: undefined }))).toBe(false);
    expect(isSaleReadyTea(tea({ price_per_gram: '0.2' }))).toBe(true);
  });

  it('preserves source order without mutating the input', () => {
    const items = [
      tea({ id: 'past-first', stock_g: 0 }),
      tea({ id: 'curated-first', isCurated: true }),
      tea({ id: 'available' }),
      tea({ id: 'curated-second', isCurated: true }),
      tea({ id: 'past-second', stock_g: 0 }),
    ];
    const original = items.map(item => ({ ...item, tags: [...item.tags] }));

    expect(selectAvailableTeas(items).map(item => item.id)).toEqual([
      'curated-first', 'available', 'curated-second',
    ]);
    expect(selectCuratedTeas(items).map(item => item.id)).toEqual([
      'curated-first', 'curated-second',
    ]);
    expect(selectPastTeas(items).map(item => item.id)).toEqual(['past-first', 'past-second']);
    expect(items).toEqual(original);
  });

  it('maps finder choices to canonical filters', () => {
    expect(applyFinderIntent('light-fragrant')).toEqual({ categoryId: 'flavor', termId: 'floral' });
    expect(applyFinderIntent('grounding-deep')).toEqual({ categoryId: 'feeling', termId: 'grounding' });
    expect(applyFinderIntent('clear-focused')).toEqual({ categoryId: 'feeling', termId: 'clarifying' });
    expect(applyFinderIntent('all')).toBeNull();
  });
});
