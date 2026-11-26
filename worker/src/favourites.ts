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

/** Every kind a person has marked, in one answer. */
async function listFavourites(db: D1Database, userId: string) {
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
         JOIN accounts a ON a.id = p.account_id AND a.status = 'active' AND a.public_enabled = 1
        WHERE uf.user_id = ?
          AND p.is_public = 1 AND p.shown_in_shop = 1 AND p.status IN ('Active', 'Sold Out')
          AND NOT ${INWARD_ORDERS_PAUSED_SQL}
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

  const keepArticle: Handler<E> = async (request, env, { id }) => {
    const user = await signedIn(request, env);
    if ('error' in user) return user.error;
    const article = await env.DB.prepare(`SELECT id FROM articles WHERE id = ? AND status = 'published'`)
      .bind(id).first<{ id: string }>();
    if (!article) return notFound();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO favourite_articles (user_id, article_id) VALUES (?, ?)`
    ).bind(user.userId, article.id).run();
    return privateJson({ kept: true });
  };

  const unkeepArticle: Handler<E> = async (request, env, { id }) => {
    const user = await signedIn(request, env);
    if ('error' in user) return user.error;
    const article = await env.DB.prepare(`SELECT id FROM articles WHERE id = ? AND status = 'published'`)
      .bind(id).first<{ id: string }>();
    if (!article) return notFound();
    await env.DB.prepare(`DELETE FROM favourite_articles WHERE user_id = ? AND article_id = ?`)
      .bind(user.userId, article.id).run();
    return privateJson({ kept: false });
  };

  const markChestTea: Handler<E> = async (request, env, { id }) => {
    const user = await signedIn(request, env);
    if ('error' in user) return user.error;
    const body = await request.json().catch(() => null) as { favourite?: unknown } | null;
    if (typeof body?.favourite !== 'boolean') {
      return privateJson({ error: 'Say favourite: true or false.' }, 400);
    }
    const saved = await env.DB.prepare(
      `UPDATE personal_cellar_items SET favourite = ? WHERE id = ? AND owner_user_id = ?`
    ).bind(body.favourite ? 1 : 0, id, user.userId).run();
    if (!saved.meta.changes) return notFound();
    return privateJson({ id, favourite: body.favourite });
  };

  return [
    ['GET', '/api/me/favourites', list],
    ['PUT', '/api/me/favourites/articles/:id', keepArticle],
    ['DELETE', '/api/me/favourites/articles/:id', unkeepArticle],
    ['PUT', '/api/me/cellar/:id/favourite', markChestTea],
  ];
}
