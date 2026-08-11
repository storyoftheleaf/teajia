import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'split-link-secret';

class SplitLinkDb {
  invoice = {
    id: 'invoice-a', account_id: 'acct-a', invoice_number: 'A-00001', customer_name: 'Buyer',
    customer_whatsapp: null, customer_id: null, display_currency: 'USD', notes: null,
    status: 'Pending', inventory_deducted: 0, fulfillment_claim_token: null as string | null,
    fulfillment_claimed_at: null as string | null,
  };
  lines = [
    { id: 'line-a', account_id: 'acct-a', invoice_id: 'invoice-a', product_id: null as string | null, custom_name: 'Custom', quantity: 40 },
    { id: 'line-b', account_id: 'acct-a', invoice_id: 'invoice-a', product_id: 'product-b', custom_name: null, quantity: 20 },
  ];
  stock = 100;
  sequence = 1;
  createdInvoices: string[] = [];
  audits = 0;
  ledgers = 0;
  lineReads = 0;
  productReads = 0;
  fulfillBeforeMutableRead = false;
  stealBeforeSplitBatch = false;
  stealBeforeLinkBatch = false;
  claimAttempts = 0;
  throwOnSplitBatchPrepare = false;

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    if (this.throwOnSplitBatchPrepare && this.invoice.fulfillment_claim_token && normalized.startsWith('update accounts set invoice_seq')) {
      this.throwOnSplitBatchPrepare = false;
      throw new Error('unexpected split statement construction failure');
    }
    let values: any[] = [];
    const statement = {
      sql,
      bind: (...input: any[]) => { values = input; return statement; },
      first: async () => {
        if (normalized === 'select platform_role from users where id = ?') return { platform_role: null };
        if (normalized.includes('from account_members am')) return { role: 'owner', permissions: '{}', kind: 'location' };
        if (normalized.includes('select status from accounts')) return { status: 'active' };
        if (normalized.startsWith('update invoices set fulfillment_claim_token = ?')) {
          this.claimAttempts += 1;
          const stale = this.invoice.fulfillment_claim_token != null
            && (this.invoice.fulfillment_claimed_at == null || new Date(this.invoice.fulfillment_claimed_at).getTime() < Date.now() - 5 * 60_000);
          const allowed = normalized.includes("status = 'pending'")
            ? this.invoice.status === 'Pending' && this.invoice.inventory_deducted === 0
            : ['Draft', 'Pending', 'Filled', 'Void'].includes(this.invoice.status);
          if (!allowed || (this.invoice.fulfillment_claim_token && !stale)) return null;
          this.invoice.fulfillment_claim_token = String(values[0]);
          this.invoice.fulfillment_claimed_at = new Date().toISOString();
          return { ...this.invoice };
        }
        if (normalized.startsWith('update accounts set invoice_seq')) {
          this.sequence += 1;
          return { invoice_seq: this.sequence, invoice_prefix: 'A' };
        }
        if (normalized.includes('from invoices where id = ?')) return { ...this.invoice };
        if (normalized.includes('from invoice_line_items where id = ?')) {
          this.lineReads += 1;
          this.runMutableReadRace();
          return this.lines.find(line => line.id === values[0] && line.invoice_id === values[1] && line.account_id === values[2]) ?? null;
        }
        if (normalized.includes('from products where id = ?')) {
          this.productReads += 1;
          return values[0] === 'product-a'
            ? { id: 'product-a', stock_grams: this.stock, low_stock_threshold: 0, given_name: 'Tea', product_name: 'Tea', status: 'Active', source_compass_entry_id: null }
            : null;
        }
        if (normalized.startsWith('update products set stock_grams = stock_grams - ?')) {
          if (this.stock < Number(values[0])) return null;
          this.stock -= Number(values[0]);
          return { stock_grams: this.stock };
        }
        if (normalized.startsWith('select stock_grams from products')) return { stock_grams: this.stock };
        return null;
      },
      all: async () => {
        if (!normalized.includes('from invoice_line_items')) return { results: [] };
        this.lineReads += 1;
        this.runMutableReadRace();
        return { results: this.lines.filter(line => line.invoice_id === values[0] && line.account_id === values[1]).map(line => ({ ...line })) };
      },
      run: async () => {
        const fenced = normalized.includes('fulfillment_claim_token = ?');
        if (fenced && !values.includes(this.invoice.fulfillment_claim_token)) return { success: true, meta: { changes: 0 } };
        if (normalized.includes('status = ?') && normalized.includes('inventory_deducted = ?')) {
          const expectedStatus = values.at(-2);
          const expectedDeducted = Number(values.at(-1));
          if (this.invoice.status !== expectedStatus || this.invoice.inventory_deducted !== expectedDeducted) {
            return { success: true, meta: { changes: 0 } };
          }
        }
        if (normalized.startsWith('update accounts set invoice_seq')) {
          this.sequence += Number(values[0]);
          return { success: true, meta: { changes: 1 }, results: [{ invoice_seq: this.sequence }] };
        }
        if (normalized.startsWith('insert into invoices')) {
          this.createdInvoices.push(String(values[0]));
          return { success: true, meta: { changes: 1 } };
        }
        if (normalized.startsWith('update invoice_line_items set invoice_id = ?')) {
          const line = this.lines.find(row => row.id === values[1] && row.account_id === values[2]);
          if (line) line.invoice_id = String(values[0]);
          return { success: true, meta: { changes: line ? 1 : 0 } };
        }
        if (normalized.startsWith('update invoice_line_items set product_id = ?')) {
          const line = this.lines.find(row => row.id === values[1] && row.invoice_id === values[2] && row.account_id === values[3]);
          if (line) { line.product_id = String(values[0]); line.custom_name = null; }
          return { success: true, meta: { changes: line ? 1 : 0 } };
        }
        if (normalized.startsWith('update products set stock_grams = stock_grams - ?')) {
          this.stock -= Number(values[0]);
          return { success: true, meta: { changes: 1 } };
        }
        if (normalized.startsWith('insert into activity_logs')) {
          this.audits += 1;
          return { success: true, meta: { changes: 1 } };
        }
        if (normalized.startsWith('insert into stock_ledger')) {
          this.ledgers += 1;
          return { success: true, meta: { changes: 1 } };
        }
        if (normalized.startsWith('update invoices set fulfillment_claim_token = null')) {
          if (this.invoice.fulfillment_claim_token !== values[2]) return { success: true, meta: { changes: 0 } };
          this.invoice.fulfillment_claim_token = null;
          this.invoice.fulfillment_claimed_at = null;
          return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 1 } };
      },
    };
    return statement;
  }

  private runMutableReadRace() {
    if (!this.fulfillBeforeMutableRead || this.invoice.fulfillment_claim_token) return;
    this.fulfillBeforeMutableRead = false;
    this.invoice.status = 'Filled';
    this.invoice.inventory_deducted = 1;
    this.stock = 60;
  }

  async batch(statements: Array<{ sql: string; run: () => Promise<any> }>) {
    const isSplit = statements.some(statement => statement.sql.toLowerCase().includes('insert into invoices'));
    const isLink = statements.some(statement => statement.sql.toLowerCase().includes('update invoice_line_items set product_id'));
    if ((isSplit && this.stealBeforeSplitBatch) || (isLink && this.stealBeforeLinkBatch)) {
      this.stealBeforeSplitBatch = false;
      this.stealBeforeLinkBatch = false;
      this.invoice.fulfillment_claim_token = 'lifecycle-winner';
      this.invoice.status = 'Void';
      this.invoice.inventory_deducted = 0;
    }
    const snapshot = {
      invoice: { ...this.invoice }, lines: this.lines.map(line => ({ ...line })), stock: this.stock,
      sequence: this.sequence, createdInvoices: [...this.createdInvoices], audits: this.audits,
      ledgers: this.ledgers,
    };
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    } catch (error) {
      this.invoice = snapshot.invoice;
      this.lines = snapshot.lines;
      this.stock = snapshot.stock;
      this.sequence = snapshot.sequence;
      this.createdInvoices = snapshot.createdInvoices;
      this.audits = snapshot.audits;
      this.ledgers = snapshot.ledgers;
      throw error;
    }
  }
}

