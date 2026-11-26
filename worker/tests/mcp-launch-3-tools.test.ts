import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { sha256Hex } from '../src/inquiryDomain';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'launch-3-test-secret';
const actors = ['owner', 'host', 'other', 'guest', 'stranger'] as const;
type Actor = typeof actors[number];
const account = (actor: Actor) => `${actor}-account`;
const token = (actor: Actor) => `tjmcp_launch3_${actor}`;
const HOST_TOOLS = ['release_guest_seat', 'same_table_again', 'set_session_tasting'];
const OWNER_TOOLS = ['stop_host', 'let_host_again'];
const ALL_TOOLS = ['report', 'release_my_seat', ...HOST_TOOLS, ...OWNER_TOOLS];
const date = '2099-12-01T12:00';

let db: SqliteD1;
let fewHosts: boolean;
let anyoneHosts: boolean;

function run(path: string, bearer: string, method: string, body?: unknown, actor?: Actor) {
  const headers = new Headers({ Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' });
  if (actor) headers.set('X-Teajia-Account', account(actor));
  return worker.fetch(new Request(`https://worker.test${path}`, {
    headers, method, body: body === undefined ? undefined : JSON.stringify(body),
  }), {
    DB: {
      prepare(sql: string) {
        const inner = db.prepare(sql);
        const statement = {
          inner,
          bind: (...values: unknown[]) => { inner.bind(...values); return statement; },
          first: async () => inner.first(),
          all: async () => inner.all(),
          run: async () => inner.run(),
        };
        return statement;
      },
      batch: async (statements: { inner: ReturnType<SqliteD1['prepare']> }[]) => db.batch(statements.map(s => s.inner)),
    },
    JWT_SECRET: SECRET,
    FEW_HOSTS_OPEN: String(fewHosts),
    ANYONE_HOSTS_OPEN: String(anyoneHosts),
    PROVIDER_LIMITER: { limit: async () => ({ success: true }) },
  } as never, { waitUntil() {} } as never);
}

async function route(actor: Actor, path: string, method: string, input: unknown, status = 200) {
  const jwt = await signedToken(SECRET, { sub: actor, name: actor, email: `${actor}@test.dev`, role: 'user' });
  const response = await run(path, jwt, method, input, actor);
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(status);
  return body;
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

async function preview(actor: Actor, name: string, args: Record<string, unknown>) {
  const result = await tool(actor, name, args);
  expect(result.preview).toBeDefined();
  expect(result.confirmation_token).toEqual(expect.any(String));
  expect(JSON.stringify(result)).not.toMatch(/Secret Lane|private-map|waitlist_position|seats_released|host_reach|reporter_user_id/);
  return result.confirmation_token as string;
}

async function confirm(actor: Actor, name: string, ticket: string) {
  const result = await tool(actor, name, { confirm: ticket });
  expect(result).toMatchObject({ committed: true });
  expect(JSON.stringify(result)).not.toMatch(/Secret Lane|private-map|waitlist_position|seats_released|host_reach|reporter_user_id/);
  if (actor !== 'owner') expect(result).not.toHaveProperty('hosting_stopped');
  expect((await tool(actor, name, { confirm: ticket })).error).toBe('invalid_or_expired_confirmation_token');
  return result;
}

function table(id: string, actor: Actor = 'host') {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, event_end_date, total_capacity,
      timezone, door, status, lifecycle_status, host_user_id, address_text, map_link, public_visibility, network_discovery)
    VALUES (?, ?, ?, 'Tea table', ?, '2099-12-01T13:00', 1, 'UTC', 'request', 'active', 'published',
      ?, 'Secret Lane', 'private-map', 'unlisted', 0)`).run(id, account(actor), id, date, actor);
}

function guests(event: string) {
  const insert = db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, user_id,
    magic_token, status, waitlist_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  insert.run(`seat-${event}`, account('host'), event, 'guest', 'guest', `magic-${event}`, 'confirmed', null);
  insert.run(`wait-${event}`, account('host'), event, 'waiting guest', null, `queue-${event}`, 'waitlist', 1);
}

function seatState(event: string) {
  return db.sqlite.prepare(`SELECT status, claim_expires_at IS NOT NULL AS offered FROM event_attendees
    WHERE event_id = ? ORDER BY id`).all(event);
}

beforeEach(async () => {
  db = new SqliteD1('migrations');
  fewHosts = anyoneHosts = true;
  for (const actor of actors) {
    seedIdentity(db, { userId: actor, accountId: account(actor), bundles: ['gather'],
      role: actor === 'guest' || actor === 'stranger' ? 'viewer' : 'owner',
      platformRole: actor === 'owner' ? 'platform_owner' : null });
    if (actor === 'host' || actor === 'other') {
      db.sqlite.prepare('UPDATE accounts SET personal_inventory_user_id = ?, owner_user_id = ?, public_enabled = 0 WHERE id = ?')
        .run(actor, actor, account(actor));
    }
    const scopes = actor === 'guest' || actor === 'stranger' ? ['inventory:read'] : ['catalog:write', 'sales:write', 'admin:write'];
    db.sqlite.prepare(`INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
      VALUES (?, ?, ?, ?, ?, ?, 'tjmcp_', ?, ?)`).run(actor, account(actor), actor, `${actor}@test.dev`, actor,
      await sha256Hex(token(actor)), JSON.stringify(scopes), actor === 'owner' ? 'platform_owner' :
        actor === 'guest' || actor === 'stranger' ? 'viewer' : 'account_owner');
  }
  table('agent');
  table('web');
  guests('agent');
  guests('web');
});

afterEach(() => db.close());

describe('Launch 3 MCP tools', () => {
  it.each([
    [false, false, []],
    [false, true, ['report']],
    // Launch 3's tools close with its switch (A3); stopping a host stays with Launch 2's.
    [true, false, [...OWNER_TOOLS]],
    [true, true, ALL_TOOLS],
  ] as const)('lists tools for FEW_HOSTS_OPEN=%s and ANYONE_HOSTS_OPEN=%s', async (few, anyone, expected) => {
    fewHosts = few;
    anyoneHosts = anyone;
    const { result } = await rpc('owner', 'tools/list');
    const tools = result.tools.filter(({ name }: { name: string }) => ALL_TOOLS.includes(name));
    expect(tools.map(({ name }: { name: string }) => name).sort()).toEqual([...expected].sort());
    expect(tools.every(({ annotations }: any) => annotations.readOnlyHint === false)).toBe(true);
    for (const name of ALL_TOOLS.filter(name => !(expected as readonly string[]).includes(name))) {
      expect((await tool('owner', name, {})).error).toBe('not_available');
    }
  });

  it.each(['session', 'person'] as const)('files a %s report with a signed-in read-only token', async kind => {
    if (kind === 'person') db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name) VALUES ('person', 'host-account', 'host', 'Person')`).run();
    const targetId = kind === 'person' ? 'person' : 'agent';
    const args = { target_kind: kind, target_id: targetId, reason: 'Please review' };
    const ticket = await preview('stranger', 'report', args);
    const reports = db.sqlite.prepare('SELECT target_kind, target_id, reason FROM session_reports ORDER BY reporter_user_id');
    expect(reports.all()).toEqual([]);
    const web = await route('guest', '/api/session-reports', 'POST', args, 201);
    expect(await confirm('stranger', 'report', ticket)).toEqual({ ...web as object, committed: true, action: 'report' });
    expect(reports.all()).toEqual(Array.from({ length: 2 }, () => args));
  });

  it('only cancels the caller’s own seat and advances the same waiting list as guest cancel', async () => {
    const args = { attendee_id: 'seat-agent' };
    const before = seatState('agent');
    expect((await tool('stranger', 'release_my_seat', args)).error).toBe('guest_not_found');
    const ticket = await preview('guest', 'release_my_seat', args);
    expect(seatState('agent')).toEqual(before);
    expect((await tool('stranger', 'release_my_seat', { confirm: ticket })).error).toBeTruthy();
    const web = await route('guest', '/api/rsvp/magic-web', 'PUT', { cancel: true });
    expect(await confirm('guest', 'release_my_seat', ticket)).toMatchObject(web as object);
    expect(seatState('agent')).toEqual(seatState('web'));
    // A by-request table: the freed seat sends the waiting guest back to asking, never offers it (J13 finding 1).
    expect(seatState('agent')).toEqual([{ status: 'cancelled', offered: 0 }, { status: 'requested', offered: 0 }]);
  });

  it('lets an unapproved host release a confirmed guest with the same waiting list result as the route', async () => {
    const args = { table_id: 'agent', attendee_id: 'seat-agent' };
    const before = seatState('agent');
    expect((await tool('stranger', 'release_guest_seat', args)).error).toBeTruthy();
    expect((await tool('other', 'release_guest_seat', args)).error).toBe('table_not_found');
    expect((await tool('host', 'release_guest_seat', { ...args, attendee_id: 'wait-agent' })).error).toBe('state_conflict');
    expect((await tool('host', 'release_guest_seat', { ...args, attendee_id: 'seat-web' })).error).toBe('guest_not_found');
    const ticket = await preview('host', 'release_guest_seat', args);
    expect(seatState('agent')).toEqual(before);
    const web = await route('host', '/api/me/tables/web/guests/seat-web/release', 'PUT', {});
    expect(await confirm('host', 'release_guest_seat', ticket)).toEqual({
      committed: true, action: 'release_guest_seat', ok: true, status: 'cancelled',
    });
    expect(web).toMatchObject({ ok: true, status: 'cancelled' });
    expect(seatState('agent')).toEqual(seatState('web'));
  });

  it('lets an unapproved host duplicate their own table as a draft using the route’s copy path', async () => {
    const input = { slug: 'agent-copy', event_date: '2099-12-02T12:00' };
    const args = { table_id: 'agent', ...input };
    expect((await tool('stranger', 'same_table_again', args)).error).toBeTruthy();
    expect((await tool('other', 'same_table_again', args)).error).toBe('table_not_found');
    const copies = db.sqlite.prepare(`SELECT title, host_user_id, door, status, lifecycle_status, event_date, event_end_date,
      address_text, public_visibility, network_discovery FROM events WHERE slug = ?`);
    db.sqlite.exec(`INSERT INTO event_tea_menu (id, account_id, event_id, custom_name, brew_order)
      VALUES ('agent-tea', 'host-account', 'agent', 'Rou Gui', 1), ('web-tea', 'host-account', 'web', 'Rou Gui', 1)`);
    const ticket = await preview('host', 'same_table_again', args);
    expect(copies.get(input.slug)).toBeUndefined();
    await route('host', '/api/admin/events/web/duplicate', 'POST', { ...input, slug: 'web-copy' }, 201);
    const done = await confirm('host', 'same_table_again', ticket);
    expect(done).toEqual({ committed: true, action: 'same_table_again', table_id: expect.any(String) });
    expect(copies.get(input.slug)).toEqual(copies.get('web-copy'));
    expect(db.sqlite.prepare('SELECT custom_name FROM event_tea_menu WHERE event_id = ?').all(done.table_id))
      .toEqual([{ custom_name: 'Rou Gui' }]);
    expect(db.sqlite.prepare('SELECT id FROM event_attendees WHERE event_id = ?').all(done.table_id)).toEqual([]);
    expect(copies.get(input.slug)).toMatchObject({ host_user_id: 'host', status: 'draft', lifecycle_status: 'draft',
      event_end_date: '2099-12-02T13:00', public_visibility: 'unlisted' });
  });

  it('lets an unapproved host mark or clear a tasting with the same stored flag as the route', async () => {
    const flag = db.sqlite.prepare('SELECT is_tasting FROM events WHERE id = ?');
    for (const value of [true, false]) {
      const args = { table_id: 'agent', is_tasting: value };
      expect((await tool('stranger', 'set_session_tasting', args)).error).toBeTruthy();
      expect((await tool('other', 'set_session_tasting', args)).error).toBe('table_not_found');
      const ticket = await preview('host', 'set_session_tasting', args);
      expect(flag.get('agent')).toEqual({ is_tasting: Number(!value) });
      const web = await route('host', '/api/admin/events/web', 'PUT', { is_tasting: value });
      expect(await confirm('host', 'set_session_tasting', ticket)).toMatchObject(web as object);
      expect(flag.get('agent')).toEqual(flag.get('web'));
      expect(flag.get('agent')).toEqual({ is_tasting: Number(value) });
    }
  });

  it('rechecks flags, host standing and seat ownership when confirming', async () => {
    const tasting = await preview('host', 'set_session_tasting', { table_id: 'agent', is_tasting: true });
    anyoneHosts = false;
    expect((await tool('host', 'set_session_tasting', { confirm: tasting })).error).toBe('not_available');
    expect(db.sqlite.prepare("SELECT is_tasting FROM events WHERE id = 'agent'").get()).toEqual({ is_tasting: 0 });
    anyoneHosts = true;

    const copy = await preview('host', 'same_table_again', { table_id: 'agent', slug: 'later', event_date: date });
    await route('owner', '/api/platform/users/host/hosting-stopped', 'PUT', { stopped: true });
    expect((await tool('host', 'same_table_again', { confirm: copy })).error).toBe('not_available');
    expect(db.sqlite.prepare("SELECT id FROM events WHERE slug = 'later'").get()).toBeUndefined();

    const release = await preview('guest', 'release_my_seat', { attendee_id: 'seat-agent' });
    db.sqlite.exec("UPDATE event_attendees SET user_id = 'stranger' WHERE id = 'seat-agent'");
    expect((await tool('guest', 'release_my_seat', { confirm: release })).error).toBe('guest_not_found');
    expect(seatState('agent')[0]).toEqual({ status: 'confirmed', offered: 0 });
  });

  it('changes hosting only for the platform owner and records the same state as the route', async () => {
    const stopped = db.sqlite.prepare('SELECT hosting_stopped_at IS NOT NULL AS stopped FROM users WHERE id = ?');
    for (const [name, value] of [['stop_host', true], ['let_host_again', false]] as const) {
      const args = { user_id: 'host' };
      expect((await tool('other', name, args)).error).toBe('not_available');
      expect((await tool('stranger', name, args)).error).toBeTruthy();
      const ticket = await preview('owner', name, args);
      expect(stopped.get('host')).toEqual({ stopped: Number(!value) });
      const web = await route('owner', '/api/platform/users/other/hosting-stopped', 'PUT', { stopped: value });
      expect(await confirm('owner', name, ticket)).toMatchObject(web as object);
      expect(stopped.get('host')).toEqual(stopped.get('other'));
      expect(stopped.get('host')).toEqual({ stopped: Number(value) });
    }
  });
});
