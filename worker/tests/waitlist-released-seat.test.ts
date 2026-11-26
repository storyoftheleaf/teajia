// Launch 3, slice J9: the waiting list and a released seat. One describe per
// finding of the audit (guests-build/j9-waiting-list-audit.md), 1 to 5 and 7,
// and one for the host's own release. Concurrency is proved the way
// seat-request.test.ts proves it: the writes are held until both callers have
// read, so only the guard inside each write decides.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { eventsToolModule } from '../src/mcpTools/events';
import { advanceWaitingLists, lapseExpiredOffers, offerDeadline, offerFreedSeats, releaseSeats } from '../src/waitingList';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-waiting-list-secret';
const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

type Actor = { userId: string; accountId: string };
const adrian: Actor = { userId: 'adrian', accountId: 'shop' };
const ana: Actor = { userId: 'ana', accountId: 'ana-personal' };
const bo: Actor = { userId: 'bo', accountId: 'bo-personal' };
const T = { eventId: 't', accountId: ana.accountId };

let db: SqliteD1;

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown } = {}) {
  const { actor, body, method = 'GET' } = options;
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' });
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
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test', FEW_HOSTS_OPEN: 'true',
    RSVP_LIMITER: { limit: async () => ({ success: true }) },
  } as never, { waitUntil: () => undefined } as never);
}

function personalAccount(actor: Actor) {
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, '2026-11-26T00:00:00Z')`)
    .run(actor.accountId, actor.accountId, `${actor.userId} chest`, actor.userId, actor.userId);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`)
    .run(actor.accountId, actor.userId);
  db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z' WHERE id = ?`).run(actor.userId);
}

