import { afterEach, describe, expect, it } from 'vitest';
import { mcpFetch } from '../src/mcp';
import { isTeaType, TEA_TYPES } from '../../src/wisdom/vocabulary';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

/**
 * `create_tea` used to default an omitted type to 'Tea' and its own tool
 * description told the model to try 'Pu-erh'. Neither is a real tea type:
 * `TEA_TYPES` is Green, White, Yellow, Oolong, Red, Dark, Sheng, Shou, Herbal,
 * and `isTeaType` is exactly what `authorizeInvoiceLines` (worker/src/
 * teaMasterSales.ts) checks before it will let a product sell. A tea created
 * through the agent door with no type, or with 'Pu-erh', landed in the catalog
 * looking normal and was refused the first time anyone tried to sell it.
 *
 * The fix refuses the create instead of inventing an answer: an omitted or
 * unrecognised type is rejected by name, listing the types the shop actually
 * accepts, the same shape `createMissingCost` already uses for an omitted
 * cost. A recognised alias (an existing spelling `normalizeTeaType` already
 * resolves, e.g. 'Black' or 'Wulong') is accepted and stored under its
 * canonical word, so the tool is not stricter than the vocabulary module
 * whose word it enforces. Bare 'Pu-erh' stays refused on purpose: the
 * vocabulary module deliberately cannot resolve it to Sheng or Shou without a
 * human, and a tool default must not guess what a human coder would not.
 */

const TOKEN = 'tea_type_secret_token';
const ACCOUNT = 'acc-type';
const OWNER = 'owner-type';

const tokenHash = async (token: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
    .map(value => value.toString(16).padStart(2, '0')).join('');

/* mcp.ts fires its last_used_at update without awaiting it, so the D1 it is
   handed has to return promises the way the real one does. */
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

const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function database() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner', bundles: ['catalog', 'stock', 'publish', 'sell'] });
  return db;
}

async function mintMcpToken(db: SqliteD1, scopes: string[]) {
  db.sqlite.prepare(`INSERT OR REPLACE INTO mcp_tokens
    (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
    VALUES ('tok-type',?,?,?,'type',?,?,?,'account_owner')`)
    .run(ACCOUNT, OWNER, `${OWNER}@test.dev`, await tokenHash(TOKEN), TOKEN.slice(0, 8), JSON.stringify(scopes));
}

/** The JSON-RPC envelope, so a refusal (which arrives as a top-level rpc.error
    from a thrown Error, not a result payload) is readable the same way
    a-tea-arrives-with-its-cost.test.ts reads one. */
async function callTool(db: SqliteD1, name: string, args: Record<string, unknown>) {
  const response = await mcpFetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), { DB: new AsyncD1(db) as any } as any);
  return await response.json() as any;
}

const toolPayload = (rpc: any) => JSON.parse(rpc.result.content[0].text);

const productRow = (db: SqliteD1, name: string) => db.sqlite.prepare(
  'SELECT id, type FROM products WHERE product_name = ?'
).get(name) as any;

/** Returns the refusal message (a thrown Error surfaces as rpc.error.message),
    or the committed tool payload when the create goes through. */
async function createTea(db: SqliteD1, args: Record<string, unknown>) {
  const previewRpc = await callTool(db, 'create_tea', args);
  if (previewRpc.error) return { error: previewRpc.error.message };
  const preview = toolPayload(previewRpc);
  if (preview.error) return preview;
  const committedRpc = await callTool(db, 'create_tea', { ...args, confirm: preview.confirmation_token });
  if (committedRpc.error) return { error: committedRpc.error.message };
  return toolPayload(committedRpc);
}

describe('the vocabulary create_tea now enforces', () => {
  it('is the list authorizeInvoiceLines actually checks', () => {
    expect(TEA_TYPES).toEqual(['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Dark', 'Sheng', 'Shou', 'Herbal']);
    expect(isTeaType('Tea')).toBe(false);
    expect(isTeaType('Pu-erh')).toBe(false);
  });
});

