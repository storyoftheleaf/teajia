import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useScrollLock } from '../../../hooks/useScrollLock';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { useAppStore } from '../../../lib/store';
import type { InventoryItem } from '../../../types';

/**
 * The swipe-and-peek carousel the two alcove modals both are.
 *
 * Round seven merged the cards. `AlcoveShell` took the surface, the warmth, the
 * grain and the watermark, and `TeawareAlcoveCard` was ported onto it with two
 * optional props for the opacities it wanted differently. The shells were left
 * out of that pass, and they were the larger half: about a hundred and eighty
 * lines of `TeawareAlcoveModal` were a second copy of `AlcoveModal`. Not a
 * similar copy. The velocity threshold (`> 0.3` then 20 else 40), the boundary
 * resistance (`* 0.15`), the four peek offsets with their
 * `calc(50% - min(240px, 42.5vw) ...)` arithmetic, the `justNavigatedRef`
 * requestAnimationFrame trick that stops a card-swap from reading as a backdrop
 * click, the 350ms slide timeout, the `inert` marking of the preview subtrees,
 * the keydown handler, the close-button SVG: all of it identical, character for
 * character, in two files.
 *
 * Two copies of one behaviour is how one of them stops matching, and this pair
 * had already proved it twice. The teaware shell shipped without `role`,
 * `aria-modal` or a focus trap for months after the tea shell had all three,
 * and its close button sat in the wrong corner. Both were fixed by hand, in the
 * file, one round after the other.
 *
 * ── What the shell owns ──────────────────────────────────────────────────────
 *
 * Everything a reader can do to the carousel: the scroll lock, the bottom-nav
 * suppression, the focus trap, index maths, next/previous, the keyboard, the
 * touch gesture, the four peeking neighbours, the desktop arrows, and the
 * backdrop hit test. All of the hooks live here, above the one early return,
 * which is why the two callers now have no hooks at all and cannot break the
 * rule conditionalHooks.test.ts pins.
 *
 * ── What a caller passes ─────────────────────────────────────────────────────
 *
 * Every optional prop defaults to `AlcoveModal`'s value, following the
 * convention `AlcoveShell` set: the dominant call site says nothing, and the
 * variant states only its differences. `TeawareAlcoveModal` states seven, and
 * one of them is not cosmetic:
 *
 *   Cosmetic:  peekHeight 820 rather than 780, peekOpacity 0.35 rather than
 *              0.2, peekBlur 1px rather than 8px, the arrow treatment, the two
 *              arrow labels ("item" rather than "tea"), and the mobile counter,
 *              which only the teaware carousel shows.
 *   Not:       the backdrop is `z-modal` (40) with a flat `bg-black/95`, where
 *              the tea modal is `z-panel-modal` (70) with a blurred
 *              `bg-black/85`. Preserved exactly rather than unified, because a
 *              z-layer change is a stacking bug waiting to happen and it is
 *              not this file's business to guess which layer is right. See the
 *              note under `backdropLayerClassName`.
 *
 * The eighth difference is gone. The teaware dialog used to name itself with
 * `aria-label={item.name}` while the tea dialog pointed at its heading with
 * `aria-labelledby`, on the reasoning that a teapot had no heading to point at.
 * That stopped being true when `TeawareAlcoveCard` was ported onto
 * `AlcoveIdentityHeader`, which renders `<h1 id="alcove-title-{item.id}">` for
 * both cards. Both now use `aria-labelledby`, so the accessible name is the
 * heading a sighted reader is looking at rather than a second string that can
 * drift from it.
 *
 * One thing was dropped rather than made a prop, and it is worth saying so the
 * next reader does not go looking for it. `AlcoveModal` kept a `slideDirection`
 * state, set on every navigation and never read anywhere; the teaware copy kept
 * the 350ms timeout that used to clear it, firing an empty callback. With the
 * state gone the timeout had nothing to clear, so the ref, its cleanup effect
 * and both `clearTimeout` calls went with it. The `justNavigatedRef` frame
 * guard, which is the one that actually does something (it stops a card swap
 * from registering as a backdrop click and closing the dialog), stays.
 */
export interface AlcoveCarouselShellProps {
  /** The focused item. `null` renders nothing, after every hook has run. */
  item: InventoryItem | null;
  items: InventoryItem[];
  onClose: () => void;
  onItemChange?: (item: InventoryItem) => void;

