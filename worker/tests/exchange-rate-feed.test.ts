import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Every currency a tea can be bought in gets refreshed, every day.
 *
 * A tea's cost is recorded in whatever it was paid for, and the shop converts
 * that to a shelf price on every request. So one row of `exchange_rates`
 * decides what a whole country pays, and a rate nobody refreshes goes stale
 * while looking exactly like a current one.
 *
 * The worker already refreshes them from a free feed on its daily tick. What
 * it did not do was cover the list: HKD was absent from the map, so the
 * twenty-seven lots bought in Hong Kong dollars priced off a seeded figure
 * indefinitely. Nothing failed, nothing logged, the prices were simply wrong.
 *
 * These scans exist so that adding a currency to the shop and forgetting the
 * feed is a failing test rather than a slow leak.
 */

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const worker = read('../src/index.ts');
const adminTypes = read('../../src/admin/types.ts');

/** The currencies the app lets an operator record a cost in. */
function shopCurrencies(): string[] {
  const union = adminTypes.match(/export type Currency\s*=\s*([^;]+);/);
  if (!union) throw new Error('the Currency union moved; this guard needs its new home');
  return [...union[1].matchAll(/'([^']+)'/g)]
    .map(m => m[1])
    // Not a currency: the sentinel for a cost whose currency was never recorded.
    .filter(c => c !== 'UNK');
}

/** The shop-side names the feed map can produce. */
function refreshedCurrencies(): string[] {
  const block = worker.match(/const FX_FEED_CURRENCY_MAP[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (!block) throw new Error('FX_FEED_CURRENCY_MAP moved or was renamed');
  return [...block[1].matchAll(/[A-Z]{3}:\s*'([^']+)'/g)].map(m => m[1]);
}

describe('the daily rate refresh', () => {
  it('covers every currency a tea can be costed in', () => {
    const refreshed = new Set(refreshedCurrencies());
    const missing = shopCurrencies().filter(c => !refreshed.has(c));
    expect(missing, 'these currencies would never refresh, so their prices go stale in silence').toEqual([]);
  });

  it('runs on a schedule, which is the only thing that makes it daily', () => {
    // The function can be perfect and still never run. The worker deploys by
    // hand, so a cron missing from wrangler.toml is a refresh that exists only
    // in the repository.
    const wrangler = read('../wrangler.toml');
    expect(wrangler, 'no cron trigger, so scheduled() never fires').toMatch(/\[triggers\][\s\S]*crons\s*=/);
    expect(worker, 'the scheduled tick no longer refreshes rates').toContain('syncLiveExchangeRates(env)');
  });

  it('leaves the old rate standing when the feed is unreachable', () => {
    // A shop that keeps yesterday's dollar keeps selling. One that zeroes a
    // rate on a timeout gives its tea away, and every price on the site is
    // computed through this number.
    const fn = worker.match(/async function syncLiveExchangeRates[\s\S]*?\n\}/);
    expect(fn, 'syncLiveExchangeRates moved or was renamed').toBeTruthy();
    const body = fn![0];
    expect(body).toMatch(/if\s*\(!resp\.ok\)\s*return false/);
    expect(body).toMatch(/rateToUsd\s*<=\s*0\)\s*continue/);
  });

  it('never lets the feed move the dollar off one', () => {
    // USD is what the feed is quoted against. A fetched value for it could
    // only ever be noise in the one row that must stay exactly 1.
    const seeded = read('../../db_setup.sql');
    expect(seeded).toContain("('USD', 1.0)");
  });
});
