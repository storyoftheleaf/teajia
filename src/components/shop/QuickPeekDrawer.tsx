import React, { useState, useEffect, useRef } from 'react';
import { Icons } from '../Icons';
import { Button } from '../shared/Button';
import { HapticSlider } from '../shared/HapticSlider';
import { useScrollLock } from '../../hooks/useScrollLock';
import type { InventoryItem } from '../../types';
import { fmtPrice } from '../../utils/formatNumber';

interface QuickPeekDrawerProps {
  item: InventoryItem | null;
  onClose: () => void;
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
}

export const QuickPeekDrawer: React.FC<QuickPeekDrawerProps> = ({ item, onClose, onAddToCart }) => {
  const [quantity, setQuantity] = useState(25);
  const [isVisible, setIsVisible] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useScrollLock(!!item);

  // Animate in
  useEffect(() => {
    if (item) {
      setQuantity(item.category === 'tea' ? 25 : 1);
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [item]);

  // Swipe-to-dismiss on mobile
  const touchStartY = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY.current;
    if (delta > 80) onClose();
    touchStartY.current = null;
  };

  if (!item) return null;

  const isTea = item.category === 'tea';
  const pricePerUnit = isTea
    ? parseFloat(item.price_per_gram || '0')
    : parseFloat(item.price_50g || '0');
  const total = pricePerUnit * quantity;
  const maxQty = isTea ? Math.min(item.stock_g, 500) : Math.min(item.stock_g, 10);

  const handleAdd = () => {
    onAddToCart(item, quantity, total);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Drawer — bottom sheet on mobile, right-edge on desktop */}
      <div
        ref={drawerRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`
          fixed z-[61] bg-tea-paper dark:bg-tea-bg shadow-2xl overflow-y-auto
          transition-transform duration-300 ease-out
          bottom-0 left-0 right-0 max-h-[70vh] rounded-t-xl
          lg:bottom-0 lg:right-0 lg:left-auto lg:top-0 lg:w-[400px] lg:max-h-none lg:h-full lg:rounded-none
          ${isVisible
            ? 'translate-y-0 lg:translate-y-0 lg:translate-x-0'
            : 'translate-y-full lg:translate-y-0 lg:translate-x-full'
          }
        `}
      >
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-tea-ink/20 dark:bg-white/20" />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-tea-paper dark:bg-tea-bg border-b border-tea-ink/10 dark:border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h3 className="font-serif text-lg text-tea-ink dark:text-tea-paper truncate pr-4">
            {item.name}
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-tea-ink/10 dark:hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center shrink-0"
          >
            <Icons.Close className="w-5 h-5 text-tea-ink dark:text-tea-paper" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Image */}
          <div className="aspect-square rounded-lg overflow-hidden bg-tea-ink/5 dark:bg-white/5">
            <img
              src={item.image}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Meta */}
          <div>
            <p className="text-xs uppercase tracking-wider text-tea-ink/50 dark:text-tea-paper/50 mb-1">
              {item.origin} · {item.year}
            </p>
            <p className="text-sm text-tea-ink/70 dark:text-tea-paper/70 leading-relaxed">
              {item.description}
            </p>
          </div>

          {/* Quantity */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase tracking-wider text-tea-ink/50 dark:text-tea-paper/50">
                Quantity
              </span>
              <span className="num text-sm text-tea-ink dark:text-tea-paper">
                {quantity}{isTea ? 'g' : ' unit(s)'}
              </span>
            </div>
            {isTea ? (
              <HapticSlider
                min={25}
                max={maxQty}
                step={25}
                value={quantity}
                onChange={setQuantity}
                unit="g"
                size="sm"
              />
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 rounded-md border border-tea-ink/20 dark:border-white/20 flex items-center justify-center hover:bg-tea-ink/5 dark:hover:bg-white/5"
                >
                  −
                </button>
                <span className="num text-lg w-8 text-center text-tea-ink dark:text-tea-paper">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                  className="w-10 h-10 rounded-md border border-tea-ink/20 dark:border-white/20 flex items-center justify-center hover:bg-tea-ink/5 dark:hover:bg-white/5"
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* Add to Cart */}
          <Button variant="primary" fullWidth onClick={handleAdd}>
            Add {fmtPrice(total)}
          </Button>
        </div>
      </div>
    </>
  );
};
