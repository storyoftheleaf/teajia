/**
 * Where a tea's stock is kept (Adrian, 2026-11-28: "Split stock based on where
 * it is stored, but just have one number").
 *
 * The shop keeps ONE number per tea, `products.stock_grams` (`quantity_units`
 * for teaware), and only the stock ledger moves it. This file owns the private
 * split of that number between the account's named places (a studio, a
 * house). Customers never see it.
 *
 * Only what has been placed is stored (`product_stock_places`). The rest of the
 * total is "not placed yet". Many doors move the total without naming a place
 * (a sale, an invoice, an import), so the stored split is never trusted as it
 * stands: every read goes through `fitSplit`, which fits it to the current
 * total. When the places hold more than the total, the difference comes off
 * the places in the shop's own order, first place first, which is where the
 * shop sells from. So the split always adds up to the one number.
 *
 * A movement that names a place (receive at the studio, count the house) moves
 * the total through the ledger as before and moves that place by the same
 * amount, in the same batch, guarded on the same `stock_movement_guard`.
 * Moving stock between places changes no total and writes no ledger line;
 * `stock_place_moves` keeps the history of every change to the split.
 */

import { clean, fitSplit, isRefusal, moveBetween, setAmounts, shiftPlace, stockColumn, type SplitRefusal, type StockPlace, type StockSplit } from '../../shared/stockSplit';

export * from '../../shared/stockSplit';

// ── The database ──

export const PLACE_NAME_MAX = 60;

export function cleanPlaceName(value: unknown): string | null {
  const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, PLACE_NAME_MAX) : '';
  return name || null;
}

export async function listStockPlaces(db: D1Database, accountId: string): Promise<StockPlace[]> {
  const rows = await db.prepare(`SELECT id, name, position FROM stock_places
    WHERE account_id = ? AND archived_at IS NULL ORDER BY position, created_at, id`).bind(accountId).all();
  return ((rows.results ?? []) as any[]).map(row => ({ id: String(row.id), name: String(row.name), position: Number(row.position) }));
}

/** A place by id or by name (any case), among the account's current places. */
export function findPlace(places: StockPlace[], ref: unknown): StockPlace | null {
  const text = typeof ref === 'string' ? ref.trim() : '';
  if (!text) return null;
  return places.find(place => place.id === text) ?? places.find(place => place.name.toLowerCase() === text.toLowerCase()) ?? null;
}

/** Make a place, or hand back the current one of that name. Placed last in the shop's order. */
export async function createStockPlace(db: D1Database, accountId: string, rawName: unknown): Promise<StockPlace | SplitRefusal> {
  const name = cleanPlaceName(rawName);
  if (!name) return { error: 'bad_amount', message: 'Give the place a name.' };
  const places = await listStockPlaces(db, accountId);
  const existing = findPlace(places, name);
  if (existing && existing.name.toLowerCase() === name.toLowerCase()) return existing;
  const id = crypto.randomUUID();
  const position = places.reduce((max, place) => Math.max(max, place.position), -1) + 1;
  try {
    await db.prepare(`INSERT INTO stock_places (id, account_id, name, position) VALUES (?, ?, ?, ?)`).bind(id, accountId, name, position).run();
  } catch (error) {
    // Two doors naming the same new place at once: the unique index keeps one.
    const raced = findPlace(await listStockPlaces(db, accountId), name);
    if (raced) return raced;
    throw error;
  }
  return { id, name, position };
}

export async function readStockSplit(db: D1Database, accountId: string, productId: string, total: number, places?: StockPlace[]): Promise<StockSplit> {
  const list = places ?? await listStockPlaces(db, accountId);
  if (!list.length) return { total: Math.max(0, Number(total) || 0), places: [], not_placed: Math.max(0, Number(total) || 0) };
  const rows = await db.prepare(`SELECT place_id, amount FROM product_stock_places WHERE account_id = ? AND product_id = ?`).bind(accountId, productId).all();
  const stored = new Map<string, number>(((rows.results ?? []) as any[]).map(row => [String(row.place_id), Number(row.amount)]));
  return fitSplit(total, list, stored);
}

