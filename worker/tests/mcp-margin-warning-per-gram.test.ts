import { afterEach, describe, expect, it } from 'vitest';
import { mcpFetch } from '../src/mcp';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

/*
 * `update_tea_pricing`'s preview warns when the margin falls under 30 percent.
 * It compared `retail_price_usd`, a PER-GRAM figure, against `cost_amount`,
 * the TOTAL paid for `quantity_purchased` grams, converted to dollars and
 * never divided by the grams. For a cake bought as 2,000 g for 1,200 yuan the
 * cost per gram is 0.083 dollars; the warning read it as 166 dollars, two
 * thousand times too much, and told the operator a 0.50 dollar price was a
 * loss of 33,000 percent. The same total-as-per-gram fault was fixed in
 * `handleNetworkCatalog` (audit finding MONEY-3); this is the agent door's
 * copy of it. Nothing here writes a price, so no money moved, but the one
 * sentence the preview shows about money was wrong on every non-trivial tea.
 *
 * Driven against the running handler, not scanned: a scan of `mcp.ts` for
 * `quantity_purchased` was already green while the division was missing.
 */

const SECRET = 'margin-per-gram-secret';
const TOKEN = 'margin_per_gram_token';
const ACCOUNT = 'account-margin';
const OWNER = 'owner-margin';

const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

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

const tokenHash = async (token: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))]
    .map(value => value.toString(16).padStart(2, '0')).join('');

/**
 * A 2,000 g cake bought for 1,200 yuan, priced through the seeded table's
 * 7.2 yuan to the dollar and the shop's fallback freight of 85 yuan a kilo:
 * 0.0833 for the leaf plus 0.0118 for the freight, 0.0951 dollars a gram.
 */
async function seed(quantityPurchased: number | null = 2000): Promise<SqliteD1> {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner', bundles: ['catalog', 'stock', 'publish', 'sell'] });
  db.sqlite.prepare(`INSERT OR REPLACE INTO mcp_tokens
    (id,account_id,user_id,user_email,label,token_hash,token_prefix,scopes,creator_tier)
    VALUES ('tok-margin',?,?,?,'margin',?,?,?,'account_owner')`)
    .run(ACCOUNT, OWNER, `${OWNER}@test.dev`, await tokenHash(TOKEN), TOKEN.slice(0, 8), JSON.stringify(['stock:write']));
  db.sqlite.prepare(
    `INSERT INTO products (id, account_id, type, product_name, given_name, cost_amount, cost_currency, quantity_purchased, stock_grams)
     VALUES ('cake', ?, 'Puerh', 'A Cake Worth 2000 Grams', 'A Cake Worth 2000 Grams', 1200, 'Yuan', ?, 2000)`
  ).run(ACCOUNT, quantityPurchased);
  return db;
}

async function preview(db: SqliteD1, args: Record<string, unknown>) {
  const response = await mcpFetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'update_tea_pricing', arguments: { product_id: 'cake', ...args } } }),
  }), { DB: new AsyncD1(db) as any, JWT_SECRET: SECRET } as any);
  const rpc = await response.json() as any;
  expect(rpc.error, JSON.stringify(rpc.error)).toBeUndefined();
  return JSON.parse(rpc.result.content[0].text).preview;
}

describe('update_tea_pricing margin warning compares per gram to per gram', () => {
  it('does not warn on a healthy per-gram price just because the batch total is large', async () => {
    const db = await seed();
    const { margin_warning } = await preview(db, { retail_price_usd: 0.5 });
    // 0.0951 dollars a gram against 0.50 is an 81 percent margin.
    expect(margin_warning).toBeNull();
  });

  it('warns with the real per-gram margin when the price is genuinely thin', async () => {
    const db = await seed();
    const { margin_warning } = await preview(db, { retail_price_usd: 0.1 });
    // (0.10 - 0.0951) / 0.10 rounds to 5 percent, freight included, as the
    // shop's own pricing counts it.
    expect(margin_warning).toMatch(/Margin will be 5%/);
  });

  it('uses a quantity supplied in the same call', async () => {
    const db = await seed(null);
    const { margin_warning } = await preview(db, { retail_price_usd: 0.5, quantity_purchased: 2000 });
    expect(margin_warning).toBeNull();
  });

  it('declines to warn when the cost currency was never stated, rather than assume dollars', async () => {
    const db = await seed();
    db.sqlite.prepare("UPDATE products SET cost_currency = 'UNK' WHERE id = 'cake'").run();
    const { margin_warning } = await preview(db, { retail_price_usd: 0.1 });
    expect(margin_warning).toBeNull();
  });

  it('declines to warn when no quantity is recorded, rather than reading the total as per gram', async () => {
    const db = await seed(null);
    const { margin_warning } = await preview(db, { retail_price_usd: 0.5 });
    expect(margin_warning).toBeNull();
  });
});
