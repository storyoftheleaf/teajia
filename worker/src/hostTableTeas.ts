// A tea for the table (Launch 2, slice H6:
// todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H6" and hard
// question 7).
//
// A host lists teas on one of their own tables. A tea is one of three things:
//   shop  a tea of Teajia's shop (the platform owner's account), and only one
//         that is public, active and shown in the shop;
//   chest a tea in the host's own Tea Chest (a product of the table's own
//         personal account);
//   name  anything else, the words the host typed.
// The row in event_tea_menu always keeps the tea's name in custom_name, so a
// tea that later leaves the shop, or that never could be linked, stays a
// plain name everywhere it is read.
//
// Nothing here carries a price, stock or cost: the host's screen shows none.
// Every function takes the table that requireOwnHostedTable (index.ts)
// already proved is the caller's own.

import { INWARD_ORDERS_PAUSED_SQL } from '../../shared/catalog/inwardOrders';

export type TableTeaSource = 'shop' | 'chest' | 'name';

export type HostTableTea = {
  id: string;
  name: string;
  source: TableTeaSource;
  /** Set for a shop or chest tea that still resolves; never for a plain name. */
  product_id: string | null;
  brew_order: number | null;
  /** "Where it is from", in the host's words. */
  from: string | null;
  /** The host's own photograph of the tea, framed in the shared photo editor. */
  photo_url: string | null;
};

export type TableTeaMatch = { source: 'shop' | 'chest'; id: string; name: string; type: string | null; year: string | null };

type Table = { id: string; account_id: string };

export const TABLE_TEA_NAME_MAX = 240;
export const TABLE_TEA_FROM_MAX = 200;
export const TABLE_TEAS_MAX = 30;
export const TABLE_TEA_SEARCH_LIMIT = 5;

/**
 * A product of Teajia's own shop that any session may point at: the platform
 * owner's active, public account, and the product public, active, shown in
 * the shop and a tea. The one door across accounts (hard question 7).
 */
export function crossShopTeaSql(product: string): string {
  return `(${product}.status = 'Active' AND ${product}.is_public = 1 AND ${product}.shown_in_shop = 1
    AND COALESCE(${product}.type, '') NOT IN ('Teaware', 'Misc')
    AND EXISTS (SELECT 1 FROM accounts shop_account WHERE shop_account.id = ${product}.account_id
      AND shop_account.is_platform_owner = 1 AND shop_account.status = 'active' AND shop_account.public_enabled = 1))`;
}

/** A tea of the table's own account that the host may list: their Tea Chest, never teaware. */
export function chestTeaSql(product: string): string {
  return `(COALESCE(${product}.type, '') NOT IN ('Teaware', 'Misc') AND COALESCE(${product}.status, '') NOT IN ('Archived', 'Deleted'))`;
}

const teaName = (product: string) =>
  `COALESCE(NULLIF(trim(${product}.given_name), ''), NULLIF(trim(${product}.product_name), ''))`;

/**
 * The two joins every reader of a session's tea menu uses: the session's own
 * account (`own`) and Teajia's shop (`shop`). Anything else joins nothing, so
 * the menu row is read as its plain name.
 */
export function menuProductJoins(menu: string, account = `${menu}.account_id`): string {
  return `LEFT JOIN products own ON own.id = ${menu}.product_id AND own.account_id = ${account}
    LEFT JOIN products shop ON shop.id = ${menu}.product_id AND shop.account_id <> ${account} AND ${crossShopTeaSql('shop')}`;
}

/** The shop page of a Teajia tea, the same address resolveSessionTeas gives. */
export function shopTeaPath(address: string, store: string | null): string {
  const path = `/shop/product/${encodeURIComponent(address)}`;
  return store ? `${path}?store=${encodeURIComponent(store)}` : path;
}

/** The SQL columns that give a shop tea its address: its slug or id, and the store's slug. */
export function shopTeaAddressColumns(): string {
  return `COALESCE(NULLIF(trim(shop.slug), ''), shop.id) AS shop_address,
    (SELECT sa.slug FROM accounts sa WHERE sa.id = shop.account_id) AS shop_store`;
}

/**
 * Search offers only the shop teas the shop's browse list shows: in stock (or
 * the one lot whose orders are paused, which the browse list keeps), the same
 * rule as fetchPublicProductsForAccount in index.ts (audit A2 F9). A listed
 * tea that later sells out still resolves on the table, as it does by address.
 */
const SHOP_BROWSE_STOCK_SQL = `(${INWARD_ORDERS_PAUSED_SQL} OR COALESCE(p.stock_grams, 0) > 0)`;

