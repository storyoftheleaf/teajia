/**
 * Curate for agents: the same sourcing work the app does, reachable from
 * Claude, ChatGPT, Hermes or GrokBot through the shop's MCP connection.
 *
 * Adrian, 2026-10-06/07: whether he talks to an agent or types in the app, the
 * result must land in the same place. So nothing here keeps its own copy of a
 * tea or a vendor. A tea is a `tea_compass_entries` row owned by the token's
 * user (the app reads exactly `user_id = me AND account_id = shop`), a vendor
 * is a `customers` row tagged vendor, a transcript is a row in `notes` anchored
 * to the tea, and a price is the three compass columns the app already writes:
 * amount, currency, and how many grams the amount is for (jin 500, liang 50,
 * gram 1, a cake or brick NULL because it is priced per piece).
 *
 * Three kinds of write, and the line between them is deliberate:
 *
 *   - What changes the shop's record of a tea or a vendor (add a tea, fill a
 *     field, a price, tasting, a vendor's contact, picking suggestions) goes
 *     through the preview/confirm ticket in `tickets.ts`. Adrian sees the
 *     preview read back to him and says yes.
 *   - What an agent finds on its own (ten teas on a vendor's website) does not
 *     touch the shop at all: it goes to `curate_suggestions`, a waiting list,
 *     and becomes a tea only when Adrian picks it. The pick is the approval, so
 *     the suggestion itself is written in one step; a ticket in front of a list
 *     whose whole purpose is to be approved later would be the same yes twice.
 *   - A to-do ("remind me to ask Wang about the 2018") is his own scratch line.
 *     One step, and it can be ticked off the same way.
 *
 * Money rules, from CLAUDE.md, applied here rather than restated:
 *   - A price is an amount AND a currency, or it is refused. The currency is
 *     resolved through `refreshedCurrencyName`, the one gate onto the shop's
 *     alias map, so 'cny', 'RMB' and 'Yuan' all store as the shop's 'Yuan'.
 *   - Nothing entered is NULL; a typed 0 is kept as 0. No blank becomes zero.
 *   - `tea_compass_entries.price_currency` carries DEFAULT 'NT', so every insert
 *     here names the column, NULL when no price was given, and the unit is
 *     never left for the table to guess.
 */
import { refreshedCurrencyName, REFRESHED_CURRENCIES } from '../exchangeRateFeed';
import { mergeProductTasting, readStoredTasting, tastingTermLabel, TASTING_TERM_CATEGORIES } from '../curateImportTasting';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { INVALID_TICKET, consumeTicket, issueTicket, previewEnvelope } from './tickets';

// ── Small readers ─────────────────────────────────────────────────────────────

export function str(value: unknown, max = 500): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

export function agentName(args: any): string {
  return str(args?.agent, 60) ?? 'an agent';
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw !== 'string') return raw as T;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

/** How many grams a quoted price is for. A piece (cake, brick, tuo, pot) is NULL. */
const PRICE_UNIT_GRAMS: Record<string, number | null> = {
  gram: 1,
  liang: 50,
  jin: 500,
  kg: 1000,
  piece: null,
};
const PRICE_UNITS = Object.keys(PRICE_UNIT_GRAMS);

export type QuotedPrice = {
  price_amount: number;
  price_currency: string;
  price_per_unit_grams: number | null;
  /** How the vendor said it, for reading back: "¥1,200 per cake". */
  said: string;
};

/**
 * Read a price the way a vendor quotes it. Refuses rather than guesses: no
 * currency, a currency the shop keeps no live rate for, the UNK sentinel, or a
 * unit nobody named are all errors the agent turns into one question.
 */
export function readQuotedPrice(raw: unknown, teaLabel = 'this tea'): QuotedPrice | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error(`price for ${teaLabel} must be an object: {amount, currency, per}`);
  const p = raw as Record<string, unknown>;
  if (p.amount == null || p.amount === '') throw new Error(`price for ${teaLabel} has no amount. Leave price out entirely if Adrian has not said one.`);
  const amount = typeof p.amount === 'number' ? p.amount : Number(String(p.amount).replace(/[,\s]/g, ''));
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`price.amount for ${teaLabel} must be a number of 0 or more`);
  const typed = str(p.currency, 20);
  if (!typed) {
    throw new Error(`price for ${teaLabel} has no currency. A cost without its currency is not a cost: ask Adrian what it was quoted in (yuan at a mainland table is usual, but ask).`);
  }
  if (/^unk$/i.test(typed)) throw new Error("'UNK' means nobody recorded a currency, so it is not an answer");
  const currency = refreshedCurrencyName(typed);
  if (!currency) {
    throw new Error(`${typed} is not a currency this shop keeps a live rate for. Use one of: ${[...REFRESHED_CURRENCIES].join(', ')}.`);
  }
  let perGrams: number | null;
  let perLabel: string;
  if (p.per_grams != null && p.per_grams !== '') {
    const g = Number(p.per_grams);
    if (!Number.isFinite(g) || g <= 0) throw new Error(`price.per_grams for ${teaLabel} must be a positive number of grams`);
    perGrams = g;
    perLabel = `per ${g} g`;
  } else {
    const per = str(p.per, 20)?.toLowerCase() ?? null;
    if (!per || !PRICE_UNITS.includes(per)) {
      throw new Error(`price.per for ${teaLabel} must say what the amount is for: ${PRICE_UNITS.join(', ')} (piece = a cake, brick, tuo or teapot), or give per_grams.`);
    }
    perGrams = PRICE_UNIT_GRAMS[per];
    perLabel = per === 'piece' ? 'per piece' : `per ${per}`;
  }
  return {
    price_amount: amount,
    price_currency: currency,
    price_per_unit_grams: perGrams,
    said: `${amount.toLocaleString('en-US')} ${currency} ${perLabel}`,
  };
}

/** A tea's year is an integer column; "1990s" or "late 80s" belongs in `era`. */
function readYear(raw: unknown): { year?: number; era?: string } {
  const text = str(raw, 40);
  if (!text) return {};
  if (/^\d{4}$/.test(text)) {
    const year = Number(text);
    if (year >= 1800 && year <= 2100) return { year };
  }
  return { era: text };
}

const CATEGORY_VALUES = new Set(['tea', 'teaware']);
export const TRANSPORT_MODES = new Set(['air', 'sea', 'land', 'courier']);

/** "I'm interested in buying it" lands on the same two columns the app's buttons write. */
const WANTS: Record<string, { decision: string; status: string; said: string }> = {
  considering: { decision: 'considering', status: 'want', said: 'interested, deciding' },
  buying: { decision: 'selected', status: 'buying', said: 'buying it' },
  passed: { decision: 'passed_on', status: 'pass', said: 'passing on it' },
};

/** The tea fields an agent may set, read into compass column values. */
function readTeaFields(args: any, label: string): { values: Record<string, unknown>; price: QuotedPrice | null; lines: string[] } {
  const values: Record<string, unknown> = {};
  const lines: string[] = [];
  const simple: Array<[string, string, number]> = [
    ['name', 'name', 300], ['chinese_name', 'Chinese name', 200], ['type', 'type', 80],
    ['form', 'form', 80], ['season', 'season', 40], ['storage', 'storage', 80],
    ['origin_country', 'country', 80], ['origin_region', 'region', 160], ['cultivar', 'cultivar', 120],
    ['description', 'description', 4000], ['teaware_category', 'teaware kind', 80], ['material', 'material', 120],
    ['shop_name', 'shop name', 200],
  ];
  for (const [key, word, max] of simple) {
    const v = str(args?.[key], max);
    if (v != null) { values[key] = v; if (key !== 'name') lines.push(`${word}: ${v}`); }
  }
  if (args?.category != null) {
    const c = str(args.category, 20);
    if (!c || !CATEGORY_VALUES.has(c)) throw new Error('category must be tea or teaware');
    values.category = c;
  }
  if (args?.capacity_ml != null && args.capacity_ml !== '') {
    const ml = Number(args.capacity_ml);
    if (!Number.isInteger(ml) || ml <= 0) throw new Error('capacity_ml must be a whole number of millilitres');
    values.capacity_ml = ml;
    lines.push(`capacity: ${ml} ml`);
  }
  if (args?.ships_by != null) {
    const mode = str(args.ships_by, 20)?.toLowerCase() ?? null;
    if (!mode || !TRANSPORT_MODES.has(mode)) throw new Error('ships_by must be air, sea, land or courier');
    values.transport_mode = mode;
    lines.push(`ships by: ${mode}`);
  }
  if (args?.wants != null) {
    const wants = str(args.wants, 20);
    const mapped = wants ? WANTS[wants] : undefined;
    if (!mapped) throw new Error(`wants must be one of: ${Object.keys(WANTS).join(', ')}`);
    values.decision = mapped.decision;
    values.status = mapped.status;
    lines.push(`Adrian: ${mapped.said}`);
  }
  const y = readYear(args?.year);
  if (y.year != null) { values.year = y.year; lines.push(`year: ${y.year}`); }
  if (y.era != null) { values.era = y.era; lines.push(`era: ${y.era}`); }
  const price = readQuotedPrice(args?.price, label);
  if (price) {
    values.price_amount = price.price_amount;
    values.price_currency = price.price_currency;
    values.price_per_unit_grams = price.price_per_unit_grams;
    lines.unshift(`price: ${price.said}`);
  }
  return { values, price, lines };
}

