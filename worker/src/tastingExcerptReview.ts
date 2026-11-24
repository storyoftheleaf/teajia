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

/**
 * The shop approves the words as the customer offered them. Only the author
 * can change the excerpt or the byline; an approval carrying anything else is
 * refused.
 */
export function matchesTastingOffer(body: Record<string, unknown>, offer: Record<string, any>) {
  return (body.edited_text === undefined || body.edited_text === offer.source_text)
    && (body.attribution_name === undefined || body.attribution_name === offer.attribution_name)
    && (body.attribution_detail === undefined || body.attribution_detail === null
      || body.attribution_detail === '');
}

/** One offer in this shop, whatever its status. */
export async function loadTastingExcerptOffer(db: D1Database, accountId: string, id: string) {
  return db.prepare(`
    SELECT * FROM tasting_note_candidates WHERE id = ? AND account_id = ? AND offered_at IS NOT NULL
  `).bind(id, accountId).first<Record<string, any>>();
}

export async function listTastingExcerptCandidates(db: D1Database, accountId: string, status: ExcerptStatus) {
  const { results } = await db.prepare(`
    SELECT c.*, i.id AS impression_id, i.show_on_listing, i.show_on_main_page,
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
  }));
}

export async function approveTastingExcerptOffer(
  db: D1Database, scope: ReviewScope, id: string, body: Record<string, unknown>,
): Promise<ReviewOutcome> {
  const offer = await loadTastingExcerptOffer(db, scope.accountId, id);
  if (!offer) return { status: 404, body: { error: 'Offer not found' } };
  if (!matchesTastingOffer(body, offer)) return { status: 422, body: { error: 'Approval must use the offered excerpt and byline' } };
  if (offer.status !== 'starred') return { status: 409, body: { error: 'Offer already resolved' } };

  const now = new Date().toISOString();
  const impressionId = crypto.randomUUID();
  try {
    const [impression] = await db.batch([
      db.prepare(`
        INSERT INTO product_impressions
          (id, account_id, product_id, candidate_id, text, attribution_name, published_at, published_by, created_at)
        SELECT ?, account_id, product_id, id, source_text, attribution_name, ?, ?, ?
        FROM tasting_note_candidates WHERE id = ? AND account_id = ? AND offered_at = ? AND status = 'starred'
        ON CONFLICT(candidate_id) DO UPDATE SET id = excluded.id, product_id = excluded.product_id,
          account_id = excluded.account_id, text = excluded.text, attribution_name = excluded.attribution_name,
          attribution_detail = NULL, published_at = excluded.published_at, published_by = excluded.published_by,
          show_on_listing = 0, show_on_main_page = 0
      `).bind(impressionId, now, scope.userId, now, id, scope.accountId, offer.offered_at),
      db.prepare(`
        UPDATE tasting_note_candidates SET status = 'promoted', promoted_at = ?, promoted_by = ?, updated_at = ?
        WHERE id = ? AND account_id = ? AND status = 'starred'
          AND EXISTS (SELECT 1 FROM product_impressions WHERE id = ? AND candidate_id = tasting_note_candidates.id)
      `).bind(now, scope.userId, now, id, scope.accountId, impressionId),
    ]);
    if (!impression.meta.changes) return { status: 409, body: { error: 'Offer already resolved or withdrawn' } };
  } catch {
    return { status: 500, body: { error: 'Approval could not be completed', retryable: true } };
  }
  return {
    status: 201,
    body: {
      id: impressionId, status: 'promoted', productId: offer.product_id, text: offer.source_text,
      attributionName: offer.attribution_name, attributionDetail: null, publishedAt: now,
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
