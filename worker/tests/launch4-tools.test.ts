import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { sha256Hex } from '../src/inquiryDomain';
import { seedIdentity, SqliteD1 } from './helpers/sqliteD1';

let db: SqliteD1;
const scopes = ['inventory:read', 'stock:write', 'catalog:write', 'admin:write'];

beforeEach(async () => {
  db = new SqliteD1('migrations');
  seedIdentity(db, { userId: 'host', accountId: 'shop' });
  seedIdentity(db, { userId: 'other', accountId: 'other-shop' });
  seedIdentity(db, { userId: 'owner', accountId: 'platform', platformRole: 'platform_owner' });
  db.exec(`
    INSERT INTO articles (id, account_id, title, slug, status) VALUES
      ('article', 'shop', 'Water and stone', 'water-and-stone', 'published');
    INSERT INTO products (id, account_id, product_name, type, status, is_public, shown_in_shop) VALUES
      ('tea', 'shop', 'Old Tree Red', 'Red', 'Active', 1, 1);
    INSERT INTO personal_cellar_items (id, owner_user_id, name, grams) VALUES
      ('chest', 'host', 'Liu Bao', 100), ('other-chest', 'other', 'Dancong', 50);
    INSERT INTO events (id, account_id, title, slug, event_date, lifecycle_status, public_visibility, recap_status, network_discovery) VALUES
      ('recap', 'shop', 'Autumn sit', 'autumn', '2026-11-20', 'completed', 'public', 'published', 1),
      ('foreign', 'other-shop', 'Other sit', 'other', '2026-11-21', 'completed', 'public', 'published', 1);
    INSERT INTO event_post_session (id, account_id, event_id, session_notes) VALUES
      ('post', 'shop', 'recap', 'We poured tea.'), ('foreign-post', 'other-shop', 'foreign', 'Tea.');
    INSERT INTO customer_tasting_journal (id, user_id, product_id, product_name) VALUES
      ('tasting', 'host@test.dev', 'tea', 'Old Tree Red');
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published, page_tier) VALUES
      ('host-page', 'shop', 'host', 'Host', 1, 'family');
    -- The token's person hosted the sit: the page and the tool put a recap on the table for its host (A11-6).
    INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('host-page', 'shop');
    INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public) VALUES
      ('recap-host', 'shop', 'recap', 'host-page', 'lead_host', 0);
    INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, tea_table_at)
      VALUES ('tasting', 'shop', 'tea', 'host', 'page', datetime('now'));
    INSERT INTO tea_table_keeps (user_id, item_kind, item_id) VALUES ('other', 'tasting', 'tasting');
  `);
  for (const [token, user, account, granted] of [
    ['host', 'host', 'shop', scopes],
    ['sibling', 'host', 'shop', scopes],
    ['reader', 'host', 'shop', ['inventory:read']],
    ['other', 'other', 'other-shop', scopes],
    ['owner', 'owner', 'platform', scopes],
  ] as const) {
    db.sqlite.prepare(`INSERT INTO mcp_tokens
      (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
      VALUES (?, ?, ?, ?, 'test', ?, 'tjmcp_', ?, ?)`).run(
      token, account, user, `${user}@test.dev`, await sha256Hex(`tjmcp_${token}`),
      JSON.stringify(granted), user === 'owner' ? 'platform_owner' : 'account_owner',
    );
  }
});

afterEach(() => db?.close());

async function rpc(method: string, params: unknown, token = 'host', flags = {}) {
  const response = await worker.fetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { authorization: `Bearer tjmcp_${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }), { DB: db as any, JWT_SECRET: 'synthetic', FAVOURITES_OPEN: 'true', TEA_TABLE_OPEN: 'true', ...flags });
  expect(response.status).toBe(200);
  const body = await response.json() as any;
  expect(body.error).toBeUndefined();
  return body.result;
}

/** The whole JSON-RPC answer, error or not. */
async function rawCall(name: string, args = {}, token = 'host', flags = {}) {
  const response = await worker.fetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { authorization: `Bearer tjmcp_${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), { DB: db as any, JWT_SECRET: 'synthetic', FAVOURITES_OPEN: 'true', TEA_TABLE_OPEN: 'true', ...flags });
  return { status: response.status, body: await response.json() as any };
}

/** A closed tool answers exactly as a tool that does not exist (A4 review, finding 12). */
async function expectAbsent(name: string, args: object, token: string, flags: object) {
  const absent = await rawCall('no_such_tool', args, token, flags);
  const answer = await rawCall(name, args, token, flags);
  expect(answer).toEqual({
    ...absent, body: { ...absent.body, error: { ...absent.body.error, message: absent.body.error.message.replace('no_such_tool', name) } },
  });
}

const call = async (name: string, args = {}, token = 'host', flags = {}) =>
  (await rpc('tools/call', { name, arguments: args }, token, flags)).structuredContent;
const list = (token = 'host') => call('list_my_favourites', {}, token);
const invalid = { error: 'invalid_or_expired_confirmation_token' };

