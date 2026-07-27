import React from 'react';
import { motion } from 'framer-motion';
import { LogoEmblem } from '../Logos/LogoEmblem';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isRefreshing: boolean;
  progress: number;
}

/**
 * Pull-to-refresh in the SAME loading language as everything else: the brand
 * emblem, breathing (EmblemLoader's fade + gentle scale), not a spinner.
 *
 * The previous version here was a leftover from before the loader redesign,
 * a gold progress ring with a tea leaf in a circular chip. It read as "old
 * circle spinner" next to the pulsing emblem used for every other wait, so it
 * looked like the stuck-spinner bug had returned. One loading identity now:
 * while pulling, the emblem fades/scales in with the pull; while refreshing,
 * it breathes exactly like EmblemLoader (same 1.9s ease, same ranges).
 */
export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isRefreshing,
  progress,
}) => {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const atThreshold = progress >= 1;

  return (
    <div
      className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-modal flex items-center justify-center pointer-events-none"
      style={{
        transform: `translateY(${pullDistance}px)`,
        opacity: Math.min(progress * 1.6, 1),
        // Soft shadow for legibility when the emblem floats over content.
        filter: 'drop-shadow(0 4px 14px rgb(var(--tea-shadow-rgb) / 0.45))',
      }}
    >
      {isRefreshing ? (
        <motion.div
          className="-mt-6"
          initial={{ opacity: 0.3, scale: 0.94 }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.94, 1, 0.94] }}
          transition={{ duration: 1.9, ease: 'easeInOut', repeat: Infinity }}
        >
          <LogoEmblem size={40} className="text-tea-gold" />
        </motion.div>
      ) : (
        <div
          className="-mt-6"
          style={{
            transform: `scale(${0.7 + Math.min(progress, 1) * 0.3})`,
            transition: 'transform 0.12s ease-out',
          }}
        >
          <LogoEmblem
            size={40}
            className={atThreshold ? 'text-tea-gold' : 'text-tea-text-sec'}
          />
        </div>
      )}
    </div>
  );
};
