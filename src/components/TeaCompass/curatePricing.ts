/**
 * Curate's money, read through the shop's own pricing.
 *
 * Curate used to carry a second copy of it: a freight rate kept in the
 * compass store, starting at zero and typed in whatever currency the tea
 * happened to be in, a `* 3` written beside it, and a "retail" figure printed
 * in the purchase currency. So a tea priced at the table with free freight, a
 * freight of "85" meant yuan on one tea and Taiwan dollars on the next, and
 * the shelf price the operator saw was not the one the shop would charge.
 *
 * Nothing here holds a rate, a markup or a freight figure. The rate list is
 * `useRates`, the freight is the account's (`useShopFreightDefault`), and the
 * arithmetic is `calculatePricing`, the same function the admin's price
 * preview uses, which reads `SHOP_MARKUP_MULTIPLIER`.
 */
import { calculatePricing } from '../../admin/utils';
import type { ExchangeRate } from '../../admin/types';
import { isUnrecordedCurrency, rateToUsd } from '../../lib/currency';
import { shopRateInCurrency } from '../../lib/shippingRate';
import type { LedgerLineItem, LedgerTransaction } from '../../lib/ledgerStore';

export interface CurateShelfPreview {
  /** What one gram cost, in the currency it was bought in. */
  costPerGramSource: number;
  /** The shop's freight per kilo, in that same currency. */
  freightPerKgSource: number;
  /** What one gram would sell for on the shelf, in USD. */
  retailPerGramUsd: number;
}

/**
 * The shelf price of a tea as captured, or null when it cannot be priced.
 *
 * Null when the currency has no rate: there is no honest figure, and a rate
 * of 1 would read yuan as dollars and the markup would triple it. The caller
 * says so in words rather than printing a number.
 */
export function curateShelfPreview(input: {
  costAmount: number;
  grams: number;
  currency: string;
  rates: readonly ExchangeRate[] | null | undefined;
  shopFreightPerKgUsd: number;
}): CurateShelfPreview | null {
  const { costAmount, grams, currency, rates, shopFreightPerKgUsd } = input;
  if (!(costAmount >= 0) || !(grams > 0) || !rates) return null;
  const rate = isUnrecordedCurrency(currency) ? 1 : rateToUsd(rates, currency);
  const freightPerKgSource = shopRateInCurrency(shopFreightPerKgUsd, rate);
  if (freightPerKgSource === null) return null;
  const priced = calculatePricing(costAmount, freightPerKgSource, grams, currency, [...rates]);
  if (!priced.rateUsed) return null;
  return {
    costPerGramSource: costAmount / grams,
    freightPerKgSource,
    retailPerGramUsd: priced.suggestedRetailUSD,
  };
}

/** One line's amount in its own currency. */
export function ledgerItemAmount(item: LedgerLineItem): number {
  if (item.priceIsPerGram && item.quantityGrams) return item.pricePerUnit * item.quantityGrams;
  if (!item.priceIsPerGram && item.quantityUnits) return item.pricePerUnit * item.quantityUnits;
  return item.pricePerUnit;
}

export interface PurchaseInUsd {
  tx: LedgerTransaction;
  usd: number;
  /** Per line, in the same order as `tx.items`. */
  itemsUsd: number[];
}

export interface PurchaseSpend {
  /** Purchases every line of which could be converted. */
  priced: PurchaseInUsd[];
  /** Purchases left out because a line's currency has no rate, by currency. */
  unpricedByCurrency: Record<string, number>;
}

/**
 * Every confirmed purchase converted to USD at the shop's rates.
 *
 * Each line converts in its own currency, falling back to the purchase's,
 * because a basket bought across two vendors can hold both. A purchase with
 * any line the shop has no rate for is left out whole and counted by
 * currency, so the total never silently includes a figure read at 1.
 */
export function purchaseSpendInUsd(
  transactions: readonly LedgerTransaction[],
  rates: readonly ExchangeRate[] | null | undefined,
): PurchaseSpend {
  const priced: PurchaseInUsd[] = [];
  const unpricedByCurrency: Record<string, number> = {};
  for (const tx of transactions) {
    let missing: string | null = null;
    const itemsUsd: number[] = [];
    for (const item of tx.items) {
      const currency = item.currency || tx.currency;
      const rate = isUnrecordedCurrency(currency) ? 1 : rateToUsd(rates, currency);
      if (!rate) { missing = String(currency); break; }
      itemsUsd.push(ledgerItemAmount(item) / rate);
    }
    if (missing !== null) {
      unpricedByCurrency[missing] = (unpricedByCurrency[missing] ?? 0) + 1;
      continue;
    }
    priced.push({ tx, usd: itemsUsd.reduce((a, b) => a + b, 0), itemsUsd });
  }
  return { priced, unpricedByCurrency };
}
