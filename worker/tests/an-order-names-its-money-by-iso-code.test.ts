import { describe, expect, it } from 'vitest';
import { normalizeCartInquiry } from '../src/inquiryDomain';

/**
 * An order placed with the shop's currency set to yuan was refused with
 * "Currency must be a three-letter code", because the cart sent the shop's own
 * key, 'Yuan', and the server only read ISO codes. Every yuan order failed.
 * The cart now sends the ISO code, and the server also reads the shop's keys
 * through the one alias map, so an older cached cart still gets through.
 */
const order = (currency: unknown) => normalizeCartInquiry({
  store_slug: 'teajia-bali',
  tracking_token: 'A'.repeat(43),
  ref_number: 'TJ-20260929-0192C332',
  total_estimate_usd: 21,
  currency,
  items_json: JSON.stringify([{
    id: 'tea-1', name: 'Aged Liu Bao Tea', category: 'tea', storeSlug: 'teajia-bali',
    quantityGrams: 50, packGrams: 50, packs: 1, pricePerGram: 0.42, totalPrice: 21,
  }]),
});

const currencyOf = (currency: unknown) => {
  const result = order(currency);
  return result.ok ? result.value.currency : result.error;
};

describe('an order names its money by ISO code', () => {
  it('stores the ISO code the cart now sends', () => {
    expect(currencyOf('CNY')).toBe('CNY');
    expect(currencyOf('IDR')).toBe('IDR');
    expect(currencyOf('USD')).toBe('USD');
  });

  it('reads the shop keys a cached cart may still send, instead of refusing the order', () => {
    expect(currencyOf('Yuan')).toBe('CNY');
    expect(currencyOf('NT')).toBe('TWD');
  });

  it('still refuses a currency nobody can read, rather than calling it dollars', () => {
    expect(currencyOf('Yuanx')).toBe('Currency must be a three-letter code');
    expect(currencyOf('')).toBe('Currency must be a three-letter code');
    expect(currencyOf(undefined)).toBe('Currency must be a three-letter code');
  });
});
