
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
          style={{ bottom: 'calc(44px + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
          initial={{ scale: 0.8, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.8, opacity: 0, y: 10 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          aria-label={`View cart, ${itemCount} item${itemCount !== 1 ? 's' : ''}`}
        >
          <div className="flex items-center gap-2 pl-3 pr-3.5 py-2.5 bg-tea-surface/95 backdrop-blur-md border border-tea-border shadow-lg rounded-full">
            <Icons.Bag className="w-4 h-4 text-tea-text-sec" strokeWidth={1.8} />
            <span className="text-xs font-serif text-tea-text tracking-wide">{itemCount}</span>
          </div>
        </motion.button>
      )}
    </AnimatePresence>
  );
};
