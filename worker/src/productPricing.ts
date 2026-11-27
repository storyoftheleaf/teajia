import { canonicalCurrency, isUnrecordedCurrency } from '../../src/lib/currency';
import { SHOP_MARKUP_MULTIPLIER } from './markup';
import { readPackingSizes } from './packingSizes';
import { shippingPerGramUsd, resolveShopFreightDefault, freightFor, serviceRatesFromRows, shipmentFreightFromRows, type FreightDefaults, type ServiceRow, type ShipmentLineRow } from './shippingRate';

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
 * The shop's own freight rate, the logistics services' rates, and the last
 * confirmed shipment freight of each tea, converted to USD at today's rate.
 * A tea picks its own figure with freightFor (src/lib/freightSource.ts).
 *
 * Read per request rather than cached: a rate that kept serving the old number
 * after Adrian changed it in Settings or Logistics would be the same class of
 * bug this whole area exists to stop.
 */
export async function accountFreightDefaults(env: { DB: D1Database }, accountId: string, rates: Map<string, number>): Promise<FreightDefaults> {
  return (await freightDefaultsByAccount(env, [accountId], rates)).get(accountId)!;
}

/** The same, for every shop a response carries teas from: three reads, plus one for each shop's packed sizes. */
export async function freightDefaultsByAccount(env: { DB: D1Database }, accountIds: readonly string[], rates: Map<string, number>): Promise<Map<string, FreightDefaults>> {
  const ids = [...new Set(accountIds.filter(Boolean))];
  const out = new Map<string, FreightDefaults>();
  if (!ids.length) return out;
  const marks = ids.map(() => '?').join(', ');
  const accounts = await env.DB.prepare(
    `SELECT id, default_shipping_rate_per_kg, default_shipping_rate_currency FROM accounts WHERE id IN (${marks})`,
  ).bind(...ids).all<{ id: string; default_shipping_rate_per_kg?: number | null; default_shipping_rate_currency?: string | null }>();
  const services = await env.DB.prepare(
    `SELECT id, account_id, basis, rate, currency, active, name, logistics_company_name FROM logistics_services WHERE account_id IN (${marks})`,
  ).bind(...ids).all<ServiceRow & { account_id: string }>();
  const lines = await env.DB.prepare(
    `SELECT s.id AS shipment_id, s.account_id, s.service_id, COALESCE(s.dispatched_at, s.created_at) AS dated, s.freight_json,
            l.id AS line_id, r.product_id, r.unit, l.quantity, l.weight_kg, l.volume_m3, l.weight_estimated, l.volume_estimated
       FROM logistics_shipments s
       JOIN logistics_shipment_lines l ON l.shipment_id = s.id AND l.account_id = s.account_id
       JOIN inventory_receipt_lines r ON r.id = l.receipt_line_id AND r.account_id = l.account_id
      WHERE s.account_id IN (${marks}) AND s.state <> 'cancelled' AND s.service_id IS NOT NULL AND s.freight_json IS NOT NULL`,
  ).bind(...ids).all<Record<string, any>>();
  const lookup = (c: string) => lookupRateToUsd(rates, c);
  const parse = (json: unknown) => { try { return typeof json === 'string' ? JSON.parse(json) : null; } catch { return null; } };
  const lineRows: Array<ShipmentLineRow & { account_id: string }> = (lines.results ?? []).map(r => ({
    shipment_id: r.shipment_id, account_id: r.account_id, service_id: r.service_id, dated: String(r.dated ?? ''), freight: parse(r.freight_json),
    line_id: r.line_id, product_id: r.product_id, unit: r.unit, quantity: Number(r.quantity),
    weight_kg: r.weight_kg == null ? null : Number(r.weight_kg), volume_m3: r.volume_m3 == null ? null : Number(r.volume_m3),
    weight_estimated: !!r.weight_estimated, volume_estimated: !!r.volume_estimated,
  }));
  for (const id of ids) {
    out.set(id, {
      shopPerKgUsd: resolveShopFreightDefault((accounts.results ?? []).find(a => a.id === id) ?? null, lookup).perKgUsd,
      services: serviceRatesFromRows((services.results ?? []).filter(r => r.account_id === id), lookup),
      shipments: shipmentFreightFromRows(lineRows.filter(r => r.account_id === id), lookup),
      packing: await readPackingSizes(env, id),
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
  const fallback = freightFor(product, freightDefaults);
  // What the admin shows beside the price: the freight a tea with no rate of its own takes, and from where.
  const freightFields = { freight_fallback_per_kg_usd: fallback.perKgUsd, freight_source: fallback.source, freight_fell_back: fallback.fellBack ?? null, freight_dated: fallback.dated ?? null };
  const freight = shippingPerGramUsd({
    storedRatePerKg: product.shipping_rate_per_kg,
    rateToUsd: rate,
    isTeaware,
    // The tea's own rate, else its service's shipments or quote, else the shop's: src/lib/freightSource.ts.
    shopDefaultPerKgUsd: fallback.perKgUsd,
  });
  if (!rate || !Number.isFinite(rate) || rate <= 0 || freight === null || product.cost_amount == null || !(Number(product.quantity_purchased) > 0)) {
    return {
      ...product,
      ...freightFields,
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
    ...freightFields,
    stock_grams: Math.round(product.stock_grams || 0),
    stock_grams_exact: product.stock_grams ?? 0,
    cost_per_gram_usd: Math.round(costPerUnitUSD * 100) / 100,
    retail_price_per_gram_usd: product.fixed_retail_price_usd ?? Math.round(retailPricePerUnitUSD * 100) / 100,
  };
}
