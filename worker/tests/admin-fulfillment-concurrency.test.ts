import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'admin-fulfill-secret';

class FulfillmentDb {
  invoice = { id: 'invoice-a', account_id: 'acct-a', invoice_number: 'A-1', status: 'Pending', inventory_deducted: 0, fulfillment_claim_token: null as string | null, fulfillment_claimed_at: null as string | null, fulfilled_at: null as string | null };
  stock = 100;
  otherHeldStock = 0;
  ledgers = 0;
  audits = 0;
  failBatch = false;
  stealLeaseBeforeBatch = false;
  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase(); let values: any[] = [];
    const statement = {
      sql,
      bind: (...input: any[]) => { values = input; return statement; },
      first: async () => {
        if (normalized === 'select platform_role from users where id = ?') return { platform_role: null };
        if (normalized.includes('from account_members am')) return { role: 'owner', permissions: '{}', kind: 'location' };
        if (normalized.includes('select status from accounts')) return { status: 'active' };
        if (normalized.startsWith('update invoices set fulfillment_claim_token = ?')) {
          const stale = this.invoice.fulfillment_claim_token != null && (this.invoice.fulfillment_claimed_at == null || new Date(this.invoice.fulfillment_claimed_at).getTime() < Date.now() - 5 * 60_000);
          if (this.invoice.inventory_deducted || (this.invoice.fulfillment_claim_token && !stale)) return null;
          // Mirrors the real claim's status clause. Without modelling it here a
          // test could pass while production still let a voided invoice through.
          if (normalized.includes("status in ('draft', 'pending')") && !['Draft', 'Pending'].includes(this.invoice.status)) return null;
          this.invoice.fulfillment_claim_token = values[0]; this.invoice.fulfillment_claimed_at = new Date().toISOString(); return { id: this.invoice.id };
        }
        if (normalized.startsWith('select status, inventory_deducted from invoices')) {
          return { status: this.invoice.status, inventory_deducted: this.invoice.inventory_deducted };
        }
        if (normalized.includes('select * from invoices where id = ?')) return { ...this.invoice };
        if (normalized.includes('from products where id = ?')) return { id: 'product-a', stock_grams: this.stock, low_stock_threshold: 0, product_name: 'Tea', status: 'Active', source_compass_entry_id: null };
        return null;
      },
      all: async () => normalized.includes('from invoice_line_items') ? { results: [{ id: 'line-a', account_id: 'acct-a', invoice_id: 'invoice-a', product_id: 'product-a', quantity: 40, price_at_sale: 1 }] } : { results: [] },
      run: async () => {
        if (normalized.includes('fulfillment_claim_token = ?') && !normalized.startsWith('update invoices set fulfillment_claim_token = ?') && this.invoice.fulfillment_claim_token !== values.at(-1)) return { success: true, meta: { changes: 0 }, results: [] };
        if (normalized.startsWith('update products set stock_grams = case')) {
          const requested = Number(values[3]);
          this.stock = this.stock - this.otherHeldStock >= requested
            ? this.stock - Number(values[4])
            : -1;
          if (this.stock < 0) throw new Error('stock_grams cannot be negative');
          return { success: true, results: [{ stock_grams: this.stock }], meta: { changes: 1 } };
        }
        if (normalized.startsWith('insert into stock_ledger')) { this.ledgers += 1; return { success: true, meta: { changes: 1 } }; }
        if (normalized.startsWith('insert into activity_logs')) { this.audits += 1; return { success: true, meta: { changes: 1 } }; }
        if (normalized.startsWith("update invoices set status = 'filled'")) {
          if (this.invoice.fulfillment_claim_token !== values[2]) return { success: true, meta: { changes: 0 } };
          this.invoice.inventory_deducted = 1; this.invoice.fulfilled_at ||= '2026-07-13 00:00:00'; this.invoice.fulfillment_claim_token = null; this.invoice.fulfillment_claimed_at = null;
        }
        if (normalized.startsWith('update invoices set fulfillment_claim_token = null') && this.invoice.fulfillment_claim_token === values[2]) this.invoice.fulfillment_claim_token = null;
        return { success: true, meta: { changes: 1 } };
      },
    }; return statement;
  }
  async batch(statements: any[]) {
    if (this.stealLeaseBeforeBatch && statements.some(statement => statement.sql?.toLowerCase().includes('update products set stock_grams'))) {
      this.stealLeaseBeforeBatch = false; this.invoice.fulfillment_claim_token = 'winner-b'; this.invoice.inventory_deducted = 1; this.invoice.fulfilled_at = 'winner-time'; this.stock = 60; this.ledgers = 1; this.audits = 1;
    }
    const snapshot = { invoice: { ...this.invoice }, stock: this.stock, ledgers: this.ledgers, audits: this.audits };
    try { const results = []; for (const statement of statements) { results.push(await statement.run()); if (this.failBatch && statement.sql?.toLowerCase().includes('update products set stock_grams')) throw new Error('simulated batch failure'); } return results; }
    catch (error) { this.invoice = snapshot.invoice; this.stock = snapshot.stock; this.ledgers = snapshot.ledgers; this.audits = snapshot.audits; this.failBatch = false; throw error; }
  }
}

