// Launch 5, M4: circles and series (worker/src/circles.ts, worker/src/mcpTools/circles.ts).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { sha256Hex } from '../src/inquiryDomain';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'circles-test-secret';
const actors = ['host', 'other', 'guest'] as const;
type Actor = typeof actors[number];
const account = (actor: Actor) => `${actor}-account`;
const token = (actor: Actor) => `tjmcp_circles_${actor}`;
const CIRCLE_TOOLS = ['make_circle', 'put_table_in_circle', 'list_my_circles'];
// Nothing an answer here may carry: the way to the house, or any count of meetings or seats.
const NEVER = /Secret Lane|private-map|count|times|seats_taken|confirmed_count|guests_total|attended/i;

let db: SqliteD1;
let circles: boolean;
let fewHosts: boolean;

function run(path: string, bearer: string | null, method: string, body?: unknown, actor?: Actor) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
  if (actor) headers.set('X-Teajia-Account', account(actor));
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    DB: db as unknown as D1Database,
    JWT_SECRET: SECRET,
    FEW_HOSTS_OPEN: String(fewHosts),
    ANYONE_HOSTS_OPEN: 'true',
    CIRCLES_OPEN: String(circles),
    PROVIDER_LIMITER: { limit: async () => ({ success: true }) },
  } as never, { waitUntil() {} } as never);
}

async function route(actor: Actor | null, path: string, method = 'GET', input?: unknown) {
  const jwt = actor ? await signedToken(SECRET, { sub: actor, name: actor, email: `${actor}@test.dev`, role: 'user' }) : null;
  const response = await run(path, jwt, method, input, actor ?? undefined);
  return { status: response.status, body: await response.json() as any };
}

async function rpc(actor: Actor, method: string, params = {}) {
  const response = await run('/mcp', token(actor), 'POST', { jsonrpc: '2.0', id: 1, method, params });
  expect(response.status).toBe(200);
  return await response.json() as any;
}

async function tool(actor: Actor, name: string, args: Record<string, unknown>) {
  const body = await rpc(actor, 'tools/call', { name, arguments: args });
  return body.result?.structuredContent ?? JSON.parse(body.result?.content[0].text ?? JSON.stringify(body.error));
}

function table(id: string, when: string, actor: Actor = 'host', extra: { door?: string; series?: string | null } = {}) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, event_end_date, total_capacity,
      timezone, door, status, lifecycle_status, host_user_id, address_text, map_link, public_visibility, network_discovery,
      series_id, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, 4, 'UTC', ?, 'active', 'published', ?, 'Secret Lane', 'private-map', 'unlisted', 0, ?, ?)`)
    .run(id, account(actor), id, `Table ${id}`, when, extra.door ?? 'request', actor, extra.series ?? null, when);
}

function seat(id: string, event: string, name: string, status: string, contact: { user?: string; phone?: string } = {}) {
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, user_id, phone_number, magic_token, status, photo_consent)
    VALUES (?, 'host-account', ?, ?, ?, ?, ?, ?, 0)`).run(id, event, name, contact.user ?? null, contact.phone ?? null, `magic-${id}`, status);
}

function circle(id: string, kind: 'circle' | 'series' = 'circle', actor: Actor = 'host', name = 'Thursday tea') {
  db.sqlite.prepare(`INSERT INTO session_series (id, account_id, host_user_id, name, kind) VALUES (?, ?, ?, ?, ?)`)
    .run(id, account(actor), actor, name, kind);
}

const seriesOf = (event: string) =>
  (db.sqlite.prepare('SELECT series_id FROM events WHERE id = ?').get(event) as { series_id: string | null }).series_id;

beforeEach(async () => {
  db = new SqliteD1('migrations');
  circles = fewHosts = true;
  for (const actor of actors) {
    seedIdentity(db, { userId: actor, accountId: account(actor), bundles: ['gather'], role: 'owner' });
    if (actor !== 'guest') {
      db.sqlite.prepare('UPDATE accounts SET personal_inventory_user_id = ?, owner_user_id = ?, public_enabled = 0 WHERE id = ?')
        .run(actor, actor, account(actor));
    }
    db.sqlite.prepare(`INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
      VALUES (?, ?, ?, ?, ?, ?, 'tjmcp_', ?, 'account_owner')`).run(actor, account(actor), actor, `${actor}@test.dev`, actor,
      await sha256Hex(token(actor)), JSON.stringify(['catalog:write', 'inventory:read', 'sales:write']));
  }
  table('first', '2099-01-01T12:00');
  table('second', '2099-02-01T12:00');
  table('next', '2099-03-01T12:00');
  table('theirs', '2099-02-01T12:00', 'other');
});

