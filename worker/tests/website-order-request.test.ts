import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { inquiryPhone, quoteInquiryLine } from '../src/inquiryDomain';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const TOKEN = 'privatewebsiteordertoken00000000000001';
const SECRET = 'website-test-secret';
const databases: SqliteD1[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  databases.splice(0).forEach(db => db.close());
});

function seed(payable = true) {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop', bundles: ['sell'] });
  db.sqlite.exec(`
    UPDATE accounts SET default_shipping_rate_per_kg = 0, default_shipping_rate_currency = 'USD' WHERE id = 'shop';
    INSERT OR REPLACE INTO exchange_rates (currency, rate_to_usd) VALUES ('USD', 1);
    INSERT INTO products (id, account_id, type, product_name, form, cost_amount, cost_currency, quantity_purchased, stock_grams)
    VALUES ('tea', 'shop', 'Red', 'Red tea', 'Loose', 20, 'USD', 300, 1000);
  `);
  if (payable) db.sqlite.exec(`
    INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
    VALUES ('recipient', 'shop', 'owner', 'Tea house', 1);
    INSERT INTO payment_methods (id, contributor_id, method_type, label, recipient_name, position, is_published)
    VALUES ('method', 'recipient', 'bank_transfer', 'Bank', 'Tea house', 0, 1);
  `);
  return db;
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    source: 'website', store_slug: 'shop', tracking_token: TOKEN, ref_number: 'TJ-WEBSITE',
    customer_name: 'Guest', customer_contact: 'guest@example.com', customer_location: 'Ubud, Indonesia',
    currency: 'USD', total_estimate_usd: 14,
    items: [{ id: 'tea', name: 'Red tea', category: 'tea', storeSlug: 'shop', quantityGrams: 50, packGrams: 25, packs: 2, pricePerGram: 0.2, totalPrice: 14 }],
    ...overrides,
  };
}

function create(db: SqliteD1, body = payload(), mail = false) {
  return worker.fetch(new Request('https://app.test/api/inquiries', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }), {
    DB: db, JWT_SECRET: SECRET, INQUIRY_LIMITER: { limit: async () => ({ success: true }) },
    ...(mail ? { SENDER_EMAIL: 'store@example.com', RESEND_API_KEY: 'test-key' } : {}),
  } as never, {} as never);
}

