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

async function call(db: any, path: string, options: {
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

class FulfillmentRaceDb {
  private injected = false;

  constructor(readonly inner: SqliteD1) {}

  prepare(sql: string) {
    const inner = this.inner.prepare(sql);
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    const statement = {
      inner,
      bind: (...values: unknown[]) => { inner.bind(...values); return statement; },
      first: async () => {
        const result = inner.first();
        if (!this.injected && result && normalized.startsWith('update invoices set fulfillment_claim_token = ?')) {
          this.injected = true;
          this.inner.sqlite.prepare(`INSERT INTO stock_holds
            (id,account_id,invoice_id,product_id,held_grams,expires_at)
            VALUES ('racing-hold','account-a','racing-invoice','person-tea',30,datetime('now','+1 day'))`).run();
        }
        return result;
      },
      all: async () => inner.all(),
      run: async () => inner.run(),
    };
    return statement;
  }

  async batch(statements: any[]) {
    return this.inner.batch(statements.map(statement => statement.inner) as any);
  }
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

function seedEvent(db: SqliteD1, productId: string) {
  db.sqlite.exec(`
    CREATE TABLE events (id TEXT PRIMARY KEY, account_id TEXT NOT NULL, status TEXT, updated_at TEXT);
    CREATE TABLE event_tea_menu (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, product_id TEXT, brew_order INTEGER);
    CREATE TABLE event_attendees (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, full_name TEXT, phone_number TEXT, email TEXT, customer_id TEXT, attended INTEGER);
  `);
  db.sqlite.prepare(`INSERT INTO events(id,account_id,status) VALUES ('event-a','account-a','active')`).run();
  db.sqlite.prepare(`INSERT INTO event_tea_menu(id,event_id,product_id,brew_order) VALUES ('menu-a','event-a',?,1)`).run(productId);
  db.sqlite.prepare(`INSERT INTO event_attendees(id,event_id,full_name,phone_number,attended) VALUES ('attendee-a','event-a','Guest','123',1)`).run();
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

  it('atomically retires the previous effective grant and exposes one deterministic winner', async () => {
    const db = database(); seed(db);
    const first = await (await createGrant(db, { owner_share_value: 80 })).json() as any;
    const second = await (await createGrant(db, { owner_share_value: 60 })).json() as any;
    expect(db.sqlite.prepare(`SELECT id FROM sales_grants
      WHERE account_id='account-a' AND product_id='person-tea' AND seller_user_id='seller' AND revoked_at IS NULL
        AND (starts_at IS NULL OR starts_at<=datetime('now')) AND (expires_at IS NULL OR expires_at>datetime('now'))`).all())
      .toEqual([{ id: second.id }]);
    expect(db.sqlite.prepare('SELECT revoked_at FROM sales_grants WHERE id=?').get(first.id)).toMatchObject({ revoked_at: expect.any(String) });
    const eligible = await (await call(db, '/api/sales/eligible-products', { userId: 'seller' })).json() as any[];
    expect(eligible.filter(row => row.product_id === 'person-tea')).toEqual([
      expect.objectContaining({ grant_id: second.id, permission_reason: 'active_grant' }),
    ]);
  });

  it('returns only operational labels for products the actor may sell', async () => {
    const db = database(); seed(db); await createGrant(db);
    db.sqlite.prepare(`INSERT INTO products
      (id,account_id,type,product_name,given_name,status,stock_grams,fixed_retail_price_usd,owner_user_id)
      VALUES
      ('teaware','account-a','Teaware','Tea Tray','Tea Tray','Active',0,20,NULL),
      ('misc','account-a','Misc','Misc Item','Misc Item','Active',10,2,NULL),
      ('missing-type','account-a','MISSING_TYPE','Missing Type','Missing Type','Active',10,0.4,NULL),
      ('empty-type','account-a','','Empty Type','Empty Type','Active',10,0.4,NULL),
      ('draft-tea','account-a','Oolong','Draft Tea','Draft Tea','Draft',40,0.4,NULL),
      ('archived-tea','account-a','Oolong','Archived Tea','Archived Tea','Archived',40,0.4,NULL)`).run();
    db.sqlite.prepare(`INSERT INTO stock_holds(id,account_id,invoice_id,product_id,held_grams,expires_at)
      VALUES ('hold-a','account-a','other-order','person-tea',25,datetime('now','+1 day'))`).run();
    const response = await call(db, '/api/sales/eligible-products', { userId: 'seller' });
    expect(response.status).toBe(200);
    const rows = await response.json() as any[];
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ product_id: 'person-tea', owner_id: 'stock-owner', physical_quantity: 100, held_quantity: 25, available_quantity: 75, permission_reason: 'active_grant' }),
      expect.objectContaining({ product_id: 'location-tea', owner_id: null, permission_reason: 'location_stock' }),
    ]));
    const productIds = rows.map(row => row.product_id);
    for (const excludedId of ['teaware', 'misc', 'missing-type', 'empty-type', 'draft-tea', 'archived-tea']) {
      expect(productIds).not.toContain(excludedId);
    }
    expect(JSON.stringify(rows)).not.toContain('@test.dev');
  });
});

