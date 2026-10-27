import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
const secret = 'product-detail-refresh-test';
afterEach(() => { databases.splice(0).forEach(db => db.close()); });

async function fixture() {
  const db = new SqliteD1(); databases.push(db);
  seedIdentity(db, { accountId: 'shop-a', userId: 'operator-a' });
  seedIdentity(db, { accountId: 'shop-b', userId: 'operator-b' });
  db.exec(`UPDATE accounts SET default_shipping_rate_per_kg = 85, default_shipping_rate_currency = 'Yuan';
    INSERT INTO products (id, account_id, product_name, type, status, cost_amount, cost_currency,
      quantity_purchased, stock_grams, shipping_rate_per_kg, tasting_notes, additional_images, tasting, is_featured)
    VALUES ('tea-a', 'shop-a', 'Private shop A tea', 'Oolong', 'Draft', 100, 'Yuan',
      500, 123, NULL, '["orchid"]', '["https://example.test/tea.jpg"]', '{"flavor":["floral"]}', 0),
      ('tea-other-a', 'shop-a', 'Other tea', 'Green', 'Active', 10, 'USD', 100, 40, NULL, '[]', '[]', '{}', 0),
      ('tea-b', 'shop-b', 'Private shop B tea', 'Red', 'Active', 200, 'USD', 100, 9, NULL, '[]', '[]', '{}', 0);
    INSERT INTO collections (id, account_id, title, status) VALUES ('collection-a', 'shop-a', 'Featured', 'active');
    INSERT INTO collection_items (id, collection_id, product_id, position) VALUES ('item-a', 'collection-a', 'tea-a', 0);
    INSERT INTO collection_publications (id, collection_id, target_type, slug) VALUES ('publication-a', 'collection-a', 'shop', 'featured');`);
  const token = await signedToken(secret, { sub: 'operator-a', email: 'operator-a@test.dev', role: 'owner', active_account_id: 'shop-a' });
  const sql: string[] = [];
  // This fixture executes only SELECT batches. The generic helper's batch is
  // for mutation tests and deliberately returns run() metadata instead.
  const DB = {
    prepare(query: string) { sql.push(query); return db.prepare(query); },
    batch(statements: Array<ReturnType<SqliteD1['prepare']>>) { return statements.map(statement => statement.all()); },
  };
  const call = (path: string, auth = token, account = 'shop-a') => worker.fetch(new Request(`https://worker.test${path}`, {
    headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), 'X-Teajia-Account': account },
  }), { DB, JWT_SECRET: secret } as any);
  return { db, call, sql };
}

describe('authenticated single-product refresh', () => {
  it('returns exactly the list row, including private fields, JSON, derived collection status and pricing', async () => {
    const { call, sql } = await fixture();
    const listResponse = await call('/api/products');
    expect(listResponse.status).toBe(200);
    const list = await listResponse.json() as any[];
    sql.length = 0;
    const detailResponse = await call('/api/products/tea-a');
    expect(detailResponse.status).toBe(200);
    const detail = await detailResponse.json() as any;
    expect(detail).toEqual(list.find(product => product.id === 'tea-a'));
    expect(detail).toMatchObject({ id: 'tea-a', cost_amount: 100, stock_grams: 123, is_featured: 1, tasting_notes: ['orchid'], tasting: { flavor: ['floral'] } });
    expect(detail.retail_price_per_gram_usd).toBeGreaterThan(0);
    expect(sql.find(query => query.includes('FROM products p'))).toContain('p.account_id = ? AND p.id = ?');
  });

  it('returns indistinguishable 404s for missing and foreign-account product IDs', async () => {
    const { call } = await fixture();
    const missing = await call('/api/products/missing');
    const foreign = await call('/api/products/tea-b');
    expect(missing.status).toBe(404); expect(foreign.status).toBe(404);
    expect(await foreign.json()).toEqual(await missing.json());
  });

  it('refuses anonymous, invalid-token, revoked-session and unauthorized-account reads', async () => {
    const { call, db } = await fixture();
    expect((await call('/api/products/tea-a', '')).status).toBe(401);
    expect((await call('/api/products/tea-a', 'invalid')).status).toBe(401);
    const token = await signedToken(secret, { sub: 'operator-a', email: 'operator-a@test.dev', active_account_id: 'shop-a' });
    expect((await call('/api/products/tea-b', token, 'shop-b')).status).toBe(403);
    db.exec("UPDATE users SET session_version = 1 WHERE id = 'operator-a'");
    expect((await call('/api/products/tea-a')).status).toBe(401);
  });

  it('reloads updated commercial and stock values without reading the whole account list', async () => {
    const { call, db, sql } = await fixture();
    db.exec("UPDATE products SET cost_amount = 150, stock_grams = 98 WHERE id = 'tea-a'");
    const detail = await call('/api/products/tea-a');
    expect(detail.status).toBe(200);
    expect(await detail.json()).toMatchObject({ cost_amount: 150, stock_grams: 98 });
    expect(sql.filter(query => query.includes('FROM products p'))).toHaveLength(1);
    expect(sql.find(query => query.includes('FROM products p'))).toContain('AND p.id = ?');
  });
});
