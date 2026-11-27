import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { combineToolModules } from '../src/mcpTools/registry';
import { stockCountTools } from '../src/mcpTools/stockCount';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

/*
 * Adrian, 2026-11-25: the 600 Year Gushu Red came in at 500 g, nobody knows
 * what is left, and he wants it set to 118 g. That is a count. These tests go
 * through the real /mcp route, so the count lands through the same
 * applyStockMovement the Manage stock edit uses, and what is asserted is what
 * the shop then reads: the balance, the "counted" stamps, the ledger line, and
 * that nothing is written when the shelf moved after the preview.
 */

const SHOP = 'acc-count';
const OTHER = 'acc-elsewhere';
const TOKEN = 'tjmcp_stock_count_test';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

/* mcp.ts fires some writes without awaiting them, so the D1 it is handed has
   to return promises the way the real one does. */
class AsyncD1 {
  constructor(readonly inner: SqliteD1) {}
  prepare(sql: string) {
    const inner = this.inner.prepare(sql);
    const statement: any = {
      inner,
      bind: (...values: unknown[]) => { inner.bind(...values); return statement; },
      first: async () => inner.first(),
      all: async () => inner.all(),
      run: async () => inner.run(),
    };
    return statement;
  }
  batch(statements: any[]) { return this.inner.batch(statements.map(s => s.inner)); }
}

const tokenHash = async (token: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
    .map(value => value.toString(16).padStart(2, '0')).join('');

async function makeDb(scopes = ['inventory:read', 'stock:write']) {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: SHOP, role: 'owner' });
  seedIdentity(db, { userId: 'other', accountId: OTHER, role: 'owner' });
  db.sqlite.prepare(`INSERT INTO mcp_tokens
    (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
    VALUES ('tok-count',?,?,?,'count',?,?,?,'account_owner')`)
    .run(SHOP, 'adrian', 'adrian@test.dev', await tokenHash(TOKEN), TOKEN.slice(0, 8), JSON.stringify(scopes));
  return db;
}

