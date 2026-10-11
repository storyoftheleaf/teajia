/**
 * Freight for a supplier's order, estimated from the shipping routes in
 * Settings (migration 0042). Silent on purpose: the basket shows one figure,
 * never route lines (Adrian, 2026-10-10).
 *
 * Per route, per supplier parcel: the tea's weight, plus packing, rounded up to
 * the carrier's billing step and never under its minimum, times its rate.
 *   - Air with no route, or no rate on its route, follows the shop freight rate.
 *   - Boat with no route or no rate is not estimated: there is no shop boat rate,
 *     and guessing one would print a number nobody gave.
 *   - Both is estimated as air, the dearer leg, so the estimate never comes in under.
 * Unknown is null, never zero. Shelf prices are untouched by any of this.
 */
import type { ExchangeRate } from '../../admin/types';
import type { LedgerTransaction } from '../../lib/ledgerStore';
import { isUnrecordedCurrency, rateToUsd } from '../../lib/currency';
import { ledgerItemGrams } from '../CurateV2/curatePricing';

export interface ShippingRoute {
  id: string;
  mode: 'air' | 'sea';
  carrier: string | null;
  destination: string | null;
  rate_per_kg: number | null;
  rate_currency: string | null;
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

const perUsd = (rates: readonly ExchangeRate[] | null | undefined, currency: string | null | undefined): number | null =>
  isUnrecordedCurrency(currency) ? 1 : rateToUsd(rates, String(currency));

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
  rates: readonly ExchangeRate[] | null | undefined,
  shopFreightPerKgUsd: number,
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
    let usdPerKg: number | null = null;
    if (route?.rate_per_kg != null) {
      const p = perUsd(rates, route.rate_currency);
      usdPerKg = p ? route.rate_per_kg / p : null;
    } else if (mode === 'air') {
      usdPerKg = shopFreightPerKgUsd;
    }
    if (usdPerKg == null || orderPerUsd == null || amount == null) { amount = null; continue; }
    amount += kg * usdPerKg * orderPerUsd;
  }
  return { amount, packing, modes };
}
