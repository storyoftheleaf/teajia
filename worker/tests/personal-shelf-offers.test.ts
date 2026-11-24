import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-offer-test-secret';
const dbs: SqliteD1[] = [];
afterEach(() => { while (dbs.length) dbs.pop()!.close(); });

function database() {
  const db = new SqliteD1('migrations');
  dbs.push(db);
  seedIdentity(db, { userId: 'seller', accountId: 'seller-account' });
  seedIdentity(db, { userId: 'other', accountId: 'other-account' });
  db.sqlite.prepare("UPDATE users SET shelf_enabled=1, shelf_slug='seller-tea', shelf_whatsapp='628123456789' WHERE id='seller'").run();
  db.sqlite.prepare(`INSERT INTO personal_cellar_items
    (id, owner_user_id, name, type, year, origin, notes, grams, image_url, shelf_published, chest_cost_amount, chest_cost_currency)
    VALUES ('holding', 'seller', 'Private supplier name', 'Oolong', 2020, 'Private source',
      'Secret sourcing note', 150, 'https://private.example/original.jpg', 0, 9, 'AUD')`).run();
  return db;
}

async function call(db: SqliteD1, path: string, method = 'GET', body?: unknown, user = 'seller', accountId = `${user}-account`) {
  const token = await signedToken(SECRET, { sub: user, email: `${user}@test.dev`, name: user,
    active_account_id: accountId, platform_role: null });
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), { DB: db as any, JWT_SECRET: SECRET } as any);
}
const offer = { name: 'Mountain Oolong', grams: 50, type: 'Oolong', year: 2021, origin: 'Taiwan', price_amount: 25, price_currency: 'USD' };
const publish = (db: SqliteD1, body: unknown = offer, user = 'seller') =>
  call(db, '/api/me/cellar/holding/publish-shelf', 'POST', body, user);
const publicRead = (db: SqliteD1, path: string) => worker.fetch(
  new Request(`https://worker.test${path}`), { DB: db as any } as any,
);
const publicShelf = async (db: SqliteD1) => (await publicRead(db, '/api/shelf/seller-tea')).json() as Promise<any>;
const holding = (db: SqliteD1) => db.sqlite.prepare("SELECT * FROM personal_cellar_items WHERE id='holding'").get() as any;

