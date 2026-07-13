import React from 'react';

export interface ProductImpression {
  id: string;
  productId: string;
  text: string;
  attributionName: string;
  attributionDetail: string | null;
  publishedAt: string;
}

export const ProductImpressions: React.FC<{ impressions: ProductImpression[] }> = ({ impressions }) => {
  if (impressions.length === 0) return null;
  return (
    <section aria-labelledby="community-impressions-heading" className="mx-5 mb-6 mt-5 space-y-4">
      <h3 id="community-impressions-heading" className="text-ui-11 uppercase tracking-[0.15em] text-tea-text-sec">Selected impressions</h3>
      {impressions.map(impression => (
        <blockquote key={impression.id} className="border-l-2 border-tea-gold pl-4">
          <p className="font-body text-ui-15 italic leading-relaxed text-tea-text">“{impression.text}”</p>
          <footer className="mt-2 text-ui-11 text-tea-text-sec">
            — {impression.attributionName}{impression.attributionDetail ? ` · ${impression.attributionDetail}` : ''}
          </footer>
        </blockquote>
      ))}
    </section>
  );
};
