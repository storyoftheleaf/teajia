import { ROUTE_QUOTES_SCHEMA, CONTACT_PEOPLE_SCHEMA, ADDRESSES_SCHEMA, CONTACTS_SCHEMA } from './curateSchemas';
import { prepareCurateRecordedWrite, requireCurateManager, previewCurateMutation, confirmCurateMutation, readCurateHistory } from '../curateMutations';
import { COMPASS_STRUCTURED_COLUMNS, readCompassStructuredPatch, readVendorStructuredPatch, mergeVendorContacts, type VendorStructuredFields, type VendorContactEndpoint } from '../../../src/lib/curateStructuredFields';
import { prepareVendorStructuredProfileWrite, readVendorStructuredProfile } from '../curateVendorProfile';
import { validateCompassQuoteLink } from '../curateQuotes';
import { prepareCompassSampleWrite } from '../curateSampleBridge';
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
 *   - A to-do is a shop record too: agent changes preview, confirm and enter
 *     the same attributed history and undo ledger as other Curate records.
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
  if (str(args?.note, 8000)) throw new Error('Agent notes are disabled: build or use the structured field for this information');
  const allowed = new Set([...Object.keys(TEA_FIELD_PROPS), ...Object.keys(FILING_PROPS), 'name', 'tea_id', 'clear']);
  const unknown = Object.keys(args ?? {}).find(key => !allowed.has(key));
  if (unknown) throw new Error(`${unknown} has no structured tea field`);
  const structured = readCompassStructuredPatch(args ?? {}, refreshedCurrencyName);
  const values: Record<string, unknown> = Object.fromEntries(Object.entries(structured).map(([key, value]) => [key, key === 'route_quotes' ? JSON.stringify(value) : value]));
  const lines: string[] = Object.entries(structured).map(([key, value]) => `${key}: ${value === null ? '(cleared)' : JSON.stringify(value)}`);
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
  id: string; name: string; chinese_name?: string | null; company: string | null; phone: string | null; whatsapp: string | null;
  email: string | null; city: string | null; country: string | null; address: string | null;
  notes: string | null; contacts: string | null; tags: string | null; type: string | null; preferred_currency?: string | null;
};

const VENDOR_COLUMNS = 'id, name, chinese_name, company, phone, whatsapp, email, city, country, address, notes, contacts, tags, type, preferred_currency';

function isVendorRow(row: Pick<VendorRow, 'tags' | 'type'>): boolean {
  return /vendor/i.test(row.tags ?? '') || row.type === 'vendor' || row.type === 'supplier';
}

type ContactLike = { id?: string; person_id?: string; channel?: string; handle?: string; type?: string; value?: string; label?: string };

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
    `SELECT ${VENDOR_COLUMNS} FROM customers WHERE account_id = ? AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL AND LOWER(TRIM(name)) = LOWER(TRIM(?))`
  ).bind(auth.accountId, name).all<VendorRow>();
  return rows.results ?? [];
}

export async function vendorById(env: ToolEnv, auth: ToolAuth, id: string): Promise<VendorRow | null> {
  return env.DB.prepare(`SELECT ${VENDOR_COLUMNS} FROM customers WHERE id = ? AND account_id = ? AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL`)
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
  price_currency?: string | null; storage?: string | null; story?: string | null; ships_from?: string | null; route?: string | null; lead_time_days?: number | null;
};

function readVendorProfile(args: any, lines: string[]): VendorProfileWrite {
  const profile: VendorProfileWrite = {};
  if (args?.price_currency === null) { profile.price_currency = null; lines.push('price currency: (cleared)'); }
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
    if (args?.[key] === null) { profile[key] = null; lines.push(`${word}: (cleared)`); }
    else if (v) { profile[key] = v; lines.push(`${word}: ${v}`); }
  }
  const story = str(args?.story, 2000);
  if (args?.story === null) { profile.story = null; lines.push('story: (cleared)'); }
  if (story) { profile.story = story; lines.push(`their story: ${story}`); }
  if (args?.lead_time_days === null) { profile.lead_time_days = null; lines.push('lead time: (cleared)'); }
  if (args?.lead_time_days != null && args.lead_time_days !== '') {
    const days = Number(args.lead_time_days);
    if (!Number.isInteger(days) || days < 0) throw new Error('lead_time_days must be a whole number of days');
    profile.lead_time_days = days;
    lines.push(`takes about ${days} days to arrive`);
  }
  return profile;
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

export async function curateManagerAccess(env: ToolEnv, auth: Pick<ToolAuth, 'accountId' | 'userId'>): Promise<boolean> {
  try { await requireCurateManager(env.DB, auth); return true; } catch { return false; }
}
const ACTIVE_TEAS = 'deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL';
export async function entryById(env: ToolEnv, auth: ToolAuth, id: string): Promise<EntryRow | null> {
  const manager = await curateManagerAccess(env, auth);
  return env.DB.prepare(`SELECT * FROM tea_compass_entries WHERE id = ? AND account_id = ? AND ${ACTIVE_TEAS} ${manager ? '' : 'AND user_id = ?'}`)
    .bind(id, auth.accountId, ...(manager ? [] : [auth.userId])).first<EntryRow>();
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
    ...Object.fromEntries(COMPASS_STRUCTURED_COLUMNS.map(key => [key, key === 'route_quotes' ? parseJson(e[key], []) : e[key] ?? null])),
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
  clearSaid?: { tea: Record<string, any>; transcripts: Record<string, any>[] };
  vendorNote: string | null;
  todo: string | null;
  vendor: VendorPlan | null;
  sample: boolean;
  sampleState?: 'requested' | 'received' | 'tasted';
  sampleGrams?: number;
  photos?: string[];
  photosMode?: 'append' | 'replace';
  agent: string;
};

