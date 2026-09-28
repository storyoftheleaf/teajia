import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// DELETE /api/admin/contributors/:id. Deleting is permanent, so the rule is:
// only an unpublished profile that nothing else points at, and every refusal
// says in words what is in the way.

const SIGNING_KEY = 'contributor-delete-test-key';
const databases: SqliteD1[] = [];
function database() { const db = new SqliteD1(); databases.push(db); return db; }
afterEach(() => { while (databases.length) databases.pop()!.close(); });

async function call(db: SqliteD1, path: string, method = 'DELETE', options: { userId?: string; accountId?: string } = {}) {
  const userId = options.userId ?? 'owner-one';
  const accountId = options.accountId ?? 'acc-one';
  const token = await signedToken(SIGNING_KEY, { sub: userId, email: `${userId}@test.dev`, name: userId, active_account_id: accountId, platform_role: null });
  return worker.fetch(new Request(`https://worker.test${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'X-Teajia-Account': accountId },
  }), { DB: db as any, JWT_SECRET: SIGNING_KEY } as any);
}

function seedPerson(db: SqliteD1, id: string, options: { published?: boolean; accountId?: string; userId?: string | null } = {}) {
  const accountId = options.accountId ?? 'acc-one';
  db.sqlite.prepare(`INSERT OR IGNORE INTO accounts (id, slug, name, status, public_enabled) VALUES (?, ?, ?, 'active', 1)`).run(accountId, accountId, accountId);
  db.sqlite.prepare(`INSERT INTO contributors (id, account_id, display_name, user_id, is_published, links) VALUES (?, ?, ?, ?, ?, '[]')`)
    .run(id, accountId, `Display ${id}`, options.userId ?? null, options.published ? 1 : 0);
}

const exists = (db: SqliteD1, id: string) => Boolean(db.sqlite.prepare('SELECT 1 FROM contributors WHERE id = ?').get(id));

describe('deleting a contributor', () => {
  it('removes an unpublished profile that nothing points at, with its gallery, and logs it', async () => {
    const db = database();
    seedIdentity(db, { userId: 'owner-one', accountId: 'acc-one', role: 'owner' });
    seedPerson(db, 'placeholder');
    db.sqlite.prepare(`INSERT INTO contributor_gallery_images (id, contributor_id, image_url, position) VALUES ('g1', 'placeholder', 'https://example.com/a.jpg', 0)`).run();

    const res = await call(db, '/api/admin/contributors/placeholder');
    expect(res.status).toBe(200);
    expect(exists(db, 'placeholder')).toBe(false);
    expect(db.sqlite.prepare(`SELECT COUNT(*) AS n FROM contributor_gallery_images WHERE contributor_id = 'placeholder'`).get()).toEqual({ n: 0 });
    expect(db.sqlite.prepare(`SELECT action FROM activity_logs WHERE entity_id = 'placeholder'`).get()).toEqual({ action: 'contributor_deleted' });
  });

  it('refuses a published profile, and says to unpublish first', async () => {
    const db = database();
    seedIdentity(db, { userId: 'owner-one', accountId: 'acc-one', role: 'owner' });
    seedPerson(db, 'live-person', { published: true });
    const res = await call(db, '/api/admin/contributors/live-person');
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error).toMatch(/still published\. Unpublish it first/);
    expect(exists(db, 'live-person')).toBe(true);
  });

  it('refuses while an article still names the person, as author or as a subject', async () => {
    const db = database();
    seedIdentity(db, { userId: 'owner-one', accountId: 'acc-one', role: 'owner' });
    seedPerson(db, 'named');
    db.sqlite.prepare(`INSERT INTO articles (id, account_id, title, slug, status, subject_ids) VALUES ('a1', 'acc-one', 'A piece', 'a-piece', 'published', '["named"]')`).run();
    const res = await call(db, '/api/admin/contributors/named');
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error).toMatch(/An article names it as author or subject/);
    expect(exists(db, 'named')).toBe(true);
  });

  it('refuses a profile linked to a member’s sign-in', async () => {
    const db = database();
    seedIdentity(db, { userId: 'owner-one', accountId: 'acc-one', role: 'owner' });
    seedPerson(db, 'member-page', { userId: 'owner-one' });
    const res = await call(db, '/api/admin/contributors/member-page');
    expect(res.status).toBe(409);
    expect(exists(db, 'member-page')).toBe(true);
  });

  it('cannot reach another account’s profile, and is owner-tier only', async () => {
    const db = database();
    seedIdentity(db, { userId: 'owner-one', accountId: 'acc-one', role: 'owner' });
    seedIdentity(db, { userId: 'staff-one', accountId: 'acc-one', role: 'staff' });
    seedPerson(db, 'elsewhere', { accountId: 'acc-two' });
    seedPerson(db, 'mine');
    expect((await call(db, '/api/admin/contributors/elsewhere')).status).toBe(404);
    expect(exists(db, 'elsewhere')).toBe(true);
    expect((await call(db, '/api/admin/contributors/mine', 'DELETE', { userId: 'staff-one' })).status).toBe(403);
    expect(exists(db, 'mine')).toBe(true);
  });
});
