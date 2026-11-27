// The launch-5 flags-off audit (todo/reviews/launch-5-flags-off-audit.md on
// build/l5-flags-off-audit): with every switch off, the live site answers as
// main did before PR 560 (13143c89). One describe per finding restored here;
// each checks the closed answer against main's and, where it matters, that
// turning the switch on gives the launch's answer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { offerFreedSeats } from '../src/waitingList';
import { isHostArticleId } from '../src/hostArticleOffers';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-launch-5-parity-secret';
const DAY = 24 * 60 * 60 * 1000;
type Actor = { userId: string; accountId: string };
const adrian: Actor = { userId: 'adrian', accountId: 'shop' };
const mei: Actor = { userId: 'mei', accountId: 'mei-account' };
const S = { eventId: 's', accountId: adrian.accountId };

let db: SqliteD1;

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; open?: boolean } = {}) {
  const { actor, body, method = 'GET', open = false } = options;
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.45' });
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
    // Every switch off, as on live, unless the test opens Launch 3.
    FEW_HOSTS_OPEN: 'false', ANYONE_HOSTS_OPEN: open ? 'true' : 'false',
    RSVP_LIMITER: { limit: async () => ({ success: true }) },
  } as never, { waitUntil: () => undefined } as never);
}

function session(seats: number, options: { door?: 'request' | null; hostUserId?: string | null } = {}) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door, host_user_id,
      requires_approval, public_visibility, network_discovery, status, lifecycle_status, claim_window_minutes)
    VALUES ('s', ?, 's', 'Shop session', ?, ?, 'UTC', ?, ?, 1, 'public', 1, 'active', 'published', 30)`)
    .run(adrian.accountId, new Date(Date.now() + 7 * DAY).toISOString().slice(0, 16), seats,
      options.door ?? null, options.hostUserId ?? null);
}

let clock = 0;
function guest(id: string, status: 'confirmed' | 'requested' | 'waitlist' | 'denied', options: { position?: number } = {}) {
  clock += 1;
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, status, magic_token, waitlist_position, created_at)
    VALUES (?, ?, 's', ?, ?, ?, ?, ?)`).run(id, adrian.accountId, `Guest ${id}`, status, `token-${id}`, options.position ?? null,
      `2026-11-0${Math.min(9, clock)}T00:00:00Z`);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, 's', ?, ?, 1, ?)`).run(`seat-of-${id}`, adrian.accountId, id, `Guest ${id}`, status === 'confirmed' ? 'confirmed' : 'requested');
}

const row = <T = Record<string, unknown>>(sql: string, ...values: unknown[]) => db.sqlite.prepare(sql).get(...(values as never[])) as T;
const count = (sql: string, ...values: unknown[]) => Number(row<{ n: number }>(sql, ...values).n);
const attendee = (id: string) => row<{ status: string }>('SELECT status FROM event_attendees WHERE id = ?', id);
const notifications = () => db.sqlite.prepare('SELECT attendee_id, type FROM event_notifications ORDER BY rowid').all();

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

describe('a full by-request table: the party stays asking while Launch 3 is closed', () => {
  const ask = (open: boolean) => call('/api/events/s/rsvp', {
    method: 'POST', open, body: { full_name: 'Late Guest', email: 'late@test.dev', contact_method: 'email' },
  });

  it('answers requested, as main did', async () => {
    session(1, { door: 'request' });
    guest('c1', 'confirmed');
    const answer = await ask(false);
    expect(answer.status).toBe(201);
    expect(await answer.json()).toMatchObject({ status: 'requested' });
    expect(count("SELECT COUNT(*) AS n FROM event_attendees WHERE status = 'waitlist'")).toBe(0);
  });

  it('puts the party on the waiting list with Launch 3 open', async () => {
    session(1, { door: 'request' });
    guest('c1', 'confirmed');
    expect(await (await ask(true)).json()).toMatchObject({ status: 'waitlist' });
  });
});

describe('cancelling while Launch 3 is closed', () => {
  const invite = () => db.sqlite.prepare(`INSERT INTO guest_invites (id, account_id, event_id, parent_attendee_id, invite_token, status)
    VALUES ('inv-1', ?, 's', 'c1', 'invite-token-1', 'pending')`).run(adrian.accountId);
  const inviteStatus = () => row('SELECT status FROM guest_invites WHERE id = ?', 'inv-1');

  it('frees the seat rows, leaves the guest’s pending invitations alone and gives main’s answer every time', async () => {
    session(2);
    guest('c1', 'confirmed');
    invite();
    const body = { cancel: true, cancellation_note: 'Flight moved.' };
    const first = await call('/api/rsvp/token-c1', { method: 'PUT', body });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ success: true, status: 'cancelled', cancellation_note: 'Flight moved.' });
    expect(attendee('c1').status).toBe('cancelled');
    expect(row('SELECT seat_status FROM event_party_members WHERE id = ?', 'seat-of-c1')).toEqual({ seat_status: 'cancelled' });
    expect(inviteStatus()).toEqual({ status: 'pending' });
    // Asked again, main answered the same, note and all.
    expect(await (await call('/api/rsvp/token-c1', { method: 'PUT', body })).json())
      .toEqual({ success: true, status: 'cancelled', cancellation_note: 'Flight moved.' });
  });

  it('cancels from Manage with no invitation expired', async () => {
    session(2);
    guest('c1', 'confirmed');
    invite();
    expect((await call('/api/admin/attendees/c1', { actor: adrian, method: 'PUT', body: { status: 'cancelled' } })).status).toBe(200);
    expect(attendee('c1').status).toBe('cancelled');
    expect(inviteStatus()).toEqual({ status: 'pending' });
  });

  it('expires the invitations with Launch 3 open', async () => {
    session(2);
    guest('c1', 'confirmed');
    invite();
    expect((await call('/api/rsvp/token-c1', { method: 'PUT', open: true, body: { cancel: true } })).status).toBe(200);
    expect(inviteStatus()).toEqual({ status: 'expired' });
  });
});

describe('a claimed seat stays visible in Manage’s Notifications while Launch 3 is closed', () => {
  async function claimOffered(open: boolean) {
    session(1);
    guest('w1', 'waitlist', { position: 1 });
    expect(await offerFreedSeats(db as never, S)).toEqual(['w1']);
    const claimed = await call('/api/rsvp/token-w1/claim', { method: 'POST', open });
    expect(claimed.status).toBe(200);
    expect(await claimed.json()).toEqual({ success: true, status: 'confirmed' });
    return (await (await call('/api/admin/events/s/notifications', { actor: adrian })).json()) as Array<{ type: string; attendee_id: string }>;
  }

  it('records main’s spot_claimed, which the Notifications list shows', async () => {
    const list = await claimOffered(false);
    expect(list.filter(item => item.type === 'spot_claimed').map(item => item.attendee_id)).toEqual(['w1']);
    expect(notifications()).toContainEqual({ attendee_id: 'w1', type: 'spot_claimed' });
  });

  it('leaves it to the seat notices with Launch 3 open', async () => {
    const list = await claimOffered(true);
    expect(list.filter(item => item.type === 'spot_claimed')).toEqual([]);
  });
});

describe('an older event-linked tasting while Launch 3 is closed', () => {
  function tasting(id: string) {
    session(4);
    seedIdentity(db, { userId: mei.userId, accountId: mei.accountId });
    db.sqlite.prepare(`INSERT INTO tasting_sessions (id, account_id, created_by_user_id, title, status, invite_token, max_participants, created_at, event_id)
      VALUES (?, ?, 'adrian', 'Table tasting', 'active', ?, 8, '2026-11-20T00:00:00Z', 's')`).run(id, adrian.accountId, `invite-${id}`);
  }

  it('is joined by its id and keeps its invitation for a member, as main did', async () => {
    tasting('8f2c7a4e-2d1b-4c3a-9e5f-1a2b3c4d5e6f');
    const joined = await call('/api/sessions/8f2c7a4e-2d1b-4c3a-9e5f-1a2b3c4d5e6f/join', { actor: mei, method: 'POST' });
    expect(joined.status).toBe(200);
    const read = await (await call('/api/sessions/8f2c7a4e-2d1b-4c3a-9e5f-1a2b3c4d5e6f', { actor: mei })).json() as { session: Record<string, unknown> };
    expect(read.session.invite_token).toBe('invite-8f2c7a4e-2d1b-4c3a-9e5f-1a2b3c4d5e6f');
  });

  it('refuses a join by id with Launch 3 open', async () => {
    tasting('8f2c7a4e-2d1b-4c3a-9e5f-1a2b3c4d5e6f');
    expect((await call('/api/sessions/8f2c7a4e-2d1b-4c3a-9e5f-1a2b3c4d5e6f/join', { actor: mei, method: 'POST', open: true })).status).toBe(404);
  });

  it('never lets a table’s own tasting, whose id anyone can work out, be joined by its id', async () => {
    tasting('event-tasting-s');
    expect((await call('/api/sessions/event-tasting-s/join', { actor: mei, method: 'POST' })).status).toBe(404);
  });
});

describe('the host-article- id prefix while host articles are closed', () => {
  it('means nothing closed, and marks a host article open', () => {
    expect(isHostArticleId('host-article-abc', { HOST_ARTICLES_OPEN: 'false' })).toBe(false);
    expect(isHostArticleId('host-article-abc', { HOST_ARTICLES_OPEN: 'true' })).toBe(true);
    expect(isHostArticleId('article-abc', { HOST_ARTICLES_OPEN: 'true' })).toBe(false);
  });
});
