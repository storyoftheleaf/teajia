/**
 * Where a tea's freight comes from (migration 0148, Adrian 2026-11-27).
 *
 * Freight prices belong to the logistics companies, not to the tea. Each
 * company has services (Suitcase, Airmail, Boat, whatever Adrian names them),
 * priced per kilo, per cubic metre or as a fixed amount, edited only in
 * Logistics. A tea only says which service it travels by. Its freight a kilo,
 * when it has no rate typed on the tea itself, is then, first that applies:
 *
 *   1. its last shipment by that service with a confirmed bill: the share of
 *      the bill the shipment gave this tea, divided by the grams it carried;
 *   2. that service's quote: a kilo rate as it is, a cubic-metre rate through
 *      the packed size the shop has learned for this tea, else for teas like
 *      it, else the planning allowance (src/lib/packingSizes.ts);
 *   3. the shop rate, which is also what every tea with no service keeps, so
 *      nothing moves until a service is picked. A fixed-price service cannot
 *      price a gram, and a service since archived prices nothing: both fall
 *      back here and say so.
 *
 * Rates are read at use time, never copied into the tea's row. One home for
 * the worker and the site; worker/src/shippingRate.ts re-exports it.
 */
import { calculateShipmentFreight, type LogisticsFreightInput } from './logisticsFreight';
import { estimateVolume, packingKindFor, type PackingSizes } from './packingSizes';

export type FreightSourceKind = 'shop' | 'service' | 'shipment';

/** A logistics service as pricing needs it, its rate already in USD per kilo or per m³. */
export interface FreightServiceRate {
  basis: 'kg' | 'm3' | 'fixed';
  /** USD per kilo (kg), per cubic metre (m3), or per shipment (fixed); null without a conversion. */
  perUnitUsd: number | null;
  name: string;
  company: string;
}

export interface FreightDefaults {
  /** The shop rate in USD a kilo, or null while its conversion is unavailable. */
  shopPerKgUsd: number | null;
  /** Active services by id. */
  services: Record<string, FreightServiceRate>;
  /** Last confirmed shipment freight, keyed `${productId}|${serviceId}`. */
  shipments: Record<string, { perKgUsd: number | null; dated: string }>;
  /** Packed sizes learned from the shop's shipments; absent means the planning allowances. */
  packing?: PackingSizes;
}

export const NO_ROUTES: Pick<FreightDefaults, 'services' | 'shipments'> = { services: {}, shipments: {} };

export interface FreightAnswer {
  /** USD a kilo, or null when it cannot be priced today. */
  perKgUsd: number | null;
  source: FreightSourceKind;
  /** Why a chosen service did not price it: fixed price, or no longer active. */
  fellBack?: 'fixed' | 'gone';
  /** The date of the shipment the figure came from. */
  dated?: string;
}

/** Packed cubic metres for a kilo of this tea: what its shipments taught, else like teas', else the allowance. */
export function packedM3PerKg(product: { id?: string | null; form?: unknown }, packing?: PackingSizes): number {
  return estimateVolume({ product_id: product.id, kind: packingKindFor({ unit: 'g', form: product.form }), quantity: 1000, unit: 'g' }, packing).volume_m3 ?? 0;
}

/** A service's quote as freight for a kilo of this tea, or null when it cannot price one. */
export function serviceQuotePerKgUsd(service: FreightServiceRate, product: { id?: string | null; form?: unknown }, packing?: PackingSizes): number | null {
  if (service.basis === 'fixed' || service.perUnitUsd === null) return null;
  return service.basis === 'kg' ? service.perUnitUsd : service.perUnitUsd * packedM3PerKg(product, packing);
}

