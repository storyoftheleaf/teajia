/**
 * Teajia family, stage 1: the upload door and what the shop does with what
 * comes through it. Plan: todo/plans/teajia-family.md.
 *
 * Three kinds of caller:
 * - a signed-in member (any account, or none): their own photographs of a
 *   shop tea, their cover for it, whether their tasting is shared, a request
 *   to find more of a sold-out tea, and voice notes with member limits;
 * - anyone, signed in or not: the shared photographs of a public tea, and a
 *   report on a page, photograph or tasting;
 * - the shop (the `publish` bundle in its own account): the offered pile,
 *   placing, the lead picture, passing, restoring, hiding, and the lists of
 *   restock requests and reports.
 *
 * Tenancy: a photograph belongs to the account that owns its tea, and every
 * shop query is scoped to the caller's account. A member's own rows are
 * person-owned (like a profile) and are read by their user id.
 *
 * The score is private. Nothing here reads `rating`, `note` or `verdict` from
 * the journal: a shared tasting is words and photographs only, and the words
 * are read where the page is built (stage 4), never from this module.
 *
 * Registered from worker/src/index.ts through `familyRoutes(deps)`; the deps
 * are the auth and upload helpers that live there.
 */
import {
  FAMILY_FULL_LONG_EDGE, FAMILY_FULL_MAX_BYTES, FAMILY_MIN_LONG_EDGE, FAMILY_PHOTO_PAGES,
  FAMILY_PHOTO_TYPE, FAMILY_PHOTOS_PER_DAY, FAMILY_PHOTOS_PER_TEA, FAMILY_SHARE_STATES,
  FAMILY_SMALL_LONG_EDGE, FAMILY_SMALL_MAX_BYTES, FAMILY_TARGET_KINDS, FAMILY_VOICE_MAX_BYTES,
  FAMILY_VOICE_MAX_SECONDS, FAMILY_VOICE_NOTES_PER_DAY,
  type FamilyAuthor, type FamilyOfferedPhotograph, type FamilyPhotoPage, type FamilyPhotograph,
  type FamilyShareState, type FamilySharedPhotograph, type FamilyTargetKind, type FamilyTeaPhotographs,
  isFamilyPhotographShape, readFamilyPhotographFrame, type FamilyPhotographFrame, type FamilyPhotographShape,
} from '../../src/lib/familyContract';
import { inspectJpeg } from './familyJpeg';
import { teaTableSittings } from './teaTable';
import { withdrawTastingShare } from './tastingWithdrawal';
import { PHOTO_TASTING_NOT_HIDDEN } from './familyPersonTastings';
import { teaTableOpen } from '../../src/lib/teaTable';
import { ensureFamilyPage } from './familyPages';
import { describeReports, familyFeedbackRoutes } from './familyFeedback';
import { signPhotograph } from './familyMedia';
import { acknowledgementOpen, photographBy } from './photographCredit';
import { yourTablePageOpen } from '../../src/lib/yourTablePage';
import { fixTeaVoiceText, hasTeaVoiceProvider, transcribeTeaVoice, TeaVoiceTranscriptionError, type TeaVoiceEnvironment } from './curateVoiceTranscription';

interface RateLimiter { limit: (opts: { key: string }) => Promise<{ success: boolean }> }

export interface FamilyEnv extends TeaVoiceEnvironment {
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  PROVIDER_LIMITER?: RateLimiter;
  JWT_SECRET?: string;
  /** "true" or "false" opens or closes Your Table as a page (Launch 4); see src/lib/yourTablePage.ts. */
  YOUR_TABLE_PAGE_OPEN?: string;
  /** See src/lib/teaTable.ts. */
  TEA_TABLE_OPEN?: string;
}

type Person = { userId: string; email: string; name: string };
type ShopCtx = { accountId: string; userId: string };
export type FamilyHandler<E> = (request: Request, env: E, params: Record<string, string>, ctx?: ExecutionContext) => Promise<Response>;

export interface FamilyDeps<E extends FamilyEnv> {
  /** The public shop. Member voice notes are filed under it. */
  publicAccountId: string;
  requireAuthenticatedUser(request: Request, env: E): Promise<Person | { error: Response }>;
  optionalAuthenticatedUser(request: Request, env: E): Promise<Person | null>;
  requireBundle(request: Request, env: E, bundle: 'catalog' | 'publish'): Promise<ShopCtx | { error: Response }>;
  enforceDurableLimit(binding: RateLimiter | undefined, bindingName: string, key: string): Promise<Response | null>;
  validateUpload(file: File, kind: 'image' | 'audio', maxBytes: number): Promise<Response | null>;
  safeUploadExtension(mime: string): string;
}

const MEDIA_PREFIX = 'https://media.teajia.co/';
const MULTIPART_ALLOWANCE = 64 * 1024;
const OWNER_ACTIONS = ['place', 'lead', 'pass', 'restore'] as const;
type OwnerAction = typeof OWNER_ACTIONS[number];

// Everything here is a person's own or can be taken back (A4 review, finding
// 4), so no answer is kept by a browser or a cache.
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

/** A refusal in a plain sentence, with a code the screen can branch on. */
function refuse(status: number, error: string, code: string): Response {
  return json({ error, code }, status);
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

const isShareState = (value: unknown): value is FamilyShareState =>
  typeof value === 'string' && (FAMILY_SHARE_STATES as readonly string[]).includes(value);
const isTargetKind = (value: unknown): value is FamilyTargetKind =>
  typeof value === 'string' && (FAMILY_TARGET_KINDS as readonly string[]).includes(value);
const isPhotoPage = (value: unknown): value is FamilyPhotoPage =>
  typeof value === 'string' && (FAMILY_PHOTO_PAGES as readonly string[]).includes(value);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value);

type ProductRow = {
  id: string; account_id: string; name: string | null; is_public: number | null; shown_in_shop: number | null; status: string | null;
  stock_grams: number | null; account_status: string | null; public_enabled: number | null;
};

async function readProduct(db: D1Database, productId: string): Promise<ProductRow | null> {
  if (!validId(productId)) return null;
  return db.prepare(
    `SELECT p.id, p.account_id, COALESCE(NULLIF(p.given_name, ''), p.product_name) AS name, p.is_public, p.shown_in_shop, p.status,
            p.stock_grams, a.status AS account_status, a.public_enabled
       FROM products p JOIN accounts a ON a.id = p.account_id
      WHERE p.id = ?`,
  ).bind(productId).first<ProductRow>();
}

/** A tea in the shop: public, in an open public account, and not withdrawn. */
function inTheShop(product: ProductRow): boolean {
  return Number(product.is_public) === 1 && Number(product.shown_in_shop) === 1 && product.account_status === 'active'
    && Number(product.public_enabled) === 1 && (product.status === 'Active' || product.status === 'Sold Out');
}

const mediaUrl = (key: string) => `${MEDIA_PREFIX}${key}`;

type PhotoRow = {
  id: string; account_id: string; product_id: string; author_user_id: string; journal_entry_id: string | null;
  page: FamilyPhotoPage | null; full_key: string; small_key: string; full_width: number; full_height: number;
  small_width: number; small_height: number; share_state: FamilyShareState; offered_at: string | null;
  shop_use: FamilyOfferedPhotograph['shop_use']; removed_by_member_at: string | null; created_at: string;
  shape?: string | null; frame?: string | null; credit_name_shown?: number | null;
};

/** The photographer said yes to "photograph by <first name>". Absent or anything else is no. */
const nameShown = (row: { credit_name_shown?: number | null }) => Number(row.credit_name_shown) === 1;

