import React, { useState, useMemo } from 'react';
import { AlcoveModal } from './AlcoveModal';
import { Icons } from '../Icons';
import type { InventoryItem } from '../../types';
import { fmtPricePerGram } from '../../utils/formatNumber';

interface CollectionTabProps {
  inventory: InventoryItem[];
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
}

export const CollectionTab: React.FC<CollectionTabProps> = ({ inventory, onAddToCart }) => {
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);

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
        onClose={() => setViewItem(null)}
        onItemChange={(item) => setViewItem(item)}
        onAddToCart={(item, qty, total) => {
          onAddToCart(item, qty, total);
          setViewItem(null);
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
          const accent = '#b5651d';

          return (
            <div
              key={item.id}
              onClick={() => setViewItem(item)}
              className="group cursor-pointer bg-tea-bg/80/90 backdrop-blur-md border border-white/10 rounded-sm overflow-hidden hover:border-white/20 transition-colors duration-300"
            >
              <div className="flex flex-col md:flex-row">
                {/* Image */}
                <div className="w-full md:w-2/5 aspect-[16/9] md:aspect-auto md:min-h-[280px] overflow-hidden">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  />
                </div>

                {/* Details */}
                <div className="flex-1 p-5 md:p-8 flex flex-col">
                  {/* Type · Origin · Year */}
                  <p className="font-serif text-xs italic text-tea-paper/40 mb-2">
                    {item.type}
                    {item.origin && <><span className="mx-2 opacity-40">·</span>{item.origin}</>}
                    {item.year && <><span className="mx-2 opacity-40">·</span>{item.year}</>}
                  </p>

                  <h3 className="font-serif text-2xl text-tea-paper mb-1 group-hover:text-tea-gold transition-colors">
                    {item.name}
                  </h3>
                  {item.variant && item.variant !== item.name && (
                    <p className="font-serif italic text-sm text-tea-paper/50 mb-3">
                      {item.variant}
                    </p>
                  )}

                  {/* Lore / Description */}
                  {(item.lore || item.description) && (
                    <p className="font-serif text-sm text-tea-paper/70 leading-relaxed mb-4 line-clamp-3">
                      {item.lore || item.description}
                    </p>
                  )}

                  {/* Tasting notes — marker style from AlcoveCard */}
                  {(item.mood || notes.length > 0) && (
                    <div className="flex flex-col gap-1.5 mb-4">
                      {item.mood && (
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-[18px] h-[2px] rounded-[1px] shrink-0"
                            style={{ background: accent, opacity: 0.7 }}
                          />
                          <span className="font-serif italic text-xs text-tea-paper/70">
                            {item.mood}
                          </span>
                        </div>
                      )}
                      {notes.slice(0, 3).map((note, i) => (
                        <div key={note} className="flex items-center gap-2.5">
                          <div
                            className="h-[2px] rounded-[1px] shrink-0"
                            style={{
                              width: `${16 - i * 2}px`,
                              background: accent,
                              opacity: 0.5 - i * 0.15,
                            }}
                          />
                          <span
                            className="font-serif italic text-xs"
                            style={{ color: 'rgba(196,184,154,0.7)', opacity: 1 - i * 0.18 }}
                          >
                            {note}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Price */}
                  <div className="mt-auto">
                    <span className="num text-sm text-tea-gold">
                      {fmtPricePerGram(pricePerGram)}
                    </span>
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
