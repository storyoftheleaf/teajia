import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * The personal tasting journal, and the column its own save forgot to create.
 *
 * `customer_tasting_journal` was created without `compass_entry_id` while both
 * inserts that serve the tasting session named it, so every write was answered
 * with `no such column` and the live table held zero rows on 2026-09-06. Nobody
 * saw it for months because the client ignores a failed sync: a note appeared
 * to save, because it did save, into one browser and nowhere else.
 *
 * So the test is not "does migration 0012 add a column". It is the general
 * shape of that bug: every column the worker NAMES in an insert into this table
 * must exist in the table after the migrations run. A future insert that adds a
 * field without adding the column fails here instead of in silence.
 */

const migrationsDirectory = new URL('../migrations/', import.meta.url);
const workerSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

/**
 * Rebuild just this table by replaying every migration in order. Reading the
 * whole schema would drag in the rest of the database for no gain; the point is
 * the shape of ONE table as the deployed worker will find it.
 */
function buildTable(): { database: string; columns: string[] } {
  const directory = mkdtempSync(join(tmpdir(), 'teajia-tasting-journal-'));
  temporaryDirectories.push(directory);
  const database = join(directory, 'journal.sqlite');

  const files = readdirSync(migrationsDirectory).filter(name => name.endsWith('.sql')).sort();
  const statements: string[] = [];
  for (const file of files) {
    const sql = readFileSync(new URL(file, migrationsDirectory), 'utf8');
    const create = sql.match(/CREATE TABLE IF NOT EXISTS customer_tasting_journal\s*\([\s\S]*?\n\);/);
    if (create) statements.push(create[0]);
    for (const alter of sql.matchAll(/ALTER TABLE customer_tasting_journal[^;]*;/g)) statements.push(alter[0]);
    for (const index of sql.matchAll(/CREATE (?:UNIQUE )?INDEX[^;]*ON customer_tasting_journal[^;]*;/g)) {
      statements.push(index[0]);
    }
  }

  execFileSync('sqlite3', [database], { input: statements.join('\n') });
  const columns = JSON.parse(
    execFileSync('sqlite3', ['-json', database, 'PRAGMA table_info(customer_tasting_journal);'], { encoding: 'utf8' }) || '[]'
  ).map((row: { name: string }) => row.name);

  return { database, columns };
}

/** Every column list the worker writes into this table. */
function insertedColumnLists(): string[][] {
  const lists: string[][] = [];
  for (const match of workerSource.matchAll(/INSERT INTO customer_tasting_journal\s*\(([\s\S]*?)\)\s*VALUES/g)) {
    lists.push(match[1].split(',').map(name => name.trim()).filter(Boolean));
  }
  return lists;
}

describe('customer_tasting_journal', () => {
  it('has every column the worker inserts into it', () => {
    const { columns } = buildTable();
    const lists = insertedColumnLists();

    // A regex that matched nothing would pass this test while proving nothing.
    expect(lists.length).toBeGreaterThan(0);

    const missing = [...new Set(lists.flat())].filter(name => !columns.includes(name)).sort();
    expect(missing).toEqual([]);
  });

  it('carries the compass entry a tasting came from', () => {
    // Named on its own because the reader hands this field back out as
    // `compassEntryId`; dropping it from the inserts would satisfy the test
    // above while quietly making the journal forget where an entry came from.
    expect(buildTable().columns).toContain('compass_entry_id');
  });

  it('accepts the sync insert, upserting by user and product', () => {
    const { database } = buildTable();
    const columns = insertedColumnLists()[0];
    const insert = `
      INSERT INTO customer_tasting_journal (${columns.join(', ')})
      VALUES (${columns.map(name => (name === 'archived' ? '0' : `'${name}-value'`)).join(', ')})
      ON CONFLICT(user_id, product_id) DO UPDATE SET product_name = 'second';
    `;

    // Twice: the second run must take the conflict branch rather than add a row,
    // which is what the sync relies on to edit a note in place.
    execFileSync('sqlite3', [database], { input: insert + insert });

    const rows = JSON.parse(execFileSync('sqlite3', ['-json', database,
      'SELECT product_name FROM customer_tasting_journal;'], { encoding: 'utf8' }) || '[]');
    expect(rows).toEqual([{ product_name: 'second' }]);
  });
});
