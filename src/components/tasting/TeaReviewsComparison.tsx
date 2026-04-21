import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Heart, ThumbsUp, Minus, X } from 'lucide-react';
import { api } from '../../lib/api';
import { resolveTermLabel } from '../../data/tastingTaxonomy';
import type { TastingData } from '../../types';

interface TeaReview {
  id: string;
  tea_key: string;
  author_name?: string;
  author_account_name?: string;
  visibility: string;
  status: 'draft' | 'submitted';
  tasting?: TastingData;
  verdict?: string;
  would_buy?: boolean;
  created_at: string;
}

interface TeaReviewsComparisonProps {
  teaKey: string;
  className?: string;
}

const VERDICT_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; color: string }> = {
  love:    { icon: Heart,     label: 'Love',    color: 'text-rose-400' },
  like:    { icon: ThumbsUp,  label: 'Like',    color: 'text-emerald-400' },
  neutral: { icon: Minus,     label: 'Neutral', color: 'text-tea-text-sec' },
  pass:    { icon: X,         label: 'Pass',    color: 'text-tea-text-dim' },
};

function topFlavors(tasting?: TastingData, max = 4): string[] {
  if (!tasting?.flavor?.length) return [];
  return tasting.flavor.slice(0, max).map((id) => resolveTermLabel(id)).filter(Boolean);
}

export const TeaReviewsComparison: React.FC<TeaReviewsComparisonProps> = ({ teaKey, className = '' }) => {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['tea-reviews-comparison', teaKey],
    queryFn: () => api.teaReviews.list({ tea_key: teaKey, visibility: 'network' }),
    enabled: !!teaKey,
    staleTime: 60_000,
  });

  const submitted = (reviews || []).filter((r: TeaReview) => r.status === 'submitted');

  if (isLoading) {
    return (
      <div className={`space-y-2 ${className}`}>
        {[0, 1].map((i) => (
          <div key={i} className="h-14 bg-tea-elevated/40 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!submitted.length) return null;

  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-3" style={{ fontFamily: 'var(--font-display)' }}>
        Tasting Panel · {submitted.length} {submitted.length === 1 ? 'review' : 'reviews'}
      </p>

      <div className="space-y-2">
        {submitted.map((review: TeaReview) => {
          const vm = review.verdict ? VERDICT_META[review.verdict] : null;
          const flavors = topFlavors(review.tasting);
          const quality = review.tasting?.quality;

          return (
            <div
              key={review.id}
              className="flex items-start gap-3 px-3.5 py-3 bg-tea-surface border border-tea-border rounded-md"
            >
              {/* Reviewer */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-tea-text truncate" style={{ fontFamily: 'var(--font-display)' }}>
                    {review.author_name || review.author_account_name || 'Anonymous'}
                  </span>
                  {review.author_account_name && review.author_name && (
                    <span className="text-[10px] text-tea-text-dim">· {review.author_account_name}</span>
                  )}
                </div>

                {flavors.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {flavors.map((f) => (
                      <span
                        key={f}
                        className="text-[10px] text-tea-text-sec bg-tea-elevated px-1.5 py-0.5 rounded-sm"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Verdict + quality */}
              <div className="flex items-center gap-2 shrink-0">
                {quality != null && (
                  <span className="text-xs text-tea-text-sec font-mono">{quality}/10</span>
                )}
                {vm && (
                  <vm.icon size={14} className={vm.color} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
