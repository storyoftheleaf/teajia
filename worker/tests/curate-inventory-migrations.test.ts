import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const migrationNames = [
  '099_compass_decision.sql',
  '100_curate_context.sql',
  '101_curate_imports.sql',
  '102_compass_sample_state.sql',
  '103_inventory_purpose_receipts.sql',
  '104_inventory_receipts.sql',
  '105_stock_movements.sql',
] as const;

const migrations = migrationNames.map(name =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'),
).join('\n');
const promotionMigration = readFileSync(
  new URL('../migrations/106_compass_promotion_identity.sql', import.meta.url),
  'utf8',
);
const canonicalSchema = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function databaseFor(prefix: string, sql: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  const database = join(directory, 'migration.sqlite');
  execFileSync('sqlite3', [database], { input: 'PRAGMA foreign_keys = ON;\n' + sql });
  return database;
}

function query(database: string, sql: string): Array<Record<string, string | number | null>> {
  return JSON.parse(execFileSync('sqlite3', ['-json', database, sql], { encoding: 'utf8' }) || '[]');
}

// This fixture intentionally models the production schema immediately after
// migration 098, including the legacy profile/listing mirror and operational
// sample tables. It is kept to only the columns exercised by migrations 099–106.
const production098Subset = `
  CREATE TABLE accounts (id TEXT PRIMARY KEY);
  CREATE TABLE users (id TEXT PRIMARY KEY);
  CREATE TABLE customers (id TEXT PRIMARY KEY, line TEXT);
  CREATE TABLE batches (id TEXT PRIMARY KEY);
  CREATE TABLE tea_compass_entries (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, user_id TEXT NOT NULL,
    draft_product_id TEXT
  );
  CREATE TABLE products (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, product_name TEXT,
    type TEXT, is_sample INTEGER DEFAULT 0, is_personal INTEGER DEFAULT 0,
    stock_grams INTEGER DEFAULT 0, source_compass_entry_id TEXT,
    created_at TEXT
  );
  CREATE TABLE tea_profiles (
    id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL,
    originated_by_account_id TEXT NOT NULL, curated_by_account_id TEXT NOT NULL,
    name TEXT NOT NULL
  );
  CREATE TABLE product_listings (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL, profile_id TEXT NOT NULL,
    stock_grams INTEGER DEFAULT 0, is_sample INTEGER DEFAULT 0,
    is_personal INTEGER DEFAULT 0, legacy_product_id TEXT
  );
  CREATE TABLE stock_ledger (
    id TEXT PRIMARY KEY, account_id TEXT, product_id TEXT NOT NULL,
    delta INTEGER NOT NULL, balance_after INTEGER NOT NULL, reason TEXT NOT NULL
  );
  CREATE TABLE tea_samples (
    id TEXT PRIMARY KEY, account_id TEXT, name TEXT NOT NULL,
    set_id TEXT NOT NULL, product_id TEXT, compass_entry_id TEXT
  );
  CREATE TABLE tea_sample_sets (
    id TEXT PRIMARY KEY, account_id TEXT, name TEXT NOT NULL
  );
  CREATE TABLE tea_sample_tastings (
    id TEXT PRIMARY KEY, account_id TEXT, sample_id TEXT NOT NULL
  );

  INSERT INTO accounts VALUES ('account-a');
  INSERT INTO users VALUES ('user-a');
  INSERT INTO tea_compass_entries VALUES ('entry-a', 'account-a', 'user-a', 'product-new');
  INSERT INTO products VALUES ('product-old', 'account-a', 'Old encounter copy', 'Green', 1, 0, 25, 'entry-a', '2025-01-01');
  INSERT INTO products VALUES ('product-new', 'account-a', 'Current encounter copy', 'Green', 0, 1, 80, 'entry-a', '2026-01-01');
  INSERT INTO tea_profiles VALUES ('profile-a', 'profile-a', 'account-a', 'account-a', 'Preserved profile');
  INSERT INTO product_listings VALUES ('listing-a', 'account-a', 'profile-a', 25, 1, 0, 'product-old');
  INSERT INTO tea_sample_sets VALUES ('set-a', 'account-a', 'Field samples');
  INSERT INTO tea_samples VALUES ('sample-a', 'account-a', 'Ten gram sample', 'set-a', 'product-old', 'entry-a');
  INSERT INTO tea_sample_tastings VALUES ('tasting-a', 'account-a', 'sample-a');
  INSERT INTO stock_ledger VALUES ('ledger-a', 'account-a', 'product-old', 25, 25, 'MANUAL_INCREMENT');
`;

describe('Curate and Inventory migration rehearsal', () => {
  it('upgrades a production-faithful migration-098 database without losing legacy data', () => {
    const database = databaseFor(
      'teajia-curate-migrations-',
      production098Subset + migrations + promotionMigration + promotionMigration,
    );

    expect(query(database, `
      SELECT id, inventory_purpose, stock_grams, source_compass_entry_id
      FROM products ORDER BY id;
    `)).toEqual([
      { id: 'product-new', inventory_purpose: 'personal', stock_grams: 80, source_compass_entry_id: 'entry-a' },
      { id: 'product-old', inventory_purpose: 'sample', stock_grams: 25, source_compass_entry_id: null },
    ]);
    expect(query(database, `
      SELECT id, draft_product_id, decision, sample_state FROM tea_compass_entries;
    `)).toEqual([
      { id: 'entry-a', draft_product_id: 'product-new', decision: null, sample_state: null },
    ]);
    expect(query(database, `
      SELECT l.id, l.inventory_purpose, l.stock_grams, p.name profile_name
      FROM product_listings l JOIN tea_profiles p ON p.id = l.profile_id;
    `)).toEqual([
      { id: 'listing-a', inventory_purpose: 'sample', stock_grams: 25, profile_name: 'Preserved profile' },
    ]);
    expect(query(database, `
      SELECT s.id, s.name, ss.name set_name, t.id tasting_id
      FROM tea_samples s
      JOIN tea_sample_sets ss ON ss.id = s.set_id AND ss.account_id = s.account_id
      JOIN tea_sample_tastings t ON t.sample_id = s.id AND t.account_id = s.account_id;
    `)).toEqual([
      { id: 'sample-a', name: 'Ten gram sample', set_name: 'Field samples', tasting_id: 'tasting-a' },
    ]);
    expect(query(database, `
      SELECT id, account_id, movement_unit, movement_type FROM stock_ledger;
    `)).toEqual([
      { id: 'ledger-a', account_id: 'account-a', movement_unit: null, movement_type: null },
    ]);
  });

  it('builds a clean canonical database with every legacy dependency required by Curate and Inventory', () => {
    const database = databaseFor('teajia-canonical-schema-', canonicalSchema);
    const requiredTables = [
      'product_listings',
      'tea_profiles',
      'tea_sample_sets',
      'tea_sample_tastings',
      'tea_samples',
    ];
    const requiredTableList = requiredTables.map(name => `'${name}'`).join(', ');

    expect(query(database, `
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN (${requiredTableList})
      ORDER BY name;
    `).map(row => row.name)).toEqual([
      'product_listings',
      'tea_profiles',
      'tea_sample_sets',
      'tea_sample_tastings',
      'tea_samples',
    ]);
  });
});
