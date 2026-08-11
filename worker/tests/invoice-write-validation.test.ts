import { describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'invoice-write-secret';

type RecordedStatement = { sql: string; values: unknown[] };

class InvoiceWriteDb {
  readonly writes: RecordedStatement[] = [];
  readonly reads: RecordedStatement[] = [];
  sequenceAllocations = 0;
  genericStatusBeforeUpdate: string | null = null;
  editStatusBeforeClaim: string | null = null;
  editStatusBeforeBatch: string | null = null;
  failEditBatch = false;
  editClaimAttempts = 0;
  editReleaseAttempts = 0;
  invoices = [{
    id: 'invoice-a', account_id: 'account-a', invoice_number: 'A-00001', customer_name: 'Existing Buyer',
    customer_whatsapp: null, customer_id: null, display_currency: 'USD', shipping_cost_usd: 0,
    status: 'Pending', notes: null, source_event_id: null, payment_status: 'unpaid', inventory_deducted: 0,
    fulfillment_claim_token: null as string | null, fulfillment_claimed_at: null as string | null,
  }];
  lines = [{ id: 'line-a', account_id: 'account-a', invoice_id: 'invoice-a', product_id: 'product-a', custom_name: null, quantity: 1, price_at_sale: 5 }];
  products = [
    { id: 'product-a', account_id: 'account-a' },
    { id: 'product-b', account_id: 'account-a' },
    { id: 'product-other', account_id: 'account-b' },
  ];
  customers = [
    { id: 'customer-a', account_id: 'account-a' },
    { id: 'customer-other', account_id: 'account-b' },
  ];

  prepare(sql: string) {
    const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
    let values: unknown[] = [];
    const record = () => ({ sql: normalized, values: [...values] });
    const statement = {
      bind: (...input: unknown[]) => { values = input; return statement; },
      first: async () => {
        if (normalized.startsWith('update accounts set invoice_seq')) {
          this.sequenceAllocations += 1;
          this.writes.push(record());
          return { invoice_seq: this.sequenceAllocations, invoice_prefix: 'A' };
        }
        if (normalized.startsWith('update invoices set fulfillment_claim_token = ?')) {
          this.editClaimAttempts += 1;
          if (this.editStatusBeforeClaim) {
            this.invoices[0].status = this.editStatusBeforeClaim;
            this.editStatusBeforeClaim = null;
          }
          const invoice = this.invoices.find(row => row.id === values[1] && row.account_id === values[2]);
          const stale = invoice?.fulfillment_claim_token != null
            && (invoice.fulfillment_claimed_at == null || new Date(invoice.fulfillment_claimed_at).getTime() < Date.now() - 5 * 60_000);
          if (!invoice || (invoice.status !== null && invoice.status !== 'Pending') || invoice.inventory_deducted !== 0 || (invoice.fulfillment_claim_token && !stale)) return null;
          invoice.status = 'Pending';
          invoice.fulfillment_claim_token = String(values[0]);
          invoice.fulfillment_claimed_at = new Date().toISOString();
          this.writes.push(record());
          return { id: invoice.id };
        }
        this.reads.push(record());
        if (normalized.includes('select platform_role, session_version from users')) return { platform_role: null, session_version: 0 };
        if (normalized === 'select platform_role from users where id = ?') return { platform_role: null };
        if (normalized.includes('from account_members am join accounts')) return { role: 'owner', permissions: '{}', kind: 'location' };
        if (normalized.includes('select status from accounts')) return { status: 'active' };
        if (normalized.includes('from invoices where id = ? and account_id = ?')) {
          return this.invoices.find(row => row.id === values[0] && row.account_id === values[1]) ?? null;
        }
        if (normalized.startsWith('select id from products where id = ? and account_id = ?')) {
          return this.products.find(row => row.id === values[0] && row.account_id === values[1]) ?? null;
        }
        if (normalized.startsWith('select id from customers where id = ? and account_id = ?')) {
          return this.customers.find(row => row.id === values[0] && row.account_id === values[1]) ?? null;
        }
        return null;
      },
      all: async () => {
        this.reads.push(record());
        if (normalized.includes('from invoice_line_items') && normalized.includes('invoice_id = ?') && normalized.includes('account_id = ?')) {
          return { results: this.lines.filter(row => row.invoice_id === values[0] && row.account_id === values[1]) };
        }
        return { results: [] };
      },
      run: async () => {
        const invoice = this.invoices[0];
        if (normalized.startsWith('update invoices set fulfillment_claim_token = null')) {
          this.editReleaseAttempts += 1;
          const token = String(values.at(-1));
          const requiresPendingFence = normalized.includes("status = 'pending'");
          if (invoice.fulfillment_claim_token !== token
            || (requiresPendingFence && (invoice.status !== 'Pending' || invoice.inventory_deducted !== 0))) {
            return { success: true, meta: { changes: 0 } };
          }
          invoice.fulfillment_claim_token = null;
          invoice.fulfillment_claimed_at = null;
          this.writes.push(record());
          return { success: true, meta: { changes: 1 } };
        }
        const isGenericInvoiceUpdate = normalized.startsWith('update invoices set')
          && !normalized.includes('fulfillment_claim_token = null');
        if (isGenericInvoiceUpdate && this.genericStatusBeforeUpdate) {
          invoice.status = this.genericStatusBeforeUpdate;
          this.genericStatusBeforeUpdate = null;
        }
        if (isGenericInvoiceUpdate && normalized.includes('and status = ?') && invoice.status !== values.at(-1)) {
          return { success: true, meta: { changes: 0 } };
        }
        const fencedEdit = normalized.includes('fulfillment_claim_token = ?');
        if (fencedEdit) {
          const token = String(values.at(-1));
          if (invoice.fulfillment_claim_token !== token || invoice.status !== 'Pending' || invoice.inventory_deducted !== 0) {
            return { success: true, meta: { changes: 0 } };
          }
        }
        if (/^(insert|update|delete)/.test(normalized)) this.writes.push(record());
        return { success: true, meta: { changes: 1 } };
      },
      sql: normalized,
    };
    return statement;
  }

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    if (this.editStatusBeforeBatch) {
      this.invoices[0].status = this.editStatusBeforeBatch;
      this.editStatusBeforeBatch = null;
    }
    const writesLength = this.writes.length;
    const invoiceSnapshot = { ...this.invoices[0] };
    try {
      const results: unknown[] = [];
      for (const [index, statement] of statements.entries()) {
        results.push(await statement.run());
        if (this.failEditBatch && index === 0) throw new Error('simulated edit batch failure');
      }
      return results;
    } catch (error) {
      this.writes.splice(writesLength);
      Object.assign(this.invoices[0], invoiceSnapshot);
      this.failEditBatch = false;
      throw error;
    }
  }
}

