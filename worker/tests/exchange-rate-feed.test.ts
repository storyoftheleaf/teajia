import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FALLBACK_SHIPPING_RATE_CURRENCY } from '../src/shippingRate';

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

/** Every TypeScript source under a directory, as [path relative to src, text]. */
function listSources(root: string, prefix = ''): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listSources(join(root, entry.name), rel));
    else if (/\.tsx?$/.test(entry.name)) out.push([rel, readFileSync(join(root, entry.name), 'utf8')]);
  }
  return out;
}

const worker = read('../src/index.ts');
const feed = read('../src/exchangeRateFeed.ts');
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
  const block = feed.match(/const FX_FEED_CURRENCY_MAP[^=]*=\s*\{([\s\S]*?)\n\};/);
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

  it('covers the currency the shop quotes its freight in', () => {
    // The freight rate is a yuan figure converted to USD on every request, so
    // it is only as live as its exchange row. A freight currency outside the
    // refresh would still price and would still look right, and would never
    // move again — the HKD failure, but on the one number that touches the cost
    // basis of every tea in the shop.
    expect(refreshedCurrencies()).toContain(FALLBACK_SHIPPING_RATE_CURRENCY);
  });

  it('refuses a freight currency it does not keep current', () => {
    // Checked at both doors that can set it, since a value stored through
    // either one is read by the same pricing path.
    expect(worker, 'the account update route accepts any freight currency')
      .toContain('freight_currency_not_refreshed');
    const mcp = read('../src/mcp.ts');
    expect(mcp, 'update_account_settings accepts any freight currency')
      .toContain('refreshedCurrencyName(freightCurrency)');
  });

  it('is the only live rate pass in the app', () => {
    // The browser used to fetch its own rates from a second vendor and merge
    // them under whatever /api/rates returned. The worker prices every tea
    // through the D1 table; the browser only converts an already-computed USD
    // figure for display. So a browser reading a different feed does not make
    // the shop more current, it makes the price the customer reads disagree
    // with the price their order is reconciled at.
    const appSources = listSources(fileURLToPath(new URL('../../src', import.meta.url)));
    const offenders = appSources.filter(([, source]) =>
      /(exchangerate-api\.com|open\.er-api\.com|exchangerate\.host|api\.frankfurter)/.test(source));
    expect(offenders.map(([name]) => name), 'a second currency feed appeared in the app').toEqual([]);
  });

  it('keeps one rate table, so two of them cannot drift apart', () => {
    // There were three: src/utils/currency.ts at CNY 7.25 / IDR 16250, the
    // admin seed constants at 7.2 / 16210, and D1. None looked wrong on its
    // own, and the two in the app were both years out of date. The app holds
    // none now: an unread rate table is an empty list, and an empty list makes
    // the shop quote its own USD rather than a number from 2024.
    const appSources = listSources(fileURLToPath(new URL('../../src', import.meta.url)));
    const offenders = appSources.filter(([, source]) =>
      /(CNY|Yuan)\s*:\s*\d+(\.\d+)?\s*,[\s\S]{0,80}(TWD|NT)\s*:\s*\d+/.test(source));
    expect(offenders.map(([name]) => name),
      'no file in the app may hold a table of exchange rates; there is one, in D1').toEqual([]);
  });

  it('prices the storefront through that one table', () => {
    // useShopPrice is what twelve customer-facing components read. If it ever
    // stops reading useRates, the shop is converting through something else.
    const shopPrice = read('../../src/components/shop/shopPrice.ts');
    expect(shopPrice, 'the storefront no longer reads the shared rate table').toContain('useRates');
    const hook = read('../../src/admin/hooks/useAdminData.ts');
    expect(hook, 'useRates no longer reads /api/rates').toContain('api.rates.list()');
  });

  it('refreshes on every tick rather than once a day', () => {
    // A 24-hour gate meant one good read bought a whole day of not looking, so
    // the table was only ever as current as the moment the gate happened to
    // open. The cron is hourly and the feed is free.
    const fn = worker.match(/async function syncLiveExchangeRates[\s\S]*?\n\}/);
    expect(fn, 'syncLiveExchangeRates moved or was renamed').toBeTruthy();
    expect(fn![0], 'the refresh is gated again; it should run every tick')
      .not.toMatch(/24\s*\*\s*3600|86400000|24\s*\*\s*60\s*\*\s*60/);
  });

  it('keeps yesterday rate rather than letting the shop go down', () => {
    // Adrian's rule, and the one I got backwards once: if the rates cannot be
    // read today, yesterday's rate is better than the whole system going down.
    // Two halves to it. The worker never clears a stored row on a bad fetch,
    // and the browser falls back to the last rates it actually saw rather than
    // to an empty list.
    const fn = worker.match(/async function syncLiveExchangeRates[\s\S]*?\n\}/)![0];
    expect(fn, 'a failed refresh must leave the stored rows standing')
      .not.toMatch(/DELETE\s+FROM\s+exchange_rates|UPDATE\s+exchange_rates\s+SET\s+rate_to_usd\s*=\s*0/i);

    const hook = read('../../src/admin/hooks/useAdminData.ts');
    expect(hook, 'a failed rate read must fall back to the last known rates')
      .toContain('loadLastKnownRates');
    expect(hook, 'a successful read must be remembered for the next bad minute')
      .toContain('saveLastKnownRates');

    // And what it falls back to has to be a remembered reading, never a typed
    // figure. The seeds it replaced were from 2024 and 8% out on IDR.
    const cache = read('../../src/admin/lastKnownRates.ts');
    expect(cache, 'the fallback invented a rate instead of remembering one')
      .not.toMatch(/(IDR|CNY|Yuan|HKD|JPY|MYR|NT|TWD)\s*:\s*\d/);
  });

  it('says out loud when the refresh has stopped for days', () => {
    // The shop keeping yesterday's rate is deliberate. The floor under that is
    // that a rate carries no sign of its own age, so a trade that is safe for a
    // day is invisible for a month: Indonesia priced 8% under the market for
    // months with nothing on any screen saying so.
    expect(worker, 'the tick no longer checks how old the rates are')
      .toContain('reportStaleExchangeRates');

    const banner = read('../../src/admin/components/StaleRatesBanner.tsx');
    const shell = read('../../src/admin/AdminApp.tsx');
    expect(shell, 'the stale-rate warning is not mounted, so nobody sees it')
      .toContain('<StaleRatesBanner />');
    expect(banner, 'the warning does not lead anywhere it can be fixed')
      .toContain('/admin/currency');

    // Both halves must agree on how many days is too many, or the log and the
    // screen tell different stories about the same table.
    const workerDays = worker.match(/STALE_RATES_AFTER_DAYS\s*=\s*(\d+)/);
    const bannerDays = banner.match(/STALE_RATES_AFTER_DAYS\s*=\s*(\d+)/);
    expect(workerDays, 'the worker lost its staleness threshold').toBeTruthy();
    expect(bannerDays, 'the banner lost its staleness threshold').toBeTruthy();
    expect(Number(bannerDays![1])).toBe(Number(workerDays![1]));
  });

  it('never lets the feed move the dollar off one', () => {
    // USD is what the feed is quoted against. A fetched value for it could
    // only ever be noise in the one row that must stay exactly 1.
    const seeded = read('../../db_setup.sql');
    expect(seeded).toContain("('USD', 1.0)");
  });
});
