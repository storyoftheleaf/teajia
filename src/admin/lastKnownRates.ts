/**
 * The last rates this browser successfully read, kept so a bad minute is not a
 * broken shop.
 *
 * Adrian's rule, and it is the right one: if the rates cannot be read today,
 * yesterday's rate is better than the whole system going down. A shop that
 * stops quoting prices because a request failed is worse than a shop quoting a
 * figure a day old, and the difference between the two is a fraction of a
 * percent while the difference in what the customer sees is everything.
 *
 * This is NOT a second rate table. It is a cache of the one table, written only
 * from a successful read of `/api/rates`, and it holds whatever the shop last
 * said rather than a figure anybody typed. That distinction is the whole point:
 * the hardcoded seeds this replaced were from 2024 and had drifted 8% on IDR
 * without ever looking wrong. A cached rate carries the date it was read, so it
 * can say how old it is; an invented one cannot.
 *
 * Per browser, so it does not travel and does not need to. The durable copy is
 * `exchange_rates` in D1, refreshed hourly by the worker.
 */
import type { ExchangeRate } from './types';

const KEY = 'teajia.rates.lastKnown';

/** Rates from the most recent successful read, or an empty list on a cold browser. */
export function loadLastKnownRates(): ExchangeRate[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r: any) => r && typeof r.currency === 'string' && Number.isFinite(Number(r.rateToUSD)) && Number(r.rateToUSD) > 0,
    ) as ExchangeRate[];
  } catch {
    // Private browsing, disabled storage, corrupt value. The shop still runs.
    return [];
  }
}

/** Remember a successful read. Never called with an empty or partial list. */
export function saveLastKnownRates(rates: ExchangeRate[]): void {
  if (!rates || rates.length === 0) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(rates));
  } catch {
    // A shop that cannot write to storage still sells.
  }
}
