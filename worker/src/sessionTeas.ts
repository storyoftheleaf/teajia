// A poured tea on a session, as a record a visitor can open.
//
// A session names its teas in pouring order. Each name may point at a real tea:
// a product in the shop that hosted the sit, or a holding in the private Tea
// Chest of someone credited on the sit (a Tea Master's own tea). A plain name
// stays the fallback when no tea record exists.
//
// The price rule is the one the shop already applies. A tea carries an `offer`
// only when its owner marked it for sale: a live listing in a public shop, or
// an open, in-stock personal offer made from the holding. A tea not for sale
// carries no price field at all, and a name-only tea carries its name only.

import type { PublicSessionTea, SessionTeaOffer } from '../../shared/sessionTea';
import { crossShopTeaSql } from './hostTableTeas';

/** One served tea: its id on the sit, and what it points at (a product, or a holding in someone's Tea Chest list). */
export type SessionTeaRef = { menuId: string | null; productId: string | null; name: string; chestId?: string | null };

/** The public product row the shop's own catalogue returns, or null when it is not public. */
export type PublicProductReader = (accountId: string, productId: string) => Promise<Record<string, unknown> | null>;

export type { PublicSessionTea, SessionTeaOffer };

type TeaRow = {
  id: string; account_id: string; slug: string | null; name: string | null;
  year: number | string | null; type: string | null; origin_country: string | null; origin_region: string | null;
  is_public: number; shown_in_shop: number; status: string | null;
  account_slug: string | null; account_public: number; account_status: string | null;
  personal_inventory_user_id: string | null; open_offer_id: string | null; is_offer: number;
};

const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;

/** A product the shop is selling right now: public, active, counted, in stock and priced. */
export function isForSale(product: Record<string, unknown> | null | undefined): product is Record<string, unknown> {
  if (!product || product.status !== 'Active' || product.orders_paused === true) return false;
  const stock = Number(product.stock_grams);
  if (!Number.isFinite(stock) || stock <= 0) return false;
  return [product.exact_pack_price_usd, product.retail_price_per_gram_usd, product.fixed_retail_price_usd]
    .some(value => typeof value === 'number' && Number.isFinite(value) && value > 0);
}

function teaPath(productAddress: string, store: string | null) {
  const path = `/shop/product/${encodeURIComponent(productAddress)}`;
  return store ? `${path}?store=${encodeURIComponent(store)}` : path;
}

function place(row: Pick<TeaRow, 'origin_country' | 'origin_region'>) {
  return [text(row.origin_region), text(row.origin_country)].filter(Boolean).join(', ') || null;
}

/**
 * The teas of one session, resolved in the order given.
 *
 * `accountId` is the shop that hosted the sit. `ownerUserIds` are the people
 * whose own Tea Chest may hold a poured tea (the credited hosts and pourers, or
 * the member who hosted a casual sit). One door crosses accounts: a tea of
 * Teajia's own shop (the platform owner's) that is public, active and shown
 * in the shop, so a host who pours Adrian's tea can lead a guest to it
 * (Launch 2, hard question 7; `crossShopTeaSql`). A product id that belongs
 * to anyone else, or a shop tea that is a draft, hidden or archived, is
 * treated as a plain name, so a menu can never reach into an unrelated account.
 */
export async function resolveSessionTeas(
  db: D1Database, readPublic: PublicProductReader,
  accountId: string | null, ownerUserIds: string[], refs: SessionTeaRef[],
): Promise<PublicSessionTea[]> {
  const ids = [...new Set(refs.map(ref => ref.productId).filter((id): id is string => Boolean(id)))];
  const rows = new Map<string, TeaRow>();
  if (ids.length) {
    const owners = ownerUserIds.length ? ownerUserIds : [''];
    const { results } = await db.prepare(
      `SELECT p.id, p.account_id, p.slug, COALESCE(NULLIF(trim(p.given_name), ''), p.product_name) AS name,
         p.year, p.type, p.origin_country, p.origin_region, p.is_public, p.shown_in_shop, p.status,
         a.slug AS account_slug, a.public_enabled AS account_public, a.status AS account_status,
         a.personal_inventory_user_id,
         (SELECT o.id FROM products o WHERE o.account_id = p.account_id AND o.personal_offer_source_id = p.id
            AND o.personal_offer_withdrawn_at IS NULL ORDER BY o.id LIMIT 1) AS open_offer_id,
         (p.personal_offer_source_id IS NOT NULL AND p.personal_offer_withdrawn_at IS NULL) AS is_offer
       FROM products p JOIN accounts a ON a.id = p.account_id
       WHERE p.id IN (${ids.map(() => '?').join(',')}) AND COALESCE(p.type, '') NOT IN ('Teaware', 'Misc')
         AND (p.account_id = ? OR a.personal_inventory_user_id IN (${owners.map(() => '?').join(',')})
           OR ${crossShopTeaSql('p')})`,
    ).bind(...ids, accountId ?? '', ...owners).all<TeaRow>();
    for (const row of results) rows.set(row.id, row);
  }

  // A Tea Chest list item belongs to one of the sit's credited people. It has
  // no public page and no price of its own; it shows what the tea is.
  const chestIds = [...new Set(refs.map(ref => ref.chestId).filter((id): id is string => Boolean(id)))];
  const chest = new Map<string, Pick<TeaRow, 'year' | 'type' | 'origin_country' | 'origin_region'>>();
  if (chestIds.length && ownerUserIds.length) {
    const { results } = await db.prepare(
      `SELECT id, year, type, origin FROM personal_cellar_items
       WHERE id IN (${chestIds.map(() => '?').join(',')}) AND owner_user_id IN (${ownerUserIds.map(() => '?').join(',')})`,
    ).bind(...chestIds, ...ownerUserIds).all<{ id: string; year: number | null; type: string | null; origin: string | null }>();
    for (const row of results) chest.set(row.id, { year: row.year, type: row.type, origin_country: null, origin_region: row.origin });
  }

  return Promise.all(refs.map(async (ref): Promise<PublicSessionTea> => {
    const row = ref.productId ? rows.get(ref.productId) : undefined;
    const held = !row && ref.chestId ? chest.get(ref.chestId) : undefined;
    if (held) {
      return { kind: 'tea', id: ref.menuId, name: ref.name, href: null,
        year: held.year == null ? null : String(held.year), type: text(held.type), place: place(held) };
    }
    if (!row) return { kind: 'name', id: ref.menuId, name: ref.name };
    const storeOpen = row.account_public === 1 && row.account_status === 'active';
    const store = storeOpen ? row.account_slug : null;
    const tea = {
      kind: 'tea' as const, id: ref.menuId, name: ref.name,
      year: row.year == null || row.year === '' ? null : String(row.year),
      type: text(row.type), place: place(row),
    };
    if (row.personal_inventory_user_id) {
      // A Tea Master's own tea. The holding itself is private; only an open
      // personal offer made from it has a page and a price.
      const offerId = row.is_offer ? row.id : row.open_offer_id;
      const offer = store && offerId ? await readPublic(row.account_id, offerId) : null;
      if (!isForSale(offer)) return { ...tea, href: null };
      return { ...tea, href: teaPath(String(offer.slug || offer.id), store), offer: { store: store!, count: 'pack', product: offer } };
    }
    const listing = store ? await readPublic(row.account_id, row.id) : null;
    const href = listing ? teaPath(String(listing.slug || listing.id), store) : null;
    if (!isForSale(listing)) return { ...tea, href };
    const count = listing.exact_pack_price_usd != null ? 'pack' as const : 'weigh' as const;
    return { ...tea, href, offer: { store: store!, count, product: listing } };
  }));
}
