import worker from '../../src/index';

const JWT_SECRET = 'test-secret';

export type CompassRow = Record<string, unknown> & {
  id: string;
  account_id: string;
  user_id: string;
};

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

class FakeStatement {
  values: unknown[] = [];

  constructor(readonly sql: string, private readonly db: FakeDb) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first() {
    const sql = normalizeSql(this.sql);
    if (sql.includes('from account_members am join accounts a on a.id = am.account_id')) {
      return { role: 'owner', permissions: '{}', kind: 'location', status: 'active' };
    }
    if (sql.includes('select platform_role from users where id = ?')) return { platform_role: null };
    if (sql.includes('select id, email, platform_role from users where id = ?')) {
      return { id: this.values[0], email: `${this.values[0]}@example.com`, platform_role: null };
    }
    if (sql.includes('select status from accounts where id = ?')) return { status: 'active' };
    if (sql.includes('from tea_compass_entries where id = ?')) {
      const [id, ...scope] = this.values;
      const row = this.db.rows.get(String(id));
      if (!row) return null;
      if (sql.includes('user_id = ?') && row.user_id !== scope[0]) return null;
      const accountValue = sql.includes('user_id = ?') ? scope[1] : scope[0];
      if (sql.includes('account_id = ?') && row.account_id !== accountValue) return null;
      return { ...row };
    }
    for (const [table, rows] of [['curate_journeys', this.db.journeys], ['curate_visits', this.db.visits]] as const) {
      if (sql.includes(`from ${table} where id = ?`)) {
        const row = rows.get(String(this.values[0]));
        return row && row.account_id === this.values[1] ? { ...row } : null;
      }
    }
    if (sql.includes('from customers where id = ? and account_id = ?')) {
      const row = this.db.customers.get(String(this.values[0]));
      return row && row.account_id === this.values[1] ? { ...row } : null;
    }
    return null;
  }

  async all() {
    const sql = normalizeSql(this.sql);
    if (sql.includes('from tea_compass_entries where user_id = ? and account_id = ?')) {
      const [userId, accountId] = this.values;
      return {
        results: [...this.db.rows.values()]
          .filter(row => row.user_id === userId && row.account_id === accountId)
          .map(row => ({ ...row })),
      };
    }
    if (sql.includes('from curate_journeys where account_id = ?')) {
      return { results: [...this.db.journeys.values()].filter(row => row.account_id === this.values[0]).map(row => ({ ...row })) };
    }
    if (sql.includes('from curate_visits where account_id = ?')) {
      return { results: [...this.db.visits.values()].filter(row => row.account_id === this.values[0] && (!sql.includes('journey_id = ?') || row.journey_id === this.values[1])).map(row => ({ ...row })) };
    }
    return { results: [] };
  }