/** Tasting terms by category, taxonomy ids only, plus an optional 1-10 score. */
function readTasting(args: any): { byCategory: Record<string, string[]>; score: number | null; lines: string[] } {
  const byCategory: Record<string, string[]> = {};
  const lines: string[] = [];
  const t = args?.tasting;
  if (t != null) {
    if (typeof t !== 'object' || Array.isArray(t)) throw new Error('tasting must be an object of taxonomy term ids by category');
    for (const [category, terms] of Object.entries(t as Record<string, unknown>)) {
      if (!(TASTING_TERM_CATEGORIES as readonly string[]).includes(category)) {
        throw new Error(`tasting.${category} is not a tasting category. Use: ${TASTING_TERM_CATEGORIES.join(', ')}`);
      }
      if (!Array.isArray(terms)) throw new Error(`tasting.${category} must be a list of term ids`);
      byCategory[category] = terms.map(term => String(term).trim()).filter(Boolean);
    }
  }
  let score: number | null = null;
  if (args?.score != null && args.score !== '') {
    score = Number(args.score);
    if (!Number.isInteger(score) || score < 1 || score > 10) throw new Error('score must be a whole number from 1 to 10');
  }
  // Validate now so a bad term is refused at preview, not at commit.
  if (Object.keys(byCategory).length) {
    mergeProductTasting(null, byCategory);
    for (const [category, terms] of Object.entries(byCategory)) {
      lines.push(`${category}: ${terms.length ? terms.map(tastingTermLabel).join(' · ') : '(cleared)'}`);
    }
  }
  if (score != null) lines.push(`score: ${score}/10`);
  return { byCategory, score, lines };
}

// ── Vendors ───────────────────────────────────────────────────────────────────

export type VendorRow = {
  id: string; name: string; company: string | null; phone: string | null; whatsapp: string | null;
  email: string | null; city: string | null; country: string | null; address: string | null;
  notes: string | null; contacts: string | null; tags: string | null; type: string | null;
};

const VENDOR_COLUMNS = 'id, name, company, phone, whatsapp, email, city, country, address, notes, contacts, tags, type';

function isVendorRow(row: Pick<VendorRow, 'tags' | 'type'>): boolean {
  return /vendor/i.test(row.tags ?? '') || row.type === 'vendor' || row.type === 'supplier';
}

type ContactLike = { channel?: string; handle?: string; type?: string; value?: string; label?: string };

/** Contacts as the admin reads them ({channel, handle}), tolerating the older {type, value} rows. */
function readContacts(raw: unknown): ContactLike[] {
  const list = parseJson<unknown>(raw, []);
  return Array.isArray(list) ? list.filter(c => c && typeof c === 'object') as ContactLike[] : [];
}

function contactChannel(c: ContactLike): string | null {
  if (c.label === 'website') return 'website';
  return (c.channel ?? c.type ?? null);
}
function contactHandle(c: ContactLike): string | null {
  return (c.handle ?? c.value ?? null);
}

function vendorReach(row: VendorRow) {
  const contacts = readContacts(row.contacts);
  const has = (channel: string) => contacts.some(c => contactChannel(c) === channel && contactHandle(c));
  return {
    wechat: has('wechat'),
    whatsapp: !!row.whatsapp || has('whatsapp'),
    phone: !!row.phone || has('phone'),
    website: has('website'),
    contacts,
  };
}

async function findVendors(env: ToolEnv, auth: ToolAuth, name: string): Promise<VendorRow[]> {
  const rows = await env.DB.prepare(
    `SELECT ${VENDOR_COLUMNS} FROM customers WHERE account_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?))`
  ).bind(auth.accountId, name).all<VendorRow>();
  return rows.results ?? [];
}

export async function vendorById(env: ToolEnv, auth: ToolAuth, id: string): Promise<VendorRow | null> {
  return env.DB.prepare(`SELECT ${VENDOR_COLUMNS} FROM customers WHERE id = ? AND account_id = ?`)
    .bind(id, auth.accountId).first<VendorRow>();
}

export type VendorPlan = { id: string | null; name: string; isNew: boolean };

/**
 * Who sold it. An id must exist in this shop; a name matches an existing
 * vendor by name, or is planned as a new
 * vendor. Two vendors with one name is refused with both ids, because guessing
 * puts a tea on the wrong card in silence.
 */
export async function planVendor(env: ToolEnv, auth: ToolAuth, vendorId: string | null, vendorName: string | null): Promise<VendorPlan | null> {
  if (vendorId) {
    const row = await vendorById(env, auth, vendorId);
    if (!row) throw new Error(`No vendor with id ${vendorId} in this shop. Use curate_find to look it up.`);
    return { id: row.id, name: row.name, isNew: false };
  }
  if (!vendorName) return null;
  // Only people already tagged vendor match: a customer who happens to share a
  // name must not quietly become a supplier.
  const pool = (await findVendors(env, auth, vendorName)).filter(isVendorRow);
  if (pool.length === 0) return { id: null, name: vendorName, isNew: true };
  if (pool.length > 1) {
    throw new Error(`More than one person in the shop is called "${vendorName}": ${pool.map(v => `${v.id}${v.company ? ` (${v.company})` : ''}`).join(', ')}. Pass vendor_id instead.`);
  }
  return { id: pool[0].id, name: pool[0].name, isNew: false };
}

/**
 * The people behind a tea, all private: the vendor who sells it, the freight
 * forwarder who moves it, the warehouse that holds it. Each is a `customers`
 * row with its own tag, so a forwarder never shows up in the vendor picker.
 */
export type ContactRole = 'vendor' | 'freight' | 'warehouse';
const ROLE_TAG: Record<ContactRole, string> = { vendor: 'vendor', freight: 'freight', warehouse: 'warehouse' };
const ROLE_TYPE: Record<ContactRole, string> = { vendor: 'vendor', freight: 'logistics', warehouse: 'logistics' };
const ROLE_WORD: Record<ContactRole, string> = { vendor: 'vendor', freight: 'freight forwarder', warehouse: 'warehouse' };

function hasRole(row: Pick<VendorRow, 'tags' | 'type'>, role: ContactRole): boolean {
  if (role === 'vendor') return isVendorRow(row);
  return new RegExp(ROLE_TAG[role], 'i').test(row.tags ?? '');
}

function newVendorStatements(env: ToolEnv, auth: ToolAuth, id: string, name: string, agent: string, role: ContactRole = 'vendor'): D1PreparedStatement[] {
  return [
    env.DB.prepare(
      `INSERT INTO customers (id, account_id, type, name, tags, contacts, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', ?, datetime('now'), datetime('now'))`
    ).bind(id, auth.accountId, ROLE_TYPE[role], name, JSON.stringify([ROLE_TAG[role]]), `curate (added by ${agent})`),
  ];
}

/** What the shop knows about how a vendor works. Every field optional; only what is sent changes. */
export type VendorProfileWrite = {
  price_currency?: string; storage?: string; story?: string; ships_from?: string; route?: string; lead_time_days?: number;
};

function readVendorProfile(args: any, lines: string[]): VendorProfileWrite {
  const profile: VendorProfileWrite = {};
  const typed = str(args?.price_currency, 20);
  if (typed) {
    if (/^unk$/i.test(typed)) throw new Error("'UNK' is not a currency");
    const currency = refreshedCurrencyName(typed);
    if (!currency) throw new Error(`${typed} is not a currency this shop keeps a live rate for. Use one of: ${[...REFRESHED_CURRENCIES].join(', ')}.`);
    profile.price_currency = currency;
    lines.push(`quotes prices in: ${currency}`);
  }
  for (const [key, word] of [['storage', 'stores tea'], ['ships_from', 'ships from'], ['route', 'route home']] as const) {
    const v = str(args?.[key], 500);
    if (v) { profile[key] = v; lines.push(`${word}: ${v}`); }
  }
  const story = str(args?.story, 2000);
  if (story) { profile.story = story; lines.push(`their story: ${story}`); }
  if (args?.lead_time_days != null && args.lead_time_days !== '') {
    const days = Number(args.lead_time_days);
    if (!Number.isInteger(days) || days < 0) throw new Error('lead_time_days must be a whole number of days');
    profile.lead_time_days = days;
    lines.push(`takes about ${days} days to arrive`);
  }
  return profile;
}

async function writeVendorProfile(env: ToolEnv, auth: ToolAuth, vendorId: string, p: VendorProfileWrite, agent: string) {
  if (!Object.keys(p).length) return;
  const current = await env.DB.prepare('SELECT * FROM curate_vendor_profiles WHERE vendor_id = ? AND account_id = ?')
    .bind(vendorId, auth.accountId).first<Record<string, any>>();
  // The story grows: a new fact is added under what is already known, dated.
  const story = p.story
    ? (current?.story ? `${current.story}\n${datedLine(agent, p.story)}` : datedLine(agent, p.story))
    : current?.story ?? null;
  const merged = {
    price_currency: p.price_currency ?? current?.price_currency ?? null,
    storage: p.storage ?? current?.storage ?? null,
    story,
    ships_from: p.ships_from ?? current?.ships_from ?? null,
    route: p.route ?? current?.route ?? null,
    lead_time_days: p.lead_time_days ?? current?.lead_time_days ?? null,
  };
  await env.DB.prepare(
    `INSERT INTO curate_vendor_profiles (vendor_id, account_id, price_currency, storage, story, ships_from, route, lead_time_days, updated_by_agent, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(vendor_id) DO UPDATE SET price_currency = excluded.price_currency, storage = excluded.storage, story = excluded.story,
       ships_from = excluded.ships_from, route = excluded.route, lead_time_days = excluded.lead_time_days,
       updated_by_agent = excluded.updated_by_agent, updated_at = excluded.updated_at
     WHERE curate_vendor_profiles.account_id = excluded.account_id`
  ).bind(vendorId, auth.accountId, merged.price_currency, merged.storage, merged.story, merged.ships_from, merged.route, merged.lead_time_days, agent).run();
}

