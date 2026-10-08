import { describe, expect, it } from 'vitest';
import { curateShelfPreview } from './curatePricing';
import { calculatePricing } from '../../admin/utils';
import { isUnrecordedCurrency, rateToUsd } from '../../lib/currency';
import { SHOP_MARKUP_MULTIPLIER as APP_MARKUP } from '../../lib/markup';
import { shopFreightDefaultFrom } from '../../lib/shippingRate';
import type { ExchangeRate } from '../../admin/types';

/*
 * What Curate v2 SHOWS as a shelf price, against how the shop itself prices.
 *
 * The shop's arithmetic is the worker's: `addPricingFields` in
 * worker/src/index.ts, built from `shippingPerGramUsd` and
 * `resolveShopFreightDefault` (worker/src/shippingRate.ts) and the markup in
 * worker/src/markup.ts. `addPricingFields` is a private function of a 27,000
 * line module, so it is written out here from those exported pieces in the
 * same order it applies them: cost per unit over the rate, plus freight per
 * gram, times the markup, rounded to the cent. The worker modules are loaded
 * by variable path so the frontend's typecheck does not take on Worker
 * sources (the same arrangement as src/lib/teaCompassSync.test.ts).
 */
const freightPath = '../../../worker/src/shippingRate.ts';
const markupPath = '../../../worker/src/markup.ts';
const { shippingPerGramUsd, resolveShopFreightDefault } = await import(freightPath);
const { SHOP_MARKUP_MULTIPLIER } = await import(markupPath);

const rates: ExchangeRate[] = [
  { currency: 'USD', rateToUSD: 1 },
  { currency: 'Yuan', rateToUSD: 7.1 },
  { currency: 'NT', rateToUSD: 32.4 },
];

const lookup = (c: string): number | undefined => rateToUsd(rates, c) ?? undefined;

interface Case {
  name: string;
  cost: number | null | undefined;
  /** Grams the price covers; pieces for teaware. */
  qty: number;
  currency: string;
  isTeaware?: boolean;
}

/** The shop's retail price per gram (per piece for teaware), or null when it prints a dash. */
function shopRetail(c: Case, account: { default_shipping_rate_per_kg?: number | null; default_shipping_rate_currency?: string | null } | null) {
  if (c.cost == null) return null;
  const shopDefault = resolveShopFreightDefault(account, lookup).perKgUsd;
  const rate = isUnrecordedCurrency(c.currency) ? 1 : lookup(c.currency);
  if (!rate || rate <= 0) return null;
  const costPerUnitUsd = c.cost / c.qty / rate + shippingPerGramUsd({
    storedRatePerKg: null,
    rateToUsd: rate,
    isTeaware: !!c.isTeaware,
    shopDefaultPerKgUsd: shopDefault,
  });
  return Math.round(costPerUnitUsd * SHOP_MARKUP_MULTIPLIER * 100) / 100;
}

function v2Retail(c: Case, account: Parameters<typeof shopRetail>[1]) {
  const shopDefault = shopFreightDefaultFrom(account, lookup).perKgUsd;
  const preview = curateShelfPreview({
    costAmount: c.cost as number,
    grams: c.qty,
    currency: c.currency,
    rates,
    shopFreightPerKgUsd: shopDefault,
    isTeaware: c.isTeaware,
  });
  return preview ? Math.round(preview.retailPerGramUsd * 100) / 100 : null;
}

const cases: Case[] = [
  { name: 'a 1,200 yuan 357 g cake', cost: 1200, qty: 357, currency: 'Yuan' },
  { name: 'the same cake recorded as CNY', cost: 1200, qty: 357, currency: 'CNY' },
  { name: 'NT$1,800 for 150 g of loose tea', cost: 1800, qty: 150, currency: 'NT' },
  { name: 'a $40 teaware piece', cost: 40, qty: 1, currency: 'USD', isTeaware: true },
  { name: 'a 300 yuan teaware piece', cost: 300, qty: 1, currency: 'Yuan', isTeaware: true },
  { name: 'a tea whose currency has no rate', cost: 380, qty: 100, currency: 'HKD' },
  { name: 'a tea with no price', cost: null, qty: 100, currency: 'Yuan' },
  { name: 'a tea with no currency recorded at all (the older dollars convention)', cost: 60, qty: 100, currency: 'UNK' },
  { name: 'a free tea (a typed zero is a price)', cost: 0, qty: 100, currency: 'Yuan' },
];

const accounts = [
  { label: 'a shop that never set a rate', account: null },
  { label: 'a shop at 70 yuan a kilo', account: { default_shipping_rate_per_kg: 70, default_shipping_rate_currency: 'Yuan' } },
  { label: 'a shop quoting 12 dollars a kilo', account: { default_shipping_rate_per_kg: 12, default_shipping_rate_currency: 'USD' } },
];

describe('Curate v2 shelf figures against the shop\'s own pricing', () => {
  it('uses the shop\'s markup', () => {
    expect(APP_MARKUP).toBe(SHOP_MARKUP_MULTIPLIER);
    expect(SHOP_MARKUP_MULTIPLIER).toBe(3);
  });

  for (const { label, account } of accounts) {
    describe(label, () => {
      for (const c of cases) {
        it(`${c.name}: the same figure, or the same dash`, () => {
          expect(v2Retail(c, account)).toEqual(shopRetail(c, account));
        });
      }
    });
  }

  it('puts the freight inside the markup: a 1,200 yuan 357 g cake is ((1200 + 30.345) / 357 / 7.1) x 3', () => {
    const preview = curateShelfPreview({ costAmount: 1200, grams: 357, currency: 'Yuan', rates, shopFreightPerKgUsd: 85 / 7.1 });
    // 85 yuan a kilo on 357 g is 30.345 yuan, and it is multiplied with the rest.
    expect(preview!.retailPerGramUsd).toBeCloseTo(((1200 + 30.345) / 357 / 7.1) * 3, 10);
    expect(preview!.freightPerKgSource).toBeCloseTo(85, 10);
  });

  it('charges teaware no freight at all', () => {
    const preview = curateShelfPreview({ costAmount: 40, grams: 1, currency: 'USD', rates, shopFreightPerKgUsd: 85 / 7.1, isTeaware: true });
    expect(preview!.freightPerKgSource).toBe(0);
    expect(preview!.retailPerGramUsd).toBeCloseTo(120, 10);
    // And it agrees with the admin's own preview for the same piece.
    expect(preview!.retailPerGramUsd).toBeCloseTo(calculatePricing(40, 85, 1, 'USD', rates, true).suggestedRetailUSD, 10);
  });

  it('prints a dash for a currency with no rate, never a rate of 1', () => {
    expect(curateShelfPreview({ costAmount: 380, grams: 100, currency: 'HKD', rates, shopFreightPerKgUsd: 12 })).toBeNull();
    expect(curateShelfPreview({ costAmount: 380, grams: 100, currency: 'HKD', rates: [], shopFreightPerKgUsd: 12 })).toBeNull();
  });

  it('prints nothing for a tea with no price', () => {
    for (const costAmount of [undefined, null, Number.NaN] as unknown as number[]) {
      expect(curateShelfPreview({ costAmount, grams: 100, currency: 'Yuan', rates, shopFreightPerKgUsd: 12 })).toBeNull();
    }
  });
});
