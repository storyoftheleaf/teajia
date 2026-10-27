/**
 * The guardrail that exists because the fix alone was not enough.
 *
 * `curateHoldings.ts` no longer reads 93,817 rows per call, and the test next
 * door pins that. This file pins the thing that would have made the outage
 * survivable even with the bug in place: a bound on one call, a bound on one
 * request, and an honest answer about which half broke.
 *
 * It DRIVES the paths rather than reading them. A scan over the source can only
 * tell you the source still says the right thing, and this codebase has twice
 * had a guard stay green while the behaviour it guarded was deleted one file
 * along.
 */
import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { mcpFetch } from '../src/mcp';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';
import {
  withD1ReadBudget,
  resolveD1Budget,
  d1BudgetUsage,
  isD1ReadBudgetExceeded,
  classifyD1Failure,
  DEFAULT_D1_ROWS_READ_BUDGET,
  DEFAULT_D1_STATEMENT_BUDGET,
} from '../src/d1Budget';
import {
  readCurateHoldings,
  readCurateHoldingsPage,
  DEFAULT_CURATE_HOLDINGS_PAGE,
  MAX_CURATE_HOLDINGS_PAGE,
} from '../src/curateHoldings';

const JWT = 'one-request-one-read-budget';
const open: SqliteD1[] = [];
afterEach(() => { while (open.length) open.pop()!.close(); });

/**
 * The test harness's D1 shim reports no `meta`, because `node:sqlite` has no
 * row-scan counter to report. Real D1 does, and the budget is summed from it,
 * so the shim is given one: `rowsPerStatement` is what every statement claims
 * to have read. Synthetic on purpose — this file asks whether the ledger adds
 * up and the refusal comes back cleanly, not what SQLite actually scans. The
 * real figures are measured against the local D1 runtime instead, in
 * `worker/scripts/measure-holdings-rows.mjs`.
 */
function metered(db: SqliteD1, rowsPerStatement: number, cheapIdentityReads = false) {
  const wrap = (statement: any, readCost: number): any => ({
    bind: (...values: unknown[]) => wrap(statement.bind(...values), readCost),
    first: () => Promise.resolve(statement.first()),
    all: () => Promise.resolve({ ...statement.all(), meta: { rows_read: readCost, rows_written: 0 } }),
    run: () => { const result = statement.run(); return Promise.resolve({ ...result, meta: { ...result.meta, rows_read: readCost } }); },
    raw: statement,
  });
  return {
    prepare: (sql: string) => wrap(db.prepare(sql), cheapIdentityReads && /\b(?:FROM|UPDATE)\s+(?:users|accounts|account_members|mcp_tokens)\b/i.test(sql) ? Math.min(1, rowsPerStatement) : rowsPerStatement),
    batch: (statements: any[]) => Promise.resolve(
      db.batch(statements.map(statement => statement.raw)).map(result => ({ ...result, meta: { ...result.meta, rows_read: rowsPerStatement } })),
    ),
    sqlite: db.sqlite,
  } as any;
}

function holdingsSchema(db: SqliteD1) {
  db.exec(`CREATE TABLE tea_compass_entries(id TEXT PRIMARY KEY,account_id TEXT,name TEXT,vendor_name TEXT,sample_state TEXT,draft_product_id TEXT,archived_at TEXT,deleted_at TEXT,merged_into_id TEXT);
  CREATE TABLE products(id TEXT PRIMARY KEY,account_id TEXT,source_compass_entry_id TEXT,stock_grams REAL,inventory_purpose TEXT);
  CREATE TABLE tea_sample_sets(id TEXT PRIMARY KEY,account_id TEXT,archived INTEGER);
  CREATE TABLE tea_samples(id TEXT PRIMARY KEY,account_id TEXT,compass_entry_id TEXT,set_id TEXT,name TEXT,grams REAL,status TEXT,created_at TEXT,archived_at TEXT,grams_known INTEGER NOT NULL DEFAULT 1);`);
  return db;
}

