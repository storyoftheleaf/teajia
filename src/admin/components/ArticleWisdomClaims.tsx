/**
 * The Wisdom claims an article cites, in the article editor (Tea Wisdom).
 * Contract: docs/_notes/tea-wisdom-claims.md, "Article claim uses".
 *
 * For any tea: pick a block, pick a claim from the claims set (claims whose page
 * the block names are suggested first), and it is recorded at the claim's
 * current revision. When a claim moves on, `articleUseNeedsReview` flags the
 * use with the old and the new text; "Mark reviewed" moves the use onto the
 * current revision once the sentence has been checked.
 *
 * The flag is computed against `claims`: pass the set in use (GENERATED_CLAIMS,
 * or the demo panel's overridden set). Left out, wisdomPilotData.ts is used.
 */
import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../lib/store';
import { wisdomClaimUsesApi } from '../../lib/wisdomClaimUsesApi';
import { Button } from '../../components/shared/Button';
import type { ArticleBlock } from '../../types';
import type { ArticleClaimUse, DraftReferencePage, PublicClaim } from '../../wisdom/reference/claims';
import {
  addClaimUse,
  claimUseFlag,
  markClaimUseReviewed,
  removeClaimUse,
  reviewClaimUses,
  searchClaims,
  suggestClaimsForBlock,
  toArticleClaimUse,
  toClaimUseInput,
  wisdomDestinations,
  type ClaimUseReview,
} from '../../pages/wisdom/articleClaimUses';
import { useWisdomPilotData } from '../../pages/wisdom/wisdomPilotData';

const HEADING = 'text-ui-10 uppercase tracking-[0.2em] text-tea-text-dim font-medium';
const FIELD = 'w-full border-b border-tea-border bg-transparent focus:border-tea-gold outline-none text-sm text-tea-text py-2 [color-scheme:dark]';

function blockText(block: ArticleBlock | undefined): string {
  if (!block) return '';
  const parts: string[] = [];
  for (const key of ['text', 'body', 'sidebar', 'title', 'subtitle'] as const) {
    const value = (block as Record<string, unknown>)[key];
    if (typeof value === 'string') parts.push(value);
  }
  return parts.join(' ');
}

function blockLabel(block: ArticleBlock | undefined, index: number): string {
  const first = blockText(block).split(/(?<=[.!?])\s/)[0] ?? '';
  const excerpt = first.length > 90 ? `${first.slice(0, 87)}…` : first;
  return excerpt ? `Block ${index + 1} · ${excerpt}` : `Block ${index + 1}`;
}

const UseRow: React.FC<{
  review: ClaimUseReview;
  block: ArticleBlock | undefined;
  href?: string;
  busy: boolean;
  onRemove: () => void;
  onReviewed: (rev: number) => void;
}> = ({ review, block, href, busy, onRemove, onReviewed }) => {
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
        <div className="rounded-md border border-tea-border bg-tea-accent-sub p-3 space-y-2" role="status">
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
          {use.useKind === 'live_block'
            ? (review.currentText ? 'Shows the current approved text.' : 'No public text is available for this block.')
            : 'Matches the current revision.'}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {review.status === 'changed' && review.currentRev !== null && (
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => onReviewed(review.currentRev as number)} data-mark-reviewed>
            Mark reviewed at rev {review.currentRev}
          </Button>
        )}
        <Button type="button" variant="quiet" size="sm" disabled={busy} onClick={onRemove}>Remove</Button>
      </div>
    </li>
  );
};

