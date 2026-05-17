import { describe, expect, it } from 'vitest';
import { mcpFetch } from '../src/mcp';

const ACCOUNT_ID = 'acc_test';
const TOKEN = 'tjmcp_test';

type ProductRecord = {
  id: string;
  stock_grams: number;
  low_stock_threshold: number;
  given_name: string | null;
  product_name: string;
  status: string;
  source_compass_entry_id: string | null;
};

type FakeDbState = {
  invoice: {
    id: string;
    invoice_number: string;
    customer_name: string;
    status: string;
    payment_status: string;
    payment_date: string | null;
    inventory_deducted: number;
  };
  lineItems: Array<{ product_id: string | null; quantity: number }>;
  products: Map<string, ProductRecord>;
  listings: Map<string, { stock_grams: number; status: string }>;
  ledger: Array<{ product_id: string; delta: number; balance_after: number }>;
  batchedSql: string[];
};

class FakeStatement {
  values: unknown[] = [];

  constructor(
    readonly sql: string,
    private state: FakeDbState,
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first() {
    const sql = normalizeSql(this.sql);
    if (sql.includes('from mcp_tokens where token_hash = ?')) {
      return {
        id: 'mcp_token_test',
        account_id: ACCOUNT_ID,
        user_id: 'user_test',
        user_email: 'staff@example.com',
        revoked_at: null,
        scopes: JSON.stringify(['sales:write']),
      };
    }
    if (sql.includes('from invoices where id = ? and account_id = ?')) {
      return this.state.invoice;
    }
    if (sql.includes('from products where id = ? and account_id = ?')) {
      return this.state.products.get(String(this.values[0])) || null;
    }
    return null;
  }

  async all() {
    const sql = normalizeSql(this.sql);
    if (sql.includes('from invoice_line_items where invoice_id = ? and account_id = ?')) {
      return { results: this.state.lineItems };
    }
    return { results: [] };
  }

  async run() {
    return runStatement(this.state, this);
  }
}

class FakeDb {
  constructor(private state: FakeDbState) {}

  prepare(sql: string) {
    return new FakeStatement(sql, this.state);
  }

  async batch(statements: FakeStatement[]) {
    const results = [];
    for (const statement of statements) {
      this.state.batchedSql.push(normalizeSql(statement.sql));
      results.push(await runStatement(this.state, statement));
    }
    return results;
  }
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

function runStatement(state: FakeDbState, statement: FakeStatement) {
  const sql = normalizeSql(statement.sql);
  const values = statement.values;

  if (sql.startsWith('update products set stock_grams = stock_grams - ?')) {
    const grams = Number(values[0]);
    const productId = String(values[1]);
    const product = state.products.get(productId);
    if (!product) return { success: true, meta: { changes: 0 } };
    product.stock_grams -= grams;
    return { success: true, meta: { changes: 1 } };
  }

  if (sql.startsWith('update product_listings set stock_grams = stock_grams - ?')) {
    const grams = Number(values[0]);
    const listingId = String(values[1]);
    const listing = state.listings.get(listingId);
    if (!listing) return { success: true, meta: { changes: 0 } };
    listing.stock_grams -= grams;
    return { success: true, meta: { changes: 1 } };
  }

  if (sql.startsWith('insert into stock_ledger')) {
    state.ledger.push({
      product_id: String(values[1]),
      delta: Number(values[2]),
      balance_after: Number(values[3]),
    });
    return { success: true, meta: { changes: 1 } };
  }

  if (sql.startsWith('update invoices set inventory_deducted = -1')) {
    if (state.invoice.inventory_deducted !== 0) return { success: true, meta: { changes: 0 } };
    state.invoice.inventory_deducted = -1;
    return { success: true, meta: { changes: 1 } };
  }

  if (sql.startsWith('update invoices set status =')) {
    if (state.invoice.inventory_deducted !== -1) return { success: true, meta: { changes: 0 } };
    state.invoice.status = 'Filled';
    state.invoice.inventory_deducted = 1;
    return { success: true, meta: { changes: 1 } };
  }

  return { success: true, meta: { changes: 1 } };
}

function makeState(stockGrams: number): FakeDbState {
  return {
    invoice: {
      id: 'inv_test',
      invoice_number: 'TJA-1',
      customer_name: 'Test Buyer',
      status: 'Pending',
      payment_status: 'unpaid',
      payment_date: null,
      inventory_deducted: 0,
    },
    lineItems: [
      { product_id: 'prod_test', quantity: 40 },
      { product_id: 'prod_test', quantity: 40 },
    ],
    products: new Map([[
      'prod_test',
      {
        id: 'prod_test',
        stock_grams: stockGrams,
        low_stock_threshold: 0,
        given_name: 'Test Tea',
        product_name: 'Test Tea',
        status: 'Active',
        source_compass_entry_id: null,
      },
    ]]),
    listings: new Map([['list_prod_test', { stock_grams: stockGrams, status: 'Active' }]]),
    ledger: [],
    batchedSql: [],
  };
}

async function callMcp(state: FakeDbState, args: Record<string, unknown>) {
  const response = await mcpFetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'fulfill_invoice', arguments: args },
    }),
  }), { DB: new FakeDb(state) } as any);
  const rpc = await response.json() as any;
  return JSON.parse(rpc.result.content[0].text);
}

