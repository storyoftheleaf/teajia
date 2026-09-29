import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X } from '@phosphor-icons/react';

export interface FootnoteAnchor { left: number; top: number; bottom: number; width: number }

interface FootnoteCardProps {
  term: string;
  definition: string;
  pronunciation?: string;
  chineseCharacters?: string;
  imageUrl?: string;
  /** The tapped word's box in viewport coordinates; the card sits under it,
   *  or above it when there is no room below. */
  anchor: FootnoteAnchor;
  onDismiss: () => void;
}

const CARD_MAX_WIDTH = 300;
const SCREEN_MARGIN = 12;
const GAP = 10;

/**
 * FootnoteCard: the definition a tea term opens in a story.
 * Rendered into document.body, so a transformed ancestor (every [data-reveal]
 * section animates with transforms) cannot trap its fixed position. Clamped to
 * the viewport, so it never adds horizontal scroll at 390px. Takes focus when
 * it opens and dismisses on Escape, an outside tap, or scroll; the trigger
 * gets focus back (TermLink does that).
 */
const FootnoteCard: React.FC<FootnoteCardProps> = ({
  term,
  definition,
  pronunciation,
  chineseCharacters,
  imageUrl,
  anchor,
  onDismiss,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(160);

  useLayoutEffect(() => {
    if (cardRef.current) setHeight(cardRef.current.offsetHeight);
  }, [term, definition]);

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(CARD_MAX_WIDTH, vw - SCREEN_MARGIN * 2);
  const left = Math.min(
    Math.max(anchor.left + anchor.width / 2 - width / 2, SCREEN_MARGIN),
    vw - width - SCREEN_MARGIN,
  );
  const fitsBelow = anchor.bottom + GAP + height <= vh - SCREEN_MARGIN;
  const top = fitsBelow
    ? anchor.bottom + GAP
    : Math.max(anchor.top - GAP - height, SCREEN_MARGIN);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onDismiss();
  }, [onDismiss]);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    const target = e.target as Element | null;
    if (cardRef.current && target && !cardRef.current.contains(target) && !target.closest?.('[data-term-link]')) {
      onDismiss();
    }
  }, [onDismiss]);

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
    // Scroll listeners attach a beat later: focusing and the tap itself can
    // nudge the page on a phone, which would close the card as it opens.
    const t = window.setTimeout(() => {
      window.addEventListener('scroll', onDismiss, { passive: true });
    }, 250);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('scroll', onDismiss);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [handleKeyDown, handlePointerDown, onDismiss]);

  return createPortal(
    <motion.div
      ref={cardRef}
      role="dialog"
      aria-label={`${term}: definition`}
      tabIndex={-1}
      data-testid="term-card"
      initial={{ opacity: 0, y: fitsBelow ? -4 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="fixed z-popover overflow-hidden rounded-md bg-tea-elevated text-left shadow-2xl outline-none"
      style={{
        left,
        top,
        width,
        borderTop: '2px solid var(--tj-gold, rgb(var(--tea-gold-rgb)))',
      }}
    >
      {imageUrl && <img src={imageUrl} alt="" className="h-24 w-full object-cover" />}
      <div className="px-4 pb-4 pt-3 pr-11">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-display text-ui-20 leading-tight text-tea-text">{term}</span>
          {chineseCharacters && (
            <span className="text-ui-15 text-tea-gold" style={{ fontFamily: "'Noto Serif SC',serif" }} lang="zh">{chineseCharacters}</span>
          )}
        </div>
        {pronunciation && <div className="mt-0.5 font-body text-ui-13 italic text-tea-text-sec">{pronunciation}</div>}
        <p className="mt-2 font-body text-ui-15 leading-relaxed text-tea-text">{definition}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close"
        className="tap-target absolute right-2 top-2 flex h-7 w-7 items-center justify-center text-tea-text-sec transition-colors hover:text-tea-text"
      >
        <X size={16} weight="light" />
      </button>
    </motion.div>,
    document.body,
  );
};

export default FootnoteCard;