/** A row written before the column existed, or holding anything unexpected, reads as square. */
/** The stored frame, or null when there is none or it does not read as one. */
function frameOf(row: { frame?: string | null }): FamilyPhotographFrame | null {
  if (!row.frame) return null;
  try { return readFamilyPhotographFrame(JSON.parse(row.frame)) ?? null; } catch { return null; }
}
const shapeOf = (row: { shape?: string | null }): FamilyPhotographShape => (isFamilyPhotographShape(row.shape) ? row.shape : 'square');

function ownPhoto(row: PhotoRow): FamilyPhotograph {
  return {
    id: row.id, product_id: row.product_id, journal_entry_id: row.journal_entry_id, page: row.page,
    full_url: mediaUrl(row.full_key), small_url: mediaUrl(row.small_key),
    full_width: Number(row.full_width), full_height: Number(row.full_height),
    small_width: Number(row.small_width), small_height: Number(row.small_height),
    share_state: row.share_state, shape: shapeOf(row), frame: frameOf(row), credit_name_shown: nameShown(row), created_at: row.created_at,
  };
}

type AuthoredRow = PhotoRow & { author_name: string | null; page_id: string | null };

function photoParts(row: AuthoredRow) {
  return {
    id: row.id, full_url: mediaUrl(row.full_key), small_url: mediaUrl(row.small_key),
    full_width: Number(row.full_width), full_height: Number(row.full_height),
    small_width: Number(row.small_width), small_height: Number(row.small_height), shape: shapeOf(row), frame: frameOf(row),
  };
}

/** The shop's own view of an offered photograph: it knows who sent it. Never served in public. */
function shopPhoto(row: AuthoredRow): FamilySharedPhotograph & { author: FamilyAuthor } {
  const author: FamilyAuthor = { name: row.author_name || 'A member of the Teajia family', page_id: row.page_id ?? null };
  return { ...photoParts(row), author, photograph_by: photographBy(row, row.author_name) };
}

/**
 * A photograph as any visitor sees it. The photographer's name leaves the
 * worker only when they allowed it, and then as a first name; their page is
 * linked only then too, and only when it is published (AUTHOR_COLUMNS). When
 * they did not allow it there is no author at all: no name, no page, no slug.
 */
function publicPhoto(row: AuthoredRow, credit: boolean): FamilySharedPhotograph {
  const firstName = photographBy(row, row.author_name);
  return {
    ...photoParts(row),
    author: firstName ? { name: firstName, page_id: row.page_id ?? null } : null,
    // "Photograph by" opens with the Tea Table (A4 review, finding 11).
    ...(credit ? { photograph_by: firstName } : {}),
  };
}

/** The credited name and the live page of a photograph's author. */
const AUTHOR_COLUMNS = `
  COALESCE(
    (SELECT NULLIF(c.display_name, '') FROM contributors c WHERE c.user_id = p.author_user_id AND c.is_published = 1 ORDER BY c.created_at LIMIT 1),
    NULLIF(u.name, '')
  ) AS author_name,
  (SELECT c.id FROM contributors c WHERE c.user_id = p.author_user_id AND c.is_published = 1 ORDER BY c.created_at LIMIT 1) AS page_id`;

/** Hidden by the owner: the photograph itself, the tasting it belongs to, or the author's whole page. */
const NOT_HIDDEN = `
  NOT EXISTS (SELECT 1 FROM family_hides h WHERE h.account_id = p.account_id AND h.target_kind = 'photograph' AND h.target_id = p.id)
  AND ${PHOTO_TASTING_NOT_HIDDEN}
  AND NOT EXISTS (SELECT 1 FROM family_hides h JOIN contributors hc ON hc.id = h.target_id
                   WHERE h.account_id = p.account_id AND h.target_kind = 'page' AND hc.user_id = p.author_user_id)`;

// ── One photograph through the door ───────────────────────────────────────

type CheckedPhoto = { file: File; bytes: Uint8Array; width: number; height: number };

async function checkPhoto(
  value: unknown,
  label: 'large' | 'small',
  maxBytes: number,
  maxLongEdge: number,
): Promise<CheckedPhoto | Response> {
  if (!(value instanceof File)) return refuse(400, `The ${label} copy of the photograph is missing.`, 'photo_missing');
  if (value.type !== FAMILY_PHOTO_TYPE) return refuse(415, 'Photographs are sent as JPEG pictures.', 'unsupported_media_type');
  if (value.size > maxBytes) return refuse(413, `The ${label} copy of the photograph is too big.`, 'upload_too_large');
  const bytes = new Uint8Array(await value.arrayBuffer());
  const seen = inspectJpeg(bytes);
  if (!seen.ok) {
    if (seen.reason === 'not_jpeg') return refuse(415, 'That file is not a JPEG picture.', 'invalid_media_signature');
    if (seen.reason === 'carries_metadata') {
      return refuse(422, 'That photograph still carries its camera details. Add it again from the tasting.', 'photo_carries_metadata');
    }
    return refuse(422, 'That photograph could not be read.', 'invalid_photograph');
  }
  const longEdge = Math.max(seen.width, seen.height);
  if (longEdge > maxLongEdge || longEdge < FAMILY_MIN_LONG_EDGE) {
    return refuse(422, `The ${label} copy of the photograph is the wrong size.`, 'photo_wrong_size');
  }
  return { file: value, bytes, width: seen.width, height: seen.height };
}

function sameShape(a: CheckedPhoto, b: CheckedPhoto) {
  const ratioA = a.width / a.height;
  const ratioB = b.width / b.height;
  return Math.abs(ratioA - ratioB) / ratioA <= 0.03 && Math.max(b.width, b.height) <= Math.max(a.width, a.height);
}

