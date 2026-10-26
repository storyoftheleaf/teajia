import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { mcpFetch } from '../src/mcp';
import { budgetRefusal } from '../src/d1BudgetResponse';
import { withD1ReadBudget } from '../src/d1Budget';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const opened: SqliteD1[] = [];
afterEach(() => { for (const db of opened.splice(0)) db.close(); });
const secret = 'budget-response-fixture';
function fixture(readCost: (sql: string) => number) {
  const db = new SqliteD1(); opened.push(db);
  seedIdentity(db, { userId: 'owner', accountId: 'shop' });
  const sent: string[] = [];
  const wrapped = {
    prepare(sql: string) {
      const statement = db.prepare(sql);
      const out: any = {
        inner: statement,
        bind(...values: unknown[]) { statement.bind(...values); return out; },
        async all() { sent.push(sql); return { ...statement.all(), meta: { rows_read: readCost(sql), rows_written: 0 } }; },
        async run() { sent.push(sql); const value = statement.run(); return { ...value, meta: { ...value.meta, rows_read: readCost(sql), rows_written: value.meta.changes } }; },
      };
      return out;
    },
    async batch(statements: any[]) {
      return db.batch(statements.map(s => s.inner)).map(value => ({ ...value, meta: { ...value.meta, rows_read: 1, rows_written: value.meta.changes } }));
    },
  };
  return { db, wrapped, sent };
}
async function request(db: any, path: string, method = 'GET', body?: unknown) {
  const token = await signedToken(secret, { sub: 'owner', email: 'owner@test.dev', active_account_id: 'shop', platform_role: null });
  return worker.fetch(new Request(`https://worker.test${path}`, { method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Teajia-Account': 'shop' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), { DB: db, JWT_SECRET: secret, D1_ROWS_READ_BUDGET: '100' } as any);
}

describe('budget refusal responses preserve committed outcomes', () => {
  it('replaces a swallowed public lookup failure with an explicit non-retryable budget response', async () => {
    const { wrapped } = fixture(sql => /FROM accounts WHERE slug/.test(sql) ? 101 : 1);
    // getPublicAccountIdBySlug catches errors and returns null (formerly 404).
    const response = await request(wrapped, '/api/s/shop/products');
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBeNull();
    expect(await response.json()).toMatchObject({ error: 'database_read_budget_exceeded', retryable: false, writes_committed: false });
  });

  it('returns successful final-write overage as success, with the actual stored change', async () => {
    const { db, wrapped } = fixture(sql => /UPDATE users SET admin_request_status/.test(sql) ? 101 : 1);
    const response = await request(wrapped, '/api/auth/request-admin', 'POST', {});
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true });
    expect(db.sqlite.prepare("SELECT admin_request_status FROM users WHERE id='owner'").get()).toMatchObject({ admin_request_status: 'pending' });
  });

  it('requires reconciliation when a profile write committed but its following read was refused', async () => {
    const { db, wrapped, sent } = fixture(sql => /UPDATE users SET name/.test(sql) ? 101 : 1);
    const response = await request(wrapped, '/api/auth/profile', 'PUT', { name: 'Saved name' });
    expect(response.status).toBe(409);
    expect(response.headers.get('Retry-After')).toBeNull();
    const body = await response.json() as any;
    expect(body).toMatchObject({ error: 'database_write_reconciliation_required', retryable: false, writes_committed: true, reason: 'reconciliation_required' });
    expect(body.message).toMatch(/do not repeat this request automatically/i);
    expect(db.sqlite.prepare("SELECT name FROM users WHERE id='owner'").get()).toMatchObject({ name: 'Saved name' });
    expect(sent.filter(sql => /UPDATE users SET name/.test(sql))).toHaveLength(1);
    expect(sent.some(sql => /SELECT id, email, username, name/.test(sql))).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/Saved name|UPDATE users|Bearer/);
  });

  it('retains JSON-RPC id and error envelope when MCP auth swallows an over-budget lookup', async () => {
    const { wrapped } = fixture(() => 101);
    const response = await mcpFetch(new Request('https://worker.test/mcp', { method: 'POST',
      headers: { Authorization: 'Bearer not-a-real-token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'request-42', method: 'tools/list' }),
    }), { DB: wrapped, JWT_SECRET: secret, D1_ROWS_READ_BUDGET: '100' } as any);
    expect(response.status).toBe(200);
    expect(response.headers.get('Retry-After')).toBeNull();
    expect(await response.json()).toMatchObject({ jsonrpc: '2.0', id: 'request-42', error: {
      code: -32003, data: { reason: 'budget', retryable: false, writes_committed: false },
    } });
  });

  it('gives unused unmetered operations an explicit non-retryable repair response', async () => {
    const db = withD1ReadBudget({ exec: async () => { throw new Error('must not execute'); } }, { rows: 100, statements: 5 });
    await expect(db.exec()).rejects.toThrow(/cannot|unavailable/i);
    expect(budgetRefusal(db)).toMatchObject({ status: 503, rpcCode: -32003, body: {
      error: 'database_unmetered_operation', reason: 'unmetered_operation', retryable: false, writes_committed: false,
    } });
  });
});

it('does not invite retry when daily quota fails after a committed profile change', async () => {
  const { db, wrapped } = fixture(() => 1);
  const prepare = wrapped.prepare.bind(wrapped);
  // Throw during execution, as real D1 does, so the quota wrapper sees it.
  const actualPrepare = prepare;
  wrapped.prepare = (sql: string) => {
    const statement = actualPrepare(sql);
    if (/SELECT id, email, username, name/.test(sql)) statement.all = async () => { throw new Error("D1_ERROR: Exceeded D1's free tier daily row read limit"); };
    return statement;
  };
  const response = await request(wrapped, '/api/auth/profile', 'PUT', { name: 'Committed before quota' });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: 'database_write_reconciliation_required', retryable: false, writes_committed: true });
  expect(db.sqlite.prepare("SELECT name FROM users WHERE id='owner'").get()).toMatchObject({ name: 'Committed before quota' });
});
