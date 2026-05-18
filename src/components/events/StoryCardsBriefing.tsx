import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { BriefingCard } from '../../types/events';

interface StoryCardsBriefingProps {
  cards: BriefingCard[];
  onComplete: () => void;
  eventTitle: string;
  eventDay?: string;   // e.g. "Saturday"
  flyerUrl?: string;
}

const StoryCardsBriefing: React.FC<StoryCardsBriefingProps> = ({
  cards,
  onComplete,
  eventTitle,
  eventDay,
  flyerUrl,
}) => {
  // Build ordered card sequence: intro card + content cards + outro card
  const allCards = buildCardSequence(cards, eventTitle, eventDay, flyerUrl);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  const totalCards = allCards.length;
  const isLast = currentIndex === totalCards - 1;

  const advance = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      setDirection(1);
      setCurrentIndex((i) => i + 1);
    }
  }, [isLast, onComplete]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onComplete();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        advance();
      }
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setDirection(-1);
        setCurrentIndex((i) => i - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [advance, currentIndex, onComplete]);

  // Touch / swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.changedTouches[0].clientY - touchStartY.current);
    // Only treat horizontal swipes (dx > 40px, not too vertical)
    if (Math.abs(dx) > 40 && dy < 60) {
      if (dx < 0) {
        advance(); // swipe left → forward
      } else if (currentIndex > 0) {
        setDirection(-1);
        setCurrentIndex((i) => i - 1);
      }
    }
  };

  const card = allCards[currentIndex];

  return (
    <div
      className="fixed inset-0 z-priority bg-tea-bg"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      role="dialog"
      aria-modal="true"
      aria-label="Event briefing"
    >
      {/* Tap zone — advancing happens here, not on the root, so the Skip
          control, dots, and CTA are naturally exempt without stopPropagation. */}
      <button
        type="button"
        onClick={advance}
        aria-label={isLast ? 'Finish briefing' : 'Next card'}
        className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-none"
      />

      {/* Persistent skip — always available, no need to reach the last card */}
      {!isLast && (
        <button
          type="button"
          onClick={onComplete}
          className="tap-target absolute top-4 right-4 z-20 text-ui-12 uppercase tracking-[0.2em] text-tea-text-sec hover:text-tea-text transition-colors"
        >
          Skip
        </button>
      )}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentIndex}
          custom={direction}
          variants={{
            enter: (d: number) => ({ opacity: 0, x: d * 20 }),
            center: { opacity: 1, x: 0 },
            exit: (d: number) => ({ opacity: 0, x: d * -20 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.32, ease: 'easeInOut' }}
          className="absolute inset-0 z-10 pointer-events-none"
        >
          {/* Background */}
          {card.imageUrl ? (
            <>
              <img
                src={card.imageUrl}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-tea-overlay" />
            </>
          ) : (
            <div className="absolute inset-0 bg-tea-surface" />
          )}

          {/* Text content */}
          <div className="relative z-10 flex flex-col items-center justify-center h-full px-8 text-center">
            <h2
              className="font-display leading-snug max-w-xs mx-auto text-tea-text"
              style={{ fontSize: 'clamp(18px, 4.5vw, 24px)' }}
            >
              {card.text}
            </h2>

            {/* Last card CTA */}
            {card.isOutro && (
              <button
                type="button"
                onClick={onComplete}
                className="tap-target pointer-events-auto mt-10 flex items-center gap-2 px-6 py-3 border border-tea-gold text-tea-gold text-ui-12 uppercase tracking-[0.2em] hover:bg-tea-gold hover:text-tea-bg transition-colors duration-300"
              >
                View Your Ticket
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      <div className="absolute bottom-10 left-0 right-0 flex justify-center gap-2 z-20">
        {allCards.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => { setDirection(idx > currentIndex ? 1 : -1); setCurrentIndex(idx); }}
            aria-label={`Go to card ${idx + 1}`}
            aria-current={idx === currentIndex ? 'step' : undefined}
            className="tap-target flex items-center justify-center"
          >
            <span
              className={`block h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'bg-tea-gold w-5' : 'bg-tea-text-dim/40 w-1.5'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
};

// ----------------------------------------------------------------
// Helper: build the full card sequence
// ----------------------------------------------------------------
interface InternalCard extends BriefingCard {
  isOutro?: boolean;
}

function buildCardSequence(
  cards: BriefingCard[],
  eventTitle: string,
  eventDay?: string,
  flyerUrl?: string,
): InternalCard[] {
  const intro: InternalCard = {
    order: 0,
    text: 'Your seat is confirmed.\nBefore we meet, a few things to know.',
    imageUrl: flyerUrl,
  };

  const sorted = [...cards].sort((a, b) => a.order - b.order);

  const outro: InternalCard = {
    order: 9999,
    text: eventDay ? `See you ${eventDay}.` : `See you soon.`,
    imageUrl: flyerUrl,
    isOutro: true,
  };

  return [intro, ...sorted, outro];
}

export default StoryCardsBriefing;
