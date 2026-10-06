import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { curateShelfPreview, purchaseSpendInUsd } from './curatePricing';
import { calculatePricing } from '../../admin/utils';
import type { LedgerTransaction } from '../../lib/ledgerStore';
import type { ExchangeRate } from '../../admin/types';

const rates: ExchangeRate[] = [
  { currency: 'USD', rateToUSD: 1 },
  { currency: 'Yuan', rateToUSD: 7 },
  { currency: 'NT', rateToUSD: 32 },
];
// The shop's 85 yuan a kilo, in dollars.
const shopFreightPerKgUsd = 85 / 7;

describe('curateShelfPreview', () => {
  it('prices a yuan tea exactly as the admin price preview does, freight and markup included', () => {
    const preview = curateShelfPreview({ costAmount: 380, grams: 100, currency: 'Yuan', rates, shopFreightPerKgUsd });
    const admin = calculatePricing(380, 85, 100, 'Yuan', rates);
    expect(preview).not.toBeNull();
    expect(preview!.retailPerGramUsd).toBeCloseTo(admin.suggestedRetailUSD, 10);
    // (3.8 + 0.085) yuan a gram, in dollars, times three.
    expect(preview!.retailPerGramUsd).toBeCloseTo(((3.8 + 0.085) / 7) * 3, 10);
    expect(preview!.freightPerKgSource).toBeCloseTo(85, 10);
  });

  it('charges the same freight in money terms whatever currency the tea was bought in', () => {
    const preview = curateShelfPreview({ costAmount: 1000, grams: 100, currency: 'NT', rates, shopFreightPerKgUsd });
    expect(preview!.freightPerKgSource).toBeCloseTo((85 / 7) * 32, 10);
  });

  it('declines to price a currency the shop has no rate for, rather than reading it as dollars', () => {
    expect(curateShelfPreview({ costAmount: 380, grams: 100, currency: 'HKD', rates, shopFreightPerKgUsd })).toBeNull();
  });

  it('declines with no grams to divide by', () => {
    expect(curateShelfPreview({ costAmount: 380, grams: 0, currency: 'Yuan', rates, shopFreightPerKgUsd })).toBeNull();
  });
});

const tx = (id: string, currency: string, items: Array<{ price: number; grams?: number; units?: number; currency?: string }>): LedgerTransaction => ({
  id,
  direction: 'purchase',
  counterpartyName: 'Vendor',
  items: items.map((it, i) => ({
    id: `${id}-${i}`,
    name: 'Tea',
    pricePerUnit: it.price,
    priceIsPerGram: it.grams !== undefined,
    quantityGrams: it.grams,
    quantityUnits: it.units,
    currency: (it.currency ?? currency) as LedgerTransaction['currency'],
    addedAt: '2026-10-01',
  })),
  photos: [],
  status: 'confirmed',
  currency: currency as LedgerTransaction['currency'],
  createdAt: '2026-10-01',
  updatedAt: '2026-10-01',
});

describe('purchaseSpendInUsd', () => {
  it('counts a yuan purchase and a Taiwan dollar purchase together, each at its own rate', () => {
    const spend = purchaseSpendInUsd([
      tx('a', 'Yuan', [{ price: 700, units: 1 }]),
      tx('b', 'NT', [{ price: 2, grams: 160 }]),
    ], rates);
    expect(spend.priced.map((p) => p.usd)).toEqual([100, 10]);
    expect(spend.unpricedByCurrency).toEqual({});
  });

  it('converts each line in its own currency inside one purchase', () => {
    const spend = purchaseSpendInUsd([
      tx('a', 'Yuan', [{ price: 70, units: 1 }, { price: 320, units: 1, currency: 'NT' }]),
    ], rates);
    expect(spend.priced[0].itemsUsd).toEqual([10, 10]);
    expect(spend.priced[0].usd).toBe(20);
  });

  it('leaves a purchase out, and says which currency, when there is no rate for it', () => {
    const spend = purchaseSpendInUsd([
      tx('a', 'HKD', [{ price: 500, units: 1 }]),
      tx('b', 'Yuan', [{ price: 70, units: 1 }]),
    ], rates);
    expect(spend.priced.map((p) => p.tx.id)).toEqual(['b']);
    expect(spend.unpricedByCurrency).toEqual({ HKD: 1 });
  });
});

describe('Curate holds no pricing of its own', () => {
  it('the capture card has no freight setting, and no markup written into it', () => {
    const card = readFileSync(resolve(__dirname, 'CaptureCard.tsx'), 'utf8');
    const store = readFileSync(resolve(__dirname, '../../lib/teaCompassStore.ts'), 'utf8');
    expect(store).not.toMatch(/shippingRatePerKg/);
    expect(card).not.toMatch(/shippingRatePerKg/);
    expect(card).not.toMatch(/\)\s*\*\s*3\b/);
  });
});
