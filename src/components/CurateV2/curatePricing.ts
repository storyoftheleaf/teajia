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
import type { Currency, ExchangeRate } from '../../admin/types';
import { canonicalCurrency, isUnrecordedCurrency, rateToUsd } from '../../lib/currency';
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

export interface OrderMoney {
  /** The order's money: the one every priced line is in (the order's own when it has none). */
  currency: Currency;
  /** Priced lines in more than one money. Added up as one figure they would label
   *  one money's number with another's symbol, so no single total exists. */
  mixed: boolean;
  /** What the priced lines come to, in each money they are in. */
  parts: Array<{ currency: Currency; amount: number }>;
  /** Lines nobody has priced: they are in no total and are said so. */
  unpriced: number;
}

/**
 * An order counted in the money its lines are actually in. A line carries its
 * own currency; the order is expected to hold one, but a draft made before
 * that was enforced can hold two, and then the honest total is each money on
 * its own. A line with no price yet has no money and contributes nothing.
 */
export function orderMoney(tx: Pick<LedgerTransaction, 'items' | 'currency'>): OrderMoney {
  const parts: OrderMoney['parts'] = [];
  let unpriced = 0;
  for (const item of tx.items) {
    if (item.unpriced) { unpriced += 1; continue; }
    const money = (item.currency || tx.currency) as Currency;
    const key = canonicalCurrency(money) ?? money;
    const found = parts.find((part) => (canonicalCurrency(part.currency) ?? part.currency) === key);
    if (found) found.amount += ledgerItemAmount(item);
    else parts.push({ currency: money, amount: ledgerItemAmount(item) });
  }
  if (parts.length === 0) parts.push({ currency: tx.currency, amount: 0 });
  return { currency: parts[0].currency, mixed: parts.length > 1, parts, unpriced };
}

export interface OrderLanded {
  /** What the teas cost, in the order's currency. */
  subtotal: number;
  /** Tea weight carried, in kilos. Teaware is priced with its freight inside. */
  weightKg: number;
  /** The shop's freight per kilo, in the order's currency. */
  freightPerKg: number;
  freight: number;
  /** Units of the order's currency to one dollar, today. */
  perUsd: number;
  landedUsd: number;
}

const PIECE_GRAMS: Record<string, number> = { Cake: 357, Brick: 250, Tuo: 100 };

/**
 * An order as it lands: the teas, the shop's freight on their weight (85
 * yuan a kilo unless the shop says otherwise), and the total in dollars at
 * today's rate. Null when the order's currency has no rate, for the same
 * reason the shelf preview declines: a rate of 1 reads yuan as dollars.
 */
export function orderLanded(
  tx: Pick<LedgerTransaction, 'items' | 'currency'>,
  rates: readonly ExchangeRate[] | null | undefined,
  shopFreightPerKgUsd: number,
): OrderLanded | null {
  // Two moneys on one order have no single landed figure.
  const money = orderMoney(tx);
  if (money.mixed) return null;
  const perUsd = isUnrecordedCurrency(money.currency) ? 1 : rateToUsd(rates, money.currency);
  if (!perUsd) return null;
  const freightPerKg = shopRateInCurrency(shopFreightPerKgUsd, perUsd);
  if (freightPerKg === null) return null;
  let subtotal = 0;
  let grams = 0;
  for (const item of tx.items) {
    if (!item.unpriced) subtotal += ledgerItemAmount(item);
    if (item.type === 'Teaware') continue;
    if (item.priceIsPerGram) grams += item.quantityGrams ?? 0;
    else grams += (item.quantityUnits ?? 1) * (item.unitWeightGrams ?? PIECE_GRAMS[String(item.form)] ?? 0);
  }
  const weightKg = grams / 1000;
  const freight = weightKg * freightPerKg;
  return { subtotal, weightKg, freightPerKg, freight, perUsd, landedUsd: (subtotal + freight) / perUsd };
}
