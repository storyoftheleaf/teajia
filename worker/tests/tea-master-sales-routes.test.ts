import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'tea-master-sales-secret';
const databases: SqliteD1[] = [];

function database() {
  const db = new SqliteD1();
  databases.push(db);
  return db;
}

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function call(db: SqliteD1, path: string, options: {
  method?: string; body?: unknown; userId?: string; accountId?: string;
} = {}) {
  const userId = options.userId ?? 'account-owner';
  const accountId = options.accountId ?? 'account-a';
  const token = await signedToken(SECRET, {
    sub: userId, email: `${userId}@test.dev`, name: userId,
    active_account_id: accountId, platform_role: null,
  });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: options.method ?? 'GET', headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

function seed(db: SqliteD1) {
  seedIdentity(db, { userId: 'account-owner', accountId: 'account-a', role: 'owner' });
  seedIdentity(db, { userId: 'stock-owner', accountId: 'account-a', role: 'staff', bundles: ['stock'] });
  seedIdentity(db, { userId: 'seller', accountId: 'account-a', role: 'staff', bundles: ['sell'] });
  seedIdentity(db, { userId: 'other-seller', accountId: 'account-a', role: 'staff', bundles: ['sell'] });
  seedIdentity(db, { userId: 'account-b-owner', accountId: 'account-b', role: 'owner' });
  db.sqlite.prepare(`INSERT INTO products
    (id, account_id, type, product_name, given_name, stock_grams, fixed_retail_price_usd, owner_user_id)
    VALUES ('person-tea','account-a','Oolong','Person Tea','Person Tea',100,0.5,'stock-owner')`).run();
  db.sqlite.prepare(`INSERT INTO products
    (id, account_id, type, product_name, given_name, stock_grams, fixed_retail_price_usd, owner_user_id)
    VALUES ('location-tea','account-a','Oolong','Location Tea','Location Tea',80,0.4,NULL)`).run();
  db.sqlite.prepare(`INSERT INTO products
    (id, account_id, type, product_name, given_name, stock_grams, fixed_retail_price_usd, owner_user_id)
    VALUES ('foreign-tea','account-b','Oolong','Foreign Tea','Foreign Tea',100,0.5,'account-b-owner')`).run();
}

async function createGrant(db: SqliteD1, overrides: Record<string, unknown> = {}) {
  return call(db, '/api/sales/grants', {
    method: 'POST', body: {
      product_id: 'person-tea', seller_user_id: 'seller', price_floor: 0.4,
      owner_share_type: 'percent', owner_share_value: 80, quantity_limit: 50,
      ...overrides,
    },
  });
}

const invoiceBody = (status = 'Pending', quantity = 20, price = 0.5) => ({
  invoice: { customer_name: 'Buyer', display_currency: 'USD', status },
  lineItems: [{ product_id: 'person-tea', quantity, price_at_sale: price }],
});

describe('Tea Master sales grants and eligibility', () => {
  it('confines grants to one account and requires an active Sell recipient', async () => {
    const db = database(); seed(db);
    const crossAccount = await createGrant(db, { product_id: 'foreign-tea' });
    expect(crossAccount.status).toBe(404);

    const noSell = await createGrant(db, { seller_user_id: 'stock-owner' });
    expect(noSell.status).toBe(400);
    expect(await noSell.json()).toMatchObject({ code: 'seller_requires_sell_access' });
  });

  it('lets owner-tier or the stock owner create, update, list and revoke grants without deleting history', async () => {
    const db = database(); seed(db);
    const created = await createGrant(db);
    expect(created.status).toBe(201);
    const grant = await created.json() as any;
    expect(grant).toMatchObject({ account_id: 'account-a', product_id: 'person-tea', seller_user_id: 'seller' });

    const updated = await call(db, `/api/sales/grants/${grant.id}`, {
      method: 'PUT', userId: 'stock-owner', body: { price_floor: 0.45, quantity_limit: 40 },
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ price_floor: 0.45, quantity_limit: 40 });

    expect((await call(db, `/api/sales/grants/${grant.id}`, { method: 'DELETE', userId: 'stock-owner' })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT revoked_at FROM sales_grants WHERE id=?').get(grant.id)).toMatchObject({ revoked_at: expect.any(String) });
  });

  it('returns only operational labels for products the actor may sell', async () => {
    const db = database(); seed(db); await createGrant(db);
    db.sqlite.prepare(`INSERT INTO stock_holds(id,account_id,invoice_id,product_id,held_grams,expires_at)
      VALUES ('hold-a','account-a','other-order','person-tea',25,datetime('now','+1 day'))`).run();
    const response = await call(db, '/api/sales/eligible-products', { userId: 'seller' });
    expect(response.status).toBe(200);
    const rows = await response.json() as any[];
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ product_id: 'person-tea', owner_id: 'stock-owner', physical_quantity: 100, held_quantity: 25, available_quantity: 75, permission_reason: 'active_grant' }),
      expect.objectContaining({ product_id: 'location-tea', owner_id: null, permission_reason: 'location_stock' }),
    ]));
    expect(JSON.stringify(rows)).not.toContain('@test.dev');
  });
});

