import { canonicalCurrency, isUnrecordedCurrency } from '../../src/lib/currency';
import { SHOP_MARKUP_MULTIPLIER } from './markup';
import { shippingPerGramUsd, resolveShopFreightDefault, freightDefaultFor, methodRatesFromRoutes, type FreightDefaults, type RouteRateRow } from './shippingRate';

/**
 * Case-insensitive rate lookup with alias normalization, so 'CNY' resolves to
 * the 'Yuan' row. Exact key first, then case-insensitive, then alias map.
 *
 * Shared by product pricing and by the shop's freight default, because a rate
 * that resolves for one and silently falls back to 1 for the other would price
 * a yuan figure as dollars.
 */
export function lookupRateToUsd(rates: Map<string, number>, rawCurrency: string | null | undefined): number | undefined {
  const currency = canonicalCurrency(rawCurrency);
  if (!currency) return undefined;
  const exact = rates.get(currency);
  if (exact !== undefined) return exact;
  const lc = currency.toLowerCase();
  for (const [k, v] of rates) {
    if (k.toLowerCase() === lc) return v;
  }
  return undefined;
}

/**
 * The shop's own freight rate and each freight method's route rate, converted
 * to USD at today's rate.
 *
 * Read per request rather than cached: two indexed reads, and a rate that kept
 * serving the old number after Adrian changed it in Settings would be the same
 * class of bug this whole area exists to stop.
 */
export async function accountFreightDefaults(env: { DB: D1Database }, accountId: string, rates: Map<string, number>): Promise<FreightDefaults> {
  return (await freightDefaultsByAccount(env, [accountId], rates)).get(accountId)!;
}

/** The same, for every shop a response carries teas from, in two reads however many shops. */
export async function freightDefaultsByAccount(env: { DB: D1Database }, accountIds: readonly string[], rates: Map<string, number>): Promise<Map<string, FreightDefaults>> {
  const ids = [...new Set(accountIds.filter(Boolean))];
  const out = new Map<string, FreightDefaults>();
  if (!ids.length) return out;
  const marks = ids.map(() => '?').join(', ');
  const accounts = await env.DB.prepare(
    `SELECT id, default_shipping_rate_per_kg, default_shipping_rate_currency FROM accounts WHERE id IN (${marks})`,
  ).bind(...ids).all<{ id: string; default_shipping_rate_per_kg?: number | null; default_shipping_rate_currency?: string | null }>();
  const routes = await env.DB.prepare(
    `SELECT account_id, mode, rate_per_kg, rate_currency FROM shipping_routes
      WHERE account_id IN (${marks}) AND archived_at IS NULL AND rate_per_kg IS NOT NULL ORDER BY created_at, id`,
  ).bind(...ids).all<RouteRateRow & { account_id: string }>();
  const lookup = (c: string) => lookupRateToUsd(rates, c);
  const accountRows = accounts.results ?? [];
  const routeRows = routes.results ?? [];
  for (const id of ids) {
    out.set(id, {
      shopPerKgUsd: resolveShopFreightDefault(accountRows.find(a => a.id === id) ?? null, lookup).perKgUsd,
      methodPerKgUsd: methodRatesFromRoutes(routeRows.filter(r => r.account_id === id), lookup),
    });
  }
  return out;
}

export function addPricingFields(product: any, rates: Map<string, number>, freightDefaults: FreightDefaults): any {
  /* A named cost currency with no rate is not a rate of 1. Reading a 380 yuan
     cost as 380 dollars is a seven-fold error that the x3 then triples, and it
     arrives looking like an expensive tea rather than like a fault. Nothing to
     convert with means no price: the surfaces print a dash, which is what not
     knowing should look like.

     A cost with no currency recorded at all is the separate, older case. It
     means nobody wrote one down, which by this shop's convention is USD, and
     'UNK' is the sentinel the admin uses for it. That still converts at 1,
     because that is what it has always meant, not because a rate is missing. */
  const declared = product.cost_currency as string | null | undefined;
  // The reading of "nobody said" lives beside the alias map, because the admin
  // dashboard has to take the same one or the shelf and the dashboard disagree
  // about the same teas. It was written out here in full, which is how a rule
  // gets two homes.
  const rate = isUnrecordedCurrency(declared) ? 1 : lookupRateToUsd(rates, declared);
  const isTeaware = product.type === 'Teaware';
  const freight = shippingPerGramUsd({
    storedRatePerKg: product.shipping_rate_per_kg,
    rateToUsd: rate,
    isTeaware,
    // The tea's own rate, else its method's route, else the shop's: worker/src/shippingRate.ts.
    shopDefaultPerKgUsd: freightDefaultFor(product.freight_method, freightDefaults),
  });
  if (!rate || !Number.isFinite(rate) || rate <= 0 || freight === null || product.cost_amount == null || !(Number(product.quantity_purchased) > 0)) {
    return {
      ...product,
      stock_grams: Math.round(product.stock_grams || 0),
      // The books keep part grams; the Stock page reads this, the shop keeps whole grams.
      stock_grams_exact: product.stock_grams ?? 0,
      cost_per_gram_usd: null,
      retail_price_per_gram_usd: product.fixed_retail_price_usd ?? null,
    };
  }

  // The purchase denominator is acquisition evidence, never current availability.
  const qty = Number(product.quantity_purchased) || 0;

  let costPerUnitUSD = 0;
  let retailPricePerUnitUSD = 0;

  if (qty > 0) {
    const costPerUnit = product.cost_amount / qty;
    /* Freight belongs in the basis the markup multiplies, and the rate itself
       is decided in one place. See worker/src/shippingRate.ts for both, and
       for why a NULL rate is not the same as a rate of zero. */
    costPerUnitUSD = costPerUnit / rate + freight;
  }

  if (qty > 0) {
    retailPricePerUnitUSD = costPerUnitUSD * SHOP_MARKUP_MULTIPLIER;
  }

  return {
    ...product,
    stock_grams: Math.round(product.stock_grams || 0),
    stock_grams_exact: product.stock_grams ?? 0,
    cost_per_gram_usd: Math.round(costPerUnitUSD * 100) / 100,
    retail_price_per_gram_usd: product.fixed_retail_price_usd ?? Math.round(retailPricePerUnitUSD * 100) / 100,
  };
}
