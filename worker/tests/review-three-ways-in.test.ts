// A11 review (todo/plans/review-prompts/astra-a11-three-ways-in.md): one
// action, three ways in. The host's page route, the same tool called with a
// scoped token on the host's own personal account (the "owner tool" way a
// shop token takes), and the host's own key (`host:self`). Each block sends
// the same good input and the same bad inputs through every way and compares
// what each answered and what each wrote.
//
// Tests named "FINDING A11-n" are expected to FAIL on build/review: each one
// asserts the rule the page keeps and shows the way in that does not keep it.
// Everything else passes and is a line under "What holds" in
// todo/review/findings/A11.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { sha256Hex } from '../src/inquiryDomain';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/* mcp.ts fires some writes without awaiting them, so the D1 it is handed has
   to return promises the way the real one does (as in host-token.test.ts). */
class AsyncD1 {
  constructor(readonly inner: SqliteD1) {}
  prepare(sql: string) {
    const inner = this.inner.prepare(sql);
    const statement: any = {
      inner,
      bind: (...values: unknown[]) => { inner.bind(...values); return statement; },
      first: async () => inner.first(),
      all: async () => inner.all(),
      run: async () => inner.run(),
    };
    return statement;
  }
  async batch(statements: any[]) { return this.inner.batch(statements.map(s => s.inner)); }
}

const SECRET = 'a11-three-ways-secret';
const ALL_SCOPES = ['inventory:read', 'customers:read', 'sales:read', 'stock:write', 'sales:write', 'catalog:write', 'customers:write', 'admin:write'];
const INVALID = { error: 'invalid_or_expired_confirmation_token' };

let db: SqliteD1;
let flags: Record<string, string>;

function env() {
  return {
    DB: new AsyncD1(db), JWT_SECRET: SECRET, APP_URL: 'https://hosts.test',
    PROVIDER_LIMITER: { limit: async () => ({ success: true }) },
    AFTER_SIT_LIMITER: { limit: async () => ({ success: true }) },
    ...flags,
  } as any;
}

async function send(path: string, init: { method?: string; bearer?: string | null; body?: unknown; account?: string } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (init.bearer) headers.set('Authorization', `Bearer ${init.bearer}`);
  if (init.account) headers.set('X-Teajia-Account', init.account);
  return worker.fetch(new Request(`https://api.hosts.test${path}`, {
    method: init.method ?? 'GET', headers,
    body: init.body === undefined || !init.method || init.method === 'GET' ? undefined : JSON.stringify(init.body),
  }), env(), { waitUntil() {}, passThroughOnException() {} } as any);
}

/** The page's way in: a signed-in person calling the route the page calls. */
async function route(who: string, path: string, method = 'GET', body?: unknown, account?: string) {
  const jwt = await signedToken(SECRET, {
    sub: who, name: who, email: `${who}@test.dev`, role: 'user', active_account_id: account ?? null, session_version: 0,
  });
  const response = await send(path, { method, bearer: jwt, body, account });
  const text = await response.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: response.status, body: parsed };
}

async function rpc(token: string, method: string, params: Record<string, unknown> = {}) {
  const response = await send('/mcp', { method: 'POST', bearer: token, body: { jsonrpc: '2.0', id: 1, method, params } });
  return { status: response.status, body: await response.json() as any };
}

/** One tools/call. An auth refusal or an unknown tool comes back as { status, rpcError }. */
async function call(token: string, name: string, args: Record<string, unknown> = {}): Promise<any> {
  const { status, body } = await rpc(token, 'tools/call', { name, arguments: args });
  if (status !== 200 || body.error) return { status, rpcError: body.error };
  const text = body.result?.content?.[0]?.text ?? '{}';
  try { return JSON.parse(text); } catch { return { toolError: text }; }
}

/** Preview, then confirm when the preview gave a ticket. Returns both answers. */
async function viaTool(token: string, name: string, args: Record<string, unknown>, keepOnConfirm: string[] = []) {
  const preview = await call(token, name, args);
  if (!preview?.confirmation_token) return { preview, result: preview, ticket: null as string | null };
  const kept = Object.fromEntries(keepOnConfirm.map(key => [key, args[key]]));
  const result = await call(token, name, { ...kept, confirm: preview.confirmation_token });
  return { preview, result, ticket: preview.confirmation_token as string };
}

const refused = (answer: any) => Boolean(
  answer?.error || answer?.rpcError || answer?.toolError || (typeof answer?.status === 'number' && answer.status >= 400),
);
const count = (sql: string, ...values: unknown[]) => Number((db.sqlite.prepare(sql).get(...values as never[]) as { n: number }).n);
const statusOf = (attendeeId: string) =>
  (db.sqlite.prepare('SELECT status FROM event_attendees WHERE id = ?').get(attendeeId) as { status: string } | undefined)?.status;

function personalAccount(userId: string, approved: boolean) {
  const id = `${userId}-personal`;
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, ?)`)
    .run(id, id, id, userId, userId, approved ? '2026-11-26T00:00:00Z' : null);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`).run(id, userId);
  if (approved) db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z' WHERE id = ?`).run(userId);
}

function table(id: string, accountId: string, hostUserId: string | null, capacity = 6) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status, address_text, map_link)
    VALUES (?, ?, ?, ?, ?, ?, 'Asia/Taipei', 'request', 1, 'unlisted', 0, ?, 'active', 'published', '12 Secret Lane', 'https://maps.test/secret')`)
    .run(id, accountId, `slug-${id}`, `Table ${id}`, new Date(Date.now() + 7 * 86400000).toISOString(), capacity, hostUserId);
}

function guest(id: string, eventId: string, accountId: string, status = 'confirmed') {
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, email, magic_token, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, accountId, eventId, `Guest ${id}`, `${id}@guest.test`, `magic-${id}`, status);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, ?, ?, ?, 1, ?)`).run(`seat-${id}`, accountId, eventId, id, `Guest ${id}`, status === 'confirmed' ? 'confirmed' : 'requested');
}

