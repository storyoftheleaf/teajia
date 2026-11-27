import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src/index';
import { favouritesRoutes } from '../src/favourites';
import { SqliteD1, seedIdentity, signedToken } from './helpers/sqliteD1';

// Launch 4, favourites in three kinds. Each person sees and changes only what
// they marked; a draft article cannot be kept; closed, every route is 404.

let database: SqliteD1;
beforeEach(() => {
  database = new SqliteD1('migrations');
  seedIdentity(database, { userId: 'reader', accountId: 'shop' });
  seedIdentity(database, { userId: 'other', accountId: 'shop' });
  database.exec(`
    INSERT INTO articles (id, account_id, title, slug, status) VALUES
      ('art-open', 'shop', 'Water and stone', 'water-and-stone', 'published'),
      ('art-other', 'shop', 'Old trees', 'old-trees', 'published'),
      ('art-draft', 'shop', 'Not yet', 'not-yet', 'draft');
    INSERT INTO products (id, account_id, product_name, slug, type, status, is_public, shown_in_shop) VALUES
      ('tea-shown', 'shop', 'Old Tree Red', 'old-tree-red', 'Red', 'Active', 1, 1),
      ('tea-hidden', 'shop', 'Hidden Green', 'hidden-green', 'Green', 'Active', 0, 1);
    INSERT INTO user_favorites (user_id, account_id, item_id) VALUES
      ('reader', 'shop', 'tea-shown'), ('reader', 'shop', 'tea-hidden'), ('other', 'shop', 'tea-shown');
    INSERT INTO personal_cellar_items (id, owner_user_id, name, grams) VALUES
      ('chest-mine', 'reader', 'My Liu Bao', 100),
      ('chest-theirs', 'other', 'Their Dancong', 50);
  `);
});
afterEach(() => database.close());

const env = (open = true) => ({ DB: database as unknown as D1Database, FAVOURITES_OPEN: open ? 'true' : 'false' });

function call(method: string, path: string, user: string | null, body?: unknown, open = true) {
  const routes = favouritesRoutes({
    requireUser: async request => {
      const id = request.headers.get('x-user');
      return id ? { userId: id } : { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
    },
  });
  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method) continue;
    const want = pattern.split('/');
    const have = path.split('/');
    if (want.length !== have.length) continue;
    const params: Record<string, string> = {};
    if (!want.every((part, i) => part.startsWith(':') ? (params[part.slice(1)] = have[i], true) : part === have[i])) continue;
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (user) headers['x-user'] = user;
    return handler(new Request('https://worker.test' + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }), env(open), params);
  }
  throw new Error('no route ' + method + ' ' + path);
}

async function favourites(user: string) {
  const response = await call('GET', '/api/me/favourites', user);
  expect(response.status).toBe(200);
  return response.json() as Promise<{
    articles: Array<{ id: string; path: string }>;
    shop_teas: Array<{ id: string; path: string }>;
    chest_teas: Array<{ id: string }>;
  }>;
}

