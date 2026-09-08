/**
 * Migration 0017 rehearsed against the real tables, row shape by row shape.
 *
 * It renames a label, not a number. 22 teas carry 'CNY' or 'YUAN' in a column
 * whose only valid yuan spelling is 'Yuan', because `update_tea_pricing`
 * uppercased what it was given instead of canonicalising it. The worker knew
 * about the aliases so the shelf priced them correctly; the admin did not, so
 * every readout of them was wrong.
 *
 * Two things have to be true and both are easy to get wrong. It must move the
 * rows that are one of those two spellings, in any casing. And it must leave
 * everything else alone: a tea already spelled 'Yuan' (or the UPDATE churns
 * rows for nothing), a tea in HKD or USD, a tea whose currency nobody ever
 * stated, teaware. The `cost_currency_source` column must not move either,
 * because rewriting our own spelling of an answer is not Adrian giving a new
 * one.
 *
 * Seeded from `0000_initial_schema.sql` plus the later migrations, never from
 * `worker/schema.sql`, which is known to disagree with the live tables. The
 * default on `cost_currency` is 'USD' and it is part of what is being tested:
 * a row nobody answered must come out of this migration exactly as it went in.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// fileURLToPath, not URL.pathname: the checkout lives under a directory with a
// space in its name and pathname hands back the percent-encoded form.
const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));
const migration = readFileSync(join(MIGRATIONS_DIR, '0017_yuan_is_spelled_yuan.sql'), 'utf8');

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/**
 * The real CREATE TABLE for one table, plus every later ALTER that touches it.
 *
 * Taken from the migration files rather than typed out here, so the defaults
 * this rehearsal runs against are the defaults the live table actually has.
 */
function realTable(table: string): string {
  const files = readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  const statements: string[] = [];
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const create = sql.match(new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?"?${table}"? *\\([\\s\\S]*?\\n\\);`));
    if (create) statements.push(create[0]);
    for (const alter of sql.match(new RegExp(`ALTER TABLE "?${table}"? ADD COLUMN[^;]*;`, 'g')) ?? []) {
      statements.push(alter);
    }
  }
  if (statements.length === 0) throw new Error(`${table} is not in the migrations`);
  return statements.join('\n');
}

interface Shape {
  /** What Adrian would call it. */
  label: string;
  name: string;
  type: string;
  /** Omitted entirely when the row shape is "nobody ever said". */
  currency?: string | null;
  amount: number | null;
  source?: string | null;
}

const SHAPES: Shape[] = [
  { label: 'a tea labelled CNY', name: '1993 Y562 (Jixing) Black Box', type: 'Pu-erh', currency: 'CNY', amount: 1200, source: 'stated' },
  { label: 'a tea labelled YUAN', name: 'Mahei Gushu Red', type: 'Red', currency: 'YUAN', amount: 470, source: 'stated' },
  { label: 'a tea labelled cny in lower case', name: 'Small Basket Liu Bao', type: 'Dark', currency: 'cny', amount: 200, source: null },
  { label: 'a tea already labelled Yuan', name: 'Yuandu Sheng', type: 'Pu-erh', currency: 'Yuan', amount: 180, source: 'stated' },
  { label: 'a tea labelled HKD', name: 'Hong Kong Storage Ripe', type: 'Pu-erh', currency: 'HKD', amount: 900, source: 'stated' },
  { label: 'a tea labelled USD', name: 'A tea bought in dollars', type: 'Green', currency: 'USD', amount: 40, source: 'stated' },
  { label: 'a tea labelled NT', name: 'Dong Ding', type: 'Oolong', currency: 'NT', amount: 2400, source: 'stated' },
  { label: 'a tea nobody stated a currency for', name: 'An unanswered tea', type: 'Oolong', amount: 300, source: null },
  { label: 'teaware with no cost currency', name: 'A gaiwan', type: 'Teaware', currency: null, amount: null, source: null },
  { label: 'teaware labelled CNY', name: 'A yixing pot', type: 'Teaware', currency: 'CNY', amount: 800, source: 'stated' },
];

const quote = (v: string | null | undefined) => (v === null || v === undefined ? 'NULL' : `'${v.replace(/'/g, "''")}'`);

interface Observed { name: string; currency: string | null; amount: number | null; source: string | null }

