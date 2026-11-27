// Launch 5, M6 part two: a host's own agent token (worker/src/hostTokens.ts,
// HOST_SELF_TOOLS in worker/src/mcp.ts). A host mints, lists and revokes their
// own key from /account/host; the secret is shown once and kept only as a
// hash; on /mcp the key lists and calls exactly the host tools, every other
// tool is unknown to it, another host's table is not found, a stopped host's
// key refuses at once, and with either switch closed nothing works.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { HOST_SELF_TOOLS, mcpAdminMintToken, mcpToolNames } from '../src/mcp';
import { sha256Hex } from '../src/inquiryDomain';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/* mcp.ts fires some writes without awaiting them, so the D1 it is handed has
   to return promises the way the real one does. */
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

const SECRET = 'host-token-test-secret';
const ALL_SCOPES = ['inventory:read', 'customers:read', 'sales:read', 'stock:write', 'sales:write', 'catalog:write', 'customers:write', 'admin:write'];

/** Exactly what a host key may list, written out here so the test does not lean on the code it checks. */
const HOST_SET = [
  'host_table', 'list_my_tables', 'get_table_guests', 'answer_guest', 'add_table_tea', 'set_guest_note', 'get_guest_notes',
  'release_guest_seat', 'same_table_again', 'set_session_tasting', 'report',
  'make_circle', 'put_table_in_circle', 'list_my_circles',
  'list_my_favourites',
].sort();

let db: SqliteD1;
let flags: Record<string, string>;

function env() {
  return {
    DB: new AsyncD1(db), JWT_SECRET: SECRET, APP_URL: 'https://hosts.test',
    PROVIDER_LIMITER: { limit: async () => ({ success: true }) },
    ...flags,
  } as any;
}

async function send(path: string, init: { method?: string; bearer?: string | null; body?: unknown } = {}) {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (init.bearer) headers.set('Authorization', `Bearer ${init.bearer}`);
  return worker.fetch(new Request(`https://api.hosts.test${path}`, {
    method: init.method ?? 'GET', headers,
    body: init.body === undefined || !init.method || init.method === 'GET' ? undefined : JSON.stringify(init.body),
  }), env(), { waitUntil() {}, passThroughOnException() {} } as any);
}

async function route(who: string, path: string, method = 'GET', body?: unknown) {
  const jwt = await signedToken(SECRET, { sub: who, name: who, email: `${who}@test.dev`, role: 'user' });
  const response = await send(path, { method, bearer: jwt, body });
  const text = await response.text();
  return { status: response.status, text, body: text ? JSON.parse(text) : null };
}

async function rpc(token: string, method: string, params: Record<string, unknown> = {}) {
  const response = await send('/mcp', { method: 'POST', bearer: token, body: { jsonrpc: '2.0', id: 1, method, params } });
  return { status: response.status, body: await response.json() as any };
}

async function listed(token: string): Promise<string[]> {
  const { status, body } = await rpc(token, 'tools/list');
  expect(status, JSON.stringify(body)).toBe(200);
  return body.result.tools.map((tool: { name: string }) => tool.name).sort();
}

async function call(token: string, name: string, args: Record<string, unknown> = {}) {
  const { status, body } = await rpc(token, 'tools/call', { name, arguments: args });
  if (status !== 200 || body.error) return { status, rpcError: body.error } as any;
  return JSON.parse(body.result?.content?.[0]?.text ?? '{}');
}

const count = (sql: string, ...values: unknown[]) => Number((db.sqlite.prepare(sql).get(...values as never[]) as { n: number }).n);

