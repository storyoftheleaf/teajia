import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { resolveTermLabel, flattenTastingNotes } from '../../data/tastingTaxonomy';
import type { TastingData } from '../../types';
import { shopTermHref } from './termFilter';
import { BODY, LABEL, LABEL_GAP, LINK, NUMERAL } from '../shared/typeRoles';

/**
 * What other people found in this tea, on both surfaces that describe it.
 *
 * This lived inside ProductPage.tsx, which is why the quick view did not have
 * it. A reader could open a tea from the shop grid, read the plant, the maker,
 * the brew and the tasting notes, and never learn that four people had written
 * about it, then open the same tea's own page and find them. Two documents
 * about one tea, disagreeing about what is known.
 *
 * Rendering nothing is the normal case, and the card is a 480px column, so the
 * empty state is a page-only affordance: see `emptyState` below.
 */
export interface PublicTeaReview {
  id: string;
  tea_key: string;
  author_name?: string;
  author_account_name?: string;
  // The API also returns `rating`, a number out of ten. It is deliberately not
  // read here. Scoring is banned outright on this site, and a number rating a
  // tea is not a fact about the tea: it is one person's compression of a
  // session into a digit, printed in the face reserved for the numbers a
  // customer transacts on, which lent it the authority of a price. The verdict
  // and the note below say the same thing in the taster's own words, which is
  // what a reader can actually weigh.
  notes?: string;
  voice_notes?: string[];
  tasting?: TastingData;
  verdict?: string;
  session_date?: string;
  created_at: string;
  visibility: string;
}

interface ProductReviewsProps {
  productId: string;
  teaKey?: string;
  /**
   * Print "No reviews yet." when there are none.
   *
   * True on the product page, because a tea's own address is the document of
   * record for that tea and an absence there is a fact worth stating. False in
   * the quick view, where the reader is deciding whether to open the page at
   * all and a heading followed by a sentence saying it has nothing under it is
   * a row of scroll spent on nothing.
   */
  emptyState?: boolean;
  /** Wrapper classes, so each surface keeps its own section rhythm. */
  className?: string;
}

export const ProductReviews: React.FC<ProductReviewsProps> = ({
  productId,
  teaKey,
  emptyState = false,
  className = '',
}) => {
  const { data: reviews = [], isLoading } = useQuery<PublicTeaReview[]>({
    queryKey: ['public-tea-reviews', productId, teaKey],
    queryFn: () => api.teaReviews.list({
      product_id: productId,
      ...(teaKey ? { tea_key: teaKey } : {}),
      visibility: 'network',
    }),
    staleTime: 60_000,
  });

  const networkReviews = reviews.filter(r => r.visibility === 'network');

  if (isLoading) return null;

  if (networkReviews.length === 0) {
    if (!emptyState) return null;
    return (
      <div className={className}>
        <h2 className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>Reviews</h2>
        <p className={`${BODY} text-tea-text-dim italic`}>No reviews yet.</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* One word, one case. The count used to ride inside the label in normal
          case, which made this the only label on the page setting two cases in
          one line, and it was counting entries that are listed directly beneath
          it in full. A number a reader can see is not a fact the heading has to
          carry. */}
      <h2 className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>Reviews</h2>
      {/* Flat entries, separated by the same hairline every other section on
          these surfaces is separated by. This was the last bordered, filled
          card left standing after the brewing card dissolved into a fact grid,
          and one surviving card among flat sections reads as a leftover widget
          rather than as part of the page. Hierarchy inside an entry is colour
          only: the note is secondary, everything about the note is dim. */}
      <div className="space-y-5">
        {networkReviews.map(r => {
          const flavorTerms = r.tasting ? flattenTastingNotes(r.tasting) : [];
          const brewedAt = r.tasting?.brewingTemp
            ? [`Brewed at ${r.tasting.brewingTemp}°C`, r.tasting.brewingTime, r.tasting.brewingVessel]
                .filter(Boolean)
                .join(' · ')
            : '';
          return (
            <article key={r.id} className="space-y-1 border-t border-tea-border pt-5 first:border-t-0 first:pt-0">
              <div className={`${BODY} flex flex-wrap items-baseline gap-x-2 text-tea-text-dim`}>
                <span className="text-tea-text">
                  {r.author_name ? r.author_name.charAt(0) + '.' : 'Anonymous'}
                </span>
                {r.author_account_name && <span>· {r.author_account_name}</span>}
                {r.verdict && <span className="capitalize text-tea-text-sec">{r.verdict}</span>}
                <span className={`${NUMERAL} ml-auto`}>
                  {(r.session_date || r.created_at).slice(0, 10)}
                </span>
              </div>

              {/* Still a caption, not a row of pills: the shape was right and
                  stays. What was wrong is that every term in it was set plain
                  while the tasting block twenty rows up set the identical term
                  as a link. One page, one word, two promises. A term the shop
                  can filter on is a link here too; body, finish and liquor
                  colour cannot be filtered on and stay plain in both blocks.
                  `shopTermHref` decides, once, for both. */}
              {flavorTerms.length > 0 && (
                <p className={`${BODY} text-tea-text-dim`}>
                  {flavorTerms.slice(0, 6).map((termId, idx) => {
                    const href = shopTermHref(termId);
                    return (
                      <React.Fragment key={termId}>
                        {idx > 0 && <span className="select-none"> · </span>}
                        {href
                          ? <Link to={href} className={LINK}>{resolveTermLabel(termId)}</Link>
                          : resolveTermLabel(termId)}
                      </React.Fragment>
                    );
                  })}
                </p>
              )}

              {r.notes && <p className={`${BODY} italic text-tea-text-sec`}>{r.notes}</p>}

              {r.voice_notes && r.voice_notes.length > 0 && (
                <div className="space-y-1">
                  {r.voice_notes.map((n, i) => (
                    <p key={i} className={`${BODY} italic text-tea-text-sec`}>&ldquo;{n}&rdquo;</p>
                  ))}
                </div>
              )}

              {brewedAt && <p className={`${BODY} text-tea-text-dim`}>{brewedAt}</p>}
            </article>
          );
        })}
      </div>
    </div>
  );
};
