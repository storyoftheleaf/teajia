import React from 'react';
import { motion } from 'framer-motion';
import { LogoEmblem } from '../Logos/LogoEmblem';

/**
 * EmblemLoader — the app's loading indicator: the brand emblem, centered,
 * slowly breathing (fading + gently scaling) in and out. Replaces the old
 * mix of shimmer skeletons and circular spinners so every wait reads the same
 * and feels calm rather than busy.
 *
 * It is purely presentational and has no internal timers or state, so it can
 * never "get stuck" on its own — whatever mounts it decides when it unmounts.
 * The previous stuck-loader glitch lived in the lazy-import recovery logic
 * (see lazyWithReload in App.tsx), not in the indicator itself.
 */
export const EmblemLoader: React.FC<{ size?: number; className?: string }> = ({
  size = 92,
  className = '',
}) => (
  <div
    className={`flex items-center justify-center w-full h-full min-h-[45vh] ${className}`}
    role="status"
    aria-label="Loading"
  >
    <motion.div
      initial={{ opacity: 0.3, scale: 0.94 }}
      animate={{ opacity: [0.3, 1, 0.3], scale: [0.94, 1, 0.94] }}
      transition={{ duration: 1.9, ease: 'easeInOut', repeat: Infinity }}
    >
      <LogoEmblem size={size} className="text-tea-gold" />
    </motion.div>
  </div>
);

export default EmblemLoader;
