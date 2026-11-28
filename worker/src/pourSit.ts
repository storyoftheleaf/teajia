// Pouring, and the sit it makes (Adrian, 2026-11-27).
//
// A host pulls a tea out and taps it on the pour page: the tea joins that
// day's sit. For a stock-linked tea, entering weight requires stock authority. Nothing
// has to be started first. The first pour of a day makes the day's sit; a sit
// can also be made on its own, for a day to come or one already gone.
//
// A sit made here is an ordinary session (an `events` row, its teas in
// `event_tea_menu`), so the thank-you, the guest book, photographs from the
// table, the recap and the Tea Table all work as they do for a session that
// was invited ahead. A casual sit's /sit/<code> link is itself the door:
// guests can see the teas and the host's note and say they were there.
// A scheduled session can use the same address format while keeping its
// existing RSVP, confirmed guest and attendance rules.
//
// Stock follows remove_stock (mcp.ts): a guarded decrement, the listing, the
// ledger, and Sold Out when a tea on sale reaches zero. A pour is never
// refused for want of stock, because the tea is already in the pot: it takes
// what the shelf holds and the row keeps both numbers.

import { accountFreightDefaults, addPricingFields } from './productPricing';
import { issueAfterSitLink } from './afterSitAccess';
import { tableSlug } from './hostTable';
import { servedTeasOf } from './publicSessions';
import type { PublicProductReader } from './sessionTeas';
import { sitWayHolder, signWayGuide } from './wayMedia';
import { sessionHasEnded, sessionInstant, sessionEndsAt, sitWayEndsAt, sitWayOpen } from '../../shared/sessionEnd';
import { approvedSeatSourceSql, attendeeIdentitySql } from './seatRequest';
import { mayShowWalkthrough } from './sessionWalkthrough';

type PourEnv = { DB: D1Database; JWT_SECRET?: string };
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
type Host = { accountId: string; userId?: string | null; email?: string | null };
type StockAuthority = {
  userId: string | null;
  ownerId: string | null;
  shopStock: boolean;
  personal: boolean;
};

async function readStockAuthority(db: D1Database, host: Host): Promise<StockAuthority> {
  const userId = host.userId ?? null;
  const row = await db.prepare(
    `SELECT a.owner_user_id, a.personal_inventory_user_id, m.role,
            EXISTS (
              SELECT 1 FROM json_each(CASE WHEN json_valid(m.permissions) THEN m.permissions ELSE '{}' END, '$.bundles')
              WHERE value = 'stock' AND json_type(CASE WHEN json_valid(m.permissions) THEN m.permissions ELSE '{}' END, '$.bundles') = 'array'
            ) AS staff_stock
       FROM accounts a LEFT JOIN account_members m ON m.account_id = a.id AND m.user_id = ? AND m.status = 'active'
      WHERE a.id = ? AND a.status = 'active'`,
  ).bind(userId, host.accountId).first<{
    owner_user_id: string | null; personal_inventory_user_id: string | null; role: string | null; staff_stock: number;
  }>();
  const ownerId = row?.owner_user_id ?? null;
  const personal = Boolean(row?.personal_inventory_user_id);
  const shopStock = Boolean(userId && row && (personal
    ? row.personal_inventory_user_id === userId && ownerId === userId && row.role === 'owner'
    : ownerId === userId || (ownerId === null && row.role === 'owner') || (row.role === 'staff' && row.staff_stock === 1)));
  return { userId: row ? userId : null, ownerId, shopStock, personal };
}

function canMovePourStock(authority: StockAuthority, holdingOwner: string | null) {
  if (authority.personal && !authority.shopStock) return false;
  if (holdingOwner !== null && holdingOwner === authority.userId) return true;
  return authority.shopStock && (holdingOwner === null || holdingOwner === authority.ownerId);
}

const stockRefusal = () => refuse('Only the stock owner or staff with Stock permission for this shop can change these grams.', 'pour_stock_permission', 403);

type Guest = { userId: string; email?: string | null; name?: string | null };

type Deps<E> = {
  requireHost: (request: Request, env: E) => Promise<Host | { error: Response }>;
  requireUser: (request: Request, env: E) => Promise<Guest | { error: Response }>;
  /** The account that holds the host's own tea spaces (their personal one), when it is not the shop. */
  ownPlacesAccount?: (env: E, userId: string) => Promise<string | null>;
  limit: (request: Request, env: E, key: string) => Promise<Response | null>;
  readPublic: (env: E) => PublicProductReader;
  appOrigin: (env: E) => string;
  /** The signed-in caller when the request carries a valid sign-in, else null. Never refuses. */
  optionalUser?: (request: Request, env: E) => Promise<string | null>;
  /** The normal RSVP and guest doors over events e and accounts a. */
  sessionRsvpSql: (env: E) => string;
  sessionGuestSql: (env: E) => string;
};

