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

function applyTrackedMigrations(database: string, through?: string): string[] {
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
    if (name === through) break;
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
    expect(migrationNames.at(-1)).toBe('130_secure_inquiry_tracking.sql');
    expect(sqlite(database, `SELECT name FROM pragma_table_info('tea_compass_entries') WHERE name='sample_set_id';`)).toBe('sample_set_id');
    expect(sqlite(database, `SELECT name FROM pragma_table_info('tea_compass_entries') WHERE name='classification';`)).toBe('classification');
  }));

  it('upgrades the production-shaped pre-017 schema through the latest migration', () => withDatabase((database) => {
    sqlite(database, sql('tests/fixtures/pre-017-production.sql'));
    expect(sqlite(database, 'PRAGMA foreign_keys;')).toBe('1');
    sqlite(database, `
      INSERT INTO products(id, type, product_name) VALUES ('legacy', 'Oolong', 'Legacy tea');
    `);
    initializeLedger(database, ['017_multi_account.sql']);

    const firstBatch = applyTrackedMigrations(database, '017_multi_account_patched.sql');
    sqlite(database, `
      INSERT INTO events(id, slug, title, event_date, status, account_id)
      VALUES
        ('legacy-bali-event', 'legacy-bali-event', 'Legacy Bali event', '2026-09-01', 'active', 'acc_teajia_bali'),
        ('legacy-australia-event', 'legacy-australia-event', 'Legacy Australia event', '2026-09-02', 'closed', 'acc_teajia_australia');
      INSERT INTO event_attendees(
        id, event_id, full_name, phone_number, status, magic_token, account_id
      ) VALUES
        ('legacy-bali-attendee', 'legacy-bali-event', 'Bali guest', '1', 'confirmed', 'legacy-bali-magic', 'acc_teajia_bali'),
        ('legacy-australia-attendee', 'legacy-australia-event', 'Australia guest', '2', 'waitlist', 'legacy-australia-magic', 'acc_teajia_australia');
      INSERT INTO event_tea_menu(id, event_id, custom_name, account_id)
      VALUES ('legacy-bali-menu', 'legacy-bali-event', 'Legacy Rou Gui', 'acc_teajia_bali');
    `);
    const through126 = applyTrackedMigrations(database, '126_tea_master_integrity.sql');
    sqlite(database, `
      INSERT INTO stock_holds(id,account_id,invoice_id,product_id,held_grams)
        VALUES ('legacy-valid','acc_teajia_bali','pending-old','legacy',15),
               ('legacy-unsafe',NULL,'pending-old','legacy',5);
    `);
    sqlite(database, `
      INSERT INTO event_tasting_notes(
        id, event_id, attendee_id, tea_menu_id, rating, impression, is_favorite, created_at, account_id
      ) VALUES
        ('legacy-note-new', 'legacy-bali-event', 'legacy-bali-attendee', 'legacy-bali-menu', 5, 'Newest', 1, '2026-09-03T08:00:00Z', NULL),
        ('legacy-note-old', 'legacy-bali-event', 'legacy-bali-attendee', 'legacy-bali-menu', 2, 'Older', 0, '2026-09-01T08:00:00Z', NULL);
    `);
    const applied = [...firstBatch, ...through126, ...applyTrackedMigrations(database)];

    expect(applied.at(0)).toBe('017_multi_account_patched.sql');
    expect(applied.at(-1)).toBe('130_secure_inquiry_tracking.sql');
    expect(sqlite(database, `SELECT account_id FROM products WHERE id='legacy';`)).toBe('acc_teajia_bali');
    expect(sqlite(database, `SELECT name FROM sqlite_master WHERE type='table' AND name='private_recordings';`))
      .toBe('private_recordings');
    expect(sqlite(database, `SELECT name FROM sqlite_master WHERE type='table' AND name='provider_jobs';`))
      .toBe('provider_jobs');
    expect(sqlite(database, `SELECT COUNT(*) FROM users WHERE email_verified_at IS NULL;`)).toBe('0');
    expect(sqlite(database, `SELECT name FROM pragma_table_info('tea_sample_sets') WHERE name='archived';`)).toBe('archived');
    expect(sqlite(database, `SELECT name FROM pragma_table_info('tea_compass_entries') WHERE name='sample_set_id';`)).toBe('sample_set_id');
    expect(sqlite(database, `SELECT group_concat(name, ',') FROM pragma_table_info('stock_holds') ORDER BY cid;`))
      .toBe('id,account_id,invoice_id,product_id,held_grams,expires_at');
    expect(sqlite(database, `SELECT id || ':' || held_grams || ':' || (expires_at IS NULL) FROM stock_holds ORDER BY id;`))
      .toBe('legacy-valid:15.0:1');
    sqlite(database, `
      INSERT INTO invoices(id,invoice_number,status,account_id) VALUES ('pending-reservation','TST-1','Pending','acc_teajia_bali');
      INSERT INTO stock_holds(id,account_id,invoice_id,product_id,held_grams,expires_at)
        VALUES ('pending-hold','acc_teajia_bali','pending-reservation','legacy',10,datetime('now','+2 days'));
    `);
    expect(sqlite(database, `SELECT held_grams || ':' || (expires_at IS NOT NULL) FROM stock_holds WHERE id='pending-hold';`))
      .toBe('10.0:1');
    expect(sqlite(database, `
      SELECT id || '|' || lifecycle_status FROM events
       WHERE id IN ('legacy-bali-event', 'legacy-australia-event') ORDER BY id;
    `).split('\n')).toEqual([
      'legacy-australia-event|registration_closed',
      'legacy-bali-event|published',
    ]);
    expect(sqlite(database, `
      SELECT id || '|' || account_id || '|' || impression
      FROM event_tasting_notes WHERE attendee_id='legacy-bali-attendee';
    `)).toBe('legacy-note-new|acc_teajia_bali|Newest');
    expect(sqlite(database, `
      SELECT original_note_id || '|' || account_id || '|' || COALESCE(original_account_id, 'NULL') || '|' ||
             event_id || '|' || attendee_id || '|' ||
             tea_menu_id || '|' || rating || '|' || impression || '|' || is_favorite || '|' || created_at || '|' || archive_reason
      FROM event_tasting_note_history WHERE original_note_id='legacy-note-old';
    `)).toBe(
      'legacy-note-old|acc_teajia_bali|NULL|legacy-bali-event|legacy-bali-attendee|legacy-bali-menu|2|Older|0|2026-09-01T08:00:00Z|superseded_during_migration_129',
    );
    expect(sqlite(database, `
      SELECT account_id || '|' || event_id || '|' || participation_id || '|' || is_primary || '|' || seat_status
        FROM event_party_members
       WHERE participation_id IN ('legacy-bali-attendee', 'legacy-australia-attendee')
       ORDER BY participation_id;
    `).split('\n')).toEqual([
      'acc_teajia_australia|legacy-australia-event|legacy-australia-attendee|1|requested',
      'acc_teajia_bali|legacy-bali-event|legacy-bali-attendee|1|confirmed',
    ]);
    expect(() => sqlite(database, `
      INSERT INTO event_party_members(
        id, account_id, event_id, participation_id, full_name, seat_status
      ) VALUES (
        'cross-tenant-party', 'acc_teajia_bali', 'legacy-bali-event',
        'legacy-australia-attendee', 'Cross tenant', 'requested'
      );
    `)).toThrow(/FOREIGN KEY constraint failed/);
    expect(() => sqlite(database, `
      INSERT INTO event_party_members(
        id, account_id, event_id, participation_id, full_name, is_primary, seat_status
      ) VALUES (
        'duplicate-primary', 'acc_teajia_bali', 'legacy-bali-event',
        'legacy-bali-attendee', 'Duplicate', 1, 'confirmed'
      );
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
