import { afterEach, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const databases: SqliteD1[] = [];
afterEach(() => databases.splice(0).forEach(db => db.close()));

async function setup() {
  const db = new SqliteD1('schema');
  databases.push(db);
  const { accountId, userId, email } = seedIdentity(db, { bundles: ['stock', 'catalog', 'sell', 'publish'] });
  const JWT_SECRET = 'synthetic-publication-jwt';
  const token = await signedToken(JWT_SECRET, { sub: userId, email, role: 'owner', active_account_id: accountId });
  const mcpToken = 'tjmcp_synthetic_listing';
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(mcpToken)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  db.sqlite.prepare(`INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
    VALUES ('mcp', ?, ?, ?, 'Publication fixture', ?, 'fixture', '["stock:write","catalog:write"]', 'account_owner')`)
    .run(accountId, userId, email, hash);

  async function request(path: string, method = 'GET', body?: unknown, auth = token) {
    const response = await worker.fetch(new Request('https://demo.test' + path, {
      method, headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}`, 'X-Teajia-Account': accountId } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }), { DB: db, JWT_SECRET, PUBLIC_MCP_LIMITER: { limit: async () => ({ success: true }) } } as never, { waitUntil() {} } as never);
    return { status: response.status, body: await response.json() as any };
  }

  async function tool(name: string, args: Record<string, unknown>) {
    const response = await request('/mcp', 'POST', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, mcpToken);
    expect(response.body.error, JSON.stringify(response.body)).toBeUndefined();
    return JSON.parse(response.body.result.content[0].text);
  }

  async function publicTool(name: string, args: Record<string, unknown>) {
    const response = await request(`/mcp/public?account=${accountId}`, 'POST',
      { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, '');
    expect(response.body.error, JSON.stringify(response.body)).toBeUndefined();
    return JSON.parse(response.body.result.content[0].text);
  }

  function product(id: string) {
    return db.sqlite.prepare('SELECT * FROM products WHERE id = ?').get(id) as { slug: string };
  }

  return { db, accountId, userId, request, tool, publicTool, product };
}

const ready = { product_name: 'Spring Oolong', type: 'Oolong', cost_amount: 100, cost_currency: 'USD', fixed_retail_price_usd: 2, stock_grams: 0 };

it('only publishes eligible REST creates, gives counted zero a sold-out address, and imports in private', async () => {
  const { accountId, request, product } = await setup();
  const unknown = { ...ready, product_name: 'Unknown count', stock_grams: undefined, stock_known_at: '2026-11-17' };
  expect(await request('/api/products', 'POST', { ...unknown, is_public: true })).toMatchObject({
    status: 409, body: { code: 'product_publication_incomplete', details: { missing: ['stock'] } },
  });
  expect(await request('/api/products', 'POST', { ...ready, product_name: 'Untitled', type: 'Misc', fixed_retail_price_usd: null, is_public: true })).toMatchObject({
    status: 409, body: { details: { missing: ['name', 'type', 'price'] } },
  });
  expect(await request('/api/products', 'POST', { ...ready, is_public: true, in_transit: true })).toMatchObject({
    status: 409, body: { code: 'incoming_stock_not_publishable' },
  });

  const zero = await request('/api/products', 'POST', { ...ready, is_public: true, status: 'Sold Out' });
  expect(zero.status).toBe(201);
  expect(product(zero.body.id)).toMatchObject({ stock_grams: 0, is_public: 1, shown_in_shop: 1 });
  const shop = `/api/s/${accountId}/products`;
  expect(await request(shop, 'GET', undefined, '')).toMatchObject({ status: 200, body: [] });
  expect(await request(`${shop}/${zero.body.id}`, 'GET', undefined, '')).toMatchObject({ status: 200, body: { id: zero.body.id, status: 'Sold Out' } });

  const listed = await request('/api/products', 'POST', {
    ...ready, product_name: 'Source-reviewed Oolong', stock_grams: 120,
    description: 'Picked by hand in spring.', image_url: 'https://example.test/hero.jpg',
    additional_images: ['https://example.test/leaf.jpg'],
  });
  expect(listed.status).toBe(201);
  const publicProduct = {
    id: listed.body.id, description: 'Picked by hand in spring.', image_url: 'https://example.test/hero.jpg',
    additional_images: ['https://example.test/leaf.jpg'], retail_price_per_gram_usd: 2, stock_grams: 120,
  };
  expect(await request(shop, 'GET', undefined, '')).toMatchObject({ status: 200, body: [publicProduct] });
  expect(await request(`${shop}/${product(listed.body.id).slug}`, 'GET', undefined, '')).toMatchObject({ status: 200, body: publicProduct });

  const implicit = await request('/api/products', 'POST', unknown);
  expect(implicit.status).toBe(201);
  expect(product(implicit.body.id)).toMatchObject({ stock_known_at: null, is_public: 0, shown_in_shop: 0 });
  expect(await request(`${shop}/${implicit.body.id}`, 'GET', undefined, '')).toMatchObject({ status: 404 });

  const bulk = await request('/api/products/bulk', 'POST', { products: [{ ...ready, product_name: 'Bulk known', is_public: true }, { ...unknown, product_name: 'Bulk unknown', is_public: true }] });
  expect(bulk.status).toBeLessThan(300);
  expect(bulk.body.results).toHaveLength(2);
  for (const row of bulk.body.results) {
    expect(row.status).toBe('inserted');
    expect(product(row.product_id)).toMatchObject({ is_public: 0, shown_in_shop: 0 });
  }
  const imported = bulk.body.results.map((row: { product_id: string }) => product(row.product_id));
  expect(imported).toEqual(expect.arrayContaining([
    expect.objectContaining({ product_name: 'Bulk known', stock_known_at: expect.any(String) }),
    expect.objectContaining({ product_name: 'Bulk unknown', stock_known_at: null }),
  ]));
});

it('allows ready rows and returns precise row refusals for mixed Stock publication writes', async () => {
  const { db, accountId, userId, request, publicTool, product } = await setup();
  db.sqlite.exec(`INSERT INTO products (id, account_id, product_name, type, status, stock_grams, stock_known_at, fixed_retail_price_usd, is_public, shown_in_shop)
    VALUES ('counted', '${accountId}', 'Counted', 'Red', 'Draft', 0, '2026-11-17', 2, 0, 0),
           ('unknown', '${accountId}', 'Unknown', 'Red', 'Draft', 500, NULL, 2, 1, 1),
           ('legacy', '${accountId}', 'Legacy', 'Red', 'Sold Out', 0, NULL, NULL, 1, 1),
           ('incoming', '${accountId}', 'Incoming', 'Red', 'Active', 0, '2026-11-17', 2, 0, 0);
    INSERT INTO inventory_receipts (id, account_id, state, source_kind, created_by_user_id, idempotency_key, request_fingerprint)
    VALUES ('inbound', '${accountId}', 'ordered', 'manual', '${userId}', 'fixture', 'fixture');
    INSERT INTO inventory_receipt_lines (id, account_id, receipt_id, product_id, expected_quantity, unit, intended_purpose, source_kind)
    VALUES ('inbound-line', '${accountId}', 'inbound', 'incoming', 200, 'g', 'working', 'manual');`);

  const results = await Promise.all([
    request('/api/products/counted/publication', 'PUT', { status: 'Active', is_public: true }),
    request('/api/products/unknown/publication', 'PUT', { status: 'Active' }),
    request('/api/products/legacy/shown', 'PUT', { shown_in_shop: true }),
    request('/api/products/incoming/shown', 'PUT', { shown_in_shop: true }),
  ]);
  expect(results.map(result => result.status)).toEqual([200, 409, 200, 409]);
  expect(results[1].body).toMatchObject({ details: { missing: ['stock'] } });
  expect(results[3].body).toMatchObject({ code: 'incoming_stock_not_publishable', details: { incoming_quantity: 200 } });
  expect(await request('/api/products/counted/shown', 'PUT', { shown_in_shop: true })).toMatchObject({ status: 200 });
  expect(product('unknown')).toMatchObject({ status: 'Draft' });
  expect(product('incoming')).toMatchObject({ shown_in_shop: 0 });
  expect(await request(`/api/s/${accountId}/products/legacy`, 'GET', undefined, '')).toMatchObject({ status: 200 });
  expect(await publicTool('get_tea', { id: 'legacy' })).toMatchObject({ id: 'legacy', in_stock: false });
  expect(await publicTool('get_tea', { id: 'incoming' })).toEqual({ error: 'not_found' });
  expect(await publicTool('browse_catalog', {})).toMatchObject({ items: [expect.objectContaining({ id: 'counted' })] });

  expect(await request('/api/products/unknown/publication', 'PUT', { status: 'Archived' })).toMatchObject({ status: 200 });
  expect(await request('/api/products/unknown/publication', 'PUT', { status: 'Active' })).toMatchObject({ status: 200 });
  expect(product('unknown')).toMatchObject({ status: 'Active', is_public: 0, shown_in_shop: 0 });
});

it('rechecks MCP visibility on confirm and distinguishes counted zero from a default zero on create', async () => {
  const { db, request, tool, product } = await setup();
  const privateRow = await request('/api/products', 'POST', { ...ready, is_public: false });
  expect(privateRow.status).toBe(201);
  const args = { product_id: privateRow.body.id, shown_in_shop: true, is_public: true };
  const preview = await tool('set_tea_visibility', args);
  expect(preview.confirmation_token).toBeTruthy();

  db.sqlite.prepare('UPDATE products SET stock_known_at = NULL WHERE id = ?').run(privateRow.body.id);
  expect(await tool('set_tea_visibility', { ...args, confirm: preview.confirmation_token })).toMatchObject({
    code: 'product_publication_incomplete', details: { missing: ['stock'] },
  });
  expect(product(privateRow.body.id)).toMatchObject({ is_public: 0, shown_in_shop: 0 });

  for (const count of [undefined, 0]) {
    const input = { ...ready, product_name: `MCP count ${count}`, stock_grams: count };
    const preview = await tool('create_tea', input);
    expect(preview.preview.product.publish).toBe(count === 0);
    const result = await tool('create_tea', { confirm: preview.confirmation_token });
    expect(result).toMatchObject({ committed: true, is_public: count === 0 });
    expect(product(result.product.id)).toMatchObject({ is_public: count === 0 ? 1 : 0 });
  }
});

it('rolls back publication and its mirror when stock changes after eligibility is read', async () => {
  const { db, request, product } = await setup();
  const created = await request('/api/products', 'POST', { ...ready, is_public: false });
  const id = created.body.id;
  const batch = db.batch.bind(db);
  db.batch = statements => {
    db.sqlite.prepare('UPDATE products SET stock_known_at = NULL WHERE id = ?').run(id);
    db.batch = batch;
    return batch(statements);
  };
  expect(await request(`/api/products/${id}/publication`, 'PUT', { is_public: true })).toMatchObject({
    status: 409, body: { code: 'product_publication_changed' },
  });
  expect(product(id)).toMatchObject({ is_public: 0, stock_known_at: null });
  expect(db.sqlite.prepare('SELECT is_public FROM product_listings WHERE legacy_product_id = ?').get(id)).toEqual({ is_public: 0 });
});