function table(id: string, accountId: string, seats: number, options: { startsIn?: number; hostUserId?: string | null } = {}) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status, claim_window_minutes)
    VALUES (?, ?, ?, ?, ?, ?, 'UTC', 'request', 1, 'unlisted', 0, ?, 'active', 'published', 30)`)
    .run(id, accountId, id, `Table ${id}`, new Date(Date.now() + (options.startsIn ?? 7 * DAY)).toISOString().slice(0, 16), seats,
      options.hostUserId === undefined ? (accountId === ana.accountId ? ana.userId : null) : options.hostUserId);
}

let clock = 0;
function guest(id: string, status: 'confirmed' | 'requested' | 'waitlist', options: {
  eventId?: string; accountId?: string; position?: number | null; companions?: number; created?: string;
} = {}) {
  const eventId = options.eventId ?? 't';
  const accountId = options.accountId ?? ana.accountId;
  clock += 1;
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, status, magic_token, waitlist_position, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, accountId, eventId, `Guest ${id}`, status, `token-${id}`,
      options.position ?? null, options.created ?? `2026-11-0${Math.min(9, clock)}T00:00:00Z`);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, ?, ?, ?, 1, ?)`).run(`seat-of-${id}`, accountId, eventId, id, `Guest ${id}`, status === 'confirmed' ? 'confirmed' : 'requested');
  for (let n = 0; n < (options.companions ?? 0); n += 1) {
    const invite = `invite-${id}-${n}`;
    db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, invitation_id, seat_status)
      VALUES (?, ?, ?, ?, NULL, 0, ?, 'held')`).run(`seat-of-${id}-${n}`, accountId, eventId, id, invite);
    db.sqlite.prepare(`INSERT INTO guest_invites (id, account_id, event_id, parent_attendee_id, invite_token, status)
      VALUES (?, ?, ?, ?, ?, 'pending')`).run(invite, accountId, eventId, id, `invite-token-${id}-${n}`);
  }
}

const row = <T = Record<string, unknown>>(sql: string, ...values: unknown[]) => db.sqlite.prepare(sql).get(...(values as never[])) as T;
const rows = <T = Record<string, unknown>>(sql: string, ...values: unknown[]) => db.sqlite.prepare(sql).all(...(values as never[])) as T[];
const n = (sql: string, ...values: unknown[]) => Number(row<{ n: number }>(sql, ...values).n);
const heldSeats = (eventId = 't') => n(`SELECT COUNT(*) AS n FROM event_party_members pm WHERE event_id = ? AND seat_status IN ('held','confirmed')
  AND NOT EXISTS (SELECT 1 FROM event_attendees g WHERE g.id = pm.participation_id AND g.status IN ('cancelled','denied'))`, eventId);
const liveOffers = (eventId = 't') => n(`SELECT COUNT(*) AS n FROM event_attendees WHERE event_id = ? AND status = 'waitlist'
  AND claim_expires_at IS NOT NULL AND datetime(claim_expires_at) > datetime('now')`, eventId);
const offerOf = (id: string) => row<{ claim_expires_at: string | null; status: string; offer_lapsed_at: string | null }>(
  `SELECT claim_expires_at, status, offer_lapsed_at FROM event_attendees WHERE id = ?`, id);
const capacity = (eventId = 't') => n(`SELECT total_capacity AS n FROM events WHERE id = ?`, eventId);
const notices = (eventId = 't') => rows<{ kind: string; attendee_id: string; seats: number }>(
  `SELECT kind, attendee_id, seats FROM event_seat_notices WHERE event_id = ? ORDER BY rowid`, eventId);
const neverOver = (eventId = 't') => expect(heldSeats(eventId) + liveOffers(eventId)).toBeLessThanOrEqual(capacity(eventId));
const cancel = (id: string) => call(`/api/rsvp/token-${id}`, { method: 'PUT', body: { cancel: true } });
const claim = (id: string) => call(`/api/rsvp/token-${id}/claim`, { method: 'POST' });
const expire = (id: string) => db.sqlite.prepare(`UPDATE event_attendees SET claim_expires_at = ? WHERE id = ?`)
  .run(new Date(Date.now() - 1000).toISOString(), id);

/** A database whose matching writes wait until `count` callers have reached them. */
function heldWrites(match: (sql: string) => boolean, count = 2) {
  let release: () => void = () => undefined;
  const all = new Promise<void>(resolve => { release = resolve; });
  let waiting = 0;
  const arrive = async () => { waiting += 1; if (waiting === count) release(); await all; };
  return {
    prepare: (sql: string) => {
      const statement = db.prepare(sql);
      if (!match(sql)) return statement;
      const held = {
        bind: (...values: unknown[]) => { statement.bind(...values); return held; },
        first: async () => { await arrive(); return statement.first(); },
        run: async () => { await arrive(); return statement.run(); },
        all: async () => { await arrive(); return statement.all(); },
      };
      return held;
    },
    batch: async (statements: never[]) => { await arrive(); return db.batch(statements); },
  };
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  clock = 0;
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner', bundles: ['gather'] });
  db.sqlite.prepare(`UPDATE accounts SET is_platform_owner = 1, public_enabled = 1 WHERE id = ?`).run(adrian.accountId);
  seedIdentity(db, { userId: ana.userId, accountId: 'ana-unused', publicEnabled: false });
  seedIdentity(db, { userId: bo.userId, accountId: 'bo-unused', publicEnabled: false });
  personalAccount(ana);
  personalAccount(bo);
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('finding 1: a cancel frees the seats, and the offered guest can take one', () => {
  it('offers the longest-waiting guest, who then takes the seat; the count never passes the seats', async () => {
    table('t', ana.accountId, 2);
    guest('c1', 'confirmed');
    guest('c2', 'confirmed');
    guest('w-second', 'waitlist', { position: 2 });
    guest('w-first', 'waitlist', { position: 1 });
    neverOver();

    expect((await cancel('c1')).status).toBe(200);
    expect(row(`SELECT seat_status FROM event_party_members WHERE id = 'seat-of-c1'`)).toEqual({ seat_status: 'cancelled' });
    expect(offerOf('w-first').claim_expires_at).not.toBeNull();
    expect(offerOf('w-second').claim_expires_at).toBeNull();
    neverOver();

    const taken = await claim('w-first');
    expect(taken.status).toBe(200);
    expect(await taken.json()).toEqual({ success: true, status: 'confirmed' });
    expect(offerOf('w-first')).toMatchObject({ status: 'confirmed', claim_expires_at: null });
    expect(heldSeats()).toBe(2);
    expect(offerOf('w-second').claim_expires_at).toBeNull();
    neverOver();
  });

  it('breaks a tie in the queue by when they asked, then by id, never by chance', async () => {
    table('t', ana.accountId, 1);
    guest('c1', 'confirmed');
    guest('w-b', 'waitlist', { position: 1, created: '2026-11-02T00:00:00Z' });
    guest('w-a', 'waitlist', { position: 1, created: '2026-11-02T00:00:00Z' });
    guest('w-early', 'waitlist', { position: 1, created: '2026-11-01T00:00:00Z' });
    await cancel('c1');
    expect(offerOf('w-early').claim_expires_at).not.toBeNull();
    expect(liveOffers()).toBe(1);
    db.sqlite.prepare(`UPDATE event_attendees SET status = 'cancelled', claim_expires_at = NULL WHERE id = 'w-early'`).run();
    await offerFreedSeats(db as never, T);
    expect(offerOf('w-a').claim_expires_at).not.toBeNull();
    expect(offerOf('w-b').claim_expires_at).toBeNull();
  });

  it('gives two guests moved to the waiting list at once two positions', async () => {
    table('t', ana.accountId, 1);
    guest('c1', 'confirmed');
    db.sqlite.prepare(`UPDATE accounts SET owner_user_id = 'ana' WHERE id = ?`).run(ana.accountId);
    seedIdentity(db, { userId: ana.userId, accountId: ana.accountId, bundles: ['gather'] });
    guest('r1', 'requested');
    guest('r2', 'requested');
    const [a, b] = await Promise.all([
      call('/api/admin/attendees/r1/waitlist', { actor: ana, method: 'PUT', body: {} }),
      call('/api/admin/attendees/r2/waitlist', { actor: ana, method: 'PUT', body: {} }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    const positions = rows<{ waitlist_position: number }>(`SELECT waitlist_position FROM event_attendees WHERE id IN ('r1','r2')`)
      .map(r => r.waitlist_position).sort();
    expect(positions).toEqual([1, 2]);
    // A confirmed guest is never moved to the waiting list: their seat would be lost.
    expect((await call('/api/admin/attendees/c1/waitlist', { actor: ana, method: 'PUT', body: {} })).status).toBe(409);
    expect(offerOf('c1').status).toBe('confirmed');
  });
});

describe('finding 2: concurrency, repeats, and the routes that went around the guard', () => {
  it('two cancels at once with one guest waiting give one offer, and the deadline is set once', async () => {
    table('t', ana.accountId, 2);
    guest('c1', 'confirmed');
    guest('c2', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    const racing = heldWrites(sql => sql.includes('SET claim_expires_at = ?'));
    const releaseBoth = await Promise.all(['c1', 'c2'].map(id => releaseSeats(db as never, {
      ...T, attendeeId: id, from: ['confirmed'], kind: 'cancelled',
    })));
    expect(releaseBoth.map(r => r?.seats)).toEqual([1, 1]);
    const offered = await Promise.all([offerFreedSeats(racing as never, T), offerFreedSeats(racing as never, T)]);
    expect(offered.flat()).toEqual(['w1']);
    expect(rows(`SELECT 1 FROM event_seat_notices WHERE kind = 'offered'`)).toHaveLength(1);
    neverOver();
  });

  it('the same cancel twice at once gives back the seat once and offers once', async () => {
    table('t', ana.accountId, 1);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    // Only the batch is held: both callers have read before either writes.
    const racing = heldWrites(() => false);
    const results = await Promise.all([1, 2].map(() => releaseSeats(racing as never, {
      ...T, attendeeId: 'c1', from: ['confirmed'], kind: 'cancelled',
    })));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await offerFreedSeats(db as never, T)).toEqual(['w1']);
    const first = offerOf('w1').claim_expires_at;
    expect(first).not.toBeNull();
    // Offering again neither renews the deadline nor offers the seat twice.
    expect(await offerFreedSeats(db as never, T)).toEqual([]);
    expect(offerOf('w1').claim_expires_at).toBe(first);
    // At the route: a second tap is fine and changes nothing.
    const again = await cancel('c1');
    expect(again.status).toBe(200);
    expect(offerOf('w1').claim_expires_at).toBe(first);
    expect(offerOf('w2').claim_expires_at).toBeNull();
    expect(notices().filter(x => x.kind === 'cancelled')).toHaveLength(1);
  });

  it('a guest who never held a seat cancelling offers nothing', async () => {
    table('t', ana.accountId, 1);
    guest('c1', 'confirmed');
    guest('r1', 'requested');
    guest('w1', 'waitlist', { position: 1 });
    expect((await cancel('r1')).status).toBe(200);
    expect(liveOffers()).toBe(0);
    expect(notices()).toEqual([{ kind: 'cancelled', attendee_id: 'r1', seats: 0 }]);
  });

  it('never offers a second seat to a guest who already holds an offer', async () => {
    table('t', ana.accountId, 2);
    guest('c1', 'confirmed');
    guest('c2', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    await cancel('c1');
    await cancel('c2');
    expect(offerOf('w1').claim_expires_at).not.toBeNull();
    expect(offerOf('w2').claim_expires_at).not.toBeNull();
    expect(liveOffers()).toBe(2);
    neverOver();
  });

  it('the attendee editor no longer writes a status around the guard', async () => {
    table('t', ana.accountId, 1);
    seedIdentity(db, { userId: ana.userId, accountId: ana.accountId, bundles: ['gather'] });
    guest('c1', 'confirmed');
    guest('r1', 'requested');
    guest('w1', 'waitlist', { position: 1 });
    const confirm = await call('/api/admin/attendees/r1', { actor: ana, method: 'PUT', body: { status: 'confirmed' } });
    expect(confirm.status).toBe(409);
    expect(offerOf('r1').status).toBe('requested');
    expect(heldSeats()).toBe(1);
    // Cancelled goes through the release: the seat is given back and offered on.
    expect((await call('/api/admin/attendees/c1', { actor: ana, method: 'PUT', body: { status: 'cancelled' } })).status).toBe(200);
    expect(row(`SELECT seat_status FROM event_party_members WHERE id = 'seat-of-c1'`)).toEqual({ seat_status: 'cancelled' });
    expect(offerOf('w1').claim_expires_at).not.toBeNull();
    neverOver();
  });

  it('no is refused to a guest who holds a seat, and a no frees nothing so offers nothing', async () => {
    table('t', ana.accountId, 1);
    seedIdentity(db, { userId: ana.userId, accountId: ana.accountId, bundles: ['gather'] });
    guest('c1', 'confirmed');
    guest('r1', 'requested');
    guest('w1', 'waitlist', { position: 1 });
    expect((await call('/api/admin/attendees/c1/deny', { actor: ana, method: 'PUT', body: {} })).status).toBe(409);
    expect(offerOf('c1').status).toBe('confirmed');
    expect((await call('/api/admin/attendees/r1/deny', { actor: ana, method: 'PUT', body: {} })).status).toBe(200);
    expect(liveOffers()).toBe(0);
  });

  it('writes deadlines to the whole second, so SQLite and the claim agree at the edge', () => {
    expect(offerDeadline(Date.parse('2026-11-26T10:00:00.250Z'), 30)).toBe('2026-11-26T10:30:01.000Z');
    expect(offerDeadline(Date.parse('2026-11-26T10:00:00.000Z'), 30)).toBe('2026-11-26T10:30:00.000Z');
  });

  it('a claim the moment the offer ends is refused as expired, and the seat moves on', async () => {
    table('t', ana.accountId, 1);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    await cancel('c1');
    // Exactly now, to the second: SQLite's datetime() says it has ended.
    db.sqlite.prepare(`UPDATE event_attendees SET claim_expires_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 'w1'`).run();
    const late = await claim('w1');
    expect(late.status).toBe(410);
    expect(offerOf('w1')).toMatchObject({ status: 'waitlist', claim_expires_at: null });
    expect(offerOf('w2').claim_expires_at).not.toBeNull();
    neverOver();
  });

  it('a stale cleanup does not wipe a deadline that was renewed in between', async () => {
    table('t', ana.accountId, 1);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    await cancel('c1');
    const renewed = offerOf('w1').claim_expires_at;
    // The cleanup read the offer as expired a moment ago; its write checks again.
    await lapseExpiredOffers(db as never, T);
    expect(offerOf('w1')).toMatchObject({ claim_expires_at: renewed, offer_lapsed_at: null });
  });
});

describe('finding 3: a cancelled party gives back all its seats', () => {
  it('gives back the guest’s seat and the companion nobody claimed, and offers both', async () => {
    table('t', ana.accountId, 2);
    guest('c1', 'confirmed', { companions: 1 });
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    expect(heldSeats()).toBe(2);
    await cancel('c1');
    expect(rows(`SELECT seat_status FROM event_party_members WHERE participation_id = 'c1' ORDER BY id`))
      .toEqual([{ seat_status: 'cancelled' }, { seat_status: 'cancelled' }]);
    expect(row(`SELECT status FROM guest_invites WHERE id = 'invite-c1-0'`)).toEqual({ status: 'expired' });
    expect(notices()[0]).toEqual({ kind: 'cancelled', attendee_id: 'c1', seats: 2 });
    expect(liveOffers()).toBe(2);
    neverOver();
  });

  it('a companion who already claimed keeps their own seat', async () => {
    table('t', ana.accountId, 2);
    guest('c1', 'confirmed', { companions: 1 });
    // The companion claimed: their seat moved to their own participation.
    db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, status, magic_token)
      VALUES ('friend', ?, 't', 'Friend', 'confirmed', 'token-friend')`).run(ana.accountId);
    db.sqlite.prepare(`UPDATE event_party_members SET participation_id = 'friend', seat_status = 'confirmed' WHERE id = 'seat-of-c1-0'`).run();
    db.sqlite.prepare(`UPDATE guest_invites SET status = 'claimed', claimed_attendee_id = 'friend' WHERE id = 'invite-c1-0'`).run();
    await cancel('c1');
    expect(row(`SELECT seat_status FROM event_party_members WHERE id = 'seat-of-c1-0'`)).toEqual({ seat_status: 'confirmed' });
    expect(offerOf('friend').status).toBe('confirmed');
    expect(heldSeats()).toBe(1);
  });

  it('a seat left counted by a cancel from before this fix no longer counts', async () => {
    table('t', ana.accountId, 1);
    guest('old', 'confirmed');
    db.sqlite.prepare(`UPDATE event_attendees SET status = 'cancelled' WHERE id = 'old'`).run();
    guest('w1', 'waitlist', { position: 1 });
    expect(await offerFreedSeats(db as never, T)).toEqual(['w1']);
    expect((await claim('w1')).status).toBe(200);
  });
});

