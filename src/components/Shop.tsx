import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { CollectionTab } from './shop/CollectionTab';
import { TeaInventory } from './TeaInventory';
import { TeawareCatalog } from './TeawareCatalog';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { Icons } from './Icons';
import { STARTER_TEA_SETS, STARTER_TEAWARE_SETS } from '../constants';
import { CardImage } from './shared/CardImage';
import { ShopGridLayout } from './shared/ShopGridLayout';
import { SectionDivider } from './shared/SectionDivider';
import type { StarterSet } from '../types';

type ShopTab = 'collection' | 'tea' | 'teaware' | 'sets';

interface ShopProps {
  teaInventory: InventoryItem[];
  teawareInventory: InventoryItem[];
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
  cartItemCount?: number;
  onCartClick?: () => void;
  onAccountClick?: () => void;
}

const TABS = [
  { id: 'collection', label: 'Collection', icon: <Icons.Seal className="w-4 h-4" /> },
  { id: 'tea', label: 'Tea', icon: <Icons.Leaf className="w-4 h-4" /> },
  { id: 'teaware', label: 'Teaware', icon: <Icons.Teapot className="w-4 h-4" /> },
  { id: 'sets', label: 'Sets', icon: <Icons.Box className="w-4 h-4" /> },
];

export const Shop: React.FC<ShopProps> = ({
  teaInventory,
  teawareInventory,
  onAddToCart,
  cartItemCount = 0,
  onCartClick,
  onAccountClick,
}) => {
  const [activeTab, setActiveTab] = useState<ShopTab>('tea');
  const [isAddingToCart, setIsAddingToCart] = useState<Record<string, boolean>>({});

  const allInventory = [...teaInventory, ...teawareInventory];

  const handleAddStarterSet = async (set: StarterSet) => {
    setIsAddingToCart(prev => ({ ...prev, [set.id]: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    set.items.forEach(({ itemId }) => {
      const item = allInventory.find(inv => inv.id === itemId);
      if (item) {
        const defaultQty = item.category === 'tea' ? 50 : 1;
        const pricePerUnit = item.category === 'tea'
          ? parseFloat(item.price_per_gram || '0')
          : parseFloat(item.price_50g || '0');
        const total = pricePerUnit * defaultQty;
        onAddToCart(item, defaultQty, total);
      }
    });
    setIsAddingToCart(prev => ({ ...prev, [set.id]: false }));
  };

  const renderSetCard = (set: StarterSet) => (
    <div
      key={set.id}
      className="group cursor-pointer relative break-inside-avoid md:hover:-translate-y-1 md:hover:shadow-lg md:transition-all md:duration-300"
      onClick={() => handleAddStarterSet(set)}
    >
      <div className="p-2 md:p-3 bg-tea-ink dark:bg-tea-ink border border-white/10 rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        <CardImage src={set.image} alt={set.name} aspect="square" />
        <div className="px-1 mt-3">
          <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-1 mb-1.5">
            <h4 className="card-grid-title">{set.name}</h4>
            <div className="card-grid-price"><span className="card-grid-price">{set.price}</span></div>
          </div>
          <div className="mb-2">
            <span className="card-grid-badge">{set.items.length} items</span>
          </div>
          <p className="card-grid-description">{set.shortDescription}</p>
          <div className="mt-3">
            <button
              onClick={(e) => { e.stopPropagation(); handleAddStarterSet(set); }}
              disabled={isAddingToCart[set.id]}
              className="bg-tea-seal hover:bg-tea-seal/90 text-white text-xs uppercase tracking-widest font-medium py-2 px-4 rounded-[1px] transition-all active:scale-95 flex items-center justify-center gap-3 w-full"
            >
              <span>{isAddingToCart[set.id] ? 'Adding...' : 'Add Set'}</span>
              <span className="w-[1px] h-3 bg-white/30" />
              <span className="font-mono text-sm">{set.price}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSets = () => (
    <div className="max-w-full mx-auto px-3 md:px-4 lg:px-6 pt-4 animate-[fadeIn_0.5s_ease-out]">
      {STARTER_TEA_SETS.length === 0 && STARTER_TEAWARE_SETS.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 opacity-40">
          <div className="w-16 h-16 border border-tea-ink/20 dark:border-tea-paper/20 rounded-full flex items-center justify-center mb-4">
            <Icons.Box className="w-6 h-6 text-tea-ink/50 dark:text-tea-paper/50" />
          </div>
          <p className="font-serif italic text-base text-tea-ink/60 dark:text-tea-paper/60">No sets available.</p>
        </div>
      ) : (
        <>
          <SectionDivider label="Tea Sets" subtitle="Curated tea collections with essential brewing vessels." />
          <ShopGridLayout>
            {STARTER_TEA_SETS.map(set => renderSetCard(set))}
          </ShopGridLayout>

          <SectionDivider label="Teaware Sets" subtitle="Complete teaware collections for any brewing style." />
          <ShopGridLayout>
            {STARTER_TEAWARE_SETS.map(set => renderSetCard(set))}
          </ShopGridLayout>
        </>
      )}
    </div>
  );

  return (
    <div className="flex flex-col flex-1 bg-white dark:bg-tea-ink animate-[fadeIn_0.5s_ease-out]">
      <PageHeader
        title="Shop"
        onCartClick={onCartClick}
        onAccountClick={onAccountClick}
        cartItemCount={cartItemCount}
      >
        <PageHeaderTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as ShopTab)}
        />
      </PageHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-w-[1400px] mx-auto w-full">
        {activeTab === 'collection' && (
          <CollectionTab
            inventory={[...teaInventory, ...teawareInventory]}
            onAddToCart={onAddToCart}
          />
        )}

        {activeTab === 'tea' && (
          <TeaInventory
            inventory={teaInventory}
            onAddToCart={onAddToCart}
            hideHeader
          />
        )}

        {activeTab === 'teaware' && (
          <TeawareCatalog
            externalInventory={teawareInventory}
            onAddToCart={onAddToCart}
            hideHeader
          />
        )}

        {activeTab === 'sets' && renderSets()}
      </div>
    </div>
  );
};
