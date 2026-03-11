import React from 'react';

interface SectionSkeletonProps {
  variant?: 'grid' | 'list' | 'hero';
}

const ShimmerBar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative overflow-hidden bg-tea-text/5 rounded-sm ${className}`}>
    <div
      className="absolute inset-0 animate-shimmer"
      style={{
        background: 'linear-gradient(90deg, transparent, var(--tea-accent-sub), transparent)',
      }}
    />
  </div>
);

const SkeletonCard: React.FC = () => (
  <div className="flex flex-col gap-2 animate-[fadeIn_0.2s_ease-out]">
    <ShimmerBar className="aspect-[3/4] w-full" />
    <ShimmerBar className="h-4 w-3/4" />
    <ShimmerBar className="h-3 w-1/2" />
  </div>
);

export const SectionSkeleton: React.FC<SectionSkeletonProps> = ({ variant = 'grid' }) => {
  if (variant === 'hero') {
    return (
      <div className="animate-[fadeIn_0.15s_ease-out] px-4 pt-4">
        <ShimmerBar className="w-full aspect-[4/3] md:aspect-video mb-8 rounded-lg" />
        <ShimmerBar className="h-8 w-64 mb-4" />
        <ShimmerBar className="h-4 w-48 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="animate-[fadeIn_0.15s_ease-out] px-4 pt-4">
        <ShimmerBar className="h-10 w-full mb-4" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-tea-border">
            <ShimmerBar className="w-12 h-12 rounded-sm flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <ShimmerBar className="h-4 w-3/5" />
              <ShimmerBar className="h-3 w-2/5" />
            </div>
            <ShimmerBar className="h-4 w-16 flex-shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  // Default grid
  return (
    <div className="animate-[fadeIn_0.15s_ease-out] px-4 pt-4">
      <ShimmerBar className="h-10 w-full mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
};
