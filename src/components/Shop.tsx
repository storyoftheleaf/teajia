import React, { useState, lazy, Suspense } from 'react';
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
import { useAdminOverlay } from '../hooks/useAdminOverlay';
import { useRates } from '../admin/hooks/useAdminData';
import type { StarterSet } from '../types';
import type { Product } from '../admin/types';

const AddProductModal = lazy(() => import('../admin/components/AddProductModal').then(m => ({ default: m.AddProductModal })));

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

  // Admin overlay state
  const { isAdmin, productMap, refetchProducts } = useAdminOverlay();
  const { data: rates = [] } = useRates();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleAdminEdit = (itemId: string) => {
    const product = productMap.get(itemId);
    if (product) setEditingProduct(product);
  };

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
      <div className="p-2 md:p-3 bg-tea-surface border border-tea-border rounded-[14px]">
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
              className="bg-tea-gold hover:bg-tea-gold/90 text-white text-xs uppercase tracking-widest font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-3 w-full"
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

  return (
    <div className="flex flex-col flex-1 bg-tea-bg animate-[fadeIn_0.5s_ease-out]">
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
            isAdmin={isAdmin}
            adminProductMap={productMap}
            onAdminEdit={handleAdminEdit}
          />
        )}

        {activeTab === 'teaware' && (
          <TeawareCatalog
            externalInventory={teawareInventory}
            onAddToCart={onAddToCart}
            hideHeader
            isAdmin={isAdmin}
            adminProductMap={productMap}
            onAdminEdit={handleAdminEdit}
          />
        )}

        {activeTab === 'sets' && renderSets()}
      </div>

      {/* Admin: Floating Action Button for quick product creation */}
      {isAdmin && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="fixed bottom-28 right-6 lg:bottom-8 z-[50] w-12 h-12 rounded-full bg-tea-seal text-white shadow-lg hover:bg-tea-seal/90 transition-all active:scale-95 flex items-center justify-center hover:shadow-xl"
          title="Add new product"
        >
          <Icons.Plus className="w-5 h-5" />
        </button>
      )}

      {/* Admin: Edit/Create Product Modal */}
      {(editingProduct || showCreateModal) && (
        <Suspense fallback={null}>
          <AddProductModal
            isOpen={true}
            onClose={() => { setEditingProduct(null); setShowCreateModal(false); }}
            onSuccess={() => { setEditingProduct(null); setShowCreateModal(false); refetchProducts(); }}
            initialData={editingProduct}
            rates={rates}
          />
        </Suspense>
      )}
    </div>
  );
};