/** Seed the shapes, run 0017 twice, and read both tables back. */
function rehearse(): { products: Map<string, Observed>; listings: Map<string, Observed> } {
  const directory = mkdtempSync(join(tmpdir(), 'teajia-yuan-'));
  temporaryDirectories.push(directory);
  const database = join(directory, 'migration.sqlite');

  const seed = SHAPES.map((s, i) => {
    const id = `p${i}`;
    // A shape with `currency` omitted takes the column's own default, which is
    // 'USD' and is exactly the "nobody said" case migration 0014 named.
    const productCols = s.currency === undefined
      ? `(id, product_name, type, cost_amount, cost_currency_source)`
      : `(id, product_name, type, cost_amount, cost_currency, cost_currency_source)`;
    const productVals = s.currency === undefined
      ? `('${id}', ${quote(s.name)}, ${quote(s.type)}, ${s.amount ?? 'NULL'}, ${quote(s.source)})`
      : `('${id}', ${quote(s.name)}, ${quote(s.type)}, ${s.amount ?? 'NULL'}, ${quote(s.currency)}, ${quote(s.source)})`;
    // account_id is NOT NULL on the listing mirror, which the real CREATE TABLE
    // is where you find out. A hand-written stand-in would not have said so.
    const listingCols = s.currency === undefined
      ? `(id, account_id, profile_id, legacy_product_id, cost_amount, cost_currency_source)`
      : `(id, account_id, profile_id, legacy_product_id, cost_amount, cost_currency, cost_currency_source)`;
    const listingVals = s.currency === undefined
      ? `('l${i}', 'acct-bali', 'prof${i}', '${id}', ${s.amount ?? 'NULL'}, ${quote(s.source)})`
      : `('l${i}', 'acct-bali', 'prof${i}', '${id}', ${s.amount ?? 'NULL'}, ${quote(s.currency)}, ${quote(s.source)})`;
    return `INSERT INTO products ${productCols} VALUES ${productVals};\n`
      + `INSERT INTO product_listings ${listingCols} VALUES ${listingVals};`;
  }).join('\n');

  const script = [
    'PRAGMA foreign_keys = OFF;',
    realTable('products'),
    realTable('product_listings'),
    seed,
    migration,
    // Twice, because a migration that is not idempotent is a migration that
    // cannot be re-run after a partial failure.
    migration,
  ].join('\n');

  execFileSync('sqlite3', [database], { input: script });

  const readBack = (table: string, key: string) => new Map<string, Observed>(
    (JSON.parse(execFileSync('sqlite3', ['-json', database,
      `SELECT ${key} AS name, cost_currency AS currency, cost_amount AS amount, cost_currency_source AS source FROM ${table} ORDER BY id`,
    ]).toString() || '[]') as Observed[]).map(r => [String(r.name), r]),
  );

  return {
    products: readBack('products', 'product_name'),
    listings: readBack('product_listings', 'legacy_product_id'),
  };
}

describe('migration 0017: yuan is spelled Yuan', () => {
  const { products, listings } = rehearse();
  const shapeByName = new Map(SHAPES.map(s => [s.name, s]));

  it('seeded every shape, so a silent miss cannot pass as a pass', () => {
    expect(products.size).toBe(SHAPES.length);
    expect(listings.size).toBe(SHAPES.length);
  });

  it.each([
    ['1993 Y562 (Jixing) Black Box', 'Yuan'],
    ['Mahei Gushu Red', 'Yuan'],
    ['Small Basket Liu Bao', 'Yuan'],
  ])('%s moves to %s', (name, expected) => {
    expect(products.get(name)!.currency).toBe(expected);
    expect(listings.get(`p${SHAPES.findIndex(s => s.name === name)}`)!.currency).toBe(expected);
  });

  it.each([
    ['Yuandu Sheng', 'Yuan'],
    ['Hong Kong Storage Ripe', 'HKD'],
    ['A tea bought in dollars', 'USD'],
    ['Dong Ding', 'NT'],
    ['An unanswered tea', 'USD'],
    ['A gaiwan', null],
  ])('%s is left exactly as it was (%s)', (name, expected) => {
    expect(products.get(name as string)!.currency).toBe(expected);
  });

  it('teaware is treated like any other row, because this is about spelling', () => {
    // Freight migrations exempt teaware. This one does not, and that is
    // deliberate: a yixing pot bought in yuan was bought in yuan.
    expect(products.get('A yixing pot')!.currency).toBe('Yuan');
  });

  it('moves exactly four of the ten shapes and no others', () => {
    const moved = SHAPES.filter(s => {
      const before = s.currency === undefined ? 'USD' : s.currency;
      return products.get(s.name)!.currency !== before;
    }).map(s => s.label);
    expect(moved).toEqual([
      'a tea labelled CNY',
      'a tea labelled YUAN',
      'a tea labelled cny in lower case',
      'teaware labelled CNY',
    ]);
  });

  it('does not touch a single cost amount', () => {
    for (const shape of SHAPES) {
      expect(products.get(shape.name)!.amount, shape.label).toBe(shape.amount);
    }
  });

  it('does not touch cost_currency_source, on any row', () => {
    for (const shape of SHAPES) {
      expect(products.get(shape.name)!.source ?? null, shape.label).toBe(shape.source ?? null);
      expect(shapeByName.has(shape.name)).toBe(true);
    }
  });

  it('is idempotent, since it ran twice above', () => {
    // Nothing to assert beyond the results already read: a second run that
    // moved anything would have shown up in the expectations above.
    expect(products.get('Yuandu Sheng')!.currency).toBe('Yuan');
  });
});
