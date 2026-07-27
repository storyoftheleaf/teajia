import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
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
 * One reader of this endpoint, for both surfaces that show it.
 *
 * The quick view and the product page each wrote their own `useQuery` against
 * `['product-impressions', id]`, in two files, with the key, the fetcher and
 * the sixty-second staleTime spelled out twice. That is not a duplicated
 * component, it is a duplicated *contract*: the two calls only collapse into
 * one request because React Query happens to dedupe by key, and nothing in
 * either file says so. Change the key in one place, or the staleTime, and the
 * page quietly starts issuing a second request for data it already holds, or
 * shows a different vintage of it than the card that opened it.
 *
 * The hook sits beside the component that renders the data rather than in
 * hooks/, for the same reason `stockStatus` and `shopPrice` sit beside the
 * shop: the shape and the reader belong together. `enabled` handles the product
 * page's case, where the id comes from the address and the first render may not
 * have one yet, which is also why this must stay callable unconditionally.
 */
export function useProductImpressions(productId: string | undefined) {
  return useQuery<ProductImpression[]>({
    queryKey: ['product-impressions', productId],
    queryFn: () => api.productImpressions.list(productId!),
    enabled: Boolean(productId),
    staleTime: 60_000,
  });
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
