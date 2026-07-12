import { describe, expect, it } from 'vitest';
import worker from '../src/index';

const SECRET = 'event-draft-secret';
const compact = (sql: string) => sql.replace(/\s+/g, ' ').trim().toLowerCase();

async function jwt() {
  const encode = (value: unknown) => btoa(JSON.stringify(value));
  const now = Math.floor(Date.now() / 1000);
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: 'host', email: 'host@test', name: 'Host', active_account_id: 'a', iat: now, exp: now + 3600 })}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

class Db {
  articles: Record<string, any>[] = [];
  writes: Array<{ sql: string; values: any[] }> = [];
  constructor(readonly bundles = ['gather', 'publish']) {}
  prepare(sql: string) { return new Statement(this, sql); }
}

class Statement {
  values: any[] = [];
  constructor(private db: Db, private raw: string) {}
  bind(...values: any[]) { this.values = values; return this; }
  async first() {
    const sql = compact(this.raw);
    if (sql.includes('select platform_role from users')) return { platform_role: null };
    if (sql.includes('from account_members am join accounts')) return { role: 'staff', permissions: JSON.stringify({ bundles: this.db.bundles }), kind: 'location' };
    if (sql.includes('select status from accounts')) return { status: 'active' };
    if (sql.includes('from events where id = ? and account_id = ?')) {
      const [id, account] = this.values;
      return id === 'event-1' && account === 'a' ? { id, account_id: account, title: 'Cliff Tea Evening', subtitle: 'Wuyi after rain' } : null;
    }
    if (sql.includes('from event_post_session')) return { event_id: 'event-1', account_id: 'a', session_notes: 'Quiet table.', energy: 'contemplative', gallery_images: '["https://uploads.test/e.jpg"]', shared_tasting_notes: '["Warm rock"]', tea_ledger: '[]' };
    if (sql.includes('from articles where account_id = ? and source_event_id = ?')) {
      const [account, event] = this.values;
      return this.db.articles.find(article => article.account_id === account && article.source_event_id === event) || null;
    }
    if (sql.includes('from articles where id = ? and account_id = ?')) {
      const [id, account] = this.values;
      return this.db.articles.find(article => article.id === id && article.account_id === account) || null;
    }
    return null;
  }
  async run() {
    const sql = compact(this.raw);
    this.db.writes.push({ sql, values: this.values });
    if (sql.startsWith('insert into articles')) {
      const [id, account_id, title, subtitle, author_id, slug, category, tags, cover_image_url, blocks, layout_template, source_event_id] = this.values;
      this.db.articles.push({ id, account_id, title, subtitle, author_id, slug, status: 'draft', category, tags, cover_image_url, blocks, layout_template, source_event_id, created_at: 'now', updated_at: 'now' });
    }
    return { success: true, meta: { changes: 1 } };
  }
}

async function request(db: Db, event = 'event-1') {
  return worker.fetch(new Request(`https://test/api/admin/events/${event}/article-draft`, { method: 'POST', headers: { Authorization: `Bearer ${await jwt()}`, 'X-Teajia-Account': 'a' } }), { DB: db, JWT_SECRET: SECRET } as any);
}

async function postSession(db: Db, body: unknown) {
  return worker.fetch(new Request('https://test/api/admin/events/event-1/post-session', { method: 'POST', headers: { Authorization: `Bearer ${await jwt()}`, 'X-Teajia-Account': 'a', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { DB: db, JWT_SECRET: SECRET } as any);
}

describe('event article draft endpoint', () => {
  it('creates one ordinary account-scoped draft and returns it idempotently', async () => {
    const db = new Db();
    const created = await request(db);
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ existing: false, article: { status: 'draft', source_event_id: 'event-1', blocks: expect.any(Array) } });
    const existing = await request(db);
    expect(existing.status).toBe(200);
    expect(await existing.json()).toMatchObject({ existing: true, article: { source_event_id: 'event-1' } });
    expect(db.articles).toHaveLength(1);
  });

  it('denies wrong-account events and staff missing either required capability', async () => {
    expect((await request(new Db(), 'other-account')).status).toBe(404);
    expect((await request(new Db(['gather']))).status).toBe(403);
    expect((await request(new Db(['publish']))).status).toBe(403);
  });

  it('persists energy and shared tasting notes with the existing post-session fields', async () => {
    const db = new Db();
    const response = await postSession(db, { tea_ledger: [], gallery_images: ['https://uploads.test/e.jpg'], session_notes: 'Quiet.', playlist_url: 'https://playlist.test', energy: 'contemplative', shared_tasting_notes: ['Warm rock'] });
    expect(response.status).toBe(200);
    const update = db.writes.find(write => write.sql.startsWith('update event_post_session'))!;
    expect(update.sql).toContain('energy = ?, shared_tasting_notes = ?');
    expect(update.values).toEqual(['[]', 'https://playlist.test', '["https://uploads.test/e.jpg"]', 'Quiet.', 'contemplative', '["Warm rock"]', 'event-1', 'a']);
  });
});