async function ensureVendorRelationship(env: ToolEnv, auth: ToolAuth, customerId: string) {
  // Same row the admin writes when a person is tagged vendor. A database that
  // predates contact_relationships keeps working without it.
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO contact_relationships (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
       VALUES (?, ?, ?, 'vendor', 'mcp', 'customer', ?)`
    ).bind(crypto.randomUUID(), auth.accountId, customerId, customerId).run();
  } catch { /* older database */ }
}

export async function resolveVendorAtCommit(env: ToolEnv, auth: ToolAuth, plan: VendorPlan | null, agent: string): Promise<{ id: string; name: string } | null> {
  if (!plan) return null;
  if (plan.id) {
    const row = await vendorById(env, auth, plan.id);
    if (!row) throw new Error('That vendor was removed after the preview. Preview again.');
    return { id: row.id, name: row.name };
  }
  // A vendor may have been created between preview and confirm (two picks in a row).
  const again = (await findVendors(env, auth, plan.name)).filter(isVendorRow);
  if (again.length === 1) return { id: again[0].id, name: again[0].name };
  const id = crypto.randomUUID();
  await env.DB.batch(newVendorStatements(env, auth, id, plan.name, agent));
  await ensureVendorRelationship(env, auth, id);
  return { id, name: plan.name };
}

export function datedLine(agent: string, text: string): string {
  return `${today()} (${agent}): ${text}`;
}

// ── Teas (compass entries) ────────────────────────────────────────────────────

export type EntryRow = Record<string, any> & { id: string; name: string | null };

export async function entryById(env: ToolEnv, auth: ToolAuth, id: string): Promise<EntryRow | null> {
  return env.DB.prepare('SELECT * FROM tea_compass_entries WHERE id = ? AND account_id = ? AND user_id = ?')
    .bind(id, auth.accountId, auth.userId).first<EntryRow>();
}

/** What a Curate tea is still missing, most important first: cost, then where it is from. */
export function teaMissing(e: Record<string, any>): string[] {
  const missing: string[] = [];
  const isWare = e.category === 'teaware';
  if (e.price_amount == null) missing.push('cost');
  else if (!e.price_currency) missing.push('currency of the price');
  if (!isWare && e.origin_region == null && e.origin_country == null) missing.push('where it is from');
  if (e.vendor_id == null && !e.vendor_name) missing.push('who sold it');
  if (!isWare && e.type == null) missing.push('type');
  if (!isWare && e.year == null && !e.era) missing.push('year');
  return missing;
}

function askFor(e: Record<string, any>, missing: string[]): string {
  const tea = e.name || 'this tea';
  const from = e.vendor_name ? ` from ${e.vendor_name}` : '';
  switch (missing[0]) {
    case 'cost': return `What did ${tea}${from} cost, in what currency, and per what (jin, liang, cake, gram)?`;
    case 'currency of the price': return `${tea}${from} is down at ${e.price_amount}: in which currency?`;
    case 'where it is from': return `Where is ${tea}${from} from?`;
    case 'who sold it': return `Who did ${tea} come from?`;
    case 'type': return `What kind of tea is ${tea}${from} (sheng, shou, oolong, white…)?`;
    case 'year': return `What year is ${tea}${from}?`;
    default: return '';
  }
}

function teaSummary(e: Record<string, any>) {
  const missing = teaMissing(e);
  return {
    id: e.id,
    name: e.name,
    vendor: e.vendor_name ?? null,
    vendor_id: e.vendor_id ?? null,
    category: e.category ?? 'tea',
    type: e.type ?? null,
    year: e.year ?? e.era ?? null,
    origin: [e.origin_region, e.origin_country].filter(Boolean).join(', ') || null,
    price: e.price_amount == null ? null : {
      amount: e.price_amount,
      currency: e.price_currency ?? null,
      per_grams: e.price_per_unit_grams ?? null,
    },
    shop_name: e.shop_name ?? null,
    ships_by: e.transport_mode ?? null,
    status: e.status ?? null,
    decision: e.decision ?? null,
    sample_state: e.sample_state ?? null,
    missing,
  };
}

const CLOSED_STATUSES = "('pass', 'in_stock', 'depleted')";

// ── Tickets ───────────────────────────────────────────────────────────────────

type TeaWrite = {
  values: Record<string, unknown>;
  clear: string[];
  tasting: Record<string, string[]> | null;
  score: number | null;
  note: string | null;
  said: string | null;
  vendorNote: string | null;
  todo: string | null;
  vendor: VendorPlan | null;
  sample: boolean;
  agent: string;
};

type AddTeaTicket = { kind: 'curate:add_tea'; accountId: string; userId: string; entryId: string; write: TeaWrite };
type UpdateTeaTicket = { kind: 'curate:update_tea'; accountId: string; userId: string; entryId: string; write: TeaWrite };
type SaveVendorTicket = {
  kind: 'curate:save_vendor'; accountId: string; vendorId: string | null; name: string; agent: string;
  rename: string | null; columns: Record<string, string>; contacts: Array<{ channel: string; handle: string; label?: string }>;
  note: string | null; role: ContactRole; profile: VendorProfileWrite;
};
type PickTicket = {
  kind: 'curate:pick'; accountId: string; userId: string; agent: string;
  pick: string[]; drop: string[]; as: 'sample' | 'considering';
};
type CurateTicket = AddTeaTicket | UpdateTeaTicket | SaveVendorTicket | PickTicket;

const CLEARABLE = new Set(['chinese_name', 'type', 'form', 'season', 'storage', 'origin_country', 'origin_region',
  'cultivar', 'description', 'year', 'era', 'price', 'vendor', 'teaware_category', 'material', 'capacity_ml',
  'shop_name', 'transport_mode']);

function readTeaWrite(args: any, label: string, vendor: VendorPlan | null): { write: TeaWrite; lines: string[] } {
  const fields = readTeaFields(args, label);
  const tasting = readTasting(args);
  const clear = Array.isArray(args?.clear) ? args.clear.map((c: unknown) => String(c)) : [];
  for (const c of clear) if (!CLEARABLE.has(c)) throw new Error(`clear: ${c} cannot be cleared here. Clearable: ${[...CLEARABLE].join(', ')}`);
  const write: TeaWrite = {
    values: fields.values,
    clear,
    tasting: Object.keys(tasting.byCategory).length ? tasting.byCategory : null,
    score: tasting.score,
    note: str(args?.note, 8000),
    said: str(args?.said, 20000),
    vendorNote: str(args?.vendor_note, 4000),
    todo: str(args?.todo, 500),
    vendor,
    sample: args?.sample === true,
    agent: agentName(args),
  };
  const lines: string[] = [];
  for (const l of fields.lines) lines.push(`Tea · ${l}`);
  for (const l of tasting.lines) lines.push(`Tasting · ${l}`);
  if (vendor) lines.push(`Vendor · ${vendor.name}${vendor.isNew ? ' (new vendor, name only)' : ''}`);
  if (write.note) lines.push(`Story note · ${write.note.slice(0, 160)}${write.note.length > 160 ? '…' : ''}`);
  if (write.said) lines.push(`What Adrian said, kept whole · ${write.said.length} characters`);
  if (write.vendorNote) lines.push(`On the vendor's card · ${write.vendorNote}`);
  if (write.todo) lines.push(`To do · ${write.todo}`);
  if (write.sample) lines.push('Marked as a sample to request');
  for (const c of clear) lines.push(`Cleared · ${c}`);
  return { write, lines };
}

async function commitTeaWrite(env: ToolEnv, auth: ToolAuth, entryId: string, w: TeaWrite, isNew: boolean) {
  const vendor = await resolveVendorAtCommit(env, auth, w.vendor, w.agent);
  const values: Record<string, unknown> = { ...w.values };
  if (vendor) { values.vendor_id = vendor.id; values.vendor_name = vendor.name; }
  for (const c of w.clear) {
    if (c === 'price') { values.price_amount = null; values.price_currency = null; values.price_per_unit_grams = null; }
    else if (c === 'vendor') { values.vendor_id = null; values.vendor_name = null; }
    else values[c] = null;
  }
  if (w.sample) values.sample_state = 'requested';

  const statements: D1PreparedStatement[] = [];
  if (isNew) {
    const row: Record<string, unknown> = {
      category: 'tea',
      status: 'noted',
      // Named so the table's DEFAULT 'NT' cannot answer for a price nobody gave.
      price_amount: null, price_currency: null, price_per_unit_grams: null,
      photos: '[]', audio_clips: '[]',
      ...values,
    };
    if (w.tasting || w.score != null) {
      const merged = w.tasting ? mergeProductTasting(null, w.tasting).next : {};
      if (w.score != null) merged.quality = w.score;
      row.tasting = JSON.stringify(merged);
    }
    const cols = Object.keys(row);
    statements.push(env.DB.prepare(
      `INSERT INTO tea_compass_entries (id, user_id, account_id, ${cols.join(', ')}, created_at, updated_at)
       VALUES (?, ?, ?, ${cols.map(() => '?').join(', ')}, datetime('now'), datetime('now'))`
    ).bind(entryId, auth.userId, auth.accountId, ...cols.map(c => row[c])));
  } else {
    const current = await entryById(env, auth, entryId);
    if (!current) throw new Error('That tea is no longer in Curate.');
    if (w.tasting || w.score != null) {
      const merged = w.tasting ? mergeProductTasting(current.tasting, w.tasting).next : readStoredTasting(current.tasting);
      if (w.score != null) merged.quality = w.score;
      values.tasting = JSON.stringify(merged);
    }
    const cols = Object.keys(values);
    if (cols.length) {
      statements.push(env.DB.prepare(
        `UPDATE tea_compass_entries SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = datetime('now')
         WHERE id = ? AND account_id = ? AND user_id = ?`
      ).bind(...cols.map(c => values[c]), entryId, auth.accountId, auth.userId));
    }
  }
  const author = `Adrian (via ${w.agent})`;
  if (w.said) {
    statements.push(env.DB.prepare(
      `INSERT INTO notes (id, account_id, compass_entry_id, text, source_type, author_id, author_name, visibility, created_at)
       VALUES (?, ?, ?, ?, 'voice', ?, ?, 'private', datetime('now'))`
    ).bind(crypto.randomUUID(), auth.accountId, entryId, w.said, auth.userId, author));
  }
  if (w.note) {
    statements.push(env.DB.prepare(
      `INSERT INTO notes (id, account_id, compass_entry_id, text, source_type, author_id, author_name, visibility, created_at)
       VALUES (?, ?, ?, ?, 'manual', ?, ?, 'private', datetime('now'))`
    ).bind(crypto.randomUUID(), auth.accountId, entryId, w.note, auth.userId, author));
  }
  const vendorIdForExtras = vendor?.id ?? (isNew ? null : (await entryById(env, auth, entryId))?.vendor_id ?? null);
  if (w.vendorNote) {
    if (!vendorIdForExtras) throw new Error('vendor_note needs the tea to have a vendor. Pass vendor_name or vendor_id too.');
    statements.push(env.DB.prepare(
      `UPDATE customers SET notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || char(10) || ? END,
         updated_at = datetime('now') WHERE id = ? AND account_id = ?`
    ).bind(datedLine(w.agent, w.vendorNote), datedLine(w.agent, w.vendorNote), vendorIdForExtras, auth.accountId));
  }
  if (w.todo) {
    statements.push(env.DB.prepare(
      `INSERT INTO curate_todos (id, account_id, created_by_user_id, text, compass_entry_id, vendor_id, from_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), auth.accountId, auth.userId, w.todo, entryId, vendorIdForExtras, w.agent));
  }
  if (statements.length) await env.DB.batch(statements);
  const after = await entryById(env, auth, entryId);
  return { committed: true, tea: after ? teaSummary(after) : { id: entryId } };
}

// ── Tool: curate_find ─────────────────────────────────────────────────────────

const toolFind: ToolHandler = async (env, auth, args) => {
  const q = str(args?.query, 120);
  const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 50);
  const like = q ? `%${q.toLowerCase()}%` : null;
  const teas = await env.DB.prepare(
    `SELECT * FROM tea_compass_entries WHERE account_id = ? AND user_id = ?
       ${like ? 'AND (LOWER(COALESCE(name, \'\')) LIKE ? OR LOWER(COALESCE(chinese_name, \'\')) LIKE ? OR LOWER(COALESCE(vendor_name, \'\')) LIKE ?)' : ''}
     ORDER BY updated_at DESC LIMIT ?`
  ).bind(auth.accountId, auth.userId, ...(like ? [like, like, like] : []), limit).all<EntryRow>();
  const vendors = await env.DB.prepare(
    `SELECT ${VENDOR_COLUMNS} FROM customers WHERE account_id = ?
       AND (tags LIKE '%vendor%' OR type IN ('vendor', 'supplier'))
       ${like ? 'AND (LOWER(name) LIKE ? OR LOWER(COALESCE(company, \'\')) LIKE ?)' : ''}
     ORDER BY updated_at DESC LIMIT ?`
  ).bind(auth.accountId, ...(like ? [like, like] : []), limit).all<VendorRow>();
  return {
    teas: (teas.results ?? []).map(teaSummary),
    vendors: (vendors.results ?? []).map(vendorSummary),
  };
};

export function vendorSummary(v: VendorRow) {
  const reach = vendorReach(v);
  const missing: string[] = [];
  if (!reach.wechat) missing.push('WeChat');
  if (!reach.wechat && !reach.whatsapp && !reach.phone) missing.push('any way to reach them');
  if (!v.city && !v.country && !v.address) missing.push('where they are');
  return {
    id: v.id,
    name: v.name,
    company: v.company,
    city: v.city,
    country: v.country,
    phone: v.phone,
    whatsapp: v.whatsapp,
    wechat: reach.contacts.find(c => contactChannel(c) === 'wechat') ? contactHandle(reach.contacts.find(c => contactChannel(c) === 'wechat')!) : null,
    website: reach.contacts.find(c => contactChannel(c) === 'website') ? contactHandle(reach.contacts.find(c => contactChannel(c) === 'website')!) : null,
    notes: v.notes,
    missing,
  };
}

// ── Tool: curate_get_tea ──────────────────────────────────────────────────────

const toolGetTea: ToolHandler = async (env, auth, args) => {
  const id = str(args?.tea_id, 80);
  if (!id) throw new Error('tea_id is required (from curate_find)');
  const e = await entryById(env, auth, id);
  if (!e) return { error: 'not_found' };
  const [notes, todos, vendor] = await Promise.all([
    env.DB.prepare(`SELECT text, source_type, author_name, created_at FROM notes
                    WHERE account_id = ? AND compass_entry_id = ? AND (deleted IS NULL OR deleted = 0) ORDER BY created_at ASC`)
      .bind(auth.accountId, id).all(),
    env.DB.prepare('SELECT id, text, created_at FROM curate_todos WHERE account_id = ? AND compass_entry_id = ? AND done_at IS NULL ORDER BY created_at ASC')
      .bind(auth.accountId, id).all(),
    e.vendor_id ? vendorById(env, auth, String(e.vendor_id)) : Promise.resolve(null),
  ]);
  const tasting = readStoredTasting(e.tasting);
  return {
    tea: teaSummary(e),
    details: {
      chinese_name: e.chinese_name, form: e.form, season: e.season, storage: e.storage,
      cultivar: e.cultivar, description: e.description, notes_field: e.notes,
      decision: e.decision, created_at: e.created_at, updated_at: e.updated_at,
    },
    tasting: Object.fromEntries(Object.entries(tasting).map(([k, v]) =>
      [k, Array.isArray(v) ? v.map(t => ({ id: t, label: tastingTermLabel(String(t)) })) : v])),
    notes: notes.results ?? [],
    open_todos: todos.results ?? [],
    vendor: vendor ? vendorSummary(vendor) : null,
  };
};

// ── Tool: curate_whats_missing ────────────────────────────────────────────────

const toolWhatsMissing: ToolHandler = async (env, auth, args) => {
  const limit = Math.min(Math.max(Number(args?.limit) || 15, 1), 50);
  const teas = await env.DB.prepare(
    `SELECT * FROM tea_compass_entries WHERE account_id = ? AND user_id = ?
       AND COALESCE(status, 'noted') NOT IN ${CLOSED_STATUSES}
       AND COALESCE(decision, '') != 'passed_on'
     ORDER BY updated_at DESC`
  ).bind(auth.accountId, auth.userId).all<EntryRow>();
  const teaGaps = (teas.results ?? [])
    .map(e => ({ e, missing: teaMissing(e) }))
    .filter(x => x.missing.length > 0);
  // Cost first, then where from: the order Adrian gave.
  const weight = (m: string[]) => (m.includes('cost') ? 0 : m.includes('currency of the price') ? 1 : m.includes('where it is from') ? 2 : 3);
  teaGaps.sort((a, b) => weight(a.missing) - weight(b.missing));

  const vendors = await env.DB.prepare(
    `SELECT ${VENDOR_COLUMNS} FROM customers WHERE account_id = ?
       AND (tags LIKE '%vendor%' OR type IN ('vendor', 'supplier')) ORDER BY updated_at DESC`
  ).bind(auth.accountId).all<VendorRow>();
  const vendorGaps = (vendors.results ?? []).map(vendorSummary).filter(v => v.missing.length > 0);

  const [todos, waiting] = await Promise.all([
    env.DB.prepare(
      `SELECT t.id, t.text, t.compass_entry_id, t.vendor_id, t.created_at, e.name AS tea_name, c.name AS vendor_name
         FROM curate_todos t
         LEFT JOIN tea_compass_entries e ON e.id = t.compass_entry_id
         LEFT JOIN customers c ON c.id = t.vendor_id
        WHERE t.account_id = ? AND t.done_at IS NULL ORDER BY t.created_at ASC`
    ).bind(auth.accountId).all(),
    env.DB.prepare(
      `SELECT COUNT(*) AS n FROM curate_suggestions WHERE account_id = ? AND state = 'waiting'`
    ).bind(auth.accountId).first<{ n: number }>(),
  ]);

  return {
    counts: {
      teas_with_gaps: teaGaps.length,
      vendors_with_gaps: vendorGaps.length,
      open_todos: (todos.results ?? []).length,
      suggestions_waiting: Number(waiting?.n ?? 0),
    },
    how_to_use: 'Ask Adrian one question at a time, starting at the top. Write each answer back with curate_update_tea or curate_save_vendor, then call this again.',
    teas: teaGaps.slice(0, limit).map(({ e, missing }) => ({
      id: e.id, name: e.name, vendor: e.vendor_name ?? null, missing, ask: askFor(e, missing),
    })),
    vendors: vendorGaps.slice(0, limit).map(v => ({
      id: v.id, name: v.name, missing: v.missing,
      ask: v.missing.includes('WeChat') ? `What is ${v.name}'s WeChat? (A photo of their card works too.)` : `Where is ${v.name}?`,
    })),
    todos: todos.results ?? [],
  };
};