export const SIT_CODE_FORMAT = /^[a-f0-9]{24}$/;
export const SIT_TITLE_MAX = 120;
export const SIT_NOTE_MAX = 4000;
export const POUR_NAME_MAX = 240;
export const POUR_GRAMS_MAX = 2000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const hex = (bytes: Uint8Array) => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
const newSitCode = () => hex(crypto.getRandomValues(new Uint8Array(12)));

function reply(value: unknown, status = 200) {
  const response = Response.json(value, { status });
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}
const refuse = (error: string, code: string, status = 400) => reply({ error, code }, status);
const gone = () => refuse('This sit could not be found.', 'sit_not_found', 404);

function validZone(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 64) return null;
  try { new Intl.DateTimeFormat('en', { timeZone: value.trim() }); return value.trim(); } catch { return null; }
}

/** "Tea on 27 November": what a sit is called until its host names it. */
export function sitTitleFor(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return `Tea on ${new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(date)}`;
}

/**
 * What a typed weight means. Nothing typed is no weight (null) and takes no
 * stock; a number is the number, to one decimal place. Zero is no weight too:
 * nobody pours nothing.
 */
export function pouredGrams(value: unknown): number | null | { refused: string } {
  if (value === undefined || value === null || value === '') return null;
  const grams = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(grams) || grams < 0) return { refused: 'Type the weight in grams.' };
  if (grams > POUR_GRAMS_MAX) return { refused: `A pour is at most ${POUR_GRAMS_MAX} g.` };
  const rounded = Math.round(grams * 10) / 10;
  return rounded === 0 ? null : rounded;
}

type SitRow = {
  id: string; account_id: string; slug: string; title: string; event_date: string; event_end_date: string | null;
  timezone: string | null; lifecycle_status: string; status: string | null; sit_link_code: string | null;
  casual_sit: number; address_text: string | null; map_link: string | null; venue_guide: string | null;
  location_id: string | null; location_name: string | null;
};
type LinkedSit = SitRow & { rsvp_open: number; guest_open: number };
const SIT_COLUMNS = `e.id, e.account_id, e.slug, e.title, e.event_date, e.event_end_date, e.timezone,
  e.lifecycle_status, e.status, e.sit_link_code, e.casual_sit, e.address_text, e.map_link, e.venue_guide,
  e.location_id, e.location_name`;

const hasBegun = (sit: SitRow, now = Date.now()) => {
  const start = sessionInstant(sit.event_date, sit.timezone);
  return start !== null && start.at <= now;
};

/**
 * A sit made on the pour page for a day to come is waiting; once its day has
 * arrived it has happened, which is what opens the thank-you, the guest book
 * and photographs. Stated here once, and run wherever the sit is read.
 */
async function settleSit(db: D1Database, sit: SitRow, now = Date.now()): Promise<SitRow> {
  if (!sit.casual_sit || (sit.lifecycle_status !== 'published' && sit.lifecycle_status !== 'draft') || !hasBegun(sit, now)) return sit;
  await db.prepare(
    `UPDATE events SET lifecycle_status = 'completed', status = 'closed', updated_at = datetime('now')
     WHERE id = ? AND account_id = ? AND casual_sit = 1 AND lifecycle_status IN ('draft', 'published')`,
  ).bind(sit.id, sit.account_id).run();
  return { ...sit, lifecycle_status: 'completed', status: 'closed' };
}

type PouredRow = {
  id: string; product_id: string | null; name: string | null; poured_grams: number | null;
  stock_taken_grams: number | null; stock_owner_id: string | null; stock_product_id: string | null; image_url: string | null; stock_grams: number | null;
};

async function pouredAt(db: D1Database, sit: { id: string; account_id: string }, authority: StockAuthority) {
  const { results } = await db.prepare(
    `SELECT m.id, m.product_id,
            COALESCE(NULLIF(trim(m.custom_name), ''), NULLIF(trim(p.given_name), ''), NULLIF(trim(p.product_name), '')) AS name,
            m.poured_grams, m.stock_taken_grams, p.owner_user_id AS stock_owner_id, p.id AS stock_product_id, p.image_url, p.stock_grams
     FROM event_tea_menu m
     LEFT JOIN products p ON p.id = m.product_id AND p.account_id = m.account_id
     WHERE m.account_id = ? AND m.event_id = ?
     ORDER BY m.brew_order ASC NULLS LAST, m.created_at ASC, m.id ASC`,
  ).bind(sit.account_id, sit.id).all<PouredRow>();
  return results.map(row => ({
    id: row.id, product_id: row.product_id, name: row.name ?? '', grams: row.poured_grams,
    // The shelf held less than was poured: the host sees it, once, on the pour itself.
    short: row.poured_grams !== null && row.stock_taken_grams !== null && row.stock_taken_grams < row.poured_grams,
    can_take_back: !(Number(row.stock_taken_grams ?? 0) > 0 && row.stock_product_id) || canMovePourStock(authority, row.stock_owner_id),
    image_url: row.image_url, stock_grams: row.stock_grams,
  }));
}

