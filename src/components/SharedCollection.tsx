
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icons, SealIcon } from './Icons';
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

  if (collectionIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-[fadeIn_0.5s_ease-out]">
        <SealIcon className="w-12 h-12 text-tea-gold/30 mb-4" />
        <h1 className="text-2xl text-tea-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>Collection Not Found</h1>
        <p className="text-sm text-tea-text/50 max-w-md">
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
        <SealIcon className="w-8 h-8 text-tea-gold mx-auto mb-3 opacity-60" />
        <h1 className="text-3xl text-tea-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>Shared Collection</h1>
        <p className="text-sm text-tea-text/50 italic" style={{ fontFamily: 'var(--font-body)' }}>
          {collectionItems.length} {collectionItems.length === 1 ? 'selection' : 'selections'} from Teajia
        </p>
      </div>

      {/* Tea Grid */}
      <div className="space-y-0" style={{ boxShadow: 'inset 0 1px 0 var(--tea-accent-sub)' }}>
        {collectionItems.map((item) => (
          <div
            key={item.id}
            onClick={() => setViewItem(item)}
            className="flex items-center gap-4 px-4 py-4 hover:bg-tea-elevated/50 cursor-pointer transition-colors group"
            style={{ boxShadow: '0 1px 0 var(--tea-accent-sub)' }}
          >
            {/* Image */}
            {item.image && (
              <div className="w-14 h-14 rounded-md overflow-hidden shrink-0 bg-tea-text/5">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base text-tea-text group-hover:text-tea-gold transition-colors truncate" style={{ fontFamily: 'var(--font-display)' }}>
                {item.name}
              </h3>
              <div className="flex items-center gap-2 text-ui-11 text-tea-text/50 mt-0.5">
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
                    <span className="font-mono tabular-nums">{item.year}</span>
                  </>
                )}
              </div>
              {item.mood && (
                <p className="text-ui-11 italic text-tea-text/40 mt-1 truncate" style={{ fontFamily: 'var(--font-body)' }}>{item.mood}</p>
              )}
            </div>

            {/* Price */}
            <div className="shrink-0 text-right">
              <span className="num text-sm text-tea-text/70">
                {fmtPricePerGram(parseFloat(item.price_per_gram || '0'))}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="text-center pt-8">
        <a
          href="/shop"
          className="inline-flex items-center gap-2 px-6 py-3 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.15em] hover:bg-tea-gold/90 transition-colors"
        >
          Browse Full Shop
          <Icons.ChevronRight className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