// ── Tool: curate_add_tea ──────────────────────────────────────────────────────

const toolAddTea: ToolHandler = async (env, auth, args) => {
  const confirm = str(args?.confirm, 100);
  if (confirm) {
    const t = await consumeTicket<CurateTicket, 'curate:add_tea'>(env, confirm, 'curate:add_tea', auth);
    if (!t || t.userId !== auth.userId) return INVALID_TICKET;
    return commitTeaWrite(env, auth, t.entryId, t.write, true);
  }
  const name = str(args?.name, 300);
  if (!name) throw new Error('name is required. A name is all a tea needs to exist.');
  const vendor = await planVendor(env, auth, str(args?.vendor_id, 80), str(args?.vendor_name, 200));
  const { write, lines } = readTeaWrite(args, name, vendor);
  write.values.name = name;
  const same = await env.DB.prepare(
    `SELECT id, name, vendor_name FROM tea_compass_entries WHERE account_id = ? AND user_id = ? AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 5`
  ).bind(auth.accountId, auth.userId, name).all();
  const entryId = crypto.randomUUID();
  const ticket: AddTeaTicket = { kind: 'curate:add_tea', accountId: auth.accountId, userId: auth.userId, entryId, write };
  const token = await issueTicket(env, ticket, auth.tokenId);
  return previewEnvelope({
    action: 'curate_add_tea',
    read_back: `Add "${name}" to Curate${vendor ? ` from ${vendor.name}` : ''}.`,
    will_file: lines,
    still_missing: teaMissing({ ...write.values, vendor_name: vendor?.name ?? null }),
    ...(same.results?.length ? { already_in_curate_with_this_name: same.results, hint: 'If it is the same tea, use curate_update_tea instead.' } : {}),
  }, token);
};

