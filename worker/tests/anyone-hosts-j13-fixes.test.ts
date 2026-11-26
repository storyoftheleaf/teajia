// Launch 3, check run J13 (tests/anyone-hosts.spec.ts): the fixes for what the
// journey found, one describe per finding the worker holds.
//
// 1. A full by-request table puts a guest who asks on its waiting list, and a
//    freed seat sends the guest waiting longest back to asking: never an
//    offer, since every seat there needs the host's yes.
// 2. "Report" on a person's table names it by its slug, because its public
//    answer carries no id; the id is never put back.
// 4. A host makes their own table a tasting from their own page, and the
//    public answer of a person's table says whether it is one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-j13-fixes-secret';
type Actor = { userId: string; name: string; accountId: string };
const adrian: Actor = { userId: 'adrian', name: 'Adrian', accountId: 'shop' };
const ana: Actor = { userId: 'ana', name: 'Ana', accountId: 'ana-home' };
const bo: Actor = { userId: 'bo', name: 'Bo', accountId: 'bo-home' };

let db: SqliteD1;
const allow = { limit: async () => ({ success: true }) };

async function call(path: string, options: { actor?: Actor; method?: string; body?: unknown; anyone?: boolean } = {}) {
  const { actor, body, method = 'GET', anyone = true } = options;
  const headers = new Headers({ 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.13' });
  if (actor) {
    const token = await signedToken(SECRET, {
      sub: actor.userId, name: actor.name, email: `${actor.userId}@test.dev`, active_account_id: actor.accountId, role: 'user',
    });
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Teajia-Account', actor.accountId);
  }
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    DB: db, JWT_SECRET: SECRET, APP_URL: 'https://hosts.test',
    FEW_HOSTS_OPEN: 'true', ANYONE_HOSTS_OPEN: anyone ? 'true' : 'false',
    RSVP_LIMITER: allow, PUBLIC_MCP_LIMITER: allow, PROVIDER_LIMITER: allow, INQUIRY_LIMITER: allow,
  } as never, { waitUntil: () => undefined } as never);
}

const json = async (response: Response) => response.json() as Promise<Record<string, any>>;
const day = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

async function makeTable(actor: Actor, seats: number) {
  const made = await call('/api/me/tables', { actor, method: 'POST', body: { date: day, time: '16:00', timezone: 'Asia/Makassar', seats } });
  expect(made.status).toBe(201);
  return await json(made) as { id: string; slug: string };
}

let phone = 100;
async function ask(slug: string, name: string) {
  phone += 1;
  const asked = await call(`/api/events/${slug}/rsvp`, { method: 'POST', body: { full_name: name, phone_number: `+62 811 5550${phone}` } });
  expect(asked.status).toBe(201);
  const body = await json(asked);
  const row = db.sqlite.prepare('SELECT id FROM event_attendees WHERE magic_token = ?').get(body.magic_token) as { id: string };
  return { status: body.status as string, token: body.magic_token as string, id: row.id };
}

