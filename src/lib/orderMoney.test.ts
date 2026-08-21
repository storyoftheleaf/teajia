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
