import { INWARD_ORDERS_PAUSED_SQL } from '../../shared/catalog/inwardOrders';
import { favouritesOpen } from '../../src/lib/favouritesOpen';

// Launch 4, favourites in three kinds (todo/plans/guests-and-tea-masters-launch-4-run.md, K3).
//
// One page lists what a person has marked, in three kinds that stay separate
// records: articles they kept (favourite_articles), teas the shop has
// (user_favorites, written by the existing heart control), and teas in their
// own Tea Chest they marked (personal_cellar_items.favourite). Everything here
// belongs to the caller alone, and no answer carries a count of any kind.

type FavouritesEnv = { DB: D1Database; FAVOURITES_OPEN?: string };
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
type Deps<E> = {
  requireUser: (request: Request, env: E) => Promise<{ userId: string } | { error: Response }>;
};

function privateJson(value: unknown, status = 200) {
  const response = Response.json(value, { status });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}

const notFound = () => privateJson({ error: 'Not found' }, 404);

const SHOP_FAVOURITE_VISIBLE = `p.is_public = 1 AND p.shown_in_shop = 1 AND p.status IN ('Active', 'Sold Out')
  AND NOT ${INWARD_ORDERS_PAUSED_SQL}`;
const OPEN_SHOP = "a.status = 'active' AND a.public_enabled = 1";

/** Every kind a person has marked, in one answer. */
export async function listFavourites(db: D1Database, userId: string) {
  const [articles, shopTeas, chestTeas] = await Promise.all([
    db.prepare(
      `SELECT a.id, a.slug, a.title, a.subtitle, a.cover_image_url, f.is_public, f.created_at AS kept_at
         FROM favourite_articles f
         JOIN articles a ON a.id = f.article_id AND a.status = 'published'
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC, a.id`
    ).bind(userId).all(),
    db.prepare(
      `SELECT p.id, p.product_name AS name, p.type, p.image_url,
              '/shop/product/' || COALESCE(p.slug, p.id) AS path,
              MIN(uf.created_at) AS kept_at
         FROM user_favorites uf
         JOIN products p ON p.id = uf.item_id AND (uf.account_id IS NULL OR uf.account_id = p.account_id)
         JOIN accounts a ON a.id = p.account_id AND ${OPEN_SHOP}
        WHERE uf.user_id = ?
          AND ${SHOP_FAVOURITE_VISIBLE}
        GROUP BY p.id
        ORDER BY kept_at DESC, p.id`
    ).bind(userId).all(),
    db.prepare(
      `SELECT id, name, type, year, image_url, updated_at
         FROM personal_cellar_items
        WHERE owner_user_id = ? AND favourite = 1
        ORDER BY updated_at DESC, id`
    ).bind(userId).all(),
  ]);
  return {
    articles: (articles.results as any[]).map(row => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle ?? null,
      cover_image_url: row.cover_image_url ?? null,
      path: '/article/' + row.slug,
      is_public: row.is_public === 1,
    })),
    shop_teas: (shopTeas.results as any[]).map(row => ({
      id: row.id,
      name: row.name,
      type: row.type ?? null,
      image_url: row.image_url ?? null,
      path: row.path,
    })),
    chest_teas: (chestTeas.results as any[]).map(row => ({
      id: row.id,
      name: row.name,
      type: row.type ?? null,
      year: row.year ?? null,
      image_url: row.image_url ?? null,
      path: '/account/cellar',
    })),
  };
}

export const FAVOURITE_KINDS = ['article', 'shop_tea', 'chest_tea'] as const;
export type FavouriteKind = typeof FAVOURITE_KINDS[number];