type AddTeaTicket = { kind: 'curate:add_tea'; accountId: string; userId: string; entryId: string; write: TeaWrite };
type UpdateTeaTicket = { kind: 'curate:update_tea'; accountId: string; userId: string; entryId: string; write: TeaWrite };
type SaveVendorTicket = {
  kind: 'curate:save_vendor'; accountId: string; vendorId: string | null; name: string; agent: string;
  rename: string | null; columns: Record<string, string | null>; contacts: Array<{ channel: string; handle: string; label?: string }>;
  note: string | null; role: ContactRole; profile: VendorProfileWrite; structured?: VendorStructuredFields; clear?: string[];
};
type PickTicket = {
  kind: 'curate:pick'; accountId: string; userId: string; agent: string;
  pick: string[]; drop: string[]; as: 'sample' | 'considering';
};
type CurateTicket = AddTeaTicket | UpdateTeaTicket | SaveVendorTicket | PickTicket;

const CLEARABLE = new Set(['chinese_name', 'type', 'form', 'season', 'storage', 'origin_country', 'origin_region',
  'cultivar', 'description', 'year', 'era', 'price', 'vendor', 'teaware_category', 'material', 'capacity_ml',
  'shop_name', 'transport_mode', 'note', 'notes', 'said', ...COMPASS_STRUCTURED_COLUMNS]);

function readTeaWrite(args: any, label: string, vendor: VendorPlan | null): { write: TeaWrite; lines: string[] } {
  if (str(args?.vendor_note, 4000)) throw new Error('Agent vendor notes are disabled: use a structured vendor field');
  const fields = readTeaFields(args, label);
  const tasting = readTasting(args);
  if (args?.clear !== undefined && !Array.isArray(args.clear)) throw new Error('clear must be a field list');
  const clear = Array.isArray(args?.clear) ? args.clear.map((c: unknown) => String(c)) : [];
  if (clear.includes('said') && str(args?.said, 20000)) throw new Error('Choose either clear said or a new said transcript; preview them separately');
  for (const c of clear) if (!CLEARABLE.has(c)) throw new Error(`clear: ${c} cannot be cleared here. Clearable: ${[...CLEARABLE].join(', ')}`);
  if (args?.sample_state !== undefined && !['requested', 'received', 'tasted'].includes(args.sample_state)) throw new Error('sample_state must be requested, received or tasted');
  if (args?.sample_grams !== undefined && (typeof args.sample_grams !== 'number' || !Number.isFinite(args.sample_grams) || args.sample_grams < 0)) throw new Error('sample_grams must be a non-negative finite number');
  let photos: string[] | undefined;
  if (args?.photos !== undefined) {
    if (!Array.isArray(args.photos) || args.photos.length > 50) throw new Error('photos must be a list of at most 50 hosted HTTPS URLs');
    photos = args.photos.map((photo: unknown) => {
      if (typeof photo !== 'string') throw new Error('photos must be hosted HTTPS URLs');
      let url: URL; try { url = new URL(photo); } catch { throw new Error('photos must be hosted HTTPS URLs'); }
      if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.')) throw new Error('photos must be hosted HTTPS URLs');
      return url.href;
    });
  }
  if (args?.photos_mode !== undefined && !['append', 'replace'].includes(args.photos_mode)) throw new Error('photos_mode must be append or replace');
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
    sample: args?.sample === true || args?.sample_state !== undefined || args?.sample_grams !== undefined,
    sampleState: args?.sample_state,
    sampleGrams: args?.sample_grams,
    photos,
    photosMode: args?.photos_mode ?? 'append',
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
  if (write.sample) lines.push(`Sample shelf · ${write.sampleState ?? 'keep existing state, requested for a new sample'}; ${write.sampleGrams === undefined ? 'existing grams kept; new sample uses 10 g request default (not measured received weight)' : `${write.sampleGrams} g`}`);
  if (photos !== undefined) lines.push(`Photos · ${write.photosMode} ${photos.length} hosted photo(s)`);
  for (const c of clear) lines.push(`Cleared · ${c}`);
  return { write, lines };
}

