// Launch 2, slice H4 (todo/plans/guests-and-tea-masters-launch-2-run.md,
// "Sol, H4"): the host's page for one table. Only the table's host reads or
// changes its guests; a yes goes through the guarded seat allocator and so
// respects the seats; another host and the shop owner get 404.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-host-guests-secret';
type Actor = { userId: string; accountId: string };
const adrian: Actor = { userId: 'adrian', accountId: 'platform-home' };
const ana: Actor = { userId: 'ana', accountId: 'ana-personal' };
const bo: Actor = { userId: 'bo', accountId: 'bo-personal' };

let db: SqliteD1;

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; open?: boolean } = {}) {
  const { actor, body, method = 'GET', open = true } = options;
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.userId, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test', FEW_HOSTS_OPEN: open ? 'true' : 'false',
    AFTER_SIT_LIMITER: { limit: async () => ({ success: true }) },
  } as never);
}

function personalAccount(userId: string) {
  const id = `${userId}-personal`;
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-26T00:00:00Z')`)
    .run(id, id, id, userId, userId);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`).run(id, userId);
  db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z' WHERE id = ?`).run(userId);
}

function table(id: string, accountId: string, hostUserId: string | null, options: { seats?: number; when?: string; lifecycle?: string } = {}) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status)
    VALUES (?, ?, ?, ?, ?, ?, 'Asia/Makassar', 'request', 1, 'unlisted', 0, ?, 'active', ?)`)
    .run(id, accountId, `slug-${id}`, `Table ${id}`, options.when ?? new Date(Date.now() + 7 * 86400000).toISOString(),
      options.seats ?? 4, hostUserId, options.lifecycle ?? 'published');
}

function guest(id: string, eventId: string, accountId: string, options: { status?: string; phone?: string | null; note?: string | null; photo?: 0 | 1; seat?: string } = {}) {
  const status = options.status ?? 'requested';
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, phone_number, magic_token, status, notes, photo_consent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, accountId, eventId, `Guest ${id}`, options.phone ?? null, `magic-${id}`, status, options.note ?? null, options.photo ?? 1);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, ?, ?, ?, 1, ?)`)
    .run(`seat-${id}`, accountId, eventId, id, `Guest ${id}`, options.seat ?? (status === 'confirmed' ? 'confirmed' : 'requested'));
}

