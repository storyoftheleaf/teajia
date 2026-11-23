import type { CitedClaimHistory } from '../../lib/wisdomClaimUsesApi';
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

export function reviewClaimUse(use: ArticleClaimUse, claims: readonly PublicClaim[], history?: CitedClaimHistory): ClaimUseReview {
  const claim = claims.find(candidate => candidate.claimId === use.claimId);
  const needsReview = articleUseNeedsReview(use, claim);
  const usedRevision = claim?.previousRevisions?.find(revision => revision.rev === use.revUsed);
  const textUsed = usedRevision?.text ?? history?.text ?? (claim && claim.rev === use.revUsed ? claim.text : null);
  const withdrawn = claim ? claim.reviewState === 'withdrawn' : Boolean(history?.withdrawn);
  const live = claim && !withdrawn && claim.rev !== null;
  const status: ClaimUseStatus = withdrawn ? 'withdrawn'
    : !live ? 'not_public'
    : use.useKind === 'live_block' ? 'live'
    : needsReview ? 'changed' : 'current';
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

export function reviewClaimUses(uses: readonly ArticleClaimUse[], claims: readonly PublicClaim[], history: readonly CitedClaimHistory[] = []): ClaimUseReview[] {
  return uses.map(use => reviewClaimUse(use, claims, history.find(item => item.claim_id === use.claimId && item.rev_used === use.revUsed)));
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
    case 'named_tea': return `/wisdom/named/${pageId}`;
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

// ── Editing an article's uses ────────────────────────────────────────────────

/** What the worker's replace route takes. */
export interface ClaimUseInput {
  block_index: number;
  claim_id: string;
  rev_used: number;
  use_kind: 'prose' | 'live_block';
}

export function toClaimUseInput(use: ArticleClaimUse): ClaimUseInput {
  return { block_index: use.blockIndex, claim_id: use.claimId, rev_used: use.revUsed, use_kind: use.useKind };
}

const sameUse = (a: Pick<ArticleClaimUse, 'blockIndex' | 'claimId'>, b: Pick<ArticleClaimUse, 'blockIndex' | 'claimId'>) =>
  a.blockIndex === b.blockIndex && a.claimId === b.claimId;

/** A claim can be cited only at an approved revision that is still public. */
export function citableClaims<T extends PublicClaim>(claims: readonly T[]): T[] {
  return claims.filter(claim => claim.rev !== null && claim.reviewState !== 'withdrawn');
}

/** Record a claim on a block at its current revision. Re-adding the same pair replaces it. */
export function addClaimUse(
  uses: readonly ArticleClaimUse[],
  articleId: string,
  blockIndex: number,
  claim: Pick<PublicClaim, 'claimId' | 'rev'>,
  useKind: ArticleClaimUse['useKind'],
): ArticleClaimUse[] {
  if (claim.rev === null) return [...uses];
  const next: ArticleClaimUse = { articleId, blockIndex, claimId: claim.claimId, revUsed: claim.rev, useKind };
  return [...uses.filter(use => !sameUse(use, next)), next].sort((a, b) => a.blockIndex - b.blockIndex || a.claimId.localeCompare(b.claimId));
}

export function removeClaimUse(uses: readonly ArticleClaimUse[], target: ArticleClaimUse): ArticleClaimUse[] {
  return uses.filter(use => !sameUse(use, target));
}

/** After the sentence has been checked against the new text: the use now rests on the current revision. */
export function markClaimUseReviewed(uses: readonly ArticleClaimUse[], target: ArticleClaimUse, currentRev: number): ArticleClaimUse[] {
  return uses.map(use => (sameUse(use, target) ? { ...use, revUsed: currentRev } : use));
}

const words = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '');

/**
 * Claims whose page is named in a block's text come first, so a writer working
 * on any tea sees the likely entries without searching. A page is "named" when
 * its label appears in the block; a page label shorter than four letters never
 * counts, to keep "Tea" and similar from matching everything.
 */
export function suggestClaimsForBlock<T extends PublicClaim>(
  blockText: string,
  claims: readonly T[],
  pages: readonly Pick<DraftReferencePage, 'id' | 'label'>[],
): T[] {
  const text = words(blockText);
  const named = new Set(pages.filter(page => page.label.length >= 4 && text.includes(words(page.label))).map(page => page.id));
  return citableClaims(claims).filter(claim => named.has(claim.pageId));
}

export function searchClaims<T extends PublicClaim>(query: string, claims: readonly T[], limit = 30): T[] {
  const needle = words(query.trim());
  const citable = citableClaims(claims);
  if (!needle) return citable.slice(0, limit);
  return citable
    .filter(claim => words(`${claim.claimId} ${claim.label} ${claim.text} ${claim.terms.map(term => `${term.original} ${term.pinyin} ${term.gloss}`).join(' ')}`).includes(needle))
    .slice(0, limit);
}
