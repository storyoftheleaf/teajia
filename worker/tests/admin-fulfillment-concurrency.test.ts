import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'admin-fulfill-secret';

class FulfillmentDb {
  invoice = { id: 'invoice-a', account_id: 'acct-a', invoice_number: 'A-1', status: 'Pending', inventory_deducted: 0, fulfillment_claim_token: null as string | null, fulfillment_claimed_at: null as string | null, fulfilled_at: null as string | null };
  stock = 100;
  lineQuantity = 40;
  lineReads = 0;
  otherHeldStock = 0;
  ledgers = 0;
  audits = 0;
  failBatch = false;
  stealLeaseBeforeBatch = false;
  editBeforeLineRead = false;
  fulfillBeforeVoidBatch = false;
  stealVoidLeaseBeforeBatch = false;
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
          const allowedStatuses = normalized.includes("status in ('draft', 'pending')") ? ['Draft', 'Pending'] : ['Draft', 'Pending', 'Filled'];
          if (!allowedStatuses.includes(this.invoice.status) || (normalized.includes('inventory_deducted = 0') && this.invoice.inventory_deducted) || (this.invoice.fulfillment_claim_token && !stale)) return null;
          this.invoice.fulfillment_claim_token = values[0]; this.invoice.fulfillment_claimed_at = new Date().toISOString(); return { ...this.invoice };
        }
        if (normalized.includes('from invoices where id = ?')) return { ...this.invoice };
        if (normalized.includes('from products where id = ?')) return { id: 'product-a', stock_grams: this.stock, low_stock_threshold: 0, product_name: 'Tea', status: 'Active', source_compass_entry_id: null };
        return null;
      },
      all: async () => {
        if (!normalized.includes('from invoice_line_items')) return { results: [] };
        this.lineReads += 1;
        if (this.editBeforeLineRead && !this.invoice.fulfillment_claim_token) {
          this.editBeforeLineRead = false;
          this.lineQuantity = 80;
        }
        return { results: [{ id: 'line-a', account_id: 'acct-a', invoice_id: 'invoice-a', product_id: 'product-a', quantity: this.lineQuantity, price_at_sale: 1 }] };
      },
      run: async () => {
        if (normalized.includes('fulfillment_claim_token = ?') && !normalized.startsWith('update invoices set fulfillment_claim_token = ?') && !values.includes(this.invoice.fulfillment_claim_token)) return { success: true, meta: { changes: 0 }, results: [] };
        if (normalized.startsWith('update products set stock_grams = stock_grams + ?')) { this.stock += Number(values[0]); return { success: true, meta: { changes: 1 } }; }
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
          if (!values.includes(this.invoice.fulfillment_claim_token)) return { success: true, meta: { changes: 0 } };
          this.invoice.status = 'Filled'; this.invoice.inventory_deducted = 1; this.invoice.fulfilled_at ||= '2026-07-13 00:00:00'; this.invoice.fulfillment_claim_token = null; this.invoice.fulfillment_claimed_at = null;
        }
        if (normalized.startsWith("update invoices set status = 'void'")) {
          if (normalized.includes('fulfillment_claim_token = ?') && !values.includes(this.invoice.fulfillment_claim_token)) return { success: true, meta: { changes: 0 } };
          this.invoice.status = 'Void'; this.invoice.inventory_deducted = 0; this.invoice.fulfillment_claim_token = null; this.invoice.fulfillment_claimed_at = null;
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
    if (this.fulfillBeforeVoidBatch && statements.some(statement => statement.sql?.toLowerCase().includes("update invoices set status = 'void'"))) {
      this.fulfillBeforeVoidBatch = false;
      if (!this.invoice.fulfillment_claim_token) {
        this.stock -= this.lineQuantity;
        this.invoice.status = 'Filled'; this.invoice.inventory_deducted = 1; this.invoice.fulfilled_at = 'competing-fulfillment';
      }
    }
    if (this.stealVoidLeaseBeforeBatch && statements.some(statement => statement.sql?.toLowerCase().includes("update invoices set status = 'void'"))) {
      this.stealVoidLeaseBeforeBatch = false;
      this.invoice.fulfillment_claim_token = 'winning-void'; this.invoice.status = 'Void'; this.invoice.inventory_deducted = 0;
      this.stock = 100; this.ledgers = 1; this.audits = 1;
    }
    const snapshot = { invoice: { ...this.invoice }, stock: this.stock, ledgers: this.ledgers, audits: this.audits };
    try { const results = []; for (const statement of statements) { results.push(await statement.run()); if (this.failBatch && statement.sql?.toLowerCase().includes('update products set stock_grams')) throw new Error('simulated batch failure'); } return results; }
    catch (error) { this.invoice = snapshot.invoice; this.stock = snapshot.stock; this.ledgers = snapshot.ledgers; this.audits = snapshot.audits; this.failBatch = false; throw error; }
  }
}

