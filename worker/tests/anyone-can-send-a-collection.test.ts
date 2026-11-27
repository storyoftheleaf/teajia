import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// A tea master tells someone what to buy by sending a collection (Adrian,
// 2026-11-27). Anyone signed in makes one from shop teas; it lives in the shop
// that sells them, carries the maker's name, and the shop's own price applies.

const SECRET = 'made-collection-secret';
const databases: SqliteD1[] = [];
afterEach(() => { databases.splice(0).forEach(db => db.close()); });

function seed() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop', bundles: ['sell'] });
  seedIdentity(db, { userId: 'owner2', accountId: 'other', bundles: ['sell'] });
  db.sqlite.exec(`
    INSERT INTO users (id, email, name, password_hash, role, session_version) VALUES ('daniel', 'daniel@test.dev', 'Daniel Ruiz', 'test', 'user', 0);
    INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency, quantity_purchased, stock_grams, is_public, shown_in_shop, status)
    VALUES ('liu-bao', 'shop', 'Dark', 'Liu Bao', 'Loose', 20, 'USD', 300, 1000, 1, 1, 'Active'),
           ('dan-cong', 'shop', 'Oolong', 'Dan Cong', 'Loose', 30, 'USD', 300, 1000, 1, 1, 'Active'),
           ('hidden', 'shop', 'Red', 'Private Red', 'Loose', 30, 'USD', 300, 1000, 0, 0, 'Active'),
           ('elsewhere', 'other', 'Green', 'Long Jing', 'Loose', 30, 'USD', 300, 1000, 1, 1, 'Active');
  `);
  return db;
}

async function call(db: SqliteD1, method: string, path: string, body?: unknown) {
  const token = await signedToken(SECRET, { sub: 'daniel', email: 'daniel@test.dev', name: 'Daniel Ruiz', platform_role: null });
  return worker.fetch(new Request(`https://app.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
}

describe('anyone can send a collection', () => {
  it('makes a live link from shop teas, named for its maker, priced by the shop', async () => {
    const db = seed();
    const made = await call(db, 'POST', '/api/me/collections/make', { title: 'For Mia', note: 'Start with the Liu Bao.', product_ids: ['liu-bao', 'dan-cong', 'hidden'] });
    expect(made.status).toBe(201);
    const { slug, item_count, left_out } = await made.json() as { slug: string; item_count: number; left_out: number };
    expect(item_count).toBe(2);
    expect(left_out).toBe(1);

    const collection = db.sqlite.prepare('SELECT account_id, status, curator_user_id, curator_display_name FROM collections').get();
    expect(collection).toEqual({ account_id: 'shop', status: 'active', curator_user_id: 'daniel', curator_display_name: 'Daniel Ruiz' });
    const prices = db.sqlite.prepare('SELECT recommended_price_usd FROM collection_items').all() as Array<{ recommended_price_usd: number | null }>;
    expect(prices.every(row => row.recommended_price_usd == null)).toBe(true);

    const page = await worker.fetch(new Request(`https://app.test/api/public/c/${slug}`), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect(page.status).toBe(200);

    const shelf = await (await call(db, 'GET', '/api/me/collections')).json() as { collections: Array<{ slug: string; source: string }> };
    expect(shelf.collections).toEqual([expect.objectContaining({ slug, source: 'made' })]);
  });

  it('keeps it "made" when the maker opens their own link', async () => {
    const db = seed();
    const { slug } = await (await call(db, 'POST', '/api/me/collections/make', { title: 'For Mia', product_ids: ['liu-bao'] })).json() as { slug: string };
    await call(db, 'POST', '/api/me/collections/received', { slug });
    expect(db.sqlite.prepare('SELECT source FROM saved_collections').get()).toEqual({ source: 'made' });
  });

  it('refuses teas the shop does not sell, and teas from two shops at once', async () => {
    const db = seed();
    expect((await call(db, 'POST', '/api/me/collections/make', { title: 'x', product_ids: ['hidden'] })).status).toBe(400);
    expect((await call(db, 'POST', '/api/me/collections/make', { title: 'x', product_ids: ['liu-bao', 'elsewhere'] })).status).toBe(400);
    expect((await call(db, 'POST', '/api/me/collections/make', { title: '', product_ids: ['liu-bao'] })).status).toBe(400);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM collections').get()).toEqual({ n: 0 });
  });

  it('takes the link down when the maker removes it', async () => {
    const db = seed();
    const { id, slug } = await (await call(db, 'POST', '/api/me/collections/make', { title: 'For Mia', product_ids: ['liu-bao'] })).json() as { id: string; slug: string };
    expect((await call(db, 'DELETE', `/api/me/collections/${id}`)).status).toBe(200);
    const page = await worker.fetch(new Request(`https://app.test/api/public/c/${slug}`), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect(page.status).toBe(410);
  });

  it('needs a signed-in person', async () => {
    const db = seed();
    const response = await worker.fetch(new Request('https://app.test/api/me/collections/make', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'x', product_ids: ['liu-bao'] }),
    }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect(response.status).toBe(401);
  });
});
