import React, { useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';

interface CardData {
  title: string;
  content: string;
  accent?: string;
}

interface StackedCardsProps {
  cards: CardData[];
  stackTitle?: string;
}

/**
 * StackedCards — Swipeable micro-card stack.
 * Cards are stacked with perspective depth (scale + translateY).
 * Swipe left/right > 50px or tap to advance to next card.
 * Card count indicator. Framer Motion AnimatePresence transitions.
 */
const StackedCards: React.FC<StackedCardsProps> = ({ cards, stackTitle }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const advance = () => {
    if (currentIndex < cards.length - 1) {
      setDirection(1);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const retreat = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -50) advance();
    else if (info.offset.x > 50) retreat();
  };

  const visibleCards = cards.slice(currentIndex, currentIndex + 3);

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {stackTitle && (
        <p className="text-xs text-tea-text-dim uppercase tracking-widest">
          {stackTitle}
        </p>
      )}

      {/* Stack container */}
      <div className="relative w-full" style={{ height: 200 }}>
        {/* Background depth cards */}
        {visibleCards
          .slice(1)
          .reverse()
          .map((card, i) => {
            const depthIndex = visibleCards.length - 1 - i;
            return (
              <div
                key={`${currentIndex + depthIndex}`}
                className="absolute inset-0 rounded-xl bg-tea-surface"
                style={{
                  transform: `translateY(${depthIndex * 4}px) scale(${1 - depthIndex * 0.02})`,
                  zIndex: 10 - depthIndex,
                  opacity: 1 - depthIndex * 0.15,
                }}
              />
            );
          })}

        {/* Top active card */}
        <AnimatePresence mode="popLayout" custom={direction}>
          {cards[currentIndex] && (
            <motion.div
              key={currentIndex}
              custom={direction}
              initial={{ x: direction * 100, opacity: 0, scale: 0.95 }}
              animate={{ x: 0, opacity: 1, scale: 1, translateY: 0 }}
              exit={{ x: direction * -100, opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              onClick={advance}
              className="absolute inset-0 rounded-xl bg-tea-surface p-5 flex flex-col gap-3 cursor-pointer z-20"
              style={{
                borderLeft: cards[currentIndex].accent
                  ? `3px solid ${cards[currentIndex].accent}`
                  : '3px solid var(--color-tea-gold, #c9a84c)',
              }}
            >
              <h3 className="text-tea-text font-semibold text-sm leading-snug">
                {cards[currentIndex].title}
              </h3>
              <p className="text-tea-text-sec text-xs leading-relaxed flex-1">
                {cards[currentIndex].content}
              </p>
              {currentIndex < cards.length - 1 && (
                <p className="text-tea-text-dim text-xs text-right">
                  tap to continue →
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Card counter */}
      <div className="flex items-center gap-3">
        <button
          onClick={retreat}
          disabled={currentIndex === 0}
          className="text-xs text-tea-text-dim disabled:opacity-30 hover:text-tea-text transition-colors"
          aria-label="Previous card"
        >
          ←
        </button>
        <span className="text-xs text-tea-text-dim">
          {currentIndex + 1} / {cards.length}
        </span>
        <button
          onClick={advance}
          disabled={currentIndex >= cards.length - 1}
          className="text-xs text-tea-text-dim disabled:opacity-30 hover:text-tea-text transition-colors"
          aria-label="Next card"
        >
          →
        </button>
      </div>

      {/* Dot indicators */}
      <div className="flex gap-1.5">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setDirection(i > currentIndex ? 1 : -1);
              setCurrentIndex(i);
            }}
            className="rounded-full transition-all duration-200"
            style={{
              width: i === currentIndex ? 16 : 6,
              height: 6,
              background:
                i === currentIndex
                  ? 'var(--color-tea-gold, #c9a84c)'
                  : 'var(--color-tea-border, #ccc)',
              opacity: i === currentIndex ? 1 : 0.4,
            }}
            aria-label={`Go to card ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default StackedCards;
