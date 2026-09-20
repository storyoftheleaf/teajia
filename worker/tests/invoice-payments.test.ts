import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * The payment ledger, driven through the real worker against real SQL.
 *
 * This is money, so the sequence below walks the whole path rather than the
 * happy half of it: a report changes nothing, a report above the balance is
 * refused, confirming moves the order to partial and then to paid across two
 * payments, the pay link asks for the balance and then disappears, rejecting a
 * confirmed payment puts the order back, and confirming the same payment twice
 * counts it once.
 */

const SECRET = 'invoice-payments-secret';
const ACCOUNT = 'account-a';
const OWNER = 'owner-a';
const INVOICE = 'invoice-a';
// 32 to 128 url-safe characters, the shape isValidTrackingToken accepts.
const TOKEN = 'trackingtoken0000000000000000000000001';

const databases: SqliteD1[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function tokenHashOf(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function seed(): Promise<SqliteD1> {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner' });
  // worker/schema.sql is behind migrations/0000 on both of these columns, and
  // the ownership predicate for GET /api/me/orders reads both. Added here
  // rather than widening schema.sql, which is a separate drift to fix.
  try { db.sqlite.exec('ALTER TABLE customers ADD COLUMN user_id TEXT'); } catch { /* already there */ }
  try { db.sqlite.exec('ALTER TABLE users ADD COLUMN phone TEXT'); } catch { /* already there */ }

  db.sqlite.prepare(
    `INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
     VALUES ('tea-master', ?, ?, 'Adrian', 1)`
  ).run(ACCOUNT, OWNER);
  db.sqlite.prepare(
    `INSERT INTO payment_methods
       (id, contributor_id, account_id, method_type, label, recipient_name, position, is_published)
     VALUES ('pm-1', 'tea-master', NULL, 'bank_transfer', 'Bank transfer', 'Adrian', 0, 1)`
  ).run();

  db.sqlite.prepare(
    `INSERT INTO customers (id, account_id, name, email, user_id)
     VALUES ('cust-a', ?, 'Mei', 'mei@test.dev', ?)`
  ).run(ACCOUNT, OWNER);

  // 30.00 of tea plus 5.00 shipping. There is no total column on invoices.
  db.sqlite.prepare(
    `INSERT INTO invoices
       (id, account_id, invoice_number, customer_name, customer_id, display_currency,
        shipping_cost_usd, status, payment_status, payment_recipient_user_id)
     VALUES (?, ?, 'TJ-00001', 'Mei', 'cust-a', 'USD', 5, 'Pending', 'unpaid', ?)`
  ).run(INVOICE, ACCOUNT, OWNER);
  db.sqlite.prepare(
    `INSERT INTO invoice_line_items (id, account_id, invoice_id, custom_name, quantity, price_at_sale)
     VALUES ('line-a', ?, ?, 'Da Hong Pao', 30, 1)`
  ).run(ACCOUNT, INVOICE);

  db.sqlite.prepare(
    `INSERT INTO inquiries
       (id, account_id, name, email, items, total_usd, currency, status,
        ref_number, tracking_token_hash, converted_invoice_id)
     VALUES ('inq-a', ?, 'Mei', 'mei@test.dev', '[]', 35, 'USD', 'replied', 'REF-1', ?, ?)`
  ).run(ACCOUNT, await tokenHashOf(TOKEN), INVOICE);

  return db;
}

function env(db: SqliteD1) {
  return { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any;
}

async function admin(db: SqliteD1, path: string, options: { method?: string; body?: unknown } = {}) {
  const token = await signedToken(SECRET, {
    sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER,
    active_account_id: ACCOUNT, platform_role: null,
  });
  const headers = new Headers({ Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  }), env(db));
}

async function claim(db: SqliteD1, body: unknown, ip = '203.0.113.1') {
  return worker.fetch(new Request(`https://worker.test/api/orders/${TOKEN}/payment-claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  }), env(db));
}

/** The payment block as the customer's own order page sees it. */
async function trackedPayment(db: SqliteD1) {
  const response = await worker.fetch(
    new Request(`https://worker.test/api/inquiries/${TOKEN}`), env(db),
  );
  const body = await response.json() as any;
  return body.payment;
}

function storedInvoice(db: SqliteD1) {
  return db.sqlite.prepare(
    'SELECT payment_status, payment_date, payment_method FROM invoices WHERE id = ?'
  ).get(INVOICE) as Record<string, any>;
}

function payAmount(payUrl: string | null): string | null {
  return payUrl ? new URL(payUrl).searchParams.get('amount') : null;
}

describe('invoice payment ledger', () => {
  it('prices an unpaid order and asks for the whole total', async () => {
    const db = await seed();
    const payment = await trackedPayment(db);
    expect(payment.total_usd).toBe(35);
    expect(payment.paid_usd).toBe(0);
    expect(payment.outstanding_usd).toBe(35);
    expect(payment.claims_pending).toBe(0);
    expect(payment.tea_line_count).toBe(1);
    expect(payment.has_methods).toBe(true);
    expect(payAmount(payment.pay_url)).toBe('35.00');
    // The link states USD because invoice amounts are USD columns.
    expect(new URL(payment.pay_url).searchParams.get('currency')).toBe('USD');
  });

  it('counts the teas on the invoice and leaves teaware out', async () => {
    const db = await seed();
    db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, type) VALUES ('tea-1', ?, 'Shui Xian', 'Oolong')`).run(ACCOUNT);
    db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, type) VALUES ('pot-1', ?, 'Zini pot', 'Teaware')`).run(ACCOUNT);
    db.sqlite.prepare(
      `INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale) VALUES
         ('line-b', ?, ?, 'tea-1', 25, 1), ('line-c', ?, ?, 'pot-1', 1, 40), ('line-d', ?, ?, 'tea-1', 25, 1)`
    ).run(ACCOUNT, INVOICE, ACCOUNT, INVOICE, ACCOUNT, INVOICE);
    const payment = await trackedPayment(db);
    // Da Hong Pao (a custom line) and Shui Xian (twice, one tea); the pot is not a tea.
    expect(payment.tea_line_count).toBe(2);
  });

  it('records a customer report without moving the order toward paid', async () => {
    const db = await seed();
    const response = await claim(db, { amount: 20, method: 'Bank transfer', reference: 'BCA 8891' }, '203.0.113.2');
    expect(response.status).toBe(201);
    const body = await response.json() as any;
    expect(body.claims_pending).toBe(1);
    expect(body.claim_id).toBeTruthy();

    // The whole point of the boundary: nothing on the invoice moved.
    expect(storedInvoice(db).payment_status).toBe('unpaid');
    expect(storedInvoice(db).payment_date).toBeNull();
    const payment = await trackedPayment(db);
    expect(payment.paid_usd).toBe(0);
    expect(payment.outstanding_usd).toBe(35);
    expect(payment.claims_pending).toBe(1);
    expect(payAmount(payment.pay_url)).toBe('35.00');
  });

  it('refuses a report above the balance and a report of nothing', async () => {
    const db = await seed();
    const tooMuch = await claim(db, { amount: 40 }, '203.0.113.3');
    expect(tooMuch.status).toBe(400);
    expect((await tooMuch.json() as any).code).toBe('amount_above_outstanding');

    const nothing = await claim(db, { amount: 0 }, '203.0.113.4');
    expect(nothing.status).toBe(400);
    const negative = await claim(db, { amount: -5 }, '203.0.113.5');
    expect(negative.status).toBe(400);

    // A cent over the balance is rounding, not a second payment.
    const rounding = await claim(db, { amount: 35.01 }, '203.0.113.6');
    expect(rounding.status).toBe(201);
  });

  it('defaults an omitted amount to the whole outstanding balance', async () => {
    const db = await seed();
    const response = await claim(db, {}, '203.0.113.7');
    expect(response.status).toBe(201);
    const row = db.sqlite.prepare('SELECT amount_usd, status, claimed_by FROM invoice_payments').get() as any;
    expect(row.amount_usd).toBe(35);
    expect(row.status).toBe('claimed');
    expect(row.claimed_by).toBe('customer');
  });

  it('walks unpaid to partial to paid, and the link asks for the balance', async () => {
    const db = await seed();
    await claim(db, { amount: 20, method: 'Bank transfer' }, '203.0.113.8');
    const claimId = (db.sqlite.prepare('SELECT id FROM invoice_payments').get() as any).id;

    const confirmed = await admin(db, `/api/invoice-payments/${claimId}/confirm`, { method: 'POST' });
    expect(confirmed.status).toBe(200);
    const afterConfirm = await confirmed.json() as any;
    expect(afterConfirm.payment_status).toBe('partial');
    expect(afterConfirm.paid_usd).toBe(20);
    expect(afterConfirm.outstanding_usd).toBe(15);
    expect(afterConfirm.claims_pending).toBe(0);
    expect(storedInvoice(db).payment_status).toBe('partial');
    expect(storedInvoice(db).payment_method).toBe('Bank transfer');

    // The single most important line of the round.
    expect(payAmount((await trackedPayment(db)).pay_url)).toBe('15.00');

    const recorded = await admin(db, `/api/invoices/${INVOICE}/payments`, {
      method: 'POST', body: { amount_usd: 15, method_label: 'Cash' },
    });
    expect(recorded.status).toBe(201);
    const afterRecord = await recorded.json() as any;
    expect(afterRecord.payment_status).toBe('paid');
    expect(afterRecord.paid_usd).toBe(35);
    expect(afterRecord.outstanding_usd).toBe(0);
    expect(storedInvoice(db).payment_status).toBe('paid');
    expect(storedInvoice(db).payment_method).toBe('Cash');

    // Nothing outstanding, so no live pay button anywhere.
    const settled = await trackedPayment(db);
    expect(settled.pay_url).toBeNull();
    expect(settled.has_methods).toBe(true);
    expect(settled.recipient_name).toBe('Adrian');
  });

  it('counts a payment once however many times it is confirmed', async () => {
    const db = await seed();
    await claim(db, { amount: 20 }, '203.0.113.9');
    const claimId = (db.sqlite.prepare('SELECT id FROM invoice_payments').get() as any).id;

    const first = await (await admin(db, `/api/invoice-payments/${claimId}/confirm`, { method: 'POST' })).json() as any;
    expect(first.changed).toBe(true);
    expect(first.paid_usd).toBe(20);

    const second = await (await admin(db, `/api/invoice-payments/${claimId}/confirm`, { method: 'POST' })).json() as any;
    expect(second.changed).toBe(false);
    expect(second.paid_usd).toBe(20);
    expect(second.payment_status).toBe('partial');
  });

  it('puts the order back when a confirmed payment is rejected', async () => {
    const db = await seed();
    await claim(db, { amount: 35 }, '203.0.113.10');
    const claimId = (db.sqlite.prepare('SELECT id FROM invoice_payments').get() as any).id;
    await admin(db, `/api/invoice-payments/${claimId}/confirm`, { method: 'POST' });
    expect(storedInvoice(db).payment_status).toBe('paid');

    const rejected = await (await admin(db, `/api/invoice-payments/${claimId}/reject`, { method: 'POST' })).json() as any;
    expect(rejected.changed).toBe(true);
    expect(rejected.payment_status).toBe('unpaid');
    expect(rejected.paid_usd).toBe(0);
    expect(storedInvoice(db).payment_status).toBe('unpaid');
    expect(storedInvoice(db).payment_date).toBeNull();
    expect(payAmount((await trackedPayment(db)).pay_url)).toBe('35.00');

    const rejectedRow = db.sqlite.prepare('SELECT status, confirmed_at FROM invoice_payments WHERE id = ?').get(claimId) as any;
    expect(rejectedRow.status).toBe('rejected');
    expect(rejectedRow.confirmed_at).toBeNull();
  });

  it('absorbs a settlement that was written on the column and nowhere else', async () => {
    // What the MCP mark_invoice_paid tool leaves behind: a paid column with an
    // empty ledger. A later ledger write must not drag the order back.
    const db = await seed();
    db.sqlite.prepare(
      `UPDATE invoices SET payment_status = 'paid', payment_date = '2026-08-01T00:00:00Z',
                           payment_method = 'Wise' WHERE id = ?`
    ).run(INVOICE);

    // Read side: nothing outstanding, so no pay link, even with no ledger rows.
    const before = await trackedPayment(db);
    expect(before.paid_usd).toBe(35);
    expect(before.outstanding_usd).toBe(0);
    expect(before.pay_url).toBeNull();

    // Write side: recording a further payment must not recompute it to partial.
    const recorded = await admin(db, `/api/invoices/${INVOICE}/payments`, {
      method: 'POST', body: { amount_usd: 5, method_label: 'Cash', note: 'shipping top up' },
    });
    expect(recorded.status).toBe(201);
    const after = await recorded.json() as any;
    expect(after.payment_status).toBe('paid');
    expect(after.paid_usd).toBe(40);
    expect(storedInvoice(db).payment_status).toBe('paid');

    const rows = db.sqlite.prepare(
      'SELECT amount_usd, note FROM invoice_payments ORDER BY amount_usd DESC'
    ).all() as any[];
    expect(rows).toHaveLength(2);
    expect(rows[0].amount_usd).toBe(35);
    expect(rows[0].note).toContain('before this was recorded');
  });

  it('lists the payment history for the admin, reports and money together', async () => {
    const db = await seed();
    await claim(db, { amount: 20, reference: 'BCA 8891' }, '203.0.113.11');
    await admin(db, `/api/invoices/${INVOICE}/payments`, { method: 'POST', body: { amount_usd: 15 } });

    const response = await admin(db, `/api/invoices/${INVOICE}/payments`);
    expect(response.status).toBe(200);
    const rows = await response.json() as any[];
    expect(rows).toHaveLength(2);
    expect(rows.map(row => row.status).sort()).toEqual(['claimed', 'confirmed']);
    expect(rows.map(row => row.claimed_by).sort()).toEqual(['customer', 'operator']);
  });

  it('refuses a report on an order belonging to another account', async () => {
    const db = await seed();
    seedIdentity(db, { userId: 'owner-b', accountId: 'account-b', accountSlug: 'account-b', role: 'owner' });
    await claim(db, { amount: 20 }, '203.0.113.12');
    const claimId = (db.sqlite.prepare('SELECT id FROM invoice_payments').get() as any).id;

    const token = await signedToken(SECRET, {
      sub: 'owner-b', email: 'owner-b@test.dev', name: 'owner-b',
      active_account_id: 'account-b', platform_role: null,
    });
    const response = await worker.fetch(new Request(
      `https://worker.test/api/invoice-payments/${claimId}/confirm`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'account-b' } },
    ), env(db));
    expect(response.status).toBe(404);
    expect(storedInvoice(db).payment_status).toBe('unpaid');
  });

  it('takes a report from the signed-in order history too', async () => {
    const db = await seed();
    const token = await signedToken(SECRET, {
      sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER,
      active_account_id: ACCOUNT, platform_role: null,
    });
    const response = await worker.fetch(new Request(
      `https://worker.test/api/me/orders/${INVOICE}/payment-claim`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Teajia-Account': ACCOUNT,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: 12, method: 'Wise' }),
      },
    ), env(db));
    expect(response.status).toBe(201);
    expect((await response.json() as any).claims_pending).toBe(1);
    expect(storedInvoice(db).payment_status).toBe('unpaid');

    const orders = await (await worker.fetch(new Request('https://worker.test/api/me/orders', {
      headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT },
    }), env(db))).json() as any;
    expect(orders.orders[0].payment.claims_pending).toBe(1);
    expect(orders.orders[0].payment.outstanding_usd).toBe(35);
  });

  it("carries a pay link on the customer profile's recent orders", async () => {
    const db = await seed();
    const response = await admin(db, '/api/customers/cust-a/orders');
    expect(response.status).toBe(200);
    const rows = await response.json() as any[];
    expect(rows).toHaveLength(1);
    expect(rows[0].payment.recipient_name).toBe('Adrian');
    expect(payAmount(rows[0].payment.pay_url)).toBe('35.00');
    expect(rows[0].payment.outstanding_usd).toBe(35);
  });

  it('rate limits the unauthenticated report path', async () => {
    const db = await seed();
    const ip = '198.51.100.77';
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      statuses.push((await claim(db, { amount: 1 }, ip)).status);
    }
    expect(statuses.filter(status => status === 201)).toHaveLength(6);
    expect(statuses.at(-1)).toBe(429);
  });
});
