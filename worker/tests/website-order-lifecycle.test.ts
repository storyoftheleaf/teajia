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

function seed() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner-a', accountId: 'shop-a', bundles: ['sell'] });
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
    source: 'website', store_slug: account,
    tracking_token: `privatewebsiteordertoken000000000000${String(id).padStart(2, '0')}`,
    ref_number: `TJ-WEB-${id}`, customer_name: 'Guest', customer_contact: contact,
    customer_location: 'Ubud, Indonesia', currency: 'USD', total_estimate_usd: 1,
    items: [{ id: account === 'shop-a' ? 'tea-a' : 'tea-b', name: 'Red tea', category: 'tea',
      storeSlug: account, quantityGrams: 50, packGrams: 25, packs: 2,
      pricePerGram: 0.001, totalPrice: 0.01 }],
    ...overrides,
  };
}

function publicOrder(db: SqliteD1, body: Record<string, unknown>) {
  return worker.fetch(new Request('https://app.test/api/inquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET, INQUIRY_LIMITER: { limit: async () => ({ success: true }) } } as never, {} as never);
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

describe('website order lifecycle', () => {
  it('atomically creates one server-priced Draft, request, and owner outbox without a payment method', async () => {
    const db = seed();
    const body = orderPayload('shop-a', '+628123456789', { total_estimate_usd: 0 });
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

  it('rolls back the invoice and request if the notification row cannot be queued', async () => {
    const db = seed();
    db.sqlite.exec(`CREATE TRIGGER reject_order_outbox BEFORE INSERT ON order_whatsapp_outbox
      BEGIN SELECT RAISE(ABORT, 'outbox unavailable'); END;`);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await publicOrder(db, orderPayload())).status).toBe(500);
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
    expect(invoice(db, paidId)).toMatchObject({ status: 'Void', refund_required: 1, inventory_deducted: 1 });
    expect(ledger(db, paidId)).toMatchObject([{ status: 'confirmed', amount_usd: 14 }]);
    expect(stock(db)).toBe(950);
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
    const { result } = await create(db, orderPayload('shop-b'));
    const id = result.invoice_id;
    expect(invoice(db, id).account_id).toBe('shop-b');
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
