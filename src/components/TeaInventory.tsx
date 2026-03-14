
import React, { useState, useMemo, useCallback } from 'react';
import { Icons } from './Icons';
import { X } from 'lucide-react';
import { AlcoveModal } from './shop/AlcoveModal';
import { resolveTermLabel, resolveTermIcon, TASTING_TAXONOMY, type TastingCategoryId } from '../data/tastingTaxonomy';
import { CardImage } from './shared/CardImage';
import { TeaPlaceholder } from './shop/TeaPlaceholder';
import { CardGridItem } from './shared/CardGridItem';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { PageHeaderActions } from './shared/PageHeaderActions';
import { fmtPrice } from '../utils/formatNumber';
import { ShopGridLayout } from './shared/ShopGridLayout';
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
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('LIST');

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
  const { favoriteTeas, toggleFavoriteTea, compareItems } = useAppStore();
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
  const [viewItem, setViewItem] = useState<TeaItem | null>(null);

  // Tasting Session State
  const [tastingItem, setTastingItem] = useState<TeaItem | null>(null);
  const handleTaste = useCallback((item: TeaItem) => {
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

      {!hideHeader ? (
        <PageHeader
          title="Tea Ledger"
          onCartClick={onCartClick}
          onAccountClick={onAccountClick}
          cartItemCount={cartItemCount}
          rightContent={
            <PageHeaderActions
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onReset={clearFilters}
              showReset={(activeType !== 'All' || !!activeFeeling || specialFilter !== 'None' || !!tastingFilter)}
              activeType={activeType}
              activeFeeling={activeFeeling}
            />
          }
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
      ) : (
        /* Compact toolbar when embedded as a tab (hideHeader) */
        <div className="flex items-center justify-between px-3 md:px-4 lg:px-6 py-2">
          <PageHeaderActions
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onReset={clearFilters}
            showReset={(activeType !== 'All' || !!activeFeeling || specialFilter !== 'None' || !!tastingFilter)}
            activeType={activeType}
            activeFeeling={activeFeeling}
          />
        </div>
      )}

      {/* --- Inline Filter Bar + Content (full width) --- */}
      <div className="max-w-full mx-auto px-3 md:px-4 lg:px-6 pt-4">

         {/* Active tasting filter indicator */}
         {tastingFilter && (() => {
           const Icon = resolveTermIcon(tastingFilter.termId);
           return (
             <div className="mb-3 flex items-center gap-2">
               <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim">Showing teas with</span>
               <span className="inline-flex items-center gap-1.5 text-sm text-tea-gold italic">
                 <Icon size={12} />
                 {resolveTermLabel(tastingFilter.termId)}
               </span>
               <button
                 onClick={clearTastingFilter}
                 className="ml-1 p-0.5 text-tea-text-dim hover:text-tea-text transition-colors"
                 aria-label="Clear filter"
               >
                 <X size={12} />
               </button>
             </div>
           );
         })()}

         {/* Inline filter chips */}
         <div className="mb-4 space-y-3">
            {/* Type chips — horizontally scrollable */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
               <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim shrink-0 mr-1">Type</span>
               <button
                  onClick={() => setActiveType('All')}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wider transition-all ${
                     activeType === 'All'
                        ? 'bg-tea-elevated text-tea-text font-medium border border-tea-border'
                        : 'text-tea-text/50 border border-tea-border hover:text-tea-text hover:border-tea-gold/30'
                  }`}
               >
                  All
               </button>
               {teaTypes.map(t => (
                  <button
                     key={t}
                     onClick={() => setActiveType(prev => prev === t ? 'All' : t)}
                     className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] uppercase tracking-wider transition-all ${
                        activeType === t
                           ? 'bg-tea-gold text-tea-bg font-medium border border-tea-gold'
                           : 'text-tea-text/50 border border-tea-border hover:text-tea-text hover:border-tea-gold/30'
                     }`}
                  >
                     {t}
                  </button>
               ))}
            </div>

            {/* Feeling chips — horizontally scrollable, derived from taxonomy + inventory */}
            {availableFeelings.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
               <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim shrink-0 mr-1">Mood</span>
               {availableFeelings.map(f => (
                  <button
                     key={f.id}
                     onClick={() => setActiveFeeling(prev => prev === f.id ? null : f.id)}
                     className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] tracking-wider transition-all ${
                        activeFeeling === f.id
                           ? 'bg-tea-gold text-tea-bg font-medium border border-tea-gold'
                           : 'text-tea-text/50 border border-tea-border hover:text-tea-text hover:border-tea-gold/30'
                     }`}
                  >
                     {f.label}
                  </button>
               ))}
            </div>
            )}

            {/* Active filters summary + count */}
            <div className="flex items-center justify-between">
               <p className="text-xs uppercase tracking-[0.15em] text-tea-text/50">
                  {filteredInventory.length} {filteredInventory.length === 1 ? 'tea' : 'teas'}
               </p>
               {(activeType !== 'All' || !!activeFeeling || specialFilter !== 'None') && (
                  <button
                     onClick={clearFilters}
                     className="text-[11px] text-tea-gold hover:text-tea-gold/80 transition-colors uppercase tracking-wider flex items-center gap-1.5"
                  >
                     <Icons.Close className="w-3 h-3" />
                     Clear filters
                  </button>
               )}
            </div>
         </div>

         {/* Main content area (full width now) */}
         <div className="w-full">

         {filteredInventory.length === 0 ? (
            <div className="text-center py-32">
               <Icons.Leaf className="w-12 h-12 mx-auto mb-4 text-tea-text/20" />
               <p className="font-serif italic text-tea-text/60 mb-2">No teas match your filters</p>
               <button
                  onClick={clearFilters}
                  className="text-sm text-tea-gold hover:text-tea-gold/80 transition-colors underline"
               >
                  Clear all filters
               </button>
            </div>
         ) : null}

         {/* GRID VIEW - Optimized for tablets */}
         {viewMode === 'GRID' && filteredInventory.length > 0 && (
            <ShopGridLayout className="xl:grid-cols-5">
               {filteredInventory.map(item => {
                  const gridPpg = parseFloat(item.price_per_gram || '0') || 0;
                  const gridPrice25 = Math.round(gridPpg * 25 * 100) / 100;
                  const isAdded = addedItems[item.id];
                  return (
                     <CardGridItem
                        key={item.id}
                        item={item}
                        title={item.name}
                        onCardClick={(item, e) => { e.stopPropagation(); setViewItem(item); }}
                        imageComponent={<CardImage src={item.image} alt={item.name} aspect="square" className="card-grid-image" teaType={item.type} />}
                        badgesComponent={
                           <div className="flex items-center gap-1.5">
                              <span className="card-grid-badge">{item.type}</span>
                              {item.origin && (
                                 <span className="text-[10px] text-tea-text-sec italic">{item.origin}</span>
                              )}
                           </div>
                        }
                        priceDisplay={
                           <span className="card-grid-price">
                              <span className="num">{fmtPrice(gridPrice25)}</span>
                              <span className="text-tea-text-sec text-[10px] ml-1">/ 25g</span>
                           </span>
                        }
                        sliderComponent={
                           <button
                              onClick={() => handleAddWithFeedback(item, 25, gridPrice25)}
                              className={`w-full text-[11px] uppercase tracking-[0.12em] font-medium py-2 rounded-sm transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[44px] ${
                                 isAdded
                                    ? 'bg-tea-green text-tea-bg'
                                    : 'bg-tea-gold hover:bg-tea-gold-lt text-tea-bg'
                              }`}
                           >
                              {isAdded ? (
                                 <span>Added ✓</span>
                              ) : (
                                 <>
                                    <span>Add 25g</span>
                                    <span className="w-px h-3 bg-tea-bg/20" />
                                    <span className="num">{fmtPrice(gridPrice25)}</span>
                                 </>
                              )}
                           </button>
                        }
                     />
                  );
               })}
            </ShopGridLayout>
         )}

         {/* LIST VIEW — thumbnail rows, tap opens AlcoveCard */}
         {viewMode === 'LIST' && filteredInventory.length > 0 && (
            <div className="flex flex-col px-0 animate-[fadeIn_0.5s_ease-out]">
               {groupedInventory.map((group) => (
                <React.Fragment key={group.type}>

                    {/* Category label */}
                    {activeType === 'All' && specialFilter === 'None' && (
                        <div className="pt-8 pb-2 first:pt-4 pl-2 border-b border-tea-border">
                            <span className="font-sans text-[10px] uppercase tracking-[2px] text-tea-text-sec">{group.type}</span>
                        </div>
                    )}

                    {group.items.map((item) => {
                        const isTeajiaFav = !!item.isFeatured;
                        const isFavorite = userFavorites.has(item.id);
                        const pricePerGram = parseFloat(item.price_per_gram || '0') || 0;
                        const price25g = Math.round(pricePerGram * 25 * 100) / 100;

                        return (
                            <div
                                key={item.id}
                                className="border-b border-tea-border hover:bg-tea-accent-sub/50 transition-colors cursor-pointer"
                                onClick={() => setViewItem(item)}
                            >
                                <div className="flex items-center py-3 lg:py-4 px-2 gap-3">
                                    {/* Thumbnail */}
                                    <div className="w-12 h-12 rounded-sm overflow-hidden shrink-0 bg-tea-elevated">
                                        {item.image ? (
                                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                                        ) : (
                                            <TeaPlaceholder type={item.type} style={{ width: '100%', height: '100%' }} />
                                        )}
                                    </div>

                                    {/* Name + metadata */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-serif text-lg leading-none text-tea-text truncate">
                                                {item.name}
                                            </h3>
                                            {isTeajiaFav && <Icons.Seal className="w-3 h-3 text-tea-gold shrink-0 opacity-80" />}
                                        </div>
                                        <div className="text-[13px] mt-1 truncate flex items-center gap-2">
                                             <span className="text-[10px] uppercase tracking-wider text-tea-text-sec">{item.type}</span>
                                             {item.origin && (
                                                 <><span className="text-tea-text/20">·</span>
                                                 <span className="font-body italic text-tea-text/40">{item.origin}</span></>
                                             )}
                                             {item.year && (
                                                 <><span className="text-tea-text/20">·</span>
                                                 <span className="font-mono num text-[11px] text-tea-gold/60">{item.year}</span></>
                                             )}
                                        </div>
                                    </div>

                                    {/* Right: heart + price + admin controls + chevron */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Favorite/heart toggle */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleFavoriteTea(item.id); }}
                                            className={`-my-1 p-1.5 transition-colors ${isFavorite ? 'text-tea-gold' : 'text-tea-text/20 hover:text-tea-text/50'}`}
                                            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                                        >
                                            <Icons.Heart filled={isFavorite} className="w-4 h-4" />
                                        </button>
                                        {/* Admin: stock indicator */}
                                        {isAdmin && adminProductMap?.has(item.id) && (() => {
                                            const ap = adminProductMap.get(item.id)!;
                                            const stockColor = ap.stockGrams < 50 ? 'bg-red-400' : ap.stockGrams < (ap.lowStockThreshold || 100) ? 'bg-amber-400' : 'bg-emerald-400';
                                            return (
                                                <span className="hidden md:flex items-center gap-1.5" title={`${ap.stockGrams}g in stock`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${stockColor}`} />
                                                    <span className="text-[10px] num text-tea-text/40">{ap.stockGrams}g</span>
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
                                        <div className="text-right">
                                            <span className="num text-sm text-tea-gold">{fmtPrice(price25g)}</span>
                                            <span className="text-[10px] text-tea-text-sec ml-1">/ 25g</span>
                                        </div>
                                        <Icons.Next className="w-4 h-4 text-tea-text/20 shrink-0" />
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
