import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { mcpFetch } from '../src/mcp';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

const mcpSource = readFileSync(new URL('../src/mcp.ts', import.meta.url), 'utf8');

describe('MCP Tea Master sales invariant wiring', () => {
  it('uses the shared sale authorization and settlement seams', () => {
    expect(mcpSource).toContain('authorizeInvoiceLines');
    expect(mcpSource).toContain('buildSettlementStatements');
    expect(mcpSource).toContain('buildSettlementReversalStatements');
  });

  it('subtracts other live holds before MCP fulfillment or immediate sale', () => {
    expect(mcpSource).toContain('SUM(held_grams)');
    expect(mcpSource).toContain('invoice_id != ?');
  });
});

const tokenHash = async (token: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
  .map(value => value.toString(16).padStart(2, '0')).join('');

class RecordSaleDb {
  constructor(readonly inner: SqliteD1, readonly failBatch = false) {}

  prepare(sql: string) {
    if (this.failBatch && normalizeSql(sql).startsWith('update products set stock_grams=stock_grams+?')) {
      const rejected = {
        bind: () => rejected,
        run: async () => { throw new Error('simulated compensation failure'); },
      };
      return rejected;
    }
    const inner = this.inner.prepare(sql);
    const statement = {
      inner,
      bind: (...values: unknown[]) => { inner.bind(...values); return statement; },
      first: async () => inner.first(),
      all: async () => inner.all(),
      run: async () => inner.run(),
    };
    return statement;
  }

  batch(statements: any[]) {
    const inner = statements.map(statement => statement.inner);
    if (this.failBatch) {
      inner.push(this.inner.prepare(`INSERT INTO products(id,account_id,type,product_name) VALUES ('prod_test','acc_test','Tea','duplicate')`));
    }
    return this.inner.batch(inner as any);
  }
}

async function callRecordSale(db: RecordSaleDb, args: Record<string, unknown>) {
  const response = await mcpFetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'record_sale', arguments: args } }),
  }), { DB: db } as any);
  return response.json() as Promise<any>;
}