/** A shelf of `count` canonical teas, named so the sort order is predictable. */
function shelf(count: number) {
  const db = holdingsSchema(new SqliteD1(false));
  open.push(db);
  const insert = db.sqlite.prepare('INSERT INTO tea_compass_entries VALUES(?,?,?,?,?,NULL,NULL,NULL,NULL)');
  for (let i = 0; i < count; i++) {
    insert.run(`tea-${String(i).padStart(5, '0')}`, 'a', `Tea ${String(i).padStart(5, '0')}`, 'Vendor', 'received');
  }
  return db;
}

describe('one request, one read budget', () => {
  it('sums rows_read from D1 own meta and refuses the next query once the budget is gone', async () => {
    const db = shelf(3);
    const budgeted = withD1ReadBudget(metered(db, 400), { rows: 1_000, statements: 100 });
    for (let call = 0; call < 2; call++) await budgeted.prepare('SELECT * FROM tea_compass_entries').bind().all();
    expect(d1BudgetUsage(budgeted)).toMatchObject({ rowsRead: 800, statements: 2 });

    // The query that goes OVER throws rather than handing its rows back. It
    // has already been billed by D1, so nothing is saved by returning them,
    // and continuing on a blown budget is how one expensive request becomes
    // twenty. The request fails here, in words, instead.
    await expect(budgeted.prepare('SELECT * FROM tea_compass_entries').bind().all())
      .rejects.toThrow(/read budget exceeded/i);
    expect(d1BudgetUsage(budgeted)!.rowsRead).toBe(1_200);
    await expect(budgeted.prepare('SELECT 1').bind().all()).rejects.toThrow(/read budget exceeded/i);
  });

  it('counts statements too, because an N+1 of point lookups reads few rows and still spends a day', async () => {
    const db = shelf(1);
    const budgeted = withD1ReadBudget(metered(db, 0), { rows: 5_000_000, statements: 3 });
    for (let call = 0; call < 3; call++) await budgeted.prepare('SELECT * FROM tea_compass_entries WHERE id=?').bind('tea-00000').first();
    let caught: unknown;
    try { await budgeted.prepare('SELECT 1').bind().first(); } catch (error) { caught = error; }
    expect(isD1ReadBudgetExceeded(caught)).toBe(true);
    expect((caught as any).kind).toBe('statements');
    expect(d1BudgetUsage(budgeted)!.rowsRead).toBe(0);
  });

  it('is one ledger per request however many times it is asked for', async () => {
    const db = shelf(2);
    const once = withD1ReadBudget(metered(db, 10), { rows: 100, statements: 100 });
    const twice = withD1ReadBudget(once, { rows: 100, statements: 100 });
    expect(twice).toBe(once);
    await twice.prepare('SELECT * FROM tea_compass_entries').bind().all();
    expect(d1BudgetUsage(once)).toMatchObject({ rowsRead: 10, statements: 1 });
  });

  it('charges a batch per statement and leaves an unwrapped database alone', async () => {
    const db = shelf(1);
    const budgeted = withD1ReadBudget(metered(db, 7), { rows: 1_000, statements: 1_000 });
    await budgeted.batch([
      budgeted.prepare("INSERT INTO tea_sample_sets VALUES('s1','a',0)").bind(),
      budgeted.prepare("INSERT INTO tea_sample_sets VALUES('s2','a',0)").bind(),
    ]);
    expect(d1BudgetUsage(budgeted)).toMatchObject({ statements: 2, rowsRead: 14 });
    expect(db.sqlite.prepare('SELECT COUNT(*) AS n FROM tea_sample_sets').get()).toMatchObject({ n: 2 });
    expect(d1BudgetUsage(db)).toBeNull();
  });

  it('reads its caps from the environment, and off means off', () => {
    expect(resolveD1Budget({})).toEqual({ rows: DEFAULT_D1_ROWS_READ_BUDGET, statements: DEFAULT_D1_STATEMENT_BUDGET });
    expect(resolveD1Budget({ D1_ROWS_READ_BUDGET: '120000', D1_STATEMENT_BUDGET: '40' })).toEqual({ rows: 120_000, statements: 40 });
    // Absence, blank, zero and nonsense are all the default; a budget of zero
    // rows would refuse every request, which is a worse outage than the one
    // being guarded against.
    for (const bad of ['', '0', '-5', 'lots', null, undefined]) {
      expect(resolveD1Budget({ D1_ROWS_READ_BUDGET: bad })).toMatchObject({ rows: DEFAULT_D1_ROWS_READ_BUDGET });
    }
    expect(resolveD1Budget({ D1_ROWS_READ_BUDGET: 'off' })).toBeNull();
    expect(resolveD1Budget({ D1_STATEMENT_BUDGET: 'OFF' })).toBeNull();
    const db = shelf(1);
    expect(withD1ReadBudget(db, null)).toBe(db);
  });
});

