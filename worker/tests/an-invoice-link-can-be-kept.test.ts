import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { invoiceKeepTools } from '../src/mcpTools/invoiceKeep';
import { sha256Hex } from '../src/inquiryDomain';

// An invoice sent by its pay link becomes the buyer's (Adrian, 2026-11-27).
// "Save to my account" on the pay page links the invoice to the signed-in
// person, so it shows in their orders. The first person to keep it wins.

const SECRET = 'an-invoice-link-can-be-kept';
const TOKEN = 'a'.repeat(32);
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function env(db: SqliteD1) {
  return { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any;
}

async function as(db: SqliteD1, userId: string | null, path: string, body?: unknown, flags?: Record<string, string>) {
  const headers = new Headers();
  if (userId) {
    headers.set('Authorization', `Bearer ${await signedToken(SECRET, {
      sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: null, platform_role: null,
    })}`);
  }
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method: body === undefined ? 'GET' : 'POST', headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }), { ...env(db), ...flags });
}

function seed(customerId: string | null = null, customerEmail: string | null = null, schema: 'schema' | 'migrations' = 'schema') {
  const db = new SqliteD1(schema);
  databases.push(db);
  seedIdentity(db, { userId: 'kenji-user', accountId: 'acc-one', role: 'owner' });
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, business_name, is_published, links)
    VALUES ('kenji-tanaka', 'acc-one', 'kenji-user', 'Kenji Tanaka', 'Tanaka Tea House', 1, '[]')`).run();
  db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('kenji-tanaka', 'acc-one')`).run();
  for (const id of ['tia-user', 'sam-user']) {
    db.sqlite.prepare(`INSERT OR IGNORE INTO users (id, email, name, password_hash, role, session_version)
      VALUES (?, ?, ?, 'test', 'user', 0)`).run(id, `${id}@test.dev`, id);
  }
  if (customerId) {
    db.sqlite.prepare(`INSERT INTO customers (id, account_id, name, email) VALUES (?, 'acc-one', 'Tia', ?)`).run(customerId, customerEmail);
  }
  db.sqlite.prepare(`INSERT INTO invoices (id, account_id, invoice_number, status, payment_status, customer_id, customer_name, sold_by_user_id, display_currency)
    VALUES ('inv-1', 'acc-one', 'TJB-00007', 'Draft', 'unpaid', ?, 'Tia', 'kenji-user', 'USD')`).run(customerId);
  db.sqlite.prepare(`INSERT INTO payment_share_links (id, account_id, contributor_id, invoice_id, token)
    VALUES ('link-1', 'acc-one', 'kenji-tanaka', 'inv-1', ?)`).run(TOKEN);
  return db;
}

const KEEP = '/api/public/people/kenji-tanaka/pay-access/keep';
const keptBy = (db: SqliteD1) => db.sqlite.prepare(
  `SELECT user_id FROM pay_invoice_keeps WHERE invoice_id = 'inv-1' AND account_id = 'acc-one'`
).get();

const customerOf = (db: SqliteD1) => db.sqlite.prepare(
  `SELECT i.customer_id, c.user_id FROM invoices i LEFT JOIN customers c
     ON c.id = i.customer_id AND c.account_id = i.account_id WHERE i.id = 'inv-1'`
).get();

const orderIds = async (db: SqliteD1, userId: string) => {
  const list = await (await as(db, userId, '/api/me/orders')).json() as { orders: { id: string }[] };
  return list.orders.map(order => order.id).sort();
};

