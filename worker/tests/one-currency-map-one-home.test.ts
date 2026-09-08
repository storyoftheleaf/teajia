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
import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  CURRENCY_ALIASES,
  SHOP_CURRENCY_KEYS,
  canonicalCurrency,
  currencyInText,
  isUnrecordedCurrency,
  isoCurrencyCode,
  knownCurrency,
  rateToUsd,
  sameCurrency,
} from '../../src/lib/currency';
import { normalizeCurrency, detectCurrencyToken } from '../../src/admin/lib/intakeMapping';
import { normalizeImportCurrency } from '../../src/admin/lib/csvImportRows';
import { canonicalCurrency as workerCanonicalCurrency } from '../src/teaMasterSales';
import { FX_FEED_CURRENCY_MAP, refreshedCurrencyName, isRefreshedCurrency } from '../src/exchangeRateFeed';
import { shippingRateUsdFor, shopRateInCurrency } from '../../src/lib/shippingRate';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { calculatePricing, formatCurrency } from '../../src/admin/utils';
import worker from '../src/index';

const ROOT = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** Source with comments stripped, so a guard cannot be satisfied by deleting
 *  the paragraph that explains why it exists. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * The files allowed to say what a currency spelling means, and why each is.
 *
 * `src/lib/currency.ts` is the map. `exchangeRateFeed.ts` names CNY beside
 * 'Yuan' for a different job: the join between the FEED's codes and the shop's,
 * which is also the definition of which currencies the shop keeps current.
 *
 * The two curate-import files translate a PROVIDER's spelling into an ISO code,
 * which is a different namespace from the shop's keys and cannot be swapped for
 * the shared map without changing what they store: they write
 * `inventory_receipt_lines.original_cost_currency`, which this shop treats as
 * evidence of what was actually paid and reads live rather than copying, and
 * they accept EUR and GBP, which the shop keys no money under at all. They are
 * pinned to agree with the shared map instead, below.
 */
const ALIAS_MAP_HOMES = new Set([
  'src/lib/currency.ts',
  'worker/src/exchangeRateFeed.ts',
  'worker/src/curateImportCanonical.ts',
  'worker/src/curateImportAnalysis.ts',
]);

/* The shop's own two non-ISO names, as string literals. Everything that
   translates a spelling has to produce one of these, so a second alias table
   always has one of them within a line or so of a spelling of the same money. */
