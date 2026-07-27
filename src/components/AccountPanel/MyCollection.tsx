
import React, { useState, useMemo } from 'react';
import { Icons } from '../Icons';
import { AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { useInventory } from '../../context/InventoryContext';
import type { InventoryItem } from '../../types';
import { useShopPrice } from '../shop/shopPrice';
import { TastingSession, type TastingItem } from '../tasting/TastingSession';
import { ListShell } from './primitives';

interface MyCollectionProps {
  onBack: () => void;
  onViewItem?: (item: InventoryItem) => void;
}

export const MyCollection: React.FC<MyCollectionProps> = ({ onBack, onViewItem }) => {
  const { favoriteTeas, toggleFavoriteTea } = useAppStore();
  const { inventory } = useInventory();
  const [copied, setCopied] = useState(false);
  const [tastingItem, setTastingItem] = useState<InventoryItem | null>(null);
  // The saved list is the shop, remembered. Same prices, same currency.
  const shopPrice = useShopPrice();

  const favoriteItems = useMemo(() => {
    return favoriteTeas
      .map(id => inventory.find(item => item.id === id))
      .filter((item): item is InventoryItem => !!item);
  }, [favoriteTeas, inventory]);

  const buildShareUrl = () => {
    const ids = favoriteTeas.join(',');
    const encoded = btoa(ids);
    return `${window.location.origin}/collection?c=${encoded}`;
  };

  const handleShare = async () => {
    const url = buildShareUrl();
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
    await navigator.clipboard.writeText(buildShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Back button — top-left, matches Cancel/Back/Close rules
  const BackButton = (
    <button
      onClick={onBack}
      className="inline-flex items-center gap-1.5 text-tea-text-sec hover:text-tea-text transition-colors mb-6"
      aria-label="Back"
    >
      <Icons.Back className="w-4 h-4" />
      <span className="text-ui-13">Back</span>
    </button>
  );

  // Empty state — §19 pattern: 28px Lucide icon, font-display headline,
  // text-ui-12 body. No decorative illustrations.
  if (favoriteItems.length === 0) {
    return (
      <div className="animate-[fadeIn_0.3s_ease-out]">
        {BackButton}
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <Heart size={28} strokeWidth={1.25} className="text-tea-text-dim" />
          <h3 className="font-display text-ui-17 text-tea-text mt-4">No favorites yet</h3>
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
            Tap the heart icon on any tea in the shop to start building your collection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-[fadeIn_0.3s_ease-out]">
      {BackButton}

      {/* Header — narrow form chrome, title left, share right */}
      <div className="flex items-end justify-between mb-5 gap-3">
        <div className="min-w-0">
          <h3 className="h3">My Collection</h3>
          <p className="text-ui-12 text-tea-text-dim mt-0.5">
            {favoriteItems.length} {favoriteItems.length === 1 ? 'tea' : 'teas'} kept
          </p>
        </div>
        <button
          onClick={handleShare}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-xs font-semibold shrink-0"
        >
          {copied ? (
            <>
              <Icons.Check className="w-3.5 h-3.5 text-tea-green" />
              <span className="text-tea-green">Copied</span>
            </>
          ) : (
            <>
              <Icons.Share className="w-3.5 h-3.5" />
              <span>Share</span>
            </>
          )}
        </button>
      </div>

      {/* Copy link bar — quiet utility row */}
      <button
        onClick={handleCopyLink}
        className="w-full flex items-center gap-3 px-3 py-3 mb-4 bg-tea-surface border border-tea-border rounded-md hover:bg-tea-accent-sub transition-colors group"
      >
        <Icons.Link className="w-3.5 h-3.5 text-tea-text-sec group-hover:text-tea-text transition-colors" />
        <span className="text-ui-12 text-tea-text-sec truncate flex-1 text-left">
          {copied ? 'Link copied to clipboard' : 'Copy shareable link'}
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

      {/* Tea list — canonical §19 ListShell/ListRow.
          We use `as="div"` because each row has inline action buttons
          (tasting + favorite); nesting buttons inside a button is invalid HTML. */}
      <ListShell>
        {favoriteItems.map((item) => {
          const meta = [item.type, item.origin].filter(Boolean).join(' · ');
          const price = shopPrice.perGram(parseFloat(item.price_per_gram || '0'));

          const leading = item.image ? (
            <button
              onClick={() => onViewItem?.(item)}
              className="w-10 h-10 rounded-md bg-tea-bg/5 overflow-hidden block"
              title={item.name}
            >
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ) : null;

          const trailing = (
            <div className="flex items-center gap-2">
              <span className="text-ui-12 font-mono tabular-nums text-tea-text-sec">{price}</span>
              <button
                onClick={() => setTastingItem(item)}
                className="p-2 text-tea-text-sec hover:text-tea-text transition-colors tap-target"
                title="Add to your note"
              >
                <Icons.Sparkles className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => toggleFavoriteTea(item.id)}
                className="p-2 text-tea-gold hover:text-tea-error transition-colors tap-target"
                title="Remove from collection"
              >
                <Icons.Heart filled className="w-3.5 h-3.5" />
              </button>
            </div>
          );

          return (
            <li key={item.id}>
              <div className="w-full px-4 md:px-6 py-4 flex items-center gap-3 transition-colors hover:bg-tea-accent-sub">
                {leading && <div className="shrink-0">{leading}</div>}
                <button
                  onClick={() => onViewItem?.(item)}
                  className="flex-1 min-w-0 text-left"
                  style={{ WebkitTapHighlightColor: 'transparent' }}
                >
                  <div className="font-display text-ui-15 text-tea-text truncate">{item.name}</div>
                  {meta && <div className="text-ui-12 text-tea-text-dim mt-1 truncate">{meta}</div>}
                </button>
                <div className="shrink-0 ml-2">{trailing}</div>
              </div>
            </li>
          );
        })}
      </ListShell>
    </div>
  );
};