describe('Tea Master invoice authorization, holds and settlements', () => {
  it.each([
    ['Draft', 'Oolong'],
    ['Archived', 'Oolong'],
    ['Active', 'Teaware'],
    ['Active', 'Misc'],
    ['Active', 'MISSING_TYPE'],
    ['Active', ''],
  ])('rejects a new linked %s %s product without partial writes', async (status, type) => {
    const db = database(); seed(db);
    db.sqlite.prepare(`INSERT INTO products
      (id,account_id,type,product_name,given_name,status,stock_grams,fixed_retail_price_usd,owner_user_id)
      VALUES ('ineligible','account-a',?,'Ineligible','Ineligible',?,20,0.5,NULL)`).run(type, status);

    const response = await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: {
      invoice: { customer_name: 'Buyer', display_currency: 'USD', status: 'Pending' },
      lineItems: [{ product_id: 'ineligible', quantity: 5, price_at_sale: 0.5 }],
    } });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'product_not_sale_eligible' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices').get()).toEqual({ count: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoice_line_items').get()).toEqual({ count: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM stock_holds').get()).toEqual({ count: 0 });
  });

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

  it('fails closed without partial writes when the snapshotted seller is inactive or loses Sell', async () => {
    const db = database(); seed(db); await createGrant(db, { quantity_limit: 100 });
    const created = await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody('Pending', 10) });
    const invoice = await created.json() as any;
    const beforeLines = db.sqlite.prepare('SELECT * FROM invoice_line_items WHERE invoice_id=?').all(invoice.id);
    const beforeHolds = db.sqlite.prepare('SELECT * FROM stock_holds WHERE invoice_id=?').all(invoice.id);
    db.sqlite.prepare(`UPDATE account_members SET status='inactive' WHERE account_id='account-a' AND user_id='seller'`).run();

    const replaced = await call(db, `/api/invoices/${invoice.id}/items`, {
      method: 'PUT', userId: 'other-seller', body: { lineItems: [{ product_id: 'person-tea', quantity: 12, price_at_sale: 0.5 }] },
    });
    expect(replaced.status).toBe(403);
    expect(db.sqlite.prepare('SELECT * FROM invoice_line_items WHERE invoice_id=?').all(invoice.id)).toEqual(beforeLines);
    expect(db.sqlite.prepare('SELECT * FROM stock_holds WHERE invoice_id=?').all(invoice.id)).toEqual(beforeHolds);

    db.sqlite.prepare(`UPDATE account_members SET status='active',permissions='{"bundles":[]}' WHERE account_id='account-a' AND user_id='seller'`).run();
    const customCreated = await call(db, '/api/invoices', {
      method: 'POST', userId: 'account-owner', body: {
        invoice: { customer_name: 'Buyer', display_currency: 'USD', status: 'Draft' },
        lineItems: [{ product_id: null, custom_name: 'Custom', quantity: 8, price_at_sale: 0.5 }],
      },
    });
    const customInvoice = await customCreated.json() as any;
    db.sqlite.prepare(`UPDATE invoices SET sold_by_user_id='seller' WHERE id=?`).run(customInvoice.id);
    const customLine = db.sqlite.prepare('SELECT id FROM invoice_line_items WHERE invoice_id=?').get(customInvoice.id) as any;
    const linked = await call(db, '/api/rpc/link-line-item', {
      method: 'POST', userId: 'other-seller', body: { invoice_id: customInvoice.id, line_item_id: customLine.id, product_id: 'person-tea' },
    });
    expect(linked.status).toBe(403);
    expect(db.sqlite.prepare('SELECT product_id,stock_owner_user_id,sales_grant_id FROM invoice_line_items WHERE id=?').get(customLine.id))
      .toEqual({ product_id: null, stock_owner_user_id: null, sales_grant_id: null });
  });

  it('rejects split when the snapshotted seller is now an inactive former owner', async () => {
    const db = database(); seed(db);
    const created = await call(db, '/api/invoices', { method: 'POST', body: {
      invoice: { customer_name: 'Buyer', display_currency: 'USD', status: 'Pending' },
      lineItems: [
        { product_id: 'location-tea', quantity: 10, price_at_sale: 0.4 },
        { product_id: 'location-tea', quantity: 5, price_at_sale: 0.4 },
      ],
    } });
    const invoice = await created.json() as any;
    const activeOwnerEdit = await call(db, `/api/invoices/${invoice.id}/items`, {
      method: 'PUT', userId: 'other-seller', body: { lineItems: [
        { product_id: 'location-tea', quantity: 9, price_at_sale: 0.4 },
        { product_id: 'location-tea', quantity: 6, price_at_sale: 0.4 },
      ] },
    });
    expect(activeOwnerEdit.status).toBe(200);
    const line = db.sqlite.prepare('SELECT id FROM invoice_line_items WHERE invoice_id=? LIMIT 1').get(invoice.id) as any;
    const beforeSeq = db.sqlite.prepare(`SELECT invoice_seq FROM accounts WHERE id='account-a'`).get();
    const beforeHolds = db.sqlite.prepare('SELECT * FROM stock_holds WHERE invoice_id=?').all(invoice.id);
    db.sqlite.prepare(`UPDATE account_members SET role='staff',status='inactive' WHERE account_id='account-a' AND user_id='account-owner'`).run();

    const split = await call(db, '/api/rpc/split-invoice', {
      method: 'POST', userId: 'other-seller', body: { invoice_id: invoice.id, line_item_ids: [line.id] },
    });
    expect(split.status).toBe(403);
    expect(db.sqlite.prepare(`SELECT invoice_seq FROM accounts WHERE id='account-a'`).get()).toEqual(beforeSeq);
    expect(db.sqlite.prepare('SELECT * FROM stock_holds WHERE invoice_id=?').all(invoice.id)).toEqual(beforeHolds);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices').get()).toEqual({ count: 1 });
  });

  it.each(['platform_owner', 'platform_admin'] as const)('allows a snapshotted %s without an account membership', async (platformRole) => {
    const db = database(); seed(db);
    seedIdentity(db, { userId: `platform-${platformRole}`, accountId: 'account-a', role: 'owner', platformRole });
    db.sqlite.prepare(`DELETE FROM account_members WHERE account_id='account-a' AND user_id=?`).run(`platform-${platformRole}`);
    const body = {
      invoice: { customer_name: 'Buyer', display_currency: 'USD', status: 'Pending' },
      lineItems: [
        { product_id: 'person-tea', quantity: 10, price_at_sale: 0.5 },
        { product_id: 'person-tea', quantity: 5, price_at_sale: 0.5 },
      ],
    };
    const created = await call(db, '/api/invoices', { method: 'POST', userId: `platform-${platformRole}`, body });
    expect(created.status).toBe(201);
    const invoice = await created.json() as any;
    const line = db.sqlite.prepare('SELECT id FROM invoice_line_items WHERE invoice_id=? LIMIT 1').get(invoice.id) as any;
    const split = await call(db, '/api/rpc/split-invoice', {
      method: 'POST', userId: 'other-seller', body: { invoice_id: invoice.id, line_item_ids: [line.id] },
    });
    expect(split.status).toBe(201);
    const result = await split.json() as any;
    expect(db.sqlite.prepare('SELECT sold_by_user_id FROM invoices WHERE id IN (?,?) ORDER BY id').all(invoice.id, result.new_id))
      .toEqual([{ sold_by_user_id: `platform-${platformRole}` }, { sold_by_user_id: `platform-${platformRole}` }]);
  });

  it.each(['revoked', 'expired'] as const)('splits stored grant snapshots after the grant is %s while blocking new sales', async (state) => {
    const db = database(); seed(db); const grant = await (await createGrant(db, { quantity_limit: 100 })).json() as any;
    const body = invoiceBody('Pending', 20);
    body.lineItems.push({ product_id: 'person-tea', quantity: 10, price_at_sale: 0.5 });
    const invoice = await (await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body })).json() as any;
    const lines = db.sqlite.prepare('SELECT id FROM invoice_line_items WHERE invoice_id=? ORDER BY id').all(invoice.id) as any[];
    if (state === 'revoked') {
      await call(db, `/api/sales/grants/${grant.id}`, { method: 'DELETE' });
    } else {
      db.sqlite.prepare(`UPDATE sales_grants SET expires_at=datetime('now','-1 minute') WHERE id=?`).run(grant.id);
    }

    const split = await call(db, '/api/rpc/split-invoice', {
      method: 'POST', userId: 'other-seller', body: { invoice_id: invoice.id, line_item_ids: [lines[0].id] },
    });
    expect(split.status).toBe(201);
    const result = await split.json() as any;
    expect(db.sqlite.prepare(`SELECT i.sold_by_user_id,i.payment_recipient_user_id,l.stock_owner_user_id,l.sales_grant_id
      FROM invoices i JOIN invoice_line_items l ON l.invoice_id=i.id WHERE i.id IN (?,?) ORDER BY i.id`).all(invoice.id, result.new_id))
      .toEqual([
        { sold_by_user_id: 'seller', payment_recipient_user_id: 'stock-owner', stock_owner_user_id: 'stock-owner', sales_grant_id: grant.id },
        { sold_by_user_id: 'seller', payment_recipient_user_id: 'stock-owner', stock_owner_user_id: 'stock-owner', sales_grant_id: grant.id },
      ]);
    expect(db.sqlite.prepare('SELECT SUM(held_grams) AS held FROM stock_holds WHERE invoice_id IN (?,?)').get(invoice.id, result.new_id))
      .toEqual({ held: 30 });
    expect((await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody('Pending', 5) })).status).toBe(403);
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

  it('fulfills an already authorized snapshot after its product is archived', async () => {
    const db = database(); seed(db); await createGrant(db);
    const invoice = await (await call(db, '/api/invoices', {
      method: 'POST', userId: 'seller', body: invoiceBody('Pending', 20, 0.5),
    })).json() as any;
    db.sqlite.prepare(`UPDATE products SET status='Archived' WHERE id='person-tea'`).run();

    const fulfilled = await call(db, '/api/rpc/fulfill-invoice', {
      method: 'POST', userId: 'other-seller', body: { invoice_id: invoice.id },
    });

    expect(fulfilled.status).toBe(200);
    expect(db.sqlite.prepare(`SELECT status,inventory_deducted FROM invoices WHERE id=?`).get(invoice.id))
      .toEqual({ status: 'Filled', inventory_deducted: 1 });
  });

  it('settles from immutable line economics and aggregates duplicate product stock movements', async () => {
    const db = database(); seed(db); const grant = await (await createGrant(db, { quantity_limit: 100, owner_share_value: 80 })).json() as any;
    const body = invoiceBody('Pending', 40, 0.5);
    body.lineItems.push({ product_id: 'person-tea', quantity: 40, price_at_sale: 0.5 });
    const invoice = await (await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body })).json() as any;
    expect(db.sqlite.prepare(`SELECT owner_share_type,owner_share_value FROM invoice_line_items WHERE invoice_id=? ORDER BY id`).all(invoice.id))
      .toEqual([{ owner_share_type: 'percent', owner_share_value: 80 }, { owner_share_type: 'percent', owner_share_value: 80 }]);
    await call(db, `/api/sales/grants/${grant.id}`, { method: 'PUT', body: { owner_share_value: 50 } });

    const fulfilled = await call(db, '/api/rpc/fulfill-invoice', { method: 'POST', userId: 'other-seller', body: { invoice_id: invoice.id } });
    expect(fulfilled.status).toBe(200);
    expect(db.sqlite.prepare(`SELECT stock_grams FROM products WHERE id='person-tea'`).get()).toEqual({ stock_grams: 20 });
    expect(db.sqlite.prepare(`SELECT delta,balance_after FROM stock_ledger WHERE source_invoice_id=?`).all(invoice.id))
      .toEqual([{ delta: -80, balance_after: 20 }]);
    expect(db.sqlite.prepare(`SELECT owner_amount,seller_amount,grant_id FROM sales_settlements WHERE invoice_id=? ORDER BY line_item_id`).all(invoice.id))
      .toEqual([
        { owner_amount: 16, seller_amount: 4, grant_id: grant.id },
        { owner_amount: 16, seller_amount: 4, grant_id: grant.id },
      ]);
  });

  it('atomically rejects a fulfillment when another hold arrives after its availability read', async () => {
    const db = database(); seed(db); await createGrant(db, { quantity_limit: 100 });
    const body = invoiceBody('Pending', 40, 0.5);
    body.lineItems.push({ product_id: 'person-tea', quantity: 40, price_at_sale: 0.5 });
    const invoice = await (await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body })).json() as any;

    const fulfilled = await call(new FulfillmentRaceDb(db), '/api/rpc/fulfill-invoice', {
      method: 'POST', userId: 'other-seller', body: { invoice_id: invoice.id },
    });
    expect(fulfilled.status).toBe(409);
    expect(db.sqlite.prepare(`SELECT stock_grams FROM products WHERE id='person-tea'`).get()).toEqual({ stock_grams: 100 });
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM stock_ledger WHERE source_invoice_id=?`).get(invoice.id)).toEqual({ count: 0 });
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS count FROM sales_settlements WHERE invoice_id=?`).get(invoice.id)).toEqual({ count: 0 });
    expect(db.sqlite.prepare(`SELECT status,inventory_deducted,fulfillment_claim_token FROM invoices WHERE id=?`).get(invoice.id))
      .toEqual({ status: 'Pending', inventory_deducted: 0, fulfillment_claim_token: null });
  });

  it('limits settlement reads to participants and owner-tier, and paid writes to owner-tier', async () => {
    const db = database(); seed(db); await createGrant(db);
    const invoice = await (await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody() })).json() as any;
    await call(db, '/api/rpc/fulfill-invoice', { method: 'POST', userId: 'seller', body: { invoice_id: invoice.id } });
    const settlement = db.sqlite.prepare('SELECT id FROM sales_settlements WHERE invoice_id=?').get(invoice.id) as any;

    const sellerSettlements = await (await call(db, '/api/sales/settlements?mine=1', { userId: 'seller' })).json() as any[];
    expect(sellerSettlements).toHaveLength(1);
    expect(sellerSettlements[0]).toMatchObject({ invoice_id: invoice.id, invoice_number: invoice.invoice_number });
    expect((await (await call(db, '/api/sales/settlements?mine=1', { userId: 'other-seller' })).json() as any[]).length).toBe(0);
    expect((await call(db, `/api/sales/settlements/${settlement.id}`, { method: 'PUT', userId: 'seller', body: { status: 'paid' } })).status).toBe(403);
    expect((await call(db, `/api/sales/settlements/${settlement.id}`, { method: 'PUT', body: { status: 'paid' } })).status).toBe(200);
    expect(db.sqlite.prepare('SELECT status FROM sales_settlements WHERE id=?').get(settlement.id)).toEqual({ status: 'paid' });
  });

  it('returns safe order attribution names and settlement status to owner-tier', async () => {
    const db = database(); seed(db); await createGrant(db);
    db.sqlite.prepare("UPDATE users SET name='Rayi' WHERE id='seller'").run();
    db.sqlite.prepare("UPDATE users SET name='Barry' WHERE id='stock-owner'").run();
    db.sqlite.prepare("UPDATE users SET name='Adrian' WHERE id='other-seller'").run();
    const invoice = await (await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody() })).json() as any;
    await call(db, '/api/rpc/fulfill-invoice', { method: 'POST', userId: 'other-seller', body: { invoice_id: invoice.id } });

    const response = await call(db, `/api/invoices/${invoice.id}/attribution`);
    expect(response.status).toBe(200);
    const detail = await response.json() as any;
    expect(detail).toMatchObject({
      invoice_id: invoice.id,
      seller_name: 'Rayi',
      payment_recipient_name: 'Barry',
      fulfilled_by_name: 'Adrian',
      settlement_visibility: 'full',
    });
    expect(detail.items).toEqual([
      expect.objectContaining({ stock_owner_name: 'Barry', settlement_status: 'owed' }),
    ]);
    expect(JSON.stringify(detail)).not.toContain('@test.dev');
  });

  it('keeps settlement status private from non-participant staff while preserving operational names', async () => {
    const db = database(); seed(db); await createGrant(db);
    const invoice = await (await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody() })).json() as any;
    await call(db, '/api/rpc/fulfill-invoice', { method: 'POST', userId: 'seller', body: { invoice_id: invoice.id } });

    const response = await call(db, `/api/invoices/${invoice.id}/attribution`, { userId: 'other-seller' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      seller_name: 'seller',
      payment_recipient_name: 'stock-owner',
      fulfilled_by_name: null,
      settlement_visibility: 'restricted',
      items: [expect.objectContaining({ stock_owner_name: 'stock-owner', settlement_status: null })],
    });
  });

  it('lets a non-owner participant see only their authorized settlement status', async () => {
    const db = database(); seed(db); await createGrant(db);
    const invoice = await (await call(db, '/api/invoices', { method: 'POST', userId: 'seller', body: invoiceBody() })).json() as any;
    await call(db, '/api/rpc/fulfill-invoice', { method: 'POST', userId: 'seller', body: { invoice_id: invoice.id } });

    const response = await call(db, `/api/invoices/${invoice.id}/attribution`, { userId: 'stock-owner' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      settlement_visibility: 'participant',
      items: [expect.objectContaining({ stock_owner_name: 'stock-owner', settlement_status: 'owed' })],
    });
  });
});

