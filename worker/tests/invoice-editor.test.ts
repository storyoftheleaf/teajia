import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import { planInvoiceDetailsEdit } from '../src/invoiceEdit';

// Fixing a mistake on an invoice (Adrian, 2026-11-28: "It's not very easy for
// me to edit mistakes... Her name is Tiya").

const SECRET = 'invoice-editor';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

async function put(db: SqliteD1, path: string, body: unknown, accountId = 'acc-one') {
  const headers = new Headers({ 'Content-Type': 'application/json', 'X-Teajia-Account': accountId });
  headers.set('Authorization', `Bearer ${await signedToken(SECRET, {
    sub: 'kenji-user', email: 'kenji-user@test.dev', name: 'kenji', active_account_id: accountId, platform_role: null,
  })}`);
  return worker.fetch(new Request(`https://worker.test${path}`, { method: 'PUT', headers, body: JSON.stringify(body) }),
    { DB: db as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any);
}

function seed(paymentStatus = 'unpaid', status = 'Draft') {
  const db = new SqliteD1('schema');
  databases.push(db);
  seedIdentity(db, { userId: 'kenji-user', accountId: 'acc-one', role: 'owner' });
  db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, type) VALUES ('p1', 'acc-one', 'Guogai', 'Shou')`).run();
  db.sqlite.prepare(`INSERT INTO invoices (id, account_id, invoice_number, status, payment_status, customer_name, sold_by_user_id, display_currency, created_at)
    VALUES ('inv-1', 'acc-one', 'TJB-00007', ?, ?, 'Tia', 'kenji-user', 'USD', '2026-11-27 04:51:05')`).run(status, paymentStatus);
  db.sqlite.prepare(`INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale) VALUES ('l1', 'acc-one', 'inv-1', 'p1', 150, 1.21)`).run();
  db.sqlite.prepare(`INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale) VALUES ('l2', 'acc-one', 'inv-1', 'p1', 200, 0.55)`).run();
  db.sqlite.prepare(`INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, custom_name, quantity, price_at_sale) VALUES ('d1', 'acc-one', 'inv-1', NULL, 'Discount 10%', 1, -29.15)`).run();
  return db;
}

const invoice = (db: SqliteD1) => db.sqlite.prepare(`SELECT customer_name, notes, created_at FROM invoices WHERE id = 'inv-1'`).get() as any;
const lines = (db: SqliteD1) => db.sqlite.prepare(`SELECT product_id, custom_name, quantity, price_at_sale FROM invoice_line_items WHERE invoice_id = 'inv-1' ORDER BY price_at_sale DESC`).all() as any[];
const timeline = (db: SqliteD1) => (db.sqlite.prepare(`SELECT details FROM activity_logs WHERE entity_id = 'inv-1' AND action = 'INVOICE_EDITED'`).all() as any[]).map(row => row.details);

describe('the invoice editor', () => {
  it('corrects the name and date on a paid invoice and says what it was', async () => {
    const db = seed('paid', 'Filled');
    const res = await put(db, '/api/invoices/inv-1/details', { customer_name: ' Tiya ', invoice_date: '2026-11-26' });
    expect(res.status).toBe(200);
    expect(invoice(db)).toMatchObject({ customer_name: 'Tiya', created_at: '2026-11-26 04:51:05' });
    expect(timeline(db)).toEqual(['Invoice TJB-00007 edited: name "Tia" to "Tiya"; date 2026-11-27 to 2026-11-26.']);
  });

  it('renames the customer record when it carried the old name, and leaves a differently named one alone', async () => {
    const db = seed();
    db.sqlite.prepare(`INSERT INTO customers (id, account_id, name) VALUES ('c1', 'acc-one', 'Tia')`).run();
    db.sqlite.prepare(`UPDATE invoices SET customer_id = 'c1' WHERE id = 'inv-1'`).run();
    const res = await put(db, '/api/invoices/inv-1/details', { customer_name: 'Tiya' });
    expect(await res.json()).toMatchObject({ customer_renamed: true });
    expect((db.sqlite.prepare(`SELECT name FROM customers WHERE id = 'c1'`).get() as any).name).toBe('Tiya');

    db.sqlite.prepare(`UPDATE customers SET name = 'Tiya Rao' WHERE id = 'c1'`).run();
    await put(db, '/api/invoices/inv-1/details', { customer_name: 'T. Rao' });
    expect((db.sqlite.prepare(`SELECT name FROM customers WHERE id = 'c1'`).get() as any).name).toBe('Tiya Rao');
  });

  it('refuses a date that is not a day, and another account cannot reach the invoice', async () => {
    const db = seed();
    expect((await put(db, '/api/invoices/inv-1/details', { invoice_date: '2026-02-30' })).status).toBe(400);
    seedIdentity(db, { userId: 'kenji-user', accountId: 'acc-two', role: 'owner' });
    expect((await put(db, '/api/invoices/inv-1/details', { customer_name: 'X' }, 'acc-two')).status).toBe(404);
    expect(invoice(db).customer_name).toBe('Tia');
  });

  it('writes the discount again from the new lines, so it never keeps an old amount', async () => {
    const db = seed();
    const res = await put(db, '/api/invoices/inv-1/items', {
      lineItems: [
        { product_id: 'p1', quantity: 100, price_at_sale: 1.21 },
        { product_id: 'p1', quantity: 200, price_at_sale: 0.55 },
        { custom_name: 'Discount 10%', quantity: 1, price_at_sale: -29.15 },
      ],
    });
    expect(res.status).toBe(200);
    expect(lines(db).map(line => [line.custom_name, line.quantity, line.price_at_sale])).toEqual([
      [null, 100, 1.21], [null, 200, 0.55], ['Discount 10%', 1, -23.1],
    ]);
    expect(timeline(db)[0]).toMatch(/lines were Guogai 150g at \$1\.21; Guogai 200g at \$0\.55; now Guogai 100g at \$1\.21/);
  });

  it('changes the discount percent, and 0 takes it off', async () => {
    const db = seed();
    await put(db, '/api/invoices/inv-1/items', { discount_percent: 20 });
    expect(lines(db).find(line => line.custom_name)?.custom_name).toBe('Discount 20%');
    await put(db, '/api/invoices/inv-1/items', { discount_percent: 0 });
    expect(lines(db).some(line => line.custom_name)).toBe(false);
    expect((await put(db, '/api/invoices/inv-1/items', { discount_percent: 120 })).status).toBe(400);
  });

  it('plans nothing when nothing changed, and nothing on a void invoice', () => {
    expect(planInvoiceDetailsEdit({ customer_name: 'Tiya', notes: null, created_at: '2026-11-27 04:51:05' }, { customer_name: 'Tiya', notes: '', invoice_date: '2026-11-27' }))
      .toEqual({ ok: true, sets: [], values: [], changes: [] });
    expect(planInvoiceDetailsEdit({ status: 'Void' }, { customer_name: 'A' })).toMatchObject({ ok: false, error: 'invoice_void' });
  });
});
