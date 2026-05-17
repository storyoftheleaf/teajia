import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';

interface OrderBarProps {
  buyingCount: number;
  onViewOrder: () => void;
}

export const OrderBar: React.FC<OrderBarProps> = ({ buyingCount, onViewOrder }) => {
  return (
    <AnimatePresence>
      {buyingCount > 0 && (
        <motion.button
          type="button"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          onClick={onViewOrder}
          className="w-full flex items-center justify-center gap-2 px-4 py-3
                     rounded-xl bg-tea-gold text-tea-bg font-medium text-sm
                     shadow-lg transition-transform active:scale-[0.98]"
        >
          <ShoppingBag size={16} />
          <span>
            {buyingCount} {buyingCount === 1 ? 'item' : 'items'} to buy
          </span>
          <span className="opacity-70">·</span>
          <span>View Order</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
};

export default OrderBar;
