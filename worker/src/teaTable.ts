/**
 * The Tea Table (Launch 4, K1 and K2; plan todo/plans/tea-table.md; the rule
 * is "The Tea Table" in CLAUDE.md). One public page of what people chose to
 * put on the table, newest first: shared tastings with their words and
 * photographs, and published session recaps. Nothing rises by itself.
 *
 * The consent gate (K0 audit, 2026-11-26). A piece is on the table only when
 * it was put there under the Tea Table wording:
 * - a tasting needs member_tasting_shares.tea_table_at, written only by the
 *   Share step's Tea Table wording (familyRoutes.ts, shareTasting). Shares
 *   under the older "On my page" wording have none and stay off until shared
 *   again. Its words come only from the sittings the journal held at that
 *   moment (tea_table_sittings), and a note written later is left out, so a
 *   later sitting kept private never shows. Its photographs are the ones it
 *   had then. Never a score: the journal's `rating`, `note` and `verdict` are
 *   never selected.
 * - a recap needs events.tea_table_at, written when its host puts the
 *   published recap on the table, and it must still be published, public, on
 *   the network and not hidden by the platform owner.
 * Every read applies the gate, so a withdrawn or hidden piece is gone from
 * the stream, the held pieces and everyone's kept pieces in the same moment.
 *
 * Taking off and hiding (A4 review, 2026-11-26). Adrian's rule: a person can
 * take their own item off, and the owner can hide any item; a withdrawn item
 * is gone from every place.
 * - The author taking a tasting off: when they had chosen their own page by
 *   itself before (member_tasting_shares.page_alone_at), it leaves the table
 *   and stays on that page. When the table was the only reason it was public,
 *   it goes private everywhere, with its photographs and quotes
 *   (worker/src/tastingWithdrawal.ts).
 * - The owner's hide of a tasting is a family hide, honoured on the person's
 *   page, its photographs and its quotes as well as here.
 * - A host taking a recap off: the table only; the recap stays public on its
 *   own page. The owner's hide of a recap takes it off every public place
 *   (RECAP_NOT_HIDDEN inside publishedSitRecap).
 * - Only a host of the session, acting for its shop, puts a recap on, takes it
 *   off or holds it; the platform owner may act on any.
 *
 * The hand (K2). A host may hold their own recap at the top for a while; the
 * platform owner may hold any piece. A hold always has an end. Anyone signed
 * in may keep a piece to their own favourites. The number of keeps is read by
 * one route only, GET /api/admin/tea-table, for the platform owner; no other
 * answer carries it, and the public stream is the same for everyone.
 */
import { FAMILY_PAGE_NOT_HIDDEN_SQL, PHOTO_NOT_HIDDEN, TASTING_NOT_HIDDEN, wordsFromSittings } from './familyPersonTastings';
import { formalSessionCardColumns, publishedSitRecap, sessionCards, type SessionCardRow } from './publicSitConnections';
import { isFamilyPhotographShape, readFamilyPhotographFrame, type FamilyPersonPhotograph } from '../../src/lib/familyContract';
import { recapPath } from '../../src/lib/publicSitConnections';
import { teaTableOpen } from '../../src/lib/teaTable';
import { withdrawTastingShare } from './tastingWithdrawal';
import {
  TEA_TABLE_HOLD_DAYS, TEA_TABLE_SHOWS, teaTableKey, teaTableMoment,
  type TeaTableItem, type TeaTableKind, type TeaTableManageItem, type TeaTableMine, type TeaTablePage,
  type TeaTableRecap, type TeaTableRecapState, type TeaTableShow, type TeaTableTasting,
} from '../../src/lib/teaTableContract';

export type TeaTableEnv = { DB: D1Database; TEA_TABLE_OPEN?: string };
type Person = { userId: string };
type Shop = { accountId: string; userId: string };
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
export interface TeaTableDeps<E> {
  requireAuthenticatedUser(request: Request, env: E): Promise<Person | { error: Response }>;
  requireBundle(request: Request, env: E, bundle: 'gather'): Promise<Shop | { error: Response }>;
}

const PAGE = 20;
const MOST_HELD = 6;
const MOST_KEPT = 120;
const MEDIA_PREFIX = 'https://media.teajia.co/';
const KINDS: readonly TeaTableKind[] = ['recap', 'tasting'];

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const privateJson = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
const refuse = (status: number, error: string, code: string) => privateJson({ error, code }, status);
const notFound = () => refuse(404, 'Not found', 'not_found');
export const isTeaTableKind = (value: unknown): value is TeaTableKind => typeof value === 'string' && (KINDS as readonly string[]).includes(value);

// ── The consent gate, as SQL ────────────────────────────────────────────────

