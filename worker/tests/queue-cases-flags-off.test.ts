// The thirteen waiting-list cases of guests-build/flags-off-queue-cases.md:
// with ANYONE_HOSTS_OPEN off the waiting list answers as main did before PR
// 560, except where a seat fix of the review run is kept (no offer once tea
// has begun). The decision table is todo/review/fixes/queue-cases.md. Each
// describe checks the closed answer and, where it differs, the open one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { offerFreedSeats } from '../src/waitingList';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-queue-cases-secret';
const DAY = 24 * 60 * 60 * 1000;
type Actor = { userId: string; accountId: string };
const adrian: Actor = { userId: 'adrian', accountId: 'shop' };
const S = { eventId: 's', accountId: adrian.accountId };

let db: SqliteD1;

const env = (open: boolean) => ({
  DB: db, JWT_SECRET: SECRET, APP_URL: 'https://shop.test',
  FEW_HOSTS_OPEN: 'false', ANYONE_HOSTS_OPEN: open ? 'true' : 'false',
  RSVP_LIMITER: { limit: async () => ({ success: true }) },
});

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; open?: boolean } = {}) {
  const { actor, body, method = 'GET', open = false } = options;
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.46' });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.userId, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), env(open) as never, { waitUntil: () => undefined } as never);
}

