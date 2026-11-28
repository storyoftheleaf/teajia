// Pouring at a host's own table (Adrian, 2026-11-28).
//
// The pour page, opened from a table, pours into that table: each tea tapped
// joins the table's own tea list in pouring order, with its weight. The table
// is the sit; its tea space gives the way in; the pours are its teas.
//
// Where the grams come from depends on who pours:
//   the shop's shelf   for someone who runs the shop's sessions, or a person
//                      the shop's owner named as a pourer (shop_pourers). The
//                      stock record carries their name and the table. They see
//                      names and weights, never a cost.
//   their own chest    for every host: the teas of the table's own account.
//   a typed name       for anything else; no stock moves.
//
// The table lives in the host's own account and the shelf in the shop's, so a
// row in event_tea_menu here may point at a product of another account. The
// row always keeps the tea's name, and what guests may open stays decided by
// crossShopTeaSql (hostTableTeas.ts): a tea the shop has not released reads as
// its name alone.

import { chestTeaSql } from './hostTableTeas';
import { POUR_NAME_MAX, pouredGrams, returnStock, shelfTeas, takeStock } from './pourSit';
import { sessionInstant } from '../../shared/sessionEnd';

type Env = { DB: D1Database };
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
type Table = { id: string; account_id: string; title: string; event_date: string; timezone: string | null; lifecycle_status: string };
type Pourer = { userId: string; email?: string | null; name?: string | null };

type Deps<E> = {
  /** The caller's own table, or the refusal. */
  requireOwnTable: (request: Request, env: E, tableId: string) => Promise<{ host: Pourer; table: Table } | { error: Response }>;
  /**
   * The shop whose shelf this person may pour from; null when none. `priced` shows its prices, and `weighs`
   * lets a pour take grams off it (the shop's stock rule, pourSit.ts, or the owner's naming).
   */
  shopShelf: (env: E, userId: string) => Promise<{ accountId: string; priced: boolean; weighs: boolean } | null>;
  /** The shop's owner, for naming pourers. */
  requireShopOwner: (request: Request, env: E) => Promise<{ accountId: string; userId?: string | null } | { error: Response }>;
};

