import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { Icons } from '../Icons';

export interface ProductImpression {
  id: string;
  productId: string;
  text: string;
  attributionName: string;
  attributionDetail: string | null;
  publishedAt: string;
}

export function useProductImpressions(productId: string | undefined) {
  return useQuery<ProductImpression[]>({
    queryKey: ['product-impressions', productId],
    queryFn: () => api.productImpressions.list(productId!),
    enabled: Boolean(productId),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export const ProductImpressions: React.FC<{ impressions: ProductImpression[] }> = ({ impressions }) => {
  if (!impressions.length) return null;
  return (
    <section aria-label="From the tasting journal" className="my-[var(--space-4)] min-w-0 border-l border-tea-border pl-[var(--space-3)]">
      <h2 className={`${TYPOGRAPHY_CLASSES.label} mb-[var(--space-1)] text-tea-text-sec`}>From the tasting journal</h2>
      <div className="grid gap-[var(--space-3)]">
        {impressions.map(impression => (
          <figure key={impression.id} className="min-w-0">
            <blockquote className={`${TYPOGRAPHY_CLASSES.subtitle} break-words italic text-tea-text`}>
              &ldquo;{impression.text}&rdquo;
            </blockquote>
            <figcaption className={`${TYPOGRAPHY_CLASSES.accountMeta} mt-[var(--space-1)] flex min-w-0 items-center gap-[var(--space-1)] text-tea-text-sec`}>
              <Icons.User aria-hidden="true" className="h-[var(--space-3)] w-[var(--space-3)] shrink-0" />
              <span className="truncate" title={impression.attributionName}>{impression.attributionName}</span>
              {impression.attributionDetail && <span>{impression.attributionDetail}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
};
