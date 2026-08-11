import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'invoice-write-secret';

type RecordedStatement = { sql: string; values: unknown[] };

class InvoiceWriteDb {
  readonly writes: RecordedStatement[] = [];
  readonly reads: RecordedStatement[] = [];
  sequenceAllocations = 0;
  invoices = [{
    id: 'invoice-a', account_id: 'account-a', invoice_number: 'A-00001', customer_name: 'Existing Buyer',
    customer_whatsapp: null, customer_id: null, display_currency: 'USD', shipping_cost_usd: 0,
    status: 'Pending', notes: null, source_event_id: null, payment_status: 'unpaid',
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
        this.reads.push(record());
        if (normalized.includes('select platform_role, session_version from users')) return { platform_role: null, session_version: 0 };
        if (normalized === 'select platform_role from users where id = ?') return { platform_role: null };
        if (normalized.includes('from account_members am join accounts')) return { role: 'owner', permissions: '{}', kind: 'location' };
        if (normalized.includes('select status from accounts')) return { status: 'active' };
        if (normalized.startsWith('select * from invoices where id = ? and account_id = ?')) {
          return this.invoices.find(row => row.id === values[0] && row.account_id === values[1]) ?? null;
        }
        if (normalized.startsWith('select id from invoices where id = ? and account_id = ?')) {
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
        if (/^(insert|update|delete)/.test(normalized)) this.writes.push(record());
        return { success: true, meta: { changes: 1 } };
      },
    };
    return statement;
  }

  async batch(statements: Array<{ run: () => Promise<unknown> }>) {
    return Promise.all(statements.map(statement => statement.run()));
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

  it('merges a partial pending edit with stored fields and lines before validating', async () => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', { customer_name: '  Renamed Buyer  ' });
    expect(response.status).toBe(200);
    const update = db.writes.find(entry => entry.sql.startsWith('update invoices set'))!;
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

  it('allows a header-only edit when unchanged legacy references are orphaned', async () => {
    const db = new InvoiceWriteDb();
    db.invoices[0].customer_id = 'orphaned-customer';
    db.lines[0].product_id = 'orphaned-product';
    const response = await request(db, 'PUT', '/api/invoices/invoice-a/items', { customer_name: '  Legacy Buyer  ' });
    expect(response.status).toBe(200);
    expect(db.writes.find(entry => entry.sql.startsWith('update invoices set'))?.values[0]).toBe('Legacy Buyer');
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
    ['nonexistent column', { amount_usd: 100 }],
  ])('blocks generic update: %s', async (_label, body) => {
    const db = new InvoiceWriteDb();
    const response = await request(db, 'PUT', '/api/invoices/invoice-a', body);
    expect(response.status).toBe(400);
    expectNoWrites(db);
  });
});