/** Up to five teas whose name holds what the host typed: Teajia's shop first, then their own chest. */
export async function searchTableTeas(db: D1Database, table: Table, query: string): Promise<TableTeaMatch[]> {
  const words = query.trim().slice(0, 80);
  if (words.length < 2) return [];
  const like = `%${words.replace(/[\\%_]/g, char => `\\${char}`)}%`;
  const matches = (product: string) => `(${teaName(product)} LIKE ?1 ESCAPE '\\' OR ${product}.chinese_name LIKE ?1 ESCAPE '\\')`;
  const [shop, chest] = await db.batch([
    db.prepare(`SELECT p.id, ${teaName('p')} AS name, p.type, p.year FROM products p
      WHERE p.account_id <> ?2 AND ${crossShopTeaSql('p')} AND ${SHOP_BROWSE_STOCK_SQL} AND ${teaName('p')} IS NOT NULL AND ${matches('p')}
      ORDER BY ${teaName('p')} COLLATE NOCASE, p.id LIMIT ${TABLE_TEA_SEARCH_LIMIT}`).bind(like, table.account_id),
    db.prepare(`SELECT p.id, ${teaName('p')} AS name, p.type, p.year FROM products p
      WHERE p.account_id = ?2 AND ${chestTeaSql('p')} AND ${teaName('p')} IS NOT NULL AND ${matches('p')}
      ORDER BY ${teaName('p')} COLLATE NOCASE, p.id LIMIT ${TABLE_TEA_SEARCH_LIMIT}`).bind(like, table.account_id),
  ]);
  type Row = { id: string; name: string; type: string | null; year: number | string | null };
  const read = (source: 'shop' | 'chest') => (row: Row): TableTeaMatch => ({
    source, id: row.id, name: row.name, type: row.type || null,
    year: row.year == null || row.year === '' ? null : String(row.year),
  });
  return [
    ...(shop.results as Row[]).map(read('shop')),
    ...(chest.results as Row[]).map(read('chest')),
  ].slice(0, TABLE_TEA_SEARCH_LIMIT);
}

/** The teas on one of the host's tables, in pouring order, for the host. No price, stock or cost. */
export async function hostTableTeas(db: D1Database, table: Table): Promise<HostTableTea[]> {
  const { results } = await db.prepare(`
    SELECT m.id, m.brew_order, m.custom_description, m.photo_url,
           COALESCE(NULLIF(trim(m.custom_name), ''), ${teaName('own')}, ${teaName('shop')}) AS name,
           CASE WHEN own.id IS NOT NULL AND ${chestTeaSql('own')} THEN 'chest' WHEN shop.id IS NOT NULL THEN 'shop' ELSE 'name' END AS source,
           CASE WHEN own.id IS NOT NULL AND ${chestTeaSql('own')} THEN own.id ELSE shop.id END AS product_id
      FROM event_tea_menu m
      ${menuProductJoins('m')}
     WHERE m.event_id = ? AND m.account_id = ?
     ORDER BY m.brew_order IS NULL, m.brew_order, m.created_at, m.id
  `).bind(table.id, table.account_id).all<Record<string, unknown>>();
  return results
    .filter(row => typeof row.name === 'string' && row.name.trim())
    .map(row => ({
      id: String(row.id),
      name: String(row.name).trim(),
      source: row.source as TableTeaSource,
      product_id: row.source === 'name' ? null : (row.product_id as string | null),
      brew_order: row.brew_order == null ? null : Number(row.brew_order),
      from: typeof row.custom_description === 'string' && row.custom_description.trim() ? row.custom_description.trim() : null,
      photo_url: typeof row.photo_url === 'string' && row.photo_url ? row.photo_url : null,
    }));
}

export type TableTeaInput = {
  id: string | null;
  source: TableTeaSource;
  product_id: string | null;
  name: string;
  from: string | null;
  photo_url: string | null;
};

type Refusal = { refused: { status: number; code: string; error: string } };
const refuse = (error: string, code = 'table_teas_invalid', status = 400): Refusal => ({ refused: { status, code, error } });
const words = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

/** Where a host's tea photograph is kept: under the table's own account, one folder per table. */
export function tableTeaPhotoPrefix(table: Table): string {
  return `accounts/${table.account_id}/host-teas/${table.id}/`;
}

const MEDIA_ORIGIN = 'https://media.teajia.co/';

/** A photograph address is kept only when it is one this table's own upload gave. */
function ownPhotoUrl(table: Table, value: unknown): string | null | Refusal {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.length > 500 || !value.startsWith(`${MEDIA_ORIGIN}${tableTeaPhotoPrefix(table)}`)) {
    return refuse('That photograph was not added to this table.', 'table_tea_photo');
  }
  return value;
}

