/**
 * Freight for a supplier's order, estimated from the logistics services in
 * Logistics (Adrian, 2026-11-27: freight prices live with the distributors,
 * never in Settings). Silent on purpose: the basket shows one figure, never
 * route lines (Adrian, 2026-10-10).
 *
 * Per mode, per supplier parcel: the tea's weight, plus the route's packing,
 * rounded up to its billing step and never under its minimum (the routes in
 * Settings, migration 0042, which no longer hold a rate), times the dearest
 * active service of that mode that can price a kilo, so the estimate never
 * comes in under:
 *   - a kilo rate as it is, a cubic-metre rate through the planning packing
 *     allowance (src/lib/packingSizes.ts); a fixed price cannot price a kilo.
 *   - Air with no such service follows the shop default rate.
 *   - Boat with none is not estimated: there is no shop boat rate, and guessing
 *     one would print a number nobody gave.
 *   - Both is estimated as air, the dearer leg.
 * A rate once typed on a route is kept as data and no longer read. Unknown is
 * null, never zero. Shelf prices are untouched.
 */
import type { ExchangeRate } from '../../admin/types';
import type { LedgerTransaction } from '../../lib/ledgerStore';
import { isUnrecordedCurrency, rateToUsd } from '../../lib/currency';
import { serviceQuotePerKgUsd, serviceRatesFromRows, type ServiceRow } from '../../lib/freightSource';
import { ledgerItemGrams } from '../CurateV2/curatePricing';

export interface ShippingRoute {
  id: string;
  mode: 'air' | 'sea';
  carrier: string | null;
  destination: string | null;
  packing_percent: number | null;
  billing_step_kg: number | null;
  minimum_kg: number | null;
  learned?: { bills: number; per_kg: number; currency: string } | null;
}

export type RouteMode = 'air' | 'sea';
export const routeModeOf = (shipBy: 'air' | 'boat' | 'both' | undefined): RouteMode => (shipBy === 'boat' ? 'sea' : 'air');

/** Kilos a carrier bills for a parcel of tea: packing added, rounded up to its step, never under its minimum. */
export function billedKg(teaKg: number, route: Pick<ShippingRoute, 'packing_percent' | 'billing_step_kg' | 'minimum_kg'> | null): number {
  if (!(teaKg > 0)) return 0;
  let kg = teaKg * (1 + (route?.packing_percent ?? 0) / 100);
  const step = route?.billing_step_kg;
  if (step && step > 0) kg = Math.ceil(kg / step - 1e-9) * step;
  if (route?.minimum_kg != null) kg = Math.max(kg, route.minimum_kg);
  return kg;
}

/** A logistics service as the estimate needs it: the service row plus its mode. */
export type EstimateService = ServiceRow & { mode: string };

const perUsd = (rates: readonly ExchangeRate[] | null | undefined, currency: string | null | undefined): number | null =>
  isUnrecordedCurrency(currency) ? 1 : rateToUsd(rates, String(currency));

/** USD a kilo by the dearest active service of this mode that can price one, or null. */
export function modePerKgUsd(services: readonly EstimateService[], mode: RouteMode, rates: readonly ExchangeRate[] | null | undefined): number | null {
  const quotes = serviceRatesFromRows(services.filter(service => service.mode === mode), currency => perUsd(rates, currency));
  const priced = Object.values(quotes).map(quote => serviceQuotePerKgUsd(quote, {})).filter((n): n is number => n !== null && Number.isFinite(n));
  return priced.length ? Math.max(...priced) : null;
}

export interface OrderFreight {
  /** In the order's own money; null when some leg could not be estimated. */
  amount: number | null;
  /** A route's packing allowance went into the figure. */
  packing: boolean;
  /** The modes this order uses, for the Receiving tiles. */
  modes: RouteMode[];
}

export function estimateOrderFreight(
  tx: Pick<LedgerTransaction, 'items' | 'currency'>,
  routes: readonly ShippingRoute[],
  services: readonly EstimateService[],
  rates: readonly ExchangeRate[] | null | undefined,
  shopFreightPerKgUsd: number | null,
): OrderFreight {
  const orderPerUsd = perUsd(rates, tx.currency);
  const grams: Record<RouteMode, number> = { air: 0, sea: 0 };
  for (const item of tx.items) grams[routeModeOf(item.shipBy)] += ledgerItemGrams(item);
  const modes = (['air', 'sea'] as const).filter((m) => grams[m] > 0);
  let amount: number | null = 0;
  let packing = false;
  for (const mode of modes) {
    const route = routes.find((r) => r.mode === mode) ?? null;
    const kg = billedKg(grams[mode] / 1000, route);
    if (route?.packing_percent) packing = true;
    const usdPerKg = modePerKgUsd(services, mode, rates) ?? (mode === 'air' ? shopFreightPerKgUsd : null);
    if (usdPerKg == null || orderPerUsd == null || amount == null) { amount = null; continue; }
    amount += kg * usdPerKg * orderPerUsd;
  }
  return { amount, packing, modes };
}