function b64(value: string | Uint8Array) { const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value; return btoa(String.fromCharCode(...bytes)); }
async function jwt() { const now = Math.floor(Date.now() / 1000); const data = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub: 'owner-a', email: 'owner@test.dev', name: 'Owner', active_account_id: 'acct-a', iat: now, exp: now + 60 }))}`; const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return `${data}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))))}`; }
async function fulfill(db: FulfillmentDb) { return worker.fetch(new Request('https://test.dev/api/rpc/fulfill-invoice', { method: 'POST', headers: { Authorization: `Bearer ${await jwt()}`, 'X-Teajia-Account': 'acct-a', 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_id: 'invoice-a' }) }), { DB: db, JWT_SECRET } as any); }

describe('admin fulfillment claim', () => {
  it('allows only one competing request to deduct and finalize', async () => {
    const db = new FulfillmentDb();
    const responses = await Promise.all([fulfill(db), fulfill(db)]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect(db.stock).toBe(60);
    expect(db.ledgers).toBe(1);
    expect(db.audits).toBe(1);
    expect(db.invoice.fulfilled_at).toBe('2026-07-13 00:00:00');
  });

  it('reclaims a stale lease left before the mutation batch', async () => {
    const db = new FulfillmentDb(); db.invoice.fulfillment_claim_token = 'abandoned'; db.invoice.fulfillment_claimed_at = new Date(Date.now() - 6 * 60_000).toISOString();
    expect((await fulfill(db)).status).toBe(200); expect(db.stock).toBe(60);
  });

  it('recovers a migration-111 claim with a null lease timestamp', async () => {
    const db = new FulfillmentDb(); db.invoice.fulfillment_claim_token = 'legacy';
    expect((await fulfill(db)).status).toBe(200);
  });

  it('rolls back stock, ledger, audit, and invoice on batch failure', async () => {
    const db = new FulfillmentDb(); db.failBatch = true;
    expect((await fulfill(db)).status).toBe(500);
    expect(db.stock).toBe(100); expect(db.ledgers).toBe(0); expect(db.audits).toBe(0); expect(db.invoice.inventory_deducted).toBe(0); expect(db.invoice.fulfillment_claim_token).toBeNull();
  });

  it('fences a paused owner after a stale-lease winner commits', async () => {
    const db = new FulfillmentDb(); db.stealLeaseBeforeBatch = true;
    expect((await fulfill(db)).status).toBe(409);
    expect(db.stock).toBe(60); expect(db.ledgers).toBe(1); expect(db.audits).toBe(1); expect(db.invoice.fulfilled_at).toBe('winner-time');
  });

  // Voiding restores the stock and sets inventory_deducted back to 0, which is
  // right. It also used to leave the invoice satisfying the fulfilment claim,
  // so a void could be undone by fulfilling again — deducting the same stock a
  // second time and marking the invoice Filled.
  it('refuses to fulfil a voided invoice, so a void cannot be reversed', async () => {
    const db = new FulfillmentDb();
    db.invoice.status = 'Void';

    const response = await fulfill(db);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'invoice_not_fulfillable', status: 'Void' });
    expect(db.stock).toBe(100);              // no second deduction
    expect(db.ledgers).toBe(0);
    expect(db.invoice.status).toBe('Void');  // the void still stands
    expect(db.invoice.fulfilled_at).toBeNull();
  });

  it('refuses to fulfil an invoice that is already Filled', async () => {
    const db = new FulfillmentDb();
    db.invoice.status = 'Filled';

    const response = await fulfill(db);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'invoice_not_fulfillable', status: 'Filled' });
    expect(db.stock).toBe(100);
  });

  it('says which of the two reasons it refused for', async () => {
    // A live lease is "try again"; a wrong status is "this will never work".
    // Answering both with the same sentence made the second look transient.
    const db = new FulfillmentDb();
    db.invoice.fulfillment_claim_token = 'someone-else';
    db.invoice.fulfillment_claimed_at = new Date().toISOString();

    const response = await fulfill(db);

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'Invoice fulfillment is already in progress' });
  });
});
