/**
 * Teajia family, stage 4: what a person's page shows of their tastings, and
 * who the people list calls "The family". Plan: todo/plans/teajia-family.md.
 *
 * A tasting is on a person's page only when they shared it (state 'page' or
 * 'offered' in member_tasting_shares). Words come from the dated notes inside
 * the journal's `tastings` list and nothing else: this module selects that one
 * column and never `note`, `rating`, `verdict` or `personalNote`, so the score
 * cannot reach a page. Photographs are the ones the person shared and has not
 * removed from their page.
 *
 * The owner's hides apply here: a whole page (family_hides 'page' by
 * contributor id, from the shop that holds the page), one tasting ('tasting' by journal id) and
 * one photograph ('photograph' by id).
 *
 * The SQL pieces are exported as strings so index.ts can use them on lines it
 * already has, without adding lines to the pinned worker type check.
 */
import { isFamilyPhotographShape, readFamilyPhotographFrame, type FamilyPersonPhotograph, type FamilyPersonTasting, type FamilyPersonWord } from '../../src/lib/familyContract';
import { photographBy } from './photographCredit';

const MEDIA_PREFIX = 'https://media.teajia.co/';
const mediaUrl = (key: string) => `${MEDIA_PREFIX}${key}`;

/** True when the shop that holds this page has not hidden it. A hide by another shop never reaches it. Needs the contributors row aliased `c`. */
export const FAMILY_PAGE_NOT_HIDDEN_SQL =
  `NOT EXISTS (SELECT 1 FROM family_hides fh WHERE fh.target_kind = 'page' AND fh.target_id = c.id AND fh.account_id = c.account_id)`;

export const TASTING_NOT_HIDDEN =
  `NOT EXISTS (SELECT 1 FROM family_hides h WHERE h.account_id = s.account_id AND h.target_kind = 'tasting' AND h.target_id = s.journal_entry_id)`;
export const PHOTO_NOT_HIDDEN =
  `NOT EXISTS (SELECT 1 FROM family_hides h WHERE h.account_id = p.account_id AND h.target_kind = 'photograph' AND h.target_id = p.id)`;
/**
 * True unless the owner hid the tasting this photograph belongs to (A4 review,
 * finding 3): a hidden tasting takes its photographs with it. A photograph
 * belongs to the tasting its journal row names; one that names no journal row
 * belongs to its author's tasting of that tea. A photograph that names another
 * journal row is never taken with it (launch-5 flags-off audit): hiding one
 * tasting does not hide a photograph of a different one.
 * Needs the member_photographs row aliased `p`.
 */
export const PHOTO_TASTING_NOT_HIDDEN =
  `NOT EXISTS (SELECT 1 FROM family_hides ht WHERE ht.account_id = p.account_id AND ht.target_kind = 'tasting'
     AND (ht.target_id = p.journal_entry_id OR (p.journal_entry_id IS NULL AND ht.target_id IN (
       SELECT ts.journal_entry_id FROM member_tasting_shares ts
        WHERE ts.author_user_id = p.author_user_id AND ts.product_id = p.product_id))))`;
/** True unless the owner hid the tasting a quote came from. Needs the tasting_note_candidates row aliased `c`. */
export const QUOTE_TASTING_NOT_HIDDEN =
  `NOT EXISTS (SELECT 1 FROM family_hides hq WHERE hq.account_id = c.account_id AND hq.target_kind = 'tasting' AND hq.target_id = c.journal_entry_id)`;

/** The newest moment a person shared a tasting or a photograph. Needs the contributors row aliased `c`. */
export const FAMILY_LAST_ACTIVE_COLUMN =
  `(SELECT MAX(t) FROM (
      SELECT COALESCE(s.shared_at, s.updated_at) AS t FROM member_tasting_shares s
       WHERE s.author_user_id = c.user_id AND s.share_state IN ('page', 'offered') AND ${TASTING_NOT_HIDDEN}
      UNION ALL
      SELECT p.updated_at AS t FROM member_photographs p
       WHERE p.author_user_id = c.user_id AND p.share_state IN ('page', 'offered')
         AND p.removed_by_member_at IS NULL AND ${PHOTO_NOT_HIDDEN}
    )) AS family_last_active`;

const MAX_TEAS = 60;
const MAX_NOTES_PER_TEA = 30;
const MAX_PHOTOS_PER_TEA = 6;