const AddClaimUse: React.FC<{
  blocks: readonly ArticleBlock[];
  claims: readonly PublicClaim[];
  pages: readonly DraftReferencePage[];
  busy: boolean;
  onAdd: (blockIndex: number, claim: PublicClaim, useKind: ArticleClaimUse['useKind']) => void;
}> = ({ blocks, claims, pages, busy, onAdd }) => {
  const writable = blocks.map((block, index) => ({ index, text: blockText(block) })).filter(entry => entry.text.trim());
  const [blockIndex, setBlockIndex] = useState<number>(writable[0]?.index ?? 0);
  const [query, setQuery] = useState('');
  const [useKind, setUseKind] = useState<ArticleClaimUse['useKind']>('prose');
  const suggested = useMemo(
    () => suggestClaimsForBlock(blockText(blocks[blockIndex]), claims, pages),
    [blocks, blockIndex, claims, pages],
  );
  const found = useMemo(() => (query.trim() ? searchClaims(query, claims, 20) : []), [query, claims]);
  const pageLabel = (pageId: string) => pages.find(page => page.id === pageId)?.label ?? pageId;

  if (writable.length === 0) return null;
  const option = (claim: PublicClaim) => (
    <li key={claim.claimId} className="py-2 border-t border-tea-border first:border-t-0 min-w-0">
      <p className="text-ui-12 text-tea-text break-words">
        {pageLabel(claim.pageId)} · {claim.label} <span className="text-tea-text-sec">· rev {claim.rev}</span>
      </p>
      <p className="text-ui-11 text-tea-text-sec leading-relaxed break-words line-clamp-2">{claim.text}</p>
      <Button type="button"
        variant="secondary" size="sm" className="mt-1"
        disabled={busy}
        onClick={() => onAdd(blockIndex, claim, useKind)}
        data-add-claim={claim.claimId}
      >
        Cite on block {blockIndex + 1}
      </Button>
    </li>
  );

  return (
    <section className="mt-5 pt-4 border-t border-tea-border space-y-3" aria-labelledby="article-wisdom-add">
      <h4 id="article-wisdom-add" className={HEADING}>Cite a Wisdom claim</h4>
      <label className="block">
        <span className="text-ui-11 text-tea-text-sec">Block</span>
        <select className={FIELD} value={blockIndex} onChange={event => setBlockIndex(Number(event.target.value))} data-claim-block-select>
          {writable.map(entry => (
            <option key={entry.index} value={entry.index} className="bg-tea-surface text-tea-text">
              {blockLabel(blocks[entry.index], entry.index)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-ui-11 text-tea-text-sec">Used as</span>
        <select className={FIELD} value={useKind} onChange={event => setUseKind(event.target.value as ArticleClaimUse['useKind'])}>
          <option value="prose" className="bg-tea-surface text-tea-text">Prose (flag me when the claim changes)</option>
          <option value="live_block" className="bg-tea-surface text-tea-text">Live block (always shows the current text)</option>
        </select>
      </label>
      {suggested.length > 0 && (
        <div>
          <p className={`${HEADING} mb-1`}>Named in this block</p>
          <ul className="list-none m-0 p-0" data-claim-suggestions>{suggested.map(option)}</ul>
        </div>
      )}
      <label className="block">
        <span className="text-ui-11 text-tea-text-sec">Search every claim</span>
        <input
          type="search"
          className={FIELD}
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="A tea, a place, a grade, a term"
          data-claim-search
        />
      </label>
      {query.trim() && (
        found.length > 0
          ? <ul className="list-none m-0 p-0" data-claim-results>{found.map(option)}</ul>
          : <p className="text-ui-12 text-tea-text-sec">No approved claim matches.</p>
      )}
    </section>
  );
};

export const ArticleWisdomClaims: React.FC<{
  articleId: string;
  blocks: readonly ArticleBlock[];
  /** The claims set to review against. Defaults to the pilot data. */
  claims?: readonly PublicClaim[];
  pages?: readonly DraftReferencePage[];
  beforeOpen?: () => Promise<boolean>;
}> = ({ articleId, blocks, claims, pages, beforeOpen }) => {
  const navigate = useNavigate();
  function openCitedPage(event: React.MouseEvent<HTMLElement>) {
    const link = (event.target as HTMLElement).closest<HTMLAnchorElement>('a');
    if (!beforeOpen || !link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    const href = link.pathname + link.search + link.hash;
    void beforeOpen().then(saved => { if (saved) navigate(href); });
  }
  const pilot = useWisdomPilotData();
  const queryClient = useQueryClient();
  const claimSet = claims ?? pilot?.claims ?? [];
  const pageSet = pages ?? pilot?.pages ?? [];
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const queryKey = ['article-wisdom-claim-uses', accountId, userId, articleId];
  const query = useQuery({ queryKey, queryFn: () => wisdomClaimUsesApi.list(articleId) });
  const save = useMutation({
    mutationFn: (next: ArticleClaimUse[]) => wisdomClaimUsesApi.replace(articleId, next.map(toClaimUseInput)),
    // The replace answer carries the uses only; refetch so the cited-revision history stays current.
    onSuccess: data => {
      queryClient.setQueryData(queryKey, (old: { history?: unknown } | undefined) => ({ ...old, ...data }));
      void queryClient.invalidateQueries({ queryKey });
    },
  });
  const uses = useMemo(() => (query.data?.uses ?? []).map(toArticleClaimUse), [query.data]);
  // Flagged uses first, then in block order, so a review is never below the fold.
  const reviews = useMemo(
    () => reviewClaimUses(uses, claimSet, query.data?.history).sort((a, b) => Number(b.needsReview) - Number(a.needsReview)),
    [uses, claimSet, query.data?.history],
  );
  const destinations = useMemo(() => wisdomDestinations(uses.map(use => use.claimId), pageSet, true), [uses, pageSet]);
  const hrefFor = (claimId: string) => destinations.find(destination => claimId.startsWith(`${destination.pageId}:`))?.href;
  const flagged = reviews.filter(review => review.needsReview).length;
  const busy = save.isPending;

  return (
    <section aria-labelledby="article-wisdom-claims" data-article-wisdom-claims onClickCapture={openCitedPage}>
      <h3 id="article-wisdom-claims" className={`${HEADING} mb-3`}>Wisdom claims</h3>
      {query.isLoading && <p className="text-ui-12 text-tea-text-sec">Loading…</p>}
      {query.isError && <p className="text-ui-12 text-tea-text-sec">The claim uses could not be loaded.</p>}
      {save.isError && <p className="text-ui-12 text-tea-text" role="alert">The change was not saved. {(save.error as Error)?.message}</p>}
      {query.data && uses.length === 0 && (
        <p className="text-ui-12 text-tea-text-sec leading-relaxed">This article cites no Wisdom claims yet.</p>
      )}
      {uses.length > 0 && (
        <>
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mb-2">
            {uses.length} {uses.length === 1 ? 'use' : 'uses'}{flagged > 0 ? `, ${flagged} needing review` : ''}.
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
                busy={busy}
                onRemove={() => save.mutate(removeClaimUse(uses, review.use))}
                onReviewed={rev => save.mutate(markClaimUseReviewed(uses, review.use, rev))}
              />
            ))}
          </ul>
        </>
      )}
      {query.data && (
        <AddClaimUse
          blocks={blocks}
          claims={claimSet}
          pages={pageSet}
          busy={busy}
          onAdd={(blockIndex, claim, useKind) => save.mutate(addClaimUse(uses, articleId, blockIndex, claim, useKind))}
        />
      )}
    </section>
  );
};

export default ArticleWisdomClaims;