/** Split by place for many teas at once (Manage's shelf), each fitted to its own total. */
export async function readStockSplits(db: D1Database, accountId: string, totals: Map<string, number>): Promise<Map<string, StockSplit>> {
  const out = new Map<string, StockSplit>();
  const places = await listStockPlaces(db, accountId);
  if (!places.length) return out;
  const rows = await db.prepare(`SELECT product_id, place_id, amount FROM product_stock_places WHERE account_id = ?`).bind(accountId).all();
  const stored = new Map<string, Map<string, number>>();
  for (const row of (rows.results ?? []) as any[]) {
    const id = String(row.product_id);
    if (!totals.has(id)) continue;
    if (!stored.has(id)) stored.set(id, new Map());
    stored.get(id)!.set(String(row.place_id), Number(row.amount));
  }
  for (const [id, map] of stored) out.set(id, fitSplit(totals.get(id) ?? 0, places, map));
  return out;
}

/** A condition every split write carries, so it lands only beside the movement it belongs to. */
export interface SplitGuard { sql: string; binds: unknown[] }

export const movementGuardFor = (accountId: string, productId: string, guard: string): SplitGuard => ({
  sql: 'EXISTS (SELECT 1 FROM products WHERE id = ? AND account_id = ? AND stock_movement_guard = ?)',
  binds: [productId, accountId, guard],
});

export const totalGuardFor = (accountId: string, productId: string, column: 'stock_grams' | 'quantity_units', total: number): SplitGuard => ({
  sql: `EXISTS (SELECT 1 FROM products WHERE id = ? AND account_id = ? AND COALESCE(${column}, 0) = ?)`,
  binds: [productId, accountId, total],
});

export interface SplitChange { from_place_id: string | null; to_place_id: string | null; amount: number }

/** What moved between `before` and `after`, as rows for `stock_place_moves`. */
export function splitChanges(before: StockSplit, after: StockSplit): SplitChange[] {
  const changes: SplitChange[] = [];
  for (const row of after.places) {
    const was = before.places.find(place => place.place_id === row.place_id)?.amount ?? 0;
    const diff = clean(row.amount - was);
    if (diff > 0) changes.push({ from_place_id: null, to_place_id: row.place_id, amount: diff });
    if (diff < 0) changes.push({ from_place_id: row.place_id, to_place_id: null, amount: -diff });
  }
  return changes;
}

/** Store `split` for a tea, and the history of how it got there, under `guard`. */
export function writeSplitStatements(
  db: D1Database,
  ctx: { accountId: string; productId: string; email?: string | null; note?: string | null; ledgerId?: string | null },
  before: StockSplit,
  after: StockSplit,
  guard: SplitGuard,
): D1PreparedStatement[] {
  const statements: D1PreparedStatement[] = [
    db.prepare(`DELETE FROM product_stock_places WHERE account_id = ? AND product_id = ? AND ${guard.sql}`)
      .bind(ctx.accountId, ctx.productId, ...guard.binds),
  ];
  for (const row of after.places) {
    if (row.amount <= 0) continue;
    statements.push(db.prepare(`INSERT INTO product_stock_places (account_id, product_id, place_id, amount, updated_at)
      SELECT ?, ?, ?, ?, datetime('now') WHERE ${guard.sql}`)
      .bind(ctx.accountId, ctx.productId, row.place_id, row.amount, ...guard.binds));
  }
  for (const change of splitChanges(before, after)) {
    statements.push(db.prepare(`INSERT INTO stock_place_moves (id, account_id, product_id, from_place_id, to_place_id, amount, ledger_id, note, user_email)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard.sql}`)
      .bind(crypto.randomUUID(), ctx.accountId, ctx.productId, change.from_place_id, change.to_place_id, change.amount,
        ctx.ledgerId ?? null, ctx.note ?? null, ctx.email ?? null, ...guard.binds));
  }
  return statements;
}

