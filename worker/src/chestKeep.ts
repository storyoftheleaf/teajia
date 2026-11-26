// Launch 1, the first table: teas arriving in a person's own Tea Chest.
//
// Two doors, both by the person's own tap, never by a write they did not ask
// for: a tea poured for them at a session (from the after-sit thank-you), and
// a tea line of an order they bought. Nothing is invented on the way in: a tea
// kept from a session holds 0 grams and no cost, because none was held and no
// cost was stated. See todo/plans/guests-and-tea-masters-launch-1-run.md.

import { TEA_TYPES } from '../../src/wisdom/vocabulary';
import { findEligibleSeat } from './afterSitAccess';
import { findPartyRecap } from './afterSitPartyLinks';
import type { PublicProductReader } from './sessionTeas';
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
 * is not eligible or the tea was not served at that session. Any link that
 * opens the thank-you (a seat's own, an extra, or a party link) may keep.
 * Product details (type, year, origin, the product link) are copied only when
 * the shop's own public catalogue rule shows that product; otherwise the chest
 * gets the name the thank-you already showed, and nothing more.
 */
export async function keepSessionTea(
  db: D1Database,
  input: { userId: string; credentialHash: string; teaId: string; readPublic?: PublicProductReader },
): Promise<KeptChestItem | null> {
  const seat = await findEligibleSeat(db, input.credentialHash) ?? await findPartyRecap(db, input.credentialHash);
  if (!seat) return null;
  const teas = JSON.parse(seat.teas_json) as Array<{ id?: unknown }>;
  if (!teas.some(tea => tea.id === input.teaId)) return null;

  const served = await db.prepare(
    `SELECT tea.name, tea.product_id, p.type, p.year, p.origin_country, p.origin_region
     FROM (${sessionServedTeas('?1', '?2')}) AS tea
     LEFT JOIN products p ON p.id = tea.product_id AND p.account_id = ?1
     WHERE tea.id = ?3 LIMIT 1`,
  ).bind(seat.account_id, seat.id, input.teaId).first<{
    name: string; product_id: string | null; type: string | null; year: number | null;
    origin_country: string | null; origin_region: string | null;
  }>();
  if (!served) return null;
  const shown = served.product_id && input.readPublic
    ? Boolean(await input.readPublic(seat.account_id, served.product_id))
    : false;
  if (!shown) Object.assign(served, { type: null, year: null, origin_country: null, origin_region: null });
  const linkedProductId = shown ? served.product_id : null;

  const id = `cellar_${crypto.randomUUID().replace(/-/g, '')}`;
  const origin = [served.origin_region, served.origin_country].filter(Boolean).join(', ') || null;
  // The chest keeps a year only as four digits, as its own form does.
  const year = served.year != null && /^\d{4}$/.test(String(served.year).trim()) ? Number(String(served.year).trim()) : null;
  await db.prepare(
    `INSERT INTO personal_cellar_items
       (id, owner_user_id, name, type, year, origin, grams, chest_cost_amount, chest_cost_currency,
        linked_product_id, source_kind, source_event_id, source_tea_ref)
     VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL, ?, 'session', ?, ?)
     ON CONFLICT DO NOTHING`,
  ).bind(id, input.userId, served.name, served.type, year, origin, linkedProductId, seat.id, input.teaId).run();

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

/** Shared with order detail: older tea lines were sold in grams. */
export function boughtLineQuantityUnit(line: Record<string, any>): string {
  return line.quantity_unit ?? (line.type === 'Teaware' ? 'unit' : 'g');
}

function boughtGrams(line: Record<string, any>): number | null {
  if (!line.product_id || !line.product_name || !(TEA_TYPES as readonly string[]).includes(line.type)) return null;
  const quantity = Number(line.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  const unit = boughtLineQuantityUnit(line);
  const weight = Number(line.piece_weight_g);
  const grams = unit === 'g' ? quantity : unit === 'unit' && weight > 0 ? quantity * weight : NaN;
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

function canKeepBoughtOrder(order: BoughtOrder): boolean {
  const invoice = order.invoice;
  const payment = order.payment as { total_usd?: number; paid_usd?: number; outstanding_usd?: number } | null;
  return order.linkedToUser && ['Pending', 'Filled'].includes(invoice.status)
    && !invoice.deleted_at && !invoice.cancelled_at && !invoice.refund_required
    && payment != null && Number.isFinite(payment.total_usd) && payment.total_usd! > 0
    && Number.isFinite(payment.paid_usd) && payment.paid_usd! >= payment.total_usd!
    && payment.outstanding_usd === 0;
}

/** Reads never create chest rows. Legacy contact matches do not authorize copying shop facts. */
export async function boughtLineChestState(
  db: D1Database, order: BoughtOrder,
): Promise<Map<string, { chest_item_id: string | null; can_keep: boolean }>> {
  const { results } = await db.prepare(
    `SELECT id, source_invoice_line_id FROM personal_cellar_items
     WHERE owner_user_id = ? AND source_invoice_id = ?`,
  ).bind(order.userId, order.invoice.id).all<{ id: string; source_invoice_line_id: string }>();
  const kept = new Map(results.map(row => [row.source_invoice_line_id, row.id]));
  return new Map(order.lines.map(line => {
    const id = kept.get(line.id) ?? null;
    return [line.id, { chest_item_id: id, can_keep: !id && canKeepBoughtOrder(order) && boughtGrams(line) !== null }];
  }));
}

/** Put one tea line into the buyer's chest. The unique index arbitrates concurrent taps. */
export async function keepBoughtLine(
  db: D1Database, order: BoughtOrder, lineId: string,
): Promise<KeptChestItem | null> {
  const line = order.lines.find(candidate => candidate.id === lineId);
  if (!order.linkedToUser || !line) return null;
  const read = () => db.prepare(
    `SELECT * FROM personal_cellar_items
     WHERE owner_user_id = ? AND source_invoice_id = ? AND source_invoice_line_id = ?`,
  ).bind(order.userId, order.invoice.id, lineId).first();
  // A later refund never rewrites a person's private record, including their edits.
  const existing = await read();
  if (existing) return ownedCellarItemToApi(existing);
  const grams = boughtGrams(line);
  if (!canKeepBoughtOrder(order) || grams === null) return null;
  const price = line.price_at_sale == null || line.price_at_sale === '' ? NaN : Number(line.price_at_sale);
  const cost = price * Number(line.quantity);
  const amount = Number.isFinite(cost) && price >= 0 ? cost : null;
  const year = line.year != null && /^\d{4}$/.test(String(line.year).trim()) ? Number(line.year) : null;
  const origin = [line.origin_region, line.origin_country].filter(Boolean).join(', ') || null;
  // Repeat mutable order/ownership checks at the write, not just at route load.
  // If the person deleted the row, a new tap puts it back once (Opus, S6 review).
  await db.prepare(
    `INSERT INTO personal_cellar_items
       (id, owner_user_id, name, type, year, origin, grams, chest_cost_amount, chest_cost_currency,
        source_kind, source_invoice_id, source_invoice_line_id)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bought', i.id, ?
     FROM invoices i
     WHERE i.id = ? AND i.account_id = ? AND i.deleted_at IS NULL AND i.cancelled_at IS NULL
       AND i.status IN ('Pending', 'Filled') AND COALESCE(i.refund_required, 0) = 0
       AND i.customer_id IN (SELECT id FROM customers WHERE user_id = ? AND account_id = i.account_id)
       AND EXISTS (SELECT 1 FROM invoice_line_items l WHERE l.id = ? AND l.invoice_id = i.id AND l.account_id = i.account_id)
     ON CONFLICT(owner_user_id, source_invoice_line_id) WHERE source_invoice_line_id IS NOT NULL DO NOTHING`,
  ).bind(`cellar_${crypto.randomUUID().replace(/-/g, '')}`, order.userId,
    line.custom_name || line.product_name, line.type, year, origin, grams, amount, amount === null ? null : 'USD',
    lineId, order.invoice.id, order.invoice.account_id, order.userId, lineId).run();
  const row = await read();
  return row ? ownedCellarItemToApi(row) : null;
}