describe('no single call reads the whole shelf', () => {
  it('answers one page and a cursor, and the pages together are the whole shelf exactly once', async () => {
    const db = shelf(130);
    const first = await readCurateHoldingsPage(db as any, 'a');
    expect(first.limit).toBe(DEFAULT_CURATE_HOLDINGS_PAGE);
    expect(first.holdings).toHaveLength(DEFAULT_CURATE_HOLDINGS_PAGE);
    expect(first.has_more).toBe(true);
    expect(first.next_cursor).toBeTruthy();

    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 20; page++) {
      const result = await readCurateHoldingsPage(db as any, 'a', { cursor });
      seen.push(...result.holdings.map(h => String(h.entry.id)));
      if (!result.has_more) break;
      cursor = result.next_cursor;
    }
    expect(seen).toHaveLength(130);
    expect(new Set(seen).size).toBe(130);
    expect(seen).toEqual([...seen].sort());
  });

  it('will not be talked above its ceiling, and the array door is bounded too', async () => {
    const db = shelf(260);
    expect((await readCurateHoldingsPage(db as any, 'a', { limit: 10_000 })).limit).toBe(MAX_CURATE_HOLDINGS_PAGE);
    expect((await readCurateHoldingsPage(db as any, 'a', { limit: 10_000 })).holdings).toHaveLength(MAX_CURATE_HOLDINGS_PAGE);
    // A limit of zero, or a negative, or a word, is nobody saying how many —
    // the default, not a page of nothing and not a page of everything.
    for (const nonsense of [0, -5, NaN, undefined]) {
      expect((await readCurateHoldingsPage(db as any, 'a', { limit: nonsense as number })).limit).toBe(DEFAULT_CURATE_HOLDINGS_PAGE);
    }
    // The back-compatible array door defaults to the ceiling, not to 50, so a
    // caller counting a 139-tea shelf gets the shelf; what it cannot do is
    // read an unbounded one.
    expect(await readCurateHoldings(db as any, 'a')).toHaveLength(MAX_CURATE_HOLDINGS_PAGE);
    expect(await readCurateHoldings(db as any, 'a', { limit: 5 })).toHaveLength(5);
  });

  it('keeps a tea with no vendor recorded on the page, which is what a row-value keyset drops', async () => {
    const db = shelf(4);
    db.sqlite.prepare("UPDATE tea_compass_entries SET vendor_name=NULL WHERE id IN ('tea-00001','tea-00003')").run();
    const seen: string[] = [];
    let cursor: string | null = null;
    for (let page = 0; page < 10; page++) {
      const result = await readCurateHoldingsPage(db as any, 'a', { cursor, limit: 1 });
      seen.push(...result.holdings.map(h => String(h.entry.id)));
      if (!result.has_more) break;
      cursor = result.next_cursor;
    }
    expect(seen.sort()).toEqual(['tea-00000', 'tea-00001', 'tea-00002', 'tea-00003']);
  });

  it('starts over on a cursor it cannot read rather than refusing', async () => {
    const db = shelf(3);
    const page = await readCurateHoldingsPage(db as any, 'a', { cursor: 'not-a-cursor-at-all' });
    expect(page.holdings).toHaveLength(3);
  });

  it('still costs the same two statements at a page of 200 as at a page of 3', async () => {
    const db = shelf(200);
    let statements = 0;
    const prepare = db.prepare.bind(db);
    (db as any).prepare = (sql: string) => { statements++; return prepare(sql); };
    await readCurateHoldingsPage(db as any, 'a', { limit: MAX_CURATE_HOLDINGS_PAGE });
    expect(statements).toBe(2);
  });
});

