import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * The derived order journey, and the attention queue, driven through the real
 * worker against real SQL. Sibling of invoice-payments.test.ts and built on the
 * same harness.
 *
 * The journey is the fix for the review's worst finding: the customer's page
 * showed four words driven by a status only the operator changes by hand, in a
 * different screen from the one where the order is worked, so an order could be
 * priced, paid and posted while the page still said the request had arrived.
 * The walk below is therefore the whole path rather than the happy half of it,
 * and it asserts a manual word the operator set is never thrown away.
 */

const SECRET = 'order-journey-secret';
const ACCOUNT = 'account-j';
const OWNER = 'owner-j';
const INVOICE = 'invoice-j';
const TOKEN = 'trackingtoken0000000000000000000000002';

const databases: SqliteD1[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function tokenHashOf(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * One customer, one request, one order for 35 dollars. The order starts as a
 * Draft the request became, which is where the journey's second stage lives.
 */
async function seed(): Promise<SqliteD1> {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner' });
  // worker/schema.sql is behind migrations/0000 on both of these, and the
  // ownership predicate for GET /api/me/orders reads both. Added here rather
  // than widening schema.sql, matching invoice-payments.test.ts.
  try { db.sqlite.exec('ALTER TABLE customers ADD COLUMN user_id TEXT'); } catch { /* already there */ }
  try { db.sqlite.exec('ALTER TABLE users ADD COLUMN phone TEXT'); } catch { /* already there */ }

  db.sqlite.prepare(
    `INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
     VALUES ('tea-master-j', ?, ?, 'Adrian', 1)`
  ).run(ACCOUNT, OWNER);
  db.sqlite.prepare(
    `INSERT INTO payment_methods
       (id, contributor_id, account_id, method_type, label, recipient_name, position, is_published)
     VALUES ('pm-j', 'tea-master-j', NULL, 'bank_transfer', 'Bank transfer', 'Adrian', 0, 1)`
  ).run();
  db.sqlite.prepare(
    `INSERT INTO customers (id, account_id, name, email, user_id)
     VALUES ('cust-j', ?, 'Mei', 'mei@test.dev', ?)`
  ).run(ACCOUNT, OWNER);

  // 30.00 of tea plus 5.00 shipping. There is no total column on invoices.
  db.sqlite.prepare(
    `INSERT INTO invoices
       (id, account_id, invoice_number, customer_name, customer_id, display_currency,
        shipping_cost_usd, status, payment_status, payment_recipient_user_id, created_at)
     VALUES (?, ?, 'TJ-J0001', 'Mei', 'cust-j', 'USD', 5, 'Draft', 'unpaid', ?, '2026-08-01 09:00:00')`
  ).run(INVOICE, ACCOUNT, OWNER);
  db.sqlite.prepare(
    `INSERT INTO invoice_line_items (id, account_id, invoice_id, custom_name, quantity, price_at_sale)
     VALUES ('line-j', ?, ?, 'Da Hong Pao', 30, 1)`
  ).run(ACCOUNT, INVOICE);

  db.sqlite.prepare(
    `INSERT INTO inquiries
       (id, account_id, name, email, items, total_usd, currency, status,
        ref_number, tracking_token_hash, converted_invoice_id, created_at)
     VALUES ('inq-j', ?, 'Mei', 'mei@test.dev', '[]', 35, 'USD', 'replied',
             'REF-J', ?, ?, '2026-07-30 08:00:00')`
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

/** The journey exactly as the customer's own tracking page reads it. */
async function trackedJourney(db: SqliteD1) {
  const response = await worker.fetch(
    new Request(`https://worker.test/api/inquiries/${TOKEN}`), env(db),
  );
  const body = await response.json() as any;
  return body.journey;
}

function setInvoice(db: SqliteD1, columns: Record<string, unknown>) {
  const keys = Object.keys(columns);
  db.sqlite.prepare(
    `UPDATE invoices SET ${keys.map(key => `${key} = ?`).join(', ')} WHERE id = ?`
  ).run(...keys.map(key => columns[key] as any), INVOICE);
}

function setInquiry(db: SqliteD1, columns: Record<string, unknown>) {
  const keys = Object.keys(columns);
  db.sqlite.prepare(
    `UPDATE inquiries SET ${keys.map(key => `${key} = ?`).join(', ')} WHERE id = 'inq-j'`
  ).run(...keys.map(key => columns[key] as any));
}

/** Money the operator has seen, straight into the ledger as confirmed. */
async function recordPayment(db: SqliteD1, amount: number) {
  const response = await admin(db, `/api/invoices/${INVOICE}/payments`, {
    method: 'POST',
    body: { amount_usd: amount, method_label: 'Bank transfer' },
  });
  expect(response.status).toBe(201);
  return response.json() as any;
}

describe('the derived order journey', () => {
  it('says a request has arrived while it is still only a request', async () => {
    const db = await seed();
    setInquiry(db, { converted_invoice_id: null, status: 'new' });
    const journey = await trackedJourney(db);
    expect(journey.stage).toBe('received');
    expect(journey.label).toBe('Request received');
    // The promise the old page made on every order at every stage lives here
    // now, where it is still true.
    expect(journey.detail).toContain('WhatsApp');
    expect(journey.at).toBe('2026-07-30T08:00:00Z');
  });

  it('says the order is confirmed while it is a draft being priced', async () => {
    const db = await seed();
    const journey = await trackedJourney(db);
    expect(journey.stage).toBe('confirmed');
    expect(journey.label).toBe('Order confirmed');
    // The stage moved on from the request's own timestamp to the order's.
    expect(journey.at).toBe('2026-08-01T09:00:00Z');
  });

  it('asks for payment once the order is real and money is owed', async () => {
    const db = await seed();
    setInvoice(db, { status: 'Pending' });
    const journey = await trackedJourney(db);
    expect(journey.stage).toBe('awaiting_payment');
    expect(journey.label).toBe('Awaiting payment');
    expect(journey.detail).toContain('$35.00');
  });

  it('says a payment is on its way while a report sits unconfirmed', async () => {
    const db = await seed();
    setInvoice(db, { status: 'Pending' });
    const reported = await worker.fetch(new Request(
      `https://worker.test/api/orders/${TOKEN}/payment-claim`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.40' },
        body: JSON.stringify({ amount: 35, method: 'Bank transfer' }),
      },
    ), env(db));
    expect(reported.status).toBe(201);

    // The exact moment the review was about: they transferred, they said so,
    // and the balance is still due. The stage does not move, and the words say
    // why rather than leaving them to wonder.
    const journey = await trackedJourney(db);
    expect(journey.stage).toBe('awaiting_payment');
    expect(journey.detail).toContain('told us a payment is on its way');
  });

  it('says part paid after a confirmed part payment, with both figures', async () => {
    const db = await seed();
    setInvoice(db, { status: 'Pending' });
    await recordPayment(db, 20);
    const journey = await trackedJourney(db);
    expect(journey.stage).toBe('part_paid');
    expect(journey.label).toBe('Part paid');
    expect(journey.detail).toContain('$20.00');
    expect(journey.detail).toContain('$15.00');
  });

  it('says paid in full once nothing is outstanding', async () => {
    const db = await seed();
    setInvoice(db, { status: 'Pending' });
    await recordPayment(db, 35);
    const journey = await trackedJourney(db);
    expect(journey.stage).toBe('paid');
    expect(journey.label).toBe('Paid in full');
  });

  it('says sent once the order has been fulfilled', async () => {
    const db = await seed();
    setInvoice(db, { status: 'Filled', fulfilled_at: '2026-08-20T10:00:00.000Z' });
    const journey = await trackedJourney(db);
    expect(journey.stage).toBe('sent');
    expect(journey.label).toBe('Sent');
    expect(journey.at).toBe('2026-08-20T10:00:00.000Z');
  });

  it('closes a voided order in words that cannot be read as a completed one', async () => {
    const db = await seed();
    setInvoice(db, { status: 'Void' });
    const journey = await trackedJourney(db);
    expect(journey.stage).toBe('closed');
    expect(journey.label).toBe('Order cancelled');
    expect(journey.detail).toContain('cancelled');
  });

  it('lets a manual shipped win over a lesser derived stage', async () => {
    const db = await seed();
    // The facts say the order is priced and unpaid. The operator has said it
    // went in the post. Nothing set by hand is thrown away.
    setInvoice(db, { status: 'Pending' });
    expect((await trackedJourney(db)).stage).toBe('awaiting_payment');
    setInquiry(db, { status: 'shipped' });
    const journey = await trackedJourney(db);
    expect(journey.stage).toBe('sent');
    expect(journey.label).toBe('Sent');
  });

  it('lets a manual completed close the order, in different words from a cancellation', async () => {
    const db = await seed();
    setInvoice(db, { status: 'Pending' });
    setInquiry(db, { status: 'completed' });
    const journey = await trackedJourney(db);
    expect(journey.stage).toBe('closed');
    expect(journey.label).toBe('Complete');
    expect(journey.detail).not.toContain('cancelled');
  });

  it('never lets a manual word drag an order backwards', async () => {
    const db = await seed();
    setInvoice(db, { status: 'Filled', fulfilled_at: '2026-08-20T10:00:00.000Z' });
    // 'new' is earlier than everything. The parcel has still been sent.
    setInquiry(db, { status: 'new' });
    expect((await trackedJourney(db)).stage).toBe('sent');
    // And a void order stays cancelled whatever the filing says.
    setInvoice(db, { status: 'Void' });
    setInquiry(db, { status: 'shipped' });
    const journey = await trackedJourney(db);
    expect(journey.stage).toBe('closed');
    expect(journey.label).toBe('Order cancelled');
  });

  it('carries the journey on the signed-in order list and detail', async () => {
    const db = await seed();
    setInvoice(db, { status: 'Pending', customer_whatsapp: null });
    await recordPayment(db, 35);

    const list = await admin(db, '/api/me/orders');
    expect(list.status).toBe(200);
    const orders = (await list.json() as any).orders;
    expect(orders).toHaveLength(1);
    expect(orders[0].journey.stage).toBe('paid');

    const detail = await admin(db, `/api/me/orders/${INVOICE}`);
    expect(detail.status).toBe(200);
    expect((await detail.json() as any).journey.stage).toBe('paid');
  });
});

describe('what needs the tea master', () => {
  /**
   * Four kinds, deliberately interleaved in time so that a list ordered by kind
   * and a list ordered by waiting time come out differently. That difference is
   * the whole value of the surface.
   */
  async function seedFourKinds(): Promise<SqliteD1> {
    const db = await seed();

    // Oldest of all: a request nobody has answered.
    db.sqlite.prepare(
      `INSERT INTO inquiries (id, account_id, name, email, items, total_usd, currency,
                              status, ref_number, created_at)
       VALUES ('inq-wait', ?, 'Lin', 'lin@test.dev', '[]', 12, 'USD', 'new', 'REF-W',
               '2026-07-01 08:00:00')`
    ).run(ACCOUNT);

    // A converted request still sitting as a draft: the seeded order itself.
    // Its created_at is 2026-08-01.

    // Paid and not sent, paid on the 5th.
    db.sqlite.prepare(
      `INSERT INTO invoices (id, account_id, invoice_number, customer_name, display_currency,
                             shipping_cost_usd, status, payment_status, payment_date, created_at)
       VALUES ('inv-unsent', ?, 'TJ-J0002', 'Ravi', 'USD', 0, 'Pending', 'paid',
               '2026-08-05T12:00:00.000Z', '2026-08-04 08:00:00')`
    ).run(ACCOUNT);
    db.sqlite.prepare(
      `INSERT INTO invoice_line_items (id, account_id, invoice_id, custom_name, quantity, price_at_sale)
       VALUES ('line-unsent', ?, 'inv-unsent', 'Shou Mei', 40, 1)`
    ).run(ACCOUNT);

    // Newest: a payment reported on the 25th and not yet looked at.
    db.sqlite.prepare(
      `INSERT INTO invoices (id, account_id, invoice_number, customer_name, display_currency,
                             shipping_cost_usd, status, payment_status, created_at)
       VALUES ('inv-claimed', ?, 'TJ-J0003', 'Sara', 'USD', 0, 'Pending', 'unpaid',
               '2026-08-20 08:00:00')`
    ).run(ACCOUNT);
    db.sqlite.prepare(
      `INSERT INTO invoice_line_items (id, account_id, invoice_id, custom_name, quantity, price_at_sale)
       VALUES ('line-claimed', ?, 'inv-claimed', 'Bai Mu Dan', 50, 1)`
    ).run(ACCOUNT);
    db.sqlite.prepare(
      `INSERT INTO invoice_payments (id, invoice_id, account_id, amount_usd, status,
                                     claimed_by, claimed_at)
       VALUES ('pay-claimed', 'inv-claimed', ?, 50, 'claimed', 'customer', '2026-08-25T09:00:00.000Z')`
    ).run(ACCOUNT);

    return db;
  }

  it('returns all four kinds ordered by waiting time, not grouped by kind', async () => {
    const db = await seedFourKinds();
    const response = await admin(db, '/api/attention');
    expect(response.status).toBe(200);
    const body = await response.json() as any;

    expect(body.counts).toEqual({ requests: 1, unpriced: 1, claims: 1, unsent: 1 });

    // Oldest first, and the kinds interleave rather than clustering.
    expect(body.items.map((item: any) => item.kind))
      .toEqual(['request', 'unpriced', 'unsent', 'claim']);

    const waited = body.items.map((item: any) => item.waiting_since);
    expect([...waited].sort()).toEqual(waited);

    // Each kind waits from its own moment: the request from when it arrived,
    // the unsent order from when the money landed rather than when it was
    // ordered, the claim from when it was reported.
    const by = (kind: string) => body.items.find((item: any) => item.kind === kind);
    expect(by('request').waiting_since).toBe('2026-07-01T08:00:00Z');
    expect(by('unsent').waiting_since).toBe('2026-08-05T12:00:00.000Z');
    expect(by('claim').waiting_since).toBe('2026-08-25T09:00:00.000Z');
  });

  it('names the person or the order, and links somewhere that exists', async () => {
    const db = await seedFourKinds();
    const body = await (await admin(db, '/api/attention')).json() as any;
    const by = (kind: string) => body.items.find((item: any) => item.kind === kind);

    expect(by('request').label).toBe('Order request from Lin');
    expect(by('request').href).toBe('/admin/activity?tab=inquiries');
    expect(by('unpriced').label).toContain('Mei');
    expect(by('claim').label).toBe('Sara reports paying $50.00 on TJ-J0003');
    expect(by('unsent').label).toContain('is paid and not yet sent');

    // Every href is an app path the admin router actually serves.
    for (const item of body.items) {
      expect(item.href.startsWith('/admin/activity?tab=')).toBe(true);
    }
    // meta is lowercase and written to follow a comma.
    for (const item of body.items) {
      expect(item.meta).toMatch(/^waiting /);
    }
  });

  it('leaves out a request that has been answered and an order already sent', async () => {
    const db = await seedFourKinds();
    db.sqlite.prepare("UPDATE inquiries SET status = 'replied' WHERE id = 'inq-wait'").run();
    db.sqlite.prepare(
      "UPDATE invoices SET fulfilled_at = '2026-08-06T00:00:00.000Z' WHERE id = 'inv-unsent'"
    ).run();
    const body = await (await admin(db, '/api/attention')).json() as any;
    expect(body.counts.requests).toBe(0);
    expect(body.counts.unsent).toBe(0);
    expect(body.items.map((item: any) => item.kind)).toEqual(['unpriced', 'claim']);
  });

  it('catches a live order carrying a line with no price', async () => {
    const db = await seedFourKinds();
    // The order the request became, now moved to Pending with a line still at
    // zero. Convert leaves unresolvable items at zero on purpose, so this is
    // how an order reaches a customer asking for too little.
    db.sqlite.prepare("UPDATE invoices SET status = 'Pending' WHERE id = ?").run(INVOICE);
    db.sqlite.prepare("UPDATE invoice_line_items SET price_at_sale = 0 WHERE id = 'line-j'").run();
    const body = await (await admin(db, '/api/attention')).json() as any;
    const unpriced = body.items.filter((item: any) => item.kind === 'unpriced');
    expect(unpriced).toHaveLength(1);
    expect(unpriced[0].label).toContain('has a line with no price');
  });

  it('answers nothing waiting with an empty list and a 200, never with a failure', async () => {
    const db = await seed();
    // The seeded draft came from a request, so clear that link to leave a
    // genuinely quiet account.
    setInquiry(db, { converted_invoice_id: null, status: 'closed' });
    db.sqlite.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ?').run(INVOICE);
    db.sqlite.prepare('DELETE FROM invoices WHERE id = ?').run(INVOICE);
    const response = await admin(db, '/api/attention');
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.items).toEqual([]);
    expect(body.counts).toEqual({ requests: 0, unpriced: 0, claims: 0, unsent: 0 });
  });

  it('refuses a caller with no account rather than answering that all is clear', async () => {
    const db = await seedFourKinds();
    const response = await worker.fetch(
      new Request('https://worker.test/api/attention'), env(db),
    );
    expect(response.status).not.toBe(200);
  });
});

describe('the local figure on the pay link', () => {
  async function seedRupiah(): Promise<SqliteD1> {
    const db = await seed();
    // schema.sql already seeds a live rate table, so this pins the one the
    // assertions below read rather than inserting a second row.
    db.sqlite.prepare(
      `INSERT INTO exchange_rates (currency, rate_to_usd, last_updated)
            VALUES ('IDR', 16000, '2026-08-30 06:00:00')
       ON CONFLICT(currency) DO UPDATE
            SET rate_to_usd = 16000, last_updated = '2026-08-30 06:00:00'`
    ).run();
    setInvoice(db, { status: 'Pending', display_currency: 'IDR' });
    return db;
  }

  async function payUrl(db: SqliteD1): Promise<URL> {
    const response = await worker.fetch(
      new Request(`https://worker.test/api/inquiries/${TOKEN}`), env(db),
    );
    const body = await response.json() as any;
    return new URL(body.payment.pay_url);
  }

  it('asks in dollars and carries the customer own currency alongside', async () => {
    const db = await seedRupiah();
    const url = await payUrl(db);
    // The dollar figure stays the one that is owed.
    expect(url.searchParams.get('amount')).toBe('35.00');
    expect(url.searchParams.get('currency')).toBe('USD');
    expect(url.searchParams.get('display')).toBe('IDR');
  });

  it('carries no display parameter when the order is already priced in dollars', async () => {
    const db = await seed();
    setInvoice(db, { status: 'Pending', display_currency: 'USD' });
    expect((await payUrl(db)).searchParams.get('display')).toBeNull();
  });

  it('carries no display parameter for a currency the pay page would refuse', async () => {
    const db = await seed();
    setInvoice(db, { status: 'Pending', display_currency: 'ZWL' });
    expect((await payUrl(db)).searchParams.get('display')).toBeNull();
  });

  it('converts on the pay page from the live rate, as an approximation with a date', async () => {
    const db = await seedRupiah();
    const url = await payUrl(db);
    const response = await worker.fetch(new Request(
      `https://worker.test/api/public/people/tea-master-j/payment-methods`
      + `?amount=${url.searchParams.get('amount')}&display=${url.searchParams.get('display')}`,
    ), env(db));
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.context.local).toEqual({
      currency: 'IDR',
      // Rupiah is quoted whole, so no cents appear on a figure of this size.
      amount: '560000',
      rate: 16000,
      as_of: '2026-08-30T06:00:00Z',
    });
  });

  it('says nothing rather than guessing when there is no rate to convert with', async () => {
    const db = await seed();
    db.sqlite.prepare("DELETE FROM exchange_rates WHERE currency = 'IDR'").run();
    const response = await worker.fetch(new Request(
      'https://worker.test/api/public/people/tea-master-j/payment-methods?amount=35.00&display=IDR',
    ), env(db));
    const body = await response.json() as any;
    expect(body.context.local).toBeNull();
  });

  it('says nothing when the link is already in dollars', async () => {
    const db = await seedRupiah();
    const response = await worker.fetch(new Request(
      'https://worker.test/api/public/people/tea-master-j/payment-methods?amount=35.00&display=USD',
    ), env(db));
    expect((await response.json() as any).context.local).toBeNull();
  });
});

describe('the payment confirmed email', () => {
  /** A customer report sitting on a priced order, waiting to be confirmed. */
  async function seedClaim(db: SqliteD1) {
    setInvoice(db, { status: 'Pending' });
    const reported = await worker.fetch(new Request(
      `https://worker.test/api/orders/${TOKEN}/payment-claim`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.60' },
        body: JSON.stringify({ amount: 35, method: 'Bank transfer' }),
      },
    ), env(db));
    expect(reported.status).toBe(201);
    return (db.sqlite.prepare('SELECT id FROM invoice_payments').get() as any).id as string;
  }

  async function confirm(db: SqliteD1, paymentId: string, overrides: Record<string, unknown> = {}) {
    const token = await signedToken(SECRET, {
      sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER,
      active_account_id: ACCOUNT, platform_role: null,
    });
    return worker.fetch(new Request(
      `https://worker.test/api/invoice-payments/${paymentId}/confirm`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT },
      },
    ), { ...env(db), ...overrides });
  }

  it('confirms cleanly when Resend is not configured at all', async () => {
    const db = await seed();
    const paymentId = await seedClaim(db);
    const response = await confirm(db, paymentId);
    expect(response.status).toBe(200);
    const body = await response.json() as any;
    expect(body.changed).toBe(true);
    expect(body.payment_status).toBe('paid');
    expect((await trackedJourney(db)).stage).toBe('paid');
  });

  it('confirms even when the mail send itself blows up', async () => {
    const db = await seed();
    const paymentId = await seedClaim(db);
    // With a sender configured the template is built and sendEmail is reached.
    // Money must not depend on a third party answering the phone.
    const realFetch = globalThis.fetch;
    const sent: Array<Record<string, any>> = [];
    globalThis.fetch = (async (input: any, init?: any) => {
      if (String(input).includes('resend.com')) {
        sent.push(JSON.parse(String(init?.body ?? '{}')));
        throw new Error('mail is down');
      }
      return realFetch(input, init);
    }) as typeof fetch;
    try {
      const response = await confirm(db, paymentId, {
        SENDER_EMAIL: 'tea@test.dev',
        SENDER_NAME: 'Teajia',
        RESEND_API_KEY: 'test-key',
      });
      expect(response.status).toBe(200);
      expect((await response.json() as any).payment_status).toBe('paid');
    } finally {
      globalThis.fetch = realFetch;
    }
    // The send was genuinely attempted, so this proves the catch and not an
    // early return that never reached the network. And it went to the customer,
    // whose address the invoice does not carry and which came off the linked
    // customer record.
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('mei@test.dev');
    expect(sent[0].subject).toContain('payment received');
    expect(sent[0].html).toContain('$35.00');
    expect(sent[0].html).toContain('Nothing');
    // And the money landed regardless.
    expect((db.sqlite.prepare(
      'SELECT payment_status FROM invoices WHERE id = ?'
    ).get(INVOICE) as any).payment_status).toBe('paid');
  });
});