async function hostSit<E extends PourEnv>(deps: Deps<E>, env: E, sit: SitRow, authority: StockAuthority) {
  const note = await env.DB.prepare(
    `SELECT session_notes FROM event_attendee_recaps WHERE event_id = ? AND account_id = ?`,
  ).bind(sit.id, sit.account_id).first<{ session_notes: string | null }>();
  return {
    id: sit.id, title: sit.title, date: sit.event_date, timezone: sit.timezone, casual: sit.casual_sit === 1,
    happened: sit.lifecycle_status === 'completed' || sit.lifecycle_status === 'archived',
    link: sit.sit_link_code ? `${deps.appOrigin(env)}/sit/${sit.sit_link_code}` : null,
    note: note?.session_notes ?? null,
    place: sit.location_id ? { id: sit.location_id, name: sit.location_name } : null,
    has_way: Boolean(sit.address_text || sit.map_link || sit.venue_guide),
    way_open: sit.casual_sit === 1 ? sitWayOpen(sit) : !sessionHasEnded(sit),
    teas: await pouredAt(env.DB, sit, authority),
  };
}

function readSit(db: D1Database, accountId: string, id: string) {
  return db.prepare(`SELECT ${SIT_COLUMNS} FROM events e WHERE e.id = ? AND e.account_id = ?`)
    .bind(id, accountId).first<SitRow>();
}

/** Make a sit for one day. Its day already here, it has happened; otherwise it waits for its day. */
async function makeSit(db: D1Database, accountId: string, day: string, timezone: string, title?: string): Promise<SitRow> {
  const id = crypto.randomUUID();
  const name = title?.trim().slice(0, SIT_TITLE_MAX) || sitTitleFor(day);
  const start = sessionInstant(day, timezone);
  const begun = start !== null && start.at <= Date.now();
  await db.prepare(
    `INSERT INTO events (
       id, account_id, title, slug, event_date, timezone, total_capacity, requires_approval,
       public_visibility, network_discovery, status, lifecycle_status, claim_window_minutes,
       event_format, gathering_type, recap_status, casual_sit, sit_link_code, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, 12, 0, 'unlisted', 0, ?, ?, 60,
       'private_tasting', 'private', 'draft', 1, ?, datetime('now'), datetime('now'))`,
  ).bind(id, accountId, name, tableSlug(name), day, timezone, begun ? 'closed' : 'active',
    begun ? 'completed' : 'published', newSitCode()).run();
  return (await readSit(db, accountId, id))!;
}

