import { describe, expect, it } from 'vitest';
import { rateToUsd } from './currency';
import { FALLBACK_SHIPPING_RATE_PER_KG, shopFreightDefaultFrom, shippingRateUsdFor } from './shippingRate';
import { resolveShopFreightDefault, shippingPerGramUsd } from '../../worker/src/shippingRate';

// Both builds must agree at their existing money boundary. This is deliberately
// separate from tests of either implementation, including the kg/g conversion.
describe('client and Worker freight conversion contract', () => {
  const rates = [{ currency: 'USD', rateToUSD: 1 }, { currency: 'Yuan', rateToUSD: 7.123456 }];
  const lookup = (currency: string) => rateToUsd(rates, currency);
  const account = { default_shipping_rate_per_kg: 85, default_shipping_rate_currency: 'Yuan' };

  it.each([
    { name: 'unset account', account: null, expected: FALLBACK_SHIPPING_RATE_PER_KG / 7.123456 },
    { name: 'NULL amount ignores a stale quote currency', account: { default_shipping_rate_per_kg: null, default_shipping_rate_currency: 'USD' }, expected: FALLBACK_SHIPPING_RATE_PER_KG / 7.123456 },
    { name: 'recorded Yuan quote', account, expected: 85 / 7.123456 },
    { name: 'existing CNY alias', account: { ...account, default_shipping_rate_currency: 'CNY' }, expected: 85 / 7.123456 },
    { name: 'recorded USD quote', account: { default_shipping_rate_per_kg: 12, default_shipping_rate_currency: 'USD' }, expected: 12 },
    { name: 'missing named FX cannot borrow Yuan', account: { ...account, default_shipping_rate_currency: 'HKD' }, expected: null },
  ])('$name', ({ account: selected, expected }) => {
    const client = shopFreightDefaultFrom(selected, lookup);
    const worker = resolveShopFreightDefault(selected, lookup);
    expect(client).toEqual(worker);
    expect(client.perKgUsd).toBe(expected);
  });

  it.each([null, undefined, 0, -2, NaN, Infinity])('keeps unusable FX %s unknown in both builds', conversion => {
    const client = shopFreightDefaultFrom(account, () => conversion);
    const worker = resolveShopFreightDefault(account, () => conversion);
    expect(client.perKgUsd).toBeNull();
    expect(worker).toEqual(client);
    const free = { ...account, default_shipping_rate_per_kg: 0 };
    expect(shopFreightDefaultFrom(free, () => conversion).perKgUsd).toBe(0);
    expect(resolveShopFreightDefault(free, () => conversion).perKgUsd).toBe(0);
  });

  it.each([
    { name: 'inherited unavailable quote', stored: null, ownRate: 1, shop: null, expected: null },
    { name: 'known inherited quote independent of cost FX', stored: null, ownRate: null, shop: 12, expected: 0.012 },
    { name: 'known inherited zero', stored: null, ownRate: null, shop: 0, expected: 0 },
    { name: 'entered zero without either conversion', stored: 0, ownRate: null, shop: null, expected: 0 },
    { name: 'own conversion independent of unknown shop', stored: 14, ownRate: 7, shop: null, expected: 0.002 },
    { name: 'own missing conversion', stored: 14, ownRate: null, shop: 12, expected: null },
    { name: 'own invalid zero conversion', stored: 14, ownRate: 0, shop: 12, expected: null },
    { name: 'own nonfinite conversion', stored: 14, ownRate: Infinity, shop: 12, expected: null },
  ])('$name preserves the same per-gram money', ({ stored, ownRate, shop, expected }) => {
    const clientPerKg = shippingRateUsdFor(stored, ownRate, shop);
    const clientPerGram = clientPerKg === null ? null : clientPerKg / 1000;
    const workerPerGram = shippingPerGramUsd({ storedRatePerKg: stored, rateToUsd: ownRate, shopDefaultPerKgUsd: shop, isTeaware: false });
    expect(clientPerGram).toBe(expected);
    expect(workerPerGram).toBe(expected);
  });
});