async function commitTeaWrite(env: ToolEnv, auth: ToolAuth, entryId: string, w: TeaWrite, isNew: boolean) {
  if (w.note || w.vendorNote) throw new Error('Agent notes are disabled; preview structured fields instead');
  await requireCurateManager(env.DB, auth);
  const vendor = await resolveVendorAtCommit(env, auth, w.vendor, w.agent);
  const current = isNew ? null : await entryById(env, auth, entryId);
  if (!isNew && !current) throw new Error('That tea is no longer active in Curate.');
  const values: Record<string, unknown> = { ...w.values };
  if (vendor) Object.assign(values, { vendor_id: vendor.id, vendor_name: vendor.name });
  for (const field of w.clear) {
    if (field === 'said') continue;
    if (field === 'price') Object.assign(values, { price_amount: null, price_currency: null, price_per_unit_grams: null });
    else if (field === 'vendor') Object.assign(values, { vendor_id: null, vendor_name: null });
    else values[field === 'note' ? 'notes' : field] = field === 'route_quotes' ? '[]' : null;
  }
  if (w.sample) values.sample_state = w.sampleState ?? current?.sample_state ?? 'requested';
  if (w.photos !== undefined) values.photos = JSON.stringify(w.photosMode === 'replace' ? w.photos : [...new Set([...parseJson<string[]>(current?.photos, []), ...w.photos])]);
  if (w.tasting || w.score != null) {
    const tasting = w.tasting ? mergeProductTasting(current?.tasting, w.tasting).next : readStoredTasting(current?.tasting);
    if (w.score != null) tasting.quality = w.score;
    values.tasting = JSON.stringify(tasting);
  }
  const now = new Date().toISOString();
  let after: Record<string, any> = {
    ...(current ?? { category: 'tea', status: 'noted', price_amount: null, price_currency: null, price_per_unit_grams: null, photos: '[]', audio_clips: '[]', created_at: now }),
    ...values, id: entryId, account_id: auth.accountId, user_id: current?.user_id ?? auth.userId, updated_at: now,
  };
  await validateCompassQuoteLink(env.DB, auth.accountId, after);
  let changes: Parameters<typeof prepareCurateRecordedWrite>[2]['changes'] = [];
  let guards: NonNullable<Parameters<typeof prepareCurateRecordedWrite>[2]['guards']> = [];
  if (after.sample_state) {
    const bridge = await prepareCompassSampleWrite(env.DB, { accountId: auth.accountId, userId: after.user_id }, after, {
      entryId, state: w.tasting || w.score != null ? 'tasted' : values.sample_state as any, grams: w.sampleGrams,
    });
    changes = bridge.changes;
    after = bridge.teaAfter;
    guards = (bridge as typeof bridge & { guards?: typeof guards }).guards ?? [];
  } else changes.push({ entityType: 'tea', entityId: entryId, before: current, after });
  if (w.clear.includes('said')) {
    if (!w.clearSaid) throw new Error('Preview the transcript clear again');
    // Pin both the selected records and their membership to the read-back.
    // The membership guard is confirmation-only: undo restores those records.
    guards.push({
      sql: `(SELECT COUNT(*) FROM notes WHERE account_id = ? AND compass_entry_id = ? AND source_type = 'voice' AND COALESCE(deleted, 0) = 0) = ? AND NOT EXISTS(SELECT 1 FROM notes WHERE account_id = ? AND compass_entry_id = ? AND source_type = 'voice' AND COALESCE(deleted, 0) = 0 AND id NOT IN (SELECT value FROM json_each(?)))`,
      values: [auth.accountId, entryId, w.clearSaid.transcripts.length, auth.accountId, entryId, JSON.stringify(w.clearSaid.transcripts.map(row => row.id))],
      confirmationOnly: true,
    });
    // A concurrent tea edit also invalidates this preview, including bridged sample writes.
    const teaChange = changes.find(change => change.entityType === 'tea' && change.entityId === entryId);
    if (teaChange) teaChange.before = w.clearSaid.tea;
    for (const transcript of w.clearSaid.transcripts) changes.push({ entityType: 'transcript', entityId: transcript.id, before: transcript, after: { ...transcript, deleted: 1 } });
  }
  if (w.said) {
    const id = crypto.randomUUID();
    changes.push({ entityType: 'transcript', entityId: id, before: null, after: {
      id, account_id: auth.accountId, compass_entry_id: entryId, text: w.said, source_type: 'voice',
      author_id: auth.userId, author_name: `Adrian (via ${w.agent})`, visibility: 'private', created_at: now,
    } });
  }
  if (w.todo) {
    const id = crypto.randomUUID();
    changes.push({ entityType: 'todo', entityId: id, before: null, after: {
      id, account_id: auth.accountId, created_by_user_id: auth.userId, text: w.todo,
      compass_entry_id: entryId, vendor_id: after.vendor_id ?? null, from_agent: w.agent, created_at: now,
    } });
  }
  const recorded = prepareCurateRecordedWrite(env.DB, auth, { commandType: isNew ? 'tea:create' : 'tea:update', agent: w.agent, changes, guards });
  if (w.clearSaid) {
    const results = await env.DB.batch(recorded.statements);
    if (!results[0]?.meta?.changes) return { error: 'stale_preview', message: 'The tea or its transcripts changed. Preview the clear again.' };
  } else await env.DB.batch([...recorded.statements, recorded.assertion]);
  const row = await entryById(env, auth, entryId);
  return { committed: true, mutation_id: recorded.mutationId, tea: row ? teaSummary(row) : { id: entryId } };
}

// ── Tool: curate_find ─────────────────────────────────────────────────────────

