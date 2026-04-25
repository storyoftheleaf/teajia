
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icons } from './Icons';
import { X, Leaf } from 'lucide-react';
import { AddToSampleButton } from './samples/AddToSampleButton';
import { AlcoveModal } from './shop/AlcoveModal';
import { TastingEditorModal } from '../admin/components/TastingEditorModal';
import { resolveTermLabel, resolveTermIcon, TASTING_TAXONOMY, type TastingCategoryId } from '../data/tastingTaxonomy';
import { getCommonTastingForType } from '../data/commonTastingByStyle';
import { TeaPlaceholder } from './shop/TeaPlaceholder';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { fmtShopPrice } from '../utils/formatNumber';
import { TEA_TYPE_COLORS } from '../designTokens';
import { InventoryItem } from '../types';
import { SALE_ITEM_IDS } from '../data/curatedCollections';
import { useAppStore } from '../lib/store';
import { useProductUrl } from '../hooks/useProductUrl';
import { CompareView } from './shop/CompareView';
import { useTastingCounts } from '../hooks/useTastingCount';
import { TastingSession, type TastingItem } from './tasting/TastingSession';
import { AnimatePresence } from 'framer-motion';
import type { Product } from '../admin/types';

// Use shared type alias for backward compatibility in this component if needed,
// or directly use InventoryItem
export type TeaItem = InventoryItem;

interface TeaInventoryProps {
  initialProductId?: string;
  inventory: TeaItem[];
  onAddToCart?: (item: TeaItem, qty: number, total: number) => void;
  onCartClick?: () => void;
  onAccountClick?: () => void;
  cartItemCount?: number;
  hideHeader?: boolean;
  isAdmin?: boolean;
  adminProductMap?: Map<string, Product>;
  onAdminEdit?: (itemId: string) => void;
}

// Preferred display order for tea types — any types not listed here appear at the end
const TYPE_ORDER = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Black', 'Dark', 'Sheng', 'Shou', 'Herbal'];

// Extract feeling terms from the canonical tasting taxonomy
const FEELING_TERMS = (() => {
  const cat = TASTING_TAXONOMY.categories.find(c => c.id === 'feeling');
  if (!cat) return [];
  return cat.groups.flatMap(g => g.terms.map(t => ({ id: t.id, label: t.label })));
})();

// Sale items imported from data/curatedCollections

/**
 * Does the resolved tasting profile for this item include a given term?
 * Checks owner-saved data first; falls back to the style-level common profile
 * so filters still match before any tasting has been reviewed.
 */
function resolvedIncludes(item: TeaItem, categoryId: TastingCategoryId, termId: string): boolean {
  const ownerTerms =
    (item.tastingSource === 'owner' || item.tastingSource === 'community')
      ? item.tasting?.[categoryId]
      : undefined;
  if (ownerTerms?.includes(termId)) return true;
  const common = getCommonTastingForType(item.type);
  return Boolean(common?.[categoryId]?.includes(termId));
}