/** Read the whole list the host saves, in pouring order. */
export function readTableTeas(table: Table, body: unknown): TableTeaInput[] | Refusal {
  const list = body && typeof body === 'object' ? (body as { teas?: unknown }).teas : null;
  if (!Array.isArray(list)) return refuse('Send the teas as a list.');
  if (list.length > TABLE_TEAS_MAX) return refuse(`A table lists up to ${TABLE_TEAS_MAX} teas.`);
  const seen = new Set<string>();
  const teas: TableTeaInput[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') return refuse('Each tea needs a name.');
    const item = raw as Record<string, unknown>;
    const source = item.source === 'shop' || item.source === 'chest' ? item.source : 'name';
    const name = words(item.name);
    if (!name) return refuse('Each tea needs a name.');
    if (name.length > TABLE_TEA_NAME_MAX) return refuse(`Keep a tea’s name under ${TABLE_TEA_NAME_MAX} characters.`);
    const from = words(item.from);
    if (from.length > TABLE_TEA_FROM_MAX) return refuse(`Keep “Where it is from” under ${TABLE_TEA_FROM_MAX} characters.`);
    const photo = ownPhotoUrl(table, item.photo_url);
    if (photo && typeof photo === 'object') return photo;
    const id = typeof item.id === 'string' && item.id ? item.id : null;
    if (id) {
      if (seen.has(id)) return refuse('A tea is listed twice.');
      seen.add(id);
    }
    const productId = source !== 'name' && typeof item.product_id === 'string' && item.product_id ? item.product_id : null;
    teas.push({ id, source: productId ? source : 'name', product_id: productId, name, from: from || null, photo_url: photo });
  }
  return teas;
}

/**
 * Save the table's teas in the order given. A shop tea must still be one of
 * Teajia's public teas and a chest tea one of the table's own; any other id
 * is dropped and the tea is kept as its name, never linked. Teas left out of
 * the list are taken off the table. A shop or chest tea keeps its record's
 * own name, so the name a guest reads is always the tea's.
 */
export async function saveTableTeas(db: D1Database, table: Table, teas: TableTeaInput[]) {
  const shopIds = [...new Set(teas.filter(tea => tea.source === 'shop').map(tea => tea.product_id!))];
  const chestIds = [...new Set(teas.filter(tea => tea.source === 'chest').map(tea => tea.product_id!))];
  const marks = (ids: string[]) => ids.map(() => '?').join(',');
  const named = new Map<string, string>();
  if (shopIds.length) {
    const { results } = await db.prepare(`SELECT p.id, ${teaName('p')} AS name FROM products p
      WHERE p.id IN (${marks(shopIds)}) AND p.account_id <> ? AND ${crossShopTeaSql('p')}`)
      .bind(...shopIds, table.account_id).all<{ id: string; name: string | null }>();
    for (const row of results) named.set(`shop:${row.id}`, row.name ?? '');
  }
  if (chestIds.length) {
    const { results } = await db.prepare(`SELECT p.id, ${teaName('p')} AS name FROM products p
      WHERE p.id IN (${marks(chestIds)}) AND p.account_id = ? AND ${chestTeaSql('p')}`)
      .bind(...chestIds, table.account_id).all<{ id: string; name: string | null }>();
    for (const row of results) named.set(`chest:${row.id}`, row.name ?? '');
  }

  const { results: existing } = await db.prepare('SELECT id FROM event_tea_menu WHERE event_id = ? AND account_id = ?')
    .bind(table.id, table.account_id).all<{ id: string }>();
  const kept = new Set(existing.map(row => row.id));

  const statements: D1PreparedStatement[] = [];
  const keptIds = new Set<string>();
  teas.forEach((tea, index) => {
    const key = tea.product_id ? `${tea.source}:${tea.product_id}` : null;
    const linked = key !== null && named.has(key);
    const productId = linked ? tea.product_id : null;
    const name = (linked && named.get(key!)?.trim()) || tea.name;
    const order = index + 1;
    if (tea.id && kept.has(tea.id)) {
      keptIds.add(tea.id);
      statements.push(db.prepare(`UPDATE event_tea_menu SET product_id = ?, custom_name = ?, custom_description = ?, photo_url = ?, brew_order = ?
        WHERE id = ? AND event_id = ? AND account_id = ?`)
        .bind(productId, name, tea.from, tea.photo_url, order, tea.id, table.id, table.account_id));
    } else {
      statements.push(db.prepare(`INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, custom_description, photo_url, reveal_date, brew_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`)
        .bind(crypto.randomUUID(), table.account_id, table.id, productId, name, tea.from, tea.photo_url, order));
    }
  });
  const removed = [...kept].filter(id => !keptIds.has(id));
  if (removed.length) {
    // A tea a guest has already written about stays on the table, so their
    // words keep the tea they were about.
    const written = await db.prepare(`SELECT COUNT(*) AS n FROM event_tasting_notes WHERE tea_menu_id IN (${marks(removed)})`)
      .bind(...removed).first<{ n: number }>();
    if (Number(written?.n ?? 0) > 0) {
      return refuse('A guest has written about a tea you took off, so it stays on the table.', 'table_tea_written', 409);
    }
  }
  for (const id of removed) {
    statements.push(db.prepare('DELETE FROM event_tea_menu WHERE id = ? AND event_id = ? AND account_id = ?').bind(id, table.id, table.account_id));
  }
  if (statements.length) await db.batch(statements);
  return { teas: await hostTableTeas(db, table) };
}
