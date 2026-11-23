import { readPersonalTeaMoney } from '../../src/lib/personalTeaMoney';
import { normalizeShelfWhatsApp } from '../../shared/shelfContact';

interface OfferSnapshot {
  name: string;
  grams: number;
  type: string | null;
  year: number | null;
  origin: string | null;
  priceAmount: number;
  priceCurrency: string;
}

interface ShelfRow {
  shelf_title: string | null;
  seller_name: string | null;
  shelf_whatsapp: string | null;
  contributor_slug: string | null;
  store_slug: string | null;
  item_id: string | null;
  name: string | null;
  grams: number | null;
  type: string | null;
  year: number | null;
  origin: string | null;
  price_amount: number | null;
  price_currency: string | null;
}

export function readOfferInput(body: unknown): OfferSnapshot | null {
  if (!body || typeof body !== 'object') return null;
  const { name, grams, type, year, origin, price_amount, price_currency } = body as Record<string, unknown>;
  const price = readPersonalTeaMoney(price_amount, price_currency);
  if (!price || price.amount <= 0) return null;
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120
    || typeof grams !== 'number' || !Number.isFinite(grams) || grams <= 0
    || (type != null && (typeof type !== 'string' || type.trim().length > 40))
    || (year != null && (typeof year !== 'number' || !Number.isInteger(year) || year < 1000 || year > 9999))
    || (origin != null && (typeof origin !== 'string' || origin.trim().length > 100))) return null;
  return {
    name: name.trim(), grams, priceAmount: price.amount, priceCurrency: price.currency,
    type: typeof type === 'string' ? type.trim() || null : null,
    year: year ?? null,
    origin: typeof origin === 'string' ? origin.trim() || null : null,
  };
}

// Queries use the aliases u (seller) and c (holding). A legacy shelf flag by
// itself conveys no approval of the inherited name, weight, or photo.
export const recordedChestCostSql = `
  c.chest_cost_amount IS NOT NULL AND c.chest_cost_amount >= 0 AND c.chest_cost_currency IS NOT NULL
`;

export const approvedShelfOfferSql = `
  c.shelf_published = 1 AND c.placement_status = 'private'
  AND c.shelf_offer_name IS NOT NULL AND (${recordedChestCostSql})
  AND c.shelf_offer_price_amount IS NOT NULL AND c.shelf_offer_price_amount > 0
  AND c.shelf_offer_price_currency IS NOT NULL
  AND c.shelf_offer_grams > 0 AND c.shelf_offer_grams <= c.grams
`;

export const shelfContactSql = `
  length(u.shelf_whatsapp) BETWEEN 7 AND 15
  AND u.shelf_whatsapp GLOB '[1-9]*'
  AND u.shelf_whatsapp NOT GLOB '*[^0-9]*'
`;

export async function getOrderableShelfSlug(db: D1Database, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const seller = await db.prepare(`
    SELECT u.shelf_slug FROM users u
    WHERE u.id = ? AND u.shelf_enabled = 1 AND u.shelf_slug <> '' AND (${shelfContactSql})
      AND NOT EXISTS (SELECT 1 FROM accounts WHERE personal_inventory_user_id = u.id)
      AND EXISTS (
        SELECT 1 FROM personal_cellar_items c
        WHERE c.owner_user_id = u.id AND (${approvedShelfOfferSql})
      )
  `).bind(userId).first<{ shelf_slug: string }>();
  return seller?.shelf_slug ?? null;
}

export async function getPublicShelf(db: D1Database, slug: string) {
  // One statement gives the buyer a consistent snapshot of contact and stock.
  const { results } = await db.prepare(`
    SELECT u.shelf_title, u.name AS seller_name, CASE WHEN a.id IS NULL THEN u.shelf_whatsapp END AS shelf_whatsapp,
           CASE WHEN a.status = 'active' AND a.public_enabled = 1 AND a.owner_user_id = u.id
             AND EXISTS (SELECT 1 FROM account_members m WHERE m.account_id = a.id AND m.user_id = u.id
               AND m.status = 'active' AND m.role = 'owner') THEN a.slug END AS store_slug,
           (SELECT id FROM contributors WHERE user_id = u.id AND is_published = 1 ORDER BY id LIMIT 1) AS contributor_slug,
           c.id AS item_id, c.shelf_offer_name AS name, c.shelf_offer_grams AS grams,
           c.shelf_offer_type AS type, c.shelf_offer_year AS year, c.shelf_offer_origin AS origin,
           c.shelf_offer_price_amount AS price_amount, c.shelf_offer_price_currency AS price_currency
    FROM users u
    LEFT JOIN accounts a ON a.personal_inventory_user_id = u.id
    LEFT JOIN personal_cellar_items c
      ON a.id IS NULL AND c.owner_user_id = u.id AND (${approvedShelfOfferSql}) AND (${shelfContactSql})
    WHERE u.shelf_slug = ? AND u.shelf_enabled = 1
    ORDER BY c.created_at DESC, c.id
  `).bind(slug).all<ShelfRow>();
  const seller = results[0];
  if (!seller) return null;
  return {
    slug,
    ...(seller.store_slug ? { store_slug: seller.store_slug } : {}),
    title: seller.shelf_title,
    seller_name: seller.seller_name,
    ...(seller.contributor_slug ? { contributor_slug: seller.contributor_slug } : {}),
    whatsapp: normalizeShelfWhatsApp(seller.shelf_whatsapp),
    items: results.flatMap(row => row.item_id && row.name !== null && row.grams !== null
      && row.price_amount !== null && row.price_currency !== null ? [{
      id: row.item_id,
      name: row.name,
      type: row.type,
      year: row.year,
      origin: row.origin,
      grams: row.grams,
      image_url: null,
      price_amount: row.price_amount,
      price_currency: row.price_currency,
    }] : []),
  };
}