function personalAccount(userId: string, approved: boolean) {
  const id = `${userId}-personal`;
  db.sqlite.prepare(`INSERT INTO accounts (id, slug, name, kind, status, public_enabled, owner_user_id,
      personal_inventory_user_id, host_approved_at) VALUES (?, ?, ?, 'master', 'active', 0, ?, ?, ?)`)
    .run(id, id, id, userId, userId, approved ? '2026-11-26T00:00:00Z' : null);
  db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES (?, ?, 'owner', 'active')`).run(id, userId);
  if (approved) db.sqlite.prepare(`UPDATE users SET host_approved_at = '2026-11-26T00:00:00Z' WHERE id = ?`).run(userId);
}

function table(id: string, accountId: string, hostUserId: string | null) {
  db.sqlite.prepare(`INSERT INTO events (id, account_id, slug, title, event_date, total_capacity, timezone, door,
      requires_approval, public_visibility, network_discovery, host_user_id, status, lifecycle_status, address_text, map_link)
    VALUES (?, ?, ?, ?, ?, 4, 'Asia/Taipei', 'request', 1, 'unlisted', 0, ?, 'active', 'published', '12 Secret Lane', 'https://maps.test/secret')`)
    .run(id, accountId, `slug-${id}`, `Table ${id}`, new Date(Date.now() + 7 * 86400000).toISOString(), hostUserId);
}

function guest(id: string, eventId: string, accountId: string, status = 'confirmed') {
  db.sqlite.prepare(`INSERT INTO event_attendees (id, account_id, event_id, full_name, email, magic_token, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, accountId, eventId, `Guest ${id}`, `${id}@guest.test`, `magic-${id}`, status);
  db.sqlite.prepare(`INSERT INTO event_party_members (id, account_id, event_id, participation_id, full_name, is_primary, seat_status)
    VALUES (?, ?, ?, ?, ?, 1, ?)`).run(`seat-${id}`, accountId, eventId, id, `Guest ${id}`, status);
}

