
import React, { useState, useMemo } from 'react';
import { Icons, SealIcon } from '../Icons';
import { useAppStore } from '../../lib/store';
import { useInventory } from '../../context/InventoryContext';
import type { InventoryItem } from '../../types';
import { fmtPricePerGram } from '../../utils/formatNumber';

interface MyCollectionProps {
  onBack: () => void;
  onViewItem?: (item: InventoryItem) => void;
}

export const MyCollection: React.FC<MyCollectionProps> = ({ onBack, onViewItem }) => {
  const { favoriteTeas, toggleFavoriteTea } = useAppStore();
  const { inventory } = useInventory();
  const [copied, setCopied] = useState(false);
  const [shareView, setShareView] = useState(false);

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
          className="flex items-center gap-2 text-tea-charcoal/50 dark:text-white/50 hover:text-tea-charcoal dark:hover:text-white transition-colors mb-6"
        >
          <Icons.Back className="w-4 h-4" />
          <span className="text-xs uppercase tracking-widest">Back</span>
        </button>

        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-tea-seal/10 dark:bg-tea-seal/20 flex items-center justify-center mb-4">
            <Icons.Heart className="w-7 h-7 text-tea-seal/40" />
          </div>
          <h3 className="font-serif text-lg text-tea-charcoal dark:text-white mb-2">No Favorites Yet</h3>
          <p className="text-sm text-tea-charcoal/50 dark:text-white/50 text-center max-w-[260px] leading-relaxed">
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
        className="flex items-center gap-2 text-tea-charcoal/50 dark:text-white/50 hover:text-tea-charcoal dark:hover:text-white transition-colors mb-4"
      >
        <Icons.Back className="w-4 h-4" />
        <span className="text-xs uppercase tracking-widest">Back</span>
      </button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-serif text-lg text-tea-charcoal dark:text-white">My Collection</h3>
          <span className="text-[10px] uppercase tracking-widest text-tea-charcoal/50 dark:text-white/50">
            {favoriteItems.length} {favoriteItems.length === 1 ? 'tea' : 'teas'}
          </span>
        </div>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-3 py-2 bg-tea-seal/10 dark:bg-tea-seal/20 border border-tea-seal/20 hover:bg-tea-seal/15 dark:hover:bg-tea-seal/30 transition-colors"
        >
          {copied ? (
            <>
              <Icons.Check className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
              <span className="text-[10px] uppercase tracking-widest text-green-600 dark:text-green-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <Icons.Share className="w-3.5 h-3.5 text-tea-seal" />
              <span className="text-[10px] uppercase tracking-widest text-tea-seal font-medium">Share</span>
            </>
          )}
        </button>
      </div>

      {/* Copy link bar */}
      <button
        onClick={handleCopyLink}
        className="w-full flex items-center gap-3 px-3 py-2.5 mb-4 bg-white/30 dark:bg-white/5 border border-tea-charcoal/5 dark:border-white/10 hover:bg-white/50 dark:hover:bg-white/10 transition-colors group"
      >
        <Icons.Link className="w-3.5 h-3.5 text-tea-charcoal/40 dark:text-white/40 group-hover:text-tea-seal transition-colors" />
        <span className="text-[11px] text-tea-charcoal/60 dark:text-white/50 truncate flex-1 text-left">
          {copied ? 'Link copied to clipboard!' : 'Copy shareable link'}
        </span>
        <Icons.Copy className="w-3.5 h-3.5 text-tea-charcoal/30 dark:text-white/30" />
      </button>

      {/* Tea list */}
      <div className="border border-tea-charcoal/5 dark:border-white/10 overflow-hidden">
        {favoriteItems.map((item, i) => (
          <div
            key={item.id}
            className={`flex items-center gap-3 px-3 py-3 hover:bg-white/30 dark:hover:bg-white/5 transition-colors ${
              i < favoriteItems.length - 1 ? 'border-b border-tea-charcoal/5 dark:border-white/5' : ''
            }`}
          >
            {/* Thumbnail */}
            {item.image && (
              <div
                className="w-10 h-10 rounded-sm bg-tea-charcoal/5 dark:bg-white/10 overflow-hidden shrink-0 cursor-pointer"
                onClick={() => onViewItem?.(item)}
              >
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onViewItem?.(item)}>
              <h4 className="font-serif text-sm text-tea-charcoal dark:text-white truncate">{item.name}</h4>
              <div className="flex items-center gap-1.5 text-[10px] text-tea-charcoal/50 dark:text-white/40">
                <span>{item.type}</span>
                {item.origin && (
                  <>
                    <span className="opacity-50">·</span>
                    <span className="truncate">{item.origin}</span>
                  </>
                )}
              </div>
            </div>

            {/* Price + Remove */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="num text-xs text-tea-charcoal/60 dark:text-white/50">
                {fmtPricePerGram(parseFloat(item.price_per_gram || '0'))}
              </span>
              <button
                onClick={() => toggleFavoriteTea(item.id)}
                className="p-1 text-tea-seal hover:text-red-500 transition-colors"
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