/** A tasting on the table. Needs s (member_tasting_shares), j (journal), c (contributors), p (products), a (accounts). */
const TASTING_FROM = `
  FROM member_tasting_shares s
  JOIN customer_tasting_journal j ON j.id = s.journal_entry_id
  JOIN contributors c ON c.user_id = s.author_user_id
  JOIN products p ON p.id = s.product_id AND p.account_id = s.account_id
  JOIN accounts a ON a.id = p.account_id`;
const TASTING_ON_TABLE = `
  s.share_state IN ('page', 'offered') AND s.tea_table_at IS NOT NULL
  AND COALESCE(j.archived, 0) = 0 AND ${TASTING_NOT_HIDDEN}
  AND c.is_published = 1 AND ${FAMILY_PAGE_NOT_HIDDEN_SQL}
  AND p.is_public = 1 AND p.shown_in_shop = 1 AND p.status IN ('Active', 'Sold Out')
  AND a.status = 'active' AND a.public_enabled = 1`;

/** A recap on the table. Needs e (events) and a (accounts). */
const RECAP_ELIGIBLE = `e.network_discovery = 1 AND ${publishedSitRecap}`;
const RECAP_ON_TABLE = `
  ${RECAP_ELIGIBLE}
  AND e.tea_table_at IS NOT NULL AND e.tea_table_hidden_at IS NULL`;

const held = (kind: TeaTableKind, id: string) => `EXISTS (SELECT 1 FROM tea_table_holds th
  WHERE th.item_kind = '${kind}' AND th.item_id = ${id} AND datetime(th.held_until) > datetime('now'))`;

type Filter = { before?: string | null; hold?: 'only' | 'without'; ids?: string[]; limit: number };

function where(kind: TeaTableKind, column: string, id: string, filter: Filter, binds: unknown[]): string {
  const parts: string[] = [];
  if (filter.before) { parts.push(`datetime(${column}) < datetime(?)`); binds.push(filter.before); }
  if (filter.hold === 'only') parts.push(held(kind, id));
  if (filter.hold === 'without') parts.push(`NOT ${held(kind, id)}`);
  if (filter.ids) { parts.push(`${id} IN (${filter.ids.map(() => '?').join(',') || 'NULL'})`); binds.push(...filter.ids); }
  return parts.map(part => ` AND ${part}`).join('');
}

// ── Reading the table ───────────────────────────────────────────────────────

