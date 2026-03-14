import React, { useState, useMemo } from 'react';
import { AlcoveModal } from './AlcoveModal';
import { TeaPlaceholder } from './TeaPlaceholder';
import { Icons } from '../Icons';
import { useProductUrl } from '../../hooks/useProductUrl';
import type { InventoryItem } from '../../types';
import { fmtPrice } from '../../utils/formatNumber';

interface CollectionTabProps {
  inventory: InventoryItem[];
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
}

export const CollectionTab: React.FC<CollectionTabProps> = ({ inventory, onAddToCart }) => {
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const { closeWithHistory, navigateWithinModal } = useProductUrl(inventory, viewItem, setViewItem);

  const featuredItems = useMemo(
    () => inventory.filter(item => item.isFeatured),
    [inventory]
  );

  if (featuredItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 opacity-40">
        <div className="w-16 h-16 border border-tea-text/20  rounded-full flex items-center justify-center mb-4">
          <Icons.Seal className="w-6 h-6 text-tea-text/50" />
        </div>
        <p className="font-serif italic text-base text-tea-text/60">
          No featured teas at the moment.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 md:px-4 lg:px-6 py-6 animate-[fadeIn_0.5s_ease-out]">
      <AlcoveModal
        item={viewItem}
        items={featuredItems}
        onClose={closeWithHistory}
        onItemChange={navigateWithinModal}
        onAddToCart={(item, qty, total) => {
          onAddToCart(item, qty, total);
          closeWithHistory();
        }}
      />

      {/* Intro */}
      <div className="mb-8">
        <div className="w-12 h-[1px] bg-tea-gold mb-4" />
        <h2 className="font-serif text-2xl md:text-3xl text-tea-text mb-2">
          Our Picks
        </h2>
        <p className="text-sm text-tea-text/50 font-serif italic">
          Teas we keep coming back to.
        </p>
      </div>

      {/* Editorial cards */}
      <div className="flex flex-col gap-8 md:gap-10">
        {featuredItems.map(item => {
          const pricePerGram = parseFloat(item.price_per_gram || '0');
          const notes = item.tags || [];
          const accent = 'var(--tea-gold)';

          return (
            <div
              key={item.id}
              onClick={() => setViewItem(item)}
              className="group cursor-pointer bg-tea-bg/90 backdrop-blur-md border border-tea-gold/10 rounded-sm overflow-hidden hover:border-tea-gold/15 transition-colors duration-300"
            >
              <div className="flex flex-col md:flex-row">
                {/* Image */}
                <div className="w-full md:w-2/5 aspect-[16/9] md:aspect-auto md:min-h-[280px] overflow-hidden bg-tea-elevated/50">
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

                  {/* Tasting notes — marker style from AlcoveCard */}
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
                      <span className="num text-sm text-tea-gold">{fmtPrice(pricePerGram * 25)}</span>
                      <span className="text-tea-text-sec text-xs ml-1">/ 25g</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCart(item, 25, Math.round(pricePerGram * 25 * 100) / 100);
                      }}
                      className="ml-auto text-[10px] uppercase tracking-[0.12em] font-medium py-2 px-4 rounded-sm bg-tea-gold hover:bg-tea-gold-lt text-tea-bg transition-all active:scale-95 min-h-[44px]"
                    >
                      Add 25g
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
