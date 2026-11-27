import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ProductPage } from '../../pages/ProductPage';
import type { InventoryItem } from '../../types';
import type { YoursStripNav } from './YoursStrip';

/**
 * A tea opened from a private link (an invoice's pay page, a /c/ collection)
 * is the store's own product page, the same component /shop/product/:id
 * renders, with the link's own bit on top (Adrian, 2026-11-27: "have it be the
 * store, just add an extra bit on top of it"). It opens over the link and
 * Back closes it. A collection brings its own order footer at its own price;
 * an invoice's tea keeps the shop's own, to get more of it. A private tea the
 * shop does not list opens from what the link carries, with no footer.
 * On a desktop it opens beside the left sidebar, which stays (Adrian, 2026-11-27).
 */
export function LinkTeaPage({ item, onClose, footer, top, yoursLine, yoursNote, yoursNav, onAddToCart, onOpenCart, cartItemCount }: {
  item: InventoryItem;
  onAddToCart?: (item: InventoryItem, grams: number, totalUsd: number) => void;
  onClose: () => void;
  /** The shop's cart, opened from the shop's own bar. */
  onOpenCart?: () => void;
  cartItemCount?: number;
  footer?: React.ReactNode;
  top?: React.ReactNode;
  /** The tea is theirs on this link: the page shows the strip that is theirs with this line. */
  yoursLine?: string;
  yoursNote?: { text: string | null | undefined; by?: string };
  /** Where the tea sits among the link's teas, and the arrows to the ones beside it. */
  yoursNav?: YoursStripNav;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [item.id]);

  return createPortal(
    <div
      ref={scroller}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      className="link-tea-page fixed inset-0 z-modal overflow-y-auto bg-tea-bg pb-nav-gap"
      data-testid="link-tea-page"
    >
      <ProductPage onAddToCart={onAddToCart} onCartClick={onOpenCart} cartItemCount={cartItemCount} link={{ productKey: item.id, fallbackItem: item, top, yoursLine, yoursNote, yoursNav, footer, onBack: onClose }} />
    </div>,
    document.body,
  );
}