function sittingIdsOf(raw: unknown): string[] {
  let sittings: unknown;
  try { sittings = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
  if (!Array.isArray(sittings)) return [];
  return sittings.flatMap(sitting => (sitting && typeof sitting.id === 'string' && sitting.id ? [sitting.id] : []));
}

/** The ids of the sittings a journal row holds now: what a Tea Table share covers. */
export function teaTableSittings(raw: unknown): string {
  return JSON.stringify(sittingIdsOf(raw));
}

/**
 * The words of a tasting as it was put on the table: only the sittings it held
 * then, and only notes written by then. A sitting with no id cannot be told
 * apart from a later one, so it is left out.
 */
export function wordsOnTheTable(raw: unknown, sittingsAtShare: string | null, at: string) {
  let shared: Set<string>;
  try { shared = new Set((JSON.parse(sittingsAtShare ?? '[]') as unknown[]).filter((id): id is string => typeof id === 'string')); } catch { shared = new Set(); }
  let sittings: unknown;
  try { sittings = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
  if (!Array.isArray(sittings)) return [];
  const kept = sittings.filter(sitting => sitting && typeof sitting.id === 'string' && shared.has(sitting.id));
  const cutoff = teaTableMoment(at).getTime();
  return wordsFromSittings(kept).filter(word => {
    if (!word.date) return true;
    const written = new Date(word.date).getTime();
    return Number.isNaN(written) || written <= cutoff;
  });
}

type TastingRow = {
  id: string; at: string; sittings: string | null; tastings: string | null; author: string; product_id: string;
  page_id: string; person: string | null; tea: string | null; chinese_name: string | null; slug: string | null;
  type: string | null; account_slug: string;
};
type PhotoRow = {
  journal_entry_id: string; id: string; small_key: string; full_key: string; small_width: number; small_height: number;
  shape: string | null; frame: string | null;
};

function frameOf(text: string | null) {
  if (!text) return null;
  try { return readFamilyPhotographFrame(JSON.parse(text)) ?? null; } catch { return null; }
}

async function readTastings(db: D1Database, filter: Filter): Promise<TeaTableTasting[]> {
  const binds: unknown[] = [];
  const conditions = where('tasting', 's.tea_table_at', 's.journal_entry_id', filter, binds);
  const { results } = await db.prepare(
    `SELECT s.journal_entry_id AS id, s.tea_table_at AS at, s.tea_table_sittings AS sittings, j.tastings,
            s.author_user_id AS author, s.product_id, c.id AS page_id, c.display_name AS person,
            COALESCE(NULLIF(p.given_name, ''), p.product_name) AS tea, p.chinese_name, p.slug, p.type, a.slug AS account_slug
     ${TASTING_FROM}
     WHERE ${TASTING_ON_TABLE}${conditions}
     ORDER BY datetime(s.tea_table_at) DESC, s.journal_entry_id DESC LIMIT ?`,
  ).bind(...binds, filter.limit).all<TastingRow>();
  const rows = results ?? [];
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const photos = await db.prepare(
    `SELECT s.journal_entry_id, p.id, p.small_key, p.full_key, p.small_width, p.small_height, p.shape, p.frame
       FROM member_tasting_shares s
       JOIN member_photographs p ON p.author_user_id = s.author_user_id AND p.product_id = s.product_id
      WHERE s.journal_entry_id IN (${ids.map(() => '?').join(',')})
        AND p.share_state IN ('page', 'offered') AND p.removed_by_member_at IS NULL AND ${PHOTO_NOT_HIDDEN}
        AND datetime(p.created_at) <= datetime(s.tea_table_at)
      ORDER BY p.created_at, p.id`,
  ).bind(...ids).all<PhotoRow>();
  const pictures = new Map<string, FamilyPersonPhotograph[]>();
  for (const photo of photos.results ?? []) {
    const list = pictures.get(photo.journal_entry_id) ?? [];
    if (list.length >= 6) continue;
    list.push({
      id: photo.id, small_url: MEDIA_PREFIX + photo.small_key, full_url: MEDIA_PREFIX + photo.full_key,
      small_width: Number(photo.small_width), small_height: Number(photo.small_height),
      shape: isFamilyPhotographShape(photo.shape) ? photo.shape : 'square', frame: frameOf(photo.frame),
    });
    pictures.set(photo.journal_entry_id, list);
  }
  return rows.filter(row => row.tea).map(row => ({
    kind: 'tasting' as const,
    id: row.id,
    at: row.at,
    person: { name: (row.person ?? '').trim() || 'Teajia family', path: `/people/${encodeURIComponent(row.page_id)}` },
    tea: {
      name: row.tea!, chinese_name: row.chinese_name ?? null, type: row.type ?? null,
      path: `/shop/product/${encodeURIComponent(row.slug || row.product_id)}?store=${encodeURIComponent(row.account_slug)}`,
    },
    words: wordsOnTheTable(row.tastings, row.sittings, row.at),
    photographs: pictures.get(row.id) ?? [],
  }));
}

type RecapRow = SessionCardRow & { id: string; at: string };

async function readRecaps(db: D1Database, filter: Filter): Promise<TeaTableRecap[]> {
  const binds: unknown[] = [];
  const conditions = where('recap', 'e.tea_table_at', 'e.id', filter, binds);
  const { results } = await db.prepare(
    `SELECT e.id, e.tea_table_at AS at, ${formalSessionCardColumns}, a.name AS host
       FROM events e JOIN accounts a ON a.id = e.account_id
      WHERE ${RECAP_ON_TABLE}${conditions}
      ORDER BY datetime(e.tea_table_at) DESC, e.id DESC LIMIT ?`,
  ).bind(...binds, filter.limit).all<RecapRow>();
  return (sessionCards(results ?? [], false) as Array<ReturnType<typeof sessionCards>[number] & { id: string; at: string }>).map(card => ({
    kind: 'recap' as const,
    id: card.id,
    at: card.at,
    slug: card.slug,
    title: card.title,
    session_date: card.event_date,
    host: card.host ?? null,
    writing: card.writing,
    teas: card.teas.map(tea => tea.name),
    tea_type: card.teas[0]?.type ?? null,
  }));
}

const newestFirst = (a: TeaTableItem, b: TeaTableItem) =>
  teaTableMoment(b.at).getTime() - teaTableMoment(a.at).getTime() || teaTableKey(b).localeCompare(teaTableKey(a));

async function readBoth(db: D1Database, show: TeaTableShow, filter: Filter): Promise<TeaTableItem[]> {
  const [tastings, recaps] = await Promise.all([
    show === 'sessions' ? [] : readTastings(db, filter),
    show === 'tastings' ? [] : readRecaps(db, filter),
  ]);
  return [...tastings, ...recaps].sort(newestFirst);
}

/** One page of the table. Held pieces sit above the rest on the first page and are not repeated below. */
export async function readTeaTable(db: D1Database, show: TeaTableShow, before: string | null): Promise<TeaTablePage> {
  const [heldItems, rest] = await Promise.all([
    before ? Promise.resolve([]) : readBoth(db, show, { hold: 'only', limit: MOST_HELD }),
    readBoth(db, show, { hold: 'without', before, limit: PAGE + 1 }),
  ]);
  let cut = Math.min(rest.length, PAGE);
  // Pieces put on the table in the same second stay on the same page, so "Earlier" never skips one.
  while (cut > 0 && cut < rest.length && rest[cut].at === rest[cut - 1].at) cut += 1;
  const items = rest.slice(0, cut);
  return { held: heldItems.slice(0, MOST_HELD), items, earlier: rest.length > cut ? items[items.length - 1].at : null };
}

/** Pieces still on the table, by kind and id, in the order given. A withdrawn or hidden one is simply missing. */
async function readByIds(db: D1Database, keys: Array<{ kind: TeaTableKind; id: string }>): Promise<TeaTableItem[]> {
  const ids = (kind: TeaTableKind) => keys.filter(key => key.kind === kind).map(key => key.id);
  const [tastings, recaps] = await Promise.all([
    ids('tasting').length ? readTastings(db, { ids: ids('tasting'), limit: MOST_KEPT }) : [],
    ids('recap').length ? readRecaps(db, { ids: ids('recap'), limit: MOST_KEPT }) : [],
  ]);
  const found = new Map([...tastings, ...recaps].map(item => [teaTableKey(item), item]));
  return keys.flatMap(key => found.get(teaTableKey(key)) ?? []);
}

export async function teaTablePiece(db: D1Database, kind: TeaTableKind, id: string) {
  return (await readByIds(db, [{ kind, id }]))[0];
}

/** Whether this person is the platform owner, read from the database, never from the token. */
export async function isTeaTablePlatformOwner(db: D1Database, userId: string): Promise<boolean> {
  const row = await db.prepare('SELECT platform_role FROM users WHERE id = ?').bind(userId).first<{ platform_role: string | null }>();
  return row?.platform_role === 'platform_owner';
}

/**
 * Whether this person hosted this session: credited as its lead host, co-host
 * or guest host through their page, or named as its host directly where the
 * events table has that column (hostArticleOffers.ts reads hosts the same way).
 */
export async function hostedTeaTableSession(db: D1Database, eventId: string, accountId: string, userId: string): Promise<boolean> {
  const credited = await db.prepare(
    `SELECT 1 FROM event_contributors ec JOIN contributors c ON c.id = ec.contributor_id
      WHERE ec.event_id = ? AND ec.account_id = ? AND c.user_id = ? AND ec.role IN ('lead_host', 'co_host', 'guest_host') LIMIT 1`,
  ).bind(eventId, accountId, userId).first();
  if (credited) return true;
  const direct = await db.prepare("SELECT 1 FROM pragma_table_info('events') WHERE name = 'host_user_id'").first();
  return Boolean(direct && await db.prepare('SELECT 1 FROM events WHERE id = ? AND account_id = ? AND host_user_id = ?')
    .bind(eventId, accountId, userId).first());
}

// Use the read gates in the insert itself, so concurrent withdrawal cannot create a new keep or hold.
function visiblePiece(kind: TeaTableKind, idBind: string) {
  return kind === 'tasting'
    ? `SELECT 1 ${TASTING_FROM} WHERE s.journal_entry_id = ${idBind} AND ${TASTING_ON_TABLE}
        AND COALESCE(NULLIF(p.given_name, ''), p.product_name) <> ''`
    : `SELECT 1 FROM events e JOIN accounts a ON a.id = e.account_id WHERE e.id = ${idBind} AND ${RECAP_ON_TABLE}`;
}

export async function setTeaTableKeep(db: D1Database, userId: string, kind: TeaTableKind, id: string, kept: boolean) {
  if (kept) {
    const row = await db.prepare(
      `INSERT INTO tea_table_keeps (user_id, item_kind, item_id) SELECT ?1, ?2, ?3
        WHERE EXISTS (${visiblePiece(kind, '?3')})
        ON CONFLICT(user_id, item_kind, item_id) DO UPDATE SET item_id = excluded.item_id
        RETURNING item_id`,
    ).bind(userId, kind, id).first();
    if (!row) return notFound();
  } else {
    await db.prepare('DELETE FROM tea_table_keeps WHERE user_id = ? AND item_kind = ? AND item_id = ?')
      .bind(userId, kind, id).run();
  }
  return privateJson({ kind, id, kept });
}

export async function takeTastingOffTeaTable(db: D1Database, userId: string, id: string) {
  const share = await db.prepare(
    `SELECT product_id, page_alone_at FROM member_tasting_shares
      WHERE journal_entry_id = ? AND author_user_id = ? AND tea_table_at IS NOT NULL`,
  ).bind(id, userId).first<{ product_id: string; page_alone_at: string | null }>();
  if (!share) return notFound();
  if (!share.page_alone_at) {
    // The Tea Table was the only reason it was public: it goes private everywhere.
    await db.batch(withdrawTastingShare(db, id, userId, share.product_id));
    return privateJson({ kind: 'tasting', id, on_table: false, on_page: false });
  }
  const [, result] = await db.batch([
    db.prepare(`DELETE FROM tea_table_holds WHERE item_kind = 'tasting' AND item_id = ?
      AND EXISTS (SELECT 1 FROM member_tasting_shares WHERE journal_entry_id = ? AND author_user_id = ? AND tea_table_at IS NOT NULL)`)
      .bind(id, id, userId),
    db.prepare(`UPDATE member_tasting_shares SET tea_table_at = NULL, tea_table_sittings = NULL, updated_at = datetime('now')
      WHERE journal_entry_id = ? AND author_user_id = ? AND tea_table_at IS NOT NULL`).bind(id, userId),
  ]);
  return result.meta?.changes ? privateJson({ kind: 'tasting', id, on_table: false, on_page: true }) : notFound();
}

export function isTeaTableHoldDays(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
    && value >= TEA_TABLE_HOLD_DAYS.least && value <= TEA_TABLE_HOLD_DAYS.most;
}

export async function holdTeaTablePiece(db: D1Database, userId: string, kind: TeaTableKind, id: string, days: unknown) {
  if (!isTeaTableHoldDays(days)) {
    return refuse(400, `Hold it for ${TEA_TABLE_HOLD_DAYS.least} to ${TEA_TABLE_HOLD_DAYS.most} days.`, 'validation_failed');
  }
  const row = await db.prepare(
    `INSERT INTO tea_table_holds (item_kind, item_id, held_by, held_until)
     SELECT ?1, ?2, ?3, datetime('now', '+' || ?4 || ' days') WHERE EXISTS (${visiblePiece(kind, '?2')})
     ON CONFLICT(item_kind, item_id) DO UPDATE SET held_by = excluded.held_by, held_until = excluded.held_until
     RETURNING held_until`,
  ).bind(kind, id, userId, days).first<{ held_until: string }>();
  if (!row) return refuse(409, 'Only a piece on the Tea Table can be held at the top.', 'not_on_table');
  return privateJson({ kind, id, held_until: row.held_until });
}

export async function teaTableRecapTarget(db: D1Database, accountId: string, id: string) {
  return db.prepare(`SELECT e.title, (${RECAP_ELIGIBLE} AND e.tea_table_hidden_at IS NULL) AS eligible
    FROM events e JOIN accounts a ON a.id = e.account_id WHERE e.id = ? AND e.account_id = ?`)
    .bind(id, accountId).first<{ title: string; eligible: number }>();
}

export async function setTeaTableRecap(db: D1Database, accountId: string, userId: string, eventId: string, onTable: boolean | null) {
  if (onTable === true) {
    await db.prepare(
      `UPDATE events SET tea_table_at = datetime('now'), tea_table_by = ?
        WHERE id = ? AND account_id = ? AND tea_table_at IS NULL AND tea_table_hidden_at IS NULL
          AND id IN (SELECT e.id FROM events e JOIN accounts a ON a.id = e.account_id WHERE e.id = ? AND ${RECAP_ELIGIBLE})`,
    ).bind(userId, eventId, accountId, eventId).run();
  } else if (onTable === false) {
    await db.batch([
      db.prepare('UPDATE events SET tea_table_at = NULL, tea_table_by = NULL WHERE id = ? AND account_id = ?').bind(eventId, accountId),
      db.prepare(`DELETE FROM tea_table_holds WHERE item_kind = 'recap' AND item_id = ?
        AND EXISTS (SELECT 1 FROM events WHERE id = ? AND account_id = ?)`).bind(eventId, eventId, accountId),
    ]);
  }
  const [eligible, holdRow] = await Promise.all([
    db.prepare(
      `SELECT e.id FROM events e JOIN accounts a ON a.id = e.account_id WHERE e.id = ? AND ${RECAP_ELIGIBLE}`,
    ).bind(eventId).first<{ id: string }>(),
    db.prepare(
      `SELECT held_until FROM tea_table_holds WHERE item_kind = 'recap' AND item_id = ? AND datetime(held_until) > datetime('now')`,
    ).bind(eventId).first<{ held_until: string }>(),
  ]);
  const body: TeaTableRecapState = {
    eligible: Boolean(eligible),
    on_table: Boolean(await teaTablePiece(db, 'recap', eventId)),
    held_until: holdRow?.held_until ?? null,
  };
  if (onTable === true && !body.on_table) {
    return refuse(409, 'A recap goes on the Tea Table once it is published, public and shown on the network.', 'recap_not_eligible');
  }
  return privateJson(body);
}

export async function setTeaTableHidden(db: D1Database, userId: string, kind: TeaTableKind, id: string, hidden: boolean) {
  let change: D1PreparedStatement;
  if (kind === 'tasting') {
    const share = await db.prepare('SELECT account_id FROM member_tasting_shares WHERE journal_entry_id = ?')
      .bind(id).first<{ account_id: string }>();
    if (!share) return notFound();
    change = hidden ? db.prepare(
      `INSERT INTO family_hides (account_id, target_kind, target_id, hidden_by) VALUES (?, 'tasting', ?, ?)
       ON CONFLICT(account_id, target_kind, target_id) DO NOTHING`,
    ).bind(share.account_id, id, userId) : db.prepare(
      "DELETE FROM family_hides WHERE account_id = ? AND target_kind = 'tasting' AND target_id = ?",
    ).bind(share.account_id, id);
  } else {
    change = db.prepare(
      `UPDATE events SET tea_table_hidden_at = ${hidden ? "COALESCE(tea_table_hidden_at, datetime('now'))" : 'NULL'} WHERE id = ?`,
    ).bind(id);
  }
  const [result] = hidden ? await db.batch([
    change,
    db.prepare('DELETE FROM tea_table_holds WHERE item_kind = ? AND item_id = ?').bind(kind, id),
  ]) : [await change.run()];
  if (kind === 'recap' && !result.meta?.changes) return notFound();
  return privateJson({ kind, id, hidden });
}

function normalBefore(value: string | null): string | null | 'bad' {
  if (!value) return null;
  if (value.length > 40) return 'bad';
  const moment = teaTableMoment(value);
  if (Number.isNaN(moment.getTime())) return 'bad';
  return moment.toISOString().slice(0, 19).replace('T', ' ');
}

// ── Routes ──────────────────────────────────────────────────────────────────

export function teaTableRoutes<E extends TeaTableEnv>(deps: TeaTableDeps<E>): [string, string, Handler<E>][] {
  const signedIn = async (request: Request, env: E): Promise<Person | { error: Response }> => {
    if (!teaTableOpen(env)) return { error: notFound() };
    return deps.requireAuthenticatedUser(request, env);
  };

  const platformOwner = async (request: Request, env: E): Promise<Person | { error: Response }> => {
    const person = await signedIn(request, env);
    if ('error' in person) return person;
    if (!(await isTeaTablePlatformOwner(env.DB, person.userId))) return { error: refuse(403, 'Platform owner access required', 'platform_owner_only') };
    return person;
  };

  /**
   * The event, when the caller may act for it: the platform owner, or a host of
   * this session acting for its shop (gather in the event's shop). Holding
   * gather or publish in the shop is not enough on its own (A4 review, finding 7).
   */
  const hostOf = async (request: Request, env: E, eventId: string): Promise<{ userId: string; accountId: string } | { error: Response }> => {
    const person = await signedIn(request, env);
    if ('error' in person) return person;
    const event = await env.DB.prepare('SELECT id, account_id FROM events WHERE id = ?').bind(eventId).first<{ id: string; account_id: string }>();
    if (!event) return { error: notFound() };
    if (await isTeaTablePlatformOwner(env.DB, person.userId)) return { userId: person.userId, accountId: event.account_id };
    const shop = await deps.requireBundle(request, env, 'gather');
    if ('error' in shop) return shop;
    // A host acts only for sessions of their own shop.
    if (shop.accountId !== event.account_id) return { error: notFound() };
    if (!(await hostedTeaTableSession(env.DB, event.id, event.account_id, person.userId))) {
      return { error: refuse(403, 'Only a host of this session can do that.', 'not_host') };
    }
    return { userId: person.userId, accountId: event.account_id };
  };

  // GET /api/tea-table?show=all|tastings|sessions&before=<moment>. Public, and the same for everyone.
  const list: Handler<E> = async (request, env) => {
    if (!teaTableOpen(env)) return notFound();
    const url = new URL(request.url);
    const showParam = url.searchParams.get('show') || 'all';
    if (!(TEA_TABLE_SHOWS as readonly string[]).includes(showParam)) return refuse(400, 'Unknown view.', 'validation_failed');
    const before = normalBefore(url.searchParams.get('before'));
    if (before === 'bad') return refuse(400, 'Unknown date.', 'validation_failed');
    return json(await readTeaTable(env.DB, showParam as TeaTableShow, before));
  };

  // GET /api/tea-table/me: the caller's kept pieces, and which pieces are theirs to take off.
  const mine: Handler<E> = async (request, env) => {
    const person = await signedIn(request, env);
    if ('error' in person) return person.error;
    const [keeps, own] = await Promise.all([
      env.DB.prepare(
        `SELECT item_kind AS kind, item_id AS id FROM tea_table_keeps WHERE user_id = ? ORDER BY created_at DESC, item_id LIMIT ?`,
      ).bind(person.userId, MOST_KEPT).all<{ kind: TeaTableKind; id: string }>(),
      env.DB.prepare(
        `SELECT DISTINCT s.journal_entry_id AS id
         ${TASTING_FROM}
         WHERE s.author_user_id = ? AND ${TASTING_ON_TABLE}`,
      ).bind(person.userId).all<{ id: string }>(),
    ]);
    const body: TeaTableMine = {
      kept: await readByIds(env.DB, (keeps.results ?? []).filter(row => isTeaTableKind(row.kind))),
      mine: (own.results ?? []).map(row => teaTableKey({ kind: 'tasting', id: row.id })),
    };
    return privateJson(body);
  };

  // PUT and DELETE /api/tea-table/keeps/:kind/:id: the private keep. The answer never says how many.
  const keep = (kept: boolean): Handler<E> => async (request, env, { kind, id }) => {
    const person = await signedIn(request, env);
    if ('error' in person) return person.error;
    if (!isTeaTableKind(kind)) return notFound();
    return setTeaTableKeep(env.DB, person.userId, kind, id, kept);
  };

  // DELETE /api/tea-table/mine/tasting/:id: the author takes their tasting off the table. It stays on
  // their page only when they had chosen their page by itself; otherwise it goes private everywhere.
  const takeOff: Handler<E> = async (request, env, { id }) => {
    const person = await signedIn(request, env);
    if ('error' in person) return person.error;
    return takeTastingOffTeaTable(env.DB, person.userId, id);
  };

  // PUT and DELETE /api/tea-table/holds/:kind/:id { days }: hold a piece at the top for a while, or let it go.
  // A host holds only their own session's recap; the platform owner holds any piece.
  const hold = (holding: boolean): Handler<E> => async (request, env, { kind, id }) => {
    if (!isTeaTableKind(kind)) return notFound();
    let who: { userId: string };
    if (kind === 'recap') {
      const host = await hostOf(request, env, id);
      if ('error' in host) return host.error;
      who = host;
    } else {
      const owner = await platformOwner(request, env);
      if ('error' in owner) return owner.error;
      who = owner;
    }
    if (!holding) {
      await env.DB.prepare('DELETE FROM tea_table_holds WHERE item_kind = ? AND item_id = ?').bind(kind, id).run();
      return privateJson({ kind, id, held_until: null });
    }
    const body = await request.json().catch(() => ({})) as { days?: unknown } | null;
    const days = body?.days === undefined ? TEA_TABLE_HOLD_DAYS.usual : body.days;
    return holdTeaTablePiece(env.DB, who.userId, kind, id, days);
  };

  // GET, PUT and DELETE /api/admin/tea-table/recaps/:eventId: the host puts their published recap on the table, or takes it off.
  const recap: Handler<E> = async (request, env, { eventId }) => {
    const host = await hostOf(request, env, eventId);
    if ('error' in host) return host.error;
    const onTable = request.method === 'GET' ? null : request.method === 'PUT';
    return setTeaTableRecap(env.DB, host.accountId, host.userId, eventId, onTable);
  };

  // GET /api/admin/tea-table: every piece put on the table, hidden ones too, with its keeps. The platform owner alone.
  const manage: Handler<E> = async (request, env) => {
    const owner = await platformOwner(request, env);
    if ('error' in owner) return owner.error;
    const keepsOf = (kind: TeaTableKind, id: string) =>
      `(SELECT COUNT(*) FROM tea_table_keeps k WHERE k.item_kind = '${kind}' AND k.item_id = ${id}) AS keeps`;
    const holdOf = (kind: TeaTableKind, id: string) =>
      `(SELECT held_until FROM tea_table_holds th WHERE th.item_kind = '${kind}' AND th.item_id = ${id}
          AND datetime(th.held_until) > datetime('now')) AS held_until`;
    const [tastings, recaps] = await env.DB.batch([
      env.DB.prepare(
        `SELECT s.journal_entry_id AS id, s.tea_table_at AS at,
                COALESCE(NULLIF(p.given_name, ''), p.product_name) AS title, c.display_name AS by, c.id AS page_id,
                (${TASTING_ON_TABLE}) AS showing, NOT ${TASTING_NOT_HIDDEN} AS hidden,
                ${keepsOf('tasting', 's.journal_entry_id')}, ${holdOf('tasting', 's.journal_entry_id')}
         ${TASTING_FROM}
         WHERE s.tea_table_at IS NOT NULL
         ORDER BY datetime(s.tea_table_at) DESC LIMIT 200`,
      ),
      env.DB.prepare(
        `SELECT e.id, e.slug, e.tea_table_at AS at, e.title, a.name AS by,
                (${RECAP_ON_TABLE}) AS showing, e.tea_table_hidden_at IS NOT NULL AS hidden,
                ${keepsOf('recap', 'e.id')}, ${holdOf('recap', 'e.id')}
           FROM events e JOIN accounts a ON a.id = e.account_id
          WHERE e.tea_table_at IS NOT NULL
          ORDER BY datetime(e.tea_table_at) DESC LIMIT 200`,
      ),
    ]);
    type Row = { id: string; at: string; title: string | null; by: string | null; hidden: number; showing: number; keeps: number; held_until: string | null; page_id?: string; slug?: string };
    const items: TeaTableManageItem[] = [
      ...((tastings.results ?? []) as Row[]).map(row => ({
        kind: 'tasting' as const, id: row.id, at: row.at, title: row.title ?? 'A tasting', by: row.by,
        path: `/people/${encodeURIComponent(row.page_id ?? '')}`, hidden: Boolean(row.hidden), showing: Boolean(row.showing), held_until: row.held_until, keeps: Number(row.keeps),
      })),
      ...((recaps.results ?? []) as Row[]).map(row => ({
        kind: 'recap' as const, id: row.id, at: row.at, title: row.title ?? 'A session', by: row.by,
        path: recapPath(row.slug ?? ''), hidden: Boolean(row.hidden), showing: Boolean(row.showing), held_until: row.held_until, keeps: Number(row.keeps),
      })),
    ].sort((a, b) => teaTableMoment(b.at).getTime() - teaTableMoment(a.at).getTime());
    return privateJson({ items });
  };

  // POST /api/admin/tea-table/hide { kind, id, hidden }: the platform owner's hand on any piece, and back.
  // A hidden tasting is hidden everywhere the family shows it, as the shop's own hide is.
  const hide: Handler<E> = async (request, env) => {
    const owner = await platformOwner(request, env);
    if ('error' in owner) return owner.error;
    const body = await request.json().catch(() => null) as { kind?: unknown; id?: unknown; hidden?: unknown } | null;
    if (!body || !isTeaTableKind(body.kind) || typeof body.id !== 'string' || typeof body.hidden !== 'boolean') {
      return refuse(400, 'Say what to hide.', 'validation_failed');
    }
    return setTeaTableHidden(env.DB, owner.userId, body.kind, body.id, body.hidden);
  };

  return [
    ['GET', '/api/tea-table', list],
    ['GET', '/api/tea-table/me', mine],
    ['PUT', '/api/tea-table/keeps/:kind/:id', keep(true)],
    ['DELETE', '/api/tea-table/keeps/:kind/:id', keep(false)],
    ['DELETE', '/api/tea-table/mine/tasting/:id', takeOff],
    ['PUT', '/api/tea-table/holds/:kind/:id', hold(true)],
    ['DELETE', '/api/tea-table/holds/:kind/:id', hold(false)],
    ['GET', '/api/admin/tea-table', manage],
    ['POST', '/api/admin/tea-table/hide', hide],
    ['GET', '/api/admin/tea-table/recaps/:eventId', recap],
    ['PUT', '/api/admin/tea-table/recaps/:eventId', recap],
    ['DELETE', '/api/admin/tea-table/recaps/:eventId', recap],
  ];
}

/** Statements that clear a person's keeps and holds before their account is deleted (familyErasure.ts). */
export function teaTableErasureStatements(db: D1Database, userId: string): D1PreparedStatement[] {
  return [
    db.prepare(`DELETE FROM tea_table_holds WHERE held_by = ?`).bind(userId),
    db.prepare(`DELETE FROM tea_table_holds WHERE item_kind = 'tasting' AND item_id IN
      (SELECT journal_entry_id FROM member_tasting_shares WHERE author_user_id = ?)`).bind(userId),
    db.prepare(`DELETE FROM tea_table_keeps WHERE item_kind = 'tasting' AND item_id IN
      (SELECT journal_entry_id FROM member_tasting_shares WHERE author_user_id = ?)`).bind(userId),
    db.prepare(`DELETE FROM tea_table_keeps WHERE user_id = ?`).bind(userId),
  ];
}
