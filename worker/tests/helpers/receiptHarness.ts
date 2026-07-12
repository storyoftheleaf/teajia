import worker from '../../src/index';

const JWT_SECRET = 'test-secret';
const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();
type Row = Record<string, any>;

class ReceiptStatement {
  values: unknown[] = [];
  constructor(readonly sql: string, private db: ReceiptDb) {}
  bind(...values: unknown[]) { this.values = values; return this; }

  async first() {
    const sql = norm(this.sql);
    if (sql.includes('from account_members am join accounts a on a.id = am.account_id')) return { role: 'owner', permissions: '{}', kind: 'location', status: 'active' };
    if (sql.includes('select platform_role from users where id = ?')) return { platform_role: null };
    if (sql.includes('select id, email, platform_role from users where id = ?')) return { id: this.values[0], email: `${this.values[0]}@example.com`, platform_role: null };
    if (sql.includes('select status from accounts where id = ?')) return { status: 'active' };
    if (sql.includes('from tea_compass_entries where id = ?')) return scoped(this.db.entries, this.values[0], sql, this.values);
    if (sql.includes('from curate_receipt_proposals where account_id = ? and idempotency_key = ?')) {
      return [...this.db.proposals.values()].find(row => row.account_id === this.values[0] && row.idempotency_key === this.values[1]) ?? null;
    }
    if (sql.includes('from curate_receipt_proposals where id = ? and account_id = ?')) return scoped(this.db.proposals, this.values[0], sql, this.values);
    if (sql.includes('from products where id = ? and account_id = ?')) return scoped(this.db.products, this.values[0], sql, this.values);
    if (sql.includes('from batches where id = ? and account_id = ?')) return scoped(this.db.batches, this.values[0], sql, this.values);
    if (sql.includes('from curate_import_items where id = ? and account_id = ?')) return scoped(this.db.importItems, this.values[0], sql, this.values);
    if (sql.includes('from curate_import_batches where id = ? and account_id = ?')) return scoped(this.db.imports, this.values[0], sql, this.values);
    if (sql.startsWith('update products set') && sql.includes('returning stock_grams')) {
      const result = await this.run();
      return (result as any).meta.changes ? { stock_grams: this.values[0] } : null;
    }
    return null;
  }
  async all() { return { results: [] }; }
  async run() {
    const sql = norm(this.sql);
    if (sql.startsWith('insert into curate_receipt_proposals')) return insertColumns(this.db.proposals, this.sql, this.values);
    if (sql.startsWith('insert into products')) return insertColumns(this.db.products, this.sql, this.values);
    if (sql.startsWith('insert into tea_profiles')) return insertColumns(this.db.profiles, this.sql, this.values);
    if (sql.startsWith('insert into product_listings')) return insertColumns(this.db.listings, this.sql, this.values);
    if (sql.startsWith('insert into stock_ledger')) return insertColumns(this.db.ledger, this.sql, this.values);
    if (sql.startsWith('update curate_receipt_proposals set')) return updateRow(this.db.proposals, this.sql, this.values);
    if (sql.startsWith('update products set')) return updateRow(this.db.products, this.sql, this.values);
    if (sql.startsWith('update product_listings set')) {
      if (sql.includes('where legacy_product_id = ?')) return updateByLegacy(this.db.listings, this.sql, this.values);
      return updateRow(this.db.listings, this.sql, this.values);
    }
    if (sql.startsWith('update tea_compass_entries set')) return updateRow(this.db.entries, this.sql, this.values);
    return { success: true, meta: { changes: 1 } };
  }
}

function scoped(map: Map<string, Row>, id: unknown, sql: string, values: unknown[]) {
  const row = map.get(String(id));
  if (!row) return null;
  const accountIndex = 1;
  if (sql.includes('account_id = ?') && row.account_id !== values[accountIndex]) return null;
  if (sql.includes('user_id = ?') && row.user_id !== values[2]) return null;
  return { ...row };
}

function insertColumns(target: Map<string, Row> | Row[], sql: string, values: unknown[]) {
  const table = norm(sql).match(/^insert into ([a-z_]+)/)![1];
  const match = sql.match(new RegExp(`${table}\\s*\\(([^)]+)\\)`, 'i'))!;
  const columns = match[1].split(',').map(v => v.trim());
  const valueMatch = sql.match(/values\s*\((.+)\)/is);
  const tokens = valueMatch ? valueMatch[1].split(',').map(value => value.trim()) : columns.map(() => '?');
  let bind = 0;
  const row = Object.fromEntries(columns.map((column, index) => {
    const token = tokens[index] ?? '?';
    if (token === '?') return [column, values[bind++]];
    if (/^'.*'$/.test(token)) return [column, token.slice(1, -1)];
    if (/^-?\d+(?:\.\d+)?$/.test(token)) return [column, Number(token)];
    return [column, null];
  }));
  if (table === 'curate_receipt_proposals') Object.assign(row, { status: 'pending', ledger_id: null, reviewed_by_user_id: null, reviewed_at: null });
  if (table === 'curate_receipt_proposals' && [...(target as Map<string, Row>).values()].some(existing => existing.account_id === row.account_id && existing.idempotency_key === row.idempotency_key)) throw new Error('UNIQUE account idempotency');
  if (table === 'stock_ledger' && (target as Row[]).some(existing => existing.receipt_proposal_id === row.receipt_proposal_id)) throw new Error('UNIQUE receipt ledger');
  if (target instanceof Map) target.set(String(row.id), row); else target.push(row);
  return { success: true, meta: { changes: 1 } };
}

