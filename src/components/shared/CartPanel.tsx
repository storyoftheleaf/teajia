
import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CartItem as AdminCartItem, ExchangeRate, Currency } from '../../admin/types';
import { CartItem as PublicCartItem } from '../../types';
import { Icons } from '../Icons';
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
  onAddItem: (item: PublicCartItem) => void;
  /** Optional per-store override; falls back to platform default when absent. */
  whatsappNumber?: string;
};

type CartPanelProps = { isOpen: boolean; onClose: () => void } & (AdminProps | PublicProps);

// ── Component ────────────────────────────────────────────────────────────────

export const CartPanel: React.FC<CartPanelProps> = (props) => {
  const { isOpen, onClose } = props;
  const isAdmin = props.mode === 'admin';

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // ── Focus return on close (#61) ─────────────────────────────────────────
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
    } else if (triggerRef.current) {
      const el = triggerRef.current;
      triggerRef.current = null;
      setTimeout(() => el.focus(), 100);
    }
  }, [isOpen]);

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
    <AnimatePresence>
      {isOpen && (
      <>
      {/* Backdrop with blur fade — z-toast to render above bottom nav */}
      <motion.div
        className="fixed inset-0 z-toast bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeOut' } }}
        transition={{ duration: 0.3 }}
      />

      {/* Panel — fade in */}
      <motion.div
        ref={focusTrapRef}
        className={`fixed top-0 right-0 h-dvh w-full z-toast shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom,0px)] glass-grain ${
          isAdmin
            ? 'md:w-[480px] bg-tea-bg/95 backdrop-blur-2xl'
            : 'md:w-[460px] bg-tea-surface'
        } border-l border-tea-border`}
        initial={{ opacity: 0 }}
        animate={isDragging ? { x: touchOffset, opacity: swipeOpacity } : { opacity: 1, x: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.15, ease: 'easeOut' } }}
        transition={isDragging ? { duration: 0 } : { duration: 0.3, ease: 'easeOut' }}
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
          <div className="flex flex-col flex-1 min-h-0">
            {/* Drag handle — mobile only */}
            <div data-drag-handle className="md:hidden flex justify-center py-3 cursor-grab active:cursor-grabbing touch-pan-x shrink-0">
              <div className={`h-1 rounded-full transition-all duration-150 ${isDragging ? 'bg-tea-gold w-16' : 'bg-tea-text-sec/30 w-10'}`} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-tea-border shrink-0">
              <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2" aria-label="Close cart">
                <Icons.Close className="w-5 h-5 text-tea-text-sec hover:text-tea-text transition-colors" />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 min-h-0">
              <PublicCart
                cart={props.cart}
                onRemoveItem={props.onRemoveItem}
                onUpdateQuantity={props.onUpdateQuantity}
                onAddItem={props.onAddItem}
                isOpen={isOpen}
                whatsappNumber={props.whatsappNumber}
                onClose={onClose}
              />
            </div>
          </div>
        ) : null}
      </motion.div>
      </>
      )}
    </AnimatePresence>
  );
};
