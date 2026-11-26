/**
 * "Does anyone know this tea?" on the Tea Table (Launch 5, M8; the switch and
 * the reasons are in src/lib/knowThisTea.ts; the shapes in
 * src/lib/knowThisTeaContract.ts).
 *
 * A signed-in person puts one photograph of a tea they cannot name on the
 * table, with a line about where they got it. It sits in the table's time
 * order like every other piece (teaTable.ts reads it through
 * readTableQuestions), and is never held or kept: those tables name their
 * kinds, and a question is not one of them.
 *
 * Privacy, the whole of it:
 * - What someone writes to the asker is read by one route,
 *   GET /api/tea-table/questions/:id/asked, and only for the asker. Anyone
 *   else, and the asker once the question is taken off or hidden, gets the
 *   same 404 an absent question gets.
 * - No answer anywhere says how many people wrote. Nothing is sent: no
 *   message, no mail, no notice. The asker sees what came when they look.
 * - Writing to a question that is taken off, hidden, named or absent gets
 *   that same 404, so a closed question cannot be told from one that never was.
 * - The piece shows "Named by" a first name only when the asker thanked that
 *   person and that person said their first name may show.
 *
 * The asker takes their question off; its photograph files go with it. The
 * platform owner hides any question, and can bring it back. Its photograph is
 * served by /api/media only while the question is on the table (familyMedia.ts).
 */
import { checkPhoto, sameShape } from './familyRoutes';
import { isTeaTablePlatformOwner } from './teaTable';
import { QUESTION_PHOTO_KEY_PREFIX } from './familyMedia';
import { teaTableOpen } from '../../src/lib/teaTable';
import { KNOW_THIS_TEA_LIMITS, KNOW_THIS_TEA_MOST, knowThisTeaOpen } from '../../src/lib/knowThisTea';
import {
  FAMILY_FULL_LONG_EDGE, FAMILY_FULL_MAX_BYTES, FAMILY_PHOTO_TYPE, FAMILY_SMALL_LONG_EDGE, FAMILY_SMALL_MAX_BYTES,
  type FamilyPhotographShape,
} from '../../src/lib/familyContract';
import type { KnowThisTeaAsked, KnowThisTeaManageItem, KnowThisTeaNote, TeaTableQuestion } from '../../src/lib/knowThisTeaContract';

export type KnowThisTeaEnv = {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  TEA_TABLE_OPEN?: string;
  KNOW_THIS_TEA_OPEN?: string;
};
type Person = { userId: string; name?: string };
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
export interface KnowThisTeaDeps<E> {
  requireAuthenticatedUser(request: Request, env: E): Promise<Person | { error: Response }>;
}

const MEDIA_PREFIX = 'https://media.teajia.co/';
const MULTIPART_ALLOWANCE = 64 * 1024;
const NOTES_PER_DAY = 20;

const privateJson = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
const publicJson = (value: unknown) => Response.json(value, { headers: { 'Cache-Control': 'no-store' } });
const refuse = (status: number, error: string, code: string) => privateJson({ error, code }, status);
/** The one answer for absent, closed and not yours. */
const notFound = () => refuse(404, 'Not found', 'not_found');

/** Both switches: the Tea Table, and this slice on it. */
export const questionsOpen = (env: { TEA_TABLE_OPEN?: string; KNOW_THIS_TEA_OPEN?: string }) => teaTableOpen(env) && knowThisTeaOpen(env);

const chars = (value: string) => [...value].length;
function cleanText(value: unknown, most: number): string | null | 'too_long' {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\r\n?/g, '\n').trim();
  if (!text) return null;
  return chars(text) > most ? 'too_long' : text;
}
const firstName = (value: string | null | undefined) => (value ?? '').trim().split(/\s+/)[0] || null;

function shapeOf(width: number, height: number): FamilyPhotographShape {
  const ratio = width / height;
  if (ratio > 1.1) return 'across';
  if (ratio < 0.9) return 'upright';
  return 'square';
}