describe('favourites', () => {
  it('lists the three kinds, the caller\'s own only, and no counts', async () => {
    await call('PUT', '/api/me/favourites/articles/art-open', 'reader');
    await call('PUT', '/api/me/favourites/articles/art-other', 'other');
    await call('PUT', '/api/me/cellar/chest-mine/favourite', 'reader', { favourite: true });
    await call('PUT', '/api/me/cellar/chest-theirs/favourite', 'other', { favourite: true });

    const mine = await favourites('reader');
    expect(mine.articles.map(a => a.id)).toEqual(['art-open']);
    expect(mine.articles[0].path).toBe('/article/water-and-stone');
    expect(mine.shop_teas.map(t => t.id)).toEqual(['tea-shown']);
    expect(mine.shop_teas[0].path).toBe('/shop/product/old-tree-red');
    expect(mine.chest_teas.map(t => t.id)).toEqual(['chest-mine']);
    const keys = JSON.stringify(mine).match(/"[a-z_]+":/g) ?? [];
    expect(keys.filter(key => /count|total|number|keeps/i.test(key))).toEqual([]);
    expect(Object.keys(mine).sort()).toEqual(['articles', 'chest_teas', 'shop_teas']);
  });

  it('keeps and takes off an article, both idempotent', async () => {
    for (let i = 0; i < 2; i++) expect((await call('PUT', '/api/me/favourites/articles/art-open', 'reader')).status).toBe(200);
    expect((await favourites('reader')).articles).toHaveLength(1);
    for (let i = 0; i < 2; i++) expect((await call('DELETE', '/api/me/favourites/articles/art-open', 'reader')).status).toBe(200);
    expect((await favourites('reader')).articles).toHaveLength(0);
  });

  it('refuses a draft article and an unknown one', async () => {
    expect((await call('PUT', '/api/me/favourites/articles/art-draft', 'reader')).status).toBe(404);
    expect((await call('PUT', '/api/me/favourites/articles/nothing', 'reader')).status).toBe(404);
    expect(database.sqlite.prepare('SELECT COUNT(*) AS n FROM favourite_articles').get()).toEqual({ n: 0 });
  });

  it('hides an article kept before it went back to draft', async () => {
    await call('PUT', '/api/me/favourites/articles/art-open', 'reader');
    database.exec(`UPDATE articles SET status = 'draft' WHERE id = 'art-open'`);
    expect((await favourites('reader')).articles).toEqual([]);
  });

  it('never marks or unmarks another person\'s chest tea', async () => {
    const response = await call('PUT', '/api/me/cellar/chest-theirs/favourite', 'reader', { favourite: true });
    expect(response.status).toBe(404);
    expect(database.sqlite.prepare(`SELECT favourite FROM personal_cellar_items WHERE id = 'chest-theirs'`).get())
      .toEqual({ favourite: 0 });
    await call('PUT', '/api/me/cellar/chest-theirs/favourite', 'other', { favourite: true });
    expect((await call('PUT', '/api/me/cellar/chest-theirs/favourite', 'reader', { favourite: false })).status).toBe(404);
    expect(database.sqlite.prepare(`SELECT favourite FROM personal_cellar_items WHERE id = 'chest-theirs'`).get())
      .toEqual({ favourite: 1 });
  });

  it('marks and unmarks the caller\'s own chest tea, and asks for a plain yes or no', async () => {
    expect((await call('PUT', '/api/me/cellar/chest-mine/favourite', 'reader', { favourite: true })).status).toBe(200);
    expect((await favourites('reader')).chest_teas).toHaveLength(1);
    expect((await call('PUT', '/api/me/cellar/chest-mine/favourite', 'reader', { favourite: false })).status).toBe(200);
    expect((await favourites('reader')).chest_teas).toHaveLength(0);
    expect((await call('PUT', '/api/me/cellar/chest-mine/favourite', 'reader', { favourite: 1 })).status).toBe(400);
  });

  it('asks a signed-out caller to sign in', async () => {
    expect((await call('GET', '/api/me/favourites', null)).status).toBe(401);
  });

  it('answers 404 on every route while closed', async () => {
    for (const [method, path, body] of [
      ['GET', '/api/me/favourites', undefined],
      ['PUT', '/api/me/favourites/articles/art-open', undefined],
      ['DELETE', '/api/me/favourites/articles/art-open', undefined],
      ['PUT', '/api/me/cellar/chest-mine/favourite', { favourite: true }],
    ] as const) {
      expect((await call(method, path, 'reader', body, false)).status).toBe(404);
    }
    expect(database.sqlite.prepare('SELECT COUNT(*) AS n FROM favourite_articles').get()).toEqual({ n: 0 });
  });

  it('is wired into the worker and closed there when set to false', async () => {
    const response = await worker.fetch(
      new Request('https://worker.test/api/me/favourites'),
      { DB: database, FAVOURITES_OPEN: 'false' } as unknown as Parameters<typeof worker.fetch>[1],
    );
    expect(response.status).toBe(404);
    const opened = await worker.fetch(
      new Request('https://worker.test/api/me/favourites'),
      { DB: database, FAVOURITES_OPEN: 'true' } as unknown as Parameters<typeof worker.fetch>[1],
    );
    expect(opened.status).toBe(401);
  });

  it('leaves favourite off the owner\'s Tea Chest answer while closed, as main answers', async () => {
    database.exec(`UPDATE personal_cellar_items SET favourite = 1 WHERE id = 'chest-mine'`);
    const token = await signedToken('fav-secret', { sub: 'reader', email: 'reader@test.dev', active_account_id: 'shop', role: 'owner' });
    const chest = async (open?: string) => {
      const response = await worker.fetch(
        new Request('https://worker.test/api/me/cellar', { headers: { Authorization: `Bearer ${token}` } }),
        { DB: database, JWT_SECRET: 'fav-secret', ...(open ? { FAVOURITES_OPEN: open } : {}) } as unknown as Parameters<typeof worker.fetch>[1],
      );
      expect(response.status, await response.clone().text()).toBe(200);
      return ((await response.json()) as { items: Array<Record<string, unknown>> }).items.find(item => item.id === 'chest-mine')!;
    };
    expect(await chest('false')).not.toHaveProperty('favourite');
    expect((await chest('true')).favourite).toBe(true);
  });
});