describe('Tea Master invoice authorization, holds and settlements', () => {
  it('denies another person\'s stock without a grant and validates grant price and quantity', async () => {
    const db = database(); seed(db);
    expect((await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody() })).status).toBe(403);
    await createGrant(db);
    expect((await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody('Pending', 20, 0.39) })).status).toBe(400);
    expect((await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody('Pending', 51, 0.5) })).status).toBe(400);
    const duplicateLimit = invoiceBody('Pending', 30, 0.5);
    duplicateLimit.lineItems.push({ product_id: 'person-tea', quantity: 30, price_at_sale: 0.5 });
    expect((await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: duplicateLimit })).status).toBe(400);
  });

  it('authorizes a custom-line product link before mutating the invoice', async () => {
    const db = database(); seed(db);
    const created = await call(db, '/api/invoices', {
      method: 'POST', userId: 'seller', body: {
        invoice: { customer_name: 'Buyer', display_currency: 'USD', status: 'Draft' },
        lineItems: [{ product_id: null, custom_name: 'Custom', quantity: 10, price_at_sale: 0.5 }],
      },
    });
    const invoice = await created.json() as any;
    const line = db.sqlite.prepare('SELECT id FROM invoice_line_items WHERE invoice_id=?').get(invoice.id) as any;
    const linked = await call(db, '/api/rpc/link-line-item', {
      method: 'POST', userId: 'seller', body: { invoice_id: invoice.id, line_item_id: line.id, product_id: 'person-tea' },
    });
    expect(linked.status).toBe(403);
    expect(db.sqlite.prepare('SELECT product_id,stock_owner_user_id,sales_grant_id FROM invoice_line_items WHERE id=?').get(line.id))
      .toEqual({ product_id: null, stock_owner_user_id: null, sales_grant_id: null });
  });

  it('snapshots seller, stock owner and grant while Draft remains unreserved', async () => {
    const db = database(); seed(db); const grant = await (await createGrant(db)).json() as any;
    const created = await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody('Draft') });
    expect(created.status).toBe(201);
    const invoice = await created.json() as any;
    expect(db.sqlite.prepare('SELECT sold_by_user_id,payment_recipient_user_id FROM invoices WHERE id=?').get(invoice.id))
      .toEqual({ sold_by_user_id: 'seller', payment_recipient_user_id: 'stock-owner' });
    expect(db.sqlite.prepare('SELECT stock_owner_user_id,sales_grant_id FROM invoice_line_items WHERE invoice_id=?').get(invoice.id))
      .toEqual({ stock_owner_user_id: 'stock-owner', sales_grant_id: grant.id });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM stock_holds WHERE invoice_id=?').get(invoice.id)).toEqual({ count: 0 });
  });

  it('atomically rejects a Pending hold after other live holds consume availability', async () => {
    const db = database(); seed(db); await createGrant(db, { quantity_limit: 100 });
    const first = await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody('Pending', 70) });
    expect(first.status).toBe(201);
    const second = await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody('Pending', 40) });
    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ code: 'insufficient_available_stock' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices').get()).toEqual({ count: 1 });
  });

  it('preserves seller and owner snapshots while atomically splitting Pending holds', async () => {
    const db = database(); seed(db); await createGrant(db, { quantity_limit: 100 });
    const body = invoiceBody('Pending', 20);
    body.lineItems.push({ product_id: 'person-tea', quantity: 10, price_at_sale: 0.5 });
    const invoice = await (await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body })).json() as any;
    const lines = db.sqlite.prepare('SELECT id FROM invoice_line_items WHERE invoice_id=? ORDER BY id').all(invoice.id) as any[];
    const split = await call(db, '/api/rpc/split-invoice', {
      method: 'POST', userId: 'seller', body: { invoice_id: invoice.id, line_item_ids: [lines[0].id] },
    });
    expect(split.status).toBe(201);
    const result = await split.json() as any;
    expect(db.sqlite.prepare('SELECT sold_by_user_id,payment_recipient_user_id FROM invoices WHERE id=?').get(result.new_id))
      .toEqual({ sold_by_user_id: 'seller', payment_recipient_user_id: 'stock-owner' });
    expect(db.sqlite.prepare('SELECT held_grams FROM stock_holds WHERE invoice_id=?').get(invoice.id)).toBeTruthy();
    expect(db.sqlite.prepare('SELECT held_grams FROM stock_holds WHERE invoice_id=?').get(result.new_id)).toBeTruthy();
    expect(db.sqlite.prepare('SELECT SUM(held_grams) AS held FROM stock_holds WHERE invoice_id IN (?,?)').get(invoice.id, result.new_id))
      .toEqual({ held: 30 });
  });

  it('uses the snapshotted seller when another Sell editor replaces or links lines', async () => {
    const db = database(); seed(db); const grant = await (await createGrant(db, { quantity_limit: 100 })).json() as any;
    const created = await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody('Pending', 10) });
    const invoice = await created.json() as any;

    const replaced = await call(db, `/api/invoices/${invoice.id}/items`, {
      method: 'PUT', userId: 'other-seller', body: { lineItems: [
        { product_id: 'person-tea', quantity: 12, price_at_sale: 0.5 },
        { product_id: 'location-tea', quantity: 5, price_at_sale: 0.4 },
      ] },
    });
    expect(replaced.status).toBe(200);
    expect(db.sqlite.prepare('SELECT sold_by_user_id,payment_recipient_user_id FROM invoices WHERE id=?').get(invoice.id))
      .toEqual({ sold_by_user_id: 'seller', payment_recipient_user_id: null });
    expect(db.sqlite.prepare(`SELECT stock_owner_user_id,sales_grant_id FROM invoice_line_items
      WHERE invoice_id=? AND product_id='person-tea'`).get(invoice.id))
      .toEqual({ stock_owner_user_id: 'stock-owner', sales_grant_id: grant.id });

    const customCreated = await call(db, '/api/invoices', {
      method: 'POST', userId: 'seller', body: {
        invoice: { customer_name: 'Buyer', display_currency: 'USD', status: 'Draft' },
        lineItems: [{ product_id: null, custom_name: 'Custom', quantity: 8, price_at_sale: 0.5 }],
      },
    });
    const customInvoice = await customCreated.json() as any;
    const customLine = db.sqlite.prepare('SELECT id FROM invoice_line_items WHERE invoice_id=?').get(customInvoice.id) as any;
    const linked = await call(db, '/api/rpc/link-line-item', {
      method: 'POST', userId: 'other-seller', body: {
        invoice_id: customInvoice.id, line_item_id: customLine.id, product_id: 'person-tea',
      },
    });
    expect(linked.status).toBe(200);
    expect(db.sqlite.prepare('SELECT sold_by_user_id,payment_recipient_user_id FROM invoices WHERE id=?').get(customInvoice.id))
      .toEqual({ sold_by_user_id: 'seller', payment_recipient_user_id: 'stock-owner' });
    expect(db.sqlite.prepare('SELECT stock_owner_user_id,sales_grant_id FROM invoice_line_items WHERE id=?').get(customLine.id))
      .toEqual({ stock_owner_user_id: 'stock-owner', sales_grant_id: grant.id });
  });

  it('rejects invalid split IDs before writes and recalculates both payment recipients', async () => {
    const db = database(); seed(db); await createGrant(db, { quantity_limit: 100 });
    const body = invoiceBody('Pending', 10);
    body.lineItems.push(
      { product_id: 'person-tea', quantity: 5, price_at_sale: 0.5 },
      { product_id: 'location-tea', quantity: 7, price_at_sale: 0.4 },
    );
    const invoice = await (await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body })).json() as any;
    const lines = db.sqlite.prepare('SELECT id,product_id FROM invoice_line_items WHERE invoice_id=? ORDER BY id').all(invoice.id) as any[];
    const beforeSeq = db.sqlite.prepare(`SELECT invoice_seq FROM accounts WHERE id='account-a'`).get();
    const beforeLines = db.sqlite.prepare('SELECT id,invoice_id FROM invoice_line_items ORDER BY id').all();
    const beforeHolds = db.sqlite.prepare('SELECT invoice_id,product_id,held_grams FROM stock_holds ORDER BY product_id').all();

    const duplicate = await call(db, '/api/rpc/split-invoice', {
      method: 'POST', userId: 'seller', body: { invoice_id: invoice.id, line_item_ids: [lines[0].id, lines[0].id] },
    });
    expect(duplicate.status).toBe(400);
    const unknown = await call(db, '/api/rpc/split-invoice', {
      method: 'POST', userId: 'seller', body: { invoice_id: invoice.id, line_item_ids: ['unknown-line'] },
    });
    expect(unknown.status).toBe(400);
    expect(db.sqlite.prepare(`SELECT invoice_seq FROM accounts WHERE id='account-a'`).get()).toEqual(beforeSeq);
    expect(db.sqlite.prepare('SELECT id,invoice_id FROM invoice_line_items ORDER BY id').all()).toEqual(beforeLines);
    expect(db.sqlite.prepare('SELECT invoice_id,product_id,held_grams FROM stock_holds ORDER BY product_id').all()).toEqual(beforeHolds);

    const locationLine = lines.find(line => line.product_id === 'location-tea');
    const split = await call(db, '/api/rpc/split-invoice', {
      method: 'POST', userId: 'other-seller', body: { invoice_id: invoice.id, line_item_ids: [locationLine.id] },
    });
    expect(split.status).toBe(201);
    const result = await split.json() as any;
    expect(db.sqlite.prepare('SELECT sold_by_user_id,payment_recipient_user_id FROM invoices WHERE id=?').get(invoice.id))
      .toEqual({ sold_by_user_id: 'seller', payment_recipient_user_id: 'stock-owner' });
    expect(db.sqlite.prepare('SELECT sold_by_user_id,payment_recipient_user_id FROM invoices WHERE id=?').get(result.new_id))
      .toEqual({ sold_by_user_id: 'seller', payment_recipient_user_id: null });
  });

  it('deducts exact stock, releases its hold, creates settlement, then void restores and reverses', async () => {
    const db = database(); seed(db); const grant = await (await createGrant(db)).json() as any;
    const created = await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody('Pending', 20, 0.5) });
    const invoice = await created.json() as any;
    expect(db.sqlite.prepare('SELECT held_grams FROM stock_holds WHERE invoice_id=?').get(invoice.id)).toEqual({ held_grams: 20 });

    const fulfilled = await call(db, '/api/rpc/fulfill-invoice', { method: 'POST', userId: 'seller', body: { invoice_id: invoice.id } });
    expect(fulfilled.status).toBe(200);
    expect(db.sqlite.prepare(`SELECT stock_grams FROM products WHERE id='person-tea'`).get()).toEqual({ stock_grams: 80 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM stock_holds WHERE invoice_id=?').get(invoice.id)).toEqual({ count: 0 });
    expect(db.sqlite.prepare('SELECT stock_owner_user_id,seller_user_id,grant_id,gross_amount,owner_amount,seller_amount,status FROM sales_settlements WHERE invoice_id=?').get(invoice.id))
      .toEqual({ stock_owner_user_id: 'stock-owner', seller_user_id: 'seller', grant_id: grant.id, gross_amount: 10, owner_amount: 8, seller_amount: 2, status: 'owed' });

    expect((await call(db, '/api/rpc/void-invoice', { method: 'POST', userId: 'seller', body: { invoice_id: invoice.id } })).status).toBe(200);
    expect(db.sqlite.prepare(`SELECT stock_grams FROM products WHERE id='person-tea'`).get()).toEqual({ stock_grams: 100 });
    expect(db.sqlite.prepare('SELECT status,reversed_at FROM sales_settlements WHERE invoice_id=?').get(invoice.id))
      .toMatchObject({ status: 'reversed', reversed_at: expect.any(String) });
  });

  it('limits settlement reads to participants and owner-tier, and paid writes to owner-tier', async () => {
    const db = database(); seed(db); await createGrant(db);
    const invoice = await (await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody() })).json() as any;
    await call(db, '/api/rpc/fulfill-invoice', { method: 'POST', userId: 'seller', body: { invoice_id: invoice.id } });
    const settlement = db.sqlite.prepare('SELECT id FROM sales_settlements WHERE invoice_id=?').get(invoice.id) as any;

    expect((await (await call(db, '/api/sales/settlements?mine=1', { userId: 'seller' })).json() as any[]).length).toBe(1);
    expect((await (await call(db, '/api/sales/settlements?mine=1', { userId: 'other-seller' })).json() as any[]).length).toBe(0);
    expect((await call(db, `/api/sales/settlements/${settlement.id}`, { method: 'PUT', userId: 'seller', body: { status: 'paid' } })).status).toBe(403);
    expect((await call(db, `/api/sales/settlements/${settlement.id}`, { method: 'PUT', body: { status: 'paid' } })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT status FROM sales_settlements WHERE id=?').get(settlement.id)).toEqual({ status: 'paid' });
  });
});
