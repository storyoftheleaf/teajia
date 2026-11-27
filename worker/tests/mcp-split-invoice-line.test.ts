import { describe, expect, it } from 'vitest';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';
import { invoiceLineTools, splitAmounts } from '../src/mcpTools/invoiceLines';

// Two 100g packs are two lines, not one 200g line (Adrian, 2026-11-27).

const ACCOUNT = 'acc-split';
const auth = { accountId: ACCOUNT, userId: 'u1', userEmail: 'u1@test.dev', tokenId: 'tok-1', creatorTier: 'account_owner' } as any;
const call = (db: SqliteD1, args: any) => invoiceLineTools.handlers.split_invoice_line({ DB: db } as any, auth, args) as Promise<Record<string, any>>;

function seed(status = 'Draft') {
  const db = new SqliteD1();
  seedIdentity(db, { userId: 'u1', accountId: ACCOUNT, role: 'owner' });
  db.sqlite.prepare(`INSERT INTO invoices (id, account_id, invoice_number, status, payment_status) VALUES ('inv', ?, 'TJB-7', ?, 'unpaid')`).run(ACCOUNT, status);
  const insert = db.sqlite.prepare(`INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale) VALUES (?, ?, 'inv', ?, ?, ?)`);
  for (const id of ['p1', 'p2', 'p3']) {
    db.sqlite.prepare(`INSERT INTO products (id, account_id, product_name, type) VALUES (?, ?, ?, 'Shou Puer')`).run(id, ACCOUNT, id);
  }
  insert.run('l1', ACCOUNT, 'p1', 150, 1.21);
  insert.run('l2', ACCOUNT, 'p2', 200, 0.55);
  insert.run('l3', ACCOUNT, 'p3', 10, 0);
  return db;
}
const lines = (db: SqliteD1) => db.sqlite.prepare(`SELECT product_id, quantity, price_at_sale FROM invoice_line_items WHERE invoice_id = 'inv' ORDER BY rowid`).all();

describe('split_invoice_line', () => {
  it('reads amounts that add up, and nothing else', () => {
    expect(splitAmounts(200, [100, 100])).toEqual([100, 100]);
    expect(splitAmounts(200, [100, 50])).toBeNull();
    expect(splitAmounts(200, [200])).toBeNull();
    expect(splitAmounts(200, [100.5, 99.5])).toBeNull();
  });

  it('previews, then splits the line in its place at the same price', async () => {
    const db = seed();
    const preview = await call(db, { invoice_number: 'TJB-7', product_id: 'p2', amounts: [100, 100] });
    expect(preview.preview.becomes).toEqual([{ quantity: 100, line_total_usd: 55 }, { quantity: 100, line_total_usd: 55 }]);
    expect(lines(db)).toHaveLength(3);
    const done = await call(db, { invoice_number: 'TJB-7', product_id: 'p2', amounts: [100, 100], confirm: preview.confirmation_token });
    expect(done.committed).toBe(true);
    expect(lines(db)).toEqual([
      { product_id: 'p1', quantity: 150, price_at_sale: 1.21 },
      { product_id: 'p2', quantity: 100, price_at_sale: 0.55 },
      { product_id: 'p2', quantity: 100, price_at_sale: 0.55 },
      { product_id: 'p3', quantity: 10, price_at_sale: 0 },
    ]);
  });

  it('refuses a fulfilled invoice and amounts that do not add up', async () => {
    expect((await call(seed('Filled'), { invoice_number: 'TJB-7', product_id: 'p2', amounts: [100, 100] })).error).toBe('invoice_not_editable');
    expect((await call(seed(), { invoice_number: 'TJB-7', product_id: 'p2', amounts: [100, 50] })).error).toBe('amounts_must_add_up');
  });

  it('changes nothing when the invoice moved after the preview', async () => {
    const db = seed();
    const preview = await call(db, { invoice_number: 'TJB-7', product_id: 'p2', amounts: [100, 100] });
    db.sqlite.prepare(`UPDATE invoices SET status = 'Filled' WHERE id = 'inv'`).run();
    const done = await call(db, { invoice_number: 'TJB-7', product_id: 'p2', amounts: [100, 100], confirm: preview.confirmation_token });
    expect(done.committed).toBeUndefined();
    expect(lines(db)).toHaveLength(3);
  });
});