describe('Tea Master event completion invoice authorization', () => {
  it.each(['empty menu', 'no attended guests', 'no new invoices'] as const)(
    'allows a Gather-only user to complete with %s', async (branch) => {
      const db = database(); seed(db);
      seedIdentity(db, { userId: 'gatherer', accountId: 'account-a', role: 'staff', bundles: ['gather'] });
      seedEvent(db, 'location-tea');
      if (branch === 'empty menu') {
        db.sqlite.prepare(`DELETE FROM event_tea_menu WHERE event_id='event-a'`).run();
      } else if (branch === 'no attended guests') {
        db.sqlite.prepare(`UPDATE event_attendees SET attended=0 WHERE event_id='event-a'`).run();
      } else {
        db.sqlite.prepare(`INSERT INTO invoices
          (id,account_id,invoice_number,customer_name,display_currency,status,inventory_deducted,payment_status,source_event_id)
          VALUES ('existing-event-invoice','account-a','EVENT-EXISTING','Guest','TWD','Draft',0,'unpaid','event-a')`).run();
      }
      const beforeInvoices = db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices').get();

      const response = await call(db, '/api/admin/events/event-a/complete', { method: 'POST', userId: 'gatherer' });

      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: 'completed', invoices_created: 0 });
      expect(db.sqlite.prepare(`SELECT status FROM events WHERE id='event-a'`).get()).toEqual({ status: 'completed' });
      expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices').get()).toEqual(beforeInvoices);
    },
  );

  it.each([
    ['Active', 'Teaware'],
    ['Active', 'Misc'],
    ['Draft', 'Oolong'],
  ])('rejects a linked %s %s event product without completing or writing invoices', async (status, type) => {
    const db = database(); seed(db);
    db.sqlite.prepare(`INSERT INTO products
      (id,account_id,type,product_name,given_name,status,stock_grams,fixed_retail_price_usd,owner_user_id)
      VALUES ('event-product','account-a',?,'Event Product','Event Product',?,20,0.5,NULL)`).run(type, status);
    seedEvent(db, 'event-product');

    const response = await call(db, '/api/admin/events/event-a/complete', { method: 'POST' });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'product_not_sale_eligible' });
    expect(db.sqlite.prepare(`SELECT status FROM events WHERE id='event-a'`).get()).toEqual({ status: 'active' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices').get()).toEqual({ count: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoice_line_items').get()).toEqual({ count: 0 });
  });

  it('requires Sell access before event completion can create linked invoices', async () => {
    const db = database(); seed(db);
    seedIdentity(db, { userId: 'gatherer', accountId: 'account-a', role: 'staff', bundles: ['gather'] });
    seedEvent(db, 'location-tea');

    const response = await call(db, '/api/admin/events/event-a/complete', { method: 'POST', userId: 'gatherer' });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'insufficient_bundle', details: { required_bundle: 'sell' } });
    expect(db.sqlite.prepare(`SELECT status FROM events WHERE id='event-a'`).get()).toEqual({ status: 'active' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices').get()).toEqual({ count: 0 });
  });

  it('snapshots the authenticated seller and authorized grant terms on event invoices', async () => {
    const db = database(); seed(db);
    db.sqlite.prepare(`UPDATE account_members SET permissions='{"bundles":["gather","sell"]}'
      WHERE account_id='account-a' AND user_id='seller'`).run();
    const grant = await (await createGrant(db, { price_floor: null, owner_share_value: 80 })).json() as any;
    seedEvent(db, 'person-tea');

    const response = await call(db, '/api/admin/events/event-a/complete', { method: 'POST', userId: 'seller' });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'completed', invoices_created: 1 });
    expect(db.sqlite.prepare(`SELECT status FROM events WHERE id='event-a'`).get()).toEqual({ status: 'completed' });
    expect(db.sqlite.prepare('SELECT sold_by_user_id,payment_recipient_user_id FROM invoices').get())
      .toEqual({ sold_by_user_id: 'seller', payment_recipient_user_id: 'stock-owner' });
    expect(db.sqlite.prepare(`SELECT product_id,custom_name,stock_owner_user_id,sales_grant_id,owner_share_type,owner_share_value
      FROM invoice_line_items`).get()).toEqual({
      product_id: 'person-tea', custom_name: null, stock_owner_user_id: 'stock-owner',
      sales_grant_id: grant.id, owner_share_type: 'percent', owner_share_value: 80,
    });
  });
});

