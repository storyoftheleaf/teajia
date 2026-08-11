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
    fulfilled_at: string | null;
    fulfillment_claim_token: string | null;
    fulfillment_claimed_at: string | null;
    inventory_deducted: number;
  };
  lineItems: Array<{ product_id: string | null; quantity: number }>;
  products: Map<string, ProductRecord>;
  listings: Map<string, { stock_grams: number; status: string }>;
  ledger: Array<{ product_id: string; delta: number; balance_after: number }>;
  batchedSql: string[];
  // Durable confirmation tickets (mcp_confirmation_tickets) — preview INSERTs a
  // row, confirm consumes it via atomic UPDATE…RETURNING.
  tickets: Map<string, { payload_json: string; expires_at: number; consumed_at: number | null }>;
  failFulfillmentBatch: boolean;
  stealLeaseBeforeBatch: boolean;
  editBeforeLineRead: boolean;
  fulfillBeforeVoidRead: boolean;
  lineReads: number;
  stealVoidLeaseBeforeBatch: boolean;
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
    if (sql === 'select id, email, platform_role from users where id = ?') {
      return { id: 'user_test', email: 'staff@example.com', platform_role: null };
    }
    if (sql === 'select status from accounts where id = ?') {
      return { status: 'active' };
    }
    if (sql.includes('from account_members am') && sql.includes("am.status = 'active'")) {
      return { role: 'staff', permissions: JSON.stringify({ bundles: ['sell'] }) };
    }
    if (sql.includes('from invoices where id = ? and account_id = ?')) {
      return { ...this.state.invoice };
    }
    if (sql.includes('from products where id = ? and account_id = ?')) {
      return this.state.products.get(String(this.values[0])) || null;
    }
    if (sql.startsWith('update invoices set fulfillment_claim_token = ?')) {
      const stale = this.state.invoice.fulfillment_claim_token != null && (this.state.invoice.fulfillment_claimed_at == null || new Date(this.state.invoice.fulfillment_claimed_at).getTime() < Date.now() - 5 * 60_000);
      const allowedStatuses = sql.includes("status in ('draft', 'pending')") ? ['Draft', 'Pending'] : ['Draft', 'Pending', 'Filled'];
      if (!allowedStatuses.includes(this.state.invoice.status) || (sql.includes('inventory_deducted = 0') && this.state.invoice.inventory_deducted) || (this.state.invoice.fulfillment_claim_token && !stale)) return null;
      this.state.invoice.fulfillment_claim_token = String(this.values[0]);
      this.state.invoice.fulfillment_claimed_at = new Date().toISOString();
      return { ...this.state.invoice };
    }
    if (sql.startsWith('update mcp_confirmation_tickets set consumed_at')) {
      // consumeConfirmationToken binds (now, token_hash, now)
      const hash = String(this.values[1]);
      const now = Number(this.values[2]);
      const ticket = this.state.tickets.get(hash);
      if (!ticket || ticket.consumed_at !== null || ticket.expires_at <= now) return null;
      ticket.consumed_at = now;
      return { payload_json: ticket.payload_json };
    }
    return null;
  }

  async all() {
    const sql = normalizeSql(this.sql);
    // The line-items query LEFT JOINs products for name + stock fields.
    if (sql.includes('from invoice_line_items')) {
      this.state.lineReads += 1;
      if (this.state.editBeforeLineRead && !this.state.invoice.fulfillment_claim_token) {
        this.state.editBeforeLineRead = false;
        this.state.lineItems[0].quantity = 50;
      }
      if (this.state.fulfillBeforeVoidRead && !this.state.invoice.fulfillment_claim_token) {
        this.state.fulfillBeforeVoidRead = false;
        this.state.invoice.status = 'Filled';
        this.state.invoice.inventory_deducted = 1;
        this.state.products.get('prod_test')!.stock_grams = 20;
        this.state.listings.get('list_prod_test')!.stock_grams = 20;
        this.state.ledger.push({ product_id: 'prod_test', delta: -80, balance_after: 20 });
      }
      return {
        results: this.state.lineItems.map(li => {
          const p = li.product_id ? this.state.products.get(li.product_id) : undefined;
          return {
            ...li,
            given_name: p?.given_name ?? null,
            product_name: p?.product_name ?? null,
            stock_grams: p?.stock_grams ?? null,
          };
        }),
      };
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
    if (this.state.stealLeaseBeforeBatch && statements.some(statement => normalizeSql(statement.sql).startsWith('update products set stock_grams'))) {
      this.state.stealLeaseBeforeBatch = false;
      this.state.invoice.fulfillment_claim_token = 'winner-b'; this.state.invoice.inventory_deducted = 1; this.state.invoice.fulfilled_at = 'winner-time';
      this.state.products.get('prod_test')!.stock_grams = 20;
      this.state.listings.get('list_prod_test')!.stock_grams = 20;
      this.state.ledger.push({ product_id: 'prod_test', delta: -80, balance_after: 20 });
    }
    if (this.state.stealVoidLeaseBeforeBatch && statements.some(statement => normalizeSql(statement.sql).startsWith("update invoices set status = 'void'"))) {
      this.state.stealVoidLeaseBeforeBatch = false;
      this.state.invoice.fulfillment_claim_token = 'winning-void'; this.state.invoice.status = 'Void'; this.state.invoice.inventory_deducted = 0;
      this.state.products.get('prod_test')!.stock_grams = 100;
      this.state.listings.get('list_prod_test')!.stock_grams = 100;
      this.state.ledger = [{ product_id: 'prod_test', delta: 80, balance_after: 100 }];
    }
    const snapshot = { invoice: { ...this.state.invoice }, products: new Map([...this.state.products].map(([id, row]) => [id, { ...row }])), listings: new Map([...this.state.listings].map(([id, row]) => [id, { ...row }])), ledger: this.state.ledger.map(row => ({ ...row })) };
    const results = [];
    try {
      for (const statement of statements) {
        this.state.batchedSql.push(normalizeSql(statement.sql));
        results.push(await runStatement(this.state, statement));
        if (this.state.failFulfillmentBatch && normalizeSql(statement.sql).startsWith('update products set stock_grams')) throw new Error('simulated batch failure');
      }
    } catch (error) {
      this.state.invoice = snapshot.invoice; this.state.products = snapshot.products; this.state.listings = snapshot.listings; this.state.ledger = snapshot.ledger;
      this.state.failFulfillmentBatch = false;
      throw error;
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
  if (sql.includes('fulfillment_claim_token = ?') && !sql.startsWith('update invoices set fulfillment_claim_token = ?')) {
    if (!values.includes(state.invoice.fulfillment_claim_token)) return { success: true, meta: { changes: 0 }, results: [] };
  }

  if (sql.startsWith('insert into mcp_confirmation_tickets')) {
    // issueConfirmationToken binds (token_hash, account_id, kind, payload_json, expires_at)
    state.tickets.set(String(values[0]), {
      payload_json: String(values[3]),
      expires_at: Number(values[4]),
      consumed_at: null,
    });
    return { success: true, meta: { changes: 1 } };
  }

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

  if (sql.startsWith('update products set stock_grams = stock_grams + ?')) {
    const product = state.products.get(String(values[1]));
    if (product) product.stock_grams += Number(values[0]);
    return { success: true, meta: { changes: product ? 1 : 0 } };
  }

  if (sql.startsWith('update product_listings set stock_grams = stock_grams + ?')) {
    const listing = state.listings.get(String(values[1]));
    if (listing) listing.stock_grams += Number(values[0]);
    return { success: true, meta: { changes: listing ? 1 : 0 } };
  }

  if (sql.startsWith('insert into stock_ledger')) {
    state.ledger.push({
      product_id: String(values[1]),
      delta: Number(values[2]),
      balance_after: Number(values[3]),
    });
    return { success: true, meta: { changes: 1 } };
  }

  // Single-statement commit: status and inventory_deducted are set together
  // inside the batch (atomicity comes from DB.batch, not a -1 claim phase).
  if (sql.startsWith("update invoices set status = 'filled', inventory_deducted = 1")) {
    if (!values.includes(state.invoice.fulfillment_claim_token)) return { success: true, meta: { changes: 0 } };
    state.invoice.status = 'Filled';
    state.invoice.inventory_deducted = 1;
    state.invoice.fulfilled_at ||= '2026-07-13 00:00:00';
    state.invoice.fulfillment_claim_token = null;
    state.invoice.fulfillment_claimed_at = null;
    return { success: true, meta: { changes: 1 } };
  }
  if (sql.startsWith("update invoices set status = 'void', inventory_deducted = 0")) {
    if (sql.includes('fulfillment_claim_token = ?') && !values.includes(state.invoice.fulfillment_claim_token)) return { success: true, meta: { changes: 0 } };
    state.invoice.status = 'Void';
    state.invoice.inventory_deducted = 0;
    state.invoice.fulfillment_claim_token = null;
    state.invoice.fulfillment_claimed_at = null;
    return { success: true, meta: { changes: 1 } };
  }
  if (sql.startsWith('update invoices set fulfillment_claim_token = null')) {
    if (state.invoice.fulfillment_claim_token === values[2]) state.invoice.fulfillment_claim_token = null;
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
      fulfilled_at: null,
      fulfillment_claim_token: null,
      fulfillment_claimed_at: null,
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
    tickets: new Map(),
    failFulfillmentBatch: false,
    stealLeaseBeforeBatch: false,
    editBeforeLineRead: false,
    fulfillBeforeVoidRead: false,
    lineReads: 0,
    stealVoidLeaseBeforeBatch: false,
  };
}

async function callMcp(state: FakeDbState, args: Record<string, unknown>, name = 'fulfill_invoice') {
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
      params: { name, arguments: args },
    }),
  }), { DB: new FakeDb(state) } as any);
  const rpc = await response.json() as any;
  return JSON.parse(rpc.result.content[0].text);
}