  async run() {
    const sql = normalizeSql(this.sql);
    for (const [table, rows] of [['curate_journeys', this.db.journeys], ['curate_visits', this.db.visits]] as const) {
      if (sql.startsWith(`insert into ${table}`)) {
        const columnMatch = this.sql.match(new RegExp(`${table}\\s*\\(([^)]+)\\)`, 'i'))!;
        const columns = columnMatch[1].split(',').map(column => column.trim());
        const row = { ...(table === 'curate_visits' ? { journey_id: null } : {}), ...Object.fromEntries(columns.map((column, index) => [column, this.values[index]])) };
        rows.set(String(row.id), row);
        return { success: true, meta: { changes: 1 } };
      }
      if (sql.startsWith(`update ${table} set`)) {
        const id = String(this.values.at(-2));
        const accountId = this.values.at(-1);
        const row = rows.get(id);
        if (!row || row.account_id !== accountId) return { success: true, meta: { changes: 0 } };
        const setClause = this.sql.match(/set\s+(.+?)\s+where/is)?.[1] ?? '';
        const columns = [...setClause.matchAll(/(?:^|,)\s*([a-z_]+)\s*=\s*\?/gi)].map(match => match[1]);
        columns.forEach((column, index) => { row[column] = this.values[index]; });
        rows.set(id, row);
        return { success: true, meta: { changes: 1 } };
      }
      if (sql.startsWith(`delete from ${table}`)) {
        const row = rows.get(String(this.values[0]));
        const changed = !!row && row.account_id === this.values[1];
        if (changed) rows.delete(String(this.values[0]));
        return { success: true, meta: { changes: changed ? 1 : 0 } };
      }
    }
    if (sql.startsWith('insert into tea_compass_entries')) {
      const columnMatch = this.sql.match(/tea_compass_entries\s*\(([^)]+)\)/i);
      if (!columnMatch) throw new Error(`Missing INSERT columns: ${this.sql}`);
      const columns = columnMatch[1].split(',').map(column => column.trim());
      const incoming = Object.fromEntries(columns.map((column, index) => [column, this.values[index]])) as CompassRow;
      const current = this.db.rows.get(String(incoming.id));
      if (
        current
        && sql.includes('where tea_compass_entries.user_id = excluded.user_id')
        && (current.user_id !== incoming.user_id || current.account_id !== incoming.account_id)
      ) {
        return { success: true, meta: { changes: 0 } };
      }
      if (!current) {
        this.db.rows.set(String(incoming.id), incoming);
        return { success: true, meta: { changes: 1 } };
      }
      const updateClause = this.sql.match(/do\s+update\s+set\s+(.+?)\s+where/is)?.[1] ?? '';
      const updated = { ...current };
      for (const match of updateClause.matchAll(/(?:^|,)\s*([a-z_]+)\s*=\s*excluded\.([a-z_]+)/gi)) {
        updated[match[1]] = incoming[match[2]];
      }
      this.db.rows.set(String(incoming.id), updated);
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith('update tea_compass_entries set')) {
      const hasUserScope = sql.includes('user_id = ?');
      const idIndex = hasUserScope ? -3 : -2;
      const id = String(this.values.at(idIndex));
      const userId = hasUserScope ? this.values.at(-2) : undefined;
      const accountId = this.values.at(-1);
      const scoped = this.db.rows.get(id);
      if (!scoped || scoped.account_id !== accountId || (hasUserScope && scoped.user_id !== userId)) {
        return { success: true, meta: { changes: 0 } };
      }
      const setClause = this.sql.match(/set\s+(.+?)\s+where/is)?.[1] ?? '';
      const columns = [...setClause.matchAll(/(?:^|,)\s*([a-z_]+)\s*=\s*\?/gi)].map(match => match[1]);
      columns.forEach((column, index) => { scoped[column] = this.values[index]; });
      this.db.rows.set(id, scoped);
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 1 } };
  }
}

export class FakeDb {
  rows = new Map<string, CompassRow>();
  journeys = new Map<string, Record<string, unknown>>();
  visits = new Map<string, Record<string, unknown>>();
  customers = new Map<string, Record<string, unknown>>();

  prepare(sql: string) {
    return new FakeStatement(sql, this);
  }

  async batch(statements: FakeStatement[]) {
    const snapshot = new Map(
      [...this.rows].map(([id, row]) => [id, { ...row }]),
    );
    try {
      // D1 batch results are positional and the batch is transactional. Keep
      // both properties in the harness because sync acknowledgements depend on
      // each statement's corresponding meta.changes value.
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      return results;
    } catch (error) {
      this.rows = snapshot;
      throw error;
    }
  }
}

function base64Url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function tokenFor(userId: string, accountId: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    sub: userId,
    email: `${userId}@example.com`,
    active_account_id: accountId,
    iat: now,
    exp: now + 3600,
  }));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${base64Url(new Uint8Array(signature))}`;
}

export async function compassRequest(
  db: FakeDb,
  path: string,
  options: RequestInit & { accountId?: string; userId?: string } = {},
) {
  const accountId = options.accountId ?? 'account-a';
  const userId = options.userId ?? 'user-a';
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${await tokenFor(userId, accountId)}`);
  headers.set('X-Teajia-Account', accountId);
  if (options.body) headers.set('Content-Type', 'application/json');
  const request = new Request(`https://worker.test${path}`, { ...options, headers });
  return worker.fetch(request, { DB: db, JWT_SECRET } as any);
}
