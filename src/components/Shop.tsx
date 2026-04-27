import React, { useState, useEffect, useRef, useMemo, useCallback, lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { Check, Loader2, ChevronDown } from 'lucide-react';
import { InventoryItem, Account } from '../types';
import { CollectionTab } from './shop/CollectionTab';
import { ShopCollectionBand } from './shop/ShopCollectionBand';
import { usePublicShopCollections } from '../hooks/usePublicShopCollections';
import { TeaInventory } from './TeaInventory';
import { TeawareCatalog } from './TeawareCatalog';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { Icons } from './Icons';
import { fmtShopPrice, fmtShopPricePerGram } from '../utils/formatNumber';
import { STARTER_TEA_SETS, STARTER_TEAWARE_SETS } from '../constants';
import { CardImage } from './shared/CardImage';
import { SectionDivider } from './shared/SectionDivider';
import { SectionSkeleton } from './shared/SectionSkeleton';
import { useAdminOverlay } from '../hooks/useAdminOverlay';
import { useScrollRestoration } from '../hooks/useScrollRestoration';
import { useRates } from '../admin/hooks/useAdminData';
import { ToastProvider } from '../admin/components/Toast';
import { useAppStore } from '../lib/store';
import { fetchNetworkStores } from '../lib/storefrontApi';

import type { StarterSet } from '../types';
import type { Product } from '../admin/types';

const AddProductModal = lazy(() => import('../admin/components/AddProductModal').then(m => ({ default: m.AddProductModal })));
const ProductEditPanel = lazy(() => import('../admin/components/ProductEditPanel').then(m => ({ default: m.ProductEditPanel })));

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
  initialProductId?: string;
}

