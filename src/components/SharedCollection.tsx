
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icons, SealIcon } from './Icons';
import { useInventory } from '../context/InventoryContext';
import { AlcoveModal } from './shop/AlcoveModal';
import type { InventoryItem } from '../types';

export const SharedCollection: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { inventory } = useInventory();
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);

  const collectionIds = useMemo(() => {
    const encoded = searchParams.get('c');
    if (!encoded) return [];
    try {
      return atob(encoded).split(',').filter(Boolean);
    } catch {
      return [];
    }
  }, [searchParams]);

  const collectionItems = useMemo(() => {
    return collectionIds
      .map(id => inventory.find(item => item.id === id))
      .filter((item): item is InventoryItem => !!item);
  }, [collectionIds, inventory]);

  if (collectionIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-[fadeIn_0.5s_ease-out]">
        <SealIcon className="w-12 h-12 text-tea-seal/30 mb-4" />
        <h1 className="text-2xl font-serif text-tea-ink dark:text-tea-paper mb-2">Collection Not Found</h1>
        <p className="text-sm text-tea-ink/50 dark:text-tea-paper/50 max-w-md">
          This collection link appears to be invalid or expired.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-16 animate-[fadeIn_0.5s_ease-out]">
      <AlcoveModal
        item={viewItem}
        items={collectionItems}
        onClose={() => setViewItem(null)}
        onItemChange={setViewItem}
      />

      {/* Header */}
      <div className="text-center pt-8 pb-8">
        <SealIcon className="w-8 h-8 text-tea-seal mx-auto mb-3 opacity-60" />
        <h1 className="text-3xl font-serif text-tea-ink dark:text-tea-paper mb-1">Shared Collection</h1>
        <p className="text-sm text-tea-ink/50 dark:text-tea-paper/50 font-serif italic">
          {collectionItems.length} {collectionItems.length === 1 ? 'selection' : 'selections'} from Teajia
        </p>
      </div>

      {/* Tea Grid */}
      <div className="space-y-0 border-t border-tea-ink/10 dark:border-white/10">
        {collectionItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setViewItem(item)}
            className="flex items-center gap-4 px-4 py-4 border-b border-tea-ink/5 dark:border-white/5 hover:bg-tea-ink/[0.02] dark:hover:bg-white/[0.02] cursor-pointer transition-colors group"
          >
            {/* Image */}
            {item.image && (
              <div className="w-14 h-14 rounded-sm overflow-hidden shrink-0 bg-tea-ink/5 dark:bg-white/10">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-serif text-base text-tea-ink dark:text-tea-paper group-hover:text-tea-seal transition-colors truncate">
                {item.name}
              </h3>
              <div className="flex items-center gap-2 text-[11px] text-tea-ink/50 dark:text-tea-paper/50 mt-0.5">
                <span>{item.type}</span>
                {item.origin && (
                  <>
                    <span className="opacity-40">·</span>
                    <span>{item.origin}</span>
                  </>
                )}
                {item.year && (
                  <>
                    <span className="opacity-40">·</span>
                    <span className="font-mono">{item.year}</span>
                  </>
                )}
              </div>
              {item.mood && (
                <p className="text-[11px] font-serif italic text-tea-ink/40 dark:text-tea-paper/40 mt-1 truncate">{item.mood}</p>
              )}
            </div>

            {/* Price */}
            <div className="shrink-0 text-right">
              <span className="font-mono text-sm text-tea-ink/70 dark:text-tea-paper/70">
                ${parseFloat(item.price_per_gram || '0').toFixed(2)}/g
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="text-center pt-8">
        <a
          href="/shop"
          className="inline-flex items-center gap-2 px-6 py-3 bg-tea-seal text-white text-xs uppercase tracking-[0.2em] hover:bg-tea-seal/90 transition-colors"
        >
          Browse Full Shop
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