async function fulfillInvoice(state: FakeDbState) {
  const preview = await callMcp(state, { invoice_id: 'inv_test' });
  return callMcp(state, { confirm: preview.confirmation_token });
}

describe('MCP invoice fulfillment', () => {
  it('aggregates duplicate product lines before deducting stock and writing ledger', async () => {
    const state = makeState(100);

    const result = await fulfillInvoice(state);

    expect(result.committed).toBe(true);
    expect(state.products.get('prod_test')?.stock_grams).toBe(20);
    expect(state.listings.get('list_prod_test')?.stock_grams).toBe(20);
    expect(state.ledger).toEqual([{ product_id: 'prod_test', delta: -80, balance_after: 20 }]);
    expect(result.deducted).toEqual([{ product_id: 'prod_test', grams: 80, balance_after: 20 }]);
    expect(state.invoice.status).toBe('Filled');
    expect(state.invoice.inventory_deducted).toBe(1);

    const ledgerIndex = state.batchedSql.findIndex(sql => sql.startsWith('insert into stock_ledger'));
    const invoiceIndex = state.batchedSql.findIndex(sql => sql.startsWith('update invoices set status ='));
    expect(ledgerIndex).toBeGreaterThanOrEqual(0);
    expect(invoiceIndex).toBeGreaterThan(ledgerIndex);
  });

  it('rejects duplicate lines whose aggregate quantity exceeds stock', async () => {
    const state = makeState(70);

    const result = await fulfillInvoice(state);

    expect(result.error).toBe('insufficient_stock_at_fulfillment');
    expect(result.requested_grams).toBe(80);
    expect(result.available_grams).toBe(70);
    expect(state.products.get('prod_test')?.stock_grams).toBe(70);
    expect(state.listings.get('list_prod_test')?.stock_grams).toBe(70);
    expect(state.ledger).toEqual([]);
    expect(state.invoice.status).toBe('Pending');
    expect(state.invoice.inventory_deducted).toBe(0);
  });

  it('fills custom-only invoices without stock ledger rows', async () => {
    const state = makeState(100);
    state.lineItems = [{ product_id: null, quantity: 2 }];

    const result = await fulfillInvoice(state);

    expect(result.committed).toBe(true);
    expect(result.deducted).toEqual([]);
    expect(state.products.get('prod_test')?.stock_grams).toBe(100);
    expect(state.listings.get('list_prod_test')?.stock_grams).toBe(100);
    expect(state.ledger).toEqual([]);
    expect(state.invoice.status).toBe('Filled');
    expect(state.invoice.inventory_deducted).toBe(1);
  });

  it('deducts only product-backed lines when custom lines are present', async () => {
    const state = makeState(100);
    state.lineItems = [
      { product_id: 'prod_test', quantity: 35 },
      { product_id: null, quantity: 2 },
    ];

    const result = await fulfillInvoice(state);

    expect(result.committed).toBe(true);
    expect(state.products.get('prod_test')?.stock_grams).toBe(65);
    expect(state.listings.get('list_prod_test')?.stock_grams).toBe(65);
    expect(state.ledger).toEqual([{ product_id: 'prod_test', delta: -35, balance_after: 65 }]);
    expect(result.deducted).toEqual([{ product_id: 'prod_test', grams: 35, balance_after: 65 }]);
  });
});