function b64(input: string | Uint8Array) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return btoa(String.fromCharCode(...bytes));
}

async function token() {
  const now = Math.floor(Date.now() / 1000);
  const payload = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub: 'user-a', email: 'owner@test.dev', active_account_id: 'account-a', session_version: 0, iat: now, exp: now + 60 }))}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return `${payload}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))))}`;
}

async function request(db: InvoiceWriteDb, method: string, path: string, body: unknown) {
  return worker.fetch(new Request(`https://test.dev${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'X-Teajia-Account': 'account-a', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), { DB: db, JWT_SECRET } as any);
}

async function rawRequest(db: InvoiceWriteDb, method: string, path: string, body: string) {
  return worker.fetch(new Request(`https://test.dev${path}`, {
    method,
    headers: { Authorization: `Bearer ${await token()}`, 'X-Teajia-Account': 'account-a', 'Content-Type': 'application/json' },
    body,
  }), { DB: db, JWT_SECRET } as any);
}

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    invoice: { customer_name: '  Buyer Name  ', display_currency: ' USD ', ...overrides },
    lineItems: [{ product_id: 'product-a', quantity: 2, price_at_sale: 4 }],
  };
}

function expectNoWrites(db: InvoiceWriteDb) {
  expect(db.sequenceAllocations).toBe(0);
  expect(db.writes).toEqual([]);
}

function invoiceDataWrites(db: InvoiceWriteDb) {
  return db.writes.filter(entry => !entry.sql.startsWith('update invoices set fulfillment_claim_token'));
}

function invoiceHeaderWrite(db: InvoiceWriteDb) {
  return db.writes.find(entry => entry.sql.startsWith('update invoices set')
    && !entry.sql.startsWith('update invoices set fulfillment_claim_token'));
}