// ── The SQL gates ───────────────────────────────────────────────────────────

/** A question on the table now. Needs q (tea_table_questions). */
const QUESTION_SHOWING = 'q.taken_off_at IS NULL AND q.hidden_at IS NULL';
/** A tea in the shop. Needs p (products) and a (accounts). */
const IN_THE_SHOP = `p.is_public = 1 AND p.shown_in_shop = 1 AND p.status IN ('Active', 'Sold Out')
  AND a.status = 'active' AND a.public_enabled = 1`;
const teaPath = (row: { slug: string | null; id: string; account_slug: string }) =>
  `/shop/product/${encodeURIComponent(row.slug || row.id)}?store=${encodeURIComponent(row.account_slug)}`;

/** The asker's published page, when they have one that is not hidden. */
const ASKER_PAGE = `(SELECT c.id FROM contributors c WHERE c.user_id = q.asker_user_id AND c.is_published = 1
  AND NOT EXISTS (SELECT 1 FROM family_hides fh WHERE fh.target_kind = 'page' AND fh.target_id = c.id AND fh.account_id = c.account_id)
  ORDER BY c.id LIMIT 1)`;

const QUESTION_SELECT = `
  SELECT q.id, q.asked_at AS at, q.where_from, q.small_key, q.full_key, q.small_width, q.small_height, q.shape,
         q.named_name, q.named_at, q.asker_user_id,
         u.name AS asker_name, pc.id AS page_id, pc.display_name AS page_name,
         np.id AS named_id, np.slug AS named_slug, na.slug AS named_account_slug,
         CASE WHEN tn.name_shown = 1 THEN tu.name END AS thanked_name
    FROM tea_table_questions q
    JOIN users u ON u.id = q.asker_user_id
    LEFT JOIN contributors pc ON pc.id = ${ASKER_PAGE}
    LEFT JOIN (SELECT p.id, p.slug, p.account_id FROM products p JOIN accounts a ON a.id = p.account_id WHERE ${IN_THE_SHOP}) np
      ON np.id = q.named_product_id
    LEFT JOIN accounts na ON na.id = np.account_id
    LEFT JOIN tea_table_question_notes tn ON tn.id = q.thanked_note_id AND tn.question_id = q.id AND q.named_name IS NOT NULL
    LEFT JOIN users tu ON tu.id = tn.writer_user_id`;

type QuestionRow = {
  id: string; at: string; where_from: string; small_key: string; full_key: string; small_width: number; small_height: number;
  shape: string; named_name: string | null; named_at: string | null; asker_user_id: string;
  asker_name: string | null; page_id: string | null; page_name: string | null;
  named_id: string | null; named_slug: string | null; named_account_slug: string | null; thanked_name: string | null;
};

function toQuestion(row: QuestionRow): TeaTableQuestion {
  const pageName = (row.page_name ?? '').trim();
  return {
    kind: 'question',
    id: row.id,
    at: row.at,
    person: pageName && row.page_id
      ? { name: pageName, path: `/people/${encodeURIComponent(row.page_id)}` }
      : { name: firstName(row.asker_name) ?? 'Someone at the table', path: null },
    where_from: row.where_from,
    photograph: {
      id: row.id,
      small_url: MEDIA_PREFIX + row.small_key,
      full_url: MEDIA_PREFIX + row.full_key,
      small_width: Number(row.small_width),
      small_height: Number(row.small_height),
      shape: row.shape === 'upright' || row.shape === 'across' ? row.shape : 'square',
      frame: null,
    },
    named: row.named_name ? {
      name: row.named_name,
      path: row.named_id && row.named_account_slug ? teaPath({ id: row.named_id, slug: row.named_slug, account_slug: row.named_account_slug }) : null,
      by: firstName(row.thanked_name),
    } : null,
  };
}

// ── Reading ─────────────────────────────────────────────────────────────────