async function preview(name: string, args: object, token = 'host') {
  const result = await call(name, args, token);
  expect(result.preview).toMatchObject({ action: name });
  expect(result.confirmation_token).toEqual(expect.any(String));
  expect(JSON.stringify(result)).not.toMatch(/"(?:count|keeps|keep_count|score)":/);
  return result.confirmation_token as string;
}

async function commit(name: string, args: object, token = 'host') {
  const result = await call(name, { confirm: await preview(name, args, token) }, token);
  expect(result).toMatchObject({ committed: true, action: name });
  expect(JSON.stringify(result)).not.toMatch(/"(?:count|keeps|keep_count|score)":/);
  return result;
}

describe('Launch 4 MCP tools', () => {
  it('registers tools on /mcp and hides closed or owner-only tools from discovery', async () => {
    const names = async (token: string, flags = {}) =>
      (await rpc('tools/list', {}, token, flags)).tools.map((tool: { name: string }) => tool.name);
    const favourites = ['list_my_favourites', 'set_my_favourite'];
    const table = ['set_tea_table_keep', 'set_my_recap_on_tea_table', 'take_my_tasting_off_tea_table'];
    const moderation = ['hold_tea_table_piece', 'hide_tea_table_piece'];
    const hostTools = await names('host');
    const ownerTools = await names('owner');
    expect(hostTools).toEqual(expect.arrayContaining([...favourites, ...table]));
    expect(ownerTools).toEqual(expect.arrayContaining([...favourites, ...table, ...moderation]));
    for (const name of moderation) expect(hostTools).not.toContain(name);

    const closedFavourites = { FAVOURITES_OPEN: 'false' };
    const closedTable = { TEA_TABLE_OPEN: 'false' };
    const withoutFavourites = await names('owner', closedFavourites);
    const withoutTable = await names('owner', closedTable);
    expect(withoutFavourites).toEqual(expect.arrayContaining(table));
    expect(withoutTable).toEqual(expect.arrayContaining(favourites));
    for (const name of favourites) {
      expect(withoutFavourites).not.toContain(name);
      await expectAbsent(name, {}, 'owner', closedFavourites);
    }
    for (const name of [...table, ...moderation]) {
      expect(withoutTable).not.toContain(name);
      await expectAbsent(name, {}, 'owner', closedTable);
    }
    expect(await call('set_my_favourite', {}, 'reader')).toMatchObject({ error: 'insufficient_mcp_scope' });
    // Closed, even a token without the scope cannot tell the tool exists.
    await expectAbsent('set_my_favourite', {}, 'reader', closedFavourites);
  });

  it.each([
    ['article', 'article', 'articles'], ['shop_tea', 'tea', 'shop_teas'], ['chest_tea', 'chest', 'chest_teas'],
  ])('adds and removes a private %s favourite through the shared list', async (kind, id, group) => {
    const args = { kind, id, kept: true };
    const confirm = await preview('set_my_favourite', args);
    expect((await list())[group]).toEqual([]);
    expect(await call('set_my_favourite', { confirm }, 'sibling')).toEqual(invalid);
    await expectAbsent('set_my_favourite', { confirm }, 'host', { FAVOURITES_OPEN: 'false' });
    expect(await call('set_my_favourite', { confirm, id: 'ignored', kept: false })).toMatchObject({ committed: true, id, kept: true });
    expect(await call('set_my_favourite', { confirm })).toEqual(invalid);
    expect((await list())[group]).toEqual([expect.objectContaining({ id })]);
    expect((await list('other'))[group]).toEqual([]);
    await commit('set_my_favourite', { ...args, kept: false });
    expect((await list())[group]).toEqual([]);
  });

  it('removes legacy shop favourites and checks current eligibility on confirm', async () => {
    db.exec("INSERT INTO user_favorites (user_id, item_id) VALUES ('host', 'tea'), ('host', 'tea')");
    await commit('set_my_favourite', { kind: 'shop_tea', id: 'tea', kept: false });
    expect((await list()).shop_teas).toEqual([]);
    expect(await call('set_my_favourite', { kind: 'chest_tea', id: 'other-chest', kept: true })).toMatchObject({ error: 'not_found' });
    const confirm = await preview('set_my_favourite', { kind: 'article', id: 'article', kept: true });
    db.exec("UPDATE articles SET status = 'draft' WHERE id = 'article'");
    expect(await call('set_my_favourite', { confirm })).toMatchObject({ error: 'not_found' });
    expect(db.sqlite.prepare('SELECT * FROM favourite_articles').all()).toEqual([]);
  });

  it('can remove a stale shop favourite without revealing a private product name', async () => {
    db.exec(`
      UPDATE products SET is_public = 0 WHERE id = 'tea';
      INSERT INTO user_favorites (user_id, item_id) VALUES ('host', 'tea');
    `);
    const args = { kind: 'shop_tea', id: 'tea', kept: false };
    const result = await call('set_my_favourite', args);
    expect(result.preview).toMatchObject({ id: 'tea', title: 'tea' });
    expect(JSON.stringify(result)).not.toContain('Old Tree Red');
    expect(await call('set_my_favourite', { confirm: result.confirmation_token })).toMatchObject({ committed: true });
    expect(db.sqlite.prepare('SELECT * FROM user_favorites').all()).toEqual([]);
  });

  it('keeps and lets go a visible piece for the caller only', async () => {
    const args = { kind: 'tasting', id: 'tasting', kept: true };
    const saved = () => db.sqlite.prepare('SELECT user_id FROM tea_table_keeps ORDER BY user_id').all();
    const confirm = await preview('set_tea_table_keep', args);
    expect(saved()).toEqual([{ user_id: 'other' }]);
    expect(await call('take_my_tasting_off_tea_table', { confirm })).toEqual(invalid);
    await expectAbsent('set_tea_table_keep', { confirm }, 'host', { TEA_TABLE_OPEN: 'false' });
    expect(await call('set_tea_table_keep', { confirm })).toMatchObject({ committed: true, kept: true });
    expect(saved()).toEqual([{ user_id: 'host' }, { user_id: 'other' }]);
    await commit('set_tea_table_keep', { ...args, kept: false });
    expect(saved()).toEqual([{ user_id: 'other' }]);
  });

  it('publishes and withdraws a recap only for its host, in its own account', async () => {
    const args = { id: 'recap', on_table: true };
    const state = () => db.sqlite.prepare("SELECT tea_table_at AS at FROM events WHERE id = 'recap'").get();
    expect(await call('set_my_recap_on_tea_table', args, 'other')).toMatchObject({ error: 'not_found' });
    const confirm = await preview('set_my_recap_on_tea_table', args);
    expect(state()).toEqual({ at: null });
    db.exec("UPDATE events SET network_discovery = 0 WHERE id = 'recap'");
    expect(await call('set_my_recap_on_tea_table', { confirm })).toMatchObject({ error: 'recap_not_eligible' });
    expect(state()).toEqual({ at: null });
    db.exec("UPDATE events SET network_discovery = 1 WHERE id = 'recap'");
    expect(await commit('set_my_recap_on_tea_table', args)).toMatchObject({ on_table: true });
    expect(state()).toEqual({ at: expect.any(String) });
    await commit('set_my_recap_on_tea_table', { ...args, on_table: false });
    expect(state()).toEqual({ at: null });
  });

  it('lets the author take their tasting off the table, keeping their page share', async () => {
    const args = { id: 'tasting' };
    expect(await call('take_my_tasting_off_tea_table', args, 'other')).toMatchObject({ error: 'not_found' });
    await commit('hold_tea_table_piece', { kind: 'tasting', ...args, days: 1 }, 'owner');
    // The author had put it on their page by itself first, so taking it off
    // the table keeps the page (A4 review, finding 1).
    db.exec("UPDATE member_tasting_shares SET page_alone_at = datetime('now')");
    await commit('take_my_tasting_off_tea_table', args);
    expect(db.sqlite.prepare('SELECT share_state, tea_table_at FROM member_tasting_shares').get())
      .toEqual({ share_state: 'page', tea_table_at: null });
    expect(db.sqlite.prepare('SELECT * FROM tea_table_holds').all()).toEqual([]);
  });

  it('makes a tasting private when the table was the only reason it was public', async () => {
    await commit('take_my_tasting_off_tea_table', { id: 'tasting' });
    expect(db.sqlite.prepare('SELECT share_state, tea_table_at FROM member_tasting_shares').get())
      .toEqual({ share_state: 'private', tea_table_at: null });
  });

  it('limits moderation to the current platform owner and a hold to 1 through 14 days', async () => {
    const item = { kind: 'tasting', id: 'tasting' };
    expect(await call('hold_tea_table_piece', { ...item, days: 1 })).toMatchObject({ error: 'platform_owner_only' });
    expect(await call('hide_tea_table_piece', item)).toMatchObject({ error: 'platform_owner_only' });
    for (const days of [0, 15, 1.5, '7', undefined]) {
      expect(await call('hold_tea_table_piece', { ...item, days }, 'owner')).toMatchObject({ error: 'validation_failed' });
    }
    const held = await commit('hold_tea_table_piece', { ...item, days: 14 }, 'owner');
    expect(Date.parse(held.held_until.replace(' ', 'T') + 'Z') - Date.now()).toBeGreaterThan(13 * 86400000);
    const keep = await preview('set_tea_table_keep', { ...item, kept: true });
    const confirm = await preview('hide_tea_table_piece', item, 'owner');
    db.exec("UPDATE users SET platform_role = 'platform_admin' WHERE id = 'owner'");
    expect(await call('hide_tea_table_piece', { confirm }, 'owner')).toMatchObject({ error: 'platform_owner_only' });
    db.exec("UPDATE users SET platform_role = 'platform_owner' WHERE id = 'owner'");
    expect(await call('hide_tea_table_piece', { confirm }, 'owner')).toMatchObject({ committed: true, hidden: true });
    expect(await call('set_tea_table_keep', { confirm: keep })).toMatchObject({ error: 'not_found' });
    expect(db.sqlite.prepare('SELECT * FROM tea_table_holds').all()).toEqual([]);
    expect(db.sqlite.prepare('SELECT hidden_by FROM family_hides').get()).toEqual({ hidden_by: 'owner' });
  });
});
