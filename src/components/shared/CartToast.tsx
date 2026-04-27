import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../Icons';

interface CartToastProps {
  itemName: string;
  cartCount: number;
  isVisible: boolean;
  onViewCart: () => void;
  onDismiss: () => void;
}

export const CartToast: React.FC<CartToastProps> = ({
  itemName,
  cartCount,
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

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(44px+env(safe-area-inset-bottom,0px)+1rem)] lg:bottom-8 left-1/2 lg:left-auto lg:right-8 lg:translate-x-0 -translate-x-1/2 z-toast pointer-events-none"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            className="pointer-events-auto bg-tea-surface border border-tea-border shadow-2xl rounded-sm px-5 py-3.5 flex items-center gap-4 min-w-[280px] max-w-[90vw] md:max-w-md cursor-pointer select-none"
            onClick={onViewCart}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onViewCart();
            }}
            tabIndex={0}
            role="button"
            aria-label={`Added ${itemName}. View cart with ${cartCount} items.`}
          >
            {/* Item info */}
            <div className="flex-1 min-w-0">
              <p className="text-ui-11 text-tea-text-sec uppercase tracking-[0.15em] mb-0.5">Added to cart</p>
              <p className="text-sm font-serif text-tea-text truncate">{itemName}</p>
            </div>

            {/* View Cart — typographic, no bronze fill */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewCart();
              }}
              className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 text-tea-text text-ui-11 uppercase tracking-[0.15em] underline underline-offset-4 decoration-tea-border hover:decoration-tea-gold transition-colors"
            >
              <Icons.Bag className="w-3.5 h-3.5 text-tea-text-sec" />
              <span className="num">{cartCount}</span>
            </button>

            {/* Dismiss */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="shrink-0 p-1 text-tea-text-sec hover:text-tea-text transition-colors duration-200"
              aria-label="Dismiss"
            >
              <Icons.Close className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
