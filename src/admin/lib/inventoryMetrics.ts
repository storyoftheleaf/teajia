/**
 * What the shelf is worth, what it cost, and where the money sits.
 *
 * Out here rather than inside the dashboard's `useMemo` because these are money
 * totals and a total is the one place a wrong number looks most like a right
 * one. A rule that can only be read cannot be asked what it does with a tea
 * whose currency has no rate, and that question is the whole of this file.
 *
 * The two sides are answered separately and deliberately:
 *
 *   The RETAIL side is already in dollars. The shelf price is what this shop
 *   charges, so no exchange rate is consulted to read it, and every unarchived
 *   tea belongs in the shelf's worth, its region and its type. Dropping a tea
 *   from those because its COST currency would not resolve was a second wrong
 *   number arrived at while avoiding the first.
 *
 *   The COST side needs a rate, so a tea whose currency the shop has no rate
 *   for contributes no cost. Not a cost at a rate of 1: that reads a yuan
 *   figure as dollars, nearly seven times too big, and it surfaces as an
 *   expensive tea rather than as a fault.
 *
 * A tea with NO currency recorded is the separate, older case. Nobody wrote one
 * down, which by this shop's convention is dollars, and it converts at 1 for
 * that reason and not because a rate is missing. That is the same reading the
 * worker's own pricing takes, so the dashboard and the shelf agree about these
 * teas rather than one of them quietly leaving them out.
 */

import { canonicalCurrency, isUnrecordedCurrency, rateToUsd, type RateRow } from '../../lib/currency';

/** Everything these totals read off a product. */
export interface ValuedProduct {
  status?: string | null;
  costAmount: number;
  costCurrency: string | null;
  quantityPurchased: number;
  stockGrams: number;
  pricePerGramUSD: number;
  fixedRetailPriceUSD?: number | null;
  originRegion?: string | null;
  type?: string | null;
}

export interface NamedValue {
  name: string;
  value: number;
}

export interface InventoryMetrics {
  totalCostUSD: number;
  totalRetailUSD: number;
  potentialProfit: number;
  currencyExposure: NamedValue[];
  regionValue: NamedValue[];
  typeValue: NamedValue[];
  /** How many teas contributed a retail value but no cost, and in what. */
  costlessCurrencies: Map<string, number>;
}

const ranked = (totals: Record<string, number>): NamedValue[] =>
  Object.entries(totals).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

export function inventoryMetrics(
  products: readonly ValuedProduct[],
  rates: readonly RateRow[] | null | undefined,
): InventoryMetrics {
  let totalCostUSD = 0;
  let totalRetailUSD = 0;
  const currencyExposure: Record<string, number> = {};
  const regionValue: Record<string, number> = {};
  const typeValue: Record<string, number> = {};
  const costlessCurrencies = new Map<string, number>();

  for (const p of products) {
    // Archived stock is not on the shelf, so it is in none of these.
    if (p.status === 'Archived') continue;

    const itemTotalRetailUSD = (p.fixedRetailPriceUSD ?? p.pricePerGramUSD) * p.stockGrams;
    totalRetailUSD += itemTotalRetailUSD;

    const region = p.originRegion || 'Unknown';
    regionValue[region] = (regionValue[region] || 0) + itemTotalRetailUSD;

    const type = p.type || 'Misc';
    typeValue[type] = (typeValue[type] || 0) + itemTotalRetailUSD;

    const rate = isUnrecordedCurrency(p.costCurrency) ? 1 : rateToUsd(rates, p.costCurrency);
    if (rate === null) {
      const named = canonicalCurrency(p.costCurrency) || 'unknown';
      costlessCurrencies.set(named, (costlessCurrencies.get(named) ?? 0) + 1);
      continue;
    }

    // Cost per gram in USD at today's rate, rather than at whatever the row was
    // computed against whenever it was last written.
    const validBatchWeight = p.quantityPurchased > 0 ? p.quantityPurchased : 1;
    const itemTotalCostUSD = ((p.costAmount / validBatchWeight) / rate) * p.stockGrams;
    totalCostUSD += itemTotalCostUSD;

    // Canonicalised, or 'CNY' and 'Yuan' split one pile of money into two lines
    // and neither of them says how much is in China.
    const currencyKey = canonicalCurrency(p.costCurrency) || 'USD';
    currencyExposure[currencyKey] = (currencyExposure[currencyKey] || 0) + itemTotalCostUSD;
  }

  return {
    totalCostUSD,
    totalRetailUSD,
    potentialProfit: totalRetailUSD - totalCostUSD,
    currencyExposure: ranked(currencyExposure),
    regionValue: ranked(regionValue).slice(0, 8), // Top 8 regions
    typeValue: Object.entries(typeValue).map(([name, value]) => ({ name, value })),
    costlessCurrencies,
  };
}
