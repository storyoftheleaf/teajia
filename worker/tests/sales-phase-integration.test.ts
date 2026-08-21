import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'sales-phase-integration-secret';
const databases: SqliteD1[] = [];

function database() {
  const db = new SqliteD1();
  databases.push(db);
  return db;
}

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function authenticatedRequest(db: SqliteD1, path: string, options: {
  method?: string;
  body?: unknown;
  userId?: string;
  accountId?: string;
} = {}) {
  const userId = options.userId ?? 'account-owner';
  const accountId = options.accountId ?? 'account-a';
  const token = await signedToken(SECRET, {
    sub: userId,
    email: `${userId}@test.dev`,
    name: userId,
    active_account_id: accountId,
    platform_role: null,
  });
  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    'X-Teajia-Account': accountId,
  });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}

function seedSalesAccount(db: SqliteD1) {
  seedIdentity(db, { userId: 'account-owner', accountId: 'account-a', role: 'owner' });
  seedIdentity(db, { userId: 'stock-owner', accountId: 'account-a', role: 'staff', bundles: ['stock'] });
  seedIdentity(db, { userId: 'seller', accountId: 'account-a', role: 'staff', bundles: ['sell'] });
  db.sqlite.prepare(`INSERT INTO products
    (id, account_id, type, product_name, given_name, stock_grams, fixed_retail_price_usd, owner_user_id)
    VALUES ('person-tea','account-a','Oolong','Person Tea','Person Tea',100,0.5,'stock-owner')`).run();
}

async function createGrant(db: SqliteD1) {
  const response = await authenticatedRequest(db, '/api/sales/grants', {
    method: 'POST',
    body: {
      product_id: 'person-tea',
      seller_user_id: 'seller',
      price_floor: 0.4,
      owner_share_type: 'percent',
      owner_share_value: 80,
      quantity_limit: 50,
    },
  });
  expect(response.status).toBe(201);
  return response.json() as Promise<{ id: string }>;
}

function invoiceBody(status: 'Draft' | 'Pending', quantity = 20) {
  return {
    invoice: { customer_name: 'Buyer', display_currency: 'USD', status },
    lineItems: [{ product_id: 'person-tea', quantity, price_at_sale: 0.5 }],
  };
}

describe('sales phase integration boundary', () => {
  it('rejects a negative Tea Master invoice before any invoice write', async () => {
    const db = database();
    seedSalesAccount(db);

    const response = await authenticatedRequest(db, '/api/invoices', {
      method: 'POST',
      userId: 'seller',
      body: invoiceBody('Draft', -5),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_invoice' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices').get()).toEqual({ count: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM invoice_line_items').get()).toEqual({ count: 0 });
  });

  it('snapshots the authenticated seller, stock owner, and authorized grant', async () => {
    const db = database();
    seedSalesAccount(db);
    const grant = await createGrant(db);

    const response = await authenticatedRequest(db, '/api/invoices', {
      method: 'POST',
      userId: 'seller',
      body: invoiceBody('Draft'),
    });
    expect(response.status).toBe(201);
    const invoice = await response.json() as { id: string };

    expect(db.sqlite.prepare(
      'SELECT sold_by_user_id,payment_recipient_user_id FROM invoices WHERE id=?',
    ).get(invoice.id)).toEqual({
      sold_by_user_id: 'seller',
      payment_recipient_user_id: 'stock-owner',
    });
    expect(db.sqlite.prepare(
      'SELECT stock_owner_user_id,sales_grant_id FROM invoice_line_items WHERE invoice_id=?',
    ).get(invoice.id)).toEqual({
      stock_owner_user_id: 'stock-owner',
      sales_grant_id: grant.id,
    });
  });

  it('keeps one account-scoped stock hold when a pending invoice reservation is retried', async () => {
    const db = database();
    seedSalesAccount(db);
    await createGrant(db);
    const created = await authenticatedRequest(db, '/api/invoices', {
      method: 'POST',
      userId: 'seller',
      body: invoiceBody('Pending'),
    });
    expect(created.status).toBe(201);
    const invoice = await created.json() as { id: string };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const retried = await authenticatedRequest(db, `/api/invoices/${invoice.id}/items`, {
        method: 'PUT',
        userId: 'seller',
        body: { lineItems: invoiceBody('Pending').lineItems },
      });
      expect(retried.status).toBe(200);
    }

    expect(db.sqlite.prepare(
      'SELECT account_id,invoice_id,product_id,held_grams FROM stock_holds WHERE invoice_id=?',
    ).all(invoice.id)).toEqual([{
      account_id: 'account-a',
      invoice_id: invoice.id,
      product_id: 'person-tea',
      held_grams: 20,
    }]);
  });

  it('keeps public inquiry tracking private and redacted', async () => {
    const db = database();
    seedIdentity(db, {
      userId: 'store-owner', accountId: 'account-public', accountSlug: 'bali', role: 'owner', publicEnabled: true,
    });
    db.sqlite.prepare(`INSERT INTO products
      (id,account_id,type,product_name,given_name,stock_grams,fixed_retail_price_usd)
      VALUES ('public-tea','account-public','Oolong','Public Tea','Public Tea',100,0.5)`).run();
    const trackingToken = 'sales_phase_private_tracking_token_123456';
    const create = await worker.fetch(new Request('https://worker.test/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        store_slug: 'bali',
        tracking_token: trackingToken,
        ref_number: 'TJ-INTEGRATION-1',
        customer_name: 'Private Person',
        customer_contact: 'private@example.com',
        customer_location: 'Denpasar',
        currency: 'USD',
        total_estimate_usd: 12.5,
        items: [{
          id: 'public-tea', name: 'Public Tea', category: 'tea', storeSlug: 'bali',
          quantityGrams: 25, pricePerGram: 0.5, totalPrice: 12.5,
        }],
      }),
    }), { DB: db as any, JWT_SECRET: SECRET } as any);
    expect(create.status).toBe(201);

    const byHumanReference = await worker.fetch(
      new Request('https://worker.test/api/inquiries/TJ-INTEGRATION-1'),
      { DB: db as any, JWT_SECRET: SECRET } as any,
    );
    expect(byHumanReference.status).toBe(404);

    const tracked = await worker.fetch(
      new Request(`https://worker.test/api/inquiries/${trackingToken}`),
      { DB: db as any, JWT_SECRET: SECRET } as any,
    );
    expect(tracked.status).toBe(200);
    const body = await tracked.json() as Record<string, unknown>;
    expect(body).toMatchObject({ ref_number: 'TJ-INTEGRATION-1', currency: 'USD' });
    expect(body).not.toHaveProperty('name');
    expect(body).not.toHaveProperty('email');
    expect(body).not.toHaveProperty('phone');
    expect(JSON.stringify(body)).not.toContain('Private Person');
    expect(JSON.stringify(body)).not.toContain('private@example.com');
    expect(JSON.stringify(body)).not.toContain('Denpasar');
  });
});
