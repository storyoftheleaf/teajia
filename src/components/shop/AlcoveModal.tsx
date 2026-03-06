import React, { useState, useEffect, useRef } from 'react';
import { AlcoveCard } from './AlcoveCard';
import { Icons } from '../Icons';
import { useScrollLock } from '../../hooks/useScrollLock';
import type { InventoryItem } from '../../types';

interface AlcoveModalProps {
  item: InventoryItem | null;
  items: InventoryItem[];
  onClose: () => void;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onItemChange?: (item: InventoryItem) => void;
}

export const AlcoveModal: React.FC<AlcoveModalProps> = ({
  item,
  items,
  onClose,
  onAddToCart,
  onItemChange,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const isOpen = !!item;
  useScrollLock(isOpen);

  // Swipe navigation state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  useEffect(() => {
    if (item) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [item]);

  // Escape key
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't intercept touches on buttons/inputs inside the card
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    setTouchStart(e.touches[0].clientX);
    setTouchStartTime(Date.now());
    setSwipeOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    setSwipeOffset(e.touches[0].clientX - touchStart);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null || touchStartTime === null) return;

    const diff = touchStart - e.changedTouches[0].clientX;
    const distance = Math.abs(diff);
    const velocity = distance / (Date.now() - touchStartTime);
    const threshold = velocity > 0.3 ? 20 : 40;

    if (distance > threshold && onItemChange) {
      const currentIndex = items.findIndex(i => i.id === item.id);
      if (diff > 0 && currentIndex < items.length - 1) {
        onItemChange(items[currentIndex + 1]);
      } else if (diff < 0 && currentIndex > 0) {
        onItemChange(items[currentIndex - 1]);
      }
    }

    setTouchStart(null);
    setTouchStartTime(null);
    setSwipeOffset(0);
  };

  const handleAddToCart = (addedItem: InventoryItem, qty: number, total: number) => {
    if (onAddToCart) onAddToCart(addedItem, qty, total);
  };

  return (
    <div
      className={`fixed inset-0 z-[100] transition-all duration-300 ${isVisible ? 'bg-black/90' : 'bg-black/0 pointer-events-none'}`}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 z-[102] text-white/60 hover:text-white transition-colors p-2"
        onClick={onClose}
        aria-label="Close"
      >
        <Icons.Close className="w-6 h-6" />
      </button>

      {/* Card container */}
      <div
        className="flex items-center justify-center w-full h-full p-4 md:p-8"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeOffset * 0.3}px)`, transition: touchStart ? 'none' : 'transform 0.2s ease' }}
      >
        <AlcoveCard
          item={item}
          onAddToCart={handleAddToCart}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
