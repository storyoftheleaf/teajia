import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { dashboardStockSignals, teaQuestions } from './dashboardSignals';

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

describe('teas waiting on an answer', () => {
  it('asks for a blank cost, then for a missing bag weight, and keeps a typed zero', () => {
    const result = teaQuestions([
      product({ id: 'priced', costAmount: 900, quantityPurchased: 250 }),
      product({ id: 'no-cost', costAmount: null, quantityPurchased: 150 }),
      product({ id: 'no-weight', costAmount: 3800, quantityPurchased: 0 }),
      product({ id: 'zero-cost', costAmount: 0, quantityPurchased: 300 }),
      product({ id: 'both', costAmount: null, quantityPurchased: 0 }),
    ]);
    expect(result.map(q => `${q.product.id}:${q.kind}`)).toEqual(['no-cost:cost', 'no-weight:weight', 'both:cost']);
  });
  it('leaves out archived teas and teaware', () => {
    const result = teaQuestions([
      product({ id: 'archived', status: 'Archived', costAmount: null }),
      product({ id: 'pot', type: 'Teaware', costAmount: null }),
      product({ id: 'draft', status: 'Draft', costAmount: null }),
    ]);
    expect(result.map(q => q.product.id)).toEqual(['draft']);
  });
});
