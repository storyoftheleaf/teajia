import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { mcpFetch } from '../src/mcp';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

/**
 * The screen and the voice must answer "what needs me" with the same list.
 *
 * `/api/attention` (index.ts) and `whats_waiting` (mcp.ts) were written as two
 * queries against the same idea, and they drifted: the voice required
 * `status = 'Draft'` across BOTH halves of its unpriced question, so a Pending
 * order carrying a line priced at nothing was on the screen and not in the
 * spoken answer. `/api/attention` had a test for that case; the voice had none,
 * which is how the divergence survived.
 *
 * These tests assert the two agree, rather than testing either alone, so the
 * next divergence fails here instead of being discovered by a customer paying
 * the wrong amount.
 */

const SECRET = 'attention-parity-secret';
const ACCOUNT = 'account-p';
const OWNER = 'owner-p';
const MCP_TOKEN = 'parity-token-000000000000000000000001';

const databases: SqliteD1[] = [];

afterEach(() => {
  while (databases.length) databases.pop()!.close();
});

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The harness runs SQLite synchronously. `authenticateMcp` bumps last_used_at
 * fire-and-forget with `.run().catch(...)`, so the MCP path needs statements
 * that actually return promises. Same shape as the wrapper in
 * mcp-fulfillment.test.ts, kept local rather than widening the shared harness.
 */
function asyncDb(db: SqliteD1) {
  return {
    prepare(sql: string) {
      const inner = db.prepare(sql);
      const statement = {
        inner,
        bind: (...values: unknown[]) => { inner.bind(...values); return statement; },
        first: async () => inner.first(),
        all: async () => inner.all(),
        run: async () => inner.run(),
      };
      return statement;
    },
    batch(statements: any[]) {
      return Promise.resolve(db.batch(statements.map(statement => statement.inner)));
    },
  };
}

function env(db: SqliteD1) {
  return { DB: asyncDb(db) as any, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com' } as any;
}

/**
 * One request that became an order, plus the MCP token the voice arrives with.
 * The order starts as a Draft the request became, which both surfaces already
 * agreed was unpriced. Each test then moves it to the state that separated them.
 */
async function seed(): Promise<SqliteD1> {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: OWNER, accountId: ACCOUNT, role: 'owner' });

  db.sqlite.prepare(
    `INSERT INTO mcp_tokens
       (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
     VALUES ('token-parity', ?, ?, ?, 'parity', ?, ?, '["sales:read"]', 'account_owner')`
  ).run(ACCOUNT, OWNER, `${OWNER}@test.dev`, await sha256Hex(MCP_TOKEN), MCP_TOKEN.slice(0, 8));

  db.sqlite.prepare(
    `INSERT INTO invoices
       (id, account_id, invoice_number, customer_name, display_currency,
        shipping_cost_usd, status, payment_status, created_at)
     VALUES ('inv-p', ?, 'TJ-P0001', 'Mei', 'USD', 0, 'Draft', 'unpaid', '2026-08-01 09:00:00')`
  ).run(ACCOUNT);
  db.sqlite.prepare(
    `INSERT INTO invoice_line_items (id, account_id, invoice_id, custom_name, quantity, price_at_sale)
     VALUES ('line-p', ?, 'inv-p', 'Da Hong Pao', 30, 1)`
  ).run(ACCOUNT);
  db.sqlite.prepare(
    `INSERT INTO inquiries
       (id, account_id, name, email, items, total_usd, currency, status,
        ref_number, converted_invoice_id, created_at)
     VALUES ('inq-p', ?, 'Mei', 'mei@test.dev', '[]', 30, 'USD', 'replied',
             'REF-P', 'inv-p', '2026-07-30 08:00:00')`
  ).run(ACCOUNT);

  return db;
}

/** The unpriced order ids as the admin screen reports them. */
async function screenUnpriced(db: SqliteD1): Promise<string[]> {
  const token = await signedToken(SECRET, {
    sub: OWNER, email: `${OWNER}@test.dev`, name: OWNER,
    active_account_id: ACCOUNT, platform_role: null,
  });
  const response = await worker.fetch(new Request('https://worker.test/api/attention', {
    headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT },
  }), env(db));
  expect(response.status).toBe(200);
  const body = await response.json() as any;
  return body.items
    .filter((item: any) => item.kind === 'unpriced')
    .map((item: any) => item.id)
    .sort();
}

/** The same question asked by voice. */
async function voiceUnpriced(db: SqliteD1): Promise<string[]> {
  const response = await mcpFetch(new Request('https://worker.test/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${MCP_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'whats_waiting', arguments: { kind: 'unpriced', limit: 40 } },
    }),
  }), env(db));
  const rpc = await response.json() as any;
  expect(rpc.error).toBeUndefined();
  const payload = rpc.result.structuredContent;
  return payload.items
    .filter((item: any) => item.kind === 'unpriced')
    .map((item: any) => item.id)
    .sort();
}

describe('the screen and the voice answer "what needs me" identically', () => {
  it('agrees on a converted request still sitting as a draft', async () => {
    const db = await seed();
    expect(await screenUnpriced(db)).toEqual(['inv-p']);
    expect(await voiceUnpriced(db)).toEqual(await screenUnpriced(db));
  });

  it('agrees on a live order carrying a line with no price', async () => {
    const db = await seed();
    // Convert leaves a retired tea at zero on purpose, so an order can reach
    // Pending still asking a customer for nothing. This is the case the voice
    // used to miss: its unpriced query required Draft on both halves, so the
    // screen showed a superset of what was spoken.
    db.sqlite.prepare("UPDATE invoices SET status = 'Pending' WHERE id = 'inv-p'").run();
    db.sqlite.prepare("UPDATE invoice_line_items SET price_at_sale = 0 WHERE id = 'line-p'").run();

    expect(await screenUnpriced(db)).toEqual(['inv-p']);
    expect(await voiceUnpriced(db)).toEqual(['inv-p']);
  });

  it('agrees that a plain draft nobody requested is not nagging anyone', async () => {
    const db = await seed();
    // Priced, and no longer the order a request became: an operator composing
    // an order by hand. Neither surface should raise it.
    db.sqlite.prepare("UPDATE inquiries SET converted_invoice_id = NULL WHERE id = 'inq-p'").run();

    expect(await screenUnpriced(db)).toEqual([]);
    expect(await voiceUnpriced(db)).toEqual([]);
  });

  it('agrees that a sent order is water under the bridge', async () => {
    const db = await seed();
    db.sqlite.prepare(
      "UPDATE invoices SET status = 'Pending', fulfilled_at = '2026-08-06T00:00:00.000Z' WHERE id = 'inv-p'"
    ).run();
    db.sqlite.prepare("UPDATE invoice_line_items SET price_at_sale = 0 WHERE id = 'line-p'").run();

    expect(await screenUnpriced(db)).toEqual([]);
    expect(await voiceUnpriced(db)).toEqual([]);
  });

  it('agrees that a voided order is not waiting on anyone', async () => {
    const db = await seed();
    db.sqlite.prepare("UPDATE invoices SET status = 'Void' WHERE id = 'inv-p'").run();
    db.sqlite.prepare("UPDATE invoice_line_items SET price_at_sale = 0 WHERE id = 'line-p'").run();

    expect(await screenUnpriced(db)).toEqual([]);
    expect(await voiceUnpriced(db)).toEqual([]);
  });
});
