
import React, { useState, useRef, lazy, Suspense } from 'react';
import { CartItem as AdminCartItem, ExchangeRate, Currency } from '../../admin/types';
import { CartItem as PublicCartItem } from '../../types';
import { Icons } from '../Icons';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { PublicCart } from './PublicCart';

const AdminCart = lazy(() => import('./AdminCart').then(m => ({ default: m.AdminCart })));

// ── Types ───────────────────────────────────────────────────────────────────

type AdminProps = {
  mode: 'admin';
  cart: AdminCartItem[];
  setCart: (cart: AdminCartItem[]) => void;
  onClearCart: () => void;
  onSuccess: () => void;
  rates: ExchangeRate[];
  showToast: (message: string, type?: string) => void;
};

type PublicProps = {
  mode: 'public';
  cart: PublicCartItem[];
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, grams: number) => void;
};

type CartPanelProps = { isOpen: boolean; onClose: () => void } & (AdminProps | PublicProps);

// ── Component ────────────────────────────────────────────────────────────────

export const CartPanel: React.FC<CartPanelProps> = (props) => {
  const { isOpen, onClose } = props;
  const isAdmin = props.mode === 'admin';

  useScrollLock(isOpen);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // ── Swipe to dismiss (public only) ─────────────────────────────────────
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchOffset, setTouchOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isDragHandle = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    isDragHandle.current = !!target.closest('[data-drag-handle]');
    if (!isDragHandle.current) return;
    setTouchStart(e.touches[0].clientX);
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragHandle.current || touchStart === null) return;
    const offset = e.touches[0].clientX - touchStart;
    if (offset > 0) setTouchOffset(offset);
  };
  const handleTouchEnd = () => {
    if (!isDragHandle.current || touchStart === null) return;
    if (touchOffset > 150) onClose();
    setTouchStart(null);
    setTouchOffset(0);
    setIsDragging(false);
    isDragHandle.current = false;
  };

  const swipeProgress = touchOffset / 150;
  const swipeOpacity = Math.max(0.3, 1 - swipeProgress * 0.7);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-drawer bg-tea-text/80 backdrop-blur-sm transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={focusTrapRef}
        className={`fixed top-0 right-0 h-full w-full z-drawer shadow-2xl flex flex-col ${
          isAdmin
            ? 'md:w-[480px] bg-tea-bg/95 backdrop-blur-2xl border-l border-tea-border'
            : 'md:w-[450px] bg-tea-bg'
        } ${isOpen ? '' : 'pointer-events-none'}`}
        style={{
          transform: isOpen ? `translateX(${touchOffset}px)` : 'translateX(100%)',
          opacity: isDragging ? swipeOpacity : 1,
          transition: isDragging ? 'none' : 'transform 300ms ease-out, opacity 300ms ease-out',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isAdmin && props.mode === 'admin' ? (
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center text-tea-text-sec">
              <div className="animate-pulse text-sm">Loading...</div>
            </div>
          }>
            <AdminCart
              cart={props.cart}
              setCart={props.setCart}
              onClearCart={props.onClearCart}
              onSuccess={props.onSuccess}
              onClose={onClose}
              rates={props.rates}
              showToast={props.showToast}
            />
          </Suspense>
        ) : props.mode === 'public' ? (
          <div className="surface-warm flex flex-col h-full">
            {/* Public header */}
            <div className="flex flex-col relative z-10">
              <div data-drag-handle className="md:hidden flex justify-center py-3 bg-tea-surface cursor-grab active:cursor-grabbing touch-pan-x">
                <div className={`h-1 rounded-full transition-all duration-150 ${isDragging ? 'bg-tea-gold w-16' : 'bg-tea-bg/20 w-12'}`} />
              </div>
              <div className="flex items-center justify-between p-6 border-b border-tea-gold/20 bg-tea-surface">
                <div className="w-[44px]" />
                <div className="text-center">
                  <h2 className="text-lg font-serif text-tea-text tracking-wide">Your Selection</h2>
                </div>
                <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2.5" aria-label="Close cart">
                  <Icons.Close className="w-6 h-6 text-tea-text-sec hover:text-tea-text" />
                </button>
              </div>
            </div>

            <PublicCart
              cart={props.cart}
              onRemoveItem={props.onRemoveItem}
              onUpdateQuantity={props.onUpdateQuantity}
              isOpen={isOpen}
            />
          </div>
        ) : null}
      </div>
    </>
  );
};
