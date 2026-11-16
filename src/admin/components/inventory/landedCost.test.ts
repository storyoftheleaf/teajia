import { describe, expect, it } from 'vitest';
import { landedCost } from './landedCost';

describe('landedCost', () => {
  it('adds freight to cost when the currency is spelled differently', () => {
    expect(landedCost(100, 'Yuan', 20, 'CNY')).toBe(120);
    expect(landedCost(100, 'CNY', 20, 'cny')).toBe(120);
    expect(landedCost(100, 'NT', 20, 'TWD')).toBe(120);
  });
  it('keeps a zero amount', () => {
    expect(landedCost(0, 'Yuan', 20, 'CNY')).toBe(20);
    expect(landedCost(100, 'Yuan', 0, 'CNY')).toBe(100);
  });
  it('declines for genuinely different money or missing amounts', () => {
    expect(landedCost(100, 'Yuan', 20, 'USD')).toBeNull();
    expect(landedCost(null, 'Yuan', 20, 'CNY')).toBeNull();
    expect(landedCost(100, 'Yuan', null, 'CNY')).toBeNull();
  });
});
