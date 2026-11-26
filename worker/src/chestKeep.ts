// Launch 1, the first table: teas arriving in a person's own Tea Chest.
//
// Two doors, both by the person's own tap, never by a write they did not ask
// for: a tea poured for them at a session (from the after-sit thank-you), and
// a tea line of an order they bought. Nothing is invented on the way in: a tea
// kept from a session holds 0 grams and no cost, because none was held and no
// cost was stated. See todo/plans/guests-and-tea-masters-launch-1-run.md.

/** The chest row as the owner's API returns it (see ownedCellarItemToApi in index.ts). */
export type KeptChestItem = Record<string, unknown> & { id: string };

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
  _db: D1Database, _input: { userId: string; credentialHash: string; teaId: string },
): Promise<KeptChestItem | null> {
  // S5 (Sol) fills this in. Until then the route answers as for an unknown link.
  return null;
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
