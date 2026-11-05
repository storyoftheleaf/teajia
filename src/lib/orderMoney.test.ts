import { describe, expect, it } from 'vitest';
import { convertOrderAmount, formatOrderAmount } from './orderMoney';

const rates = [
  { currency: 'USD', rateToUSD: 1 },
  { currency: 'AUD', rateToUSD: 1.52 },
  { currency: 'IDR', rateToUSD: 16_210 },
];

describe('order money presentation', () => {
  it('converts USD base amounts before applying a currency label', () => {
    expect(convertOrderAmount(16, 'AUD', rates)).toEqual({ amount: 24.32, currency: 'AUD', rate: 1.52, converted: true });
    expect(convertOrderAmount(16, 'IDR', rates)).toEqual({ amount: 259_360, currency: 'IDR', rate: 16_210, converted: true });
  });

  it('keeps USD unchanged and fails closed to USD when the rate is unusable', () => {
    expect(convertOrderAmount(16, 'USD', rates)).toEqual({ amount: 16, currency: 'USD', rate: 1, converted: true });
    expect(convertOrderAmount(16, 'JPY', rates)).toEqual({ amount: 16, currency: 'USD', rate: 1, converted: false });
    expect(convertOrderAmount(16, 'AUD', [{ currency: 'AUD', rateToUSD: 0 }])).toEqual({ amount: 16, currency: 'USD', rate: 1, converted: false });
  });

  it('rejects invalid USD values instead of displaying invented money', () => {
    expect(() => convertOrderAmount(-1, 'USD', rates)).toThrow(RangeError);
    expect(() => convertOrderAmount(Number.NaN, 'USD', rates)).toThrow(RangeError);
  });

  it('formats the converted amount, not the raw USD number', () => {
    expect(formatOrderAmount(16, 'AUD', rates)).toContain('24.32');
  });
});

describe('order currency aliases', () => {
  const shopRates = [{ currency: 'Yuan', rateToUSD: 7.123456 }, { currency: 'NT', rateToUSD: 31.654321 }];

  it.each([
    ['Yuan', 'CNY', 7.123456], ['cny', 'CNY', 7.123456], [' RMB ', 'CNY', 7.123456],
    ['NT', 'TWD', 31.654321], ['twd', 'TWD', 31.654321], ['NT$', 'TWD', 31.654321],
  ])('converts %s with the recorded shop rate and an ISO display label', (requested, currency, rate) => {
    const amountUsd = 12.345678;
    expect(convertOrderAmount(amountUsd, requested, shopRates)).toEqual({ amount: amountUsd * rate, currency, rate, converted: true });
    expect(formatOrderAmount(10, requested, shopRates)).toBe(new Intl.NumberFormat('en-US', {
      style: 'currency', currency, maximumFractionDigits: 2,
    }).format(10 * rate));
  });

  it('recognizes USD aliases without consulting an exchange rate', () => {
    expect(convertOrderAmount(0, 'us$', [])).toEqual({ amount: 0, currency: 'USD', rate: 1, converted: true });
  });

  it.each([0, -1, NaN, Infinity])('keeps dollars honestly labeled when the alias rate is %s', rateToUSD => {
    expect(convertOrderAmount(16, 'CNY', [{ currency: 'Yuan', rateToUSD }])).toEqual({ amount: 16, currency: 'USD', rate: 1, converted: false });
  });

  it.each(['UNK', 'not money', 'constructor', '__proto__'])('refuses invalid currency %s even if a rate row names it', requested => {
    expect(convertOrderAmount(16, requested, [{ currency: requested, rateToUSD: 7 }])).toEqual({ amount: 16, currency: 'USD', rate: 1, converted: false });
  });

  it.each(['Yuan', 'NT$', 'constructor', '__proto__', 'UNK', 'not money'])('does not invent an exchange rate for %s', requested => {
    expect(convertOrderAmount(16, requested, [])).toEqual({ amount: 16, currency: 'USD', rate: 1, converted: false });
  });
});
