import { afterEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

const SECRET = 'host-article-test';
const SHOP = 'acc_teajia_bali';
const databases: SqliteD1[] = [];
afterEach(() => { while (databases.length) databases.pop()!.close(); });

function setup() {
  const db = new SqliteD1('migrations');
  databases.push(db);
  seedIdentity(db, { userId: 'adrian', accountId: SHOP, role: 'owner', platformRole: 'platform_owner' });
  seedIdentity(db, { userId: 'editor', accountId: SHOP, role: 'staff', bundles: ['publish'] });
  db.sqlite.exec(`
    INSERT INTO users (id, email, name, password_hash, role) VALUES
      ('host', 'host@test.dev', 'Mei', 'x', 'user'),
      ('second', 'second@test.dev', 'Ren', 'x', 'user'),
      ('guest', 'guest@test.dev', 'Guest', 'x', 'user');
    INSERT INTO member_private_sits (id, owner_user_id, request_id, sit_date) VALUES
      ('sit1', 'host', 'r1', '2026-11-25'), ('sit2', 'second', 'r2', '2026-11-25');
  `);
  const objects = new Map<string, Uint8Array>();
  const env = {
    DB: db,
    JWT_SECRET: SECRET,
    HOST_ARTICLES_OPEN: 'true',
    MEDIA_BUCKET: { get: async () => null },
    ATLAS_BUCKET: {
      put: async (key: string, bytes: ArrayBuffer) => { objects.set(key, new Uint8Array(bytes)); },
      delete: async (keys: string[]) => { for (const key of keys) objects.delete(key); },
      get: async (key: string) => objects.has(key) ? { body: objects.get(key) } : null,
    },
    PROVIDER_LIMITER: { limit: async () => ({ success: true }) },
  };
  return { db, env, objects };
}

async function call(env: ReturnType<typeof setup>['env'], user: string | null, path: string, data?: FormData | object, method = data ? 'POST' : 'GET') {
  const headers = new Headers();
  if (user) {
    const accountId = user === 'adrian' || user === 'editor' ? SHOP : null;
    const token = await signedToken(SECRET, {
      sub: user, email: `${user}@test.dev`, name: user, active_account_id: accountId,
      platform_role: 'platform_owner',
    });
    headers.set('Authorization', `Bearer ${token}`);
    if (accountId) headers.set('X-Teajia-Account', accountId);
  }
  if (data && !(data instanceof FormData)) headers.set('Content-Type', 'application/json');
  return worker.fetch(new Request(`https://api.test${path}`, {
    method, headers, body: data instanceof FormData ? data : data ? JSON.stringify(data) : undefined,
  }), env as any);
}

function form(values: Record<string, string> = {}, photo = false) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  if (photo) data.append('photos', new File([new Uint8Array([255, 216, 255, 217])], 'tea.jpg', { type: 'image/jpeg' }));
  return data;
}

const MINE = '/api/me/article-offers';
const REVIEW = '/api/admin/article-offers';
const draft = (credit = 'false', submissionId = crypto.randomUUID(), photo = true) =>
  form({ title: 'A winter tea', body: 'First paragraph.\n\nSecond paragraph.', credit, submission_id: submissionId }, photo);
const publish = () => form({ action: 'publish', title: 'Winter oolong', body: 'An edited article.\n\nA second paragraph.' });

