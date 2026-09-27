/**
 * The shelf is worth what it is worth, whatever a tea's cost was paid in.
 *
 * These totals answer two questions with two different rules, and reading them
 * as one question cost the dashboard twice in opposite directions.
 *
 * First a rate of 1 for a currency the table could not resolve, which read a
 * yuan cost as dollars and overstated the shelf nearly sevenfold on every tea
 * recorded as 'CNY'. Then, fixing that, a bare `return` that dropped the tea
 * from the RETAIL totals as well, though the retail figures are already in
 * dollars and consult no rate at all. A tea's cost currency is not a reason to
 * forget the tea exists.
 */
import { describe, it, expect } from 'vitest';
import { inventoryMetrics, type ValuedProduct } from '../../src/admin/lib/inventoryMetrics';

const RATES = [
  { currency: 'Yuan', rateToUSD: 6.728858 },
  { currency: 'NT', rateToUSD: 31.630012 },
  { currency: 'USD', rateToUSD: 1 },
];

const tea = (over: Partial<ValuedProduct> = {}): ValuedProduct => ({
  status: 'Active',
  costAmount: 100,
  costCurrency: 'Yuan',
  quantityPurchased: 100,
  stockGrams: 100,
  pricePerGramUSD: 1,
  fixedRetailPriceUSD: null,
  originRegion: 'Yunnan',
  type: 'Sheng',
  ...over,
});

describe('what the shelf is worth', () => {
  it('counts every tea, including one whose cost currency will not resolve', () => {
    const withRate = inventoryMetrics([tea({ costCurrency: 'Yuan' })], RATES);
    const without = inventoryMetrics(
      [tea({ costCurrency: 'Yuan' }), tea({ costCurrency: 'AUD' })], RATES,
    );
    // Two teas at 100g x $1 is $200 of shelf, whatever either one cost.
    expect(withRate.totalRetailUSD).toBe(100);
    expect(without.totalRetailUSD).toBe(200);
    expect(without.regionValue.find((r) => r.name === 'Yunnan')!.value).toBe(200);
    expect(without.typeValue.find((t) => t.name === 'Sheng')!.value).toBe(200);
  });

  it('leaves that tea out of the cost totals, and says so', () => {
    const m = inventoryMetrics(
      [tea({ costCurrency: 'Yuan', costAmount: 1200 }), tea({ costCurrency: 'AUD', costAmount: 100 })],
      RATES,
    );
    // Only the yuan tea contributes a cost: 1200 yuan over 100g at 6.728858.
    expect(m.totalCostUSD).toBeCloseTo(178.34, 2);
    expect(m.currencyExposure.map((c) => c.name)).toEqual(['Yuan']);
    expect(m.costlessCurrencies.get('AUD')).toBe(1);
  });

  it('reads a tea recorded as CNY at the yuan rate, in one pile with the rest', () => {
    const m = inventoryMetrics(
      [tea({ costCurrency: 'CNY', costAmount: 1200 }), tea({ costCurrency: 'Yuan', costAmount: 1200 })],
      RATES,
    );
    // At a rate of 1 the first of these counted 1200 dollars, not 178.
    expect(m.totalCostUSD).toBeCloseTo(356.67, 2);
    // And one pile of money, not two lines neither of which says how much is
    // in China.
    expect(m.currencyExposure).toHaveLength(1);
    expect(m.currencyExposure[0].name).toBe('Yuan');
  });

  it('a cost with no currency on it converts at 1, the way the shelf reads it', () => {
    for (const nothing of [null, '', 'UNK']) {
      const m = inventoryMetrics([tea({ costCurrency: nothing, costAmount: 250 })], RATES);
      expect(m.totalCostUSD, `${nothing} should read as dollars`).toBeCloseTo(250, 6);
      expect(m.costlessCurrencies.size).toBe(0);
    }
  });

  it('an empty rate table costs the cost side and leaves the shelf standing', () => {
    const m = inventoryMetrics([tea({ costCurrency: 'Yuan' }), tea({ costCurrency: 'NT' })], []);
    expect(m.totalCostUSD).toBe(0);
    expect(m.totalRetailUSD).toBe(200);
    expect(m.potentialProfit).toBe(200);
  });

  it('archived stock is in none of it', () => {
    const m = inventoryMetrics([tea({ status: 'Archived' }), tea()], RATES);
    expect(m.totalRetailUSD).toBe(100);
    expect(m.regionValue.find((r) => r.name === 'Yunnan')!.value).toBe(100);
  });

  it('a fixed retail price wins over the per-gram one', () => {
    const m = inventoryMetrics([tea({ fixedRetailPriceUSD: 2, pricePerGramUSD: 1 })], RATES);
    expect(m.totalRetailUSD).toBe(200);
  });
});
