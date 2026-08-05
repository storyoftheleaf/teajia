import React, { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TouchRevealProps {
  children: ReactNode;
  hint?: string;
}

/**
 * TouchReveal: Frosted glass overlay that hides content until tapped.
 * Tap once to reveal (persistent toggle). Tap again to re-hide.
 * Uses Framer Motion for blur transition on the overlay.
 * Overlay uses bg-tea-surface/40. No hardcoded rgba().
 */
const TouchReveal: React.FC<TouchRevealProps> = ({
  children,
  hint = 'Touch to reveal',
}) => {
  const [revealed, setRevealed] = useState(false);

  const handleToggle = () => setRevealed((prev) => !prev);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Underlying content */}
      <div>{children}</div>

      {/* Overlay */}
      <AnimatePresence>
        {!revealed && (
          <motion.div
            key="overlay"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer bg-tea-surface/40"
            style={{
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
            onClick={handleToggle}
            role="button"
            aria-label={hint}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleToggle();
            }}
          >
            {/* Fingerprint-like icon using concentric circles */}
            <div className="relative w-10 h-10 mb-3 flex items-center justify-center">
              {[40, 28, 16].map((size, i) => (
                <div
                  key={i}
                  className="absolute rounded-full border border-tea-gold/30"
                  style={{
                    width: size,
                    height: size,
                    opacity: 0.5 + i * 0.15,
                  }}
                />
              ))}
              <div className="w-2 h-2 rounded-full bg-tea-gold opacity-70" />
            </div>

            <p className="text-tea-text-sec text-xs text-center px-4 select-none">
              {hint}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Re-hide button when revealed */}
      {revealed && (
        <button
          onClick={handleToggle}
          aria-label="Hide content"
          className="absolute top-2 right-2 text-xs text-tea-text-dim px-2 py-1 rounded bg-tea-surface/60 hover:bg-tea-surface transition-colors"
          style={{ backdropFilter: 'blur(4px)' }}
        >
          hide
        </button>
      )}
    </div>
  );
};

export default TouchReveal;