/** The dated notes of one journal row's `tastings` list. Notes that came from other people or from another journal row are left out. */
export function wordsFromSittings(raw: unknown): FamilyPersonWord[] {
  let sittings: unknown;
  try { sittings = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
  if (!Array.isArray(sittings)) return [];
  const seen = new Set<string>();
  const words: FamilyPersonWord[] = [];
  for (const sitting of sittings as Array<Record<string, any>>) {
    const sat = typeof sitting?.createdAt === 'string' ? sitting.createdAt : null;
    const notes = sitting?.tasting?.notes;
    const list: unknown[] = Array.isArray(notes) ? notes : (typeof notes === 'string' ? [notes] : []);
    for (const note of list) {
      const text = typeof note === 'string' ? note : (note && typeof (note as any).text === 'string' ? (note as any).text : '');
      const clean = text.trim();
      if (!clean || seen.has(clean)) continue;
      // Words that came from someone else, or that were carried over from another journal row, are not this sitting's.
      if (note && typeof note === 'object' && ((note as any).sourceAuthor || (note as any).sourceJournalEntryId)) continue;
      seen.add(clean);
      const written = note && typeof note === 'object' && typeof (note as any).capturedAt === 'string' ? (note as any).capturedAt : sat;
      words.push({ date: written && !Number.isNaN(new Date(written).getTime()) ? written : null, text: clean });
    }
  }
  words.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  return words.slice(-MAX_NOTES_PER_TEA);
}

type ShareRow = { product_id: string; journal_entry_id: string; tastings: string | null; at: string | null };
function storedFrame(text: string | null | undefined) {
  if (!text) return null;
  try { return readFamilyPhotographFrame(JSON.parse(text)) ?? null; } catch { return null; }
}

type PhotoRow = {
  id: string; product_id: string; small_key: string; full_key: string; small_width: number; small_height: number; shape?: string | null; frame?: string | null; at: string | null;
  credit_name_shown: number | null;
};
type ProductRow = {
  id: string; name: string | null; chinese_name: string | null; slug: string | null; status: string | null;
  stock_grams: number | null; account_slug: string;
};

/** The teas a person has shared, newest first, as their page shows them. */
export async function personTastings(db: D1Database, userId: string | null | undefined, authorName: string | null, credit = false): Promise<FamilyPersonTasting[]> {
  if (!userId) return [];
  const [shares, photos] = await Promise.all([
    db.prepare(
      `SELECT s.product_id, s.journal_entry_id, j.tastings, COALESCE(s.shared_at, s.updated_at) AS at
         FROM member_tasting_shares s
         JOIN customer_tasting_journal j ON j.id = s.journal_entry_id
        WHERE s.author_user_id = ? AND s.share_state IN ('page', 'offered')
          AND COALESCE(j.archived, 0) = 0 AND ${TASTING_NOT_HIDDEN}
        ORDER BY at DESC LIMIT ?`,
    ).bind(userId, MAX_TEAS).all<ShareRow>(),
    db.prepare(
      `SELECT p.id, p.product_id, p.small_key, p.full_key, p.small_width, p.small_height, p.shape, p.frame, p.credit_name_shown, p.updated_at AS at
         FROM member_photographs p
        WHERE p.author_user_id = ? AND p.share_state IN ('page', 'offered')
          AND p.removed_by_member_at IS NULL AND ${PHOTO_NOT_HIDDEN} AND ${PHOTO_TASTING_NOT_HIDDEN}
        ORDER BY p.created_at, p.id LIMIT 400`,
    ).bind(userId).all<PhotoRow>(),
  ]);

  const order: string[] = [];
  const latest = new Map<string, string>();
  const words = new Map<string, FamilyPersonWord[]>();
  for (const share of shares.results ?? []) {
    if (!order.includes(share.product_id)) order.push(share.product_id);
    latest.set(share.product_id, share.at ?? '');
    words.set(share.product_id, wordsFromSittings(share.tastings));
  }
  const pictures = new Map<string, FamilyPersonPhotograph[]>();
  for (const photo of photos.results ?? []) {
    const list = pictures.get(photo.product_id) ?? [];
    if (list.length >= MAX_PHOTOS_PER_TEA) continue;
    list.push({
      id: photo.id, small_url: mediaUrl(photo.small_key), full_url: mediaUrl(photo.full_key),
      small_width: Number(photo.small_width), small_height: Number(photo.small_height),
      shape: isFamilyPhotographShape(photo.shape) ? photo.shape : 'square',
      frame: storedFrame(photo.frame),
      // "Photograph by" opens with the Tea Table (A4 review, finding 11).
      ...(credit ? { photograph_by: photographBy(photo, authorName) } : {}),
    });
    pictures.set(photo.product_id, list);
    if (!order.includes(photo.product_id)) order.push(photo.product_id);
    if ((photo.at ?? '') > (latest.get(photo.product_id) ?? '')) latest.set(photo.product_id, photo.at ?? '');
  }
  if (order.length === 0) return [];
  order.sort((a, b) => (latest.get(b) ?? '').localeCompare(latest.get(a) ?? ''));
  const ids = order.slice(0, MAX_TEAS);

  const { results } = await db.prepare(
    `SELECT p.id, COALESCE(NULLIF(p.given_name, ''), p.product_name) AS name, p.chinese_name, p.slug, p.status,
            p.stock_grams, a.slug AS account_slug
       FROM products p JOIN accounts a ON a.id = p.account_id
      WHERE p.id IN (${ids.map(() => '?').join(',')})
        AND p.is_public = 1 AND p.shown_in_shop = 1 AND p.status IN ('Active', 'Sold Out')
        AND a.status = 'active' AND a.public_enabled = 1`,
  ).bind(...ids).all<ProductRow>();
  const byId = new Map((results ?? []).map(row => [row.id, row]));

  const out: FamilyPersonTasting[] = [];
  for (const id of ids) {
    const product = byId.get(id);
    if (!product || !product.name) continue;
    out.push({
      product_id: id,
      name: product.name,
      chinese_name: product.chinese_name ?? null,
      public_path: `/shop/product/${encodeURIComponent(product.slug || product.id)}?store=${encodeURIComponent(product.account_slug)}`,
      sold_out: product.status === 'Sold Out' || (product.stock_grams != null && Number(product.stock_grams) <= 0),
      words: words.get(id) ?? [],
      photographs: pictures.get(id) ?? [],
    });
  }
  return out;
}
