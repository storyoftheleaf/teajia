import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { invoiceDiscountTools } from '../src/mcpTools/invoiceDiscountTool';
import { discountPercent } from '../src/invoiceDiscount';

// A percent off an invoice, offered by the shop that sent it (Adrian,
// 2026-11-27: "I also want to give her a 10% discount").

const SECRET = 'invoice-discount';
const TOKEN = 'd'.repeat(32);
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

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
  }), { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any);
}

function seed(status = 'Draft') {
  const db = new SqliteD1('schema');
  databases.push(db);
  seedIdentity(db, { userId: 'kenji-user', accountId: 'acc-one', role: 'owner' });
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, user_id, display_name, business_name, is_published, links)
    VALUES ('kenji-tanaka', 'acc-one', 'kenji-user', 'Kenji Tanaka', 'Tanaka Tea House', 1, '[]')`).run();
  db.sqlite.prepare(`INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('kenji-tanaka', 'acc-one')`).run();
  db.sqlite.prepare(`INSERT OR IGNORE INTO users (id, email, name, password_hash, role, session_version)
    VALUES ('tia-user', 'tia-user@test.dev', 'tia', 'test', 'user', 0)`).run();
  db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, type) VALUES ('p1', 'acc-one', 'Guogai', 'Shou')`).run();
  db.sqlite.prepare(`INSERT INTO invoices (id, account_id, invoice_number, status, payment_status, customer_name, sold_by_user_id, display_currency)
    VALUES ('inv-1', 'acc-one', 'TJB-00007', ?, 'unpaid', 'Tia', 'kenji-user', 'USD')`).run(status);
  db.sqlite.prepare(`INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale) VALUES ('l1', 'acc-one', 'inv-1', 'p1', 150, 1.21)`).run();
  db.sqlite.prepare(`INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale) VALUES ('l2', 'acc-one', 'inv-1', 'p1', 200, 0.55)`).run();
  db.sqlite.prepare(`INSERT INTO payment_share_links (id, account_id, contributor_id, invoice_id, token)
    VALUES ('link-1', 'acc-one', 'kenji-tanaka', 'inv-1', ?)`).run(TOKEN);
  return db;
}

const DISCOUNT = '/api/public/people/kenji-tanaka/pay-access/discount';
const PAGE = `/api/public/people/kenji-tanaka/pay-access?t=${TOKEN}`;
const total = (db: SqliteD1) => (db.sqlite.prepare(`SELECT ROUND(SUM(quantity * price_at_sale), 2) AS t FROM invoice_line_items WHERE invoice_id = 'inv-1'`).get() as any).t;

describe('a discount on an invoice', () => {
  it('reads a percent and nothing else', () => {
    expect(discountPercent(10)).toBe(10);
    expect(discountPercent('12.5')).toBe(12.5);
    expect(discountPercent(0)).toBe(0);
    expect(discountPercent(100)).toBeNull();
    expect(discountPercent(-5)).toBeNull();
    expect(discountPercent(10.25)).toBeNull();
    expect(discountPercent('ten')).toBeNull();
  });

  it('the shop offers 10% from its own view, the buyer sees it above the total, and it can be taken off', async () => {
    const db = seed();
    const before = await (await as(db, 'kenji-user', PAGE)).json() as any;
    expect(before.invoice.discount_editable).toBe(true);
    expect(before.invoice.discount).toBeNull();

    const res = await as(db, 'kenji-user', DISCOUNT, { token: TOKEN, percent: 10 });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ discount_usd: 29.15, total_usd: 262.35 });
    expect(total(db)).toBe(262.35);

    const buyer = await (await as(db, 'tia-user', PAGE)).json() as any;
    expect(buyer.invoice.discount).toEqual({ percent: 10, amount_usd: 29.15, subtotal_usd: 291.5 });
    expect(buyer.invoice.discount_editable).toBe(false);
    expect(buyer.invoice.outstanding_usd).toBe(262.35);
    expect(buyer.invoice.lines).toHaveLength(2);

    await as(db, 'kenji-user', DISCOUNT, { token: TOKEN, percent: 15 });
    expect(total(db)).toBe(247.77);
    await as(db, 'kenji-user', DISCOUNT, { token: TOKEN, percent: 0 });
    expect(total(db)).toBe(291.5);
  });

  it('nobody but the shop can offer one', async () => {
    const db = seed();
    expect((await as(db, 'tia-user', DISCOUNT, { token: TOKEN, percent: 50 })).status).toBe(403);
    expect((await as(db, null, DISCOUNT, { token: TOKEN, percent: 50 })).status).toBe(401);
    expect(total(db)).toBe(291.5);
  });

  it('a paid or fulfilled invoice no longer changes', async () => {
    const db = seed('Paid');
    expect((await as(db, 'kenji-user', DISCOUNT, { token: TOKEN, percent: 10 })).status).toBe(409);
    expect(total(db)).toBe(291.5);
  });

  it('agents preview, then confirm', async () => {
    const db = seed();
    const auth = { accountId: 'acc-one', userId: 'kenji-user', userEmail: 'k@test.dev', tokenId: 'tok-1', creatorTier: 'account_owner' } as any;
    const call = (args: any) => invoiceDiscountTools.handlers.set_invoice_discount({ DB: db } as any, auth, args) as Promise<Record<string, any>>;
    const preview = await call({ invoice_number: 'TJB-00007', percent: 10 });
    expect(preview.preview).toMatchObject({ teas_usd: 291.5, discount_after: { percent: 10, usd: 29.15 }, total_after_usd: 262.35 });
    expect(total(db)).toBe(291.5);
    const done = await call({ invoice_number: 'TJB-00007', percent: 10, confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, total_usd: 262.35 });
    expect(total(db)).toBe(262.35);
  });
});

describe('a discount line among the invoice\'s other lines', () => {
  it('passes the line checks that send, ship and edit an invoice run, and nothing else may be negative', async () => {
    const { authorizeInvoiceLines } = await import('../src/teaMasterSales');
    const { validateRetailInvoiceInput } = await import('../src/invoiceDomain');
    const discount = { product_id: null, custom_name: 'Discount 10%', quantity: 1, price_at_sale: -5 };
    const input = { customer_name: 'A', lineItems: [{ product_id: null, custom_name: 'Gift', quantity: 1, price_at_sale: 50 }, discount] };
    expect(() => validateRetailInvoiceInput(input)).not.toThrow();
    expect(() => validateRetailInvoiceInput({ ...input, lineItems: [{ ...discount, custom_name: 'Refund' }] })).toThrow();
    const db = new SqliteD1('schema'); databases.push(db);
    const base = { accountId: 'a', actorUserId: 'u', actorRole: 'owner' };
    await expect(authorizeInvoiceLines({ DB: db as any }, { ...base, lines: [discount] as any })).resolves.toHaveLength(1);
    await expect(authorizeInvoiceLines({ DB: db as any }, { ...base, lines: [{ ...discount, custom_name: 'Refund' }] as any })).rejects.toThrow();
  });
});
