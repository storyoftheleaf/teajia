/**
 * The shop's side of a customer's offered tasting excerpt: list, approve,
 * pass, and choose where an approved excerpt is shown.
 *
 * Lifted out of the admin route handlers in index.ts so the routes and the MCP
 * tools (mcpTools/teaPageContent.ts) run the same statements. Each function
 * returns a status and a body rather than a Response; the routes wrap that in
 * `json(body, status)` exactly as they did before, and the tools read it.
 *
 * Every statement is bound to the caller's account. An offer, excerpt or
 * impression from another shop is "not found", never acted on.
 */
import { candidateToApi } from './tastingNoteCuration';

export type ReviewOutcome = { status: number; body: any };
export type ReviewScope = { accountId: string; userId: string };
export type ExcerptStatus = 'starred' | 'promoted' | 'dismissed';

export const MAX_EXCERPT_LENGTH = 2000;
export const MAX_BYLINE_LENGTH = 80;

export type ExcerptWords = { text: string; byline: string };

/**
 * The words the shop publishes for an excerpt (Adrian, 2026-11-25: the shop
 * may correct a spelling or a slip in a customer's words). Each of the excerpt
 * and the byline is the one given, trimmed, or the one already there when none
 * is given. The customer's original stays on the offer (source_text and its
 * byline), so a correction never loses what they wrote. A blank or overlong
 * value, or a byline detail, is refused.
 */
export function readExcerptWords(
  body: Record<string, unknown>, current: ExcerptWords,
): ExcerptWords | { error: string } {
  const pick = (value: unknown, fallback: string, max: number, label: string) => {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !value.trim()) return { error: `The ${label} cannot be blank` };
    if (value.trim().length > max) return { error: `The ${label} is longer than ${max} characters` };
    return value.trim();
  };
  if (body.attribution_detail !== undefined && body.attribution_detail !== null && body.attribution_detail !== '') {
    return { error: 'A byline detail is not published' };
  }
  const text = pick(body.edited_text, current.text, MAX_EXCERPT_LENGTH, 'excerpt');
  if (typeof text !== 'string') return text;
  const byline = pick(body.attribution_name, current.byline, MAX_BYLINE_LENGTH, 'byline');
  if (typeof byline !== 'string') return byline;
  return { text, byline };
}

/** The offer's words as the customer wrote them. */
export const offeredWords = (offer: Record<string, any>): ExcerptWords =>
  ({ text: String(offer.source_text ?? ''), byline: String(offer.attribution_name ?? '') });

/** One offer in this shop, whatever its status. */
export async function loadTastingExcerptOffer(db: D1Database, accountId: string, id: string) {
  return db.prepare(`
    SELECT * FROM tasting_note_candidates WHERE id = ? AND account_id = ? AND offered_at IS NOT NULL
  `).bind(id, accountId).first<Record<string, any>>();
}

export async function listTastingExcerptCandidates(db: D1Database, accountId: string, status: ExcerptStatus) {
  const { results } = await db.prepare(`
    SELECT c.*, i.id AS impression_id, i.show_on_listing, i.show_on_main_page,
           i.text AS published_text, i.attribution_name AS published_name,
           COALESCE(p.given_name, p.product_name) AS product_name
    FROM tasting_note_candidates c
    JOIN products p ON p.id = c.product_id AND p.account_id = c.account_id
    LEFT JOIN product_impressions i ON i.candidate_id = c.id AND i.account_id = c.account_id AND c.status = 'promoted'
    WHERE c.account_id = ? AND c.status = ? AND c.offered_at IS NOT NULL
    ORDER BY c.offered_at DESC
  `).bind(accountId, status).all<Record<string, any>>();
  return results.map(row => ({
    ...candidateToApi(row), productName: row.product_name, impressionId: row.impression_id,
    showOnListing: row.show_on_listing === 1, showOnMainPage: row.show_on_main_page === 1,
    // What the page shows, which may be the shop's correction of sourceText.
    publishedText: row.published_text ?? null, publishedName: row.published_name ?? null,
  }));
}

export async function approveTastingExcerptOffer(
  db: D1Database, scope: ReviewScope, id: string, body: Record<string, unknown>,
): Promise<ReviewOutcome> {
  const offer = await loadTastingExcerptOffer(db, scope.accountId, id);
  if (!offer) return { status: 404, body: { error: 'Offer not found' } };
  const words = readExcerptWords(body, offeredWords(offer));
  if ('error' in words) return { status: 422, body: { error: words.error } };
  if (offer.status !== 'starred') return { status: 409, body: { error: 'Offer already resolved' } };
  const corrected = words.text === offer.source_text ? null : words.text;

  const now = new Date().toISOString();
  const impressionId = crypto.randomUUID();
  try {
    const [impression] = await db.batch([
      db.prepare(`
        INSERT INTO product_impressions
          (id, account_id, product_id, candidate_id, text, attribution_name, published_at, published_by, created_at)
        SELECT ?, account_id, product_id, id, ?, ?, ?, ?, ?
        FROM tasting_note_candidates WHERE id = ? AND account_id = ? AND offered_at = ? AND status = 'starred'
        ON CONFLICT(candidate_id) DO UPDATE SET id = excluded.id, product_id = excluded.product_id,
          account_id = excluded.account_id, text = excluded.text, attribution_name = excluded.attribution_name,
          attribution_detail = NULL, published_at = excluded.published_at, published_by = excluded.published_by,
          show_on_listing = 0, show_on_main_page = 0
      `).bind(impressionId, words.text, words.byline, now, scope.userId, now, id, scope.accountId, offer.offered_at),
      db.prepare(`
        UPDATE tasting_note_candidates SET status = 'promoted', edited_text = ?, promoted_at = ?, promoted_by = ?, updated_at = ?
        WHERE id = ? AND account_id = ? AND status = 'starred'
          AND EXISTS (SELECT 1 FROM product_impressions WHERE id = ? AND candidate_id = tasting_note_candidates.id)
      `).bind(corrected, now, scope.userId, now, id, scope.accountId, impressionId),
    ]);
    if (!impression.meta.changes) return { status: 409, body: { error: 'Offer already resolved or withdrawn' } };
  } catch {
    return { status: 500, body: { error: 'Approval could not be completed', retryable: true } };
  }
  return {
    status: 201,
    body: {
      id: impressionId, status: 'promoted', productId: offer.product_id, text: words.text,
      attributionName: words.byline, attributionDetail: null, publishedAt: now,
      corrected: corrected !== null || words.byline !== offer.attribution_name,
      showOnListing: false, showOnMainPage: false,
    },
  };
}

