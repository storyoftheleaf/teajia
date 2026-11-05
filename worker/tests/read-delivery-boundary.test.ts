import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'synthetic-read-delivery-secret';
const MARKER = 'SYNTHETIC_UNPUBLISHED_READ_BODY';
const databases: SqliteD1[] = [];

function database() {
  const db = new SqliteD1();
  databases.push(db);
  seedIdentity(db, { userId: 'editor', accountId: 'acc_teajia_bali' });
  db.sqlite.prepare("UPDATE accounts SET kind = 'platform', is_platform_owner = 1 WHERE id = 'acc_teajia_bali'").run();
  db.sqlite.prepare("INSERT INTO story_content (id, account_id, story_slug, state, content) VALUES ('private-body', 'acc_teajia_bali', 'rock-remembers', 'published', ?)").run(JSON.stringify({ text: MARKER }));
  db.sqlite.prepare("INSERT INTO story_content (id, account_id, story_slug, state, content) VALUES ('private-draft', 'acc_teajia_bali', 'ritual', 'draft', ?)").run(JSON.stringify({ text: MARKER }));
  return db;
}

afterEach(() => { while (databases.length) databases.pop()!.close(); });

async function token(userId = 'editor', extra: Record<string, unknown> = {}) {
  return signedToken(SECRET, { sub: userId, email: `${userId}@test.dev`, active_account_id: 'acc_teajia_bali', ...extra });
}

function request(db: SqliteD1, path: string, init: RequestInit = {}, databaseOverride?: unknown) {
  return worker.fetch(new Request(`https://worker.test${path}`, init), {
    DB: databaseOverride ?? db, JWT_SECRET: SECRET, APP_URL: 'https://www.teajia.com',
  } as any);
}

function privateResponse(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('Vary')).toContain('Cookie');
  expect(response.headers.get('Vary')).toContain('Authorization');
}