async function photoCounts(db: D1Database, userId: string, productId: string) {
  const row = await db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM member_photographs WHERE author_user_id = ?1 AND product_id = ?2 AND removed_by_member_at IS NULL) AS on_tea,
       (SELECT COUNT(*) FROM member_photographs WHERE author_user_id = ?1 AND created_at >= datetime('now', '-1 day')) AS today`,
  ).bind(userId, productId).first<{ on_tea: number; today: number }>();
  return { onTea: Number(row?.on_tea ?? 0), today: Number(row?.today ?? 0) };
}

const teaFull = () => refuse(409, 'You have six photographs of this tea. Remove one from your page to add another.', 'tea_photo_limit');
const dayFull = () => refuse(429, 'That is as many photographs as one day takes. Add more tomorrow.', 'daily_photo_limit');

// ── The routes ─────────────────────────────────────────────────────────────

// ── The shop's offered pile and what it does with a photograph ─────────────
//
// Exported so the admin routes and the MCP tools (mcpTools/teaPageContent.ts)
// run the same statements. Every query is bound to the shop's account.

export const FAMILY_OWNER_ACTIONS = OWNER_ACTIONS;
export type FamilyOwnerAction = OwnerAction;

/**
 * Every photograph ever offered to this shop, newest first. With a secret the
 * two addresses are signed for a few hours, as the admin screen needs; without
 * one they are the canonical addresses, which load only while the picture is
 * on show.
 */
export async function listOfferedPhotographs(db: D1Database, accountId: string, secret: string | undefined): Promise<(FamilyOfferedPhotograph & { hidden: boolean })[]> {
  const { results } = await db.prepare(
    `SELECT p.*, ${AUTHOR_COLUMNS},
            COALESCE(NULLIF(pr.given_name, ''), pr.product_name) AS product_name,
            EXISTS (SELECT 1 FROM family_hides h WHERE h.account_id = p.account_id AND h.target_kind = 'photograph' AND h.target_id = p.id) AS hidden
       FROM member_photographs p
       JOIN users u ON u.id = p.author_user_id
       LEFT JOIN products pr ON pr.id = p.product_id AND pr.account_id = p.account_id
      WHERE p.account_id = ? AND p.offered_at IS NOT NULL
      ORDER BY p.offered_at DESC
      LIMIT 200`,
  ).bind(accountId).all<PhotoRow & { author_name: string | null; page_id: string | null; product_name: string | null; hidden: number }>();
  return Promise.all((results ?? []).map(async row => ({
    ...(await signPhotograph(secret, shopPhoto(row))),
    product_id: row.product_id,
    product_name: row.product_name,
    share_state: row.share_state,
    shop_use: row.shop_use,
    removed_by_author: row.removed_by_member_at !== null,
    offered_at: row.offered_at!,
    hidden: Number(row.hidden) === 1,
  })));
}

export type ShopPhotograph = {
  id: string; product_id: string; shop_use: string; shop_use_before_lead: string | null; offered_at: string | null;
  removed_by_member_at: string | null; share_state?: string | null;
};

/** One photograph in this shop, offered or not. */
export async function readShopPhotograph(db: D1Database, accountId: string, id: string): Promise<ShopPhotograph | null> {
  return db.prepare(
    `SELECT id, product_id, shop_use, shop_use_before_lead, offered_at, removed_by_member_at, share_state FROM member_photographs WHERE id = ? AND account_id = ?`,
  ).bind(id, accountId).first<ShopPhotograph>();
}

/** Why the shop may not take this photograph up, or null when it may. Pass and restore are always allowed. */
export function photographUseRefusal(photo: ShopPhotograph, action: OwnerAction): { status: number; error: string; code: string } | null {
  if (!photo.offered_at) return { status: 409, error: 'Only a photograph offered to Teajia can be used.', code: 'not_offered' };
  if (photo.removed_by_member_at && (action === 'place' || action === 'lead')) {
    return { status: 409, error: 'The member took this photograph off their page, so it cannot be used.', code: 'removed_by_author' };
  }
  // A photograph its author made private is withdrawn from every place (A4 review, finding 3).
  if (photo.share_state === 'private' && (action === 'place' || action === 'lead')) {
    return { status: 409, error: 'The member made this photograph private, so it cannot be used.', code: 'made_private' };
  }
  return null;
}

export { withdrawTastingQuotes } from './tastingWithdrawal';

export type PhotographUseOutcome =
  | { row: Record<string, unknown> | null }
  | { refused: { status: number; error: string; code: string } };

/** Place, lead, pass or restore one offered photograph. */
export async function applyPhotographUse(db: D1Database, shop: ShopCtx, id: string, action: OwnerAction): Promise<PhotographUseOutcome> {
  const photo = await readShopPhotograph(db, shop.accountId, id);
  if (!photo) return { refused: { status: 404, error: 'That photograph is not in this shop.', code: 'photograph_not_found' } };
  const refused = photographUseRefusal(photo, action);
  if (refused) return { refused };
  const decided = `shop_decided_at = datetime('now'), shop_decided_by = ?, updated_at = datetime('now')`;
  if (action === 'lead') {
    await db.batch([
      // The tea's previous lead steps back to what it was before.
      db.prepare(
        `UPDATE member_photographs SET shop_use = COALESCE(shop_use_before_lead, 'none'), shop_use_before_lead = NULL, ${decided}
          WHERE account_id = ? AND product_id = ? AND shop_use = 'lead' AND id <> ?`,
      ).bind(shop.userId, shop.accountId, photo.product_id, photo.id),
      db.prepare(
        `UPDATE member_photographs
            SET shop_use_before_lead = CASE WHEN shop_use = 'lead' THEN shop_use_before_lead ELSE shop_use END,
                shop_use = 'lead', ${decided}
          WHERE id = ? AND account_id = ?`,
      ).bind(shop.userId, photo.id, shop.accountId),
    ]);
  } else {
    const next = action === 'place' ? `'placed'` : action === 'pass' ? `'passed'`
      : `CASE WHEN shop_use = 'lead' THEN COALESCE(shop_use_before_lead, 'none') ELSE 'none' END`;
    await db.prepare(
      `UPDATE member_photographs SET shop_use = ${next}, shop_use_before_lead = NULL, ${decided} WHERE id = ? AND account_id = ?`,
    ).bind(shop.userId, photo.id, shop.accountId).run();
  }
  const row = await db.prepare('SELECT id, product_id, shop_use FROM member_photographs WHERE id = ?').bind(photo.id).first<Record<string, unknown>>();
  return { row };
}

export function familyRoutes<E extends FamilyEnv>(deps: FamilyDeps<E>): [string, string, FamilyHandler<E>][] {
  /** A tea a member may photograph: in the shop, or any tea of the caller's own account when they catalogue it. */
  async function photographableProduct(request: Request, env: E, productId: string): Promise<ProductRow | null> {
    const product = await readProduct(env.DB, productId);
    if (!product) return null;
    if (inTheShop(product)) return product;
    // The owner's sourcing tasting uses the same camera on teas that are not public yet.
    if (!request.headers.get('X-Teajia-Account')) return null;
    const staff = await deps.requireBundle(request, env, 'catalog');
    return 'error' in staff || staff.accountId !== product.account_id ? null : product;
  }

  async function journalFor(db: D1Database, person: Person, productId: string) {
    return db.prepare(
      `SELECT id FROM customer_tasting_journal WHERE user_id = ? AND product_id = ? LIMIT 1`,
    ).bind(person.email, productId).first<{ id: string }>();
  }

  // POST /api/family/photographs: both sizes of one photograph, made on the phone.
  const upload: FamilyHandler<E> = async (request, env) => {
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person.error;
    const limited = await deps.enforceDurableLimit(env.PROVIDER_LIMITER, 'PROVIDER_LIMITER', `family:${person.userId}:photo`);
    if (limited) return limited;
    if (!env.MEDIA_BUCKET) return refuse(503, 'Photographs cannot be stored right now.', 'storage_unavailable');
    if (!(request.headers.get('Content-Type') || '').includes('multipart/form-data')) {
      return refuse(400, 'Expected multipart/form-data', 'invalid_content_type');
    }
    const declared = Number(request.headers.get('content-length') || '0');
    if (declared > FAMILY_FULL_MAX_BYTES + FAMILY_SMALL_MAX_BYTES + MULTIPART_ALLOWANCE) {
      return refuse(413, 'That photograph is too big.', 'upload_too_large');
    }
    let form: FormData;
    try { form = await request.formData(); } catch { return refuse(400, 'The photograph did not arrive whole.', 'invalid_form'); }
    const productId = String(form.get('product_id') || '').trim();
    const pageValue = form.get('page');
    const page = isPhotoPage(pageValue) ? pageValue : null;

    const product = await photographableProduct(request, env, productId);
    if (!product) return refuse(404, 'This tea is not in the shop.', 'product_not_found');

    const full = await checkPhoto(form.get('full'), 'large', FAMILY_FULL_MAX_BYTES, FAMILY_FULL_LONG_EDGE);
    if (full instanceof Response) return full;
    const small = await checkPhoto(form.get('small'), 'small', FAMILY_SMALL_MAX_BYTES, FAMILY_SMALL_LONG_EDGE);
    if (small instanceof Response) return small;
    if (!sameShape(full, small)) return refuse(422, 'The two copies of the photograph do not match.', 'photo_sizes_do_not_match');

    const before = await photoCounts(env.DB, person.userId, product.id);
    if (before.onTea >= FAMILY_PHOTOS_PER_TEA) return teaFull();
    if (before.today >= FAMILY_PHOTOS_PER_DAY) return dayFull();

    const journal = await journalFor(env.DB, person, product.id);
    const id = crypto.randomUUID();
    const base = `family-photos/${product.account_id}/${product.id}/${id}`;
    const fullKey = `${base}-full.jpg`;
    const smallKey = `${base}-small.jpg`;
    const metadata = { customMetadata: { author_user_id: person.userId }, httpMetadata: { contentType: FAMILY_PHOTO_TYPE } };
    await env.MEDIA_BUCKET.put(fullKey, full.bytes, metadata);
    await env.MEDIA_BUCKET.put(smallKey, small.bytes, metadata);

    // The limits are checked again inside the insert, so two photographs sent
    // at once cannot both take the sixth place.
    let changes = 0;
    try {
      const result = await env.DB.prepare(
        `INSERT INTO member_photographs
           (id, account_id, product_id, author_user_id, journal_entry_id, page, full_key, small_key,
            full_bytes, small_bytes, full_width, full_height, small_width, small_height)
         SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
          WHERE (SELECT COUNT(*) FROM member_photographs WHERE author_user_id = ?4 AND product_id = ?3 AND removed_by_member_at IS NULL) < ?15
            AND (SELECT COUNT(*) FROM member_photographs WHERE author_user_id = ?4 AND created_at >= datetime('now', '-1 day')) < ?16`,
      ).bind(
        id, product.account_id, product.id, person.userId, journal?.id ?? null, page, fullKey, smallKey,
        full.file.size, small.file.size, full.width, full.height, small.width, small.height,
        FAMILY_PHOTOS_PER_TEA, FAMILY_PHOTOS_PER_DAY,
      ).run();
      changes = Number(result.meta?.changes ?? 0);
    } finally {
      if (!changes) {
        await env.MEDIA_BUCKET.delete(fullKey);
        await env.MEDIA_BUCKET.delete(smallKey);
      }
    }
    if (!changes) {
      const after = await photoCounts(env.DB, person.userId, product.id);
      return after.onTea >= FAMILY_PHOTOS_PER_TEA ? teaFull() : dayFull();
    }
    const row = await env.DB.prepare('SELECT * FROM member_photographs WHERE id = ?').bind(id).first<PhotoRow>();
    return json({ photograph: await signPhotograph(env.JWT_SECRET, ownPhoto(row!)), remaining: FAMILY_PHOTOS_PER_TEA - (before.onTea + 1) }, 201);
  };

  // GET /api/family/teas/:productId/mine: the member's own photographs, cover and share state for one tea.
  const myTea: FamilyHandler<E> = async (request, env, params) => {
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person.error;
    if (!validId(params.productId)) return refuse(404, 'This tea is not in the shop.', 'product_not_found');
    const [photos, cover, journal] = await Promise.all([
      env.DB.prepare(
        `SELECT * FROM member_photographs
          WHERE author_user_id = ? AND product_id = ? AND removed_by_member_at IS NULL
          ORDER BY created_at, id LIMIT ?`,
      ).bind(person.userId, params.productId, FAMILY_PHOTOS_PER_TEA * 2).all<PhotoRow>(),
      env.DB.prepare(
        `SELECT c.photograph_id FROM member_tea_covers c
           JOIN member_photographs p ON p.id = c.photograph_id AND p.removed_by_member_at IS NULL
          WHERE c.author_user_id = ? AND c.product_id = ?`,
      ).bind(person.userId, params.productId).first<{ photograph_id: string }>(),
      env.DB.prepare(
        `SELECT j.id, s.share_state FROM customer_tasting_journal j
           LEFT JOIN member_tasting_shares s ON s.journal_entry_id = j.id
          WHERE j.user_id = ? AND j.product_id = ? LIMIT 1`,
      ).bind(person.email, params.productId).first<{ id: string; share_state: FamilyShareState | null }>(),
    ]);
    const photographs = await Promise.all((photos.results ?? []).map(row => signPhotograph(env.JWT_SECRET, ownPhoto(row))));
    return json({
      product_id: params.productId,
      photographs,
      cover_photograph_id: cover?.photograph_id ?? null,
      tasting_share_state: journal ? (journal.share_state ?? 'private') : null,
      remaining: Math.max(0, FAMILY_PHOTOS_PER_TEA - photographs.length),
    });
  };

  // GET /api/family/tasting-shares: the share state of every tasting of the
  // member's that has ever been shared, in one read, for the share line on
  // each journal tasting (Your Table, K8). A saved tasting with no row here is
  // private. Their own rows only; nothing about the words or the score.
  const tastingShares: FamilyHandler<E> = async (request, env) => {
    if (!yourTablePageOpen(env)) return refuse(404, 'Not found', 'not_found');
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person.error;
    const rows = await env.DB.prepare(
      `SELECT j.product_id, s.share_state FROM customer_tasting_journal j
         JOIN member_tasting_shares s ON s.journal_entry_id = j.id AND s.author_user_id = ?
        WHERE j.user_id = ?
        ORDER BY j.product_id`,
    ).bind(person.userId, person.email).all<{ product_id: string; share_state: FamilyShareState }>();
    return json({
      shares: (rows.results ?? [])
        .filter(row => isShareState(row.share_state))
        .map(row => ({ product_id: row.product_id, share_state: row.share_state })),
    });
  };

  // PUT /api/family/teas/:productId/cover { photograph_id | null }: only the member sees it.
  const setCover: FamilyHandler<E> = async (request, env, params) => {
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person.error;
    const body = await readBody(request);
    if (!body || !('photograph_id' in body)) return refuse(400, 'Choose a photograph for the cover.', 'validation_failed');
    if (body.photograph_id === null) {
      await env.DB.prepare('DELETE FROM member_tea_covers WHERE author_user_id = ? AND product_id = ?')
        .bind(person.userId, params.productId).run();
      return json({ product_id: params.productId, cover_photograph_id: null });
    }
    if (!validId(body.photograph_id)) return refuse(400, 'Choose a photograph for the cover.', 'validation_failed');
    const photo = await env.DB.prepare(
      `SELECT id, account_id FROM member_photographs
        WHERE id = ? AND author_user_id = ? AND product_id = ? AND removed_by_member_at IS NULL`,
    ).bind(body.photograph_id, person.userId, params.productId).first<{ id: string; account_id: string }>();
    if (!photo) return refuse(404, 'That photograph is not one of yours for this tea.', 'photograph_not_found');
    await env.DB.prepare(
      `INSERT INTO member_tea_covers (author_user_id, product_id, account_id, photograph_id, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(author_user_id, product_id) DO UPDATE SET photograph_id = excluded.photograph_id, updated_at = excluded.updated_at`,
    ).bind(person.userId, params.productId, photo.account_id, photo.id).run();
    return json({ product_id: params.productId, cover_photograph_id: photo.id });
  };

  // PUT /api/family/photographs/:id/share { share_state }: one photograph's own choice.
  const sharePhoto: FamilyHandler<E> = async (request, env, params) => {
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person.error;
    const body = await readBody(request);
    if (!body || !isShareState(body.share_state)) return refuse(400, 'Choose private, on my page, or offer to Teajia.', 'validation_failed');
    const result = await env.DB.prepare(
      `UPDATE member_photographs
          SET share_state = ?1,
              offered_at = CASE WHEN ?1 = 'offered' THEN COALESCE(offered_at, datetime('now')) ELSE offered_at END,
              -- Private withdraws it from the tea page too, as Remove from my page does.
              shop_use = CASE WHEN ?1 = 'private' AND shop_use IN ('placed', 'lead') THEN 'none' ELSE shop_use END,
              shop_use_before_lead = CASE WHEN ?1 = 'private' THEN NULL ELSE shop_use_before_lead END,
              updated_at = datetime('now')
        WHERE id = ?2 AND author_user_id = ?3 AND removed_by_member_at IS NULL`,
    ).bind(body.share_state, params.id, person.userId).run();
    if (!Number(result.meta?.changes ?? 0)) return refuse(404, 'That photograph is not one of yours.', 'photograph_not_found');
    const row = await env.DB.prepare('SELECT * FROM member_photographs WHERE id = ?').bind(params.id).first<PhotoRow>();
    // Putting a photograph on a page is what makes the page: on the first share it is created.
    const page = body.share_state === 'private' ? null : await ensureFamilyPage(env.DB, person);
    return json({ photograph: await signPhotograph(env.JWT_SECRET, ownPhoto(row!)), page_id: page?.id ?? null });
  };

  // PUT /api/family/photographs/:id/shape { shape, frame? }: how the author wants it shown.
  // Square is the default; upright (2:3) and across (3:2) are the only others. The
  // frame is the part of the stored picture that shows; without one it is the middle.
  // Only numbers are stored: the picture itself cannot be swapped through this door.
  const shapePhoto: FamilyHandler<E> = async (request, env, params) => {
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person.error;
    const body = await readBody(request);
    if (!body || !isFamilyPhotographShape(body.shape)) return refuse(400, 'Choose square, 2:3 or 3:2.', 'invalid_shape');
    const frame = readFamilyPhotographFrame(body.frame);
    if (frame === undefined) return refuse(400, 'That crop could not be read. Try it again.', 'invalid_frame');
    const result = await env.DB.prepare(
      `UPDATE member_photographs SET shape = ?1, frame = ?4, updated_at = datetime('now')
        WHERE id = ?2 AND author_user_id = ?3 AND removed_by_member_at IS NULL`,
    ).bind(body.shape, params.id, person.userId, frame ? JSON.stringify(frame) : null).run();
    if (!Number(result.meta?.changes ?? 0)) return refuse(404, 'That photograph is not one of yours.', 'photograph_not_found');
    const row = await env.DB.prepare('SELECT * FROM member_photographs WHERE id = ?').bind(params.id).first<PhotoRow>();
    return json({ photograph: await signPhotograph(env.JWT_SECRET, ownPhoto(row!)) });
  };

  // PUT /api/family/photographs/:id/credit { credit_name_shown }: the photographer's own
  // yes or no to "photograph by <first name>" wherever the picture is shown large.
  // Starts at no. Only the author can change it; it changes nothing else.
  const creditPhoto: FamilyHandler<E> = async (request, env, params) => {
    if (!acknowledgementOpen(env)) return refuse(404, 'Not found', 'not_found');
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person.error;
    const body = await readBody(request);
    if (!body || typeof body.credit_name_shown !== 'boolean') {
      return refuse(400, 'Say whether your first name goes with this photograph.', 'validation_failed');
    }
    const result = await env.DB.prepare(
      `UPDATE member_photographs SET credit_name_shown = ?1, updated_at = datetime('now')
        WHERE id = ?2 AND author_user_id = ?3 AND removed_by_member_at IS NULL`,
    ).bind(body.credit_name_shown ? 1 : 0, params.id, person.userId).run();
    if (!Number(result.meta?.changes ?? 0)) return refuse(404, 'That photograph is not one of yours.', 'photograph_not_found');
    const row = await env.DB.prepare('SELECT * FROM member_photographs WHERE id = ?').bind(params.id).first<PhotoRow>();
    return json({ photograph: await signPhotograph(env.JWT_SECRET, ownPhoto(row!)) });
  };

  // POST /api/family/photographs/:id/remove: gone from the member's page and view,
  // and from the tea page. A placed or lead photograph steps down, and a removed
  // photograph can no longer be placed or made the lead. The row stays, so the
  // shop's pile still shows it was offered and then taken back.
  const removePhoto: FamilyHandler<E> = async (request, env, params) => {
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person.error;
    const photo = await env.DB.prepare(
      'SELECT id FROM member_photographs WHERE id = ? AND author_user_id = ?',
    ).bind(params.id, person.userId).first<{ id: string }>();
    if (!photo) return refuse(404, 'That photograph is not one of yours.', 'photograph_not_found');
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE member_photographs
            SET removed_by_member_at = COALESCE(removed_by_member_at, datetime('now')),
                shop_use = CASE WHEN shop_use IN ('placed', 'lead') THEN 'none' ELSE shop_use END,
                shop_use_before_lead = NULL,
                updated_at = datetime('now')
          WHERE id = ? AND author_user_id = ?`,
      ).bind(photo.id, person.userId),
      env.DB.prepare('DELETE FROM member_tea_covers WHERE author_user_id = ? AND photograph_id = ?').bind(person.userId, photo.id),
    ]);
    return json({ id: photo.id, removed: true });
  };

  // PUT /api/family/teas/:productId/share { share_state }: the Share step after Save.
  // Applies to the tasting and to every photograph of it still on the member's page.
  const shareTasting: FamilyHandler<E> = async (request, env, params) => {
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person.error;
    const body = await readBody(request);
    if (!body || !isShareState(body.share_state)) return refuse(400, 'Choose private, on my page, or offer to Teajia.', 'validation_failed');
    const product = await readProduct(env.DB, params.productId);
    if (!product) return refuse(404, 'This tea is not in the shop.', 'product_not_found');
    const journal = await journalFor(env.DB, person, product.id);
    if (!journal) return refuse(409, 'Save the tasting first, then share it.', 'tasting_not_saved');
    const state = body.share_state;
    // The Tea Table's consent (worker/src/teaTable.ts): only a share made under
    // the Tea Table wording, while the Tea Table is open, records the moment
    // and the sittings the journal holds now. A share under the older wording
    // leaves what was recorded as it was.
    const toTeaTable = state !== 'private' && body.tea_table === true && teaTableOpen(env);
    const sittings = toTeaTable
      ? teaTableSittings((await env.DB.prepare('SELECT tastings FROM customer_tasting_journal WHERE id = ?')
        .bind(journal.id).first<{ tastings: string | null }>())?.tastings ?? null)
      : null;
    const upsert = env.DB.prepare(
      `INSERT INTO member_tasting_shares (journal_entry_id, account_id, product_id, author_user_id, share_state, shared_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, CASE WHEN ?5 = 'private' THEN NULL ELSE datetime('now') END, datetime('now'))
       ON CONFLICT(journal_entry_id) DO UPDATE SET
         share_state = excluded.share_state,
         shared_at = CASE WHEN excluded.share_state = 'private' THEN member_tasting_shares.shared_at
                          ELSE COALESCE(member_tasting_shares.shared_at, excluded.shared_at) END,
         updated_at = excluded.updated_at
       WHERE member_tasting_shares.author_user_id = excluded.author_user_id`,
    ).bind(journal.id, product.account_id, product.id, person.userId, state);
    let photographsUpdated: number;
    if (state === 'private') {
      // Private takes the tasting back from every place at once: the page, the
      // Tea Table, a placed or lead photograph, and its offered and approved
      // quotes on Home and the tea listing (worker/src/tastingWithdrawal.ts).
      const [, , photos] = await env.DB.batch([upsert, ...withdrawTastingShare(env.DB, journal.id, person.userId, product.id)]);
      photographsUpdated = Number(photos.meta?.changes ?? 0);
    } else {
      // Whether the person chose their own page by itself (A4 review, finding
      // 1): a page share standing before the tasting goes on the table, or a
      // share under the older "On my page" wording. Taking the tasting off the
      // table later leaves it on that page. Before a table share it is read
      // ahead of the upsert, which changes the state.
      const pageAlone = env.DB.prepare(
        `UPDATE member_tasting_shares SET page_alone_at = COALESCE(page_alone_at, datetime('now'))
          WHERE journal_entry_id = ? AND author_user_id = ?${toTeaTable ? " AND share_state IN ('page', 'offered') AND tea_table_at IS NULL" : ''}`,
      ).bind(journal.id, person.userId);
      const results = await env.DB.batch([
        ...(toTeaTable ? [pageAlone] : []),
        upsert,
        env.DB.prepare(
          `UPDATE member_photographs
              SET share_state = ?1,
                  offered_at = CASE WHEN ?1 = 'offered' THEN COALESCE(offered_at, datetime('now')) ELSE offered_at END,
                  journal_entry_id = COALESCE(journal_entry_id, ?2),
                  updated_at = datetime('now')
            WHERE author_user_id = ?3 AND product_id = ?4 AND removed_by_member_at IS NULL`,
        ).bind(state, journal.id, person.userId, product.id),
        toTeaTable
          ? env.DB.prepare(
            // A tasting already on the table keeps its place and its words: sharing
            // it again does not move it forward (A4 review, finding 14).
            `UPDATE member_tasting_shares
                SET tea_table_sittings = CASE WHEN tea_table_at IS NULL THEN ? ELSE tea_table_sittings END,
                    tea_table_at = COALESCE(tea_table_at, datetime('now'))
              WHERE journal_entry_id = ? AND author_user_id = ?`,
          ).bind(sittings, journal.id, person.userId)
          : pageAlone,
      ]);
      photographsUpdated = Number(results[toTeaTable ? 2 : 1].meta?.changes ?? 0);
    }
    // The first share makes the person's page (family, live without review); later ones leave it as it is.
    const page = state === 'private' ? null : await ensureFamilyPage(env.DB, person);
    return json({
      product_id: product.id, journal_entry_id: journal.id, share_state: state, photographs_updated: photographsUpdated,
      on_tea_table: toTeaTable,
      page_id: page?.id ?? null, page_path: page ? `/people/${encodeURIComponent(page.id)}` : null, page_created: page?.created ?? false,
    });
  };

  // GET /api/family/teas/:productId/photographs: what a public tea page shows. Public.
  const teaPhotographs: FamilyHandler<E> = async (_request, env, params) => {
    const product = await readProduct(env.DB, params.productId);
    if (!product || !inTheShop(product)) return refuse(404, 'This tea is not in the shop.', 'product_not_found');
    const { results } = await env.DB.prepare(
      `SELECT p.*, ${AUTHOR_COLUMNS}
         FROM member_photographs p
         JOIN users u ON u.id = p.author_user_id
        WHERE p.account_id = ? AND p.product_id = ?
          AND p.removed_by_member_at IS NULL
          AND p.share_state IN ('page', 'offered')
          AND ${NOT_HIDDEN}
        ORDER BY p.created_at DESC
        LIMIT 60`,
    ).bind(product.account_id, product.id).all<PhotoRow & { author_name: string | null; page_id: string | null }>();
    const rows = results ?? [];
    const lead = rows.find(row => row.shop_use === 'lead');
    const credit = acknowledgementOpen(env);
    const shown = (row: AuthoredRow) => publicPhoto(row, credit);
    const body: FamilyTeaPhotographs = {
      product_id: product.id,
      lead: lead ? shown(lead) : null,
      placed: rows.filter(row => row.shop_use === 'placed').map(shown),
      family: rows.filter(row => row.shop_use !== 'placed' && row.shop_use !== 'lead'
        && row.removed_by_member_at === null && row.share_state !== 'private').map(shown),
    };
    return json(body);
  };

  // POST /api/family/teas/:productId/restock-request { note? }: "find me more" on a sold-out tea.
  const restockRequest: FamilyHandler<E> = async (request, env, params) => {
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person.error;
    const product = await readProduct(env.DB, params.productId);
    if (!product || !inTheShop(product)) return refuse(404, 'This tea is not in the shop.', 'product_not_found');
    if (product.status === 'Active' && Number(product.stock_grams ?? 0) > 0) {
      return refuse(409, 'This tea is still in the shop.', 'still_in_stock');
    }
    const body = await readBody(request) ?? {};
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null;
    if (note && note.length > 500) return refuse(400, 'Keep the note under 500 characters.', 'validation_failed');
    const limited = await deps.enforceDurableLimit(env.PROVIDER_LIMITER, 'PROVIDER_LIMITER', `family:${person.userId}:restock`);
    if (limited) return limited;
    const id = crypto.randomUUID();
    const result = await env.DB.prepare(
      `INSERT INTO restock_requests (id, account_id, product_id, requester_user_id, note)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(requester_user_id, product_id) WHERE status = 'open' DO NOTHING`,
    ).bind(id, product.account_id, product.id, person.userId, note).run();
    const created = Number(result.meta?.changes ?? 0) > 0;
    return json({ product_id: product.id, requested: true, already_asked: !created }, created ? 201 : 200);
  };

  /** The account a report or hide is about, or null when the target does not exist. */
  async function targetAccount(db: D1Database, kind: FamilyTargetKind, targetId: string): Promise<string | null> {
    if (!validId(targetId)) return null;
    const sql = kind === 'photograph' ? 'SELECT account_id FROM member_photographs WHERE id = ?'
      : kind === 'tasting' ? 'SELECT account_id FROM member_tasting_shares WHERE journal_entry_id = ?'
        : 'SELECT account_id FROM contributors WHERE id = ?';
    const row = await db.prepare(sql).bind(targetId).first<{ account_id: string }>();
    return row?.account_id ?? null;
  }

  // POST /api/family/reports { target_kind, target_id, reason? }: anyone, signed in or not.
  const report: FamilyHandler<E> = async (request, env) => {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const limited = await deps.enforceDurableLimit(env.PROVIDER_LIMITER, 'PROVIDER_LIMITER', `family-report:${ip}`);
    if (limited) return limited;
    const body = await readBody(request);
    if (!body || !isTargetKind(body.target_kind) || typeof body.target_id !== 'string') {
      return refuse(400, 'Say what you are reporting.', 'validation_failed');
    }
    const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : null;
    if (reason && reason.length > 1000) return refuse(400, 'Keep the reason under 1000 characters.', 'validation_failed');
    const accountId = await targetAccount(env.DB, body.target_kind, body.target_id);
    if (!accountId) return refuse(404, 'That is no longer on Teajia.', 'target_not_found');
    const reporter = await deps.optionalAuthenticatedUser(request, env);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO family_reports (id, account_id, target_kind, target_id, reason, reporter_user_id) VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(id, accountId, body.target_kind, body.target_id, reason, reporter?.userId ?? null).run();
    return json({ received: true }, 201);
  };

  // ── The shop ────────────────────────────────────────────────────────────

  // GET /api/admin/family/photographs: every photograph ever offered to this shop.
  const offeredPile: FamilyHandler<E> = async (request, env) => {
    const shop = await deps.requireBundle(request, env, 'publish');
    if ('error' in shop) return shop.error;
    return json({ photographs: await listOfferedPhotographs(env.DB, shop.accountId, env.JWT_SECRET) });
  };

  // POST /api/admin/family/photographs/:id/(place|lead|pass|restore)
  const ownerAction = (action: OwnerAction): FamilyHandler<E> => async (request, env, params) => {
    const shop = await deps.requireBundle(request, env, 'publish');
    if ('error' in shop) return shop.error;
    const outcome = await applyPhotographUse(env.DB, shop, params.id, action);
    return 'refused' in outcome ? refuse(outcome.refused.status, outcome.refused.error, outcome.refused.code) : json(outcome.row);
  };

  // POST /api/admin/family/hide and /api/admin/family/unhide { target_kind, target_id }
  const hide = (hidden: boolean): FamilyHandler<E> => async (request, env) => {
    const shop = await deps.requireBundle(request, env, 'publish');
    if ('error' in shop) return shop.error;
    const body = await readBody(request);
    if (!body || !isTargetKind(body.target_kind) || typeof body.target_id !== 'string') {
      return refuse(400, 'Say what to hide.', 'validation_failed');
    }
    const owner = await targetAccount(env.DB, body.target_kind, body.target_id);
    // A hide only ever reaches what belongs to this shop: its own photographs, tastings and pages.
    if (!owner || owner !== shop.accountId) {
      return refuse(404, 'That is not in this shop.', 'target_not_found');
    }
    if (hidden) {
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO family_hides (account_id, target_kind, target_id, hidden_by) VALUES (?, ?, ?, ?)
           ON CONFLICT(account_id, target_kind, target_id) DO NOTHING`,
        ).bind(shop.accountId, body.target_kind, body.target_id, shop.userId),
        env.DB.prepare(
          `UPDATE family_reports SET status = 'acted', resolved_at = datetime('now'), resolved_by = ?
            WHERE account_id = ? AND target_kind = ? AND target_id = ? AND status = 'open'`,
        ).bind(shop.userId, shop.accountId, body.target_kind, body.target_id),
      ]);
    } else {
      await env.DB.prepare('DELETE FROM family_hides WHERE account_id = ? AND target_kind = ? AND target_id = ?')
        .bind(shop.accountId, body.target_kind, body.target_id).run();
    }
    return json({ target_kind: body.target_kind, target_id: body.target_id, hidden });
  };

  // GET /api/admin/family/reports?status=open
  const listReports: FamilyHandler<E> = async (request, env) => {
    const shop = await deps.requireBundle(request, env, 'publish');
    if ('error' in shop) return shop.error;
    const status = new URL(request.url).searchParams.get('status') || 'open';
    if (!['open', 'acted', 'dismissed'].includes(status)) return refuse(400, 'Unknown status.', 'validation_failed');
    const { results } = await env.DB.prepare(
      `SELECT id, target_kind, target_id, reason, status, created_at FROM family_reports
        WHERE account_id = ? AND status = ? ORDER BY created_at DESC LIMIT 200`,
    ).bind(shop.accountId, status).all<Parameters<typeof describeReports>[2][number]>();
    return json({ reports: await describeReports(env.DB, shop.accountId, results ?? [], env.JWT_SECRET) });
  };

  // POST /api/admin/family/reports/:id/dismiss
  const dismissReport: FamilyHandler<E> = async (request, env, params) => {
    const shop = await deps.requireBundle(request, env, 'publish');
    if ('error' in shop) return shop.error;
    const result = await env.DB.prepare(
      `UPDATE family_reports SET status = 'dismissed', resolved_at = datetime('now'), resolved_by = ?
        WHERE id = ? AND account_id = ? AND status = 'open'`,
    ).bind(shop.userId, params.id, shop.accountId).run();
    if (!Number(result.meta?.changes ?? 0)) return refuse(404, 'That report is not open in this shop.', 'report_not_found');
    return json({ id: params.id, status: 'dismissed' });
  };

  // GET /api/admin/family/restock-requests?status=open
  const listRestock: FamilyHandler<E> = async (request, env) => {
    const shop = await deps.requireBundle(request, env, 'publish');
    if ('error' in shop) return shop.error;
    const status = new URL(request.url).searchParams.get('status') || 'open';
    if (!['open', 'answered', 'closed'].includes(status)) return refuse(400, 'Unknown status.', 'validation_failed');
    const { results } = await env.DB.prepare(
      `SELECT r.id, r.product_id, COALESCE(NULLIF(p.given_name, ''), p.product_name) AS product_name,
              COALESCE(NULLIF(u.name, ''), u.username, 'A member') AS requester_name, u.email AS requester_email,
              r.note, r.status, r.created_at
         FROM restock_requests r
         JOIN users u ON u.id = r.requester_user_id
         LEFT JOIN products p ON p.id = r.product_id AND p.account_id = r.account_id
        WHERE r.account_id = ? AND r.status = ?
        ORDER BY r.created_at DESC LIMIT 200`,
    ).bind(shop.accountId, status).all();
    return json({ requests: results ?? [] });
  };

  // POST /api/admin/family/restock-requests/:id/answer
  const answerRestock: FamilyHandler<E> = async (request, env, params) => {
    const shop = await deps.requireBundle(request, env, 'publish');
    if ('error' in shop) return shop.error;
    const result = await env.DB.prepare(
      `UPDATE restock_requests SET status = 'answered', answered_at = datetime('now') WHERE id = ? AND account_id = ? AND status = 'open'`,
    ).bind(params.id, shop.accountId).run();
    if (!Number(result.meta?.changes ?? 0)) return refuse(404, 'That request is not open in this shop.', 'request_not_found');
    return json({ id: params.id, status: 'answered' });
  };

  return [
    ['POST', '/api/family/photographs', upload],
    ['PUT', '/api/family/photographs/:id/share', sharePhoto],
    ['PUT', '/api/family/photographs/:id/shape', shapePhoto],
    ['PUT', '/api/family/photographs/:id/credit', creditPhoto],
    ['POST', '/api/family/photographs/:id/remove', removePhoto],
    ['GET', '/api/family/teas/:productId/mine', myTea],
    ['GET', '/api/family/tasting-shares', tastingShares],
    ['PUT', '/api/family/teas/:productId/cover', setCover],
    ['PUT', '/api/family/teas/:productId/share', shareTasting],
    ['GET', '/api/family/teas/:productId/photographs', teaPhotographs],
    ['POST', '/api/family/teas/:productId/restock-request', restockRequest],
    ['POST', '/api/family/reports', report],
    ['GET', '/api/admin/family/photographs', offeredPile],
    ...OWNER_ACTIONS.map(action => ['POST', `/api/admin/family/photographs/:id/${action}`, ownerAction(action)] as [string, string, FamilyHandler<E>]),
    ['POST', '/api/admin/family/hide', hide(true)],
    ['POST', '/api/admin/family/unhide', hide(false)],
    ['GET', '/api/admin/family/reports', listReports],
    ['POST', '/api/admin/family/reports/:id/dismiss', dismissReport],
    ['GET', '/api/admin/family/restock-requests', listRestock],
    ['POST', '/api/admin/family/restock-requests/:id/answer', answerRestock],
    ...familyFeedbackRoutes(deps),
  ];
}

// ── Voice notes for members ────────────────────────────────────────────────

/**
 * `/api/transcribe` for everyone signed in. Shop staff (the `catalog` bundle)
 * go to the staff handler exactly as before. Anyone else signed in gets the
 * member path: two minutes, twenty a day, filed under the public shop.
 */
export function familyTranscribe<E extends FamilyEnv>(deps: FamilyDeps<E>, staff: FamilyHandler<E>): FamilyHandler<E> {
  return async (request, env, params, ctx) => {
    const member = await memberOnly(deps, request, env);
    if (!member) return staff(request, env, params, ctx);
    if ('error' in member) return member.error;
    const limited = await deps.enforceDurableLimit(env.PROVIDER_LIMITER, 'PROVIDER_LIMITER', `family:${member.userId}:transcribe`);
    if (limited) return limited;
    if (!hasTeaVoiceProvider(env)) return refuse(503, 'Voice notes are not available right now.', 'provider_unavailable');
    if (!(request.headers.get('Content-Type') || '').includes('multipart/form-data')) {
      return refuse(400, 'Expected multipart/form-data', 'invalid_content_type');
    }
    const declared = Number(request.headers.get('content-length') || '0');
    if (declared > FAMILY_VOICE_MAX_BYTES + MULTIPART_ALLOWANCE) return voiceTooLong();
    let form: FormData;
    try { form = await request.formData(); } catch { return refuse(400, 'The voice note did not arrive whole.', 'invalid_form'); }
    const seconds = Number(form.get('duration_seconds') ?? 0);
    if (Number.isFinite(seconds) && seconds > FAMILY_VOICE_MAX_SECONDS + 1) return voiceTooLong();
    const recording: unknown = form.get('file');
    if (!(recording instanceof File)) return refuse(400, 'No voice note arrived.', 'validation_failed');
    const mimeType = recording.type.split(';', 1)[0].trim();
    const file = mimeType === recording.type ? recording : new File([recording], recording.name, { type: mimeType });
    if (file.size > FAMILY_VOICE_MAX_BYTES) return voiceTooLong();
    const fileError = await deps.validateUpload(file, 'audio', FAMILY_VOICE_MAX_BYTES);
    if (fileError) return fileError;
    if (!env.MEDIA_BUCKET) return refuse(503, 'Voice notes cannot be stored right now.', 'storage_unavailable');

    const accountId = deps.publicAccountId;
    const today = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM private_recordings WHERE account_id = ? AND user_id = ? AND created_at >= datetime('now', '-1 day')`,
    ).bind(accountId, member.userId).first<{ n: number }>();
    if (Number(today?.n ?? 0) >= FAMILY_VOICE_NOTES_PER_DAY) {
      return refuse(429, 'That is as many voice notes as one day takes. Write the rest, or speak again tomorrow.', 'daily_voice_limit');
    }

    const recordingId = crypto.randomUUID();
    const ext = deps.safeUploadExtension(file.type);
    const key = `private-recordings/${accountId}/${member.userId}/${recordingId}.${ext}`;
    const bytes = await file.arrayBuffer();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await env.MEDIA_BUCKET.put(key, bytes, {
      httpMetadata: { contentType: file.type },
      customMetadata: { account_id: accountId, user_id: member.userId, expires_at: expiresAt },
    });
    await env.DB.prepare(
      `INSERT INTO private_recordings (id, account_id, user_id, object_key, mime_type, size_bytes, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    ).bind(recordingId, accountId, member.userId, key, file.type, file.size, expiresAt).run();
    return finishTranscription(env, recordingId, key, new File([bytes], file.name || `recording.${ext}`, { type: file.type }));
  };
}

/** `/api/transcriptions/:id/retry` for members; staff go to the staff handler. */
export function familyRetryTranscription<E extends FamilyEnv>(deps: FamilyDeps<E>, staff: FamilyHandler<E>): FamilyHandler<E> {
  return async (request, env, params, ctx) => {
    const member = await memberOnly(deps, request, env);
    if (!member) return staff(request, env, params, ctx);
    if ('error' in member) return member.error;
    const limited = await deps.enforceDurableLimit(env.PROVIDER_LIMITER, 'PROVIDER_LIMITER', `family:${member.userId}:transcribe-retry`);
    if (limited) return limited;
    if (!hasTeaVoiceProvider(env)) return refuse(503, 'Voice notes are not available right now.', 'provider_unavailable');
    const row = await env.DB.prepare(
      'SELECT id, object_key, mime_type, status, transcript FROM private_recordings WHERE id = ? AND account_id = ? AND user_id = ?',
    ).bind(params.id, deps.publicAccountId, member.userId).first<{ id: string; object_key: string; mime_type: string; status: string; transcript: string | null }>();
    if (!row) return refuse(404, 'That voice note is not yours.', 'recording_not_found');
    if (row.status === 'completed' && typeof row.transcript === 'string') {
      return json({ text: fixTeaVoiceText(row.transcript).text, recording_id: row.id });
    }
    const object = await env.MEDIA_BUCKET?.get(row.object_key);
    if (!object) return refuse(410, 'That voice note is no longer kept.', 'recording_expired');
    const bytes = await object.arrayBuffer();
    return finishTranscription(env, row.id, row.object_key, new File([bytes], `recording.${deps.safeUploadExtension(row.mime_type)}`, { type: row.mime_type }));
  };
}

const voiceTooLong = () => refuse(413, 'A voice note can be up to two minutes.', 'voice_note_too_long');

/**
 * Null when the caller is shop staff (the staff handler takes it unchanged),
 * an error when they are not signed in, otherwise the member.
 */
async function memberOnly<E extends FamilyEnv>(deps: FamilyDeps<E>, request: Request, env: E): Promise<Person | { error: Response } | null> {
  const staff = await deps.requireBundle(request, env, 'catalog');
  if (!('error' in staff)) return null;
  if (staff.error.status !== 403) return { error: staff.error };
  return deps.requireAuthenticatedUser(request, env);
}

/**
 * A member's voice note is only a way to write: once its words are saved the
 * audio is deleted (Adrian, 2026-11-21). The row stays, holding the words and
 * counting toward the day's limit. A failed note keeps its audio so it can be
 * retried, until the usual seven-day expiry removes it.
 */
async function finishTranscription(env: FamilyEnv, recordingId: string, objectKey: string, file: File): Promise<Response> {
  try {
    const raw = await transcribeTeaVoice(env, await file.arrayBuffer(), file.type, file.name);
    const fixed = fixTeaVoiceText(raw);
    await env.DB.prepare(
      "UPDATE private_recordings SET status = 'completed', transcript = ?, last_error_code = NULL, updated_at = datetime('now') WHERE id = ?",
    ).bind(raw, recordingId).run();
    // The words are saved; a failed delete leaves the audio to the expiry sweep.
    try { await env.MEDIA_BUCKET?.delete(objectKey); } catch { /* expiry removes it */ }
    return json({
      text: fixed.text,
      recording_id: recordingId,
      ...(fixed.fixes.length ? { raw_text: raw, word_fixes: fixed.fixes } : {}),
    });
  } catch (error) {
    const known = error instanceof TeaVoiceTranscriptionError;
    const code = known ? error.code : 'provider_error';
    await env.DB.prepare(
      "UPDATE private_recordings SET status = 'failed', last_error_code = ?, updated_at = datetime('now') WHERE id = ?",
    ).bind(code, recordingId).run();
    return json({ error: known ? error.message : 'Transcription failed', code, recording_id: recordingId, retryable: true }, known ? error.status : 502);
  }
}
