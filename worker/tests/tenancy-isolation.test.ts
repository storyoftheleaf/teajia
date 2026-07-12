import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'tenancy-secret';
type Row = { id: string; account_id: string; [key: string]: unknown };

const tables: Record<string, Row[]> = {
  customers: [{ id: 'customer-a', account_id: 'acct-a', name: 'A' }, { id: 'customer-b', account_id: 'acct-b', name: 'B' }],
  events: [{ id: 'event-a', account_id: 'acct-a', title: 'A' }, { id: 'event-b', account_id: 'acct-b', title: 'B' }],
  invoices: [{ id: 'invoice-a', account_id: 'acct-a', status: 'Pending' }, { id: 'invoice-b', account_id: 'acct-b', status: 'Pending' }],
  invoice_line_items: [{ id: 'line-a', account_id: 'acct-a', invoice_id: 'invoice-a' }, { id: 'line-b', account_id: 'acct-b', invoice_id: 'invoice-b' }],
  products: [{ id: 'product-a', account_id: 'acct-a', stock_grams: 10 }, { id: 'product-b', account_id: 'acct-b', stock_grams: 10 }],
  curate_journeys: [{ id: 'journey-a', account_id: 'acct-a', name: 'A' }, { id: 'journey-b', account_id: 'acct-b', name: 'B' }],
  curate_visits: [{ id: 'visit-a', account_id: 'acct-a', notes: 'A' }, { id: 'visit-b', account_id: 'acct-b', notes: 'B' }],
  tea_compass_entries: [{ id: 'entry-a', account_id: 'acct-a', user_id: 'member-a', notes: 'A' }, { id: 'entry-b', account_id: 'acct-b', user_id: 'member-b', notes: 'B' }],
};

class Statement {
  values: unknown[] = [];
  constructor(readonly sql: string, private db: TenantDb) {}
  bind(...values: unknown[]) { this.values = values; return this; }
  normalized() { return this.sql.replace(/\s+/g, ' ').trim().toLowerCase(); }
  table() { return Object.keys(this.db.rows).find(name => this.normalized().includes(`from ${name}`) || this.normalized().startsWith(`update ${name}`)) || null; }
  scoped(rows: Row[]) {
    const sql = this.normalized();
    if (!sql.includes('account_id')) return rows;
    const account = this.values.find(value => value === 'acct-a' || value === 'acct-b');
    return account ? rows.filter(row => row.account_id === account) : rows;
  }
  async first() {
    const sql = this.normalized();
    if (sql === 'select platform_role from users where id = ?') return { platform_role: this.db.platformRoles[String(this.values[0])] ?? null };
    if (sql.includes('from account_members am') && sql.includes('join accounts')) {
      const [userId, accountId] = this.values;
      return this.db.memberships[`${userId}:${accountId}`] ? { role: 'owner', permissions: '{}', kind: 'location' } : null;
    }
    if (sql.includes('select status from accounts where id = ?')) return { status: 'active' };
    const table = this.table();
    if (!table) return null;
    let rows = this.scoped(this.db.rows[table]);
    const requestedId = this.values.find(value => typeof value === 'string' && /^(customer|event|invoice|product|journey|visit|entry)-/.test(value));
    if (requestedId) rows = rows.filter(row => row.id === requestedId || row.invoice_id === requestedId);
    if (sql.includes('user_id = ?')) rows = rows.filter(row => row.user_id === this.values.find(value => String(value).startsWith('member-')));
    return rows[0] ? { ...rows[0] } : null;
  }
  async all() {
    const table = this.table();
    if (!table) return { results: [] };
    let rows = this.scoped(this.db.rows[table]);
    if (this.normalized().includes('invoice_id = ?')) rows = rows.filter(row => row.invoice_id === this.values[0]);
    if (this.normalized().includes('user_id = ?')) rows = rows.filter(row => row.user_id === this.values[0]);
    return { results: rows.map(row => ({ ...row })) };
  }
  async run() {
    const table = this.table();
    if (!table || !this.normalized().startsWith('update')) return { success: true, meta: { changes: 0 } };
    const id = this.values.find(value => typeof value === 'string' && /^(customer|event|invoice|product|journey|visit|entry)-/.test(value));
    const account = this.values.find(value => value === 'acct-a' || value === 'acct-b');
    const row = this.db.rows[table].find(candidate => candidate.id === id && (!this.normalized().includes('account_id') || candidate.account_id === account));
    if (!row) return { success: true, meta: { changes: 0 } };
    row.mutated = true;
    return { success: true, meta: { changes: 1 } };
  }
}

