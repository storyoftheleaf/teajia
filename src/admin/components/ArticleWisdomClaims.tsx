/**
 * The Wisdom claims an article cites, in the article editor (Tea Wisdom pilot,
 * plan Phases 3 and 4). Contract: docs/_notes/tea-wisdom-claims.md.
 *
 * Read-only. Each use shows the claim, the revision the block was written
 * against and, when `articleUseNeedsReview` says so, a flag with the old and
 * the new claim text. The flag is computed here, against `claims`: pass the
 * set in use (GENERATED_CLAIMS, or the demo panel's overridden set). Left
 * out, the pilot data is used (wisdomPilotData.ts).
 */
import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { wisdomClaimUsesApi } from '../../lib/wisdomClaimUsesApi';
import type { ArticleBlock } from '../../types';
import type { DraftReferencePage, PublicClaim } from '../../wisdom/reference/claims';
import {
  claimUseFlag,
  reviewClaimUses,
  toArticleClaimUse,
  wisdomDestinations,
  type ClaimUseReview,
} from '../../pages/wisdom/articleClaimUses';
import { useWisdomPilotData } from '../../pages/wisdom/wisdomPilotData';

const HEADING = 'text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim font-medium';

function blockLabel(block: ArticleBlock | undefined, index: number): string {
  const text = block && 'text' in block && typeof block.text === 'string' ? block.text : '';
  const first = text.split(/(?<=[.!?])\s/)[0] ?? '';
  const excerpt = first.length > 90 ? `${first.slice(0, 87)}…` : first;
  return excerpt ? `Block ${index + 1} · ${excerpt}` : `Block ${index + 1}`;
}

const UseRow: React.FC<{ review: ClaimUseReview; block: ArticleBlock | undefined; href?: string }> = ({ review, block, href }) => {
  const flag = claimUseFlag(review);
  const { use, claim } = review;
  return (
    <li className="py-3 border-t border-tea-border first:border-t-0 space-y-1.5 min-w-0" data-claim-use={use.claimId} data-needs-review={review.needsReview ? 'true' : 'false'}>
      <p className="text-ui-11 text-tea-text-sec leading-relaxed break-words">{blockLabel(block, use.blockIndex)}</p>
      <p className="text-ui-12 text-tea-text leading-relaxed break-words">
        {href ? <Link to={href} className="text-tea-gold-lt underline underline-offset-2">{claim?.label ?? use.claimId}</Link> : (claim?.label ?? use.claimId)}
        <span className="text-tea-text-sec"> · {use.claimId} · rev {use.revUsed} · {use.useKind === 'live_block' ? 'live block' : 'prose'}</span>
      </p>
      {claim?.scope && <p className="text-ui-11 text-tea-text-sec leading-relaxed break-words">Scope: {claim.scope}</p>}
      {flag ? (
        <div className="rounded-md border border-tea-gold/30 bg-tea-gold/8 p-3 space-y-2" role="status">
          <p className="text-ui-12 text-tea-text font-medium leading-relaxed">{flag}</p>
          <div>
            <p className={HEADING}>Written against, rev {use.revUsed}</p>
            <p className="text-ui-12 text-tea-text-sec leading-relaxed break-words" data-claim-text-used>
              {review.textUsed ?? 'That revision is not in the claims set in use.'}
            </p>
          </div>
          <div>
            <p className={HEADING}>{review.currentRev ? `Now, rev ${review.currentRev}` : 'Now'}</p>
            <p className="text-ui-12 text-tea-text leading-relaxed break-words" data-claim-text-current>
              {review.currentText ?? (review.status === 'withdrawn' ? 'Withdrawn. Nothing public replaces it.' : 'Not public.')}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-ui-11 text-tea-text-sec leading-relaxed">
          {review.status === 'live' ? 'Shows the current approved text.' : 'Matches the current revision.'}
        </p>
      )}
    </li>
  );
};

export const ArticleWisdomClaims: React.FC<{
  articleId: string;
  blocks: readonly ArticleBlock[];
  /** The claims set to review against. Defaults to the pilot data. */
  claims?: readonly PublicClaim[];
  pages?: readonly DraftReferencePage[];
}> = ({ articleId, blocks, claims, pages }) => {
  const pilot = useWisdomPilotData();
  const claimSet = claims ?? pilot?.claims ?? [];
  const pageSet = pages ?? pilot?.pages ?? [];
  const query = useQuery({
    queryKey: ['article-wisdom-claim-uses', articleId],
    queryFn: () => wisdomClaimUsesApi.list(articleId),
  });
  const uses = useMemo(() => (query.data?.uses ?? []).map(toArticleClaimUse), [query.data]);
  // Flagged uses first, then in block order, so a review is never below the fold.
  const reviews = useMemo(
    () => reviewClaimUses(uses, claimSet).sort((a, b) => Number(b.needsReview) - Number(a.needsReview)),
    [uses, claimSet],
  );
  const destinations = useMemo(() => wisdomDestinations(uses.map(use => use.claimId), pageSet, true), [uses, pageSet]);
  const hrefFor = (claimId: string) => destinations.find(destination => claimId.startsWith(`${destination.pageId}:`))?.href;
  const flagged = reviews.filter(review => review.needsReview).length;

  return (
    <section aria-labelledby="article-wisdom-claims" data-article-wisdom-claims>
      <h3 id="article-wisdom-claims" className={`${HEADING} mb-3`}>Wisdom claims</h3>
      {query.isLoading && <p className="text-ui-12 text-tea-text-sec">Loading…</p>}
      {query.isError && <p className="text-ui-12 text-tea-text-sec">The claim uses could not be loaded.</p>}
      {query.data && uses.length === 0 && (
        <p className="text-ui-12 text-tea-text-sec leading-relaxed">This article records no Wisdom claims.</p>
      )}
      {uses.length > 0 && (
        <>
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mb-2">
            {uses.length} {uses.length === 1 ? 'use' : 'uses'}{flagged > 0 ? `, ${flagged} needing review` : ', all current'}.
          </p>
          {destinations.length > 0 && (
            <div className="mb-3">
              <p className={`${HEADING} mb-1`}>Wisdom pages cited</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {destinations.map(destination => (
                  <li key={destination.pageId}>
                    <Link to={destination.href} className="tap-target inline-flex items-center text-ui-12 text-tea-gold-lt underline underline-offset-2" data-wisdom-destination={destination.pageId}>
                      {destination.label}
                    </Link>
                    {destination.visibility === 'draft' && <span className="text-ui-11 text-tea-text-sec"> (draft)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ul className="list-none m-0 p-0">
            {reviews.map(review => (
              <UseRow
                key={`${review.use.blockIndex}|${review.use.claimId}`}
                review={review}
                block={blocks[review.use.blockIndex]}
                href={hrefFor(review.use.claimId)}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export default ArticleWisdomClaims;