function reply(value: unknown, status = 200) {
  const response = Response.json(value, { status });
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
const refuse = (error: string, code: string, status = 400) => reply({ error, code }, status);
const stockRefusal = () => refuse('Only the stock owner, staff with Stock permission or a named pourer can change these grams.', 'pour_stock_permission', 403);

/** Whether this person is one the shop's owner named to pour its tea. */
export async function isNamedPourer(db: D1Database, accountId: string, userId: string): Promise<boolean> {
  return Boolean(await db.prepare('SELECT 1 FROM shop_pourers WHERE account_id = ? AND user_id = ?').bind(accountId, userId).first());
}

async function tableSit(db: D1Database, table: Table, shop: { accountId: string; weighs: boolean } | null) {
  const shopId = shop?.accountId ?? null;
  const { results } = await db.prepare(
    `SELECT m.id, m.product_id,
            COALESCE(NULLIF(trim(m.custom_name), ''), NULLIF(trim(p.given_name), ''), NULLIF(trim(p.product_name), '')) AS name,
            m.poured_grams, m.stock_taken_grams, p.image_url, p.stock_grams, p.account_id AS shelf
       FROM event_tea_menu m
       LEFT JOIN products p ON p.id = m.product_id AND p.account_id IN (m.account_id, ?3)
      WHERE m.account_id = ?1 AND m.event_id = ?2 AND m.poured_at IS NOT NULL
      ORDER BY m.poured_at ASC, m.brew_order ASC, m.id ASC`,
  ).bind(table.account_id, table.id, shopId ?? table.account_id).all<{
    id: string; product_id: string | null; name: string | null; poured_grams: number | null;
    stock_taken_grams: number | null; image_url: string | null; stock_grams: number | null; shelf: string | null;
  }>();
  const start = sessionInstant(table.event_date, table.timezone);
  return {
    id: table.id, title: table.title, date: table.event_date, timezone: table.timezone, casual: false,
    happened: table.lifecycle_status === 'completed' || table.lifecycle_status === 'archived' || (start !== null && start.at <= Date.now()),
    link: null, note: null, place: null, has_way: false, way_open: false,
    teas: results.map(row => ({
      id: row.id, product_id: row.product_id, name: row.name ?? '', grams: row.poured_grams,
      short: row.poured_grams !== null && row.product_id !== null && Number(row.stock_taken_grams ?? 0) < row.poured_grams,
      // Grams taken off the shop's shelf go back only by someone who may still move them.
      can_take_back: !(Number(row.stock_taken_grams ?? 0) > 0 && row.shelf !== null && row.shelf !== table.account_id) || shop?.weighs === true,
      image_url: row.image_url, stock_grams: row.stock_grams,
    })),
  };
}

export function tablePourRoutes<E extends Env>(deps: Deps<E>): [string, string, Handler<E>][] {
  // GET /api/me/tables/:id/pour: the shelves this host pours from, and what the table has been poured.
  const open: Handler<E> = async (request, env, { id }) => {
    const own = await deps.requireOwnTable(request, env, id);
    if ('error' in own) return own.error;
    const shop = await deps.shopShelf(env, own.host.userId);
    const [shopTeas, chestTeas] = await Promise.all([
      shop && shop.accountId !== own.table.account_id ? shelfTeas(env, shop.accountId, shop.priced) : Promise.resolve([]),
      shelfTeas(env, own.table.account_id, false),
    ]);
    return reply({
      teas: [
        ...shopTeas.map(tea => ({ ...tea, shelf: 'shop', can_deduct: shop?.weighs === true })),
        ...chestTeas.map(tea => ({ ...tea, shelf: 'chest', can_deduct: true })),
      ],
      sit: await tableSit(env.DB, own.table, shop),
    });
  };

  // POST /api/me/tables/:id/pour { product_id? | name?, grams? }: one tea poured at this table.
  const pour: Handler<E> = async (request, env, { id }) => {
    const own = await deps.requireOwnTable(request, env, id);
    if ('error' in own) return own.error;
    const { table, host } = own;
    if (table.lifecycle_status === 'cancelled') return refuse('This table was called off.', 'pour_table', 409);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const grams = pouredGrams(body?.grams);
    if (grams !== null && typeof grams === 'object') return refuse(grams.refused, 'pour_grams');
    const shop = await deps.shopShelf(env, host.userId);
    const shopId = shop && shop.accountId !== table.account_id ? shop.accountId : null;

    const productId = typeof body?.product_id === 'string' && body.product_id ? body.product_id : null;
    let teaName = typeof body?.name === 'string' ? body.name.trim() : '';
    // Which shelf the tea is on: the shop's, for someone who may pour from it, or the host's own chest.
    let shelf: string | null = null;
    if (productId) {
      const product = await env.DB.prepare(
        `SELECT p.account_id, COALESCE(NULLIF(trim(p.given_name), ''), p.product_name) AS name FROM products p
          WHERE p.id = ?1 AND p.personal_offer_source_id IS NULL AND COALESCE(p.status, 'Active') <> 'Archived'
            AND ((p.account_id = ?2 AND p.type NOT IN ('Teaware', 'Misc')) OR (p.account_id = ?3 AND ${chestTeaSql('p')}))`,
      ).bind(productId, shopId ?? '', table.account_id).first<{ account_id: string; name: string }>();
      if (!product) return refuse('That tea is not on a shelf you pour from.', 'pour_tea', 404);
      shelf = product.account_id;
      teaName = product.name;
    }
    if (!teaName || teaName.length > POUR_NAME_MAX) return refuse('Choose a tea, or type its name.', 'pour_tea');
    if (grams !== null && shelf !== null && shelf === shopId && !shop?.weighs) return stockRefusal();

    // A tea the host planned for this table and has not poured yet is the one poured; otherwise it joins the end.
    const planned = productId ? await env.DB.prepare(
      `SELECT id FROM event_tea_menu WHERE event_id = ? AND account_id = ? AND product_id = ? AND poured_at IS NULL
        ORDER BY brew_order IS NULL, brew_order, created_at, id LIMIT 1`,
    ).bind(table.id, table.account_id, productId).first<{ id: string }>() : null;
    const menuId = planned?.id ?? crypto.randomUUID();
    if (planned) {
      await env.DB.prepare(
        `UPDATE event_tea_menu SET poured_at = datetime('now', '+1 second'), poured_grams = ? WHERE id = ? AND event_id = ? AND account_id = ?`,
      ).bind(grams, menuId, table.id, table.account_id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order, poured_grams, created_at, poured_at)
         SELECT ?, ?, ?, ?, ?, COALESCE(MAX(brew_order), 0) + 1, ?, datetime('now'), datetime('now')
           FROM event_tea_menu WHERE event_id = ? AND account_id = ?`,
      ).bind(menuId, table.account_id, table.id, productId, teaName, grams, table.id, table.account_id).run();
    }
    if (productId && shelf && grams !== null) {
      const taken = await takeStock(env.DB, { accountId: shelf, email: host.email }, productId, grams, table.title, {
        by: shelf === shopId ? (host.name?.trim() || host.email || null) : null,
        // A host's own chest tea is never put on or off sale by a pour.
        sellsOut: shelf === shopId,
      });
      await env.DB.prepare('UPDATE event_tea_menu SET stock_taken_grams = ? WHERE id = ? AND account_id = ?')
        .bind(taken, menuId, table.account_id).run();
    }
    return reply({ poured: menuId, sit: await tableSit(env.DB, table, shop) }, 201);
  };

  // DELETE /api/me/tables/:id/pour/:menuId: the wrong tea was tapped. The grams
  // go back on the shelf they came from. A tea the pour itself added leaves the
  // table; a tea the host had planned stays, unpoured.
  const unpour: Handler<E> = async (request, env, { id, menuId }) => {
    const own = await deps.requireOwnTable(request, env, id);
    if ('error' in own) return own.error;
    const { table, host } = own;
    const row = await env.DB.prepare(
      `SELECT m.product_id, m.stock_taken_grams, (m.created_at = m.poured_at) AS added, p.account_id AS shelf,
              (SELECT COUNT(*) FROM event_tasting_notes n WHERE n.tea_menu_id = m.id) AS written
         FROM event_tea_menu m LEFT JOIN products p ON p.id = m.product_id
        WHERE m.id = ? AND m.event_id = ? AND m.account_id = ? AND m.poured_at IS NOT NULL`,
    ).bind(menuId, table.id, table.account_id).first<{
      product_id: string | null; stock_taken_grams: number | null; added: number; shelf: string | null; written: number;
    }>();
    if (!row) return refuse('That pour could not be found.', 'pour_not_found', 404);
    const shop = await deps.shopShelf(env, host.userId);
    const back = Number(row.stock_taken_grams ?? 0);
    if (back > 0 && row.shelf !== null && row.shelf !== table.account_id && !shop?.weighs) return stockRefusal();
    // A tea a guest has written about stays on the table, so their words keep the tea they were about.
    if (Number(row.added) === 1 && Number(row.written) === 0) {
      await env.DB.prepare('DELETE FROM event_tea_menu WHERE id = ? AND event_id = ? AND account_id = ?')
        .bind(menuId, table.id, table.account_id).run();
    } else {
      await env.DB.prepare(
        'UPDATE event_tea_menu SET poured_at = NULL, poured_grams = NULL, stock_taken_grams = NULL WHERE id = ? AND event_id = ? AND account_id = ?',
      ).bind(menuId, table.id, table.account_id).run();
    }
    if (row.shelf) await returnStock(env.DB, { accountId: row.shelf, email: host.email }, row.product_id, back);
    return reply({ sit: await tableSit(env.DB, table, shop) });
  };

  // GET /api/admin/pour/pourers: the people this shop's owner has named to pour its tea.
  const pourers: Handler<E> = async (request, env) => {
    const owner = await deps.requireShopOwner(request, env);
    if ('error' in owner) return owner.error;
    return reply({ pourers: await namedPourers(env.DB, owner.accountId) });
  };

  // POST /api/admin/pour/pourers { email }: name a person who already has an account.
  const namePourer: Handler<E> = async (request, env) => {
    const owner = await deps.requireShopOwner(request, env);
    if ('error' in owner) return owner.error;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!email || email.length > 320) return refuse('Type their email.', 'pourer_email');
    const user = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?').bind(email).first<{ id: string }>();
    if (!user) return refuse('Nobody has signed up with that email yet.', 'pourer_unknown', 404);
    await env.DB.prepare('INSERT OR IGNORE INTO shop_pourers (account_id, user_id, named_by_user_id) VALUES (?, ?, ?)')
      .bind(owner.accountId, user.id, owner.userId ?? null).run();
    return reply({ pourers: await namedPourers(env.DB, owner.accountId) }, 201);
  };

  // DELETE /api/admin/pour/pourers/:userId: they no longer pour this shop's tea.
  const unnamePourer: Handler<E> = async (request, env, { userId }) => {
    const owner = await deps.requireShopOwner(request, env);
    if ('error' in owner) return owner.error;
    await env.DB.prepare('DELETE FROM shop_pourers WHERE account_id = ? AND user_id = ?').bind(owner.accountId, userId).run();
    return reply({ pourers: await namedPourers(env.DB, owner.accountId) });
  };

  return [
    ['GET', '/api/me/tables/:id/pour', open],
    ['POST', '/api/me/tables/:id/pour', pour],
    ['DELETE', '/api/me/tables/:id/pour/:menuId', unpour],
    ['GET', '/api/admin/pour/pourers', pourers],
    ['POST', '/api/admin/pour/pourers', namePourer],
    ['DELETE', '/api/admin/pour/pourers/:userId', unnamePourer],
  ];
}

async function namedPourers(db: D1Database, accountId: string) {
  const { results } = await db.prepare(
    `SELECT u.id, u.name, u.email FROM shop_pourers s JOIN users u ON u.id = s.user_id
      WHERE s.account_id = ? ORDER BY s.created_at, u.id`,
  ).bind(accountId).all<{ id: string; name: string | null; email: string }>();
  return results.map(row => ({ id: row.id, name: row.name?.trim() || row.email, email: row.email }));
}
