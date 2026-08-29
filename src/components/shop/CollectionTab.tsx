import React, { useState, useMemo, useCallback } from 'react';
import type { Location } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AlcoveModal } from './AlcoveModal';
import { TeaPlaceholder } from './TeaPlaceholder';
import { TastingSession, type TastingItem } from '../tasting/TastingSession';
import { Icons } from '../Icons';
import { SectionDivider } from '../shared/SectionDivider';
import { useProductModalRoute } from '../../hooks/useProductModalRoute';
import { useAppStore } from '../../lib/store';
import type { InventoryItem } from '../../types';
import { useShopPrice } from './shopPrice';
import { AddToSampleButton } from '../samples/AddToSampleButton';
import { BODY, HEADING, LABEL, NUMERAL } from '../shared/typeRoles';

interface CollectionTabProps {
  inventory: InventoryItem[];
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
  modalLocation?: Location;
}

/**
 * The saved / picks card, on the page's four type roles.
 *
 * The last card in the shop still running a private scale. It set six sizes
 * (`text-2xl`, `text-base`, `text-sm`, `text-xs`, `text-ui-10` and the browser
 * default) against the four roles the rest of the shop settled on in round one,
 * and it carried the hierarchy in *opacity*: `text-tea-text/40` on the metadata,
 * `/50` on the variant, `/70` on the lore, plus an inline `opacity: 1 - i*0.18`
 * ramp on the tasting notes. The readability floor bans a text opacity modifier
 * outright, for a reason this card demonstrates: `/40` on the dim end of the
 * scale is a metadata line that disappears in daylight.
 *
 * The ramp was worse than illegible. Notes were printed at falling width and
 * falling opacity by array index, which is a ranking drawn on data that carries
 * no rank: the first tag a curator happened to type read as the strongest note
 * in the tea. Same mark for each of them now, and the hierarchy inside the card
 * is carried by colour, which is how every other block on these surfaces does
 * it.
 */