function b64(value: string | Uint8Array) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return btoa(String.fromCharCode(...bytes));
}

async function jwt() {
  const now = Math.floor(Date.now() / 1000);
  const data = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub: 'owner-a', email: 'owner@test.dev', name: 'Owner', active_account_id: 'acct-a', iat: now, exp: now + 60 }))}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${data}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))))}`;
}

async function rpc(db: SplitLinkDb, path: string, body: Record<string, unknown>) {
  return worker.fetch(new Request(`https://test.dev${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await jwt()}`, 'X-Teajia-Account': 'acct-a', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET } as any);
}

const split = (db: SplitLinkDb) => rpc(db, '/api/rpc/split-invoice', { invoice_id: 'invoice-a', line_item_ids: ['line-a'] });
const link = (db: SplitLinkDb) => rpc(db, '/api/rpc/link-line-item', { invoice_id: 'invoice-a', line_item_id: 'line-a', product_id: 'product-a' });

describe('invoice split and line-link lifecycle fencing', () => {
  it.each([
    { invoice_id: null, line_item_ids: ['line-a'] },
    { invoice_id: '   ', line_item_ids: ['line-a'] },
    { invoice_id: 'invoice-a', line_item_ids: null },
    { invoice_id: 'invoice-a', line_item_ids: 'line-a' },
    { invoice_id: 'invoice-a', line_item_ids: [] },
    { invoice_id: 'invoice-a', line_item_ids: ['   '] },
    { invoice_id: 'invoice-a', line_item_ids: ['line-a', 'line-a'] },
  ])('rejects malformed split identifiers before claiming: $invoice_id / $line_item_ids', async body => {
    const db = new SplitLinkDb();
    const response = await rpc(db, '/api/rpc/split-invoice', body as any);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(db.claimAttempts).toBe(0);
    expect(db.sequence).toBe(1); expect(db.createdInvoices).toEqual([]); expect(db.audits).toBe(0);
  });

  it('token-safely releases after an unexpected post-claim exception', async () => {
    const db = new SplitLinkDb(); db.throwOnSplitBatchPrepare = true;
    expect((await split(db)).status).toBe(500);
    expect(db.claimAttempts).toBe(1);
    expect(db.invoice.fulfillment_claim_token).toBeNull();
    expect(db.sequence).toBe(1); expect(db.createdInvoices).toEqual([]); expect(db.audits).toBe(0);
  });

  it('claims a Pending invoice before reading split line inputs', async () => {
    const db = new SplitLinkDb(); db.fulfillBeforeMutableRead = true;
    expect((await split(db)).status).toBe(201);
    expect(db.invoice.status).toBe('Pending');
    expect(db.stock).toBe(100);
    expect(db.invoice.fulfillment_claim_token).toBeNull();
  });

  it('rejects split while fulfillment owns the lifecycle lease without reads or writes', async () => {
    const db = new SplitLinkDb(); db.invoice.fulfillment_claim_token = 'fulfillment-owner'; db.invoice.fulfillment_claimed_at = new Date().toISOString();
    expect((await split(db)).status).toBe(409);
    expect(db.lineReads).toBe(0); expect(db.sequence).toBe(1); expect(db.createdInvoices).toEqual([]); expect(db.audits).toBe(0);
  });

  it('returns 409 without sequence, line, invoice, or audit writes when split loses its lease', async () => {
    const db = new SplitLinkDb(); db.stealBeforeSplitBatch = true;
    expect((await split(db)).status).toBe(409);
    expect(db.sequence).toBe(1); expect(db.createdInvoices).toEqual([]); expect(db.lines[0].invoice_id).toBe('invoice-a'); expect(db.audits).toBe(0);
  });

  it('rejects a split line from another account without sequence or invoice writes', async () => {
    const db = new SplitLinkDb();
    db.lines.push({ id: 'foreign-line', account_id: 'acct-b', invoice_id: 'invoice-a', product_id: null, custom_name: 'Foreign', quantity: 1 });
    const response = await rpc(db, '/api/rpc/split-invoice', { invoice_id: 'invoice-a', line_item_ids: ['foreign-line'] });
    expect(response.status).toBe(400);
    expect(db.sequence).toBe(1); expect(db.createdInvoices).toEqual([]); expect(db.audits).toBe(0);
    expect(db.lines.find(line => line.id === 'foreign-line')?.invoice_id).toBe('invoice-a');
    expect(db.invoice.fulfillment_claim_token).toBeNull();
  });

  it('claims before reading link inputs so fulfillment cannot change inventory state', async () => {
    const db = new SplitLinkDb(); db.fulfillBeforeMutableRead = true;
    const response = await link(db);
    expect(response.status).toBe(200);
    expect(db.invoice.status).toBe('Pending'); expect(db.stock).toBe(100);
    expect(db.lines[0].product_id).toBe('product-a'); expect(db.invoice.fulfillment_claim_token).toBeNull();
  });

  it('rejects link while void owns the lifecycle lease without mutable reads', async () => {
    const db = new SplitLinkDb(); db.invoice.fulfillment_claim_token = 'void-owner'; db.invoice.fulfillment_claimed_at = new Date().toISOString();
    expect((await link(db)).status).toBe(409);
    expect(db.lineReads).toBe(0); expect(db.productReads).toBe(0); expect(db.lines[0].product_id).toBeNull(); expect(db.audits).toBe(0);
  });

  it('returns 409 without line, stock, ledger, or audit writes when link loses its lease', async () => {
    const db = new SplitLinkDb(); db.stealBeforeLinkBatch = true;
    expect((await link(db)).status).toBe(409);
    expect(db.lines[0].product_id).toBeNull(); expect(db.stock).toBe(100); expect(db.audits).toBe(0);
    expect(db.invoice).toMatchObject({ status: 'Void', fulfillment_claim_token: 'lifecycle-winner' });
  });

  it('preserves retroactive stock deduction when linking a fulfilled invoice', async () => {
    const db = new SplitLinkDb(); Object.assign(db.invoice, { status: 'Filled', inventory_deducted: 1 });
    const response = await link(db);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, inventory_deducted: true });
    expect(db.lines[0].product_id).toBe('product-a'); expect(db.stock).toBe(60); expect(db.ledgers).toBe(1); expect(db.audits).toBe(1);
    expect(db.invoice.fulfillment_claim_token).toBeNull();
  });

  it('releases the link lease when the account-scoped line does not exist', async () => {
    const db = new SplitLinkDb(); db.lines[0].account_id = 'acct-b';
    expect((await link(db)).status).toBe(404);
    expect(db.lines[0].product_id).toBeNull(); expect(db.stock).toBe(100); expect(db.ledgers).toBe(0); expect(db.audits).toBe(0);
    expect(db.invoice.fulfillment_claim_token).toBeNull();
  });

  it('releases the fulfilled-link lease after a pre-batch stock rejection', async () => {
    const db = new SplitLinkDb(); Object.assign(db.invoice, { status: 'Filled', inventory_deducted: 1 }); db.stock = 20;
    expect((await link(db)).status).toBe(409);
    expect(db.lines[0].product_id).toBeNull(); expect(db.stock).toBe(20); expect(db.ledgers).toBe(0); expect(db.audits).toBe(0);
    expect(db.invoice.fulfillment_claim_token).toBeNull();
  });
});
