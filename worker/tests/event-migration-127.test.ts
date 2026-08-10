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
    CREATE TABLE customers (id TEXT PRIMARY KEY);
    CREATE TABLE products (id TEXT PRIMARY KEY);
    CREATE TABLE contributors (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id)
    );
  `);

  db.exec(migration('003_events.sql'));
  db.exec(migration('004_events_v2.sql'));
  db.exec(`
    ALTER TABLE events ADD COLUMN account_id TEXT;
    ALTER TABLE event_attendees ADD COLUMN account_id TEXT;
  `);
  db.exec(migration('025_venues.sql'));
  db.exec(migration('026_wholesale_catalog.sql'));
  db.exec(migration('033_event_gathering_type.sql'));
  db.exec(migration('034_attendee_status_expand.sql'));
  db.exec(migration('057_event_requires_approval.sql'));

  db.exec(`
    INSERT INTO accounts(id) VALUES ('account-one');
    INSERT INTO users(id) VALUES ('user-one');
    INSERT INTO customers(id) VALUES ('customer-one');
    INSERT INTO contributors(id, account_id) VALUES ('host-one', 'account-one');
    INSERT INTO events(id, slug, title, event_date, status, account_id)
      VALUES ('event-one', 'legacy-active', 'Legacy active event', '2026-09-01', 'active', 'account-one');
    INSERT INTO event_attendees(
      id, event_id, customer_id, full_name, phone_number, status, magic_token, account_id
    ) VALUES (
      'attendee-one', 'event-one', 'customer-one', 'Legacy guest', '1', 'confirmed', 'magic-one', 'account-one'
    );
  `);

  return db;
}

function applyMigration127(db: DatabaseSync): void {
  db.exec(migration('127_events_trust_identity.sql'));
}

describe('migration 127', () => {
  it('preserves legacy event participation and backfills one primary party seat', () => {
    const db = pre127Database();
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
    expect(db.prepare(`SELECT COUNT(*) AS count FROM event_attendees`).get()).toEqual({ count: 1 });
    db.close();
  });

  it('creates contributor, team, consent tables and the required indexes', () => {
    const db = pre127Database();
    applyMigration127(db);

    expect(db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN ('event_contributors','event_team_assignments','event_consents')
      ORDER BY name
    `).all()).toEqual([
      { name: 'event_consents' },
      { name: 'event_contributors' },
      { name: 'event_team_assignments' },
    ]);
    expect(db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='index' AND name IN (
        'idx_events_account_lifecycle_date',
        'idx_event_party_members_event_seat',
        'idx_event_contributors_event_order',
        'idx_event_team_assignments_event_user'
      ) ORDER BY name
    `).all()).toEqual([
      { name: 'idx_event_contributors_event_order' },
      { name: 'idx_event_party_members_event_seat' },
      { name: 'idx_event_team_assignments_event_user' },
      { name: 'idx_events_account_lifecycle_date' },
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
      WHERE type='table' AND name IN (
        'event_party_members','event_contributors','event_team_assignments','event_consents'
      ) ORDER BY name
    `).all()).toEqual([
      { name: 'event_consents' },
      { name: 'event_contributors' },
      { name: 'event_party_members' },
      { name: 'event_team_assignments' },
    ]);
    db.close();
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