function seedTea(db: SqliteD1, id: string, opts: { account?: string; type?: string; grams?: number | null; units?: number | null; status?: string; knownAt?: string | null; personalOffer?: string | null } = {}) {
  db.sqlite.prepare(`INSERT INTO products
    (id, account_id, type, product_name, given_name, chinese_name, stock_grams, quantity_units, stock_known_at, status, recheck_stock, personal_offer_source_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
    .run(id, opts.account ?? SHOP, opts.type ?? 'Red', id, id, '六百年古树红茶', opts.grams ?? null, opts.units ?? null,
      opts.knownAt ?? null, opts.status ?? 'Active', opts.personalOffer ?? null);
}

async function rpc(db: SqliteD1, method: string, params: Record<string, unknown>) {
  const response = await worker.fetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  }), { DB: new AsyncD1(db) } as any, { waitUntil() {}, passThroughOnException() {} } as any);
  return await response.json() as any;
}

async function count(db: SqliteD1, args: Record<string, unknown>) {
  const body = await rpc(db, 'tools/call', { name: 'count_stock', arguments: args });
  // A refused argument comes back as a JSON-RPC error rather than a result.
  if (body.error) return { rpcError: body.error, isError: true } as any;
  const text = body.result?.content?.[0]?.text ?? '{}';
  try { return { ...JSON.parse(text), isError: body.result?.isError }; } catch { return { text, isError: body.result?.isError }; }
}

const shelf = (db: SqliteD1, id: string) => db.sqlite.prepare(
  'SELECT stock_grams, quantity_units, stock_known_at, stock_verified_at, recheck_stock, status FROM products WHERE id = ?',
).get(id) as Record<string, any>;
const ledger = (db: SqliteD1, id: string) => db.sqlite.prepare(
  'SELECT delta, balance_after, movement_unit, movement_type, note FROM stock_ledger WHERE product_id = ? ORDER BY created_at',
).all(id) as Record<string, any>[];

describe('registration', () => {
  it('is a stock:write tool that says it is not destructive', () => {
    const { defs } = combineToolModules([stockCountTools]);
    expect(defs.map(d => [d.name, d.scope])).toEqual([['count_stock', 'stock:write']]);
    expect(defs[0].annotations).toMatchObject({ destructiveHint: false, idempotentHint: true });
  });

  it('is listed on the real endpoint for a token that can write stock, and refused to one that cannot', async () => {
    const db = await makeDb();
    const listed = await rpc(db, 'tools/list', {});
    expect(listed.result.tools.map((t: any) => t.name)).toContain('count_stock');

    const reader = await makeDb(['inventory:read']);
    seedTea(reader, 'gushu');
    const refused = await count(reader, { product_id: 'gushu', counted: 118 });
    expect(JSON.stringify(refused)).toMatch(/stock:write|scope/i);
    expect(shelf(reader, 'gushu').stock_grams).toBeNull();
  });
});

describe('the Gushu Red, never counted, set to 118 g', () => {
  it('previews without writing, and says the old number was never a count', async () => {
    const db = await makeDb();
    seedTea(db, 'gushu');
    const preview = await count(db, { product_id: 'gushu', counted: 118, agent: 'Claude' });
    expect(preview.confirmation_token).toBeTruthy();
    expect(preview.preview).toMatchObject({
      action: 'count_stock', unit: 'g', balance_before: 0, balance_before_was_known: false, balance_after: 118, difference: 118,
    });
    expect(preview.preview.read_back).toMatch(/118 g on hand\. The shop had no counted stock/);
    expect(shelf(db, 'gushu').stock_grams).toBeNull();
    expect(ledger(db, 'gushu')).toEqual([]);
  });

  it('confirms through the stock ledger: balance, counted stamps, recheck cleared, one recount line', async () => {
    const db = await makeDb();
    seedTea(db, 'gushu');
    const preview = await count(db, { product_id: 'gushu', counted: 118, agent: 'Claude', note: 'weighed after the session' });
    const done = await count(db, { confirm: preview.confirmation_token });
    expect(done).toMatchObject({ committed: true, balance_before: 0, balance_after: 118, difference: 118, unit: 'g', already_recorded: false });

    const after = shelf(db, 'gushu');
    expect(after.stock_grams).toBe(118);
    expect(after.stock_known_at).toBeTruthy();
    expect(after.stock_verified_at).toBeTruthy();
    expect(after.recheck_stock).toBe(0);
    expect(ledger(db, 'gushu')).toEqual([{
      delta: 118, balance_after: 118, movement_unit: 'gram', movement_type: 'recount',
      note: 'Counted by Claude: 0→118. weighed after the session',
    }]);
    // Every confirmed agent change is in the activity log with the token that made it.
    const logged = db.sqlite.prepare("SELECT details, entity_id FROM activity_logs WHERE action = 'MCP_TOOL_CALL'").all() as any[];
    expect(logged.map(l => ({ ...JSON.parse(l.details), entity_id: l.entity_id })))
      .toEqual([{
        tool: 'count_stock', token_id: 'tok-count', confirmed: true, failed: false, entity_id: 'tok-count',
        // The tea before and after, so undo_agent_change can put it back.
        product_id: 'gushu', before: { stock_grams: null }, after: { stock_grams: 118 },
      }]);
  });

  it('a confirmation is spent once', async () => {
    const db = await makeDb();
    seedTea(db, 'gushu');
    const preview = await count(db, { product_id: 'gushu', counted: 118 });
    await count(db, { confirm: preview.confirmation_token });
    const again = await count(db, { confirm: preview.confirmation_token });
    expect(again.committed).toBeUndefined();
    expect(ledger(db, 'gushu')).toHaveLength(1);
  });
});

describe('what a count must not do', () => {
  it('writes nothing when the shelf moved after the preview', async () => {
    const db = await makeDb();
    seedTea(db, 'gushu', { grams: 200, knownAt: '2026-11-01T00:00:00Z' });
    const preview = await count(db, { product_id: 'gushu', counted: 118 });
    expect(preview.preview).toMatchObject({ balance_before: 200, balance_before_was_known: true, difference: -82 });
    db.sqlite.prepare("UPDATE products SET stock_grams = 150 WHERE id = 'gushu'").run();

    const refused = await count(db, { confirm: preview.confirmation_token });
    expect(refused).toMatchObject({ error: 'stock_changed_since_preview', current_balance: 150 });
    expect(shelf(db, 'gushu').stock_grams).toBe(150);
    expect(ledger(db, 'gushu')).toEqual([]);
  });

  it('a preview for one tea cannot confirm another', async () => {
    const db = await makeDb();
    seedTea(db, 'gushu');
    seedTea(db, 'dancong', { grams: 300, knownAt: '2026-11-01T00:00:00Z' });
    const preview = await count(db, { product_id: 'gushu', counted: 118 });
    const refused = await count(db, { product_id: 'dancong', confirm: preview.confirmation_token });
    expect(refused.committed).toBeUndefined();
    expect(shelf(db, 'dancong').stock_grams).toBe(300);
    expect(shelf(db, 'gushu').stock_grams).toBeNull();
  });

  it('cannot see another shop\'s tea', async () => {
    const db = await makeDb();
    seedTea(db, 'theirs', { account: OTHER, grams: 40 });
    expect(await count(db, { product_id: 'theirs', counted: 0 })).toMatchObject({ error: 'not_found' });
    expect(shelf(db, 'theirs').stock_grams).toBe(40);
  });

  it('sends a personal offer back to the holding it was made from', async () => {
    const db = await makeDb();
    seedTea(db, 'holding', { grams: 500 });
    seedTea(db, 'offer', { grams: 50, personalOffer: 'holding' });
    expect(await count(db, { product_id: 'offer', counted: 10 })).toMatchObject({ error: 'personal_offer' });
  });

  it('refuses a missing or negative count instead of guessing', async () => {
    const db = await makeDb();
    seedTea(db, 'gushu');
    expect((await count(db, { product_id: 'gushu' })).isError).toBe(true);
    expect((await count(db, { product_id: 'gushu', counted: -5 })).isError).toBe(true);
    expect(shelf(db, 'gushu').stock_grams).toBeNull();
  });
});

describe('the rest of what a count means', () => {
  it('a sold-out tea that is counted with stock goes back on sale', async () => {
    const db = await makeDb();
    seedTea(db, 'gushu', { grams: 0, status: 'Sold Out', knownAt: '2026-11-01T00:00:00Z' });
    const preview = await count(db, { product_id: 'gushu', counted: 118 });
    expect(preview.preview.goes_back_on_sale).toBe(true);
    await count(db, { confirm: preview.confirmation_token });
    expect(shelf(db, 'gushu')).toMatchObject({ stock_grams: 118, status: 'Active' });
  });

  it('0 is a real count', async () => {
    const db = await makeDb();
    seedTea(db, 'gushu', { grams: 30, knownAt: '2026-11-01T00:00:00Z' });
    const preview = await count(db, { product_id: 'gushu', counted: 0 });
    await count(db, { confirm: preview.confirmation_token });
    expect(shelf(db, 'gushu').stock_grams).toBe(0);
    expect(ledger(db, 'gushu')[0]).toMatchObject({ delta: -30, balance_after: 0, movement_type: 'recount' });
  });

  it('teaware is counted in whole pieces', async () => {
    const db = await makeDb();
    seedTea(db, 'gaiwan', { type: 'Teaware', units: 3, knownAt: '2026-11-01T00:00:00Z' });
    expect((await count(db, { product_id: 'gaiwan', counted: 1.5 })).isError).toBe(true);
    const preview = await count(db, { product_id: 'gaiwan', counted: 5 });
    expect(preview.preview).toMatchObject({ unit: 'pieces', balance_before: 3, balance_after: 5 });
    await count(db, { confirm: preview.confirmation_token });
    expect(shelf(db, 'gaiwan').quantity_units).toBe(5);
    expect(ledger(db, 'gaiwan')[0]).toMatchObject({ delta: 2, movement_unit: 'unit' });
  });
});