/** The fallback freight a tea takes when it has no rate typed on it. */
export function freightFor(
  product: { id?: string | null; form?: unknown; freight_service_id?: string | null },
  defaults: FreightDefaults,
): FreightAnswer {
  const shop: FreightAnswer = { perKgUsd: defaults.shopPerKgUsd, source: 'shop' };
  const serviceId = product.freight_service_id;
  if (!serviceId) return shop;
  const service = defaults.services[serviceId];
  if (!service) return { ...shop, fellBack: 'gone' };
  const shipped = product.id ? defaults.shipments[`${product.id}|${serviceId}`] : undefined;
  if (shipped) return { perKgUsd: shipped.perKgUsd, source: 'shipment', dated: shipped.dated };
  if (service.basis === 'fixed') return { ...shop, fellBack: 'fixed' };
  return { perKgUsd: serviceQuotePerKgUsd(service, product, defaults.packing), source: 'service' };
}

export interface ServiceRow { id: string; basis: string; rate: number; currency: string; active: unknown; name: string; logistics_company_name: string }

/** Active services by id, their rates converted to USD. `rateToUsd` is units of the currency per USD. */
export function serviceRatesFromRows(rows: readonly ServiceRow[], rateToUsd: (currency: string) => number | null | undefined): Record<string, FreightServiceRate> {
  const out: Record<string, FreightServiceRate> = {};
  for (const row of rows) {
    if (!row.active || (row.basis !== 'kg' && row.basis !== 'm3' && row.basis !== 'fixed')) continue;
    const rate = Number(row.rate);
    const fx = rate === 0 ? 1 : rateToUsd(row.currency);
    out[row.id] = {
      basis: row.basis,
      perUnitUsd: Number.isFinite(rate) && typeof fx === 'number' && Number.isFinite(fx) && fx > 0 ? rate / fx : null,
      name: row.name,
      company: row.logistics_company_name,
    };
  }
  return out;
}

export interface ShipmentLineRow {
  shipment_id: string;
  service_id: string | null;
  dated: string;
  freight: LogisticsFreightInput | null;
  line_id: string;
  product_id: string;
  unit: string;
  quantity: number;
  weight_kg: number | null;
  volume_m3: number | null;
  weight_estimated: boolean;
  volume_estimated: boolean;
}

/**
 * Each tea's freight a kilo from the newest shipment by each service whose bill
 * is confirmed, dividing the bill the way the shipment itself does. Shipments
 * with no service, an unconfirmed bill or a bill that cannot be divided are left
 * out, so a tea on them keeps its service's quote.
 */
export function shipmentFreightFromRows(rows: readonly ShipmentLineRow[], rateToUsd: (currency: string) => number | null | undefined): FreightDefaults['shipments'] {
  const byShipment = new Map<string, ShipmentLineRow[]>();
  for (const row of rows) byShipment.set(row.shipment_id, [...(byShipment.get(row.shipment_id) ?? []), row]);
  const out: FreightDefaults['shipments'] = {};
  for (const lines of byShipment.values()) {
    const { freight, service_id: serviceId, dated } = lines[0];
    if (!serviceId || !freight?.confirmed) continue;
    const result = calculateShipmentFreight(freight, lines.map(l => ({ id: l.line_id, weight_kg: l.weight_kg, volume_m3: l.volume_m3, weight_estimated: l.weight_estimated, volume_estimated: l.volume_estimated })));
    if (result.issue || !freight.currency) continue;
    const amount = Number(result.total_amount);
    const fx = amount === 0 ? 1 : rateToUsd(freight.currency);
    // A tea on several lines of one shipment: its shares and grams add up.
    const perProduct = new Map<string, { amount: number; grams: number }>();
    for (const line of lines) {
      const share = result.allocations.find(a => a.id === line.line_id)?.amount;
      if (share == null || line.unit !== 'g' || !(line.quantity > 0) || !line.product_id) continue;
      const sum = perProduct.get(line.product_id) ?? { amount: 0, grams: 0 };
      perProduct.set(line.product_id, { amount: sum.amount + share, grams: sum.grams + line.quantity });
    }
    for (const [productId, { amount: share, grams }] of perProduct) {
      const key = `${productId}|${serviceId}`;
      if (out[key] && out[key].dated >= dated) continue;
      const perKg = share / (grams / 1000);
      out[key] = { perKgUsd: typeof fx === 'number' && Number.isFinite(fx) && fx > 0 ? perKg / fx : null, dated };
    }
  }
  return out;
}