const toolFind: ToolHandler = async (env, auth, args) => {
  const manager = await curateManagerAccess(env, auth);
  const q = str(args?.query, 120);
  const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 50);
  const like = q ? `%${q.toLowerCase()}%` : null;
  const teas = await env.DB.prepare(
    `SELECT * FROM tea_compass_entries WHERE account_id = ? AND ${ACTIVE_TEAS} ${manager ? '' : 'AND user_id = ?'}
       ${like ? 'AND (LOWER(COALESCE(name, \'\')) LIKE ? OR LOWER(COALESCE(chinese_name, \'\')) LIKE ? OR LOWER(COALESCE(vendor_name, \'\')) LIKE ?)' : ''}
     ORDER BY updated_at DESC LIMIT ?`
  ).bind(auth.accountId, ...(manager ? [] : [auth.userId]), ...(like ? [like, like, like] : []), limit).all<EntryRow>();
  const vendors = await env.DB.prepare(
    `SELECT ${VENDOR_COLUMNS} FROM customers WHERE account_id = ? AND deleted_at IS NULL AND archived_at IS NULL AND merged_into_id IS NULL
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
    chinese_name: v.chinese_name ?? null,
    company: v.company,
    preferred_currency: v.preferred_currency ?? null,
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
    env.DB.prepare(`SELECT id, text, source_type, author_name, created_at FROM notes
                    WHERE account_id = ? AND compass_entry_id = ? AND (deleted IS NULL OR deleted = 0) ORDER BY created_at ASC`)
      .bind(auth.accountId, id).all(),
    env.DB.prepare('SELECT id, text, created_at FROM curate_todos WHERE account_id = ? AND compass_entry_id = ? AND done_at IS NULL AND deleted_at IS NULL ORDER BY created_at ASC')
      .bind(auth.accountId, id).all(),
    e.vendor_id ? vendorById(env, auth, String(e.vendor_id)) : Promise.resolve(null),
  ]);
  const tasting = readStoredTasting(e.tasting);
  const recentHistory = await curateManagerAccess(env, auth)
    ? (await readCurateHistory(env, auth, { entity_type: 'tea', entity_id: id, limit: 5 })).history
    : [];
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
    recent_history: recentHistory.map(m => ({
      mutation_id: m.id, action: m.command_type, agent: m.agent_name, confirmed_at: m.confirmed_at,
      undo_of: m.undo_of, undone_by: m.undone_by,
      changes: m.records.map((record: Record<string, any>) => {
        const before = parseJson<Record<string, unknown> | null>(record.before_json, null);
        const after = parseJson<Record<string, unknown> | null>(record.after_json, null);
        return { entity_type: record.entity_type, entity_id: record.entity_id,
          fields: [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])]
            .filter(key => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) };
      }),
    })),
  };
};

// ── Tool: curate_whats_missing ────────────────────────────────────────────────

const toolWhatsMissing: ToolHandler = async (env, auth, args) => {
  const limit = Math.min(Math.max(Number(args?.limit) || 15, 1), 50);
  const manager = await curateManagerAccess(env, auth);
  const teas = await env.DB.prepare(
    `SELECT * FROM tea_compass_entries WHERE account_id = ? AND ${ACTIVE_TEAS} ${manager ? '' : 'AND user_id = ?'}
       AND COALESCE(status, 'noted') NOT IN ${CLOSED_STATUSES}
       AND COALESCE(decision, '') != 'passed_on'
     ORDER BY updated_at DESC`
  ).bind(auth.accountId, ...(manager ? [] : [auth.userId])).all<EntryRow>();
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
        WHERE t.account_id = ? AND t.done_at IS NULL AND t.deleted_at IS NULL ORDER BY t.created_at ASC`
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
  assertKnownToolInput('curate_add_tea', args);
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
  const manager = await curateManagerAccess(env, auth);
  const same = await env.DB.prepare(
    `SELECT id, name, vendor_name FROM tea_compass_entries WHERE account_id = ? AND ${ACTIVE_TEAS} ${manager ? '' : 'AND user_id = ?'} AND LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 5`
  ).bind(auth.accountId, ...(manager ? [] : [auth.userId]), name).all();
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
  assertKnownToolInput('curate_update_tea', args);
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
  let transcriptsToClear: Record<string, any>[] | undefined;
  if (write.clear.includes('said')) {
    if (vendor?.isNew) throw new Error('Save the new vendor separately before previewing clear said');
    transcriptsToClear = (await env.DB.prepare(`SELECT * FROM notes WHERE account_id = ? AND compass_entry_id = ? AND source_type = 'voice' AND COALESCE(deleted, 0) = 0 ORDER BY created_at, id`).bind(auth.accountId, id).all<Record<string, any>>()).results ?? [];
    write.clearSaid = { tea: current, transcripts: transcriptsToClear };
    lines.push(`Remove ${transcriptsToClear.length} exact voice transcript(s); manual notes are kept; the legacy notes field changes only if explicitly cleared`);
    for (const transcript of transcriptsToClear) lines.push(`Transcript ${transcript.id} · ${transcript.author_name ?? 'Unknown author'} · ${transcript.created_at} · ${transcript.text}`);
  }
  const before = teaSummary(current);
  const ticket: UpdateTeaTicket = { kind: 'curate:update_tea', accountId: auth.accountId, userId: auth.userId, entryId: id, write };
  const token = await issueTicket(env, ticket, auth.tokenId);
  return previewEnvelope({
    action: 'curate_update_tea',
    read_back: `File these on "${current.name ?? 'this tea'}". Adrian can keep or drop each line; to drop one, preview again without it.`,
    will_file: lines,
    ...(transcriptsToClear ? { transcripts_to_clear: transcriptsToClear.map(({ id, text, author_name, created_at }) => ({ id, text, author_name, created_at })) } : {}),
    before,
  }, token);
};

// ── Tool: curate_save_vendor ──────────────────────────────────────────────────

const VENDOR_TEXT_COLUMNS: Array<[string, string, number]> = [
  ['chinese_name', 'Chinese name', 200], ['company', 'company', 200], ['phone', 'phone', 50], ['whatsapp', 'WhatsApp', 50], ['email', 'email', 200],
  ['address', 'address', 500], ['city', 'city', 200], ['country', 'country', 100],
];

const VENDOR_CLEARABLE = new Set([
  ...VENDOR_TEXT_COLUMNS.map(([key]) => key), 'wechat', 'website', 'instagram', 'fax', 'facebook',
  'vendor_code', 'contact_people', 'addresses', 'contacts', 'price_currency', 'storage', 'story',
  'ships_from', 'route', 'lead_time_days', 'note', 'vendor_note', 'notes', 'preferred_currency',
]);
const VENDOR_CLEAR_CHANNELS = new Set(['phone','email','whatsapp','wechat','website','instagram','fax','facebook']);

