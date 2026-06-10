import { describe, expect, it } from 'vitest';
import { mcpFetch } from '../src/mcp';

// Verifies that stock arrivals created through MCP (voice/agent) are stamped with
// an intake batch — specifically the account's catch-all "Unsorted" batch — so a
// tea is never batch-less and the inventory "Unsorted" filter holds everything not
// assigned to a named shipment. See worker/migrations/078_intake_batches.sql.

const ACCOUNT_ID = 'acc_test';
const TOKEN = 'tjmcp_test';
const UNSORTED_ID = `unsorted_${ACCOUNT_ID}`;

type LedgerRow = {
  product_id: string;
  delta: number;
  balance_after: number;
  reason: string;
  batch_id: string | null;
};

type FakeState = {
  products: Map<string, { id: string; stock_grams: number; given_name: string | null; product_name: string }>;
  ledger: LedgerRow[];
  insertedBatches: Array<{ id: string; isUnsorted: boolean }>;
  // Set true to simulate the Unsorted batch already existing (the common case after
  // the migration's seed). When false, resolveUnsortedBatchId must create it.
  unsortedExists: boolean;
  // Durable confirmation tickets (mcp_confirmation_tickets) — preview INSERTs a
  // row, confirm consumes it via atomic UPDATE…RETURNING.
  tickets: Map<string, { payload_json: string; expires_at: number; consumed_at: number | null }>;
};

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

class FakeStatement {
  values: unknown[] = [];
  constructor(readonly sql: string, private state: FakeState) {}

  bind(...values: unknown[]) { this.values = values; return this; }

  async first() {
    const sql = normalizeSql(this.sql);
    if (sql.includes('from mcp_tokens where token_hash = ?')) {
      return {
        id: 'mcp_token_test',
        account_id: ACCOUNT_ID,
        user_id: 'user_test',
        user_email: 'staff@example.com',
        revoked_at: null,
        scopes: JSON.stringify(['stock:write']),
      };
    }
    if (sql.includes("from batches where account_id = ? and label = 'unsorted'")) {
      return this.state.unsortedExists ? { id: UNSORTED_ID } : null;
    }
    if (sql.includes('from products where id = ? and account_id = ?')) {
      return this.state.products.get(String(this.values[0])) || null;
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

  async all() { return { results: [] }; }

  async run() { return runStatement(this.state, this); }
}

class FakeDb {
  constructor(private state: FakeState) {}
  prepare(sql: string) { return new FakeStatement(sql, this.state); }
  async batch(statements: FakeStatement[]) {
    const out = [];
    for (const s of statements) out.push(await runStatement(this.state, s));
    return out;
  }
}

function runStatement(state: FakeState, statement: FakeStatement) {
  const sql = normalizeSql(statement.sql);
  const values = statement.values;

  if (sql.startsWith('insert into mcp_confirmation_tickets')) {
    // issueConfirmationToken binds (token_hash, account_id, kind, payload_json, expires_at)
    state.tickets.set(String(values[0]), {
      payload_json: String(values[3]),
      expires_at: Number(values[4]),
      consumed_at: null,
    });
    return { success: true, meta: { changes: 1 } };
  }

  if (sql.startsWith('insert into batches')) {
    // resolveUnsortedBatchId binds (id, account_id) and writes the 'Unsorted'
    // label as a SQL literal. Capture the id and whether the literal is present.
    state.insertedBatches.push({ id: String(values[0]), isUnsorted: sql.includes("'unsorted'") });
    return { success: true, meta: { changes: 1 } };
  }

  if (sql.startsWith('insert into stock_ledger')) {
    // Column order: id, product_id, delta, balance_after, reason, user_email, note, batch_id, account_id
    state.ledger.push({
      product_id: String(values[1]),
      delta: Number(values[2]),
      balance_after: Number(values[3]),
      reason: String(values[4]),
      batch_id: values[7] == null ? null : String(values[7]),
    });
    return { success: true, meta: { changes: 1 } };
  }

  if (sql.startsWith('update products set stock_grams = stock_grams + ?')) {
    const grams = Number(values[0]);
    const p = state.products.get(String(values[1]));
    if (p) p.stock_grams += grams;
    return { success: true, meta: { changes: 1 } };
  }

  return { success: true, meta: { changes: 1 } };
}

function makeState(unsortedExists: boolean): FakeState {
  return {
    products: new Map([[
      'prod_test',
      { id: 'prod_test', stock_grams: 100, given_name: 'Test Tea', product_name: 'Test Tea' },
    ]]),
    ledger: [],
    insertedBatches: [],
    unsortedExists,
    tickets: new Map(),
  };
}

async function addStockViaMcp(state: FakeState, args: Record<string, unknown>) {
  // add_stock is a preview/confirm tool — issue both calls so the mutation commits.
  const preview = await callTool(state, 'add_stock', args);
  const token = preview.confirmation_token;
  expect(token, 'preview should return a confirmation token').toBeTruthy();
  return callTool(state, 'add_stock', { ...args, confirm: token });
}

async function callTool(state: FakeState, name: string, args: Record<string, unknown>) {
  const response = await mcpFetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), { DB: new FakeDb(state) } as any);
  const rpc = await response.json() as any;
  return JSON.parse(rpc.result.content[0].text);
}

describe('intake batches — MCP add_stock', () => {
  it('stamps the ledger row with the existing Unsorted batch', async () => {
    const state = makeState(true);
    const result = await addStockViaMcp(state, { id: 'prod_test', grams: 50 });

    expect(result.committed).toBe(true);
    expect(state.ledger).toHaveLength(1);
    const row = state.ledger[0];
    expect(row.reason).toBe('PURCHASE_RECEIPT');
    expect(row.batch_id).toBe(UNSORTED_ID);
    // Already existed → no new batch row created.
    expect(state.insertedBatches).toHaveLength(0);
  });

  it('creates the Unsorted batch on demand when none exists yet', async () => {
    const state = makeState(false);
    const result = await addStockViaMcp(state, { id: 'prod_test', grams: 25 });

    expect(result.committed).toBe(true);
    expect(state.insertedBatches).toEqual([{ id: UNSORTED_ID, isUnsorted: true }]);
    expect(state.ledger[0].batch_id).toBe(UNSORTED_ID);
  });

  it('never leaves an intake ledger row with a null batch', async () => {
    const state = makeState(true);
    await addStockViaMcp(state, { id: 'prod_test', grams: 10 });
    expect(state.ledger.every(r => r.batch_id != null)).toBe(true);
  });
});