export const TeaInventory: React.FC<TeaInventoryProps> = ({ inventory, onAddToCart, onCartClick, onAccountClick, cartItemCount = 0, hideHeader = false, isAdmin = false, adminProductMap, onAdminEdit, initialProductId }) => {
  // Filter State
  const [activeType, setActiveType] = useState<string>('All');
  const [activeFeeling, setActiveFeeling] = useState<string | null>(null); // feeling term ID from taxonomy
  const [specialFilter, setSpecialFilter] = useState<'None' | 'Curated' | 'Sale' | 'Liked' | 'Tasted'>('None');
  const [openFilter, setOpenFilter] = useState<'type' | 'feeling' | null>(null);
  const [searchText, setSearchText] = useState<string>('');

  // Derive tea types from actual inventory (ordered by TYPE_ORDER, then alphabetically)
  const teaTypes = useMemo(() => {
    const types = new Set(inventory.map(item => item.type));
    const ordered = TYPE_ORDER.filter(t => types.has(t));
    const remaining = [...types].filter(t => !TYPE_ORDER.includes(t)).sort();
    return [...ordered, ...remaining];
  }, [inventory]);

  // Derive which feeling terms are actually present in the inventory.
  // Includes style-level common feelings so filters are meaningful before
  // the owner has saved any explicit tastings.
  const availableFeelings = useMemo(() => {
    const present = new Set<string>();
    for (const item of inventory) {
      const ownerTerms =
        (item.tastingSource === 'owner' || item.tastingSource === 'community')
          ? item.tasting?.feeling
          : undefined;
      if (ownerTerms) {
        for (const f of ownerTerms) present.add(f);
      }
      const common = getCommonTastingForType(item.type);
      if (common?.feeling) {
        for (const f of common.feeling) present.add(f);
      }
    }
    return FEELING_TERMS.filter(t => present.has(t.id));
  }, [inventory]);

  // User Interaction State — persisted via Zustand store
  const { favoriteTeas, toggleFavoriteTea, compareItems, recentlyViewed, addRecentlyViewed, shopPriceWeight, setShopPriceWeight, shopSort, setShopSort, shopSavedOnly, setShopSavedOnly } = useAppStore();
  const userFavorites = useMemo(() => new Set(favoriteTeas), [favoriteTeas]);
  const [showCompare, setShowCompare] = useState(false);

  // Tasting journal — count how many times user has tasted each tea
  const tastingCounts = useTastingCounts();

  // Tasting term filter (cross-reference from AlcoveCard)
  const [tastingFilter, setTastingFilter] = useState<{ termId: string; categoryId: string } | null>(null);

  // URL ↔ filter round-trip. ?flavor=<termId> and ?feel=<termId> are shareable
  // entry points from product pages; clearing filters in the UI also clears
  // the URL so history behaves as expected.
  const [searchParams, setSearchParams] = useSearchParams();
  const didHydrateFromUrl = useRef(false);

  // One-way hydration: on first render, seed state from the URL.
  useEffect(() => {
    if (didHydrateFromUrl.current) return;
    didHydrateFromUrl.current = true;
    const flavor = searchParams.get('flavor');
    const feel = searchParams.get('feel');
    if (flavor) setTastingFilter({ termId: flavor, categoryId: 'flavor' });
    if (feel) setActiveFeeling(feel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reverse direction: whenever state changes after hydration, update the URL.
  useEffect(() => {
    if (!didHydrateFromUrl.current) return;
    const next = new URLSearchParams(searchParams);
    const flavorTerm = tastingFilter?.categoryId === 'flavor' ? tastingFilter.termId : null;
    if (flavorTerm) next.set('flavor', flavorTerm);
    else next.delete('flavor');
    if (activeFeeling) next.set('feel', activeFeeling);
    else next.delete('feel');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFeeling, tastingFilter]);

  const handleTermClick = useCallback((termId: string, categoryId: string) => {
    setTastingFilter({ termId, categoryId });
    setViewItem(null); // close the modal
  }, []);

  const clearTastingFilter = useCallback(() => setTastingFilter(null), []);

  // Image Modal State
  const [viewItem, setViewItemRaw] = useState<TeaItem | null>(null);
  const setViewItem = useCallback((item: TeaItem | null) => {
    setViewItemRaw(item);
    if (item) addRecentlyViewed(item.id);
  }, [addRecentlyViewed]);

  // Keep the open card's data fresh. When React Query refetches inventory
  // (e.g. after an admin tasting save), re-derive viewItem from the new
  // inventory array so the card visually updates instead of holding the
  // stale snapshot captured when it was first opened.
  useEffect(() => {
    if (!viewItem) return;
    const fresh = inventory.find(i => i.id === viewItem.id);
    if (fresh && fresh !== viewItem) setViewItemRaw(fresh);
  }, [inventory, viewItem]);

  // Filter area ref
  const filterRef = useRef<HTMLDivElement>(null);

  // Recently viewed items resolved from inventory
  const recentlyViewedItems = useMemo(() => {
    return recentlyViewed
      .map(id => inventory.find(item => item.id === id))
      .filter(Boolean) as TeaItem[];
  }, [recentlyViewed, inventory]);

  // Tasting Session State
  const [tastingItem, setTastingItem] = useState<TeaItem | null>(null);
  // Admin: edit the product's own tasting profile (writes to products.tasting with source='owner')
  const [adminTastingItem, setAdminTastingItem] = useState<TeaItem | null>(null);
  const handleEditProductTasting = useCallback((item: TeaItem) => {
    setAdminTastingItem(item);
  }, []);
  const handleTaste = useCallback((item: TeaItem) => {
    // If we're on a product path, return to /shop so useProductUrl doesn't re-open the modal
    if (window.location.pathname.startsWith('/shop/product/')) {
      window.history.replaceState(null, '', '/shop');
    }
    // Admins editing their own shop almost always want to update the product's
    // tasting profile, not file a personal journal entry. Route them into the
    // admin editor instead. Customers still get the journaling flow.
    if (isAdmin) {
      setAdminTastingItem(item);
      return;
    }
    setViewItem(null); // close AlcoveModal
    setTastingItem(item);
  }, [isAdmin, setViewItem]);
  const handleOrderFromTasting = useCallback((item: TastingItem) => {
    setTastingItem(null);
    setViewItem(item as TeaItem); // item is always a full TeaItem at runtime
  }, [setViewItem]);
  const adminTastingProductShim: Product | null = useMemo(() => {
    if (!adminTastingItem) return null;
    return {
      id: adminTastingItem.id,
      givenName: adminTastingItem.name,
      productName: adminTastingItem.variant || adminTastingItem.name,
      type: adminTastingItem.type as Product['type'],
      imageUrl: adminTastingItem.image || '',
      tasting: adminTastingItem.tasting,
    } as Product;
  }, [adminTastingItem]);

  // Sync modal state with URL (/shop/product/<id>) for shareability and back-button support
  const { closeWithHistory, navigateWithinModal } = useProductUrl(inventory, viewItem, setViewItem);


  // Filter Logic
  const filteredInventory = useMemo(() => {
    const searchLower = searchText.trim().toLowerCase();
    return inventory.filter(item => {
      // 0. Search filter (case-insensitive substring on name)
      const matchSearch = !searchLower || item.name.toLowerCase().includes(searchLower);

      // 1. Basic Filter (Type/Feeling)
      const matchType = activeType === 'All' || item.type === activeType;
      const matchFeeling = !activeFeeling || resolvedIncludes(item, 'feeling', activeFeeling);

      // 2. Special Filter (Curated/Sale/Liked)
      let matchSpecial = true;
      if (specialFilter === 'Curated') matchSpecial = !!item.isFeatured;
      if (specialFilter === 'Sale') matchSpecial = SALE_ITEM_IDS.includes(item.id);
      if (specialFilter === 'Liked') matchSpecial = userFavorites.has(item.id);
      if (specialFilter === 'Tasted') matchSpecial = (tastingCounts.get(item.id) || 0) > 0;

      // 3. Tasting term filter (cross-reference)
      let matchTasting = true;
      if (tastingFilter) {
        if (tastingFilter.categoryId === 'mood') {
          // Mood filter: match against comma-separated mood field
          const itemMoods = (item.mood || '').split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
          matchTasting = itemMoods.includes(tastingFilter.termId);
        } else {
          const catKey = tastingFilter.categoryId as TastingCategoryId;
          if (resolvedIncludes(item, catKey, tastingFilter.termId)) {
            matchTasting = true;
          } else {
            // Fallback: check legacy tags
            matchTasting = item.tags.some(t => t.toLowerCase() === resolveTermLabel(tastingFilter.termId).toLowerCase());
          }
        }
      }

      // 4. Saved-only shop toggle
      const matchSaved = !shopSavedOnly || userFavorites.has(item.id);

      return matchSearch && matchType && matchFeeling && matchSpecial && matchTasting && matchSaved;
    });
  }, [inventory, searchText, activeType, activeFeeling, specialFilter, userFavorites, tastingFilter, shopSavedOnly]);

  // Grouping & Sorting Logic
  const groupedInventory = useMemo(() => {
    const groups: Record<string, TeaItem[]> = {};
    
    filteredInventory.forEach(item => {
        if (!groups[item.type]) {
            groups[item.type] = [];
        }
        groups[item.type].push(item);
    });

    // Return groups in specific order, or just the active one if filtered
    const typesToShow = activeType === 'All' ? teaTypes : [activeType];

    return typesToShow
        .filter(type => groups[type] && groups[type].length > 0)
        .map(type => ({
            type,
            items: groups[type].sort((a, b) => {
                const priceA = parseFloat(a.price_per_gram || a.price_50g || '0');
                const priceB = parseFloat(b.price_per_gram || b.price_50g || '0');
                const tastedA = tastingCounts.get(a.id) || 0;
                const tastedB = tastingCounts.get(b.id) || 0;
                switch (shopSort) {
                    case 'price_asc':  return priceA - priceB;
                    case 'price_desc': return priceB - priceA;
                    case 'recent': {
                        const idxA = recentlyViewed.indexOf(a.id);
                        const idxB = recentlyViewed.indexOf(b.id);
                        if (idxA === -1 && idxB === -1) return 0;
                        if (idxA === -1) return 1;
                        if (idxB === -1) return -1;
                        return idxA - idxB;
                    }
                    case 'tasted': return tastedB - tastedA;
                    case 'featured':
                    default: {
                        const aFeat = a.isFeatured ? 1 : 0;
                        const bFeat = b.isFeatured ? 1 : 0;
                        if (aFeat !== bFeat) return bFeat - aFeat;
                        return priceA - priceB;
                    }
                }
            })
        }));
  }, [filteredInventory, activeType, teaTypes, shopSort, tastingCounts, recentlyViewed]);

  const handleFavoriteToggle = useCallback((itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavoriteTea(itemId);
  }, [toggleFavoriteTea]);

  // Add-to-cart confirmation feedback
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});
  const handleAddWithFeedback = (item: TeaItem, qty: number, total: number) => {
    if (onAddToCart) onAddToCart(item, qty, total);
    setAddedItems(prev => ({ ...prev, [item.id]: true }));
    setTimeout(() => setAddedItems(prev => ({ ...prev, [item.id]: false })), 1500);
  };

  const clearFilters = () => {
    setActiveType('All');
    setActiveFeeling(null);
    setSpecialFilter('None');
    setTastingFilter(null);
    setSearchText('');
  };

  return (
    <div className="w-full pb-32 animate-[fadeIn_0.5s_ease-out]">

      {/* --- Alcove Detail Modal --- */}
      <AlcoveModal
        item={viewItem}
        items={filteredInventory}
        onClose={closeWithHistory}
        onItemChange={navigateWithinModal}
        onAddToCart={(item, quantity, total) => {
          if (onAddToCart) onAddToCart(item, quantity, total);
          closeWithHistory();
        }}
        onTermClick={handleTermClick}
        onTaste={handleTaste}
        isAdmin={isAdmin}
        onEditProductTasting={isAdmin ? handleEditProductTasting : undefined}
      />

      {/* Tasting Session Modal */}
      <AnimatePresence>
        {tastingItem && (
          <TastingSession
            item={tastingItem}
            onClose={() => setTastingItem(null)}
            onOrderTea={handleOrderFromTasting}
          />
        )}
      </AnimatePresence>

      {/* Admin: product-tasting editor (writes to products.tasting with source='owner') */}
      {adminTastingItem && adminTastingProductShim && (
        <TastingEditorModal
          product={adminTastingProductShim}
          onClose={() => setAdminTastingItem(null)}
          onSaved={() => setAdminTastingItem(null)}
        />
      )}

      {!hideHeader && (
        <PageHeader
          title="Tea Ledger"
          onCartClick={onCartClick}
          onAccountClick={onAccountClick}
          cartItemCount={cartItemCount}
        >
          <PageHeaderTabs
            tabs={[
              { id: 'Curated', label: 'recommended' },
              { id: 'Sale', label: 'On Sale' },
              { id: 'Liked', label: 'My Likes' },
              { id: 'Tasted', label: 'Tasted' },
            ]}
            activeTab={specialFilter}
            onChange={(id) => setSpecialFilter(prev => prev === id ? 'None' : id as any)}
          />
        </PageHeader>
      )}

      {/* --- Inline Filter Bar + Content (full width) --- */}
      <div className="max-w-full mx-auto px-1 md:px-2 lg:px-4 pt-4">

         {/* Sticky shop toolbar */}
         <div className="sticky top-0 z-sticky -mx-1 md:-mx-2 lg:-mx-4 px-1 md:px-2 lg:px-4 bg-tea-bg/95 backdrop-blur-sm border-b border-tea-border">
           {/* Row 1: search + result count */}
           <div className="flex items-center gap-3 pt-2 pb-1.5">
             <input
               type="search"
               value={searchText}
               onChange={e => setSearchText(e.target.value)}
               placeholder="search teas"
               aria-label="Search teas"
               className="flex-1 min-w-0 bg-transparent border-b border-tea-border text-tea-text text-sm placeholder:text-tea-text-dim py-1 pr-2 outline-none focus:border-tea-gold transition-colors"
               style={{ fontFamily: 'var(--font-body)' }}
             />
             <span className="shrink-0 text-[10px] uppercase tracking-[0.15em] text-tea-text-dim num">
               {filteredInventory.length} {filteredInventory.length === 1 ? 'tea' : 'teas'}
             </span>
           </div>

           {/* Row 2: actions — saved toggle · sort · weight */}
           <div className="flex items-center gap-4 pb-2 overflow-x-auto hide-scrollbar">
             <button
               type="button"
               onClick={() => setShopSavedOnly(!shopSavedOnly)}
               aria-pressed={shopSavedOnly}
               aria-label="Show only liked teas"
               className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] py-1 shrink-0 transition-colors ${
                 shopSavedOnly ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
               }`}
             >
               <Icons.Heart className="w-3 h-3" filled={shopSavedOnly} aria-hidden="true" />
               <span>Liked</span>
             </button>

             <div className="w-px h-3.5 bg-tea-border shrink-0" />

             <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-tea-text-sec shrink-0">
               <span>Sort</span>
               <select
                 value={shopSort}
                 onChange={e => setShopSort(e.target.value as any)}
                 aria-label="Sort teas by"
                 className="bg-transparent text-tea-text text-[10px] uppercase tracking-[0.15em] outline-none cursor-pointer border-none focus-visible:underline"
                 style={{ fontFamily: 'var(--font-body)' }}
               >
                 <option value="featured">Featured</option>
                 <option value="price_asc">Price ↑</option>
                 <option value="price_desc">Price ↓</option>
                 <option value="recent">Recently viewed</option>
                 <option value="tasted">Most tasted</option>
               </select>
             </label>

             <div className="w-px h-3.5 bg-tea-border shrink-0" />

             <div className="flex items-center gap-1.5 shrink-0 ml-auto">
               <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-sec">Price per</span>
               <div className="flex items-center gap-0.5 border border-tea-border rounded-sm overflow-hidden">
                 {([25, 50, 100] as const).map(g => (
                   <button
                     key={g}
                     onClick={() => setShopPriceWeight(g)}
                     className={`px-2 py-0.5 text-[10px] uppercase tracking-wider transition-colors num ${
                       shopPriceWeight === g
                         ? 'bg-tea-gold/10 text-tea-gold'
                         : 'text-tea-text-sec hover:text-tea-text'
                     }`}
                   >
                     {g}g
                   </button>
                 ))}
               </div>
             </div>
           </div>
         </div>

         {/* Filter bar — two dropdown buttons */}
         <div ref={filterRef} className="mb-3 relative z-drawer">
            <div className="flex items-center justify-between">
               {/* Type button */}
               <button
                  onClick={() => setOpenFilter(prev => prev === 'type' ? null : 'type')}
                  className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] py-1.5 transition-colors ${
                     activeType !== 'All' ? 'text-tea-gold' : openFilter === 'type' ? 'text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
                  }`}
               >
                  <span>{activeType === 'All' ? 'Type' : activeType}</span>
                  <Icons.ChevronDown className={`w-3 h-3 transition-transform ${openFilter === 'type' ? 'rotate-180' : ''}`} />
               </button>

               {/* Feeling button */}
               {availableFeelings.length > 0 && (
               <button
                  onClick={() => setOpenFilter(prev => prev === 'feeling' ? null : 'feeling')}
                  className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] py-1.5 transition-colors ${
                     activeFeeling ? 'text-tea-gold' : openFilter === 'feeling' ? 'text-tea-text' : 'text-tea-text-sec hover:text-tea-text'
                  }`}
               >
                  <span>{activeFeeling ? (FEELING_TERMS.find(f => f.id === activeFeeling)?.label || activeFeeling) : 'Feeling'}</span>
                  <Icons.ChevronDown className={`w-3 h-3 transition-transform ${openFilter === 'feeling' ? 'rotate-180' : ''}`} />
               </button>
               )}
            </div>

            {/* Full-width popover — shared backdrop, content depends on which is open */}
            {openFilter && (
               <>
                  <div className="fixed inset-0 z-overlay" onClick={() => setOpenFilter(null)} />
                  <div className="absolute left-0 right-0 top-full mt-1 z-drawer bg-tea-bg border border-tea-border rounded-lg shadow-xl p-3 animate-[fadeIn_0.15s_ease-out]">
                     {openFilter === 'type' && (
                        <div className="flex flex-wrap gap-1.5">
                           <button
                              onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveType('All'); setOpenFilter(null); }}
                              className={`pill ${activeType === 'All' ? 'pill-active' : ''}`}
                           >
                              All
                           </button>
                           {teaTypes.map(t => (
                              <button
                                 key={t}
                                 onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveType(prev => prev === t ? 'All' : t); setOpenFilter(null); }}
                                 className={`pill ${activeType === t ? 'pill-active' : ''}`}
                              >
                                 {t}
                              </button>
                           ))}
                        </div>
                     )}
                     {openFilter === 'feeling' && (
                        <div className="flex flex-wrap gap-1.5">
                           {activeFeeling && (
                              <button
                                 onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveFeeling(null); setOpenFilter(null); }}
                                 className="pill"
                              >
                                 Clear
                              </button>
                           )}
                           {availableFeelings.map(f => (
                              <button
                                 key={f.id}
                                 onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveFeeling(prev => prev === f.id ? null : f.id); setOpenFilter(null); }}
                                 className={`pill ${activeFeeling === f.id ? 'pill-active' : ''}`}
                              >
                                 {f.label}
                              </button>
                           ))}
                        </div>
                     )}
                  </div>
               </>
            )}

            {/* Active tasting filter chip (from AlcoveCard cross-reference) */}
            {tastingFilter && (() => {
               const Icon = resolveTermIcon(tastingFilter.termId);
               return (
                  <div className="flex items-center gap-2 mt-1">
                     <button
                        onClick={clearTastingFilter}
                        className="tag cursor-pointer hover:opacity-80 transition-opacity"
                     >
                        <Icon size={11} />
                        <span>{resolveTermLabel(tastingFilter.termId)}</span>
                        <X size={11} />
                     </button>
                  </div>
               );
            })()}
         </div>

         {/* Main content area (full width now) */}
         <div className="w-full">

         {filteredInventory.length === 0 ? (
            <div className="text-center py-32">
               <svg
                 className="w-16 h-16 mx-auto mb-6 text-tea-text/15 tea-leaf-float"
                 viewBox="0 0 64 64"
                 fill="none"
                 stroke="currentColor"
                 strokeWidth="1.2"
                 strokeLinecap="round"
                 strokeLinejoin="round"
                 aria-hidden="true"
               >
                 <path d="M32 56 C32 56 12 44 12 28 C12 16 20 8 32 8 C44 8 52 16 52 28 C52 44 32 56 32 56Z" />
                 <path d="M32 8 C32 8 28 20 28 32 C28 44 32 56 32 56" />
                 <path d="M18 22 C24 26 32 28 46 24" />
                 <path d="M16 34 C22 36 30 38 48 32" />
               </svg>
               <p className="font-serif italic text-tea-text-sec mb-2">Nothing matched. Try different filters.</p>
               <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm text-tea-gold hover:text-tea-gold-lt transition-colors underline"
               >
                  Clear all filters
               </button>
            </div>
         ) : null}

         {/* LIST VIEW — tap opens AlcoveCard */}
         {filteredInventory.length > 0 && (
            <div className="flex flex-col px-0 animate-[fadeIn_0.5s_ease-out]">
               {groupedInventory.map((group) => (
                <React.Fragment key={group.type}>

                    {/* Category label */}
                    {activeType === 'All' && specialFilter === 'None' && (() => {
                        const typeColor = TEA_TYPE_COLORS[group.type as keyof typeof TEA_TYPE_COLORS]?.card ?? '#737373';
                        return (
                            <div className="pt-6 first:pt-0 pb-2 px-1">
                                <div className="border-t border-tea-border mb-3 first:border-0" />
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: typeColor }} />
                                    <span className="text-[11px] uppercase tracking-[0.2em] text-tea-text-sec">{group.type}</span>
                                </div>
                            </div>
                        );
                    })()}

                    {group.items.map((item) => {
                        const isTeajiaFav = !!item.isFeatured;
                        const isFavorite = userFavorites.has(item.id);
                        const pricePerGram = parseFloat(item.price_per_gram || '0') || 0;
                        const priceAtWeight = Math.round(pricePerGram * shopPriceWeight * 100) / 100;
                        const showType = activeType !== 'All' || specialFilter !== 'None';

                        // Stock badge logic (tea items only, stock_g is in grams)
                        const stockG = item.stock_g ?? 0;
                        const stockBadge: { label: string; cls: string } | null = item.category === 'tea'
                          ? stockG <= 0
                            ? { label: 'Sold Out', cls: 'bg-tea-surface text-tea-text-dim' }
                            : stockG <= 50
                              ? { label: 'Low Stock', cls: 'bg-tea-elevated text-tea-gold-lt' }
                              : stockG <= 150
                                ? { label: 'Limited', cls: 'bg-tea-elevated text-tea-text-sec' }
                                : null
                          : null;

                        return (
                            <div
                                key={item.id}
                                role="button"
                                tabIndex={0}
                                aria-label={`View ${item.name}`}
                                className="border-b border-tea-border hover:bg-tea-surface/40 transition-colors cursor-pointer focus:outline-none focus-visible:bg-tea-surface/60 focus-visible:ring-1 focus-visible:ring-tea-gold/30"
                                onClick={() => setViewItem(item)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setViewItem(item);
                                  }
                                }}
                            >
                                <div className="flex items-center py-2 lg:py-2.5 px-1 gap-3">
                                    {/* Name + metadata */}
                                    <div className="flex-1 min-w-0">
                                        {/* Featured / Curated badges */}
                                        {(item.isFeatured || item.isCurated) && (
                                          <div className="flex flex-col mb-0.5">
                                            {item.isFeatured && (
                                              <span className="text-xs tracking-widest uppercase text-tea-gold leading-none">Featured</span>
                                            )}
                                            {item.isCurated && (
                                              <span className="text-xs tracking-widest uppercase text-tea-text-sec leading-none">Curated</span>
                                            )}
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-serif text-[15px] leading-snug text-tea-text font-medium truncate">
                                                {item.name}
                                            </h3>
                                            {isTeajiaFav && <Icons.Seal className="w-2.5 h-2.5 text-tea-gold shrink-0" />}
                                            {(tastingCounts.get(item.id) || 0) > 0 && (
                                                <span className="inline-flex items-center gap-0.5 shrink-0 text-tea-green" title={`Tasted ${tastingCounts.get(item.id)} time${tastingCounts.get(item.id)! > 1 ? 's' : ''}`}>
                                                    <Leaf className="w-2.5 h-2.5" />
                                                    {tastingCounts.get(item.id)! > 1 && (
                                                        <span className="text-[9px] font-medium leading-none">{tastingCounts.get(item.id)}</span>
                                                    )}
                                                </span>
                                            )}
                                            {/* Stock badge */}
                                            {stockBadge && (
                                                <span className={`shrink-0 text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${stockBadge.cls}`}>
                                                    {stockBadge.label}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-0.5 truncate flex items-center gap-1.5">
                                             {showType && (
                                                 <><span className="text-[10px] uppercase tracking-wider text-tea-text-sec">{item.type}</span>
                                                 <span className="text-tea-text/15">·</span></>
                                             )}
                                             {item.origin && (
                                                 <span className="text-[11px] text-tea-text-sec">{item.origin}</span>
                                             )}
                                             {item.year && (
                                                 <><span className="text-tea-text/15">·</span>
                                                 <span className="text-[11px] text-tea-text-dim">{item.year}</span></>
                                             )}
                                        </div>
                                    </div>

                                    {/* Right: actions · divider · price */}
                                    <div className="flex items-center shrink-0">
                                        <div className="flex items-center gap-1">
                                            {/* Admin: edit button */}
                                            {isAdmin && onAdminEdit && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); onAdminEdit(item.id); }}
                                                    aria-label={`Edit ${item.name}`}
                                                    className="p-1 text-tea-text-sec hover:text-tea-text transition-colors"
                                                >
                                                    <Icons.Edit className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            )}
                                            {/* Like toggle */}
                                            <button
                                                type="button"
                                                onClick={(e) => handleFavoriteToggle(item.id, e)}
                                                aria-pressed={isFavorite}
                                                aria-label={isFavorite ? `Unlike ${item.name}` : `Like ${item.name}`}
                                                className={`p-1 transition-colors ${isFavorite ? 'text-tea-text hover:text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}
                                            >
                                                <Icons.Heart className="w-4 h-4" filled={isFavorite} aria-hidden="true" />
                                            </button>
                                        </div>
                                        {/* Divider between actions and price */}
                                        <div className="w-px h-5 bg-tea-border ml-2.5 mr-3" />
                                        <div className="text-right num text-sm text-tea-gold font-medium tabular-nums min-w-[44px]">
                                            {fmtShopPrice(priceAtWeight)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </React.Fragment>
             ))}
            </div>
         )}
      </div>
      </div>

      {/* Recently Viewed */}
      {recentlyViewedItems.length > 0 && filteredInventory.length > 0 && (
        <div className="mt-10 px-3 md:px-4 lg:px-6">
          <p className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-3">Recently Viewed</p>
          <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
            {recentlyViewedItems.map(item => (
              <button
                key={item.id}
                onClick={() => setViewItem(item)}
                className="flex flex-col items-center shrink-0 group"
                style={{ width: '72px' }}
              >
                <div className="w-14 h-14 rounded-sm overflow-hidden bg-tea-elevated mb-1.5 group-hover:ring-1 group-hover:ring-tea-gold/30 transition-all">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <TeaPlaceholder type={item.type} style={{ width: '100%', height: '100%' }} />
                  )}
                </div>
                <span className="text-[10px] text-tea-text-sec text-center leading-tight line-clamp-2 group-hover:text-tea-text transition-colors">
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Floating Compare Button */}
      {compareItems.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-sticky animate-[fadeIn_0.3s_ease-out]">
          <button
            onClick={() => setShowCompare(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-tea-gold text-tea-bg text-xs uppercase tracking-[0.1em] font-medium rounded-sm shadow-lg hover:bg-tea-gold-lt transition-all active:scale-95"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="18" rx="1" />
              <rect x="14" y="3" width="7" height="18" rx="1" />
            </svg>
            <span>Compare ({compareItems.length})</span>
          </button>
        </div>
      )}

      {/* Compare Overlay */}
      {showCompare && (
        <CompareView
          items={inventory.filter((item) => compareItems.includes(item.id))}
          onClose={() => setShowCompare(false)}
        />
      )}

    </div>
  );
};
