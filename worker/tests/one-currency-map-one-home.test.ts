/**
 * One alias map, in one home, and no rate of 1 for a currency we cannot resolve.
 *
 * The exchange table keys yuan as 'Yuan', so 'CNY' and 'Yuan' are the same money
 * spelled two ways. The worker knew that and canonicalised. The admin did not:
 * it had eleven exact `===` lookups that fell back to a rate of 1, so 22 real
 * teas recorded as 'CNY' or 'YUAN' had their yuan costs read as dollars in the
 * dashboard, priced at nothing at all in the inventory preview, and would have
 * had a pinned freight rate of 85 yuan shown as $85.00.
 *
 * A rate of 1 does not fail. It hands back a figure nearly seven times too big
 * and the markup triples it, and it surfaces as an expensive tea rather than as
 * a fault. So this file pins three things: the map has one home, every door
 * that writes a currency canonicalises rather than uppercases, and nothing in
 * the admin resolves a missing rate to 1.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  CURRENCY_ALIASES,
  canonicalCurrency,
  isoCurrencyCode,
  rateToUsd,
  sameCurrency,
} from '../../src/lib/currency';
import { canonicalCurrency as workerCanonicalCurrency } from '../src/teaMasterSales';
import { FX_FEED_CURRENCY_MAP, refreshedCurrencyName, isRefreshedCurrency } from '../src/exchangeRateFeed';
import { shippingRateUsdFor, shopRateInCurrency } from '../../src/lib/shippingRate';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** Source with comments stripped, so a guard cannot be satisfied by deleting
 *  the paragraph that explains why it exists. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === 'node_modules' || name === '.git' || name === 'dist') continue;
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

/* The live sandbox rates table, read on 2026-09-09. It keys yuan as 'Yuan' and
   the Taiwan dollar as 'NT', and carries no 'CNY' or 'YUAN' row at all. */
const RATES = [
  { currency: 'Yuan', rateToUSD: 6.728858 },
  { currency: 'NT', rateToUSD: 31.630012 },
  { currency: 'HKD', rateToUSD: 7.840994 },
  { currency: 'IDR', rateToUSD: 17674.218391 },
  { currency: 'JPY', rateToUSD: 156.156625 },
  { currency: 'MYR', rateToUSD: 4.044043 },
  { currency: 'AUD', rateToUSD: 1.388189 },
  { currency: 'USD', rateToUSD: 1 },
];

describe('the resolver maps every alias the rates table might meet', () => {
  it.each([
    ['CNY', 'Yuan'],
    ['cny', 'Yuan'],
    ['Cny', 'Yuan'],
    ['YUAN', 'Yuan'],
    ['yuan', 'Yuan'],
    ['Yuan', 'Yuan'],
    ['RMB', 'Yuan'],
    ['renminbi', 'Yuan'],
    ['CNH', 'Yuan'],
    ['¥', 'Yuan'],
    ['CN¥', 'Yuan'],
    ['TWD', 'NT'],
    ['twd', 'NT'],
    ['NT', 'NT'],
    ['MOP', 'HKD'],
    ['HKD', 'HKD'],
    ['USD', 'USD'],
    ['  CNY  ', 'Yuan'],
  ])('%s resolves to %s', (input, expected) => {
    expect(canonicalCurrency(input)).toBe(expected);
  });

  it('every ISO code the daily refresh covers resolves to the shop name it stores under', () => {
    // FX_FEED_CURRENCY_MAP is the shop's own declaration of which feed code
    // means which shop key. The alias map must agree with it, or a currency the
    // shop refreshes daily is one the admin cannot look up.
    for (const [iso, shopName] of Object.entries(FX_FEED_CURRENCY_MAP)) {
      expect(canonicalCurrency(iso), `${iso} should resolve to ${shopName}`).toBe(shopName);
    }
  });

  it('resolves an alias to a real rate, and the same rate the shop key gets', () => {
    expect(rateToUsd(RATES, 'CNY')).toBe(6.728858);
    expect(rateToUsd(RATES, 'YUAN')).toBe(6.728858);
    expect(rateToUsd(RATES, 'Yuan')).toBe(6.728858);
    expect(rateToUsd(RATES, 'TWD')).toBe(31.630012);
  });

  it('refuses an unknown currency with null, never 1', () => {
    for (const unknown of ['XYZ', 'BTC', 'GBP', 'EUR', 'UNK', '', null, undefined]) {
      const answer = rateToUsd(RATES, unknown as string);
      expect(answer, `${unknown} must not resolve`).toBeNull();
      expect(answer).not.toBe(1);
    }
  });

  it('refuses a rate row that is zero, negative or not a number', () => {
    expect(rateToUsd([{ currency: 'Yuan', rateToUSD: 0 }], 'CNY')).toBeNull();
    expect(rateToUsd([{ currency: 'Yuan', rateToUSD: -3 }], 'CNY')).toBeNull();
    expect(rateToUsd([{ currency: 'Yuan', rateToUSD: NaN }], 'CNY')).toBeNull();
    expect(rateToUsd(null, 'CNY')).toBeNull();
  });

  it('knows two spellings of one money are one money', () => {
    expect(sameCurrency('CNY', 'Yuan')).toBe(true);
    expect(sameCurrency('YUAN', 'Yuan')).toBe(true);
    expect(sameCurrency('TWD', 'NT')).toBe(true);
    expect(sameCurrency('CNY', 'HKD')).toBe(false);
    expect(sameCurrency(null, 'Yuan')).toBe(false);
  });

  it('gives Intl a code it will accept, for the shop keys it refuses', () => {
    // new Intl.NumberFormat(_, { currency: 'Yuan' }) throws a RangeError, which
    // inside the PDF renderer is no invoice at all rather than a wrong one.
    for (const key of ['Yuan', 'CNY', 'NT', 'TWD', 'UNK', 'USD', 'HKD', 'nonsense']) {
      const code = isoCurrencyCode(key);
      expect(() => new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(1)).not.toThrow();
    }
    expect(isoCurrencyCode('Yuan')).toBe('CNY');
    expect(isoCurrencyCode('CNY')).toBe('CNY');
    expect(isoCurrencyCode('NT')).toBe('TWD');
    expect(isoCurrencyCode('UNK')).toBe('USD');
  });
});

