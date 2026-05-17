import React from 'react';
import { motion } from 'framer-motion';

interface SectionSkeletonProps {
  variant?: 'grid' | 'list' | 'hero' | 'shop' | 'magazine';
}

const ShimmerBar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`relative overflow-hidden shimmer-warm ${className}`}>
    <div
      className="absolute inset-0 animate-shimmer"
      style={{
        background: 'linear-gradient(90deg, transparent, rgb(var(--tea-gold-rgb, 168 135 77) / 0.08), transparent)',
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

/** Shop product card skeleton — matches the list accordion layout */
const ShopCardSkeleton: React.FC = () => (
  <div className="flex items-center py-3 px-2 gap-3 border-b border-tea-border animate-pulse">
    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
      <ShimmerBar className="h-5 w-2/5" />
      <div className="flex items-center gap-2">
        <ShimmerBar className="h-3 w-10" />
        <ShimmerBar className="h-3 w-20" />
      </div>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <ShimmerBar className="h-4 w-14" />
      <ShimmerBar className="h-5 w-5 rounded-full" />
    </div>
  </div>
);

/** Magazine article card skeleton — matches the 2-column grid card layout */
const MagazineCardSkeleton: React.FC = () => (
  <div className="flex flex-col gap-2 animate-pulse">
    <ShimmerBar className="aspect-[3/4] w-full rounded-md" />
    <ShimmerBar className="h-4 w-4/5" />
    <ShimmerBar className="h-3 w-3/5" />
    <ShimmerBar className="h-3 w-1/3" />
  </div>
);

export const SectionSkeleton: React.FC<SectionSkeletonProps> = ({ variant = 'grid' }) => {
  if (variant === 'hero') {
    return (
      <motion.div
        className="px-4 pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(4px)', scale: 0.98 }}
        transition={{ duration: 0.25 }}
      >
        <ShimmerBar className="w-full aspect-[4/3] md:aspect-video mb-8 rounded-xl" />
        <ShimmerBar className="h-8 w-64 mb-4" />
        <ShimmerBar className="h-4 w-48 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </motion.div>
    );
  }

  if (variant === 'list') {
    return (
      <motion.div
        className="px-4 pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(4px)' }}
        transition={{ duration: 0.25 }}
      >
        <ShimmerBar className="h-10 w-full mb-4" />
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3 border-b border-tea-border">
            <ShimmerBar className="w-12 h-12 rounded-md flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <ShimmerBar className="h-4 w-3/5" />
              <ShimmerBar className="h-3 w-2/5" />
            </div>
            <ShimmerBar className="h-4 w-16 flex-shrink-0" />
          </div>
        ))}
      </motion.div>
    );
  }

  if (variant === 'shop') {
    return (
      <motion.div
        className="px-4 pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(4px)' }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex items-center justify-between mb-4">
          <ShimmerBar className="h-3 w-20" />
        </div>
        <ShimmerBar className="h-3 w-16 mb-2" />
        {Array.from({ length: 6 }).map((_, i) => (
          <ShopCardSkeleton key={i} />
        ))}
      </motion.div>
    );
  }

  if (variant === 'magazine') {
    return (
      <motion.div
        className="px-4 pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, filter: 'blur(4px)' }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex gap-4 mb-8">
          <ShimmerBar className="h-4 w-16" />
          <ShimmerBar className="h-4 w-16" />
        </div>
        <div className="grid grid-cols-2 2xl:grid-cols-3 gap-4 md:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <MagazineCardSkeleton key={i} />
          ))}
        </div>
      </motion.div>
    );
  }

  // Default grid
  return (
    <motion.div
      className="px-4 pt-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(4px)' }}
      transition={{ duration: 0.25 }}
    >
      <ShimmerBar className="h-10 w-full mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </motion.div>
  );
};
