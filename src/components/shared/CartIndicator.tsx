
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../Icons';

interface CartIndicatorProps {
  itemCount: number;
  onOpen: () => void;
}

/**
 * Subtle floating cart pill — appears when items are in cart.
 * On mobile, sits just above the bottom nav bar. On desktop, floats at bottom-right.
 * Tapping opens the cart drawer.
 */
export const CartIndicator: React.FC<CartIndicatorProps> = ({ itemCount, onOpen }) => {
  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.button
          onClick={onOpen}
          className="fixed right-4 z-toast"
          style={{ bottom: 'calc(52px + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          aria-label={`View cart, ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
        >
          <div className="flex items-center gap-2 pl-3 pr-3.5 py-2.5 bg-tea-surface/95 backdrop-blur-md border border-tea-border shadow-lg rounded-sm">
            <Icons.Bag className="w-4 h-4 text-tea-text-sec" strokeWidth={1.8} />
            <span className="text-xs font-serif text-tea-text tracking-wide">{itemCount}</span>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