/** The split as an agent or Manage reads it: one number, then where it is. */
export function describeSplit(split: StockSplit, unit: 'g' | 'unit') {
  return {
    total: split.total,
    unit: unit === 'g' ? 'g' : 'pieces',
    places: split.places.map(row => ({ id: row.place_id, name: row.name, amount: row.amount })),
    not_placed: split.not_placed,
  };
}

// ── Changing the split without moving the total ──

type ProductStockRow = { id: string; type: string | null; stock_grams: number | null; quantity_units: number | null; personal_offer_source_id: string | null; given_name?: string | null; product_name?: string | null };

export async function readProductStock(db: D1Database, accountId: string, productId: string) {
  const product = await db.prepare(`SELECT id, type, stock_grams, quantity_units, personal_offer_source_id, given_name, product_name
    FROM products WHERE id = ? AND account_id = ?`).bind(productId, accountId).first<ProductStockRow>();
  if (!product) return null;
  const column = stockColumn(product.type);
  const unit: 'g' | 'unit' = column === 'stock_grams' ? 'g' : 'unit';
  return { product, column, unit, total: Number(product[column] ?? 0), name: product.given_name || product.product_name || product.id };
}

export type SplitEdit =
  | { kind: 'set'; amounts: Array<{ place_id: string; amount: number }> }
  | { kind: 'move'; from: string | null; to: string | null; amount: number };

/**
 * Change where a tea's stock is, keeping its total. `expectedTotal` pins the
 * total the person saw: if a sale or a count moved it since, nothing is
 * written and the answer says what it is now.
 */
export async function saveProductSplit(
  db: D1Database,
  ctx: { accountId: string; email?: string | null },
  productId: string,
  edit: SplitEdit,
  options: { expectedTotal?: number | null; note?: string | null } = {},
): Promise<{ status: number; value: Record<string, unknown> }> {
  const stock = await readProductStock(db, ctx.accountId, productId);
  if (!stock) return { status: 404, value: { error: 'Product not found' } };
  if (stock.product.personal_offer_source_id) return { status: 409, value: { error: 'Make stock changes on the private holding for this offer.' } };
  if (options.expectedTotal != null && Number(options.expectedTotal) !== stock.total) {
    return { status: 409, value: { error: 'Stock balance changed', current_balance: stock.total } };
  }
  const places = await listStockPlaces(db, ctx.accountId);
  const before = await readStockSplit(db, ctx.accountId, productId, stock.total, places);
  const after = edit.kind === 'set'
    ? setAmounts(before, edit.amounts, stock.unit)
    : moveBetween(before, edit.from, edit.to, Number(edit.amount), stock.unit);
  if (isRefusal(after)) return { status: after.error === 'unknown_place' ? 404 : 409, value: { error: after.message, code: after.error, available: after.available ?? null } };
  const guard = totalGuardFor(ctx.accountId, productId, stock.column, stock.total);
  const results = await db.batch([
    // Matches only while the total is still the one the split was fitted to;
    // its change count says whether the rest landed.
    db.prepare(`UPDATE products SET updated_at = updated_at WHERE id = ? AND account_id = ? AND COALESCE(${stock.column}, 0) = ?`)
      .bind(productId, ctx.accountId, stock.total),
    ...writeSplitStatements(db, { accountId: ctx.accountId, productId, email: ctx.email, note: options.note ?? null }, before, after, guard),
  ]);
  if (Number((results[0] as any)?.meta?.changes ?? 0) !== 1) {
    const latest = await readProductStock(db, ctx.accountId, productId);
    return { status: 409, value: { error: 'Stock balance changed', current_balance: latest?.total ?? null } };
  }
  return { status: 200, value: { product_id: productId, stock_places: describeSplit(after, stock.unit) } };
}

