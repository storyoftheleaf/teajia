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
  '106_compass_promotion_identity.sql',
  '107_curate_import_idempotency.sql',
  '119_curate_import_analysis.sql',
  '120_compass_sample_set.sql',
  '121_curate_import_trust_pipeline.sql',
] as const;

const migrations = migrationNames.map(name =>
  readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'),
).join('\n');
const schemaThrough098 = readFileSync(
  new URL('./fixtures/schema-through-098.sql', import.meta.url),
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

function pragma(database: string, pragmaName: string, table: string) {
  return query(database, `PRAGMA ${pragmaName}('${table.replaceAll("'", "''")}');`);
}

function normalizedColumns(database: string, table: string) {
  return pragma(database, 'table_info', table)
    .map(({ cid: _cid, ...column }) => column)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function normalizedIndexes(database: string, table: string) {
  return pragma(database, 'index_list', table)
    .filter(index => !String(index.name).startsWith('sqlite_autoindex_'))
    .map(({ seq: _seq, ...index }) => index)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function normalizedForeignKeys(database: string, table: string) {
  return pragma(database, 'foreign_key_list', table)
    .map(({ id: _id, seq: _seq, ...foreignKey }) => foreignKey)
    .sort((a, b) => `${a.from}:${a.table}:${a.to}`.localeCompare(`${b.from}:${b.table}:${b.to}`));
}

const seed = `
  INSERT INTO accounts (id, slug, name) VALUES ('account-a', 'account-a', 'Account A');
  INSERT INTO users (id, email, name, password_hash) VALUES ('user-a', 'a@example.com', 'A', 'hash');
  INSERT INTO tea_compass_entries (id, account_id, user_id, draft_product_id)
    VALUES ('entry-a', 'account-a', 'user-a', 'product-new');
  INSERT INTO products (
    id, account_id, product_name, type, is_sample, is_personal,
    stock_grams, source_compass_entry_id, created_at
  ) VALUES
    ('product-old', 'account-a', 'Old encounter copy', 'Green', 1, 0, 25, 'entry-a', '2025-01-01'),
    ('product-new', 'account-a', 'Current encounter copy', 'Green', 0, 1, 80, 'entry-a', '2026-01-01'),
    ('product-never-linked', 'account-a', 'Never linked sample', 'White', 1, 0, 11, NULL, '2026-02-01');
  INSERT INTO tea_profiles (
    id, slug, originated_by_account_id, curated_by_account_id, name
  ) VALUES ('profile-a', 'profile-a', 'account-a', 'account-a', 'Preserved profile');
  INSERT INTO product_listings (
    id, account_id, profile_id, stock_grams, is_sample, is_personal, legacy_product_id
  ) VALUES ('listing-a', 'account-a', 'profile-a', 25, 1, 0, 'product-old');
  INSERT INTO tea_sample_sets (id, account_id, name) VALUES ('set-a', 'account-a', 'Field samples');
  INSERT INTO tea_samples (id, account_id, name, set_id, product_id, compass_entry_id)
    VALUES ('sample-a', 'account-a', 'Ten gram sample', 'set-a', 'product-old', 'entry-a');
  INSERT INTO tea_sample_tastings (id, account_id, sample_id)
    VALUES ('tasting-a', 'account-a', 'sample-a');
  INSERT INTO stock_ledger (id, account_id, product_id, delta, balance_after, reason)
    VALUES ('ledger-a', 'account-a', 'product-old', 25, 25, 'MANUAL_INCREMENT');
`;

const affectedTables = [
  'tea_compass_entries',
  'curate_journeys',
  'curate_visits',
  'curate_import_batches',
  'curate_import_sources',
  'curate_import_items',
  'curate_import_vendor_groups',
  'curate_import_receipts',
  'products',
  'product_listings',
  'stock_ledger',
  'curate_receipt_proposals',
  'inventory_receipts',
  'inventory_receipt_lines',
] as const;

describe('Curate and Inventory migration rehearsal', () => {
  it('applies the Curate and Inventory migrations in production numeric order through 121', () => {
    expect(migrationNames).toEqual([
      '099_compass_decision.sql',
      '100_curate_context.sql',
      '101_curate_imports.sql',
      '102_compass_sample_state.sql',
      '103_inventory_purpose_receipts.sql',
      '104_inventory_receipts.sql',
      '105_stock_movements.sql',
      '106_compass_promotion_identity.sql',
      '107_curate_import_idempotency.sql',
      '119_curate_import_analysis.sql',
      '120_compass_sample_set.sql',
      '121_curate_import_trust_pipeline.sql',
    ]);
  });

  it('upgrades the committed production-faithful migration-098 snapshot without data loss', () => {
    const database = databaseFor(
      'teajia-curate-migrations-',
      schemaThrough098 + seed + migrations,
    );

    expect(query(database, `
      SELECT id, inventory_purpose, stock_grams, is_sample, is_personal, source_compass_entry_id
      FROM products WHERE id = 'product-never-linked';
    `)).toEqual([{
      id: 'product-never-linked', inventory_purpose: 'sample', stock_grams: 11,
      is_sample: 1, is_personal: 0, source_compass_entry_id: null,
    }]);
    expect(query(database, `
      SELECT id, inventory_purpose, stock_grams, source_compass_entry_id
      FROM products WHERE id IN ('product-old', 'product-new') ORDER BY id;
    `)).toEqual([
      { id: 'product-new', inventory_purpose: 'personal', stock_grams: 80, source_compass_entry_id: 'entry-a' },
      { id: 'product-old', inventory_purpose: 'sample', stock_grams: 25, source_compass_entry_id: null },
    ]);
    expect(query(database, `SELECT id, draft_product_id FROM tea_compass_entries;`)).toEqual([
      { id: 'entry-a', draft_product_id: 'product-new' },
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
    expect(query(database, `SELECT id, account_id FROM stock_ledger;`)).toEqual([
      { id: 'ledger-a', account_id: 'account-a' },
    ]);
    expect(query(database, 'PRAGMA integrity_check;')).toEqual([{ integrity_check: 'ok' }]);
    expect(query(database, 'PRAGMA foreign_key_check;')).toEqual([]);
  });

  it('matches the canonical schema for every Curate/Inventory table changed through migration 121', () => {
    const upgraded = databaseFor(
      'teajia-upgraded-schema-',
      schemaThrough098 + migrations,
    );
    const canonical = databaseFor('teajia-canonical-schema-', canonicalSchema);

    const upgradedTables = query(upgraded, `SELECT name FROM sqlite_master WHERE type = 'table';`)
      .map(row => row.name);
    for (const table of affectedTables) {
      expect(upgradedTables, `${table} must exist after migration`).toContain(table);
      expect(normalizedColumns(upgraded, table), `${table} columns`).toEqual(normalizedColumns(canonical, table));
      expect(normalizedIndexes(upgraded, table), `${table} indexes`).toEqual(normalizedIndexes(canonical, table));
      expect(normalizedForeignKeys(upgraded, table), `${table} foreign keys`).toEqual(normalizedForeignKeys(canonical, table));
    }

    expect(query(upgraded, 'PRAGMA integrity_check;')).toEqual([{ integrity_check: 'ok' }]);
    expect(query(upgraded, 'PRAGMA foreign_key_check;')).toEqual([]);
    expect(query(canonical, 'PRAGMA integrity_check;')).toEqual([{ integrity_check: 'ok' }]);
    expect(query(canonical, 'PRAGMA foreign_key_check;')).toEqual([]);
  });

  it('adds the Curate import trust-pipeline fields without changing existing values', () => {
    const database = databaseFor(
      'teajia-curate-trust-pipeline-',
      schemaThrough098 + seed + migrations,
    );

    expect(normalizedColumns(database, 'tea_compass_entries').map(column => column.name)).toEqual(expect.arrayContaining([
      'origin_country', 'classification', 'description',
    ]));
    expect(normalizedColumns(database, 'products').map(column => column.name)).toContain('classification');
    expect(normalizedColumns(database, 'curate_import_batches').map(column => column.name)).toContain('analysis_annotations_json');
    expect(query(database, `SELECT id, product_name FROM products WHERE id = 'product-new';`)).toEqual([
      { id: 'product-new', product_name: 'Current encounter copy' },
    ]);
  });

  it('enforces account-scoped import idempotency in a fresh canonical database', () => {
    const database = databaseFor('teajia-fresh-import-schema-', canonicalSchema);
    execFileSync('sqlite3', [database], { input: `
      INSERT INTO curate_import_batches
        (id, account_id, created_by_user_id, title, client_idempotency_key, request_fingerprint)
      VALUES
        ('batch-a', 'account-a', 'user-a', 'A', 'device-key', 'fingerprint-a'),
        ('batch-b', 'account-b', 'user-b', 'B', 'device-key', 'fingerprint-b');
      INSERT INTO curate_import_sources
        (id, batch_id, account_id, created_by_user_id, kind, pasted_text, client_idempotency_key, request_fingerprint)
      VALUES
        ('source-a', 'batch-a', 'account-a', 'user-a', 'paste', 'one', 'source-key', 'source-fingerprint-a'),
        ('source-b', 'batch-b', 'account-b', 'user-b', 'paste', 'two', 'source-key', 'source-fingerprint-b');
    ` });
    expect(() => execFileSync('sqlite3', [database], { input: `
      INSERT INTO curate_import_batches
        (id, account_id, created_by_user_id, title, client_idempotency_key, request_fingerprint)
      VALUES ('batch-c', 'account-a', 'user-a', 'C', 'device-key', 'changed');
    ` })).toThrow();
    expect(() => execFileSync('sqlite3', [database], { input: `
      INSERT INTO curate_import_sources
        (id, batch_id, account_id, created_by_user_id, kind, pasted_text, client_idempotency_key, request_fingerprint)
      VALUES ('source-c', 'batch-a', 'account-a', 'user-a', 'paste', 'three', 'source-key', 'changed');
    ` })).toThrow();
  });
});