async function admin(db: SqliteD1, path: string, method = 'GET', body?: unknown) {
  const token = await signedToken(SECRET, { sub: 'owner', email: 'owner@test.dev', active_account_id: 'shop', role: 'owner' });
  return worker.fetch(new Request(`https://app.test${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'shop', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
}

function convert(db: SqliteD1, id: string) {
  return admin(db, `/api/inquiries/${id}/convert`, 'POST');
}

async function trackedOrder(db: SqliteD1) {
  const response = await worker.fetch(new Request(`https://app.test/api/inquiries/${TOKEN}`),
    { DB: db, JWT_SECRET: SECRET } as never, {} as never);
  expect(response.status).toBe(200);
  return response.json() as Promise<any>;
}

describe('website order requests', () => {
  it('requires an email and refuses a store that cannot be paid', async () => {
    const db = seed(false);
    expect((await create(db, payload({ customer_contact: '+628123456789' }))).status).toBe(400);
    expect((await create(db)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM inquiries').get()).toEqual({ n: 0 });
  });

  it('saves once, keeps location apart from contact, and permits delivery-channel retries', async () => {
    const db = seed();
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = await create(db);
    expect(first.status).toBe(201);
    expect(await first.json()).toMatchObject({ success: true, email_sent: false, tracking_token: TOKEN });
    const row = db.sqlite.prepare('SELECT phone, message, tracking_token_hash FROM inquiries').get() as any;
    expect(row.phone).toBeNull();
    expect(row.message).toContain('Shipping location: Ubud, Indonesia');
    expect(row.tracking_token_hash).not.toBe(TOKEN);
    const replay = await create(db, payload({ source: 'whatsapp' }));
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ idempotent: true });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM inquiries').get()).toEqual({ n: 1 });
    expect(warnings.mock.calls).toEqual([
      ['order_request_email_unconfigured', { accountId: 'shop', reference: 'TJ-WEBSITE' }],
    ]);
  });

  it('awaits receipts, carries a private tracking link, and does not resend on retry', async () => {
    const db = seed();
    const messages: any[] = [];
    let releaseReceipt!: () => void;
    const receipt = new Promise<void>(resolve => { releaseReceipt = resolve; });
    const fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      messages.push(body);
      if (body.to === 'guest@example.com') await receipt;
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetch);
    let finished = false;
    const pending = create(db, payload(), true).then(response => { finished = true; return response; });
    await vi.waitFor(() => expect(messages).toHaveLength(2));
    expect(finished).toBe(false);
    releaseReceipt();
    expect(await (await pending).json()).toMatchObject({ email_sent: true });
    const customer = messages.find(message => message.to === 'guest@example.com');
    expect(customer.html).toContain(`/order/${TOKEN}`);
    expect(customer.html).toContain('2 × 25 g');
    expect(customer.reply_to).toBe('store@example.com');
    await create(db, payload(), true);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the saved request when email fails and reports no email success', async () => {
    const db = seed();
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    const response = await create(db, payload(), true);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ email_sent: false });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM inquiries').get()).toEqual({ n: 1 });
    expect(warnings.mock.calls).toEqual([
      ['order_request_store_email_failed', { accountId: 'shop', reference: 'TJ-WEBSITE' }],
    ]);
  });

  it('reports the store notification failure separately from a successful customer receipt', async () => {
    const db = seed();
    const warnings = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const { to } = JSON.parse(init.body);
      return new Response('{}', { status: to === 'guest@example.com' ? 200 : 503 });
    }));
    const response = await create(db, payload(), true);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ success: true, email_sent: true });
    // Exact arguments ensure no customer's name, contact, message or private
    // tracking token is accidentally written to the operational warning log.
    expect(warnings.mock.calls).toEqual([
      ['order_request_store_email_failed', { accountId: 'shop', reference: 'TJ-WEBSITE' }],
    ]);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM inquiries').get()).toEqual({ n: 1 });
  });

  it('recomputes invoice packs from catalogue prices and ignores forged client amounts', async () => {
    const db = seed();
    const body = payload();
    body.items[0].pricePerGram = 0;
    body.items[0].totalPrice = 0;
    const saved = await (await create(db, body)).json() as any;
    const response = await convert(db, saved.id);
    expect(response.status).toBe(200);
    const result = await response.json() as any;
    const line = db.sqlite.prepare('SELECT product_id, custom_name, quantity, price_at_sale FROM invoice_line_items WHERE invoice_id = ?').get(result.invoice_id) as any;
    expect(line.product_id).toBe('tea');
    expect(line.custom_name).toContain('2 × 25 g');
    expect(line.quantity).toBe(50);
    expect(line.quantity * line.price_at_sale).toBeCloseTo(14);
    const invoice = db.sqlite.prepare('SELECT customer_whatsapp, notes FROM invoices WHERE id = ?').get(result.invoice_id) as any;
    expect(invoice.customer_whatsapp).toBeNull();
    expect(invoice.notes).toContain('guest@example.com');
    expect((await convert(db, saved.id)).status).toBe(409);
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({ n: 1 });
  });

  it('rejects inconsistent pack counts before saving', async () => {
    const db = seed();
    const body = payload();
    body.items[0].packs = 3;
    expect((await create(db, body)).status).toBe(400);
  });

  it('does not convert a missing exchange rate into handling-only pricing', async () => {
    const db = seed();
    const saved = await (await create(db)).json() as any;
    db.sqlite.exec("UPDATE products SET cost_currency = 'MISSING' WHERE id = 'tea'");
    const response = await convert(db, saved.id);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Product price is unavailable' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({ n: 0 });
  });

  it('does not treat a missing catalogue price as zero or a city as a phone', () => {
    expect(() => quoteInquiryLine(payload().items[0], { type: 'Red', retail_price_per_gram_usd: null })).toThrow('unavailable');
    expect(inquiryPhone('Ubud, Indonesia')).toBeNull();
    expect(inquiryPhone('+62 812-3456-7890')).toBe('+62 812-3456-7890');
    expect(quoteInquiryLine({ ...payload().items[0], packGrams: 100, packs: 2, quantityGrams: 200 }, {
      type: 'Red', retail_price_per_gram_usd: 0.2, form: 'Box', piece_weight_g: 100, sold_in_whole_units: 1,
    })).toBe(40);
  });

  it('carries one website request through the real admin, payment and fulfillment routes', async () => {
    const db = seed();
    // No live network, email provider, accounts or orders participate in this rehearsal.
    const network = vi.fn(async () => { throw new Error('Unexpected external request'); });
    vi.stubGlobal('fetch', network);

    const created = await create(db);
    expect(created.status).toBe(201);
    const request = await created.json() as any;
    const inbox = await admin(db, '/api/admin/inquiries');
    expect(inbox.status).toBe(200);
    const { inquiries } = await inbox.json() as any;
    expect(inquiries).toHaveLength(1);
    expect(inquiries[0]).toMatchObject({
      id: request.id, source: 'website', email: 'guest@example.com', phone: null,
      items: [{ id: 'tea', packGrams: 25, packs: 2, quantityGrams: 50, totalPrice: 14 }],
    });
    expect(await trackedOrder(db)).toMatchObject({ journey: { stage: 'received' }, payment: null });

    const converted = await convert(db, request.id);
    expect(converted.status).toBe(200);
    const { invoice_id: invoiceId } = await converted.json() as any;
    expect(await trackedOrder(db)).toMatchObject({
      journey: { stage: 'confirmed' }, payment: { total_usd: 14 },
    });

    // Staff agrees a $3 delivery amount and sends the draft. No SQL status shortcuts.
    const sent = await admin(db, `/api/invoices/${invoiceId}`, 'PUT', { status: 'Pending', shipping_cost_usd: 3 });
    expect(sent.status).toBe(200);
    const orderList = await admin(db, '/api/invoices');
    expect(orderList.status).toBe(200);
    expect(await orderList.json()).toMatchObject([
      { id: invoiceId, status: 'Pending', shipping_cost_usd: 3, payment: { total_usd: 17 } },
    ]);
    const due = await trackedOrder(db);
    expect(due.journey.stage).toBe('awaiting_payment');
    expect(due.payment).toMatchObject({ total_usd: 17, paid_usd: 0, outstanding_usd: 17 });
    expect(new URL(due.payment.pay_url).searchParams.get('amount')).toBe('17.00');
    const payToken = new URL(due.payment.pay_url).searchParams.get('t');
    expect(payToken).toMatch(/^[a-f0-9]{32}$/);
    // The guest's order link opens protected payment details without signing in.
    const paymentMethods = '/api/public/people/recipient/payment-methods';
    const blocked = await worker.fetch(new Request(`https://app.test${paymentMethods}`),
      { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect(blocked.status).toBe(403);
    const opened = await worker.fetch(new Request(`https://app.test${paymentMethods}?t=${payToken}`),
      { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect(opened.status).toBe(200);
    expect(await opened.json()).toMatchObject({ payment_methods: [{ id: 'method', recipient_name: 'Tea house' }] });

    // A guest uses only the private tracking token to report a first transfer.
    const reported = await worker.fetch(new Request(`https://app.test/api/orders/${TOKEN}/payment-claim`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.201' },
      body: JSON.stringify({ amount: 6, currency: 'USD', method: 'Bank transfer' }),
    }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
    expect(reported.status).toBe(201);
    const claim = await reported.json() as any;
    expect(await trackedOrder(db)).toMatchObject({
      journey: { stage: 'awaiting_payment' }, payment: { paid_usd: 0, outstanding_usd: 17, claims_pending: 1 },
    });
    const confirmed = await admin(db, `/api/invoice-payments/${claim.claim_id}/confirm`, 'POST');
    expect(confirmed.status).toBe(200);
    const partPaid = await trackedOrder(db);
    expect(partPaid.journey.stage).toBe('part_paid');
    expect(partPaid.payment).toMatchObject({ paid_usd: 6, outstanding_usd: 11, claims_pending: 0 });
    expect(new URL(partPaid.payment.pay_url).searchParams.get('amount')).toBe('11.00');

    const remainder = await admin(db, `/api/invoices/${invoiceId}/payments`, 'POST', {
      amount_usd: 11, method_label: 'Cash', reference: 'Local rehearsal',
    });
    expect(remainder.status).toBe(201);
    expect(await trackedOrder(db)).toMatchObject({
      journey: { stage: 'paid' }, payment: { total_usd: 17, paid_usd: 17, outstanding_usd: 0, pay_url: null },
    });

    const fulfilled = await admin(db, '/api/rpc/fulfill-invoice', 'POST', { invoice_id: invoiceId });
    expect(fulfilled.status).toBe(200);
    const complete = await trackedOrder(db);
    expect(complete).toMatchObject({
      ref_number: request.ref_number, journey: { stage: 'sent', label: 'Fulfilled' },
      payment: { total_usd: 17, paid_usd: 17, outstanding_usd: 0, pay_url: null },
    });
    expect(JSON.parse(complete.items_json)[0]).toMatchObject({ packGrams: 25, packs: 2, quantityGrams: 50 });
    expect(db.sqlite.prepare('SELECT stock_grams FROM products WHERE id = ?').get('tea')).toEqual({ stock_grams: 950 });
    expect((await admin(db, '/api/rpc/fulfill-invoice', 'POST', { invoice_id: invoiceId })).status).toBe(409);
    expect(db.sqlite.prepare('SELECT stock_grams FROM products WHERE id = ?').get('tea')).toEqual({ stock_grams: 950 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM invoices').get()).toEqual({ n: 1 });
    expect(network).not.toHaveBeenCalled();
  });
});