describe('Tea Master public draft acceptance', () => {
  it('reauthorizes a public linked tea and snapshots the accepting seller atomically', async () => {
    const db = database(); seed(db);
    const grant = await (await createGrant(db)).json() as any;
    db.sqlite.prepare(`INSERT INTO invoices
      (id,account_id,invoice_number,customer_name,display_currency,status,inventory_deducted,payment_status)
      VALUES ('public-draft','account-a','PUBLIC-1','Recipient','USD','Draft',0,'unpaid')`).run();
    db.sqlite.prepare(`INSERT INTO invoice_line_items
      (id,account_id,invoice_id,product_id,custom_name,quantity,price_at_sale)
      VALUES ('public-line','account-a','public-draft','person-tea',NULL,10,0.5)`).run();

    const response = await call(db, '/api/invoices/public-draft', {
      method: 'PUT', userId: 'seller', body: { status: 'Pending' },
    });

    expect(response.status).toBe(200);
    expect(db.sqlite.prepare(`SELECT status,sold_by_user_id,payment_recipient_user_id FROM invoices WHERE id='public-draft'`).get())
      .toEqual({ status: 'Pending', sold_by_user_id: 'seller', payment_recipient_user_id: 'stock-owner' });
    expect(db.sqlite.prepare(`SELECT stock_owner_user_id,sales_grant_id,owner_share_type,owner_share_value
      FROM invoice_line_items WHERE id='public-line'`).get()).toEqual({
      stock_owner_user_id: 'stock-owner', sales_grant_id: grant.id,
      owner_share_type: 'percent', owner_share_value: 80,
    });
    expect(db.sqlite.prepare(`SELECT held_grams FROM stock_holds WHERE invoice_id='public-draft'`).get())
      .toEqual({ held_grams: 10 });
  });
});