describe('the map has one home', () => {
  it('the worker re-exports the shared one rather than keeping a copy', () => {
    expect(workerCanonicalCurrency('CNY')).toBe('Yuan');
    expect(workerCanonicalCurrency('TWD')).toBe('NT');
    expect(workerCanonicalCurrency).toBe(canonicalCurrency);
  });

  it('no second alias table is declared anywhere under worker/src or src', () => {
    /* `exchangeRateFeed.ts` names CNY beside 'Yuan' for a different job: it is
       the join between the FEED's codes and the shop's, and it is also the
       definition of which currencies the shop keeps current. The test above
       pins the two to agree, which is the property that matters. */
    const files = [...walk('worker/src'), ...walk('src')];
    const ALLOWED = new Set(['src/lib/currency.ts', 'worker/src/exchangeRateFeed.ts']);
    const offenders: string[] = [];
    for (const file of files) {
      if (ALLOWED.has(file)) continue;
      const src = stripComments(read(file));
      // An object literal that maps a yuan spelling onto the shop's key is a
      // second copy of this map, whatever it is called.
      if (/['"]?(cny|rmb|renminbi|yuan)['"]?\s*:\s*['"]Yuan['"]/i.test(src)) {
        offenders.push(file);
      }
    }
    expect(offenders, 'a second currency alias map appeared').toEqual([]);
  });

  it('the shop refuses a currency by what it means, not how it is spelled', () => {
    // refreshedCurrencyName gates set_cost_currency and the shop freight rate.
    // Before it canonicalised, answering 'CNY' was refused as a currency the
    // shop keeps no live rate for, while the shop refreshed it daily as 'Yuan'.
    expect(refreshedCurrencyName('CNY')).toBe('Yuan');
    expect(refreshedCurrencyName('yuan')).toBe('Yuan');
    expect(refreshedCurrencyName('TWD')).toBe('NT');
    expect(isRefreshedCurrency('CNY')).toBe(true);
    expect(isRefreshedCurrency('GBP')).toBe(false);
  });
});

describe('update_tea_pricing stores the shop key, not what was typed', () => {
  const mcp = stripComments(read('worker/src/mcp.ts'));

  it('canonicalises cost_currency instead of uppercasing it', () => {
    // The defect, verbatim: String(args.cost_currency).toUpperCase().trim().
    // It turned 'cny' and 'Yuan' into 'CNY' and 'YUAN', labels the exchange
    // table has no row for, one call at a time.
    expect(mcp).not.toMatch(/cost_currency\s*\)\s*\.toUpperCase\(\)/);
    expect(mcp).not.toMatch(/String\(args\.cost_currency\)\.toUpperCase\(\)/);
    expect(mcp).toMatch(/canonicalCurrency\(String\(args\.cost_currency\)\.trim\(\)\)/);
  });

  it('both product-writing doors go through the same map', () => {
    // create_tea and update_tea_pricing. create_tea was already right and
    // update_tea_pricing was not, which is how the rows kept being made.
    const canonicalised = mcp.match(/canonicalCurrency\(String\(args[?.]*\.cost_currency\)\.trim\(\)\)/g) ?? [];
    expect(canonicalised.length).toBeGreaterThanOrEqual(2);
  });

  it('the shared map turns every spelling those doors accept into a stored key', () => {
    // What the doors above will now write, for each thing a caller might say.
    for (const typed of ['cny', 'CNY', 'YUAN', 'yuan', 'Yuan', 'RMB', ' cny ']) {
      expect(canonicalCurrency(typed.trim())).toBe('Yuan');
    }
  });
});

