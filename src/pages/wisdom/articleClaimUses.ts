/**
 * Tea Wisdom pilot: an article's claim uses, read against a claims set.
 * Contract: docs/_notes/tea-wisdom-claims.md, "Article claim uses".
 *
 * The worker stores uses; whether one needs review is decided here, with
 * `articleUseNeedsReview`, against whatever claims set the caller passes in
 * (GENERATED_CLAIMS once it carries these pages, the pilot fixtures until then,
 * or the overridden set on the demo panel).
 */
import {
  articleUseNeedsReview,
  type ArticleClaimUse,
  type DraftReferencePage,
  type PublicClaim,
} from '../../wisdom/reference/claims';

/** As the worker returns it. */
export interface ArticleClaimUseRow {
  article_id: string;
  block_index: number;
  claim_id: string;
  rev_used: number;
  use_kind: 'prose' | 'live_block';
}

export function toArticleClaimUse(row: ArticleClaimUseRow): ArticleClaimUse {
  return {
    articleId: row.article_id,
    blockIndex: row.block_index,
    claimId: row.claim_id,
    revUsed: row.rev_used,
    useKind: row.use_kind,
  };
}

export type ClaimUseStatus = 'current' | 'changed' | 'withdrawn' | 'not_public' | 'live';

export interface ClaimUseReview {
  use: ArticleClaimUse;
  claim: PublicClaim | undefined;
  needsReview: boolean;
  status: ClaimUseStatus;
  /** The claim text the block was written against, when the claims set still has it. */
  textUsed: string | null;
  /** The claim's current text; null when it is withdrawn or not in the set. */
  currentText: string | null;
  currentRev: number | null;
}

export function reviewClaimUse(use: ArticleClaimUse, claims: readonly PublicClaim[]): ClaimUseReview {
  const claim = claims.find(candidate => candidate.claimId === use.claimId);
  const needsReview = articleUseNeedsReview(use, claim);
  const usedRevision = claim?.previousRevisions?.find(revision => revision.rev === use.revUsed);
  const textUsed = usedRevision?.text ?? (claim && claim.rev === use.revUsed ? claim.text : null);
  const withdrawn = claim?.reviewState === 'withdrawn';
  const live = claim && !withdrawn && claim.rev !== null;
  const status: ClaimUseStatus = use.useKind === 'live_block'
    ? 'live'
    : !claim || claim.rev === null ? 'not_public'
    : withdrawn ? 'withdrawn'
    : needsReview ? 'changed'
    : 'current';
  return {
    use,
    claim,
    needsReview,
    status,
    textUsed,
    currentText: live ? claim.text : null,
    currentRev: live ? claim.rev : null,
  };
}

export function reviewClaimUses(uses: readonly ArticleClaimUse[], claims: readonly PublicClaim[]): ClaimUseReview[] {
  return uses.map(use => reviewClaimUse(use, claims));
}

/** The plain-language flag line for a use that needs review. */
export function claimUseFlag(review: ClaimUseReview): string | null {
  if (!review.needsReview) return null;
  if (review.status === 'changed') return `Needs review: claim changed, rev ${review.use.revUsed} → ${review.currentRev}`;
  if (review.status === 'withdrawn') return `Needs review: claim withdrawn after rev ${review.use.revUsed}`;
  return `Needs review: claim is not public, written against rev ${review.use.revUsed}`;
}

export function pageIdOfClaim(claimId: string): string {
  return claimId.split(':')[0] ?? claimId;
}

type PageKind = DraftReferencePage['kind'];

/** Where a Wisdom page is read. Reference topics have no page of their own yet. */
export function wisdomPageHref(pageId: string, kind: PageKind): string | null {
  switch (kind) {
    case 'leaf_grade': return `/wisdom/grade/${pageId}`;
    case 'tea_type': return `/wisdom/type/${pageId}`;
    case 'tea_family': return `/wisdom/family/${pageId}`;
    case 'major_region':
    case 'tea_area': return `/wisdom/region/${pageId}`;
    default: return null;
  }
}

export interface WisdomDestination {
  pageId: string;
  label: string;
  href: string;
  visibility: 'public' | 'draft';
}

/**
 * The Wisdom pages a set of claim ids lands on, one per page. A draft page is
 * a destination only for a signed-in editor: a signed-out reader never gets a
 * link to a page that answers not found.
 */
export function wisdomDestinations(
  claimIds: readonly string[],
  pages: readonly Pick<DraftReferencePage, 'id' | 'label' | 'kind' | 'visibility'>[],
  signedIn: boolean,
): WisdomDestination[] {
  const seen = new Set<string>();
  const out: WisdomDestination[] = [];
  for (const claimId of claimIds) {
    const pageId = pageIdOfClaim(claimId);
    if (seen.has(pageId)) continue;
    seen.add(pageId);
    const page = pages.find(candidate => candidate.id === pageId);
    if (!page) continue;
    if (page.visibility !== 'public' && !signedIn) continue;
    const href = wisdomPageHref(page.id, page.kind);
    if (!href) continue;
    out.push({ pageId: page.id, label: page.label, href, visibility: page.visibility });
  }
  return out;
}
