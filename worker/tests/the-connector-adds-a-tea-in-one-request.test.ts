import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { tokenUseIsStale } from '../src/mcp';
import { SqliteD1, seedIdentity } from './helpers/sqliteD1';

/**
 * Adding a tea through the connector has to fit inside one request's share of
 * the database allowance, and a busy connector should not pay for its own
 * bookkeeping on every call.
 *
 * Every request passes through the shared allowance guard, which hands it a
 * grant: so many rows, so many writes, so many statements. Until policy
 * 2026-11-27-v1 the guard treated the owner's own connector like a scheduled
 * job and granted it 16 statements, and confirming a Curate add takes more
 * than that, so the save was refused after the preview had already been shown.
 * The guard now gives the connector an ordinary request's grant. These tests
 * run the real guard client against a stand-in governor that grants exactly
 * that, so they fail if an add grows past it, or if the connector starts
 * writing its last-used time or sweeping old tickets on every call again.
 */

const SHOP = 'acc-guarded';
const TOKEN = 'tjmcp_connector_adds_in_one_request';
const OWNER_GRANT = { rows: 5000, writes: 128, statements: 200 };

type Result = { success: boolean; results?: unknown[]; meta?: Record<string, unknown> };
type Inner = ReturnType<SqliteD1['prepare']>;

/** The test shim, with the row counts D1 reports and the guard insists on. */
class MeteredStatement {
  constructor(readonly db: MeteredD1, readonly sql: string, readonly inner: Inner) {}
  bind(...values: unknown[]) { this.inner.bind(...values); return this; }
  async all() { this.db.log.push(this.sql); return metered(this.inner.all() as Result); }
  async run() { this.db.log.push(this.sql); return metered(this.inner.run() as Result); }
  async first() { const r = await this.all(); return (r.results?.[0] as unknown) ?? null; }
}
function metered(r: Result) {
  const changes = Number(r.meta?.changes ?? 0);
  return { ...r, meta: { ...r.meta, rows_read: r.results?.length ?? 0, rows_written: changes } };
}
class MeteredD1 {
  log: string[] = [];
  constructor(readonly inner: SqliteD1) {}
  prepare(sql: string) { return new MeteredStatement(this, sql, this.inner.prepare(sql)); }
  async batch(items: MeteredStatement[]) {
    for (const item of items) this.log.push(item.sql);
    return (this.inner.batch(items.map(item => item.inner)) as Result[]).map(metered);
  }
}

/** A governor that grants what the shared ledger grants the connector, and keeps the receipts. */
function governor(grant: typeof OWNER_GRANT) {
  const reserves: Array<Record<string, unknown>> = [];
  const settles: Array<{ rowsRead: number; rowsWritten: number }> = [];
  const namespace = {
    idFromName: (name: string) => name,
    get: () => ({
      fetch: async (url: string, init: RequestInit) => {
        const body = JSON.parse(String(init.body));
        if (new URL(url).pathname === '/reserve') {
          reserves.push(body);
          return Response.json({ allowed: true, id: crypto.randomUUID(), ...grant, expiresAt: Date.now() + 600_000 });
        }
        settles.push(body);
        return Response.json({ settled: true });
      },
    }),
  };
  return { namespace, reserves, settles };
}

const sqlite: SqliteD1[] = [];
afterEach(() => { while (sqlite.length) sqlite.pop()!.close(); });

const hash = async (text: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))]
  .map(v => v.toString(16).padStart(2, '0')).join('');

async function shop() {
  const raw = new SqliteD1(); sqlite.push(raw);
  seedIdentity(raw, { userId: 'owner', accountId: SHOP, role: 'owner' });
  raw.sqlite.prepare(`INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
    VALUES ('tok-guarded', ?, 'owner', 'owner@test.dev', 'test', ?, ?, ?, 'account_owner')`)
    .run(SHOP, await hash(TOKEN), TOKEN.slice(0, 8), JSON.stringify(['inventory:read', 'stock:write', 'catalog:write', 'customers:write']));
  raw.sqlite.prepare(`INSERT INTO products (id, account_id, type, product_name, stock_grams, status) VALUES ('red', ?, 'Red', 'Old tree red', 450, 'Draft')`).run(SHOP);
  return { raw, db: new MeteredD1(raw) };
}

