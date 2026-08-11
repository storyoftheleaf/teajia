import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const workerDir = join(process.cwd(), 'worker');
const migration = (name: string) => readFileSync(join(workerDir, 'migrations', name), 'utf8');

function pre127Database(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE accounts (id TEXT PRIMARY KEY);
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      account_id TEXT
    );
    CREATE TABLE products (id TEXT PRIMARY KEY);
    CREATE TABLE contributors (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id)
    );
    CREATE TABLE account_members (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      UNIQUE(account_id, user_id)
    );
    CREATE TABLE contributor_accounts (
      contributor_id TEXT NOT NULL REFERENCES contributors(id),
      account_id TEXT NOT NULL REFERENCES accounts(id),
      PRIMARY KEY(contributor_id, account_id)
    );
  `);

  db.exec(migration('003_events.sql'));
  db.exec(migration('004_events_v2.sql'));
  db.exec(migration('004_saved_locations.sql'));
  db.exec(`
    ALTER TABLE events ADD COLUMN account_id TEXT;
    ALTER TABLE event_attendees ADD COLUMN account_id TEXT;
    ALTER TABLE event_tea_menu ADD COLUMN account_id TEXT;
    ALTER TABLE event_tasting_notes ADD COLUMN account_id TEXT;
  `);
  db.exec(migration('025_venues.sql'));
  db.exec(migration('026_wholesale_catalog.sql'));
  db.exec(migration('033_event_gathering_type.sql'));
  db.exec(migration('034_attendee_status_expand.sql'));
  db.exec(migration('057_event_requires_approval.sql'));

  db.exec(`
    INSERT INTO accounts(id) VALUES ('account-one'), ('account-two');
    INSERT INTO users(id) VALUES ('user-one'), ('user-two');
    INSERT INTO customers(id, account_id)
      VALUES ('customer-one', 'account-one'), ('customer-two', 'account-two');
    INSERT INTO contributors(id, account_id)
      VALUES ('host-one', 'account-one'), ('host-two', 'account-two');
    INSERT INTO account_members(id, account_id, user_id)
      VALUES ('member-one', 'account-one', 'user-one'), ('member-two', 'account-two', 'user-two');
    INSERT INTO contributor_accounts(contributor_id, account_id)
      VALUES ('host-one', 'account-one'), ('host-two', 'account-two');
    INSERT INTO events(id, slug, title, event_date, status, account_id)
      VALUES
        ('event-one', 'legacy-active', 'Legacy active event', '2026-09-01', 'active', 'account-one'),
        ('event-two', 'legacy-closed', 'Second legacy event', '2026-09-02', 'closed', 'account-two');
    INSERT INTO event_attendees(
      id, event_id, customer_id, full_name, phone_number, status, magic_token, account_id
    ) VALUES
      ('attendee-one', 'event-one', 'customer-one', 'Legacy guest', '1', 'confirmed', 'magic-one', 'account-one'),
      ('attendee-two', 'event-two', 'customer-two', 'Second guest', '2', 'waitlist', 'magic-two', 'account-two');
  `);

  return db;
}

function applyMigration127(db: DatabaseSync): void {
  db.exec(migration('127_events_trust_identity.sql'));
}

function tableShape(db: DatabaseSync, table: string) {
  const tableSql = String(db.prepare(`
    SELECT sql FROM sqlite_master WHERE type='table' AND name=?
  `).get(table)?.sql)
    .replace(/^CREATE TABLE IF NOT EXISTS /i, 'CREATE TABLE ')
    .replace(/\s+/g, ' ')
    .trim();
  const columns = db.prepare(`SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(?) ORDER BY name`).all(table);
  const foreignKeys = db.prepare(`
    SELECT "table", "from", "to", on_update, on_delete, match
      FROM pragma_foreign_key_list(?)
     ORDER BY "table", id, seq
  `).all(table);
  const indexes = db.prepare(`
    SELECT il.name, il."unique", il.partial, group_concat(ii.name, ',') AS columns
      FROM pragma_index_list(?) il
      JOIN pragma_index_info(il.name) ii
     GROUP BY il.name, il."unique", il.partial
     ORDER BY il.name
  `).all(table);
  return { tableSql, columns, foreignKeys, indexes };
}

describe('migration 127', () => {
  it('preserves legacy event participation and backfills one primary party seat', () => {
    const db = pre127Database();
    expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
    applyMigration127(db);

    expect(db.prepare(`SELECT lifecycle_status FROM events WHERE id='event-one'`).get())
      .toEqual({ lifecycle_status: 'published' });
    expect(db.prepare(`SELECT id, user_id FROM event_attendees WHERE id='attendee-one'`).get())
      .toEqual({ id: 'attendee-one', user_id: null });
    expect(db.prepare(`
      SELECT COUNT(*) AS count FROM event_party_members
      WHERE participation_id='attendee-one' AND is_primary=1
    `).get()).toEqual({ count: 1 });
    expect(db.prepare(`
      SELECT account_id, event_id, customer_id, full_name, seat_status
      FROM event_party_members WHERE participation_id='attendee-one'
    `).get()).toEqual({
      account_id: 'account-one',
      event_id: 'event-one',
      customer_id: 'customer-one',
      full_name: 'Legacy guest',
      seat_status: 'confirmed',
    });
    expect(db.prepare(`
      SELECT participation_id, account_id, event_id, is_primary, seat_status
        FROM event_party_members ORDER BY participation_id
    `).all()).toEqual([
      {
        participation_id: 'attendee-one', account_id: 'account-one', event_id: 'event-one',
        is_primary: 1, seat_status: 'confirmed',
      },
      {
        participation_id: 'attendee-two', account_id: 'account-two', event_id: 'event-two',
        is_primary: 1, seat_status: 'requested',
      },
    ]);
    expect(db.prepare(`SELECT COUNT(*) AS count FROM event_attendees`).get()).toEqual({ count: 2 });
    db.close();
  });

  it('fails backfill when a legacy attendee account disagrees with its event account', () => {
    const db = pre127Database();
    db.exec(`UPDATE event_attendees SET account_id='account-two' WHERE id='attendee-one'`);

    expect(() => applyMigration127(db)).toThrow(/FOREIGN KEY/);
    db.close();
  });

  it('fails backfill when an attendee customer belongs to another account', () => {
    const db = pre127Database();
    expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 1 });
    db.exec(`UPDATE event_attendees SET customer_id='customer-two' WHERE id='attendee-one'`);

    expect(() => applyMigration127(db)).toThrow(/FOREIGN KEY/);
    db.close();
  });

  it('rejects cross-event and cross-account identity links', () => {
    const db = pre127Database();
    applyMigration127(db);

    expect(() => db.exec(`
      INSERT INTO event_party_members(
        id, account_id, event_id, participation_id, full_name, seat_status
      ) VALUES ('cross-party-event', 'account-two', 'event-two', 'attendee-one', 'Guest', 'requested')
    `)).toThrow(/FOREIGN KEY/);
    expect(() => db.exec(`
      INSERT INTO event_party_members(
        id, account_id, event_id, participation_id, full_name, seat_status
      ) VALUES ('cross-party-account', 'account-two', 'event-one', 'attendee-one', 'Guest', 'requested')
    `)).toThrow(/FOREIGN KEY/);
    expect(() => db.exec(`
      INSERT INTO event_party_members(
        id, account_id, event_id, participation_id, customer_id, full_name, seat_status
      ) VALUES (
        'cross-party-customer', 'account-one', 'event-one', 'attendee-one',
        'customer-two', 'Guest', 'requested'
      )
    `)).toThrow(/FOREIGN KEY/);
    expect(() => db.exec(`
      INSERT INTO event_consents(id, account_id, event_id, attendee_id)
      VALUES ('cross-consent-event', 'account-two', 'event-two', 'attendee-one')
    `)).toThrow(/FOREIGN KEY/);
    expect(() => db.exec(`
      INSERT INTO event_consents(id, account_id, event_id, attendee_id)
      VALUES ('cross-consent-account', 'account-two', 'event-one', 'attendee-one')
    `)).toThrow(/FOREIGN KEY/);
    expect(() => db.exec(`
      INSERT INTO event_contributors(id, account_id, event_id, contributor_id, role)
      VALUES ('cross-contributor', 'account-one', 'event-one', 'host-two', 'lead_host')
    `)).toThrow(/FOREIGN KEY/);
    expect(() => db.exec(`
      INSERT INTO event_contributors(id, account_id, event_id, contributor_id, role)
      VALUES ('cross-contributor-event', 'account-two', 'event-one', 'host-two', 'lead_host')
    `)).toThrow(/FOREIGN KEY/);
    expect(() => db.exec(`
      INSERT INTO event_team_assignments(id, account_id, event_id, user_id, role)
      VALUES ('cross-team', 'account-one', 'event-one', 'user-two', 'coordinator')
    `)).toThrow(/FOREIGN KEY/);
    expect(() => db.exec(`
      INSERT INTO event_team_assignments(id, account_id, event_id, user_id, role)
      VALUES ('cross-team-event', 'account-two', 'event-one', 'user-two', 'coordinator')
    `)).toThrow(/FOREIGN KEY/);
    db.close();
  });

  it('allows at most one primary party member per participation', () => {
    const db = pre127Database();
    applyMigration127(db);

    expect(() => db.exec(`
      INSERT INTO event_party_members(
        id, account_id, event_id, participation_id, full_name, is_primary, seat_status
      ) VALUES ('second-primary', 'account-one', 'event-one', 'attendee-one', 'Another primary', 1, 'confirmed')
    `)).toThrow(/UNIQUE/);
    expect(() => db.exec(`
      INSERT INTO event_party_members(
        id, account_id, event_id, participation_id, full_name, is_primary, seat_status
      ) VALUES ('bad-primary-flag', 'account-one', 'event-one', 'attendee-one', 'Bad flag', 2, 'requested')
    `)).toThrow(/CHECK/);
    db.close();
  });

  it('deterministically keeps the newest valid tasting note and archives every superseded row losslessly', () => {
    const db = pre127Database();
    db.exec(`
      INSERT INTO event_tea_menu(id, account_id, event_id, custom_name)
      VALUES ('menu-one', 'account-one', 'event-one', 'Rou Gui');
      INSERT INTO event_tasting_notes(
        id, event_id, attendee_id, tea_menu_id, rating, impression, is_favorite, created_at, account_id
      )
      VALUES
        ('menu-new', 'event-one', 'attendee-one', 'menu-one', 5, 'Latest menu note', 1, '2026-09-03T08:00:00Z', NULL),
        ('menu-old', 'event-one', 'attendee-one', 'menu-one', 2, 'Old menu note', 0, '2026-09-01T08:00:00Z', 'account-two'),
        ('menu-invalid-date', 'event-one', 'attendee-one', 'menu-one', 3, 'Invalid-date menu note', 0, 'not-a-date', NULL),
        ('null-z', 'event-one', 'attendee-one', NULL, 4, 'Stable tie winner', 1, '2026-09-02T08:00:00Z', NULL),
        ('null-a', 'event-one', 'attendee-one', NULL, 1, 'Stable tie loser', 0, '2026-09-02T08:00:00Z', 'account-two');
    `);

    applyMigration127(db);

    expect(db.prepare(`SELECT id, account_id, impression FROM event_tasting_notes ORDER BY id`).all()).toEqual([
      { id: 'menu-new', account_id: 'account-one', impression: 'Latest menu note' },
      { id: 'null-z', account_id: 'account-one', impression: 'Stable tie winner' },
    ]);
    expect(db.prepare(`
      SELECT original_note_id, account_id, original_account_id, event_id, attendee_id, tea_menu_id,
             rating, impression, is_favorite, created_at, archive_reason
      FROM event_tasting_note_history
      ORDER BY original_note_id
    `).all()).toEqual([
      {
        original_note_id: 'menu-invalid-date', account_id: 'account-one', original_account_id: null,
        event_id: 'event-one',
        attendee_id: 'attendee-one', tea_menu_id: 'menu-one', rating: 3,
        impression: 'Invalid-date menu note', is_favorite: 0, created_at: 'not-a-date',
        archive_reason: 'superseded_during_migration_127',
      },
      {
        original_note_id: 'menu-old', account_id: 'account-one', original_account_id: 'account-two',
        event_id: 'event-one',
        attendee_id: 'attendee-one', tea_menu_id: 'menu-one', rating: 2,
        impression: 'Old menu note', is_favorite: 0, created_at: '2026-09-01T08:00:00Z',
        archive_reason: 'superseded_during_migration_127',
      },
      {
        original_note_id: 'null-a', account_id: 'account-one', original_account_id: 'account-two',
        event_id: 'event-one',
        attendee_id: 'attendee-one', tea_menu_id: null, rating: 1,
        impression: 'Stable tie loser', is_favorite: 0, created_at: '2026-09-02T08:00:00Z',
        archive_reason: 'superseded_during_migration_127',
      },
    ]);
    expect(db.prepare(`
      SELECT COUNT(*) AS count FROM event_tasting_note_history
      WHERE archived_at IS NOT NULL AND datetime(archived_at) IS NOT NULL
    `).get()).toEqual({ count: 3 });
    expect(() => db.exec(`
      INSERT INTO event_tasting_notes(id, account_id, event_id, attendee_id, tea_menu_id)
      VALUES ('menu-duplicate', 'account-one', 'event-one', 'attendee-one', 'menu-one')
    `)).toThrow(/UNIQUE/);
    expect(() => db.exec(`
      INSERT INTO event_tasting_notes(id, account_id, event_id, attendee_id, tea_menu_id)
      VALUES ('null-duplicate', 'account-one', 'event-one', 'attendee-one', NULL)
    `)).toThrow(/UNIQUE/);
    db.close();
  });

  it('rejects an FK-valid cross-event attendee before ranking, archiving, or deleting tasting notes', () => {
    const db = pre127Database();
    db.exec(`
      INSERT INTO event_tasting_notes(
        id, account_id, event_id, attendee_id, impression, created_at
      ) VALUES
        ('valid-note', 'account-one', 'event-one', 'attendee-one', 'Valid note', '2026-09-02T08:00:00Z'),
        ('cross-attendee', 'account-one', 'event-one', 'attendee-two', 'Wrong event attendee', '2026-09-01T08:00:00Z');
    `);

    expect(() => applyMigration127(db)).toThrow(/CHECK constraint failed/);
    expect(db.prepare(`SELECT id, event_id, attendee_id FROM event_tasting_notes ORDER BY id`).all()).toEqual([
      { id: 'cross-attendee', event_id: 'event-one', attendee_id: 'attendee-two' },
      { id: 'valid-note', event_id: 'event-one', attendee_id: 'attendee-one' },
    ]);
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'event_tasting_note_history'`).get())
      .toBeUndefined();
    db.close();
  });

  it('rejects an FK-valid cross-event tea menu before ranking, archiving, or deleting tasting notes', () => {
    const db = pre127Database();
    db.exec(`
      INSERT INTO event_tea_menu(id, account_id, event_id, custom_name)
      VALUES
        ('menu-one', 'account-one', 'event-one', 'Rou Gui'),
        ('menu-two', 'account-two', 'event-two', 'Other tea');
      INSERT INTO event_tasting_notes(
        id, account_id, event_id, attendee_id, tea_menu_id, impression, created_at
      ) VALUES
        ('valid-menu-note', 'account-one', 'event-one', 'attendee-one', 'menu-one', 'Valid note', '2026-09-02T08:00:00Z'),
        ('cross-menu', 'account-one', 'event-one', 'attendee-one', 'menu-two', 'Wrong event menu', '2026-09-01T08:00:00Z');
    `);

    expect(() => applyMigration127(db)).toThrow(/CHECK constraint failed/);
    expect(db.prepare(`SELECT id, event_id, attendee_id, tea_menu_id FROM event_tasting_notes ORDER BY id`).all()).toEqual([
      { id: 'cross-menu', event_id: 'event-one', attendee_id: 'attendee-one', tea_menu_id: 'menu-two' },
      { id: 'valid-menu-note', event_id: 'event-one', attendee_id: 'attendee-one', tea_menu_id: 'menu-one' },
    ]);
    expect(db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'event_tasting_note_history'`).get())
      .toBeUndefined();
    db.close();
  });

  it('backfills every legacy tasting-note account from the owning attendee and event', () => {
    const db = pre127Database();
    db.exec(`
      INSERT INTO event_tasting_notes(id, event_id, attendee_id, impression, account_id)
      VALUES
        ('null-account', 'event-one', 'attendee-one', 'Missing tenant', NULL),
        ('wrong-account', 'event-two', 'attendee-two', 'Wrong tenant', 'account-one');
    `);

    applyMigration127(db);

    expect(db.prepare(`
      SELECT id, account_id FROM event_tasting_notes ORDER BY id
    `).all()).toEqual([
      { id: 'null-account', account_id: 'account-one' },
      { id: 'wrong-account', account_id: 'account-two' },
    ]);
    db.close();
  });

  it('rejects non-boolean event, contributor, and consent flags', () => {
    const db = pre127Database();
    applyMigration127(db);

    expect(() => db.exec(`UPDATE events SET network_discovery=2 WHERE id='event-one'`)).toThrow(/CHECK/);
    expect(() => db.exec(`
      INSERT INTO event_contributors(id, account_id, event_id, contributor_id, role, is_public)
      VALUES ('bad-public', 'account-one', 'event-one', 'host-one', 'lead_host', -1)
    `)).toThrow(/CHECK/);
    for (const flag of ['photography', 'public_quote', 'review_publication', 'contact_exchange', 'operational_messages']) {
      expect(() => db.exec(`
        INSERT INTO event_consents(id, account_id, event_id, attendee_id, ${flag})
        VALUES ('bad-${flag}', 'account-one', 'event-one', 'attendee-one', 2)
      `), flag).toThrow(/CHECK/);
    }
    db.close();
  });

  it('creates contributor, team, consent tables and the required indexes', () => {
    const db = pre127Database();
    applyMigration127(db);

    expect(db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN (
        'event_contributors','event_team_assignments','event_consents','event_tasting_note_history'
      )
      ORDER BY name
    `).all()).toEqual([
      { name: 'event_consents' },
      { name: 'event_contributors' },
      { name: 'event_tasting_note_history' },
      { name: 'event_team_assignments' },
    ]);
    expect(db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name IN (
        'idx_events_account_lifecycle_date',
        'idx_event_party_members_event_seat',
        'idx_event_contributors_event_order',
        'idx_event_team_assignments_event_user',
        'uniq_events_id_account',
        'uniq_event_attendees_id_event_account',
        'uniq_customers_id_account',
        'uniq_account_members_user_account',
        'uniq_event_party_members_primary',
        'uniq_event_tasting_notes_attendee_menu',
        'uniq_event_tasting_notes_attendee_null_menu',
        'uniq_event_tasting_note_history_original',
        'idx_event_tasting_note_history_account_event'
      ) ORDER BY name
    `).all()).toEqual([
      { name: 'idx_event_contributors_event_order' },
      { name: 'idx_event_party_members_event_seat' },
      { name: 'idx_event_tasting_note_history_account_event' },
      { name: 'idx_event_team_assignments_event_user' },
      { name: 'idx_events_account_lifecycle_date' },
      { name: 'uniq_account_members_user_account' },
      { name: 'uniq_customers_id_account' },
      { name: 'uniq_event_attendees_id_event_account' },
      { name: 'uniq_event_party_members_primary' },
      { name: 'uniq_event_tasting_note_history_original' },
      { name: 'uniq_event_tasting_notes_attendee_menu' },
      { name: 'uniq_event_tasting_notes_attendee_null_menu' },
      { name: 'uniq_events_id_account' },
    ]);
    db.close();
  });

  it('rejects invalid lifecycle, visibility, recap, payment, role, and seat states', () => {
    const db = pre127Database();
    applyMigration127(db);

    expect(() => db.exec(`UPDATE events SET lifecycle_status='active' WHERE id='event-one'`)).toThrow(/CHECK/);
    expect(() => db.exec(`UPDATE events SET public_visibility='network' WHERE id='event-one'`)).toThrow(/CHECK/);
    expect(() => db.exec(`UPDATE events SET recap_status='hidden' WHERE id='event-one'`)).toThrow(/CHECK/);
    expect(() => db.exec(`UPDATE event_attendees SET payment_status='overdue' WHERE id='attendee-one'`)).toThrow(/CHECK/);
    expect(() => db.exec(`
      INSERT INTO event_party_members(
        id, account_id, event_id, participation_id, full_name, is_primary, seat_status
      ) VALUES ('bad-seat', 'account-one', 'event-one', 'attendee-one', 'Guest', 0, 'reserved')
    `)).toThrow(/CHECK/);
    expect(() => db.exec(`
      UPDATE event_party_members SET attendance_status='late' WHERE participation_id='attendee-one'
    `)).toThrow(/CHECK/);
    expect(() => db.exec(`
      INSERT INTO event_contributors(id, account_id, event_id, contributor_id, role)
      VALUES ('bad-contributor', 'account-one', 'event-one', 'host-one', 'speaker')
    `)).toThrow(/CHECK/);
    expect(() => db.exec(`
      INSERT INTO event_team_assignments(id, account_id, event_id, user_id, role)
      VALUES ('bad-team', 'account-one', 'event-one', 'user-one', 'host')
    `)).toThrow(/CHECK/);
    db.close();
  });

  it('is represented in the canonical schema snapshot', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync(join(workerDir, 'schema.sql'), 'utf8'));

    expect(db.prepare(`
      SELECT name FROM pragma_table_info('events')
      WHERE name IN ('lifecycle_status','public_visibility','network_discovery','recap_status')
      ORDER BY name
    `).all()).toEqual([
      { name: 'lifecycle_status' },
      { name: 'network_discovery' },
      { name: 'public_visibility' },
      { name: 'recap_status' },
    ]);
    expect(db.prepare(`
      SELECT name FROM pragma_table_info('event_attendees')
      WHERE name IN ('user_id','payment_status') ORDER BY name
    `).all()).toEqual([{ name: 'payment_status' }, { name: 'user_id' }]);
    expect(db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name IN (
        'uniq_event_tasting_notes_attendee_menu',
        'uniq_event_tasting_notes_attendee_null_menu'
      ) ORDER BY name
    `).all()).toEqual([
      { name: 'uniq_event_tasting_notes_attendee_menu' },
      { name: 'uniq_event_tasting_notes_attendee_null_menu' },
    ]);
    expect(db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN (
        'event_party_members','event_contributors','event_team_assignments','event_consents',
        'event_tasting_note_history'
      ) ORDER BY name
    `).all()).toEqual([
      { name: 'event_consents' },
      { name: 'event_contributors' },
      { name: 'event_party_members' },
      { name: 'event_tasting_note_history' },
      { name: 'event_team_assignments' },
    ]);
    db.close();
  });

  it('keeps canonical schema constraints, foreign keys, and indexes equivalent to migration 127', () => {
    const migrated = pre127Database();
    applyMigration127(migrated);
    const canonical = new DatabaseSync(':memory:');
    canonical.exec('PRAGMA foreign_keys = ON;');
    canonical.exec(readFileSync(join(workerDir, 'schema.sql'), 'utf8'));

    for (const table of [
      'event_party_members',
      'event_consents',
      'event_contributors',
      'event_team_assignments',
      'event_tasting_note_history',
    ]) {
      expect(tableShape(canonical, table), table).toEqual(tableShape(migrated, table));
    }
    migrated.close();
    canonical.close();
  });

  it('keeps event parent column order and attributes aligned with the migrated schema', () => {
    const migrated = pre127Database();
    applyMigration127(migrated);
    const canonical = new DatabaseSync(':memory:');
    canonical.exec(readFileSync(join(workerDir, 'schema.sql'), 'utf8'));

    for (const table of ['events', 'event_attendees']) {
      expect(canonical.prepare(`
        SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(?) ORDER BY cid
      `).all(table), table).toEqual(migrated.prepare(`
        SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(?) ORDER BY cid
      `).all(table));
    }
    migrated.close();
    canonical.close();
  });

  it('keeps the established event support schema in the canonical snapshot', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync(join(workerDir, 'schema.sql'), 'utf8'));

    expect(db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN (
        'event_tea_menu','event_tasting_notes','event_notifications',
        'guest_invites','interest_signups','stock_holds'
      ) ORDER BY name
    `).all()).toEqual([
      { name: 'event_notifications' },
      { name: 'event_tasting_notes' },
      { name: 'event_tea_menu' },
      { name: 'guest_invites' },
      { name: 'interest_signups' },
      { name: 'stock_holds' },
    ]);
    expect(db.prepare(`
      SELECT name FROM pragma_table_info('venues')
      WHERE name IN ('website','instagram') ORDER BY name
    `).all()).toEqual([{ name: 'instagram' }, { name: 'website' }]);
    expect(db.prepare(`
      SELECT name FROM pragma_table_info('venue_spaces') WHERE name='tea_styles'
    `).get()).toEqual({ name: 'tea_styles' });
    expect(db.prepare(`
      SELECT name FROM pragma_table_info('guest_invites')
      WHERE name IN ('account_id','contact') ORDER BY name
    `).all()).toEqual([{ name: 'account_id' }, { name: 'contact' }]);
    expect(db.prepare(`
      SELECT name FROM pragma_table_info('interest_signups')
      WHERE name IN ('account_id','customer_id','converted_at') ORDER BY name
    `).all()).toEqual([
      { name: 'account_id' },
      { name: 'converted_at' },
      { name: 'customer_id' },
    ]);
    expect(db.prepare(`
      SELECT name FROM pragma_table_info('stock_holds')
      WHERE name IN ('account_id','invoice_id','product_id','held_grams') ORDER BY name
    `).all()).toEqual([
      { name: 'account_id' },
      { name: 'held_grams' },
      { name: 'invoice_id' },
      { name: 'product_id' },
    ]);
    db.close();
  });
});