const ItemCard: React.FC<{
  item: InventoryItem;
  onView: (item: InventoryItem) => void;
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
}> = ({ item, onView, onAddToCart, isSaved, onToggleSave }) => {
  // The saved-teas card quoted whole dollars while the product page it opens
  // quoted the reader's currency, so a tea changed price by being tapped.
  const shopPrice = useShopPrice();
  const pricePerGram = parseFloat(item.price_per_gram || '0');
  // For teaware/misc: price_50g is actually per-unit price (legacy field name)
  const priceUnit = parseFloat(item.price_50g || '0');
  const isTea = item.category === 'tea';
  const isSoldOut = item.stock_g <= 0;
  const notes = item.tags || [];

  return (
    <div
      onClick={() => onView(item)}
      className="group cursor-pointer bg-tea-bg/90 backdrop-blur-md border border-tea-border rounded-md overflow-hidden hover:border-tea-gold/15 transition-colors duration-300"
    >
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="relative w-full md:w-2/5 aspect-[16/9] md:aspect-auto md:min-h-[280px] overflow-hidden bg-tea-elevated/50">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            />
          ) : (
            <TeaPlaceholder type={item.type} style={{ width: '100%', height: '100%' }} />
          )}
          {/* Save/unsave button overlay */}
          {onToggleSave && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleSave(item.id); }}
              className="tap-target absolute top-3 right-3 w-8 h-8 rounded-full bg-tea-bg/60 backdrop-blur-sm flex items-center justify-center transition-all hover:bg-tea-bg/80"
              aria-label={isSaved ? `Remove ${item.name} from saved` : `Save ${item.name} for later`}
              aria-pressed={Boolean(isSaved)}
            >
              <Icons.Heart
                className={`w-4 h-4 transition-colors ${isSaved ? 'text-tea-gold fill-tea-gold' : 'text-tea-text-sec'}`}
              />
            </button>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 p-5 md:p-8 flex flex-col">
          {/* A run of facts joined by interpuncts is a sentence, not a label,
              so it is set as body and coloured dim rather than shrunk. */}
          <p className={`${BODY} mb-2 italic text-tea-text-dim`}>
            {[item.type, item.origin, item.year].filter(Boolean).join(' \u00b7 ')}
          </p>

          <h3 className={`${HEADING} mb-1 text-tea-text transition-colors group-hover:text-tea-gold`}>
            {item.name}
          </h3>
          {item.variant && item.variant !== item.name && (
            <p className={`${BODY} mb-3 italic text-tea-text-dim`}>
              {item.variant}
            </p>
          )}

          {/* Lore / Description */}
          {(item.lore || item.description) && (
            <p className={`${BODY} mb-4 line-clamp-3 text-tea-text-sec`}>
              {item.lore || item.description}
            </p>
          )}

          {/* Tasting notes. One mark each, one colour each. */}
          {(item.mood || notes.length > 0) && (
            <div className="flex flex-col gap-1.5 mb-4">
              {item.mood && (
                <div className="flex items-center gap-2.5">
                  <span className="h-px w-4 shrink-0 bg-tea-border" aria-hidden="true" />
                  <span className={`${BODY} italic text-tea-text-sec`}>{item.mood}</span>
                </div>
              )}
              {notes.slice(0, 3).map(note => (
                <div key={note} className="flex items-center gap-2.5">
                  <span className="h-px w-4 shrink-0 bg-tea-border" aria-hidden="true" />
                  <span className={`${BODY} italic text-tea-text-sec`}>{note}</span>
                </div>
              ))}
            </div>
          )}

          {/* Price + Quick Add */}
          <div className="mt-auto flex items-center gap-3">
            <div>
              <span className={`${BODY} ${NUMERAL} text-tea-gold`}>
                {isTea ? shopPrice.total(pricePerGram * 50) : shopPrice.total(priceUnit)}
              </span>
              <span className={`${BODY} ml-1 text-tea-text-sec`}>{isTea ? '/ 50g' : 'each'}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {isTea && (
                <AddToSampleButton
                  item={{
                    id: item.id,
                    name: item.name,
                    chineseName: item.chineseName,
                    type: item.type,
                    vendorName: item.supplier || undefined,
                    productId: item.id,
                  }}
                  variant="icon"
                  size={15}
                />
              )}
              {/* The buy button reads the one measured solid-CTA treatment
                  (.cta-solid) rather than spelling the gold fill and the cream
                  text out by hand: that pairing is 4.1:1 in light mode. */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (isSoldOut) return;
                  if (isTea) {
                    onAddToCart(item, 50, Math.round(pricePerGram * 50 * 100) / 100);
                  } else {
                    onAddToCart(item, 1, priceUnit);
                  }
                }}
                disabled={isSoldOut}
                className={`${LABEL} min-h-[44px] rounded-md px-4 py-2 font-medium transition-all ${
                  isSoldOut
                    ? 'cursor-not-allowed bg-tea-accent-sub text-tea-text-sec'
                    : 'cta-solid active:scale-95'
                }`}
              >
                {isSoldOut ? 'Sold Out' : isTea ? 'Add 50g' : 'Add to Cart'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CollectionTab: React.FC<CollectionTabProps> = ({ inventory, onAddToCart, modalLocation }) => {
  const [tastingItem, setTastingItem] = useState<InventoryItem | null>(null);
  // Alcove modal driven by the URL (/shop/product/:id + background state).
  const { viewItem, openProduct, navigateWithinModal, closeProduct } = useProductModalRoute(inventory, modalLocation);

  const favoriteTeas = useAppStore(state => state.favoriteTeas);
  const toggleFavoriteTea = useAppStore(state => state.toggleFavoriteTea);

  const handleTaste = useCallback((item: InventoryItem) => {
    // Close the AlcoveModal via history so it cannot re-open behind the
    // tasting session.
    closeProduct();
    setTastingItem(item);
  }, [closeProduct]);

  const handleOrderFromTasting = useCallback((item: TastingItem) => {
    setTastingItem(null);
    openProduct(item as InventoryItem); // item is always a full InventoryItem at runtime
  }, [openProduct]);

  // Saved items, resolved from favorite IDs
  const savedItems = useMemo(
    () => favoriteTeas
      .map(id => inventory.find(item => item.id === id))
      .filter((item): item is InventoryItem => item !== undefined),
    [favoriteTeas, inventory]
  );

  /**
   * The shelf: whatever the curator has flagged as featured, minus what the
   * reader has already saved.
   *
   * The variable was called `recommendedItems` and it is not a
   * recommendation. `isFeatured` is a merchandising flag one person sets in the
   * admin panel; it does not read the reader, it does not know what they have
   * looked at, and it is the same list for everyone who opens this tab. The
   * page presented it as personalisation anyway, under a heading of "For You"
   * and a line about teas we think you'll love, which is a claim the code
   * cannot support and a mode this project does not build. The filter is
   * unchanged. The name and the copy now say what it is.
   */
  const shelfItems = useMemo(
    () => inventory.filter(item => item.isFeatured && !favoriteTeas.includes(item.id)),
    [inventory, favoriteTeas]
  );

  // All items for modal navigation
  const allDisplayItems = useMemo(
    () => [...savedItems, ...shelfItems],
    [savedItems, shelfItems]
  );

  const hasSaved = savedItems.length > 0;
  const hasShelf = shelfItems.length > 0;
  const isEmpty = !hasSaved && !hasShelf;

  return (
    <div className="max-w-5xl mx-auto py-6 px-3 md:px-4 animate-[fadeIn_0.5s_ease-out]">
      <AlcoveModal
        item={viewItem}
        items={allDisplayItems}
        onClose={closeProduct}
        onItemChange={navigateWithinModal}
        onAddToCart={(item, qty, total) => {
          onAddToCart(item, qty, total);
          closeProduct();
        }}
        onTaste={handleTaste}
      />

      <AnimatePresence>
        {tastingItem && (
          <TastingSession
            item={tastingItem}
            onClose={() => setTastingItem(null)}
            onOrderTea={handleOrderFromTasting}
          />
        )}
      </AnimatePresence>

      {/* Page intro */}
      <div className="mb-8">
        <div className="w-12 h-[1px] bg-tea-gold mb-4" />
        <h2 className={`${HEADING} mb-2 text-tea-text`}>
          Liked
        </h2>
        <p className={`${BODY} max-w-lg text-tea-text-sec`}>
          Teas you've set aside, and the shelf we're pouring from this season. Tap the heart on any tea across the shop to add it here. Your own shortlist for when you're ready to order.
        </p>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-16 h-16 border border-tea-border rounded-full flex items-center justify-center mb-4">
            <Icons.Heart className="w-6 h-6 text-tea-text-dim" />
          </div>
          <p className={`${BODY} mb-1 text-center italic text-tea-text-sec`}>
            Nothing saved yet.
          </p>
          <p className={`${BODY} max-w-xs text-center text-tea-text-dim`}>
            Browse the Tea or Teaware tabs and tap the heart icon on anything that catches your eye.
          </p>
        </div>
      )}

      {/* Saved items section */}
      {hasSaved && (
        <>
          <SectionDivider label="Liked" subtitle={`${savedItems.length} ${savedItems.length === 1 ? 'item' : 'items'} you've set aside.`} />
          <div className="flex flex-col gap-6 md:gap-8">
            {savedItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onView={openProduct}
                onAddToCart={onAddToCart}
                isSaved={true}
                onToggleSave={toggleFavoriteTea}
              />
            ))}
          </div>
        </>
      )}

      {/* The curator's shelf. Not a recommendation: see the `shelfItems` note. */}
      {hasShelf && (
        <>
          <SectionDivider
            label="On the Shelf"
            subtitle="What the curator has out this season. The same shelf for everyone who walks in."
          />
          <div className="flex flex-col gap-6 md:gap-8">
            {shelfItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onView={openProduct}
                onAddToCart={onAddToCart}
                isSaved={false}
                onToggleSave={toggleFavoriteTea}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
