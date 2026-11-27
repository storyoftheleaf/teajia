import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlcoveCard } from './AlcoveCard';
import { ProductDetailPageContext } from './ProductDetailLayout';
import { useInventory } from '../../context/InventoryContext';
import type { InventoryItem } from '../../types';

/**
 * A tea opened from a private link (an invoice's pay page, a /c/ collection)
 * shows the shop's own tea page, exactly as /shop/product/:id draws it, with
 * everything written for the tea in the store (Adrian, 2026-11-27). It opens
 * over the link and closes back to it. The link brings its own order footer,
 * or none on an invoice, where paying happens on the link itself; `addition`
 * is the link's own words for the tea, such as the sender's note.
 */
export function LinkTeaPage({ item, onClose, footer = null, addition }: {
  item: InventoryItem;
  onClose: () => void;
  footer?: React.ReactNode;
  addition?: React.ReactNode;
}) {
  // A tea in the shop opens as the shop holds it, every written field
  // included. A private tea, which the shop does not list, opens from what the
  // link carries.
  const { inventory } = useInventory();
  const shopItem = inventory.find(tea => tea.id === item.id) ?? item;
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
      <ProductDetailPageContext.Provider value={{ shopHref: '/shop', selectedBy: [], cartItemCount: 0, onBack: onClose }}>
        <AlcoveCard item={shopItem} layout="page" onClose={onClose} linkFooter={footer} linkAddition={addition} />
      </ProductDetailPageContext.Provider>
    </div>,
    document.body,
  );
}
