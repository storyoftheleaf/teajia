import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { dashboardStockSignals } from './dashboardSignals';

const product = (overrides: Partial<Product>): Product => ({ id: 'tea', type: 'Sheng', status: 'Active', stockGrams: 40, lowStockThreshold: 100, stockKnownAt: '2026-09-25', ...overrides } as Product);

describe('dashboard stock decisions', () => {
  it('separates unknown counts from known low stock and respects zero thresholds', () => {
    const result = dashboardStockSignals([
      product({ id: 'low' }), product({ id: 'unknown', stockKnownAt: null }),
      product({ id: 'recheck', recheckStock: true }), product({ id: 'disabled', lowStockThreshold: 0 }),
      product({ id: 'empty', stockGrams: 0 }), product({ id: 'pot', type: 'Teaware' }),
    ]);
    expect(result.low.map(p => p.id)).toEqual(['low']);
    expect(result.recheck.map(p => p.id)).toEqual(['unknown', 'recheck']);
  });
  it('keeps incoming stock visible without including archived holdings', () => {
    const result = dashboardStockSignals([product({ id: 'incoming', inTransit: true }), product({ id: 'archived', status: 'Archived', inTransit: true, recheckStock: true })]);
    expect(result.incoming.map(p => p.id)).toEqual(['incoming']);
    expect(result.recheck).toEqual([]);
  });
});
