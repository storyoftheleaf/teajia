import React, { useEffect, useRef } from 'react';
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
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-24 lg:bottom-8 left-1/2 lg:left-auto lg:right-8 lg:translate-x-0 -translate-x-1/2 z-toast transition-all duration-500 ease-out pointer-events-none ${
        isVisible
          ? 'translate-y-0 opacity-100'
          : 'translate-y-10 opacity-0'
      }`}
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
        {/* Gold accent bar */}
        <div className="w-0.5 h-8 bg-tea-gold rounded-full shrink-0" />

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-tea-text-sec uppercase tracking-widest mb-0.5">Added to cart</p>
          <p className="text-sm font-serif text-tea-text truncate">{itemName}</p>
        </div>

        {/* View Cart button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewCart();
          }}
          className="shrink-0 flex items-center gap-2 px-3 py-1.5 bg-tea-gold/10 border border-tea-gold/30 text-tea-gold text-xs uppercase tracking-widest hover:bg-tea-gold/20 transition-colors duration-200 rounded-sm"
        >
          <Icons.Bag className="w-3.5 h-3.5" />
          <span>{cartCount}</span>
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
    </div>
  );
};
