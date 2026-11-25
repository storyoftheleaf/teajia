import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { seedIdentity, signedToken, SqliteD1 } from './helpers/sqliteD1';

const SECRET = 'test-secret';
const ACCOUNT = 'acc-one';
let testDb: SqliteD1 | undefined;
afterEach(() => testDb?.close());

function fixture() {
  const db = testDb = new SqliteD1();
  seedIdentity(db, { accountId: ACCOUNT, userId: 'editor', bundles: ['publish'] });
  seedIdentity(db, { accountId: 'acc-other', userId: 'other-editor', bundles: ['publish'] });
  db.exec(`INSERT INTO contributors (id, account_id, display_name, is_published) VALUES
    ('writer-one', '${ACCOUNT}', 'Writer One', 0),
    ('subject-one', '${ACCOUNT}', 'Subject One', 0),
    ('other-writer', 'acc-other', 'Other Writer', 0);
    INSERT INTO articles (id, account_id, title, slug, author_id) VALUES
    ('legacy-article', '${ACCOUNT}', 'Legacy', 'legacy', 'legacy-writer');`);
  return db;
}

async function call(db: SqliteD1, path: string, init: RequestInit = {}) {
  const token = await signedToken(SECRET, { sub: 'editor', email: 'editor@test.dev', active_account_id: ACCOUNT });
  const headers = { Authorization: `Bearer ${token}`, 'X-Teajia-Account': ACCOUNT, 'Content-Type': 'application/json' };
  return worker.fetch(new Request(`https://worker.test${path}`, { ...init, headers }), { JWT_SECRET: SECRET, DB: db } as any);
}

async function update(db: SqliteD1, patch: object) {
  const path = '/api/admin/articles/legacy-article';
  const { review_digest } = await (await call(db, path)).json() as { review_digest: string };
  return call(db, path, { method: 'PUT', body: JSON.stringify({ ...patch, review_digest }) });
}

describe('article contributor linkage', () => {
  it('persists author, subjects, and pull quote fields for account contributors', async () => {
    const db = fixture(); const response = await call(db, '/api/admin/articles', { method: 'POST', body: JSON.stringify({ title: 'Linked', author_id: 'writer-one', subject_ids: ['subject-one'], pull_quote: 'A synthetic line.', pull_quote_subject: 'subject-one' }) });
    expect(response.status).toBe(201); expect(await response.json()).toMatchObject({ author_id: 'writer-one', subject_ids: ['subject-one'], pull_quote: 'A synthetic line.', pull_quote_subject: 'subject-one' });
  });
  it('rejects new author and subject IDs from another account', async () => {
    const db = fixture();
    expect((await call(db, '/api/admin/articles', { method: 'POST', body: JSON.stringify({ title: 'Cross', author_id: 'other-writer' }) })).status).toBe(400);
    expect((await update(db, { subject_ids: ['other-writer'] })).status).toBe(400);
  });
  it('preserves an unchanged unknown legacy author but rejects a new unknown value', async () => {
    const db = fixture();
    expect((await update(db, { title: 'Still legacy', author_id: 'legacy-writer' })).status).toBe(200);
    expect((await update(db, { author_id: 'invented-writer' })).status).toBe(400);
  });
  it('omits unpublished contributor identity from public articles', async () => {
    const db = fixture(); db.sqlite.prepare("INSERT INTO articles (id, account_id, title, slug, status, author_id, subject_ids) VALUES (?, ?, ?, ?, ?, ?, ?)").run('published', ACCOUNT, 'Published', 'published', 'published', 'writer-one', '["subject-one"]');
    const linked = await worker.fetch(new Request('https://worker.test/api/articles/published'), { DB: db } as any);
    expect(await linked.json()).toMatchObject({ author_id: null, author_name: null, subject_ids: [] });
  });
});