function updateRow(target: Map<string, Row>, sql: string, values: unknown[]) {
  const normalized = norm(sql);
  const guarded = /where id = \? and account_id = \? and stock_grams = \?/.test(normalized);
  const accountScoped = normalized.includes('where id = ? and account_id = ?');
  const id = String(values.at(guarded ? -3 : accountScoped ? -2 : -1));
  const accountId = accountScoped ? values.at(guarded ? -2 : -1) : undefined;
  const row = target.get(id);
  if (!row || (accountScoped && row.account_id !== accountId) || (guarded && row.stock_grams !== values.at(-1)) || (normalized.includes("status = 'pending'") && row.status !== 'pending')) return { success: true, meta: { changes: 0 } };
  const set = sql.match(/set\s+(.+?)\s+where/is)?.[1] ?? '';
  let bind = 0;
  for (const part of set.split(',')) {
    const column = part.trim().match(/^([a-z_]+)/i)?.[1]; if (!column) continue;
    if (part.includes('?')) row[column] = values[bind++];
    else if (/status\s*=\s*'accepted'/i.test(part)) row.status = 'accepted';
    else if (/status\s*=\s*'rejected'/i.test(part)) row.status = 'rejected';
  }
  return { success: true, meta: { changes: 1 } };
}

function updateByLegacy(target: Map<string, Row>, sql: string, values: unknown[]) {
  const productId = values.at(-2); const accountId = values.at(-1);
  const row = [...target.values()].find(value => value.legacy_product_id === productId && value.account_id === accountId);
  if (!row) return { success: true, meta: { changes: 0 } };
  const columns = [...(sql.match(/set\s+(.+?)\s+where/is)?.[1] ?? '').matchAll(/(?:^|,)\s*([a-z_]+)\s*=\s*\?/gi)].map(m => m[1]);
  columns.forEach((column, index) => { row[column] = values[index]; });
  return { success: true, meta: { changes: 1 } };
}

export class ReceiptDb {
  entries = new Map<string, Row>(); proposals = new Map<string, Row>(); products = new Map<string, Row>();
  profiles = new Map<string, Row>(); listings = new Map<string, Row>(); ledger: Row[] = [];
  batches = new Map<string, Row>(); imports = new Map<string, Row>(); importItems = new Map<string, Row>();
  failBatchAt: number | null = null;
  static seeded() {
    const db = new ReceiptDb();
    for (const [id, category, type] of [['entry-a', 'tea', 'Oolong'], ['entry-work', 'tea', 'Red'], ['entry-pot', 'teaware', null]] as const) db.entries.set(id, { id, account_id: 'account-a', user_id: 'user-a', name: id, category, type, draft_product_id: null, import_item_id: null });
    db.products.set('product-b', { id: 'product-b', account_id: 'account-b' });
    db.batches.set('batch-a', { id: 'batch-a', account_id: 'account-a' }); db.batches.set('batch-b', { id: 'batch-b', account_id: 'account-b' });
    return db;
  }
  prepare(sql: string) { return new ReceiptStatement(sql, this); }
  async batch(statements: ReceiptStatement[]) {
    const snapshot = structuredClone({ entries: [...this.entries], proposals: [...this.proposals], products: [...this.products], profiles: [...this.profiles], listings: [...this.listings], ledger: this.ledger });
    try {
      const results = [];
      for (let i = 0; i < statements.length; i++) { if (this.failBatchAt === i) throw new Error('Injected D1 batch failure'); results.push(await statements[i].run()); }
      return results;
    } catch (error) {
      this.entries = new Map(snapshot.entries); this.proposals = new Map(snapshot.proposals); this.products = new Map(snapshot.products); this.profiles = new Map(snapshot.profiles); this.listings = new Map(snapshot.listings); this.ledger = snapshot.ledger;
      throw error;
    }
  }
}

function b64(input: string | Uint8Array) { const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input; let out = ''; for (const byte of bytes) out += String.fromCharCode(byte); return btoa(out); }
async function token(userId: string, accountId: string) { const now = Math.floor(Date.now() / 1000); const data = `${b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64(JSON.stringify({ sub: userId, email: `${userId}@example.com`, active_account_id: accountId, iat: now, exp: now + 3600 }))}`; const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return `${data}.${b64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))))}`; }
export async function receiptRequest(db: ReceiptDb, path: string, options: RequestInit & { accountId?: string } = {}) { const accountId = options.accountId ?? 'account-a'; const headers = new Headers(options.headers); headers.set('Authorization', `Bearer ${await token('user-a', accountId)}`); headers.set('X-Teajia-Account', accountId); if (options.body) headers.set('Content-Type', 'application/json'); return worker.fetch(new Request(`https://worker.test${path}`, { ...options, headers }), { DB: db, JWT_SECRET } as any); }