async function shopToken(token: string, userId: string, accountId: string, scopes: unknown, tier = 'account_owner') {
  db.sqlite.prepare(`INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(`tok-${token}`, accountId, userId, `${userId}@test.dev`, token, await sha256Hex(token), token.slice(0, 8), JSON.stringify(scopes), tier);
}

/** A host key made the way a host makes one: through their own page. */
async function mint(who: string, label = 'ChatGPT on my phone') {
  const made = await route(who, '/api/me/assistant-tokens', 'POST', { label });
  expect(made.status, made.text).toBe(201);
  return made.body as { id: string; token: string; prefix: string; label: string; mcp_url: string };
}

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
  await shopToken('tjmcp_adrian_everything', 'adrian', 'platform-home', ALL_SCOPES, 'platform_owner');
  table('t-ana', 'ana-personal', 'ana');
  guest('g-ana', 't-ana', 'ana-personal');
  table('t-bo', 'bo-personal', 'bo');
  guest('g-bo', 't-bo', 'bo-personal');
  table('t-shop', 'platform-home', null);
  guest('g-shop', 't-shop', 'platform-home');
});

afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe('minting, listing and disconnecting a host key', () => {
  it('makes a key on the host\'s own account, shows the secret once and keeps only its hash', async () => {
    const made = await mint('ana');
    expect(made.token).toMatch(/^tjmcp_[A-Za-z0-9_-]{43}$/);
    expect(made.mcp_url).toBe('https://api.hosts.test/mcp');

    const row = db.sqlite.prepare('SELECT * FROM mcp_tokens WHERE id = ?').get(made.id) as Record<string, unknown>;
    expect(row).toMatchObject({ account_id: 'ana-personal', user_id: 'ana', scopes: '["host:self"]', label: 'ChatGPT on my phone' });
    expect(row.token_hash).toBe(await sha256Hex(made.token));
    expect(Object.values(row)).not.toContain(made.token);
    expect(JSON.stringify(db.sqlite.prepare('SELECT * FROM activity_logs').all())).not.toContain(made.token);

    const list = await route('ana', '/api/me/assistant-tokens');
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ may_connect: true, mcp_url: 'https://api.hosts.test/mcp' });
    expect(list.body.tokens).toEqual([expect.objectContaining({ id: made.id, label: 'ChatGPT on my phone', prefix: made.prefix, last_used_at: null })]);
    expect(list.text).not.toContain(made.token);
    expect(list.body.tokens[0]).not.toHaveProperty('token');
    expect(list.body.tokens[0]).not.toHaveProperty('token_hash');
  });

  it('refuses a key without a name', async () => {
    expect((await route('ana', '/api/me/assistant-tokens', 'POST', { label: '  ' })).status).toBe(400);
    expect(count('SELECT COUNT(*) AS n FROM mcp_tokens WHERE user_id = ?', 'ana')).toBe(0);
  });

  it('disconnects a key, which then stops working, and lists only live keys', async () => {
    const made = await mint('ana');
    expect(await listed(made.token)).toEqual(HOST_SET);
    const off = await route('ana', `/api/me/assistant-tokens/${made.id}`, 'DELETE');
    expect(off).toMatchObject({ status: 200, body: { ok: true } });
    expect((await rpc(made.token, 'tools/list')).status).toBe(401);
    expect((await route('ana', '/api/me/assistant-tokens')).body.tokens).toEqual([]);
    expect((await route('ana', `/api/me/assistant-tokens/${made.id}`, 'DELETE')).status).toBe(404);
  });

  it('lists and disconnects only the host\'s own host keys', async () => {
    const bos = await mint('bo');
    await shopToken('tjmcp_ana_shop_key', 'ana', 'ana-personal', ALL_SCOPES);
    expect((await route('ana', '/api/me/assistant-tokens')).body.tokens).toEqual([]);
    expect((await route('ana', `/api/me/assistant-tokens/${bos.id}`, 'DELETE')).status).toBe(404);
    expect((await route('ana', '/api/me/assistant-tokens/tok-tjmcp_ana_shop_key', 'DELETE')).status).toBe(404);
    expect(count('SELECT COUNT(*) AS n FROM mcp_tokens WHERE revoked_at IS NOT NULL')).toBe(0);
    expect(await listed(bos.token)).toEqual(HOST_SET);
  });

  it('answers 404 to a person who may not host', async () => {
    flags.ANYONE_HOSTS_OPEN = 'false';
    for (const [method, path] of [['GET', '/api/me/assistant-tokens'], ['POST', '/api/me/assistant-tokens'], ['DELETE', '/api/me/assistant-tokens/x']]) {
      expect((await route('cy', path, method, { label: 'Mine' })).status).toBe(404);
    }
    expect(count('SELECT COUNT(*) AS n FROM mcp_tokens WHERE user_id = ?', 'cy')).toBe(0);
  });

  it('is never made through the owner\'s token page: host:self is not a shop scope', async () => {
    expect(await mcpAdminMintToken(env(), 'ana-personal', 'ana', 'ana@test.dev', 'Sneaky', ['host:self'], 'account_owner')).toBeNull();
    const mixed = await mcpAdminMintToken(env(), 'ana-personal', 'ana', 'ana@test.dev', 'Sneaky', ['host:self', 'inventory:read'], 'account_owner');
    expect(mixed?.scopes).toEqual(['inventory:read']);
  });
});

describe('what a host key reaches on /mcp', () => {
  it('lists exactly the host tools, and the code\'s own list says the same', async () => {
    const { token } = await mint('ana');
    expect(await listed(token)).toEqual(HOST_SET);
    expect([...HOST_SELF_TOOLS].sort()).toEqual(HOST_SET);
    const init = await rpc(token, 'initialize', {});
    expect(JSON.stringify(init.body.result)).not.toMatch(/curate|invoice|inventory/i);
  });

  it('refuses every other tool as unknown, and writes nothing', async () => {
    const { token } = await mint('ana');
    const others = mcpToolNames().filter(name => !HOST_SET.includes(name));
    expect(others.length).toBeGreaterThan(100);
    for (const name of ['set_host_approval', 'stop_host', 'let_host_again', 'search_tea', 'list_invoices', 'update_account_settings',
      'curate_find', 'find_customer', 'release_my_seat', 'hide_tea_table_piece', 'get_session_thanks', 'list_events']) {
      expect(others).toContain(name);
    }
    for (const name of others) {
      const answer = await call(token, name, { table_id: 't-ana', product_id: 'p', user_id: 'bo', approved: true });
      expect(answer.rpcError?.message, name).toBe(`Unknown tool: ${name}`);
    }
    expect(count('SELECT COUNT(*) AS n FROM mcp_confirmation_tickets')).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM users WHERE host_approved_at IS NOT NULL")).toBe(2);
  });

  it('acts at the host\'s own table: makes a table and reads its guests', async () => {
    const { token } = await mint('ana');
    const preview = await call(token, 'host_table', { date: '2030-01-05', time: '16:00', timezone: 'Asia/Taipei' });
    expect(preview.confirmation_token, JSON.stringify(preview)).toBeTruthy();
    expect(await call(token, 'host_table', { confirm: preview.confirmation_token })).toMatchObject({ committed: true });
    expect(count('SELECT COUNT(*) AS n FROM events WHERE account_id = ? AND host_user_id = ?', 'ana-personal', 'ana')).toBe(2);
    const guests = await call(token, 'get_table_guests', { table_id: 't-ana' });
    expect(JSON.stringify(guests)).toContain('Guest g-ana');
    const mine = await call(token, 'list_my_tables');
    expect(JSON.stringify(mine)).not.toMatch(/t-bo|t-shop/);
  });

  it('finds no other host\'s table and no shop session', async () => {
    const { token } = await mint('ana');
    for (const table_id of ['t-bo', 't-shop']) {
      expect(await call(token, 'get_table_guests', { table_id })).toEqual({ error: 'table_not_found' });
      expect(await call(token, 'get_guest_notes', { table_id })).toEqual({ error: 'table_not_found' });
      expect(await call(token, 'answer_guest', { table_id, attendee_id: 'g-bo', answer: 'no' })).toEqual({ error: 'table_not_found' });
      expect(await call(token, 'release_guest_seat', { table_id, attendee_id: 'g-bo' })).toEqual({ error: 'table_not_found' });
      expect(await call(token, 'same_table_again', { table_id, slug: 'copy', event_date: '2030-01-05T14:00' })).toEqual({ error: 'table_not_found' });
      expect(await call(token, 'set_session_tasting', { table_id, is_tasting: true })).toEqual({ error: 'table_not_found' });
      expect((await call(token, 'put_table_in_circle', { table_id, circle_id: null })).error).toBe('table_not_found');
    }
    expect(count('SELECT COUNT(*) AS n FROM mcp_confirmation_tickets')).toBe(0);
    expect(count("SELECT COUNT(*) AS n FROM event_attendees WHERE status = 'confirmed'")).toBe(3);
  });

  it('refuses a host key on any account but the host\'s own, and one carrying any other scope', async () => {
    await shopToken('tjmcp_ana_on_shop', 'ana', 'ana-home', ['host:self']);
    await shopToken('tjmcp_ana_widened', 'ana', 'ana-personal', ['host:self', 'admin:write']);
    await shopToken('tjmcp_ana_on_other', 'ana', 'bo-personal', ['host:self']);
    for (const token of ['tjmcp_ana_on_shop', 'tjmcp_ana_widened', 'tjmcp_ana_on_other']) {
      expect((await rpc(token, 'tools/list')).status, token).toBe(401);
    }
  });

  it('never carries the platform owner\'s authority, even for Adrian', async () => {
    personalAccount('adrian', true);
    const { token } = await mint('adrian');
    expect(await listed(token)).toEqual(HOST_SET);
    expect((await call(token, 'set_host_approval', { user_id: 'cy', approved: true })).rpcError.message).toBe('Unknown tool: set_host_approval');
    expect(db.sqlite.prepare('SELECT creator_tier FROM mcp_tokens WHERE scopes = ?').get('["host:self"]')).toEqual({ creator_tier: 'account_owner' });
  });
});

describe('a stopped host', () => {
  it('cannot mint, and every key of theirs stops working at once', async () => {
    const { token, id } = await mint('ana');
    expect(await listed(token)).toEqual(HOST_SET);
    db.sqlite.prepare("UPDATE users SET hosting_stopped_at = '2026-11-26T10:00:00Z' WHERE id = 'ana'").run();

    expect((await rpc(token, 'tools/list')).status).toBe(401);
    expect((await rpc(token, 'tools/call', { name: 'list_my_tables', arguments: {} })).status).toBe(401);
    const again = await route('ana', '/api/me/assistant-tokens', 'POST', { label: 'Another' });
    expect(again).toMatchObject({ status: 403, body: { code: 'hosting_stopped' } });
    expect(count('SELECT COUNT(*) AS n FROM mcp_tokens WHERE user_id = ?', 'ana')).toBe(1);

    // They still see their keys, and may disconnect one.
    const list = await route('ana', '/api/me/assistant-tokens');
    expect(list.body).toMatchObject({ may_connect: false });
    expect(list.body.tokens.map((t: { id: string }) => t.id)).toEqual([id]);
    expect((await route('ana', `/api/me/assistant-tokens/${id}`, 'DELETE')).status).toBe(200);
  });
});

describe('a host whose approval Teajia withdrew', () => {
  it('still sees and disconnects their keys, which do not work, and makes none', async () => {
    flags.ANYONE_HOSTS_OPEN = 'false';
    const { token, id } = await mint('ana');
    db.sqlite.prepare("UPDATE users SET host_approved_at = NULL WHERE id = 'ana'").run();
    expect((await rpc(token, 'tools/list')).status).toBe(401);
    const list = await route('ana', '/api/me/assistant-tokens');
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ may_connect: false });
    expect(list.body.tokens.map((t: { id: string }) => t.id)).toEqual([id]);
    expect((await route('ana', '/api/me/assistant-tokens', 'POST', { label: 'Another' })).status).toBe(404);
    expect((await route('ana', `/api/me/assistant-tokens/${id}`, 'DELETE')).status).toBe(200);
    // With no key left, the page is closed to them again.
    expect((await route('ana', '/api/me/assistant-tokens')).status).toBe(404);
  });
});

describe('how many keys', () => {
  it('holds the limit in the write: keys made at once never pass it', async () => {
    for (let i = 0; i < 9; i++) await mint('ana', `Key ${i}`);
    const answers = await Promise.all([1, 2, 3].map(n => route('ana', '/api/me/assistant-tokens', 'POST', { label: `At once ${n}` })));
    expect(answers.filter(answer => answer.status === 201)).toHaveLength(1);
    expect(answers.filter(answer => answer.status === 409).map(answer => answer.body.code)).toEqual(['too_many_keys', 'too_many_keys']);
    expect(count("SELECT COUNT(*) AS n FROM mcp_tokens WHERE user_id = 'ana' AND revoked_at IS NULL")).toBe(10);
  });
});

describe('with a switch closed', () => {
  for (const closed of ['HOST_TOKENS_OPEN', 'FEW_HOSTS_OPEN'] as const) {
    it(`${closed} off: the routes answer 404 and no host key works`, async () => {
      const { token, id } = await mint('ana');
      flags[closed] = 'false';
      for (const [method, path] of [['GET', '/api/me/assistant-tokens'], ['POST', '/api/me/assistant-tokens'], ['DELETE', `/api/me/assistant-tokens/${id}`]]) {
        expect((await route('ana', path, method, { label: 'Mine' })).status, `${method} ${path}`).toBe(404);
      }
      expect((await rpc(token, 'tools/list')).status).toBe(401);
      expect(count('SELECT COUNT(*) AS n FROM mcp_tokens WHERE user_id = ? AND revoked_at IS NULL', 'ana')).toBe(1);
      // A shop token is untouched by the switch.
      expect((await listed('tjmcp_adrian_everything')).length).toBeGreaterThan(HOST_SET.length);
    });
  }
});