afterEach(() => db.close());

describe('circles and series, closed', () => {
  it.each([[false, true], [true, false]])('with CIRCLES_OPEN=%s and FEW_HOSTS_OPEN=%s nothing answers and nothing changes', async (open, few) => {
    circle('c1');
    db.sqlite.exec(`UPDATE events SET series_id = 'c1' WHERE id IN ('first', 'second')`);
    circles = open;
    fewHosts = few;
    expect((await route('host', '/api/me/circles')).status).toBe(404);
    expect((await route('host', '/api/me/circles', 'POST', { name: 'X', kind: 'circle' })).status).toBe(404);
    expect((await route('host', '/api/me/tables/next/circle', 'PUT', { circle_id: 'c1' })).status).toBe(404);
    expect((await route('host', '/api/me/tables/second/circle-guests')).status).toBe(404);
    expect(seriesOf('next')).toBeNull();
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM session_series').get()).toEqual({ n: 1 });

    const { result } = await rpc('host', 'tools/list');
    expect(result.tools.map((t: { name: string }) => t.name).filter((n: string) => CIRCLE_TOOLS.includes(n))).toEqual([]);
    for (const name of CIRCLE_TOOLS) expect((await tool('host', name, { name: 'X' })).error).toBe('not_available');
  });

  it('the public session answer carries no series while closed, and a copy keeps no circle', async () => {
    circle('c1', 'series');
    db.sqlite.exec(`UPDATE events SET series_id = 'c1' WHERE id = 'second'`);
    circles = false;
    const page = await route(null, '/api/events/second/public');
    expect(page.status).toBe(200);
    expect(page.body).not.toHaveProperty('series');
    const copy = await tool('host', 'same_table_again', { table_id: 'second', slug: 'second-copy', event_date: '2099-04-01T12:00' });
    const done = await tool('host', 'same_table_again', { confirm: copy.confirmation_token });
    expect(done.committed).toBe(true);
    expect(seriesOf(done.table_id)).toBeNull();
  });
});

