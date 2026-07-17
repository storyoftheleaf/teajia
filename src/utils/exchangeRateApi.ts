import { CostCurrency } from '../types';

/**
 * Preserve the stored account rates when a live refresh is unavailable.
 *
 * The old browser-side exchangerate.host call is unreliable in mainland
 * China. Returning null is intentionally silent: fetchAndSaveExchangeRates
 * leaves the last known rates in localStorage, which is preferable to showing
 * a network error for optional reference data.
 */
export async function fetchLiveExchangeRates(): Promise<Record<CostCurrency, number> | null> {
  return null;
}
