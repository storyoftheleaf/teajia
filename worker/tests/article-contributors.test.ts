import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const SECRET = 'test-secret';
const ACCOUNT = 'acc-one';
const enc = (value: object) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value))));
async function jwt() {
  const head = enc({ alg: 'HS256', typ: 'JWT' }); const now = Math.floor(Date.now() / 1000);
  const payload = enc({ sub: 'editor', email: 'editor@test.dev', active_account_id: ACCOUNT, iat: now, exp: now + 3600 });
  const data = `${head}.${payload}`; const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(sig)))}`;
}

class Statement {
  values: any[] = [];
  constructor(private db: Db, private sql: string) {}
  bind(...values: any[]) { this.values = values; return this; }
  first() { return this.db.first(this.sql, this.values); }
  all() { return this.db.all(this.sql, this.values); }
  run() { return this.db.run(this.sql, this.values); }
}
class Db {
  contributors = new Map([
    ['writer-one', { id: 'writer-one', account_id: ACCOUNT, display_name: 'Writer One', is_published: 0 }],
    ['subject-one', { id: 'subject-one', account_id: ACCOUNT, display_name: 'Subject One', is_published: 0 }],
    ['other-writer', { id: 'other-writer', account_id: 'acc-other', display_name: 'Other Writer', is_published: 0 }],
  ]);
  articles = new Map<string, any>([['legacy-article', { id: 'legacy-article', account_id: ACCOUNT, title: 'Legacy', slug: 'legacy', status: 'draft', author_id: 'legacy-writer', tags: '[]', blocks: '[]', subject_ids: '[]', pull_quote: null, pull_quote_subject: null }]]);
  prepare(sql: string) { return new Statement(this, sql); }
  n(sql: string) { return sql.replace(/\s+/g, ' ').trim().toLowerCase(); }
  async first(sqlText: string, values: any[]) {
    const sql = this.n(sqlText);
    if (sql.includes('select platform_role from users')) return { platform_role: null };
    if (sql.includes('from account_members am join accounts a')) return { role: 'owner', permissions: '{"bundles":["publish"]}', kind: 'location', status: 'active' };
    if (sql.includes('from contributors where id = ? and account_id = ?')) { const row = this.contributors.get(values[0]); return row?.account_id === values[1] ? row : null; }
    if (sql.includes('from articles where id = ? and account_id = ?')) { const row = this.articles.get(values[0]); return row?.account_id === values[1] ? structuredClone(row) : null; }
    if (sql.includes('from articles where id = ?')) return structuredClone(this.articles.get(values[0]) ?? null);
    if (sql.includes("where a.slug = ? and a.status = 'published'")) {
      const row = [...this.articles.values()].find(article => article.slug === values[0] && article.status === 'published');
      if (!row) return null;
      const contributor = this.contributors.get(row.author_id);
      const publishedAuthor = contributor?.is_published === 1 ? contributor : null;
      let subjectIds: string[] = [];
      try { subjectIds = JSON.parse(row.subject_ids || '[]'); } catch { subjectIds = []; }
      subjectIds = subjectIds.filter(id => this.contributors.get(id)?.is_published === 1);
      return {
        ...structuredClone(row),
        author_id: publishedAuthor?.id ?? null,
        author_name: publishedAuthor?.display_name ?? null,
        subject_ids: subjectIds,
        pull_quote_subject: this.contributors.get(row.pull_quote_subject)?.is_published === 1 ? row.pull_quote_subject : null,
      };
    }
    return null;
  }
  async all(sqlText: string, values: any[]) {
    const sql = this.n(sqlText);
    if (sql.includes('from contributors') && sql.includes('id in')) return { results: values.map(id => this.contributors.get(id)).filter(Boolean) };
    if (sql.includes('from articles a') && sql.includes("a.status = 'published'")) return { results: [] };
    return { results: [] };
  }
  async run(sqlText: string, values: any[]) {
    const sql = this.n(sqlText);
    if (sql.startsWith('insert into articles')) {
      const columns = sqlText.slice(sqlText.indexOf('(') + 1, sqlText.indexOf(')')).split(',').map(value => value.trim());
      let valueIndex = 0; const row: Record<string, any> = {};
      for (const column of columns) row[column] = column === 'status' ? 'draft' : values[valueIndex++];
      this.articles.set(row.id, row); return { meta: { changes: 1 } };
    }
    if (sql.startsWith('update articles set')) {
      const row = this.articles.get(values.at(-2)); if (!row || row.account_id !== values.at(-1)) return { meta: { changes: 0 } };
      const set = sqlText.match(/set([\s\S]*?)where/i)?.[1] ?? ''; const cols = [...set.matchAll(/([a-z_]+)\s*=\s*\?/gi)].map(match => match[1]);
      cols.forEach((column, index) => { row[column] = values[index]; }); return { meta: { changes: 1 } };
    }
    return { meta: { changes: 1 } };
  }
}
async function call(db: Db, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${await jwt()}`); headers.set('X-Teajia-Account', ACCOUNT); if (init.body) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://worker.test${path}`, { ...init, headers }), { JWT_SECRET: SECRET, DB: db } as any);
}

describe('article contributor linkage', () => {
  it('persists author, subjects, and pull quote fields for account contributors', async () => {
    const db = new Db(); const response = await call(db, '/api/admin/articles', { method: 'POST', body: JSON.stringify({ title: 'Linked', author_id: 'writer-one', subject_ids: ['subject-one'], pull_quote: 'A synthetic line.', pull_quote_subject: 'subject-one' }) });
    expect(response.status).toBe(201); expect(await response.json()).toMatchObject({ author_id: 'writer-one', subject_ids: ['subject-one'], pull_quote: 'A synthetic line.', pull_quote_subject: 'subject-one' });
  });
  it('rejects new author and subject IDs from another account', async () => {
    const db = new Db();
    expect((await call(db, '/api/admin/articles', { method: 'POST', body: JSON.stringify({ title: 'Cross', author_id: 'other-writer' }) })).status).toBe(400);
    expect((await call(db, '/api/admin/articles/legacy-article', { method: 'PUT', body: JSON.stringify({ subject_ids: ['other-writer'] }) })).status).toBe(400);
  });
  it('preserves an unchanged unknown legacy author but rejects a new unknown value', async () => {
    const db = new Db();
    expect((await call(db, '/api/admin/articles/legacy-article', { method: 'PUT', body: JSON.stringify({ title: 'Still legacy', author_id: 'legacy-writer' }) })).status).toBe(200);
    expect((await call(db, '/api/admin/articles/legacy-article', { method: 'PUT', body: JSON.stringify({ author_id: 'invented-writer' }) })).status).toBe(400);
  });
  it('omits unpublished contributor identity from public articles', async () => {
    const db = new Db(); db.articles.set('published', { id: 'published', account_id: ACCOUNT, title: 'Published', slug: 'published', status: 'published', author_id: 'writer-one', tags: '[]', blocks: '[]', subject_ids: '["subject-one"]' });
    const linked = await worker.fetch(new Request('https://worker.test/api/articles/published'), { DB: db } as any);
    expect(await linked.json()).toMatchObject({ author_id: null, author_name: null, subject_ids: [] });
  });
});