describe('reproduction: the old default was already unsellable', () => {
  it('a product with type "Tea" is refused by the invoice path, not just untested', async () => {
    const db = database();
    await mintMcpToken(db, ['sales:write']);
    db.sqlite.prepare(`INSERT INTO products
      (id, account_id, type, product_name, given_name, status, stock_grams, fixed_retail_price_usd)
      VALUES ('prod-old-default', ?, 'Tea', 'Old Default Tea', 'Old Default Tea', 'Active', 500, 0.5)`)
      .run(ACCOUNT);

    const preview = toolPayload(await callTool(db, 'record_sale', {
      customer_name: 'Buyer',
      lines: [{ product_id: 'prod-old-default', grams: 10, price_per_gram_usd: 0.5 }],
    }));
    expect(preview).toMatchObject({ error: 'product_not_sale_eligible', product_id: 'prod-old-default' });
  });
});

describe('create_tea refuses to guess a type', () => {
  it('an omitted type is refused, naming the accepted types', async () => {
    const db = database();
    await mintMcpToken(db, ['stock:write']);
    const result = await createTea(db, {
      product_name: 'No Type Tea', cost_amount: 100, cost_currency: 'USD', stock_grams: 100,
    });
    expect(result.error).toBeDefined();
    for (const type of TEA_TYPES) expect(result.error).toContain(type);
    expect(productRow(db, 'No Type Tea')).toBeUndefined();
  });

  it('the old bad default, "Tea", is refused rather than silently accepted', async () => {
    const db = database();
    await mintMcpToken(db, ['stock:write']);
    const result = await createTea(db, {
      product_name: 'Literally Tea', type: 'Tea', cost_amount: 100, cost_currency: 'USD', stock_grams: 100,
    });
    expect(result.error).toBeDefined();
    expect(productRow(db, 'Literally Tea')).toBeUndefined();
  });

  it('bare "Pu-erh" is refused, because it cannot be resolved to Sheng or Shou without a human', async () => {
    const db = database();
    await mintMcpToken(db, ['stock:write']);
    const result = await createTea(db, {
      product_name: 'Bare Puerh', type: 'Pu-erh', cost_amount: 100, cost_currency: 'USD', stock_grams: 100,
    });
    expect(result.error).toBeDefined();
    expect(result.error).toMatch(/Sheng|Shou/);
    expect(productRow(db, 'Bare Puerh')).toBeUndefined();
  });

  it('an unrecognised word is refused, naming the accepted types', async () => {
    const db = database();
    await mintMcpToken(db, ['stock:write']);
    const result = await createTea(db, {
      product_name: 'Nonsense Type Tea', type: 'Sparkling', cost_amount: 100, cost_currency: 'USD', stock_grams: 100,
    });
    expect(result.error).toBeDefined();
    expect(productRow(db, 'Nonsense Type Tea')).toBeUndefined();
  });

  it('every accepted type lands, and the invoice path accepts the tea it creates', async () => {
    const db = database();
    await mintMcpToken(db, ['stock:write', 'sales:write']);
    for (const type of TEA_TYPES) {
      const name = `${type} Sale Tea`;
      const committed = await createTea(db, {
        product_name: name, type, cost_amount: 100, cost_currency: 'USD', stock_grams: 100,
      });
      expect(committed.committed, `${type} was refused: ${JSON.stringify(committed)}`).toBe(true);

      const row = productRow(db, name);
      expect(row.type).toBe(type);

      const salePreview = toolPayload(await callTool(db, 'record_sale', {
        customer_name: 'Buyer',
        lines: [{ product_id: row.id, grams: 10, price_per_gram_usd: 0.5 }],
      }));
      expect(salePreview.error, `${type}: ${JSON.stringify(salePreview)}`).toBeUndefined();
    }
  });

  it('a known alias is accepted and stored under its canonical word', async () => {
    const db = database();
    await mintMcpToken(db, ['stock:write']);
    const committed = await createTea(db, {
      product_name: 'Black Tea Alias', type: 'Black', cost_amount: 100, cost_currency: 'USD', stock_grams: 100,
    });
    expect(committed.committed).toBe(true);
    expect(productRow(db, 'Black Tea Alias').type).toBe('Red');
  });
});
