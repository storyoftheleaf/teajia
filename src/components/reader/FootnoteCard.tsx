import React, { useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FootnoteCardProps {
  term: string;
  definition: string;
  pronunciation?: string;
  imageUrl?: string;
  position: { x: number; y: number };
  onDismiss: () => void;
}

const CARD_WIDTH = 280;
const CARD_APPROX_HEIGHT = 180;
const SCREEN_MARGIN = 12;

/**
 * FootnoteCard — Floating tea glossary definition card.
 * Appears at tap position, clamped to screen edges.
 * Dismisses on outside tap, scroll, or ESC key.
 * Gold accent border-top. Framer Motion spring entrance.
 */
const FootnoteCard: React.FC<FootnoteCardProps> = ({
  term,
  definition,
  pronunciation,
  imageUrl,
  position,
  onDismiss,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Clamp position to keep card within viewport
  const clampedX = Math.min(
    Math.max(position.x - CARD_WIDTH / 2, SCREEN_MARGIN),
    window.innerWidth - CARD_WIDTH - SCREEN_MARGIN
  );
  const clampedY = Math.min(
    Math.max(position.y + 12, SCREEN_MARGIN),
    window.innerHeight - CARD_APPROX_HEIGHT - SCREEN_MARGIN
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    },
    [onDismiss]
  );

  const handleScroll = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    },
    [onDismiss]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('scroll', handleScroll, { capture: true });
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [handleKeyDown, handleScroll, handlePointerDown]);

  return (
    <motion.div
      ref={cardRef}
      role="dialog"
      aria-label={`Definition of ${term}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="fixed z-50 bg-tea-surface rounded-xl shadow-2xl overflow-hidden"
      style={{
        left: clampedX,
        top: clampedY,
        width: CARD_WIDTH,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '3px solid var(--tea-gold)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt={term}
          className="w-full h-24 object-cover"
        />
      )}

      <div className="p-4">
        <div className="flex items-baseline gap-2 mb-2">
          <h3 className="text-tea-text font-semibold text-sm">{term}</h3>
          {pronunciation && (
            <span className="text-tea-text-dim text-xs">({pronunciation})</span>
          )}
        </div>
        <p className="text-tea-text-sec text-xs leading-relaxed">{definition}</p>
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-tea-surface text-tea-text-dim hover:text-tea-text transition-colors text-xs"
      >
        ✕
      </button>
    </motion.div>
  );
};

export default FootnoteCard;