export async function favouriteTarget(db: D1Database, userId: string, kind: FavouriteKind, id: string, kept: boolean) {
  switch (kind) {
    case 'article':
      return db.prepare("SELECT title FROM articles WHERE id = ? AND status = 'published'")
        .bind(id).first<{ title: string }>();
    case 'shop_tea':
      // A previously saved tea can still be removed after it leaves the shop.
      if (!kept) {
        return db.prepare(`SELECT COALESCE(p.product_name, uf.item_id) AS title
          FROM user_favorites uf
          LEFT JOIN (
            SELECT p.id, p.product_name FROM products p JOIN accounts a ON a.id = p.account_id AND ${OPEN_SHOP}
            WHERE ${SHOP_FAVOURITE_VISIBLE}
          ) p ON p.id = uf.item_id
          WHERE uf.user_id = ? AND uf.item_id = ? LIMIT 1`).bind(userId, id).first<{ title: string }>();
      }
      return db.prepare(`SELECT p.product_name AS title FROM products p
        JOIN accounts a ON a.id = p.account_id AND ${OPEN_SHOP}
        WHERE p.id = ? AND ${SHOP_FAVOURITE_VISIBLE}`).bind(id).first<{ title: string }>();
    case 'chest_tea':
      return db.prepare('SELECT name AS title FROM personal_cellar_items WHERE id = ? AND owner_user_id = ?')
        .bind(id, userId).first<{ title: string }>();
  }
}

export async function setFavourite(db: D1Database, userId: string, kind: FavouriteKind, id: string, kept: boolean) {
  switch (kind) {
    case 'article': {
      if (kept) {
        const row = await db.prepare(`INSERT INTO favourite_articles (user_id, article_id)
          SELECT ?, id FROM articles WHERE id = ? AND status = 'published'
          ON CONFLICT(user_id, article_id) DO UPDATE SET article_id = excluded.article_id
          RETURNING article_id`).bind(userId, id).first();
        return Boolean(row);
      }
      if (!await favouriteTarget(db, userId, kind, id, kept)) return false;
      await db.prepare('DELETE FROM favourite_articles WHERE user_id = ? AND article_id = ?').bind(userId, id).run();
      return true;
    }
    case 'shop_tea': {
      if (kept) {
        const row = await db.prepare(`INSERT INTO user_favorites (user_id, account_id, item_id)
          SELECT ?, p.account_id, p.id FROM products p
          JOIN accounts a ON a.id = p.account_id AND ${OPEN_SHOP}
          WHERE p.id = ? AND ${SHOP_FAVOURITE_VISIBLE}
          ON CONFLICT(user_id, account_id, item_id) DO UPDATE SET item_id = excluded.item_id
          RETURNING item_id`).bind(userId, id).first();
        return Boolean(row);
      }
      // The older shop heart stored account-less rows as well as shop-scoped ones.
      const result = await db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND item_id = ?').bind(userId, id).run();
      return Boolean(result.meta?.changes);
    }
    case 'chest_tea': {
      const result = await db.prepare('UPDATE personal_cellar_items SET favourite = ? WHERE id = ? AND owner_user_id = ?')
        .bind(kept ? 1 : 0, id, userId).run();
      return Boolean(result.meta?.changes);
    }
  }
}

export function favouritesRoutes<E extends FavouritesEnv>(deps: Deps<E>): [string, string, Handler<E>][] {
  const signedIn = async (request: Request, env: E) => {
    if (!favouritesOpen(env)) return { error: notFound() };
    return deps.requireUser(request, env);
  };

  const list: Handler<E> = async (request, env) => {
    const user = await signedIn(request, env);
    if ('error' in user) return user.error;
    return privateJson(await listFavourites(env.DB, user.userId));
  };

  const keepArticle = (kept: boolean): Handler<E> => async (request, env, { id }) => {
    const user = await signedIn(request, env);
    if ('error' in user) return user.error;
    if (!await setFavourite(env.DB, user.userId, 'article', id, kept)) return notFound();
    return privateJson({ kept });
  };

  const markChestTea: Handler<E> = async (request, env, { id }) => {
    const user = await signedIn(request, env);
    if ('error' in user) return user.error;
    const body = await request.json().catch(() => null) as { favourite?: unknown } | null;
    if (typeof body?.favourite !== 'boolean') {
      return privateJson({ error: 'Say favourite: true or false.' }, 400);
    }
    if (!await setFavourite(env.DB, user.userId, 'chest_tea', id, body.favourite)) return notFound();
    return privateJson({ id, favourite: body.favourite });
  };

  return [
    ['GET', '/api/me/favourites', list],
    ['PUT', '/api/me/favourites/articles/:id', keepArticle(true)],
    ['DELETE', '/api/me/favourites/articles/:id', keepArticle(false)],
    ['PUT', '/api/me/cellar/:id/favourite', markChestTea],
  ];
}
