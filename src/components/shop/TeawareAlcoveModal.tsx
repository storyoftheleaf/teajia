import React from 'react';
import { TeawareAlcoveCard } from './TeawareAlcoveCard';
import { AlcoveCarouselShell, AlcoveCloseButton } from './alcove/AlcoveCarouselShell';
import type { InventoryItem } from '../../types';

interface TeawareAlcoveModalProps {
  item: InventoryItem | null;
  items: InventoryItem[];
  onClose: () => void;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onItemChange?: (item: InventoryItem) => void;
  /** Admin mode: shows edit button on the card */
  isAdmin?: boolean;
  /** Called when admin clicks edit */
  onEdit?: (item: InventoryItem) => void;
}

/**
 * The teaware carousel, which is the tea carousel with eight differences.
 *
 * Everything that used to be in this file (the swipe, the peeks, the arrows,
 * the trap, the keyboard, the backdrop hit test) is `AlcoveCarouselShell`,
 * because it was the same code twice. What is left is the list of ways this
 * carousel is not the other one, which is what a file like this should be.
 */
export const TeawareAlcoveModal: React.FC<TeawareAlcoveModalProps> = ({
  item,
  items,
  onClose,
  onAddToCart,
  onItemChange,
  isAdmin,
  onEdit,
}) => (
  <AlcoveCarouselShell
    item={item}
    items={items}
    onClose={onClose}
    onItemChange={onItemChange}
    // Named the same way the tea carousel is. The old comment here said a
    // teapot has no `alcove-title-*` heading to point at, which stopped being
    // true when `TeawareAlcoveCard` was ported onto `AlcoveIdentityHeader`:
    // that header renders `<h1 id="alcove-title-{item.id}">` for both cards.
    // Two dialogs rendering one title element had no reason to name themselves
    // by two different mechanisms, and `aria-labelledby` is the better of the
    // two because the accessible name then tracks the heading a reader sees.
    ariaLabelledBy={item ? `alcove-title-${item.id}` : undefined}
    backdropLayerClassName="z-modal"
    backdropScrimClassName="bg-black/95"
    arrowClassName="border border-tea-border bg-tea-gold/10 hover:bg-tea-gold/25 text-tea-gold"
    prevLabel="Previous item"
    nextLabel="Next item"
    peekHeight="min(90vh, 820px)"
    peekOpacity={0.35}
    peekBlur="blur(1px)"
    showCounter
    slotClassName="p-4 md:p-8"
    frameClassName="relative w-full max-w-[480px] md:max-w-[560px]"
    frameStyle={{
      // Mobile reserves 32px so the commerce footer sits low, close above the
      // floating bottom nav (which stays visible above the alcove), matching
      // the tea alcove. Desktop keeps 90vh / 820px.
      height: 'min(calc(100dvh - 32px - env(safe-area-inset-bottom, 0px)), 820px)',
      minHeight: '480px',
      width: 'min(480px, 85vw)',
    }}
    renderPeek={(peeked) => <TeawareAlcoveCard item={peeked} onClose={() => {}} />}
    renderCard={(focused) => (
      <>
        <TeawareAlcoveCard
          item={focused}
          onAddToCart={onAddToCart}
          onClose={onClose}
          isAdmin={isAdmin}
          onEdit={onEdit}
        />
        <AlcoveCloseButton onClose={onClose} />
      </>
    )}
  />
);