describe('Read delivery, verified at the API', () => {
  it('withholds unpublished saved prose from an anonymous direct API request', async () => {
    const db = database();
    const response = await request(db, '/api/story-content/rock-remembers');
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain(MARKER);
    privateResponse(response);
  });

  it('allows public paths, refuses unknown paths and unpublished paths', async () => {
    const db = database();
    for (const [path, status] of [['/read/ritual', 204], ['/read/rock-remembers', 404], ['/read/unknown', 404]] as const) {
      const response = await request(db, `/api/read/access?path=${encodeURIComponent(path)}`);
      expect(response.status).toBe(status);
      privateResponse(response);
    }
  });

  it('rechecks stored unpublication instead of trusting the default live map', async () => {
    const db = database();
    db.sqlite.prepare("INSERT INTO read_publish_state (path, account_id, state, changed_by) VALUES ('/read/ritual', 'acc_teajia_bali', 'draft', 'editor')").run();
    expect((await request(db, '/api/read/access?path=/read/ritual')).status).toBe(404);
    db.sqlite.prepare("UPDATE read_publish_state SET state = 'live' WHERE path = '/read/ritual'").run();
    expect((await request(db, '/api/read/access?path=/read/ritual')).status).toBe(204);
  });

  it('publishes and withholds the same saved text with the story publication choice', async () => {
    const db = database();
    db.sqlite.prepare("INSERT INTO read_publish_state (path, account_id, state, changed_by) VALUES ('/read/rock-remembers', 'acc_teajia_bali', 'live', 'editor')").run();
    const published = await request(db, '/api/story-content/rock-remembers');
    expect(published.status).toBe(200);
    expect(await published.text()).toContain(MARKER);
    privateResponse(published);
    db.sqlite.prepare("UPDATE read_publish_state SET state = 'draft' WHERE path = '/read/rock-remembers'").run();
    const withheld = await request(db, '/api/story-content/rock-remembers');
    expect(withheld.status).toBe(404);
    expect(await withheld.text()).not.toContain(MARKER);
    privateResponse(withheld);
  });

  it('refuses forged signatures and signed elevated claims absent from the database', async () => {
    const db = database();
    seedIdentity(db, { userId: 'outsider', accountId: 'acc_other', role: 'owner' });
    for (const bearer of [
      await signedToken('wrong-signature', { sub: 'editor', platform_role: 'platform_owner' }),
      await token('outsider', { platform_role: 'platform_owner', memberships: [{ role: 'owner', account_kind: 'platform' }] }),
    ]) {
      const response = await request(db, '/api/read/access?path=/read/rock-remembers', { headers: { Authorization: `Bearer ${bearer}` } });
      expect([401, 404]).toContain(response.status);
      expect(await response.text()).not.toContain(MARKER);
      const story = await request(db, '/api/story-content/rock-remembers', { headers: { Authorization: `Bearer ${bearer}` } });
      expect([401, 404]).toContain(story.status);
      expect(await story.text()).not.toContain(MARKER);
    }
  });

  it('lets a real editor establish an HttpOnly asset session and read the saved prose', async () => {
    const db = database();
    const bearer = await token();
    const response = await request(db, '/api/read/session', { method: 'POST', headers: { Authorization: `Bearer ${bearer}` } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ editor: true });
    const cookie = response.headers.get('Set-Cookie')!;
    expect(cookie).toContain('__Host-teajia-read=');
    for (const attribute of ['Secure', 'HttpOnly', 'SameSite=Strict', 'Path=/']) expect(cookie).toContain(attribute);
    const maxAge = Number(/Max-Age=(\d+)/.exec(cookie)?.[1]);
    expect(maxAge).toBeGreaterThan(3500);
    expect(maxAge).toBeLessThanOrEqual(3600);
    privateResponse(response);
    const access = await request(db, '/api/read/access?path=/read/rock-remembers', { headers: { Cookie: cookie.split(';')[0] } });
    expect(access.status).toBe(204);
    privateResponse(access);
    const story = await request(db, '/api/story-content/rock-remembers', { headers: { Authorization: `Bearer ${bearer}` } });
    expect(story.status).toBe(200);
    expect(await story.text()).toContain(MARKER);
    privateResponse(story);
  });

  it('checks platform role and Teajia staff bundles in the database', async () => {
    const db = database();
    seedIdentity(db, { userId: 'platform', accountId: 'acc_other', role: 'viewer', platformRole: 'platform_owner' });
    seedIdentity(db, { userId: 'staff', accountId: 'acc_teajia_bali', role: 'staff', bundles: ['publish'] });
    seedIdentity(db, { userId: 'stock', accountId: 'acc_teajia_bali', role: 'staff', bundles: ['stock'] });
    seedIdentity(db, { userId: 'viewer', accountId: 'acc_teajia_bali', role: 'viewer', bundles: ['publish'] });
    for (const [id, allowed] of [['platform', true], ['staff', true], ['stock', false], ['viewer', false]] as const) {
      const response = await request(db, '/api/read/access?path=/read/rock-remembers', { headers: { Authorization: `Bearer ${await token(id)}` } });
      expect(response.status).toBe(allowed ? 204 : 404);
    }
  });

  it('requires a real editor for in-progress text even on a live story', async () => {
    const db = database();
    const denied = await request(db, '/api/story-content/ritual?state=draft');
    expect([401, 404]).toContain(denied.status);
    expect(await denied.text()).not.toContain(MARKER);
    const allowed = await request(db, '/api/story-content/ritual?state=draft', { headers: { Authorization: `Bearer ${await token()}` } });
    expect(allowed.status).toBe(200);
    expect(await allowed.text()).toContain(MARKER);
  });

  it('revokes asset access immediately after demotion or session invalidation', async () => {
    const db = database();
    const bearer = await token();
    const init = { headers: { Cookie: `__Host-teajia-read=${bearer}` } };
    expect((await request(db, '/api/read/access?path=/read/rock-remembers', init)).status).toBe(204);
    db.sqlite.prepare("UPDATE account_members SET role = 'viewer' WHERE user_id = 'editor'").run();
    expect((await request(db, '/api/read/access?path=/read/rock-remembers', init)).status).toBe(404);
    db.sqlite.prepare("UPDATE account_members SET role = 'owner' WHERE user_id = 'editor'").run();
    db.sqlite.prepare("UPDATE users SET session_version = 1 WHERE id = 'editor'").run();
    expect((await request(db, '/api/read/access?path=/read/rock-remembers', init)).status).toBe(401);
  });

  it('rejects expired asset sessions and clears a refused session cookie', async () => {
    const db = database();
    const expired = await token('editor', { exp: Math.floor(Date.now() / 1000) - 60 });
    expect((await request(db, '/api/read/access?path=/read/rock-remembers', { headers: { Cookie: `__Host-teajia-read=${expired}` } })).status).toBe(401);
    const response = await request(db, '/api/read/session', { method: 'POST', headers: { Cookie: `__Host-teajia-read=${await token()}` } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ editor: false });
    expect(response.headers.get('Set-Cookie')).toContain('Max-Age=0');
    privateResponse(response);
  });

  it('does not accept the asset cookie as a credential for writes or saved drafts', async () => {
    const db = database();
    const headers = { Cookie: `__Host-teajia-read=${await token()}`, 'Content-Type': 'application/json' };
    const publish = await request(db, '/api/read/publish-state', {
      method: 'POST', headers, body: JSON.stringify({ path: '/read/rock-remembers', state: 'live' }),
    });
    expect(publish.status).toBe(401);
    expect((await request(db, '/api/story-content/ritual?state=draft', { headers })).status).toBe(401);
    const forgedCookie = await signedToken('wrong-signature', { sub: 'editor', platform_role: 'platform_owner' });
    expect((await request(db, '/api/read/access?path=/read/rock-remembers', { headers: { Cookie: `__Host-teajia-read=${forgedCookie}` } })).status).toBe(401);
  });

  it('fails closed when the current publish state cannot be read', async () => {
    const db = database();
    db.sqlite.exec('DROP TABLE read_publish_state');
    const response = await request(db, '/api/read/access?path=/read/ritual');
    expect(response.status).toBe(503);
    privateResponse(response);
  });

  it('fails closed when editor memberships cannot be read', async () => {
    const db = database();
    const failingDb = {
      prepare(sql: string) {
        if (/FROM account_members/.test(sql)) throw new Error('synthetic membership failure');
        return db.prepare(sql);
      },
    };
    const response = await request(db, '/api/read/session', { method: 'POST', headers: { Authorization: `Bearer ${await token()}` } }, failingDb);
    expect(response.status).toBe(503);
    privateResponse(response);
  });
  it('withholds snapshot text and mutation paths from a legacy admin outside Teajia', async () => {
    const db = database();
    seedIdentity(db, { userId: 'legacy', accountId: 'acc_elsewhere', role: 'owner' });
    db.sqlite.prepare("UPDATE users SET role = 'admin' WHERE id = 'legacy'").run();
    db.sqlite.prepare("INSERT INTO story_content_versions (id, account_id, story_slug, content) VALUES ('version', 'acc_teajia_bali', 'rock-remembers', ?)").run(JSON.stringify({ text: MARKER }));
    const headers = { Authorization: `Bearer ${await token('legacy')}`, 'Content-Type': 'application/json' };
    for (const [path, method, body] of [
      ['/api/story-content/rock-remembers/versions', 'GET', undefined],
      ['/api/story-content/rock-remembers/restore/version', 'POST', undefined],
      ['/api/story-content/rock-remembers/draft', 'PUT', JSON.stringify({ content: { text: 'synthetic overwrite' } })],
      ['/api/story-content/rock-remembers/publish', 'POST', undefined],
    ] as const) {
      const response = await request(db, path, { method, headers, body });
      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain(MARKER);
      privateResponse(response);
    }
  });

  it('preserves the real magazine editor save, publish, history and restore workflow', async () => {
    const db = database();
    const headers = { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' };
    expect((await request(db, '/api/story-content/rock-remembers/draft', {
      method: 'PUT', headers, body: JSON.stringify({ content: { text: 'synthetic replacement' } }),
    })).status).toBe(200);
    expect((await request(db, '/api/story-content/rock-remembers/publish', { method: 'POST', headers })).status).toBe(200);
    const versions = await request(db, '/api/story-content/rock-remembers/versions', { headers });
    expect(versions.status).toBe(200);
    privateResponse(versions);
    const [version] = await versions.json();
    const restored = await request(db, `/api/story-content/rock-remembers/restore/${version.id}`, { method: 'POST', headers });
    expect(restored.status).toBe(200);
    expect(await restored.text()).toContain(MARKER);
    privateResponse(restored);
  });

});
