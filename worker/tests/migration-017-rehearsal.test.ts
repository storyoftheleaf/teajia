import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workerDir = join(process.cwd(), 'worker');
const migrationsDir = join(workerDir, 'migrations');
const sql = (relative: string) => readFileSync(join(workerDir, relative), 'utf8');
const migrationNames = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql') && Number.parseInt(name, 10) >= 17)
  .sort();

function sqlite(database: string, input: string): string {
  return execFileSync('sqlite3', [database], {
    input: `.bail on\nPRAGMA foreign_keys = ON;\n${input}`,
    encoding: 'utf8',
  }).trim();
}

function withDatabase(run: (database: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), 'teajia-migration-017-'));
  try {
    run(join(directory, 'rehearsal.sqlite'));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const ledgerSchema = `
  CREATE TABLE IF NOT EXISTS d1_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  );
`;

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;

function initializeLedger(database: string, appliedNames: string[] = []): void {
  sqlite(database, ledgerSchema);
  for (const name of appliedNames) {
    sqlite(database, `INSERT INTO d1_migrations(name) VALUES (${quote(name)});`);
  }
}

function applyTrackedMigrations(database: string): string[] {
  initializeLedger(database);
  const applied: string[] = [];
  for (const name of migrationNames) {
    const alreadyApplied = sqlite(database, `
      SELECT EXISTS(SELECT 1 FROM d1_migrations WHERE name = ${quote(name)});
    `) === '1';
    if (alreadyApplied) continue;

    sqlite(database, `
      BEGIN IMMEDIATE;
      ${sql(`migrations/${name}`)}
      INSERT INTO d1_migrations(name) VALUES (${quote(name)});
      COMMIT;
    `);
    applied.push(name);
  }
  return applied;
}

describe('migration 017 rehearsals', () => {
  it('boots the clean canonical schema through the latest migration', () => withDatabase((database) => {
    sqlite(database, sql('schema.sql'));

    const output = sqlite(database, `
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('accounts','account_members','private_recordings','identity_email_verifications','provider_jobs')
      ORDER BY name;
    `);
    expect(output.split('\n')).toEqual(['account_members', 'accounts', 'identity_email_verifications', 'private_recordings', 'provider_jobs']);
    expect(migrationNames.at(-1)).toBe('127_events_trust_identity.sql');
    expect(sqlite(database, `SELECT name FROM pragma_table_info('tea_compass_entries') WHERE name='sample_set_id';`)).toBe('sample_set_id');
    expect(sqlite(database, `SELECT name FROM pragma_table_info('tea_compass_entries') WHERE name='classification';`)).toBe('classification');
  }));

  it('upgrades the production-shaped pre-017 schema through the latest migration', () => withDatabase((database) => {
    sqlite(database, sql('tests/fixtures/pre-017-production.sql'));
    expect(sqlite(database, 'PRAGMA foreign_keys;')).toBe('1');
    sqlite(database, `
      INSERT INTO products(id, type, product_name) VALUES ('legacy', 'Oolong', 'Legacy tea');
      INSERT INTO events(id, slug, title, event_date, status)
        VALUES ('legacy-event', 'legacy-event', 'Legacy event', '2026-09-01', 'active');
      INSERT INTO event_attendees(
        id, event_id, full_name, phone_number, status, magic_token
      ) VALUES ('legacy-attendee', 'legacy-event', 'Legacy guest', '1', 'confirmed', 'legacy-magic');
    `);
    initializeLedger(database, ['017_multi_account.sql']);

    const applied = applyTrackedMigrations(database);

    expect(applied.at(0)).toBe('017_multi_account_patched.sql');
    expect(applied.at(-1)).toBe('127_events_trust_identity.sql');
    expect(sqlite(database, `SELECT account_id FROM products WHERE id='legacy';`)).toBe('acc_teajia_bali');
    expect(sqlite(database, `SELECT name FROM sqlite_master WHERE type='table' AND name='private_recordings';`))
      .toBe('private_recordings');
    expect(sqlite(database, `SELECT name FROM sqlite_master WHERE type='table' AND name='provider_jobs';`))
      .toBe('provider_jobs');
    expect(sqlite(database, `SELECT COUNT(*) FROM users WHERE email_verified_at IS NULL;`)).toBe('0');
    expect(sqlite(database, `SELECT name FROM pragma_table_info('tea_sample_sets') WHERE name='archived';`)).toBe('archived');
    expect(sqlite(database, `SELECT name FROM pragma_table_info('tea_compass_entries') WHERE name='sample_set_id';`)).toBe('sample_set_id');
    expect(sqlite(database, `SELECT lifecycle_status FROM events WHERE id='legacy-event';`)).toBe('published');
    expect(sqlite(database, `
      SELECT account_id || '|' || event_id || '|' || participation_id || '|' || is_primary || '|' || seat_status
        FROM event_party_members WHERE participation_id='legacy-attendee';
    `)).toBe('acc_teajia_bali|legacy-event|legacy-attendee|1|confirmed');
    expect(() => sqlite(database, `
      INSERT INTO event_party_members(
        id, account_id, event_id, participation_id, full_name, is_primary, seat_status
      ) VALUES ('duplicate-primary', 'acc_teajia_bali', 'legacy-event', 'legacy-attendee', 'Duplicate', 1, 'confirmed');
    `)).toThrow(/UNIQUE constraint failed/);
  }), 30_000);

  it('makes a real repeated migration-ledger application a no-op', () => withDatabase((database) => {
    sqlite(database, sql('tests/fixtures/pre-017-production.sql'));
    initializeLedger(database, ['017_multi_account.sql']);
    applyTrackedMigrations(database);
    const ledgerCount = sqlite(database, 'SELECT COUNT(*) FROM d1_migrations;');

    expect(applyTrackedMigrations(database)).toEqual([]);
    expect(sqlite(database, 'SELECT COUNT(*) FROM d1_migrations;')).toBe(ledgerCount);
    expect(sqlite(database, `
      SELECT name FROM d1_migrations WHERE name LIKE '017_multi_account%' ORDER BY name;
    `).split('\n')).toEqual(['017_multi_account.sql', '017_multi_account_patched.sql']);
  }), 30_000);
});