describe('MCP record_sale atomicity', () => {
  it('rolls back stock, invoice, ledger and settlement when the mutation batch fails', async () => {
    const sqlite = new SqliteD1();
    try {
      seedIdentity(sqlite, { userId: 'user_test', accountId: ACCOUNT_ID, role: 'owner' });
      sqlite.sqlite.prepare(`INSERT INTO mcp_tokens
        (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
        VALUES ('token-record','acc_test','user_test','owner@test.dev','record',?,?,'["sales:write"]','account_owner')`)
        .run(await tokenHash(TOKEN), TOKEN.slice(0, 8));
      sqlite.sqlite.prepare(`INSERT INTO products
        (id,account_id,type,product_name,given_name,stock_grams,fixed_retail_price_usd)
        VALUES ('prod_test','acc_test','Oolong','Atomic Tea','Atomic Tea',100,0.5)`).run();
      const db = new RecordSaleDb(sqlite, true);
      const args = { customer_name: 'Buyer', lines: [{ product_id: 'prod_test', grams: 40, price_per_gram_usd: 0.5 }] };
      const previewRpc = await callRecordSale(db, args);
      const preview = JSON.parse(previewRpc.result.content[0].text);
      const confirmRpc = await callRecordSale(db, { ...args, confirm: preview.confirmation_token });

      expect(confirmRpc.error).toBeTruthy();
      expect(sqlite.sqlite.prepare(`SELECT stock_grams FROM products WHERE id='prod_test'`).get()).toEqual({ stock_grams: 100 });
      expect(sqlite.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices').get()).toEqual({ count: 0 });
      expect(sqlite.sqlite.prepare('SELECT COUNT(*) AS count FROM stock_ledger').get()).toEqual({ count: 0 });
      expect(sqlite.sqlite.prepare('SELECT COUNT(*) AS count FROM sales_settlements').get()).toEqual({ count: 0 });
    } finally {
      sqlite.close();
    }
  });

  it('uses the ticket payload and current authority when confirming a sale', async () => {
    const sqlite = new SqliteD1();
    try {
      seedIdentity(sqlite, { userId: 'user_test', accountId: ACCOUNT_ID, role: 'owner' });
      seedIdentity(sqlite, { userId: 'stock-owner', accountId: ACCOUNT_ID, role: 'staff', bundles: ['stock'] });
      sqlite.sqlite.prepare(`INSERT INTO mcp_tokens
        (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
        VALUES ('token-reauth','acc_test','user_test','owner@test.dev','reauth',?,?,'["sales:write"]','account_owner')`)
        .run(await tokenHash(TOKEN), TOKEN.slice(0, 8));
      sqlite.sqlite.prepare(`INSERT INTO products
        (id,account_id,type,product_name,given_name,stock_grams,fixed_retail_price_usd,owner_user_id)
        VALUES ('owned-tea','acc_test','Oolong','Owned Tea','Owned Tea',100,0.5,'stock-owner'),
               ('location-tea','acc_test','Oolong','Location Tea','Location Tea',100,0.5,NULL)`).run();
      const db = new RecordSaleDb(sqlite);
      const sale = { customer_name: 'Buyer', lines: [{ product_id: 'owned-tea', grams: 40, price_per_gram_usd: 0.5 }] };
      const previewRpc = await callRecordSale(db, sale);
      const preview = JSON.parse(previewRpc.result.content[0].text);
      sqlite.sqlite.prepare(`UPDATE account_members SET role='staff',permissions='{"bundles":["sell"]}'
        WHERE account_id='acc_test' AND user_id='user_test'`).run();

      const confirmRpc = await callRecordSale(db, {
        confirm: preview.confirmation_token,
        customer_name: 'Substitute',
        lines: [{ product_id: 'location-tea', grams: 1, price_per_gram_usd: 0.1 }],
      });
      const denied = JSON.parse(confirmRpc.result.content[0].text);
      expect(denied.error).toBe('sale_grant_required');
      expect(sqlite.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices').get()).toEqual({ count: 0 });
      expect(sqlite.sqlite.prepare(`SELECT stock_grams FROM products WHERE id='owned-tea'`).get()).toEqual({ stock_grams: 100 });
      expect(sqlite.sqlite.prepare('SELECT COUNT(*) AS count FROM stock_ledger').get()).toEqual({ count: 0 });
      expect(sqlite.sqlite.prepare('SELECT COUNT(*) AS count FROM sales_settlements').get()).toEqual({ count: 0 });
    } finally {
      sqlite.close();
    }
  });

  it('confirms the stored sale payload when current authority is unchanged', async () => {
    const sqlite = new SqliteD1();
    try {
      seedIdentity(sqlite, { userId: 'user_test', accountId: ACCOUNT_ID, role: 'owner' });
      sqlite.sqlite.prepare(`INSERT INTO mcp_tokens
        (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
        VALUES ('token-stable','acc_test','user_test','owner@test.dev','stable',?,?,'["sales:write"]','account_owner')`)
        .run(await tokenHash(TOKEN), TOKEN.slice(0, 8));
      sqlite.sqlite.prepare(`INSERT INTO products
        (id,account_id,type,product_name,given_name,stock_grams,fixed_retail_price_usd)
        VALUES ('stable-tea','acc_test','Oolong','Stable Tea','Stable Tea',100,0.5)`).run();
      const db = new RecordSaleDb(sqlite);
      const sale = { customer_name: 'Buyer', lines: [{ product_id: 'stable-tea', grams: 40, price_per_gram_usd: 0.5 }] };
      const previewRpc = await callRecordSale(db, sale);
      const preview = JSON.parse(previewRpc.result.content[0].text);
      const confirmRpc = await callRecordSale(db, { confirm: preview.confirmation_token });
      const confirmed = JSON.parse(confirmRpc.result.content[0].text);
      expect(confirmed.committed).toBe(true);
      expect(sqlite.sqlite.prepare(`SELECT stock_grams FROM products WHERE id='stable-tea'`).get()).toEqual({ stock_grams: 60 });
      expect(sqlite.sqlite.prepare('SELECT COUNT(*) AS count FROM invoices').get()).toEqual({ count: 1 });
    } finally {
      sqlite.close();
    }
  });
});

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
  owner_user_id?: string | null;
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
    sold_by_user_id: string | null;
  };
  lineItems: Array<{
    id?: string; product_id: string | null; quantity: number; price_at_sale?: number;
    stock_owner_user_id?: string | null; sales_grant_id?: string | null;
    owner_share_type?: 'percent' | 'fixed'; owner_share_value?: number;
  }>;
  products: Map<string, ProductRecord>;
  listings: Map<string, { stock_grams: number; status: string }>;
  ledger: Array<{ product_id: string; delta: number; balance_after: number }>;
  settlements: Array<{
    stock_owner_user_id: string | null; seller_user_id: string; grant_id: string | null;
    gross_amount: number; owner_amount: number; seller_amount: number;
  }>;
  batchedSql: string[];
  // Durable confirmation tickets (mcp_confirmation_tickets) — preview INSERTs a
  // row, confirm consumes it via atomic UPDATE…RETURNING.
  tickets: Map<string, { payload_json: string; expires_at: number; consumed_at: number | null }>;
  failFulfillmentBatch: boolean;
  stealLeaseBeforeBatch: boolean;
  authRole: 'owner' | 'staff';
  mutableGrantShareValue: number | null;
  otherHeldGrams: number;
  injectHoldBeforeFulfillmentBatch: boolean;
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
      return { role: this.state.authRole, permissions: JSON.stringify({ bundles: ['sell'] }) };
    }
    if (sql.includes('from invoices where id = ? and account_id = ?')) {
      return this.state.invoice;
    }
    if (sql.includes('sum(held_grams)')) return { held: this.state.otherHeldGrams };
    if (sql.includes('from products where id = ? and account_id = ?')) {
      return this.state.products.get(String(this.values[0])) || null;
    }
    if (sql.startsWith('update invoices set fulfillment_claim_token = ?')) {
      const stale = this.state.invoice.fulfillment_claim_token != null && (this.state.invoice.fulfillment_claimed_at == null || new Date(this.state.invoice.fulfillment_claimed_at).getTime() < Date.now() - 5 * 60_000);
      if (this.state.invoice.inventory_deducted || (this.state.invoice.fulfillment_claim_token && !stale)) return null;
      this.state.invoice.fulfillment_claim_token = String(this.values[0]);
      this.state.invoice.fulfillment_claimed_at = new Date().toISOString();
      return { id: this.state.invoice.id };
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
      return {
        results: this.state.lineItems.map(li => {
          const p = li.product_id ? this.state.products.get(li.product_id) : undefined;
          const row = {
            ...li,
            given_name: p?.given_name ?? null,
            product_name: p?.product_name ?? null,
            stock_grams: p?.stock_grams ?? null,
          };
          if (sql.includes('left join sales_grants') && this.state.mutableGrantShareValue != null) {
            row.owner_share_value = this.state.mutableGrantShareValue;
          }
          return row;
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
    if (this.state.injectHoldBeforeFulfillmentBatch) {
      this.state.injectHoldBeforeFulfillmentBatch = false;
      this.state.otherHeldGrams = 30;
    }
    if (this.state.stealLeaseBeforeBatch && statements.some(statement => normalizeSql(statement.sql).startsWith('update products set stock_grams'))) {
      this.state.stealLeaseBeforeBatch = false;
      this.state.invoice.fulfillment_claim_token = 'winner-b'; this.state.invoice.inventory_deducted = 1; this.state.invoice.fulfilled_at = 'winner-time';
      this.state.products.get('prod_test')!.stock_grams = 20;
      this.state.listings.get('list_prod_test')!.stock_grams = 20;
      this.state.ledger.push({ product_id: 'prod_test', delta: -80, balance_after: 20 });
    }
    const snapshot = { invoice: { ...this.state.invoice }, lineItems: this.state.lineItems.map(row => ({ ...row })), products: new Map([...this.state.products].map(([id, row]) => [id, { ...row }])), listings: new Map([...this.state.listings].map(([id, row]) => [id, { ...row }])), ledger: this.state.ledger.map(row => ({ ...row })), settlements: this.state.settlements.map(row => ({ ...row })) };
    const results = [];
    try {
      for (const statement of statements) {
        this.state.batchedSql.push(normalizeSql(statement.sql));
        results.push(await runStatement(this.state, statement));
        if (this.state.failFulfillmentBatch && normalizeSql(statement.sql).startsWith('update products set stock_grams')) throw new Error('simulated batch failure');
      }
    } catch (error) {
      this.state.invoice = snapshot.invoice; this.state.lineItems = snapshot.lineItems; this.state.products = snapshot.products; this.state.listings = snapshot.listings; this.state.ledger = snapshot.ledger; this.state.settlements = snapshot.settlements;
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
    const claim = String(values.at(-1));
    if (state.invoice.fulfillment_claim_token !== claim) return { success: true, meta: { changes: 0 }, results: [] };
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

  if (sql.startsWith('update products set stock_grams = stock_grams - ?')
    || sql.startsWith('update products set stock_grams = case')) {
    const guarded = sql.startsWith('update products set stock_grams = case');
    const grams = Number(values[guarded ? 4 : 0]);
    const productId = String(values[guarded ? 5 : 1]);
    const product = state.products.get(productId);
    if (!product) return { success: true, meta: { changes: 0 } };
    if (guarded && product.stock_grams - state.otherHeldGrams < grams) {
      throw new Error('stock_grams cannot be negative');
    }
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
    const productId = String(values[1]);
    state.ledger.push({
      product_id: productId,
      delta: Number(values[2]),
      balance_after: sql.includes('p.stock_grams')
        ? Number(state.products.get(productId)?.stock_grams ?? 0)
        : Number(values[3]),
    });
    return { success: true, meta: { changes: 1 } };
  }

  if (sql.startsWith('update invoice_line_items set stock_owner_user_id=')) {
    const line = state.lineItems.find(item => item.id === values[2]);
    if (line) {
      line.stock_owner_user_id = values[0] == null ? null : String(values[0]);
      line.sales_grant_id = values[1] == null ? null : String(values[1]);
    }
    return { success: true, meta: { changes: line ? 1 : 0 } };
  }

  if (sql.startsWith('insert into sales_settlements')) {
    state.settlements.push({
      stock_owner_user_id: values[5] == null ? null : String(values[5]),
      seller_user_id: String(values[6]),
      grant_id: values[7] == null ? null : String(values[7]),
      gross_amount: Number(values[8]), owner_amount: Number(values[9]), seller_amount: Number(values[10]),
    });
    return { success: true, meta: { changes: 1 } };
  }

  // Single-statement commit: status and inventory_deducted are set together
  // inside the batch (atomicity comes from DB.batch, not a -1 claim phase).
  if (sql.startsWith("update invoices set status = 'filled', inventory_deducted = 1")) {
    if (state.invoice.fulfillment_claim_token !== values[2]) return { success: true, meta: { changes: 0 } };
    state.invoice.status = 'Filled';
    state.invoice.inventory_deducted = 1;
    state.invoice.fulfilled_at ||= '2026-07-13 00:00:00';
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
      sold_by_user_id: 'seller-original',
    },
    lineItems: [
      { id: 'line-a', product_id: 'prod_test', quantity: 40, price_at_sale: 1, stock_owner_user_id: null, sales_grant_id: null, owner_share_type: 'percent', owner_share_value: 100 },
      { id: 'line-b', product_id: 'prod_test', quantity: 40, price_at_sale: 1, stock_owner_user_id: null, sales_grant_id: null, owner_share_type: 'percent', owner_share_value: 100 },
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
    settlements: [],
    batchedSql: [],
    tickets: new Map(),
    failFulfillmentBatch: false,
    stealLeaseBeforeBatch: false,
    authRole: 'staff',
    mutableGrantShareValue: null,
    otherHeldGrams: 0,
    injectHoldBeforeFulfillmentBatch: false,
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
  if (!rpc.result) throw new Error(JSON.stringify(rpc));
  return JSON.parse(rpc.result.content[0].text);
}

async function fulfillInvoice(state: FakeDbState) {
  const preview = await callMcp(state, { invoice_id: 'inv_test' });
  // Confirm must repeat invoice_id — the handler checks it against the ticket.
  return callMcp(state, { invoice_id: 'inv_test', confirm: preview.confirmation_token });
}

describe('MCP invoice fulfillment', () => {
  it('honors a granted sale snapshot after revocation when an owner fulfills it', async () => {
    const state = makeState(100);
    state.authRole = 'owner';
    state.lineItems = [{
      id: 'line-granted', product_id: 'prod_test', quantity: 40, price_at_sale: 0.5,
      stock_owner_user_id: 'stock-owner', sales_grant_id: 'revoked-grant',
      owner_share_type: 'percent', owner_share_value: 80,
    }];
    state.products.get('prod_test')!.owner_user_id = 'stock-owner';

    const result = await fulfillInvoice(state);

    expect(result.committed).toBe(true);
    expect(state.invoice.sold_by_user_id).toBe('seller-original');
    expect(state.lineItems[0]).toMatchObject({ stock_owner_user_id: 'stock-owner', sales_grant_id: 'revoked-grant' });
    expect(state.settlements).toEqual([{
      stock_owner_user_id: 'stock-owner', seller_user_id: 'seller-original', grant_id: 'revoked-grant',
      gross_amount: 20, owner_amount: 16, seller_amount: 4,
    }]);
  });

  it('uses line economics after the referenced grant terms change', async () => {
    const state = makeState(100);
    state.authRole = 'owner';
    state.mutableGrantShareValue = 50;
    state.lineItems = [{
      id: 'line-granted', product_id: 'prod_test', quantity: 40, price_at_sale: 0.5,
      stock_owner_user_id: 'stock-owner', sales_grant_id: 'changed-grant',
      owner_share_type: 'percent', owner_share_value: 80,
    }];
    state.products.get('prod_test')!.owner_user_id = 'stock-owner';

    const result = await fulfillInvoice(state);

    expect(result.committed).toBe(true);
    expect(state.settlements).toEqual([expect.objectContaining({
      grant_id: 'changed-grant', owner_amount: 16, seller_amount: 4,
    })]);
  });

  it('atomically rejects a competing hold injected after the MCP availability read', async () => {
    const state = makeState(100);
    state.injectHoldBeforeFulfillmentBatch = true;
    const result = await fulfillInvoice(state);
    expect(result.error).toBe('stock_underflow_at_commit');
    expect(state.products.get('prod_test')?.stock_grams).toBe(100);
    expect(state.ledger).toEqual([]);
    expect(state.settlements).toEqual([]);
    expect(state.invoice.inventory_deducted).toBe(0);
  });

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
      { id: 'line-product', product_id: 'prod_test', quantity: 35, price_at_sale: 1, stock_owner_user_id: null, sales_grant_id: null, owner_share_type: 'percent', owner_share_value: 100 },
      { id: 'line-custom', product_id: null, quantity: 2, price_at_sale: 1 },
    ];

    const result = await fulfillInvoice(state);

    expect(result.committed).toBe(true);
    expect(state.products.get('prod_test')?.stock_grams).toBe(65);
    expect(state.listings.get('list_prod_test')?.stock_grams).toBe(65);
    expect(state.ledger).toEqual([{ product_id: 'prod_test', delta: -35, balance_after: 65 }]);
    expect(result.items_fulfilled).toBe(1);
  });
});

describe('MCP intake tools registration', () => {
  const INTAKE_TOOLS = [
    'intake_start',
    'intake_add_source',
    'intake_analyze',
    'intake_get_draft',
    'intake_update_item',
    'intake_ask',
    'intake_answer',
    'intake_finalize',
  ];

  it('registers all 8 intake tools in TOOL_DEFS', () => {
    for (const name of INTAKE_TOOLS) {
      expect(mcpSource).toContain(`name: '${name}'`);
    }
  });

  it('dispatches all 8 intake tools in the switch', () => {
    for (const name of INTAKE_TOOLS) {
      expect(mcpSource).toContain(`case '${name}':`);
    }
  });

  it('marks intake_get_draft as read-only', () => {
    expect(mcpSource).toContain("'intake_get_draft'");
    // Verify it appears in READ_ONLY_TOOLS
    const readOnlyBlock = mcpSource.slice(mcpSource.indexOf('const READ_ONLY_TOOLS'), mcpSource.indexOf('const DESTRUCTIVE_TOOLS'));
    expect(readOnlyBlock).toContain('intake_get_draft');
  });

  it('imports curate-import handlers from curateImports', () => {
    expect(mcpSource).toContain("from './curateImports'");
    expect(mcpSource).toContain('createCurateImport');
    expect(mcpSource).toContain('finalizeCurateImportRequest');
  });
});
