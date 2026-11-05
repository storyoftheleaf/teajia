import { describe, expect, it } from 'vitest';
import { CURRENCY_ALIASES, SHOP_CURRENCY_KEYS, canonicalCurrency, knownCurrency, rateToUsd } from './currency';

describe('currency normalization', () => {
  it.each([...Object.entries(CURRENCY_ALIASES), ...SHOP_CURRENCY_KEYS.map(key => [key, key])])(
    'normalizes supported spelling %s without changing its money',
    (alias, expected) => {
      expect(knownCurrency(` ${alias.toUpperCase()} `)).toBe(expected);
      expect(canonicalCurrency(` ${alias.toUpperCase()} `)).toBe(expected);
    },
  );

  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'])('does not mistake object property %s for a currency', raw => {
    expect(knownCurrency(raw)).toBeNull();
    expect(canonicalCurrency(raw)).toBe(raw.toUpperCase());
    expect(rateToUsd([{ currency: 'USD', rateToUSD: 1 }], raw)).toBeNull();
  });

  it('keeps unrecognized codes distinct from missing money', () => {
    expect(knownCurrency('gbp')).toBeNull();
    expect(canonicalCurrency('gbp')).toBe('GBP');
    for (const raw of [null, undefined, '', '  ']) {
      expect(canonicalCurrency(raw)).toBeNull();
      expect(knownCurrency(raw)).toBeNull();
    }
  });
});

describe('currency rate aliases', () => {
  it.each([['CNY', 'Yuan'], ['RMB', 'cny'], ['TWD', 'NT'], ['NT$', 'twd']])('reads rate row %s for request %s', (stored, requested) => {
    expect(rateToUsd([{ currency: stored, rateToUSD: 7.123456 }], requested)).toBe(7.123456);
  });
});