describe('finding 4: an offer that runs out moves the queue on', () => {
  it('the scheduled worker lapses an expired offer and offers the next guest', async () => {
    table('t', ana.accountId, 1);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    await cancel('c1');
    expire('w1');
    await worker.scheduled({ scheduledTime: Date.now(), cron: '0 * * * *' } as never, { DB: db } as never, { waitUntil: () => undefined } as never);
    expect(offerOf('w1')).toMatchObject({ status: 'waitlist', claim_expires_at: null });
    expect(offerOf('w1').offer_lapsed_at).not.toBeNull();
    expect(offerOf('w2').claim_expires_at).not.toBeNull();
    expect(notices().map(x => `${x.kind}:${x.attendee_id}`)).toEqual(['cancelled:c1', 'offered:w1', 'offer_lapsed:w1', 'offered:w2']);
    neverOver();
  });

  it('an expired claim offers the next guest, never the same one again', async () => {
    table('t', ana.accountId, 1);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    await cancel('c1');
    expire('w1');
    expect((await claim('w1')).status).toBe(410);
    expect(offerOf('w2').claim_expires_at).not.toBeNull();
    expect(offerOf('w1').claim_expires_at).toBeNull();
    // Asking again is still expired, and still not a new offer.
    expect((await claim('w1')).status).toBe(410);
    expect(offerOf('w1').claim_expires_at).toBeNull();
    // When the last guest also lets it pass, the seat stays free for a new yes.
    expire('w2');
    expect(await advanceWaitingLists(db as never)).toEqual({ lapsed: 1, offered: 0 });
    expect(liveOffers()).toBe(0);
  });

  it('makes no offer once the session has begun', async () => {
    table('t', ana.accountId, 1, { startsIn: -HOUR });
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    await cancel('c1');
    expect(liveOffers()).toBe(0);
  });
});

