import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const JWT_SECRET = 'test-secret';
const ACCOUNT_ID = 'acc_one';

function b64(value: string) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

async function token() {
  const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64(JSON.stringify({
    sub: 'owner_one', email: 'owner@example.com', active_account_id: ACCOUNT_ID,
    iat: now, exp: now + 3600,
  }));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

type ContributorRow = Record<string, any>;

class Statement {
  values: any[] = [];
  constructor(readonly db: FakeDb, readonly sql: string) {}
  bind(...values: any[]) { this.values = values; return this; }
  async first() { return this.db.first(this.sql, this.values); }
  async all() { return this.db.all(this.sql, this.values); }
  async run() { return this.db.run(this.sql, this.values); }
}

class FakeDb {
  role: 'owner' | 'staff' = 'owner';
  failBatchAt: number | null = null;
  batchCalls = 0;
  accounts = new Map<string, { id: string; host_contributor_id: string | null; status: string }>([
    [ACCOUNT_ID, { id: ACCOUNT_ID, host_contributor_id: null, status: 'active' }],
    ['acc_other', { id: 'acc_other', host_contributor_id: null, status: 'active' }],
  ]);
  contributors = new Map<string, ContributorRow>([
    ['other-writer', { id: 'other-writer', account_id: 'acc_other', display_name: 'Other Writer', beginnings: 'Elsewhere.', links: '[]', is_published: 0, face_of_account_id: null }],
  ]);
  prepare(sql: string) { return new Statement(this, sql); }
  async batch(statements: Statement[]) {
    this.batchCalls += 1;
    const accountSnapshot = structuredClone([...this.accounts]);
    const contributorSnapshot = structuredClone([...this.contributors]);
    try {
      const results = [];
      for (let index = 0; index < statements.length; index += 1) {
        if (this.failBatchAt === index) throw new Error('simulated atomic batch failure');
        results.push(await statements[index].run());
      }
      return results;
    }
    catch (error) {
      this.accounts = new Map(accountSnapshot);
      this.contributors = new Map(contributorSnapshot);
      throw error;
    }
  }
  normalized(sql: string) { return sql.replace(/\s+/g, ' ').trim().toLowerCase(); }
  async first(sqlText: string, values: any[]) {
    const sql = this.normalized(sqlText);
    if (sql.includes('select platform_role from users where id = ?')) return { platform_role: null };
    if (sql.includes('select status from accounts where id = ?')) return { status: this.accounts.get(values[0])?.status ?? null };
    if (sql.includes('from account_members am join accounts a')) return { role: this.role, permissions: '{"bundles":[]}', kind: 'location', status: 'active' };
    if (sql.includes('from contributors where id = ? and account_id = ?')) {
      const row = this.contributors.get(values[0]);
      return row?.account_id === values[1] ? structuredClone(row) : null;
    }
    if (sql.includes('from contributors where id = ?')) return structuredClone(this.contributors.get(values[0]) ?? null);
    if (sql.includes('from accounts where id = ?')) return structuredClone(this.accounts.get(values[0]) ?? null);
    return null;
  }
  async all(sqlText: string, values: any[]) {
    const sql = this.normalized(sqlText);
    if (sql.includes('from contributors co') && sql.includes('where co.account_id = ?')) {
      return { results: [...this.contributors.values()].filter(row => row.account_id === values[0]).map(structuredClone) };
    }
    return { results: [] };
  }
  async run(sqlText: string, values: any[]) {
    const sql = this.normalized(sqlText);
    if (sql.startsWith('insert into contributors')) {
      const columns = sqlText.slice(sqlText.indexOf('(') + 1, sqlText.indexOf(')')).split(',').map(value => value.trim());
      const row = Object.fromEntries(columns.map((column, index) => [column, values[index]]));
      row.is_published = 0; row.face_of_account_id ??= null;
      this.contributors.set(row.id, row);
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith('update contributors set')) {
      if (sql.includes('where face_of_account_id = ?') && sql.includes('face_of_account_id = null')) {
        for (const row of this.contributors.values()) if (row.face_of_account_id === values[0] && row.account_id === values[1] && row.id !== values[2]) row.face_of_account_id = null;
      } else if (sql.includes('face_of_account_id = ?')) {
        const row = this.contributors.get(values[1]); if (row?.account_id === values[2]) row.face_of_account_id = values[0];
      } else {
        const id = values.at(-2); const accountId = values.at(-1); const row = this.contributors.get(id);
        if (row?.account_id === accountId) {
          const set = sqlText.match(/set([\s\S]*?)where/i)?.[1] ?? '';
          const columns = [...set.matchAll(/([a-z_]+)\s*=\s*\?/gi)].map(match => match[1]);
          columns.forEach((column, index) => { row[column] = values[index]; });
        }
      }
      return { success: true, meta: { changes: 1 } };
    }
    if (sql.startsWith('update accounts set host_contributor_id')) {
      if (sql.includes('host_contributor_id = null')) {
        const account = this.accounts.get(values[0]); if (account && (!values[1] || account.host_contributor_id === values[1])) account.host_contributor_id = null;
      } else {
        const account = this.accounts.get(values[1]); if (account) account.host_contributor_id = values[0];
      }
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 1 } };
  }
}