/** Questions on the table, newest first, for teaTable.ts to merge into its time order. */
export async function readTableQuestions(db: D1Database, filter: { before?: { at: string; key: string | null } | null; limit: number }): Promise<TeaTableQuestion[]> {
  const binds: unknown[] = [];
  let before = '';
  // The Tea Table's cursor (teaTable.ts, TeaTableCursor): older moments, and at the same moment a lower key.
  if (filter.before?.key) {
    before = " AND (datetime(q.asked_at) < datetime(?) OR (datetime(q.asked_at) = datetime(?) AND ('question:' || q.id) < ?))";
    binds.push(filter.before.at, filter.before.at, filter.before.key);
  } else if (filter.before) { before = ' AND datetime(q.asked_at) < datetime(?)'; binds.push(filter.before.at); }
  const { results } = await db.prepare(
    `${QUESTION_SELECT} WHERE ${QUESTION_SHOWING}${before} ORDER BY datetime(q.asked_at) DESC, ('question:' || q.id) DESC LIMIT ?`,
  ).bind(...binds, filter.limit).all<QuestionRow>();
  return (results ?? []).map(toQuestion);
}

async function readQuestionRow(db: D1Database, id: string): Promise<QuestionRow | null> {
  return db.prepare(`${QUESTION_SELECT} WHERE q.id = ? AND ${QUESTION_SHOWING}`).bind(id).first<QuestionRow>();
}

/** `question:id` keys of the caller's own questions on the table, for GET /api/tea-table/me. */
export async function ownQuestionKeys(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db.prepare(
    `SELECT q.id FROM tea_table_questions q WHERE q.asker_user_id = ? AND ${QUESTION_SHOWING} ORDER BY q.asked_at DESC LIMIT 50`,
  ).bind(userId).all<{ id: string }>();
  return (results ?? []).map(row => `question:${row.id}`);
}

/**
 * A tea in the shop from a link to it: a full address, or a path like
 * /shop/product/<tea>?store=<shop>. Null when nothing was given; 'unknown'
 * when it is not a tea in the shop.
 */
export async function shopTeaFromLink(db: D1Database, value: unknown): Promise<{ id: string; name: string; path: string } | null | 'unknown'> {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 400) return 'unknown';
  let url: URL;
  try { url = new URL(value.trim(), 'https://teajia.co'); } catch { return 'unknown'; }
  const match = url.pathname.match(/^\/shop\/product\/([^/]+)\/?$/);
  if (!match) return 'unknown';
  let key: string;
  try { key = decodeURIComponent(match[1]); } catch { return 'unknown'; }
  const store = url.searchParams.get('store');
  const { results } = await db.prepare(
    `SELECT p.id, p.slug, COALESCE(NULLIF(p.given_name, ''), p.product_name) AS name, a.slug AS account_slug
       FROM products p JOIN accounts a ON a.id = p.account_id
      WHERE (p.slug = ?1 OR p.id = ?1) AND (?2 IS NULL OR a.slug = ?2) AND ${IN_THE_SHOP}
      LIMIT 2`,
  ).bind(key, store).all<{ id: string; slug: string | null; name: string | null; account_slug: string }>();
  const rows = results ?? [];
  if (rows.length !== 1 || !rows[0].name) return 'unknown';
  return { id: rows[0].id, name: rows[0].name, path: teaPath(rows[0]) };
}