function session(seats: number, options: { door?: 'request' | null; startsIn?: number } = {}) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, status, lifecycle_status, claim_window_minutes)
    VALUES ('s', ?, 's', 'Shop session', ?, ?, 'UTC', ?, 1, 'public', 1, 'active', 'published', 30)`)
    .run(adrian.accountId, new Date(Date.now() + (options.startsIn ?? 7 * DAY)).toISOString().slice(0, 16), seats, options.door ?? null);
}

let clock = 0;
function guest(id: string, status: 'confirmed' | 'requested' | 'waitlist' | 'denied' | 'cancelled', options: { position?: number; plusOne?: boolean } = {}) {
  clock += 1;
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, status, magic_token, waitlist_position, plus_one, created_at)
    VALUES (?, ?, 's', ?, ?, ?, ?, ?, ?)`).run(id, adrian.accountId, `Guest ${id}`, status, `token-${id}`, options.position ?? null,
      options.plusOne ? 1 : 0, `2026-11-0${Math.min(9, clock)}T00:00:00Z`);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, 's', ?, ?, 1, ?)`).run(`seat-of-${id}`, adrian.accountId, id, `Guest ${id}`,
      status === 'confirmed' ? 'confirmed' : status === 'cancelled' ? 'cancelled' : 'requested');
}

const row = <T = Record<string, unknown>>(sql: string, ...values: unknown[]) => db.sqlite.prepare(sql).get(...(values as never[])) as T;
const all = <T = Record<string, unknown>>(sql: string, ...values: unknown[]) => db.sqlite.prepare(sql).all(...(values as never[])) as T[];
const count = (sql: string, ...values: unknown[]) => Number(row<{ n: number }>(sql, ...values).n);
const guestRow = (id: string) => row<{ status: string; claim_expires_at: string | null; offer_lapsed_at: string | null; waitlist_position: number | null }>(
  'SELECT status, claim_expires_at, offer_lapsed_at, waitlist_position FROM event_attendees WHERE id = ?', id);
const offered = () => all<{ id: string }>(`SELECT id FROM event_attendees WHERE status = 'waitlist'
  AND claim_expires_at IS NOT NULL AND datetime(claim_expires_at) > datetime('now') ORDER BY id`).map(r => r.id);
const promotions = () => all<{ attendee_id: string }>(`SELECT attendee_id FROM event_notifications WHERE type = 'waitlist_promotion' ORDER BY rowid`)
  .map(r => r.attendee_id);
const seatNotices = () => count('SELECT COUNT(*) AS n FROM event_seat_notices');
const setOffer = (id: string, at: number) => db.sqlite.prepare('UPDATE event_attendees SET claim_expires_at = ? WHERE id = ?')
  .run(new Date(at).toISOString(), id);
const admin = (path: string, body: unknown = {}, open = false) => call(`/api/admin/attendees/${path}`, { actor: adrian, method: 'PUT', body, open });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  clock = 0;
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner', bundles: ['gather'] });
  db.sqlite.prepare('UPDATE accounts SET is_platform_owner = 1, public_enabled = 1 WHERE id = ?').run(adrian.accountId);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('case 1: an expired claim', () => {
  it('closed: 410 with no code, the offer cleared, and main’s cascade offers the first guest again', async () => {
    session(1);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    setOffer('w1', Date.now() - 60_000);
    const answer = await call('/api/rsvp/token-w1/claim', { method: 'POST' });
    expect(answer.status).toBe(410);
    expect(await answer.json()).toEqual({ error: 'Claim window has expired' });
    // Main's cascade takes the first on the list, who is the same guest.
    expect(offered()).toEqual(['w1']);
    expect(guestRow('w1').offer_lapsed_at).toBeNull();
    expect(promotions()).toEqual(['w1']);
  });

  it('open: 410 offer_expired, and the next guest is offered, never the same one', async () => {
    session(1);
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    expect(await offerFreedSeats(db as never, S)).toEqual(['w1']);
    setOffer('w1', Date.now() - 60_000);
    const answer = await call('/api/rsvp/token-w1/claim', { method: 'POST', open: true });
    expect(answer.status).toBe(410);
    expect(await answer.json()).toMatchObject({ code: 'offer_expired' });
    expect(offered()).toEqual(['w2']);
  });
});

describe('case 2: a claim with no deadline but a lapse mark', () => {
  const lapsed = () => {
    session(2);
    guest('w1', 'waitlist', { position: 1 });
    db.sqlite.prepare(`UPDATE event_attendees SET offer_lapsed_at = '2026-11-20T00:00:00Z' WHERE id = 'w1'`).run();
  };
  it('closed: 400, no claim offer pending, as main', async () => {
    lapsed();
    const answer = await call('/api/rsvp/token-w1/claim', { method: 'POST' });
    expect(answer.status).toBe(400);
    expect(await answer.json()).toEqual({ error: 'No claim offer pending' });
  });
  it('open: 410 offer_expired', async () => {
    lapsed();
    expect((await call('/api/rsvp/token-w1/claim', { method: 'POST', open: true })).status).toBe(410);
  });
});

describe('case 3: a cascade with no seat free', () => {
  it('closed: denying a requested guest at a full table still offers the first waiting guest, as main', async () => {
    session(1);
    guest('c1', 'confirmed');
    guest('r1', 'requested');
    guest('w1', 'waitlist', { position: 1 });
    expect((await admin('r1/deny')).status).toBe(200);
    expect(offered()).toEqual(['w1']);
    expect(promotions()).toEqual(['w1']);
  });
  it('open: no offer', async () => {
    session(1);
    guest('c1', 'confirmed');
    guest('r1', 'requested');
    guest('w1', 'waitlist', { position: 1 });
    expect((await admin('r1/deny', {}, true)).status).toBe(200);
    expect(offered()).toEqual([]);
  });
});

describe('case 4: the first waiting guest already holds a live offer', () => {
  it('closed: their deadline is renewed, and nobody else is offered', async () => {
    session(3);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    const soon = Date.now() + 60_000;
    setOffer('w1', soon);
    expect((await call('/api/rsvp/token-c1', { method: 'PUT', body: { cancel: true } })).status).toBe(200);
    expect(Date.parse(guestRow('w1').claim_expires_at as string)).toBeGreaterThan(soon + 10 * 60_000);
    expect(offered()).toEqual(['w1']);
  });
  it('open: the live offer is left alone and the next guest is offered when a seat is free', async () => {
    session(3);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    setOffer('w1', Date.now() + 60_000);
    expect((await call('/api/rsvp/token-c1', { method: 'PUT', body: { cancel: true }, open: true })).status).toBe(200);
    expect(offered()).toEqual(['w1', 'w2']);
  });
});

describe('case 5: saying no to a waiting guest who holds a live offer', () => {
  it('closed: 200 denied, the offer ends with it, and main’s cascade runs', async () => {
    session(1);
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    setOffer('w1', Date.now() + 10 * 60_000);
    const answer = await admin('w1/deny');
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ success: true, status: 'denied' });
    expect(guestRow('w1')).toMatchObject({ status: 'denied', claim_expires_at: null });
    expect(offered()).toEqual(['w2']);
  });
  it('open: 409 state_conflict', async () => {
    session(1);
    guest('w1', 'waitlist', { position: 1 });
    setOffer('w1', Date.now() + 10 * 60_000);
    expect((await admin('w1/deny', {}, true)).status).toBe(409);
  });
  it('closed or open, a confirmed guest is still released, never said no to', async () => {
    session(1);
    guest('c1', 'confirmed');
    expect((await admin('c1/deny')).status).toBe(409);
    expect(guestRow('c1').status).toBe('confirmed');
  });
});

describe('case 6: saying no to a requested guest', () => {
  it('closed: main’s cascade runs after', async () => {
    session(2);
    guest('r1', 'requested');
    guest('w1', 'waitlist', { position: 1 });
    expect((await admin('r1/deny')).status).toBe(200);
    expect(promotions()).toEqual(['w1']);
  });
  it('open: nothing is promoted by a no', async () => {
    session(2);
    guest('c1', 'confirmed');
    guest('c2', 'confirmed');
    guest('r1', 'requested');
    guest('w1', 'waitlist', { position: 1 });
    expect((await admin('r1/deny', {}, true)).status).toBe(200);
    expect(promotions()).toEqual([]);
  });
});

describe('case 7: moving a guest to the waiting list', () => {
  it('closed: a cancelled or already waiting guest takes a new place at the end, and no offer is made', async () => {
    session(3);
    guest('w1', 'waitlist', { position: 1 });
    guest('x1', 'cancelled');
    const moved = await admin('x1/waitlist');
    expect(moved.status).toBe(200);
    expect(await moved.json()).toEqual({ success: true, status: 'waitlist', waitlist_position: 2 });
    const again = await admin('w1/waitlist');
    expect(await again.json()).toEqual({ success: true, status: 'waitlist', waitlist_position: 3 });
    // Two seats free, yet main made no offer on a move.
    expect(offered()).toEqual([]);
    expect(promotions()).toEqual([]);
  });
  it('closed: a confirmed guest keeps their seat', async () => {
    session(3);
    guest('c1', 'confirmed');
    expect((await admin('c1/waitlist')).status).toBe(409);
    expect(guestRow('c1').status).toBe('confirmed');
  });
  it('open: a cancelled guest is refused, and a requested one moved is offered a free seat at once', async () => {
    session(3);
    guest('x1', 'cancelled');
    guest('r1', 'requested');
    expect((await admin('x1/waitlist', {}, true)).status).toBe(409);
    expect((await admin('r1/waitlist', {}, true)).status).toBe(200);
    expect(offered()).toEqual(['r1']);
  });
});

describe('case 8: one release frees several seats', () => {
  async function cancelPlusOneParty(open: boolean) {
    session(2);
    guest('c1', 'confirmed');
    db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
      VALUES ('seat-of-c1-b', ?, 's', 'c1', 'Friend', 0, 'confirmed')`).run(adrian.accountId);
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    expect((await call('/api/rsvp/token-c1', { method: 'PUT', body: { cancel: true }, open })).status).toBe(200);
  }
  it('closed: one seat is offered per release, as main', async () => {
    await cancelPlusOneParty(false);
    expect(offered()).toEqual(['w1']);
  });
  it('open: every free seat is offered', async () => {
    await cancelPlusOneParty(true);
    expect(offered()).toEqual(['w1', 'w2']);
  });
});

