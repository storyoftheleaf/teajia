
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Icons } from './Icons';
import { X, SlidersHorizontal } from 'lucide-react';
import { AlcoveModal } from './shop/AlcoveModal';
import { resolveTermLabel, resolveTermIcon, TASTING_TAXONOMY, type TastingCategoryId } from '../data/tastingTaxonomy';
import { TeaPlaceholder } from './shop/TeaPlaceholder';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { fmtPrice } from '../utils/formatNumber';
import { TEA_TYPE_COLORS } from '../designTokens';
import { InventoryItem } from '../types';
import { SALE_ITEM_IDS } from '../data/curatedCollections';
import { useAppStore } from '../lib/store';
import { useProductUrl } from '../hooks/useProductUrl';
import { CompareView } from './shop/CompareView';
import { TastingSession } from './tasting/TastingSession';
import { AnimatePresence } from 'framer-motion';
import type { Product } from '../admin/types';

// Use shared type alias for backward compatibility in this component if needed,
// or directly use InventoryItem
export type TeaItem = InventoryItem;

interface TeaInventoryProps {
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
const TYPE_ORDER = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Black', 'Dark', 'Sheng', 'Shou', 'Herbal', 'Matcha', 'Flower'];

// Extract feeling terms from the canonical tasting taxonomy
const FEELING_TERMS = (() => {
  const cat = TASTING_TAXONOMY.categories.find(c => c.id === 'feeling');
  if (!cat) return [];
  return cat.groups.flatMap(g => g.terms.map(t => ({ id: t.id, label: t.label })));
})();

// Sale items imported from data/curatedCollections

export const TeaInventory: React.FC<TeaInventoryProps> = ({ inventory, onAddToCart, onCartClick, onAccountClick, cartItemCount = 0, hideHeader = false, isAdmin = false, adminProductMap, onAdminEdit }) => {
  // Filter State
  const [activeType, setActiveType] = useState<string>('All');
  const [activeFeeling, setActiveFeeling] = useState<string | null>(null); // feeling term ID from taxonomy
  const [specialFilter, setSpecialFilter] = useState<'None' | 'Curated' | 'Sale' | 'Liked'>('None');
  const [showFilters, setShowFilters] = useState(false);

  // Derive tea types from actual inventory (ordered by TYPE_ORDER, then alphabetically)
  const teaTypes = useMemo(() => {
    const types = new Set(inventory.map(item => item.type));
    const ordered = TYPE_ORDER.filter(t => types.has(t));
    const remaining = [...types].filter(t => !TYPE_ORDER.includes(t)).sort();
    return [...ordered, ...remaining];
  }, [inventory]);

  // Derive which feeling terms are actually present in the inventory
  const availableFeelings = useMemo(() => {
    const present = new Set<string>();
    for (const item of inventory) {
      if (item.tasting?.feeling) {
        for (const f of item.tasting.feeling) present.add(f);
      }
    }
    return FEELING_TERMS.filter(t => present.has(t.id));
  }, [inventory]);

  // User Interaction State — persisted via Zustand store
  const { favoriteTeas, toggleFavoriteTea, compareItems, recentlyViewed, addRecentlyViewed } = useAppStore();
  const userFavorites = useMemo(() => new Set(favoriteTeas), [favoriteTeas]);
  const [showCompare, setShowCompare] = useState(false);

  // Tasting term filter (cross-reference from AlcoveCard)
  const [tastingFilter, setTastingFilter] = useState<{ termId: string; categoryId: string } | null>(null);

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

  // Filter area ref for FAB scroll-to-filters
  const filterRef = useRef<HTMLDivElement>(null);
  const [showFilterFab, setShowFilterFab] = useState(false);

  // IntersectionObserver to detect when filters scroll out of view
  useEffect(() => {
    const el = filterRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowFilterFab(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Recently viewed items resolved from inventory
  const recentlyViewedItems = useMemo(() => {
    return recentlyViewed
      .map(id => inventory.find(item => item.id === id))
      .filter(Boolean) as TeaItem[];
  }, [recentlyViewed, inventory]);

  // Tasting Session State
  const [tastingItem, setTastingItem] = useState<TeaItem | null>(null);
  const handleTaste = useCallback((item: TeaItem) => {
    // Clean up ?product= URL param so useProductUrl doesn't re-open the modal
    const url = new URL(window.location.href);
    if (url.searchParams.has('product')) {
      url.searchParams.delete('product');
      window.history.replaceState(null, '', url.toString());
    }
    setViewItem(null); // close AlcoveModal
    setTastingItem(item);
  }, []);
  const handleOrderFromTasting = useCallback((item: TeaItem) => {
    setTastingItem(null);
    setViewItem(item); // open AlcoveModal for ordering
  }, []);

  // Sync modal state with URL (?product=ID) for shareability and back-button support
  const { closeWithHistory, navigateWithinModal } = useProductUrl(inventory, viewItem, setViewItem);


  // Filter Logic
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // 1. Basic Filter (Type/Feeling)
      const matchType = activeType === 'All' || item.type === activeType;
      const matchFeeling = !activeFeeling || (item.tasting?.feeling?.includes(activeFeeling) ?? false);
      
      // 2. Special Filter (Curated/Sale/Liked)
      let matchSpecial = true;
      if (specialFilter === 'Curated') matchSpecial = !!item.isFeatured;
      if (specialFilter === 'Sale') matchSpecial = SALE_ITEM_IDS.includes(item.id);
      if (specialFilter === 'Liked') matchSpecial = userFavorites.has(item.id);

      // 3. Tasting term filter (cross-reference)
      let matchTasting = true;
      if (tastingFilter) {
        if (tastingFilter.categoryId === 'mood') {
          // Mood filter: match against comma-separated mood field
          const itemMoods = (item.mood || '').split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
          matchTasting = itemMoods.includes(tastingFilter.termId);
        } else {
          const catKey = tastingFilter.categoryId as TastingCategoryId;
          const tasting = item.tasting;
          if (tasting && tasting[catKey]) {
            matchTasting = tasting[catKey]!.includes(tastingFilter.termId);
          } else {
            // Fallback: check legacy tags
            matchTasting = item.tags.some(t => t.toLowerCase() === resolveTermLabel(tastingFilter.termId).toLowerCase());
          }
        }
      }

      return matchType && matchFeeling && matchSpecial && matchTasting;
    });
  }, [inventory, activeType, activeFeeling, specialFilter, userFavorites, tastingFilter]);

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
            // Sort: featured first, then by price per gram (Low to High)
            items: groups[type].sort((a, b) => {
                const aFeat = a.isFeatured ? 1 : 0;
                const bFeat = b.isFeatured ? 1 : 0;
                if (aFeat !== bFeat) return bFeat - aFeat;
                const priceA = parseFloat(a.price_per_gram || a.price_50g || '0');
                const priceB = parseFloat(b.price_per_gram || b.price_50g || '0');
                return priceA - priceB;
            })
        }));
  }, [filteredInventory, activeType, teaTypes]);

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
              { id: 'Liked', label: 'My Likes' }
            ]}
            activeTab={specialFilter}
            onChange={(id) => setSpecialFilter(prev => prev === id ? 'None' : id as any)}
          />
        </PageHeader>
      )}

      {/* --- Inline Filter Bar + Content (full width) --- */}
      <div className="max-w-full mx-auto px-1 md:px-2 lg:px-4 pt-4">

         {/* Filter bar */}
         <div ref={filterRef} className="mb-3 relative">
            {/* Filter button + active chips — always one line */}
            <div className="flex items-center gap-2 flex-wrap">
               <span className="text-[9px] uppercase tracking-[0.15em] text-tea-text-dim ml-auto order-last">per 50g</span>
               <button
                  onClick={() => setShowFilters(prev => !prev)}
                  className={`flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] py-1 transition-colors ${
                     showFilters ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
                  }`}
               >
                  <SlidersHorizontal size={13} />
                  <span>Filter</span>
                  {(activeType !== 'All' || !!activeFeeling || !!tastingFilter) && (
                     <span className="w-4 h-4 rounded-full bg-tea-gold/20 text-tea-gold text-[9px] flex items-center justify-center font-medium">
                        {(activeType !== 'All' ? 1 : 0) + (activeFeeling ? 1 : 0) + (tastingFilter ? 1 : 0)}
                     </span>
                  )}
               </button>

               {/* Active filter chips (removable) */}
               {activeType !== 'All' && (
                  <button
                     onClick={() => setActiveType('All')}
                     className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-tea-gold/10 text-tea-gold text-[10px] tracking-wider hover:bg-tea-gold/20 transition-colors"
                  >
                     <span>{activeType}</span>
                     <X size={10} />
                  </button>
               )}
               {activeFeeling && (
                  <button
                     onClick={() => setActiveFeeling(null)}
                     className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-tea-gold/10 text-tea-gold text-[10px] tracking-wider hover:bg-tea-gold/20 transition-colors"
                  >
                     <span>{FEELING_TERMS.find(f => f.id === activeFeeling)?.label || activeFeeling}</span>
                     <X size={10} />
                  </button>
               )}
               {tastingFilter && (() => {
                  const Icon = resolveTermIcon(tastingFilter.termId);
                  return (
                     <button
                        onClick={clearTastingFilter}
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-tea-gold/10 text-tea-gold text-[10px] tracking-wider hover:bg-tea-gold/20 transition-colors"
                     >
                        <Icon size={10} />
                        <span>{resolveTermLabel(tastingFilter.termId)}</span>
                        <X size={10} />
                     </button>
                  );
               })()}
               {(activeType !== 'All' || !!activeFeeling || !!tastingFilter) && (
                  <button
                     onClick={clearFilters}
                     className="text-[10px] text-tea-text-dim hover:text-tea-text transition-colors ml-1"
                  >
                     Clear all
                  </button>
               )}
            </div>

            {/* Popover filter panel — floats over content */}
            {showFilters && (
               <>
                  {/* Backdrop to close */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
                  <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-tea-bg border border-tea-border rounded-lg shadow-xl p-4 space-y-4 animate-[fadeIn_0.15s_ease-out]">
                     {/* Type */}
                     <div>
                        <span className="text-[9px] uppercase tracking-[0.2em] text-tea-text-dim block mb-2">Type</span>
                        <div className="flex flex-wrap gap-1.5">
                           <button
                              onClick={() => setActiveType('All')}
                              className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider transition-all ${
                                 activeType === 'All'
                                    ? 'bg-tea-elevated text-tea-text font-medium'
                                    : 'text-tea-text/40 hover:text-tea-text/70'
                              }`}
                           >
                              All
                           </button>
                           {teaTypes.map(t => (
                              <button
                                 key={t}
                                 onClick={() => setActiveType(prev => prev === t ? 'All' : t)}
                                 className={`px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider transition-all ${
                                    activeType === t
                                       ? 'bg-tea-gold/15 text-tea-gold font-medium'
                                       : 'text-tea-text/40 hover:text-tea-text/70'
                                 }`}
                              >
                                 {t}
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* Feeling */}
                     {availableFeelings.length > 0 && (
                     <div>
                        <span className="text-[9px] uppercase tracking-[0.2em] text-tea-text-dim block mb-2">Feeling</span>
                        <div className="flex flex-wrap gap-1.5">
                           {availableFeelings.map(f => (
                              <button
                                 key={f.id}
                                 onClick={() => setActiveFeeling(prev => prev === f.id ? null : f.id)}
                                 className={`px-2.5 py-1 rounded-full text-[10px] tracking-wider transition-all ${
                                    activeFeeling === f.id
                                       ? 'bg-tea-gold/15 text-tea-gold font-medium'
                                       : 'text-tea-text/40 hover:text-tea-text/70'
                                 }`}
                              >
                                 {f.label}
                              </button>
                           ))}
                        </div>
                     </div>
                     )}
                  </div>
               </>
            )}
         </div>

         {/* Main content area (full width now) */}
         <div className="w-full">

         {filteredInventory.length === 0 ? (
            <div className="text-center py-32">
               <svg
                 className="w-16 h-16 mx-auto mb-6 text-tea-text/15"
                 viewBox="0 0 64 64"
                 fill="none"
                 stroke="currentColor"
                 strokeWidth="1.2"
                 strokeLinecap="round"
                 strokeLinejoin="round"
                 style={{ animation: 'teaLeafFloat 3s ease-in-out infinite' }}
               >
                 <path d="M32 56 C32 56 12 44 12 28 C12 16 20 8 32 8 C44 8 52 16 52 28 C52 44 32 56 32 56Z" />
                 <path d="M32 8 C32 8 28 20 28 32 C28 44 32 56 32 56" />
                 <path d="M18 22 C24 26 32 28 46 24" />
                 <path d="M16 34 C22 36 30 38 48 32" />
               </svg>
               <p className="font-serif italic text-tea-text/60 mb-2">No teas match your filters</p>
               <button
                  onClick={clearFilters}
                  className="text-sm text-tea-gold hover:text-tea-gold/80 transition-colors underline"
               >
                  Clear all filters
               </button>
               <style>{`
                 @keyframes teaLeafFloat {
                   0%, 100% { transform: translateY(0px); }
                   50% { transform: translateY(-8px); }
                 }
                 @media (prefers-reduced-motion: reduce) {
                   .teaLeafFloat { animation: none !important; }
                 }
               `}</style>
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
                        const price50g = Math.round(pricePerGram * 50 * 100) / 100;
                        const showType = activeType !== 'All' || specialFilter !== 'None';

                        return (
                            <div
                                key={item.id}
                                className="border-b border-tea-border hover:bg-tea-surface/40 transition-colors cursor-pointer"
                                onClick={() => setViewItem(item)}
                            >
                                <div className="flex items-center py-2 lg:py-2.5 px-1 gap-3">
                                    {/* Name + metadata */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-serif text-[15px] leading-snug text-tea-text font-medium truncate">
                                                {item.name}
                                            </h3>
                                            {isTeajiaFav && <Icons.Seal className="w-2.5 h-2.5 text-tea-gold shrink-0" />}
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

                                    {/* Right: bookmark + price + admin controls */}
                                    <div className="flex items-center gap-2.5 shrink-0">
                                        {/* Save/bookmark toggle */}
                                        <button
                                            onClick={(e) => handleFavoriteToggle(item.id, e)}
                                            className={`-my-1 p-1 transition-colors ${isFavorite ? 'text-tea-gold' : 'text-tea-text/15 hover:text-tea-text/40'}`}
                                            title={isFavorite ? 'Remove from saved' : 'Save'}
                                        >
                                            <Icons.Bookmark className="w-3.5 h-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
                                        </button>
                                        {/* Admin: stock indicator */}
                                        {isAdmin && adminProductMap?.has(item.id) && (() => {
                                            const ap = adminProductMap.get(item.id)!;
                                            const stockColor = ap.stockGrams < 50 ? 'bg-red-400' : ap.stockGrams < (ap.lowStockThreshold || 100) ? 'bg-amber-400' : 'bg-emerald-400';
                                            return (
                                                <span className="hidden md:flex items-center gap-1.5" title={`${Math.round(ap.stockGrams)}g in stock`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${stockColor}`} />
                                                    <span className="text-[10px] num text-tea-text/40">{Math.round(ap.stockGrams)}g</span>
                                                </span>
                                            );
                                        })()}
                                        {/* Admin: edit button */}
                                        {isAdmin && onAdminEdit && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onAdminEdit(item.id); }}
                                                className="p-1 text-tea-text/20 hover:text-tea-gold transition-colors"
                                                title="Edit product"
                                            >
                                                <Icons.Edit className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <span className="num text-sm text-tea-gold font-medium">{fmtPrice(price50g)}</span>
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
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
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

      {/* Floating Filter FAB (mobile only) */}
      <button
        onClick={() => filterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
        className={`fixed bottom-24 right-4 z-30 w-12 h-12 rounded-full bg-tea-gold text-tea-bg flex items-center justify-center shadow-lg lg:hidden transition-all duration-300 ${
          showFilterFab ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
        }`}
        aria-label="Scroll to filters"
        style={{ transitionProperty: 'opacity, transform' }}
      >
        <SlidersHorizontal size={20} />
      </button>

      {/* Floating Compare Button */}
      {compareItems.length > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 animate-[fadeIn_0.3s_ease-out]">
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
