import { describe, expect, it } from 'vitest';
import {
  TEA_SHOP_VIEWS,
  applyFinderIntent,
  selectAvailableTeas,
  selectCuratedTeas,
  selectPastTeas,
} from './teaShopView';

const tea = (overrides: Record<string, unknown> = {}) => ({
  id: 'tea-1', category: 'tea', type: 'White', name: 'Tea', year: '2024',
  origin: 'Fujian', stock_g: 100, cost_price: '0', price_per_gram: '0.2',
  description: '', tags: [], ...overrides,
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
    ] as any[];
    expect(selectAvailableTeas(items).map(item => item.id)).toEqual(['available', 'curated']);
    expect(selectCuratedTeas(items).map(item => item.id)).toEqual(['curated']);
    expect(selectPastTeas(items).map(item => item.id)).toEqual(['past']);
  });

  it('maps finder choices to canonical filters', () => {
    expect(applyFinderIntent('light-fragrant')).toEqual({ categoryId: 'flavor', termId: 'floral' });
    expect(applyFinderIntent('grounding-deep')).toEqual({ categoryId: 'feeling', termId: 'grounding' });
    expect(applyFinderIntent('clear-focused')).toEqual({ categoryId: 'feeling', termId: 'clarifying' });
    expect(applyFinderIntent('all')).toBeNull();
  });
});