describe('case 9: a seat frees at a by-request table', () => {
  it('closed: the first waiting guest gets a claim window, as main', async () => {
    session(1, { door: 'request' });
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    expect((await call('/api/rsvp/token-c1', { method: 'PUT', body: { cancel: true } })).status).toBe(200);
    expect(guestRow('w1').status).toBe('waitlist');
    expect(offered()).toEqual(['w1']);
  });
  it('open: that guest goes back to asking', async () => {
    session(1, { door: 'request' });
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    expect((await call('/api/rsvp/token-c1', { method: 'PUT', body: { cancel: true }, open: true })).status).toBe(200);
    expect(guestRow('w1').status).toBe('requested');
  });
});

describe('case 10: the scheduled run', () => {
  async function run(open: boolean) {
    session(1);
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    expect(await offerFreedSeats(db as never, S)).toEqual(['w1']);
    setOffer('w1', Date.now() - 60_000);
    await worker.scheduled({ scheduledTime: Date.now(), cron: '0 * * * *' } as never, env(open) as never, { waitUntil: () => undefined } as never);
  }
  it('closed: does nothing to the waiting list, as main', async () => {
    await run(false);
    expect(guestRow('w1').offer_lapsed_at).toBeNull();
    expect(offered()).toEqual([]);
  });
  it('open: lapses the expired offer and offers the next guest', async () => {
    await run(true);
    expect(guestRow('w1').offer_lapsed_at).not.toBeNull();
    expect(offered()).toEqual(['w2']);
  });
});