const toolSaveVendor: ToolHandler = async (env, auth, args) => {
  assertKnownToolInput('curate_save_vendor', args);
  const confirm = str(args?.confirm, 100);
  if (confirm) {
    const t = await consumeTicket<CurateTicket, 'curate:save_vendor'>(env, confirm, 'curate:save_vendor', auth);
    if (!t) return INVALID_TICKET;
    return commitSaveVendor(env, auth, t);
  }
  const clear: string[] = Array.isArray(args?.clear) ? args.clear.map(String) : [];
  if (args?.clear !== undefined && !Array.isArray(args.clear)) throw new Error('clear must be a field list');
  for (const field of clear) if (!VENDOR_CLEARABLE.has(field)) throw new Error(`${field} cannot be cleared on a vendor`);
  const rawArgs = args;
  args = { ...args };
  for (const field of clear) args[field] = ['contact_people','addresses','contacts'].includes(field) ? [] : null;
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
  const columns: Record<string, string | null> = {};
  const lines: string[] = clear.map(field => `Cleared: ${field}`);
  const profile = readVendorProfile(args, lines);
  if (args?.preferred_currency !== undefined) {
    const currency = args.preferred_currency === null ? null
      : typeof args.preferred_currency === 'string' ? refreshedCurrencyName(args.preferred_currency) : null;
    if (args.preferred_currency !== null && !currency) throw new Error('preferred_currency must be a supported currency or null');
    columns.preferred_currency = currency;
    lines.push(`preferred currency on contact: ${currency ?? '(cleared)'}`);
  }
  for (const [key, word, max] of VENDOR_TEXT_COLUMNS) {
    const v = str(args?.[key], max);
    if (args?.[key] === null) { columns[key] = null; lines.push(`${word}: (cleared)`); }
    else if (v != null) { columns[key] = v; lines.push(`${word}: ${v}`); }
  }
  const contacts: VendorContactEndpoint[] = [];
  const wechat = str(args?.wechat, 100);
  if (wechat) { contacts.push({ channel: 'wechat', handle: wechat }); lines.push(`WeChat: ${wechat}`); }
  if (columns.whatsapp) contacts.push({ channel: 'whatsapp', handle: columns.whatsapp });
  if (columns.phone) contacts.push({ channel: 'phone', handle: columns.phone });
  if (columns.email) contacts.push({ channel: 'email', handle: columns.email });
  const website = str(args?.website, 300);
  if (website) { contacts.push({ channel: 'website', handle: website }); lines.push(`website: ${website}`); }
  const instagram = str(args?.instagram, 100);
  if (instagram) { contacts.push({ channel: 'instagram', handle: instagram }); lines.push(`Instagram: ${instagram}`); }
  const structured = readVendorStructuredPatch(args ?? {});
  for (const channel of ['fax', 'facebook'] as const) {
    const handle = str(args?.[channel], 500); if (handle) contacts.push({ channel, handle });
  }
  for (const [key, value] of Object.entries(structured)) lines.push(`${key}: ${JSON.stringify(value)}`);
  if (existing && Object.keys(structured).length) await prepareVendorStructuredProfileWrite(env.DB, { ...auth, agent: agentName(args) }, existing.id, structured as Record<string, unknown>);
  if (str(rawArgs?.note, 4000) || str(rawArgs?.vendor_note, 4000)) throw new Error('Agent vendor notes are disabled: use a structured vendor field');
  const note = null;
  if (note) lines.push(`note on the card: ${note}`);
  const rename = vendorId ? str(args?.name, 200) : null;
  if (rename && existing && rename !== existing.name) lines.unshift(`rename to: ${rename}`);
  const agent = agentName(args);
  const ticket: SaveVendorTicket = {
    kind: 'curate:save_vendor', accountId: auth.accountId, vendorId: existing?.id ?? null,
    name: existing?.name ?? name!, agent, rename: rename && existing && rename !== existing.name ? rename : null,
    columns, contacts, note, role, profile, structured, clear,
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
  if (t.note) throw new Error('Agent vendor notes are disabled; preview structured fields instead');
  await requireCurateManager(env.DB, auth);
  let id = t.vendorId;
  const role: ContactRole = t.role ?? 'vendor';
  if (!id) {
    const again = (await findVendors(env, auth, t.name)).filter(row => hasRole(row, role));
    if (again.length > 1) throw new Error('Vendor name became ambiguous; preview again');
    id = again[0]?.id ?? crypto.randomUUID();
  }
  const before = await env.DB.prepare('SELECT * FROM customers WHERE id = ? AND account_id = ?').bind(id, auth.accountId).first<Record<string, any>>();
  if (t.vendorId && !before) throw new Error('Vendor was removed after preview');
  const now = new Date().toISOString();
  const contactsBefore = readContacts(before?.contacts).map(contact => ({ ...contact, channel: contactChannel(contact) ?? 'other', handle: contactHandle(contact) ?? '' }));
  let contacts = t.structured?.contacts === undefined ? contactsBefore
    : t.structured.contacts_mode === 'replace' ? t.structured.contacts : mergeVendorContacts(contactsBefore, t.structured.contacts);
  if (t.contacts.length) contacts = mergeVendorContacts(contacts, t.contacts);
  contacts = contacts.filter(contact => !(t.clear ?? []).some(field => VENDOR_CLEAR_CHANNELS.has(field) && contact.channel === field));
  const profileBefore = await env.DB.prepare('SELECT * FROM curate_vendor_profiles WHERE vendor_id = ?').bind(id).first<Record<string, any>>();
  if (profileBefore && profileBefore.account_id !== auth.accountId) throw new Error('Vendor profile belongs to another account');
  const people = t.structured?.contact_people ?? parseJson<Array<{id:string}>>(profileBefore?.contact_people, []);
  for (const contact of contacts) if (contact.person_id && !people.some(person => person.id === contact.person_id)) throw new Error(`Contact refers to missing person ${contact.person_id}`);
  const tags = parseJson<string[]>(before?.tags, []);
  if (!tags.includes(ROLE_TAG[role])) tags.push(ROLE_TAG[role]);
  const after: Record<string, any> = { ...(before ?? { id, account_id: auth.accountId, name: t.name, type: ROLE_TYPE[role], source: `curate (added by ${t.agent})`, created_at: now }),
    ...t.columns, contacts: JSON.stringify(contacts), tags: JSON.stringify(tags), updated_at: now };
  if (t.rename) after.name = t.rename;
  if ((t.clear ?? []).some(field => ['note','vendor_note','notes'].includes(field))) after.notes = null;
  const changes: Parameters<typeof prepareCurateRecordedWrite>[2]['changes'] = [{ entityType: 'vendor', entityId: id, before, after }];
  const profileFields: Record<string, any> = { ...(t.profile ?? {}) };
  for (const key of ['vendor_code','contact_people','addresses'] as const) if (t.structured?.[key] !== undefined) profileFields[key] = key === 'vendor_code' ? t.structured[key] : JSON.stringify(t.structured[key]);
  if (Object.keys(profileFields).length) {
    if (profileFields.story) profileFields.story = profileBefore?.story ? `${profileBefore.story}\n${datedLine(t.agent, profileFields.story)}` : datedLine(t.agent, profileFields.story);
    changes.push({ entityType: 'vendor_profile', entityId: id, before: profileBefore,
      after: { ...(profileBefore ?? {}), vendor_id: id, account_id: auth.accountId, ...profileFields, updated_by_agent: t.agent, updated_at: now } });
  }
  if (t.rename) {
    const teas = await env.DB.prepare('SELECT * FROM tea_compass_entries WHERE vendor_id = ? AND account_id = ?').bind(id, auth.accountId).all<Record<string, any>>();
    for (const tea of teas.results) changes.push({ entityType: 'tea', entityId: tea.id, before: tea, after: { ...tea, vendor_name: t.rename, updated_at: now } });
  }
  const write = prepareCurateRecordedWrite(env.DB, auth, { commandType: before ? 'vendor:update' : 'vendor:create', agent: t.agent, changes });
  await env.DB.batch([...write.statements, write.assertion]);
  if (role === 'vendor') await ensureVendorRelationship(env, auth, id);
  const vendor = await vendorById(env, auth, id);
  return { committed: true, mutation_id: write.mutationId, vendor: vendor ? vendorSummary(vendor) : { id }, structured: await readVendorStructuredProfile(env.DB, auth, id) };
}

// ── Tool: curate_suggest_teas (one step: the inbox is not the shop) ─────────

const MAX_SUGGESTIONS = 50;

const toolSuggestTeas: ToolHandler = async (env, auth, args) => {
  assertKnownToolInput('curate_suggest_teas', args);
  const agent = str(args?.agent, 60);
  if (!agent) throw new Error('agent is required: say who found these (GrokBot, Hermes, ChatGPT, Claude…), so Adrian knows where they came from.');
  const from = (args?.from && typeof args.from === 'object') ? args.from : {};
  const fromUrl = str(from.url, 500);
  const fromVendor = str(from.vendor_name, 200);
  const fromContact = str(from.contact, 500);
  if (str(from.note, 2000)) throw new Error('Agent source notes are disabled: use structured source/provenance fields');
  const fromNote = null;
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

/** What agents found and Adrian has not picked from yet, one group per find
 *  (a website, a vendor's list). The agent tool and the app read the same. */
export async function waitingSuggestions(env: ToolEnv, accountId: string, limit = 50) {
  const rows = await env.DB.prepare(
    `SELECT * FROM curate_suggestions WHERE account_id = ? AND state = 'waiting' ORDER BY created_at ASC LIMIT ?`
  ).bind(accountId, Math.min(Math.max(limit, 1), 100)).all<Record<string, any>>();
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
  return [...groups.values()];
}

const toolListSuggestions: ToolHandler = async (env, auth, args) => {
  const waiting = await waitingSuggestions(env, auth.accountId, Number(args?.limit) || 50);
  return { waiting, how_to_use: 'Number the teas when you read them out. Pass the ids Adrian keeps to curate_pick_suggestions as pick, and the rest as drop.' };
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

/** Open to-dos, oldest first, with the tea and vendor they are about. */
export async function openTodos(env: ToolEnv, accountId: string) {
  const r = await env.DB.prepare(
    `SELECT t.id, t.text, t.compass_entry_id, t.vendor_id, t.from_agent, t.created_at, e.name AS tea_name, c.name AS vendor_name
       FROM curate_todos t
       LEFT JOIN tea_compass_entries e ON e.id = t.compass_entry_id
       LEFT JOIN customers c ON c.id = t.vendor_id
      WHERE t.account_id = ? AND t.done_at IS NULL AND t.deleted_at IS NULL ORDER BY t.created_at ASC LIMIT 200`
  ).bind(accountId).all<Record<string, any>>();
  return r.results ?? [];
}

/** Add a to-do, from an agent or from the app. A to-do about a tea also
 *  carries that tea's vendor, so it shows on the vendor's card too. */
export async function addTodo(env: ToolEnv, auth: ToolAuth, input: { text?: unknown; tea_id?: unknown; vendor_id?: unknown; agent?: unknown }) {
  const text = str(input.text, 500);
  if (!text) throw new Error('text is required');
  const teaId = str(input.tea_id, 80);
  let vendorId = str(input.vendor_id, 80);
  if (teaId) {
    const e = await entryById(env, auth, teaId);
    if (!e) throw new Error('No such tea in Curate (tea_id)');
    vendorId = vendorId ?? (e.vendor_id ? String(e.vendor_id) : null);
  }
  if (vendorId && !await vendorById(env, auth, vendorId)) throw new Error('No such vendor (vendor_id)');
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO curate_todos (id, account_id, created_by_user_id, text, compass_entry_id, vendor_id, from_agent) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, auth.accountId, auth.userId, text, teaId, vendorId, input.agent == null ? null : agentName(input)).run();
  return { added: true, todo_id: id, text };
}

/** Tick a to-do off for the app's existing Today list contract. */
export async function markTodoDone(env: ToolEnv, auth: Pick<ToolAuth, 'accountId'>, todoId: string): Promise<boolean> {
  const r = await env.DB.prepare(`UPDATE curate_todos SET done_at = datetime('now') WHERE id = ? AND account_id = ? AND done_at IS NULL AND deleted_at IS NULL`)
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
    if (note) throw new Error('Stored suggestion notes must be moved into structured fields before picking');
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
    const claimed = await env.DB.prepare(
      `UPDATE curate_suggestions SET state = 'picked', compass_entry_id = ?, decided_at = datetime('now')
        WHERE id = ? AND account_id = ? AND state = 'waiting'`
    ).bind(entryId, sid, auth.accountId).run();
    if (!(claimed.meta?.changes ?? 0)) { skipped.push(sid); continue; }
    const sampleStatements = t.as === 'sample' ? (await prepareCompassSampleWrite(env.DB, auth, { ...row, id: entryId, account_id: auth.accountId, user_id: auth.userId }, { entryId, state: 'requested' })).statements : [];
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO tea_compass_entries (id, user_id, account_id, ${cols.join(', ')}, created_at, updated_at)
         VALUES (?, ?, ?, ${cols.map(() => '?').join(', ')}, datetime('now'), datetime('now'))`
      ).bind(entryId, auth.userId, auth.accountId, ...cols.map(c => row[c])),
      ...sampleStatements,
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
  if (r.from_url && !contacts.some(c => contactChannel(c) === 'website')) additions.push({ channel: 'website', handle: r.from_url });
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (additions.length) { sets.push('contacts = ?'); binds.push(JSON.stringify([...contacts, ...additions])); }
  // Contact evidence remains on curate_suggestions.from_contact with its agent/source URL.
  if (!sets.length) return;
  await env.DB.prepare(`UPDATE customers SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
    .bind(...binds, vendorId, auth.accountId).run();
}

// ── Tool: curate_todo — preview/confirm, with attributed history and undo ────

const toolTodo: ToolHandler = async (env, auth, args) => {
  await requireCurateManager(env.DB, auth);
  const confirm = str(args?.confirm, 200);
  if (confirm) {
    const ticket = await consumeTicket<{ kind: 'curate:todo'; accountId: string; userId: string; agent: string; todo: Record<string, any> }, 'curate:todo'>(env, confirm, 'curate:todo', auth);
    if (!ticket) return confirmCurateMutation(env, auth, confirm);
    if (ticket.userId !== auth.userId) return INVALID_TICKET;
    const recorded = prepareCurateRecordedWrite(env.DB, auth, {
      commandType: 'todo:add', agent: ticket.agent,
      changes: [{ entityType: 'todo', entityId: ticket.todo.id, before: null, after: ticket.todo }],
    });
    await env.DB.batch([...recorded.statements, recorded.assertion]);
    return { confirmed: true, added: true, todo_id: ticket.todo.id, text: ticket.todo.text, mutation_id: recorded.mutationId };
  }
  const action = str(args?.action, 10);
  if (action === 'done' || action === 'edit' || action === 'delete') {
    const id = str(args?.todo_id, 80);
    if (!id) throw new Error('todo_id is required');
    if (action === 'edit') {
      return previewCurateMutation(env, auth, {
        entity: 'todo', id, action: 'edit', fields: { text: args?.text },
      }, agentName(args));
    }
    return previewCurateMutation(env, auth, {
      entity: 'todo', id, action: action === 'done' ? 'close' : 'delete',
    }, agentName(args));
  }
  if (action !== 'add') throw new Error("action must be 'add', 'done', 'edit' or 'delete'");
  const text = str(args?.text, 500);
  if (!text) throw new Error('text is required');
  const teaId = str(args?.tea_id, 80);
  let vendorId = str(args?.vendor_id, 80);
  if (teaId) {
    const tea = await entryById(env, auth, teaId);
    if (!tea) throw new Error('No such tea in Curate (tea_id)');
    vendorId = vendorId ?? (tea.vendor_id ? String(tea.vendor_id) : null);
  }
  if (vendorId && !await vendorById(env, auth, vendorId)) throw new Error('No such vendor (vendor_id)');
  const agent = agentName(args);
  const todo = { id: crypto.randomUUID(), account_id: auth.accountId, created_by_user_id: auth.userId,
    text, compass_entry_id: teaId, vendor_id: vendorId, from_agent: agent,
    done_at: null, deleted_at: null, created_at: new Date().toISOString() };
  const token = await issueTicket(env, { kind: 'curate:todo', accountId: auth.accountId, userId: auth.userId, agent, todo }, auth.tokenId);
  return previewEnvelope({ action: 'todo:add', changes: [{ entity: 'todo', id: todo.id, before: null, after: todo }] }, token);
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
  age_quoted: { type: ['string', 'null'], description: 'Age as stated, e.g. about 20 years; never derive a vintage.' },
  grade: { type: ['string', 'null'] },
  pack_size_grams: { type: ['number', 'null'], exclusiveMinimum: 0 },
  pack_size_label: { type: ['string', 'null'] },
  vendor_item_number: { type: ['string', 'null'] },
  discount_percent: { type: ['number', 'null'], minimum: 0, maximum: 100, description: 'Quoted discount only; does not change inventory pricing.' },
  quote_id: { type: ['string', 'null'], description: 'Existing private quote record for this vendor.' },
  route_quotes: ROUTE_QUOTES_SCHEMA,
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
  note: { type: 'string', description: 'Unsupported for agents. Use a named structured field; nonempty note inputs are refused.' },
  said: { type: 'string', description: 'What Adrian said, verbatim and whole (the transcript). Kept as a voice note on the tea, whatever else is filed.' },
  vendor_note: { type: 'string', description: 'Unsupported for agents. Use structured vendor fields; nonempty values are refused.' },
  todo: { type: 'string', description: 'A reminder ("ask Wang about the 2018"). Becomes an open to-do on this tea.' },
  sample: { type: 'boolean', description: 'true puts the tea on the sample shelf; preserves existing received/tasted state.' },
  sample_state: { type: 'string', enum: ['requested', 'received', 'tasted'], description: 'Sample lifecycle, shared with the shelf.' },
  sample_grams: { type: 'number', minimum: 0, description: 'Explicit sample grams, zero included. Omitted keeps existing measured grams; a new request has unknown weight (null) until measured.' },
  photos: { type: 'array', items: { type: 'string' }, description: 'Hosted HTTPS photo URLs.' },
  photos_mode: { type: 'string', enum: ['append', 'replace'], description: 'append (default) keeps existing photos; replace replaces the list, including clearing with [].' },
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
    description: 'Use this to read everything Curate knows about one tea: fields, price as quoted, tasting with labels, every note and transcript, open to-dos, its vendor card, and what is missing. Shop managers also receive the five most recent history entries with changed fields and undo attribution. Use it to write tea.md in Drive.',
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
    annotations: { destructiveHint: true },
    description: 'Correct structured tea facts, quoted price, tasting terms, score, an exact transcript or a to-do. Only supplied fields change. Use clear to deliberately empty a field; clear note/notes empties only the legacy notes column; clear said removes only active exact voice transcripts, with their IDs and text in the preview. Manual notes are kept. Agent note/vendor_note writing is disabled. Every mutation is previewed and confirmed.',
    inputSchema: {
      type: 'object',
      properties: {
        tea_id: { type: 'string', description: 'Tea id from curate_find.' },
        name: { type: 'string', description: 'A corrected name.' },
        ...TEA_FIELD_PROPS,
        ...FILING_PROPS,
        clear: { type: 'array', items: { type: 'string', enum: [...CLEARABLE] }, description: 'Fields to empty on purpose; said soft-deletes active voice transcripts only, note/notes clears the legacy notes column only. E.g. ["price"] when a price was wrong. Never send an empty value instead.' },
      },
      required: ['tea_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'curate_save_vendor',
    scope: 'stock:write',
    description: 'Create or correct a private shop vendor, forwarder or warehouse using structured contact, address and vendor-profile fields. Multiple same-channel endpoints are preserved unless explicitly cleared or replaced. clear names fields to empty deliberately, including note/vendor_note legacy-column aliases. Agent note writing is disabled. Preview then confirm every write.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Vendor name. Matches an existing vendor by name, or adds a new one. With vendor_id, renames.' },
        vendor_id: { type: 'string', description: 'The vendor id from curate_find, to change an existing vendor.' },
        chinese_name: { type: ['string', 'null'] },
        company: { type: ['string', 'null'] }, wechat: { type: ['string', 'null'] }, whatsapp: { type: ['string', 'null'] }, phone: { type: ['string', 'null'] },
        vendor_code: { type: ['string', 'null'] },
        contact_people: CONTACT_PEOPLE_SCHEMA,
        addresses: ADDRESSES_SCHEMA,
        contacts_mode: { type: 'string', enum: ['merge', 'replace'], description: 'merge default appends/edits endpoints by id; replace explicitly replaces the complete list.' },
        contacts: CONTACTS_SCHEMA,
        fax: { type: ['string', 'null'] }, facebook: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] }, website: { type: ['string', 'null'] }, instagram: { type: ['string', 'null'] },
        address: { type: ['string', 'null'] }, city: { type: ['string', 'null'] }, country: { type: ['string', 'null'] },
        note: { type: ['string', 'null'], description: 'Unsupported for agents; structured vendor fields are required.' },
        role: { type: 'string', enum: ['vendor', 'freight', 'warehouse'], description: 'vendor (default), freight (a forwarder or shipping agent), or warehouse (a distributor or storage).' },
        price_currency: { type: ['string', 'null'], description: 'The currency this vendor quotes in, e.g. HKD for a Hong Kong shop. Next time a price from them comes without one, propose this one and read it back.' },
        preferred_currency: { type: ['string', 'null'], description: 'Preferred currency on the underlying vendor contact. Explicitly independent from the Curate profile price_currency; accepts known currency aliases, null clears.' },
        storage: { type: ['string', 'null'], description: 'How their tea is stored, e.g. "Hong Kong traditional storage".' },
        story: { type: ['string', 'null'], description: 'A fact about them worth telling, e.g. "in business for 70 years". Added under what is already known.' },
        ships_from: { type: ['string', 'null'], description: 'Where their tea leaves from, e.g. "Sheung Wan, Hong Kong".' },
        route: { type: ['string', 'null'], description: 'The way home in words, e.g. "courier Hong Kong to Guangzhou, then boat Guangzhou to Bali".' },
        lead_time_days: { type: ['number', 'null'], description: 'About how many days from order to arrival.' },
        clear: { type: 'array', items: { type: 'string', enum: [...VENDOR_CLEARABLE] }, description: 'Fields to clear deliberately. Contact channel names remove that channel only; contacts/people/addresses clear their arrays. note/vendor_note/notes clear the legacy vendor notes column.' },
        vendor_note: { type: ['string', 'null'], description: 'Unsupported for writing; clear alias only.' },
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
            note: { type: 'string', description: 'Unsupported for agents; use the named source/provenance fields.' },
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
              note: { type: 'string', description: 'Unsupported for agents; unknown facts need structured fields.' },
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
    annotations: { destructiveHint: true },
    description: 'Add, complete, edit or delete a shop reminder attached to a tea or vendor. Every change previews first; confirm only after Adrian accepts the exact preview. Changes enter attributed Curate history and can be undone. Requires shop Curate management. Open, undeleted reminders show in curate_whats_missing.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['add', 'done', 'edit', 'delete'] },
        text: { type: 'string', description: 'For add or edit: the reminder.' },
        tea_id: { type: 'string', description: 'For add: the tea it is about.' },
        vendor_id: { type: 'string', description: 'For add: the vendor it is about.' },
        todo_id: { type: 'string', description: 'For done, edit or delete: the to-do id.' },
        agent: AGENT_PROP,
        confirm: CONFIRM_PROP,
      },
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

function assertKnownToolInput(name: string, args: Record<string, unknown> = {}) {
  const definition = defs.find(def => def.name === name)!;
  const properties = definition.inputSchema.properties as Record<string, unknown>;
  const unknown = Object.keys(args).find(key => !(key in properties));
  if (unknown) throw new Error(`${unknown} has no field on ${name}; build a structured field instead of filing it in notes`);
}