describe('nothing in the admin resolves a missing rate to 1', () => {
  const adminFiles = [...walk('src/admin'), 'src/lib/shippingRate.ts'];

  it('no exact === comparison against a shop currency key survives', () => {
    /* A stored currency is compared canonically or not at all: 'CNY' === 'Yuan'
       is false and the two are the same money.

       Scoped to the keys where that actually bites: the shop's two non-ISO
       names, and the yuan spellings the doors wrote. A comparison against
       'IDR' or 'HKD' is a comparison against a code that is also the shop's
       key, so it cannot miss. `src/lib/currency.ts` is exempt because it IS
       the map, and it is the only exemption. */
    const names = ['Yuan', 'CNY', 'YUAN', 'RMB', 'NT', 'TWD'];
    const offenders: string[] = [];
    for (const file of adminFiles) {
      const src = stripComments(read(file));
      for (const name of names) {
        // `x === 'Yuan'` and `'Yuan' === x`, in either quote style.
        const re = new RegExp(`(===|!==)\\s*['"\`]${name}['"\`]|['"\`]${name}['"\`]\\s*(===|!==)`);
        if (re.test(src)) offenders.push(`${file}: ${name}`);
      }
    }
    expect(offenders, 'a currency compared by string equality').toEqual([]);
  });

  it('no rate lookup falls back to 1', () => {
    /* `shopFreightDefaultFrom` is the one allowed `|| 1`, and it is a different
       failure: it is reached only when the rate table is EMPTY, not when a
       currency is spelled differently, and `ShopFreightDefault.perKgUsd` is a
       number every surface renders, so declining there needs a nullable field
       and a dash in four places. Left as it stands, deliberately, and named
       here so it is a decision rather than an oversight. */
    const ALLOWED = new Set(['src/lib/shippingRate.ts']);
    const offenders: string[] = [];
    for (const file of adminFiles) {
      if (ALLOWED.has(file)) continue;
      const src = stripComments(read(file));
      // `...rateToUSD || 1`, `...rateToUSD ?? 1`, and the rate-object ternary.
      if (/rateToUSD\s*(\|\||\?\?)\s*1\b/.test(src)) offenders.push(`${file}: rateToUSD fallback to 1`);
      if (/rateTo[Uu]sd\([^)]*\)\s*(\|\||\?\?)\s*1\b/.test(src) && !/callerCurrency === 'USD'/.test(src)) {
        offenders.push(`${file}: resolver fallback to 1`);
      }
      if (/rateObj\s*\?\s*rateObj\.rateToUSD\s*:\s*1\b/.test(src)) {
        offenders.push(`${file}: rate ternary to 1`);
      }
    }
    expect(offenders, 'a missing rate read as 1').toEqual([]);
  });

  it('the freight helpers decline rather than divide by 1', () => {
    // A tea pinned to 85 in a currency with no rate. At a rate of 1 this
    // printed $85.00 under a dollar heading; the true figure is $12.63.
    expect(shippingRateUsdFor(85, null, 12.63)).toBeNull();
    expect(shippingRateUsdFor(85, 6.728858, 12.63)).toBeCloseTo(12.63, 2);
    // A tea with nothing recorded still shows the shop rate, which is already
    // in dollars and needs no rate at all. That must not become a dash.
    expect(shippingRateUsdFor(null, null, 12.63)).toBe(12.63);
    expect(shopRateInCurrency(12.63, null)).toBeNull();
    expect(shopRateInCurrency(85 / 6.728858, 6.728858)).toBeCloseTo(85, 6);
  });
});
