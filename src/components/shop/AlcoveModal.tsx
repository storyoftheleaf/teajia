import React from 'react';
import { AlcoveCard } from './AlcoveCard';
import { AlcoveCarouselShell, AlcoveCloseButton } from './alcove/AlcoveCarouselShell';
import type { InventoryItem } from '../../types';

interface AlcoveModalProps {
  item: InventoryItem | null;
  items: InventoryItem[];
  onClose: () => void;
  onAddToCart?: (item: InventoryItem, qty: number, total: number) => void;
  onItemChange?: (item: InventoryItem) => void;
  onTermClick?: (termId: string, categoryId: string) => void;
  onTaste?: (item: InventoryItem) => void;
  onEditProductTasting?: (item: InventoryItem) => void;
  isAdmin?: boolean;
}

/**
 * The tea carousel. Every carousel behaviour lives in `AlcoveCarouselShell`;
 * this file is the card, its four editorial callbacks, and the breakpoint
 * sizing the tea card needs and the teaware card does not.
 *
 * The shell's defaults are this modal's values, so nothing here restates a
 * scrim, a z-layer, a peek opacity or an arrow treatment.
 */
export const AlcoveModal: React.FC<AlcoveModalProps> = ({
  item,
  items,
  onClose,
  onAddToCart,
  onItemChange,
  onTermClick,
  onTaste,
  onEditProductTasting,
  isAdmin,
}) => (
  <AlcoveCarouselShell
    item={item}
    items={items}
    onClose={onClose}
    onItemChange={onItemChange}
    ariaLabelledBy={item ? `alcove-title-${item.id}` : undefined}
    slotStyle={{ width: '100%', height: '100%' }}
    renderPeek={(peeked) => <AlcoveCard item={peeked} onClose={() => {}} />}
    renderCard={(focused) => (
      <>
        {/* On desktop, constrain size. On mobile (<lg), leave just enough
            clearance at the bottom for the global BottomTabBar so the alcove
            commerce footer sits low, close above the floating capsule, instead
            of leaving a dead gap. The capsule floats 12px off the bottom, so we
            reserve 32px here and the footer drops nearer to it. */}
        <style>{`
          [data-alcove-card-wrapper] {
            height: calc(100dvh - 44px - 32px - env(safe-area-inset-bottom, 0px));
            max-height: calc(100dvh - 44px - 32px - env(safe-area-inset-bottom, 0px));
          }
          @media (min-width: 1024px) {
            [data-alcove-card-wrapper] {
              height: calc(100dvh - 44px - env(safe-area-inset-bottom, 0px));
              max-height: calc(100dvh - 44px - env(safe-area-inset-bottom, 0px));
            }
          }
          @media (min-width: 768px) {
            [data-alcove-card-wrapper] {
              height: min(90vh, 780px) !important;
              min-height: 480px !important;
              width: min(480px, 85vw) !important;
              max-height: min(90vh, 780px) !important;
              border-radius: 3px;
            }
          }
        `}</style>
        <div data-alcove-card-wrapper className="relative w-full md:rounded-[3px] overflow-hidden">
          <AlcoveCard
            item={focused}
            onAddToCart={onAddToCart}
            onClose={onClose}
            onTermClick={onTermClick}
            onTaste={onTaste}
            onEditProductTasting={onEditProductTasting}
            isAdmin={isAdmin}
          />
          <AlcoveCloseButton onClose={onClose} />
        </div>
      </>
    )}
  />
);
