// One seat each, and a table knows when it is on (todo/review/fixes/seats.md).
// The paths the review fix added beside the A9 review cases
// (worker/tests/review-seats-and-time.test.ts): each door's one-seat rule,
// rows written before party seats existed, the instant rule, the shared
// clock, the upcoming list and the windows of attendance and reminders.
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { offerDeadline, offerFreedSeats, offerShownUntil } from '../src/waitingList';
import { sessionCancelled, sessionMoment } from '../../shared/sessionEnd';
import { sessionClock } from '../../shared/sessionClock';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const secret = 'seats-local-test-secret';
const start = Date.parse('2099-03-05T15:30:00Z');
const minute = 60_000;
let db: SqliteD1;

beforeEach(() => {
  db = new SqliteD1('migrations');
  vi.stubGlobal('fetch', () => { throw new Error('External fetch in a local test'); });
  seedIdentity(db, { userId: 'host', accountId: 'house', publicEnabled: false, bundles: ['gather'] });
  seedIdentity(db, { userId: 'guest', accountId: 'home', role: 'viewer' });
  db.exec(`UPDATE accounts SET owner_user_id='host', personal_inventory_user_id='host',
      host_approved_at='2026-01-01' WHERE id='house';
    UPDATE users SET host_approved_at='2026-01-01' WHERE id='host';`);
  db.sqlite.prepare('UPDATE users SET password_hash=?').run(createHash('sha256').update('pw').digest('hex'));
  table('tea', '2099-03-05T15:30:00Z', 2);
});
afterEach(() => {
  db.close();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function table(id: string, date: string, seats = 2, door = 'link') {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, host_user_id, slug, title, event_date, timezone,
    address_text, total_capacity, door, requires_approval, public_visibility, status, lifecycle_status, claim_window_minutes)
    VALUES (?, 'house','host',?,'Tea',?,'Asia/Makassar','Garden gate',?,?,?,'unlisted','active','published',30)`)
    .run(id, id, date, seats, door, door === 'link' ? 0 : 1);
}

async function call(path: string, method = 'GET', body?: object, actor?: 'host' | 'guest') {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (actor) {
    const account = actor === 'host' ? 'house' : 'home';
    headers.set('X-Teajia-Account', account);
    headers.set('Authorization', 'Bearer ' + await signedToken(secret, {
      sub: actor, email: actor + '@test.dev', active_account_id: account, role: 'user',
    }));
  }
  return worker.fetch(new Request('https://worker.test' + path, { headers, method, body: body && JSON.stringify(body) }), {
    DB: db, JWT_SECRET: secret, APP_URL: 'https://test.invalid', FEW_HOSTS_OPEN: 'true',
    ANYONE_HOSTS_OPEN: 'true', CIRCLES_OPEN: 'true', TEA_TABLE_OPEN: 'true', HOST_CREDIT_OPEN: 'true',
    RSVP_LIMITER: { limit: async () => ({ success: true }) },
  } as never, { waitUntil() {} } as never);
}

const ask = (fields: object, actor?: 'guest', slug = 'tea') => call(`/api/events/${slug}/rsvp`, 'POST', fields, actor);
const rows = (sql: string) => db.sqlite.prepare(sql).all();
const live = (event = 'tea') => rows(`SELECT id, status FROM event_attendees WHERE event_id='${event}' AND status IN ('confirmed','requested','waitlist')`);

describe('one person, one seat', () => {
  it('a seat written before party seats existed keeps its person from a second seat', async () => {
    // The old row shape: a confirmed guest with an email and no party seat row.
    db.exec(`INSERT INTO event_attendees (id,account_id,event_id,magic_token,full_name,email,status)
      VALUES ('older','house','tea','old-key','Lin','lin@test.invalid','confirmed')`);
    const again = await ask({ full_name: 'Lin', email: 'LIN@test.invalid' });
    expect(again.status).toBe(200);
    // The neutral answer: a typed email never hands out someone's private link.
    expect(await again.json()).not.toHaveProperty('magic_token');
    expect(live()).toEqual([{ id: 'older', status: 'confirmed' }]);
    // The older seat is counted once, so the second seat of two is still free.
    expect((await ask({ full_name: 'Bo' })).status).toBe(201);
    expect((await ask({ full_name: 'Tao' })).status).toBe(409);
  });

  it('a signed-in guest asking again from another phone is handed their own seat', async () => {
    const first = await ask({ full_name: 'Lin', seat_key: 'phone_one_key_aaaaaaaa' }, 'guest');
    expect(first.status).toBe(201);
    const { magic_token } = await first.json() as { magic_token: string };
    const second = await ask({ full_name: 'Lin', seat_key: 'phone_two_key_bbbbbbbb' }, 'guest');
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ magic_token, repeat: true });
    expect(live()).toHaveLength(1);
  });

  it('a signed-in companion who already holds a seat cannot take a second by an invitation', async () => {
    const own = await ask({ full_name: 'Lin' }, 'guest');
    expect(own.status).toBe(201);
    db.exec(`INSERT INTO event_attendees (id,account_id,event_id,magic_token,full_name,status)
        VALUES ('parent','house','tea','parent-key','Mei','confirmed');
      INSERT INTO event_party_members (id,account_id,event_id,participation_id,full_name,is_primary,invitation_id,seat_status)
        VALUES ('parent-seat','house','tea','parent','Mei',1,NULL,'confirmed');
      UPDATE events SET total_capacity=3 WHERE id='tea';
      INSERT INTO event_party_members (id,account_id,event_id,participation_id,full_name,is_primary,invitation_id,seat_status)
        VALUES ('companion-seat','house','tea','parent',NULL,0,'invite','held');
      INSERT INTO guest_invites (id,account_id,event_id,parent_attendee_id,invite_token,name_hint,contact,status)
        VALUES ('invite','house','tea','parent','invite-token','Lin',NULL,'pending');`);
    const claim = await call('/api/guest-invite/invite-token/claim', 'POST', { name: 'Lin', email: 'other@test.invalid' }, 'guest');
    expect(claim.status).toBe(409);
    expect(await claim.json()).toMatchObject({ code: 'already_seated' });
    expect(rows("SELECT status FROM guest_invites WHERE id='invite'")).toEqual([{ status: 'pending' }]);
    expect(rows("SELECT count(*) n FROM event_attendees WHERE user_id='guest'")).toEqual([{ n: 1 }]);
  });

  it('the host cannot confirm a second row of a person already confirmed here', async () => {
    db.exec("UPDATE events SET door='request', requires_approval=1, total_capacity=4 WHERE id='tea'");
    // Two requests from one account, written before the one-seat rule.
    for (const id of ['one', 'two']) {
      db.exec(`INSERT INTO event_attendees (id,account_id,event_id,magic_token,full_name,user_id,status)
          VALUES ('${id}','house','tea','key-${id}','Lin','guest','requested');
        INSERT INTO event_party_members (id,account_id,event_id,participation_id,full_name,is_primary,seat_status)
          VALUES ('seat-${id}','house','tea','${id}','Lin',1,'requested');`);
    }
    expect((await call('/api/me/tables/tea/guests/one/yes', 'PUT', {}, 'host')).status).toBe(200);
    const second = await call('/api/me/tables/tea/guests/two/yes', 'PUT', {}, 'host');
    expect(second.status).toBe(409);
    expect(rows("SELECT id FROM event_attendees WHERE status='confirmed'")).toEqual([{ id: 'one' }]);
  });
});

describe('a table knows when it is on', () => {
  const session = { event_date: '2099-03-05T23:30', event_end_date: '2099-03-06T00:30', timezone: 'Asia/Makassar' };

  it('is before, during and after by its own zone, and says when it is cancelled', () => {
    expect(sessionMoment(session, start - 1)).toBe('before');
    expect(sessionMoment(session, start)).toBe('during');
    expect(sessionMoment(session, start + 60 * minute - 1)).toBe('during');
    expect(sessionMoment(session, start + 60 * minute)).toBe('after');
    expect(sessionMoment({ ...session, lifecycle_status: 'cancelled' }, start - minute)).toBe('after');
    expect(sessionCancelled({ lifecycle_status: 'cancelled' })).toBe(true);
    expect(sessionCancelled({ lifecycle_status: 'published', status: 'active' })).toBe(false);
  });

  it('shows the table time in the table zone with the zone named, whatever the phone', () => {
    vi.stubEnv('TZ', 'America/New_York');
    try {
      expect(sessionClock('2099-03-05T15:30:00Z', 'Asia/Makassar')).toMatchObject({
        day: 'Thursday', date: 'March 5, 2099', hour: '11:30 PM', time: '11:30 PM, Makassar time',
      });
      // A wall time with no offset is read in the table's zone, not the phone's.
      expect(sessionClock(session.event_date, session.timezone)?.time).toBe('11:30 PM, Makassar time');
      expect(sessionClock('2099-03-05T15:30:00Z', 'UTC')?.time).toBe('3:30 PM, UTC');
      expect(sessionClock('not a date', 'UTC')).toBeNull();
    } finally { vi.unstubAllEnvs(); }
  });

  it('caps an offer at the start and shows none once tea has begun', () => {
    expect(offerDeadline(start - minute, 30, start)).toBe(new Date(start).toISOString());
    expect(offerDeadline(start - 60 * minute, 30, start)).toBe(new Date(start - 30 * minute).toISOString());
    const older = new Date(start + 29 * minute).toISOString();
    expect(offerShownUntil(older, session, start - minute)).toBe(new Date(start).toISOString());
    expect(offerShownUntil(older, session, start)).toBeNull();
  });

  it('refuses a claim on an older offer that runs past the start', async () => {
    db.sqlite.prepare("UPDATE events SET event_date=?, timezone='UTC' WHERE id='tea'").run(new Date(Date.now() - minute).toISOString());
    db.exec(`INSERT INTO event_attendees (id,account_id,event_id,magic_token,full_name,status,claim_expires_at)
        VALUES ('lin','house','tea','key-lin','Lin','waitlist',datetime('now','+20 minutes'));
      INSERT INTO event_party_members (id,account_id,event_id,participation_id,full_name,is_primary,seat_status)
        VALUES ('seat-lin','house','tea','lin','Lin',1,'requested');`);
    const claim = await call('/api/rsvp/key-lin/claim', 'POST');
    expect(claim.status).toBe(410);
    expect(rows("SELECT status FROM event_attendees WHERE id='lin'")).toEqual([{ status: 'waitlist' }]);
    expect(await (await call('/api/rsvp/key-lin')).json()).toMatchObject({ attendee: { claim_expires_at: null } });
  });

  it('makes no offer once tea has begun', async () => {
    db.exec(`INSERT INTO event_attendees (id,account_id,event_id,magic_token,full_name,status,waitlist_position)
      VALUES ('lin','house','tea','key-lin','Lin','waitlist',1)`);
    expect(await offerFreedSeats(db as never, { accountId: 'house', eventId: 'tea' }, start)).toEqual([]);
  });

  it('prepares reminders before tea and marks who came only after the end', async () => {
    expect((await ask({ full_name: 'Lin' })).status).toBe(201);
    expect((await call('/api/admin/events/tea/notifications', 'POST', {}, 'host')).status).toBe(201);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(start + 4 * 60 * minute - 1);
    expect((await call('/api/me/tables/tea/came', 'PUT', { attendee_ids: [] }, 'host')).status).toBe(409);
    vi.setSystemTime(start + 4 * 60 * minute);
    expect((await call('/api/me/tables/tea/came', 'PUT', { attendee_ids: [] }, 'host')).status).toBe(200);
    expect(rows("SELECT lifecycle_status FROM events WHERE id='tea'")).toEqual([{ lifecycle_status: 'completed' }]);
  });

  it('lists only what is still to come, the limit applied after the rule', async () => {
    db.exec("UPDATE accounts SET is_platform_owner=1, public_enabled=1 WHERE id='house'");
    db.exec("UPDATE events SET public_visibility='public', network_discovery=1 WHERE id='tea'");
    const today = new Date().toISOString().slice(0, 10);
    // Thirty sessions stored as a wall time early today in Taipei: all begun.
    for (let i = 0; i < 30; i += 1) {
      db.sqlite.prepare(`INSERT INTO events (id, account_id, host_user_id, slug, title, event_date, timezone, total_capacity,
        public_visibility, network_discovery, status, lifecycle_status)
        VALUES (?, 'house', NULL, ?, 'Early', ?, 'Asia/Taipei', 4, 'public', 1, 'active', 'published')`)
        .run('early-' + i, 'early-' + i, today + 'T00:0' + (i % 10));
    }
    db.exec(`INSERT INTO events (id, account_id, slug, title, event_date, timezone, total_capacity,
        public_visibility, network_discovery, status, lifecycle_status)
      VALUES ('ahead', 'house', 'ahead', 'Ahead', '2099-01-02T12:00', 'Asia/Taipei', 4, 'public', 1, 'active', 'published'),
             ('closed-ahead', 'house', 'closed-ahead', 'Closed', '2099-01-03T12:00', 'Asia/Taipei', 4, 'public', 1, 'active', 'registration_closed')`);
    const response = await call('/api/events');
    expect(response.status).toBe(200);
    const listed = await response.json() as { slug: string }[];
    expect(listed.some(row => row.slug.startsWith('early-'))).toBe(false);
    expect(listed.map(row => row.slug)).toContain('ahead');
    expect(listed.map(row => row.slug)).not.toContain('closed-ahead');
  });
});
