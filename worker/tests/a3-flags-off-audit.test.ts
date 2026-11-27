// The review of launches 3 to 5 with every switch off
// (guests-build/launches-3-5-flags-off-audit.md): one describe per Launch 3
// item fixed on build/l3-a3-privacy. Item 1 (no entry key on an unnamed Guest
// Book photo) is held in session-guest-book-photos.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { advanceWaitingLists, offerFreedSeats } from '../src/waitingList';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-flags-off-audit-secret';
const DAY = 24 * 60 * 60 * 1000;
type Actor = { userId: string; accountId: string };
const adrian: Actor = { userId: 'adrian', accountId: 'shop' };
const S = { eventId: 's', accountId: adrian.accountId };

let db: SqliteD1;

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; anyone?: boolean } = {}) {
  const { actor, body, method = 'GET', anyone = false } = options;
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.44' });
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
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://shop.test',
    // Every switch off, as on live: the default in code, said out loud.
    FEW_HOSTS_OPEN: 'false', ANYONE_HOSTS_OPEN: anyone ? 'true' : 'false',
    RSVP_LIMITER: { limit: async () => ({ success: true }) },
  } as never, { waitUntil: () => undefined } as never);
}

/** A shop session, as Adrian makes them on live today. */
function session(seats: number) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone,
      requires_approval, public_visibility, network_discovery, status, lifecycle_status, claim_window_minutes)
    VALUES ('s', ?, 's', 'Shop session', ?, ?, 'UTC', 0, 'public', 1, 'active', 'published', 30)`)
    .run(adrian.accountId, new Date(Date.now() + 7 * DAY).toISOString().slice(0, 16), seats);
}

let clock = 0;
function guest(id: string, status: 'confirmed' | 'requested' | 'waitlist' | 'denied' | 'cancelled', options: { position?: number; seat?: 'held' | 'confirmed' | 'requested' } = {}) {
  clock += 1;
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, status, magic_token, waitlist_position, created_at)
    VALUES (?, ?, 's', ?, ?, ?, ?, ?)`).run(id, adrian.accountId, `Guest ${id}`, status, `token-${id}`, options.position ?? null,
      `2026-11-0${Math.min(9, clock)}T00:00:00Z`);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, 's', ?, ?, 1, ?)`).run(`seat-of-${id}`, adrian.accountId, id, `Guest ${id}`,
      options.seat ?? (status === 'confirmed' ? 'confirmed' : 'requested'));
}

const row = <T = Record<string, unknown>>(sql: string, ...values: unknown[]) => db.sqlite.prepare(sql).get(...(values as never[])) as T;
const offerOf = (id: string) => row<{ claim_expires_at: string | null; status: string; offer_lapsed_at: string | null }>(
  'SELECT claim_expires_at, status, offer_lapsed_at FROM event_attendees WHERE id = ?', id);
const offer = (id: string, at: number) => db.sqlite.prepare('UPDATE event_attendees SET claim_expires_at = ? WHERE id = ?')
  .run(new Date(at).toISOString(), id);
const json = async (response: Response) => response.json() as Promise<Record<string, any>>;

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

describe('item 2: a freed seat is offered on, whatever the guest who left held', () => {
  it('offers the seat on when a waiting guest with a live offer cancels by their link', async () => {
    session(1);
    guest('w-offered', 'waitlist', { position: 1 });
    guest('w-next', 'waitlist', { position: 2 });
    expect(await offerFreedSeats(db as never, S)).toEqual(['w-offered']);

    const gone = await call('/api/rsvp/token-w-offered', { method: 'PUT', body: { cancel: true } });
    expect(gone.status).toBe(200);
    expect(offerOf('w-offered')).toMatchObject({ status: 'cancelled', claim_expires_at: null });
    expect(offerOf('w-next').claim_expires_at).not.toBeNull();
  });

  it('offers the seat on when the shop cancels a waiting guest who held an offer', async () => {
    session(1);
    guest('w-offered', 'waitlist', { position: 1 });
    guest('w-next', 'waitlist', { position: 2 });
    await offerFreedSeats(db as never, S);

    const cancelled = await call('/api/admin/attendees/w-offered', { actor: adrian, method: 'PUT', body: { status: 'cancelled' } });
    expect(cancelled.status).toBe(200);
    expect(offerOf('w-next').claim_expires_at).not.toBeNull();
  });
});

describe('item 3: public and Manage counts use the booking rule', () => {
  it('does not count the seat rows main left behind for a guest who cancelled or was said no to', async () => {
    session(3);
    guest('c1', 'confirmed');
    // What main's cancel and deny left on live: the guest gone, the seat row still held.
    guest('gone', 'cancelled', { seat: 'confirmed' });
    guest('no', 'denied', { seat: 'held' });

    const page = await json(await call('/api/events/s/public'));
    expect(page).toMatchObject({ confirmed_count: 1, seats_remaining: 2 });
    expect(await json(await call('/api/events/s/availability'))).toMatchObject({ confirmed_count: 1, seats_remaining: 2, is_full: false });
    const listed = (await json(await call('/api/events')) as unknown as Array<Record<string, unknown>>).find(ev => ev.slug === 's');
    expect(listed).toMatchObject({ confirmed_count: 1, seats_remaining: 2 });
    const store = (await json(await call('/api/s/shop/events')) as unknown as Array<Record<string, unknown>>).find(ev => ev.slug === 's');
    expect(store).toMatchObject({ confirmed_count: 1, seats_remaining: 2 });
    const manage = (await json(await call('/api/admin/events', { actor: adrian })) as unknown as Array<Record<string, unknown>>)
      .find(ev => ev.id === 's');
    expect(manage).toMatchObject({ confirmed_count: 1 });
    expect(await json(await call('/api/admin/events/s', { actor: adrian }))).toMatchObject({ confirmed_count: 1 });
  });
});

describe('item 4: the scheduled run rewrites no row from before Launch 3', () => {
  it('leaves an old offer of main’s that ran out exactly as it was, and lapses only an offer this code made', async () => {
    session(2);
    guest('c1', 'confirmed');
    // Main's cascade: an offer that ran out long ago, with no notice of this code's.
    guest('w-old', 'waitlist', { position: 1 });
    offer('w-old', Date.now() - 30 * DAY);
    const before = offerOf('w-old');
    guest('w-new', 'waitlist', { position: 2 });

    // The run finds nothing it made, so it writes nothing at all.
    expect(await advanceWaitingLists(db as never)).toEqual({ lapsed: 0, offered: 0 });
    expect(offerOf('w-old')).toEqual(before);
    expect(row<{ n: number }>('SELECT COUNT(*) AS n FROM event_seat_notices').n).toBe(0);
    expect(row<{ n: number }>('SELECT COUNT(*) AS n FROM event_notifications').n).toBe(0);
  });

  it('offers a freed seat to the guest whose old offer ran out, as main did, and leaves no notice for a run to lapse', async () => {
    session(1);
    guest('c1', 'confirmed');
    guest('w-old', 'waitlist', { position: 1 });
    offer('w-old', Date.now() - 30 * DAY);
    guest('w-new', 'waitlist', { position: 2 });

    expect((await call('/api/rsvp/token-c1', { method: 'PUT', body: { cancel: true } })).status).toBe(200);
    // The longest-waiting guest is offered the seat, as on main.
    expect(Date.parse(offerOf('w-old').claim_expires_at!)).toBeGreaterThan(Date.now());
    expect(offerOf('w-new').claim_expires_at).toBeNull();

    // Closed, that offer is main's cascade's (queue cases 10 and 12,
    // todo/review/fixes/queue-cases.md): it leaves no seat notice, so even
    // the run called by hand lapses nothing, and the scheduler does not run it.
    offer('w-old', Date.now() - 1000);
    expect(await advanceWaitingLists(db as never)).toEqual({ lapsed: 0, offered: 0 });
    expect(offerOf('w-old').offer_lapsed_at).toBeNull();
    expect(offerOf('w-new').claim_expires_at).toBeNull();
  });
});

describe('item 5: the session gallery and a shop session’s tasting are closed with the switch off', () => {
  it('writes no tasting on a shop session, shows its guest no tasting door, and answers no gallery', async () => {
    session(4);
    guest('c1', 'confirmed');
    const saved = await call('/api/admin/events/s', { actor: adrian, method: 'PUT', body: { title: 'Shop session', is_tasting: true } });
    expect(saved.status).toBe(200);
    // A10-2: the answer names what was not kept, so a site already open does not claim it was.
    expect(await json(saved)).toMatchObject({ success: true, not_kept: ['is_tasting'] });
    expect(row('SELECT is_tasting FROM events WHERE id = ?', 's')).toEqual({ is_tasting: 0 });

    db.sqlite.prepare("UPDATE events SET is_tasting = 1 WHERE id = 's'").run();
    const page = await json(await call('/api/rsvp/token-c1'));
    expect(page.event.is_tasting).toBe(false);
    expect(page.event.tasting_session_id ?? null).toBeNull();
    expect((await call('/api/rsvp/token-c1/tasting', { method: 'POST', body: {} })).status).toBe(404);
    expect((await call('/api/after-sit/gallery', { method: 'POST', body: { credential: 'x', action: 'read' } })).status).toBe(404);
  });

  it('opens them with the switch on', async () => {
    session(4);
    guest('c1', 'confirmed');
    db.sqlite.prepare("UPDATE events SET is_tasting = 1 WHERE id = 's'").run();
    expect((await json(await call('/api/rsvp/token-c1', { anyone: true }))).event.is_tasting).toBe(true);
    expect((await call('/api/after-sit/gallery', { anyone: true, method: 'POST', body: { credential: 'x', action: 'read' } })).status).not.toBe(404);
  });
});

describe('item 6: main’s answers where the guard was not a safety fix', () => {
  it('lets a guest said no to cancel by their link, as main did', async () => {
    session(2);
    guest('no', 'denied', { seat: 'held' });
    const cancelled = await call('/api/rsvp/token-no', { method: 'PUT', body: { cancel: true } });
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toEqual({ success: true, status: 'cancelled' });
    expect(offerOf('no').status).toBe('cancelled');
    // A seat row main left held for them is given back with it.
    expect(row('SELECT seat_status FROM event_party_members WHERE id = ?', 'seat-of-no')).toEqual({ seat_status: 'cancelled' });
  });

  it('lets the shop mark a guest said no to as cancelled, as main did', async () => {
    session(2);
    guest('no', 'denied');
    expect((await call('/api/admin/attendees/no', { actor: adrian, method: 'PUT', body: { status: 'cancelled' } })).status).toBe(200);
    expect(offerOf('no').status).toBe('cancelled');
  });

  it('still refuses the writes that went around the seat guard (kept as safety fixes)', async () => {
    session(1);
    guest('c1', 'confirmed');
    guest('r1', 'requested');
    // Writing confirmed straight would seat a guest past the seats.
    expect((await call('/api/admin/attendees/r1', { actor: adrian, method: 'PUT', body: { status: 'confirmed' } })).status).toBe(409);
    // Denying or moving a confirmed guest lost their seat rows on main.
    expect((await call('/api/admin/attendees/c1/deny', { actor: adrian, method: 'PUT', body: {} })).status).toBe(409);
    expect((await call('/api/admin/attendees/c1/waitlist', { actor: adrian, method: 'PUT', body: {} })).status).toBe(409);
    expect(offerOf('c1').status).toBe('confirmed');
  });
});
