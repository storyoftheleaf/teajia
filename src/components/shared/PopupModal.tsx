import React, { useState, useRef, useEffect } from 'react';
import { Icons } from '../Icons';
import { HapticSlider } from './HapticSlider';
import { TeaPlaceholder } from '../shop/TeaPlaceholder';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { fmtShopPrice } from '../../utils/formatNumber';

export interface PopupItem {
  id: string;
  image: string;
  name: string;
  type?: string;
  variant?: string;
  year?: string;
  origin?: string;
  description?: string;
  price_per_gram?: string;
  price_50g?: string;
  stock_g?: string;
}

interface PopupModalProps {
  item: PopupItem | null;
  items: PopupItem[];
  onClose: () => void;
  onAddToCart?: (item: PopupItem, quantity: number, totalPrice: number) => void;
  onItemChange?: (item: PopupItem) => void;
  showQuantityControls?: boolean;
  quantityStep?: number;
  defaultQuantity?: number;
  maxQuantity?: number;
  itemType?: 'tea' | 'teaware';
}

export const PopupModal: React.FC<PopupModalProps> = ({
  item,
  items,
  onClose,
  onAddToCart,
  onItemChange,
  showQuantityControls = true,
  quantityStep = 25,
  defaultQuantity = 25,
  maxQuantity = 500,
  itemType = 'tea'
}) => {
  const [zoomTouchStart, setZoomTouchStart] = useState<number | null>(null);
  const [zoomTouchStartTime, setZoomTouchStartTime] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const isTouchOnSlider = useRef(false);
  const isOpen = !!item;
  useScrollLock(isOpen);
  const focusTrapRef = useFocusTrap<HTMLDivElement>(isOpen);

  // Escape key handler
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  // Bottom sheet drag state
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetTouchStartY = useRef(0);
  const isDraggingSheet = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Animate in
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (item) {
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [item]);

  if (!item) return null;

  const handleZoomTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    // Check if touching slider
    if (target.closest('input[type="range"]') || target.closest('.slider-area')) {
      isTouchOnSlider.current = true;
      return;
    }
    // Check if touching the bottom sheet drag handle or sheet content
    if (target.closest('.sheet-drag-handle')) {
      isDraggingSheet.current = true;
      sheetTouchStartY.current = e.touches[0].clientY;
      return;
    }
    isTouchOnSlider.current = false;
    isDraggingSheet.current = false;
    setZoomTouchStart(e.touches[0].clientX);
    setZoomTouchStartTime(Date.now());
    setSwipeOffset(0);
  };

  const handleZoomTouchMove = (e: React.TouchEvent) => {
    // Handle sheet drag
    if (isDraggingSheet.current) {
      const diff = e.touches[0].clientY - sheetTouchStartY.current;
      if (diff > 0) {
        setSheetDragY(diff);
      }
      return;
    }
    if (isTouchOnSlider.current || zoomTouchStart === null) return;
    const currentX = e.touches[0].clientX;
    const offset = currentX - zoomTouchStart;
    setSwipeOffset(offset);
  };

  const handleZoomTouchEnd = (e: React.TouchEvent) => {
    // Handle sheet drag end
    if (isDraggingSheet.current) {
      isDraggingSheet.current = false;
      if (sheetDragY > 100) {
        onClose();
      }
      setSheetDragY(0);
      return;
    }
    if (isTouchOnSlider.current) {
      isTouchOnSlider.current = false;
      return;
    }
    if (zoomTouchStart === null || zoomTouchStartTime === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const touchDuration = Date.now() - zoomTouchStartTime;
    const diff = zoomTouchStart - touchEnd;
    const distance = Math.abs(diff);

    const velocity = distance / touchDuration;
    const BASE_THRESHOLD = 30;
    const VELOCITY_THRESHOLD = 0.3;
    const threshold = velocity > VELOCITY_THRESHOLD ? 20 : BASE_THRESHOLD;

    if (distance < threshold) {
      setZoomTouchStart(null);
      setZoomTouchStartTime(null);
      return;
    }

    const currentIndex = items.findIndex(i => i.id === item.id);
    if (currentIndex === -1) {
      setZoomTouchStart(null);
      setZoomTouchStartTime(null);
      return;
    }

    let newItem: PopupItem | null = null;
    if (diff > 0) {
      if (currentIndex < items.length - 1) {
        newItem = items[currentIndex + 1];
      }
    } else {
      if (currentIndex > 0) {
        newItem = items[currentIndex - 1];
      }
    }

    if (newItem && onItemChange) {
      onItemChange(newItem);
    }

    setZoomTouchStart(null);
    setZoomTouchStartTime(null);
    setSwipeOffset(0);
  };

  const getQuantityPrice = (item: PopupItem, quantity: number): number => {
    const pricePerUnit = parseFloat(item.price_per_gram || item.price_50g || '0') || 0;
    return pricePerUnit > 0 ? Math.round(pricePerUnit * quantity * 100) / 100 : 0;
  };

  const currentQuantity = selectedQuantities[item.id] || defaultQuantity;
  const totalPrice = getQuantityPrice(item, currentQuantity);

  // Hide purchase controls entirely when onAddToCart is not provided
  const purchaseControls = onAddToCart && showQuantityControls && (
    <div className="rounded-lg p-4 w-full backdrop-blur-sm mt-4" style={{ background: 'var(--tea-accent-sub)', boxShadow: 'inset 0 1px 0 var(--tea-border), inset 0 -1px 0 var(--tea-accent-sub), 0 1px 4px rgba(0,0,0,0.2)' }}>
      {itemType === 'tea' ? (
        <>
          <div className="flex items-center gap-4 px-1 mb-4">
            <div className="flex flex-col min-w-[60px] text-left">
              <span className="text-[10px] uppercase tracking-[0.15em] text-tea-bg/60">Qty</span>
              <span className="num text-sm text-tea-bg">{currentQuantity}g</span>
            </div>
            <HapticSlider
              min={quantityStep}
              max={maxQuantity}
              step={quantityStep}
              value={currentQuantity}
              onChange={(val) => setSelectedQuantities(prev => ({ ...prev, [item.id]: val }))}
            />
          </div>
          <button
            onClick={() => { onAddToCart(item, currentQuantity, totalPrice); onClose(); }}
            className="add-to-cart-btn w-full bg-tea-gold hover:bg-tea-gold/90 text-tea-text text-xs uppercase tracking-[0.2em] font-medium py-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-3 focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none"
          >
            <span>Add to Cart</span>
            <span className="opacity-50">•</span>
            <span className="num">{fmtShopPrice(totalPrice)}</span>
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-4 px-1 mb-4">
            <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text/60">Quantity</span>
            <div className="flex items-center rounded-lg bg-tea-text/25 ml-auto" style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
              <button
                onClick={() => setSelectedQuantities(prev => ({ ...prev, [item.id]: Math.max(1, (prev[item.id] || defaultQuantity) - 1) }))}
                disabled={currentQuantity <= 1}
                className="px-3 py-2 hover:bg-tea-gold/10 transition-colors text-tea-text disabled:opacity-30"
              >−</button>
              <span className="px-4 py-2 num text-sm min-w-[50px] text-center" style={{ boxShadow: 'inset 1px 0 0 var(--tea-border), inset -1px 0 0 var(--tea-border)' }}>{currentQuantity}</span>
              <button
                onClick={() => setSelectedQuantities(prev => ({ ...prev, [item.id]: Math.min(maxQuantity, (prev[item.id] || defaultQuantity) + 1) }))}
                disabled={currentQuantity >= maxQuantity}
                className="px-3 py-2 hover:bg-tea-gold/10 transition-colors text-tea-text disabled:opacity-30"
              >+</button>
            </div>
          </div>
          <button
            onClick={() => { onAddToCart(item, currentQuantity, totalPrice); onClose(); }}
            className="add-to-cart-btn w-full bg-tea-gold hover:bg-tea-gold/90 text-tea-text text-xs uppercase tracking-[0.2em] font-medium py-3 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-3 focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none"
          >
            <span>Add to Cart</span>
            <span className="opacity-50">•</span>
            <span className="num">{fmtShopPrice(totalPrice)}</span>
          </button>
        </>
      )}
    </div>
  );

  return (
    <div
      ref={focusTrapRef}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      className={`fixed inset-0 z-modal transition-all duration-300 ${isVisible ? 'bg-black/85' : 'bg-tea-text/0'}`}
      onClick={onClose}
      onTouchStart={handleZoomTouchStart}
      onTouchMove={handleZoomTouchMove}
      onTouchEnd={handleZoomTouchEnd}
    >
      {/* Desktop: Centered modal */}
      <div className="hidden md:flex w-full h-full flex-col items-center justify-center p-8 cursor-zoom-out">
        <div className="relative w-full max-w-4xl flex flex-col items-center">
          <div
            className="relative max-h-[65vh] w-auto shadow-2xl rounded-lg overflow-hidden transition-transform duration-100"
            style={{ transform: `translateX(${swipeOffset * 0.5}px)` }}
          >
            {item.image ? (
              <img src={item.image} className="w-full h-full object-contain max-h-[65vh]" alt={item.name} loading="lazy" />
            ) : (
              <div className="w-full flex items-center justify-center" style={{ height: '40vh' }}>
                <TeaPlaceholder type={item.type || ''} style={{ width: '100%', height: '100%' }} />
              </div>
            )}
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-tea-bg/90 to-transparent pointer-events-none" />
          </div>
          <div className="mt-6 text-center w-full max-w-sm cursor-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-3xl text-tea-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>{item.name}</h2>
            {(item.type || item.variant) && (
              <div className="text-tea-gold text-xs uppercase tracking-[0.2em] mb-2 font-medium">
                {item.type} {item.variant ? `• ${item.variant}` : ''}
              </div>
            )}
            {(item.year || item.origin) && (
              <div className="flex items-center justify-center gap-3 text-tea-text/70 text-xs uppercase tracking-[0.15em] mb-4">
                {item.year && <span className="font-mono tabular-nums">{item.year}</span>}
                {item.year && item.origin && <span>•</span>}
                {item.origin && <span>{item.origin}</span>}
              </div>
            )}
            {itemType === 'teaware' && item.description && (
              <p className="italic text-sm text-tea-text/80 leading-relaxed mb-4" style={{ fontFamily: 'var(--font-body)' }}>{item.description}</p>
            )}
            {purchaseControls}
          </div>
        </div>
        <button className="absolute top-6 right-6 text-tea-text-sec hover:text-tea-text transition-colors focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none rounded-lg" onClick={onClose} aria-label="Close">
          <Icons.Close className="w-8 h-8" />
        </button>
      </div>

      {/* Mobile: Bottom sheet */}
      <div
        ref={sheetRef}
        className={`md:hidden absolute left-0 right-0 flex flex-col transition-transform duration-300 ease-out ${isVisible ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ transform: isVisible ? `translateY(${sheetDragY}px)` : 'translateY(100%)', bottom: 0, maxHeight: 'calc(100dvh - 44px - env(safe-area-inset-bottom, 0px))' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Image area — peek above sheet */}
        <div
          className="relative w-full overflow-hidden transition-transform duration-100"
          style={{ transform: `translateX(${swipeOffset * 0.5}px)`, maxHeight: '40vh' }}
        >
          {item.image ? (
            <img src={item.image} className="w-full h-full object-contain max-h-[40vh]" alt={item.name} loading="lazy" />
          ) : (
            <div className="w-full flex items-center justify-center" style={{ height: '30vh' }}>
              <TeaPlaceholder type={item.type || ''} style={{ width: '100%', height: '100%' }} />
            </div>
          )}
          <div className="absolute bottom-0 left-0 w-full h-20 bg-gradient-to-t from-tea-bg to-transparent pointer-events-none" />
        </div>

        {/* Sheet content */}
        <div className="bg-tea-bg rounded-t-lg relative -mt-4 pb-[calc(44px+env(safe-area-inset-bottom,0px))] lg:pb-[env(safe-area-inset-bottom)]">
          {/* Drag handle */}
          <div className="sheet-drag-handle flex justify-center pt-3 pb-4 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1 bg-tea-gold/15 rounded-full" />
          </div>

          <div className="px-6 pb-6">
            <h2 className="text-2xl text-tea-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>{item.name}</h2>
            {(item.type || item.variant) && (
              <div className="text-tea-gold text-xs uppercase tracking-[0.2em] mb-2 font-medium">
                {item.type} {item.variant ? `• ${item.variant}` : ''}
              </div>
            )}
            {(item.year || item.origin) && (
              <div className="flex items-center gap-3 text-tea-text/70 text-xs uppercase tracking-[0.15em] mb-3">
                {item.year && <span className="font-mono tabular-nums">{item.year}</span>}
                {item.year && item.origin && <span>•</span>}
                {item.origin && <span>{item.origin}</span>}
              </div>
            )}
            {itemType === 'teaware' && item.description && (
              <p className="italic text-sm text-tea-text/80 leading-relaxed mb-3" style={{ fontFamily: 'var(--font-body)' }}>{item.description}</p>
            )}
            {purchaseControls}
          </div>
        </div>
      </div>
    </div>
  );
};