function b64(value: string | Uint8Array) { const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value; return btoa(String.fromCharCode(...bytes)); }
async function jwt() { const now = Math.floor(Date.now() / 1000); const data = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub: 'owner-a', email: 'owner@test.dev', name: 'Owner', active_account_id: 'acct-a', iat: now, exp: now + 60 }))}`; const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return `${data}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))))}`; }
async function fulfill(db: FulfillmentDb) { return worker.fetch(new Request('https://test.dev/api/rpc/fulfill-invoice', { method: 'POST', headers: { Authorization: `Bearer ${await jwt()}`, 'X-Teajia-Account': 'acct-a', 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_id: 'invoice-a' }) }), { DB: db, JWT_SECRET } as any); }
async function voidInvoice(db: FulfillmentDb) { return worker.fetch(new Request('https://test.dev/api/rpc/void-invoice', { method: 'POST', headers: { Authorization: `Bearer ${await jwt()}`, 'X-Teajia-Account': 'acct-a', 'Content-Type': 'application/json' }, body: JSON.stringify({ invoice_id: 'invoice-a' }) }), { DB: db, JWT_SECRET } as any); }

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

  it('claims before reading mutable lines so a pending edit cannot change fulfillment inputs', async () => {
    const db = new FulfillmentDb(); db.editBeforeLineRead = true;
    expect((await fulfill(db)).status).toBe(200);
    expect(db.lineQuantity).toBe(40);
    expect(db.stock).toBe(60);
  });

  it('rejects terminal invoices before reading fulfillment inputs', async () => {
    const db = new FulfillmentDb(); db.invoice.status = 'Void';
    expect((await fulfill(db)).status).toBe(409);
    expect(db.lineReads).toBe(0);
    expect(db.invoice.fulfillment_claim_token).toBeNull();
  });

  it('releases the fulfillment claim after a pre-batch stock rejection', async () => {
    const db = new FulfillmentDb(); db.stock = 20;
    expect((await fulfill(db)).status).toBe(409);
    expect(db.invoice.fulfillment_claim_token).toBeNull();
    expect(db.stock).toBe(20); expect(db.ledgers).toBe(0); expect(db.audits).toBe(0);
  });

  it('void holds the shared lease so a fulfillment cannot win before the void batch', async () => {
    const db = new FulfillmentDb(); db.fulfillBeforeVoidBatch = true;
    expect((await voidInvoice(db)).status).toBe(200);
    expect(db.invoice.status).toBe('Void');
    expect(db.stock).toBe(100);
    expect(db.invoice.fulfillment_claim_token).toBeNull();
  });

  it('restores a filled invoice once and releases the void lease', async () => {
    const db = new FulfillmentDb();
    Object.assign(db.invoice, { status: 'Filled', inventory_deducted: 1 }); db.stock = 60;
    expect((await voidInvoice(db)).status).toBe(200);
    expect(db.invoice).toMatchObject({ status: 'Void', inventory_deducted: 0, fulfillment_claim_token: null });
    expect(db.stock).toBe(100); expect(db.ledgers).toBe(1); expect(db.audits).toBe(1);
  });

  it('does not replay restoration when a competing void wins after the claim', async () => {
    const db = new FulfillmentDb();
    Object.assign(db.invoice, { status: 'Filled', inventory_deducted: 1 }); db.stock = 60; db.stealVoidLeaseBeforeBatch = true;
    expect((await voidInvoice(db)).status).toBe(409);
    expect(db.invoice).toMatchObject({ status: 'Void', inventory_deducted: 0, fulfillment_claim_token: 'winning-void' });
    expect(db.stock).toBe(100); expect(db.ledgers).toBe(1); expect(db.audits).toBe(1);
  });
});
