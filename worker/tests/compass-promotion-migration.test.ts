import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../migrations/106_compass_promotion_identity.sql', import.meta.url), 'utf8');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function migrate(seed: string): Array<Record<string, string | number | null>> {
  const directory = mkdtempSync(join(tmpdir(), 'teajia-promotion-'));
  temporaryDirectories.push(directory);
  const database = join(directory, 'migration.sqlite');
  const script = `
    CREATE TABLE tea_compass_entries (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, draft_product_id TEXT);
    CREATE TABLE products (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, source_compass_entry_id TEXT, stock_grams INTEGER, created_at TEXT);
    ${seed}
    ${migration}
    ${migration}
  `;
  writeFileSync(join(directory, 'migration.sql'), script);
  execFileSync('sqlite3', [database], { input: script });
  return JSON.parse(execFileSync('sqlite3', ['-json', database, `
    SELECT 'entry' kind, id, account_id, draft_product_id link, NULL stock, NULL source FROM tea_compass_entries
    UNION ALL
    SELECT 'product', id, account_id, NULL, stock_grams, source_compass_entry_id FROM products
    ORDER BY kind, id;
  `], { encoding: 'utf8' }) || '[]');
}

describe('Compass promotion identity migration', () => {
  it('creates the unique identity on a fresh database', () => {
    const rows = migrate(`
      INSERT INTO tea_compass_entries VALUES ('entry-a', 'account-a', NULL);
      INSERT INTO products VALUES ('product-a', 'account-a', 'entry-a', 0, '2026-01-01');
    `);
    expect(rows).toEqual([
      { kind: 'entry', id: 'entry-a', account_id: 'account-a', link: 'product-a', stock: null, source: null },
      { kind: 'product', id: 'product-a', account_id: 'account-a', link: null, stock: 0, source: 'entry-a' },
    ]);
  });

  it('preserves every duplicate product and stock while repairing one canonical identity', () => {
    const rows = migrate(`
      INSERT INTO tea_compass_entries VALUES ('entry-a', 'account-a', 'product-new');
      INSERT INTO tea_compass_entries VALUES ('entry-orphan', 'account-a', NULL);
      INSERT INTO products VALUES ('product-old', 'account-a', 'entry-a', 25, '2025-01-01');
      INSERT INTO products VALUES ('product-new', 'account-a', 'entry-a', 80, '2026-01-01');
      INSERT INTO products VALUES ('orphan-b', 'account-a', 'missing-entry', 9, '2026-01-01');
      INSERT INTO products VALUES ('orphan-a', 'account-a', 'missing-entry', 7, '2025-01-01');
    `);
    expect(rows).toContainEqual({ kind: 'entry', id: 'entry-a', account_id: 'account-a', link: 'product-new', stock: null, source: null });
    expect(rows).toContainEqual({ kind: 'product', id: 'product-new', account_id: 'account-a', link: null, stock: 80, source: 'entry-a' });
    expect(rows).toContainEqual({ kind: 'product', id: 'product-old', account_id: 'account-a', link: null, stock: 25, source: null });
    expect(rows).toContainEqual({ kind: 'product', id: 'orphan-a', account_id: 'account-a', link: null, stock: 7, source: 'missing-entry' });
    expect(rows).toContainEqual({ kind: 'product', id: 'orphan-b', account_id: 'account-a', link: null, stock: 9, source: null });
    expect(rows.filter(row => row.kind === 'product')).toHaveLength(4);
  });
});