class TenantDb {
  rows = Object.fromEntries(Object.entries(tables).map(([name, rows]) => [name, rows.map(row => ({ ...row }))])) as Record<string, Row[]>;
  memberships: Record<string, boolean> = { 'member-a:acct-a': true, 'member-b:acct-b': true };
  platformRoles: Record<string, string | null> = { 'member-a': null, 'member-b': null, platform: 'platform_owner' };
  prepare(sql: string) { return new Statement(sql, this); }
  async batch(statements: Statement[]) {
    const results = [];
    for (const statement of statements) results.push(statement.normalized().startsWith('select') ? await statement.all() : await statement.run());
    return results;
  }
}

function b64(value: string | Uint8Array) { const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value; return btoa(String.fromCharCode(...bytes)); }
async function token(userId: string) { const now = Math.floor(Date.now() / 1000); const data = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: userId === 'member-b' ? 'acct-b' : 'acct-a', iat: now, exp: now + 60 }))}`; const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return `${data}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))))}`; }
async function call(db: TenantDb, userId: string, accountId: string, path: string, method = 'GET', body?: unknown) { const response = await worker.fetch(new Request(`https://worker.test${path}`, { method, headers: { Authorization: `Bearer ${await token(userId)}`, 'X-Teajia-Account': accountId, 'Content-Type': 'application/json' }, body: body == null ? undefined : JSON.stringify(body) }), { DB: db, JWT_SECRET } as any); return response; }
function ids(value: unknown): string[] { if (Array.isArray(value)) return value.flatMap(ids); if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, nested]) => key === 'id' && typeof nested === 'string' ? [nested] : ids(nested)); return []; }

const cases = [
  ['customers', '/api/customers', '/api/customers/customer-b', 'PUT', { name: 'changed' }],
  ['events', '/api/admin/events', '/api/admin/events/event-b', 'PUT', { title: 'changed' }],
  ['invoices', '/api/invoices', '/api/invoices/invoice-b/items', 'GET', undefined],
  ['inventory', '/api/products', '/api/products/product-b/stock', 'PUT', { stock_grams: 999 }],
  ['curate journeys', '/api/curate/journeys', '/api/curate/journeys/journey-b', 'PUT', { name: 'changed' }],
  ['curate visits', '/api/curate/visits', '/api/curate/visits/visit-b', 'PUT', { notes: 'changed' }],
  ['curate records', '/api/compass/entries', '/api/compass/entries/entry-b', 'PUT', { notes: 'changed' }],
] as const;

describe('cross-account resource isolation', () => {
  it('denies selecting an account without membership', async () => { const response = await call(new TenantDb(), 'member-a', 'acct-b', '/api/customers'); expect(response.status).toBe(403); expect(await response.json()).toMatchObject({ error: 'Account access denied' }); });

  it.each(cases)('scopes %s lists and direct access', async (_label, listPath, directPath, method, body) => {
    const db = new TenantDb(); const before = JSON.stringify(db.rows);
    const list = await call(db, 'member-a', 'acct-a', listPath); expect(list.status).toBe(200); expect(ids(await list.json())).not.toContain(expect.stringMatching(/-b$/));
    const direct = await call(db, 'member-a', 'acct-a', directPath, method, body); expect([403, 404]).toContain(direct.status);
    expect(JSON.stringify(db.rows)).toBe(before);
  });

  it('uses database platform role for the platform exception', async () => {
    const db = new TenantDb();
    expect((await call(db, 'member-a', 'acct-b', '/api/customers')).status).toBe(403);
    const response = await call(db, 'platform', 'acct-b', '/api/customers'); expect(response.status).toBe(200); expect(ids(await response.json())).toContain('customer-b');
  });

  it('blocks cross-account fulfillment and stock side effects', async () => {
    const db = new TenantDb(); const before = JSON.stringify(db.rows);
    const fulfill = await call(db, 'member-a', 'acct-a', '/api/rpc/fulfill-invoice', 'POST', { invoice_id: 'invoice-b' });
    const stock = await call(db, 'member-a', 'acct-a', '/api/products/product-b/stock', 'PUT', { stock_grams: 999 });
    expect(fulfill.status).toBe(404);
    expect(stock.status).toBe(404);
    expect(JSON.stringify(db.rows)).toBe(before);
  });
});
