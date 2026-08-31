
import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { CartItem as AdminCartItem, ExchangeRate } from '../../admin/types';
import { CartItem as PublicCartItem } from '../../types';
import { Icons } from '../Icons';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { PublicCart } from './PublicCart';

const AdminCart = lazy(() => import('./AdminCart').then(m => ({ default: m.AdminCart })));

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
  storeSlug: string;
  storeName: string;
  cart: PublicCartItem[];
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, grams: number) => void;
  onAddItem: (item: PublicCartItem) => void;
  /** Optional per-store override; falls back to platform default when absent. */
  whatsappNumber?: string;
  contactEmail?: string;
};

type CartPanelProps = { isOpen: boolean; onClose: () => void } & (AdminProps | PublicProps);

export const CartPanel: React.FC<CartPanelProps> = (props) => {
  const { isOpen, onClose } = props;
  const isAdmin = props.mode === 'admin';

  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Visibility state, drives opacity-only fade matching AccountPanel
  const [mounted, setMounted] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Next frame so the initial opacity-0 paints before transitioning to 1
      const id = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setIsVisible(false);
      const t = setTimeout(() => setMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  /**
   * The page's own docked bar stands down while this panel is open.
   *
   * The product page's order bar is `z-nav` (75) and this panel is `z-modal`
   * (40), so the bar was drawing over an open order panel: the reader saw the
   * price of the tea they were looking at floating on top of the order they
   * were editing. Raising the panel would put it over the navigation too,
   * which is a different and worse answer. The panel is the thing that knows
   * it is covering the page, so it is the thing that says so, and any other
   * surface that docks a bar inherits the fix.
   */
  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add('cart-panel-open');
    return () => document.body.classList.remove('cart-panel-open');
  }, [isOpen]);

  // Focus return on close
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement;
    } else if (triggerRef.current) {
      const el = triggerRef.current;
      triggerRef.current = null;
      requestAnimationFrame(() => requestAnimationFrame(() => el.focus()));
    }
  }, [isOpen]);

  // Swipe to dismiss (public only, drag handle on mobile)
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

  if (!mounted) return null;

  const dragTransform = isDragging ? `translateX(${touchOffset}px)` : undefined;
  const dragOpacity = isDragging ? Math.max(0.3, 1 - (touchOffset / 150) * 0.7) : undefined;

  return createPortal(
    <>
      {/* Backdrop, same pattern as AccountPanel */}
      <div
        className={`fixed inset-0 z-drawer bg-black/80 backdrop-blur-sm ${isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ transition: isVisible ? 'opacity 300ms ease' : 'opacity 150ms ease' }}
        onClick={onClose}
      />

      {/* Panel, docks right, opacity fade, viewport-attached via portal */}
      <div
        ref={focusTrapRef}
        className="fixed top-0 right-0 h-full w-full md:w-[400px] bg-tea-bg z-modal shadow-2xl flex flex-col border-l border-tea-border pb-[env(safe-area-inset-bottom,0px)]"
        style={{
          opacity: isDragging ? dragOpacity : (isVisible ? 1 : 0),
          transform: dragTransform,
          pointerEvents: isVisible ? undefined : 'none',
          transition: isDragging ? 'none' : (isVisible ? 'opacity 300ms ease' : 'opacity 150ms ease'),
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
          <div className="flex flex-col flex-1 min-h-0">
            {/* Drag handle, mobile only */}
            <div data-drag-handle className="md:hidden flex justify-center py-2 cursor-grab active:cursor-grabbing touch-pan-x shrink-0">
              <div className={`h-1 rounded-full transition-all duration-150 ${isDragging ? 'bg-tea-gold w-16' : 'bg-tea-text-sec/30 w-10'}`} />
            </div>

            {/* Header: Close top-left, matching AccountPanel rule. The title
                sits centred in the same row so the panel names itself without
                spending a third band of chrome above the steps. */}
            <div className="flex items-center gap-3 px-4 py-1.5 bg-tea-surface shrink-0">
              <button
                onClick={onClose}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2"
                aria-label="Close cart"
              >
                <Icons.Close className="w-5 h-5 text-tea-text-sec hover:text-tea-text transition-colors" />
              </button>
              <span className="flex-1 text-center font-display text-[23px] leading-none text-tea-text">Your order</span>
              <span className="min-w-[44px] shrink-0" aria-hidden="true" />
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 min-h-0">
              <PublicCart
                storeSlug={props.storeSlug}
                storeName={props.storeName}
                cart={props.cart}
                onRemoveItem={props.onRemoveItem}
                onUpdateQuantity={props.onUpdateQuantity}
                onAddItem={props.onAddItem}
                isOpen={isOpen}
                whatsappNumber={props.whatsappNumber}
                contactEmail={props.contactEmail}
                onClose={onClose}
              />
            </div>
          </div>
        ) : null}
      </div>
    </>,
    document.body
  );
};
