import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

/*
 * Adrian, 2026-11-27: "shop default" should open the shop's shipping, and an
 * agent should be able to do the same work. These go through the real /mcp
 * route: one read shows every rate, and a tea can be put on a service or back
 * on the shop default with preview and confirm.
 */

const SHOP = 'acc-freight';
const TOKEN = 'tjmcp_freight_rates_test';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

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

async function makeDb() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: SHOP, role: 'owner' });
  db.sqlite.prepare(`INSERT INTO mcp_tokens
    (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
    VALUES ('tok-freight',?,?,?,'freight',?,?,?,'account_owner')`)
    .run(SHOP, 'adrian', 'adrian@test.dev', await tokenHash(TOKEN), TOKEN.slice(0, 8), JSON.stringify(['inventory:read', 'stock:write']));
  db.sqlite.prepare("UPDATE accounts SET default_shipping_rate_per_kg = 85, default_shipping_rate_currency = 'Yuan' WHERE id = ?").run(SHOP);
  db.sqlite.prepare("INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd, last_updated) VALUES ('Yuan', 7, datetime('now'))").run();
  db.sqlite.prepare("INSERT INTO customers (id, account_id, name) VALUES ('co-1', ?, 'Fast Freight')").run(SHOP);
  db.sqlite.prepare(`INSERT INTO logistics_services (id, account_id, logistics_company_id, logistics_company_name, name, mode, basis, rate, currency, active, created_at, updated_at)
    VALUES ('svc-air', ?, 'co-1', 'Fast Freight', 'Air', 'air', 'kg', 60, 'Yuan', 1, datetime('now'), datetime('now')),
           ('svc-old', ?, 'co-1', 'Fast Freight', 'Old', 'sea', 'kg', 20, 'Yuan', 0, datetime('now'), datetime('now'))`).run(SHOP, SHOP);
  const tea = db.sqlite.prepare("INSERT INTO products (id, account_id, type, product_name, given_name, status, shipping_rate_per_kg, freight_service_id) VALUES (?, ?, ?, ?, ?, 'Active', ?, ?)");
  tea.run('dancong', SHOP, 'Oolong', 'Dancong', 'Dancong', null, null);
  tea.run('liubao', SHOP, 'Dark', 'Liubao', 'Liubao', null, 'svc-air');
  tea.run('aged', SHOP, 'Oolong', 'Aged', 'Aged', 12, null);
  tea.run('cup', SHOP, 'Teaware', 'Cup', 'Cup', null, null);
  return db;
}

async function call(db: SqliteD1, name: string, args: Record<string, unknown>) {
  const response = await worker.fetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), { DB: new AsyncD1(db) } as any, { waitUntil() {}, passThroughOnException() {} } as any);
  const body = await response.json() as any;
  if (body.error) return { rpcError: body.error } as any;
  return JSON.parse(body.result?.content?.[0]?.text ?? '{}');
}
const serviceOf = (db: SqliteD1, id: string) => (db.sqlite.prepare('SELECT freight_service_id FROM products WHERE id = ?').get(id) as any).freight_service_id;

describe('list_freight_rates', () => {
  it('shows the shop default, each active service, and teas with their own rate', async () => {
    const db = await makeDb();
    const read = await call(db, 'list_freight_rates', {});
    expect(read.shop_default).toMatchObject({ rate_per_kg: 85, currency: 'Yuan', per_kg_usd: 85 / 7, teas_following: 1, set_by_shop: true });
    expect(read.services).toHaveLength(1);
    expect(read.services[0]).toMatchObject({ service_id: 'svc-air', rate: 60, label: '60 Yuan/kg', teas_following: 1 });
    expect(read.teas_with_own_rate.map((t: any) => t.product_id)).toEqual(['aged']);
  });
});

describe('set_tea_freight_service', () => {
  it('previews without writing, then puts the tea on the service', async () => {
    const db = await makeDb();
    const preview = await call(db, 'set_tea_freight_service', { product_id: 'dancong', service_id: 'svc-air' });
    expect(preview.preview).toMatchObject({ from: 'shop default', to: 'Fast Freight · Air, 60 Yuan/kg' });
    expect(serviceOf(db, 'dancong')).toBeNull();
    const done = await call(db, 'set_tea_freight_service', { confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, freight_service_id: 'svc-air' });
    expect(serviceOf(db, 'dancong')).toBe('svc-air');
  });

  it('hands a tea back to the shop default with null', async () => {
    const db = await makeDb();
    const preview = await call(db, 'set_tea_freight_service', { product_id: 'liubao', service_id: null });
    expect(preview.preview.to).toBe('shop default');
    await call(db, 'set_tea_freight_service', { confirm: preview.confirmation_token });
    expect(serviceOf(db, 'liubao')).toBeNull();
  });

  it('refuses an archived service, teaware, and a tea that changed after the preview', async () => {
    const db = await makeDb();
    expect((await call(db, 'set_tea_freight_service', { product_id: 'dancong', service_id: 'svc-old' })).error).toMatch(/active logistics services/);
    expect((await call(db, 'set_tea_freight_service', { product_id: 'cup', service_id: 'svc-air' })).error).toMatch(/Teaware/);
    const preview = await call(db, 'set_tea_freight_service', { product_id: 'dancong', service_id: 'svc-air' });
    db.sqlite.prepare("UPDATE products SET freight_service_id = 'svc-old' WHERE id = 'dancong'").run();
    expect((await call(db, 'set_tea_freight_service', { confirm: preview.confirmation_token })).error).toMatch(/changed after the preview/);
    expect(serviceOf(db, 'dancong')).toBe('svc-old');
  });

  it('warns when the tea still carries its own older rate', async () => {
    const db = await makeDb();
    const preview = await call(db, 'set_tea_freight_service', { product_id: 'aged', service_id: 'svc-air' });
    expect(preview.preview.warning).toMatch(/own older rate/);
  });
});