  /** The focused card, plus its own close button. */
  renderCard: (item: InventoryItem) => React.ReactNode;
  /** A neighbour, rendered blurred and inert on both sides. */
  renderPeek: (item: InventoryItem) => React.ReactNode;

  /**
   * The id of the heading that names the dialog. Both carousels pass the
   * `alcove-title-*` id `AlcoveIdentityHeader` puts on the product name, which
   * is why there is no `ariaLabel` escape hatch here: a second, hand-written
   * name is a string that can drift from the heading under it.
   */
  ariaLabelledBy?: string;

  /**
   * Stacking layer for the whole dialog. Default is the tea modal's.
   *
   * The two carousels disagree here and the disagreement is deliberate rather
   * than settled: tea opens at `z-panel-modal` (70), teaware at `z-modal` (40).
   * 40 is the layer AccountPanel and its backdrop also occupy, and the app
   * relies on DOM order to break that tie, so raising or lowering either one is
   * a stacking change with consequences outside this component. Whoever picks
   * this up should decide which layer a product carousel belongs on and move
   * both, with the overlays that share the layer in view. Do not unify it by
   * deleting one of the two values.
   */
  backdropLayerClassName?: string;
  /** The visible scrim, applied once the dialog has faded in. */
  backdropScrimClassName?: string;
  /** Desktop arrow treatment. Default is the tea modal's glass puck. */
  arrowClassName?: string;
  prevLabel?: string;
  nextLabel?: string;

  /** Peek geometry. Defaults are the tea modal's. */
  peekHeight?: string;
  peekOpacity?: number;
  peekBlur?: string;

  /** "3 of 12" under the card on mobile. Off by default. */
  showCounter?: boolean;

  /** The positioner that carries the swipe transform. */
  slotClassName?: string;
  slotStyle?: React.CSSProperties;
  /** The frame the backdrop hit test treats as "inside the card". */
  frameClassName?: string;
  frameStyle?: React.CSSProperties;
}

const DEFAULT_ARROW = 'glass-panel hover:bg-tea-gold/15 text-tea-gold';