// ── Tool: curate_update_tea ───────────────────────────────────────────────────

const toolUpdateTea: ToolHandler = async (env, auth, args) => {
  const confirm = str(args?.confirm, 100);
  if (confirm) {
    const t = await consumeTicket<CurateTicket, 'curate:update_tea'>(env, confirm, 'curate:update_tea', auth);
    if (!t || t.userId !== auth.userId) return INVALID_TICKET;
    return commitTeaWrite(env, auth, t.entryId, t.write, false);
  }
  const id = str(args?.tea_id, 80);
  if (!id) throw new Error('tea_id is required (from curate_find)');
  const current = await entryById(env, auth, id);
  if (!current) return { error: 'not_found' };
  const vendor = await planVendor(env, auth, str(args?.vendor_id, 80), str(args?.vendor_name, 200));
  const { write, lines } = readTeaWrite(args, current.name ?? 'this tea', vendor);
  if (!lines.length) throw new Error('Nothing to change. Pass at least one field, price, tasting, score, note, said, vendor_note or todo.');
  const before = teaSummary(current);
  const ticket: UpdateTeaTicket = { kind: 'curate:update_tea', accountId: auth.accountId, userId: auth.userId, entryId: id, write };
  const token = await issueTicket(env, ticket, auth.tokenId);
  return previewEnvelope({
    action: 'curate_update_tea',
    read_back: `File these on "${current.name ?? 'this tea'}". Adrian can keep or drop each line; to drop one, preview again without it.`,
    will_file: lines,
    before,
  }, token);
};

// ── Tool: curate_save_vendor ──────────────────────────────────────────────────

const VENDOR_TEXT_COLUMNS: Array<[string, string, number]> = [
  ['company', 'company', 200], ['phone', 'phone', 50], ['whatsapp', 'WhatsApp', 50], ['email', 'email', 200],
  ['address', 'address', 500], ['city', 'city', 200], ['country', 'country', 100],
];

const toolSaveVendor: ToolHandler = async (env, auth, args) => {
  const confirm = str(args?.confirm, 100);
  if (confirm) {
    const t = await consumeTicket<CurateTicket, 'curate:save_vendor'>(env, confirm, 'curate:save_vendor', auth);
    if (!t) return INVALID_TICKET;
    return commitSaveVendor(env, auth, t);
  }
  const vendorId = str(args?.vendor_id, 80);
  const name = str(args?.name, 200);
  if (!vendorId && !name) throw new Error('name is required (or vendor_id to change an existing vendor). A name is all a vendor needs.');
  const role = (str(args?.role, 20) ?? 'vendor') as ContactRole;
  if (!ROLE_TAG[role]) throw new Error('role must be vendor, freight or warehouse');
  let existing: VendorRow | null = null;
  if (vendorId) {
    existing = await vendorById(env, auth, vendorId);
    if (!existing) throw new Error(`No contact with id ${vendorId} in this shop.`);
  } else {
    const same = (await findVendors(env, auth, name!)).filter(row => hasRole(row, role));
    if (same.length > 1) throw new Error(`More than one ${ROLE_WORD[role]} is called "${name}": ${same.map(v => v.id).join(', ')}. Pass vendor_id instead.`);
    existing = same[0] ?? null;
  }
  const columns: Record<string, string> = {};
  const lines: string[] = [];
  const profile = readVendorProfile(args, lines);
  for (const [key, word, max] of VENDOR_TEXT_COLUMNS) {
    const v = str(args?.[key], max);
    if (v != null) { columns[key] = v; lines.push(`${word}: ${v}`); }
  }
  const contacts: Array<{ channel: string; handle: string; label?: string }> = [];
  const wechat = str(args?.wechat, 100);
  if (wechat) { contacts.push({ channel: 'wechat', handle: wechat }); lines.push(`WeChat: ${wechat}`); }
  if (columns.whatsapp) contacts.push({ channel: 'whatsapp', handle: columns.whatsapp });
  if (columns.phone) contacts.push({ channel: 'phone', handle: columns.phone });
  const website = str(args?.website, 300);
  if (website) { contacts.push({ channel: 'other', handle: website, label: 'website' }); lines.push(`website: ${website}`); }
  const instagram = str(args?.instagram, 100);
  if (instagram) { contacts.push({ channel: 'instagram', handle: instagram }); lines.push(`Instagram: ${instagram}`); }
  const note = str(args?.note, 4000);
  if (note) lines.push(`note on the card: ${note}`);
  const rename = vendorId ? str(args?.name, 200) : null;
  if (rename && existing && rename !== existing.name) lines.unshift(`rename to: ${rename}`);
  const agent = agentName(args);
  const ticket: SaveVendorTicket = {
    kind: 'curate:save_vendor', accountId: auth.accountId, vendorId: existing?.id ?? null,
    name: existing?.name ?? name!, agent, rename: rename && existing && rename !== existing.name ? rename : null,
    columns, contacts, note, role, profile,
  };
  const token = await issueTicket(env, ticket, auth.tokenId);
  return previewEnvelope({
    action: 'curate_save_vendor',
    read_back: existing
      ? `Add to ${existing.name}'s card. Only the lines below change; everything else on the card stays.`
      : `Add a new ${ROLE_WORD[role]} "${name}"${lines.length ? '' : ' (name only, the rest can be filled later)'}.`,
    mode: existing ? 'update_existing' : 'create_new',
    vendor_id: existing?.id ?? null,
    will_file: lines,
    already_on_card: existing ? vendorSummary(existing) : null,
  }, token);
};

