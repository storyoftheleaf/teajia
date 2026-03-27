import React, { useState, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { AlcoveModal } from './AlcoveModal';
import { TeaPlaceholder } from './TeaPlaceholder';
import { TastingSession } from '../tasting/TastingSession';
import { Icons } from '../Icons';
import { SectionDivider } from '../shared/SectionDivider';
import { useProductUrl } from '../../hooks/useProductUrl';
import { useAppStore } from '../../lib/store';
import type { InventoryItem } from '../../types';
import { fmtPrice } from '../../utils/formatNumber';

interface CollectionTabProps {
  inventory: InventoryItem[];
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
}

/** Shared card component for both saved and recommended items */
const ItemCard: React.FC<{
  item: InventoryItem;
  onView: (item: InventoryItem) => void;
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
  isSaved?: boolean;
  onToggleSave?: (id: string) => void;
}> = ({ item, onView, onAddToCart, isSaved, onToggleSave }) => {
  const pricePerGram = parseFloat(item.price_per_gram || '0');
  const priceUnit = parseFloat(item.price_50g || '0');
  const isTea = item.category === 'tea';
  const isSoldOut = item.stock_g <= 0;
  const notes = item.tags || [];
  const accent = 'var(--tea-gold)';

  return (
    <div
      onClick={() => onView(item)}
      className="group cursor-pointer bg-tea-bg/90 backdrop-blur-md border border-tea-gold/10 rounded-sm overflow-hidden hover:border-tea-gold/15 transition-colors duration-300"
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
              onClick={(e) => { e.stopPropagation(); onToggleSave(item.id); }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-tea-bg/60 backdrop-blur-sm flex items-center justify-center transition-all hover:bg-tea-bg/80"
              title={isSaved ? 'Remove from saved' : 'Save for later'}
            >
              <Icons.Heart
                className={`w-4 h-4 transition-colors ${isSaved ? 'text-tea-gold fill-tea-gold' : 'text-tea-text/60'}`}
              />
            </button>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 p-5 md:p-8 flex flex-col">
          {/* Type · Origin · Year */}
          <p className="font-serif text-xs italic text-tea-text/40 mb-2">
            {item.type}
            {item.origin && <><span className="mx-2 opacity-40">·</span>{item.origin}</>}
            {item.year && <><span className="mx-2 opacity-40">·</span>{item.year}</>}
          </p>

          <h3 className="font-serif text-2xl text-tea-text mb-1 group-hover:text-tea-gold transition-colors">
            {item.name}
          </h3>
          {item.variant && item.variant !== item.name && (
            <p className="font-serif italic text-sm text-tea-text/50 mb-3">
              {item.variant}
            </p>
          )}

          {/* Lore / Description */}
          {(item.lore || item.description) && (
            <p className="font-serif text-sm text-tea-text/70 leading-relaxed mb-4 line-clamp-3">
              {item.lore || item.description}
            </p>
          )}

          {/* Tasting notes */}
          {(item.mood || notes.length > 0) && (
            <div className="flex flex-col gap-1.5 mb-4">
              {item.mood && (
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-[18px] h-[2px] rounded-lg shrink-0"
                    style={{ background: accent, opacity: 0.7 }}
                  />
                  <span className="font-serif italic text-xs text-tea-text/70">
                    {item.mood}
                  </span>
                </div>
              )}
              {notes.slice(0, 3).map((note, i) => (
                <div key={note} className="flex items-center gap-2.5">
                  <div
                    className="h-[2px] rounded-lg shrink-0"
                    style={{
                      width: `${16 - i * 2}px`,
                      background: accent,
                      opacity: 0.5 - i * 0.15,
                    }}
                  />
                  <span
                    className="font-serif italic text-xs"
                    style={{ color: 'var(--tea-text-sec)', opacity: 1 - i * 0.18 }}
                  >
                    {note}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Price + Quick Add */}
          <div className="mt-auto flex items-center gap-3">
            <div>
              {isTea ? (
                <>
                  <span className="num text-sm text-tea-gold">{fmtPrice(pricePerGram * 50)}</span>
                  <span className="text-tea-text-sec text-xs ml-1">/ 50g</span>
                </>
              ) : (
                <span className="num text-sm text-tea-gold">{fmtPrice(priceUnit)}</span>
              )}
            </div>
            <button
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
              className={`ml-auto text-[10px] uppercase tracking-[0.12em] font-medium py-2 px-4 rounded-sm transition-all min-h-[44px] ${
                isSoldOut
                  ? 'bg-tea-accent-sub text-tea-text-sec cursor-not-allowed opacity-60'
                  : 'bg-tea-gold hover:bg-tea-gold-lt text-tea-bg active:scale-95'
              }`}
            >
              {isSoldOut ? 'Sold Out' : isTea ? 'Add 50g' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const CollectionTab: React.FC<CollectionTabProps> = ({ inventory, onAddToCart }) => {
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const [tastingItem, setTastingItem] = useState<InventoryItem | null>(null);
  const { closeWithHistory, navigateWithinModal } = useProductUrl(inventory, viewItem, setViewItem);

  const favoriteTeas = useAppStore(state => state.favoriteTeas);
  const toggleFavoriteTea = useAppStore(state => state.toggleFavoriteTea);

  const handleTaste = useCallback((item: InventoryItem) => {
    const url = new URL(window.location.href);
    if (url.searchParams.has('product')) {
      url.searchParams.delete('product');
      window.history.replaceState(null, '', url.toString());
    }
    setViewItem(null);
    setTastingItem(item);
  }, []);

  const handleOrderFromTasting = useCallback((item: InventoryItem) => {
    setTastingItem(null);
    setViewItem(item);
  }, []);

  // Saved items — resolved from favorite IDs
  const savedItems = useMemo(
    () => favoriteTeas
      .map(id => inventory.find(item => item.id === id))
      .filter((item): item is InventoryItem => item !== undefined),
    [favoriteTeas, inventory]
  );

  // Our picks — featured items, excluding already-saved ones
  const recommendedItems = useMemo(
    () => inventory.filter(item => item.isFeatured && !favoriteTeas.includes(item.id)),
    [inventory, favoriteTeas]
  );

  // All items for modal navigation
  const allDisplayItems = useMemo(
    () => [...savedItems, ...recommendedItems],
    [savedItems, recommendedItems]
  );

  const hasSaved = savedItems.length > 0;
  const hasRecommended = recommendedItems.length > 0;
  const isEmpty = !hasSaved && !hasRecommended;

  return (
    <div className="max-w-5xl mx-auto px-3 md:px-4 lg:px-6 py-6 animate-[fadeIn_0.5s_ease-out]">
      <AlcoveModal
        item={viewItem}
        items={allDisplayItems}
        onClose={closeWithHistory}
        onItemChange={navigateWithinModal}
        onAddToCart={(item, qty, total) => {
          onAddToCart(item, qty, total);
          closeWithHistory();
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
        <h2 className="font-serif text-2xl md:text-3xl text-tea-text mb-2">
          For You
        </h2>
        <p className="text-sm text-tea-text-sec leading-relaxed max-w-lg">
          Teas you've saved and teas we think you'll love. Tap the heart on any tea across the shop to add it here — your own shortlist for when you're ready to order.
        </p>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-24 opacity-50">
          <div className="w-16 h-16 border border-tea-text/20 rounded-full flex items-center justify-center mb-4">
            <Icons.Heart className="w-6 h-6 text-tea-text/40" />
          </div>
          <p className="font-serif italic text-base text-tea-text/60 text-center mb-1">
            Nothing saved yet.
          </p>
          <p className="text-xs text-tea-text/40 text-center max-w-xs">
            Browse the Tea or Teaware tabs and tap the heart icon on anything that catches your eye.
          </p>
        </div>
      )}

      {/* Saved items section */}
      {hasSaved && (
        <>
          <SectionDivider label="Saved" subtitle={`${savedItems.length} ${savedItems.length === 1 ? 'item' : 'items'} you've set aside.`} />
          <div className="flex flex-col gap-6 md:gap-8">
            {savedItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onView={setViewItem}
                onAddToCart={onAddToCart}
                isSaved={true}
                onToggleSave={toggleFavoriteTea}
              />
            ))}
          </div>
        </>
      )}

      {/* Recommended / Our Picks section */}
      {hasRecommended && (
        <>
          <SectionDivider
            label="Our Picks"
            subtitle="Teas we keep coming back to — worth a try if you haven't already."
          />
          <div className="flex flex-col gap-6 md:gap-8">
            {recommendedItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onView={setViewItem}
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