const SHOP_KEY_LITERAL = /['"`](Yuan|NT)['"`]/gi;

/* Spellings distinctive enough to be evidence on their own. Deliberately not
   'NT', 'RM', 'HK', 'EN' or '$': those are short enough to appear in ordinary
   code, and a guard that cries wolf on ordinary code gets switched off. */
const YUAN_SPELLINGS = ['CNY', 'RMB', 'RENMINBI', 'CNH'];
const TWD_SPELLINGS = ['TWD', 'NTD'];
/* 'Yuan' and 'NT' are absent on purpose: they are the shop's own keys, so a
   list of them beside each other is the Currency union or a dropdown, not a
   translation. Seven such lists were flagged before this was scoped down, and
   a guard that fires on the type declaration is a guard somebody deletes. */
const ALL_SPELLINGS = [...YUAN_SPELLINGS, ...TWD_SPELLINGS];

/**
 * Does this source declare what a currency spelling MEANS?
 *
 * Two shapes, because the first guard only knew one of them and two live copies
 * written in the other sat under `src/admin/lib` the whole time it was passing.
 *
 *   1. A spelling sitting next to one of the shop's own keys, whatever the
 *      punctuation between them: `cny: 'Yuan'`, `['RMB','CNY'].includes(c))
 *      return 'Yuan'`, `c === 'CNY' ? 'Yuan' : …`, a switch, an indexOf.
 *   2. Two or more spellings of the SAME money quoted together, which is a list
 *      of aliases even when the key it resolves to is somewhere else.
 *
 * Returns the offending text, or null.
 */
function aliasTableIn(src: string): string | null {
  const quoted = (word: string) =>
    new RegExp(`['"\`]${word.replace(/\$/g, '\\$')}['"\`]`, 'i');

  for (const family of [YUAN_SPELLINGS, TWD_SPELLINGS]) {
    const seen = family.filter((word) => quoted(word).test(src));
    if (seen.length >= 2) return `two spellings of one money quoted together (${seen.join(', ')})`;
  }

  const keys = [...src.matchAll(SHOP_KEY_LITERAL)];
  if (keys.length === 0) return null;
  for (const word of ALL_SPELLINGS) {
    const hits = [...src.matchAll(new RegExp(`\\b${word}\\b`, 'gi'))];
    for (const hit of hits) {
      for (const key of keys) {
        if (hit[0].toUpperCase() === key[1].toUpperCase()) continue;
        if (Math.abs((hit.index ?? 0) - (key.index ?? 0)) <= 40) {
          return `${hit[0]} declared as ${key[0]}`;
        }
      }
    }
  }
  return null;
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

  it('a recognised code comes back in the shop spelling whatever case was typed', () => {
    /* The doors WRITE this answer into products.cost_currency, and the rate
       lookup is a string match on the column, so casing is not cosmetic here.
       Removing the doors' `.toUpperCase()` without moving case-normalisation
       into the map made canonicalCurrency('hkd') answer 'hkd': a spelling no
       rate row carries and no migration covers, saved one call at a time. */
    for (const [typed, stored] of [
      ['hkd', 'HKD'], ['Hkd', 'HKD'], ['HKD', 'HKD'],
      ['usd', 'USD'], ['uSd', 'USD'],
      ['idr', 'IDR'], ['jpy', 'JPY'], ['myr', 'MYR'], ['aud', 'AUD'],
      ['nt', 'NT'], ['Nt', 'NT'], ['twd', 'NT'],
      ['yuan', 'Yuan'], ['YUAN', 'Yuan'], ['cny', 'Yuan'],
      ['unk', 'UNK'], ['Unk', 'UNK'],
    ]) {
      expect(canonicalCurrency(typed), `${typed} should store as ${stored}`).toBe(stored);
    }
    // Every shop key survives a round trip through its own lower case.
    for (const key of SHOP_CURRENCY_KEYS) {
      expect(canonicalCurrency(key.toLowerCase())).toBe(key);
      expect(canonicalCurrency(key.toUpperCase())).toBe(key);
    }
  });

  it('a code the shop does not know is uppercased, never lower-cased', () => {
    // Nothing new should arrive in a spelling the table cannot later be taught.
    expect(canonicalCurrency('gbp')).toBe('GBP');
    expect(canonicalCurrency('  eur  ')).toBe('EUR');
    expect(canonicalCurrency('nonsense')).toBe('NONSENSE');
    // And it still prices at nothing, because the shop holds no rate for it.
    expect(rateToUsd(RATES, 'gbp')).toBeNull();
  });

  it('knownCurrency answers only for money the shop recognises', () => {
    expect(knownCurrency('cny')).toBe('Yuan');
    expect(knownCurrency('NTD')).toBe('NT');
    expect(knownCurrency('RM')).toBe('MYR');
    expect(knownCurrency('hk$')).toBe('HKD');
    expect(knownCurrency('gbp')).toBeNull();
    expect(knownCurrency('')).toBeNull();
    expect(knownCurrency(null)).toBeNull();
  });

  it('nobody wrote a currency down is not the same as the shop has no rate', () => {
    for (const nothing of [null, undefined, '', '   ', 'UNK', 'unk']) {
      expect(isUnrecordedCurrency(nothing as string), `${nothing} means nobody said`).toBe(true);
    }
    for (const named of ['Yuan', 'CNY', 'GBP', 'USD']) {
      expect(isUnrecordedCurrency(named), `${named} is a currency somebody named`).toBe(false);
    }
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
    const offenders: string[] = [];
    for (const file of files) {
      if (ALIAS_MAP_HOMES.has(file)) continue;
      const found = aliasTableIn(stripComments(read(file)));
      if (found) offenders.push(`${file}: ${found}`);
    }
    expect(offenders, 'a second currency alias map appeared').toEqual([]);
  });

  it('the detector refuses a second map however it is written, and passes ordinary code', () => {
    /* The guard above used to look only for the object-literal shape, so two
       live copies written as includes() ladders sat under src/admin/lib for as
       long as it had been running: the intake sheet mapper and the CSV import
       row builder, eight currencies each, one of them missing AUD and MYR. A
       guard is only worth what a synthetic violation proves it catches, so it
       is fed one of each shape here. */
    const REFUSED: [string, string][] = [
      ['object literal', `const m = { cny: 'Yuan', twd: 'NT' };`],
      ['includes ladder', `if (['RMB', 'CNY', 'YUAN'].includes(c)) return 'Yuan';`],
      ['includes ladder, no quotes on the key', `if (["nt", "twd", "ntd"].includes(c)) return "NT";`],
      ['ternary ladder', `const k = c === 'CNY' ? 'Yuan' : c === 'TWD' ? 'NT' : c;`],
      ['switch', `switch (c) { case 'RMB': case 'CNY': return 'Yuan'; }`],
      ['a bare list of spellings of one money', `const YUAN = ['CNY', 'RMB', 'YUAN'];`],
      ['indexOf instead of includes', `if (['CNY','RMB'].indexOf(c) >= 0) return 'Yuan';`],
    ];
    for (const [shape, sample] of REFUSED) {
      expect(aliasTableIn(sample), `${shape} should be refused`).not.toBeNull();
    }

    const ALLOWED_SAMPLES: [string, string][] = [
      ['naming one currency once', `if (currency === 'HKD') return hkdOnlyThing();`],
      ['a comment about yuan', `// a cost recorded as CNY is a yuan cost`],
      ['calling the shared map', `const key = canonicalCurrency(raw) ?? 'UNK';`],
      ['an unrelated list', `const forms = ['Loose', 'Cake', 'Tuo'];`],
      ['one spelling beside a shop key', `label = isoCurrencyCode('Yuan');`],
    ];
    for (const [shape, sample] of ALLOWED_SAMPLES) {
      expect(aliasTableIn(sample), `${shape} should pass`).toBeNull();
    }
  });

  it('the curate-import vocabulary agrees with the shared map where they overlap', () => {
    /* Those two files are exempted above because they answer in ISO codes for a
       receipt line rather than in the shop's keys. Exempt is not unchecked: a
       spelling the shop knows must mean the same money in both, or a provider
       record and the shelf would disagree about the same purchase. */
    for (const [spelling, iso] of [
      ['RMB', 'CNY'], ['YUAN', 'CNY'], ['CN¥', 'CNY'], ['CNH', 'CNY'],
      ['NT', 'TWD'], ['NT$', 'TWD'], ['TWD', 'TWD'],
      ['US$', 'USD'], ['HKD', 'HKD'], ['MOP', 'HKD'],
    ]) {
      expect(isoCurrencyCode(knownCurrency(spelling)), `${spelling} should be ${iso}`).toBe(iso);
    }
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

describe('the row a door writes is a row the table can be looked up by', () => {
  /* The three doors used to uppercase before canonicalising. Removing that call
     without moving case-normalisation into the map is what this covers: the
     column has no COLLATE NOCASE, so what the doors store is matched byte for
     byte, and a lower-cased spelling is invisible to every lookup. */
  const withRates = () => {
    const db = new SqliteD1();
    db.exec("DELETE FROM exchange_rates");
    db.exec(
      "INSERT INTO exchange_rates (currency, rate_to_usd) VALUES ('USD', 1.0), ('Yuan', 6.728858), ('NT', 31.63), ('HKD', 7.840994)",
    );
    return db;
  };

  it('finds the HKD row for an operator who typed hkd', () => {
    const db = withRates();
    try {
      const row = db.prepare('SELECT currency, rate_to_usd FROM exchange_rates WHERE currency = ?')
        .bind(canonicalCurrency('hkd')).first() as { currency: string } | null;
      expect(row, 'update_exchange_rate answered currency_not_found for hkd').not.toBeNull();
      expect(row!.currency).toBe('HKD');
      // And it is the same row 'HKD' finds, not a second one.
      const upper = db.prepare('SELECT currency FROM exchange_rates WHERE currency = ?')
        .bind(canonicalCurrency('HKD')).first() as { currency: string } | null;
      expect(upper!.currency).toBe('HKD');
    } finally {
      db.close();
    }
  });

  it('finds the Yuan row for cny, CNY and yuan alike', () => {
    const db = withRates();
    try {
      for (const typed of ['cny', 'CNY', 'yuan', 'Yuan', 'RMB', 'twd', 'nt']) {
        const row = db.prepare('SELECT currency FROM exchange_rates WHERE currency = ?')
          .bind(canonicalCurrency(typed)).first() as { currency: string } | null;
        expect(row, `${typed} found no row`).not.toBeNull();
      }
    } finally {
      db.close();
    }
  });

  it('a lower-cased spelling would find nothing, which is why the map fixes the case', () => {
    // The shape of the regression, stated as a fact about the table rather than
    // about the code: this is what storing 'hkd' would have cost.
    const db = withRates();
    try {
      const row = db.prepare('SELECT currency FROM exchange_rates WHERE currency = ?')
        .bind('hkd').first();
      expect(row).toBeNull();
    } finally {
      db.close();
    }
  });
});

describe('the two spreadsheet doors read the shared map', () => {
  it('a currency column resolves through it, and only the UNK sentinel is local', () => {
    for (const [typed, key] of [
      ['NT$', 'NT'], ['ntd', 'NT'], ['TWD', 'NT'],
      ['rmb', 'Yuan'], ['CNY', 'Yuan'], ['¥', 'Yuan'],
      ['HK$', 'HKD'], ['hk', 'HKD'],
      ['yen', 'JPY'], ['RM', 'MYR'], ['Rp', 'IDR'], ['A$', 'AUD'], ['US$', 'USD'], ['$', 'USD'],
    ]) {
      expect(normalizeCurrency(typed), `intake: ${typed}`).toBe(key);
      expect(normalizeImportCurrency(typed), `csv: ${typed}`).toBe(key);
    }
    for (const nothing of ['', '   ', 'unknown', 'n/a', null, undefined, 'wombat']) {
      expect(normalizeCurrency(nothing), `intake: ${nothing}`).toBe('UNK');
      expect(normalizeImportCurrency(nothing), `csv: ${nothing}`).toBe('UNK');
    }
  });

  it('the CSV door now reads the currencies its own copy had lost', () => {
    // Its list carried six currencies against the intake sheet's eight, so a
    // sheet whose currency column said AUD or MYR became UNK and every row of
    // it was refused by the server by name.
    expect(normalizeImportCurrency('AUD')).toBe('AUD');
    expect(normalizeImportCurrency('MYR')).toBe('MYR');
    // And both doors now know the spellings only the worker used to.
    for (const door of [normalizeCurrency, normalizeImportCurrency]) {
      expect(door('MOP')).toBe('HKD');
      expect(door('CNH')).toBe('Yuan');
      expect(door('renminbi')).toBe('Yuan');
    }
  });

  it('a currency read out of free text keeps its boundaries', () => {
    expect(detectCurrencyToken('700 NT$')).toBe('NT');
    expect(detectCurrencyToken('Unit Price (HK$)')).toBe('HKD');
    expect(detectCurrencyToken('1200 RMB')).toBe('Yuan');
    expect(detectCurrencyToken('¥1200')).toBe('Yuan');
    expect(currencyInText('cost in TWD')).toBe('NT');
    // A bare dollar sign is too ambiguous to read out of prose, and stays so.
    expect(detectCurrencyToken('$45')).toBe('');
    // Short spellings must not be found inside ordinary words.
    expect(currencyInText('internal notes')).toBeNull();
    expect(currencyInText('warm and sweet')).toBeNull();
    expect(currencyInText('a spring picking')).toBeNull();
  });
});

describe('a figure is labelled with the money it actually is', () => {
  const RATE_ROWS = RATES.map((r) => ({ currency: r.currency, rateToUSD: r.rateToUSD })) as any;

  it('converts and labels in the chosen currency when the shop has a rate', () => {
    // $10 at 6.728858 yuan to the dollar, rounded up as this shop always does.
    expect(formatCurrency(10, 'Yuan' as any, RATE_ROWS)).toBe('CN¥68');
    // A tea recorded as 'CNY' takes the 'Yuan' row, and prints the same.
    expect(formatCurrency(10, 'CNY' as any, RATE_ROWS)).toBe('CN¥68');
    expect(formatCurrency(10, 'NT' as any, RATE_ROWS)).toContain('317');
  });

  it('labels an unconverted figure USD, because a USD figure is what it is', () => {
    /* This one is a deliberate decision rather than an oversight, and it reads
       backwards from the outside, so it is written down.

       `formatCurrency` is handed a figure that is ALREADY in dollars and asked
       to show it in the currency the operator or shopper picked. Every one of
       its call sites passes a USD amount: a per-gram shelf price, a line total,
       a cart subtotal. When the shop has no rate, no conversion happens and the
       dollars are printed unchanged, so 'USD' is the true label and the
       currency that was asked for would be the mislabel: it would print $85 of
       tea as NT$85, which is a quarter of the money.

       The rule is that a figure carries the label of the money it IS, not of
       the money somebody wanted to see it in. */
    expect(formatCurrency(85, 'GBP' as any, RATE_ROWS)).toBe('$85');
    expect(formatCurrency(85, 'NT' as any, [] as any)).toBe('$85');
    // The one currency that is not a currency keeps its own marker.
    expect(formatCurrency(85, 'UNK' as any, RATE_ROWS)).toBe('~$85');
  });

  it('the retail preview prices a tea nobody wrote a currency on, as the shelf does', () => {
    /* 1000 over 100g at a rate of 1, times the shop's markup. The worker has
       always read an unrecorded currency as dollars; this preview declined, so
       the panel showed a dash for a tea the shelf was pricing and selling. */
    for (const nothing of [null, '', 'UNK']) {
      const priced = calculatePricing(1000, 0, 100, nothing as any, RATE_ROWS);
      expect(priced.rateUsed, `${nothing} should price`).toBe(1);
      expect(priced.trueCostUSD).toBeCloseTo(10, 6);
    }
    // A currency the shop genuinely has no rate for still declines.
    expect(calculatePricing(1000, 0, 100, 'GBP' as any, RATE_ROWS).rateUsed).toBe(0);
    // And a spelling of one it does have still prices.
    expect(calculatePricing(1000, 0, 100, 'CNY' as any, RATE_ROWS).rateUsed).toBeCloseTo(6.728858, 6);
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
    /* PartnerListingEdit converts a curator's OWN price into their OWN
       currency, so `callerCurrency === 'USD'` makes a rate of 1 the identity,
       not a missing rate read as one: there is no conversion to decline. Keyed
       by path, not by grepping the file for that comparison's exact text. A
       string match is satisfied by the literal appearing anywhere in the file,
       including a comment, and does not survive the comparison being reworded
       or copy-pasted into an unrelated fallback the file grows later; a path
       says which fallback was actually reviewed. */
    const RESOLVER_FALLBACK_ALLOWED = new Set(['src/admin/views/PartnerListingEdit.tsx']);
    const offenders: string[] = [];
    for (const file of adminFiles) {
      if (ALLOWED.has(file)) continue;
      const src = stripComments(read(file));
      // `...rateToUSD || 1`, `...rateToUSD ?? 1`, and the rate-object ternary.
      if (/rateToUSD\s*(\|\||\?\?)\s*1\b/.test(src)) offenders.push(`${file}: rateToUSD fallback to 1`);
      if (/rateTo[Uu]sd\([^)]*\)\s*(\|\||\?\?)\s*1\b/.test(src) && !RESOLVER_FALLBACK_ALLOWED.has(file)) {
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

describe('the REST product write doors canonicalise cost_currency too, not only mcp.ts', () => {
  /* The guard above, "update_tea_pricing stores the shop key, not what was
     typed", read only `worker/src/mcp.ts`. Four REST doors write cost_currency
     in `worker/src/index.ts` (single create, bulk create, the product edit
     panel's commercial update, and the Tea Compass promotion) and none of them
     were read by anything here, so a caller sending 'cny' or 'hkd' to
     POST /api/products stored that spelling verbatim on both `products` and its
     `product_listings` mirror for as long as this guard existed and passed. */
  const worker_ = stripComments(read('worker/src/index.ts'));

  it('index.ts calls the shared canonicaliser at every door that writes cost_currency', () => {
    const calls = worker_.match(/canonicalizeCostCurrency\(/g) ?? [];
    // One call per door: single create, bulk create, applyProductUpdate
    // (shared by catalog/stock/commercial updates), and the compass promotion.
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  it('index.ts imports canonicalizeCostCurrency from the module the guard already trusts', () => {
    expect(worker_).toMatch(/canonicalizeCostCurrency/);
    expect(read('worker/src/costCurrency.ts')).toMatch(/export function canonicalizeCostCurrency/);
  });
});

describe('the REST doors store the shop spelling, driven through the running routes', () => {
  /* Source scans can only say the call is present, not that it runs before the
     row is written or that the mirror sees the same value. These drive the
     actual `worker.fetch` handler against a seeded database, the way
     `a-tea-arrives-with-its-cost.test.ts` does, so the assertion is about what
     lands in `products` and `product_listings`, not about the source text. */
  const SECRET = 'currency-labels-r3-secret';
  const ACCOUNT = 'currency-r3-account';
  const OWNER = 'currency-r3-owner';

  const databases: SqliteD1[] = [];
  afterEach(() => { while (databases.length) databases.pop()!.close(); });

  function database() {
    const db = new SqliteD1();
    databases.push(db);
    seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner' });
    return db;
  }

  async function ownerToken() {
    return signedToken(SECRET, {
      sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER,
      active_account_id: ACCOUNT, platform_role: null,
    });
  }

  async function call(db: SqliteD1, method: string, path: string, body: unknown) {
    return worker.fetch(new Request(`https://worker.test${path}`, {
      method,
      headers: new Headers({
        Authorization: `Bearer ${await ownerToken()}`,
        'X-Teajia-Account': ACCOUNT,
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify(body),
    }), { DB: db as any, JWT_SECRET: SECRET } as any);
  }

  const productRow = (db: SqliteD1, id: string) => db.sqlite.prepare(
    'SELECT cost_currency FROM products WHERE id = ?'
  ).get(id) as { cost_currency: string } | undefined;

  const listingRow = (db: SqliteD1, id: string) => db.sqlite.prepare(
    'SELECT cost_currency FROM product_listings WHERE legacy_product_id = ?'
  ).get(id) as { cost_currency: string } | undefined;

  it('POST /api/products stores the shop spelling for a lower-cased currency, on the row and its mirror', async () => {
    const db = database();
    const res = await call(db, 'POST', '/api/products', {
      product_name: 'R3 Single Create Yuan', type: 'Oolong', cost_amount: 100, cost_currency: 'cny',
    });
    expect(res.status).toBe(201);
    const { id } = await res.json() as { id: string };
    expect(productRow(db, id)?.cost_currency).toBe('Yuan');
    expect(listingRow(db, id)?.cost_currency).toBe('Yuan');
  });

  it('POST /api/products stores the shop spelling for an upper-cased currency too', async () => {
    const db = database();
    const res = await call(db, 'POST', '/api/products', {
      product_name: 'R3 Single Create CNY', type: 'Oolong', cost_amount: 100, cost_currency: 'CNY',
    });
    expect(res.status).toBe(201);
    const { id } = await res.json() as { id: string };
    expect(productRow(db, id)?.cost_currency).toBe('Yuan');
  });

  it('POST /api/products/bulk stores the shop spelling for a lower-cased currency', async () => {
    const db = database();
    const res = await call(db, 'POST', '/api/products/bulk', {
      products: [{ product_name: 'R3 Bulk HKD Tea', type: 'Oolong', cost_amount: 50, cost_currency: 'hkd' }],
    });
    expect(res.status).toBe(200);
    const row = db.sqlite.prepare(
      "SELECT cost_currency FROM products WHERE product_name = 'R3 Bulk HKD Tea'"
    ).get() as { cost_currency: string } | undefined;
    expect(row?.cost_currency).toBe('HKD');
  });

  it('PUT /api/products/:id/commercial stores the shop spelling for a lower-cased currency', async () => {
    const db = database();
    const created = await call(db, 'POST', '/api/products', {
      product_name: 'R3 Update Target', type: 'Oolong', cost_amount: 100, cost_currency: 'USD',
    });
    const { id } = await created.json() as { id: string };
    const res = await call(db, 'PUT', `/api/products/${id}/commercial`, {
      cost_amount: 200, cost_currency: 'cny',
    });
    expect(res.status).toBe(200);
    expect(productRow(db, id)?.cost_currency).toBe('Yuan');
    expect(listingRow(db, id)?.cost_currency).toBe('Yuan');
  });

  it('the Tea Compass promotion stores the shop spelling for a lower-cased currency', async () => {
    const db = database();
    db.sqlite.prepare(
      `INSERT INTO tea_compass_entries (id, user_id, account_id, name, category, price_amount, price_currency)
       VALUES ('r3-compass-entry', ?, ?, 'R3 Compass Tea', 'tea', 300, 'cny')`
    ).run(OWNER, ACCOUNT);
    const res = await call(db, 'POST', '/api/compass/entries/r3-compass-entry/promote', {});
    expect(res.status).toBe(201);
    const { id } = await res.json() as { id: string };
    expect(productRow(db, id)?.cost_currency).toBe('Yuan');
  });
});
