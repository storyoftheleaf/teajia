import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const SECRET = 'curation-secret';

async function token(user = 'member', email = 'member@test') {
  const encode = (value: unknown) => btoa(JSON.stringify(value));
  const now = Math.floor(Date.now() / 1000);
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user, email, name: 'Member', active_account_id: 'a', iat: now, exp: now + 3600 })}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

type Row = Record<string, any>;
const normalized = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();

class Db {
  candidates: Row[] = [];
  impressions: Row[] = [];
  constructor(private bundles: string[] = ['publish']) {}
  prepare(sql: string) { return new Statement(this, sql); }
  async batch(statements: Statement[]) { return Promise.all(statements.map(statement => statement.run())); }
  auth(sql: string) {
    if (sql.includes('select platform_role from users')) return { platform_role: null };
    if (sql.includes('from account_members am join accounts')) return { role: 'staff', permissions: JSON.stringify({ bundles: this.bundles }), kind: 'location' };
    if (sql.includes('select status from accounts')) return { status: 'active' };
    return undefined;
  }
}

class Statement {
  values: any[] = [];
  constructor(private db: Db, private raw: string) {}
  bind(...values: any[]) { this.values = values; return this; }
  async first() {
    const sql = normalized(this.raw);
    const auth = this.db.auth(sql); if (auth !== undefined) return auth;
    if (sql.includes('from customer_tasting_journal') && !sql.includes('join')) {
      const [id, account, email] = this.values;
      return id === 'journal-a' && account === 'a' && email === 'member@test' ? { id, product_id: 'product-a' } : null;
    }
    if (sql.includes('select * from tasting_note_candidates where account_id')) {
      const [account, author, journal, key] = this.values;
      return this.db.candidates.find(c => c.account_id === account && c.author_user_id === author && c.journal_entry_id === journal && c.note_key === key) || null;
    }
    if (sql.includes('select * from tasting_note_candidates where id')) {
      const [id, account] = this.values;
      return this.db.candidates.find(c => c.id === id && c.account_id === account) || null;
    }
    return null;
  }
  async all() {
    const sql = normalized(this.raw);
    if (sql.includes('from tasting_note_candidates')) {
      const [account, status] = this.values;
      return { results: this.db.candidates.filter(c => c.account_id === account && c.status === status) };
    }
    if (sql.includes('from product_impressions')) {
      const [product] = this.values;
      return { results: this.db.impressions.filter(i => i.product_id === product && i.product_public) };
    }
    return { results: [] };
  }
  async run() {
    const sql = normalized(this.raw);
    if (sql.startsWith('insert into tasting_note_candidates')) {
      const [id, account_id, journal_entry_id, note_key, product_id, author_user_id, source_text, source_tasting, created_at, updated_at] = this.values;
      const old = this.db.candidates.find(c => c.author_user_id === author_user_id && c.journal_entry_id === journal_entry_id && c.note_key === note_key);
      if (old?.status === 'starred') Object.assign(old, { source_text, source_tasting, updated_at });
      else if (!old) this.db.candidates.push({ id, account_id, journal_entry_id, note_key, product_id, author_user_id, source_text, source_tasting, status: 'starred', edited_text: null, attribution_name: null, attribution_detail: null, created_at, updated_at });
      return { success: true, meta: { changes: old?.status === 'starred' || !old ? 1 : 0 } };
    }
    if (sql.startsWith("update tasting_note_candidates set status = 'promoted'")) {
      const [promoted_at, promoted_by, updated_at, id, account] = this.values;
      const candidate = this.db.candidates.find(c => c.id === id && c.account_id === account && c.status === 'starred');
      if (candidate) Object.assign(candidate, { status: 'promoted', promoted_at, promoted_by, updated_at });
      return { success: true, meta: { changes: candidate ? 1 : 0 } };
    }
    if (sql.startsWith('insert into product_impressions')) {
      const [id, account_id, product_id, candidate_id, text, attribution_name, attribution_detail, published_at, published_by, created_at] = this.values;
      if (this.db.impressions.some(row => row.candidate_id === candidate_id)) throw new Error('unique candidate');
      this.db.impressions.push({ id, account_id, product_id, candidate_id, text, attribution_name, attribution_detail, published_at, published_by, created_at, product_public: true });
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 1 } };
  }
}

