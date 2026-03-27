import React, { useState } from 'react';
import { PageHeader } from '../shared/PageHeader';
import { PageHeaderTabs } from '../shared/PageHeaderTabs';
import { CardGridItem } from '../shared/CardGridItem';
import { CardImage } from '../shared/CardImage';
import { ShopGridLayout } from '../shared/ShopGridLayout';
import { SectionDivider } from '../shared/SectionDivider';
import { PopupModal } from '../shared/PopupModal';
import { CurrencyToggle } from '../shared/CurrencyToggle';
import type { DisplayCurrency } from '../shared/CurrencyToggle';
import { TeaInventory } from '../TeaInventory';
import { TeawareCatalog } from '../TeawareCatalog';
import { Icons } from '../Icons';
import { STARTER_TEA_SETS, STARTER_TEAWARE_SETS } from '../../constants';
import { INCENSE_ITEMS } from '../../data/incense';
import { ORACLE_CARD_ITEMS } from '../../data/oracleCards';
import type { InventoryItem, StarterSet } from '../../types';

type PracticeTab = 'sets' | 'tea' | 'teaware' | 'table';

interface ForYourPracticeProps {
  teaInventory: InventoryItem[];
  teawareInventory: InventoryItem[];
  onAddToCart: (item: InventoryItem, qty: number, total: number) => void;
  onBack: () => void;
  onNavigateToCollection: () => void;
  cartItemCount?: number;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  initialTab?: PracticeTab;
}

const TABS = [
  { id: 'sets', label: 'Sets', icon: <Icons.Box className="w-4 h-4" /> },
  { id: 'tea', label: 'Tea', icon: <Icons.Leaf className="w-4 h-4" /> },
  { id: 'teaware', label: 'Teaware', icon: <Icons.Teapot className="w-4 h-4" /> },
  { id: 'table', label: 'At the Table', icon: <Icons.Coffee className="w-4 h-4" /> },
];

const TAB_INTROS: Record<PracticeTab, string> = {
  sets: 'Curated bundles to begin or deepen your tea practice.',
  tea: 'The full catalog of teas available for your practice.',
  teaware: 'Traditional vessels and tools for brewing and serving.',
  table: 'Everything that enhances the session beyond tea and teaware.',
};