describe('circles and series, open', () => {
  it('a host makes a circle, puts their own tables in and takes one out', async () => {
    expect((await route('host', '/api/me/circles', 'POST', { name: '  ', kind: 'circle' })).status).toBe(400);
    expect((await route('host', '/api/me/circles', 'POST', { name: 'A', kind: 'club' })).status).toBe(400);
    const made = await route('host', '/api/me/circles', 'POST', { name: 'Thursday tea', kind: 'circle' });
    expect(made.status).toBe(201);
    const id = made.body.circle.id;
    expect((await route('host', '/api/me/tables/first/circle', 'PUT', { circle_id: id })).status).toBe(200);
    expect((await route('host', '/api/me/tables/next/circle', 'PUT', { circle_id: id })).status).toBe(200);
    expect((await route('host', '/api/me/tables/first/circle', 'PUT', { circle_id: null })).status).toBe(200);
    expect([seriesOf('first'), seriesOf('next')]).toEqual([null, id]);
    const list = await route('host', '/api/me/circles');
    expect(list.body.circles).toEqual([{ id, name: 'Thursday tea', kind: 'circle', created_at: expect.any(String),
      tables: [{ id: 'next', title: 'Table next', event_date: '2099-03-01T12:00', timezone: 'UTC', lifecycle_status: 'published' }] }]);
    expect(JSON.stringify(list.body)).not.toMatch(NEVER);
  });

  it('only the host’s own tables and own circles', async () => {
    circle('mine');
    circle('their-circle', 'circle', 'other');
    expect((await route('host', '/api/me/tables/theirs/circle', 'PUT', { circle_id: 'mine' })).status).toBe(404);
    expect((await route('host', '/api/me/tables/next/circle', 'PUT', { circle_id: 'their-circle' })).body.code).toBe('circle_not_found');
    expect((await route('other', '/api/me/tables/next/circle', 'PUT', { circle_id: 'their-circle' })).body.code).toBe('table_not_found');
    expect((await route('other', '/api/me/tables/next/circle-guests')).status).toBe(404);
    expect((await route('other', '/api/me/circles')).body.circles.map((c: { id: string }) => c.id)).toEqual(['their-circle']);
    // A person with no table of their own and no personal account is not a host of circles.
    expect((await route('guest', '/api/me/circles')).status).toBe(404);
    expect([seriesOf('theirs'), seriesOf('next')]).toEqual([null, null]);
    expect((await tool('host', 'put_table_in_circle', { table_id: 'theirs', circle_id: 'mine' })).error).toBe('table_not_found');
  });

  it('asks back only guests confirmed at an earlier table of that circle, as the host’s yes', async () => {
    circle('c1');
    circle('c2');
    db.sqlite.exec(`UPDATE events SET series_id = 'c1' WHERE id IN ('first', 'next');
      UPDATE events SET series_id = 'c2' WHERE id = 'second'`);
    table('later', '2099-06-01T12:00', 'host', { series: 'c1' });
    seat('mei', 'first', 'Mei', 'confirmed', { phone: '+62811000001' });
    seat('lin', 'first', 'Lin', 'cancelled', { phone: '+62811000002' });
    seat('wen', 'first', 'Wen', 'requested', { phone: '+62811000003' });
    seat('other-circle', 'second', 'Jun', 'confirmed', { phone: '+62811000004' });
    seat('after', 'later', 'Hua', 'confirmed', { phone: '+62811000005' });
    seat('already', 'first', 'Bo', 'confirmed', { user: 'guest' });
    seat('already-here', 'next', 'Bo', 'confirmed', { user: 'guest' });

    const listed = await route('host', '/api/me/tables/next/circle-guests');
    expect(listed.body).toEqual({ circle: { id: 'c1', name: 'Thursday tea' }, guests: [{ attendee_id: 'mei', name: 'Mei' }] });
    expect(JSON.stringify(listed.body)).not.toMatch(/\+62|Secret Lane|count/);
    // A table in no circle, or in a series, has nobody to ask back; another host's table is not found.
    table('loose', '2099-07-01T12:00');
    expect((await route('host', '/api/me/tables/loose/circle-guests')).body).toEqual({ circle: null, guests: [] });
    circle('s1', 'series');
    table('in-series', '2099-07-02T12:00', 'host', { series: 's1' });
    expect((await route('host', '/api/me/tables/in-series/circle-guests')).body).toEqual({ circle: null, guests: [] });
    expect((await route('host', '/api/me/tables/theirs/circle-guests')).status).toBe(404);

    for (const id of ['lin', 'wen', 'other-circle', 'after', 'already']) {
      const refused = await route('host', `/api/me/tables/next/circle-guests/${id}/ask`, 'POST', {});
      expect(refused.status, id).toBe(404);
    }
    const asked = await route('host', '/api/me/tables/next/circle-guests/mei/ask', 'POST', {});
    expect(asked.status).toBe(200);
    expect(asked.body).toMatchObject({ ok: true, name: 'Mei', status: 'confirmed' });
    const row = db.sqlite.prepare(`SELECT full_name, phone_number, status, photo_consent, magic_token FROM event_attendees
      WHERE event_id = 'next' AND full_name = 'Mei'`).get() as Record<string, unknown>;
    expect(row).toMatchObject({ full_name: 'Mei', phone_number: '+62811000001', status: 'confirmed', photo_consent: 0 });
    expect(row.magic_token).not.toBe('magic-mei');
    expect(db.sqlite.prepare(`SELECT seat_status FROM event_party_members WHERE event_id = 'next'`).all())
      .toEqual([{ seat_status: 'confirmed' }]);
    // Asked once: she is at this table now, so she is not offered again.
    expect((await route('host', '/api/me/tables/next/circle-guests/mei/ask', 'POST', {})).status).toBe(404);
    expect((await route('host', '/api/me/tables/next/circle-guests')).body.guests).toEqual([]);
  });

  it('a full table refuses the ask back through the guarded allocator', async () => {
    circle('c1');
    db.sqlite.exec(`UPDATE events SET series_id = 'c1', total_capacity = 0 WHERE id = 'next';
      UPDATE events SET series_id = 'c1' WHERE id = 'first'`);
    seat('mei', 'first', 'Mei', 'confirmed', { phone: '+62811000001' });
    const refused = await route('host', '/api/me/tables/next/circle-guests/mei/ask', 'POST', {});
    expect(refused).toMatchObject({ status: 409, body: { code: 'capacity_conflict' } });
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM event_attendees WHERE event_id = 'next'`).get()).toEqual({ n: 0 });
  });

  it('a stopped host makes nothing new, and may still take a table out', async () => {
    circle('c1');
    db.sqlite.exec(`UPDATE events SET series_id = 'c1' WHERE id IN ('first', 'second')`);
    seat('mei', 'first', 'Mei', 'confirmed', { phone: '+62811000001' });
    db.sqlite.exec(`UPDATE users SET hosting_stopped_at = '2099-01-01' WHERE id = 'host'`);
    expect((await route('host', '/api/me/circles', 'POST', { name: 'New', kind: 'series' })).status).toBe(403);
    expect((await route('host', '/api/me/tables/next/circle', 'PUT', { circle_id: 'c1' })).status).toBe(403);
    expect((await route('host', '/api/me/tables/second/circle-guests/mei/ask', 'POST', {})).status).toBe(403);
    expect((await tool('host', 'make_circle', { name: 'New' })).error).toBe('hosting_stopped');
    expect((await tool('host', 'put_table_in_circle', { table_id: 'next', circle_id: 'c1' })).error).toBe('hosting_stopped');
    expect((await route('host', '/api/me/tables/second/circle', 'PUT', { circle_id: null })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM session_series').get()).toEqual({ n: 1 });
    expect([seriesOf('next'), seriesOf('second')]).toEqual([null, null]);
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM event_attendees WHERE event_id = 'second'`).get()).toEqual({ n: 0 });
  });

  it('same table again on a table in a circle puts the copy in the same circle', async () => {
    circle('c1');
    db.sqlite.exec(`UPDATE events SET series_id = 'c1' WHERE id = 'next'`);
    const preview = await tool('host', 'same_table_again', { table_id: 'next', slug: 'next-again', event_date: '2099-04-01T12:00' });
    const done = await tool('host', 'same_table_again', { confirm: preview.confirmation_token });
    expect(seriesOf(done.table_id)).toBe('c1');
  });

  it('the agent tools preview, confirm once, and answer with no address or counts', async () => {
    const { result } = await rpc('host', 'tools/list');
    expect(result.tools.map((t: { name: string }) => t.name).filter((n: string) => CIRCLE_TOOLS.includes(n)).sort())
      .toEqual([...CIRCLE_TOOLS].sort());

    const preview = await tool('host', 'make_circle', { name: 'Spring series', kind: 'series' });
    expect(preview.preview).toMatchObject({ action: 'make_circle', name: 'Spring series', kind: 'series' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM session_series').get()).toEqual({ n: 0 });
    const made = await tool('host', 'make_circle', { confirm: preview.confirmation_token });
    expect(made).toMatchObject({ committed: true, name: 'Spring series', kind: 'series' });
    expect((await tool('host', 'make_circle', { confirm: preview.confirmation_token })).error).toBe('invalid_or_expired_confirmation_token');

    const put = await tool('host', 'put_table_in_circle', { table_id: 'next', circle_id: made.circle_id });
    expect(seriesOf('next')).toBeNull();
    expect((await tool('other', 'put_table_in_circle', { confirm: put.confirmation_token })).error).toBeTruthy();
    expect(await tool('host', 'put_table_in_circle', { confirm: put.confirmation_token })).toMatchObject({ committed: true, table_id: 'next' });
    expect(seriesOf('next')).toBe(made.circle_id);

    const listed = await tool('host', 'list_my_circles', {});
    expect(listed.circles).toEqual([{ id: made.circle_id, name: 'Spring series', kind: 'series',
      tables: [{ id: 'next', title: 'Table next', event_date: '2099-03-01T12:00', timezone: 'UTC' }] }]);
    for (const answer of [preview, made, put, listed]) expect(JSON.stringify(answer)).not.toMatch(NEVER);
    expect((await tool('other', 'list_my_circles', {})).circles).toEqual([]);
  });

  it('the session page names its circle or series and links a series’ other findable sessions, never their address', async () => {
    circle('c1', 'circle', 'host', 'Thursday tea');
    circle('s1', 'series', 'host', 'Spring of Wuyi');
    db.sqlite.exec(`UPDATE events SET series_id = 'c1' WHERE id = 'first';
      UPDATE events SET series_id = 's1' WHERE id IN ('second', 'next');
      UPDATE users SET host_reach = 'listed' WHERE id = 'host'`);
    table('hidden', '2099-05-01T12:00', 'host', { series: 's1' });
    // 'next' is an open table of a host Teajia lists, so anyone may find it; 'hidden' is by link only.
    db.sqlite.exec(`UPDATE events SET door = 'open' WHERE id = 'next'`);

    const circlePage = await route(null, '/api/events/first/public');
    expect(circlePage.body.series).toEqual({ name: 'Thursday tea', kind: 'circle', others: [] });
    const seriesPage = await route(null, '/api/events/second/public');
    expect(seriesPage.body.series).toEqual({ name: 'Spring of Wuyi', kind: 'series',
      others: [{ slug: 'next', title: 'Table next', event_date: '2099-03-01T12:00' }] });
    expect(JSON.stringify(seriesPage.body.series)).not.toMatch(NEVER);
    expect(seriesPage.body).not.toHaveProperty('series_id');
    // A session in no series says nothing of one.
    expect((await route(null, '/api/events/theirs/public')).body).not.toHaveProperty('series');
  });
});