describe('finding 5: seats are never lowered below confirmed guests and live offers', () => {
  beforeEach(async () => {
    table('t', ana.accountId, 3);
    guest('c1', 'confirmed');
    guest('c2', 'confirmed');
    guest('c3', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    await cancel('c3');
    expect(liveOffers()).toBe(1);
  });

  it('is refused on the table’s own page, in the admin, and by the agent tool at confirm', async () => {
    expect((await call('/api/me/tables/t', { actor: ana, method: 'PUT', body: { seats: 2 } })).status).toBe(409);
    expect((await call('/api/admin/events/t', { actor: ana, method: 'PUT', body: { total_capacity: 2 } })).status).toBe(409);
    const H = eventsToolModule.handlers;
    const auth = { accountId: ana.accountId, userId: ana.userId, userEmail: 'ana@test.dev', tokenId: 't-ana', scopes: [], creatorTier: 'platform_owner' };
    const env = { DB: db as unknown as D1Database };
    expect(await H.update_event(env, auth as never, { event_id: 't', total_capacity: 2 })).toMatchObject({ error: 'capacity_below_held_seats' });
    const preview = await H.update_event(env, auth as never, { event_id: 't', total_capacity: 3 }) as { confirmation_token: string };
    db.sqlite.prepare(`UPDATE events SET total_capacity = 4 WHERE id = 't'`).run();
    guest('c4', 'confirmed');
    const confirmed = await H.update_event(env, auth as never, { event_id: 't', total_capacity: 3, confirm: preview.confirmation_token });
    expect(confirmed).toMatchObject({ error: 'capacity_below_held_seats' });
    expect(capacity()).toBe(4);
    neverOver();
  });

  it('an offer is never made to a seat a lowered capacity took away', async () => {
    db.sqlite.prepare(`UPDATE event_attendees SET status = 'cancelled', claim_expires_at = NULL WHERE id = 'w1'`).run();
    expect((await call('/api/me/tables/t', { actor: ana, method: 'PUT', body: { seats: 2 } })).status).toBe(200);
    guest('w2', 'waitlist', { position: 2 });
    expect(await offerFreedSeats(db as never, T)).toEqual([]);
  });
});

describe('finding 7: the host is told, in the app, and nothing is marked sent', () => {
  it('records cancel, offer, lapse and claim for the host’s table page and Manage', async () => {
    table('t', ana.accountId, 1);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    await cancel('c1');
    expire('w1');
    await claim('w1');
    await claim('w2');
    const page = await (await call('/api/me/tables/t', { actor: ana })).json() as {
      notices: Array<{ kind: string; guest_name: string; seats: number }>;
      guests: Array<{ id: string; offer_until: string | null; offer_lapsed: boolean }>;
    };
    expect(page.notices.map(x => `${x.kind}:${x.guest_name}`)).toEqual([
      'claimed:Guest w2', 'offered:Guest w2', 'offer_lapsed:Guest w1', 'offered:Guest w1', 'cancelled:Guest c1',
    ]);
    expect(page.guests.find(g => g.id === 'w1')).toMatchObject({ offer_until: null, offer_lapsed: true });
    // Nothing claims to have been sent, and the worker sent nothing.
    expect(n(`SELECT COUNT(*) AS n FROM event_notifications WHERE status = 'sent'`)).toBe(0);
    expect(n(`SELECT COUNT(*) AS n FROM event_notifications WHERE type = 'spot_claimed'`)).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    // Another host sees none of it.
    expect((await call('/api/me/tables/t', { actor: bo })).status).toBe(404);
  });

  it('shows a shop session’s notices in Manage, to the shop only', async () => {
    table('s', adrian.accountId, 1, { hostUserId: null });
    guest('c1', 'confirmed', { eventId: 's', accountId: adrian.accountId });
    guest('w1', 'waitlist', { eventId: 's', accountId: adrian.accountId, position: 1 });
    await offerFreedSeats(db as never, { eventId: 's', accountId: adrian.accountId });
    expect(liveOffers('s')).toBe(0);
    await releaseSeats(db as never, { eventId: 's', accountId: adrian.accountId, attendeeId: 'c1', from: ['confirmed'], kind: 'cancelled' });
    await offerFreedSeats(db as never, { eventId: 's', accountId: adrian.accountId });
    const manage = await (await call('/api/admin/events/s/seat-notices', { actor: adrian })).json() as { notices: Array<{ kind: string }> };
    expect(manage.notices.map(x => x.kind)).toEqual(['offered', 'cancelled']);
    expect((await call('/api/admin/events/s/seat-notices', { actor: ana })).status).toBe(404);
  });
});

describe('the host releases a confirmed guest’s seat on their own table', () => {
  it('gives back the party’s seats and offers them to the guests waiting longest', async () => {
    table('t', ana.accountId, 2);
    guest('c1', 'confirmed', { companions: 1 });
    guest('w1', 'waitlist', { position: 1 });
    guest('w2', 'waitlist', { position: 2 });
    guest('w3', 'waitlist', { position: 3 });
    const released = await call('/api/me/tables/t/guests/c1/release', { actor: ana, method: 'PUT', body: {} });
    expect(released.status).toBe(200);
    expect(await released.json()).toEqual({ ok: true, status: 'cancelled', seats_released: 2, offered: 2 });
    expect(offerOf('c1').status).toBe('cancelled');
    expect([offerOf('w1'), offerOf('w2'), offerOf('w3')].map(x => x.claim_expires_at !== null)).toEqual([true, true, false]);
    expect(notices()[0]).toEqual({ kind: 'released', attendee_id: 'c1', seats: 2 });
    expect((await claim('w2')).status).toBe(200);
    neverOver();
  });

  it('is only for a confirmed guest, only on the host’s own table, and only before it happens', async () => {
    table('t', ana.accountId, 2);
    guest('c1', 'confirmed');
    guest('r1', 'requested');
    expect((await call('/api/me/tables/t/guests/r1/release', { actor: ana, method: 'PUT', body: {} })).status).toBe(409);
    expect((await call('/api/me/tables/t/guests/c1/release', { actor: bo, method: 'PUT', body: {} })).status).toBe(404);
    expect((await call('/api/me/tables/t/guests/c1/release', { method: 'PUT', body: {} })).status).toBe(401);
    expect(offerOf('c1').status).toBe('confirmed');
    db.sqlite.prepare(`UPDATE events SET lifecycle_status = 'completed' WHERE id = 't'`).run();
    expect((await call('/api/me/tables/t/guests/c1/release', { actor: ana, method: 'PUT', body: {} })).status).toBe(409);
    expect(offerOf('c1').status).toBe('confirmed');
  });

  it('two releases of the same guest at once give the seat back once', async () => {
    table('t', ana.accountId, 1);
    guest('c1', 'confirmed');
    guest('w1', 'waitlist', { position: 1 });
    const [a, b] = await Promise.all([
      call('/api/me/tables/t/guests/c1/release', { actor: ana, method: 'PUT', body: {} }),
      call('/api/me/tables/t/guests/c1/release', { actor: ana, method: 'PUT', body: {} }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(notices().filter(x => x.kind === 'released')).toHaveLength(1);
    expect(liveOffers()).toBe(1);
  });
});
