import React, { useState, lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
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
import { SectionSkeleton } from './shared/SectionSkeleton';
import { useAdminOverlay } from '../hooks/useAdminOverlay';
import { useRates } from '../admin/hooks/useAdminData';
import { ToastProvider } from '../admin/components/Toast';
import { useAppStore } from '../lib/store';
import { fmtPrice } from '../utils/formatNumber';
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
  isLoading?: boolean;
  isError?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

const TABS = [
  { id: 'tea', label: 'Tea', icon: <Icons.Leaf className="w-4 h-4" /> },
  { id: 'teaware', label: 'Teaware', icon: <Icons.Teapot className="w-4 h-4" /> },
  { id: 'sets', label: 'Sets', icon: <Icons.Box className="w-4 h-4" /> },
  { id: 'collection', label: 'Collection', icon: <Icons.Seal className="w-4 h-4" /> },
];

export const Shop: React.FC<ShopProps> = ({
  teaInventory,
  teawareInventory,
  onAddToCart,
  cartItemCount = 0,
  onCartClick,
  onAccountClick,
  isLoading,
  isError,
  error,
  onRetry,
}) => {
  const [activeTab, setActiveTab] = useState<ShopTab>('tea');
  const [isAddingToCart, setIsAddingToCart] = useState<Record<string, boolean>>({});
  const [addedProductId, setAddedProductId] = useState<string | null>(null);

  const publicCart = useAppStore(state => state.publicCart);
  const recentlyViewed = useAppStore(state => state.recentlyViewed);

  const formatTotalPrice = () => {
    const total = publicCart.reduce((sum, item) => sum + item.pricePerGram * item.quantityGrams, 0);
    return fmtPrice(total);
  };

  // Admin overlay state
  const { isAdmin, productMap, refetchProducts } = useAdminOverlay();
  const { data: rates = [] } = useRates();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleAdminEdit = (itemId: string) => {
    const product = productMap.get(itemId);
    if (product) setEditingProduct(product);
  };

  const handleAddToCart = (item: InventoryItem, qty: number, total: number) => {
    onAddToCart(item, qty, total);
    setAddedProductId(item.id);
    setTimeout(() => setAddedProductId(null), 1500);
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
    setAddedProductId(set.id);
    setTimeout(() => setAddedProductId(null), 1500);
  };

  const renderSetCard = (set: StarterSet) => (
    <div
      key={set.id}
      className="group cursor-pointer relative break-inside-avoid md:hover:-translate-y-1 md:hover:shadow-lg md:transition-all md:duration-300"
      onClick={() => handleAddStarterSet(set)}
    >
      <div className="p-2 md:p-3 bg-tea-surface rounded-lg">
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
              className="bg-tea-gold hover:bg-tea-gold/90 text-tea-bg text-xs uppercase tracking-[0.15em] font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-3 w-full"
            >
              <span>{isAddingToCart[set.id] ? 'Adding...' : 'Add Set'}</span>
              <span className="w-[1px] h-3 bg-tea-text-sec/30" />
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
      <Helmet>
        <title>Shop — Teajia</title>
        <meta name="description" content="Browse curated fine teas and teaware. Oolongs, pu-erh, greens, whites, and handmade vessels — sourced directly from farmers and artisans." />
      </Helmet>
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
        {isLoading && !isError && teaInventory.length === 0 && (
          <SectionSkeleton variant="shop" />
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-[fadeIn_0.5s_ease-out]">
            <div className="w-14 h-14 border border-tea-gold/30 rounded-full flex items-center justify-center mb-5">
              <Icons.Leaf className="w-6 h-6 text-tea-gold/60" />
            </div>
            <h3 className="font-serif text-lg text-tea-text mb-2">Unable to load teas</h3>
            <p className="text-tea-text/50 text-sm mb-6 max-w-sm">
              {error?.message || 'We couldn\'t reach the server. Please check your connection and try again.'}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="bg-tea-gold text-white text-xs uppercase tracking-[0.15em] font-medium py-2.5 px-6 rounded-lg hover:bg-tea-gold/90 transition-all active:scale-95"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {!isError && activeTab === 'collection' && (
          <CollectionTab
            inventory={[...teaInventory, ...teawareInventory]}
            onAddToCart={onAddToCart}
          />
        )}

        {!isError && activeTab === 'tea' && (
          <TeaInventory
            inventory={teaInventory}
            onAddToCart={onAddToCart}
            hideHeader
            isAdmin={isAdmin}
            adminProductMap={productMap}
            onAdminEdit={handleAdminEdit}
          />
        )}

        {!isError && activeTab === 'teaware' && (
          <TeawareCatalog
            externalInventory={teawareInventory}
            onAddToCart={onAddToCart}
            hideHeader
            isAdmin={isAdmin}
            adminProductMap={productMap}
            onAdminEdit={handleAdminEdit}
          />
        )}

        {!isError && activeTab === 'sets' && renderSets()}

        {/* #34 — Recently Viewed */}
        {!isError && recentlyViewed.length > 0 && (() => {
          const recentItems = recentlyViewed
            .map(id => allInventory.find(item => item.id === id))
            .filter((item): item is InventoryItem => item !== undefined)
            .slice(0, 10);
          if (recentItems.length === 0) return null;
          return (
            <div className="px-3 md:px-4 lg:px-6 pb-8 pt-6">
              <p className="text-[11px] uppercase tracking-[0.15em] text-tea-text-dim mb-3 font-sans">Recently Viewed</p>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory">
                {recentItems.map(item => (
                  <div
                    key={item.id}
                    className="flex-shrink-0 snap-start w-28 cursor-pointer group"
                    onClick={() => onAddToCart(item, item.category === 'tea' ? 50 : 1, parseFloat(item.category === 'tea' ? (item.price_per_gram || '0') : (item.price_50g || '0')) * (item.category === 'tea' ? 50 : 1))}
                  >
                    <div className="w-28 h-28 bg-tea-surface rounded-lg overflow-hidden mb-2 group-hover:opacity-90 transition-opacity">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover sepia-[0.2]" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icons.Leaf className="w-8 h-8 text-tea-text-dim" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-tea-text font-serif leading-snug line-clamp-2">{item.name}</p>
                    <p className="text-[10px] text-tea-text-sec mt-0.5 font-mono">
                      {item.category === 'tea'
                        ? `$${parseFloat(item.price_per_gram || '0').toFixed(2)}/g`
                        : `$${parseFloat(item.price_50g || '0').toFixed(2)}`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* #29 — Sticky cart CTA bar */}
      <AnimatePresence>
        {publicCart.length > 0 && (
          <motion.div
            className="fixed bottom-[56px] lg:bottom-8 left-4 right-4 lg:left-auto lg:right-8 lg:w-80 z-30"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <button
              onClick={() => onCartClick?.()}
              className="w-full bg-tea-gold text-white flex items-center justify-between px-5 py-3.5 rounded-xl shadow-lg font-sans text-sm font-medium"
            >
              <span className="flex items-center gap-2">
                <span className="bg-white/20 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                  {publicCart.length}
                </span>
                View Cart
              </span>
              <span className="font-mono tabular-nums">{formatTotalPrice()}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin: Floating Action Button for quick product creation */}
      {isAdmin && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="fixed bottom-28 right-6 lg:bottom-8 z-sticky w-12 h-12 rounded-full bg-tea-gold text-white shadow-lg hover:bg-tea-gold/90 transition-all active:scale-95 flex items-center justify-center hover:shadow-xl"
          title="Add new product"
        >
          <Icons.Plus className="w-5 h-5" />
        </button>
      )}

      {/* Admin: Edit/Create Product Modal */}
      {(editingProduct || showCreateModal) && (
        <ToastProvider>
          <Suspense fallback={null}>
            <AddProductModal
              isOpen={true}
              onClose={() => { setEditingProduct(null); setShowCreateModal(false); }}
              onSuccess={() => { setEditingProduct(null); setShowCreateModal(false); refetchProducts(); }}
              initialData={editingProduct}
              rates={rates}
            />
          </Suspense>
        </ToastProvider>
      )}
    </div>
  );
};