describe('the request boundary refuses cleanly', () => {
  async function holdingsRequest(db: SqliteD1, rowsPerStatement: number, env: Record<string, unknown> = {}) {
    const token = await signedToken(JWT, { sub: 'owner', email: 'owner@test.dev', active_account_id: 'acc-shop', platform_role: null });
    return worker.fetch(new Request('https://worker.test/api/curate/holdings?samples_only=false', {
      headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': 'acc-shop' },
    }), { DB: metered(db, rowsPerStatement, true), JWT_SECRET: JWT, ...env } as any);
  }

  function shop() {
    const db = new SqliteD1();
    open.push(db);
    seedIdentity(db, { userId: 'owner', accountId: 'acc-shop', role: 'owner' });
    db.sqlite.prepare(`INSERT INTO tea_compass_entries(id,user_id,account_id,name,vendor_name,sample_state)
      VALUES ('tea','owner','acc-shop','A tea','Vendor','received')`).run();
    return db;
  }

  it('answers the holdings with the budget in place', async () => {
    const response = await holdingsRequest(shop(), 10);
    expect(response.status).toBe(200);
    expect(((await response.json()) as any[]).map(h => h.entry.id)).toEqual(['tea']);
  });

  it('answers 503 and words, not 500 and silence, when the request has read its share', async () => {
    // One statement claims a whole budget's worth, so the holdings read spends
    // it and the portions read is refused: the shape of the real outage, in
    // which one query cost more than a request may spend.
    const response = await holdingsRequest(shop(), 60_000);
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBeNull();
    const body = await response.json() as any;
    expect(body.error).toBe('database_read_budget_exceeded');
    expect(body.retryable).toBe(false);
    expect(body.message).toMatch(/more than any one request may read/i);
    expect(body.rows_read).toBeGreaterThan(body.rows_budget - 1);
    // Nothing SQL, stack or secret shaped rides out on it.
    expect(JSON.stringify(body)).not.toMatch(/SELECT|tea_compass_entries|JWT|Bearer/i);
  });

  it('obeys a budget set in the environment, which is how it is turned off', async () => {
    const tight = await holdingsRequest(shop(), 400, { D1_ROWS_READ_BUDGET: '100' });
    expect(tight.status).toBe(503);
    const none = await holdingsRequest(shop(), 10_000_000, { D1_ROWS_READ_BUDGET: 'off' });
    expect(none.status).toBe(200);
  });

  it('is not reported by the curate route as a bad request, which is the opposite of true', async () => {
    const response = await holdingsRequest(shop(), 60_000);
    expect(response.status).not.toBe(400);
    expect((await response.json() as any).error).not.toMatch(/budget exceeded for this request: /);
  });
});