async function readNotes(db: D1Database, question: QuestionRow): Promise<KnowThisTeaNote[]> {
  const thanked = await db.prepare('SELECT thanked_note_id FROM tea_table_questions WHERE id = ?')
    .bind(question.id).first<{ thanked_note_id: string | null }>();
  const { results } = await db.prepare(
    `SELECT n.id, n.updated_at AS at, n.words, n.name_shown, u.name AS writer_name,
            tp.id AS tea_id, tp.slug AS tea_slug, tp.name AS tea_name, tp.account_slug AS tea_account_slug
       FROM tea_table_question_notes n
       JOIN users u ON u.id = n.writer_user_id
       LEFT JOIN (SELECT p.id, p.slug, COALESCE(NULLIF(p.given_name, ''), p.product_name) AS name, a.slug AS account_slug
                    FROM products p JOIN accounts a ON a.id = p.account_id WHERE ${IN_THE_SHOP}) tp ON tp.id = n.product_id
      WHERE n.question_id = ?
      ORDER BY datetime(n.created_at), n.rowid`,
  ).bind(question.id).all<{
    id: string; at: string; words: string; name_shown: number; writer_name: string | null;
    tea_id: string | null; tea_slug: string | null; tea_name: string | null; tea_account_slug: string | null;
  }>();
  return (results ?? []).map(row => ({
    id: row.id,
    at: row.at,
    by: firstName(row.writer_name) ?? 'Someone at the table',
    words: row.words,
    tea: row.tea_id && row.tea_name && row.tea_account_slug
      ? { name: row.tea_name, path: teaPath({ id: row.tea_id, slug: row.tea_slug, account_slug: row.tea_account_slug }) }
      : null,
    name_shown: Number(row.name_shown) === 1,
    thanked: thanked?.thanked_note_id === row.id && Boolean(question.named_name),
  }));
}

// ── Writing ─────────────────────────────────────────────────────────────────

/** Asking: one photograph, both sizes made on the phone, and where the tea came from. */
async function ask(env: KnowThisTeaEnv, person: Person, request: Request): Promise<Response> {
  if (!env.MEDIA_BUCKET) return refuse(503, 'Photographs cannot be stored right now.', 'storage_unavailable');
  const known = await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(person.userId).first();
  if (!known) return refuse(403, 'Sign in with your own account to ask.', 'person_only');
  if (!(request.headers.get('Content-Type') || '').includes('multipart/form-data')) {
    return refuse(400, 'Expected multipart/form-data', 'invalid_content_type');
  }
  const declared = Number(request.headers.get('content-length') || '0');
  if (declared > FAMILY_FULL_MAX_BYTES + FAMILY_SMALL_MAX_BYTES + MULTIPART_ALLOWANCE) {
    return refuse(413, 'That photograph is too big.', 'upload_too_large');
  }
  let form: FormData;
  try { form = await request.formData(); } catch { return refuse(400, 'The photograph did not arrive whole.', 'invalid_form'); }
  const whereFrom = cleanText(form.get('where_from'), KNOW_THIS_TEA_LIMITS.whereFrom);
  if (!whereFrom) return refuse(400, 'Say where you got the tea.', 'where_from_missing');
  if (whereFrom === 'too_long') return refuse(400, `Keep where you got it to ${KNOW_THIS_TEA_LIMITS.whereFrom} characters.`, 'where_from_too_long');
  const full = await checkPhoto(form.get('full'), 'large', FAMILY_FULL_MAX_BYTES, FAMILY_FULL_LONG_EDGE);
  if (full instanceof Response) return full;
  const small = await checkPhoto(form.get('small'), 'small', FAMILY_SMALL_MAX_BYTES, FAMILY_SMALL_LONG_EDGE);
  if (small instanceof Response) return small;
  if (!sameShape(full, small)) return refuse(422, 'The two copies of the photograph do not match.', 'photo_sizes_do_not_match');

  const id = crypto.randomUUID();
  const base = `${QUESTION_PHOTO_KEY_PREFIX}${id}`;
  const fullKey = `${base}-full.jpg`;
  const smallKey = `${base}-small.jpg`;
  const metadata = { customMetadata: { author_user_id: person.userId }, httpMetadata: { contentType: FAMILY_PHOTO_TYPE } };
  await env.MEDIA_BUCKET.put(fullKey, full.bytes, metadata);
  await env.MEDIA_BUCKET.put(smallKey, small.bytes, metadata);
  let changes = 0;
  try {
    // The limits are checked inside the insert, so two questions sent at once cannot both pass.
    const result = await env.DB.prepare(
      `INSERT INTO tea_table_questions (id, asker_user_id, where_from, full_key, small_key, small_width, small_height, shape)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8
        WHERE (SELECT COUNT(*) FROM tea_table_questions WHERE asker_user_id = ?2 AND taken_off_at IS NULL AND hidden_at IS NULL) < ?9
          AND (SELECT COUNT(*) FROM tea_table_questions WHERE asker_user_id = ?2 AND asked_at >= datetime('now', '-1 day')) < ?10`,
    ).bind(
      id, person.userId, whereFrom, fullKey, smallKey, small.width, small.height, shapeOf(full.width, full.height),
      KNOW_THIS_TEA_MOST.open, KNOW_THIS_TEA_MOST.perDay,
    ).run();
    changes = Number(result.meta?.changes ?? 0);
  } finally {
    if (!changes) {
      await env.MEDIA_BUCKET.delete(fullKey);
      await env.MEDIA_BUCKET.delete(smallKey);
    }
  }
  if (!changes) {
    return refuse(429, `You can have ${KNOW_THIS_TEA_MOST.open} questions on the table, and ask ${KNOW_THIS_TEA_MOST.perDay} in a day. Take one off, or ask tomorrow.`, 'question_limit');
  }
  const row = await readQuestionRow(env.DB, id);
  return privateJson({ question: toQuestion(row!) }, 201);
}