describe('retail invoice write validation', () => {
  it('returns a structured 400 for malformed create JSON without writes', async () => {
    const db = new InvoiceWriteDb();
    const response = await rawRequest(db, 'POST', '/api/invoices', '{');
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_invoice' });
    expectNoWrites(db);
  });

  it.each([
    ['blank customer', createBody({ customer_name: ' ' })],
    ['empty lines', { ...createBody(), lineItems: [] }],
    ['numeric string', { ...createBody(), lineItems: [{ product_id: 'product-a', quantity: '2', price_at_sale: 4 }] }],
    ['lowercase currency', createBody({ display_currency: 'usd' })],
    ['numeric currency', createBody({ display_currency: 'US1' })],
    ['short currency', createBody({ display_currency: 'U' })],
    ['word currency', createBody({ display_currency: 'Banana' })],
    ['null shipping', createBody({ shipping_cost_usd: null })],
    ['null currency', createBody({ display_currency: null })],
    ['null status', createBody({ status: null })],
    ['null payment', createBody({ payment_status: null })],
    ['terminal status', createBody({ status: 'Filled' })],
    ['paid status', createBody({ payment_status: 'paid' })],
  ])('rejects invalid create input before allocating a sequence or writing: %s', async (_label, body) => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'POST', '/api/invoices', body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_invoice' });
    expectNoWrites(db);
  });

  it.each([
    ['missing product', 'missing-product'],
    ['cross-account product', 'product-other'],
  ])('rejects a %s before create writes', async (_label, productId) => {
    const db = new InvoiceWriteDb();
    const body = createBody();
    body.lineItems = [
      { product_id: productId, quantity: 1, price_at_sale: 2 },
      { product_id: productId, quantity: 2, price_at_sale: 3 },
    ];
    const response = await request(db, 'POST', '/api/invoices', body);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'invoice_product_not_found', details: { product_id: productId } });
    expect(db.reads.filter(entry => entry.sql.startsWith('select id from products')).map(entry => entry.values)).toEqual([[productId, 'account-a']]);
    expectNoWrites(db);
  });

  it('rejects a cross-account customer before create writes', async () => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'POST', '/api/invoices', createBody({ customer_id: 'customer-other' }));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'invoice_customer_not_found', details: { customer_id: 'customer-other' } });
    expectNoWrites(db);
  });

  it('binds normalized values for a valid create while preserving custom lines', async () => {
    const db = new InvoiceWriteDb();
    const body = createBody({ customer_id: 'customer-a', shipping_cost_usd: 0 });
    body.lineItems = [
      { product_id: 'product-a', quantity: 2, price_at_sale: 4 },
      { product_id: null as any, quantity: 1, price_at_sale: 3, custom_name: '  Gift tin  ' } as any,
    ];
    const response = await request(db, 'POST', '/api/invoices', body);
    expect(response.status).toBe(201);
    const invoiceInsert = db.writes.find(entry => entry.sql.startsWith('insert into invoices'))!;
    expect(invoiceInsert.values.slice(3, 13)).toEqual(['Buyer Name', null, 'customer-a', 'USD', 0, 'Pending', 0, null, null, 'unpaid']);
    const lineInserts = db.writes.filter(entry => entry.sql.startsWith('insert into invoice_line_items'));
    expect(lineInserts.map(entry => entry.values.slice(3))).toEqual([
      ['product-a', null, 2, 4],
      [null, 'Gift tin', 1, 3],
    ]);
  });

  it.each([
    ['line product overflow', [{ custom_name: 'Overflow', quantity: 2, price_at_sale: Number.MAX_VALUE }]],
    ['aggregate overflow', [
      { custom_name: 'First', quantity: 1, price_at_sale: Number.MAX_VALUE },
      { custom_name: 'Second', quantity: 1, price_at_sale: Number.MAX_VALUE },
    ]],
  ])('rejects create %s before allocating a sequence or writing', async (_label, lineItems) => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'POST', '/api/invoices', { ...createBody(), lineItems });
    expect(response.status).toBe(400);
    expectNoWrites(db);
  });

  it('merges a partial pending edit with stored fields and lines before validating', async () => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', { customer_name: '  Renamed Buyer  ' });
    expect(response.status).toBe(200);
    const update = invoiceHeaderWrite(db)!;
    expect(update.values[0]).toBe('Renamed Buyer');
    expect(db.writes.some(entry => entry.sql.startsWith('delete from invoice_line_items'))).toBe(false);
  });

  it.each(['usd', 'US1', 'U', 'Banana'])('rejects malformed edit currency %s without writes', async display_currency => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', { display_currency });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'invalid_invoice' });
    expectNoWrites(db);
  });

  it.each([
    ['shipping_cost_usd', null],
    ['display_currency', null],
    ['status', null],
    ['payment_status', null],
  ])('rejects explicit null edit field %s without writes', async (field, value) => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', { [field]: value });
    expect(response.status).toBe(400);
    expectNoWrites(db);
  });

  it('normalizes persisted legacy null defaults for an unrelated pending header edit', async () => {
    const db = new InvoiceWriteDb();
    Object.assign(db.invoices[0], { display_currency: null, shipping_cost_usd: null, status: null, payment_status: null });
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', { notes: 'Legacy-safe edit' });
    expect(response.status).toBe(200);
    expect(invoiceHeaderWrite(db)?.values[0]).toBe('Legacy-safe edit');
  });

  it.each([
    ['empty body', {}],
    ['unknown field', { amount_usd: 100 }],
  ])('rejects a pending item edit with %s before activity writes', async (_label, body) => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'validation_failed' });
    expectNoWrites(db);
  });

  it.each([
    ['line product overflow', [{ custom_name: 'Overflow', quantity: 2, price_at_sale: Number.MAX_VALUE }]],
    ['aggregate overflow', [
      { custom_name: 'First', quantity: 1, price_at_sale: Number.MAX_VALUE },
      { custom_name: 'Second', quantity: 1, price_at_sale: Number.MAX_VALUE },
    ]],
  ])('rejects edit %s without writes', async (_label, lineItems) => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', { lineItems });
    expect(response.status).toBe(400);
    expectNoWrites(db);
  });

  it('round-trips a custom-only replacement line', async () => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', {
      lineItems: [{ product_id: null, custom_name: '  Private tasting fee  ', quantity: 1, price_at_sale: 25 }],
    });
    expect(response.status).toBe(200);
    expect(db.writes.find(entry => entry.sql.startsWith('insert into invoice_line_items'))?.values.slice(3))
      .toEqual([null, 'Private tasting fee', 1, 25, 'invoice-a', 'account-a', expect.any(String)]);
  });

  it('allows a header-only edit when unchanged legacy references are orphaned', async () => {
    const db = new InvoiceWriteDb();
    db.invoices[0].customer_id = 'orphaned-customer';
    db.lines[0].product_id = 'orphaned-product';
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', { customer_name: '  Legacy Buyer  ' });
    expect(response.status).toBe(200);
    expect(invoiceHeaderWrite(db)?.values[0]).toBe('Legacy Buyer');
    expect(db.reads.some(entry => entry.sql.startsWith('select id from products'))).toBe(false);
    expect(db.reads.some(entry => entry.sql.startsWith('select id from customers'))).toBe(false);
    expect(db.writes.some(entry => entry.sql.startsWith('insert or ignore into contact_relationships'))).toBe(false);
  });

  it.each([
    ['cross-account replacement product', { lineItems: [{ product_id: 'product-other', quantity: 1, price_at_sale: 2 }] }],
    ['missing replacement product', { lineItems: [{ product_id: 'missing-product', quantity: 1, price_at_sale: 2 }] }],
    ['cross-account replacement customer', { customer_id: 'customer-other' }],
    ['missing replacement customer', { customer_id: 'missing-customer' }],
    ['invalid replacement quantity', { lineItems: [{ product_id: 'product-a', quantity: 0, price_at_sale: 2 }] }],
  ])('rejects %s without changing the pending invoice', async (_label, body) => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', body);
    expect([400, 404]).toContain(response.status);
    expectNoWrites(db);
  });

  it.each([
    ['Filled lifecycle bypass', { status: 'Filled' }],
    ['Void lifecycle bypass', { status: 'Void' }],
    ['paid payment bypass', { payment_status: 'paid' }],
    ['partial payment bypass', { payment_status: 'partial' }],
    ['null lifecycle', { status: null }],
    ['null payment lifecycle', { payment_status: null }],
    ['null shipping', { shipping_cost_usd: null }],
    ['null currency', { display_currency: null }],
    ['nonexistent column', { amount_usd: 100 }],
  ])('blocks generic update: %s', async (_label, body) => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'PUT', '/api/invoices/invoice-a', body);
    expect(response.status).toBe(400);
    expectNoWrites(db);
  });

  it.each([
    ['Draft', 'Draft'],
    ['Pending', 'Pending'],
    ['Draft', 'Pending'],
  ])('allows generic lifecycle transition %s to %s', async (persisted, requested) => {
    const db = new InvoiceWriteDb();
    db.invoices[0].status = persisted;
    const response = await request(db, 'PUT', '/api/invoices/invoice-a', { status: requested });
    expect(response.status).toBe(200);
    expect(db.reads.some(entry => entry.sql.startsWith('select status, payment_status from invoices'))).toBe(true);
    expect(db.writes.find(entry => entry.sql.startsWith('update invoices set'))?.values[0]).toBe(requested);
  });

  it.each([
    ['Pending', 'Draft'],
    ['Filled', 'Pending'],
    ['Void', 'Draft'],
  ])('rejects generic lifecycle transition %s to %s without writes', async (persisted, requested) => {
    const db = new InvoiceWriteDb();
    db.invoices[0].status = persisted;
    const response = await request(db, 'PUT', '/api/invoices/invoice-a', { status: requested });
    expect(response.status).toBe(400);
    expectNoWrites(db);
  });

  it.each([
    ['paid', { payment_status: 'unpaid' }],
    ['partial', { payment_status: 'unpaid' }],
    ['paid', { payment_date: '2026-08-11' }],
    ['partial', { payment_method: 'cash' }],
  ])('rejects generic payment mutation from %s without writes', async (persisted, body) => {
    const db = new InvoiceWriteDb();
    db.invoices[0].payment_status = persisted;
    const response = await request(db, 'PUT', '/api/invoices/invoice-a', body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'validation_failed' });
    expectNoWrites(db);
  });

  it.each(['Filled', 'Void'])('allows a notes-only generic edit on a terminal %s invoice', async status => {
    const db = new InvoiceWriteDb();
    db.invoices[0].status = status;
    const response = await request(db, 'PUT', '/api/invoices/invoice-a', { notes: 'Administrative note' });
    expect(response.status).toBe(200);
    expect(db.writes.find(entry => entry.sql.startsWith('update invoices set'))?.values[0]).toBe('Administrative note');
  });

  it.each([
    ['Draft', 'Pending'],
    ['Draft', 'Filled'],
    ['Pending', 'Void'],
  ])('CAS-rejects a stale generic status write after %s concurrently becomes %s', async (persisted, concurrent) => {
    const db = new InvoiceWriteDb();
    db.invoices[0].status = persisted;
    db.genericStatusBeforeUpdate = concurrent;
    const response = await request(db, 'PUT', '/api/invoices/invoice-a', { status: 'Pending', customer_id: 'customer-a' });
    expect(response.status).toBe(409);
    expect(db.invoices[0].status).toBe(concurrent);
    expect(invoiceDataWrites(db)).toEqual([]);
    expect(db.writes.some(entry => entry.sql.startsWith('insert or ignore into contact_relationships'))).toBe(false);
  });

  it('rejects an edit claim when the invoice becomes terminal after validation', async () => {
    const db = new InvoiceWriteDb();
    db.editStatusBeforeClaim = 'Filled';
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', { notes: 'Too late' });
    expect(response.status).toBe(409);
    expect(db.editClaimAttempts).toBe(1);
    expect(db.invoices[0].status).toBe('Filled');
    expect(invoiceDataWrites(db)).toEqual([]);
  });

  it('fences the edit batch when a terminal transition wins after the claim', async () => {
    const db = new InvoiceWriteDb();
    db.editStatusBeforeBatch = 'Void';
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', {
      customer_id: 'customer-a',
      lineItems: [{ custom_name: 'Raced line', quantity: 1, price_at_sale: 10 }],
    });
    expect(response.status).toBe(409);
    expect(db.invoices[0]).toMatchObject({ status: 'Void', fulfillment_claim_token: null });
    expect(invoiceDataWrites(db)).toEqual([]);
    expect(db.writes.some(entry => entry.sql.startsWith('insert or ignore into contact_relationships'))).toBe(false);
  });

  it('releases the shared claim after a normal pending edit', async () => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', { notes: 'Claimed edit' });
    expect(response.status).toBe(200);
    expect(db.editClaimAttempts).toBe(1);
    expect(db.invoices[0].fulfillment_claim_token).toBeNull();
    expect(db.writes.some(entry => entry.sql.startsWith("insert into activity_logs") && entry.sql.includes("select"))).toBe(true);
  });

  it('best-effort releases the shared claim after an atomic batch failure', async () => {
    const db = new InvoiceWriteDb();
    db.failEditBatch = true;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', {
      lineItems: [{ custom_name: 'Will roll back', quantity: 1, price_at_sale: 10 }],
    }).finally(() => consoleError.mockRestore());
    expect(response.status).toBe(500);
    expect(db.editClaimAttempts).toBe(1);
    expect(db.editReleaseAttempts).toBe(1);
    expect(db.invoices[0].fulfillment_claim_token).toBeNull();
    expect(invoiceDataWrites(db)).toEqual([]);
  });
});