async function call(db: MeteredD1, gov: ReturnType<typeof governor>, name: string, args: Record<string, unknown>) {
  db.log = [];
  const response = await worker.fetch(new Request('https://api.teajia.com/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  }), { DB: db, SHARED_ALLOWANCE: gov.namespace, SHARED_ALLOWANCE_REQUIRED: 'true' } as never, { passThroughOnException() {} } as never);
  const status = response.status;
  const body = await response.json() as { result?: { isError?: boolean; content?: Array<{ text?: string }> } };
  const text = body.result?.content?.[0]?.text ?? '';
  let out: Record<string, unknown> = {};
  try { out = JSON.parse(text); } catch { out = { text }; }
  return { status, isError: body.result?.isError === true, out, statements: db.log.length, log: [...db.log] };
}

const tea = { name: 'Old bush oolong', vendor_name: 'Chen', origin_region: 'Wuyi' };

describe('adding a tea through the connector', () => {
  it('previews and saves inside the grant the guard gives the owner', async () => {
    const { raw, db } = await shop();
    const gov = governor(OWNER_GRANT);

    const preview = await call(db, gov, 'curate_add_tea', tea);
    expect(preview.status).toBe(200);
    expect(preview.isError).toBe(false);
    expect(typeof preview.out.confirmation_token).toBe('string');

    const saved = await call(db, gov, 'curate_add_tea', { ...tea, confirm: preview.out.confirmation_token });
    expect(saved.status).toBe(200);
    expect(saved.isError, JSON.stringify(saved.out)).toBe(false);
    expect(raw.sqlite.prepare(`SELECT COUNT(*) AS n FROM tea_compass_entries WHERE account_id = ? AND name = ?`).get(SHOP, tea.name)).toEqual({ n: 1 });

    // The guard was asked for the connector's lane, once per call, and every grant was settled.
    expect(gov.reserves).toEqual([
      { project: 'teajia', feature: 'agent', priority: 'background' },
      { project: 'teajia', feature: 'agent', priority: 'background' },
    ]);
    expect(gov.settles).toHaveLength(2);
    for (const step of [preview, saved]) expect(step.statements).toBeLessThan(OWNER_GRANT.statements / 4);
  });
});

describe('a busy connector does not pay for its own bookkeeping on every call', () => {
  it('writes its last-used time once, not on every call', async () => {
    const { db } = await shop();
    const gov = governor(OWNER_GRANT);
    const touches = (log: string[]) => log.filter(sql => /UPDATE mcp_tokens SET last_used_at/.test(sql)).length;

    const first = await call(db, gov, 'get_tea', { id: 'red', source: 'product' });
    const second = await call(db, gov, 'get_tea', { id: 'red', source: 'product' });
    expect(first.isError).toBe(false);
    expect(second.isError).toBe(false);
    expect(touches(first.log)).toBe(1);
    expect(touches(second.log)).toBe(0);
    expect(second.statements).toBe(first.statements - 1);
  });

  it('sweeps expired confirmation tickets at most once every few minutes', async () => {
    const { db } = await shop();
    const gov = governor(OWNER_GRANT);
    const sweeps = (log: string[]) => log.filter(sql => /DELETE FROM mcp_confirmation_tickets/.test(sql)).length;

    const one = await call(db, gov, 'curate_add_tea', tea);
    const two = await call(db, gov, 'curate_add_tea', { ...tea, name: 'Second oolong' });
    expect(typeof one.out.confirmation_token).toBe('string');
    expect(typeof two.out.confirmation_token).toBe('string');
    expect(sweeps(one.log)).toBeLessThanOrEqual(1);
    expect(sweeps(two.log)).toBe(0);
  });

  it('counts a last-used time as fresh for five minutes, in the form SQLite writes it', () => {
    const now = Date.parse('2026-11-27T02:00:00Z');
    expect(tokenUseIsStale(null, now)).toBe(true);
    expect(tokenUseIsStale('2026-11-27 01:58:00', now)).toBe(false);
    expect(tokenUseIsStale('2026-11-27 01:55:00', now)).toBe(true);
    expect(tokenUseIsStale('2026-11-27T01:59:30.000Z', now)).toBe(false);
    expect(tokenUseIsStale('not a time', now)).toBe(true);
  });
});
