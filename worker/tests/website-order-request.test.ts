import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import { inquiryPhone, quoteInquiryLine } from '../src/inquiryDomain';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const TOKEN = 'privatewebsiteordertoken00000000000001';
const SECRET = 'website-test-secret';
const databases: SqliteD1[] = [];
afterEach(() => {
  vi.unstubAllGlobals();
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
    DB: db, JWT_SECRET: SECRET,
    ...(mail ? { SENDER_EMAIL: 'store@example.com', RESEND_API_KEY: 'test-key' } : {}),
  } as never, {} as never);
}

async function convert(db: SqliteD1, id: string) {
  const token = await signedToken(SECRET, { sub: 'owner', email: 'owner@test.dev', active_account_id: 'shop', role: 'owner' });
  return worker.fetch(new Request(`https://app.test/api/inquiries/${id}/convert`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'shop' },
  }), { DB: db, JWT_SECRET: SECRET } as never, {} as never);
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
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 503 })));
    const response = await create(db, payload(), true);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ email_sent: false });
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
});
