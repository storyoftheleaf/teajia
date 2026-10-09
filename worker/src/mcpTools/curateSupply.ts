import { requireCurateManager } from '../curateMutations';
import { readVendorStructuredProfile } from '../curateVendorProfile';
import { listCurateQuotes } from '../curateQuotes';
/**
 * The back office of a Curate tea: what a vendor costs to buy from, what it
 * costs to bring their tea home, and the order Adrian sends them.
 *
 * Adrian, 2026-10-07: "anytime I do buy something, I will give you the price
 * that it costs for how many kilos of tea and then you will calculate, okay,
 * this vendor costs this much to ship this much tea." And when he logs in, the
 * order is waiting to copy, the message to the vendor is written, and the
 * arrival is there to approve into stock.
 *
 * So:
 *   - `curate_record_freight` keeps each shipping cost as he said it: a total,
 *     its currency, the weight it moved, the leg it covered. The per-kg figure
 *     is worked out when read, never stored, so it cannot drift from the
 *     evidence. The newest figure for a leg is that leg's cost; older ones stay
 *     as history.
 *   - `curate_order` writes the shop's existing purchase order (the Purchase
 *     Orders page and the vendor's page already list them), with the message to
 *     copy, and one pending receipt per tea: the "approve when it arrives" step
 *     the app already knows how to accept.
 *   - `curate_get_vendor` reads it all back in one place, so the next agent
 *     knows that a Hong Kong vendor quotes in HKD, stores in Hong Kong, and
 *     costs so much a kilo to reach Bali.
 *
 * What this does NOT do: change a shelf price. The shelf still prices freight
 * at the shop rate (worker/src/shippingRate.ts), and a tea carrying its own rate
 * is still Adrian's deliberate exception. The real legs are used for the landed
 * cost an order shows him, which is evidence he can act on, not a rate copied
 * into rows.
 */
import { refreshedCurrencyName, REFRESHED_CURRENCIES } from '../exchangeRateFeed';
import {
  agentName, datedLine, entryById, curateManagerAccess, parseJson, planVendor, readQuotedPrice, resolveVendorAtCommit, str,
  teaMissing, TRANSPORT_MODES, vendorById, vendorSummary, type VendorPlan,
} from './curateIntake';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { INVALID_TICKET, consumeTicket, issueTicket, previewEnvelope } from './tickets';

// ── Money helpers ─────────────────────────────────────────────────────────────

/** Units of each currency per US dollar, as the shop's exchange table holds them. */
async function loadRates(env: ToolEnv): Promise<Map<string, number>> {
  const rows = await env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates').all<{ currency: string; rate_to_usd: number }>();
  const map = new Map<string, number>();
  for (const r of rows.results ?? []) if (Number(r.rate_to_usd) > 0) map.set(String(r.currency).toLowerCase(), Number(r.rate_to_usd));
  return map;
}

/** Dollars for an amount, or null when the shop has no rate. Never a rate of 1. */
function toUsd(rates: Map<string, number>, amount: number, currency: string): number | null {
  if (/^usd$/i.test(currency)) return amount;
  const rate = rates.get(currency.toLowerCase());
  return rate ? amount / rate : null;
}

function money(amount: number, currency: string): string {
  const rounded = Math.round(amount * 100) / 100;
  return `${rounded.toLocaleString('en-US')} ${currency}`;
}
function usd(amount: number): string {
  return `$${(Math.round(amount * 100) / 100).toLocaleString('en-US')}`;
}

function readCurrency(raw: unknown, what: string): string {
  const typed = str(raw, 20);
  if (!typed) throw new Error(`${what} has no currency. Ask Adrian what it was paid in.`);
  if (/^unk$/i.test(typed)) throw new Error("'UNK' is not a currency");
  const currency = refreshedCurrencyName(typed);
  if (!currency) throw new Error(`${typed} is not a currency this shop keeps a live rate for. Use one of: ${[...REFRESHED_CURRENCIES].join(', ')}.`);
  return currency;
}

// ── Freight legs ──────────────────────────────────────────────────────────────

type FreightRow = {
  id: string; vendor_id: string | null; leg: string; mode: string | null; total_amount: number; currency: string;
  weight_kg: number; transit_days: number | null; observed_on: string; note: string | null;
};

