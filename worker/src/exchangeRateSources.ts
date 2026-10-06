import { FX_FEED_CURRENCY_MAP } from './exchangeRateFeed';

/**
 * Where the daily rate refresh reads its numbers from, and what it says when
 * none of them answers.
 *
 * There used to be one feed. When it stopped answering, the refresh returned
 * false without a word, the rates aged for days, and nothing recorded why: the
 * worker keeps no logs, so "open.er-api was down" and "open.er-api changed its
 * shape" and "the worker was blocked" were indistinguishable afterwards. Two
 * changes fix that. A second, independent free feed sits behind the first, so
 * one vendor having a bad week no longer freezes the dollar. And every failed
 * attempt now says what it saw, so the reason travels with the result into the
 * problem ledger instead of evaporating.
 *
 * This module is pure apart from the injected `fetch`, which is what makes the
 * parsing testable without a network. It never touches the database: deciding
 * to write (and never to delete or zero) stays in `syncLiveExchangeRates`.
 */

/** Rates keyed by the FEED's ISO code (CNY, TWD...), units per one USD. */
export type FeedRates = Record<string, number>;

export type FeedParse =
  | { ok: true; rates: FeedRates }
  | { ok: false; reason: string };

export type FeedSource = {
  /** Plain-English name, used verbatim in the failure reason. */
  name: string;
  url: string;
  parse: (body: unknown) => FeedParse;
};

/**
 * Keep only the currencies the shop maps, and only numbers that can be a rate.
 * A non-finite or non-positive value is dropped rather than trusted, for the
 * same reason the writer skips it: a zero rate prices every tea in that
 * currency at nothing, and it would look like a cheap tea rather than a fault.
 */
function usableRates(raw: Record<string, unknown>, upperCaseKeys: boolean): FeedRates {
  const out: FeedRates = {};
  for (const [key, value] of Object.entries(raw)) {
    const code = upperCaseKeys ? key.toUpperCase() : key;
    if (!Object.prototype.hasOwnProperty.call(FX_FEED_CURRENCY_MAP, code)) continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
    out[code] = value;
  }
  return out;
}

function nothingUsable(name: string): FeedParse {
  return { ok: false, reason: `${name} sent no usable rates` };
}

/** open.er-api.com: `{ result: 'success', rates: { CNY: 7.1, ... } }`. */
export function parseErApi(body: unknown): FeedParse {
  const b = body as { result?: unknown; rates?: unknown } | null;
  if (!b || typeof b !== 'object') return { ok: false, reason: 'open.er-api sent a body that was not JSON' };
  if (b.result !== 'success') return { ok: false, reason: 'open.er-api did not report success' };
  if (!b.rates || typeof b.rates !== 'object') return nothingUsable('open.er-api');
  const rates = usableRates(b.rates as Record<string, unknown>, false);
  return Object.keys(rates).length > 0 ? { ok: true, rates } : nothingUsable('open.er-api');
}

/**
 * fawazahmed0/currency-api: `{ date, usd: { cny: 7.1, ... } }`. Lowercase keys,
 * and units per one USD, the same direction as er-api's `rates`, so the numbers
 * go straight into the same table.
 */
export function parseCurrencyApi(name: string) {
  return (body: unknown): FeedParse => {
    const b = body as { usd?: unknown } | null;
    if (!b || typeof b !== 'object') return { ok: false, reason: `${name} sent a body that was not JSON` };
    if (!b.usd || typeof b.usd !== 'object') return nothingUsable(name);
    const rates = usableRates(b.usd as Record<string, unknown>, true);
    return Object.keys(rates).length > 0 ? { ok: true, rates } : nothingUsable(name);
  };
}

/** In the order they are tried. The first is the one the shop has always used. */
export const FEED_SOURCES: FeedSource[] = [
  { name: 'open.er-api', url: 'https://open.er-api.com/v6/latest/USD', parse: parseErApi },
  {
    name: 'backup feed',
    url: 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json',
    parse: parseCurrencyApi('backup feed'),
  },
  {
    name: 'second backup feed',
    url: 'https://latest.currency-api.pages.dev/v1/currencies/usd.json',
    parse: parseCurrencyApi('second backup feed'),
  },
];

export type LiveRatesResult =
  | { ok: true; source: string; rates: FeedRates }
  | { ok: false; reason: string };

/**
 * Try each feed in turn and stop at the first that yields rates.
 *
 * A failure is never thrown out of here: the caller's contract is that a bad
 * feed leaves the stored rows standing, so every failure mode, a refused
 * request, a thrown network error, a malformed body, is folded into the reason
 * string and the next feed is tried.
 */
export async function fetchLiveRates(
  fetchImpl: typeof fetch = fetch,
  sources: FeedSource[] = FEED_SOURCES,
): Promise<LiveRatesResult> {
  const failures: string[] = [];
  for (const source of sources) {
    try {
      const resp = await fetchImpl(source.url, {
        headers: { 'User-Agent': 'teajia-worker/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!resp.ok) {
        failures.push(`${source.name} answered ${resp.status}`);
        continue;
      }
      let body: unknown;
      try {
        body = await resp.json();
      } catch {
        failures.push(`${source.name} sent a body that was not JSON`);
        continue;
      }
      const parsed = source.parse(body);
      if (parsed.ok) return { ok: true, source: source.name, rates: parsed.rates };
      failures.push(parsed.reason);
    } catch (err) {
      const why = err instanceof Error && err.name ? err.name : 'error';
      failures.push(`${source.name} could not be reached (${why})`);
    }
  }
  return { ok: false, reason: failures.join('; ') };
}

/**
 * The outcome of one refresh tick, in words a person can read later.
 * `refreshed` is true only when rates were written.
 */
export type RateRefreshResult = {
  refreshed: boolean;
  /** Set when the refresh did not run because the rates were still fresh. */
  skipped?: 'fresh';
  /** Which feed supplied the rates, when it worked. */
  source?: string;
  /** Plain reason, when it did not work. */
  reason?: string;
};

export type RateRow = { currency: string; last_updated: string | null };

/**
 * Which stored rates are older than the threshold. A row with no readable date
 * counts as stale with `days: null`, because a rate nobody can date is exactly
 * the kind that has been standing for a long time.
 */
export function staleRateRows(
  rows: RateRow[],
  now: number,
  thresholdDays: number,
): Array<{ currency: string; days: number | null }> {
  const stale: Array<{ currency: string; days: number | null }> = [];
  for (const row of rows) {
    if (!row.last_updated) { stale.push({ currency: row.currency, days: null }); continue; }
    const at = new Date(`${String(row.last_updated).replace(' ', 'T')}Z`).getTime();
    if (!Number.isFinite(at)) { stale.push({ currency: row.currency, days: null }); continue; }
    const days = (now - at) / 86400000;
    if (days > thresholdDays) stale.push({ currency: row.currency, days: Math.round(days) });
  }
  return stale;
}

/** The plain-English line the problem ledger carries for stale rates. */
export function staleRatesMessage(
  stale: Array<{ currency: string; days: number | null }>,
  lastAttempt: string | undefined,
): string {
  const dated = stale.map(s => s.days).filter((d): d is number => d !== null);
  const age = dated.length > 0
    ? `Exchange rates last refreshed ${Math.max(...dated)} days ago.`
    : 'Exchange rates have no readable refresh date.';
  return lastAttempt ? `${age} Last attempt: ${lastAttempt}.` : age;
}
