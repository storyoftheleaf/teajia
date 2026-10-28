import { describe, expect, it } from 'vitest';
import worker from '../src/index';
import { sha256Hex } from '../src/inquiryDomain';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

async function setup() {
  const db = new SqliteD1('migrations');
  seedIdentity(db, { accountId: 'invoice-shop', userId: 'invoice-owner' });
  const bearer = 'test-invoice-arrivals';
  db.sqlite.prepare(`INSERT INTO mcp_tokens
    (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier,expires_at)
    VALUES ('invoice-token','invoice-shop','invoice-owner','invoice-owner@test.dev','test',?,'test','["inventory:read","stock:write"]','account_owner',?)`)
    .run(await sha256Hex(bearer), Math.floor(Date.now() / 1000) + 3600);
  db.sqlite.prepare("INSERT INTO customers(id,account_id,name,tags) VALUES('invoice-vendor','invoice-shop','Invoice supplier','[\"vendor\"]')").run();
  // Match D1's asynchronous interface, including paths which use .catch().
  const wrap = (statement: any): any => ({
    bind: (...values: unknown[]) => wrap(statement.bind(...values)),
    first: () => Promise.resolve(statement.first()), all: () => Promise.resolve(statement.all()),
    run: () => Promise.resolve(statement.run()), raw: statement,
  });
  const env = { DB: {
    prepare: (sql: string) => wrap(db.prepare(sql)),
    batch: (statements: any[]) => Promise.resolve(db.batch(statements.map(s => s.raw))),
  }, JWT_SECRET: 'test-invoice-secret' };
  async function rpc(name: string, args: any) {
    const res = await worker.fetch(new Request('https://worker.test/mcp', {
      method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    }), env as any);
    const body: any = await res.json();
    expect(res.status, JSON.stringify(body)).toBe(200);
    expect(body.error, JSON.stringify(body)).toBeUndefined();
    return body.result.structuredContent ?? JSON.parse(body.result.content[0].text);
  }
  async function confirm(name: string, args: any) {
    const preview = await rpc(name, args);
    expect(preview.confirmation_token, JSON.stringify(preview)).toBeTruthy();
    const result = await rpc(name, { ...args, confirm: preview.confirmation_token });
    expect(result.error, JSON.stringify(result)).toBeUndefined();
    expect(result.committed, JSON.stringify(result)).toBe(true);
    return result;
  }
  return { db, rpc, confirm };
}

describe('invoice and arrivals through the real MCP endpoint', () => {
  it.each(['in_transit', 'received'] as const)('files a %s invoice into one connected purchase, receipt and stock history', async disposition => {
    const { db, rpc, confirm } = await setup();
    try {
      const started = await rpc('intake_start', { title: 'Invoice INV-101', pasted_text: 'INV-101: Red tea 500g USD70; Gaiwan 4 pieces USD40.' });
      expect(started.import_id, JSON.stringify(started)).toBeTruthy();
      const import_id = started.import_id;
      await confirm('intake_add_items', { import_id, vendor_customer_id: 'invoice-vendor', items: [
        { name: 'Red tea', category: 'tea', quantity: { amount: 500, unit: 'g' }, disposition, price: { amount: 70, currency: 'USD', basis: 'line_total' } },
        { name: 'Gaiwan', category: 'teaware', quantity: { amount: 4, unit: 'piece' }, disposition, price: { amount: 40, currency: 'USD', basis: 'line_total' } },
      ] });
      const finalized = await confirm('intake_finalize', { import_id });
      expect(finalized.receipts).toHaveLength(1);
      const receipt = finalized.receipts[0];
      expect(receipt.purchase_order_id).toBeTruthy();
      const tea: any = db.sqlite.prepare("SELECT * FROM inventory_receipt_lines WHERE receipt_id=? AND unit='g'").get(receipt.id);
      const ware: any = db.sqlite.prepare("SELECT * FROM inventory_receipt_lines WHERE receipt_id=? AND unit='unit'").get(receipt.id);
      expect(tea.expected_quantity).toBe(500); expect(ware.expected_quantity).toBe(4);
      if (disposition === 'in_transit') {
        expect(db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toMatchObject({ n: 0 });
        const arrival = { receipt_id: receipt.id, idempotency_key: 'parcel-one', lines: [{ line_id: tea.id, quantity: 200 }, { line_id: ware.id, quantity: 1 }] };
        await confirm('record_arrival', arrival);
        await confirm('record_arrival', arrival);
        expect(db.sqlite.prepare('SELECT COUNT(*) n FROM stock_ledger').get()).toMatchObject({ n: 2 });
        const partial = await rpc('get_purchase', { id: receipt.purchase_order_id });
        expect(partial.rows[0].receipt.state).toBe('partially_received');
        expect(partial.rows[0].source_document.import_id).toBe(import_id);
        await confirm('record_arrival', { receipt_id: receipt.id, idempotency_key: 'parcel-two', lines: [{ line_id: tea.id, quantity: 300 }, { line_id: ware.id, quantity: 3 }] });
      }
      expect(db.sqlite.prepare('SELECT stock_grams,cost_amount,quantity_purchased FROM products WHERE id=?').get(tea.product_id))
        .toMatchObject({ stock_grams: 500, cost_amount: 70, quantity_purchased: 500 });
      expect(db.sqlite.prepare('SELECT quantity_units,cost_amount,quantity_purchased FROM products WHERE id=?').get(ware.product_id))
        .toMatchObject({ quantity_units: 4, cost_amount: 10, quantity_purchased: 1 });
      expect(db.sqlite.prepare('SELECT state FROM inventory_receipts WHERE id=?').get(receipt.id)).toMatchObject({ state: 'received' });
      expect(db.sqlite.prepare('SELECT status FROM purchase_orders WHERE id=?').get(receipt.purchase_order_id)).toMatchObject({ status: 'received' });
      const tracked = await rpc('get_purchase', { id: receipt.purchase_order_id });
      expect(tracked.rows[0].history).toHaveLength(disposition === 'received' ? 2 : 4);
      expect(tracked.rows[0].attention).toEqual([]);
      expect(db.sqlite.prepare('SELECT COUNT(*) n FROM purchase_orders').get()).toMatchObject({ n: 1 });
    } finally { db.close(); }
  });
});