/** Take a pour's grams off the shelf: what was typed, or what is there when that is less. Returns what was taken. */
async function takeStock(db: D1Database, host: Host, productId: string, grams: number, sitTitle: string): Promise<number> {
  // The read is advisory; the guarded statement decides, so two pours at once
  // cannot take the same grams twice. A lost race reads again, once.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const shelf = await db.prepare('SELECT stock_grams FROM products WHERE id = ? AND account_id = ?')
      .bind(productId, host.accountId).first<{ stock_grams: number | null }>();
    const amount = Math.min(grams, Math.max(0, Number(shelf?.stock_grams ?? 0)));
    if (!(amount > 0)) return 0;
    const taken = await db.prepare(
      `UPDATE products SET stock_grams = stock_grams - ?1 WHERE id = ?2 AND account_id = ?3 AND stock_grams >= ?1
       RETURNING stock_grams, status`,
    ).bind(amount, productId, host.accountId).first<{ stock_grams: number; status: string | null }>();
    if (!taken) continue;
    const after = Number(taken.stock_grams);
    const statements = [
      db.prepare(`UPDATE product_listings SET stock_grams = MAX(0, stock_grams - ?), updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
        .bind(amount, `list_${productId}`, host.accountId),
      db.prepare(
        `INSERT INTO stock_ledger (id, product_id, delta, balance_after, movement_unit, reason, movement_type, user_email, note, account_id)
         VALUES (?, ?, ?, ?, 'gram', 'SAMPLE', 'sample_use', ?, ?, ?)`,
      ).bind(crypto.randomUUID(), productId, -amount, after, host.email ?? null, `Poured at ${sitTitle}`.slice(0, 500), host.accountId),
    ];
    if (after === 0 && taken.status === 'Active') {
      statements.push(db.prepare(`UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ? AND account_id = ?`)
        .bind(productId, host.accountId));
    }
    await db.batch(statements);
    return amount;
  }
  return 0;
}

export function pourSitRoutes<E extends PourEnv>(deps: Deps<E>): [string, string, Handler<E>][] {
  // GET /api/admin/pour/teas: every tea on the shelf, newest first, as buttons.
  const teas: Handler<E> = async (request, env) => {
    const host = await deps.requireHost(request, env);
    if ('error' in host) return host.error;
    const [{ results }, rateRows, authority] = await Promise.all([
      env.DB.prepare(
        `SELECT * FROM products
         WHERE account_id = ? AND type NOT IN ('Teaware', 'Misc') AND COALESCE(status, 'Active') <> 'Archived'
           AND personal_offer_source_id IS NULL
         ORDER BY created_at DESC, id DESC LIMIT 800`,
      ).bind(host.accountId).all<Record<string, unknown>>(),
      env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates').all<{ currency: string; rate_to_usd: number }>(),
      readStockAuthority(env.DB, host),
    ]);
    // The shelf price of a gram, read now from cost and freight (worker/src/productPricing.ts); null prints a dash.
    const rates = new Map(rateRows.results.map(row => [row.currency, row.rate_to_usd]));
    const freight = await accountFreightDefaults(env, host.accountId, rates);
    const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
    return reply({
      teas: results.map(row => {
        const price = addPricingFields(row, rates, freight).retail_price_per_gram_usd;
        return {
          id: row.id, can_deduct: canMovePourStock(authority, text(row.owner_user_id)), name: text(row.given_name) ?? row.product_name, product_name: row.product_name, chinese_name: row.chinese_name,
          type: row.type, classification: row.classification, year: row.year,
          image_url: text(row.image_url) ?? text(row.bag_photo_url), stock_grams: row.stock_grams, status: row.status,
          created_at: row.created_at, sample: Number(row.is_sample) === 1 || row.inventory_purpose === 'sample' ? 1 : 0,
          price_per_gram: typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null,
        };
      }),
    });
  };

  // GET /api/admin/pour/sits?date=YYYY-MM-DD: the sits a pour could belong to.
  // The ones made here lately, and any session of that day.
  const sits: Handler<E> = async (request, env) => {
    const host = await deps.requireHost(request, env);
    if ('error' in host) return host.error;
    const day = new URL(request.url).searchParams.get('date') ?? '';
    if (!DAY.test(day)) return refuse('Say which day.', 'pour_day');
    const { results } = await env.DB.prepare(
      `SELECT ${SIT_COLUMNS} FROM events e
       WHERE e.account_id = ?1 AND e.lifecycle_status NOT IN ('cancelled', 'archived')
         AND (e.casual_sit = 1 OR substr(e.event_date, 1, 10) = ?2)
       ORDER BY substr(e.event_date, 1, 10) DESC, e.created_at DESC LIMIT 8`,
    ).bind(host.accountId, day).all<SitRow>();
    const settled = await Promise.all(results.map(sit => settleSit(env.DB, sit)));
    const authority = await readStockAuthority(env.DB, host);
    return reply({ sits: await Promise.all(settled.map(sit => hostSit(deps, env, sit, authority))) });
  };

  // POST /api/admin/pour/sits { date, timezone, title? }: a sit with no tea yet,
  // for sending the way in ahead of the day.
  const createSit: Handler<E> = async (request, env) => {
    const host = await deps.requireHost(request, env);
    if ('error' in host) return host.error;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const zone = validZone(body?.timezone);
    if (typeof body?.date !== 'string' || !DAY.test(body.date) || !zone) return refuse('Say which day.', 'pour_day');
    const sit = await makeSit(env.DB, host.accountId, body.date, zone, typeof body.title === 'string' ? body.title : undefined);
    return reply({ sit: await hostSit(deps, env, sit, await readStockAuthority(env.DB, host)) }, 201);
  };

  /** The host's own account beside the shop: their tea spaces are kept there. */
  const ownAccount = async (env: E, host: Host) =>
    (host.userId && deps.ownPlacesAccount ? await deps.ownPlacesAccount(env, host.userId) : null) ?? host.accountId;

  // GET /api/admin/pour/places: where a sit can be, for the send sheet. The
  // host's tea spaces first, then their other saved places, each group with
  // the place sat at most lately on top. Names only: the way in stays behind.
  const places: Handler<E> = async (request, env) => {
    const host = await deps.requireHost(request, env);
    if ('error' in host) return host.error;
    const own = await ownAccount(env, host);
    const { results } = await env.DB.prepare(
      `SELECT l.id, l.name, l.is_host_table,
              (SELECT MAX(substr(e.event_date, 1, 10)) FROM events e
                WHERE e.location_id = l.id AND e.account_id = ?1
                  AND e.lifecycle_status NOT IN ('cancelled')) AS last_sat
         FROM saved_locations l WHERE l.account_id IN (?1, ?2)
        ORDER BY l.is_host_table DESC, last_sat IS NULL, last_sat DESC, l.name COLLATE NOCASE ASC LIMIT 100`,
    ).bind(host.accountId, own).all<{ id: string; name: string | null; is_host_table: number; last_sat: string | null }>();
    return reply({
      places: results.map(row => ({
        id: String(row.id), name: String(row.name ?? ''), space: Number(row.is_host_table) === 1, sat: Boolean(row.last_sat),
      })),
    });
  };

  // PUT /api/admin/pour/sits/:id { title?, note?, place_id?, link? }: name it,
  // say a word to the guests, choose a place, or create or remove the shared
  // link without changing the session's RSVP door.
  const changeSit: Handler<E> = async (request, env, { id }) => {
    const host = await deps.requireHost(request, env);
    if ('error' in host) return host.error;
    let sit = await readSit(env.DB, host.accountId, id);
    if (!sit) return gone();
    sit = await settleSit(env.DB, sit);
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return refuse('Nothing to change.', 'sit_change');

    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title || title.length > SIT_TITLE_MAX) return refuse('Give the sit a name.', 'sit_title');
      await env.DB.prepare(`UPDATE events SET title = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
        .bind(title, sit.id, host.accountId).run();
    }
    if (body.link === true && !sit.sit_link_code) {
      await env.DB.prepare(`UPDATE events SET sit_link_code = ? WHERE id = ? AND account_id = ? AND sit_link_code IS NULL`)
        .bind(newSitCode(), sit.id, host.accountId).run();
    } else if (body.link === false) {
      await env.DB.prepare(`UPDATE events SET sit_link_code = NULL WHERE id = ? AND account_id = ?`)
        .bind(sit.id, host.accountId).run();
    }
    if (body.place_id !== undefined) {
      if (body.place_id === null) {
        await env.DB.prepare(
          `UPDATE events SET location_id = NULL, location_name = NULL, address_text = NULL, map_link = NULL, venue_guide = NULL,
             updated_at = datetime('now') WHERE id = ? AND account_id = ?`,
        ).bind(sit.id, host.accountId).run();
      } else {
        // The place is one this shop saved, or a tea space of the host's own; its way in is copied onto the sit, as the session form does.
        const placed = await env.DB.prepare(
          `UPDATE events SET location_id = l.id, location_name = l.name, address_text = l.address, map_link = l.map_link,
             venue_guide = l.venue_guide, updated_at = datetime('now')
           FROM saved_locations l
           WHERE events.id = ? AND events.account_id = ? AND l.id = ? AND l.account_id IN (events.account_id, ?)`,
        ).bind(sit.id, host.accountId, String(body.place_id), await ownAccount(env, host)).run();
        if (!placed.meta?.changes) return refuse('That place is not one of yours.', 'sit_place', 404);
      }
    }
    if (body.note !== undefined) {
      const note = typeof body.note === 'string' ? body.note.trim() : '';
      if (note.length > SIT_NOTE_MAX) return refuse('Keep the note shorter.', 'sit_note');
      if (!note) {
        await env.DB.prepare(`DELETE FROM event_attendee_recaps WHERE event_id = ? AND account_id = ?`)
          .bind(sit.id, host.accountId).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO event_attendee_recaps (event_id, account_id, session_notes) VALUES (?, ?, ?)
           ON CONFLICT(event_id) DO UPDATE SET session_notes = excluded.session_notes
           WHERE event_attendee_recaps.account_id = excluded.account_id`,
        ).bind(sit.id, host.accountId, note).run();
      }
    }
    return reply({ sit: await hostSit(deps, env, (await readSit(env.DB, host.accountId, id))!, await readStockAuthority(env.DB, host)) });
  };

  // POST /api/admin/pour { date, timezone, sit_id?, product_id? | name?, grams? }:
  // one tea out of the cupboard. With no sit named, it joins the sit made here
  // for that day, and makes it when there is none.
  const pour: Handler<E> = async (request, env) => {
    const host = await deps.requireHost(request, env);
    if ('error' in host) return host.error;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const grams = pouredGrams(body?.grams);
    if (grams !== null && typeof grams === 'object') return refuse(grams.refused, 'pour_grams');

    const productId = typeof body?.product_id === 'string' && body.product_id ? body.product_id : null;
    const typed = typeof body?.name === 'string' ? body.name.trim() : '';
    const authority = await readStockAuthority(env.DB, host);
    let teaName = typed;
    if (productId) {
      const product = await env.DB.prepare(
        `SELECT COALESCE(NULLIF(trim(given_name), ''), product_name) AS name, owner_user_id FROM products
         WHERE id = ? AND account_id = ? AND type NOT IN ('Teaware', 'Misc') AND personal_offer_source_id IS NULL`,
      ).bind(productId, host.accountId).first<{ name: string; owner_user_id: string | null }>();
      if (!product) return refuse('That tea is not on this shelf.', 'pour_tea', 404);
      if (grams !== null && !canMovePourStock(authority, product.owner_user_id)) return stockRefusal();
      teaName = product.name;
    }
    if (!teaName || teaName.length > POUR_NAME_MAX) return refuse('Choose a tea, or type its name.', 'pour_tea');

    let sit: SitRow | null = null;
    if (typeof body?.sit_id === 'string' && body.sit_id) {
      sit = await readSit(env.DB, host.accountId, body.sit_id);
      if (!sit || sit.lifecycle_status === 'cancelled' || sit.lifecycle_status === 'archived') return gone();
    } else {
      const zone = validZone(body?.timezone);
      if (typeof body?.date !== 'string' || !DAY.test(body.date) || !zone) return refuse('Say which day.', 'pour_day');
      sit = await env.DB.prepare(
        `SELECT ${SIT_COLUMNS} FROM events e WHERE e.account_id = ? AND e.casual_sit = 1 AND e.event_date = ?
           AND e.lifecycle_status NOT IN ('cancelled', 'archived') ORDER BY e.created_at DESC LIMIT 1`,
      ).bind(host.accountId, body.date).first<SitRow>() ?? await makeSit(env.DB, host.accountId, body.date, zone);
    }
    sit = await settleSit(env.DB, sit);

    const menuId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, brew_order, poured_grams)
       SELECT ?, ?, ?, ?, ?, COALESCE(MAX(brew_order), 0) + 1, ? FROM event_tea_menu WHERE event_id = ? AND account_id = ?`,
    ).bind(menuId, host.accountId, sit.id, productId, teaName, grams, sit.id, host.accountId).run();
    if (productId && grams !== null) {
      const taken = await takeStock(env.DB, host, productId, grams, sit.title);
      await env.DB.prepare(`UPDATE event_tea_menu SET stock_taken_grams = ? WHERE id = ? AND account_id = ?`)
        .bind(taken, menuId, host.accountId).run();
    }
    return reply({ poured: menuId, sit: await hostSit(deps, env, sit, authority) }, 201);
  };

  // DELETE /api/admin/pour/:menuId: the wrong tea was tapped. The row goes and
  // the grams it took go back on the shelf.
  const unpour: Handler<E> = async (request, env, { menuId }) => {
    const host = await deps.requireHost(request, env);
    if ('error' in host) return host.error;
    const row = await env.DB.prepare(
      `SELECT m.event_id, m.product_id, m.stock_taken_grams, p.id AS stock_product_id, p.owner_user_id
         FROM event_tea_menu m LEFT JOIN products p ON p.id = m.product_id AND p.account_id = m.account_id
        WHERE m.id = ? AND m.account_id = ?`,
    ).bind(menuId, host.accountId).first<{
      event_id: string; product_id: string | null; stock_taken_grams: number | null;
      stock_product_id: string | null; owner_user_id: string | null;
    }>();
    if (!row) return gone();
    const back = Number(row.stock_taken_grams ?? 0);
    const authority = await readStockAuthority(env.DB, host);
    if (row.stock_product_id && back > 0 && !canMovePourStock(authority, row.owner_user_id)) return stockRefusal();
    const deleted = await env.DB.prepare(
      `DELETE FROM event_tea_menu WHERE id = ? AND account_id = ? AND product_id IS ? AND stock_taken_grams IS ?`,
    ).bind(menuId, host.accountId, row.product_id, row.stock_taken_grams).run();
    if (!deleted.meta?.changes) return gone();
    if (row.stock_product_id && back > 0) {
      const returned = await env.DB.prepare(
        `UPDATE products SET stock_grams = COALESCE(stock_grams, 0) + ? WHERE id = ? AND account_id = ? RETURNING stock_grams, status`,
      ).bind(back, row.stock_product_id, host.accountId).first<{ stock_grams: number; status: string | null }>();
      if (returned) {
        const statements = [
          env.DB.prepare(`UPDATE product_listings SET stock_grams = stock_grams + ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
            .bind(back, `list_${row.stock_product_id}`, host.accountId),
          env.DB.prepare(
            `INSERT INTO stock_ledger (id, product_id, delta, balance_after, movement_unit, reason, movement_type, user_email, note, account_id)
             VALUES (?, ?, ?, ?, 'gram', 'MANUAL_ADJUST', 'return', ?, 'A pour taken back', ?)`,
          ).bind(crypto.randomUUID(), row.stock_product_id, back, Number(returned.stock_grams), host.email ?? null, host.accountId),
        ];
        // A tea the pour sold out is on sale again, as a count that finds stock does.
        if (returned.status === 'Sold Out') {
          statements.push(env.DB.prepare(`UPDATE products SET status = 'Active', sold_out_at = NULL WHERE id = ? AND account_id = ? AND status = 'Sold Out'`)
            .bind(row.stock_product_id, host.accountId));
        }
        await env.DB.batch(statements);
      }
    }
    const sit = await readSit(env.DB, host.accountId, row.event_id);
    return reply({ sit: sit ? await hostSit(deps, env, sit, authority) : null });
  };

  const findByCode = (env: E, code: string) => SIT_CODE_FORMAT.test(code)
    ? env.DB.prepare(
      `SELECT ${SIT_COLUMNS}, (${deps.sessionRsvpSql(env)}) AS rsvp_open, (${deps.sessionGuestSql(env)}) AS guest_open
       FROM events e JOIN accounts a ON a.id = e.account_id AND a.status = 'active'
       WHERE e.sit_link_code = ? AND e.lifecycle_status <> 'cancelled'`,
    ).bind(code).first<LinkedSit>()
    : Promise.resolve(null);

  const checkedSeat = (env: E, sit: SitRow, userId: string) => {
    const casual = sit.casual_sit === 1;
    const identitySql = casual ? 'ea.user_id = ?' : attendeeIdentitySql('ea');
    const identityBinds = casual ? [userId] : [userId, userId];
    return env.DB.prepare(
      `SELECT ea.id, ea.attended
       FROM event_attendees ea JOIN events e ON e.id = ea.event_id AND e.account_id = ea.account_id
       WHERE e.id = ? AND e.account_id = ? AND e.sit_link_code = ? AND ea.status = 'confirmed'
         AND ${approvedSeatSourceSql('e', 'ea')} AND ${identitySql}
       ORDER BY ea.user_id IS NULL, ea.attended DESC, ea.created_at, ea.id LIMIT 1`,
    ).bind(sit.id, sit.account_id, sit.sit_link_code, ...identityBinds).first<{ id: string; attended: number | null }>();
  };

  const limited = async (request: Request, env: E, code: string) => {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    // A malformed code is limited by address alone: it never becomes a limiter key.
    return await deps.limit(request, env, `sit-ip:${ip}`)
      ?? (SIT_CODE_FORMAT.test(code) ? await deps.limit(request, env, `sit:${code}`) : null);
  };

  // GET /api/sit/:code: a scheduled session projects private details only
  // to a signed-in confirmed guest. Its regular RSVP can still be opened.
  const open: Handler<E> = async (request, env, { code }) => {
    const refused = await limited(request, env, code);
    if (refused) return refused;
    const linked = await findByCode(env, code);
    if (!linked) return gone();
    const casual = linked.casual_sit === 1;
    const sit = await settleSit(env.DB, linked);
    const userId = deps.optionalUser ? await deps.optionalUser(request, env) : null;
    const seat = userId && (casual || linked.guest_open === 1) ? await checkedSeat(env, sit, userId) : null;
    if (!casual && !seat) {
      const rsvpPath = linked.rsvp_open === 1 && !sessionHasEnded(sit) ? `/event/${encodeURIComponent(sit.slug)}` : null;
      return reply({ access: 'approval', rsvp_path: rsvpPath });
    }
    const [note, poured] = await Promise.all([
      env.DB.prepare(`SELECT session_notes FROM event_attendee_recaps WHERE event_id = ? AND account_id = ?`)
        .bind(sit.id, sit.account_id).first<{ session_notes: string | null }>(),
      servedTeasOf(env.DB, deps.readPublic(env), sit),
    ]);
    const endsAt = casual ? sitWayEndsAt(sit) : sessionEndsAt(sit);
    const wayOpen = (casual ? sitWayOpen(sit) : mayShowWalkthrough('confirmed', sit, true))
      && endsAt !== null && Boolean(sit.address_text || sit.map_link || sit.venue_guide);
    return reply({
      access: casual ? 'casual' : 'confirmed',
      title: sit.title, date: sit.event_date, timezone: sit.timezone,
      happened: sit.lifecycle_status === 'completed' || sit.lifecycle_status === 'archived',
      seated: seat?.attended === 1,
      note: note?.session_notes ?? null,
      teas: poured,
      way: wayOpen ? {
        place: sit.location_name, address: sit.address_text, map_link: sit.map_link, ends_at: endsAt,
        guide: sit.venue_guide ? await signWayGuide(env.JWT_SECRET, sit.venue_guide, sitWayHolder(code, casual ? null : seat?.id), { endsAt }) : null,
      } : null,
    });
  };

  // POST /api/sit/:code/join: self-attestation is for casual sits only.
  // Scheduled guests need both a confirmed seat and recorded attendance.
  const join: Handler<E> = async (request, env, { code }) => {
    const refused = await limited(request, env, code);
    if (refused) return refused;
    const guest = await deps.requireUser(request, env);
    if ('error' in guest) return guest.error;
    const linked = await findByCode(env, code);
    if (!linked) return gone();
    const sit = await settleSit(env.DB, linked);
    const refusedSeat = () => refuse('Ask your host about this sit.', 'sit_seat', 403);
    if (sit.casual_sit !== 1) {
      const seat = linked.guest_open === 1 ? await checkedSeat(env, sit, guest.userId) : null;
      if (seat?.attended !== 1) return refusedSeat();
      const issued = await issueAfterSitLink(env.DB, { attendeeId: seat.id, eventId: sit.id, accountId: sit.account_id }, { code, userId: guest.userId });
      return issued ? reply({ credential: issued.credential }) : refusedSeat();
    }
    if (sit.lifecycle_status !== 'completed' && sit.lifecycle_status !== 'archived') {
      return refuse('This sit has not happened yet.', 'sit_not_yet', 409);
    }
    const person = await env.DB.prepare(`SELECT name, email FROM users WHERE id = ?`).bind(guest.userId)
      .first<{ name: string | null; email: string | null }>();
    const fullName = person?.name?.trim() || guest.name?.trim() || 'Guest';
    await env.DB.prepare(
      `INSERT INTO event_attendees (id, event_id, account_id, user_id, full_name, email, status, attended, magic_token, source)
       SELECT ?, ?, ?, ?, ?, ?, 'confirmed', 1, ?, 'sit_link'
       WHERE EXISTS (SELECT 1 FROM events WHERE id = ? AND account_id = ? AND sit_link_code = ? AND casual_sit = 1)
         AND NOT EXISTS (SELECT 1 FROM event_attendees WHERE event_id = ? AND account_id = ? AND user_id = ?)`,
    ).bind(crypto.randomUUID(), sit.id, sit.account_id, guest.userId, fullName, person?.email ?? guest.email ?? null,
      hex(crypto.getRandomValues(new Uint8Array(24))), sit.id, sit.account_id, code, sit.id, sit.account_id, guest.userId).run();
    // A seat the host has since marked as not there stays that way: the link is for those who came.
    const seat = await env.DB.prepare(
      `SELECT id FROM event_attendees WHERE event_id = ? AND account_id = ? AND user_id = ? AND status = 'confirmed' AND attended = 1
       ORDER BY created_at ASC LIMIT 1`,
    ).bind(sit.id, sit.account_id, guest.userId).first<{ id: string }>();
    if (!seat) return refusedSeat();
    const issued = await issueAfterSitLink(env.DB, { attendeeId: seat.id, eventId: sit.id, accountId: sit.account_id }, { code, userId: guest.userId });
    return issued ? reply({ credential: issued.credential }) : refusedSeat();
  };

  return [
    ['GET', '/api/admin/pour/teas', teas],
    ['GET', '/api/admin/pour/sits', sits],
    ['GET', '/api/admin/pour/places', places],
    ['POST', '/api/admin/pour/sits', createSit],
    ['PUT', '/api/admin/pour/sits/:id', changeSit],
    ['POST', '/api/admin/pour', pour],
    ['DELETE', '/api/admin/pour/:menuId', unpour],
    ['GET', '/api/sit/:code', open],
    ['POST', '/api/sit/:code/join', join],
  ];
}
