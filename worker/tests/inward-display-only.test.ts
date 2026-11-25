import { afterEach, expect, it } from 'vitest';
import { INWARD_BALI_LOT } from '../../shared/catalog/inwardOrders';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const { accountId, id } = INWARD_BALI_LOT;
const slug = 'teajia-bali';
const shop = '/api/s/' + slug + '/products';
const intake = '/api/admin/catalog-review/teas';
const privateFinding = 'Owner-only fixture: verify the lot before offering it.';
const opening = 'The handwritten label reads “Liu Pao”, another spelling of Liu Bao.';
const secret = 'synthetic-inward-display-only';
const other = 'counted-control';
const opened: SqliteD1[] = [];
afterEach(() => opened.splice(0).forEach(db => db.close()));

async function fixture() {
  const db = new SqliteD1('migrations');
  opened.push(db);
  seedIdentity(db, { accountId, accountSlug: slug, userId: 'owner', bundles: ['catalog', 'publish', 'stock', 'sell'] });
  seedIdentity(db, { accountId, accountSlug: slug, userId: 'staff', role: 'staff', bundles: ['catalog', 'publish', 'stock'] });
  seedIdentity(db, { accountId: 'other-shop', userId: 'other-owner', bundles: ['catalog', 'publish', 'stock', 'sell'] });
  const add = db.sqlite.prepare(`INSERT INTO products
    (id, account_id, slug, type, product_name, given_name, form, description, image_url, additional_images,
     cost_amount, cost_currency, fixed_retail_price_usd, stock_grams, stock_known_at, stock_verified_at, status, is_public, shown_in_shop)
    VALUES (?, ?, ?, 'Liu Bao', ?, ?, 'Loose', ?, '/fixture/wide.jpg', '["/fixture/detail.jpg"]',
      NULL, NULL, 2, ?, ?, NULL, 'Active', 1, 0)`);
  add.run(id, accountId, 'inward', 'Liu Bao', 'Inward', opening, 600, null);
  add.run(other, accountId, 'counted', 'Counted tea', 'Counted', 'Control', 200, '2026-11-24');
  add.run('uncounted-control', accountId, 'uncounted', 'Uncounted tea', 'Uncounted', 'Control', 600, null);
  db.sqlite.prepare("INSERT INTO tea_profiles (id, slug, name, type, originated_by_account_id, curated_by_account_id, description) VALUES (?, 'inward', 'Inward', 'Liu Bao', ?, ?, ?)").run('prof_' + id, accountId, accountId, opening);
  db.sqlite.prepare(`INSERT INTO product_listings (id, account_id, profile_id, legacy_product_id, stock_grams, status, is_public, shown_in_shop)
    VALUES ('inward-listing', ?, ?, ?, 600, 'active', 1, 0)`).run(accountId, 'prof_' + id, id);

  const profilePath = '/shop/product/inward';
  const holdHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('holds:' + profilePath));
  const holdKey = [...new Uint8Array(holdHash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const root = 'owner-review/' + accountId + '/catalog-reading/';
  const objects = new Map([
    [root + 'index.json', { ownerUserId: 'owner', items: [] }],
    [root + 'editorial.json', { holds: [{ title: 'Inward', url: profilePath }], passages: [], histories: [] }],
    [root + 'connections/' + holdKey + '.json', { version: 1, finding: { text: privateFinding, resolved: false } }],
  ]);
  const env = {
    DB: db, JWT_SECRET: secret, INQUIRY_LIMITER: { limit: async () => ({ success: true }) },
    ATLAS_BUCKET: { get: async (key: string) => objects.has(key) ? Response.json(objects.get(key)) : null },
  } as unknown as Parameters<typeof worker.fetch>[1];
  const tokens = {
    owner: await signedToken(secret, { sub: 'owner', email: 'owner@test.dev', active_account_id: accountId }),
    staff: await signedToken(secret, { sub: 'staff', email: 'staff@test.dev', active_account_id: accountId }),
    other: await signedToken(secret, { sub: 'other-owner', email: 'other@test.dev', active_account_id: 'other-shop' }),
  };
  const request = (path: string, method = 'GET', body?: unknown, who?: keyof typeof tokens) => worker.fetch(
    new Request('https://fixture.test' + path, {
      method, headers: { 'Content-Type': 'application/json', ...(who && { Authorization: 'Bearer ' + tokens[who] }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), env, { waitUntil() {} } as unknown as ExecutionContext,
  );
  let sequence = 0;
  const order = (productId: string, source: 'website' | 'cart') => {
    sequence++;
    return request('/api/inquiries', 'POST', {
      source, store_slug: slug, tracking_token: 'inwardtesttoken' + String(sequence).padStart(20, '0'), ref_number: 'TJ-' + sequence,
      customer_name: 'Guest', customer_contact: 'guest@example.com', customer_location: 'Los Angeles, CA 90012, United States',
      delivery_country: 'US', delivery_address: '12 Test Lane', delivery_city: 'Los Angeles', delivery_state: 'CA', us_shipping_postcode: '90012',
      currency: 'USD', total_estimate_usd: 50,
      items: [{ id: productId, name: 'Tea', category: 'tea', storeSlug: slug, quantityGrams: 50, packGrams: 25, packs: 2, pricePerGram: 0.2, totalPrice: 14 }],
    });
  };
  return { db, request, order, findingPath: intake + '/connection?' + new URLSearchParams({ view: 'holds', id: profilePath }) };
}

it('keeps the exact pending Bali tea viewable only after the existing owner action and blocks purchases and samples', async () => {
  const { db, request, order, findingPath } = await fixture();
  const shown = '/api/products/' + id + '/shown';
  expect((await request(shop + '/inward')).status).toBe(404);
  expect((await request(shown, 'PUT', { shown_in_shop: true }, 'staff')).status).toBe(403);
  expect((await request(shown, 'PUT', { shown_in_shop: true }, 'other')).status).toBe(404);
  expect((await request('/api/products/' + id + '/publication', 'PUT', { is_public: true }, 'owner')).status).toBe(409);
  expect((await request('/api/products/uncounted-control/shown', 'PUT', { shown_in_shop: true }, 'owner')).status).toBe(409);
  expect((await request(shown, 'PUT', { shown_in_shop: true }, 'owner')).status).toBe(200);
  expect(db.sqlite.prepare('SELECT status, stock_grams, stock_known_at, stock_verified_at FROM products WHERE id=?').get(id)).toEqual({
    status: 'Active', stock_grams: 600, stock_known_at: null, stock_verified_at: null,
  });

  const publicShape = {
    id, description: opening, image_url: '/fixture/wide.jpg', additional_images: ['/fixture/detail.jpg'],
    stock_grams: null, retail_price_per_gram_usd: null, fixed_retail_price_usd: null, orders_paused: true,
  };
  for (const path of [shop + '/inward', '/api/products/public/' + id]) {
    const publicRow = await (await request(path)).json();
    expect(publicRow).toMatchObject(publicShape);
    expect(JSON.stringify(publicRow)).not.toContain(privateFinding);
    expect(publicRow).not.toHaveProperty('stock_verified_at');
  }
  expect(await (await request(shop)).json()).toEqual([expect.objectContaining(publicShape)]);
  expect(await (await request(findingPath, 'GET', undefined, 'owner')).json()).toMatchObject({ finding: { text: privateFinding, resolved: false } });
  expect((await request(findingPath)).status).toBe(401);
  expect((await request(findingPath, 'GET', undefined, 'staff')).status).toBe(403);

  const website = await order(id, 'website');
  expect(website.status).toBe(400);
  expect(await website.json()).toEqual({ error: 'Store or items not found' });
  const cart = await order(id, 'cart');
  expect(cart.status, await cart.text()).toBe(404);
  expect((await request('/api/samples/request', 'POST', { product_id: id, quantity_grams: 25 }, 'owner')).status).toBe(404);
  const wholesale = await request('/api/wholesale/orders', 'POST', { supplier_account_id: accountId, currency: 'USD', items: [
    { supplier_listing_id: 'inward-listing', grams: 25, unit_price_amount: 2, unit_price_currency: 'USD' },
  ] }, 'other');
  expect(wholesale.status).toBe(409);
  for (const table of ['inquiries', 'invoices', 'wholesale_orders', 'tea_samples']) {
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM ' + table).get()).toMatchObject({ n: 0 });
  }

  expect((await request(shown, 'PUT', { shown_in_shop: false }, 'owner')).status).toBe(200);
  expect((await request(shop + '/inward')).status).toBe(404);
});

it('preserves ordinary counted publication and resumes Inward after a verified count in the fixture', async () => {
  const { db, request, order } = await fixture();
  expect((await request('/api/products/' + other + '/shown', 'PUT', { shown_in_shop: true }, 'owner')).status).toBe(200);
  expect(await (await request(shop + '/counted')).json()).toMatchObject({ id: other, stock_grams: 200, retail_price_per_gram_usd: 2 });
  const countedOrder = await order(other, 'website');
  expect(countedOrder.status, await countedOrder.text()).toBe(201);
  const countedSample = await request('/api/samples/request', 'POST', { product_id: other, quantity_grams: 25 }, 'owner');
  expect(countedSample.status, await countedSample.text()).toBe(201);

  expect((await request('/api/products/' + id + '/shown', 'PUT', { shown_in_shop: true }, 'owner')).status).toBe(200);
  db.sqlite.prepare("UPDATE products SET stock_known_at='2026-11-24' WHERE id=?").run(id);
  expect(await (await request(shop + '/inward')).json()).toMatchObject({ orders_paused: true });
  const website = await order(id, 'website');
  expect(website.status).toBe(400);
  expect(await website.json()).toEqual({ error: 'Store or items not found' });
  const counted = await request('/api/products/' + id + '/movements', 'POST', {
    movement_type: 'recount', balance: 120, expected_balance: 600, unit: 'g', idempotency_key: 'fixture-count-only',
  }, 'owner');
  expect(counted.status, await counted.text()).toBe(201);
  const row = await (await request(shop + '/inward')).json();
  expect(row).toMatchObject({ id, stock_grams: 120, retail_price_per_gram_usd: 2 });
  expect(row).not.toHaveProperty('orders_paused');
  expect((await order(id, 'website')).status).toBe(201);
});

it('leaves a paused tea out of a basket and sends the rest of the order through', async () => {
  const { db, request } = await fixture();
  expect((await request('/api/products/' + other + '/shown', 'PUT', { shown_in_shop: true }, 'owner')).status).toBe(200);
  expect((await request('/api/products/' + id + '/shown', 'PUT', { shown_in_shop: true }, 'owner')).status).toBe(200);
  const line = (productId: string) => ({ id: productId, name: 'Tea', category: 'tea', storeSlug: slug, quantityGrams: 50, packGrams: 25, packs: 2, pricePerGram: 0.2, totalPrice: 14 });
  const basket = (source: 'website' | 'cart', n: number, items: unknown[]) => request('/api/inquiries', 'POST', {
    source, store_slug: slug, tracking_token: 'mixedbaskettoken' + String(n).padStart(20, '0'), ref_number: 'TJ-M' + n,
    customer_name: 'Guest', customer_contact: 'guest@example.com', customer_location: 'Los Angeles, CA 90012, United States',
    delivery_country: 'US', delivery_address: '12 Test Lane', delivery_city: 'Los Angeles', delivery_state: 'CA', us_shipping_postcode: '90012',
    currency: 'USD', total_estimate_usd: 28, items,
  });
  for (const [n, source] of ([[1, 'website'], [2, 'cart']] as const)) {
    const response = await basket(source, n, [line(id), line(other)]);
    const body = await response.json() as Record<string, unknown>;
    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body.skipped_paused_product_ids).toEqual([id]);
  }
  const saved = db.sqlite.prepare('SELECT items FROM inquiries ORDER BY rowid').all() as Array<{ items: string }>;
  expect(saved).toHaveLength(2);
  for (const row of saved) expect(JSON.parse(row.items).map((item: { id: string }) => item.id)).toEqual([other]);
  expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoice_line_items WHERE product_id = ?').get(id)).toMatchObject({ n: 0 });

  const onlyPaused = await basket('cart', 3, [line(id)]);
  expect(onlyPaused.status).toBe(404);
});
