import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'website-order-lifecycle-test';
const databases: SqliteD1[] = [];
let sequence = 0;

afterEach(() => {
  vi.restoreAllMocks();
  databases.splice(0).forEach(db => db.close());
});

function seed(schema: 'schema' | 'migrations' = 'schema') {
  const db = new SqliteD1(schema);
  databases.push(db);
  seedIdentity(db, { userId: 'owner-a', accountId: 'shop-a', accountSlug: 'teajia-bali', bundles: ['sell'] });
  seedIdentity(db, { userId: 'owner-b', accountId: 'shop-b', bundles: ['sell'] });
  db.sqlite.exec(`
    UPDATE accounts SET default_shipping_rate_per_kg = 0, default_shipping_rate_currency = 'USD';
    INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('USD', 1);
    INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency, quantity_purchased, stock_grams)
    VALUES ('tea-a', 'shop-a', 'Red', 'Red tea', 'Loose', 20, 'USD', 300, 1000),
           ('tea-b', 'shop-b', 'Red', 'Other red tea', 'Loose', 20, 'USD', 300, 1000);
  `);
  return db;
}

function orderPayload(account = 'shop-a', contact = 'guest@example.com', overrides: Record<string, unknown> = {}) {
  const id = ++sequence;
  return {
    source: 'website', store_slug: account === 'shop-a' ? 'teajia-bali' : account,
    tracking_token: `privatewebsiteordertoken000000000000${String(id).padStart(2, '0')}`,
    ref_number: `TJ-WEB-${id}`, customer_name: 'Guest', customer_contact: contact,
    customer_location: 'Ubud, Indonesia', currency: 'USD', total_estimate_usd: 1,
    items: [{ id: account === 'shop-a' ? 'tea-a' : 'tea-b', name: 'Red tea', category: 'tea',
      storeSlug: account === 'shop-a' ? 'teajia-bali' : account, quantityGrams: 50, packGrams: 25, packs: 2,
      pricePerGram: 0.001, totalPrice: 0.01 }],
    ...overrides,
  };
}

