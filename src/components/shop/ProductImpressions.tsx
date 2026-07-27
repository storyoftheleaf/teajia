import React from 'react';
import { BODY, LABEL, LABEL_GAP, SECTION } from '../shared/typeRoles';

export interface ProductImpression {
  id: string;
  productId: string;
  text: string;
  attributionName: string;
  attributionDetail: string | null;
  publishedAt: string;
}

/**
 * What other people said about this tea, chosen by hand.
 *
 * Brought onto the product page's four type roles and its one caps setting:
 * the heading was 11px caps tracked at 0.15em where the page tracks at 0.08em,
 * the quote and the attribution sat two sizes apart, and the quote rule was
 * bronze, which is reserved for the active state, the brand and warnings.
 *
 * The hierarchy inside the block is now carried entirely by colour. The quote
 * is primary text, the attribution is dim, and both are set at body size, so
 * nothing here needs a fifth step on the scale to be read in the right order.
 */
export const ProductImpressions: React.FC<{ impressions: ProductImpression[] }> = ({ impressions }) => {
  if (impressions.length === 0) return null;
  return (
    <section aria-labelledby="community-impressions-heading" className={SECTION}>
      <h2 id="community-impressions-heading" className={`${LABEL} ${LABEL_GAP} text-tea-text-dim`}>
        Selected impressions
      </h2>
      <div className="space-y-4">
        {impressions.map(impression => (
          <blockquote key={impression.id} className="border-l border-tea-border pl-4">
            <p className={`${BODY} italic text-tea-text`}>&ldquo;{impression.text}&rdquo;</p>
            <footer className={`${BODY} mt-1 text-tea-text-dim`}>
              {impression.attributionName}
              {impression.attributionDetail ? ` · ${impression.attributionDetail}` : ''}
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
};
