import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation, useSearchParams } from 'react-router-dom';
import { PRODUCT_PATH_RE } from '../hooks/useProductModalRoute';
import { useQuery } from '@tanstack/react-query';

import { Check, Loader2, ChevronDown } from 'lucide-react';
import { InventoryItem, Account } from '../types';
import { CollectionTab } from './shop/CollectionTab';
import { TeaInventory } from './TeaInventory';
import { TeawareCatalog } from './TeawareCatalog';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { Icons } from './Icons';
import { fmtShopPrice, fmtShopPricePerGram } from '../utils/formatNumber';
import { STARTER_TEA_SETS, STARTER_TEAWARE_SETS } from '../constants';
import { CardImage } from './shared/CardImage';
import { AnchoredMenu } from './shared/AnchoredMenu';
import { SectionDivider } from './shared/SectionDivider';
import { SectionSkeleton } from './shared/SectionSkeleton';
import { LogoEmblem } from './Logos/LogoEmblem';
import { getSetCoverVariant } from './shop/setCover';
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

const SetCover: React.FC<{ set: StarterSet }> = ({ set }) => {
  const category = set.items.some(item => item.type === 'tea') ? 'Tea collection' : 'Teaware collection';
  const variant = getSetCoverVariant(set.id, category);
  const emblemClasses = {
    orbit: 'relative self-center opacity-55',
    column: 'absolute right-6 top-16 opacity-50',
    horizon: 'absolute bottom-6 right-6 opacity-45',
    seal: 'absolute -right-7 top-1/2 -translate-y-1/2 opacity-[0.16]',
  }[variant];
  return (
    <div
      className="relative flex h-full min-h-48 w-full flex-col justify-between overflow-hidden bg-tea-elevated p-5 md:min-h-64 md:p-6"
      role="img"
      aria-label={`${set.name}, ${category}`}
      data-cover-variant={variant}
    >
      <div className="absolute inset-0 opacity-[0.035] grain-texture pointer-events-none" aria-hidden="true" />
      {variant === 'orbit' && <span className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 rounded-full border border-tea-border" aria-hidden="true" />}
      {variant === 'column' && <span className="absolute bottom-5 right-20 top-16 w-px bg-tea-border" aria-hidden="true" />}
      {variant === 'horizon' && <span className="absolute inset-x-5 top-1/2 border-t border-tea-border" aria-hidden="true" />}
      {variant === 'seal' && <span className="absolute bottom-5 left-5 top-16 w-px bg-tea-gold opacity-30" aria-hidden="true" />}
      <div className="relative flex items-center justify-between border-b border-tea-border pb-3">
        <span className="label-caps text-tea-text-sec">{category}</span>
        <span className="font-mono text-ui-9 text-tea-text-dim">{String(set.items.length).padStart(2, '0')} pieces</span>
      </div>
      <LogoEmblem size={variant === 'seal' ? 144 : 64} color="var(--tea-gold)" className={emblemClasses} ariaLabel="Teajia emblem" />
      <p className="relative max-w-52 font-display text-ui-26 leading-tight text-tea-text">{set.name}</p>
    </div>
  );
};

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

  // Product URLs are handled by real routing now: grid taps push
  // /shop/product/:id with background state (modal over this component) and
  // cold loads render the standalone ProductPage — no ?product= param anymore.
  // One reload edge remains: history state survives a reload, so this
  // component can mount while a product modal route is active. Make sure the
  // tab that owns the product is the one mounted, or the modal cannot open.
  const { pathname } = useLocation();
  useEffect(() => {
    const match = PRODUCT_PATH_RE.exec(pathname);
    if (!match) return;
    const productId = decodeURIComponent(match[1]);
    const inTea = teaInventory.some(i => i.id === productId);
    const inWare = teawareInventory.some(i => i.id === productId);
    const tabShowsIt =
      activeTab === 'collection' ? (inTea || inWare)
        : activeTab === 'tea' ? inTea
          : activeTab === 'teaware' ? inWare
            : false;
    if (tabShowsIt) return;
    if (inTea) setActiveTab('tea');
    else if (inWare) setActiveTab('teaware');
  }, [pathname, teaInventory, teawareInventory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch available stores
  const { data: networkStores = [] } = useQuery<Account[]>({
    queryKey: ['network', 'stores'],
    queryFn: fetchNetworkStores,
    staleTime: 1000 * 60 * 30,
  });

  const activeStore = networkStores.find(s => s.slug === shopStoreSlug) || networkStores[0];
  const activeStoreLabel = activeStore?.location_city || activeStore?.name || 'Bali';

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
        className="group bg-tea-surface rounded-xl overflow-hidden border border-tea-border transition-colors duration-200 hover:bg-tea-elevated"
      >
        <div className="flex flex-col md:flex-row">
          {/* Image side */}
          <div className="relative md:w-[40%] lg:w-[35%] flex-shrink-0">
            {set.image ? (
              <CardImage src={set.image} alt={set.name} aspect="video" className="md:!aspect-auto md:h-full" />
            ) : (
              <SetCover set={set} />
            )}
          </div>

          {/* Content side */}
          <div className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col">
            {/* Tags */}
            {set.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {set.tags.map(tag => (
                  <span key={tag} className="inline-flex px-2 py-0.5 rounded-full text-ui-9 uppercase tracking-caps bg-tea-elevated text-tea-text-sec">{tag}</span>
                ))}
              </div>
            )}

            {/* Title */}
            <h3 className="font-display text-ui-20 text-tea-text leading-tight mb-1 group-hover:text-tea-gold transition-colors duration-150">
              {set.name}
            </h3>

            {/* Ideal for */}
            {set.idealFor && (
              <p className="font-body text-ui-12 text-tea-text-sec italic mb-3">
                {set.idealFor}
              </p>
            )}

            {/* Full description */}
            <p className="body-light mb-4">
              {set.description}
            </p>

            {/* What's inside */}
            <div className="mb-4">
              <p className="label-caps text-tea-text-dim mb-2">
                What's inside
              </p>
              <div className="divide-y divide-tea-border">
                {resolvedItems.map((item) => (
                  <div
                    key={item.itemId}
                    className="flex items-center gap-2 py-1.5 text-ui-13 text-tea-text leading-snug"
                  >
                    {/* dot */}
                    <span className="w-1 h-1 rounded-full bg-tea-gold flex-shrink-0" />
                    <span className="flex-1">{item.name}{item.type === 'tea' ? ` · ${item.quantity}${item.unit}` : ''}</span>
                    <span className="text-ui-9 uppercase tracking-caps text-tea-text-dim flex-shrink-0 ml-auto">
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
                  {showComparison && (
                    <span className="font-mono tabular-nums text-ui-13 text-tea-text-dim line-through">
                      ${retailTotal}
                    </span>
                  )}
                  <span className="font-mono tabular-nums text-ui-17 text-tea-text font-semibold">
                    {set.price}
                  </span>
                </div>
                {set.discount && (
                  <p className="font-body italic text-ui-11 text-tea-text-sec mt-0.5">
                    {set.discount}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleAddStarterSet(set); }}
                disabled={isAddingToCart[set.id]}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isAddingToCart[set.id] && <Loader2 size={13} className="animate-spin" />}
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
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <Icons.Box className="w-7 h-7 text-tea-text-dim" strokeWidth={1.25} />
          <h3 className="font-display text-ui-17 text-tea-text mt-4">Nothing here yet</h3>
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
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
          <AnchoredMenu
            align="right"
            width={180}
            className="!bg-tea-elevated"
            role="listbox"
            open={storePickerOpen}
            onOpenChange={setStorePickerOpen}
            trigger={(props) => (
              <button
                {...props}
                type="button"
                aria-label={`Choose store, currently ${activeStoreLabel}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-ui-12 text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors"
              >
                <Icons.Location className="w-3.5 h-3.5 text-tea-text-sec" />
                <span className="tracking-wide">{activeStoreLabel}</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${storePickerOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          >
            {(close) => (
              <>
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
                        close();
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 text-ui-13 transition-colors ${
                        isActive
                          ? 'text-tea-text bg-tea-accent-sub'
                          : 'text-tea-text hover:bg-tea-accent-sub'
                      }`}
                    >
                      <Icons.Location className="w-3.5 h-3.5 shrink-0 text-tea-text-dim" />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-ui-13">{store.location_city || store.name}</div>
                        {store.location_country && (
                          <div className="text-ui-10 text-tea-text-dim truncate">{store.location_country}</div>
                        )}
                      </div>
                      {isActive && <Check className="w-3.5 h-3.5 text-tea-gold shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
              </>
            )}
          </AnchoredMenu>
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
        positioned at bottom-[calc(52px+env(safe-area-inset-bottom,0px)+1rem)] on
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
          <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6 animate-[fadeIn_0.5s_ease-out]">
            <Icons.AlertCircle className="w-7 h-7 text-tea-error" strokeWidth={1.25} />
            <h3 className="font-display text-ui-17 text-tea-text mt-4">Unable to load teas</h3>
            <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2 mb-6">
              {error?.message || 'We couldn\'t reach the server. Please check your connection and try again.'}
            </p>
            {onRetry && (
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-xs"
              >
                Try again
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
              <p className="label-caps text-tea-text-dim mb-3">Recently Viewed</p>
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
                      className="text-left flex-shrink-0 snap-start w-28 group focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-2 focus-visible:ring-offset-tea-bg rounded-md"
                    >
                      <div className="w-28 h-28 bg-tea-surface border border-tea-border rounded-md overflow-hidden mb-2">
                        {item.image ? (
                          <img src={item.image} alt="" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.06]" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Icons.Leaf className="w-8 h-8 text-tea-text-dim" aria-hidden="true" />
                          </div>
                        )}
                      </div>
                      <p className="font-display text-ui-13 text-tea-text leading-snug line-clamp-2">{item.name}</p>
                      <p className="text-ui-10 text-tea-text-sec mt-0.5 font-mono tabular-nums">
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
