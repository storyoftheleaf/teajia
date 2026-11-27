import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { resetWisdomIndexForTests } from '../src/mcpTools/wisdomRecords';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

/*
 * The tools added on 2026-11-27 for what an agent could not do that a person
 * can (docs/claude/mcp.md, "What an agent still cannot do"). Each goes through
 * the real /mcp route, so scope, owner checks, tickets and the audit line are
 * the ones a connected assistant meets.
 */

const SHOP = 'acc-gaps';
const TOKEN = 'tjmcp_gap_tools_test';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); vi.unstubAllGlobals(); resetWisdomIndexForTests(); });

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
  batch(statements: any[]) { return this.inner.batch(statements.map(s => s.inner)); }
}

const tokenHash = async (token: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
    .map(value => value.toString(16).padStart(2, '0')).join('');

const ALL = ['inventory:read', 'customers:read', 'sales:read', 'stock:write', 'sales:write', 'catalog:write', 'customers:write', 'admin:write'];

async function makeDb(opts: { scopes?: string[]; platformOwner?: boolean } = {}) {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: SHOP, role: 'owner', platformRole: opts.platformOwner ? 'platform_owner' : null });
  db.sqlite.prepare(`INSERT INTO mcp_tokens
    (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
    VALUES ('tok-gaps',?,?,?,'gaps',?,?,?,'account_owner')`)
    .run(SHOP, 'adrian', 'adrian@test.dev', await tokenHash(TOKEN), TOKEN.slice(0, 8), JSON.stringify(opts.scopes ?? ALL));
  return db;
}

async function rpc(db: SqliteD1, method: string, params: Record<string, unknown>) {
  const response = await worker.fetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }), { DB: new AsyncD1(db), APP_URL: 'https://www.teajia.com' } as any, { waitUntil() {}, passThroughOnException() {} } as any);
  return await response.json() as any;
}

async function call(db: SqliteD1, name: string, args: Record<string, unknown> = {}) {
  const body = await rpc(db, 'tools/call', { name, arguments: args });
  if (body.error) return { rpcError: body.error } as any;
  const text = body.result?.content?.[0]?.text ?? '{}';
  try { return JSON.parse(text); } catch { return { text }; }
}

const listed = async (db: SqliteD1) => (await rpc(db, 'tools/list', {})).result.tools.map((t: any) => t.name) as string[];

