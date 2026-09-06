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
    // src/utils/currency.ts carried its own: CNY 7.25, IDR 16250, HKD 7.75,
    // against the shop's 7.2, 16210, 7.8, keyed by ISO code where the shop keys
    // CNY as 'Yuan'. Neither table looked wrong on its own, which is the whole
    // problem with having two.
    const appSources = listSources(fileURLToPath(new URL('../../src', import.meta.url)));
    const seedFile = 'admin/constants.ts';
    const offenders = appSources.filter(([name, source]) =>
      name !== seedFile && /(CNY|Yuan)\s*:\s*\d+(\.\d+)?\s*,[\s\S]{0,80}(TWD|NT)\s*:\s*\d+/.test(source));
    expect(offenders.map(([name]) => name),
      `only ${seedFile} may hold a table of exchange rates`).toEqual([]);
  });

  it('prices the storefront through that one table', () => {
    // useShopPrice is what twelve customer-facing components read. If it ever
    // stops reading useRates, the shop is converting through something else.
    const shopPrice = read('../../src/components/shop/shopPrice.ts');
    expect(shopPrice, 'the storefront no longer reads the shared rate table').toContain('useRates');
    const hook = read('../../src/admin/hooks/useAdminData.ts');
    expect(hook, 'useRates no longer reads /api/rates').toContain('api.rates.list()');
  });

  it('never lets the feed move the dollar off one', () => {
    // USD is what the feed is quoted against. A fetched value for it could
    // only ever be noise in the one row that must stay exactly 1.
    const seeded = read('../../db_setup.sql');
    expect(seeded).toContain("('USD', 1.0)");
  });
});
