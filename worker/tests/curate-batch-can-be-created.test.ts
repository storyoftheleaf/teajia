import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SqliteD1 } from './helpers/sqliteD1';

/**
 * Starting a Curate import has to actually insert a row.
 *
 * On 2026-09-06 the batch INSERT was changed to bind NULL for
 * `shipping_rate_per_kg`, for the right reason: nobody has said what freight a
 * batch carries, so the shop rate should apply and keep applying as it is
 * renegotiated. But migration 0001 declared that column `NOT NULL DEFAULT 10.0`,
 * and SQLite refuses an explicit NULL into a NOT NULL column rather than
 * falling back to its default. So every attempt to start an import from that
 * afternoon onward died on a constraint error, in production, for a day.
 *
 * Nothing caught it. Eleven hundred tests passed and the deploy went green,
 * because the suite drives the import routes through a request helper and no
 * test ever ran this statement against the real table. A column list is not
 * covered by a test that never inserts.
 *
 * So this asserts the smallest true thing: the statement the code writes is
 * legal against the schema the shop actually has. It builds the row from the
 * real `schema.sql` rather than a hand-made table, because the bug lived
 * entirely in the difference between the two.
 */

const src = readFileSync(fileURLToPath(new URL('../src/curateImports.ts', import.meta.url)), 'utf8');

/** The batch INSERT as it appears in the source, so the test cannot drift from it. */
function batchInsert(): { columns: string[]; sql: string } {
  const match = src.match(/INSERT INTO curate_import_batches \(([^)]*)\)\s*\n\s*VALUES \(([^)]*)\)/);
  if (!match) throw new Error('the batch INSERT is no longer where this test looks for it');
  const columns = match[1].split(',').map(c => c.trim()).filter(Boolean);
  const placeholders = match[2].split(',').map(c => c.trim()).filter(Boolean);
  expect(placeholders.length, 'the INSERT names a different number of columns and values').toBe(columns.length);
  return { columns, sql: `INSERT INTO curate_import_batches (${columns.join(', ')}) VALUES (${placeholders.join(', ')})` };
}

describe('a Curate import batch can be created', () => {
  it('inserts against the real schema without violating a constraint', () => {
    const db = new SqliteD1();
    db.sqlite.prepare("INSERT INTO accounts (id, slug, name, status) VALUES ('a','a','a','active')").run();
    db.sqlite.prepare(
      "INSERT INTO users (id, email, name, password_hash, role, session_version) VALUES ('u','u@t.d','u','x','user',0)"
    ).run();

    const { columns, sql } = batchInsert();
    /* One value per named column, shaped like what the route binds. Anything
       the route leaves out is left out here too, which is the point: the
       column that broke this is one the route must NOT name. */
    const value = (col: string) => {
      if (col === 'id') return 'b1';
      if (col === 'account_id') return 'a';
      if (col === 'created_by_user_id') return 'u';
      if (col === 'review_state') return 'pending';
      if (col === 'journey_id' || col === 'visit_id') return null;
      return 'x';
    };

    expect(() => db.sqlite.prepare(sql).run(...columns.map(value))).not.toThrow();
    const row = db.sqlite.prepare('SELECT id FROM curate_import_batches WHERE id = ?').get('b1');
    expect(row, 'the batch was not written').toBeTruthy();
  });

  it('does not name the freight column, which cannot hold "nobody said"', () => {
    /* `NOT NULL DEFAULT 10.0` means the column can never distinguish a rate
       somebody chose from the stale default it was born with. Naming it forces
       a choice between a constraint error and a copied policy number, and the
       honest answer is neither: leave it out and read the shop rate. */
    const { columns } = batchInsert();
    expect(columns, 'the batch INSERT names the freight column again')
      .not.toContain('shipping_rate_per_kg');
  });

  it('reports the shop rate rather than whatever the column happens to hold', () => {
    expect(src).toMatch(/const shippingRatePerKg = shopRatePerKg;/);
  });
});