describe('a personal Tea Chest using Stock and Sales', () => {
  it('provisions one private account for the authenticated person and keeps it separate from the main Shop', async () => {
    const db = database();
    const path = '/api/me/tea-chest/account';
    expect(await (await call(db, path)).json()).toEqual({ account: null });
    const [first, retry] = await Promise.all([call(db, path, 'POST'), call(db, path, 'POST')]);
    expect(first.status).toBe(200);
    const { account } = await first.json() as { account: { id: string; slug: string } };
    expect(await retry.json()).toEqual({ account });
    expect(account.id).not.toBe('seller-account');
    expect(await (await call(db, path, 'GET', undefined, 'other')).json()).toEqual({ account: null });
    expect((await publicRead(db, `/api/s/${account.slug}/products`)).status).toBe(404);
    expect((await call(db, '/api/accounts/switch', 'POST', { account_id: account.id }, 'other')).status).toBe(403);
    const switched = await call(db, '/api/accounts/switch', 'POST', { account_id: account.id });
    expect(switched.status).toBe(200);
    expect(await switched.json()).toMatchObject({ active_account_id: account.id });
    expect(db.sqlite.prepare('SELECT owner_user_id, public_enabled FROM accounts WHERE id=?').get(account.id))
      .toEqual({ owner_user_id: 'seller', public_enabled: 0 });
  });

  it('connects an opened personal store to the main checkout under the seller’s account', async () => {
    const db = database();
    seedIdentity(db, { userId: 'main-owner', accountId: 'acc_teajia_bali', accountSlug: 'teajia-bali' });
    db.sqlite.prepare(`INSERT INTO products(id,account_id,type,product_name,status,is_public,shown_in_shop,
      stock_grams,cost_amount,cost_currency,fixed_retail_price_usd)
      VALUES ('main-tea','acc_teajia_bali','Oolong','Main Shop tea','Active',1,1,30,1,'USD',0.5)`).run();
    const { account } = await (await call(db, '/api/me/tea-chest/account', 'POST')).json() as {
      account: { id: string; slug: string };
    };
    const scoped = (path: string, method: string, body?: unknown) =>
      call(db, path, method, body, 'seller', account.id);
    expect((await scoped(`/api/accounts/${account.id}`, 'PUT', { public_enabled: true })).status).toBe(409);
    db.sqlite.prepare(`INSERT INTO contributors(id,account_id,user_id,display_name,is_published)
      VALUES ('seller-public',?,'seller','Seller',1)`).run(account.id);
    db.sqlite.prepare(`INSERT INTO payment_methods(id,contributor_id,method_type,label,recipient_name,account_identifier,is_published)
      VALUES ('seller-bank','seller-public','bank_transfer','Bank transfer','Seller','Synthetic reference',1)`).run();
    const tee = await scoped('/api/products', 'POST', {
      product_name: 'Personal Spring oolong', type: 'Oolong', stock_grams: 150,
      cost_amount: 9, cost_currency: 'USD', fixed_retail_price_usd: 0.5,
      status: 'Active', is_public: 1, shown_in_shop: 1, owner_user_id: 'seller',
    });
    expect(tee.status).toBe(201);
    const { id: productId } = await tee.json() as { id: string };
    expect((await scoped(`/api/accounts/${account.id}`, 'PUT', { public_enabled: true })).status).toBe(200);
    expect(await publicShelf(db)).toMatchObject({ store_slug: account.slug, items: [], whatsapp: null });
    expect(await (await publicRead(db, '/api/people/seller-public')).json()).toMatchObject({ personal_store_slug: account.slug });
    const publicProducts = await publicRead(db, `/api/s/${account.slug}/products`);
    expect(publicProducts.status).toBe(200);
    expect(await publicProducts.json()).toMatchObject([{ id: productId, stock_grams: 150 }]);
    const mainProducts = await publicRead(db, '/api/products/public');
    const mainCatalog = await mainProducts.json() as Array<{ id: string }>;
    expect(mainCatalog.map(item => item.id)).toEqual(['main-tea']);

    const request = new Request('https://worker.test/api/inquiries', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'website', store_slug: account.slug, tracking_token: 'synthetic-personal-shop-order-000000000001',
        ref_number: 'TJ-WEB-PERSONAL-1', customer_name: 'Buyer', customer_contact: 'buyer@example.test',
        customer_location: 'Tokyo, Japan', currency: 'USD', total_estimate_usd: 1,
        items: [{ id: productId, name: 'Personal Spring oolong', category: 'tea',
          storeSlug: account.slug, quantityGrams: 50, packGrams: 25, packs: 2, pricePerGram: 0.02, totalPrice: 1 }],
      }),
    });
    const checkout = await worker.fetch(request, {
      DB: db, JWT_SECRET: SECRET, INQUIRY_LIMITER: { limit: async () => ({ success: true }) },
    } as never, {} as never);
    expect(checkout.status, await checkout.clone().text()).toBe(201);
    const { invoice_id } = await checkout.json() as { invoice_id: string };
    expect(db.sqlite.prepare('SELECT account_id, status FROM invoices WHERE id=?').get(invoice_id))
      .toEqual({ account_id: account.id, status: 'Draft' });
    expect(db.sqlite.prepare('SELECT quantity, price_at_sale FROM invoice_line_items WHERE invoice_id=?').get(invoice_id))
      .toEqual({ quantity: 50, price_at_sale: 0.6 });
    expect((await scoped(`/api/invoices/${invoice_id}`, 'PUT', { status: 'Pending' })).status).toBe(200);
    const tracked = await publicRead(db, '/api/inquiries/synthetic-personal-shop-order-000000000001');
    expect(tracked.status).toBe(200);
    expect(await tracked.json()).toMatchObject({ payment: {
      total_usd: 30, pay_url: expect.stringContaining('/people/seller-public/pay?'),
    } });
    const paid = { amount_usd: 30, method_label: 'Bank transfer', request_id: 'personal-checkout-confirm' };
    expect((await scoped(`/api/invoices/${invoice_id}/payments`, 'POST', paid)).status).toBe(201);
    expect(db.sqlite.prepare('SELECT stock_grams FROM products WHERE id=?').get(productId)).toEqual({ stock_grams: 100 });
  });

  it('uses canonical Stock and Sales for an owner’s 50 g sale while leaving the shop closed', async () => {
    const db = database();
    const { account } = await (await call(db, '/api/me/tea-chest/account', 'POST')).json() as {
      account: { id: string; slug: string };
    };
    const scoped = (path: string, method: string, body?: unknown) =>
      call(db, path, method, body, 'seller', account.id);
    const created = await scoped('/api/products', 'POST', {
      product_name: 'Personal Autumn oolong', type: 'Oolong', stock_grams: 150,
      cost_amount: 9, cost_currency: 'USD', fixed_retail_price_usd: 50,
      status: 'Active', is_public: 0, shown_in_shop: 0, owner_user_id: 'seller',
    });
    expect(created.status).toBe(201);
    const { id: productId } = await created.json() as { id: string };
    expect((await publicRead(db, `/api/s/${account.slug}/products`)).status).toBe(404);
    expect(await (await publicRead(db, '/api/products/public')).text()).not.toContain(productId);

    const order = await scoped('/api/invoices', 'POST', {
      invoice: { customer_name: 'Buyer', display_currency: 'USD', status: 'Pending' },
      lineItems: [{ product_id: productId, quantity: 50, price_at_sale: 0.5 }],
    });
    expect(order.status).toBe(201);
    const { id: invoiceId } = await order.json() as { id: string };
    expect(db.sqlite.prepare(`SELECT account_id, sold_by_user_id, payment_recipient_user_id
      FROM invoices WHERE id=?`).get(invoiceId)).toEqual({
      account_id: account.id, sold_by_user_id: 'seller', payment_recipient_user_id: 'seller',
    });
    expect(db.sqlite.prepare(`SELECT owner_share_value FROM invoice_line_items WHERE invoice_id=?`).get(invoiceId))
      .toEqual({ owner_share_value: 100 });
    const payment = { amount_usd: 25, method_label: 'Cash', request_id: 'tea-chest-sale-once' };
    expect((await scoped(`/api/invoices/${invoiceId}/payments`, 'POST', payment)).status).toBe(201);
    expect((await scoped(`/api/invoices/${invoiceId}/payments`, 'POST', payment)).ok).toBe(true);
    expect(db.sqlite.prepare('SELECT stock_grams FROM products WHERE id=?').get(productId)).toEqual({ stock_grams: 100 });
    expect(db.sqlite.prepare('SELECT grams FROM personal_cellar_items WHERE id=?').get('holding')).toEqual({ grams: 150 });
  });
});

