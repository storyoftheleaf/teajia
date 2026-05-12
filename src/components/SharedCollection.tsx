import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SealIcon } from './Icons';
import { useInventory } from '../context/InventoryContext';
import { AlcoveModal } from './shop/AlcoveModal';
import type { InventoryItem } from '../types';
import { fmtPricePerGram } from '../utils/formatNumber';

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

  // ── Empty / invalid state ───────────────────────────────────────────────────
  if (collectionIds.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-3 pb-nav-gap">
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <SealIcon className="w-7 h-7 text-tea-text-dim" />
          <h3 className="font-display text-ui-17 text-tea-text mt-4">Collection not found</h3>
          <p className="text-ui-12 text-tea-text-sec mt-1 leading-relaxed">
            This collection link appears to be invalid or expired.
          </p>
          <a
            href="/shop"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors mt-6"
          >
            Browse Shop
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-nav-gap">
      <AlcoveModal
        item={viewItem}
        items={collectionItems}
        onClose={() => setViewItem(null)}
        onItemChange={setViewItem}
      />

      {/* Editorial cover */}
      <div className="text-center pt-8 pb-10">
        <SealIcon className="w-8 h-8 text-tea-gold mx-auto mb-4 opacity-70" />
        <p className="label-caps text-tea-text-dim">Curated by Teajia</p>
        <h1 className="h1 mt-2">Shared Collection</h1>
        <p className="subtitle mt-2">
          {collectionItems.length} {collectionItems.length === 1 ? 'selection' : 'selections'} chosen for you
        </p>
      </div>

      {/* Tea list */}
      <ul className="divide-y divide-tea-border bg-tea-surface border border-tea-border rounded-xl overflow-hidden">
        {collectionItems.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setViewItem(item)}
              className="w-full text-left flex items-center gap-4 px-4 md:px-6 py-4 hover:bg-tea-accent-sub transition-colors group"
            >
              {item.image ? (
                <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 bg-tea-elevated">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-md bg-tea-elevated shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <h3 className="font-display text-ui-15 text-tea-text truncate group-hover:text-tea-readgold transition-colors">
                  {item.name}
                </h3>
                <div className="flex flex-wrap items-center gap-1.5 text-ui-12 text-tea-text-dim mt-1">
                  {item.type && <span>{item.type}</span>}
                  {item.type && item.origin && <span>·</span>}
                  {item.origin && <span>{item.origin}</span>}
                  {(item.type || item.origin) && item.year && <span>·</span>}
                  {item.year && <span className="font-mono tabular-nums">{item.year}</span>}
                </div>
                {item.mood && (
                  <p className="text-ui-12 text-tea-text-sec mt-1 italic truncate">{item.mood}</p>
                )}
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <span className="mono-text text-ui-13 text-tea-text-sec">
                  {fmtPricePerGram(parseFloat(item.price_per_gram || '0'))}
                </span>
                <ChevronRight size={14} className="text-tea-text-dim" />
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Footer CTA */}
      <div className="text-center pt-10 pb-2">
        <a
          href="/shop"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors"
        >
          Browse Full Shop
          <ChevronRight size={14} />
        </a>
      </div>
    </div>
  );
};
