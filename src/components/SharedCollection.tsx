import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SealIcon } from './Icons';
import { useInventory } from '../context/InventoryContext';
import { AlcoveModal } from './shop/AlcoveModal';
import type { InventoryItem } from '../types';
import { useShopPrice } from './shop/shopPrice';

export const SharedCollection: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { inventory } = useInventory();
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  // A shared collection is a shop page someone else built. It quoted dollars
  // while the shop it links into quoted the reader's own currency.
  const shopPrice = useShopPrice();

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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors mt-6"
          >
            Browse shop
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
        <h1 className="h1 mt-2">Shared collection</h1>
        <p className="subtitle mt-2">
          {collectionItems.length} {collectionItems.length === 1 ? 'selection' : 'selections'} chosen for you
        </p>
      </div>

      {/* Tea card grid, §20 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {collectionItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setViewItem(item)}
            className="group text-left bg-tea-surface border border-tea-border rounded-md overflow-hidden transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50"
          >
            <div className="relative aspect-square overflow-hidden bg-tea-elevated">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500"
                  loading="lazy"
                />
              ) : (
                <div className="absolute inset-0 bg-tea-elevated" />
              )}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-tea-gold/70" />
            </div>
            <div className="px-3 py-3">
              <h4 className="font-display text-ui-15 text-tea-text group-hover:text-tea-readgold transition-colors line-clamp-2">
                {item.name}
              </h4>
              <p className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim mt-1 truncate">
                {[item.origin, item.type].filter(Boolean).join(' · ') || '—'}
                {item.year ? ` · ${item.year}` : ''}
              </p>
              <p className="font-mono text-ui-13 text-tea-text-sec mt-1.5 tabular-nums">
                {shopPrice.perGram(parseFloat(item.price_per_gram || '0'))}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="text-center pt-10 pb-2">
        <a
          href="/shop"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md cta-solid text-xs font-semibold transition-colors"
        >
          Browse full shop
        </a>
      </div>
    </div>
  );
};