async function call(db: Db, path: string, method = 'GET', body?: unknown, account = 'a') {
  return worker.fetch(new Request(`https://test${path}`, { method, headers: { Authorization: `Bearer ${await token()}`, 'X-Teajia-Account': account, 'Content-Type': 'application/json' }, body: body == null ? undefined : JSON.stringify(body) }), { DB: db, JWT_SECRET: SECRET } as any);
}

describe('tasting-note curation routes', () => {
  it('stars only a journal entry owned by the authenticated member in the active account', async () => {
    const db = new Db();
    const saved = await call(db, '/api/tasting-journal/journal-a/candidates/aroma', 'PUT', { source_text: '  orchid  ', source_tasting: { private: true } });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ noteKey: 'aroma', sourceText: 'orchid', status: 'starred' });
    expect((await call(db, '/api/tasting-journal/journal-b/candidates/aroma', 'PUT', { source_text: 'stolen' })).status).toBe(404);
    expect((await call(db, '/api/tasting-journal/journal-a/candidates/aroma', 'PUT', { source_text: 'cross account' }, 'b')).status).toBe(404);
  });

  it('requires publish capability and never returns private candidates publicly', async () => {
    const denied = await call(new Db(['catalog']), '/api/admin/tasting-note-candidates');
    expect(denied.status).toBe(403);
    const db = new Db();
    await call(db, '/api/tasting-journal/journal-a/candidates/aroma', 'PUT', { source_text: 'private' });
    expect(await (await worker.fetch(new Request('https://test/api/products/product-a/impressions'), { DB: db, JWT_SECRET: SECRET } as any)).json()).toEqual([]);
  });

  it('scopes the admin queue to the active account', async () => {
    const db = new Db();
    db.candidates.push(
      { id: 'a-note', account_id: 'a', status: 'starred', source_text: 'A', edited_text: null, journal_entry_id: 'j', note_key: 'aroma', product_id: 'p', created_at: '1', updated_at: '1' },
      { id: 'b-note', account_id: 'b', status: 'starred', source_text: 'B', edited_text: null, journal_entry_id: 'j2', note_key: 'aroma', product_id: 'p2', created_at: '1', updated_at: '1' },
    );
    const response = await call(db, '/api/admin/tasting-note-candidates');
    expect((await response.json() as Row[]).map(row => row.id)).toEqual(['a-note']);
  });

  it('promotes once and exposes only the durable public impression fields', async () => {
    const db = new Db();
    await call(db, '/api/tasting-journal/journal-a/candidates/aroma', 'PUT', { source_text: 'private source', source_tasting: { private: true } });
    Object.assign(db.candidates[0], { edited_text: 'Orchid over warm stone', attribution_name: 'M.', attribution_detail: 'Bali' });
    const first = await call(db, `/api/admin/tasting-note-candidates/${db.candidates[0].id}/promote`, 'POST');
    expect(first.status).toBe(201);
    expect((await call(db, `/api/admin/tasting-note-candidates/${db.candidates[0].id}/promote`, 'POST')).status).toBe(409);
    const publicResponse = await worker.fetch(new Request('https://test/api/products/product-a/impressions'), { DB: db, JWT_SECRET: SECRET } as any);
    const published = await publicResponse.json() as Row[];
    expect(published).toEqual([expect.objectContaining({ text: 'Orchid over warm stone', attributionName: 'M.' })]);
    expect(published[0]).not.toHaveProperty('sourceTasting');
    expect(published[0]).not.toHaveProperty('sourceText');
  });
});
