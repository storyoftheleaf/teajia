// Launch 1, the first table: teas arriving in a person's own Tea Chest.
//
// Two doors, both by the person's own tap, never by a write they did not ask
// for: a tea poured for them at a session (from the after-sit thank-you), and
// a tea line of an order they bought. Nothing is invented on the way in: a tea
// kept from a session holds 0 grams and no cost, because none was held and no
// cost was stated. See todo/plans/guests-and-tea-masters-launch-1-run.md.

import { findEligibleSeat } from './afterSitAccess';
import { sessionServedTeas } from './sessionServedTeas';

/** The chest row as the owner's API returns it (see ownedCellarItemToApi in index.ts). */
export type KeptChestItem = Record<string, unknown> & { id: string };

/** Shared owner-facing Tea Chest mapping, copied from index.ts for this slice. */
export function ownedCellarItemToApi(row: any): KeptChestItem {
  const source = row.source_kind ? {
    kind: row.source_kind,
    fromName: row.source_from_name ?? null,
    eventId: row.source_event_id ?? null,
    eventTitle: row.source_event_title ?? null,
    invoiceId: row.source_invoice_id ?? null,
  } : null;
  return {
    id: row.id,
    name: row.name,
    type: row.type ?? null,
    year: row.year ?? null,
    origin: row.origin ?? null,
    notes: row.notes ?? null,
    grams: Number(row.grams) || 0,
    imageUrl: row.image_url ?? null,
    placementStatus: row.placement_status ?? 'private',
    placementAccountId: row.placement_account_id ?? null,
    linkedProductId: row.linked_product_id ?? null,
    shelfPublished: !!row.shelf_published && row.shelf_offer_name != null && row.chest_cost_amount != null
      && row.chest_cost_currency != null && row.shelf_offer_price_amount > 0 && row.shelf_offer_price_currency != null
      && row.placement_status === 'private' && row.shelf_offer_grams > 0 && row.shelf_offer_grams <= row.grams,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    label: row.chest_label ?? null,
    costAmount: row.chest_cost_amount ?? null,
    costCurrency: row.chest_cost_currency ?? null,
    shelfNeedsReview: !!row.shelf_published && (row.shelf_offer_name == null || row.shelf_offer_price_amount == null),
    source,
    shelfOffer: row.shelf_offer_name == null ? null : {
      name: row.shelf_offer_name,
      price_amount: row.shelf_offer_price_amount ?? null,
      price_currency: row.shelf_offer_price_currency ?? null,
      grams: row.shelf_offer_grams,
      type: row.shelf_offer_type ?? null,
      year: row.shelf_offer_year ?? null,
      origin: row.shelf_offer_origin ?? null,
    },
  };
}

/**
 * The served-tea ids of one session this person already keeps. Used by the
 * after-sit recap to mark `kept` for a signed-in caller; it reads only the
 * caller's own rows, so it can never say anything about anyone else's chest.
 */
export async function keptSessionTeaIds(db: D1Database, userId: string, eventId: string): Promise<Set<string>> {
  const { results } = await db.prepare(
    `SELECT source_tea_ref FROM personal_cellar_items
     WHERE owner_user_id = ? AND source_kind = 'session' AND source_event_id = ?`,
  ).bind(userId, eventId).all<{ source_tea_ref: string | null }>();
  return new Set(results.map(row => row.source_tea_ref).filter((id): id is string => Boolean(id)));
}

/**
 * Keep one poured tea from a session in the caller's chest (slice S5).
 * Returns the chest row, the same row on a repeat, or null when the seat link
 * is not eligible or the tea was not served at that session.
 */
export async function keepSessionTea(
  db: D1Database, input: { userId: string; credentialHash: string; teaId: string },
): Promise<KeptChestItem | null> {
  const seat = await findEligibleSeat(db, input.credentialHash);
  if (!seat) return null;
  const teas = JSON.parse(seat.teas_json) as Array<{ id?: unknown }>;
  if (!teas.some(tea => tea.id === input.teaId)) return null;

  const served = await db.prepare(
    `SELECT tea.name, p.type, p.year, p.origin_country, p.origin_region,
        CASE WHEN p.is_public = 1 AND p.shown_in_shop = 1
          AND shop.status = 'active' AND shop.public_enabled = 1 THEN p.id ELSE NULL END AS linked_product_id
     FROM (${sessionServedTeas('?1', '?2')}) AS tea
     LEFT JOIN products p ON p.id = tea.product_id AND p.account_id = ?1
     LEFT JOIN accounts shop ON shop.id = ?1
     WHERE tea.id = ?3 LIMIT 1`,
  ).bind(seat.account_id, seat.id, input.teaId).first<{
    name: string; type: string | null; year: number | null;
    origin_country: string | null; origin_region: string | null; linked_product_id: string | null;
  }>();
  if (!served) return null;

  const id = `cellar_${crypto.randomUUID().replace(/-/g, '')}`;
  const origin = [served.origin_region, served.origin_country].filter(Boolean).join(', ') || null;
  await db.prepare(
    `INSERT INTO personal_cellar_items
       (id, owner_user_id, name, type, year, origin, grams, chest_cost_amount, chest_cost_currency,
        linked_product_id, source_kind, source_event_id, source_tea_ref)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, 'session', ?, ?)
     ON CONFLICT DO NOTHING`,
  ).bind(id, input.userId, served.name, served.type, served.year, origin, served.linked_product_id, seat.id, input.teaId).run();

  const row = await db.prepare(
    `SELECT c.*, e.title AS source_event_title
     FROM personal_cellar_items c
     LEFT JOIN events e ON e.id = c.source_event_id
     WHERE c.owner_user_id = ? AND c.source_kind = 'session'
       AND c.source_event_id = ? AND c.source_tea_ref = ?`,
  ).bind(input.userId, seat.id, input.teaId).first();
  return row ? ownedCellarItemToApi(row) : null;
}

/**
 * One order the caller owns, as the order routes load it. `lines` are raw
 * invoice_line_items rows joined to products (product_name, type,
 * piece_weight_g, year, origin_country, origin_region). `payment` is the
 * result of resolveInvoicePayment. `linkedToUser` is true only when the
 * order's customer row is linked to this user (the strongest ownership match).
 */
export type BoughtOrder = {
  userId: string;
  invoice: Record<string, any>;
  lines: Record<string, any>[];
  payment: unknown;
  linkedToUser: boolean;
};

/** Per order line: the chest row it already became, and whether one tap may add it (slice S6). */
export async function boughtLineChestState(
  _db: D1Database, _order: BoughtOrder,
): Promise<Map<string, { chest_item_id: string | null; can_keep: boolean }>> {
  // S6 (Astra) fills this in. Until then no line is offered.
  return new Map();
}

/** Put one tea line of a paid order into the buyer's chest, once (slice S6). Null when refused. */
export async function keepBoughtLine(
  _db: D1Database, _order: BoughtOrder, _lineId: string,
): Promise<KeptChestItem | null> {
  return null;
}
