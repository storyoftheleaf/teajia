import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ProductPage } from '../../pages/ProductPage';
import type { InventoryItem } from '../../types';

/**
 * A tea opened from a private link (an invoice's pay page, a /c/ collection)
 * is the store's own product page, the same component /shop/product/:id
 * renders, with the link's own bit on top (Adrian, 2026-11-27: "have it be the
 * store, just add an extra bit on top of it"). It opens over the link and
 * Back closes it. The link brings its own order footer, or none on an
 * invoice, where paying happens on the link itself. A private tea the shop
 * does not list opens from what the link carries.
 */
export function LinkTeaPage({ item, onClose, footer = null, top }: {
  item: InventoryItem;
  onClose: () => void;
  footer?: React.ReactNode;
  top?: React.ReactNode;
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
      className="fixed inset-0 z-modal overflow-y-auto bg-tea-bg pb-nav-gap"
      data-testid="link-tea-page"
    >
      <ProductPage link={{ productKey: item.id, fallbackItem: item, top, footer, onBack: onClose }} />
    </div>,
    document.body,
  );
}

export { LinkTeaTop } from './LinkTeaTop';