export const AlcoveCarouselShell: React.FC<AlcoveCarouselShellProps> = ({
  item,
  items,
  onClose,
  onItemChange,
  renderCard,
  renderPeek,
  ariaLabelledBy,
  backdropLayerClassName = 'z-panel-modal',
  backdropScrimClassName = 'bg-black/85 backdrop-blur-sm',
  arrowClassName = DEFAULT_ARROW,
  prevLabel = 'Previous tea',
  nextLabel = 'Next tea',
  peekHeight = 'min(90vh, 780px)',
  peekOpacity = 0.2,
  peekBlur = 'blur(8px)',
  showCounter = false,
  slotClassName = 'p-0 md:p-8',
  slotStyle,
  frameClassName = 'relative w-full md:max-w-[560px] md:flex md:items-center md:justify-center',
  frameStyle = { height: '100%', maxHeight: '100dvh', width: '100%' },
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const isOpen = !!item;
  useScrollLock(isOpen);

  // Hide the floating BottomTabBar while this full-screen card is open so it
  // can't overlap the card's bottom action bar. Works regardless of whether
  // the call site syncs the open product to the URL.
  const setProductOverlayOpen = useAppStore(s => s.setProductOverlayOpen);
  useEffect(() => {
    setProductOverlayOpen(isOpen);
    return () => setProductOverlayOpen(false);
  }, [isOpen, setProductOverlayOpen]);

  // Swipe navigation state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const cardRef = useRef<HTMLDivElement>(null);
  const justNavigatedRef = useRef(false);

  /**
   * The trap is the shared hook, not thirty lines of it written again.
   *
   * Each dialog used to keep its own Tab cycle, its own focusable-element query
   * and its own previously-focused element. The hook needed two things those
   * copies had, so both moved into it: it skips `[inert]` and
   * `[aria-hidden="true"]` subtrees (the peeking preview cards), and it reads
   * the focusable list at Tab time rather than at arm time, because the card is
   * swapped out from under it by the arrow keys.
   *
   * `initialFocus` is the close button, which is why `renderCard` is required
   * to include one carrying `data-alcove-close`.
   */
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, { initialFocus: '[data-alcove-close]' });

  const currentIndex = item ? items.findIndex(i => i.id === item.id) : -1;
  const isFirst = currentIndex <= 0;
  const isLast = currentIndex >= items.length - 1;
  const prevItem = !isFirst ? items[currentIndex - 1] : null;
  const nextItem = !isLast ? items[currentIndex + 1] : null;

  const goNext = useCallback(() => {
    if (!item || !onItemChange || isLast) return;
    justNavigatedRef.current = true;
    requestAnimationFrame(() => { justNavigatedRef.current = false; });
    onItemChange(items[currentIndex + 1]);
  }, [item, onItemChange, items, currentIndex, isLast]);

  const goPrev = useCallback(() => {
    if (!item || !onItemChange || isFirst) return;
    justNavigatedRef.current = true;
    requestAnimationFrame(() => { justNavigatedRef.current = false; });
    onItemChange(items[currentIndex - 1]);
  }, [item, onItemChange, items, currentIndex, isFirst]);

  // The preview cards are `aria-hidden` in the markup, which is what the focus
  // trap reads. `inert` is set here as well so a pointer cannot reach into them
  // either; it is a property rather than an attribute because React does not
  // serialise it on every version this app runs on.
  useEffect(() => {
    if (item) {
      requestAnimationFrame(() => setIsVisible(true));
      requestAnimationFrame(() => {
        dialogRef.current?.querySelectorAll<HTMLElement>('[data-alcove-preview]').forEach((el) => {
          (el as HTMLElement & { inert: boolean }).inert = true;
        });
      });
    } else {
      setIsVisible(false);
    }
  }, [item, dialogRef]);

  // Keyboard navigation (Escape + arrow keys)
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose, goPrev, goNext]);

  if (!item) return null;

  // Close when clicking anywhere outside the active card
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (justNavigatedRef.current) return;
    if (cardRef.current && cardRef.current.contains(e.target as Node)) return;
    onClose();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    setTouchStart(e.touches[0].clientX);
    setTouchStartTime(Date.now());
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const raw = e.touches[0].clientX - touchStart;
    // Add resistance at boundaries
    if ((raw > 0 && isFirst) || (raw < 0 && isLast)) {
      setSwipeOffset(raw * 0.15);
    } else {
      setSwipeOffset(raw);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || touchStartTime === null) return;

    const diff = touchStart - e.changedTouches[0].clientX;
    const distance = Math.abs(diff);
    const velocity = distance / (Date.now() - touchStartTime);
    const threshold = velocity > 0.3 ? 20 : 40;

    if (distance > threshold && onItemChange) {
      if (diff > 0 && !isLast) {
        goNext();
      } else if (diff < 0 && !isFirst) {
        goPrev();
      }
    }

    setTouchStart(null);
    setTouchStartTime(null);
    setSwipeOffset(0);
  };

  const hasNavigation = items.length > 1 && onItemChange;
  // 40px of gap between the focused card and the neighbour that peeks past it.
  const PEEK_INSET = 'calc(50% - min(240px, 42.5vw) - 40px - min(480px, 85vw) + 100px)';

  // Escape and the arrow keys are already listened for on the window; this
  // stops a keypress inside the trapped dialog bubbling out to anything behind
  // it as well. Tab is `useFocusTrap`'s business.
  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key === 'ArrowLeft') { e.stopPropagation(); goPrev(); return; }
    if (e.key === 'ArrowRight') { e.stopPropagation(); goNext(); }
  };

  const desktopPeek = (side: 'left' | 'right', peeked: InventoryItem, go: () => void) => (
    <div
      data-alcove-preview
      aria-hidden="true"
      className="absolute hidden md:block pointer-events-auto cursor-pointer"
      style={{
        zIndex: 1,
        width: 'min(480px, 85vw)',
        height: peekHeight,
        minHeight: '480px',
        left: side === 'left' ? PEEK_INSET : undefined,
        right: side === 'right' ? PEEK_INSET : undefined,
        transform: `translateX(${swipeOffset * 0.5}px) scale(0.88)`,
        transition: touchStart ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: peekOpacity,
        filter: peekBlur,
      }}
      onClick={(e) => { e.stopPropagation(); go(); }}
    >
      {renderPeek(peeked)}
    </div>
  );

  // The mobile peek is pinned just off the opposite edge: the previous card
  // hangs off the left, so it is anchored by `right`, and vice versa.
  const mobilePeek = (which: 'prev' | 'next', peeked: InventoryItem) => {
    const isPrev = which === 'prev';
    const inset = isPrev
      ? `calc(100% - 24px + ${Math.max(0, -swipeOffset) * 0.3}px)`
      : `calc(100% - 24px - ${Math.max(0, swipeOffset) * 0.3}px)`;
    const shift = isPrev
      ? (swipeOffset > 0 ? swipeOffset * 0.5 : 0)
      : (swipeOffset < 0 ? swipeOffset * 0.5 : 0);
    return (
      <div
        data-alcove-preview
        aria-hidden="true"
        className="absolute md:hidden pointer-events-none"
        style={{
          zIndex: 1,
          width: '85vw',
          maxWidth: '480px',
          height: peekHeight,
          minHeight: '480px',
          right: isPrev ? inset : undefined,
          left: isPrev ? undefined : inset,
          transform: `scale(0.9) translateX(${shift}px)`,
          transition: touchStart ? 'none' : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: Math.min(0.3, Math.abs(swipeOffset) / 300 + 0.15),
        }}
      >
        {renderPeek(peeked)}
      </div>
    );
  };

  const arrow = (dir: 'prev' | 'next') => (
    <button
      className={`hidden md:flex absolute ${dir === 'prev' ? 'left-6' : 'right-6'} top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full transition-all ${arrowClassName}`}
      style={{ zIndex: 10 }}
      onClick={(e) => { e.stopPropagation(); if (dir === 'prev') goPrev(); else goNext(); }}
      aria-label={dir === 'prev' ? prevLabel : nextLabel}
    >
      {dir === 'prev' ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
    </button>
  );

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy}
      className={`fixed inset-0 transition-all duration-300 ${backdropLayerClassName} ${isVisible ? backdropScrimClassName : 'bg-black/0 pointer-events-none'}`}
      onClick={handleBackdropClick}
      onKeyDown={handleDialogKeyDown}
    >
      {/* Carousel container */}
      <div
        className="relative flex items-center justify-center w-full h-full overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {hasNavigation && prevItem && desktopPeek('left', prevItem, goPrev)}
        {hasNavigation && prevItem && mobilePeek('prev', prevItem)}

        {/* Current card */}
        <div
          className={`flex flex-col items-center justify-center ${slotClassName}`}
          style={{
            zIndex: 5,
            position: 'relative',
            transform: `translateX(${swipeOffset * 0.4}px)`,
            transition: touchStart ? 'none' : 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
            ...slotStyle,
          }}
        >
          <div ref={cardRef} className={frameClassName} style={frameStyle}>
            {renderCard(item)}
          </div>

          {showCounter && hasNavigation && (
            <div className="mt-3 flex items-center gap-3 md:hidden" onClick={(e) => e.stopPropagation()}>
              <span className="text-xs text-tea-text-sec/70 tracking-wide">
                {currentIndex + 1} of {items.length}
              </span>
            </div>
          )}
        </div>

        {hasNavigation && nextItem && desktopPeek('right', nextItem, goNext)}
        {hasNavigation && nextItem && mobilePeek('next', nextItem)}

        {hasNavigation && !isFirst && arrow('prev')}
        {hasNavigation && !isLast && arrow('next')}
      </div>
    </div>
  );
};

/**
 * The close control, top-left, icon only, secondary text colour: the
 * panel/drawer rule the rest of the app follows. The shell arms its focus trap
 * on `[data-alcove-close]`, so a card that renders its own must render this.
 *
 * It is a component rather than shell markup because the two carousels position
 * it against different ancestors. The teaware card's frame is the positioned
 * box; the tea card nests one more wrapper inside it for the breakpoint sizing,
 * and hoisting the button out of that wrapper would leave it floating 40px off
 * the card on desktop.
 */
export const AlcoveCloseButton: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <button
    data-alcove-close
    className="tap-target absolute top-2 left-2 z-10 flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
    onClick={onClose}
    aria-label="Close"
  >
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  </button>
);