/** Rename, reorder or retire a place. A retired place's stock reads as "not placed yet". */
export async function updateStockPlace(db: D1Database, accountId: string, placeId: string, patch: { name?: unknown; position?: unknown; archived?: unknown }) {
  const place = await db.prepare('SELECT id, name, position FROM stock_places WHERE id = ? AND account_id = ? AND archived_at IS NULL').bind(placeId, accountId).first<StockPlace>();
  if (!place) return { status: 404, value: { error: 'Stock place not found' } };
  if (patch.archived === true) {
    await db.batch([
      db.prepare(`UPDATE stock_places SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND account_id = ?`).bind(placeId, accountId),
      db.prepare('DELETE FROM product_stock_places WHERE account_id = ? AND place_id = ?').bind(accountId, placeId),
    ]);
    return { status: 200, value: { place: { ...place, archived: true } } };
  }
  const name = patch.name === undefined ? place.name : cleanPlaceName(patch.name);
  if (!name) return { status: 400, value: { error: 'Give the place a name.' } };
  const position = patch.position === undefined ? Number(place.position) : Number(patch.position);
  if (!Number.isInteger(position) || position < 0) return { status: 400, value: { error: 'position must be a whole number, 0 or more' } };
  const clash = findPlace(await listStockPlaces(db, accountId), name);
  if (clash && clash.id !== placeId && clash.name.toLowerCase() === name.toLowerCase()) return { status: 409, value: { error: `There is already a place called ${clash.name}.` } };
  await db.prepare(`UPDATE stock_places SET name = ?, position = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?`).bind(name, position, placeId, accountId).run();
  return { status: 200, value: { place: { id: placeId, name, position } } };
}

// ── A movement at a place, for doors that write the total themselves ──

export interface PlaceRef { id: string | null; name: string }

/** Resolve what a caller named: a current place, or a new one to make on confirm. */
export async function namePlace(db: D1Database, accountId: string, ref: unknown): Promise<PlaceRef | null> {
  const name = cleanPlaceName(ref);
  if (!name) return null;
  const found = findPlace(await listStockPlaces(db, accountId), name);
  return found ? { id: found.id, name: found.name } : { id: null, name };
}

/** How the split reads if `delta` lands at `place`, without writing anything. */
export async function previewPlaceShift(db: D1Database, accountId: string, productId: string, total: number, place: PlaceRef, delta: number, unit: 'g' | 'unit') {
  const split = await readStockSplit(db, accountId, productId, total);
  const id = place.id ?? 'new';
  const withNew = place.id ? split : { ...split, places: [...split.places, { place_id: id, name: place.name, amount: 0 }] };
  const before = withNew.places.find(row => row.place_id === id)?.amount ?? 0;
  const after = shiftPlace(withNew, id, delta, unit);
  if (isRefusal(after)) return after;
  return { place: { name: place.name, is_new: !place.id, before, after: before + delta }, stock_places: describeSplit(after, unit) };
}

/**
 * The split writes for `delta` landing at `place`, guarded on the tea's total
 * having become `totalBefore + delta` in the same batch. Makes a new place
 * first; call it only on confirm.
 */
export async function placeShiftStatements(
  db: D1Database,
  ctx: { accountId: string; email?: string | null; note?: string | null },
  productId: string,
  column: 'stock_grams' | 'quantity_units',
  totalBefore: number,
  place: PlaceRef,
  delta: number,
  unit: 'g' | 'unit',
): Promise<{ statements: D1PreparedStatement[]; split: StockSplit } | SplitRefusal> {
  const made = place.id ? findPlace(await listStockPlaces(db, ctx.accountId), place.id) : await createStockPlace(db, ctx.accountId, place.name);
  if (!made) return { error: 'unknown_place', message: `${place.name} is no longer one of the shop's places.` };
  if (isRefusal(made)) return made;
  const before = await readStockSplit(db, ctx.accountId, productId, totalBefore);
  const after = shiftPlace(before, made.id, delta, unit);
  if (isRefusal(after)) return after;
  return {
    statements: writeSplitStatements(db, { accountId: ctx.accountId, productId, email: ctx.email, note: ctx.note }, before, after,
      totalGuardFor(ctx.accountId, productId, column, after.total)),
    split: after,
  };
}