async function commitSaveVendor(env: ToolEnv, auth: ToolAuth, t: SaveVendorTicket) {
  let id = t.vendorId;
  let row: VendorRow | null = id ? await vendorById(env, auth, id) : null;
  if (id && !row) throw new Error('That vendor was removed after the preview. Preview again.');
  const role: ContactRole = t.role ?? 'vendor';
  if (!id) {
    const again = (await findVendors(env, auth, t.name)).filter(r => hasRole(r, role));
    if (again.length === 1) { id = again[0].id; row = again[0]; }
    else {
      id = crypto.randomUUID();
      await env.DB.batch(newVendorStatements(env, auth, id, t.name, t.agent, role));
      row = await vendorById(env, auth, id);
    }
  }
  // Merge contacts: a new handle replaces the same channel's, nothing else is touched.
  const contacts = readContacts(row!.contacts).filter(c =>
    !t.contacts.some(n => (n.label === 'website' ? contactChannel(c) === 'website' : contactChannel(c) === n.channel)));
  const merged = [...contacts, ...t.contacts];
  const tags = parseJson<unknown>(row!.tags, []);
  const tagList = Array.isArray(tags) ? tags.map(String) : (row!.tags ? [String(row!.tags)] : []);
  if (!tagList.some(tag => new RegExp(ROLE_TAG[role], 'i').test(tag))) tagList.push(ROLE_TAG[role]);
  const sets: string[] = ['contacts = ?', 'tags = ?'];
  const binds: unknown[] = [JSON.stringify(merged), JSON.stringify(tagList)];
  for (const [key, value] of Object.entries(t.columns)) { sets.push(`${key} = ?`); binds.push(value); }
  if (t.rename) { sets.push('name = ?'); binds.push(t.rename); }
  if (t.note) {
    sets.push(`notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || char(10) || ? END`);
    binds.push(datedLine(t.agent, t.note), datedLine(t.agent, t.note));
  }
  await env.DB.prepare(`UPDATE customers SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
    .bind(...binds, id, auth.accountId).run();
  if (role === 'vendor') await ensureVendorRelationship(env, auth, id!);
  await writeVendorProfile(env, auth, id!, t.profile ?? {}, t.agent);
  if (t.rename) {
    // The tea rows carry the vendor's name beside its id; keep them saying the same thing.
    await env.DB.prepare('UPDATE tea_compass_entries SET vendor_name = ?, updated_at = datetime(\'now\') WHERE vendor_id = ? AND account_id = ?')
      .bind(t.rename, id, auth.accountId).run();
  }
  const after = await vendorById(env, auth, id!);
  return { committed: true, vendor: after ? vendorSummary(after) : { id } };
}

// ── Tool: curate_suggest_teas (one step: the inbox is not the shop) ─────────

const MAX_SUGGESTIONS = 50;

const toolSuggestTeas: ToolHandler = async (env, auth, args) => {
  const agent = str(args?.agent, 60);
  if (!agent) throw new Error('agent is required: say who found these (GrokBot, Hermes, ChatGPT, Claude…), so Adrian knows where they came from.');
  const from = (args?.from && typeof args.from === 'object') ? args.from : {};
  const fromUrl = str(from.url, 500);
  const fromVendor = str(from.vendor_name, 200);
  const fromContact = str(from.contact, 500);
  const fromNote = str(from.note, 2000);
  if (!fromUrl && !fromVendor) throw new Error('from.url or from.vendor_name is required: a suggestion carries where it came from.');
  const teas = Array.isArray(args?.teas) ? args.teas : [];
  if (!teas.length) throw new Error('teas is required: at least one tea with a name.');
  if (teas.length > MAX_SUGGESTIONS) throw new Error(`At most ${MAX_SUGGESTIONS} teas per call. Send the rest in a second call.`);

  const waiting = await env.DB.prepare(
    `SELECT name, from_vendor_name, from_url, state FROM curate_suggestions WHERE account_id = ? AND state IN ('waiting', 'dropped')`
  ).bind(auth.accountId).all<{ name: string; from_vendor_name: string | null; from_url: string | null; state: string }>();
  const key = (name: string, vendor: string | null, url: string | null) => `${name.toLowerCase()}|${(vendor ?? url ?? '').toLowerCase()}`;
  const seen = new Map((waiting.results ?? []).map(r => [key(r.name, r.from_vendor_name, r.from_url), r.state]));

  const batchId = crypto.randomUUID();
  const statements: D1PreparedStatement[] = [];
  const added: Array<{ id: string; name: string; price: string | null }> = [];
  const skipped: Array<{ name: string; why: string }> = [];
  teas.forEach((raw: any, index: number) => {
    const name = str(raw?.name, 300);
    if (!name) throw new Error(`teas[${index}] has no name. Every suggestion needs one.`);
    const fields = readTeaFields({ ...raw, name: undefined }, name);
    const note = str(raw?.note, 2000);
    const k = key(name, fromVendor, fromUrl);
    if (seen.has(k)) { skipped.push({ name, why: seen.get(k) === 'dropped' ? 'Adrian already turned this one down' : 'already waiting' }); return; }
    seen.set(k, 'waiting');
    const id = crypto.randomUUID();
    const category = (fields.values.category as string | undefined) ?? 'tea';
    delete fields.values.category;
    statements.push(env.DB.prepare(
      `INSERT INTO curate_suggestions (id, account_id, created_by_user_id, batch_id, from_agent, from_url, from_vendor_name, from_contact, from_note, name, category, fields_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, auth.accountId, auth.userId, batchId, agent, fromUrl, fromVendor, fromContact, fromNote, name, category,
      JSON.stringify({ ...fields.values, ...(note ? { note } : {}) })));
    added.push({ id, name, price: fields.price?.said ?? null });
  });
  if (statements.length) await env.DB.batch(statements);
  return {
    added: added.length,
    batch_id: batchId,
    waiting_for_adrian: added,
    skipped,
    next: 'Nothing is in Curate yet. Read the list to Adrian and ask which to keep, then call curate_pick_suggestions with his picks.',
  };
};

// ── Tool: curate_list_suggestions ─────────────────────────────────────────────

const toolListSuggestions: ToolHandler = async (env, auth, args) => {
  const limit = Math.min(Math.max(Number(args?.limit) || 50, 1), 100);
  const rows = await env.DB.prepare(
    `SELECT * FROM curate_suggestions WHERE account_id = ? AND state = 'waiting' ORDER BY created_at ASC LIMIT ?`
  ).bind(auth.accountId, limit).all<Record<string, any>>();
  const groups = new Map<string, any>();
  for (const r of rows.results ?? []) {
    if (!groups.has(r.batch_id)) {
      groups.set(r.batch_id, {
        batch_id: r.batch_id, found_by: r.from_agent, url: r.from_url, vendor: r.from_vendor_name,
        contact: r.from_contact, note: r.from_note, found_at: r.created_at, teas: [],
      });
    }
    const f = parseJson<Record<string, any>>(r.fields_json, {});
    groups.get(r.batch_id).teas.push({
      id: r.id, name: r.name, category: r.category, type: f.type ?? null, year: f.year ?? f.era ?? null,
      price: f.price_amount == null ? null : { amount: f.price_amount, currency: f.price_currency, per_grams: f.price_per_unit_grams ?? null },
      note: f.note ?? null,
    });
  }
  return { waiting: [...groups.values()], how_to_use: 'Number the teas when you read them out. Pass the ids Adrian keeps to curate_pick_suggestions as pick, and the rest as drop.' };
};

// ── Tool: curate_pick_suggestions ─────────────────────────────────────────────

const toolPickSuggestions: ToolHandler = async (env, auth, args) => {
  const confirm = str(args?.confirm, 100);
  if (confirm) {
    const t = await consumeTicket<CurateTicket, 'curate:pick'>(env, confirm, 'curate:pick', auth);
    if (!t || t.userId !== auth.userId) return INVALID_TICKET;
    return commitPick(env, auth, t);
  }
  const pick: string[] = Array.isArray(args?.pick) ? args.pick.map(String) : [];
  const drop: string[] = Array.isArray(args?.drop) ? args.drop.map(String) : [];
  if (!pick.length && !drop.length) throw new Error('pick or drop is required: the suggestion ids Adrian keeps, and the ones he does not.');
  const both = pick.filter(id => drop.includes(id));
  if (both.length) throw new Error(`These are in both pick and drop: ${both.join(', ')}`);
  const as = args?.as === 'considering' ? 'considering' : 'sample';
  const ids = [...pick, ...drop];
  const rows = await env.DB.prepare(
    `SELECT * FROM curate_suggestions WHERE account_id = ? AND state = 'waiting' AND id IN (${ids.map(() => '?').join(', ')})`
  ).bind(auth.accountId, ...ids).all<Record<string, any>>();
  const found = new Map((rows.results ?? []).map(r => [r.id, r]));
  const missing = ids.filter(id => !found.has(id));
  if (missing.length) throw new Error(`Not waiting (already picked, dropped, or not this shop's): ${missing.join(', ')}`);
  const vendors = new Map<string, string>();
  for (const id of pick) {
    const r = found.get(id)!;
    if (r.from_vendor_name && !vendors.has(r.from_vendor_name)) {
      const plan = await planVendor(env, auth, null, r.from_vendor_name);
      vendors.set(r.from_vendor_name, plan?.isNew ? `${r.from_vendor_name} (new vendor)` : r.from_vendor_name);
    }
  }
  const ticket: PickTicket = { kind: 'curate:pick', accountId: auth.accountId, userId: auth.userId, agent: agentName(args), pick, drop, as };
  const token = await issueTicket(env, ticket, auth.tokenId);
  return previewEnvelope({
    action: 'curate_pick_suggestions',
    read_back: `${pick.length} to Curate${as === 'sample' ? ' as samples to request' : ''}, ${drop.length} dropped.`,
    to_curate: pick.map(id => ({ id, name: found.get(id)!.name, vendor: found.get(id)!.from_vendor_name ?? null })),
    dropped: drop.map(id => ({ id, name: found.get(id)!.name })),
    vendors: [...vendors.values()],
  }, token);
};

/**
 * The same pick, for the app's "From your agent" list.
 *
 * Adrian ticking a box in the app IS the approval, so there is no ticket here;
 * what is shared is the commit, so a pick made in the app and a pick confirmed
 * through an agent land exactly the same rows (the Curate tea, the vendor and
 * its website and contact, the "Suggested by" note). The caller is responsible
 * for having authenticated Adrian and scoped `auth` to his account and user.
 */
export async function pickSuggestions(
  env: ToolEnv,
  auth: Pick<ToolAuth, 'accountId' | 'userId'>,
  input: { pick?: string[]; drop?: string[]; as?: 'sample' | 'considering'; agent?: string },
) {
  const pick = (input.pick ?? []).map(String);
  const drop = (input.drop ?? []).map(String);
  if (!pick.length && !drop.length) throw new Error('pick or drop is required');
  const both = pick.filter(id => drop.includes(id));
  if (both.length) throw new Error(`These are in both pick and drop: ${both.join(', ')}`);
  return commitPick(env, auth as ToolAuth, {
    kind: 'curate:pick', accountId: auth.accountId, userId: auth.userId,
    agent: str(input.agent, 60) ?? 'the app', pick, drop, as: input.as === 'considering' ? 'considering' : 'sample',
  });
}

/** Tick a to-do off, for the app's Today list. Same write as `curate_todo` done. */
export async function markTodoDone(env: ToolEnv, auth: Pick<ToolAuth, 'accountId'>, todoId: string): Promise<boolean> {
  const r = await env.DB.prepare(`UPDATE curate_todos SET done_at = datetime('now') WHERE id = ? AND account_id = ? AND done_at IS NULL`)
    .bind(todoId, auth.accountId).run();
  return (r.meta?.changes ?? 0) > 0;
}