function legReading(r: FreightRow, rates: Map<string, number>) {
  const perKg = r.total_amount / r.weight_kg;
  const perKgUsd = toUsd(rates, perKg, r.currency);
  return {
    leg: r.leg,
    mode: r.mode,
    per_kg: money(perKg, r.currency),
    per_kg_usd: perKgUsd == null ? null : Math.round(perKgUsd * 100) / 100,
    from: `${money(r.total_amount, r.currency)} for ${r.weight_kg} kg on ${r.observed_on}`,
    transit_days: r.transit_days,
    shared: r.vendor_id == null,
  };
}

/** The newest figure for each leg: the vendor's own, or the legs every vendor shares. */
async function currentLegs(env: ToolEnv, auth: ToolAuth, vendorId: string | null): Promise<FreightRow[]> {
  const rows = await env.DB.prepare(
    `SELECT * FROM curate_freight_costs WHERE account_id = ? AND ${vendorId ? 'vendor_id = ?' : 'vendor_id IS NULL'}
     ORDER BY observed_on DESC, created_at DESC`
  ).bind(auth.accountId, ...(vendorId ? [vendorId] : [])).all<FreightRow>();
  const seen = new Set<string>();
  const out: FreightRow[] = [];
  for (const r of rows.results ?? []) {
    const k = r.leg.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

type FreightTicket = {
  kind: 'curate:freight'; accountId: string; vendorId: string | null; vendorPlan: VendorPlan | null; agent: string;
  leg: string; mode: string | null; total: number; currency: string; weightKg: number; transitDays: number | null;
  observedOn: string; note: string | null;
};

const toolRecordFreight: ToolHandler = async (env, auth, args) => {
  if (str(args?.note, 1000)) throw new Error('Agent notes are disabled: use a structured freight field');
  const confirm = str(args?.confirm, 100);
  if (confirm) {
    const t = await consumeTicket<FreightTicket, 'curate:freight'>(env, confirm, 'curate:freight', auth);
    if (!t) return INVALID_TICKET;
    if (t.note) throw new Error('Agent notes are disabled; preview structured freight fields instead');
    const vendor = t.vendorPlan ? await resolveVendorAtCommit(env, auth, t.vendorPlan, t.agent) : null;
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO curate_freight_costs (id, account_id, vendor_id, leg, mode, total_amount, currency, weight_kg, transit_days, observed_on, note, from_agent, created_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, auth.accountId, vendor?.id ?? null, t.leg, t.mode, t.total, t.currency, t.weightKg, t.transitDays, t.observedOn, t.note, t.agent, auth.userId).run();
    const rates = await loadRates(env);
    return { committed: true, freight_id: id, vendor: vendor?.name ?? 'every vendor (shared leg)', ...legReading({
      id, vendor_id: vendor?.id ?? null, leg: t.leg, mode: t.mode, total_amount: t.total, currency: t.currency,
      weight_kg: t.weightKg, transit_days: t.transitDays, observed_on: t.observedOn, note: t.note,
    }, rates) };
  }
  const leg = str(args?.leg, 200);
  if (!leg) throw new Error('leg is required, in words: "Hong Kong to Guangzhou", "Guangzhou to Bali by boat".');
  const total = args?.total;
  if (!total || typeof total !== 'object') throw new Error('total is required: {amount, currency} for the whole shipment.');
  if (total.amount == null || total.amount === '') throw new Error('total.amount is required');
  const amount = Number(total.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('total.amount must be a number of 0 or more');
  const currency = readCurrency(total.currency, 'The shipping cost');
  const weightKg = Number(args?.weight_kg);
  if (!Number.isFinite(weightKg) || weightKg <= 0) throw new Error('weight_kg is required: how many kilos that cost moved.');
  let mode: string | null = null;
  if (args?.mode != null) {
    mode = str(args.mode, 20)?.toLowerCase() ?? null;
    if (!mode || !TRANSPORT_MODES.has(mode)) throw new Error('mode must be air, sea, land or courier');
  }
  let transitDays: number | null = null;
  if (args?.transit_days != null && args.transit_days !== '') {
    transitDays = Number(args.transit_days);
    if (!Number.isInteger(transitDays) || transitDays < 0) throw new Error('transit_days must be a whole number');
  }
  const observedOn = str(args?.observed_on, 10) ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(observedOn)) throw new Error('observed_on must be a date like 2026-10-07');
  const vendorPlan = args?.shared === true ? null : await planVendor(env, auth, str(args?.vendor_id, 80), str(args?.vendor_name, 200));
  if (!vendorPlan && args?.shared !== true) throw new Error('vendor_name or vendor_id is required, or shared: true for a leg every vendor uses (the boat to Bali).');
  const rates = await loadRates(env);
  const previous = (await currentLegs(env, auth, vendorPlan?.id ?? null)).find(r => r.leg.trim().toLowerCase() === leg.toLowerCase());
  const reading = legReading({ id: '', vendor_id: vendorPlan?.id ?? null, leg, mode, total_amount: amount, currency, weight_kg: weightKg, transit_days: transitDays, observed_on: observedOn, note: null }, rates);
  const ticket: FreightTicket = {
    kind: 'curate:freight', accountId: auth.accountId, vendorId: vendorPlan?.id ?? null, vendorPlan, agent: agentName(args),
    leg, mode, total: amount, currency, weightKg, transitDays, observedOn, note: null,
  };
  const token = await issueTicket(env, ticket, auth.tokenId);
  return previewEnvelope({
    action: 'curate_record_freight',
    read_back: `${leg}${mode ? ` (${mode})` : ''}${vendorPlan ? ` for ${vendorPlan.name}${vendorPlan.isNew ? ' (new vendor)' : ''}` : ', shared by every vendor'}: ${money(amount, currency)} for ${weightKg} kg, so ${reading.per_kg} a kilo${reading.per_kg_usd != null ? ` (about $${reading.per_kg_usd})` : ''}.`,
    replaces_as_current: previous ? legReading(previous, rates) : null,
    note: 'The shelf price still uses the shop freight rate; this figure is used for order landed costs.',
  }, token);
};

// ── Orders ────────────────────────────────────────────────────────────────────

const QTY_UNIT_GRAMS: Record<string, number> = { g: 1, liang: 50, jin: 500, kg: 1000 };

type OrderLine = {
  entryId: string; productId: string | null; name: string; type: string | null; grams: number;
  quantityWords: string; unitPrice: string; lineTotal: number;
};
type OrderTicket = {
  kind: 'curate:order'; accountId: string; userId: string; agent: string; vendorPlan: VendorPlan;
  currency: string; lines: OrderLine[]; total: number; totalUsd: number; message: string; notes: string;
  shipsBy: string | null; freightEstimate?: Record<string, unknown>;
};

const toolOrder: ToolHandler = async (env, auth, args) => {
  if (str(args?.note, 1000)) throw new Error('Agent notes are disabled: use structured order fields');
  const confirm = str(args?.confirm, 100);
  if (confirm) {
    const t = await consumeTicket<OrderTicket, 'curate:order'>(env, confirm, 'curate:order', auth);
    if (!t || t.userId !== auth.userId) return INVALID_TICKET;
    return commitOrder(env, auth, t);
  }
  const vendorPlan = await planVendor(env, auth, str(args?.vendor_id, 80), str(args?.vendor_name, 200));
  if (!vendorPlan) throw new Error('vendor_name or vendor_id is required: an order is to one vendor.');
  const rawLines = Array.isArray(args?.lines) ? args.lines : [];
  if (!rawLines.length) throw new Error('lines is required: each tea and how much of it.');

  const lines: OrderLine[] = [];
  let currency: string | null = null;
  for (const [i, raw] of rawLines.entries()) {
    const teaId = str(raw?.tea_id, 80);
    if (!teaId) throw new Error(`lines[${i}] has no tea_id (from curate_find).`);
    const e = await entryById(env, auth, teaId);
    if (!e) throw new Error(`lines[${i}]: no such tea in Curate.`);
    const label = e.shop_name ? `${e.name} (${e.shop_name})` : (e.name ?? 'this tea');
    const q = raw?.quantity;
    const qAmount = Number(q?.amount);
    const qUnit = str(q?.unit, 10)?.toLowerCase() ?? '';
    if (!Number.isFinite(qAmount) || qAmount <= 0) throw new Error(`How much of ${label}? quantity.amount is required.`);
    let grams: number;
    let pieces: number | null = null;
    const pieceGrams = raw?.piece_grams != null ? Number(raw.piece_grams) : null;
    if (qUnit === 'piece') {
      if (!pieceGrams || !Number.isFinite(pieceGrams) || pieceGrams <= 0) throw new Error(`How much does one piece of ${label} weigh? piece_grams is needed for freight and stock.`);
      pieces = qAmount;
      grams = qAmount * pieceGrams;
    } else if (QTY_UNIT_GRAMS[qUnit]) {
      grams = qAmount * QTY_UNIT_GRAMS[qUnit];
      if (pieceGrams && pieceGrams > 0) pieces = grams / pieceGrams;
    } else {
      throw new Error(`quantity.unit for ${label} must be g, liang, jin, kg or piece.`);
    }
    const price = readQuotedPrice(raw?.price, label) ?? (e.price_amount != null
      ? (e.price_currency
        ? { price_amount: Number(e.price_amount), price_currency: String(e.price_currency), price_per_unit_grams: e.price_per_unit_grams == null ? null : Number(e.price_per_unit_grams), said: '' }
        : null)
      : null);
    if (!price) throw new Error(`${label} has no price with a currency. Ask Adrian what it costs and per what.`);
    let lineTotal: number;
    if (price.price_per_unit_grams != null) lineTotal = price.price_amount * grams / price.price_per_unit_grams;
    else if (pieces != null) lineTotal = price.price_amount * pieces;
    else throw new Error(`${label} is priced per piece: give quantity in pieces, or piece_grams.`);
    if (currency && currency !== price.price_currency) throw new Error(`One order is one currency: ${label} is in ${price.price_currency}, the rest in ${currency}. Split the order.`);
    currency = price.price_currency;
    lines.push({
      entryId: e.id, productId: e.draft_product_id ?? null, name: e.shop_name ?? e.name ?? 'Unnamed tea', type: e.category === 'teaware' ? 'Teaware' : (e.type ?? null), grams,
      quantityWords: `${qAmount} ${qUnit}`, unitPrice: price.price_per_unit_grams != null ? `${money(price.price_amount, price.price_currency)} per ${price.price_per_unit_grams} g` : `${money(price.price_amount, price.price_currency)} per piece`,
      lineTotal,
    });
  }
  const rates = await loadRates(env);
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  const totalUsd = toUsd(rates, total, currency!);
  if (totalUsd == null) throw new Error(`The shop has no exchange rate for ${currency}, so the order cannot be priced. Add the rate at /admin/currency first.`);

  // Landed cost from the real legs: the vendor's own, plus any shared legs named.
  const weightKg = lines.reduce((s, l) => s + l.grams, 0) / 1000;
  const vendorLegs = vendorPlan.id ? await currentLegs(env, auth, vendorPlan.id) : [];
  const sharedAll = await currentLegs(env, auth, null);
  const wanted: string[] = Array.isArray(args?.shared_legs) ? args.shared_legs.map((x: unknown) => String(x).trim().toLowerCase()) : [];
  const shared = sharedAll.filter(r => wanted.includes(r.leg.trim().toLowerCase()));
  const unknownShared = wanted.filter(w => !sharedAll.some(r => r.leg.trim().toLowerCase() === w));
  if (unknownShared.length) throw new Error(`No shared leg called: ${unknownShared.join(', ')}. Shared legs on record: ${sharedAll.map(r => r.leg).join(', ') || 'none'}.`);
  const legs = [...vendorLegs, ...shared];
  const freightLines: string[] = [];
  let freightUsd = 0;
  let freightKnown = legs.length > 0;
  for (const r of legs) {
    const perKgUsd = toUsd(rates, r.total_amount / r.weight_kg, r.currency);
    if (perKgUsd == null) { freightKnown = false; freightLines.push(`${r.leg}: no exchange rate for ${r.currency}`); continue; }
    freightUsd += perKgUsd * weightKg;
    freightLines.push(`${r.leg}: ${usd(perKgUsd * weightKg)} (${money(r.total_amount / r.weight_kg, r.currency)}/kg)`);
  }
  const grams = weightKg * 1000;
  const landed = freightKnown
    ? `Landed about ${usd(totalUsd + freightUsd)} (${usd((totalUsd + freightUsd) / grams)}/g): goods ${money(total, currency!)} ≈ ${usd(totalUsd)}, freight ${usd(freightUsd)} for ${weightKg} kg.`
    : `Goods ${money(total, currency!)} ≈ ${usd(totalUsd)}. No shipping cost on record for this route yet, so the landed cost is unknown.`;
  const vendorName = vendorPlan.name;
  const message = str(args?.message, 4000)
    ?? `Hello ${vendorName}, I would like to order:\n${lines.map(l => `- ${l.quantityWords} of ${l.name}`).join('\n')}\nPlease confirm the total and how to pay. Thank you, Adrian`;
  let shipsBy: string | null = null;
  if (args?.ships_by != null) {
    shipsBy = str(args.ships_by, 20)?.toLowerCase() ?? null;
    if (!shipsBy || !TRANSPORT_MODES.has(shipsBy)) throw new Error('ships_by must be air, sea, land or courier');
  }
  const ticket: OrderTicket = {
    kind: 'curate:order', accountId: auth.accountId, userId: auth.userId, agent: agentName(args), vendorPlan,
    currency: currency!, lines, total, totalUsd, message, notes: '', shipsBy,
    freightEstimate: { legs: legs.map(({id,leg,mode,total_amount,currency,weight_kg,observed_on}) => ({id,leg,mode,total_amount,currency,weight_kg,observed_on})), weight_kg: weightKg, goods_usd: totalUsd, freight_usd: freightKnown ? freightUsd : null, landed_estimate_usd: freightKnown ? totalUsd + freightUsd : null, recorded_at: new Date().toISOString(), estimated_only: true },
  };
  const token = await issueTicket(env, ticket, auth.tokenId);
  return previewEnvelope({
    action: 'curate_order',
    read_back: `Order from ${vendorName}${vendorPlan.isNew ? ' (new vendor)' : ''}: ${lines.map(l => `${l.quantityWords} of ${l.name} at ${l.unitPrice} = ${money(l.lineTotal, currency!)}`).join('; ')}. ${landed}`,
    freight: freightLines,
    shared_legs_available: wanted.length ? undefined : sharedAll.map(r => r.leg),
    message_to_copy: message,
    after_confirm: 'The order waits on the Purchase Orders page with this message to copy, and each tea waits as an arrival to approve into stock.',
  }, token);
};

async function commitOrder(env: ToolEnv, auth: ToolAuth, t: OrderTicket) {
  await requireCurateManager(env.DB, auth);
  for (const line of t.lines) if (!await entryById(env, auth, line.entryId)) throw new Error('Order tea is no longer active in this account');
  const vendor = await resolveVendorAtCommit(env, auth, t.vendorPlan, t.agent);
  if (!vendor) throw new Error('No vendor for this order.');
  const card = await vendorById(env, auth, vendor.id);
  const reach = card ? vendorSummary(card) : null;
  const contact = [reach?.wechat ? `WeChat ${reach.wechat}` : null, reach?.whatsapp ? `WhatsApp ${reach.whatsapp}` : null, reach?.phone ?? null].filter(Boolean).join(' · ') || null;
  const poId = crypto.randomUUID();
  const now = new Date().toISOString();
  const items = t.lines.map(l => ({
    product_id: l.productId, product_name: l.name, quantity_grams: l.grams,
    compass_entry_id: l.entryId, quantity: l.quantityWords, unit_price: l.unitPrice,
    line_total: Math.round(l.lineTotal * 100) / 100, currency: t.currency,
  }));
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO purchase_orders (id, account_id, vendor_name, vendor_id, vendor_contact, items_json, total_usd, display_currency, status, message_text, notes, freight_estimate_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`
    ).bind(poId, auth.accountId, vendor.name, vendor.id, contact, JSON.stringify(items), Math.round(t.totalUsd * 100) / 100, t.currency, t.message, null, t.freightEstimate ? JSON.stringify(t.freightEstimate) : null, now, now),
  ];
  for (const l of t.lines) {
    statements.push(env.DB.prepare(
      `INSERT INTO curate_receipt_proposals (id, account_id, compass_entry_id, product_id, product_name, product_type, purpose, quantity, unit, acquisition_kind, idempotency_key, proposed_by_user_id)
       VALUES (?, ?, ?, ?, ?, ?, 'working', ?, 'g', 'purchase', ?, ?)`
    ).bind(crypto.randomUUID(), auth.accountId, l.entryId, l.productId, l.name, l.type, l.grams, `order:${poId}:${l.entryId}`, auth.userId));
    statements.push(env.DB.prepare(
      `UPDATE tea_compass_entries SET decision = 'selected', status = 'buying', buy_quantity_grams = ?,
         vendor_id = COALESCE(vendor_id, ?), vendor_name = COALESCE(vendor_name, ?)${t.shipsBy ? ', transport_mode = ?' : ''}, updated_at = datetime('now')
       WHERE id = ? AND account_id = ?`
    ).bind(l.grams, vendor.id, vendor.name, ...(t.shipsBy ? [t.shipsBy] : []), l.entryId, auth.accountId));
  }
  await env.DB.batch(statements);
  return {
    committed: true,
    purchase_order_id: poId,
    where: 'Purchase Orders page (/admin/purchase-orders) and the vendor\'s page; arrivals wait to be approved into stock.',
    message_to_copy: t.message,
    freight_estimate: t.freightEstimate ?? null,
  };
}

// ── Tool: curate_get_vendor ───────────────────────────────────────────────────

const toolGetVendor: ToolHandler = async (env, auth, args) => {
  let id = str(args?.vendor_id, 80);
  if (!id) {
    const name = str(args?.name, 200);
    if (!name) throw new Error('vendor_id or name is required');
    const rows = await env.DB.prepare('SELECT id FROM customers WHERE account_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))')
      .bind(auth.accountId, name).all<{ id: string }>();
    if (!rows.results?.length) return { error: 'not_found', hint: 'Not in the shop yet. Research them, then curate_save_vendor.' };
    if (rows.results.length > 1) return { error: 'ambiguous', ids: rows.results.map(r => r.id) };
    id = rows.results[0].id;
  }
  const card = await vendorById(env, auth, id);
  if (!card) return { error: 'not_found' };
  const manager = await curateManagerAccess(env, auth);
  const [profile, teas, orders, todos, rates] = await Promise.all([
    env.DB.prepare('SELECT * FROM curate_vendor_profiles WHERE vendor_id = ? AND account_id = ?').bind(id, auth.accountId).first<Record<string, any>>(),
    env.DB.prepare(`SELECT * FROM tea_compass_entries WHERE account_id = ? AND vendor_id = ? AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL ${manager ? '' : 'AND user_id = ?'} ORDER BY updated_at DESC LIMIT 50`)
      .bind(auth.accountId, id, ...(manager ? [] : [auth.userId])).all<Record<string, any>>(),
    env.DB.prepare('SELECT id, status, total_usd, display_currency, items_json, message_text, created_at FROM purchase_orders WHERE account_id = ? AND vendor_id = ? ORDER BY created_at DESC LIMIT 20')
      .bind(auth.accountId, id).all<Record<string, any>>(),
    env.DB.prepare('SELECT id, text, created_at FROM curate_todos WHERE account_id = ? AND vendor_id = ? AND done_at IS NULL').bind(auth.accountId, id).all(),
    loadRates(env),
  ]);
  const own = await currentLegs(env, auth, id);
  const shared = await currentLegs(env, auth, null);
  return {
    card: vendorSummary(card),
    structured: await readVendorStructuredProfile(env.DB, auth, id),
    quotes: await listCurateQuotes(env.DB, auth, id),
    tags: parseJson<unknown>(card.tags, []),
    knows: profile ? {
      quotes_in: profile.price_currency, storage: profile.storage, story: profile.story,
      ships_from: profile.ships_from, route: profile.route, lead_time_days: profile.lead_time_days,
    } : null,
    freight: own.map(r => legReading(r, rates)),
    shared_freight: shared.map(r => legReading(r, rates)),
    teas: (teas.results ?? []).map(e => ({ id: e.id, name: e.name, shop_name: e.shop_name ?? null, status: e.status, decision: e.decision, missing: teaMissing(e) })),
    orders: (orders.results ?? []).map(o => ({
      id: o.id, status: o.status, total_usd: o.total_usd, currency: o.display_currency, created_at: o.created_at,
      items: parseJson<any[]>(o.items_json, []).map(i => `${i.quantity ?? `${i.quantity_grams} g`} of ${i.product_name}`),
    })),
    open_todos: todos.results ?? [],
  };
};

// ── Definitions ───────────────────────────────────────────────────────────────

const AGENT_PROP = { type: 'string', description: 'Who is calling: GrokBot, Hermes, ChatGPT, Claude.' };
const CONFIRM_PROP = { type: 'string', description: 'The confirmation_token from the preview, sent only after Adrian said yes.' };

const defs: ToolDefinition[] = [
  {
    name: 'curate_get_vendor',
    scope: 'inventory:read',
    description: 'Use this before filing anything from a vendor, and when Adrian asks about one: their card, what the shop knows about them (the currency they quote in, how they store tea, their story, their route home), the current shipping cost of each leg per kg, their teas in Curate, their orders and open to-dos. If a price comes with no currency, propose the one they quote in and read it back.',
    inputSchema: {
      type: 'object',
      properties: {
        vendor_id: { type: 'string', description: 'From curate_find.' },
        name: { type: 'string', description: 'Or the exact name.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'curate_record_freight',
    scope: 'stock:write',
    description: 'Use this when Adrian says what shipping cost, e.g. "it cost HK$450 to send 3 kg from Yee On to Guangzhou" or "the boat to Bali was 2,000 yuan for 20 kg". Keeps the total, its currency and the weight, per vendor and per leg; the per-kg cost is worked out from it and used to estimate landed costs on orders. A newer figure replaces the older as current. shared: true for a leg every vendor uses. Two steps (preview, then confirm).',
    inputSchema: {
      type: 'object',
      properties: {
        vendor_id: { type: 'string' },
        vendor_name: { type: 'string', description: 'The vendor this leg is for.' },
        shared: { type: 'boolean', description: 'true for a leg every vendor uses, e.g. the boat from China to Bali.' },
        leg: { type: 'string', description: 'The leg in words: "Hong Kong to Guangzhou", "Guangzhou to Bali by boat".' },
        mode: { type: 'string', enum: ['air', 'sea', 'land', 'courier'] },
        total: {
          type: 'object',
          description: 'What the whole shipment cost.',
          properties: { amount: { type: 'number' }, currency: { type: 'string', description: 'HKD, Yuan, USD, IDR…' } },
          required: ['amount', 'currency'],
          additionalProperties: false,
        },
        weight_kg: { type: 'number', description: 'How many kilos that cost moved.' },
        transit_days: { type: 'number', description: 'How long it took, if he said.' },
        observed_on: { type: 'string', description: 'The date of that shipment, YYYY-MM-DD. Defaults to today.' },
        note: { type: 'string' },
        agent: AGENT_PROP,
        confirm: CONFIRM_PROP,
      },
      required: ['leg', 'total', 'weight_kg'],
      additionalProperties: false,
    },
  },
  {
    name: 'curate_order',
    scope: 'stock:write',
    description: 'Use this when Adrian decides to buy, e.g. "I want one kilo of it". Writes the order to the Purchase Orders page with the message to send the vendor (pass message in the vendor\'s language, Chinese with English beneath for a Chinese-speaking vendor), works out the cost landed in Bali from the vendor\'s shipping legs, and leaves each tea as an arrival to approve into stock. Prices come from the tea unless given. One order is one vendor and one currency. Two steps (preview, then confirm).',
    inputSchema: {
      type: 'object',
      properties: {
        vendor_id: { type: 'string' },
        vendor_name: { type: 'string' },
        lines: {
          type: 'array',
          description: 'Each tea and how much.',
          items: {
            type: 'object',
            properties: {
              tea_id: { type: 'string', description: 'From curate_find.' },
              quantity: {
                type: 'object',
                properties: { amount: { type: 'number' }, unit: { type: 'string', enum: ['g', 'liang', 'jin', 'kg', 'piece'] } },
                required: ['amount', 'unit'],
                additionalProperties: false,
              },
              piece_grams: { type: 'number', description: 'Weight of one cake/brick/tuo, needed when ordering by the piece.' },
              price: {
                type: 'object',
                description: 'Only if different from the price on the tea.',
                properties: {
                  amount: { type: 'number' }, currency: { type: 'string' },
                  per: { type: 'string', enum: ['gram', 'liang', 'jin', 'kg', 'piece'] }, per_grams: { type: 'number' },
                },
                required: ['amount', 'currency'],
                additionalProperties: false,
              },
            },
            required: ['tea_id', 'quantity'],
            additionalProperties: false,
          },
        },
        shared_legs: { type: 'array', items: { type: 'string' }, description: 'Shared legs this order also travels, by name, e.g. ["Guangzhou to Bali by boat"]. The preview lists the ones on record.' },
        ships_by: { type: 'string', enum: ['air', 'sea', 'land', 'courier'] },
        message: { type: 'string', description: 'The message for Adrian to copy to the vendor.' },
        note: { type: 'string' },
        agent: AGENT_PROP,
        confirm: CONFIRM_PROP,
      },
      additionalProperties: false,
    },
  },
];

export const curateSupplyTools: ToolModule = {
  area: 'curate-supply',
  defs,
  handlers: {
    curate_get_vendor: toolGetVendor,
    curate_record_freight: toolRecordFreight,
    curate_order: toolOrder,
  },
};

export const __testables = { toUsd, legReading, datedLine };
