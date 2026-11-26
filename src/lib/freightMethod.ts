/**
 * How a tea travels home (migration 0148, Adrian 2026-11-26): Suitcase,
 * Airmail or Boat. Each names a shipping route in Settings, and a tea with a
 * method takes that route's rate in place of the shop's. The order, highest
 * first:
 *
 *   1. a rate typed on the tea itself (shipping_rate_per_kg), zero included;
 *   2. the tea's method, when that method has a route with a rate;
 *   3. the shop rate.
 *
 * A method whose route has no rate falls through to the shop rate rather than
 * printing no price, which is what an Air route with no rate has always done.
 * The route's rate is read at use time, never copied into the tea's row, so
 * changing it in Settings reprices every tea on that method at once. Only the
 * per-kilo rate is used: packing, billing steps and minimums are per parcel,
 * and stay with the buying basket's order estimate.
 */
export const FREIGHT_METHODS = ['suitcase', 'air', 'sea'] as const;
export type FreightMethod = typeof FREIGHT_METHODS[number];

export function isFreightMethod(value: unknown): value is FreightMethod {
  return typeof value === 'string' && (FREIGHT_METHODS as readonly string[]).includes(value);
}

export interface FreightDefaults {
  /** The shop rate in USD a kilo, or null while its conversion is unavailable. */
  shopPerKgUsd: number | null;
  /** Per method: the route's rate in USD a kilo; null when the route has a rate
      that cannot be converted today; absent when the method has no rated route. */
  methodPerKgUsd: Partial<Record<FreightMethod, number | null>>;
}

/** The fallback rate a tea takes when it has no rate of its own. */
export function freightDefaultFor(method: unknown, defaults: FreightDefaults): number | null {
  if (isFreightMethod(method) && method in defaults.methodPerKgUsd) return defaults.methodPerKgUsd[method] ?? null;
  return defaults.shopPerKgUsd;
}

export interface RouteRateRow { mode: string; rate_per_kg: number | null; rate_currency: string | null }

/**
 * Each method's rate from a shop's routes: the oldest live route of that mode
 * that has a rate. `rows` must already exclude archived routes.
 */
export function methodRatesFromRoutes(
  rows: readonly RouteRateRow[],
  rateToUsd: (currency: string) => number | null | undefined,
): FreightDefaults['methodPerKgUsd'] {
  const out: FreightDefaults['methodPerKgUsd'] = {};
  for (const row of rows) {
    if (!isFreightMethod(row.mode) || row.mode in out) continue;
    const perKg = row.rate_per_kg;
    if (perKg === null || perKg === undefined || !Number.isFinite(Number(perKg))) continue;
    if (Number(perKg) === 0) { out[row.mode] = 0; continue; }
    const rate = row.rate_currency ? rateToUsd(row.rate_currency) : undefined;
    out[row.mode] = typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? Number(perKg) / rate : null;
  }
  return out;
}

/** The word Adrian uses for each method. */
export const FREIGHT_METHOD_WORD: Record<FreightMethod, string> = { suitcase: 'Suitcase', air: 'Airmail', sea: 'Boat' };
