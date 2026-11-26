import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fileReport, openReports, resolveReport } from '../src/sessionReports';
import { SqliteD1 } from './helpers/sqliteD1';

let fixture: SqliteD1;
let db: D1Database;
const session = { targetKind: 'session', targetId: 'event', reason: null, reporterUserId: null, reporterSeatId: null } as const;
const person = { ...session, targetKind: 'person', targetId: 'profile' } as const;

beforeEach(() => {
  fixture = new SqliteD1(false);
  fixture.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY);
    CREATE TABLE events (id TEXT PRIMARY KEY, title TEXT);
    CREATE TABLE contributors (id TEXT PRIMARY KEY, display_name TEXT);
    CREATE TABLE session_guest_book_photos (id TEXT PRIMARY KEY);
    INSERT INTO users VALUES ('visitor'), ('owner');
    INSERT INTO events VALUES ('event', 'Evening tea');
    INSERT INTO contributors VALUES ('profile', 'Tea Host');
  `);
  fixture.exec(readFileSync(new URL('../migrations/0130_session_reports_contribution.sql', import.meta.url), 'utf8'));
  db = fixture as unknown as D1Database;
});

afterEach(() => fixture.close());

describe('session and person reports', () => {
  it('accepts signed-in, guest-seat and signed-out reports', async () => {
    expect(await fileReport(db, { ...session, reporterUserId: 'visitor' })).toEqual({ received: true });
    expect(await fileReport(db, { ...session, reporterSeatId: 'seat' })).toEqual({ received: true });
    expect(await fileReport(db, person)).toEqual({ received: true });
    expect(await openReports(db, { platformOwner: true })).toEqual(expect.arrayContaining([
      expect.objectContaining({ target_kind: 'session', label: 'Evening tea', reporter_user_id: 'visitor', reporter_seat_id: null }),
      expect.objectContaining({ target_kind: 'session', reporter_user_id: null, reporter_seat_id: 'seat' }),
      expect.objectContaining({ target_kind: 'person', label: 'Tea Host', reason: null, reporter_user_id: null, reporter_seat_id: null }),
    ]));
  });

  it('updates the original open report for the same member or guest seat', async () => {
    for (const reporter of [{ reporterUserId: 'visitor' }, { reporterSeatId: 'seat' }]) {
      await fileReport(db, { ...session, ...reporter, reason: 'First' });
      const original = (await openReports(db, { platformOwner: true })).find(row =>
        reporter.reporterUserId ? row.reporter_user_id === reporter.reporterUserId : row.reporter_seat_id === reporter.reporterSeatId,
      );
      await fileReport(db, { ...session, ...reporter, reason: ' Revised ' });
      const repeats = (await openReports(db, { platformOwner: true })).filter(row =>
        reporter.reporterUserId ? row.reporter_user_id === reporter.reporterUserId : row.reporter_seat_id === reporter.reporterSeatId,
      );
      expect(repeats).toEqual([{ ...original, reason: 'Revised' }]);
    }
    expect(await openReports(db)).toHaveLength(2);
  });

  it('keeps reports from unidentified visitors separate', async () => {
    await fileReport(db, session);
    await fileReport(db, { ...session, reason: 'A second visitor' });
    expect(await openReports(db)).toHaveLength(2);
  });

  it('refuses unknown targets and reasons longer than 1000 characters', async () => {
    for (const target of [session, person]) {
      expect(await fileReport(db, { ...target, targetId: 'missing' })).toMatchObject({ refused: { status: 404, code: 'target_not_found' } });
    }
    expect(await fileReport(db, { ...session, reason: 'a'.repeat(1001) })).toMatchObject({ refused: { status: 400, code: 'validation_failed' } });
    expect(await openReports(db)).toEqual([]);
  });

  it.each(['acted', 'dismissed'] as const)('records %s once without changing the target', async status => {
    const input = { ...person, reporterUserId: 'visitor' };
    await fileReport(db, input);
    const [{ id }] = await openReports(db);
    expect(await resolveReport(db, { id, status, actorId: 'owner' })).toEqual({ id, status });
    expect(await resolveReport(db, { id, status: status === 'acted' ? 'dismissed' : 'acted', actorId: 'visitor' }))
      .toMatchObject({ refused: { status: 404, code: 'report_not_found' } });
    expect(await openReports(db)).toEqual([]);
    expect(fixture.prepare('SELECT status, resolved_at, resolved_by FROM session_reports WHERE id = ?').bind(id).first())
      .toEqual({ status, resolved_at: expect.any(String), resolved_by: 'owner' });
    expect(fixture.prepare("SELECT display_name FROM contributors WHERE id = 'profile'").first()).toEqual({ display_name: 'Tea Host' });
    await fileReport(db, input);
    expect(await openReports(db)).toEqual([expect.objectContaining({ id: expect.not.stringMatching(id) })]);
  });

  it('omits reporter fields from default and explicitly unprivileged reads', async () => {
    await fileReport(db, { ...session, reporterUserId: 'visitor', reporterSeatId: 'seat' });
    const [row] = await openReports(db);
    expect(row).not.toHaveProperty('reporter_user_id');
    expect(row).not.toHaveProperty('reporter_seat_id');
    expect(await openReports(db, { platformOwner: false })).toEqual([row]);
    expect(await openReports(db, { platformOwner: true })).toEqual([
      { ...row, reporter_user_id: 'visitor', reporter_seat_id: 'seat' },
    ]);
  });
});