async function fulfillInvoice(state: FakeDbState) {
  const preview = await callMcp(state, { invoice_id: 'inv_test' });
  // Confirm must repeat invoice_id — the handler checks it against the ticket.
  return callMcp(state, { invoice_id: 'inv_test', confirm: preview.confirmation_token });
}

describe('MCP invoice fulfillment', () => {
  it('aggregates duplicate product lines before deducting stock and writing ledger', async () => {
    const state = makeState(100);

    const result = await fulfillInvoice(state);

    expect(result.committed).toBe(true);
    expect(state.products.get('prod_test')?.stock_grams).toBe(20);
    expect(state.listings.get('list_prod_test')?.stock_grams).toBe(20);
    expect(state.ledger).toEqual([{ product_id: 'prod_test', delta: -80, balance_after: 20 }]);
    expect(result.items_fulfilled).toBe(1);
    expect(state.invoice.status).toBe('Filled');
    expect(state.invoice.inventory_deducted).toBe(1);
    expect(state.invoice.fulfilled_at).toBe('2026-07-13 00:00:00');
    expect(state.batchedSql.some(sql => sql.includes("fulfilled_at = coalesce(fulfilled_at, datetime('now'))"))).toBe(true);

    const ledgerIndex = state.batchedSql.findIndex(sql => sql.startsWith('insert into stock_ledger'));
    const invoiceIndex = state.batchedSql.findIndex(sql => sql.startsWith('update invoices set status ='));
    expect(ledgerIndex).toBeGreaterThanOrEqual(0);
    expect(invoiceIndex).toBeGreaterThan(ledgerIndex);
  });

  it('rejects duplicate lines whose aggregate quantity exceeds stock', async () => {
    const state = makeState(70);

    const result = await fulfillInvoice(state);

    // The aggregate underflow is caught at preview time as a hard block.
    expect(result.error).toBe('stock_underflow');
    expect(result.underflow_lines).toEqual([
      expect.objectContaining({ product_id: 'prod_test', quantity_grams: 80, available_grams: 70, shortfall_grams: 10 }),
    ]);
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
    expect(result.items_fulfilled).toBe(0);
    expect(state.products.get('prod_test')?.stock_grams).toBe(100);
    expect(state.listings.get('list_prod_test')?.stock_grams).toBe(100);
    expect(state.ledger).toEqual([]);
    expect(state.invoice.status).toBe('Filled');
    expect(state.invoice.inventory_deducted).toBe(1);
  });

  it('preserves an existing fulfillment timestamp', async () => {
    const state = makeState(100);
    state.invoice.fulfilled_at = '2026-07-01 01:02:03';
    const result = await fulfillInvoice(state);
    expect(result.committed).toBe(true);
    expect(state.invoice.fulfilled_at).toBe('2026-07-01 01:02:03');
  });

  it('allows only one of two competing confirmations to deduct stock', async () => {
    const state = makeState(100);
    const firstPreview = await callMcp(state, { invoice_id: 'inv_test' });
    const secondPreview = await callMcp(state, { invoice_id: 'inv_test' });
    const [first, second] = await Promise.all([
      callMcp(state, { invoice_id: 'inv_test', confirm: firstPreview.confirmation_token }),
      callMcp(state, { invoice_id: 'inv_test', confirm: secondPreview.confirmation_token }),
    ]);
    expect([first, second].filter(result => result.committed)).toHaveLength(1);
    expect(state.products.get('prod_test')?.stock_grams).toBe(20);
    expect(state.ledger).toHaveLength(1);
    expect(state.invoice.fulfilled_at).toBe('2026-07-13 00:00:00');
  });

  it('reclaims a stale pre-batch lease', async () => {
    const state = makeState(100);
    state.invoice.fulfillment_claim_token = 'abandoned';
    state.invoice.fulfillment_claimed_at = new Date(Date.now() - 6 * 60_000).toISOString();
    expect((await fulfillInvoice(state)).committed).toBe(true);
    expect(state.products.get('prod_test')?.stock_grams).toBe(20);
  });

  it('recovers a migration-111 token with no lease timestamp', async () => {
    const state = makeState(100); state.invoice.fulfillment_claim_token = 'legacy'; state.invoice.fulfillment_claimed_at = null;
    expect((await fulfillInvoice(state)).committed).toBe(true);
  });

  it('rolls back the whole mutation batch on failure', async () => {
    const state = makeState(100);
    state.failFulfillmentBatch = true;
    await fulfillInvoice(state).catch(() => undefined);
    expect(state.products.get('prod_test')?.stock_grams).toBe(100);
    expect(state.ledger).toEqual([]);
    expect(state.invoice.inventory_deducted).toBe(0);
    expect(state.invoice.fulfillment_claim_token).toBeNull();
  });

  it('fences a paused owner after another owner steals and commits the stale lease', async () => {
    const state = makeState(100); state.stealLeaseBeforeBatch = true;
    const result = await fulfillInvoice(state);
    expect(result.error).toBe('invoice_fulfillment_lease_lost');
    expect(state.products.get('prod_test')?.stock_grams).toBe(20);
    expect(state.ledger).toHaveLength(1);
    expect(state.invoice.fulfilled_at).toBe('winner-time');
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
    expect(result.items_fulfilled).toBe(1);
  });

  it('claims before confirm-time line reads so an edit cannot change fulfillment inputs', async () => {
    const state = makeState(100);
    const preview = await callMcp(state, { invoice_id: 'inv_test' });
    state.editBeforeLineRead = true;
    const result = await callMcp(state, { invoice_id: 'inv_test', confirm: preview.confirmation_token });
    expect(result.committed).toBe(true);
    expect(state.lineItems[0].quantity).toBe(40);
    expect(state.products.get('prod_test')?.stock_grams).toBe(20);
  });

  it('rejects an unsupported fulfillment status before reading line inputs', async () => {
    const state = makeState(100); state.invoice.status = 'Filled';
    const result = await callMcp(state, { invoice_id: 'inv_test' });
    expect(result.error).toBe('invoice_status_cannot_be_fulfilled');
    expect(state.lineReads).toBe(0);
  });

  it('releases the MCP fulfillment claim after confirm-time stock rejection', async () => {
    const state = makeState(100);
    const preview = await callMcp(state, { invoice_id: 'inv_test' });
    state.products.get('prod_test')!.stock_grams = 20;
    const result = await callMcp(state, { invoice_id: 'inv_test', confirm: preview.confirmation_token });
    expect(result.error).toBe('stock_underflow_at_commit');
    expect(state.invoice.fulfillment_claim_token).toBeNull();
    expect(state.products.get('prod_test')?.stock_grams).toBe(20);
    expect(state.ledger).toEqual([]);
  });

  it('void claims before confirm-time restoration reads and blocks a competing fulfillment', async () => {
    const state = makeState(100);
    const preview = await callMcp(state, { invoice_id: 'inv_test' }, 'void_invoice');
    state.fulfillBeforeVoidRead = true;
    const result = await callMcp(state, { invoice_id: 'inv_test', confirm: preview.confirmation_token }, 'void_invoice');
    expect(result.committed).toBe(true);
    expect(state.invoice.status).toBe('Void');
    expect(state.products.get('prod_test')?.stock_grams).toBe(100);
    expect(state.ledger).toEqual([]);
    expect(state.invoice.fulfillment_claim_token).toBeNull();
  });

  it('fences MCP restoration when another void wins after the claim', async () => {
    const state = makeState(60);
    Object.assign(state.invoice, { status: 'Filled', inventory_deducted: 1 });
    const preview = await callMcp(state, { invoice_id: 'inv_test' }, 'void_invoice');
    state.stealVoidLeaseBeforeBatch = true;
    const result = await callMcp(state, { invoice_id: 'inv_test', confirm: preview.confirmation_token }, 'void_invoice');
    expect(result.error).toBe('invoice_void_lease_lost');
    expect(state.invoice).toMatchObject({ status: 'Void', inventory_deducted: 0, fulfillment_claim_token: 'winning-void' });
    expect(state.products.get('prod_test')?.stock_grams).toBe(100);
    expect(state.ledger).toEqual([{ product_id: 'prod_test', delta: 80, balance_after: 100 }]);
  });
});