/** The asker takes their question off. Its photograph files go with it, and what people wrote can no longer be read. */
async function takeOff(env: KnowThisTeaEnv, person: Person, id: string): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT full_key, small_key FROM tea_table_questions WHERE id = ? AND asker_user_id = ? AND taken_off_at IS NULL`,
  ).bind(id, person.userId).first<{ full_key: string; small_key: string }>();
  if (!row) return notFound();
  const result = await env.DB.prepare(
    `UPDATE tea_table_questions SET taken_off_at = datetime('now') WHERE id = ? AND asker_user_id = ? AND taken_off_at IS NULL`,
  ).bind(id, person.userId).run();
  if (!result.meta?.changes) return notFound();
  if (env.MEDIA_BUCKET) {
    await env.MEDIA_BUCKET.delete(row.full_key);
    await env.MEDIA_BUCKET.delete(row.small_key);
  }
  return privateJson({ kind: 'question', id, on_table: false });
}

/** Someone tells the asker what the tea is. One note each; writing again replaces it. */
async function tell(env: KnowThisTeaEnv, person: Person, id: string, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as { words?: unknown; tea?: unknown; name_shown?: unknown } | null;
  const question = await env.DB.prepare(
    `SELECT q.asker_user_id FROM tea_table_questions q WHERE q.id = ? AND ${QUESTION_SHOWING} AND q.named_name IS NULL`,
  ).bind(id).first<{ asker_user_id: string }>();
  if (!question) return notFound();
  if (question.asker_user_id === person.userId) return refuse(409, 'This is your own question.', 'own_question');
  const known = await env.DB.prepare('SELECT 1 FROM users WHERE id = ?').bind(person.userId).first();
  if (!known) return refuse(403, 'Sign in with your own account to tell them.', 'person_only');
  const words = cleanText(body?.words, KNOW_THIS_TEA_LIMITS.words);
  if (!words) return refuse(400, 'Say what you know about the tea.', 'words_missing');
  if (words === 'too_long') return refuse(400, `Keep it to ${KNOW_THIS_TEA_LIMITS.words} characters.`, 'words_too_long');
  const tea = await shopTeaFromLink(env.DB, body?.tea);
  if (tea === 'unknown') return refuse(400, 'That link is not a tea in the shop.', 'tea_not_in_shop');
  if (body?.name_shown !== undefined && typeof body.name_shown !== 'boolean') return refuse(400, 'Say yes or no to your name.', 'validation_failed');
  const row = await env.DB.prepare(
    `INSERT INTO tea_table_question_notes (id, question_id, writer_user_id, words, product_id, name_shown)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6
      WHERE EXISTS (SELECT 1 FROM tea_table_questions q WHERE q.id = ?2 AND ${QUESTION_SHOWING} AND q.named_name IS NULL)
        AND (SELECT COUNT(*) FROM tea_table_question_notes WHERE writer_user_id = ?3 AND updated_at >= datetime('now', '-1 day')) < ?7
     ON CONFLICT (question_id, writer_user_id) DO UPDATE
       SET words = excluded.words, product_id = excluded.product_id, name_shown = excluded.name_shown, updated_at = datetime('now')
     RETURNING id`,
  ).bind(crypto.randomUUID(), id, person.userId, words, tea?.id ?? null, body?.name_shown === true ? 1 : 0, NOTES_PER_DAY).first();
  if (!row) {
    const still = await env.DB.prepare(`SELECT 1 FROM tea_table_questions q WHERE q.id = ? AND ${QUESTION_SHOWING} AND q.named_name IS NULL`).bind(id).first();
    return still ? refuse(429, 'That is as much as one day takes. Write again tomorrow.', 'note_limit') : notFound();
  }
  // Nothing is counted and nothing is sent: the answer says only that it is with them.
  return privateJson({ told: true });
}

/** The asker marks the question named, with the tea in the shop when it is there. */
async function name(env: KnowThisTeaEnv, person: Person, id: string, request: Request): Promise<Response> {
  const body = await request.json().catch(() => null) as { name?: unknown; tea?: unknown } | null;
  const owned = await env.DB.prepare(`SELECT 1 FROM tea_table_questions q WHERE q.id = ? AND q.asker_user_id = ? AND ${QUESTION_SHOWING}`)
    .bind(id, person.userId).first();
  if (!owned) return notFound();
  const tea = await shopTeaFromLink(env.DB, body?.tea);
  if (tea === 'unknown') return refuse(400, 'That link is not a tea in the shop.', 'tea_not_in_shop');
  let teaName = cleanText(body?.name, KNOW_THIS_TEA_LIMITS.teaName);
  if (teaName === 'too_long') return refuse(400, `Keep the name to ${KNOW_THIS_TEA_LIMITS.teaName} characters.`, 'name_too_long');
  if (!teaName && tea) teaName = chars(tea.name) <= KNOW_THIS_TEA_LIMITS.teaName ? tea.name : null;
  if (!teaName) return refuse(400, 'Say what the tea is.', 'name_missing');
  await env.DB.prepare(
    `UPDATE tea_table_questions SET named_name = ?, named_product_id = ?, named_at = datetime('now')
      WHERE id = ? AND asker_user_id = ? AND taken_off_at IS NULL AND hidden_at IS NULL`,
  ).bind(teaName, tea?.id ?? null, id, person.userId).run();
  const row = await readQuestionRow(env.DB, id);
  return row ? privateJson({ question: toQuestion(row) }) : notFound();
}

async function unname(env: KnowThisTeaEnv, person: Person, id: string): Promise<Response> {
  const result = await env.DB.prepare(
    `UPDATE tea_table_questions SET named_name = NULL, named_product_id = NULL, named_at = NULL, thanked_note_id = NULL
      WHERE id = ? AND asker_user_id = ? AND taken_off_at IS NULL AND hidden_at IS NULL`,
  ).bind(id, person.userId).run();
  if (!result.meta?.changes) return notFound();
  const row = await readQuestionRow(env.DB, id);
  return row ? privateJson({ question: toQuestion(row) }) : notFound();
}

/** The asker thanks the person who named it: "Named by" their first name, when they allowed it. */
async function thank(env: KnowThisTeaEnv, person: Person, id: string, request: Request, thanking: boolean): Promise<Response> {
  const owned = await env.DB.prepare(
    `SELECT q.named_name FROM tea_table_questions q WHERE q.id = ? AND q.asker_user_id = ? AND ${QUESTION_SHOWING}`,
  ).bind(id, person.userId).first<{ named_name: string | null }>();
  if (!owned) return notFound();
  if (!thanking) {
    await env.DB.prepare('UPDATE tea_table_questions SET thanked_note_id = NULL WHERE id = ? AND asker_user_id = ?').bind(id, person.userId).run();
  } else {
    if (!owned.named_name) return refuse(409, 'Mark it named first.', 'not_named');
    const body = await request.json().catch(() => null) as { note_id?: unknown } | null;
    if (typeof body?.note_id !== 'string') return refuse(400, 'Say whom to thank.', 'validation_failed');
    const note = await env.DB.prepare('SELECT name_shown FROM tea_table_question_notes WHERE id = ? AND question_id = ?')
      .bind(body.note_id, id).first<{ name_shown: number }>();
    if (!note) return notFound();
    if (Number(note.name_shown) !== 1) return refuse(409, 'They asked for their name not to show.', 'name_not_shown');
    await env.DB.prepare('UPDATE tea_table_questions SET thanked_note_id = ? WHERE id = ? AND asker_user_id = ? AND named_name IS NOT NULL')
      .bind(body.note_id, id, person.userId).run();
  }
  const row = await readQuestionRow(env.DB, id);
  return row ? privateJson({ question: toQuestion(row) }) : notFound();
}

// ── Routes ──────────────────────────────────────────────────────────────────

export function knowThisTeaRoutes<E extends KnowThisTeaEnv>(deps: KnowThisTeaDeps<E>): [string, string, Handler<E>][] {
  const signedIn = async (request: Request, env: E): Promise<Person | { error: Response }> => {
    if (!questionsOpen(env)) return { error: notFound() };
    return deps.requireAuthenticatedUser(request, env);
  };
  const platformOwner = async (request: Request, env: E): Promise<Person | { error: Response }> => {
    const person = await signedIn(request, env);
    if ('error' in person) return person;
    if (!(await isTeaTablePlatformOwner(env.DB, person.userId))) return { error: refuse(403, 'Platform owner access required', 'platform_owner_only') };
    return person;
  };
  const withPerson = (act: (env: E, person: Person, id: string, request: Request) => Promise<Response>): Handler<E> =>
    async (request, env, { id }) => {
      const person = await signedIn(request, env);
      if ('error' in person) return person.error;
      return act(env, person, id, request);
    };

  // GET /api/tea-table/questions/:id: one question on the table. Public, and the same for everyone.
  const one: Handler<E> = async (_request, env, { id }) => {
    if (!questionsOpen(env)) return notFound();
    const row = await readQuestionRow(env.DB, id);
    return row ? publicJson({ question: toQuestion(row) }) : notFound();
  };

  // GET /api/tea-table/questions/:id/asked: what people told the asker. The asker alone; for anyone else,
  // and for a question taken off or hidden, the same 404 as a question that never was.
  const asked = withPerson(async (env, person, id) => {
    const row = await readQuestionRow(env.DB, id);
    if (!row || row.asker_user_id !== person.userId) return notFound();
    const body: KnowThisTeaAsked = { question: toQuestion(row), notes: await readNotes(env.DB, row) };
    return privateJson(body);
  });

  // GET /api/admin/tea-table/questions: every question, hidden and taken off too. The platform owner alone.
  const manage: Handler<E> = async (request, env) => {
    const owner = await platformOwner(request, env);
    if ('error' in owner) return owner.error;
    const { results } = await env.DB.prepare(
      `SELECT q.id, q.asked_at AS at, q.where_from, q.named_name, q.hidden_at, q.taken_off_at, u.name AS asker_name
         FROM tea_table_questions q JOIN users u ON u.id = q.asker_user_id
        ORDER BY datetime(q.asked_at) DESC LIMIT 200`,
    ).all<{ id: string; at: string; where_from: string; named_name: string | null; hidden_at: string | null; taken_off_at: string | null; asker_name: string | null }>();
    const items: KnowThisTeaManageItem[] = (results ?? []).map(row => ({
      id: row.id, at: row.at, by: firstName(row.asker_name) ?? 'Someone at the table', where_from: row.where_from,
      named: row.named_name, hidden: Boolean(row.hidden_at), showing: !row.hidden_at && !row.taken_off_at,
    }));
    return privateJson({ items });
  };

  // POST /api/admin/tea-table/questions/:id/hide { hidden }: the platform owner's hand on any question, and back.
  const hide: Handler<E> = async (request, env, { id }) => {
    const owner = await platformOwner(request, env);
    if ('error' in owner) return owner.error;
    const body = await request.json().catch(() => null) as { hidden?: unknown } | null;
    if (typeof body?.hidden !== 'boolean') return refuse(400, 'Say whether to hide it.', 'validation_failed');
    const result = await (body.hidden
      ? env.DB.prepare(`UPDATE tea_table_questions SET hidden_at = COALESCE(hidden_at, datetime('now')), hidden_by = ?
          WHERE id = ? AND taken_off_at IS NULL`).bind(owner.userId, id)
      : env.DB.prepare('UPDATE tea_table_questions SET hidden_at = NULL, hidden_by = NULL WHERE id = ? AND taken_off_at IS NULL').bind(id)
    ).run();
    if (!result.meta?.changes) return notFound();
    return privateJson({ kind: 'question', id, hidden: body.hidden });
  };

  return [
    ['POST', '/api/tea-table/questions', async (request, env) => {
      const person = await signedIn(request, env);
      if ('error' in person) return person.error;
      return ask(env, person, request);
    }],
    ['GET', '/api/tea-table/questions/:id', one],
    ['DELETE', '/api/tea-table/questions/:id', withPerson((env, person, id) => takeOff(env, person, id))],
    ['GET', '/api/tea-table/questions/:id/asked', asked],
    ['PUT', '/api/tea-table/questions/:id/note', withPerson((env, person, id, request) => tell(env, person, id, request))],
    ['PUT', '/api/tea-table/questions/:id/named', withPerson((env, person, id, request) => name(env, person, id, request))],
    ['DELETE', '/api/tea-table/questions/:id/named', withPerson((env, person, id) => unname(env, person, id))],
    ['PUT', '/api/tea-table/questions/:id/thanks', withPerson((env, person, id, request) => thank(env, person, id, request, true))],
    ['DELETE', '/api/tea-table/questions/:id/thanks', withPerson((env, person, id, request) => thank(env, person, id, request, false))],
    ['GET', '/api/admin/tea-table/questions', manage],
    ['POST', '/api/admin/tea-table/questions/:id/hide', hide],
  ];
}

/** Statements that clear a person's questions and the notes they wrote, before their account is deleted (familyErasure.ts). */
export function knowThisTeaErasureStatements(db: D1Database, userId: string): D1PreparedStatement[] {
  return [
    db.prepare(`UPDATE tea_table_questions SET thanked_note_id = NULL
      WHERE thanked_note_id IN (SELECT id FROM tea_table_question_notes WHERE writer_user_id = ?)`).bind(userId),
    db.prepare('DELETE FROM tea_table_question_notes WHERE writer_user_id = ?').bind(userId),
    db.prepare('DELETE FROM tea_table_question_notes WHERE question_id IN (SELECT id FROM tea_table_questions WHERE asker_user_id = ?)').bind(userId),
    db.prepare('UPDATE tea_table_questions SET hidden_by = NULL WHERE hidden_by = ?').bind(userId),
    db.prepare('DELETE FROM tea_table_questions WHERE asker_user_id = ?').bind(userId),
  ];
}

/** The storage keys of a person's question photographs, removed once the rows are gone. */
export async function knowThisTeaPhotoKeys(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db.prepare('SELECT full_key, small_key FROM tea_table_questions WHERE asker_user_id = ?')
    .bind(userId).all<{ full_key: string; small_key: string }>();
  return (results ?? []).flatMap(row => [row.full_key, row.small_key]).filter(Boolean);
}