describe('Save to my account keeps the invoice', () => {
  it('needs an account', async () => {
    const db = seed();
    expect((await as(db, null, KEEP, { token: TOKEN })).status).toBe(401);
    expect(keptBy(db)).toBeUndefined();
  });

  it('refuses a token that is not this invoice link', async () => {
    const db = seed();
    expect((await as(db, 'tia-user', KEEP, { token: 'b'.repeat(32) })).status).toBe(404);
  });

  it('an invoice with no customer joins the person, and pay-access then says kept', async () => {
    const db = seed();
    const before = await (await as(db, 'tia-user', `/api/public/people/kenji-tanaka/pay-access?t=${TOKEN}`)).json() as any;
    expect(before.invoice.kept).toBe(false);

    const response = await as(db, 'tia-user', KEEP, { token: TOKEN });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, invoice_id: 'inv-1', already: false });
    expect(keptBy(db)).toEqual({ user_id: 'tia-user' });
    expect(customerOf(db)).toEqual({ customer_id: null, user_id: null });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM customers').get()).toEqual({ count: 0 });
    expect((db.sqlite.prepare(`SELECT fulfillment_claim_token AS t FROM invoices WHERE id = 'inv-1'`).get() as any).t).toBeNull();

    const after = await (await as(db, 'tia-user', `/api/public/people/kenji-tanaka/pay-access?t=${TOKEN}`)).json() as any;
    expect(after.invoice.kept).toBe(true);

    const again = await as(db, 'tia-user', KEEP, { token: TOKEN });
    expect(await again.json()).toMatchObject({ ok: true, already: true });
  });

  it('lists and opens the saved invoice while leaving the shop customer record unchanged', async () => {
    const db = seed('cust-tia', null, 'migrations');
    db.sqlite.exec(`INSERT INTO invoices (id, account_id, invoice_number, customer_id, status)
        VALUES ('unrelated', 'acc-one', 'TJB-00008', 'cust-tia', 'Draft');
      INSERT INTO customers (id, account_id, name, user_id) VALUES ('owned-customer', 'acc-one', 'Tia', 'tia-user');
      INSERT INTO invoices (id, account_id, invoice_number, customer_id, status)
        VALUES ('buyer-order', 'acc-one', 'TJB-00009', 'owned-customer', 'Draft');`);
    expect((await as(db, 'tia-user', KEEP, { token: TOKEN })).status).toBe(200);
    expect(customerOf(db)).toEqual({ customer_id: 'cust-tia', user_id: null });
    expect(await orderIds(db, 'tia-user')).toEqual(['buyer-order', 'inv-1']);
    expect((await as(db, 'tia-user', '/api/me/orders/inv-1')).status).toBe(200);
  });

  it('recognizes independent ownership without creating a releasable save', async () => {
    const db = seed('cust-tia');
    db.sqlite.exec("UPDATE customers SET user_id = 'tia-user' WHERE id = 'cust-tia'");
    const response = await as(db, 'tia-user', KEEP, { token: TOKEN });
    expect(await response.json()).toMatchObject({ ok: true, already: true });
    expect(keptBy(db)).toBeUndefined();
  });

  it('the first person wins and the next is told it is kept', async () => {
    const db = seed();
    expect((await as(db, 'tia-user', KEEP, { token: TOKEN })).status).toBe(200);
    const second = await as(db, 'sam-user', KEEP, { token: TOKEN });
    expect(second.status).toBe(409);
    expect(keptBy(db)).toEqual({ user_id: 'tia-user' });
  });

  it('records one save when requests reach the invoice together', async () => {
    const db = seed();
    const [first, second] = await Promise.all([
      as(db, 'tia-user', KEEP, { token: TOKEN }),
      as(db, 'sam-user', KEEP, { token: TOKEN }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(db.sqlite.prepare("SELECT COUNT(*) AS count FROM platform_audit_log WHERE action = 'pay_invoice.kept'").get()).toEqual({ count: 1 });
  });

  it('leaves guest tracking available and keeps a split-invoice save local to its portion', async () => {
    const db = seed();
    const tracking = 'synthetic-track-0123456789abcdef0123456789';
    db.sqlite.prepare(`INSERT INTO inquiries (id, account_id, name, email, ref_number, converted_invoice_id, tracking_token_hash)
      VALUES ('order-1', 'acc-one', 'Guest', 'guest@test.dev', 'TJB-REQ-1', 'root-invoice', ?)`).run(await sha256Hex(tracking));
    db.sqlite.exec(`INSERT INTO invoices (id, account_id, invoice_number, source_inquiry_id, status)
      VALUES ('root-invoice', 'acc-one', 'TJB-00006', 'order-1', 'Draft');
      UPDATE invoices SET source_inquiry_id = 'order-1' WHERE id = 'inv-1';`);

    const trackingPath = `/api/inquiries/${tracking}`;
    expect((await as(db, null, trackingPath)).status).toBe(200);
    expect((await as(db, 'tia-user', KEEP, { token: TOKEN })).status).toBe(200);
    expect(await orderIds(db, 'tia-user')).toEqual(['inv-1']);
    expect((await as(db, 'sam-user', `${trackingPath}/claim`, {})).status).toBe(409);
    expect(await orderIds(db, 'sam-user')).toEqual([]);
    expect((await as(db, 'tia-user', `${trackingPath}/claim`, {})).status).toBe(200);
    expect(await orderIds(db, 'tia-user')).toEqual(['inv-1', 'root-invoice']);
  });

  it('the shop that sent it never keeps it, and sees it as its own to send', async () => {
    const db = seed();
    const page = await (await as(db, 'kenji-user', `/api/public/people/kenji-tanaka/pay-access?t=${TOKEN}`)).json() as any;
    expect(page.invoice.yours_to_send).toBe(true);
    const response = await as(db, 'kenji-user', KEEP, { token: TOKEN });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'own_invoice' });
    expect(keptBy(db)).toBeUndefined();

    const buyer = await (await as(db, 'tia-user', `/api/public/people/kenji-tanaka/pay-access?t=${TOKEN}`)).json() as any;
    expect(buyer.invoice.yours_to_send).toBe(false);
  });

  it('staff of the shop do not keep it either', async () => {
    const db = seed();
    db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES ('acc-one', 'sam-user', 'staff', 'active')`).run();
    expect((await as(db, 'sam-user', KEEP, { token: TOKEN })).status).toBe(403);
  });

  it('keeps payment-recipient access and host credit separate from an invoice save', async () => {
    const db = seed();
    db.sqlite.exec("UPDATE invoices SET payment_recipient_user_id = 'sam-user' WHERE id = 'inv-1'");
    expect((await as(db, 'sam-user', KEEP, { token: TOKEN })).status).toBe(403);
    expect((await as(db, 'tia-user', KEEP, { token: TOKEN })).status).toBe(200);
    const credit = await as(db, 'tia-user', '/api/me/tea-credit/orders/inv-1/use', {}, { HOST_CREDIT_OPEN: 'true' });
    expect(credit.status).toBe(404);
    expect(await credit.json()).toMatchObject({ code: 'invoice_not_found' });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS count FROM host_credit_spend_requests').get()).toEqual({ count: 0 });
    expect(db.sqlite.prepare("SELECT payment_recipient_user_id, payment_status FROM invoices WHERE id = 'inv-1'").get())
      .toEqual({ payment_recipient_user_id: 'sam-user', payment_status: 'unpaid' });
  });

  it('an invoice made out to an email is kept only by that email', async () => {
    const db = seed('cust-tia', 'Tia-User@Test.dev');
    const other = await as(db, 'sam-user', KEEP, { token: TOKEN });
    expect(other.status).toBe(403);
    expect(await other.json()).toMatchObject({ code: 'not_your_invoice' });
    expect((await as(db, 'tia-user', KEEP, { token: TOKEN })).status).toBe(200);
    expect(customerOf(db)).toEqual({ customer_id: 'cust-tia', user_id: null });
    expect(keptBy(db)).toEqual({ user_id: 'tia-user' });
  });
});

describe('release_invoice_keep gives a saved invoice back', () => {
  const auth = { accountId: 'acc-one', userId: 'kenji-user', userEmail: 'kenji-user@test.dev', tokenId: 'tok-1', creatorTier: 'account_owner' } as any;
  const release = (db: SqliteD1, args: any) =>
    invoiceKeepTools.handlers.release_invoice_keep({ DB: db } as any, auth, args) as Promise<Record<string, any>>;

  it('puts an invoice the wrong person saved back, so the right one can save it', async () => {
    const db = seed();
    expect((await as(db, 'sam-user', KEEP, { token: TOKEN })).status).toBe(200);
    const preview = await release(db, { invoice_number: 'TJB-00007' });
    expect(preview.preview.saved_by.email).toBe('sam-user@test.dev');
    expect(keptBy(db)).toEqual({ user_id: 'sam-user' });
    const done = await release(db, { invoice_number: 'TJB-00007', confirm: preview.confirmation_token });
    expect(done.committed).toBe(true);
    expect(keptBy(db)).toBeUndefined();
    expect((await as(db, 'sam-user', '/api/me/orders/inv-1')).status).toBe(404);
    expect((await as(db, 'tia-user', KEEP, { token: TOKEN })).status).toBe(200);
    expect(keptBy(db)).toEqual({ user_id: 'tia-user' });
  });

  it('leaves the named customer and its independently verified link intact on release', async () => {
    const db = seed('cust-tia');
    expect((await as(db, 'sam-user', KEEP, { token: TOKEN })).status).toBe(200);
    db.sqlite.exec("UPDATE customers SET user_id = 'tia-user' WHERE id = 'cust-tia'");
    const preview = await release(db, { invoice_number: 'TJB-00007' });
    expect(await release(db, { invoice_number: 'TJB-00007', confirm: preview.confirmation_token })).toMatchObject({ committed: true });
    expect(customerOf(db)).toEqual({ customer_id: 'cust-tia', user_id: 'tia-user' });
    expect(keptBy(db)).toBeUndefined();
    expect((await as(db, 'tia-user', '/api/me/orders/inv-1')).status).toBe(200);
  });

  it('requires a new preview when the same person saves again', async () => {
    const db = seed();
    await as(db, 'tia-user', KEEP, { token: TOKEN });
    const stale = await release(db, { invoice_number: 'TJB-00007' });
    const fresh = await release(db, { invoice_number: 'TJB-00007' });
    await release(db, { invoice_number: 'TJB-00007', confirm: fresh.confirmation_token });
    await as(db, 'tia-user', KEEP, { token: TOKEN });
    expect(await release(db, { invoice_number: 'TJB-00007', confirm: stale.confirmation_token })).toMatchObject({ error: 'invalid_or_expired_confirmation_token' });
    expect(keptBy(db)).toEqual({ user_id: 'tia-user' });
  });

  it('isolates an audited old customer binding and preserves an independently attributed checkout', async () => {
    const db = seed('cust-tia', null, 'migrations');
    seedIdentity(db, { userId: 'tia-user', accountId: 'tia-home' });
    db.sqlite.exec(`UPDATE accounts SET owner_user_id = 'tia-user' WHERE id = 'tia-home';
      UPDATE customers SET user_id = 'tia-user', source = 'claimed_order' WHERE id = 'cust-tia';
      INSERT INTO platform_audit_log (action, actor_id, account_id, target_type, target_id, details, created_at)
        VALUES ('pay_invoice.kept', 'tia-user', 'acc-one', 'invoice', 'inv-1',
                '{"link_id":"link-1","customer_id":"cust-tia","linked":"customer"}', '2026-11-27 10:00:00');
      INSERT INTO invoices (id, account_id, invoice_number, customer_id, status, customer_library_account_id, source_inquiry_id, created_at)
        VALUES ('verified-checkout', 'acc-one', 'OLD-2', 'cust-tia', 'Draft', 'tia-home', 'verified-inquiry', '2026-11-27 10:30:00'),
               ('later-inquiry', 'acc-one', 'OLD-3', 'cust-tia', 'Draft', NULL, 'guest-inquiry', '2026-11-27 11:00:00'),
               ('other-invoice', 'acc-one', 'OLD-4', 'cust-tia', 'Draft', NULL, NULL, '2026-11-26 10:00:00');
      INSERT INTO inquiries (id, account_id, name, email, items, ref_number)
        VALUES ('verified-inquiry', 'acc-one', 'Tia', 'tia-user@test.dev', '[]', 'ORDER-1'),
               ('guest-inquiry', 'acc-one', 'Guest', 'guest@test.dev', '[]', 'ORDER-2');`);

    expect(await orderIds(db, 'tia-user')).toEqual(['inv-1', 'verified-checkout']);
    const preview = await release(db, { invoice_number: 'TJB-00007' });
    expect(preview.preview.saved_by.email).toBe('tia-user@test.dev');
    expect(await release(db, { invoice_number: 'TJB-00007', confirm: preview.confirmation_token })).toMatchObject({ committed: true });
    expect(await orderIds(db, 'tia-user')).toEqual(['verified-checkout']);
    expect(customerOf(db)).toEqual({ customer_id: 'cust-tia', user_id: 'tia-user' });
    expect((await as(db, 'sam-user', KEEP, { token: TOKEN })).status).toBe(200);
    expect(await orderIds(db, 'sam-user')).toEqual(['inv-1']);
  });

  it('releases an audited old invoice attachment without changing its customer record or other purchases', async () => {
    const db = seed('cust-tia');
    db.sqlite.exec(`UPDATE customers SET user_id = 'tia-user', email = 'tia-user@test.dev' WHERE id = 'cust-tia';
      INSERT INTO platform_audit_log (action, actor_id, account_id, target_type, target_id, details)
        VALUES ('pay_invoice.kept', 'tia-user', 'acc-one', 'invoice', 'inv-1',
                '{"link_id":"link-1","customer_id":"cust-tia","linked":"invoice"}');
      INSERT INTO invoices (id, account_id, invoice_number, customer_id, status)
        VALUES ('independent-purchase', 'acc-one', 'OLD-2', 'cust-tia', 'Draft');`);

    expect(await orderIds(db, 'tia-user')).toEqual(['independent-purchase', 'inv-1']);
    const preview = await release(db, { invoice_number: 'TJB-00007' });
    expect(await release(db, { invoice_number: 'TJB-00007', confirm: preview.confirmation_token })).toMatchObject({ committed: true });
    expect(await orderIds(db, 'tia-user')).toEqual(['independent-purchase']);
    expect(customerOf(db)).toEqual({ customer_id: 'cust-tia', user_id: 'tia-user' });
    expect((await as(db, 'sam-user', KEEP, { token: TOKEN })).status).toBe(200);
    expect(await orderIds(db, 'sam-user')).toEqual(['inv-1']);
  });

  it('refuses an invoice nobody saved from its link', async () => {
    const db = seed();
    expect(await release(db, { invoice_number: 'TJB-00007' })).toMatchObject({ error: 'not_saved_through_link' });
  });
});