export async function dismissTastingExcerptOffer(db: D1Database, scope: ReviewScope, id: string): Promise<ReviewOutcome> {
  const now = new Date().toISOString();
  const result = await db.prepare(`
    UPDATE tasting_note_candidates SET status = 'dismissed', dismissed_at = ?, dismissed_by = ?, updated_at = ?
    WHERE id = ? AND account_id = ? AND status = 'starred' AND offered_at IS NOT NULL
  `).bind(now, scope.userId, now, id, scope.accountId).run();
  return result.meta.changes
    ? { status: 200, body: { success: true } }
    : { status: 409, body: { error: 'Pending offer not found' } };
}

export type PlacementInput = { listing: boolean | undefined; mainPage: boolean | undefined };

/** One or both booleans, nothing else. Null when the body does not say either. */
export function readExcerptPlacements(body: Record<string, unknown> | null): PlacementInput | null {
  const listing = body?.show_on_listing;
  const mainPage = body?.show_on_main_page;
  if ((listing === undefined && mainPage === undefined)
      || (listing !== undefined && typeof listing !== 'boolean')
      || (mainPage !== undefined && typeof mainPage !== 'boolean')) {
    return null;
  }
  return { listing: listing as boolean | undefined, mainPage: mainPage as boolean | undefined };
}

/** The condition that makes an impression an approved customer excerpt. */
const APPROVED_EXCERPT = `EXISTS (
      SELECT 1 FROM tasting_note_candidates c WHERE c.id = product_impressions.candidate_id
        AND c.account_id = product_impressions.account_id AND c.product_id = product_impressions.product_id
        AND c.offered_at IS NOT NULL AND c.status = 'promoted'
    )`;

/** An approved excerpt in this shop with its current placements, for a preview. */
export async function loadApprovedExcerpt(db: D1Database, accountId: string, impressionId: string) {
  return db.prepare(`
    SELECT id, product_id, candidate_id, text, attribution_name, show_on_listing, show_on_main_page
    FROM product_impressions WHERE id = ? AND account_id = ? AND ${APPROVED_EXCERPT}
  `).bind(impressionId, accountId).first<Record<string, any>>();
}

export async function setTastingExcerptPlacements(
  db: D1Database, accountId: string, impressionId: string, input: PlacementInput,
): Promise<ReviewOutcome> {
  const row = await db.prepare(`
    UPDATE product_impressions SET show_on_listing = COALESCE(?, show_on_listing),
      show_on_main_page = COALESCE(?, show_on_main_page)
    WHERE id = ? AND account_id = ? AND ${APPROVED_EXCERPT}
    RETURNING show_on_listing, show_on_main_page
  `).bind(input.listing === undefined ? null : Number(input.listing), input.mainPage === undefined ? null : Number(input.mainPage),
    impressionId, accountId).first<{ show_on_listing: number; show_on_main_page: number }>();
  return row
    ? { status: 200, body: { showOnListing: row.show_on_listing === 1, showOnMainPage: row.show_on_main_page === 1 } }
    : { status: 404, body: { error: 'Approved excerpt not found' } };
}

/**
 * Correct the words of an approved excerpt in place: a spelling, a slip, the
 * byline. Where it shows does not change. The customer's original stays on
 * the offer; the offer's edited_text records the shop's version (NULL when it
 * is the customer's own again).
 */
export async function correctApprovedExcerpt(
  db: D1Database, accountId: string, impressionId: string, words: ExcerptWords,
): Promise<ReviewOutcome> {
  const [row] = await db.batch([
    db.prepare(`
      UPDATE product_impressions SET text = ?, attribution_name = ?
      WHERE id = ? AND account_id = ? AND ${APPROVED_EXCERPT}
      RETURNING id, product_id, candidate_id, text, attribution_name, show_on_listing, show_on_main_page
    `).bind(words.text, words.byline, impressionId, accountId),
    db.prepare(`
      UPDATE tasting_note_candidates SET edited_text = CASE WHEN source_text = ? THEN NULL ELSE ? END, updated_at = ?
      WHERE account_id = ? AND status = 'promoted'
        AND id = (SELECT candidate_id FROM product_impressions WHERE id = ? AND account_id = ?)
    `).bind(words.text, words.text, new Date().toISOString(), accountId, impressionId, accountId),
  ]);
  const updated = (row.results as Record<string, any>[] | undefined)?.[0];
  if (!updated) return { status: 404, body: { error: 'Approved excerpt not found' } };
  return {
    status: 200,
    body: {
      id: updated.id, productId: updated.product_id, text: updated.text, attributionName: updated.attribution_name,
      showOnListing: updated.show_on_listing === 1, showOnMainPage: updated.show_on_main_page === 1,
    },
  };
}
