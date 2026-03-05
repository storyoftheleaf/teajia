import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { TheCollection } from './shop/TheCollection';
import { ForYourPractice } from './shop/ForYourPractice';
import { PageHeader } from './shared/PageHeader';
import { Icons } from './Icons';
import type { ShopView, CollectionCategory } from '../types/shop';

type PracticeTab = 'sets' | 'tea' | 'teaware' | 'table';

interface ShopProps {
  teaInventory: InventoryItem[];
  teawareInventory: InventoryItem[];
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
  cartItemCount?: number;
  onCartClick?: () => void;
  onAccountClick?: () => void;
}

const COLLECTION_SHORTCUTS: { label: string; category: CollectionCategory }[] = [
  { label: 'Tables', category: 'tea-tables' },
  { label: 'Art', category: 'art' },
  { label: 'Antiques', category: 'antiques' },
  { label: 'Rare Tea', category: 'rare-tea' },
];

const PRACTICE_SHORTCUTS: { label: string; tab: PracticeTab }[] = [
  { label: 'Sets', tab: 'sets' },
  { label: 'Tea', tab: 'tea' },
  { label: 'Teaware', tab: 'teaware' },
  { label: 'At the Table', tab: 'table' },
];

export const Shop: React.FC<ShopProps> = ({
  teaInventory,
  teawareInventory,
  onAddToCart,
  cartItemCount = 0,
  onCartClick,
  onAccountClick,
}) => {
  const [view, setView] = useState<ShopView>('landing');
  const [hoveredPath, setHoveredPath] = useState<'collection' | 'practice' | null>(null);
  const [collectionScrollTarget, setCollectionScrollTarget] = useState<CollectionCategory | undefined>();
  const [practiceInitialTab, setPracticeInitialTab] = useState<PracticeTab>('tea');

  const enterCollection = (scrollTo?: CollectionCategory) => {
    setCollectionScrollTarget(scrollTo);
    setView('collection');
  };

  const enterPractice = (tab?: PracticeTab) => {
    setPracticeInitialTab(tab || 'tea');
    setView('practice');
  };

  // ── Collection view ──
  if (view === 'collection') {
    return (
      <TheCollection
        onBack={() => setView('landing')}
        onNavigateToPractice={() => enterPractice()}
        scrollToCategory={collectionScrollTarget}
      />
    );
  }

  // ── Practice view ──
  if (view === 'practice') {
    return (
      <ForYourPractice
        teaInventory={teaInventory}
        teawareInventory={teawareInventory}
        onAddToCart={onAddToCart}
        onBack={() => setView('landing')}
        onNavigateToCollection={() => enterCollection()}
        cartItemCount={cartItemCount}
        onCartClick={onCartClick}
        onAccountClick={onAccountClick}
        initialTab={practiceInitialTab}
      />
    );
  }

  // ── Landing view with ambient mood ──
  return (
    <div className="flex flex-col flex-1 animate-[fadeIn_0.6s_ease-out]">
      <PageHeader
        title="Shop"
        onCartClick={onCartClick}
        onAccountClick={onAccountClick}
        cartItemCount={cartItemCount}
      />

      {/* Split-screen landing */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 min-h-[calc(100vh-200px)]">

        {/* ── The Collection — dark gallery side ── */}
        <div
          className={`
            group relative flex flex-col items-center justify-center text-center
            p-10 md:p-12 lg:p-16 transition-all duration-700 ease-out cursor-pointer
            ${hoveredPath === 'collection'
              ? 'bg-[#141414]'
              : hoveredPath === 'practice'
                ? 'bg-tea-charcoal/60'
                : 'bg-tea-charcoal'
            }
          `}
          onMouseEnter={() => setHoveredPath('collection')}
          onMouseLeave={() => setHoveredPath(null)}
          onClick={() => enterCollection()}
        >
          {/* Subtle accent glow */}
          <div className={`
            absolute inset-0 bg-gradient-to-br from-tea-seal/5 to-transparent
            transition-opacity duration-700 pointer-events-none
            ${hoveredPath === 'collection' ? 'opacity-100' : 'opacity-0'}
          `} />

          <div className="relative z-10 max-w-sm">
            <Icons.Seal className={`
              w-14 h-14 md:w-16 md:h-16 mx-auto mb-6 text-tea-seal/70
              transition-all duration-500
              ${hoveredPath === 'collection' ? 'scale-110 text-tea-seal' : ''}
            `} />

            {/* Badge */}
            <span className="inline-block text-[10px] uppercase tracking-[0.2em] text-tea-paper/40 mb-3">
              By inquiry only
            </span>

            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light text-tea-paper mb-3">
              The Collection
            </h2>
            <p className="text-sm md:text-base text-tea-paper/50 mb-8 leading-relaxed">
              Tea tables, art, antiques, and rare aged teas — each piece has a story. Browse and reach out when something speaks to you.
            </p>

            {/* Main CTA */}
            <span className="font-serif text-sm text-tea-seal inline-flex items-center gap-2 group-hover:gap-3 transition-all duration-300 mb-6">
              Enter the Gallery
              <span className="inline-block group-hover:translate-x-1 transition-transform duration-300">&rarr;</span>
            </span>

            {/* Category shortcuts */}
            <div className="flex items-center justify-center gap-3 flex-wrap" onClick={e => e.stopPropagation()}>
              {COLLECTION_SHORTCUTS.map(({ label, category }) => (
                <button
                  key={category}
                  onClick={() => enterCollection(category)}
                  className="text-[11px] text-tea-paper/30 hover:text-tea-seal transition-colors duration-200 uppercase tracking-wider"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── For Your Practice — warm paper side ── */}
        <div
          className={`
            group relative flex flex-col items-center justify-center text-center
            p-10 md:p-12 lg:p-16 transition-all duration-700 ease-out cursor-pointer
            ${hoveredPath === 'practice'
              ? 'bg-[#EDE9DD]'
              : hoveredPath === 'collection'
                ? 'bg-tea-paper/60'
                : 'bg-tea-paper'
            }
          `}
          onMouseEnter={() => setHoveredPath('practice')}
          onMouseLeave={() => setHoveredPath(null)}
          onClick={() => enterPractice()}
        >
          {/* Subtle accent glow */}
          <div className={`
            absolute inset-0 bg-gradient-to-br from-tea-green/5 to-transparent
            transition-opacity duration-700 pointer-events-none
            ${hoveredPath === 'practice' ? 'opacity-100' : 'opacity-0'}
          `} />

          <div className="relative z-10 max-w-sm">
            <Icons.Leaf className={`
              w-14 h-14 md:w-16 md:h-16 mx-auto mb-6 text-tea-green/60
              transition-all duration-500
              ${hoveredPath === 'practice' ? 'scale-110 text-tea-green' : ''}
            `} />

            {/* Badge */}
            <span className="inline-block text-[10px] uppercase tracking-[0.2em] text-tea-ink/40 mb-3">
              Ready to ship
            </span>

            <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light text-tea-ink mb-3">
              For Your Practice
            </h2>
            <p className="text-sm md:text-base text-tea-ink/50 mb-8 leading-relaxed">
              Tea, teaware, and everything for ceremony. Browse, choose quantities, and order.
            </p>

            {/* Main CTA */}
            <span className="font-serif text-sm text-tea-seal inline-flex items-center gap-2 group-hover:gap-3 transition-all duration-300 mb-6">
              Browse the Shop
              <span className="inline-block group-hover:translate-x-1 transition-transform duration-300">&rarr;</span>
            </span>

            {/* Category shortcuts */}
            <div className="flex items-center justify-center gap-3 flex-wrap" onClick={e => e.stopPropagation()}>
              {PRACTICE_SHORTCUTS.map(({ label, tab }) => (
                <button
                  key={tab}
                  onClick={() => enterPractice(tab)}
                  className="text-[11px] text-tea-ink/30 hover:text-tea-seal transition-colors duration-200 uppercase tracking-wider"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
