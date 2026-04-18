
import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion';
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
  onAddItem: (item: PublicCartItem) => void;
  /** Optional per-store override; falls back to platform default when absent. */
  whatsappNumber?: string;
};

type CartPanelProps = { isOpen: boolean; onClose: () => void } & (AdminProps | PublicProps);

// ── Component ────────────────────────────────────────────────────────────────

export const CartPanel: React.FC<CartPanelProps> = (props) => {
  const { isOpen, onClose } = props;
  const isAdmin = props.mode === 'admin';

  useScrollLock(isOpen);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // ── Swipe gesture hint (first open only) ───────────────────────────────
  const panelControls = useAnimationControls();

  useEffect(() => {
    if (isOpen) {
      panelControls.start({ x: 0 });
      if (!localStorage.getItem('cart-swipe-hint-shown')) {
        const timer = setTimeout(() => {
          panelControls.start({ x: [0, 20, 0], transition: { duration: 0.4, ease: 'easeInOut' } });
          localStorage.setItem('cart-swipe-hint-shown', '1');
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, panelControls]);

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
        className="fixed inset-0 z-toast bg-tea-text/80 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      />

      {/* Panel — slide in from right, z-toast above bottom nav */}
      <motion.div
        ref={focusTrapRef}
        className={`fixed top-0 right-0 h-full w-full z-toast shadow-2xl flex flex-col pb-[env(safe-area-inset-bottom,0px)] glass-grain ${
          isAdmin
            ? 'md:w-[480px] bg-tea-bg/95 backdrop-blur-2xl border-l border-tea-border'
            : 'md:w-[450px] bg-tea-surface border-l border-tea-border backdrop-blur-xl'
        }`}
        initial={{ x: '100%' }}
        animate={isDragging ? { x: touchOffset, opacity: swipeOpacity } : panelControls}
        exit={{ x: '100%' }}
        transition={isDragging ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 300 }}
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
              <div data-drag-handle className="md:hidden flex justify-center py-4 bg-tea-surface cursor-grab active:cursor-grabbing touch-pan-x">
                <div className={`h-1.5 rounded-full transition-all duration-150 ${isDragging ? 'bg-tea-gold w-16' : 'bg-tea-text-sec/30 w-12'}`} />
              </div>
              <div className="flex items-center justify-between p-6 border-b border-tea-border bg-tea-surface">
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
              onAddItem={props.onAddItem}
              isOpen={isOpen}
              whatsappNumber={props.whatsappNumber}
              onClose={onClose}
            />
          </div>
        ) : null}
      </motion.div>
      </>
      )}
    </AnimatePresence>
  );
};