async function commitPick(env: ToolEnv, auth: ToolAuth, t: PickTicket) {
  const ids = [...t.pick, ...t.drop];
  const rows = await env.DB.prepare(
    `SELECT * FROM curate_suggestions WHERE account_id = ? AND state = 'waiting' AND id IN (${ids.map(() => '?').join(', ')})`
  ).bind(auth.accountId, ...ids).all<Record<string, any>>();
  const found = new Map((rows.results ?? []).map(r => [r.id, r]));
  const vendorIds = new Map<string, { id: string; name: string }>();
  const created: Array<{ suggestion_id: string; tea_id: string; name: string }> = [];
  const skipped: string[] = [];
  for (const sid of t.pick) {
    const r = found.get(sid);
    if (!r) { skipped.push(sid); continue; }
    let vendor: { id: string; name: string } | null = null;
    if (r.from_vendor_name) {
      vendor = vendorIds.get(r.from_vendor_name) ?? null;
      if (!vendor) {
        vendor = await resolveVendorAtCommit(env, auth, await planVendor(env, auth, null, r.from_vendor_name), r.from_agent ?? t.agent);
        if (vendor) {
          vendorIds.set(r.from_vendor_name, vendor);
          await attachSourceToVendor(env, auth, vendor.id, r);
        }
      }
    }
    const f = parseJson<Record<string, any>>(r.fields_json, {});
    const note = f.note as string | undefined;
    delete f.note;
    const entryId = crypto.randomUUID();
    const row: Record<string, unknown> = {
      name: r.name,
      category: r.category,
      status: 'noted',
      price_amount: null, price_currency: null, price_per_unit_grams: null,
      photos: '[]', audio_clips: '[]',
      ...f,
      vendor_id: vendor?.id ?? null,
      vendor_name: vendor?.name ?? null,
      ...(t.as === 'sample' ? { sample_state: 'requested' } : { decision: 'considering' }),
    };
    const cols = Object.keys(row);
    const source = `Suggested by ${r.from_agent ?? 'an agent'}`
      + (r.from_url ? ` from ${r.from_url}` : r.from_vendor_name ? ` from ${r.from_vendor_name}` : '')
      + (r.from_contact ? `. Contact: ${r.from_contact}` : '');
    const claimed = await env.DB.prepare(
      `UPDATE curate_suggestions SET state = 'picked', compass_entry_id = ?, decided_at = datetime('now')
        WHERE id = ? AND account_id = ? AND state = 'waiting'`
    ).bind(entryId, sid, auth.accountId).run();
    if (!(claimed.meta?.changes ?? 0)) { skipped.push(sid); continue; }
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO tea_compass_entries (id, user_id, account_id, ${cols.join(', ')}, created_at, updated_at)
         VALUES (?, ?, ?, ${cols.map(() => '?').join(', ')}, datetime('now'), datetime('now'))`
      ).bind(entryId, auth.userId, auth.accountId, ...cols.map(c => row[c])),
      env.DB.prepare(
        `INSERT INTO notes (id, account_id, compass_entry_id, text, source_type, author_id, author_name, visibility, created_at)
         VALUES (?, ?, ?, ?, 'manual', ?, ?, 'private', datetime('now'))`
      ).bind(crypto.randomUUID(), auth.accountId, entryId, note ? `${source}. ${note}` : `${source}.`, auth.userId, r.from_agent ?? t.agent),
    ]);
    created.push({ suggestion_id: sid, tea_id: entryId, name: r.name });
  }
  if (t.drop.length) {
    await env.DB.prepare(
      `UPDATE curate_suggestions SET state = 'dropped', decided_at = datetime('now')
        WHERE account_id = ? AND state = 'waiting' AND id IN (${t.drop.map(() => '?').join(', ')})`
    ).bind(auth.accountId, ...t.drop).run();
  }
  return { committed: true, in_curate: created, dropped: t.drop.length, skipped, as: t.as };
}

/** The website and contact a suggestion arrived with go onto the vendor's card, without overwriting what is there. */
async function attachSourceToVendor(env: ToolEnv, auth: ToolAuth, vendorId: string, r: Record<string, any>) {
  const row = await vendorById(env, auth, vendorId);
  if (!row) return;
  const contacts = readContacts(row.contacts);
  const additions: ContactLike[] = [];
  if (r.from_url && !contacts.some(c => contactChannel(c) === 'website')) additions.push({ channel: 'other', handle: r.from_url, label: 'website' });
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (additions.length) { sets.push('contacts = ?'); binds.push(JSON.stringify([...contacts, ...additions])); }
  if (r.from_contact) {
    const line = datedLine(r.from_agent ?? 'an agent', `contact found with suggestions: ${r.from_contact}`);
    if (!(row.notes ?? '').includes(r.from_contact)) {
      sets.push(`notes = CASE WHEN notes IS NULL OR notes = '' THEN ? ELSE notes || char(10) || ? END`);
      binds.push(line, line);
    }
  }
  if (!sets.length) return;
  await env.DB.prepare(`UPDATE customers SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
    .bind(...binds, vendorId, auth.accountId).run();
}

// ── Tool: curate_todo (one step: Adrian's own scratch line) ──────────────────

const toolTodo: ToolHandler = async (env, auth, args) => {
  const action = str(args?.action, 10);
  if (action === 'done') {
    const id = str(args?.todo_id, 80);
    if (!id) throw new Error('todo_id is required to tick a to-do off');
    const r = await env.DB.prepare(`UPDATE curate_todos SET done_at = datetime('now') WHERE id = ? AND account_id = ? AND done_at IS NULL`)
      .bind(id, auth.accountId).run();
    return (r.meta?.changes ?? 0) ? { done: true, todo_id: id } : { error: 'not_found_or_already_done' };
  }
  if (action !== 'add') throw new Error("action must be 'add' or 'done'");
  const text = str(args?.text, 500);
  if (!text) throw new Error('text is required');
  const teaId = str(args?.tea_id, 80);
  let vendorId = str(args?.vendor_id, 80);
  if (teaId) {
    const e = await entryById(env, auth, teaId);
    if (!e) throw new Error('No such tea in Curate (tea_id)');
    vendorId = vendorId ?? (e.vendor_id ? String(e.vendor_id) : null);
  }
  if (vendorId && !await vendorById(env, auth, vendorId)) throw new Error('No such vendor (vendor_id)');
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO curate_todos (id, account_id, created_by_user_id, text, compass_entry_id, vendor_id, from_agent) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, auth.accountId, auth.userId, text, teaId, vendorId, agentName(args)).run();
  return { added: true, todo_id: id, text };
};

// ── Definitions ───────────────────────────────────────────────────────────────

const AGENT_PROP = { type: 'string', description: 'Who is calling, in one word: GrokBot, Hermes, ChatGPT, Claude. Shown to Adrian beside what you wrote.' };
const CONFIRM_PROP = { type: 'string', description: 'The confirmation_token from the preview. Send it only after Adrian said yes to the read-back.' };
const PRICE_PROP = {
  type: 'object',
  description: 'The price exactly as the vendor quoted it. Omit entirely if no price was given; never guess a currency.',
  properties: {
    amount: { type: 'number', description: 'The number quoted, e.g. 1200. 0 means it was free (a gift or sample), not unknown.' },
    currency: { type: 'string', description: 'What it was quoted in: Yuan (CNY/RMB), NT (TWD), HKD, USD, IDR, THB… Required with an amount.' },
    per: { type: 'string', enum: PRICE_UNITS, description: 'What the amount is for: gram, liang (50 g), jin (500 g), kg, or piece (a cake, brick, tuo or teapot).' },
    per_grams: { type: 'number', description: 'Instead of per: the amount is for this many grams, e.g. 100.' },
  },
  required: ['amount', 'currency'],
  additionalProperties: false,
};
const TASTING_PROP = {
  type: 'object',
  description: 'Tasting terms by category, using ids from the shop taxonomy (src/data/teajia-tasting-taxonomy.json), e.g. {"body":["full"],"flavor":["honey"],"finish":["finish-long"],"feeling":["feeling-cooling"]}. Unknown ids are refused by name. An empty list clears that category.',
  properties: Object.fromEntries(TASTING_TERM_CATEGORIES.map(c => [c, { type: 'array', items: { type: 'string' } }])),
  additionalProperties: false,
};
const TEA_FIELD_PROPS = {
  chinese_name: { type: 'string', description: 'Chinese name, e.g. 易武古树.' },
  category: { type: 'string', enum: ['tea', 'teaware'], description: 'tea (default) or teaware.' },
  type: { type: 'string', description: 'Sheng, Shou, Oolong, White, Red, Green, Dark…' },
  form: { type: 'string', description: 'Cake, Brick, Tuo, Loose Leaf…' },
  year: { type: 'string', description: '"2019", or an era like "1990s" if no exact year.' },
  season: { type: 'string', description: 'Spring, Autumn…' },
  storage: { type: 'string', description: 'Dry, wet, Hong Kong, Kunming…' },
  origin_country: { type: 'string', description: 'China, Taiwan…' },
  origin_region: { type: 'string', description: 'Yiwu, Lincang, Li Shan…' },
  cultivar: { type: 'string', description: 'Cultivar if known.' },
  description: { type: 'string', description: 'The public description customers read, written from Adrian\'s guidance notes (character, flavour, feeling, storage). Never name the vendor or what he paid here; that stays private.' },
  teaware_category: { type: 'string', description: 'For teaware: teapot, cup, gaiwan…' },
  material: { type: 'string', description: 'For teaware: zhuni, porcelain…' },
  capacity_ml: { type: 'number', description: 'For teaware: capacity in ml.' },
  price: PRICE_PROP,
  shop_name: { type: 'string', description: 'The name customers will see, if Adrian gives one ("call it Deep Forest"). name stays what the vendor calls it.' },
  ships_by: { type: 'string', enum: ['air', 'sea', 'land', 'courier'], description: 'How it travels home, e.g. sea for "by boat to Bali".' },
  wants: { type: 'string', enum: ['considering', 'buying', 'passed'], description: '"Interested in buying" = considering; "I\'m buying it" = buying; "not for me" = passed.' },
};
const FILING_PROPS = {
  tasting: TASTING_PROP,
  score: { type: 'number', description: 'Adrian\'s overall score, 1 to 10.' },
  note: { type: 'string', description: 'A story note about the tea (trees, the maker, history). Goes to the tea\'s notes thread.' },
  said: { type: 'string', description: 'What Adrian said, verbatim and whole (the transcript). Kept as a voice note on the tea, whatever else is filed.' },
  vendor_note: { type: 'string', description: 'Something about the vendor rather than the tea ("will have the 2018 in spring"). Appended to the vendor\'s card with today\'s date.' },
  todo: { type: 'string', description: 'A reminder ("ask Wang about the 2018"). Becomes an open to-do on this tea.' },
  sample: { type: 'boolean', description: 'true to mark this tea as a sample to request.' },
  vendor_id: { type: 'string', description: 'The vendor id from curate_find.' },
  vendor_name: { type: 'string', description: 'The vendor by name. Matches an existing vendor, or adds a new one with just this name.' },
  agent: AGENT_PROP,
  confirm: CONFIRM_PROP,
};