describe('host article offers', () => {
  it('defaults closed, requires sign-in and checks actual hosting', async () => {
    const { env } = setup();
    expect((await call({ ...env, HOST_ARTICLES_OPEN: '' }, 'host', MINE)).status).toBe(404);
    expect((await call(env, null, MINE)).status).toBe(401);
    expect(await (await call(env, 'guest', MINE)).json()).toEqual({ can_offer: false, offers: [] });
    expect((await call(env, 'guest', MINE, draft())).status).toBe(403);
    expect((await call(env, 'host', MINE, form({ title: 'No body' }))).status).toBe(400);
    expect(await (await call(env, 'host', MINE)).json()).toEqual({ can_offer: true, offers: [] });
  });

  it('reads public-session host identity when Launch 2 is present', async () => {
    const { db, env } = setup();
    if (!db.sqlite.prepare("SELECT 1 FROM pragma_table_info('events') WHERE name = 'host_user_id'").get()) {
      db.sqlite.exec('ALTER TABLE events ADD COLUMN host_user_id TEXT REFERENCES users(id)');
    }
    db.sqlite.exec(`
      INSERT INTO events (account_id, slug, title, event_date, host_user_id, lifecycle_status)
      VALUES ('${SHOP}', 'host-session', 'An evening sit', '2026-11-25', 'guest', 'completed');
    `);
    expect(await (await call(env, 'guest', MINE)).json()).toMatchObject({ can_offer: true });
  });

  it('accepts a credited host of a real session without requiring a public profile', async () => {
    const { db, env } = setup();
    db.sqlite.exec(`
      INSERT INTO contributors (id, account_id, user_id, display_name, is_published)
      VALUES ('guest-profile', '${SHOP}', 'guest', 'Guest', 0);
      INSERT INTO contributor_accounts (contributor_id, account_id) VALUES ('guest-profile', '${SHOP}');
      INSERT INTO events (id, account_id, slug, title, event_date, lifecycle_status)
      VALUES ('session', '${SHOP}', 'session', 'An evening sit', '2026-11-25', 'draft');
      INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public)
      VALUES ('guest-host', '${SHOP}', 'session', 'guest-profile', 'co_host', 0);
    `);
    expect(await (await call(env, 'guest', MINE)).json()).toMatchObject({ can_offer: false });
    db.sqlite.exec("UPDATE events SET lifecycle_status = 'completed' WHERE id = 'session'");
    expect(await (await call(env, 'guest', MINE)).json()).toMatchObject({ can_offer: true });
  });

  it('keeps offers and photographs private and accepts a retry just once', async () => {
    const { env, objects } = setup();
    const submissionId = crypto.randomUUID();
    const response = await call(env, 'host', MINE, draft('false', submissionId));
    expect(response.status).toBe(201);
    const offer = await response.json() as any;
    expect(offer).toMatchObject({ status: 'offered', credit: false, author_name: null, slug: null });
    expect(await (await call(env, 'host', MINE, draft('false', submissionId))).json()).toMatchObject({ id: offer.id });
    expect(objects.size).toBe(1);
    expect(await (await call(env, 'second', MINE)).json()).toMatchObject({ offers: [] });
    expect((await call(env, 'editor', REVIEW)).status).toBe(403);
    expect((await call(env, 'host', `${REVIEW}/${offer.id}`, publish())).status).toBe(403);
    expect((await call(env, 'editor', `${REVIEW}/${offer.id}`, publish())).status).toBe(403);
    expect(await (await call(env, null, '/api/articles')).json()).toEqual([]);
    const path = `/api/article-offers/${offer.id}/photos/${offer.photos[0]}`;
    expect((await call(env, null, path)).status).toBe(404);
    expect((await call(env, 'second', path)).status).toBe(404);
    expect((await call(env, 'host', path)).status).toBe(200);
    expect((await call(env, 'adrian', path)).status).toBe(200);
    expect((await call(env, null, `/api/media/${[...objects.keys()][0]}`)).status).toBe(404);
  });

  it('publishes the edited article exactly once with only the permitted byline and photos', async () => {
    const { env, db } = setup();
    const offer = await (await call(env, 'host', MINE, draft())).json() as any;
    const kept = offer.photos[0];
    const edit = publish();
    edit.append('keep_photo', kept);
    const responses = await Promise.all([
      call(env, 'adrian', `${REVIEW}/${offer.id}`, edit),
      call(env, 'adrian', `${REVIEW}/${offer.id}`, publish()),
    ]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    const published = await responses.find(r => r.ok)!.json() as any;
    expect(published).toMatchObject({ status: 'published', title: 'Winter oolong', author_name: null });
    const articlePath = `/api/articles/${published.slug}`;
    const article = await (await call(env, null, articlePath)).json() as any;
    expect(article).toMatchObject({
      title: 'Winter oolong', author_id: null, author_name: null,
      blocks: expect.arrayContaining([{ type: 'paragraph', text: 'An edited article.' }]),
    });
    expect(article).not.toHaveProperty('writer_user_id');
    expect(db.sqlite.prepare('SELECT count(*) AS n FROM articles').get()).toMatchObject({ n: 1 });
    const path = `/api/article-offers/${offer.id}/photos/${kept}`;
    expect((await call(env, null, path)).status).toBe(published.photos.length ? 200 : 404);

    const named = await (await call(env, 'host', MINE, draft('true', crypto.randomUUID(), false))).json() as any;
    expect(named.author_name).toBe('Mei');
    const approved = await (await call(env, 'adrian', `${REVIEW}/${named.id}`, publish())).json() as any;
    expect(await (await call(env, null, `/api/articles/${approved.slug}`)).json()).toMatchObject({ author_name: 'Mei' });
  });

  it('declines without publication and denies private photo reuse from another offer', async () => {
    const { env, objects } = setup();
    const first = await (await call(env, 'host', MINE, draft())).json() as any;
    const second = await (await call(env, 'second', MINE, draft())).json() as any;
    const edit = publish();
    edit.append('keep_photo', second.photos[0]);
    expect((await call(env, 'adrian', `${REVIEW}/${first.id}`, edit)).status).toBe(400);
    const declined = await (await call(env, 'adrian', `${REVIEW}/${first.id}`, form({ action: 'decline' }))).json();
    expect(declined).toMatchObject({ status: 'declined', slug: null });
    expect((await call(env, 'adrian', `${REVIEW}/${first.id}`, publish())).status).toBe(409);
    expect(await (await call(env, null, '/api/articles')).json()).toEqual([]);
    expect(objects.size).toBe(2);
  });

  it('preserves photo order and restores photo privacy when Adrian takes the article down', async () => {
    const { env, db } = setup();
    const offer = await (await call(env, 'host', MINE, draft())).json() as any;
    const edit = form({ action: 'publish', title: 'Edited tea', body: 'Edited words.' }, true);
    edit.append('keep_photo', offer.photos[0]);
    const saved = await (await call(env, 'adrian', `${REVIEW}/${offer.id}`, edit)).json() as any;
    expect(saved.photos).toEqual([expect.any(String), offer.photos[0]]);
    const publicPaths = saved.photos.map((id: string) => `/api/articles/${offer.id}/photos/${id}`);
    const articlePath = `/api/articles/${saved.slug}`;
    const liveArticle = await (await call(env, null, articlePath)).json() as any;
    expect(liveArticle.blocks).toEqual([
      { type: 'cover', title: 'Edited tea', image: publicPaths[0] },
      { type: 'paragraph', text: 'Edited words.' },
      { type: 'image', url: publicPaths[1] },
    ]);
    const closed = { ...env, HOST_ARTICLES_OPEN: 'false' };
    for (const id of saved.photos) {
      const offerPath = `/api/article-offers/${offer.id}/photos/${id}`;
      const unknown = await call(closed, null, '/api/absent');
      const actual = await call({ ...closed, DB: undefined }, null, offerPath);
      expect(actual.status).toBe(unknown.status);
      expect([...actual.headers]).toEqual([...unknown.headers]);
      expect(await actual.json()).toEqual(await unknown.json());
    }
    for (const path of publicPaths) {
      expect((await call(closed, null, path)).status).toBe(200);
    }
    db.exec(`UPDATE articles
      SET cover_image_url = replace(cover_image_url, '/api/articles/', '/api/article-offers/'),
          blocks = replace(blocks, '/api/articles/', '/api/article-offers/')
      WHERE id = '${offer.id}'`);
    const legacy = await (await call(closed, null, articlePath)).json() as any;
    expect(legacy.cover_image_url).toBe(publicPaths[0]);
    expect(legacy.blocks).toEqual(liveArticle.blocks);
    expect((await call(closed, null, legacy.cover_image_url)).status).toBe(200);

    const adminPath = `/api/admin/articles/${offer.id}`;
    const managed = await (await call(env, 'adrian', adminPath)).json() as any;
    expect((await call(env, 'editor', adminPath)).status).toBe(200);
    expect((await call(env, 'editor', `${adminPath}/unpublish`, { review_digest: managed.review_digest })).status).toBe(403);
    const byline = await call(env, 'adrian', adminPath,
      { review_digest: managed.review_digest, author_id: 'host' }, 'PUT');
    expect(byline.status).toBe(400);
    expect((await call(env, 'adrian', `${adminPath}/unpublish`, { review_digest: managed.review_digest })).status).toBe(200);
    expect((await call(env, null, articlePath)).status).toBe(404);
    for (const path of publicPaths) expect((await call(env, null, path)).status).toBe(404);
  });
});
