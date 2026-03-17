import React, { useState, useEffect, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product, Currency, ExchangeRate } from '../types';
import { formatCurrency, productToInventoryItem } from '../utils';
import { AlcoveCard } from '../../components/shop/AlcoveCard';
import { TastingEditorModal } from './TastingEditorModal';
import type { InventoryItem } from '../../types';

interface TeaDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: Product) => void;
  currency: Currency;
  rates: ExchangeRate[];
  onNext?: () => void;
  onPrev?: () => void;
  isAdmin?: boolean;
  onEdit?: (product: Product) => void;
}

export const TeaDetailsModal: React.FC<TeaDetailsModalProps> = ({
  product, isOpen, onClose, currency, rates, onNext, onPrev, isAdmin, onEdit
}) => {
  const [tastingProduct, setTastingProduct] = useState<Product | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Convert Product → InventoryItem for AlcoveCard
  const mappedItem = useMemo(
    () => product ? productToInventoryItem(product) : null,
    [product]
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && onNext) onNext();
      if (e.key === 'ArrowLeft' && onPrev) onPrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onNext, onPrev, onClose]);

  if (!isOpen || !product || !mappedItem) return null;

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) return;
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe && onNext) onNext();
    if (isRightSwipe && onPrev) onPrev();
    setTouchStart(null);
    setTouchEnd(null);
  };

  const handleAddToCart = (_item: any, qty: number, total: number) => {
    // The AlcoveCard handles its own add-to-cart UI state,
    // but we still call the parent's onAdd if needed
  };

  const handleTaste = isAdmin && product ? (_item: InventoryItem) => {
    setTastingProduct(product);
  } : undefined;

  const handleEdit = () => {
    if (onEdit && product) {
      onClose();
      onEdit(product);
    }
  };

  // Custom price formatter using admin's formatCurrency with currency/rates
  const adminFormatPrice = (pricePerGram: number, grams: number) => {
    return formatCurrency(pricePerGram * grams, currency, rates);
  };

  const hasNavigation = (onNext || onPrev);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product?.productName || 'Tea details'}
      className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/90 backdrop-blur-md p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      {/* Scrollbar styles */}
      <style>{`
        .tea-card-scroll::-webkit-scrollbar { width: 3px; }
        .tea-card-scroll::-webkit-scrollbar-track { background: transparent; }
        .tea-card-scroll::-webkit-scrollbar-thumb { background: var(--tea-border); border-radius: 2px; }
        @keyframes panelReveal {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Desktop prev/next arrows — hidden on mobile (swipe gestures handle it) */}
      {hasNavigation && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
          disabled={!onPrev}
          className="hidden md:flex absolute left-4 md:left-12 top-1/2 -translate-y-1/2 z-modal nav-control nav-control-lg"
        >
          <ChevronLeft size={32} />
        </button>
      )}

      {/* Card container with swipe (mobile swipe replaces arrows) */}
      <div
        className="flex flex-col items-center justify-center w-full h-full"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[480px]"
          style={{
            height: "min(90vh, 720px)",
            minHeight: "480px",
          }}
        >
          <AlcoveCard
            item={mappedItem}
            onAddToCart={handleAddToCart}
            onClose={onClose}
            isAdmin={isAdmin}
            onEdit={isAdmin && onEdit ? () => handleEdit() : undefined}
            formatPrice={adminFormatPrice}
            onTaste={handleTaste}
          />
          {/* Close button */}
          <button
            className="absolute top-2 right-2 z-10 nav-control nav-control-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
              stroke="var(--tea-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Desktop next arrow */}
      {hasNavigation && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext?.(); }}
          disabled={!onNext}
          className="hidden md:flex absolute right-4 md:right-12 top-1/2 -translate-y-1/2 z-modal nav-control nav-control-lg"
        >
          <ChevronRight size={32} />
        </button>
      )}

      {/* Tasting Editor Modal (admin only) */}
      {tastingProduct && (
        <TastingEditorModal
          product={tastingProduct}
          onClose={() => setTastingProduct(null)}
        />
      )}
    </div>
  );
};