const TABS = [
  { id: 'tea', label: 'Tea', icon: <Icons.Leaf className="w-4 h-4" /> },
  { id: 'teaware', label: 'Teaware', icon: <Icons.Teapot className="w-4 h-4" /> },
  { id: 'sets', label: 'Sets', icon: <Icons.Box className="w-4 h-4" /> },
  { id: 'collection', label: 'Liked', icon: <Icons.Heart className="w-4 h-4" /> },
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
  const [storePickerOpen, setStorePickerOpen] = useState(false);
  const storePickerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useScrollRestoration('scroll-shop');

  const recentlyViewed = useAppStore(state => state.recentlyViewed);
  const shopStoreSlug = useAppStore(state => state.shopStoreSlug);
  const setShopStoreSlug = useAppStore(state => state.setShopStoreSlug);

  // URL param support: ?store=slug overrides persisted selection
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStore = searchParams.get('store');
  useEffect(() => {
    if (urlStore && urlStore !== shopStoreSlug) {
      setShopStoreSlug(urlStore);
      // Clean the param from URL after applying
      searchParams.delete('store');
      setSearchParams(searchParams, { replace: true });
    }
  }, [urlStore]); // eslint-disable-line react-hooks/exhaustive-deps

  // URL param support: ?product=<id> — switch to the tab matching the product's
  // category so the active tab's useProductUrl hook can pick it up and open the
  // modal. Entry points: GlobalSearch results, shared links, page reloads.
  const urlProduct = searchParams.get('product');
  useEffect(() => {
    if (!urlProduct) return;
    // Only switch tabs if the user is on a tab that can't show this product.
    if (activeTab !== 'tea' && activeTab !== 'teaware') return;
    const inTea = teaInventory.some(i => i.id === urlProduct);
    const inWare = teawareInventory.some(i => i.id === urlProduct);
    if (inTea && activeTab !== 'tea') {
      setActiveTab('tea');
    } else if (inWare && activeTab !== 'teaware') {
      setActiveTab('teaware');
    }
  }, [urlProduct, teaInventory, teawareInventory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch available stores
  const { data: networkStores = [] } = useQuery<Account[]>({
    queryKey: ['network', 'stores'],
    queryFn: fetchNetworkStores,
    staleTime: 1000 * 60 * 30,
  });

  const activeStore = networkStores.find(s => s.slug === shopStoreSlug) || networkStores[0];
  const activeStoreLabel = activeStore?.location_city || activeStore?.name || 'Bali';

  // Close picker on outside click or Escape
  useEffect(() => {
    if (!storePickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (storePickerRef.current && !storePickerRef.current.contains(e.target as Node)) {
        setStorePickerOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStorePickerOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [storePickerOpen]);

  // Shop-published editorial collections
  const { collections: shopCollections, isLoading: collectionsLoading, isError: collectionsError } = usePublicShopCollections();

  // URL filter params: when ?flavor= or ?feel= are active the user is filtering —
  // hide discovery bands so they don't distract from the filtered result.
  const hasUrlFilter = !!(searchParams.get('flavor') || searchParams.get('feel'));

  // Bands are visible only on the tea tab and when no URL filter is active.
  const showBands = activeTab === 'tea' && !hasUrlFilter && !collectionsLoading && !collectionsError && shopCollections.length > 0;

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

  const allInventory = useMemo(
    () => [...teaInventory, ...teawareInventory],
    [teaInventory, teawareInventory],
  );

  const collectionInventory = allInventory;

  const handleAddStarterSet = async (set: StarterSet) => {
    setIsAddingToCart(prev => ({ ...prev, [set.id]: true }));
    await new Promise(resolve => setTimeout(resolve, 300));
    set.items.forEach(({ itemId }) => {
      const item = allInventory.find(inv => inv.id === itemId);
      if (item && item.stock_g > 0) {
        const defaultQty = item.category === 'tea' ? 50 : 1;
        // For tea: price_per_gram is per-gram. For teaware: price_50g is per-unit (legacy name).
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

  // Resolve set items to inventory names
  const resolveSetItems = (set: StarterSet) =>
    set.items.map(({ type, itemId, quantity }) => {
      const item = allInventory.find(inv => inv.id === itemId);
      return {
        name: item?.name || itemId,
        type,
        itemId,
        quantity: quantity || (type === 'tea' ? 50 : 1),
        unit: type === 'tea' ? 'g' : '',
      };
    });

  // Calculate "retail" total from individual item prices
  const calcRetailTotal = (set: StarterSet): number => {
    let total = 0;
    set.items.forEach(({ type, itemId }) => {
      const item = allInventory.find(inv => inv.id === itemId);
      if (item) {
        if (type === 'tea') {
          total += parseFloat(item.price_per_gram || '0') * 50;
        } else {
          // price_50g is per-unit price for teaware (legacy field name)
          total += parseFloat(item.price_50g || '0');
        }
      }
    });
    return Math.round(total);
  };

  const renderSetCard = (set: StarterSet) => {
    const resolvedItems = resolveSetItems(set);
    const retailTotal = calcRetailTotal(set);
    const setPrice = parseInt(set.price.replace('$', ''), 10);
    const showComparison = retailTotal > 0 && retailTotal > setPrice;

    return (
      <article
        key={set.id}
        className="group bg-tea-surface rounded-[6px] overflow-hidden border border-tea-border transition-colors duration-200 hover:border-tea-gold/30"
      >
        <div className="flex flex-col md:flex-row">
          {/* Image side */}
          <div className="relative md:w-[40%] lg:w-[35%] flex-shrink-0">
            <CardImage src={set.image} alt={set.name} aspect="video" className="md:!aspect-auto md:h-full" />
          </div>

          {/* Content side */}
          <div className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col">
            {/* Tags */}
            {set.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {set.tags.map(tag => (
                  <span key={tag} className="tag text-[0.5625rem]">{tag}</span>
                ))}
              </div>
            )}

            {/* Title */}
            <h3 className="font-display text-lg md:text-xl text-tea-text leading-tight mb-1 group-hover:text-tea-gold transition-colors duration-150">
              {set.name}
            </h3>

            {/* Ideal for */}
            {set.idealFor && (
              <p className="font-body text-xs text-tea-text-sec italic mb-3">
                {set.idealFor}
              </p>
            )}

            {/* Full description */}
            <p className="font-body text-sm text-tea-text-sec leading-relaxed mb-4">
              {set.description}
            </p>

            {/* What's inside */}
            <div className="mb-4">
              <p className="font-sans text-[0.625rem] uppercase tracking-[0.12em] text-tea-text-dim mb-2">
                What's inside
              </p>
              <div className="divide-y divide-tea-gold/[0.08]">
                {resolvedItems.map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center gap-2 py-1.5 text-[0.8125rem] text-tea-text leading-snug"
                  >
                    {/* dot */}
                    <span className="w-1 h-1 rounded-full bg-tea-gold/50 flex-shrink-0" />
                    <span className="flex-1">{item.name}{item.type === 'tea' ? ` · ${item.quantity}${item.unit}` : ''}</span>
                    <span className="font-sans text-[0.625rem] uppercase tracking-[0.06em] text-tea-text-dim flex-shrink-0 ml-auto">
                      {item.type === 'tea' ? 'Tea' : 'Teaware'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Price + Add button */}
            <div className="mt-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-2">
                  {/* original/retail price — inline, no .set-price-original */}
                  {showComparison && (
                    <span className="font-mono text-[0.8125rem] text-tea-text-dim line-through opacity-60">
                      ${retailTotal}
                    </span>
                  )}
                  <span className="font-mono text-lg text-tea-text font-semibold">
                    {set.price}
                  </span>
                </div>
                {set.discount && (
                  <p className="font-body text-[0.6875rem] text-tea-text-sec italic mt-0.5">
                    {set.discount}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleAddStarterSet(set); }}
                disabled={isAddingToCart[set.id]}
                className="bg-tea-gold hover:bg-tea-gold-lt text-tea-bg text-xs uppercase tracking-[0.15em] font-medium py-2.5 px-6 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-3 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingToCart[set.id] && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isAddingToCart[set.id] ? 'Adding...' : 'Add Set to Cart'}</span>
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const renderSets = () => (
    <div className="max-w-full mx-auto px-3 md:px-4 lg:px-6 pt-4 animate-[fadeIn_0.5s_ease-out]">
      {STARTER_TEA_SETS.length === 0 && STARTER_TEAWARE_SETS.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-display text-2xl text-tea-text-dim mb-2">Nothing here yet.</p>
          <p className="font-body italic text-sm text-tea-text-dim">
            Try a different filter, or explore the full catalog.
          </p>
        </div>
      ) : (
        <>
          <SectionDivider label="Tea Sets" subtitle="Curated tea collections with essential brewing vessels." />
          <div className="space-y-4 md:space-y-5 stagger-grid">
            {STARTER_TEA_SETS.map(set => renderSetCard(set))}
          </div>

          <SectionDivider label="Teaware Sets" subtitle="Complete teaware collections for any brewing style." />
          <div className="space-y-4 md:space-y-5 stagger-grid">
            {STARTER_TEAWARE_SETS.map(set => renderSetCard(set))}
          </div>
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
        rightContent={networkStores.length > 1 ? (
          <div ref={storePickerRef} className="relative">
            <button
              type="button"
              onClick={() => setStorePickerOpen(p => !p)}
              aria-haspopup="listbox"
              aria-expanded={storePickerOpen}
              aria-label={`Choose store, currently ${activeStoreLabel}`}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-tea-text-sec hover:bg-tea-surface transition-colors"
            >
              <Icons.Location className="w-3.5 h-3.5 text-tea-text-sec" />
              <span className="tracking-wide">{activeStoreLabel}</span>
              <ChevronDown className={`w-3 h-3 transition-transform ${storePickerOpen ? 'rotate-180' : ''}`} />
            </button>
            {storePickerOpen && (
              <div role="listbox" className="absolute right-0 top-full mt-1 bg-tea-elevated border border-tea-border rounded-lg shadow-lg py-1 min-w-[180px] z-50 animate-[fadeIn_0.15s_ease-out]">
                {networkStores.map(store => {
                  const isActive = store.slug === (shopStoreSlug || 'teajia-bali');
                  return (
                    <button
                      type="button"
                      key={store.slug}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => {
                        setShopStoreSlug(store.slug === 'teajia-bali' ? null : store.slug);
                        setStorePickerOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-sm transition-colors ${
                        isActive
                          ? 'text-tea-text bg-tea-surface'
                          : 'text-tea-text hover:bg-tea-surface/60'
                      }`}
                    >
                      <Icons.Location className="w-3.5 h-3.5 shrink-0 text-tea-text-dim" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium text-xs">{store.location_city || store.name}</div>
                        {store.location_country && (
                          <div className="text-[10px] text-tea-text-dim truncate">{store.location_country}</div>
                        )}
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-tea-gold shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : undefined}
      >
        <PageHeaderTabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={(tabId) => setActiveTab(tabId as ShopTab)}
        />
      </PageHeader>

      {/* Content */}
      {/*
        CartToast positioning note (#cart-toast-overlap):
        CartToast lives at src/components/shared/CartToast.tsx and is already
        positioned at bottom-[calc(44px+env(safe-area-inset-bottom,0px)+1rem)] on
        mobile and lg:bottom-8 lg:right-8 on desktop. The bottom tab bar is 56px
        (h-14) + safe area. If the tab bar height ever changes, update CartToast to:
          mobile: bottom-[calc(56px+env(safe-area-inset-bottom,0px)+12px)]
          desktop: bottom-4 right-4
      */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto max-w-[1400px] mx-auto w-full">
        {isLoading && !isError && (
          (activeTab === 'tea' && teaInventory.length === 0) ||
          (activeTab === 'teaware' && teawareInventory.length === 0)
        ) && (
          <SectionSkeleton variant="shop" />
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-[fadeIn_0.5s_ease-out]">
            <div className="w-14 h-14 border border-tea-border rounded-full flex items-center justify-center mb-5">
              <Icons.Leaf className="w-6 h-6 text-tea-gold/60" />
            </div>
            <h3 className="text-lg text-tea-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>Unable to load teas</h3>
            <p className="text-tea-text/50 text-sm mb-6 max-w-sm">
              {error?.message || 'We couldn\'t reach the server. Please check your connection and try again.'}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.15em] font-medium py-2.5 px-6 rounded-lg hover:bg-tea-gold-lt transition-all active:scale-95"
              >
                Try Again
              </button>
            )}
          </div>
        )}

        {!isError && activeTab === 'collection' && (
          <CollectionTab
            inventory={collectionInventory}
            onAddToCart={onAddToCart}
          />
        )}

        {/* Editorial collection bands — visible on tea tab when no URL filter is active */}
        {showBands && (
          <div className="overflow-hidden border-b border-tea-border">
            {shopCollections.map(entry => (
              <ShopCollectionBand key={entry.publication_id} entry={entry} />
            ))}
          </div>
        )}

        {!isError && !(isLoading && teaInventory.length === 0) && activeTab === 'tea' && (
          <TeaInventory
            inventory={teaInventory}
            onAddToCart={onAddToCart}
            hideHeader
            isAdmin={isAdmin}
            adminProductMap={productMap}
            onAdminEdit={handleAdminEdit}
          />
        )}

        {!isError && !(isLoading && teawareInventory.length === 0) && activeTab === 'teaware' && (
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
                {recentItems.map(item => {
                  const isTea = item.category === 'tea';
                  const unitPrice = parseFloat((isTea ? item.price_per_gram : item.price_50g) || '0');
                  const qty = isTea ? 50 : 1;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => onAddToCart(item, qty, unitPrice * qty)}
                      aria-label={`Add ${item.name} to cart`}
                      className="text-left flex-shrink-0 snap-start w-28 group focus:outline-none focus-visible:ring-1 focus-visible:ring-tea-gold/40 rounded-lg"
                    >
                      <div className="w-28 h-28 bg-tea-surface rounded-lg overflow-hidden mb-2 group-hover:opacity-90 transition-opacity">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover sepia-[0.2]" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icons.Leaf className="w-8 h-8 text-tea-text-dim" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-tea-text leading-snug line-clamp-2" style={{ fontFamily: 'var(--font-display)' }}>{item.name}</p>
                      <p className="text-[10px] text-tea-text-sec mt-0.5 font-mono tabular-nums">
                        {isTea
                          ? fmtShopPricePerGram(unitPrice)
                          : `${fmtShopPrice(unitPrice)} each`}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Cart access is now handled by the global CartIndicator in App.tsx */}



      {/* Admin: Create Product Modal (new items only) */}
      {showCreateModal && (
        <ToastProvider>
          <Suspense fallback={null}>
            <AddProductModal
              isOpen={true}
              onClose={() => setShowCreateModal(false)}
              onSuccess={() => { setShowCreateModal(false); refetchProducts(); }}
              rates={rates}
            />
          </Suspense>
        </ToastProvider>
      )}

      {/* Admin: Edit Product — same sidebar panel used in the inventory view */}
      {editingProduct && (
        <ToastProvider>
          <Suspense fallback={null}>
            <ProductEditPanel
              product={editingProduct}
              rates={rates}
              onClose={() => { setEditingProduct(null); refetchProducts(); }}
              onUpdate={(id, field, value) => {
                // Optimistic local update so the panel reflects the change immediately
                setEditingProduct(prev => (prev && prev.id === id ? { ...prev, [field]: value } : prev));
              }}
            />
          </Suspense>
        </ToastProvider>
      )}
    </div>
  );
};