function seedTea(db: SqliteD1, id: string, grams: number, extra: Record<string, unknown> = {}) {
  db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, given_name, stock_grams, status, low_stock_threshold, fixed_retail_price_usd, source_compass_entry_id)
    VALUES (?, ?, 'Red', ?, ?, ?, 'Active', ?, ?, ?)`)
    .run(id, SHOP, id, id, grams, extra.threshold ?? null, extra.price ?? null, extra.compass ?? null);
}

describe('site problems', () => {
  function seedProblem(db: SqliteD1) {
    db.sqlite.prepare(`INSERT INTO incident_ledger (id, signature, category, severity, status, error_code, safe_message)
      VALUES ('inc-1', 'rates:stale', 'server', 'high', 'open', 'rates_stale', 'Exchange rates are stale')`).run();
  }

  it('are not offered to a shop owner who is not the platform owner', async () => {
    const db = await makeDb();
    expect(await listed(db)).not.toContain('list_site_problems');
    expect(await call(db, 'list_site_problems')).toMatchObject({ error: 'not_available' });
  });

  it('are listed, and resolved only with what fixed them, after a preview', async () => {
    const db = await makeDb({ platformOwner: true });
    seedProblem(db);
    const list = await call(db, 'list_site_problems');
    expect(list.problems.map((p: any) => p.id)).toEqual(['inc-1']);

    expect(await call(db, 'resolve_site_problem', { problem_id: 'inc-1' })).toMatchObject({ error: 'resolution_ref_required' });
    const preview = await call(db, 'resolve_site_problem', { problem_id: 'inc-1', resolution_ref: 'PR 595' });
    expect(preview.preview).toMatchObject({ from_status: 'open', to_status: 'resolved' });
    expect((db.sqlite.prepare("SELECT status FROM incident_ledger WHERE id = 'inc-1'").get() as any).status).toBe('open');
    const done = await call(db, 'resolve_site_problem', { confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true });
    const row = db.sqlite.prepare("SELECT status, resolution_ref, resolved_at FROM incident_ledger WHERE id = 'inc-1'").get() as any;
    expect(row).toMatchObject({ status: 'resolved', resolution_ref: 'PR 595' });
    expect(row.resolved_at).toBeTruthy();
    expect((await call(db, 'list_site_problems')).problems).toEqual([]);
  });
});

describe('requests from people', () => {
  it('marks a request replied after a preview, and refuses if it moved since', async () => {
    const db = await makeDb();
    db.sqlite.prepare(`INSERT INTO inquiries (id, account_id, name, ref_number, items, status) VALUES ('inq-1', ?, 'Mei', 'TJ-1', '[]', 'new')`).run(SHOP);
    const preview = await call(db, 'set_order_request_status', { request_id: 'TJ-1', status: 'replied' });
    expect(preview.preview).toMatchObject({ from_status: 'new', to_status: 'replied' });
    expect(await call(db, 'set_order_request_status', { confirm: preview.confirmation_token })).toMatchObject({ committed: true });
    expect((db.sqlite.prepare("SELECT status FROM inquiries WHERE id = 'inq-1'").get() as any).status).toBe('replied');

    const again = await call(db, 'set_order_request_status', { request_id: 'inq-1', status: 'closed' });
    db.sqlite.prepare("UPDATE inquiries SET status = 'seen' WHERE id = 'inq-1'").run();
    expect(await call(db, 'set_order_request_status', { confirm: again.confirmation_token })).toMatchObject({ error: 'request_changed' });
  });

  it('lists only the wholesale orders this shop is part of', async () => {
    const db = await makeDb();
    expect(await call(db, 'list_wholesale_orders')).toMatchObject({ orders: [], count: 0 });
    expect(await call(db, 'move_wholesale_order', { order_id: 'nope', to: 'shipped' })).toMatchObject({ error: 'not_found' });
  });
});

describe('low stock leads back to the supplier', () => {
  it('names the supplier card and the newest quote for a tea that came in through Curate', async () => {
    const db = await makeDb();
    db.sqlite.prepare(`INSERT INTO customers (id, account_id, name) VALUES ('ven-1', ?, 'Master Bo')`).run(SHOP);
    db.sqlite.prepare(`INSERT INTO tea_compass_entries (id, account_id, name, vendor_id) VALUES ('ce-1', ?, 'Gushu Red', 'ven-1')`).run(SHOP);
    db.sqlite.prepare(`INSERT INTO curate_quotes (id, account_id, vendor_id, created_by_user_id, updated_at) VALUES ('q-1', ?, 'ven-1', 'adrian', '2026-11-20')`).run(SHOP);
    db.sqlite.prepare(`INSERT INTO curate_quote_lines (id, account_id, quote_id, compass_entry_id, price_amount, price_currency, price_per_unit_grams) VALUES ('ql-1', ?, 'q-1', 'ce-1', 900, 'Yuan', 357)`).run(SHOP);
    seedTea(db, 'gushu', 40, { threshold: 100, compass: 'ce-1' });
    seedTea(db, 'plain', 10, { threshold: 50 });
    const low = await call(db, 'list_low_stock');
    const gushu = low.items.find((i: any) => i.id === 'gushu');
    expect(gushu.reorder).toMatchObject({ vendor_id: 'ven-1', vendor_name: 'Master Bo', last_quote: { quote_id: 'q-1', price_amount: 900, price_currency: 'Yuan' } });
    expect(low.items.find((i: any) => i.id === 'plain').reorder).toBeNull();
  });
});

describe('what agents changed, and the way back', () => {
  it('keeps the stock before and after on the audit line, and puts it back through the stock path', async () => {
    const db = await makeDb();
    seedTea(db, 'gushu', 100);
    const preview = await call(db, 'add_stock', { id: 'gushu', grams: 50 });
    await call(db, 'add_stock', { id: 'gushu', grams: 50, confirm: preview.confirmation_token });
    expect((db.sqlite.prepare("SELECT stock_grams FROM products WHERE id = 'gushu'").get() as any).stock_grams).toBe(150);

    const changes = await call(db, 'list_agent_changes', { product_id: 'gushu' });
    expect(changes.changes[0]).toMatchObject({ tool: 'add_stock', product_id: 'gushu', before: { stock_grams: 100 }, after: { stock_grams: 150 }, undoable: true });

    const undo = await call(db, 'undo_agent_change', { change_id: changes.changes[0].change_id });
    expect(undo.preview.read_back).toMatch(/from 150 to 100 g/);
    expect(await call(db, 'undo_agent_change', { confirm: undo.confirmation_token })).toMatchObject({ committed: true, balance: 100 });
    expect((db.sqlite.prepare("SELECT stock_grams FROM products WHERE id = 'gushu'").get() as any).stock_grams).toBe(100);
  });

  it('answers a price change with the call that puts the old price back, and refuses once the tea moved again', async () => {
    const db = await makeDb();
    seedTea(db, 'gushu', 100, { price: 40 });
    const preview = await call(db, 'update_tea_pricing', { product_id: 'gushu', retail_price_usd: 55 });
    await call(db, 'update_tea_pricing', { product_id: 'gushu', retail_price_usd: 55, confirm: preview.confirmation_token });
    const [change] = (await call(db, 'list_agent_changes', { product_id: 'gushu' })).changes;
    expect(change).toMatchObject({ before: { fixed_retail_price_usd: 40 }, after: { fixed_retail_price_usd: 55 } });
    const undo = await call(db, 'undo_agent_change', { change_id: change.change_id });
    expect(undo.next_call).toEqual({ tool: 'update_tea_pricing', arguments: { product_id: 'gushu', retail_price_usd: 40 } });

    db.sqlite.prepare("UPDATE products SET fixed_retail_price_usd = 60 WHERE id = 'gushu'").run();
    expect(await call(db, 'undo_agent_change', { change_id: change.change_id })).toMatchObject({ error: 'changed_since' });
  });
});

describe("a person's own things", () => {
  it('reads only the caller\'s own Tea Chest', async () => {
    const db = await makeDb({ scopes: ['inventory:read'] });
    seedIdentity(db, { userId: 'mei', accountId: 'acc-mei' });
    db.sqlite.prepare(`INSERT INTO personal_cellar_items (id, owner_user_id, name, grams) VALUES ('mine', 'adrian', 'Old Shou', 200), ('hers', 'mei', 'Her Oolong', 50)`).run();
    const chest = await call(db, 'list_my_tea_chest');
    expect(chest.items.map((i: any) => i.id)).toEqual(['mine']);
    expect(await call(db, 'list_my_orders')).toMatchObject({ count: 0 });
  });
});

describe('places', () => {
  it('adds a place only with a real name and address, after a preview', async () => {
    const db = await makeDb();
    expect(await call(db, 'save_venue', { name: 'Studio' })).toMatchObject({ error: 'name_and_address_required' });
    const preview = await call(db, 'save_venue', { name: 'Studio', address: 'Jl. Raya Ubud 1', area_hint: 'Ubud' });
    expect(await call(db, 'save_venue', { confirm: preview.confirmation_token })).toMatchObject({ committed: true });
    const venues = await call(db, 'list_venues');
    expect(venues.venues.map((v: any) => [v.name, v.area_hint])).toEqual([['Studio', 'Ubud']]);
  });
});

describe('Tea Wisdom', () => {
  it('searches the open dataset and says what a tea is missing', async () => {
    const index = { holdings: [
      { name: 'regions', record: 'https://teajia.com/wisdom/region/{id}.json', page: 'https://teajia.com/wisdom/region/{id}', ids: ['yiwu', 'menghai'] },
      { name: 'cultivars', record: 'https://teajia.com/wisdom/cultivar/{id}.json', page: 'https://teajia.com/wisdom/cultivar/{id}', ids: ['da-hong-pao'] },
    ] };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => String(url).endsWith('/wisdom/index.json')
      ? Response.json(index)
      : Response.json({ id: 'yiwu', name: 'Yiwu' })));
    const db = await makeDb();
    const found = await call(db, 'search_wisdom', { query: 'Yiwu' });
    expect(found.matches[0]).toMatchObject({ holding: 'regions', id: 'yiwu', page: 'https://www.teajia.com/wisdom/region/yiwu' });
    expect(await call(db, 'get_wisdom_entry', { holding: 'regions', id: 'yiwu' })).toMatchObject({ record: { name: 'Yiwu' } });

    db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, origin_country, origin_region, cultivar, status)
      VALUES ('raw', ?, 'Sheng', 'Yiwu 2019', 'China', 'Yiwu', 'Mengku Da Ye', 'Active')`).run(SHOP);
    const needs = await call(db, 'wisdom_records_for_tea', { product_id: 'raw' });
    expect(needs.missing).toEqual(['regions: China', 'cultivars: Mengku Da Ye']);
  });
});