const guestRow = (id: string) => db.sqlite.prepare(
  'SELECT status, claim_expires_at, waitlist_position FROM event_attendees WHERE id = ?').get(id) as {
  status: string; claim_expires_at: string | null; waitlist_position: number | null;
};
const detail = async (tableId: string, actor = ana) => json(await call(`/api/me/tables/${tableId}`, { actor }));
const yes = (tableId: string, id: string) => call(`/api/me/tables/${tableId}/guests/${id}/yes`, { actor: ana, method: 'PUT', body: {} });
const no = (tableId: string, id: string) => call(`/api/me/tables/${tableId}/guests/${id}/no`, { actor: ana, method: 'PUT', body: {} });
const cancel = (token: string) => call(`/api/rsvp/${token}`, { method: 'PUT', body: { cancel: true } });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: adrian.userId, accountId: adrian.accountId, platformRole: 'platform_owner' });
  db.sqlite.prepare('UPDATE accounts SET is_platform_owner = 1 WHERE id = ?').run(adrian.accountId);
  for (const person of [ana, bo]) seedIdentity(db, { userId: person.userId, accountId: person.accountId, publicEnabled: false });
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('finding 1: a full by-request table and a freed seat', () => {
  it('puts a guest who asks at a full table on its waiting list, and says so in the answer', async () => {
    const table = await makeTable(ana, 1);
    const first = await ask(table.slug, 'Ari');
    expect(first.status).toBe('requested');
    expect((await yes(table.id, first.id)).status).toBe(200);

    const second = await ask(table.slug, 'Bo Waits');
    expect(second.status).toBe('waitlist');
    expect(guestRow(second.id)).toMatchObject({ status: 'waitlist', claim_expires_at: null, waitlist_position: 1 });
    const third = await ask(table.slug, 'Cy Waits');
    expect(guestRow(third.id)).toMatchObject({ status: 'waitlist', waitlist_position: 2 });
    expect((await detail(table.id)).table.seats_taken).toBe(1);
    // The guest's own page reads the waiting list.
    expect((await json(await call(`/api/rsvp/${second.token}`))).attendee.status).toBe('waitlist');
  });

  it('a table with a seat free still takes a request, not a place on the list', async () => {
    const table = await makeTable(ana, 2);
    const first = await ask(table.slug, 'Ari');
    await yes(table.id, first.id);
    expect((await ask(table.slug, 'Bo')).status).toBe('requested');
  });

  it('sends the guest waiting longest back to asking when a seat frees: no offer, no seat, and the host is told', async () => {
    const table = await makeTable(ana, 1);
    const first = await ask(table.slug, 'Ari');
    await yes(table.id, first.id);
    const second = await ask(table.slug, 'Bo Waits');
    const third = await ask(table.slug, 'Cy Waits');

    expect((await cancel(first.token)).status).toBe(200);
    expect(guestRow(second.id)).toMatchObject({ status: 'requested', claim_expires_at: null });
    // One free seat, one guest asking for it: the next guest keeps waiting.
    expect(guestRow(third.id)).toMatchObject({ status: 'waitlist', claim_expires_at: null });
    const seen = await detail(table.id);
    expect(seen.table.seats_taken).toBe(0);
    expect(seen.notices.map((notice: { kind: string; guest_name: string }) => [notice.kind, notice.guest_name]))
      .toEqual(expect.arrayContaining([['returned', 'Bo Waits'], ['cancelled', 'Ari']]));
    expect(seen.notices.some((notice: { kind: string }) => notice.kind === 'offered')).toBe(false);
    // Nothing was offered, so there is nothing to claim.
    expect((await call(`/api/rsvp/${second.token}/claim`, { method: 'POST' })).status).toBeGreaterThanOrEqual(400);

    // The host's yes is what gives the seat.
    expect((await yes(table.id, second.id)).status).toBe(200);
    expect(guestRow(second.id).status).toBe('confirmed');
    expect((await detail(table.id)).table.seats_taken).toBe(1);
  });

  it('moves the next guest back to asking when the host says no to the one asking', async () => {
    const table = await makeTable(ana, 1);
    const first = await ask(table.slug, 'Ari');
    await yes(table.id, first.id);
    const second = await ask(table.slug, 'Bo Waits');
    const third = await ask(table.slug, 'Cy Waits');
    await cancel(first.token);
    expect((await no(table.id, second.id)).status).toBe(200);
    expect(guestRow(second.id).status).toBe('denied');
    expect(guestRow(third.id)).toMatchObject({ status: 'requested', claim_expires_at: null });
  });

  it('moves as many guests back as the seats the host adds, and never offers one', async () => {
    const table = await makeTable(ana, 1);
    const first = await ask(table.slug, 'Ari');
    await yes(table.id, first.id);
    const waiting = [await ask(table.slug, 'Bo'), await ask(table.slug, 'Cy'), await ask(table.slug, 'Di')];
    expect((await call(`/api/me/tables/${table.id}`, { actor: ana, method: 'PUT', body: { seats: 3 } })).status).toBe(200);
    expect(waiting.map(guest => guestRow(guest.id).status)).toEqual(['requested', 'requested', 'waitlist']);
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM event_attendees WHERE event_id = ? AND claim_expires_at IS NOT NULL`)
      .get(table.id)).toEqual({ n: 0 });
  });
});

describe('finding 2: a report names a person\'s table by its slug', () => {
  it('files the report against the session the slug names, and the id stays out of every answer', async () => {
    const table = await makeTable(ana, 4);
    const page = await call(`/api/events/${table.slug}/public`);
    expect(page.status).toBe(200);
    expect(await page.text()).not.toContain(table.id);

    const filed = await call('/api/session-reports', { method: 'POST', body: { target_kind: 'session', target_slug: table.slug, reason: 'Money at the door' } });
    expect(filed.status).toBe(201);
    expect(await filed.text()).not.toContain(table.id);
    expect(db.sqlite.prepare('SELECT target_kind, target_id, reason FROM session_reports').all())
      .toEqual([{ target_kind: 'session', target_id: table.id, reason: 'Money at the door' }]);
  });

  it('refuses a slug that names nothing, and still refuses a report that names nothing at all', async () => {
    const missing = await call('/api/session-reports', { method: 'POST', body: { target_kind: 'session', target_slug: 'no-such-table' } });
    expect(missing.status).toBe(404);
    const empty = await call('/api/session-reports', { method: 'POST', body: { target_kind: 'session' } });
    expect(empty.status).toBe(400);
    expect((await json(empty)).error).toBe('Say what you are reporting.');
    // A slug is only a session's: a person is still named by id.
    expect((await call('/api/session-reports', { method: 'POST', body: { target_kind: 'person', target_slug: 'x' } })).status).toBe(400);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM session_reports').get()).toEqual({ n: 0 });
  });

  it('takes no report by slug while Launch 3 is closed', async () => {
    const table = await makeTable(ana, 4);
    expect((await call('/api/session-reports', { method: 'POST', anyone: false, body: { target_kind: 'session', target_slug: table.slug } })).status).toBe(404);
  });
});

describe('finding 4: the host makes their own table a tasting', () => {
  it('sets and clears it from the host\'s own page, and the public answer follows', async () => {
    const table = await makeTable(ana, 4);
    expect((await detail(table.id)).table.is_tasting).toBe(false);
    expect((await json(await call(`/api/events/${table.slug}/public`))).is_tasting).toBe(false);

    const set = await call(`/api/me/tables/${table.id}/tasting`, { actor: ana, method: 'PUT', body: { is_tasting: true } });
    expect(set.status).toBe(200);
    expect(await json(set)).toEqual({ ok: true, is_tasting: true });
    expect(db.sqlite.prepare('SELECT is_tasting FROM events WHERE id = ?').get(table.id)).toEqual({ is_tasting: 1 });
    expect((await detail(table.id)).table.is_tasting).toBe(true);
    expect((await json(await call(`/api/events/${table.slug}/public`))).is_tasting).toBe(true);

    expect((await call(`/api/me/tables/${table.id}/tasting`, { actor: ana, method: 'PUT', body: { is_tasting: false } })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT is_tasting FROM events WHERE id = ?').get(table.id)).toEqual({ is_tasting: 0 });
  });

  it('is the host\'s alone, takes only a yes or a no, and is closed with Launch 3', async () => {
    const table = await makeTable(ana, 4);
    expect((await call(`/api/me/tables/${table.id}/tasting`, { actor: bo, method: 'PUT', body: { is_tasting: true } })).status).toBe(404);
    expect((await call(`/api/me/tables/${table.id}/tasting`, { method: 'PUT', body: { is_tasting: true } })).status).toBeGreaterThanOrEqual(400);
    expect((await call(`/api/me/tables/${table.id}/tasting`, { actor: ana, method: 'PUT', body: { is_tasting: 'yes' } })).status).toBe(400);
    expect((await call(`/api/me/tables/${table.id}/tasting`, { actor: ana, method: 'PUT', anyone: false, body: { is_tasting: true } })).status).toBe(404);
    expect(db.sqlite.prepare('SELECT is_tasting FROM events WHERE id = ?').get(table.id)).toEqual({ is_tasting: 0 });
  });
});
