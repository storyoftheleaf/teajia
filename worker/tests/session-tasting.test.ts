// Launch 3, J8: "this is a tasting". The host's choice, what a guest's seat page
// is told, who may join the event's tasting session, and the after-sit recap.
import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { afterSitRoutes } from '../src/afterSitAccess';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));
const secret = 'session-tasting';

async function setup() {
  const db = new SqliteD1('migrations'); databases.push(db);
  seedIdentity(db, { userId: 'host', accountId: 'shop', bundles: ['gather'] });
  db.sqlite.exec(`
    UPDATE accounts SET public_enabled = 1, status = 'active', owner_user_id = 'host' WHERE id = 'shop';
    INSERT INTO users (id, email, name, password_hash, role, session_version, email_verified_at) VALUES
      ('guest', 'guest@test.dev', 'Guest', 'test', 'user', 0, '2026-11-01'),
      ('waiting', 'waiting@test.dev', 'Waiting', 'test', 'user', 0, '2026-11-01'),
      ('stranger', 'stranger@test.dev', 'Stranger', 'test', 'user', 0, '2026-11-01'),
      ('other-guest', 'other@test.dev', 'Other', 'test', 'user', 0, '2026-11-01');
    INSERT INTO events (id, account_id, slug, title, event_date, status, lifecycle_status, public_visibility, total_capacity) VALUES
      ('sit', 'shop', 'courtyard', 'Tea in the courtyard', '2026-12-01T18:00', 'active', 'published', 'unlisted', 12),
      ('other-sit', 'shop', 'garden', 'Tea in the garden', '2026-12-02T18:00', 'active', 'published', 'unlisted', 8);
    INSERT INTO event_attendees (id, account_id, event_id, full_name, email, magic_token, status, user_id) VALUES
      ('seat', 'shop', 'sit', 'Guest', 'guest@test.dev', 'tok-confirmed', 'confirmed', 'guest'),
      ('seat-email', 'shop', 'sit', 'Mail guest', 'stranger-not@test.dev', 'tok-email', 'confirmed', null),
      ('seat-wait', 'shop', 'sit', 'Waiting', 'waiting@test.dev', 'tok-wait', 'waitlist', 'waiting'),
      ('seat-denied', 'shop', 'sit', 'Denied', 'waiting@test.dev', 'tok-denied', 'denied', 'waiting'),
      ('seat-other', 'shop', 'other-sit', 'Other', 'other@test.dev', 'tok-other', 'confirmed', 'other-guest');
    INSERT INTO products (id, account_id, type, product_name, given_name) VALUES
      ('white', 'shop', 'White', 'Old tree white', null),
      ('red', 'shop', 'Red', 'Red', 'Evening red');
    INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order) VALUES
      ('m-red', 'shop', 'sit', 'red', null, 2),
      ('m-white', 'shop', 'sit', 'white', null, 1),
      ('m-plain', 'shop', 'sit', null, 'A guest''s tin', 3);
  `);
  const tokens: Record<string, string> = {};
  for (const sub of ['host', 'guest', 'waiting', 'stranger', 'other-guest']) {
    tokens[sub] = await signedToken(secret, { sub, email: `${sub}@test.dev`, name: sub, ...(sub === 'host' ? { active_account_id: 'shop', role: 'owner' } : {}) });
  }
  const send = async (path: string, method = 'GET', body?: unknown, as?: string) => worker.fetch(new Request(`https://app.test${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(as ? { Authorization: `Bearer ${tokens[as]}` } : {}),
      ...(as === 'host' ? { 'X-Teajia-Account': 'shop' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, JWT_SECRET: secret, ANYONE_HOSTS_OPEN: 'true' } as never, { waitUntil: () => undefined } as never);
  return { db, send };
}

const flag = (db: SqliteD1, id = 'sit') => (db.sqlite.prepare('SELECT is_tasting FROM events WHERE id = ?').get(id) as { is_tasting: number }).is_tasting;

describe('the host says a session is a tasting', () => {
  it('is off by default, saves on and off, and refuses anything else', async () => {
    const { db, send } = await setup();
    expect(flag(db)).toBe(0);
    const on = await send('/api/admin/events/sit', 'PUT', { is_tasting: true }, 'host');
    expect(on.status, await on.clone().text()).toBeLessThan(300);
    expect(flag(db)).toBe(1);
    expect(await (await send('/api/admin/events/sit', 'GET', undefined, 'host')).json()).toMatchObject({ is_tasting: 1 });
    expect((await send('/api/admin/events/sit', 'PUT', { is_tasting: 0 }, 'host')).status).toBeLessThan(300);
    expect(flag(db)).toBe(0);
    for (const bad of ['yes', 2, null, 'true']) {
      expect((await send('/api/admin/events/sit', 'PUT', { is_tasting: bad }, 'host')).status).toBe(400);
    }
    expect(flag(db)).toBe(0);
    // event_format is left alone.
    expect((db.sqlite.prepare("SELECT event_format FROM events WHERE id = 'sit'").get() as { event_format: string }).event_format).toBe('private_tasting');
  });

  it('cannot be written outside the check', async () => {
    const { db } = await setup();
    expect(() => db.sqlite.exec("UPDATE events SET is_tasting = 2 WHERE id = 'sit'")).toThrow();
  });
});

describe('the guest seat page', () => {
  it('says nothing about a tasting when the choice is off', async () => {
    const { send } = await setup();
    const body = await (await send('/api/rsvp/tok-confirmed')).json() as { event: Record<string, unknown> };
    expect(body.event).toMatchObject({ is_tasting: false, tasting_session_id: null });
  });

  it('tells only a confirmed seat, and gives the session id once it exists', async () => {
    const { db, send } = await setup();
    db.sqlite.exec("UPDATE events SET is_tasting = 1 WHERE id = 'sit'");
    expect((await (await send('/api/rsvp/tok-confirmed')).json() as any).event).toMatchObject({ is_tasting: true, tasting_session_id: null });
    for (const token of ['tok-wait', 'tok-denied']) {
      expect((await (await send(`/api/rsvp/${token}`)).json() as any).event).toMatchObject({ is_tasting: false, tasting_session_id: null });
    }
    const joined = await send('/api/rsvp/tok-confirmed/tasting', 'POST', {}, 'guest');
    const { session_id } = await joined.json() as { session_id: string };
    expect((await (await send('/api/rsvp/tok-confirmed')).json() as any).event.tasting_session_id).toBe(session_id);
    expect((await (await send('/api/rsvp/tok-wait')).json() as any).event.tasting_session_id).toBeNull();
  });
});

describe('a guest opens the tasting', () => {
  it('creates the session from the menu in pouring order, owned by the shop, and lets the guest in', async () => {
    const { db, send } = await setup();
    db.sqlite.exec("UPDATE events SET is_tasting = 1 WHERE id = 'sit'");
    const response = await send('/api/rsvp/tok-confirmed/tasting', 'POST', {}, 'guest');
    expect(response.status, await response.clone().text()).toBe(200);
    const { session_id } = await response.json() as { session_id: string };
    expect(db.sqlite.prepare('SELECT account_id, created_by_user_id, event_id, title, status FROM tasting_sessions WHERE id = ?').get(session_id))
      .toEqual({ account_id: 'shop', created_by_user_id: 'host', event_id: 'sit', title: 'Tea in the courtyard', status: 'active' });

    const page = await send(`/api/sessions/${session_id}`, 'GET', undefined, 'guest');
    expect(page.status).toBe(200);
    const { teas } = await page.json() as { teas: Array<{ tea_name: string; product_id: string | null; position: number }> };
    expect(teas.map(tea => [tea.tea_name, tea.product_id])).toEqual([['Old tree white', 'white'], ['Evening red', 'red'], ["A guest's tin", null]]);

    // A second open, and a second guest, use the same session and add no teas.
    expect((await (await send('/api/rsvp/tok-confirmed/tasting', 'POST', {}, 'guest')).json() as any).session_id).toBe(session_id);
    expect((db.sqlite.prepare('SELECT count(*) AS c FROM tasting_sessions WHERE event_id = ?').get('sit') as { c: number }).c).toBe(1);
    expect((db.sqlite.prepare('SELECT count(*) AS c FROM tasting_session_teas WHERE session_id = ?').get(session_id) as { c: number }).c).toBe(3);
  });

  it('uses a tasting session the host already made for the event', async () => {
    const { db, send } = await setup();
    db.sqlite.exec("UPDATE events SET is_tasting = 1 WHERE id = 'sit'");
    const made = await send('/api/sessions', 'POST', { event_id: 'sit', product_ids: ['red'] }, 'host');
    expect(made.status, await made.clone().text()).toBe(201);
    const hostSession = (await made.json() as { session: { id: string } }).session.id;
    expect((await (await send('/api/rsvp/tok-confirmed/tasting', 'POST', {}, 'guest')).json() as any).session_id).toBe(hostSession);
  });

  it('needs a sign-in', async () => {
    const { db, send } = await setup();
    db.sqlite.exec("UPDATE events SET is_tasting = 1 WHERE id = 'sit'");
    expect((await send('/api/rsvp/tok-confirmed/tasting', 'POST', {})).status).toBe(401);
  });

  it('refuses when the session is not a tasting, and creates nothing', async () => {
    const { db, send } = await setup();
    expect((await send('/api/rsvp/tok-confirmed/tasting', 'POST', {}, 'guest')).status).toBe(404);
    expect((db.sqlite.prepare('SELECT count(*) AS c FROM tasting_sessions').get() as { c: number }).c).toBe(0);
  });

  it('refuses a waitlisted or denied seat, and a seat that is not the signed-in person', async () => {
    const { db, send } = await setup();
    db.sqlite.exec("UPDATE events SET is_tasting = 1 WHERE id = 'sit'");
    expect((await send('/api/rsvp/tok-wait/tasting', 'POST', {}, 'waiting')).status).toBe(403);
    expect((await send('/api/rsvp/tok-denied/tasting', 'POST', {}, 'waiting')).status).toBe(403);
    expect((await send('/api/rsvp/tok-confirmed/tasting', 'POST', {}, 'stranger')).status).toBe(403);
    // A seat with no account opens only to the one verified email it was booked under.
    expect((await send('/api/rsvp/tok-email/tasting', 'POST', {}, 'stranger')).status).toBe(403);
    expect((db.sqlite.prepare('SELECT count(*) AS c FROM tasting_sessions').get() as { c: number }).c).toBe(0);
    db.sqlite.exec("UPDATE event_attendees SET email = 'stranger@test.dev' WHERE id = 'seat-email'");
    expect((await send('/api/rsvp/tok-email/tasting', 'POST', {}, 'stranger')).status).toBe(200);
  });

  it('keeps a guest of another session out of this one', async () => {
    const { db, send } = await setup();
    db.sqlite.exec("UPDATE events SET is_tasting = 1 WHERE id IN ('sit', 'other-sit')");
    const here = (await (await send('/api/rsvp/tok-confirmed/tasting', 'POST', {}, 'guest')).json() as any).session_id;
    const there = (await (await send('/api/rsvp/tok-other/tasting', 'POST', {}, 'other-guest')).json() as any).session_id;
    expect(here).not.toBe(there);
    expect((await send(`/api/sessions/${here}`, 'GET', undefined, 'other-guest')).status).toBe(403);
    expect((await send(`/api/sessions/${there}`, 'GET', undefined, 'other-guest')).status).toBe(200);
    // Their seat token opens their own session again, never this one.
    expect((await (await send('/api/rsvp/tok-other/tasting', 'POST', {}, 'other-guest')).json() as any).session_id).toBe(there);
  });
});

describe('the after-sit recap', () => {
  type Env = { DB: D1Database };
  const routes = afterSitRoutes<Env>({
    requireHost: async () => ({ accountId: 'shop' }),
    requireUser: async () => ({ error: new Response(null, { status: 401 }) }),
    limit: async () => null,
  });
  const call = (db: SqliteD1, path: string, body: unknown, params: Record<string, string> = {}, anyone = true) => {
    const route = routes.find(([verb, pattern]) => verb === 'POST' && pattern === path)!;
    return route[2](new Request(`https://teajia.test${path}`, { method: 'POST', body: JSON.stringify(body) }),
      { DB: db as unknown as D1Database, ANYONE_HOSTS_OPEN: anyone ? 'true' : 'false' }, params);
  };

  async function recap(tasting: boolean, anyone = true) {
    const { db } = await setup();
    db.sqlite.exec(`UPDATE events SET lifecycle_status = 'completed', is_tasting = ${tasting ? 1 : 0} WHERE id = 'sit';
      UPDATE event_attendees SET attended = 1 WHERE id = 'seat';`);
    const link = await call(db, '/api/admin/events/:eventId/after-sit/:attendeeId', undefined, { eventId: 'sit', attendeeId: 'seat' });
    const { credential } = await link.json() as { credential: string };
    return await (await call(db, '/api/after-sit/recap', { credential }, {}, anyone)).json() as Record<string, unknown>;
  }

  it('says nothing of a tasting while Launch 3 is closed (A3)', async () => {
    const body = await recap(true, false);
    expect(body.is_tasting).toBe(false);
    expect(body).not.toHaveProperty('journal_teas');
  });

  it('says a tasting was one and names the teas that have a record', async () => {
    const body = await recap(true);
    expect(body.is_tasting).toBe(true);
    expect(body.journal_teas).toEqual([
      { id: 'm-white', name: 'Old tree white', product_id: 'white' },
      { id: 'm-red', name: 'Evening red', product_id: 'red' },
    ]);
  });

  it('says nothing more for any other session', async () => {
    const body = await recap(false);
    expect(body.is_tasting).toBe(false);
    expect(body).not.toHaveProperty('journal_teas');
  });
});
