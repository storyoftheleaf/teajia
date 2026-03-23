import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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

  const dialog = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={product?.productName || 'Tea details'}
      className="fixed inset-0 bottom-[calc(49px+env(safe-area-inset-bottom))] lg:bottom-0 z-modal flex items-center justify-center bg-tea-bg md:bg-tea-bg/90 md:backdrop-blur-md md:p-4 animate-in fade-in duration-300"
      onClick={onClose}
    >
      {/* Scrollbar + responsive card height styles */}
      <style>{`
        .tea-card-scroll::-webkit-scrollbar { width: 3px; }
        .tea-card-scroll::-webkit-scrollbar-track { background: transparent; }
        .tea-card-scroll::-webkit-scrollbar-thumb { background: var(--tea-border); border-radius: 2px; }
        @keyframes panelReveal {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .alcove-modal-card { height: calc(100dvh - 49px - env(safe-area-inset-bottom)); height: calc(100vh - 49px); }
        @supports (height: 100dvh) {
          .alcove-modal-card { height: calc(100dvh - 49px - env(safe-area-inset-bottom)); }
        }
        @media (min-width: 768px) {
          .alcove-modal-card { height: min(90vh, 720px); }
        }
      `}</style>

      <div className="flex flex-col items-center justify-center w-full h-full">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full md:max-w-[480px] alcove-modal-card"
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

    </div>
  );

  return (
    <>
      {dialog}
      {/* Tasting Editor Modal — rendered via portal to avoid click propagation closing the parent */}
      {tastingProduct && createPortal(
        <TastingEditorModal
          product={tastingProduct}
          onClose={() => setTastingProduct(null)}
        />,
        document.body
      )}
    </>
  );
};