const defs: ToolDefinition[] = [
  {
    name: 'curate_find',
    scope: 'inventory:read',
    description: 'Use this to look up teas Adrian is sourcing in Curate (not the shop shelf) and vendors, by name, Chinese name or vendor. Returns ids you need for the other curate_ tools, plus what each is missing. No query lists the most recent.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Part of a tea or vendor name, e.g. "yiwu" or "Wang".' },
        limit: { type: 'number', description: 'Max rows of each kind (default 20, max 50).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'curate_get_tea',
    scope: 'inventory:read',
    description: 'Use this to read everything Curate knows about one tea: fields, price as quoted, tasting with labels, every note and transcript, open to-dos, its vendor card, and what is missing. Use it to write tea.md in Drive.',
    inputSchema: {
      type: 'object',
      properties: { tea_id: { type: 'string', description: 'Tea id from curate_find.' } },
      required: ['tea_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'curate_whats_missing',
    scope: 'inventory:read',
    description: 'Use this when Adrian asks "what\'s missing?" or has a few minutes to fill gaps. Lists Curate teas missing cost, currency, origin, vendor, type or year (cost first), vendors with no WeChat or no way to reach them, open to-dos, and how many agent suggestions are waiting. Each row carries a ready question to ask him.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max teas and vendors to list (default 15, max 50). Counts always cover everything.' } },
      additionalProperties: false,
    },
  },
  {
    name: 'curate_add_tea',
    scope: 'stock:write',
    description: 'Use this when Adrian tells you about a tea he wants in Curate (at a vendor\'s table, a WeChat offer, a friend\'s tea). A name is enough; everything else can come later. Two steps: the first call returns a read-back and a confirmation_token, the second call with confirm commits. Do NOT use for teas you found yourself on a website; those go to curate_suggest_teas.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'The tea\'s name as Adrian says it, e.g. "2019 Yiwu Gushu".' }, ...TEA_FIELD_PROPS, ...FILING_PROPS },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'curate_update_tea',
    scope: 'stock:write',
    description: 'Use this to fill in or file anything about a tea already in Curate: a field, the price as quoted, tasting terms, a score, a story note, the whole transcript of what Adrian said, a note for the vendor\'s card, a to-do. Only what you pass changes. Two steps (preview, then confirm). The preview lists each filed line so Adrian can keep or drop each; to drop one, preview again without it.',
    inputSchema: {
      type: 'object',
      properties: {
        tea_id: { type: 'string', description: 'Tea id from curate_find.' },
        name: { type: 'string', description: 'A corrected name.' },
        ...TEA_FIELD_PROPS,
        ...FILING_PROPS,
        clear: { type: 'array', items: { type: 'string' }, description: 'Fields to empty on purpose, e.g. ["price"] when a price was wrong. Never send an empty value instead.' },
      },
      required: ['tea_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'curate_save_vendor',
    scope: 'stock:write',
    description: 'Use this to add a vendor, freight forwarder or warehouse (a name is enough) or to add to their card: contacts (company, WeChat, WhatsApp, phone, email, website, Instagram, address, city, country), a dated note, and what the shop knows about how a vendor works (the currency they quote in, how they store tea, their story, where they ship from, the route home, days to arrive). Only what you pass changes; nothing on the card is wiped. Use it after a business card or a WhatsApp/WeChat screenshot, or after researching a vendor online. All private. Two steps (preview, then confirm).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Vendor name. Matches an existing vendor by name, or adds a new one. With vendor_id, renames.' },
        vendor_id: { type: 'string', description: 'The vendor id from curate_find, to change an existing vendor.' },
        company: { type: 'string' }, wechat: { type: 'string' }, whatsapp: { type: 'string' }, phone: { type: 'string' },
        email: { type: 'string' }, website: { type: 'string' }, instagram: { type: 'string' },
        address: { type: 'string' }, city: { type: 'string' }, country: { type: 'string' },
        note: { type: 'string', description: 'Appended to the card with today\'s date.' },
        role: { type: 'string', enum: ['vendor', 'freight', 'warehouse'], description: 'vendor (default), freight (a forwarder or shipping agent), or warehouse (a distributor or storage).' },
        price_currency: { type: 'string', description: 'The currency this vendor quotes in, e.g. HKD for a Hong Kong shop. Next time a price from them comes without one, propose this one and read it back.' },
        storage: { type: 'string', description: 'How their tea is stored, e.g. "Hong Kong traditional storage".' },
        story: { type: 'string', description: 'A fact about them worth telling, e.g. "in business for 70 years". Added under what is already known.' },
        ships_from: { type: 'string', description: 'Where their tea leaves from, e.g. "Sheung Wan, Hong Kong".' },
        route: { type: 'string', description: 'The way home in words, e.g. "courier Hong Kong to Guangzhou, then boat Guangzhou to Bali".' },
        lead_time_days: { type: 'number', description: 'About how many days from order to arrival.' },
        agent: AGENT_PROP,
        confirm: CONFIRM_PROP,
      },
      additionalProperties: false,
    },
  },
  {
    name: 'curate_suggest_teas',
    scope: 'stock:write',
    description: 'Use this when YOU found teas (on a vendor\'s website, a price list, a WeChat message) and Adrian has not chosen yet. They wait in his suggestions list with where they came from; nothing enters Curate until he picks. One step. Then read them to him and call curate_pick_suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: AGENT_PROP,
        from: {
          type: 'object',
          description: 'Where these came from. url or vendor_name is required.',
          properties: {
            url: { type: 'string', description: 'The page you read, e.g. https://wangtea.cn/shop.' },
            vendor_name: { type: 'string', description: 'The vendor or shop selling them.' },
            contact: { type: 'string', description: 'Contact you found: WeChat id, phone, email.' },
            note: { type: 'string', description: 'Anything else about the source.' },
          },
          additionalProperties: false,
        },
        teas: {
          type: 'array',
          description: 'Up to 50 teas, each with at least a name.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' }, chinese_name: { type: 'string' }, category: { type: 'string', enum: ['tea', 'teaware'] },
              type: { type: 'string' }, form: { type: 'string' }, year: { type: 'string' }, season: { type: 'string' },
              origin_country: { type: 'string' }, origin_region: { type: 'string' }, description: { type: 'string' },
              teaware_category: { type: 'string' }, material: { type: 'string' }, capacity_ml: { type: 'number' },
              price: PRICE_PROP,
              note: { type: 'string', description: 'Why it might interest Adrian, or anything not in a field.' },
            },
            required: ['name'],
            additionalProperties: false,
          },
        },
      },
      required: ['agent', 'from', 'teas'],
      additionalProperties: false,
    },
  },
  {
    name: 'curate_list_suggestions',
    scope: 'inventory:read',
    description: 'Use this to read Adrian the teas waiting for his yes or no, grouped by who found them and where.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max suggestions (default 50, max 100).' } },
      additionalProperties: false,
    },
  },
  {
    name: 'curate_pick_suggestions',
    scope: 'stock:write',
    description: 'Use this after Adrian chose from the suggestions. Picked teas become Curate teas (as samples to request by default) with the vendor\'s name, website and contact attached; the vendor is added if new. Dropped ones are kept as turned down so they are not suggested again. Two steps (preview, then confirm).',
    inputSchema: {
      type: 'object',
      properties: {
        pick: { type: 'array', items: { type: 'string' }, description: 'Suggestion ids Adrian keeps.' },
        drop: { type: 'array', items: { type: 'string' }, description: 'Suggestion ids he does not want.' },
        as: { type: 'string', enum: ['sample', 'considering'], description: 'sample (default): a sample to request. considering: in Curate, no sample yet.' },
        agent: AGENT_PROP,
        confirm: CONFIRM_PROP,
      },
      additionalProperties: false,
    },
  },
  {
    name: 'curate_todo',
    scope: 'stock:write',
    description: 'Use this for a reminder Adrian says ("remind me to ask Wang about the 2018"), attached to a tea or vendor, or to tick one off. One step. Open to-dos show in curate_whats_missing.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['add', 'done'] },
        text: { type: 'string', description: 'For add: the reminder.' },
        tea_id: { type: 'string', description: 'For add: the tea it is about.' },
        vendor_id: { type: 'string', description: 'For add: the vendor it is about.' },
        todo_id: { type: 'string', description: 'For done: the to-do id.' },
        agent: AGENT_PROP,
      },
      required: ['action'],
      additionalProperties: false,
    },
  },
];

export const curateIntakeTools: ToolModule = {
  area: 'curate-intake',
  defs,
  handlers: {
    curate_find: toolFind,
    curate_get_tea: toolGetTea,
    curate_whats_missing: toolWhatsMissing,
    curate_add_tea: toolAddTea,
    curate_update_tea: toolUpdateTea,
    curate_save_vendor: toolSaveVendor,
    curate_suggest_teas: toolSuggestTeas,
    curate_list_suggestions: toolListSuggestions,
    curate_pick_suggestions: toolPickSuggestions,
    curate_todo: toolTodo,
  },
};
