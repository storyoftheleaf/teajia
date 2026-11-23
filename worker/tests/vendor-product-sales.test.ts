import { afterEach, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Adrian, 2026-11-23, on the vendor page: "you're sharing what I've purchased
// from there, but you're not sharing what other people purchased from me."
// The vendor page lists every real sale of that vendor's teas, with the buyer.

const opened: SqliteD1[] = [];
afterEach(() => opened.splice(0).forEach(db => db.close()));

for (const schema of ['migrations', true] as const) {
  it(`lists the sales of a vendor's teas, newest first, real sales only (${schema === true ? 'schema.sql' : 'migrations'})`, async () => {
    const db = new SqliteD1(schema); opened.push(db);
    seedIdentity(db, { userId: 'owner', accountId: 'shop' });
    seedIdentity(db, { userId: 'other', accountId: 'elsewhere' });
    const run = (sql: string) => db.sqlite.prepare(sql).run();
    run(`INSERT INTO customers (id, account_id, name, tags, type) VALUES ('bo', 'shop', 'Master Bo', '["vendor"]', 'customer')`);
    run(`INSERT INTO customers (id, account_id, name, tags, type) VALUES ('mei', 'shop', 'Mei', '[]', 'customer')`);
    run(`INSERT INTO products (id, account_id, product_name, type, vendor_id) VALUES ('bo-tea', 'shop', 'Bo Gushu', 'Puer', 'bo')`);
    run(`INSERT INTO products (id, account_id, product_name, type, vendor_id) VALUES ('other-tea', 'shop', 'Other', 'Puer', 'someone')`);
    const invoice = (id: string, extra: string, customer: string | null, created: string) => run(
      `INSERT INTO invoices (id, account_id, invoice_number, customer_id, customer_name, status, created_at${extra ? ', ' + extra.split('=')[0] : ''})
       VALUES ('${id}', 'shop', '${id.toUpperCase()}', ${customer ? `'${customer}'` : 'NULL'}, 'Walk-in buyer', '${id === 'draft' ? 'Draft' : 'Paid'}', '${created}'${extra ? `, '${extra.split('=')[1]}'` : ''})`);
    invoice('old', '', 'mei', '2026-10-01 10:00:00');
    invoice('new', '', null, '2026-11-01 10:00:00');
    invoice('draft', '', 'mei', '2026-11-02 10:00:00');
    invoice('gone', 'deleted_at=2026-11-03', 'mei', '2026-11-03 10:00:00');
    const line = (id: string, inv: string, product: string) => run(
      `INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale) VALUES ('${id}', 'shop', '${inv}', '${product}', 50, 0.5)`);
    line('l1', 'old', 'bo-tea'); line('l2', 'new', 'bo-tea'); line('l3', 'old', 'other-tea');
    line('l4', 'draft', 'bo-tea'); line('l5', 'gone', 'bo-tea');

    const token = await signedToken('secret', { sub: 'owner', email: 'owner@test.dev', active_account_id: 'shop', platform_role: null });
    const res = await worker.fetch(new Request('https://test/api/customers/bo/product-sales', {
      headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'shop' },
    }), { DB: db, JWT_SECRET: 'secret' } as any);
    expect(res.status).toBe(200);
    const rows = await res.json() as Array<Record<string, unknown>>;
    expect(rows.map(r => r.line_id)).toEqual(['l2', 'l1']);
    expect(rows[1]).toMatchObject({ customer_id: 'mei', customer_name: 'Mei', product_name: 'Bo Gushu', quantity: 50, quantity_unit: 'g', price_at_sale: 0.5 });
    expect(rows[0]).toMatchObject({ customer_id: null, customer_name: 'Walk-in buyer' });
  });
}