describe('case 11: removing a plus-one', () => {
  it('closed: main’s cascade runs', async () => {
    session(4);
    guest('c1', 'confirmed', { plusOne: true });
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    expect((await call('/api/rsvp/token-c1', { method: 'PUT', body: { plus_one: false } })).status).toBe(200);
    expect(offered()).toEqual(['w1']);
    expect(promotions()).toEqual(['w1']);
  });
});

describe('case 12: cancel, release and claim write no seat notices while closed', () => {
  it('closed: none are written', async () => {
    session(2);
    guest('c1', 'confirmed');
    guest('c2', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    expect((await call('/api/rsvp/token-c1', { method: 'PUT', body: { cancel: true } })).status).toBe(200);
    expect((await admin('c2', { status: 'cancelled' })).status).toBe(200);
    const claimed = await call('/api/rsvp/token-w1/claim', { method: 'POST' });
    expect(await claimed.json()).toEqual({ success: true, status: 'confirmed' });
    expect(seatNotices()).toBe(0);
  });
  it('open: cancel, offer and claim are recorded', async () => {
    session(1);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    await call('/api/rsvp/token-c1', { method: 'PUT', body: { cancel: true }, open: true });
    await call('/api/rsvp/token-w1/claim', { method: 'POST', open: true });
    expect(all<{ kind: string }>('SELECT kind FROM event_seat_notices ORDER BY rowid').map(r => r.kind)).toEqual(['cancelled', 'offered', 'claimed']);
  });
});

describe('case 13: an admin cancel when the guest was cancelled in between', () => {
  // The admin read sees a confirmed guest; by the write they have cancelled.
  async function race(open: boolean) {
    session(2);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    const real = db.prepare.bind(db);
    let once = false;
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      if (!once && /INSERT INTO event_seat_notices|UPDATE event_party_members SET seat_status = 'cancelled'/.test(sql)) {
        once = true;
        db.sqlite.prepare(`UPDATE event_attendees SET status = 'cancelled' WHERE id = 'c1'`).run();
      }
      return real(sql);
    });
    return admin('c1', { status: 'cancelled' }, open);
  }
  it('closed: 200, as main always answered', async () => {
    const answer = await race(false);
    expect(answer.status).toBe(200);
    expect(await answer.json()).toEqual({ success: true });
  });
  it('open: 409 state_conflict', async () => {
    expect((await race(true)).status).toBe(409);
  });
});

describe('kept from the review run while closed: nothing is offered once tea has begun (A9-6)', () => {
  it('a cancel during tea offers no seat', async () => {
    session(2, { startsIn: -30 * 60_000 });
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    expect((await call('/api/rsvp/token-c1', { method: 'PUT', body: { cancel: true } })).status).toBe(200);
    expect(offered()).toEqual([]);
  });
});
