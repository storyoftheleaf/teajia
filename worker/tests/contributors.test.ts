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
  failWith: Error | null = null;
  users = new Map([['user_one', { id: 'user_one', account_id: ACCOUNT_ID }], ['user_other', { id: 'user_other', account_id: 'acc_other' }]]);
  products = new Map([['tea_one', { id: 'tea_one', account_id: ACCOUNT_ID }], ['tea_other', { id: 'tea_other', account_id: 'acc_other' }]]);
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
        if (this.failWith) throw this.failWith;
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
    if (sql.includes('from account_members') && sql.includes('user_id = ?') && sql.includes('account_id = ?')) {
      const user = this.users.get(values[0]); return user?.account_id === values[1] ? { user_id: user.id } : null;
    }
    if (sql.includes('from products where id = ? and account_id = ?')) {
      const product = this.products.get(values[0]); return product?.account_id === values[1] ? { id: product.id } : null;
    }
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

  // Lane A retyped contributors.links from a flat {label,url} pair to a
  // platform-typed link (worker/src/profileDomain.ts's normalizeContributorLinks,
  // migration 0021); this test now writes and reads that shape.
  it('normalizes links and enforces https URLs and the closing limit', async () => {
    const db = new FakeDb();
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'writer', display_name: 'Writer' }) });
    const updated = await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ links: [{ platform: 'website', value: 'https://example.com' }] }) });
    expect(updated.status).toBe(200);
    expect(db.contributors.get('writer')?.links).toBe('[{"platform":"website","value":"https://example.com","qr_image_url":null}]');
    expect((await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ links: [{ platform: 'website', value: 'http://example.com' }] }) })).status).toBe(400);
    expect((await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ links: [{ platform: 'carrier-pigeon', value: 'x' }] }) })).status).toBe(400);
    expect((await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ closing: 'x'.repeat(201) }) })).status).toBe(400);
  });

  it('saves and clears business_name through the same update route as every other field', async () => {
    const db = new FakeDb();
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'writer', display_name: 'Writer', business_name: 'Cloud Mountain Tea' }) });
    expect(db.contributors.get('writer')?.business_name).toBe('Cloud Mountain Tea');
    await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ business_name: null }) });
    expect(db.contributors.get('writer')?.business_name).toBeNull();
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

  it('preserves, unlinks, and reassigns host mirrors without stale links', async () => {
    const db = new FakeDb();
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'first-host', display_name: 'First' }) });
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'second-host', display_name: 'Second' }) });
    expect((await request(db, '/api/admin/contributors/first-host', { method: 'PUT', body: JSON.stringify({ face_of_account_id: ACCOUNT_ID }) })).status).toBe(200);
    expect(db.accounts.get(ACCOUNT_ID)?.host_contributor_id).toBe('first-host');
    expect(db.contributors.get('first-host')?.face_of_account_id).toBe(ACCOUNT_ID);

    // Saving an ordinary non-host with an explicit null must not clear A.
    expect((await request(db, '/api/admin/contributors/second-host', { method: 'PUT', body: JSON.stringify({ display_name: 'Second saved', face_of_account_id: null }) })).status).toBe(200);
    expect(db.accounts.get(ACCOUNT_ID)?.host_contributor_id).toBe('first-host');
    expect(db.contributors.get('first-host')?.face_of_account_id).toBe(ACCOUNT_ID);
    expect(db.contributors.get('second-host')?.face_of_account_id).toBeNull();

    // Unlinking A clears both sides.
    expect((await request(db, '/api/admin/contributors/first-host', { method: 'PUT', body: JSON.stringify({ face_of_account_id: null }) })).status).toBe(200);
    expect(db.accounts.get(ACCOUNT_ID)?.host_contributor_id).toBeNull();
    expect(db.contributors.get('first-host')?.face_of_account_id).toBeNull();

    // Reassigning B sets both sides without restoring A.
    expect((await request(db, '/api/admin/contributors/second-host', { method: 'PUT', body: JSON.stringify({ face_of_account_id: ACCOUNT_ID }) })).status).toBe(200);
    expect(db.accounts.get(ACCOUNT_ID)?.host_contributor_id).toBe('second-host');
    expect(db.contributors.get('first-host')?.face_of_account_id).toBeNull();
    expect(db.contributors.get('second-host')?.face_of_account_id).toBe(ACCOUNT_ID);
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
    const batchCallsBeforeFailure = db.batchCalls;
    db.failBatchAt = 2;
    const response = await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ face_of_account_id: ACCOUNT_ID }) });
    expect(response.status).toBe(500);
    expect(db.batchCalls).toBe(batchCallsBeforeFailure + 1);
    expect(db.accounts.get(ACCOUNT_ID)?.host_contributor_id).toBeNull();
    expect(db.contributors.get('writer')?.face_of_account_id).toBeNull();
  });

  it('rolls back contributor creation when host mirroring fails', async () => {
    const db = new FakeDb(); db.failBatchAt = 2;
    const response = await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'atomic-host', display_name: 'Atomic', face_of_account_id: ACCOUNT_ID }) });
    expect(response.status).toBe(500);
    expect(db.contributors.has('atomic-host')).toBe(false);
    expect(db.accounts.get(ACCOUNT_ID)?.host_contributor_id).toBeNull();
  });

  it('rolls back ordinary contributor fields when host mirroring fails', async () => {
    const db = new FakeDb();
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'writer', display_name: 'Before' }) });
    db.failBatchAt = 2;
    const response = await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: JSON.stringify({ display_name: 'After', face_of_account_id: ACCOUNT_ID }) });
    expect(response.status).toBe(500);
    expect(db.contributors.get('writer')?.display_name).toBe('Before');
    expect(db.contributors.get('writer')?.face_of_account_id).toBeNull();
  });

  it('rejects malformed JSON as a client error', async () => {
    const db = new FakeDb();
    const response = await request(db, '/api/admin/contributors', { method: 'POST', body: '{bad' });
    expect(response.status).toBe(400);
    await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'writer', display_name: 'Writer' }) });
    const update = await request(db, '/api/admin/contributors/writer', { method: 'PUT', body: '{bad' });
    expect(update.status).toBe(400);
  });

  it('prevents generic account updates from mutating the host mirror', async () => {
    const db = new FakeDb();
    db.accounts.get(ACCOUNT_ID)!.host_contributor_id = 'existing-host';
    const response = await request(db, `/api/accounts/${ACCOUNT_ID}`, { method: 'PUT', body: JSON.stringify({ host_contributor_id: 'other-writer' }) });
    expect(response.status).toBe(400);
    expect(db.accounts.get(ACCOUNT_ID)?.host_contributor_id).toBe('existing-host');
  });

  it('validates linked users and pouring products within the active account', async () => {
    const db = new FakeDb();
    for (const body of [
      { id: 'bad-user', display_name: 'Bad', user_id: 'user_other' },
      { id: 'bad-tea', display_name: 'Bad', pouring_today_product_id: 'tea_other' },
    ]) {
      const response = await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify(body) });
      expect(response.status).toBe(400);
      expect(db.contributors.has(body.id)).toBe(false);
    }
    expect((await request(db, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'valid-links', display_name: 'Valid', user_id: 'user_one', pouring_today_product_id: 'tea_one' }) })).status).toBe(201);
  });

  it('maps uniqueness failures to 409 and unrelated database failures to 500', async () => {
    const uniqueDb = new FakeDb(); uniqueDb.failWith = new Error('D1_ERROR: UNIQUE constraint failed: contributors.id');
    expect((await request(uniqueDb, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'race', display_name: 'Race' }) })).status).toBe(409);
    const brokenDb = new FakeDb(); brokenDb.failWith = new Error('D1_ERROR: disk I/O error');
    expect((await request(brokenDb, '/api/admin/contributors', { method: 'POST', body: JSON.stringify({ id: 'broken', display_name: 'Broken' }) })).status).toBe(500);
  });
});
