/**
 * Shipping routes: how bought tea travels home (migration 0042). Set once in
 * Settings, read by the buying basket to estimate freight silently. The shelf
 * price never reads these; it prices freight at the shop rate.
 *
 * Nothing entered is NULL, anything entered is the number, zero included: an
 * empty rate is "nobody said", never free freight. A rate states its currency
 * or is refused, because a number without its unit is not a number.
 */
import { canonicalCurrency } from '../../src/lib/currency';

export type RouteMode = 'air' | 'sea';

export interface ShippingRouteRow {
  id: string;
  mode: RouteMode;
  carrier: string | null;
  destination: string | null;
  rate_per_kg: number | null;
  rate_currency: string | null;
  packing_percent: number | null;
  billing_step_kg: number | null;
  minimum_kg: number | null;
}

/** What past freight bills on this mode say: the last three, in one money. */
export interface LearnedFromBills { bills: number; per_kg: number; currency: string }

const TEXT_FIELDS = ['carrier', 'destination'] as const;
const NUMBER_FIELDS = ['rate_per_kg', 'packing_percent', 'billing_step_kg', 'minimum_kg'] as const;

/** An entered number, or null when the field was left empty. Refuses anything else by name. */
function entered(value: unknown, field: string): number | null {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n) || n < 0) throw new RouteRefusal(`${field} must be a number, or empty.`);
  return n;
}

export class RouteRefusal extends Error {}

/** The columns a save writes, checked. `partial` keeps fields the body did not name. */
export function routeFields(body: Record<string, unknown>, partial: boolean): Partial<Omit<ShippingRouteRow, 'id'>> {
  const out: Partial<Omit<ShippingRouteRow, 'id'>> = {};
  if ('mode' in body || !partial) {
    if (body.mode !== 'air' && body.mode !== 'sea') throw new RouteRefusal('mode must be air or sea.');
    out.mode = body.mode;
  }
  for (const f of TEXT_FIELDS) if (f in body || !partial) out[f] = typeof body[f] === 'string' && (body[f] as string).trim() ? (body[f] as string).trim().slice(0, 200) : null;
  for (const f of NUMBER_FIELDS) if (f in body || !partial) out[f] = entered(body[f], f);
  if (out.billing_step_kg === 0) throw new RouteRefusal('billing_step_kg must be more than zero, or empty.');
  if ('rate_currency' in body || !partial) out.rate_currency = canonicalCurrency(typeof body.rate_currency === 'string' ? body.rate_currency : null);
  return out;
}

export async function listRoutes(db: D1Database, accountId: string): Promise<Array<ShippingRouteRow & { learned: LearnedFromBills | null }>> {
  const { results } = await db.prepare(
    `SELECT id, mode, carrier, destination, rate_per_kg, rate_currency, packing_percent, billing_step_kg, minimum_kg
       FROM shipping_routes WHERE account_id = ? AND archived_at IS NULL ORDER BY mode, created_at`,
  ).bind(accountId).all<ShippingRouteRow>();
  const learned: Partial<Record<RouteMode, LearnedFromBills | null>> = {};
  for (const mode of ['air', 'sea'] as const) learned[mode] = await learnFromBills(db, accountId, mode);
  return (results ?? []).map((r) => ({ ...r, learned: learned[r.mode] ?? null }));
}

/** The last three freight bills on this mode, in the money of the newest. Per kilo of what was billed. */
export async function learnFromBills(db: D1Database, accountId: string, mode: RouteMode): Promise<LearnedFromBills | null> {
  const { results } = await db.prepare(
    `SELECT total_amount, currency, weight_kg FROM curate_freight_costs
      WHERE account_id = ? AND mode = ? ORDER BY observed_on DESC, created_at DESC LIMIT 3`,
  ).bind(accountId, mode).all<{ total_amount: number; currency: string; weight_kg: number }>();
  const rows = results ?? [];
  if (!rows.length) return null;
  const money = canonicalCurrency(rows[0].currency) ?? rows[0].currency;
  const same = rows.filter((r) => (canonicalCurrency(r.currency) ?? r.currency) === money);
  const weight = same.reduce((s, r) => s + Number(r.weight_kg), 0);
  if (!(weight > 0)) return null;
  const total = same.reduce((s, r) => s + Number(r.total_amount), 0);
  return { bills: same.length, per_kg: Math.round((total / weight) * 100) / 100, currency: money };
}

export async function saveRoute(db: D1Database, accountId: string, id: string | null, body: Record<string, unknown>): Promise<ShippingRouteRow> {
  let fields = routeFields(body, id !== null);
  if (id) {
    const existing = await db.prepare('SELECT * FROM shipping_routes WHERE id = ? AND account_id = ? AND archived_at IS NULL').bind(id, accountId).first<ShippingRouteRow>();
    if (!existing) throw new RouteRefusal('No such route.');
    fields = { ...existing, ...fields };
  }
  // A rate without its money, or a money without a rate, is refused by name.
  if ((fields.rate_per_kg ?? null) !== null && !fields.rate_currency) throw new RouteRefusal('Say which currency the rate is in.');
  if ((fields.rate_per_kg ?? null) === null) fields.rate_currency = null;
  const cols = ['mode', 'carrier', 'destination', 'rate_per_kg', 'rate_currency', 'packing_percent', 'billing_step_kg', 'minimum_kg'] as const;
  const values = cols.map((c) => fields[c] ?? null);
  if (id) {
    await db.prepare(`UPDATE shipping_routes SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
      .bind(...values, id, accountId).run();
  } else {
    id = crypto.randomUUID();
    await db.prepare(`INSERT INTO shipping_routes (id, account_id, ${cols.join(', ')}) VALUES (?, ?, ${cols.map(() => '?').join(', ')})`)
      .bind(id, accountId, ...values).run();
  }
  return { id, ...Object.fromEntries(cols.map((c, i) => [c, values[i]])) } as ShippingRouteRow;
}

/** Kept, not deleted: a route an order was estimated on stays readable. */
export async function removeRoute(db: D1Database, accountId: string, id: string): Promise<boolean> {
  const r = await db.prepare(`UPDATE shipping_routes SET archived_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND account_id = ? AND archived_at IS NULL`).bind(id, accountId).run();
  return (r.meta?.changes ?? 0) > 0;
}
