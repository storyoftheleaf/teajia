import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { invoiceKeepTools } from '../src/mcpTools/invoiceKeep';

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

async function as(db: SqliteD1, userId: string | null, path: string, body?: unknown) {
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
  }), env(db));
}

function seed(customerId: string | null = null, customerEmail: string | null = null) {
  const db = new SqliteD1('schema');
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
const ownerOf = (db: SqliteD1) => db.sqlite.prepare(
  `SELECT c.id, c.user_id FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.id = 'inv-1'`
).get() as { id: string; user_id: string } | undefined;

describe('Save to my account keeps the invoice', () => {
  it('needs an account', async () => {
    const db = seed();
    expect((await as(db, null, KEEP, { token: TOKEN })).status).toBe(401);
    expect(ownerOf(db)).toBeUndefined();
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
    expect(ownerOf(db)?.user_id).toBe('tia-user');
    expect((db.sqlite.prepare(`SELECT fulfillment_claim_token AS t FROM invoices WHERE id = 'inv-1'`).get() as any).t).toBeNull();

    const after = await (await as(db, 'tia-user', `/api/public/people/kenji-tanaka/pay-access?t=${TOKEN}`)).json() as any;
    expect(after.invoice.kept).toBe(true);

    const again = await as(db, 'tia-user', KEEP, { token: TOKEN });
    expect(await again.json()).toMatchObject({ ok: true, already: true });
  });

  it('a named customer with no account is the record linked', async () => {
    const db = seed('cust-tia');
    expect((await as(db, 'tia-user', KEEP, { token: TOKEN })).status).toBe(200);
    expect(ownerOf(db)).toEqual({ id: 'cust-tia', user_id: 'tia-user' });
  });

  it('the first person wins and the next is told it is kept', async () => {
    const db = seed();
    expect((await as(db, 'tia-user', KEEP, { token: TOKEN })).status).toBe(200);
    const second = await as(db, 'sam-user', KEEP, { token: TOKEN });
    expect(second.status).toBe(409);
    expect(ownerOf(db)?.user_id).toBe('tia-user');
  });

  it('the shop that sent it never keeps it, and sees it as its own to send', async () => {
    const db = seed();
    const page = await (await as(db, 'kenji-user', `/api/public/people/kenji-tanaka/pay-access?t=${TOKEN}`)).json() as any;
    expect(page.invoice.yours_to_send).toBe(true);
    const response = await as(db, 'kenji-user', KEEP, { token: TOKEN });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'own_invoice' });
    expect(ownerOf(db)).toBeUndefined();

    const buyer = await (await as(db, 'tia-user', `/api/public/people/kenji-tanaka/pay-access?t=${TOKEN}`)).json() as any;
    expect(buyer.invoice.yours_to_send).toBe(false);
  });

  it('staff of the shop do not keep it either', async () => {
    const db = seed();
    db.sqlite.prepare(`INSERT INTO account_members (account_id, user_id, role, status) VALUES ('acc-one', 'sam-user', 'staff', 'active')`).run();
    expect((await as(db, 'sam-user', KEEP, { token: TOKEN })).status).toBe(403);
  });

  it('an invoice made out to an email is kept only by that email', async () => {
    const db = seed('cust-tia', 'Tia-User@Test.dev');
    const other = await as(db, 'sam-user', KEEP, { token: TOKEN });
    expect(other.status).toBe(403);
    expect(await other.json()).toMatchObject({ code: 'not_your_invoice' });
    expect((await as(db, 'tia-user', KEEP, { token: TOKEN })).status).toBe(200);
    expect(ownerOf(db)).toEqual({ id: 'cust-tia', user_id: 'tia-user' });
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
    expect(ownerOf(db)?.user_id).toBe('sam-user');
    const done = await release(db, { invoice_number: 'TJB-00007', confirm: preview.confirmation_token });
    expect(done.committed).toBe(true);
    expect(ownerOf(db)).toBeUndefined();
    expect((await as(db, 'tia-user', KEEP, { token: TOKEN })).status).toBe(200);
    expect(ownerOf(db)?.user_id).toBe('tia-user');
  });

  it('a named customer is unlinked, not taken off the invoice', async () => {
    const db = seed('cust-tia');
    expect((await as(db, 'sam-user', KEEP, { token: TOKEN })).status).toBe(200);
    const preview = await release(db, { invoice_number: 'TJB-00007' });
    await release(db, { invoice_number: 'TJB-00007', confirm: preview.confirmation_token });
    expect(db.sqlite.prepare(`SELECT customer_id FROM invoices WHERE id = 'inv-1'`).get()).toEqual({ customer_id: 'cust-tia' });
    expect(ownerOf(db)).toEqual({ id: 'cust-tia', user_id: null });
  });

  it('refuses an invoice nobody saved from its link', async () => {
    const db = seed();
    expect(await release(db, { invoice_number: 'TJB-00007' })).toMatchObject({ error: 'not_saved_through_link' });
  });
});