async function request(db: FakeDb, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${await token()}`);
  headers.set('X-Teajia-Account', ACCOUNT_ID);
  if (init.body) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, { ...init, headers }), { JWT_SECRET, DB: db } as any);
}

describe('account-safe contributor administration', () => {
  it('keeps contributor administration owner-tier only', async () => {
    const db = new FakeDb(); db.role = 'staff';
    expect((await request(db, '/api/admin/contributors')).status).toBe(403);
    expect((await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'writer', display_name: 'Writer' }) })).status).toBe(403);
  });
  it('creates a draft contributor in the authenticated account and ignores ownership fields', async () => {
    const db = new FakeDb();
    const response = await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'new-writer', display_name: ' New Writer ', account_id: 'acc_other', is_published: 1, created_at: 'forged' }) });
    expect(response.status).toBe(201);
    expect(db.contributors.get('new-writer')).toMatchObject({ account_id: ACCOUNT_ID, display_name: 'New Writer', is_published: 0 });
  });

  it('rejects a slug used by another account without exposing that row', async () => {
    const response = await request(new FakeDb(), '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'other-writer', display_name: 'Duplicate' }) });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Contributor slug is unavailable' });
  });

  it('rejects contributor slugs outside lowercase kebab-case', async () => {
    const response = await request(new FakeDb(), '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'Not A Slug', display_name: 'Invalid' }) });
    expect(response.status).toBe(400);
  });

  it('denies contributor reads across accounts', async () => {
    const response = await request(new FakeDb(), '/api/admin/contributors/other-writer');
    expect(response.status).toBe(404);
  });

  it('denies contributor updates across accounts', async () => {
    const db = new FakeDb();
    const response = await request(db, '/api/admin/contributors/other-writer', { method: 'PUT', body: JSON.stringify({ display_name: 'Leaked edit' }) });
    expect(response.status).toBe(404);
    expect(db.contributors.get('other-writer')?.display_name).toBe('Other Writer');
  });

  it('normalizes links and enforces https URLs and the closing limit', async () => {
    const db = new FakeDb();
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'writer', display_name: 'Writer' }) });
    const updated = await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ links: [{ label: ' Site ', url: 'https://example.com' }] }) });
    expect(updated.status).toBe(200);
    expect(db.contributors.get('writer')?.links).toBe('[{"label":"Site","url":"https://example.com/"}]');
    expect((await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ links: [{ label: 'Bad', url: 'http://example.com' }] }) })).status).toBe(400);
    expect((await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ closing: 'x'.repeat(201) }) })).status).toBe(400);
  });

  it('rejects publication until beginnings is nonblank, then publishes and unpublishes', async () => {
    const db = new FakeDb();
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'writer', display_name: 'Writer' }) });
    expect((await request(db, '/api/admin/contributors/writer/publish', { method: 'POST' })).status).toBe(400);
    await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ beginnings: ' An origin. ' }) });
    expect((await request(db, '/api/admin/contributors/writer/publish', { method: 'POST' })).status).toBe(200);
    expect(db.contributors.get('writer')?.is_published).toBe(1);
    expect((await request(db, '/api/admin/contributors/writer/unpublish', { method: 'POST' })).status).toBe(200);
    expect(db.contributors.get('writer')?.is_published).toBe(0);
  });

  it('sets, reassigns, and clears both host mirrors without stale links', async () => {
    const db = new FakeDb();
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'first-host', display_name: 'First' }) });
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'second-host', display_name: 'Second' }) });
    expect((await request(db, '/api/admin/contributors/first-host', { method: 'PUT', body: JSON.stringify({ face_of_account_id: ACCOUNT_ID }) })).status).toBe(200);
    expect(db.accounts.get(ACCOUNT_ID)?.host_contributor_id).toBe('first-host');
    expect(db.contributors.get('first-host')?.face_of_account_id).toBe(ACCOUNT_ID);

    expect((await request(db, '/api/admin/contributors/second-host', { method: 'PUT', body: JSON.stringify({ face_of_account_id: ACCOUNT_ID }) })).status).toBe(200);
    expect(db.accounts.get(ACCOUNT_ID)?.host_contributor_id).toBe('second-host');
    expect(db.contributors.get('first-host')?.face_of_account_id).toBeNull();
    expect(db.contributors.get('second-host')?.face_of_account_id).toBe(ACCOUNT_ID);

    expect((await request(db, '/api/admin/contributors/second-host', { method: 'PUT', body: JSON.stringify({ face_of_account_id: null }) })).status).toBe(200);
    expect(db.accounts.get(ACCOUNT_ID)?.host_contributor_id).toBeNull();
    expect(db.contributors.get('second-host')?.face_of_account_id).toBeNull();
  });

  it('rejects a host account outside the authenticated boundary', async () => {
    const db = new FakeDb();
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'writer', display_name: 'Writer' }) });
    const response = await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ face_of_account_id: 'acc_other' }) });
    expect(response.status).toBe(404);
    expect(db.contributors.get('writer')?.face_of_account_id).toBeNull();
    expect(db.accounts.get('acc_other')?.host_contributor_id).toBeNull();
  });

  it('keeps both host mirrors unchanged when the atomic batch fails', async () => {
    const db = new FakeDb();
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'writer', display_name: 'Writer' }) });
    db.failBatchAt = 2;
    const response = await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ face_of_account_id: ACCOUNT_ID }) });
    expect(response.status).toBe(500);
    expect(db.batchCalls).toBe(1);
    expect(db.accounts.get(ACCOUNT_ID)?.host_contributor_id).toBeNull();
    expect(db.contributors.get('writer')?.face_of_account_id).toBeNull();
  });
});