describe('a personal shelf offer', () => {
  it('requires a recorded purchase amount and currency before adding a tea', async () => {
    const db = database();
    const tea = { name: 'Spring oolong', grams: 120 };
    for (const invalid of [{}, { costAmount: '', costCurrency: 'USD' }, { costAmount: 15 },
      { costAmount: 15, costCurrency: 'UNK' }, { costAmount: -1, costCurrency: 'USD' }]) {
      expect((await call(db, '/api/me/cellar', 'POST', { ...tea, ...invalid })).status).toBe(400);
    }
    const response = await call(db, '/api/me/cellar', 'POST', { ...tea, costAmount: 0, costCurrency: 'CNY' });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ item: { costAmount: 0, costCurrency: 'Yuan' } });
  });

  it('requires a price for the offered weight and publishes only the asking price', async () => {
    const db = database();
    expect((await publish(db, { ...offer, price_amount: undefined, price_currency: undefined })).status).toBe(400);
    expect((await publish(db, { ...offer, price_amount: 0 })).status).toBe(400);
    expect((await publish(db, { ...offer, price_amount: 12.123 })).status).toBe(400);
    expect((await publish(db)).status).toBe(200);
    const listed = (await publicShelf(db)).items[0];
    expect(listed).toMatchObject({ grams: 50, price_amount: 25, price_currency: 'USD' });
    expect(listed).not.toHaveProperty('costAmount');
    expect(listed).not.toHaveProperty('cost_amount');
  });

  it('keeps a legacy holding private until its owner records cost and approves a priced offer', async () => {
    const db = database();
    db.sqlite.prepare(`UPDATE personal_cellar_items
      SET chest_cost_amount=NULL, chest_cost_currency=NULL, shelf_published=1,
          shelf_offer_name='Old offer', shelf_offer_grams=50
      WHERE id='holding'`).run();
    expect((await publicShelf(db)).items).toEqual([]);
    expect((await publish(db)).status).toBe(409);
    expect((await call(db, '/api/me/cellar/holding', 'PUT', { costAmount: 9, costCurrency: 'AUD' })).status).toBe(200);
    expect((await publicShelf(db)).items).toEqual([]);
    expect((await publish(db)).status).toBe(200);
    expect((await publicShelf(db)).items[0]).toMatchObject({ grams: 50, price_amount: 25 });
  });

  it('publishes only approved buyer-safe fields, retries without duplicating, and withdraws without consuming the holding', async () => {
    const db = database();
    expect((await publish(db)).status).toBeLessThan(300);
    expect((await publish(db)).status).toBeLessThan(300);
    const shelf = await publicShelf(db);
    expect(shelf.items).toHaveLength(1);
    expect(shelf.items[0]).toMatchObject({ name: 'Mountain Oolong', grams: 50, type: 'Oolong', year: 2021, origin: 'Taiwan', image_url: null });
    expect(JSON.stringify(shelf)).not.toMatch(/Private supplier name|Private source|Secret sourcing note|private\.example/);
    expect(holding(db)).toMatchObject({ name: 'Private supplier name', grams: 150, notes: 'Secret sourcing note' });
    expect((await call(db, '/api/me/cellar/holding/unpublish-shelf', 'POST', {})).status).toBeLessThan(300);
    expect((await publicShelf(db)).items).toEqual([]);
    expect(holding(db)).toMatchObject({ name: 'Private supplier name', grams: 150, notes: 'Secret sourcing note', shelf_offer_name: 'Mountain Oolong', shelf_offer_grams: 50 });
  });

  it('requires ownership, an enabled address, valid seller contact, a private holding and a positive quantity within the holding', async () => {
    const db = database();
    expect((await publish(db, offer, 'other')).status).toBeGreaterThanOrEqual(400);
    for (const grams of [0, -1, 151]) expect((await publish(db, { ...offer, grams })).status).toBeGreaterThanOrEqual(400);
    db.sqlite.prepare("UPDATE users SET shelf_whatsapp=NULL WHERE id='seller'").run();
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
    db.sqlite.prepare("UPDATE users SET shelf_whatsapp='123' WHERE id='seller'").run();
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
    db.sqlite.prepare("UPDATE users SET shelf_whatsapp='628123456789', shelf_slug=NULL WHERE id='seller'").run();
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
    db.sqlite.prepare("UPDATE users SET shelf_whatsapp='628123456789', shelf_slug='seller-tea', shelf_enabled=0 WHERE id='seller'").run();
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
    db.sqlite.prepare("UPDATE users SET shelf_enabled=1 WHERE id='seller'").run();
    db.sqlite.prepare("UPDATE personal_cellar_items SET placement_status='requested' WHERE id='holding'").run();
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
    expect((await publicShelf(db)).items).toEqual([]);
  });

  it('does not expose legacy published holdings until they are explicitly approved', async () => {
    const db = database();
    db.sqlite.prepare("UPDATE personal_cellar_items SET shelf_published=1 WHERE id='holding'").run();
    expect((await publicShelf(db)).items).toEqual([]);
    expect((await publish(db)).status).toBeLessThan(300);
    expect((await publicShelf(db)).items).toHaveLength(1);
  });

  it('shares eligibility with the mapped public person and hides the offer when contact is removed', async () => {
    const db = database();
    db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
      VALUES ('seller-profile', 'seller-account', 'seller', 'Seller', 1)`).run();
    const person = async () => (await publicRead(db, '/api/people/seller-profile')).json();
    expect(await person()).toMatchObject({ id: 'seller-profile' });
    expect(await person()).not.toHaveProperty('shelf_slug');
    expect((await publish(db)).status).toBe(200);
    expect(await person()).toMatchObject({ shelf_slug: 'seller-tea', orderable_shelf_slug: 'seller-tea' });
    expect((await call(db, '/api/me/shelf', 'PUT', { whatsapp: '' })).status).toBe(200);
    expect(await publicShelf(db)).toMatchObject({ slug: 'seller-tea', whatsapp: null, items: [] });
    expect(await person()).not.toHaveProperty('shelf_slug');
  });

  it('keeps placement and an active offer mutually exclusive and withdraws when stock falls below the offer', async () => {
    const db = database();
    expect((await publish(db)).status).toBeLessThan(300);
    const placement = await call(db, '/api/me/cellar/holding/request-placement', 'POST', { account_id: 'other-account' });
    expect(placement.status).toBeGreaterThanOrEqual(400);
    expect(holding(db).placement_status).toBe('private');
    expect((await call(db, '/api/me/cellar/holding', 'PUT', { grams: 49 })).status).toBeLessThan(300);
    expect(holding(db).grams).toBe(49);
    expect((await publicShelf(db)).items).toEqual([]);
    expect((await publish(db)).status).toBeGreaterThanOrEqual(400);
  });

  it('allows only one winner when an offer and a placement request overlap', async () => {
    const db = database();
    const [offerResult, placementResult] = await Promise.all([
      publish(db),
      call(db, '/api/me/cellar/holding/request-placement', 'POST', { account_id: 'other-account' }),
    ]);
    expect([offerResult.status, placementResult.status].sort()).toEqual([200, 409]);
    const items = (await publicShelf(db)).items;
    expect(items).toHaveLength(offerResult.ok ? 1 : 0);
    expect(holding(db).placement_status).toBe(offerResult.ok ? 'private' : 'requested');
  });

  it('keeps the public quantity truthful when a stock edit overlaps publishing', async () => {
    const db = database();
    await Promise.all([
      publish(db),
      call(db, '/api/me/cellar/holding', 'PUT', { grams: 25 }),
    ]);
    expect(holding(db).grams).toBe(25);
    expect((await publicShelf(db)).items).toEqual([]);
  });

  it('moves the full holding once after withdrawal and location approval', async () => {
    const db = database();
    expect((await call(db, '/api/me/cellar/holding', 'PUT', { label: 'Personal tasting group' })).status).toBe(200);
    expect((await publish(db)).status).toBeLessThan(300);
    expect((await call(db, '/api/me/cellar/holding/unpublish-shelf', 'POST', {})).status).toBeLessThan(300);
    expect((await call(db, '/api/me/cellar/holding/request-placement', 'POST', { account_id: 'other-account' })).status).toBeLessThan(300);
    const placementInbox = await call(db, '/api/cellar-placements', 'GET', undefined, 'other');
    expect(placementInbox.status).toBe(200);
    const { requests } = await placementInbox.json() as { requests: Record<string, unknown>[] };
    expect(requests).toHaveLength(1);
    expect(requests[0]).not.toHaveProperty('label');
    expect(requests[0]).not.toHaveProperty('shelfOffer');
    expect(requests[0]).not.toHaveProperty('costAmount');
    const approvals = await Promise.all([
      call(db, '/api/cellar-placements/holding/approve', 'POST', {}, 'other'),
      call(db, '/api/cellar-placements/holding/approve', 'POST', {}, 'other'),
    ]);
    expect(approvals.filter(response => response.status < 300)).toHaveLength(1);
    const item = holding(db);
    expect(item.placement_status).toBe('placed');
    expect((await call(db, '/api/me/cellar/holding', 'PUT', { grams: 90 })).status).toBe(409);
    expect(holding(db).grams).toBe(150);
    expect((await publicShelf(db)).items).toEqual([]);
    expect(db.sqlite.prepare('SELECT stock_grams, owner_user_id FROM products WHERE id=?').get(item.linked_product_id))
      .toMatchObject({ stock_grams: 150, owner_user_id: 'seller' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM products WHERE owner_user_id=?').get('seller')).toEqual({ n: 1 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM product_listings WHERE legacy_product_id=?').get(item.linked_product_id)).toEqual({ n: 1 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_ledger WHERE product_id=?').get(item.linked_product_id)).toEqual({ n: 1 });
  });
});