async function shopToken(token: string, userId: string, accountId: string, scopes: unknown, tier = 'account_owner') {
  db.sqlite.prepare(`INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(`tok-${token}`, accountId, userId, `${userId}@test.dev`, token, await sha256Hex(token), token.slice(0, 8), JSON.stringify(scopes), tier);
}

/** A host key made the way a host makes one: through their own page. */
async function mint(who: string) {
  const made = await route(who, '/api/me/assistant-tokens', 'POST', { label: 'My assistant' });
  expect(made.status, JSON.stringify(made.body)).toBe(201);
  return made.body.token as string;
}

const stop = (userId: string) =>
  db.sqlite.prepare(`UPDATE users SET hosting_stopped_at = '2026-11-27T00:00:00Z', hosting_stopped_by = 'adrian' WHERE id = ?`).run(userId);

const ANA_SHOP = 'tjmcp_a11_ana_shop_scoped_token';
let anaKey: string;

beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('No external services in this test'); }));
  flags = {
    HOST_TOKENS_OPEN: 'true', FEW_HOSTS_OPEN: 'true', ANYONE_HOSTS_OPEN: 'true',
    CIRCLES_OPEN: 'true', FAVOURITES_OPEN: 'true', TEA_TABLE_OPEN: 'true', FIRST_TABLE_OPEN: 'true',
  };
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'adrian', accountId: 'platform-home', platformRole: 'platform_owner' });
  db.sqlite.prepare('UPDATE accounts SET is_platform_owner = 1 WHERE id = ?').run('platform-home');
  for (const [person, approved] of [['ana', true], ['bo', true], ['cy', false]] as const) {
    seedIdentity(db, { userId: person, accountId: `${person}-home`, publicEnabled: false });
    personalAccount(person, approved);
  }
  await shopToken('tjmcp_a11_adrian_everything', 'adrian', 'platform-home', ALL_SCOPES, 'platform_owner');
  await shopToken(ANA_SHOP, 'ana', 'ana-personal', ALL_SCOPES);
  table('t-ana', 'ana-personal', 'ana');
  table('t-bo', 'bo-personal', 'bo');
  guest('g-bo', 't-bo', 'bo-personal', 'requested');
  anaKey = await mint('ana');
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

// ── Make a table ────────────────────────────────────────────────────────────

describe('make a table: POST /api/me/tables, host_table (scoped), host_table (host key)', () => {
  const good = { date: '2030-01-05', time: '16:00', timezone: 'Asia/Taipei', seats: 4, name: 'Winter shou' };
  const tablesOfAna = () => count(`SELECT COUNT(*) AS n FROM events WHERE account_id = 'ana-personal' AND host_user_id = 'ana'`);

  it('the same good input makes the same table every way', async () => {
    const page = await route('ana', '/api/me/tables', 'POST', good);
    expect(page.status, JSON.stringify(page.body)).toBe(201);
    const scoped = await viaTool(ANA_SHOP, 'host_table', good);
    expect(scoped.result).toMatchObject({ committed: true });
    const key = await viaTool(anaKey, 'host_table', good);
    expect(key.result).toMatchObject({ committed: true });
    const rows = db.sqlite.prepare(`SELECT event_date, timezone, total_capacity, door, requires_approval, status, lifecycle_status,
        public_visibility, network_discovery, title FROM events WHERE account_id = 'ana-personal' AND id <> 't-ana' ORDER BY created_at`).all();
    expect(rows).toHaveLength(3);
    expect(rows[1]).toEqual(rows[0]);
    expect(rows[2]).toEqual(rows[0]);
  });

  it('switch closed, stopped host, missing day, 41 seats and a replayed ticket are refused every way and write nothing', async () => {
    const before = tablesOfAna();
    // Missing required field and out of range.
    for (const bad of [{ ...good, date: undefined }, { ...good, seats: 41 }, { ...good, time: '25:00' }]) {
      expect((await route('ana', '/api/me/tables', 'POST', bad)).status).toBe(400);
      expect(refused((await viaTool(ANA_SHOP, 'host_table', bad)).result)).toBe(true);
      expect(refused((await viaTool(anaKey, 'host_table', bad)).result)).toBe(true);
    }
    // Replay of a used ticket.
    const once = await viaTool(ANA_SHOP, 'host_table', good);
    expect(await call(ANA_SHOP, 'host_table', { confirm: once.ticket })).toEqual(INVALID);
    const onceKey = await viaTool(anaKey, 'host_table', good);
    expect(await call(anaKey, 'host_table', { confirm: onceKey.ticket })).toEqual(INVALID);
    expect(tablesOfAna()).toBe(before + 2);
    // A preview made before the stop cannot be confirmed after it.
    const pending = await call(ANA_SHOP, 'host_table', good);
    stop('ana');
    expect((await route('ana', '/api/me/tables', 'POST', good)).body.code).toBe('hosting_stopped');
    expect(refused(await call(ANA_SHOP, 'host_table', { confirm: pending.confirmation_token }))).toBe(true);
    expect(refused(await call(ANA_SHOP, 'host_table', good))).toBe(true);
    expect((await rpc(anaKey, 'tools/list')).status).toBe(401);
    db.sqlite.prepare('UPDATE users SET hosting_stopped_at = NULL WHERE id = ?').run('ana');
    // Switch closed.
    flags.FEW_HOSTS_OPEN = 'false';
    expect((await route('ana', '/api/me/tables', 'POST', good)).status).toBe(404);
    expect(refused(await call(ANA_SHOP, 'host_table', good))).toBe(true);
    expect((await rpc(anaKey, 'tools/list')).status).toBe(401);
    expect(tablesOfAna()).toBe(before + 2);
  });

  it('FINDING A11-4: a host with reach gets the open door on the page, and the tool refuses it', async () => {
    db.sqlite.prepare(`UPDATE users SET host_reach = 'teajia' WHERE id = 'ana'`).run();
    const open = { ...good, door: 'open' };
    const page = await route('ana', '/api/me/tables', 'POST', open);
    expect(page.status, JSON.stringify(page.body)).toBe(201);
    const scoped = await viaTool(ANA_SHOP, 'host_table', open);
    expect(scoped.result, 'host_table refuses the door the page gives').toMatchObject({ committed: true });
  });

  it('FINDING A11-4: the page takes the area people are told; the tool has no way to say it', async () => {
    const page = await route('ana', '/api/me/tables', 'POST', { ...good, area: 'Near Da\'an Park' });
    expect(page.status, JSON.stringify(page.body)).toBe(201);
    await viaTool(ANA_SHOP, 'host_table', { ...good, area: 'Near Da\'an Park' });
    const areas = db.sqlite.prepare(`SELECT area_hint FROM events WHERE account_id = 'ana-personal' AND id <> 't-ana' ORDER BY created_at`).all() as { area_hint: string | null }[];
    expect(areas.map(row => row.area_hint)).toEqual(['Near Da\'an Park', 'Near Da\'an Park']);
  });
});

// ── Say yes, say no ─────────────────────────────────────────────────────────

describe('answer a guest: PUT .../guests/:id/yes|no, answer_guest (scoped), answer_guest (host key)', () => {
  beforeEach(() => {
    for (const id of ['g-1', 'g-2', 'g-3', 'g-4', 'g-5', 'g-6']) guest(id, 't-ana', 'ana-personal', 'requested');
  });

  it('a yes seats the guest every way, the same', async () => {
    expect((await route('ana', '/api/me/tables/t-ana/guests/g-1/yes', 'PUT')).status).toBe(200);
    expect((await viaTool(ANA_SHOP, 'answer_guest', { table_id: 't-ana', attendee_id: 'g-2', answer: 'yes' })).result).toMatchObject({ committed: true, status: 'confirmed' });
    expect((await viaTool(anaKey, 'answer_guest', { table_id: 't-ana', attendee_id: 'g-3', answer: 'yes' })).result).toMatchObject({ committed: true, status: 'confirmed' });
    expect(['g-1', 'g-2', 'g-3'].map(statusOf)).toEqual(['confirmed', 'confirmed', 'confirmed']);
    const seats = db.sqlite.prepare(`SELECT participation_id, seat_status FROM event_party_members WHERE participation_id IN ('g-1','g-2','g-3') ORDER BY participation_id`).all();
    expect(seats).toEqual(['g-1', 'g-2', 'g-3'].map(participation_id => ({ participation_id, seat_status: 'confirmed' })));
  });

  it('a no answers the guest every way, the same', async () => {
    expect((await route('ana', '/api/me/tables/t-ana/guests/g-1/no', 'PUT')).body).toMatchObject({ status: 'denied' });
    expect((await viaTool(ANA_SHOP, 'answer_guest', { table_id: 't-ana', attendee_id: 'g-2', answer: 'no' })).result).toMatchObject({ status: 'denied' });
    expect((await viaTool(anaKey, 'answer_guest', { table_id: 't-ana', attendee_id: 'g-3', answer: 'no' })).result).toMatchObject({ status: 'denied' });
    expect(['g-1', 'g-2', 'g-3'].map(statusOf)).toEqual(['denied', 'denied', 'denied']);
  });

  it('someone else\'s table, a full table, a guest already answered and a replay are refused every way', async () => {
    // Someone else's table.
    expect((await route('ana', '/api/me/tables/t-bo/guests/g-bo/yes', 'PUT')).status).toBe(404);
    expect((await call(ANA_SHOP, 'answer_guest', { table_id: 't-bo', attendee_id: 'g-bo', answer: 'yes' }))).toEqual({ error: 'table_not_found' });
    expect((await call(anaKey, 'answer_guest', { table_id: 't-bo', attendee_id: 'g-bo', answer: 'yes' }))).toEqual({ error: 'table_not_found' });
    expect(statusOf('g-bo')).toBe('requested');
    // Out of range: the table is full.
    db.sqlite.prepare(`UPDATE events SET total_capacity = 0 WHERE id = 't-ana'`).run();
    expect((await route('ana', '/api/me/tables/t-ana/guests/g-1/yes', 'PUT')).body.code).toBe('capacity_conflict');
    expect((await call(ANA_SHOP, 'answer_guest', { table_id: 't-ana', attendee_id: 'g-2', answer: 'yes' })).error).toBe('capacity_conflict');
    expect((await call(anaKey, 'answer_guest', { table_id: 't-ana', attendee_id: 'g-3', answer: 'yes' })).error).toBe('capacity_conflict');
    db.sqlite.prepare(`UPDATE events SET total_capacity = 6 WHERE id = 't-ana'`).run();
    // Replay.
    const once = await viaTool(ANA_SHOP, 'answer_guest', { table_id: 't-ana', attendee_id: 'g-4', answer: 'yes' });
    expect(once.result).toMatchObject({ committed: true });
    expect(await call(ANA_SHOP, 'answer_guest', { confirm: once.ticket })).toEqual(INVALID);
    // A guest already answered.
    expect((await route('ana', '/api/me/tables/t-ana/guests/g-4/yes', 'PUT')).status).toBe(409);
    expect((await call(anaKey, 'answer_guest', { table_id: 't-ana', attendee_id: 'g-4', answer: 'yes' })).error).toBe('state_conflict');
    expect(['g-1', 'g-2', 'g-3'].map(statusOf)).toEqual(['requested', 'requested', 'requested']);
  });

  it('a stopped host\'s yes is refused every way', async () => {
    stop('ana');
    expect((await route('ana', '/api/me/tables/t-ana/guests/g-1/yes', 'PUT')).body.code).toBe('hosting_stopped');
    expect(refused(await call(ANA_SHOP, 'answer_guest', { table_id: 't-ana', attendee_id: 'g-2', answer: 'yes' }))).toBe(true);
    expect((await call(anaKey, 'answer_guest', { table_id: 't-ana', attendee_id: 'g-3', answer: 'yes' })).status).toBe(401);
    expect(['g-1', 'g-2', 'g-3'].map(statusOf)).toEqual(['requested', 'requested', 'requested']);
  });

  it('FINDING A11-1: a stopped host is refused a yes on the page and on answer_guest, but approve_event_rsvp seats the guest', async () => {
    stop('ana');
    const page = await route('ana', '/api/admin/attendees/g-5/approve', 'PUT', {}, 'ana-personal');
    expect(page.body?.code, JSON.stringify(page.body)).toBe('hosting_stopped');
    const tool = await viaTool(ANA_SHOP, 'approve_event_rsvp', { attendee_id: 'g-6' }, ['attendee_id']);
    expect(statusOf('g-5')).toBe('requested');
    expect(tool.result?.error, JSON.stringify(tool.result)).toBe('hosting_stopped');
    expect(statusOf('g-6'), 'approve_event_rsvp seated a guest at a stopped host\'s table').toBe('requested');
  });
});

// ── What a stopped host may still do ────────────────────────────────────────

describe('a stopped host keeps the tables they have: the page and the tools disagree on what that means', () => {
  beforeEach(() => {
    guest('g-wait', 't-ana', 'ana-personal', 'requested');
    guest('g-sat', 't-ana', 'ana-personal', 'confirmed');
    guest('g-sat2', 't-ana', 'ana-personal', 'confirmed');
    stop('ana');
  });

  it('the page lets a stopped host say no, keep a note, set the teas and give back a seat', async () => {
    expect((await route('ana', '/api/me/tables/t-ana/guests/g-wait/no', 'PUT')).status).toBe(200);
    expect((await route('ana', '/api/me/tables/t-ana/guests/g-sat/note', 'PUT', { note: 'Brought cake' })).status).toBe(200);
    expect((await route('ana', '/api/me/tables/t-ana/teas', 'PUT', { teas: [{ source: 'name', name: 'Old shou' }] })).status).toBe(200);
    expect((await route('ana', '/api/me/tables/t-ana/guests/g-sat/release', 'PUT')).status).toBe(200);
  });

  it('a scoped token on the same account gives back a seat and changes the tasting flag as the page does', async () => {
    expect((await viaTool(ANA_SHOP, 'release_guest_seat', { table_id: 't-ana', attendee_id: 'g-sat2' })).result).toMatchObject({ committed: true });
    expect((await viaTool(ANA_SHOP, 'set_session_tasting', { table_id: 't-ana', is_tasting: true })).result).toMatchObject({ committed: true });
  });

  it('FINDING A11-5: the same scoped token is refused a no, a note and a tea that the page allows', async () => {
    const no = await viaTool(ANA_SHOP, 'answer_guest', { table_id: 't-ana', attendee_id: 'g-wait', answer: 'no' });
    const note = await viaTool(ANA_SHOP, 'set_guest_note', { table_id: 't-ana', attendee_id: 'g-sat', note: 'Brought cake' });
    const tea = await viaTool(ANA_SHOP, 'add_table_tea', { table_id: 't-ana', name: 'Old shou', as_typed: true });
    expect({ no: no.result.error ?? 'ok', note: note.result.error ?? 'ok', tea: tea.result.error ?? 'ok' })
      .toEqual({ no: 'ok', note: 'ok', tea: 'ok' });
  });
});

// ── Give back a guest's seat ────────────────────────────────────────────────

describe('give back a seat: PUT .../release, release_guest_seat (scoped), release_guest_seat (host key)', () => {
  beforeEach(() => {
    for (const id of ['s-1', 's-2', 's-3', 's-4']) guest(id, 't-ana', 'ana-personal', 'confirmed');
    guest('s-wait', 't-ana', 'ana-personal', 'requested');
    guest('s-bo', 't-bo', 'bo-personal', 'confirmed');
  });

  it('the same release every way', async () => {
    expect((await route('ana', '/api/me/tables/t-ana/guests/s-1/release', 'PUT')).body).toMatchObject({ status: 'cancelled' });
    expect((await viaTool(ANA_SHOP, 'release_guest_seat', { table_id: 't-ana', attendee_id: 's-2' })).result).toMatchObject({ committed: true, status: 'cancelled' });
    expect((await viaTool(anaKey, 'release_guest_seat', { table_id: 't-ana', attendee_id: 's-3' })).result).toMatchObject({ committed: true, status: 'cancelled' });
    expect(['s-1', 's-2', 's-3'].map(statusOf)).toEqual(['cancelled', 'cancelled', 'cancelled']);
  });

  it('someone else\'s table, a guest with no seat, the switch closed and a replay are refused every way', async () => {
    expect((await route('ana', '/api/me/tables/t-bo/guests/s-bo/release', 'PUT')).status).toBe(404);
    expect(await call(ANA_SHOP, 'release_guest_seat', { table_id: 't-bo', attendee_id: 's-bo' })).toEqual({ error: 'table_not_found' });
    expect(await call(anaKey, 'release_guest_seat', { table_id: 't-bo', attendee_id: 's-bo' })).toEqual({ error: 'table_not_found' });
    expect(statusOf('s-bo')).toBe('confirmed');
    expect((await route('ana', '/api/me/tables/t-ana/guests/s-wait/release', 'PUT')).status).toBe(409);
    expect(refused(await call(ANA_SHOP, 'release_guest_seat', { table_id: 't-ana', attendee_id: 's-wait' }))).toBe(true);
    expect(refused(await call(anaKey, 'release_guest_seat', { table_id: 't-ana', attendee_id: 's-wait' }))).toBe(true);
    const once = await viaTool(ANA_SHOP, 'release_guest_seat', { table_id: 't-ana', attendee_id: 's-4' });
    expect(await call(ANA_SHOP, 'release_guest_seat', { confirm: once.ticket })).toEqual(INVALID);
    flags.ANYONE_HOSTS_OPEN = 'false';
    expect((await route('ana', '/api/me/tables/t-ana/guests/s-1/release', 'PUT')).status).toBe(404);
    expect(refused(await call(ANA_SHOP, 'release_guest_seat', { table_id: 't-ana', attendee_id: 's-1' }))).toBe(true);
    expect(refused(await call(anaKey, 'release_guest_seat', { table_id: 't-ana', attendee_id: 's-2' }))).toBe(true);
    expect(['s-1', 's-2', 's-3'].map(statusOf)).toEqual(['confirmed', 'confirmed', 'confirmed']);
  });
});

// ── Tasting flag, guest note, teas ──────────────────────────────────────────

describe('the tasting flag, the guest note and the teas, three ways', () => {
  const tasting = () => Number((db.sqlite.prepare(`SELECT is_tasting FROM events WHERE id = 't-ana'`).get() as { is_tasting: number }).is_tasting);

  it('the tasting flag is set and refused the same way', async () => {
    expect((await route('ana', '/api/me/tables/t-ana/tasting', 'PUT', { is_tasting: true })).status).toBe(200);
    expect(tasting()).toBe(1);
    expect((await viaTool(ANA_SHOP, 'set_session_tasting', { table_id: 't-ana', is_tasting: false })).result).toMatchObject({ committed: true });
    expect(tasting()).toBe(0);
    expect((await viaTool(anaKey, 'set_session_tasting', { table_id: 't-ana', is_tasting: true })).result).toMatchObject({ committed: true });
    expect(tasting()).toBe(1);
    // Out of range and someone else's table.
    expect((await route('ana', '/api/me/tables/t-ana/tasting', 'PUT', { is_tasting: 'maybe' })).status).toBe(400);
    expect(await call(ANA_SHOP, 'set_session_tasting', { table_id: 't-ana', is_tasting: 'maybe' })).toEqual({ error: 'invalid_tasting_flag' });
    expect(await call(anaKey, 'set_session_tasting', { table_id: 't-ana', is_tasting: 'maybe' })).toEqual({ error: 'invalid_tasting_flag' });
    expect((await route('ana', '/api/me/tables/t-bo/tasting', 'PUT', { is_tasting: true })).status).toBe(404);
    expect(await call(anaKey, 'set_session_tasting', { table_id: 't-bo', is_tasting: true })).toEqual({ error: 'table_not_found' });
    // Replay.
    const once = await viaTool(anaKey, 'set_session_tasting', { table_id: 't-ana', is_tasting: false });
    expect(await call(anaKey, 'set_session_tasting', { confirm: once.ticket })).toEqual(INVALID);
    // Switch closed.
    flags.ANYONE_HOSTS_OPEN = 'false';
    expect((await route('ana', '/api/me/tables/t-ana/tasting', 'PUT', { is_tasting: true })).status).toBe(404);
    expect(refused(await call(ANA_SHOP, 'set_session_tasting', { table_id: 't-ana', is_tasting: true }))).toBe(true);
    expect(tasting()).toBe(0);
  });

  it('a guest note is written and refused the same way', async () => {
    for (const id of ['n-1', 'n-2', 'n-3']) guest(id, 't-ana', 'ana-personal', 'confirmed');
    expect((await route('ana', '/api/me/tables/t-ana/guests/n-1/note', 'PUT', { note: 'Likes shou' })).status).toBe(200);
    expect((await viaTool(ANA_SHOP, 'set_guest_note', { table_id: 't-ana', attendee_id: 'n-2', note: 'Likes shou' })).result).toMatchObject({ committed: true });
    expect((await viaTool(anaKey, 'set_guest_note', { table_id: 't-ana', attendee_id: 'n-3', note: 'Likes shou' })).result).toMatchObject({ committed: true });
    const notes = db.sqlite.prepare(`SELECT note FROM host_guest_notes ORDER BY attendee_id`).all() as { note: string }[];
    expect(notes.map(row => row.note)).toEqual(['Likes shou', 'Likes shou', 'Likes shou']);
    const long = 'x'.repeat(5000);
    expect((await route('ana', '/api/me/tables/t-ana/guests/n-1/note', 'PUT', { note: long })).status).toBe(400);
    expect(refused(await call(ANA_SHOP, 'set_guest_note', { table_id: 't-ana', attendee_id: 'n-2', note: long }))).toBe(true);
    expect(refused(await call(anaKey, 'set_guest_note', { table_id: 't-ana', attendee_id: 'n-3', note: long }))).toBe(true);
    expect(await call(anaKey, 'set_guest_note', { table_id: 't-bo', attendee_id: 'g-bo', note: 'x' })).toEqual({ error: 'table_not_found' });
  });

  it('a plain-name tea lands the same way and an over-long name is refused every way', async () => {
    expect((await route('ana', '/api/me/tables/t-ana/teas', 'PUT', { teas: [{ source: 'name', name: 'Old shou' }] })).status).toBe(200);
    expect((await viaTool(ANA_SHOP, 'add_table_tea', { table_id: 't-ana', name: 'Old shou', as_typed: true })).result).toMatchObject({ committed: true });
    expect((await viaTool(anaKey, 'add_table_tea', { table_id: 't-ana', name: 'Old shou', as_typed: true })).result).toMatchObject({ committed: true });
    const names = db.sqlite.prepare(`SELECT custom_name, product_id FROM event_tea_menu WHERE event_id = 't-ana' ORDER BY brew_order`).all();
    expect(names).toEqual([1, 2, 3].map(() => ({ custom_name: 'Old shou', product_id: null })));
    const long = 'x'.repeat(500);
    expect((await route('ana', '/api/me/tables/t-ana/teas', 'PUT', { teas: [{ source: 'name', name: long }] })).status).toBe(400);
    expect(refused(await call(ANA_SHOP, 'add_table_tea', { table_id: 't-ana', name: long, as_typed: true }))).toBe(true);
    expect(refused(await call(anaKey, 'add_table_tea', { table_id: 't-ana', name: long, as_typed: true }))).toBe(true);
  });
});

// ── Circles ─────────────────────────────────────────────────────────────────

describe('circles: POST /api/me/circles and PUT /api/me/tables/:id/circle, three ways', () => {
  const circles = () => count(`SELECT COUNT(*) AS n FROM session_series WHERE host_user_id = 'ana'`);

  it('make a circle and put a table in it, the same every way', async () => {
    const page = await route('ana', '/api/me/circles', 'POST', { name: 'Thursday tea', kind: 'circle' });
    expect(page.status).toBe(201);
    expect((await viaTool(ANA_SHOP, 'make_circle', { name: 'Thursday tea', kind: 'circle' })).result).toMatchObject({ committed: true });
    expect((await viaTool(anaKey, 'make_circle', { name: 'Thursday tea', kind: 'circle' })).result).toMatchObject({ committed: true });
    expect(db.sqlite.prepare(`SELECT name, kind FROM session_series WHERE host_user_id = 'ana'`).all())
      .toEqual([1, 2, 3].map(() => ({ name: 'Thursday tea', kind: 'circle' })));
    const id = page.body.circle.id;
    expect((await route('ana', '/api/me/tables/t-ana/circle', 'PUT', { circle_id: id })).status).toBe(200);
    expect((await viaTool(anaKey, 'put_table_in_circle', { table_id: 't-ana', circle_id: null })).result).toMatchObject({ committed: true });
    expect((await viaTool(ANA_SHOP, 'put_table_in_circle', { table_id: 't-ana', circle_id: id })).result).toMatchObject({ committed: true });
    // Someone else's table, an over-long name, a replay, a stopped host, the switch closed.
    expect((await route('ana', '/api/me/tables/t-bo/circle', 'PUT', { circle_id: id })).status).toBe(404);
    expect((await call(anaKey, 'put_table_in_circle', { table_id: 't-bo', circle_id: id })).error).toBe('table_not_found');
    const long = 'x'.repeat(300);
    expect((await route('ana', '/api/me/circles', 'POST', { name: long, kind: 'circle' })).status).toBe(400);
    expect(refused(await call(ANA_SHOP, 'make_circle', { name: long, kind: 'circle' }))).toBe(true);
    const once = await viaTool(anaKey, 'make_circle', { name: 'Once', kind: 'series' });
    expect(await call(anaKey, 'make_circle', { confirm: once.ticket })).toEqual(INVALID);
    stop('ana');
    expect((await route('ana', '/api/me/circles', 'POST', { name: 'Later', kind: 'circle' })).status).toBe(403);
    expect(refused(await call(ANA_SHOP, 'make_circle', { name: 'Later', kind: 'circle' }))).toBe(true);
    db.sqlite.prepare('UPDATE users SET hosting_stopped_at = NULL WHERE id = ?').run('ana');
    flags.CIRCLES_OPEN = 'false';
    expect((await route('ana', '/api/me/circles', 'POST', { name: 'Later', kind: 'circle' })).status).toBe(404);
    expect(refused(await call(ANA_SHOP, 'make_circle', { name: 'Later', kind: 'circle' }))).toBe(true);
    expect(circles()).toBe(4);
  });

  it('FINDING A11-12: the page refuses a circle with no kind; the tool makes one', async () => {
    expect((await route('ana', '/api/me/circles', 'POST', { name: 'No kind' })).status).toBe(400);
    const tool = await viaTool(ANA_SHOP, 'make_circle', { name: 'No kind' });
    expect(refused(tool.result), JSON.stringify(tool.result)).toBe(true);
  });
});

// ── Same table again ────────────────────────────────────────────────────────

describe('same table again: tool only, and what it makes', () => {
  it('FINDING A11-2: the copy is a draft, and nothing a host has opens a draft', async () => {
    const copy = await viaTool(anaKey, 'same_table_again', { table_id: 't-ana', slug: 'ana-again', event_date: '2030-02-01T16:00' });
    expect(copy.result).toMatchObject({ committed: true });
    const row = db.sqlite.prepare(`SELECT status, lifecycle_status FROM events WHERE slug = 'ana-again'`).get();
    // A new table from the page or host_table is active and published; the copy is not,
    // and no host route or host tool can publish it.
    expect(row, 'the copy cannot be opened by the host').toEqual({ status: 'active', lifecycle_status: 'published' });
  });

  it('FINDING A11-3: the copy takes a day already past, which host_table and the page refuse', async () => {
    expect((await route('ana', '/api/me/tables', 'POST', { date: '2020-01-05', time: '16:00', timezone: 'Asia/Taipei' })).status).toBe(400);
    const copy = await viaTool(ANA_SHOP, 'same_table_again', { table_id: 't-ana', slug: 'ana-past', event_date: '2020-01-05T16:00' });
    expect(refused(copy.result), JSON.stringify(copy.result)).toBe(true);
  });

  it('FINDING A11-3: the copy keeps the by-link door after Adrian withdrew the approval that gave it', async () => {
    db.sqlite.prepare(`UPDATE events SET door = 'link', requires_approval = 0 WHERE id = 't-ana'`).run();
    db.sqlite.prepare(`UPDATE users SET host_approved_at = NULL WHERE id = 'ana'`).run();
    // The page refuses a by-link table now.
    expect((await route('ana', '/api/me/tables', 'POST', { date: '2030-01-05', time: '16:00', timezone: 'Asia/Taipei', door: 'link' })).body.code)
      .toBe('hosted_table_door_needs_approval');
    const copy = await viaTool(ANA_SHOP, 'same_table_again', { table_id: 't-ana', slug: 'ana-link', event_date: '2030-02-01T16:00' });
    const door = (db.sqlite.prepare(`SELECT door FROM events WHERE slug = 'ana-link'`).get() as { door: string } | undefined)?.door;
    expect(copy.result.error === undefined && door === 'link', 'a by-link copy was made').toBe(false);
  });
});

// ── The Tea Table ───────────────────────────────────────────────────────────

describe('the Tea Table: the page\'s routes and the launch4 tools', () => {
  const HOUSE = 'house';
  const OLGA = 'tjmcp_a11_olga_house_owner';
  const HOST = 'tjmcp_a11_hana_house_host';
  beforeEach(async () => {
    seedIdentity(db, { userId: 'olga', accountId: HOUSE, role: 'owner', bundles: ['gather', 'publish', 'catalog'] });
    seedIdentity(db, { userId: 'hana', accountId: HOUSE, role: 'owner', bundles: ['gather', 'publish', 'catalog'] });
    const seed = `
      INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status, public_visibility, recap_status, network_discovery)
      VALUES ('sit-hana', '${HOUSE}', 'hana-sit', 'Hana sit', '2026-11-20', 'completed', 'public', 'published', 1),
             ('sit-guest', '${HOUSE}', 'guest-sit', 'Guest sit', '2026-11-21', 'completed', 'public', 'published', 1);
      INSERT INTO event_post_session (id, account_id, event_id, session_notes)
      VALUES ('post-hana', '${HOUSE}', 'sit-hana', 'We poured.'), ('post-guest', '${HOUSE}', 'sit-guest', 'A guest poured.');
      INSERT INTO contributors (id, account_id, user_id, display_name, is_published, links) VALUES
        ('hana-page', '${HOUSE}', 'hana', 'Hana', 0, '[]'), ('cy-page', '${HOUSE}', 'cy', 'Cy', 0, '[]');
      INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('hana-page', '${HOUSE}'), ('cy-page', '${HOUSE}');
      INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public) VALUES
        ('c-1', '${HOUSE}', 'sit-hana', 'hana-page', 'lead_host', 0),
        ('c-2', '${HOUSE}', 'sit-guest', 'cy-page', 'guest_host', 0);
      INSERT INTO products (id, account_id, product_name, type, status, is_public, shown_in_shop) VALUES
        ('tea-h', '${HOUSE}', 'Old Tree Red', 'Red', 'Active', 1, 1);
      INSERT INTO customer_tasting_journal (id, user_id, product_id, product_name) VALUES ('j-hana', 'hana@test.dev', 'tea-h', 'Old Tree Red');
      INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, tea_table_at)
        VALUES ('j-hana', '${HOUSE}', 'tea-h', 'hana', 'page', datetime('now'));
    `;
    for (const statement of seed.split(';').map(part => part.trim()).filter(Boolean)) {
      try { db.sqlite.exec(statement); } catch (error) { throw new Error(`${(error as Error).message}: ${statement.slice(0, 80)}`); }
    }
    db.sqlite.prepare(`UPDATE contributors SET is_published = 1, page_tier = 'family' WHERE id = 'hana-page'`).run();
    await shopToken(OLGA, 'olga', HOUSE, ALL_SCOPES);
    await shopToken(HOST, 'hana', HOUSE, ALL_SCOPES);
  });
  const onTable = (id: string) => (db.sqlite.prepare('SELECT tea_table_at FROM events WHERE id = ?').get(id) as { tea_table_at: string | null }).tea_table_at;

  it('the host of a session puts its recap on the table the same way on the page and the tool', async () => {
    expect((await route('hana', '/api/admin/tea-table/recaps/sit-hana', 'PUT', undefined, HOUSE)).body).toMatchObject({ on_table: true });
    expect((await route('hana', '/api/admin/tea-table/recaps/sit-hana', 'DELETE', undefined, HOUSE)).body).toMatchObject({ on_table: false });
    expect((await viaTool(HOST, 'set_my_recap_on_tea_table', { id: 'sit-hana', on_table: true })).result).toMatchObject({ committed: true, on_table: true });
    expect(onTable('sit-hana')).not.toBeNull();
  });

  it('FINDING A11-6: the page refuses a shop owner who did not host the session; the tool lets them publish the recap', async () => {
    const page = await route('olga', '/api/admin/tea-table/recaps/sit-guest', 'PUT', undefined, HOUSE);
    expect(page.status).toBe(403);
    expect(page.body.code).toBe('not_host');
    expect(onTable('sit-guest')).toBeNull();
    const tool = await viaTool(OLGA, 'set_my_recap_on_tea_table', { id: 'sit-guest', on_table: true });
    expect(onTable('sit-guest'), `set_my_recap_on_tea_table answered ${JSON.stringify(tool.result)}`).toBeNull();
  });

  it('FINDING A11-7: the page lets a host hold their own recap at the top; the tool is the platform owner\'s alone', async () => {
    await route('hana', '/api/admin/tea-table/recaps/sit-hana', 'PUT', undefined, HOUSE);
    const page = await route('hana', '/api/tea-table/holds/recap/sit-hana', 'PUT', { days: 3 }, HOUSE);
    expect(page.status, JSON.stringify(page.body)).toBe(200);
    expect((await route('hana', '/api/tea-table/holds/recap/sit-hana', 'DELETE', undefined, HOUSE)).status).toBe(200);
    const tool = await viaTool(HOST, 'hold_tea_table_piece', { kind: 'recap', id: 'sit-hana', days: 3 });
    expect(tool.result, 'the host is refused the hold the page gives').toMatchObject({ committed: true });
  });

  it('FINDING A11-7: the page lets the owner let go of a hold and unhide a piece; no tool can', async () => {
    const names = (await rpc('tjmcp_a11_adrian_everything', 'tools/list')).body.result.tools.map((tool: { name: string }) => tool.name);
    const hide = names.includes('hide_tea_table_piece');
    expect(hide).toBe(true);
    const hideDef = (await rpc('tjmcp_a11_adrian_everything', 'tools/list')).body.result.tools
      .find((tool: { name: string }) => tool.name === 'hide_tea_table_piece');
    const holdDef = (await rpc('tjmcp_a11_adrian_everything', 'tools/list')).body.result.tools
      .find((tool: { name: string }) => tool.name === 'hold_tea_table_piece');
    expect({ unhide: 'hidden' in hideDef.inputSchema.properties, release: Object.keys(holdDef.inputSchema.properties).some(key => /release|let_go|held/.test(key)) || names.includes('release_tea_table_hold') })
      .toEqual({ unhide: true, release: true });
  });

  it('the owner hides a piece the same way on the page and the tool, and a replay is refused', async () => {
    await route('hana', '/api/admin/tea-table/recaps/sit-hana', 'PUT', undefined, HOUSE);
    const owner = 'tjmcp_a11_adrian_everything';
    const once = await viaTool(owner, 'hide_tea_table_piece', { kind: 'recap', id: 'sit-hana' });
    expect(once.result).toMatchObject({ committed: true, hidden: true });
    expect(await call(owner, 'hide_tea_table_piece', { confirm: once.ticket })).toEqual(INVALID);
    expect((await route('adrian', '/api/admin/tea-table/hide', 'POST', { kind: 'recap', id: 'sit-hana', hidden: false })).body).toMatchObject({ hidden: false });
    expect((await route('adrian', '/api/admin/tea-table/hide', 'POST', { kind: 'recap', id: 'sit-hana', hidden: true })).body).toMatchObject({ hidden: true });
    // Not the owner: refused every way.
    expect((await route('hana', '/api/admin/tea-table/hide', 'POST', { kind: 'recap', id: 'sit-hana', hidden: false })).status).toBe(403);
    expect(refused(await call(HOST, 'hide_tea_table_piece', { kind: 'recap', id: 'sit-hana' }))).toBe(true);
    // Switch closed.
    flags.TEA_TABLE_OPEN = 'false';
    expect((await route('adrian', '/api/admin/tea-table/hide', 'POST', { kind: 'recap', id: 'sit-hana', hidden: false })).status).toBe(404);
    expect(refused(await call(owner, 'hide_tea_table_piece', { kind: 'recap', id: 'sit-hana' }))).toBe(true);
  });

  it('a keep is the same on the page and the tool; an unknown kind and a replay are refused', async () => {
    expect((await route('cy', '/api/tea-table/keeps/tasting/j-hana', 'PUT')).body).toMatchObject({ kept: true });
    await shopToken('tjmcp_a11_bo_keeps', 'bo', 'bo-personal', ALL_SCOPES);
    const once = await viaTool('tjmcp_a11_bo_keeps', 'set_tea_table_keep', { kind: 'tasting', id: 'j-hana', kept: true });
    expect(once.result).toMatchObject({ committed: true, kept: true });
    expect(await call('tjmcp_a11_bo_keeps', 'set_tea_table_keep', { confirm: once.ticket })).toEqual(INVALID);
    expect(count(`SELECT COUNT(*) AS n FROM tea_table_keeps WHERE item_id = 'j-hana'`)).toBe(2);
    expect((await route('cy', '/api/tea-table/keeps/teapot/j-hana', 'PUT')).status).toBe(404);
    expect(refused(await call('tjmcp_a11_bo_keeps', 'set_tea_table_keep', { kind: 'teapot', id: 'j-hana', kept: true }))).toBe(true);
  });

  it('FINDING A11-8: take_my_tasting_off_tea_table tells the person it stays on their page, then takes it off their page too', async () => {
    const preview = await call(HOST, 'take_my_tasting_off_tea_table', { id: 'j-hana' });
    const result = await call(HOST, 'take_my_tasting_off_tea_table', { confirm: preview.confirmation_token });
    // The page's route says on_page false for a share that was public only for the Tea Table.
    expect(result).toMatchObject({ committed: true });
    const said = String(preview.preview.effect);
    expect({ said_stays_on_page: /stays on your page/i.test(said), on_page: result.on_page })
      .toEqual({ said_stays_on_page: result.on_page === true, on_page: result.on_page });
  });

  it('fix A11-8: a tasting the person chose for their page by itself is told it stays there, and it does', async () => {
    db.sqlite.prepare(`UPDATE member_tasting_shares SET page_alone_at = datetime('now') WHERE journal_entry_id = 'j-hana'`).run();
    const preview = await call(HOST, 'take_my_tasting_off_tea_table', { id: 'j-hana' });
    expect(preview.preview.effect).toMatch(/stays on your page/);
    expect(await call(HOST, 'take_my_tasting_off_tea_table', { confirm: preview.confirmation_token }))
      .toMatchObject({ committed: true, on_page: true });
  });

  it('fix A11-6: the tool refuses a shop owner who did not host at the confirm too, and the host still takes the recap off', async () => {
    const preview = await call(HOST, 'set_my_recap_on_tea_table', { id: 'sit-hana', on_table: true });
    expect(preview.confirmation_token).toEqual(expect.any(String));
    expect(await call(OLGA, 'set_my_recap_on_tea_table', { id: 'sit-guest', on_table: false })).toMatchObject({ error: 'not_host' });
    // A host who leaves the session between preview and confirm is refused at the confirm.
    db.sqlite.prepare(`DELETE FROM event_contributors WHERE id = 'c-1'`).run();
    expect(await call(HOST, 'set_my_recap_on_tea_table', { confirm: preview.confirmation_token })).toMatchObject({ error: 'not_host' });
    expect(onTable('sit-hana')).toBeNull();
  });
});

// ── Platform owner: approval and stopping ───────────────────────────────────

describe('Adrian\'s hand: host approval and stopping a host, page and tool', () => {
  const OWNER = 'tjmcp_a11_adrian_everything';
  const approved = (id: string) => (db.sqlite.prepare('SELECT host_approved_at FROM users WHERE id = ?').get(id) as { host_approved_at: string | null }).host_approved_at !== null;
  const stopped = (id: string) => (db.sqlite.prepare('SELECT hosting_stopped_at FROM users WHERE id = ?').get(id) as { hosting_stopped_at: string | null }).hosting_stopped_at !== null;

  it('approves and stops the same on the page and the tool, refuses a non-owner, a missing answer and a replay, and closes with the switch', async () => {
    expect((await route('adrian', '/api/platform/users/cy/host-approval', 'PUT', { approved: true })).status).toBe(200);
    expect(approved('cy')).toBe(true);
    expect((await viaTool(OWNER, 'set_host_approval', { user_id: 'cy', approved: false })).result).toMatchObject({ committed: true, may_host: false });
    expect(approved('cy')).toBe(false);
    expect((await route('adrian', '/api/platform/users/bo/hosting-stopped', 'PUT', { stopped: true })).status).toBe(200);
    expect(stopped('bo')).toBe(true);
    expect((await viaTool(OWNER, 'let_host_again', { user_id: 'bo' })).result).toMatchObject({ committed: true, hosting_stopped: false });
    expect(stopped('bo')).toBe(false);
    // Missing field.
    expect((await route('adrian', '/api/platform/users/cy/host-approval', 'PUT', {})).status).toBe(400);
    expect(refused(await call(OWNER, 'set_host_approval', { user_id: 'cy' }))).toBe(true);
    // Not the owner (a host's own scoped token, and a host key).
    expect((await route('ana', '/api/platform/users/cy/host-approval', 'PUT', { approved: true })).status).toBe(403);
    expect(refused(await call(ANA_SHOP, 'set_host_approval', { user_id: 'cy', approved: true }))).toBe(true);
    expect((await call(anaKey, 'stop_host', { user_id: 'bo' })).rpcError?.message).toBe('Unknown tool: stop_host');
    // Replay.
    const once = await viaTool(OWNER, 'stop_host', { user_id: 'bo' });
    expect(await call(OWNER, 'stop_host', { confirm: once.ticket })).toEqual(INVALID);
    // Switch closed.
    flags.FEW_HOSTS_OPEN = 'false';
    expect((await route('adrian', '/api/platform/users/cy/host-approval', 'PUT', { approved: true })).status).toBe(404);
    expect(refused(await call(OWNER, 'set_host_approval', { user_id: 'cy', approved: true }))).toBe(true);
    expect(approved('cy')).toBe(false);
  });
});

// ── Reports and favourites ──────────────────────────────────────────────────

describe('reports and favourites, page and tool', () => {
  it('FINDING A11-9: the page reports a person\'s table by its link; the tool needs an id the public page never shows', async () => {
    db.sqlite.prepare(`UPDATE events SET public_visibility = 'unlisted' WHERE id = 't-bo'`).run();
    const page = await route('cy', '/api/session-reports', 'POST', { target_kind: 'session', target_slug: 'slug-t-bo', reason: 'Odd' });
    const tool = await viaTool(anaKey, 'report', { target_kind: 'session', target_slug: 'slug-t-bo', reason: 'Odd' });
    expect({ page_refused: refused(page.body) || page.status >= 400, tool_refused: refused(tool.result) })
      .toEqual({ page_refused: page.status >= 400, tool_refused: page.status >= 400 });
  });

  it('an article favourite is kept the same on the page and the tool, and an unpublished one is refused both ways', async () => {
    db.sqlite.exec(`INSERT INTO articles (id, account_id, title, slug, status) VALUES
      ('art', 'platform-home', 'Water and stone', 'water-and-stone', 'published'),
      ('draft', 'platform-home', 'Not yet', 'not-yet', 'draft');`);
    expect((await route('ana', '/api/me/favourites/articles/art', 'PUT')).status).toBe(200);
    expect((await viaTool('tjmcp_a11_adrian_everything', 'set_my_favourite', { kind: 'article', id: 'art', kept: true })).result).toMatchObject({ committed: true });
    expect(count(`SELECT COUNT(*) AS n FROM favourite_articles WHERE article_id = 'art'`)).toBe(2);
    expect((await route('ana', '/api/me/favourites/articles/draft', 'PUT')).status).toBe(404);
    expect(refused((await viaTool('tjmcp_a11_adrian_everything', 'set_my_favourite', { kind: 'article', id: 'draft', kept: true })).result)).toBe(true);
  });
});

// ── Tea spaces (todo/plans/tea-spaces.md, steps 2 and 5) ─────────────────────

describe('tea spaces: the page and the host key, the same', () => {
  beforeEach(() => { flags.YOUR_TABLE_PLACE_OPEN = 'true'; });
  const spacesOfAna = () => db.sqlite.prepare(
    `SELECT name, area_hint FROM saved_locations WHERE account_id = 'ana-personal' AND is_host_table = 1 ORDER BY name`,
  ).all();

  it('adds two spaces, one on the page and one by the key, and lists both', async () => {
    const page = await route('ana', '/api/me/your-table', 'POST', { name: 'The garden room', area_hint: 'Ubud, near the market' });
    expect(page.status, JSON.stringify(page.body)).toBe(200);
    const added = await viaTool(anaKey, 'add_my_tea_space', { name: 'The tea room', area: 'Ubud, near the market' });
    expect(added.preview.preview).toMatchObject({ name: 'The tea room', area: 'Ubud, near the market' });
    expect(added.result).toMatchObject({ committed: true });
    expect(spacesOfAna()).toEqual([
      { name: 'The garden room', area_hint: 'Ubud, near the market' },
      { name: 'The tea room', area_hint: 'Ubud, near the market' },
    ]);
    const listed = await call(anaKey, 'list_my_tea_spaces');
    expect(listed.tea_spaces.map((space: { name: string }) => space.name)).toEqual(['The garden room', 'The tea room']);
    expect(await call(anaKey, 'add_my_tea_space', { confirm: added.ticket })).toEqual(INVALID);
  });

  it('a link in the area is refused every way and writes nothing', async () => {
    const page = await route('ana', '/api/me/your-table', 'POST', { name: 'Room', area_hint: 'https://maps.example/x' });
    expect(page.status).toBe(400);
    expect((await call(anaKey, 'add_my_tea_space', { name: 'Room', area: 'https://maps.example/x' })).error).toBe('your_table_area_address');
    expect(spacesOfAna()).toEqual([]);
  });

  it('puts a table in a space and takes it out again; someone else\'s space or table is refused', async () => {
    await route('ana', '/api/me/your-table', 'POST', { name: 'The garden room', area_hint: 'Ubud' });
    const garden = (db.sqlite.prepare(`SELECT id FROM saved_locations WHERE account_id = 'ana-personal'`).get() as { id: string }).id;
    const set = await viaTool(anaKey, 'set_table_tea_space', { table_id: 't-ana', place_id: garden });
    expect(set.preview.preview).toMatchObject({ space: 'The garden room' });
    expect(set.result).toMatchObject({ committed: true, space: { id: garden, name: 'The garden room', area: 'Ubud' } });
    const locationOf = (id: string) => (db.sqlite.prepare('SELECT location_id FROM events WHERE id = ?').get(id) as { location_id: string | null }).location_id;
    expect(locationOf('t-ana')).toBe(garden);
    const cleared = await route('ana', '/api/me/tables/t-ana/space', 'PUT', { place_id: null });
    expect(cleared.status).toBe(200);
    expect(locationOf('t-ana')).toBeNull();

    db.sqlite.exec(`INSERT INTO saved_locations (id, name, address, account_id, is_host_table, area_hint) VALUES ('bo-room', 'Bo room', '', 'bo-personal', 1, 'Sanur')`);
    expect((await call(anaKey, 'set_table_tea_space', { table_id: 't-ana', place_id: 'bo-room' })).error).toBe('tea_space_place');
    expect((await route('ana', '/api/me/tables/t-ana/space', 'PUT', { place_id: 'bo-room' })).status).toBe(404);
    expect((await call(anaKey, 'set_table_tea_space', { table_id: 't-bo', place_id: garden })).error).toBe('table_not_found');
    expect(locationOf('t-bo')).toBeNull();
  });
});

// ── The table of ways in ────────────────────────────────────────────────────

describe('actions with an empty cell in the table', () => {
  it('FINDING A11-10: every page action a host has is a tool their key can call', async () => {
    // The finding names these switches as on; the page routes for your table and
    // article offers are behind them, and so are their tools.
    flags.YOUR_TABLE_PLACE_OPEN = 'true';
    flags.HOST_ARTICLES_OPEN = 'true';
    const hostTools = (await rpc(anaKey, 'tools/list')).body.result.tools.map((tool: { name: string }) => tool.name);
    // Page action -> the tool a host key would need. None of these exist on build/review.
    const wanted: Record<string, string> = {
      'PUT /api/me/tables/:id (door, seats, area)': 'change_my_table',
      'PUT /api/me/tables/:id/came': 'mark_who_came',
      'POST /api/me/tables/:id/guests/:id/thanks-link': 'get_guest_thanks_link',
      'POST /api/me/tables/:id/guest-book/:id/review': 'review_guest_book',
      'PUT /api/me/tables/:id/way': 'set_table_way',
      'PUT|DELETE /api/me/your-table': 'set_your_table',
      'GET /api/me/your-table': 'list_my_tea_spaces',
      'POST /api/me/your-table': 'add_my_tea_space',
      'PUT /api/me/tables/:id/space': 'set_table_tea_space',
      'POST /api/me/tables/:id/circle-guests/:id/ask': 'ask_guest_back',
      'POST /api/me/article-offers': 'offer_article',
      'PUT|DELETE /api/me/favourites/*, PUT /api/me/cellar/:id/favourite': 'set_my_favourite',
      'PUT /api/admin/tea-table/recaps/:id': 'set_my_recap_on_tea_table',
    };
    const missing = Object.entries(wanted).filter(([, tool]) => !hostTools.includes(tool)).map(([action]) => action);
    expect(missing).toEqual([]);
  });

  it('FINDING A11-11: every owner page action has an owner tool', async () => {
    // Article offers are behind HOST_ARTICLES_OPEN on the page, and so is their tool.
    flags.HOST_ARTICLES_OPEN = 'true';
    const names = (await rpc('tjmcp_a11_adrian_everything', 'tools/list')).body.result.tools.map((tool: { name: string }) => tool.name);
    const wanted: Record<string, string> = {
      'PUT /api/platform/users/:id/host-reach': 'set_host_reach',
      'GET /api/admin/session-reports': 'list_reports',
      'POST /api/admin/session-reports/:id/resolve': 'resolve_report',
      'POST /api/admin/article-offers/:id': 'review_article_offer',
      'GET /api/admin/tea-table (with keeps)': 'list_tea_table',
    };
    const missing = Object.entries(wanted).filter(([, tool]) => !names.includes(tool)).map(([action]) => action);
    expect(missing).toEqual([]);
  });
});

// ── Paths the fixes made (todo/review/fixes/tools.md) ───────────────────────

describe('fix: the new paths each fix made hold the page\'s rule', () => {
  it('A11-1: record_event_rsvp takes no one new at a stopped host\'s table, and a yes previewed before the stop is refused at the confirm', async () => {
    guest('g-7', 't-ana', 'ana-personal', 'requested');
    const before = await call(ANA_SHOP, 'approve_event_rsvp', { attendee_id: 'g-7' });
    expect(before.confirmation_token).toEqual(expect.any(String));
    stop('ana');
    expect(await call(ANA_SHOP, 'approve_event_rsvp', { attendee_id: 'g-7', confirm: before.confirmation_token }))
      .toMatchObject({ error: 'hosting_stopped' });
    expect(statusOf('g-7')).toBe('requested');
    expect(await call(ANA_SHOP, 'record_event_rsvp', { event_id: 't-ana', full_name: 'New Guest', email: 'new@guest.test' }))
      .toMatchObject({ error: 'hosting_stopped' });
    expect(count(`SELECT COUNT(*) AS n FROM event_attendees WHERE email = 'new@guest.test'`)).toBe(0);
  });

  it('A11-2 and A11-3: an approved host\'s by-link table copies by link, a day given with a zone is read on the table\'s clock, and the preview names a door it lowered', async () => {
    db.sqlite.prepare(`UPDATE events SET door = 'link', requires_approval = 0 WHERE id = 't-ana'`).run();
    const kept = await viaTool(anaKey, 'same_table_again', { table_id: 't-ana', slug: 'ana-link-kept', event_date: '2030-02-01T08:00:00Z' });
    expect(kept.preview.preview).toMatchObject({ door: 'link', event_date: '2030-02-01T08:00:00.000Z', timezone: 'Asia/Taipei' });
    expect(kept.preview.preview.effect).not.toMatch(/cannot give/);
    expect(db.sqlite.prepare(`SELECT door, requires_approval, status, lifecycle_status, event_date FROM events WHERE slug = 'ana-link-kept'`).get())
      .toEqual({ door: 'link', requires_approval: 0, status: 'active', lifecycle_status: 'published', event_date: '2030-02-01T08:00:00.000Z' });
    db.sqlite.prepare(`UPDATE users SET host_approved_at = NULL WHERE id = 'ana'`).run();
    const lowered = await viaTool(ANA_SHOP, 'same_table_again', { table_id: 't-ana', slug: 'ana-link-lowered', event_date: '2030-02-01T16:00' });
    expect(lowered.preview.preview).toMatchObject({ door: 'request', event_date: '2030-02-01T08:00:00.000Z' });
    expect(lowered.preview.preview.effect).toMatch(/was by link, a door you cannot give a new table now/);
    expect(db.sqlite.prepare(`SELECT door, requires_approval FROM events WHERE slug = 'ana-link-lowered'`).get())
      .toEqual({ door: 'request', requires_approval: 1 });
    expect(refused(await call(ANA_SHOP, 'same_table_again', { table_id: 't-ana', slug: 'ana-bad', event_date: 'next week' }))).toBe(true);
  });

  it('A11-12: make_circle asks for the kind in its schema, as the page does', async () => {
    const def = (await rpc(ANA_SHOP, 'tools/list')).body.result.tools.find((tool: { name: string }) => tool.name === 'make_circle');
    expect(def.inputSchema.anyOf[0].required).toEqual(['name', 'kind']);
  });
});