function publicOrder(db: SqliteD1, body: Record<string, unknown>, pickupAccountId?: string, shippingConfig = {}) {
  return worker.fetch(new Request('https://app.test/api/inquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET, SHOP_PICKUP_ACCOUNT_ID: pickupAccountId, ...shippingConfig, INQUIRY_LIMITER: { limit: async () => ({ success: true }) } } as never, {} as never);
}

async function admin(db: SqliteD1, accountId: string, path: string, body?: unknown, method = 'POST') {
  const userId = accountId === 'shop-a' ? 'owner-a' : 'owner-b';
  const token = await signedToken(SECRET, {
    sub: userId, email: `${userId}@test.dev`, active_account_id: accountId, role: 'owner',
  });
  return worker.fetch(new Request(`https://app.test${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId,
      'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
}

async function create(db: SqliteD1, body = orderPayload()) {
  const response = await publicOrder(db, body);
  expect(response.status).toBe(201);
  return { body, result: await response.json() as Record<string, any> };
}

function invoice(db: SqliteD1, id: string) {
  return db.sqlite.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as Record<string, any>;
}

function stock(db: SqliteD1, account = 'shop-a') {
  return (db.sqlite.prepare('SELECT stock_grams FROM products WHERE account_id = ?').get(account) as { stock_grams: number }).stock_grams;
}

function ledger(db: SqliteD1, id: string) {
  return db.sqlite.prepare('SELECT status, amount_usd FROM invoice_payments WHERE invoice_id = ?').all(id) as Array<Record<string, any>>;
}

async function buyerRequest(db: SqliteD1, path: string, user?: string, method = 'GET') {
  const headers = new Headers();
  if (user) {
    const account = user === 'buyer' ? 'buyer-home' : 'other-home';
    const token = await signedToken(SECRET, { sub: user, email: `${user}@test.dev`, active_account_id: account });
    headers.set('Authorization', `Bearer ${token}`);
  }
  return worker.fetch(new Request(`https://app.test${path}`, { headers, method }),
    { DB: db, JWT_SECRET: SECRET } as never, {} as never);
}

async function seedPaidOrder() {
  const db = seed();
  seedIdentity(db, { userId: 'buyer', accountId: 'buyer-home' });
  seedIdentity(db, { userId: 'other-buyer', accountId: 'other-home' });
  const { body, result } = await create(db);
  const id = result.invoice_id;
  const trackingPath = `/api/inquiries/${body.tracking_token}`;
  expect((await buyerRequest(db, `${trackingPath}/claim`, 'buyer', 'POST')).status).toBe(200);
  db.sqlite.prepare(`
    UPDATE invoices SET status='Pending', payment_status='paid', inventory_deducted=1
    WHERE id=? AND account_id='shop-a'
  `).run(id);
  db.sqlite.prepare("UPDATE products SET stock_grams=950 WHERE id='tea-a' AND account_id='shop-a'").run();
  db.sqlite.prepare(`
    INSERT INTO invoice_payments (id,invoice_id,account_id,amount_usd,status,claimed_by,confirmed_at)
    VALUES ('fixture-payment',?,'shop-a',14,'confirmed','operator','2026-11-17T01:00:00Z')
  `).run(id);
  db.sqlite.prepare(`
    INSERT INTO stock_ledger (id,product_id,delta,balance_after,movement_unit,reason,source_invoice_id,account_id)
    VALUES ('fixture-sale','tea-a',-50,950,'gram','PAYMENT_CONFIRMED',?,'shop-a')
  `).run(id);
  return { db, id, trackingPath, orderPath: `/api/me/orders/${id}` };
}

async function reviewedOrderForSplit() {
  const db = seed('migrations');
  db.sqlite.exec(`
    INSERT INTO products(id, account_id, type, product_name, form, cost_amount, cost_currency, quantity_purchased, stock_grams)
    VALUES ('tea-second','shop-a','Red','Second tea','Loose',20,'USD',300,1000),
           ('tea-third','shop-a','Red','Third tea','Loose',20,'USD',300,1000)
  `);
  const body = orderPayload();
  body.items.push({ ...body.items[0], id: 'tea-second' }, { ...body.items[0], id: 'tea-third' });
  const id = (await create(db, body)).result.invoice_id as string;
  const acceptedAt = Date.now();
  expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
  const lines = db.sqlite.prepare('SELECT id, product_id FROM invoice_line_items WHERE invoice_id=? ORDER BY product_id').all(id);
  const hold = () => db.sqlite.prepare('SELECT id, invoice_id, product_id, held_grams, expires_at FROM stock_holds ORDER BY product_id').all();
  const seq = () => db.sqlite.prepare("SELECT invoice_seq FROM accounts WHERE id='shop-a'").get()!;
  const snapshot = () => ({
    invoices: db.sqlite.prepare('SELECT * FROM invoices ORDER BY id').all(),
    lines: db.sqlite.prepare('SELECT id, invoice_id FROM invoice_line_items ORDER BY id').all(),
    holds: hold(), seq: seq(),
  });
  const split = (lineIds: unknown[] = [lines[0].id], account = 'shop-a') =>
    admin(db, account, '/api/rpc/split-invoice', { invoice_id: id, line_item_ids: lineIds });
  return { db, body, id, lines, split, hold, seq, snapshot, acceptedAt };
}

function stockMovements(db: SqliteD1, invoiceId: string) {
  return db.sqlite.prepare(`
    SELECT delta, balance_after, account_id, movement_unit FROM stock_ledger
    WHERE source_invoice_id=? ORDER BY delta
  `).all(invoiceId);
}

describe('website order lifecycle', () => {
  it('atomically creates one server-priced Draft, request, and customer outbox without a payment method', async () => {
    const db = seed();
    const body = orderPayload('shop-a', '+628123456789', { total_estimate_usd: 0, whatsapp_confirmation_consent: true });
    const first = await create(db, body);
    expect(first.result).toMatchObject({ success: true, invoice_id: expect.any(String), invoice_number: expect.any(String) });
    const saved = invoice(db, first.result.invoice_id);
    expect(saved).toMatchObject({ account_id: 'shop-a', status: 'Draft', inventory_deducted: 0,
      customer_whatsapp: '+628123456789', shipping_destination: 'Ubud, Indonesia' });
    const line = db.sqlite.prepare('SELECT quantity, price_at_sale FROM invoice_line_items WHERE invoice_id = ?')
      .get(saved.id) as { quantity: number; price_at_sale: number };
    expect(line.quantity * line.price_at_sale).toBeCloseTo(14);
    expect(stock(db)).toBe(1000);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM inquiries WHERE converted_invoice_id = ?').get(saved.id)).toEqual({ n: 1 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM order_whatsapp_outbox WHERE invoice_id = ?').get(saved.id)).toEqual({ n: 1 });

    const replay = await publicOrder(db, body);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ idempotent: true, invoice_id: saved.id });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({ n: 1 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM order_whatsapp_outbox').get()).toEqual({ n: 1 });

    const malformed = orderPayload('shop-a', 'bad@example.com');
    (malformed.items[0] as any).packs = 3;
    expect((await publicOrder(db, malformed)).status).toBe(400);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM inquiries').get()).toEqual({ n: 1 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({ n: 1 });
  });

  it('opens private bank transfer for eligible pickup and deducts only after deposit confirmation', async () => {
    const db = seed('migrations');
    db.sqlite.exec(`
      UPDATE accounts SET owner_user_id='owner-a' WHERE id='shop-a';
      UPDATE products SET stock_grams=75,stock_known_at=datetime('now') WHERE id='tea-a';
      INSERT INTO contributors(id,account_id,user_id,display_name,is_published)
      VALUES ('bali-seller','shop-a','owner-a','Bali seller',1);
      INSERT INTO payment_methods(id,contributor_id,method_type,label,recipient_name,account_identifier,is_published)
      VALUES ('bali-bank','bali-seller','bank_transfer','Bank transfer','Bali seller','Synthetic bank reference',1);
    `);
    const body = orderPayload('shop-a', 'guest@example.test', {
      pickup: true, customer_location: 'Pickup requested in Bali, Indonesia',
    });
    const created = await publicOrder(db, body, 'shop-a');
    expect(created.status).toBe(201);
    const order = await created.json() as { invoice_id: string; pickup_payment_deadline: string };
    const id = order.invoice_id;
    expect(order.pickup_payment_deadline).toEqual(expect.any(String));
    expect(invoice(db, id)).toMatchObject({ status: 'Pending', shipping_cost_usd: 0, inventory_deducted: 0 });
    expect(stock(db)).toBe(75);
    expect(stockMovements(db, id)).toEqual([]);

    const replay = await publicOrder(db, body, 'shop-a');
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ invoice_id: id, pickup_payment_deadline: order.pickup_payment_deadline, idempotent: true });
    expect((await publicOrder(db, { ...body, pickup: false }, 'shop-a')).status).toBe(409);
    const second = await publicOrder(db, orderPayload('shop-a', 'other@example.test', {
      pickup: true, customer_location: body.customer_location,
    }), 'shop-a');
    expect(second.status).toBe(201);
    const fallback = await second.json() as { invoice_id: string };
    expect(fallback).not.toHaveProperty('pickup_payment_deadline');
    expect(invoice(db, fallback.invoice_id).status).toBe('Draft');

    const tracking = await buyerRequest(db, `/api/inquiries/${body.tracking_token}`);
    const view = await tracking.json();
    expect(view).toMatchObject({
      order: { status: 'Pending', shipping_destination: 'In-person pickup in Bali, Indonesia' },
      payment: { total_usd: 14, pay_url: expect.stringContaining('t=') },
    });
    expect(JSON.stringify(view)).not.toContain('Synthetic bank reference');
    const claim = await worker.fetch(new Request(`https://app.test/api/orders/${body.tracking_token}/payment-claim`, {
      method: 'POST', body: JSON.stringify({ amount_usd: 14, reference: 'TEST-TRANSFER' }),
    }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect(claim.status).toBe(201);
    expect(invoice(db, id).inventory_deducted).toBe(0);
    expect(stock(db)).toBe(75);
    const { claim_id } = await claim.json() as { claim_id: string };
    const confirmation = await admin(db, 'shop-a', `/api/invoice-payments/${claim_id}/confirm`, {});
    expect(confirmation.status).toBe(200);
    expect(stock(db)).toBe(25);
    expect(stockMovements(db, id)).toEqual([
      { delta: -50, balance_after: 25, account_id: 'shop-a', movement_unit: 'gram' },
    ]);
  });

  it('quotes configured US shipping from server-priced tea grams and preserves the invoice on retry', async () => {
    const db = seed('migrations');
    db.sqlite.exec(`
      UPDATE accounts SET owner_user_id='owner-a' WHERE id='shop-a';
      UPDATE products SET stock_known_at=datetime('now') WHERE id='tea-a';
      INSERT INTO contributors(id,account_id,user_id,display_name,is_published)
      VALUES ('bali-seller','shop-a','owner-a','Bali seller',1);
      INSERT INTO payment_methods(id,contributor_id,method_type,label,recipient_name,account_identifier,is_published)
      VALUES ('bali-bank','bali-seller','bank_transfer','Bank transfer','Bali seller','Synthetic bank reference',1);
    `);
    const config = {
      SHOP_US_SHIPPING_ACCOUNT_ID: 'shop-a',
      SHOP_US_SHIPPING_USD_PER_KG: '40.00',
      SHOP_US_SHIPPING_PACKAGING_GRAMS: '100',
      SHOP_US_SHIPPING_MAX_PACKED_GRAMS: '500',
    };
    const address = {
      customer_location: 'Los Angeles, CA 90012, United States',
      delivery_address: '12 Test Lane',
      us_shipping_postcode: '90012',
      shipping_cost_usd: 0.01,
      packed_grams: 1,
    };
    const body = orderPayload('shop-a', 'guest@example.test', address);
    const response = await publicOrder(db, body, undefined, config);
    expect(response.status).toBe(201);
    const result = await response.json() as { invoice_id: string; shipping_checkout: unknown };
    expect(result.shipping_checkout).toMatchObject({ shipping_usd: 6, packed_grams: 150, payment_deadline: expect.any(String) });
    expect(invoice(db, result.invoice_id)).toMatchObject({
      status: 'Pending', shipping_cost_usd: 6, checkout_shipping_grams: 150, delivery_address: address.delivery_address,
    });
    const tracking = await buyerRequest(db, `/api/inquiries/${body.tracking_token}`);
    const view = await tracking.json();
    expect(view).toMatchObject({ payment: { total_usd: 20, pay_url: expect.stringContaining('t=') } });
    expect(JSON.stringify(view)).not.toContain(address.delivery_address);
    const replay = await publicOrder(db, body, undefined, { ...config, SHOP_US_SHIPPING_USD_PER_KG: '70' });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ invoice_id: result.invoice_id, shipping_checkout: result.shipping_checkout, idempotent: true });
    const review = await publicOrder(db, orderPayload('shop-a', 'review@example.test', address));
    expect(review.status).toBe(201);
    const fallback = await review.json() as { invoice_id: string };
    expect(fallback).not.toHaveProperty('shipping_checkout');
    expect(invoice(db, fallback.invoice_id)).toMatchObject({ status: 'Draft', checkout_shipping_grams: null });

    const payments = `/api/invoices/${result.invoice_id}/payments`;
    const partial = await admin(db, 'shop-a', payments, { amount_usd: 14, method_label: 'Bank transfer' });
    expect(partial.status).toBe(201);
    expect(await partial.json()).toMatchObject({ payment_status: 'partial', outstanding_usd: 6 });
    expect(stockMovements(db, result.invoice_id)).toEqual([]);
    const full = await admin(db, 'shop-a', payments, { amount_usd: 6, method_label: 'Bank transfer' });
    expect(full.status).toBe(201);
    expect(await full.json()).toMatchObject({ payment_status: 'paid', outstanding_usd: 0 });
    expect(stockMovements(db, result.invoice_id)).toEqual([
      { delta: -50, balance_after: 950, account_id: 'shop-a', movement_unit: 'gram' },
    ]);
  });

  it('keeps pickup in review when a bank transfer method is unavailable', async () => {
    const db = seed();
    db.sqlite.exec(`
      UPDATE accounts SET owner_user_id='owner-a' WHERE id='shop-a';
      UPDATE products SET stock_known_at=datetime('now') WHERE id='tea-a';
    `);
    const response = await publicOrder(db, orderPayload('shop-a', 'guest@example.test', { pickup: true }), 'shop-a');
    expect(response.status).toBe(201);
    const result = await response.json() as { invoice_id: string };
    expect(result).not.toHaveProperty('pickup_payment_deadline');
    expect(invoice(db, result.invoice_id).status).toBe('Draft');
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM stock_holds').get()).toEqual({ n: 0 });
  });

  it('keeps the submitted street address in the selling store invoice only', async () => {
    const db = seed('migrations');
    const address = '12 Test Lane, Apartment 4';
    const { body, result } = await create(db, orderPayload('shop-a', 'guest@example.test', { delivery_address: address }));
    expect(result).not.toHaveProperty('delivery_address');
    expect((await publicOrder(db, body)).status).toBe(200);
    expect((await publicOrder(db, { ...body, delivery_address: '15 Test Lane' })).status).toBe(409);
    expect((await publicOrder(db, orderPayload('shop-a', 'guest@example.test', { delivery_address: 'a'.repeat(501) }))).status).toBe(400);
    const tracking = await buyerRequest(db, `/api/inquiries/${body.tracking_token}`);
    expect(tracking.status).toBe(200);
    expect(await tracking.text()).not.toContain(address);
    const owner = await admin(db, 'shop-a', '/api/invoices', undefined, 'GET');
    expect(await owner.json()).toMatchObject([{ id: result.invoice_id, delivery_address: address }]);
    const otherStore = await admin(db, 'shop-b', '/api/invoices', undefined, 'GET');
    expect(await otherStore.json()).toEqual([]);
  });

  it('keeps overlapping Shop requests in separate drafts and scopes tracking and buyer access', async () => {
    const db = seed();
    db.sqlite.exec(`
      UPDATE products SET stock_grams = 100 WHERE account_id = 'shop-a';
      UPDATE accounts SET contact_email = 'sales-a@example.test' WHERE id = 'shop-a';
    `);
    seedIdentity(db, { userId: 'buyer', accountId: 'buyer-home' });
    seedIdentity(db, { userId: 'other-buyer', accountId: 'other-home' });

    const request75 = (contact: string) => {
      const body = orderPayload('shop-a', contact);
      body.items[0] = { ...body.items[0], quantityGrams: 75, packs: 3 };
      return body;
    };
    const first = await create(db, request75('guest-a@example.test'));
    const second = await create(db, request75('guest-b@example.test'));
    const firstId = first.result.invoice_id;
    const secondId = second.result.invoice_id;
    expect(firstId).not.toBe(secondId);
    expect(db.sqlite.prepare(`
      SELECT i.account_id, i.status, i.inventory_deducted, l.quantity, l.quantity_unit, l.price_at_sale
      FROM invoices i JOIN invoice_line_items l ON l.invoice_id = i.id AND l.account_id = i.account_id
      WHERE i.id IN (?, ?)
    `).all(firstId, secondId)).toEqual(Array.from({ length: 2 }, () => ({
      account_id: 'shop-a', status: 'Draft', inventory_deducted: 0, quantity: 75, quantity_unit: 'g',
      price_at_sale: expect.closeTo(0.28),
    })));
    const replay = await publicOrder(db, first.body);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ idempotent: true, invoice_id: firstId });
    expect((await publicOrder(db, { ...first.body, customer_location: 'Different destination' })).status).toBe(409);
    const foreignReplay = { ...orderPayload('shop-b'), tracking_token: first.body.tracking_token };
    expect((await publicOrder(db, foreignReplay)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM invoices').get()).toEqual({ n: 2 });
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM inquiries WHERE converted_invoice_id IN (?, ?)').get(firstId, secondId)).toEqual({ n: 2 });
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM stock_holds').get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM stock_ledger').get()).toEqual({ n: 0 });
    expect(stock(db)).toBe(100);
    expect(stock(db, 'shop-b')).toBe(1000);

    const trackingPath = `/api/inquiries/${first.body.tracking_token}`;
    const orderPath = `/api/me/orders/${firstId}`;
    const guest = await buyerRequest(db, trackingPath);
    expect(guest.status).toBe(200);
    const guestView = await guest.json();
    expect(guestView).toMatchObject({
      invoice_id: firstId, journey: { stage: 'received' },
      contact: { email: 'sales-a@example.test' },
    });
    expect(JSON.stringify(guestView)).not.toContain('guest-a@example.test');
    expect((await buyerRequest(db, `/api/inquiries/${first.body.ref_number}`)).status).toBe(404);
    expect((await buyerRequest(db, '/api/inquiries/unknownwebsiteordertoken00000000000001')).status).toBe(404);
    expect((await buyerRequest(db, orderPath)).status).toBe(401);
    expect((await buyerRequest(db, orderPath, 'buyer')).status).toBe(404);

    const claimPath = `${trackingPath}/claim`;
    expect((await buyerRequest(db, claimPath, undefined, 'POST')).status).toBe(401);
    for (let attempt = 0; attempt < 2; attempt++) {
      const claim = await buyerRequest(db, claimPath, 'buyer', 'POST');
      expect(claim.status).toBe(200);
      expect(await claim.json()).toMatchObject({ invoice_id: firstId, account_id: 'shop-a' });
    }
    expect((await buyerRequest(db, claimPath, 'other-buyer', 'POST')).status).toBe(409);
    expect(db.sqlite.prepare("SELECT count(*) AS n FROM customers WHERE account_id = 'shop-a' AND user_id = 'buyer'").get()).toEqual({ n: 1 });
    const buyer = await buyerRequest(db, orderPath, 'buyer');
    expect(buyer.status).toBe(200);
    expect(await buyer.json()).toMatchObject({
      id: firstId, account_id: 'shop-a', status: 'Draft', total_amount_usd: expect.closeTo(21),
      items: [{ quantity: 75, quantity_unit: 'g' }],
    });
    expect((await buyerRequest(db, orderPath, 'other-buyer')).status).toBe(404);
    expect((await buyerRequest(db, `/api/me/orders/${secondId}`, 'buyer')).status).toBe(404);
  });

  it('holds one accepted 75 g request for 24 hours, keeps the other in Draft and deducts only at full payment', async () => {
    const db = seed('migrations');
    db.sqlite.prepare("UPDATE products SET stock_grams=100 WHERE id='tea-a'").run();
    const create75 = async (contact: string) => {
      const body = orderPayload('shop-a', contact);
      body.items[0] = { ...body.items[0], quantityGrams: 75, packs: 3 };
      return (await create(db, body)).result.invoice_id as string;
    };
    const ids = await Promise.all([create75('first@example.test'), create75('second@example.test')]);
    const available = async () => (await admin(db, 'shop-a', '/api/stock/available?product_id=tea-a', undefined, 'GET')).json();
    const accept = (id: string) => admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT');
    const holds = () => db.sqlite.prepare('SELECT id, invoice_id, held_grams, expires_at FROM stock_holds ORDER BY id').all();
    expect(await available()).toEqual({ stock_grams: 100, held_grams: 0, available_grams: 100 });

    const acceptedAt = Date.now();
    const competing = await Promise.all(ids.map(accept));
    expect(competing.map(response => response.status).sort()).toEqual([200, 409]);
    const winner = ids[competing.findIndex(response => response.ok)];
    const loser = ids.find(id => id !== winner)!;
    expect(await competing.find(response => !response.ok)!.json()).toMatchObject({ code: 'insufficient_available_stock' });
    expect(invoice(db, winner).status).toBe('Pending');
    expect(invoice(db, loser).status).toBe('Draft');
    const reservation = holds();
    expect(reservation).toEqual([{ invoice_id: winner, id: expect.any(String), held_grams: 75, expires_at: expect.any(String) }]);
    expect(Math.abs(Date.parse(String(reservation[0].expires_at)) - acceptedAt - 24 * 60 * 60 * 1000)).toBeLessThan(2000);
    expect((await accept(winner)).status).toBe(200);
    expect(holds()).toEqual(reservation);
    expect(await available()).toEqual({ stock_grams: 100, held_grams: 75, available_grams: 25 });

    const payment = (amount: number, requestId: string) => admin(db, 'shop-a', `/api/invoices/${winner}/payments`,
      { amount_usd: amount, method_label: 'Cash', request_id: requestId });
    const partial = await payment(5, 'overlap-payment-partial');
    expect(partial.status).toBe(201);
    expect(await partial.json()).toMatchObject({ payment_status: 'partial' });
    expect(stockMovements(db, winner)).toEqual([]);
    expect(holds()).toEqual(reservation);
    const total = db.sqlite.prepare("SELECT SUM(quantity * price_at_sale) AS total FROM invoice_line_items WHERE invoice_id=?").get(winner);
    const balance = Math.round((Number(total!.total) - 5) * 100) / 100;
    const paid = await payment(balance, 'overlap-payment-balance');
    expect(paid.status).toBe(201);
    expect(await paid.json()).toMatchObject({ payment_status: 'paid', stock: { state: 'deducted' } });
    const replay = await payment(balance, 'overlap-payment-balance');
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ idempotent: true, stock: { state: 'already_deducted' } });
    expect(holds()).toEqual([]);
    const ship = () => admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: winner, tracking_number: 'TRACK-OVERLAP' });
    expect((await ship()).status).toBe(200);
    expect((await ship()).status).toBe(200);
    expect(stockMovements(db, winner)).toEqual([{ delta: -75, balance_after: 25, account_id: 'shop-a', movement_unit: 'gram' }]);
    expect(stockMovements(db, loser)).toEqual([]);
    expect(stock(db, 'shop-b')).toBe(1000);
  });

  it.each(['replace items', 'link stock', 'legacy reserve'])(
    'keeps the approved deadline when operators %s and cannot renew an expired hold',
    async action => {
      const db = seed('migrations');
      seedIdentity(db, { userId: 'owner-a', accountId: 'shop-a', bundles: ['sell', 'stock'] });
      db.sqlite.exec(`
        INSERT INTO products(id, account_id, type, product_name, form, cost_amount, cost_currency, quantity_purchased, stock_grams)
        VALUES ('replacement-tea','shop-a','Red','Replacement tea','Loose',20,'USD',300,1000)
      `);
      const id = (await create(db)).result.invoice_id as string;
      const reserve = () => admin(db, 'shop-a', '/api/rpc/reserve-stock', { invoice_id: id });
      const accept = () => admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT');
      const hold = () => db.sqlite.prepare('SELECT product_id, held_grams, expires_at FROM stock_holds WHERE invoice_id=?').all(id);
      const edit = async (productId: string) => {
        if (action === 'legacy reserve') return reserve();
        if (action === 'replace items') {
          return admin(db, 'shop-a', `/api/invoices/${id}/items`, {
            lineItems: [{ product_id: productId, quantity: 50, price_at_sale: 0.28 }],
          }, 'PUT');
        }
        const lineId = db.sqlite.prepare('SELECT id FROM invoice_line_items WHERE invoice_id=?').get(id)!.id;
        return admin(db, 'shop-a', '/api/rpc/link-line-item', {
          invoice_id: id, line_item_id: lineId, product_id: productId,
        });
      };
      if (action === 'legacy reserve') {
        expect((await reserve()).status).toBe(409);
        expect(hold()).toEqual([]);
      }
      expect((await accept()).status).toBe(200);
      const expiry = hold()[0].expires_at;
      const result = await edit('replacement-tea');
      expect(result.status, JSON.stringify(await result.clone().json())).toBe(200);
      expect(hold()).toEqual([{ product_id: action === 'legacy reserve' ? 'tea-a' : 'replacement-tea',
        held_grams: 50, expires_at: expiry }]);

      db.sqlite.prepare("UPDATE stock_holds SET expires_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 second') WHERE invoice_id=?").run(id);
      const expiredResult = await edit('tea-a');
      if (action === 'legacy reserve') {
        expect(expiredResult.status).toBe(409);
        expect(await expiredResult.json()).toMatchObject({ code: 'invoice_hold_expired' });
      } else {
        expect(expiredResult.status).toBe(200);
        expect(db.sqlite.prepare('SELECT product_id FROM invoice_line_items WHERE invoice_id=?').get(id)).toMatchObject({ product_id: 'tea-a' });
      }
      expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM stock_holds WHERE invoice_id=? AND julianday(expires_at)>julianday('now')").get(id))
        .toEqual({ count: 0 });
      db.sqlite.prepare('DELETE FROM stock_holds WHERE invoice_id=?').run(id);
      expect((await edit('replacement-tea')).status).toBe(action === 'legacy reserve' ? 409 : 200);
      expect(hold()).toEqual([]);
      expect(stockMovements(db, id)).toEqual([]);
    },
  );

  it('splits both portions under the approved deadline and attaches the original report and tracking to the original invoice', async () => {
    const { db, body, id, lines, split, hold, seq, snapshot, acceptedAt } = await reviewedOrderForSplit();
    const deadline = hold()[0].expires_at as string;
    expect(Math.abs(Date.parse(deadline) - acceptedAt - 24 * 60 * 60 * 1000)).toBeLessThan(2000);
    expect((await buyerRequest(db, `/api/orders/${body.tracking_token}/payment-claim`, undefined, 'POST')).status).toBe(201);
    const partial = await admin(db, 'shop-a', `/api/invoices/${id}/payments`, { amount_usd: 5, method_label: 'Cash' });
    expect(partial.status).toBe(201);
    expect(await partial.json()).toMatchObject({ payment_status: 'partial' });
    const startSeq = Number(seq().invoice_seq);

    // Make both requests reach the lease, then let the second acquire it only
    // after the first commits. It must validate the moved line again.
    let atLease = 0;
    let secondArrived!: () => void;
    let firstFinished!: () => void;
    const bothArrived = new Promise<void>(resolve => { secondArrived = resolve; });
    const committed = new Promise<void>(resolve => { firstFinished = resolve; });
    const prepare = db.prepare.bind(db);
    const pauseLease = vi.spyOn(db, 'prepare').mockImplementation(sql => {
      const statement = prepare(sql);
      if (sql.includes('SET fulfillment_claim_token = ?, fulfillment_claimed_at') && sql.includes('RETURNING id')) {
        const all = statement.all.bind(statement);
        vi.spyOn(statement, 'all').mockImplementation((async () => {
          if (++atLease === 1) {
            await bothArrived;
          } else {
            secondArrived();
            await committed;
          }
          return all();
        }) as unknown as typeof statement.all);
      }
      return statement;
    });
    const requests = [split(), split()];
    void Promise.race(requests).then(firstFinished);
    const attempts = await Promise.all(requests);
    pauseLease.mockRestore();
    expect(atLease).toBe(2);
    const accepted = attempts.filter(response => response.status === 201);
    expect(accepted).toHaveLength(1);
    const { new_id: child } = await accepted[0].json();
    expect(hold().map(({ id: _, ...row }) => row)).toEqual(lines.map((line, index) => ({
      invoice_id: index === 0 ? child : id, product_id: line.product_id, held_grams: 50, expires_at: deadline,
    })));
    expect(seq().invoice_seq).toBe(startSeq + 1);
    expect(invoice(db, child).source_inquiry_id).toBe(invoice(db, id).source_inquiry_id);
    expect(ledger(db, id)).toEqual(expect.arrayContaining([
      { status: 'claimed', amount_usd: 42 }, { status: 'confirmed', amount_usd: 5 },
    ]));
    expect(ledger(db, child)).toEqual([]);
    const tracking = await buyerRequest(db, `/api/inquiries/${body.tracking_token}`);
    expect((await tracking.json()).invoice_id).toBe(id);
    const after = snapshot();
    expect([400, 409]).toContain((await split()).status);
    expect(snapshot()).toEqual(after);
  });

  it('keeps split children on the same private order, buyer, deadline, and payment ledger', async () => {
    const { db, body, id, split, hold } = await reviewedOrderForSplit();
    db.sqlite.exec(`
      UPDATE accounts SET owner_user_id='owner-a' WHERE id='shop-a';
      INSERT INTO contributors(id,account_id,user_id,display_name,is_published)
      VALUES ('seller','shop-a','owner-a','Seller',1);
      INSERT INTO payment_methods(id,contributor_id,method_type,label,recipient_name,account_identifier,is_published)
      VALUES ('bank','seller','bank_transfer','Transfer','Seller','SYNTHETIC',1);
    `);
    const originalDeadline = hold()[0].expires_at;
    const splitResponse = await split();
    expect(splitResponse.status).toBe(201);
    const { new_id: child } = await splitResponse.json();
    const path = `/api/inquiries/${body.tracking_token}`;
    const group = await buyerRequest(db, path);
    const original = await group.json();
    expect(original.invoice_id).toBe(id);
    expect(original.invoices.map((invoice: any) => invoice.invoice_id).sort()).toEqual([id, child].sort());
    const childRead = await buyerRequest(db, `${path}?invoice=${child}`);
    const childView = await childRead.json();
    expect(childRead.status).toBe(200);
    expect(childView).toMatchObject({
      invoice_id: child, payment: { total_usd: 14, payment_deadline: originalDeadline, pay_url: expect.any(String) },
      invoice_items: [{ quantity: 50, quantity_unit: 'g' }],
    });
    expect(JSON.stringify(childView)).not.toContain('SYNTHETIC');
    const foreign = (await create(db, orderPayload('shop-b'))).result.invoice_id;
    expect((await buyerRequest(db, `${path}?invoice=${foreign}`)).status).toBe(404);
    expect((await buyerRequest(db, `${path}?invoice=unknown`)).status).toBe(404);

    const report = (invoiceId: string) => worker.fetch(new Request(`https://app.test/api/orders/${body.tracking_token}/payment-claim`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.17' },
      body: JSON.stringify({ invoice_id: invoiceId, amount_usd: 5 }),
    }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect((await report(foreign)).status).toBe(404);
    expect((await report(child)).status).toBe(201);
    expect(ledger(db, id)).toEqual([]);
    expect(ledger(db, child)).toEqual([{ status: 'claimed', amount_usd: 5 }]);
    const edited = await admin(db, 'shop-a', `/api/invoices/${child}`, { notes: 'Child reviewed' }, 'PUT');
    expect(edited.status).toBe(200);
    const reserve = await admin(db, 'shop-a', '/api/rpc/reserve-stock', { invoice_id: child });
    expect(reserve.status).toBe(200);
    expect(hold().every(row => row.expires_at === originalDeadline)).toBe(true);
    expect((await admin(db, 'shop-a', `/api/invoices/${child}`, { status: 'Draft' }, 'PUT')).status).toBe(200);
    expect((await admin(db, 'shop-a', `/api/invoices/${child}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
    expect(hold().every(row => row.expires_at === originalDeadline)).toBe(true);
    expect(invoice(db, child).order_payment_deadline).toBe(originalDeadline);

    seedIdentity(db, { userId: 'buyer', accountId: 'buyer-home' });
    seedIdentity(db, { userId: 'other-buyer', accountId: 'other-home' });
    for (let attempt = 0; attempt < 2; attempt++) {
      expect((await buyerRequest(db, `${path}/claim`, 'buyer', 'POST')).status).toBe(200);
    }
    expect((await buyerRequest(db, `${path}/claim`, 'other-buyer', 'POST')).status).toBe(409);
    expect((await buyerRequest(db, `/api/me/orders/${child}`, 'buyer')).status).toBe(200);
    expect((await buyerRequest(db, `/api/me/orders/${child}`, 'other-buyer')).status).toBe(404);
    const adminList = await admin(db, 'shop-a', '/api/invoices', undefined, 'GET');
    expect((await adminList.json()).filter((row: any) => [id, child].includes(row.id)))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ id, website_order_reference: body.ref_number }),
        expect.objectContaining({ id: child, website_order_reference: body.ref_number }),
      ]));

    db.sqlite.prepare("UPDATE stock_holds SET expires_at=datetime('now','-1 minute') WHERE invoice_id IN (?,?)").run(id, child);
    const expired = await (await buyerRequest(db, `${path}?invoice=${child}`)).json();
    expect(expired.payment).toMatchObject({ pay_url: null, hold_expired: true });
    expect((await admin(db, 'shop-a', '/api/rpc/reserve-stock', { invoice_id: child })).status).toBe(409);
    const oldPay = new URL(childView.payment.pay_url);
    const share = oldPay.searchParams.get('t');
    const recipient = oldPay.pathname.split('/').filter(Boolean).at(-2);
    expect((await buyerRequest(db, `/api/public/people/${recipient}/payment-methods?t=${share}`)).status).toBe(409);
    expect((await report(child)).status).toBe(201);
    expect(stockMovements(db, child)).toEqual([]);
    db.sqlite.prepare('DELETE FROM stock_holds WHERE invoice_id=?').run(child);
    expect((await admin(db, 'shop-a', `/api/invoices/${child}`, { notes: 'Expired child edited' }, 'PUT')).status).toBe(200);
    expect((await admin(db, 'shop-a', '/api/rpc/reserve-stock', { invoice_id: child })).status).toBe(409);
  });

  it('confirms and refunds a split child once without moving the original payment or stock', async () => {
    const { db, body, id, split } = await reviewedOrderForSplit();
    const response = await split();
    expect(response.status).toBe(201);
    const { new_id: child } = await response.json();
    const payments = `/api/invoices/${child}/payments`;
    const partial = await admin(db, 'shop-a', payments, { amount_usd: 5, method_label: 'Transfer', request_id: 'child-part' });
    expect(partial.status).toBe(201);
    expect(await partial.json()).toMatchObject({ payment_status: 'partial', outstanding_usd: 9 });
    expect(stockMovements(db, child)).toEqual([]);
    const final = { amount_usd: 9, method_label: 'Transfer', request_id: 'child-final' };
    expect((await admin(db, 'shop-a', payments, final)).status).toBe(201);
    expect((await admin(db, 'shop-a', payments, final)).status).toBe(200);
    expect(stockMovements(db, child)).toEqual([{ delta: -50, balance_after: 950, account_id: 'shop-a', movement_unit: 'gram' }]);
    expect(ledger(db, id)).toEqual([]);
    expect(stockMovements(db, id)).toEqual([]);
    const cancel = () => admin(db, 'shop-a', '/api/rpc/cancel-invoice', { invoice_id: child });
    expect((await cancel()).status).toBe(200);
    expect((await cancel()).status).toBe(200);
    const refund = { amount_usd: 14, request_id: 'child-refund' };
    expect((await admin(db, 'shop-a', `/api/invoices/${child}/refunds`, refund)).status).toBe(201);
    expect((await admin(db, 'shop-a', `/api/invoices/${child}/refunds`, refund)).status).toBe(200);
    const view = await buyerRequest(db, `/api/inquiries/${body.tracking_token}?invoice=${child}`);
    expect(await view.json()).toMatchObject({ order: { status: 'Void', refunded_usd: 14, refund_due_usd: 0 } });
    expect(stockMovements(db, child)).toEqual([
      { delta: -50, balance_after: 950, account_id: 'shop-a', movement_unit: 'gram' },
      { delta: 50, balance_after: 1000, account_id: 'shop-a', movement_unit: 'gram' },
    ]);
    expect(stockMovements(db, id)).toEqual([]);
  });

  it('preserves one order identity through a second split of a child', async () => {
    const { db, body, id, lines, hold } = await reviewedOrderForSplit();
    const deadline = hold()[0].expires_at;
    const split = (invoiceId: string, selected: string[]) => admin(db, 'shop-a', '/api/rpc/split-invoice', {
      invoice_id: invoiceId, line_item_ids: selected,
    });
    const first = await split(id, [String(lines[0].id), String(lines[1].id)]);
    expect(first.status).toBe(201);
    const { new_id: child } = await first.json();
    const second = await split(child, [String(lines[0].id)]);
    expect(second.status).toBe(201);
    const { new_id: grandchild } = await second.json();
    const response = await buyerRequest(db, `/api/inquiries/${body.tracking_token}`);
    expect((await response.json()).invoices.map((row: any) => row.invoice_id).sort())
      .toEqual([id, child, grandchild].sort());
    expect(hold().every(row => row.expires_at === deadline)).toBe(true);
    expect(invoice(db, grandchild)).toMatchObject({
      source_inquiry_id: invoice(db, id).source_inquiry_id,
      order_payment_deadline: deadline,
    });
  });

  it('requires a confirmed US quote before operator acceptance and keeps absent shipping out of checkout', async () => {
    const db = seed('migrations');
    const { result } = await create(db, orderPayload('shop-a', 'us@example.test', {
      us_shipping_postcode: '90012', delivery_address: '12 Synthetic Lane',
      customer_location: 'Los Angeles, CA 90012, United States',
    }));
    expect(result).toMatchObject({ shipping_quote_requested: true });
    expect(result).not.toHaveProperty('shipping_checkout');
    const id = result.invoice_id;
    const pending = await admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT');
    expect(pending.status).toBe(409);
    expect(await pending.json()).toMatchObject({ code: 'shipping_quote_required' });
    expect(invoice(db, id).status).toBe('Draft');
    expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { shipping_cost_usd: 6 }, 'PUT')).status).toBe(200);
    expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
    expect(invoice(db, id)).toMatchObject({ shipping_cost_usd: 6, shipping_quote_status: 'confirmed', fulfillment_method: 'us_shipping' });
    const { result: free } = await create(db, orderPayload('shop-a', 'free@example.test', { delivery_country: 'US' }));
    expect(free).toMatchObject({ shipping_quote_requested: true });
    expect((await admin(db, 'shop-a', `/api/invoices/${free.invoice_id}`, {
      shipping_cost_usd: 0, status: 'Pending',
    }, 'PUT')).status).toBe(200);
    expect(invoice(db, free.invoice_id)).toMatchObject({ shipping_cost_usd: 0, shipping_quote_status: 'confirmed' });
  });

  it('refuses pickup from a store outside Bali', async () => {
    const response = await publicOrder(seed(), orderPayload('shop-b', 'guest@example.test', { pickup: true }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'In-person pickup is available in Bali only.' });
  });

  it.each(['expired', 'incomplete', 'expired during batch', 'paid'] as const)(
    'refuses a %s reviewed split without changing invoices, holds, or number sequence',
    async state => {
      const { db, id, lines, split, snapshot } = await reviewedOrderForSplit();
      const expire = () => db.sqlite.prepare("UPDATE stock_holds SET expires_at=strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 second') WHERE invoice_id=?").run(id);
      if (state === 'expired') expire();
      if (state === 'incomplete') db.sqlite.prepare('DELETE FROM stock_holds WHERE invoice_id=? AND product_id=?').run(id, lines[0].product_id);
      if (state === 'paid') {
        const paid = await admin(db, 'shop-a', `/api/invoices/${id}/payments`, { amount_usd: 42, method_label: 'Cash' });
        expect(paid.status).toBe(201);
        expect(await paid.json()).toMatchObject({ payment_status: 'paid' });
      }
      const before = snapshot();
      if (state === 'expired during batch') {
        const batch = db.batch.bind(db);
        vi.spyOn(db, 'batch').mockImplementationOnce(statements => {
          expire();
          return batch(statements);
        });
      }
      const response = await split();
      expect(response.status).toBe(409);
      if (state === 'expired during batch') {
        const after = snapshot();
        expect({ ...after, holds: before.holds }).toEqual(before);
        expect(after.holds.map(({ expires_at: _, ...row }) => row)).toEqual(before.holds.map(({ expires_at: _, ...row }) => row));
      } else {
        expect(snapshot()).toEqual(before);
      }
    },
  );

  it('denies a foreign account and invalid subsets before a reviewed split can write', async () => {
    const { lines, split, snapshot } = await reviewedOrderForSplit();
    const before = snapshot();
    expect((await split([lines[0].id], 'shop-b')).status).toBe(404);
    expect((await split([lines[0].id, lines[0].id])).status).toBe(400);
    expect((await split(lines.map(line => line.id))).status).toBe(400);
    expect((await split(['foreign-line'])).status).toBe(400);
    expect(snapshot()).toEqual(before);
  });

  it('releases expired stock on the same UTC date and keeps late payments from taking another order’s stock', async () => {
    const db = seed('migrations');
    db.sqlite.prepare("UPDATE products SET stock_grams=100 WHERE id='tea-a'").run();
    const first = orderPayload('shop-a', 'held@example.test');
    const second = orderPayload('shop-a', 'next@example.test');
    for (const body of [first, second]) body.items[0] = { ...body.items[0], quantityGrams: 75, packs: 3 };
    const firstId = (await create(db, first)).result.invoice_id;
    const secondId = (await create(db, second)).result.invoice_id;
    const accept = (id: string) => admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT');
    const available = async () => (await admin(db, 'shop-a', '/api/stock/available?product_id=tea-a', undefined, 'GET')).json();
    expect((await accept(firstId)).status).toBe(200);
    expect((await accept(secondId)).status).toBe(409);
    db.sqlite.prepare("UPDATE stock_holds SET expires_at=strftime('%Y-%m-%dT00:00:00.000Z','now') WHERE invoice_id=?").run(firstId);
    expect(await available()).toEqual({ stock_grams: 100, held_grams: 0, available_grams: 100 });
    expect((await accept(secondId)).status).toBe(200);
    expect(await available()).toEqual({ stock_grams: 100, held_grams: 75, available_grams: 25 });
    const payment = await admin(db, 'shop-a', `/api/invoices/${firstId}/payments`,
      { amount_usd: 21, method_label: 'Cash', request_id: 'late-overlap-payment' });
    expect(payment.status).toBe(201);
    expect(await payment.json()).toMatchObject({ payment_status: 'paid', stock: { state: 'blocked' } });
    expect(ledger(db, firstId)).toEqual([{ status: 'confirmed', amount_usd: 21 }]);
    expect(stockMovements(db, firstId)).toEqual([]);
    expect(stockMovements(db, secondId)).toEqual([]);
    expect((await admin(db, 'shop-a', '/api/rpc/cancel-invoice', { invoice_id: secondId })).status).toBe(200);
    expect(await available()).toEqual({ stock_grams: 100, held_grams: 0, available_grams: 100 });
    expect(stockMovements(db, secondId)).toEqual([]);
  });

  it('offers payment only during the reviewed stock hold and still accepts an already-sent report', async () => {
    const db = seed('migrations');
    seedIdentity(db, { userId: 'buyer', accountId: 'buyer-home' });
    db.sqlite.exec(`
      INSERT INTO contributors(id,account_id,user_id,display_name,is_published)
      VALUES ('review-seller','shop-a','owner-a','Review seller',1);
      INSERT INTO payment_methods(id,contributor_id,method_type,label,recipient_name,account_identifier,is_published)
      VALUES ('review-bank','review-seller','bank_transfer','Bank transfer','Review seller','Synthetic bank reference',1);
    `);
    const { body, result } = await create(db);
    const id = result.invoice_id;
    const trackingPath = `/api/inquiries/${body.tracking_token}`;
    const readTracking = () => buyerRequest(db, trackingPath).then(r => r.json());
    const orderPath = `/api/me/orders/${id}`;
    expect((await buyerRequest(db, `${trackingPath}/claim`, 'buyer', 'POST')).status).toBe(200);
    const share = () => admin(db, 'shop-a', `/api/invoices/${id}/pay-link`, {});
    expect((await share()).status).toBe(409);
    expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending', shipping_cost_usd: 6 }, 'PUT')).status).toBe(200);
    const hold = db.sqlite.prepare('SELECT expires_at FROM stock_holds WHERE invoice_id=?');
    const { expires_at: expiresAt } = hold.get(id)!;
    const [tracking, owned] = await Promise.all([buyerRequest(db, trackingPath), buyerRequest(db, orderPath, 'buyer')]);
    expect([tracking.status, owned.status]).toEqual([200, 200]);
    const live = await tracking.json();
    expect(live.payment).toMatchObject({ pay_url: expect.any(String), outstanding_usd: 20 });
    expect((await owned.json()).payment.pay_url).toBe(live.payment.pay_url);
    const token = new URL(live.payment.pay_url).searchParams.get('t');
    const profilePath = '/api/public/people/review-seller';
    expect((await buyerRequest(db, `${profilePath}/pay-access?t=${token}`, 'buyer')).status).toBe(200);

    db.sqlite.prepare("UPDATE stock_holds SET expires_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE invoice_id=?").run(id);
    const expired = await readTracking();
    expect(expired.payment).toMatchObject({ pay_url: null, hold_expired: true, outstanding_usd: 20 });
    expect(expired.journey).toMatchObject({ label: 'Stock hold expired', detail: 'Contact the store before sending payment.' });
    expect((await buyerRequest(db, orderPath, 'buyer').then(r => r.json())).payment).toMatchObject({ pay_url: null, hold_expired: true });
    expect(await (await share()).json()).toMatchObject({ code: 'invoice_hold_expired' });
    for (const path of ['pay-access', 'payment-methods']) {
      for (const user of [undefined, 'buyer']) {
        const stale = await buyerRequest(db, `${profilePath}/${path}?t=${token}`, user);
        expect(stale.status).toBe(409);
        expect(await stale.json()).toMatchObject({ code: 'invoice_hold_expired' });
      }
    }
    expect((await buyerRequest(db, `${profilePath}/payment-methods`, 'buyer')).status).toBe(200);
    expect((await buyerRequest(db, `${profilePath}/payment-methods`)).status).toBe(403);

    const late = await buyerRequest(db, `/api/orders/${body.tracking_token}/payment-claim`, undefined, 'POST');
    expect(late.status).toBe(201);
    const reported = await readTracking();
    expect(reported.payment).toMatchObject({ pay_url: null, paid_usd: 0, claims_pending: 1 });
    expect(reported.journey.detail).toContain('We will confirm it once it reaches the account.');
    expect(ledger(db, id)).toEqual([{ status: 'claimed', amount_usd: 20 }]);
    expect(stock(db)).toBe(1000);
    expect(stockMovements(db, id)).toEqual([]);

    expect(live.payment.payment_deadline).toBe(expiresAt);

    // Released/cleaned rows must not bring the pay link back.
    db.sqlite.prepare('DELETE FROM stock_holds WHERE invoice_id=?').run(id);
    expect((await readTracking()).payment).toMatchObject({ pay_url: null, hold_expired: true });
  });

  it('rolls back the invoice and request if the notification row cannot be queued', async () => {
    const db = seed();
    db.sqlite.exec(`CREATE TRIGGER reject_order_outbox BEFORE INSERT ON order_whatsapp_outbox
      BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END;`);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await publicOrder(db, orderPayload('shop-a', '+628123456789', { whatsapp_confirmation_consent: true }))).status).toBe(500);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM inquiries').get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM order_whatsapp_outbox').get()).toEqual({ n: 0 });
    error.mockRestore();
  });

  it('requires an approximate destination for website orders without changing other inquiry sources', async () => {
    const db = seed();
    const body = orderPayload('shop-a', 'guest@example.com', { customer_location: '   ' });
    const missing = await publicOrder(db, body);
    expect(missing.status).toBe(400);
    expect(await missing.json()).toMatchObject({ error: 'Approximate delivery location is required' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM inquiries').get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({ n: 0 });
    const legacy = await publicOrder(db, { ...body, source: 'whatsapp' });
    expect(legacy.status).toBe(201);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM inquiries').get()).toEqual({ n: 1 });
  });

  it('deducts stock once at confirmed full payment, then requires added shipping balance before shipment', async () => {
    const db = seed();
    const { result } = await create(db);
    const id = result.invoice_id;
    expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
    expect((await admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: id })).status).toBe(409);
    const part = await admin(db, 'shop-a', `/api/invoices/${id}/payments`, { amount_usd: 6, method_label: 'Cash' });
    expect(part.status).toBe(201);
    expect((await part.json()).payment_status).toBe('partial');
    expect(stock(db)).toBe(1000);
    expect(invoice(db, id).inventory_deducted).toBe(0);

    const paid = await admin(db, 'shop-a', `/api/invoices/${id}/payments`, { amount_usd: 8, method_label: 'Cash' });
    expect(paid.status).toBe(201);
    expect((await paid.json()).stock).toMatchObject({ state: 'deducted' });
    expect(stock(db)).toBe(950);
    expect(invoice(db, id)).toMatchObject({ status: 'Pending', inventory_deducted: 1, fulfilled_at: null });
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM stock_ledger WHERE source_invoice_id = ? AND reason = 'PAYMENT_CONFIRMED'").get(id)).toEqual({ n: 1 });

    expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { shipping_cost_usd: 3 }, 'PUT')).status).toBe(200);
    expect(stock(db)).toBe(950);
    expect((await admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: id })).status).toBe(409);
    const shipping = await admin(db, 'shop-a', `/api/invoices/${id}/payments`, { amount_usd: 3, method_label: 'Cash' });
    expect(shipping.status).toBe(201);
    expect((await shipping.json()).stock).toMatchObject({ state: 'already_deducted' });
    expect(stock(db)).toBe(950);
    const shipped = await admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: id, tracking_number: 'TRACK-123' });
    expect(shipped.status).toBe(200);
    expect(invoice(db, id)).toMatchObject({ status: 'Filled', tracking_number: 'TRACK-123', inventory_deducted: 1 });
    expect(stock(db)).toBe(950);
    expect((await admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: id })).status).toBe(200);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM stock_ledger WHERE source_invoice_id = ? AND reason = 'PAYMENT_CONFIRMED'").get(id)).toEqual({ n: 1 });
  });

  it('shows a seeded paid dispatch to its buyer and preserves tracking and stock on replay', async () => {
    const { db, id, trackingPath, orderPath } = await seedPaidOrder();
    const dispatchPath = '/api/rpc/ship-invoice';
    const details = { invoice_id: id, tracking_number: 'TRACK-FIXTURE-001' };
    expect((await admin(db, 'shop-b', dispatchPath, details)).status).toBe(404);

    const shipped = await admin(db, 'shop-a', dispatchPath, details);
    expect(shipped.status).toBe(200);
    const shipment = await shipped.json() as { shipped_at: string };
    expect(shipment).toMatchObject({ success: true, tracking_number: details.tracking_number });
    const replay = await admin(db, 'shop-a', dispatchPath, details);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ idempotent: true, shipped_at: shipment.shipped_at });
    const owner = await admin(db, 'shop-a', '/api/invoices', undefined, 'GET');
    expect(owner.status).toBe(200);
    expect(await owner.json()).toMatchObject([{
      id, status: 'Filled', tracking_number: details.tracking_number, fulfilled_at: shipment.shipped_at,
    }]);

    const buyer = await buyerRequest(db, orderPath, 'buyer');
    expect(buyer.status).toBe(200);
    expect(await buyer.json()).toMatchObject({
      id, account_id: 'shop-a', status: 'Filled', tracking_number: details.tracking_number,
    });
    expect((await buyerRequest(db, orderPath, 'other-buyer')).status).toBe(404);
    const tracking = await buyerRequest(db, trackingPath);
    expect(tracking.status).toBe(200);
    expect(await tracking.json()).toMatchObject({
      invoice_id: id, order: { status: 'Filled', tracking_number: details.tracking_number },
    });
    expect(stock(db)).toBe(950);
    expect(stock(db, 'shop-b')).toBe(1000);
    expect(stockMovements(db, id)).toEqual([
      { delta: -50, balance_after: 950, account_id: 'shop-a', movement_unit: 'gram' },
    ]);
  });

  it('restores stock once and records partial and full refunds for a seeded paid cancellation', async () => {
    const { db, id, orderPath } = await seedPaidOrder();
    const cancel = () => admin(db, 'shop-a', '/api/rpc/cancel-invoice', { invoice_id: id });
    const refundPath = `/api/invoices/${id}/refunds`;
    const firstRefund = { amount_usd: 5, request_id: 'fixture-refund-1' };
    const finalRefund = { amount_usd: 9, request_id: 'fixture-refund-2' };
    expect((await admin(db, 'shop-a', refundPath, firstRefund)).status).toBe(409);
    const cancelled = await cancel();
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toMatchObject({ refund_required: true });
    const cancelledReplay = await cancel();
    expect(cancelledReplay.status).toBe(200);
    expect(await cancelledReplay.json()).toMatchObject({ idempotent: true, refund_required: true });
    expect((await admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: id })).status).toBe(409);
    expect((await admin(db, 'shop-b', refundPath, firstRefund)).status).toBe(409);

    const partial = await admin(db, 'shop-a', refundPath, firstRefund);
    expect(partial.status).toBe(201);
    expect(await partial.json()).toMatchObject({ refunded_usd: 5, refund_due_usd: 9, refund_required: true });
    const buyerPartial = await buyerRequest(db, orderPath, 'buyer');
    expect(buyerPartial.status).toBe(200);
    expect(await buyerPartial.json()).toMatchObject({
      status: 'Void', refunded_usd: 5, refund_due_usd: 9, refund_required: true,
    });
    expect((await admin(db, 'shop-a', refundPath, { ...finalRefund, amount_usd: 9.01 })).status).toBe(409);
    const complete = await admin(db, 'shop-a', refundPath, finalRefund);
    expect(complete.status).toBe(201);
    const completed = await complete.json() as { id: string };
    expect(completed).toMatchObject({ refunded_usd: 14, refund_due_usd: 0, refund_required: false });
    const replay = await admin(db, 'shop-a', refundPath, finalRefund);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ id: completed.id, idempotent: true, refunded_usd: 14, refund_due_usd: 0 });
    expect((await admin(db, 'shop-a', refundPath, { ...finalRefund, amount_usd: 8 })).status).toBe(409);
    const closedRefund = { id, status: 'Void', refunded_usd: 14, refund_due_usd: 0 };
    const owner = await admin(db, 'shop-a', '/api/invoices', undefined, 'GET');
    expect(owner.status).toBe(200);
    expect(await owner.json()).toMatchObject([{ ...closedRefund, refund_required: 0 }]);
    const buyerComplete = await buyerRequest(db, orderPath, 'buyer');
    expect(buyerComplete.status).toBe(200);
    expect(await buyerComplete.json()).toMatchObject({ ...closedRefund, refund_required: false });
    expect((await buyerRequest(db, orderPath, 'other-buyer')).status).toBe(404);
    expect(db.sqlite.prepare('SELECT amount_usd, account_id FROM invoice_refunds WHERE invoice_id=? ORDER BY amount_usd').all(id))
      .toEqual([{ amount_usd: 5, account_id: 'shop-a' }, { amount_usd: 9, account_id: 'shop-a' }]);
    expect(ledger(db, id)).toEqual([{ status: 'confirmed', amount_usd: 14 }]);
    expect(stock(db)).toBe(1000);
    expect(stock(db, 'shop-b')).toBe(1000);
    expect(stockMovements(db, id)).toEqual([
      { delta: -50, balance_after: 950, account_id: 'shop-a', movement_unit: 'gram' },
      { delta: 50, balance_after: 1000, account_id: 'shop-a', movement_unit: 'gram' },
    ]);
  });

  it('unpaid cancellation releases holds, while paid cancellation preserves money and marks a refund', async () => {
    const db = seed();
    const unpaid = (await create(db)).result.invoice_id;
    expect((await admin(db, 'shop-a', `/api/invoices/${unpaid}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_holds WHERE invoice_id = ?').get(unpaid)).toEqual({ n: 1 });
    const declined = await admin(db, 'shop-a', '/api/rpc/cancel-invoice', { invoice_id: unpaid });
    expect(declined.status).toBe(200);
    expect(await declined.json()).toMatchObject({ success: true, refund_required: false });
    expect(invoice(db, unpaid)).toMatchObject({ status: 'Void', refund_required: 0 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM stock_holds WHERE invoice_id = ?').get(unpaid)).toEqual({ n: 0 });
    expect(stock(db)).toBe(1000);
    expect((await admin(db, 'shop-a', '/api/rpc/cancel-invoice', { invoice_id: unpaid })).status).toBe(200);

    const paidId = (await create(db)).result.invoice_id;
    expect((await admin(db, 'shop-a', `/api/invoices/${paidId}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
    expect((await admin(db, 'shop-a', `/api/invoices/${paidId}/payments`, { amount_usd: 14, method_label: 'Cash' })).status).toBe(201);
    expect(stock(db)).toBe(950);
    const cancelled = await admin(db, 'shop-a', '/api/rpc/cancel-invoice', { invoice_id: paidId });
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toMatchObject({ success: true, refund_required: true });
    expect(invoice(db, paidId)).toMatchObject({ status: 'Void', refund_required: 1, inventory_deducted: 0 });
    expect(ledger(db, paidId)).toMatchObject([{ status: 'confirmed', amount_usd: 14 }]);
    expect(stock(db)).toBe(1000);
    expect((await admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: paidId })).status).toBe(409);
  });

  it('keeps confirmed payment when stock becomes unavailable and supports one safe stock retry', async () => {
    const db = seed();
    const id = (await create(db)).result.invoice_id;
    expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
    db.sqlite.prepare('UPDATE products SET stock_grams = 10 WHERE id = ?').run('tea-a');
    const payment = await admin(db, 'shop-a', `/api/invoices/${id}/payments`, { amount_usd: 14, method_label: 'Cash' });
    expect(payment.status).toBe(201);
    expect(ledger(db, id)).toMatchObject([{ status: 'confirmed', amount_usd: 14 }]);
    expect(invoice(db, id)).toMatchObject({ inventory_deducted: 0, status: 'Pending' });
    expect(stock(db)).toBe(10);
    expect((await admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: id })).status).toBe(409);
    db.sqlite.prepare('UPDATE products SET stock_grams = 100 WHERE id = ?').run('tea-a');
    const retry = await admin(db, 'shop-a', '/api/rpc/retry-paid-stock', { invoice_id: id });
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ stock: { state: 'deducted' } });
    expect(stock(db)).toBe(50);
    const again = await admin(db, 'shop-a', '/api/rpc/retry-paid-stock', { invoice_id: id });
    expect(again.status).toBe(200);
    expect(await again.json()).toMatchObject({ stock: { state: 'already_deducted' } });
    expect(stock(db)).toBe(50);
  });

  it('keeps repeated concurrent payment, shipment, and cancellation actions to one stock movement', async () => {
    const db = seed();
    const { body, result } = await create(db);
    const id = result.invoice_id;
    expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
    const claimResponse = await worker.fetch(new Request(`https://app.test/api/orders/${body.tracking_token}/payment-claim`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.201' },
      body: JSON.stringify({ amount: 14, currency: 'USD', method: 'Bank transfer' }),
    }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect(claimResponse.status).toBe(201);
    const claim = await claimResponse.json() as { claim_id: string };
    const confirmations = await Promise.all([
      admin(db, 'shop-a', `/api/invoice-payments/${claim.claim_id}/confirm`),
      admin(db, 'shop-a', `/api/invoice-payments/${claim.claim_id}/confirm`),
    ]);
    expect(confirmations.map(response => response.status)).toEqual([200, 200]);
    expect(ledger(db, id)).toMatchObject([{ status: 'confirmed', amount_usd: 14 }]);
    expect(stock(db)).toBe(950);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM stock_ledger WHERE source_invoice_id = ? AND reason = 'PAYMENT_CONFIRMED'").get(id)).toEqual({ n: 1 });

    const shipments = await Promise.all([
      admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: id }),
      admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: id }),
    ]);
    expect(shipments.every(response => response.status === 200 || response.status === 409)).toBe(true);
    expect(invoice(db, id).status).toBe('Filled');
    expect(stock(db)).toBe(950);

    const other = (await create(db)).result.invoice_id;
    const cancellations = await Promise.all([
      admin(db, 'shop-a', '/api/rpc/cancel-invoice', { invoice_id: other }),
      admin(db, 'shop-a', '/api/rpc/cancel-invoice', { invoice_id: other }),
    ]);
    expect(cancellations.every(response => response.status === 200 || response.status === 409)).toBe(true);
    expect(invoice(db, other)).toMatchObject({ status: 'Void', refund_required: 0 });
    expect(stock(db)).toBe(950);
  });

  it('uses a manual payment request ID once across concurrent calls and a fresh request context', async () => {
    const db = seed();
    const id = (await create(db)).result.invoice_id;
    expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
    const body = { amount_usd: 14, method_label: 'Cash', request_id: 'order-payment-once-001' };
    const responses = await Promise.all([
      admin(db, 'shop-a', `/api/invoices/${id}/payments`, body),
      admin(db, 'shop-a', `/api/invoices/${id}/payments`, body),
    ]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
    const receipts = await Promise.all(responses.map(response => response.json() as Promise<Record<string, any>>));
    expect(receipts[0].payment_id).toBe(receipts[1].payment_id);
    // admin() builds a new request and Worker environment each time; this replay
    // checks durable D1 idempotency rather than an in-memory request cache.
    const replay = await admin(db, 'shop-a', `/api/invoices/${id}/payments`, body);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ payment_id: receipts[0].payment_id, idempotent: true });
    const changed = await admin(db, 'shop-a', `/api/invoices/${id}/payments`, { ...body, amount_usd: 13 });
    expect(changed.status).toBe(409);
    expect(ledger(db, id)).toMatchObject([{ status: 'confirmed', amount_usd: 14 }]);
    expect(stock(db)).toBe(950);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM stock_ledger WHERE source_invoice_id = ? AND reason = 'PAYMENT_CONFIRMED'").get(id)).toEqual({ n: 1 });
  });

  it('resumes paid stock deduction on the same payment request ID after a shortage', async () => {
    const db = seed();
    const id = (await create(db)).result.invoice_id;
    expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
    db.sqlite.prepare('UPDATE products SET stock_grams = 10 WHERE id = ?').run('tea-a');
    const body = { amount_usd: 14, method_label: 'Cash', request_id: 'stock-recovery-payment-001' };
    const first = await admin(db, 'shop-a', `/api/invoices/${id}/payments`, body);
    expect(first.status).toBe(201);
    const firstReceipt = await first.json() as Record<string, any>;
    expect(firstReceipt.stock.state).toBe('blocked');
    expect(invoice(db, id).inventory_deducted).toBe(0);
    expect(ledger(db, id)).toMatchObject([{ status: 'confirmed', amount_usd: 14 }]);

    db.sqlite.prepare('UPDATE products SET stock_grams = 100 WHERE id = ?').run('tea-a');
    const replay = await admin(db, 'shop-a', `/api/invoices/${id}/payments`, body);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      payment_id: firstReceipt.payment_id, idempotent: true, stock: { state: 'deducted' },
    });
    expect(invoice(db, id).inventory_deducted).toBe(1);
    expect(stock(db)).toBe(50);
    const repeated = await admin(db, 'shop-a', `/api/invoices/${id}/payments`, body);
    expect(repeated.status).toBe(200);
    expect(await repeated.json()).toMatchObject({ payment_id: firstReceipt.payment_id, idempotent: true });
    expect(ledger(db, id)).toHaveLength(1);
    expect(stock(db)).toBe(50);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM stock_ledger WHERE source_invoice_id = ? AND reason = 'PAYMENT_CONFIRMED'").get(id)).toEqual({ n: 1 });
  });

  it('rejects confirmation after cancellation and preserves a refund marker when payment races cancellation', async () => {
    const db = seed();
    const { body, result } = await create(db);
    const id = result.invoice_id;
    expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
    const claimed = await worker.fetch(new Request(`https://app.test/api/orders/${body.tracking_token}/payment-claim`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.211' },
      body: JSON.stringify({ amount: 14, currency: 'USD', method: 'Bank transfer' }),
    }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect(claimed.status).toBe(201);
    const { claim_id: claimId } = await claimed.json() as { claim_id: string };
    expect((await admin(db, 'shop-a', '/api/rpc/cancel-invoice', { invoice_id: id })).status).toBe(200);
    const lateConfirmation = await admin(db, 'shop-a', `/api/invoice-payments/${claimId}/confirm`);
    expect(lateConfirmation.status).toBe(409);
    expect(invoice(db, id)).toMatchObject({ status: 'Void', refund_required: 0 });
    expect(ledger(db, id)).toMatchObject([{ status: 'claimed', amount_usd: 14 }]);
    expect((await admin(db, 'shop-a', `/api/invoices/${id}/payments`, {
      amount_usd: 14, method_label: 'Cash', request_id: 'void-payment-001',
    })).status).toBe(409);

    const racingId = (await create(db)).result.invoice_id;
    expect((await admin(db, 'shop-a', `/api/invoices/${racingId}`, { status: 'Pending' }, 'PUT')).status).toBe(200);
    const [payment, cancellation] = await Promise.all([
      admin(db, 'shop-a', `/api/invoices/${racingId}/payments`, {
        amount_usd: 14, method_label: 'Cash', request_id: 'racing-payment-001',
      }),
      admin(db, 'shop-a', '/api/rpc/cancel-invoice', { invoice_id: racingId }),
    ]);
    expect([200, 201, 409]).toContain(payment.status);
    expect([200, 409]).toContain(cancellation.status);
    const final = invoice(db, racingId);
    const confirmed = ledger(db, racingId).filter(row => row.status === 'confirmed');
    if (final.status === 'Void') {
      expect(final.refund_required).toBe(confirmed.length > 0 ? 1 : 0);
    }
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoice_payments WHERE invoice_id = ?').get(racingId))
      .toEqual({ n: confirmed.length });
  });

  it('ships an approved zero-total giveaway with one stock deduction and holds a short-stock giveaway', async () => {
    const db = seed();
    const makeGiveaway = async () => {
      const id = (await create(db)).result.invoice_id as string;
      const edited = await admin(db, 'shop-a', `/api/invoices/${id}/items`, {
        lineItems: [{ product_id: 'tea-a', custom_name: 'Red tea giveaway', quantity: 50, price_at_sale: 0 }],
      }, 'PUT');
      expect(edited.status, JSON.stringify(await edited.clone().json())).toBe(200);
      expect((await admin(db, 'shop-a', `/api/invoices/${id}`, {
        status: 'Pending', allow_unpriced_lines: true,
      }, 'PUT')).status).toBe(200);
      return id;
    };

    const id = await makeGiveaway();
    expect(stock(db)).toBe(1000);
    expect((await admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: id })).status).toBe(200);
    expect(invoice(db, id)).toMatchObject({ status: 'Filled', inventory_deducted: 1 });
    expect(stock(db)).toBe(950);
    expect((await admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: id })).status).toBe(200);
    expect(stock(db)).toBe(950);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS n FROM stock_ledger WHERE source_invoice_id = ? AND reason = 'PAYMENT_CONFIRMED'").get(id)).toEqual({ n: 1 });

    const shortId = await makeGiveaway();
    db.sqlite.prepare('UPDATE products SET stock_grams = 10 WHERE id = ?').run('tea-a');
    expect((await admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: shortId })).status).toBe(409);
    expect(invoice(db, shortId)).toMatchObject({ status: 'Pending', inventory_deducted: 0 });
    expect(stock(db)).toBe(10);
  });

  it('does not allow one shop to edit, ship, or cancel another shop’s order', async () => {
    const db = seed();
    const { result } = await create(db, orderPayload('shop-b', '+628123456789', { whatsapp_confirmation_consent: true }));
    const id = result.invoice_id;
    expect(invoice(db, id).account_id).toBe('shop-b');
    const ownItems = await admin(db, 'shop-b', `/api/invoices/${id}/items`, undefined, 'GET');
    expect(ownItems.status).toBe(200);
    expect(await ownItems.json()).toMatchObject([{ product_id: 'tea-b', quantity: 50, quantity_unit: 'g' }]);
    const foreignItems = await admin(db, 'shop-a', `/api/invoices/${id}/items`, undefined, 'GET');
    expect(foreignItems.status).toBe(404);
    expect((await admin(db, 'shop-b', '/api/rpc/ship-invoice', { invoice_id: id })).status).toBe(409);
    expect((await admin(db, 'shop-a', `/api/invoices/${id}`, { shipping_cost_usd: 99 }, 'PUT')).status).toBe(404);
    expect((await admin(db, 'shop-a', '/api/rpc/ship-invoice', { invoice_id: id })).status).toBe(404);
    expect((await admin(db, 'shop-a', '/api/rpc/cancel-invoice', { invoice_id: id })).status).toBe(404);
    expect(invoice(db, id)).toMatchObject({ account_id: 'shop-b', status: 'Draft', shipping_cost_usd: 0 });
    expect(db.sqlite.prepare('SELECT account_id FROM order_whatsapp_outbox WHERE invoice_id = ?').get(id)).toEqual({ account_id: 'shop-b' });
    const crossShopItem = orderPayload('shop-a');
    crossShopItem.items[0].id = 'tea-b';
    expect((await publicOrder(db, crossShopItem)).status).toBe(400);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({ n: 1 });
  });
});
