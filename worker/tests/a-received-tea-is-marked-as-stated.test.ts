import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * A tea received against an order line is marked as having a stated currency,
 * and an order that does not exist is a 404, not a quiet success.
 *
 * The purchase order line STATES its currency, and accepting the receipt copies
 * it onto the product. Until this file the copy left `cost_currency_source`
 * NULL, which is how "nobody ever answered" is stored, so every tea shelved
 * through Curate landed in `list_unstated_costs` and a vendor-wide
 * `set_cost_currency` could have rewritten a currency somebody chose and moved
 * the shelf price by the exchange rate. These tests DRIVE `acceptCurateReceipt`
 * through the worker against a real database; reading the source cannot tell
 * you the mark was written.
 */

const SECRET = 'received-tea-secret';
const ACCOUNT = 'account-a';
const OWNER = 'account-owner';

const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function database() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner', bundles: ['catalog', 'stock', 'publish', 'sell'] });
  db.sqlite.prepare(`INSERT INTO tea_compass_entries (id, user_id, account_id, name, status) VALUES ('entry-1', ?, ?, 'Order Cake', 'want')`)
    .run(OWNER, ACCOUNT);
  return db;
}

async function call(db: SqliteD1, method: string, path: string, body?: unknown) {
  const token = await signedToken(SECRET, {
    sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER,
    active_account_id: ACCOUNT, platform_role: null,
  });
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method,
    headers: new Headers({
      Authorization: `Bearer ${token}`,
      'X-Teajia-Account': ACCOUNT,
      'Content-Type': 'application/json',
    }),
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

function orderWithArrival(db: SqliteD1, currency: string, productId: string | null = null) {
  const items = [{
    compass_entry_id: 'entry-1', name: 'Order Cake', quantity_grams: 357, line_total: 1200, currency,
  }];
  const now = new Date().toISOString();
  db.sqlite.prepare(`INSERT INTO purchase_orders (id, account_id, vendor_name, items_json, status, created_at, updated_at)
    VALUES ('order-1', ?, 'Vendor', ?, 'pending', ?, ?)`).run(ACCOUNT, JSON.stringify(items), now, now);
  db.sqlite.prepare(`INSERT INTO curate_receipt_proposals
    (id, account_id, compass_entry_id, product_id, product_name, product_type, purpose, quantity, unit, acquisition_kind, idempotency_key, proposed_by_user_id)
    VALUES ('proposal-1', ?, 'entry-1', ?, 'Order Cake', 'Sheng', 'working', 357, 'g', 'purchase', 'order:order-1:entry-1', ?)`)
    .run(ACCOUNT, productId, OWNER);
}

const product = (db: SqliteD1, id: string) => db.sqlite.prepare(
  'SELECT cost_amount, cost_currency, cost_currency_source FROM products WHERE id = ?').get(id) as any;
const listing = (db: SqliteD1, id: string) => db.sqlite.prepare(
  'SELECT cost_amount, cost_currency, cost_currency_source FROM product_listings WHERE legacy_product_id = ?').get(id) as any;

describe('a tea received against an order line carries the currency the order stated', () => {
  it('a new product is marked as stated, and so is its listing', async () => {
    const db = database();
    orderWithArrival(db, 'CNY');
    const response = await call(db, 'POST', '/api/curate/receipt-proposals/proposal-1/accept');
    expect(response.status).toBe(200);
    const { product_id } = await response.json() as { product_id: string };

    expect(product(db, product_id)).toEqual({ cost_amount: 1200, cost_currency: 'Yuan', cost_currency_source: 'stated' });
    expect(listing(db, product_id)).toEqual({ cost_amount: 1200, cost_currency: 'Yuan', cost_currency_source: 'stated' });
  });

  it('a draft the promotion created before the order is marked when its first receipt prices it', async () => {
    const db = database();
    db.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, source_compass_entry_id, cost_amount, cost_currency, cost_currency_source, stock_grams, quantity_purchased)
      VALUES ('draft-1', ?, 'Sheng', 'Order Cake', 'entry-1', NULL, NULL, NULL, 0, NULL)`).run(ACCOUNT);
    db.sqlite.prepare(`INSERT INTO tea_profiles (id, slug, originated_by_account_id, curated_by_account_id, name, type, status)
      VALUES ('prof_draft-1', 'order-cake-draft', ?, ?, 'Order Cake', 'Sheng', 'draft')`).run(ACCOUNT, ACCOUNT);
    db.sqlite.prepare(`INSERT INTO product_listings (id, account_id, profile_id, legacy_product_id) VALUES ('list_draft-1', ?, 'prof_draft-1', 'draft-1')`)
      .run(ACCOUNT);
    orderWithArrival(db, 'NT', 'draft-1');
    const response = await call(db, 'POST', '/api/curate/receipt-proposals/proposal-1/accept');
    expect(response.status).toBe(200);

    expect(product(db, 'draft-1')).toEqual({ cost_amount: 1200, cost_currency: 'NT', cost_currency_source: 'stated' });
    expect(listing(db, 'draft-1')).toEqual({ cost_amount: 1200, cost_currency: 'NT', cost_currency_source: 'stated' });
  });
});

describe('updating a purchase order that does not exist', () => {
  it('answers 404, not success', async () => {
    const db = database();
    const response = await call(db, 'PUT', '/api/purchase-orders/no-such-order', { status: 'sent' });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/not found/i) });
  });

  it('answers 404 for another account\'s order, and leaves it untouched', async () => {
    const db = database();
    db.sqlite.prepare(`INSERT INTO purchase_orders (id, account_id, items_json, status, created_at, updated_at)
      VALUES ('foreign', 'account-b', '[]', 'pending', 'x', 'x')`).run();
    const response = await call(db, 'PUT', '/api/purchase-orders/foreign', { status: 'sent' });
    expect(response.status).toBe(404);
    expect((db.sqlite.prepare("SELECT status FROM purchase_orders WHERE id = 'foreign'").get() as any).status).toBe('pending');
  });

  it('an empty edit of a missing order is also 404', async () => {
    const db = database();
    expect((await call(db, 'PUT', '/api/purchase-orders/nope', {})).status).toBe(404);
  });

  it('still updates an order that is there', async () => {
    const db = database();
    orderWithArrival(db, 'CNY');
    const response = await call(db, 'PUT', '/api/purchase-orders/order-1', { status: 'sent' });
    expect(response.status).toBe(200);
    expect((db.sqlite.prepare("SELECT status FROM purchase_orders WHERE id = 'order-1'").get() as any).status).toBe('sent');
  });
});
