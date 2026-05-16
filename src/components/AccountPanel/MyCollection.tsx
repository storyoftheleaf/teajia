
import React, { useState, useMemo } from 'react';
import { Icons, SealIcon } from '../Icons';
import { AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../lib/store';
import { useInventory } from '../../context/InventoryContext';
import type { InventoryItem } from '../../types';
import { fmtPricePerGram } from '../../utils/formatNumber';
import { TastingSession, type TastingItem } from '../tasting/TastingSession';

interface MyCollectionProps {
  onBack: () => void;
  onViewItem?: (item: InventoryItem) => void;
}

export const MyCollection: React.FC<MyCollectionProps> = ({ onBack, onViewItem }) => {
  const { favoriteTeas, toggleFavoriteTea } = useAppStore();
  const { inventory } = useInventory();
  const [copied, setCopied] = useState(false);
  const [shareView, setShareView] = useState(false);
  const [tastingItem, setTastingItem] = useState<InventoryItem | null>(null);

  const favoriteItems = useMemo(() => {
    return favoriteTeas
      .map(id => inventory.find(item => item.id === id))
      .filter((item): item is InventoryItem => !!item);
  }, [favoriteTeas, inventory]);

  const handleShare = async () => {
    const ids = favoriteTeas.join(',');
    const encoded = btoa(ids);
    const url = `${window.location.origin}/collection?c=${encoded}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My Tea Collection — Teajia',
          text: `Check out my favorite teas on Teajia! ${favoriteItems.length} selections.`,
          url,
        });
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    const ids = favoriteTeas.join(',');
    const encoded = btoa(ids);
    const url = `${window.location.origin}/collection?c=${encoded}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (favoriteItems.length === 0) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-6"
        >
          <Icons.Back className="w-4 h-4" />
          <span className="text-ui-12 uppercase tracking-[0.18em]">Back</span>
        </button>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-tea-gold/10 flex items-center justify-center mb-4">
            <Icons.Heart className="w-7 h-7 text-tea-gold/70" />
          </div>
          <h3 className="font-serif text-lg text-tea-text  mb-2">No Favorites Yet</h3>
          <p className="text-sm text-tea-text-sec text-center max-w-[260px] leading-relaxed">
            Tap the heart icon on any tea in the shop to start building your collection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors mb-4"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-ui-12 uppercase tracking-[0.18em]">Back</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-serif text-lg text-tea-text">My Collection</h3>
          <span className="text-ui-12 uppercase tracking-[0.15em] text-tea-text-sec">
            {favoriteItems.length} {favoriteItems.length === 1 ? 'tea' : 'teas'}
          </span>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-3 py-2 bg-tea-gold/10 border border-tea-border hover:bg-tea-gold/20 transition-colors min-h-[36px]"
        >
          {copied ? (
            <>
              <Icons.Check className="w-3.5 h-3.5 text-green-600" />
              <span className="text-ui-11 uppercase tracking-[0.15em] text-green-600 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Icons.Share className="w-3.5 h-3.5 text-tea-gold" />
              <span className="text-ui-11 uppercase tracking-[0.15em] text-tea-gold font-medium">Share</span>
            </>
          )}
        </button>
      </div>

      {/* Copy link bar */}
      <button
        onClick={handleCopyLink}
        className="w-full flex items-center gap-3 px-3 py-3 mb-4 bg-tea-elevated border border-tea-border hover:bg-tea-elevated/80 transition-colors group"
      >
        <Icons.Link className="w-3.5 h-3.5 text-tea-text-sec group-hover:text-tea-gold transition-colors" />
        <span className="text-ui-12 text-tea-text-sec truncate flex-1 text-left">
          {copied ? 'Link copied to clipboard!' : 'Copy shareable link'}
        </span>
        <Icons.Copy className="w-3.5 h-3.5 text-tea-text-sec" />
      </button>

      {/* Tasting Session Modal */}
      <AnimatePresence>
        {tastingItem && (
          <TastingSession
            item={tastingItem}
            onClose={() => setTastingItem(null)}
            onOrderTea={(item: TastingItem) => { setTastingItem(null); onViewItem?.(item as InventoryItem); }}
          />
        )}
      </AnimatePresence>

      {/* Tea list */}
      <div className="border border-tea-border  overflow-hidden">
        {favoriteItems.map((item, i) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-3 py-3 hover:bg-tea-elevated/30 transition-colors ${
              i < favoriteItems.length - 1 ? 'border-b border-tea-border ' : ''
            }`}
          >
            {/* Thumbnail */}
            {item.image && (
              <div
                className="w-10 h-10 rounded-md bg-tea-bg/5 overflow-hidden shrink-0 cursor-pointer"
                onClick={() => onViewItem?.(item)}
              >
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewItem?.(item)}>
              <h4 className="font-serif text-ui-15 text-tea-text truncate">{item.name}</h4>
              <div className="flex items-center gap-1.5 text-ui-12 text-tea-text-sec mt-0.5">
                <span>{item.type}</span>
                {item.origin && (
                  <>
                    <span className="text-tea-text-sec">·</span>
                    <span className="truncate">{item.origin}</span>
                  </>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="num text-ui-12 text-tea-text-sec">
                {fmtPricePerGram(parseFloat(item.price_per_gram || '0'))}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setTastingItem(item); }}
                className="p-2 text-tea-text-sec hover:text-tea-gold transition-colors"
                title="Add to your note"
              >
                <Icons.Sparkles className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => toggleFavoriteTea(item.id)}
                className="p-2 text-tea-gold hover:text-red-500 transition-colors"
                title="Remove from collection"
              >
                <Icons.Heart filled className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
