import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
const JWT = 'curate-inventory-test';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length)
  databases.pop()!.close(); });
function setup() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'a', role: 'owner', bundles: ['gather', 'catalog', 'stock'] });
  seedIdentity(db, { userId: 'other', accountId: 'b', role: 'owner', bundles: ['gather', 'catalog', 'stock'] });
  db.sqlite.prepare("INSERT INTO customers(id,account_id,name,tags) VALUES ('vendor','a','Vendor','[\"vendor\"]'),('vendor-b','b','Foreign','[\"vendor\"]'),('vendor-two','a','Vendor Two','[\"vendor\"]')").run();
  return db;
}
async function call(db: SqliteD1, path: string, method = 'GET', body?: any, account = 'a') {
  const sub = account === 'a' ? 'owner' : 'other';
  const token = await signedToken(JWT, { sub, email: `${sub}@test.dev`, name: sub, active_account_id: account, platform_role: null });
  return worker.fetch(new Request(`https://worker.test${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': account, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { DB: db as any, JWT_SECRET: JWT } as any);
}
async function checked(response: Response, status = 200) {
  const body = await response.json() as any;
  expect(response.status, JSON.stringify(body)).toBe(status);
  return body;
}
async function createTea(db: SqliteD1, id = 'tea', extra: any = {}) {
  return checked(await call(db, '/api/compass/entries', 'POST', { id, name: id, type: 'Oolong', vendor_id: 'vendor', vendor_name: 'Vendor', photos: ['https://media.teajia.co/tea.jpg'], sample_state: 'requested', ...extra }), 201);
}
const sample = (db: SqliteD1, id = 'tea') => db.sqlite.prepare('SELECT * FROM tea_samples WHERE compass_entry_id=? ORDER BY created_at LIMIT 1').get(id) as any;
const tea = (db: SqliteD1, id = 'tea') => db.sqlite.prepare('SELECT * FROM tea_compass_entries WHERE id=?').get(id) as any;
async function proposal(db: SqliteD1, id = 'tea', extra: any = {}) {
  return checked(await call(db, `/api/compass/entries/${id}/receipt-proposals`, 'POST', { purpose: 'working', quantity: 100, unit: 'g', acquisition_kind: 'purchase', idempotency_key: `order:po:${id}`, ...extra }), 201);
}
function order(db: SqliteD1, items: any[], account = 'a') {
  db.sqlite.prepare("INSERT INTO purchase_orders(id,account_id,vendor_id,vendor_name,items_json,created_at,updated_at) VALUES (?,?,?,?,?,datetime('now'),datetime('now'))").run('po', account, account === 'a' ? 'vendor' : 'vendor-b', 'Vendor', JSON.stringify(items));
}
const line = (extra: any = {}) => ({ compass_entry_id: 'tea', quantity_grams: 100, line_total: 80, currency: 'CNY', ...extra });
describe('actual HTTP sample bridge and durable tenancy', () => {
  it('Compass create/update/sync creates vendor-linked portions and retains canonical identities', async () => {
    const db = setup();
    const created = await createTea(db);
    const first = sample(db);
    expect(first).toMatchObject({ source_id: 'vendor', status: 'requested', grams: 10 });
    expect(created.sample_set_id).toBe(first.set_id);
    expect(db.sqlite.prepare('SELECT source_id FROM tea_sample_sets WHERE id=?').get(first.set_id)).toMatchObject({ source_id: 'vendor' });
    await checked(await call(db, '/api/compass/entries/tea', 'PUT', { sample_state: 'received', photos: ['https://media.teajia.co/new.jpg'] }));
    expect(sample(db)).toMatchObject({ id: first.id, status: 'received', photos: '["https://media.teajia.co/new.jpg"]' });
    await checked(await call(db, '/api/compass/sync', 'POST', { entries: [{ id: 'tea', sample_state: 'tasted', shop_name: 'Shop', transport_mode: 'air' }] }));
    expect(sample(db)).toMatchObject({ id: first.id, status: 'tasted' });
    expect(tea(db)).toMatchObject({ shop_name: 'Shop', transport_mode: 'air' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_samples').get()).toMatchObject({ n: 1 });
  });
  it('REST retries use canonical sample ID and server vendor grouping, preserving zero', async () => {
    const db = setup();
    await createTea(db);
    const first = sample(db);
    const one = await checked(await call(db, '/api/admin/samples', 'POST', { id: 'browser-one', set_id: first.set_id, compass_entry_id: 'tea', grams: 0, status: 'received' }), 201);
    const two = await checked(await call(db, '/api/admin/samples', 'POST', { id: 'browser-two', set_id: first.set_id, compass_entry_id: 'tea', status: 'requested' }), 201);
    expect(one.id).toBe(first.id);
    expect(two).toMatchObject({ id: first.id, set_id: first.set_id, grams: 0, status: 'received' });
    expect(tea(db).sample_state).toBe('received');
  });
  it('shelf status and guest tasting synchronize Curate without inventing owner tastings', async () => {
    const db = setup();
    await createTea(db);
    const s = sample(db);
    await checked(await call(db, `/api/admin/samples/${s.id}`, 'PUT', { status: 'received' }));
    expect(tea(db).sample_state).toBe('received');
    const response = await worker.fetch(new Request(`https://worker.test/api/samples/${s.id}/tastings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'guest-tasting', tasterName: 'Guest', tasting: { body: ['full'] }, verdict: 'love', rating: 8 }) }), { DB: db as any, JWT_SECRET: JWT } as any);
    await checked(response, 201);
    expect(sample(db).status).toBe('tasted');
    expect(tea(db).sample_state).toBe('tasted');
    expect(tea(db).tasting).toBeNull();
    const publicResponse = await worker.fetch(new Request(`https://worker.test/api/samples/${s.id}`), { DB: db as any, JWT_SECRET: JWT } as any);
    const publicSample = await checked(publicResponse);
    expect(publicSample).not.toHaveProperty('source_id');
    expect(publicSample).not.toHaveProperty('source_name');
  });
  it('Curate tasting advances sample lifecycle without manufacturing shelf verdicts', async () => {
    const db = setup();
    await createTea(db);
    await checked(await call(db, '/api/compass/entries/tea', 'PUT', { tasting: { body: ['full'] } }));
    expect(sample(db).status).toBe('tasted');
    expect(tea(db).sample_state).toBe('tasted');
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_sample_tastings').get()).toMatchObject({ n: 0 });
  });
  it('vendor reassignment moves the existing portion into that vendor group', async () => {
    const db = setup();
    await createTea(db);
    const original = sample(db);
    await createTea(db, 'tea-two', { vendor_id: 'vendor-two', vendor_name: 'Vendor Two' });
    const target = sample(db, 'tea-two');
    await checked(await call(db, '/api/compass/entries/tea', 'PUT', { vendor_id: 'vendor-two', vendor_name: 'Vendor Two' }));
    expect(sample(db)).toMatchObject({ id: original.id, set_id: target.set_id, source_id: 'vendor-two' });
  });
  it('rejects cross-account vendor, sample, set and Curate links without mutating data', async () => {
    const db = setup();
    await createTea(db);
    const existing = sample(db);
    const badVendor = await call(db, '/api/compass/entries/tea', 'PUT', { vendor_id: 'vendor-b' });
    expect(badVendor.status).toBe(400);
    expect(sample(db).source_id).toBe('vendor');
    const foreign = await call(db, `/api/admin/samples/${existing.id}`, 'PUT', { status: 'received' }, 'b');
    expect(foreign.status).toBe(404);
    const badLink = await call(db, '/api/admin/samples', 'POST', { id: 'bad', set_id: existing.set_id, compass_entry_id: 'tea' }, 'b');
    expect([400, 404]).toContain(badLink.status);
    const foreignSet = await call(db, '/api/compass/entries', 'POST', { id: 'bad-tea', sample_state: 'requested', sample_set_id: existing.set_id }, 'b');
    expect(foreignSet.status).toBe(404);
    expect(sample(db).status).toBe('requested');
  });
});
describe('reviewed arrivals preserve actual order cost and private metadata', () => {
  it('fills an empty promoted draft from its first actual order without treating a quote as batch cost', async () => {
    const db = setup();
    await createTea(db, 'tea', { price_amount: 800, price_currency: 'Yuan', price_per_unit_grams: 1000 });
    const promoted = await checked(await call(db, '/api/compass/entries/tea/promote', 'POST'), 201);
    expect(db.sqlite.prepare('SELECT cost_amount FROM products WHERE id = ?').get(promoted.id)).toMatchObject({ cost_amount: null });
    order(db, [line()]);
    const pending = await proposal(db, 'tea', { product_id: promoted.id });
    const accepted = await checked(await call(db, `/api/curate/receipt-proposals/${pending.id}/accept`, 'POST'));
    expect(accepted.product_id).toBe(promoted.id);
    expect(db.sqlite.prepare('SELECT cost_amount, cost_currency, quantity_purchased, stock_grams FROM products WHERE id = ?').get(promoted.id))
      .toMatchObject({ cost_amount: 80, cost_currency: 'Yuan', quantity_purchased: 100, stock_grams: 100 });
  });

  it('uses the exact order line total as cost and metadata as a hidden draft, retries once', async () => {
    const db = setup();
    await createTea(db, 'tea', { chinese_name: '茶', year: 2019, origin_region: 'Yiwu', form: 'Cake', tasting: { body: ['full'] }, price_amount: 800, price_currency: 'Yuan', price_per_unit_grams: 1000 });
    order(db, [line(), line({ compass_entry_id: 'unrelated', line_total: 999, quantity_grams: 1000 })]);
    const p = await proposal(db);
    const first = await checked(await call(db, `/api/curate/receipt-proposals/${p.id}/accept`, 'POST'));
    const product = db.sqlite.prepare('SELECT * FROM products WHERE id=?').get(first.product_id) as any;
    expect(product).toMatchObject({ cost_amount: 80, cost_currency: 'Yuan', quantity_purchased: 100, vendor_id: 'vendor', chinese_name: '茶', year: 2019, origin_region: 'Yiwu', form: 'Cake', image_url: 'https://media.teajia.co/tea.jpg', stock_grams: 100, is_public: 0, shown_in_shop: 0, shipping_rate_per_kg: null, markup_multiplier: null });
    expect(JSON.parse(product.tasting)).toMatchObject({ body: ['full'] });
    expect(sample(db).product_id).toBe(first.product_id);
    expect(tea(db).status).toBe('in_stock');
    const retry = await checked(await call(db, `/api/curate/receipt-proposals/${p.id}/accept`, 'POST'));
    expect(retry).toMatchObject({ product_id: first.product_id, ledger_id: first.ledger_id, alreadyAccepted: true });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_ledger WHERE account_id=?').get('a')).toMatchObject({ n: 1 });
    expect(db.sqlite.prepare('SELECT is_public,shown_in_shop,cost_amount,shipping_rate_per_kg FROM product_listings WHERE legacy_product_id=?').get(product.id)).toMatchObject({ is_public: 0, shown_in_shop: 0, cost_amount: 80, shipping_rate_per_kg: null });
  });
  it.each(['quantity', 'foreign-order', 'duplicate-line', 'missing-cost', 'missing-currency'] as const)('refuses %s instead of silently inventing a batch cost', async (kind) => {
    const db = setup();
    await createTea(db);
    const items = kind === 'duplicate-line' ? [line(), line()] : [line(kind === 'missing-cost' ? { line_total: null } : kind === 'missing-currency' ? { currency: null } : {})];
    order(db, items, kind === 'foreign-order' ? 'b' : 'a');
    const p = await proposal(db, 'tea', kind === 'quantity' ? { quantity: 50 } : {});
    const response = await call(db, `/api/curate/receipt-proposals/${p.id}/accept`, 'POST');
    expect(response.status, await response.text()).toBe(400);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM products WHERE account_id=?').get('a')).toMatchObject({ n: 0 });
    expect(db.sqlite.prepare('SELECT status FROM curate_receipt_proposals WHERE id=?').get(p.id)).toMatchObject({ status: 'pending' });
  });
  it('keeps purchase cost unknown without an order instead of copying a quoted per-kg price', async () => {
    const db = setup();
    await createTea(db, 'tea', { price_amount: 800, price_currency: 'Yuan', price_per_unit_grams: 1000 });
    const p = await proposal(db, 'tea', { idempotency_key: 'manual-arrival' });
    const accepted = await checked(await call(db, `/api/curate/receipt-proposals/${p.id}/accept`, 'POST'));
    expect(db.sqlite.prepare('SELECT cost_amount,cost_currency,quantity_purchased FROM products WHERE id=?').get(accepted.product_id)).toMatchObject({ cost_amount: null, cost_currency: null, quantity_purchased: null });
  });
});