const statusOf = (id: string) => (db.sqlite.prepare('SELECT status FROM event_attendees WHERE id = ?').get(id) as { status: string }).status;
const seatOf = (id: string) => (db.sqlite.prepare('SELECT seat_status FROM event_party_members WHERE participation_id = ?').get(id) as { seat_status: string }).seat_status;

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner', bundles: ['gather', 'sell'] });
  for (const person of [ana, bo]) {
    seedIdentity(db, { userId: person.userId, accountId: `${person.userId}-home`, publicEnabled: false });
    personalAccount(person.userId);
  }
  table('t-ana', ana.accountId, ana.userId);
  guest('g-mei', 't-ana', ana.accountId, { phone: '+62 812 0000 0001', note: 'First time.', photo: 0 });
  guest('g-tao', 't-ana', ana.accountId);
  table('t-bo', bo.accountId, bo.userId);
  guest('g-bo', 't-bo', bo.accountId);
  // A session of Adrian's own shop.
  table('t-shop', adrian.accountId, null);
  guest('g-shop', 't-shop', adrian.accountId);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('reading one table', () => {
  it('shows the host their guests, what each wrote, a phone for WhatsApp, the photograph wish and seats taken', async () => {
    const response = await call('/api/me/tables/t-ana', { actor: ana });
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const body = await response.json() as Record<string, any>;
    expect(body.table).toMatchObject({ id: 't-ana', seats: 4, seats_taken: 0, door: 'request', link: 'https://hosts.test/event/slug-t-ana' });
    expect(body.doors).toEqual(['request', 'link']);
    expect(body.guests).toEqual([
      expect.objectContaining({ id: 'g-mei', status: 'requested', note: 'First time.', phone: '+62 812 0000 0001', no_photographs: true }),
      expect.objectContaining({ id: 'g-tao', status: 'requested', note: null, phone: null, no_photographs: false }),
    ]);
    expect(JSON.stringify(body)).not.toContain('magic-');
  });

  it('answers 404 to another host, to the shop owner, and while Launch 2 is closed', async () => {
    expect((await call('/api/me/tables/t-ana', { actor: bo })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana', { actor: adrian })).status).toBe(404);
    expect((await call('/api/me/tables/t-shop', { actor: ana })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana', { actor: ana, open: false })).status).toBe(404);
  });
});

describe('yes and no', () => {
  it('lets only the host say yes, through the guarded allocator', async () => {
    for (const actor of [bo, adrian]) {
      expect((await call('/api/me/tables/t-ana/guests/g-mei/yes', { actor, method: 'PUT' })).status).toBe(404);
      expect((await call('/api/me/tables/t-ana/guests/g-mei/no', { actor, method: 'PUT' })).status).toBe(404);
    }
    expect(statusOf('g-mei')).toBe('requested');

    const yes = await call('/api/me/tables/t-ana/guests/g-mei/yes', { actor: ana, method: 'PUT' });
    expect(yes.status).toBe(200);
    expect(statusOf('g-mei')).toBe('confirmed');
    expect(seatOf('g-mei')).toBe('confirmed');
    // A second yes is a conflict, not a second seat.
    expect((await call('/api/me/tables/t-ana/guests/g-mei/yes', { actor: ana, method: 'PUT' })).status).toBe(409);
    const read = await (await call('/api/me/tables/t-ana', { actor: ana })).json() as Record<string, any>;
    expect(read.table.seats_taken).toBe(1);
  });

  it('refuses a yes when the table is full and leaves the guest waiting', async () => {
    db.sqlite.prepare('UPDATE events SET total_capacity = 1 WHERE id = ?').run('t-ana');
    expect((await call('/api/me/tables/t-ana/guests/g-mei/yes', { actor: ana, method: 'PUT' })).status).toBe(200);
    const full = await call('/api/me/tables/t-ana/guests/g-tao/yes', { actor: ana, method: 'PUT' });
    expect(full.status).toBe(409);
    expect(await full.json()).toMatchObject({ code: 'capacity_conflict', error: 'The table is full. Add a seat first, or say no.' });
    expect(statusOf('g-tao')).toBe('requested');
    expect(seatOf('g-tao')).toBe('requested');
  });

  it('says no only to a guest still waiting', async () => {
    expect((await call('/api/me/tables/t-ana/guests/g-tao/no', { actor: ana, method: 'PUT' })).status).toBe(200);
    expect(statusOf('g-tao')).toBe('denied');
    await call('/api/me/tables/t-ana/guests/g-mei/yes', { actor: ana, method: 'PUT' });
    expect((await call('/api/me/tables/t-ana/guests/g-mei/no', { actor: ana, method: 'PUT' })).status).toBe(409);
    expect(statusOf('g-mei')).toBe('confirmed');
  });

  it('never reaches a guest of another table through the host’s own table', async () => {
    expect((await call('/api/me/tables/t-ana/guests/g-bo/yes', { actor: ana, method: 'PUT' })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana/guests/g-shop/no', { actor: ana, method: 'PUT' })).status).toBe(404);
    expect(statusOf('g-bo')).toBe('requested');
    expect(statusOf('g-shop')).toBe('requested');
  });
});

describe('door and seats', () => {
  it('changes the door and the seats, and never below the seats taken', async () => {
    expect((await call('/api/me/tables/t-ana', { actor: ana, method: 'PUT', body: { door: 'link' } })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT door, requires_approval FROM events WHERE id = ?').get('t-ana')).toEqual({ door: 'link', requires_approval: 0 });
    expect((await call('/api/me/tables/t-ana', { actor: ana, method: 'PUT', body: { door: 'open' } })).status).toBe(400);

    await call('/api/me/tables/t-ana/guests/g-mei/yes', { actor: ana, method: 'PUT' });
    await call('/api/me/tables/t-ana/guests/g-tao/yes', { actor: ana, method: 'PUT' });
    const low = await call('/api/me/tables/t-ana', { actor: ana, method: 'PUT', body: { seats: 1 } });
    expect(low.status).toBe(409);
    expect(await low.json()).toMatchObject({ code: 'hosted_table_seats_below_taken', error: '2 seats are already taken, so the table needs at least 2.' });
    expect((await call('/api/me/tables/t-ana', { actor: ana, method: 'PUT', body: { seats: 2 } })).status).toBe(200);
    expect((await call('/api/me/tables/t-ana', { actor: ana, method: 'PUT', body: { seats: 41 } })).status).toBe(400);
    expect(db.sqlite.prepare('SELECT total_capacity FROM events WHERE id = ?').get('t-ana')).toEqual({ total_capacity: 2 });
  });

  it('answers 404 to anyone but the host', async () => {
    for (const actor of [bo, adrian]) {
      expect((await call('/api/me/tables/t-ana', { actor, method: 'PUT', body: { seats: 9 } })).status).toBe(404);
    }
    expect(db.sqlite.prepare('SELECT total_capacity FROM events WHERE id = ?').get('t-ana')).toEqual({ total_capacity: 4 });
  });
});

describe('after the table', () => {
  it('marks who came once the table has begun, finishes it, and gives a thank-you link to a guest who came', async () => {
    await call('/api/me/tables/t-ana/guests/g-mei/yes', { actor: ana, method: 'PUT' });
    await call('/api/me/tables/t-ana/guests/g-tao/yes', { actor: ana, method: 'PUT' });
    const early = await call('/api/me/tables/t-ana/came', { actor: ana, method: 'PUT', body: { attendee_ids: ['g-mei'] } });
    expect(early.status).toBe(409);

    db.sqlite.prepare('UPDATE events SET event_date = ? WHERE id = ?').run(new Date(Date.now() - 3600000).toISOString(), 't-ana');
    expect((await call('/api/me/tables/t-ana/came', { actor: bo, method: 'PUT', body: { attendee_ids: ['g-mei'] } })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana/came', { actor: ana, method: 'PUT', body: { attendee_ids: ['g-mei'] } })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT id, attended FROM event_attendees WHERE event_id = ? ORDER BY id').all('t-ana'))
      .toEqual([{ id: 'g-mei', attended: 1 }, { id: 'g-tao', attended: 0 }]);
    expect(db.sqlite.prepare('SELECT lifecycle_status FROM events WHERE id = ?').get('t-ana')).toEqual({ lifecycle_status: 'completed' });

    const link = await call('/api/me/tables/t-ana/guests/g-mei/thanks-link', { actor: ana, method: 'POST' });
    expect(link.status).toBe(200);
    expect(await link.json()).toMatchObject({ credential: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect((await call('/api/me/tables/t-ana/guests/g-tao/thanks-link', { actor: ana, method: 'POST' })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana/guests/g-mei/thanks-link', { actor: bo, method: 'POST' })).status).toBe(404);
    expect((await call('/api/me/tables/t-ana/guests/g-mei/thanks-link', { actor: adrian, method: 'POST' })).status).toBe(404);
  });
});
