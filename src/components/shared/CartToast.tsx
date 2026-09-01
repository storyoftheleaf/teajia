import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../Icons';

export type CartToastTone = 'added' | 'unavailable';

interface CartToastProps {
  itemName: string;
  /** The size that was actually added, already formatted (e.g. "50 g"). */
  detail?: string;
  cartCount: number;
  /**
   * What the band is reporting. `added` confirms and offers the order;
   * `unavailable` reports and offers nothing, because there is nothing to go
   * and look at. The band used to render one label for both, so a sold-out tea
   * arrived under the words ADDED TO CART, the one sentence a confirmation
   * must never say.
   */
  tone?: CartToastTone;
  isVisible: boolean;
  onViewCart: () => void;
  onDismiss: () => void;
}

const MICRO_LABEL = 'font-sans text-ui-10 uppercase tracking-[0.2em]';

/**
 * The add-to-cart confirmation.
 *
 * It is a band, not a card. Everything the app pins to the bottom of a
 * phone, the navigation and the order bar docked on top of it, takes the same 1rem
 * inset, the same near-black translucent ground and the same corner, so a
 * confirmation drawn as a centred 280px slab in a different material read as a
 * fourth object arriving from somewhere else. Same inset, same material, same
 * corner: it reads as the assembly speaking, one step above itself.
 *
 * Full width also fixes the truncation the old min-width caused. A tea called
 * "Mahei Gushu Red" fitted; most of the shop's names did not.
 *
 * ── The positioning bug this replaces ────────────────────────────────────────
 *
 * The old band centred itself with `left-1/2 -translate-x-1/2`, and Framer
 * Motion animates `y` by writing `transform: translateY(...)` as an inline
 * style. An inline transform replaces the class's transform outright, so the
 * `-translate-x-1/2` half never applied and the band hung off the right edge of
 * every phone, clipped, from its first day. Nothing here relies on a transform
 * for position any more: `left-4 right-4` on the phone, a stated width against
 * `right-8` on the desk. Motion is free to own the transform, which is what it
 * assumes anyway.
 *
 * Vertical placement stays in CSS (`.cart-toast` in card-utilities.css), where
 * a `:has(.commerce-dock)` rule already lifts the band clear of the order bar
 * on a product page.
 */
export const CartToast: React.FC<CartToastProps> = ({
  itemName,
  detail,
  cartCount,
  tone = 'added',
  isVisible,
  onViewCart,
  onDismiss,
}) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isVisible) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onDismiss, 5000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isVisible, onDismiss]);

  const isAdded = tone === 'added';

  /* The reading half: what happened, then what it happened to. The size sits
     on the name's own line as a middle dot, the way the shop writes a tea's
     details everywhere else, rather than as a second line the band would have
     to grow for. */
  const reading = (
    <span className="min-w-0">
      <span className={`block ${MICRO_LABEL} text-tea-text-dim`}>
        {isAdded ? 'Added' : 'Unavailable'}
      </span>
      <span className="mt-[3px] block truncate font-display text-ui-15 text-tea-text">
        {itemName}
        {detail && <span className="text-tea-text-sec"> · {detail}</span>}
      </span>
    </span>
  );

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="status"
          aria-live="polite"
          className="cart-toast fixed left-4 right-4 z-toast bottom-nav-gap lg:bottom-8 lg:left-auto lg:right-8 lg:w-[380px] pointer-events-none"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="cart-toast-band pointer-events-auto flex items-stretch">
            {isAdded ? (
              /* One control across the whole reading half, so the affordance
                 the eye lands on and the thing the thumb hits are the same
                 object. The old band was a clickable div with two buttons
                 inside it: interactive content nested in an interactive
                 element, which is invalid and which no screen reader announces
                 the way it looks. */
              <button
                type="button"
                onClick={onViewCart}
                className="flex min-w-0 flex-1 items-center justify-between gap-4 py-2.5 pl-4 pr-3 text-left transition-colors hover:bg-tea-gold/6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50"
                aria-label={`Added ${itemName}${detail ? `, ${detail}` : ''}. Open order with ${cartCount} ${cartCount === 1 ? 'item' : 'items'}.`}
              >
                {reading}
                {/* The way to the order, written the way the product page's own
                    bar writes it: caps for the words, gold for the count, and
                    gold nowhere else on the band. */}
                <span
                  aria-hidden="true"
                  className={`flex shrink-0 items-center gap-2 ${MICRO_LABEL} text-tea-text-sec`}
                >
                  <span>View order</span>
                  <span className={`num text-tea-gold`}>{cartCount}</span>
                </span>
              </button>
            ) : (
              <div className="flex min-w-0 flex-1 items-center py-2.5 pl-4 pr-3">{reading}</div>
            )}

            <button
              type="button"
              onClick={onDismiss}
              className="tap-target shrink-0 px-3 text-tea-text-sec transition-colors duration-200 hover:text-tea-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold/50"
              aria-label="Dismiss"
            >
              <Icons.Close className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
