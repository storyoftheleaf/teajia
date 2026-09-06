import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * Migration 0010 hands the catalogue back to the shop's freight rate.
 *
 * Migration 0008 wrote 12 USD/kg, converted into each tea's own cost currency,
 * onto every tea that had none. Correct then, wrong once 0009 moved the shop
 * rate onto the account: a tea holding its own copy does not follow Adrian when
 * he renegotiates freight, and the copy was already frozen at the exchange rate
 * of the day 0008 ran.
 *
 * The hard part is telling those rows from rates somebody meant. They cannot be
 * matched by equality: 0008 multiplied by that day's rate, the rate has moved
 * since, and the stored figure has been through two conversions. So the
 * migration divides back out and asks whether the answer is about twelve
 * dollars. This test exists to prove the tolerance is wide enough to catch a
 * fortnight of currency drift and narrow enough to leave every other rate in
 * the shop alone -- the intake default of 10, the old Add Product form's 13, a
 * deliberate figure, and a deliberate zero meaning free.
 */

const migration = readFileSync(new URL('../migrations/0010_freight_follows_the_shop_again.sql', import.meta.url), 'utf8');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/** Rates on the day 0008 ran. Deliberately not today's, which is the point. */
const WHEN_0008_RAN = { Yuan: 7.16, USD: 1, HKD: 7.81, IDR: 17400 };
/** Rates now. The yuan has moved; the migration still has to find those rows. */
const TODAY = { Yuan: 7.12, USD: 1, HKD: 7.78, IDR: 17550 };

const HUANG_WEI = [
  '2ec4bcf5-1773-453c-b710-5b859203cb4e',
  'd8b6bcc0-e5d1-4ed1-8cab-67b3bd62d0dc',
  'bb692acb-b4a0-4114-afa8-c9644140eb5f',
];

interface Row { id: string; type: string; currency: string; rate: number | null }

function migrate(rows: Row[]): Map<string, number | null> {
  const directory = mkdtempSync(join(tmpdir(), 'teajia-freight-'));
  temporaryDirectories.push(directory);
  const database = join(directory, 'migration.sqlite');
  const seed = rows.map(r =>
    `INSERT INTO products VALUES ('${r.id}', '${r.type}', '${r.currency}', ${r.rate === null ? 'NULL' : r.rate});`
  ).join('\n');
  const script = `
    CREATE TABLE exchange_rates (currency TEXT PRIMARY KEY, rate_to_usd REAL);
    ${Object.entries(TODAY).map(([c, r]) => `INSERT INTO exchange_rates VALUES ('${c}', ${r});`).join('\n')}
    CREATE TABLE products (id TEXT PRIMARY KEY, type TEXT, cost_currency TEXT, shipping_rate_per_kg REAL);
    CREATE TABLE product_listings (id TEXT PRIMARY KEY, legacy_product_id TEXT, cost_currency TEXT, shipping_rate_per_kg REAL);
    ${seed}
    ${migration}
    ${migration}
  `;
  writeFileSync(join(directory, 'migration.sql'), script);
  execFileSync('sqlite3', [database], { input: script });
  const out = JSON.parse(execFileSync('sqlite3', ['-json', database,
    'SELECT id, shipping_rate_per_kg AS rate FROM products ORDER BY id']).toString() || '[]');
  return new Map(out.map((r: any) => [r.id, r.rate === null ? null : Number(r.rate)]));
}

describe('migration 0010, freight follows the shop again', () => {
  it('clears what 0008 wrote, even though the exchange rate has moved since', () => {
    const result = migrate([
      { id: 'yuan', type: 'Dark', currency: 'CNY', rate: 12 * WHEN_0008_RAN.Yuan },
      { id: 'usd', type: 'Dark', currency: 'USD', rate: 12 * WHEN_0008_RAN.USD },
      { id: 'hkd', type: 'Dark', currency: 'HKD', rate: 12 * WHEN_0008_RAN.HKD },
      { id: 'idr', type: 'Dark', currency: 'IDR', rate: 12 * WHEN_0008_RAN.IDR },
    ]);
    for (const id of ['yuan', 'usd', 'hkd', 'idr']) {
      expect(result.get(id), `${id} is still pinned to a copy of the old rate`).toBeNull();
    }
  });

  it('clears the three Huang Wei teas by id, not by their figure', () => {
    // They came in at the intake default of 10, which is a number that might be
    // deliberate somewhere else in the shop. Adrian authorised these three.
    const result = migrate([
      ...HUANG_WEI.map(id => ({ id, type: 'Dark', currency: 'CNY', rate: 10 * WHEN_0008_RAN.Yuan })),
      { id: 'someone-elses-ten', type: 'Dark', currency: 'CNY', rate: 10 * WHEN_0008_RAN.Yuan },
    ]);
    for (const id of HUANG_WEI) expect(result.get(id), `${id} is still pinned`).toBeNull();
    expect(result.get('someone-elses-ten'), 'a rate of 10 elsewhere was cleared on the strength of its number')
      .not.toBeNull();
  });

  it('leaves every rate somebody actually meant', () => {
    const result = migrate([
      { id: 'deliberate-30', type: 'Dark', currency: 'USD', rate: 30 },
      { id: 'deliberate-free', type: 'Dark', currency: 'CNY', rate: 0 },
      { id: 'old-add-product-13', type: 'Dark', currency: 'USD', rate: 13 },
      { id: 'y562-about-six', type: 'Dark', currency: 'CNY', rate: 6 * WHEN_0008_RAN.Yuan },
      { id: 'teaware', type: 'Teaware', currency: 'CNY', rate: 12 * WHEN_0008_RAN.Yuan },
    ]);
    expect(result.get('deliberate-30')).toBe(30);
    // Zero is Adrian saying this one ships free, and it is not the same as
    // having said nothing. That distinction is the whole area.
    expect(result.get('deliberate-free')).toBe(0);
    expect(result.get('old-add-product-13')).toBe(13);
    expect(result.get('y562-about-six')).not.toBeNull();
    // Teaware prices per piece with freight already inside; 0008 skipped it and
    // so does this, so a stray value there is left exactly as found.
    expect(result.get('teaware')).not.toBeNull();
  });

  it('runs twice without changing its mind', () => {
    // The script above applies the migration twice. A tea already following the
    // shop rate must stay that way rather than acquiring one.
    const result = migrate([{ id: 'already-following', type: 'Dark', currency: 'CNY', rate: null }]);
    expect(result.get('already-following')).toBeNull();
  });
});