describe('the MCP door says which half is broken', () => {
  async function mcpWith(db: any, bearer: string, body: unknown, env: Record<string, unknown> = {}) {
    const response = await mcpFetch(new Request('https://worker.test/mcp', {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }), { DB: db, JWT_SECRET: JWT, ...env } as any);
    return { status: response.status, body: await response.json() as any };
  }

  /** A database that refuses every read with the error D1 actually sends. */
  const refusing = (message: string, code?: number) => ({
    prepare: () => ({
      bind: () => ({
        first: () => Promise.reject(Object.assign(new Error(message), code === undefined ? {} : { code })),
        all: () => Promise.reject(Object.assign(new Error(message), code === undefined ? {} : { code })),
        run: () => Promise.reject(new Error(message)),
      }),
    }),
    batch: () => Promise.reject(new Error(message)),
  }) as any;

  const call = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search_tea', arguments: { query: 'tea' } } };

  it('reports a spent daily quota as a quota problem, never as a bad token', async () => {
    const { status, body } = await mcpWith(
      refusing("D1_ERROR: Exceeded D1's free tier daily row read limit", 7500),
      'any-bearer-at-all',
      call,
    );
    expect(status).toBe(503);
    expect(body.error.code).toBe(-32004);
    expect(body.error.message).toMatch(/daily read quota exceeded/i);
    expect(body.error.data).toEqual({ reason: 'quota' });
    // The old answer, and the reason this test exists: -32001 sends whoever
    // reads it to mint a second token that fails identically, and -32002 says
    // the auth system is down when it is the database.
    expect(body.error.code).not.toBe(-32001);
    expect(body.error.code).not.toBe(-32002);
  });

  it('reports an unreachable database as unavailable, and keeps -32002 for a failure that is not the database', async () => {
    const down = await mcpWith(refusing('D1_ERROR: Network connection lost', 7500), 'any-bearer', call);
    expect(down.body.error).toMatchObject({ code: -32004, message: 'Database unavailable', data: { reason: 'database' } });

    const puzzling = await mcpWith(refusing('something else entirely went wrong'), 'any-bearer', call);
    expect(puzzling.body.error).toMatchObject({ code: -32002, message: 'Authentication dependency unavailable' });
  });

  it('echoes none of the provider message, so nothing key-shaped can ride out unauthenticated', async () => {
    const { body } = await mcpWith(refusing('D1_ERROR: quota gone for account sk-live-abcdefghijklmnop', 7500), 'any-bearer', call);
    expect(JSON.stringify(body)).not.toMatch(/sk-live/);
  });

  it('reports a spent read budget on a tool call as a budget problem, not an internal error', async () => {
    const db = new SqliteD1();
    open.push(db);
    seedIdentity(db, { userId: 'owner', accountId: 'acc-shop', role: 'owner' });
    db.sqlite.prepare("INSERT INTO tea_compass_entries(id,user_id,account_id,name) VALUES ('matched-tea','owner','acc-shop','tea')").run();
    const bearer = 'mcp-budget-bearer';
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bearer))))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    db.sqlite.prepare(`INSERT INTO mcp_tokens (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier,expires_at)
      VALUES ('budget-token','acc-shop','owner','owner@test.dev','test',?,'fake','["inventory:read"]','account_owner',?)`)
      .run(hash, Math.floor(Date.now() / 1000) + 3600);

    // Authentication point lookups cost one synthetic row each; the tool's
    // own scans are what run the budget down. Two of them at
    // 1,200 rows apiece is over 2,000, so the refusal lands inside the tool
    // call; a matching tea then needs a further holdings read, which must
    // be refused before execution rather than ignoring the exhausted budget.
    const { status, body } = await mcpWith(metered(db, 1_200, true), bearer, call, { D1_ROWS_READ_BUDGET: '2000' });
    expect(status).toBe(200);
    expect(body.error).toMatchObject({ code: -32005, data: { reason: 'reconciliation_required', retryable: false, writes_committed: true } });
    expect(body.error.message).toMatch(/Earlier database changes may have completed/i);
  });

  it('classifies each failure once, in one place', () => {
    expect(classifyD1Failure(new Error("Exceeded D1's free tier daily row read limit"))).toBe('quota');
    expect(classifyD1Failure(Object.assign(new Error('nope'), { code: 7500 }))).toBe('database');
    expect(classifyD1Failure(new Error('D1_ERROR: database is locked'))).toBe('database');
    expect(classifyD1Failure(new Error('wrapped'), )).toBe('auth');
    expect(classifyD1Failure(Object.assign(new Error('outer'), { cause: new Error('D1_ERROR: too many API requests') }))).toBe('quota');
    expect(classifyD1Failure(undefined)).toBe('auth');
  });
});