// ── Main component ──
export const ForYourPractice: React.FC<ForYourPracticeProps> = ({
  teaInventory,
  teawareInventory,
  onAddToCart,
  onBack,
  onNavigateToCollection,
  cartItemCount = 0,
  onCartClick,
  onAccountClick,
  initialTab = 'tea',
}) => {
  const [activeTab, setActiveTab] = useState<PracticeTab>(initialTab);
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>('USD');
  const [displayUnit, setDisplayUnit] = useState<'g' | 'oz'>('g');

  // Shared detail modal state (for Sets + At the Table)
  const [viewItem, setViewItem] = useState<InventoryItem | null>(null);
  const allTableItems = [...INCENSE_ITEMS, ...ORACLE_CARD_ITEMS];

  // Starter set state
  const [isAddingToCart, setIsAddingToCart] = useState<Record<string, boolean>>({});
  const allInventory = [...teaInventory, ...teawareInventory];

  const handleAddStarterSet = async (set: StarterSet) => {
    setIsAddingToCart(prev => ({ ...prev, [set.id]: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    set.items.forEach(({ itemId }) => {
      const item = allInventory.find(inv => inv.id === itemId);
      if (item && item.stock_g > 0) {
        const defaultQty = item.category === 'tea' ? 50 : 1;
        const pricePerUnit = item.category === 'tea'
          ? parseFloat(item.price_per_gram || '0')
          : parseFloat(item.price_50g || '0'); // price_50g is per-unit price for teaware/misc (legacy field name)
        const total = pricePerUnit * defaultQty;
        onAddToCart(item, defaultQty, total);
      }
    });
    setIsAddingToCart(prev => ({ ...prev, [set.id]: false }));
  };

  // Render a starter set card using shared card anatomy
  const renderSetCard = (set: StarterSet) => {
    const price = set.price;
    return (
      <div
        key={set.id}
        className="group cursor-pointer relative break-inside-avoid md:hover:-translate-y-1 md:hover:shadow-lg md:transition-all md:duration-300"
        onClick={() => handleAddStarterSet(set)}
      >
        <div className="p-2 md:p-3 bg-tea-elevated border border-tea-border rounded-[1px] shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
          <CardImage src={set.image} alt={set.name} aspect="square" />
          <div className="px-1 mt-3">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-1 mb-1.5">
              <h4 className="card-grid-title">{set.name}</h4>
              <div className="card-grid-price"><span className="card-grid-price">{price}</span></div>
            </div>
            <div className="mb-2">
              <span className="card-grid-badge">{set.items.length} items</span>
            </div>
            <p className="card-grid-description">{set.shortDescription}</p>
            <div className="mt-3">
              <button
                onClick={(e) => { e.stopPropagation(); handleAddStarterSet(set); }}
                disabled={isAddingToCart[set.id]}
                className="bg-tea-gold hover:bg-tea-gold/90 text-white text-xs uppercase tracking-[0.15em] font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-3 w-full"
              >
                <span>{isAddingToCart[set.id] ? 'Adding...' : 'Add Set'}</span>
                <span className="w-[1px] h-3 bg-tea-text-sec/30" />
                <span className="font-mono tabular-nums text-sm">{price}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSets = () => (
    <div className="max-w-full mx-auto px-2 md:px-4 pt-4 animate-[fadeIn_0.5s_ease-out]">
      {STARTER_TEA_SETS.length === 0 && STARTER_TEAWARE_SETS.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 opacity-40">
          <div className="w-16 h-16 border border-tea-text/20  rounded-full flex items-center justify-center mb-4">
            <Icons.Box className="w-6 h-6 text-tea-text/50" />
          </div>
          <p className="font-serif italic text-base text-tea-text/60">No sets available.</p>
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

  const renderTable = () => (
    <div className="max-w-full mx-auto px-2 md:px-4 pt-4 animate-[fadeIn_0.5s_ease-out]">
      {allTableItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 opacity-40">
          <div className="w-16 h-16 border border-tea-text/20  rounded-full flex items-center justify-center mb-4">
            <Icons.Coffee className="w-6 h-6 text-tea-text/50" />
          </div>
          <p className="font-serif italic text-base text-tea-text/60">No items available.</p>
        </div>
      ) : (
        <>
          <SectionDivider label="Incense" subtitle="Aroma companions for ceremony and meditation." />
          <ShopGridLayout>
            {INCENSE_ITEMS.map(item => (
              <CardGridItem
                key={item.id}
                item={item}
                title={item.name}
                onCardClick={(item, e) => { e.stopPropagation(); setViewItem(item as InventoryItem); }}
                imageComponent={<CardImage src={item.image} alt={item.name} aspect="square" />}
                badgesComponent={
                  <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                    <span className="card-grid-badge">{item.variant}</span>
                  </div>
                }
                priceDisplay={<span className="card-grid-price">${parseFloat(item.price_50g || '0')} <span className="text-tea-text-sec text-[10px]">each</span></span>}
                descriptionComponent={<p className="card-grid-description">{item.description}</p>}
              />
            ))}
          </ShopGridLayout>

          <SectionDivider label="Cards" subtitle="Connection and self-inquiry for the tea table." />
          <ShopGridLayout>
            {ORACLE_CARD_ITEMS.map(item => (
              <CardGridItem
                key={item.id}
                item={item}
                title={item.name}
                onCardClick={(item, e) => { e.stopPropagation(); setViewItem(item as InventoryItem); }}
                imageComponent={<CardImage src={item.image} alt={item.name} aspect="square" />}
                badgesComponent={
                  <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                    <span className="card-grid-badge">{item.variant}</span>
                  </div>
                }
                priceDisplay={<span className="card-grid-price">${parseFloat(item.price_50g || '0')} <span className="text-tea-text-sec text-[10px]">each</span></span>}
                descriptionComponent={<p className="card-grid-description">{item.description}</p>}
              />
            ))}
          </ShopGridLayout>
        </>
      )}
    </div>
  );

  // Cross-pollination CTA
  const renderCollectionCTA = () => (
    <div className="px-2 md:px-4 py-12 border-t border-tea-border">
      <h3 className="font-serif text-xl text-tea-text mb-2">See the Artisan Pieces</h3>
      <p className="text-sm text-tea-text/60 mb-6 max-w-md">
        Explore handcrafted tea tables, rare antiques, and ceremonial art from The Collection.
      </p>
      <button
        onClick={onNavigateToCollection}
        className="font-serif text-base group inline-flex items-center gap-2 text-tea-gold min-h-[44px]"
      >
        <span className="group-hover:underline">Browse The Collection</span>
        <span className="inline-block group-hover:translate-x-[3px] transition-transform">&rarr;</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
      <PageHeader
        title="For Your Practice"
        onBack={onBack}
        backLabel="Shop"
        onCartClick={onCartClick}
        onAccountClick={onAccountClick}
        cartItemCount={cartItemCount}
        toolbar={
          <div className="flex items-center justify-between">
            <p className="text-xs text-tea-text/40 italic">
              {TAB_INTROS[activeTab]}
            </p>
            <CurrencyToggle
              currency={displayCurrency}
              onCurrencyChange={setDisplayCurrency}
              unit={displayUnit}
              onUnitChange={setDisplayUnit}
            />
          </div>
        }
      >
        <PageHeaderTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as PracticeTab)}
        />
      </PageHeader>

      {/* Content */}
      <div className="flex-1 overflow-y-auto max-w-[1400px] mx-auto w-full">
        {activeTab === 'sets' && (
          <>
            {renderSets()}
            {renderCollectionCTA()}
          </>
        )}

        {activeTab === 'tea' && (
          <TeaInventory
            inventory={teaInventory}
            onAddToCart={onAddToCart}
            hideHeader
          />
        )}

        {activeTab === 'teaware' && (
          <>
            <TeawareCatalog externalInventory={teawareInventory} onAddToCart={onAddToCart} hideHeader />
            {renderCollectionCTA()}
          </>
        )}

        {activeTab === 'table' && (
          <>
            {renderTable()}
            {renderCollectionCTA()}
          </>
        )}
      </div>

      {/* Shared PopupModal for At the Table items */}
      <PopupModal
        item={viewItem}
        items={allTableItems}
        onClose={() => setViewItem(null)}
        onItemChange={(item) => setViewItem(item as InventoryItem)}
        onAddToCart={(item, quantity, total) => {
          onAddToCart(item as InventoryItem, quantity, parseFloat(total));
          setViewItem(null);
        }}
        showQuantityControls={true}
        quantityStep={1}
        defaultQuantity={1}
        maxQuantity={parseInt(viewItem?.stock_g || '100')}
        itemType="teaware"
      />
    </div>
  );
};
