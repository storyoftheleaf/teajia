
import React, { useState, useMemo } from 'react';
import { Icons } from './Icons';
import { AlcoveModal } from './shop/AlcoveModal';
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

const TEA_TYPES = ['Green', 'White', 'Yellow', 'Oolong', 'Black', 'Dark', 'Herbal'];
const FEELINGS_LIST = ['Ancient', 'Balanced', 'Energetic', 'Grounding', 'Meditative', 'Romantic', 'Soft', 'Strong', 'Vibrant', 'Wild'];

// Sale items imported from data/curatedCollections

export const TeaInventory: React.FC<TeaInventoryProps> = ({ inventory, onAddToCart, onCartClick, onAccountClick, cartItemCount = 0, hideHeader = false, isAdmin = false, adminProductMap, onAdminEdit }) => {
  // Filter State
  const [activeType, setActiveType] = useState<string>('All');
  const [activeFeeling, setActiveFeeling] = useState<string>('All');
  const [specialFilter, setSpecialFilter] = useState<'None' | 'Curated' | 'Sale' | 'Liked'>('None');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('LIST');

  // User Interaction State — persisted via Zustand store
  const { favoriteTeas, toggleFavoriteTea, compareItems } = useAppStore();
  const userFavorites = useMemo(() => new Set(favoriteTeas), [favoriteTeas]);
  const [showCompare, setShowCompare] = useState(false);

  // Image Modal State
  const [viewItem, setViewItem] = useState<TeaItem | null>(null);

  // Sync modal state with URL (?product=ID) for shareability and back-button support
  const { closeWithHistory } = useProductUrl(inventory, viewItem, setViewItem);


  // Filter Logic
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      // 1. Basic Filter (Type/Feeling)
      const matchType = activeType === 'All' || item.type === activeType;
      const matchFeeling = activeFeeling === 'All' || item.tags.includes(activeFeeling);
      
      // 2. Special Filter (Curated/Sale/Liked)
      let matchSpecial = true;
      if (specialFilter === 'Curated') matchSpecial = !!item.isFeatured;
      if (specialFilter === 'Sale') matchSpecial = SALE_ITEM_IDS.includes(item.id);
      if (specialFilter === 'Liked') matchSpecial = userFavorites.has(item.id);

      return matchType && matchFeeling && matchSpecial;
    });
  }, [inventory, activeType, activeFeeling, specialFilter, userFavorites]);

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
    const typesToShow = activeType === 'All' ? TEA_TYPES : [activeType];

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
  }, [filteredInventory, activeType]);

  // Add-to-cart confirmation feedback
  const [addedItems, setAddedItems] = useState<Record<string, boolean>>({});
  const handleAddWithFeedback = (item: TeaItem, qty: number, total: number) => {
    if (onAddToCart) onAddToCart(item, qty, total);
    setAddedItems(prev => ({ ...prev, [item.id]: true }));
    setTimeout(() => setAddedItems(prev => ({ ...prev, [item.id]: false })), 1500);
  };

  const clearFilters = () => {
    setActiveType('All');
    setActiveFeeling('All');
    setSpecialFilter('None');
  };

  return (
    <div className="w-full pb-32 animate-[fadeIn_0.5s_ease-out]">

      {/* --- Alcove Detail Modal --- */}
      <AlcoveModal
        item={viewItem}
        items={filteredInventory}
        onClose={closeWithHistory}
        onItemChange={(item) => setViewItem(item)}
        onAddToCart={(item, quantity, total) => {
          if (onAddToCart) onAddToCart(item, quantity, total);
          closeWithHistory();
        }}
      />

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
              onFilter={() => setIsFilterOpen(true)}
              onReset={clearFilters}
              showReset={(activeType !== 'All' || activeFeeling !== 'All' || specialFilter !== 'None')}
              showFilter={true}
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
        <div className="flex items-center justify-between px-3 md:px-4 lg:px-6 py-2 lg:hidden">
          <PageHeaderActions
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onFilter={() => setIsFilterOpen(true)}
            onReset={clearFilters}
            showReset={(activeType !== 'All' || activeFeeling !== 'All' || specialFilter !== 'None')}
            showFilter={true}
            activeType={activeType}
            activeFeeling={activeFeeling}
          />
        </div>
      )}

      {/* --- Filter Modal --- */}
      {isFilterOpen && (
          <div className="fixed inset-0 z-modal flex items-end md:items-center justify-center p-0 md:p-4">
              <div className="absolute inset-0 bg-tea-text/90 backdrop-blur-sm transition-opacity" onClick={() => setIsFilterOpen(false)}></div>
              <div className="relative w-full md:max-w-xl bg-tea-bg rounded-t-xl md:rounded-sm overflow-hidden flex flex-col max-h-[85vh] animate-[slideUp_0.3s_ease-out]">
                  <div className="px-6 py-3 border-b border-tea-gold/[0.08] flex justify-between items-center bg-tea-surface">
                      <span className="text-xs uppercase tracking-[0.2em] text-tea-text font-semibold">Refine Collection</span>
                      <button onClick={() => setIsFilterOpen(false)}><Icons.Close className="w-4 h-4 text-tea-text/60" /></button>
                  </div>
                  <div className="p-6 overflow-y-auto text-tea-text flex-1">
                      <div className="mb-6">
                          <h3 className="font-serif italic text-sm text-tea-text/50 mb-2">Type</h3>
                          <div className="flex flex-wrap gap-2">
                              <button onClick={() => setActiveType('All')} className={`px-3 py-1 border rounded-sm text-xs uppercase tracking-wider ${activeType === 'All' ? 'bg-tea-bg text-tea-text' : 'border-tea-gold/[0.08]'}`}>All</button>
                              {TEA_TYPES.map(t => (
                                  <button key={t} onClick={() => setActiveType(t)} className={`px-3 py-1 border rounded-sm text-xs uppercase tracking-wider ${activeType === t ? 'bg-tea-bg text-tea-text' : 'border-tea-gold/[0.08]'}`}>{t}</button>
                              ))}
                          </div>
                      </div>
                      <div>
                          <h3 className="font-serif italic text-sm text-tea-text/50 mb-2">Feeling</h3>
                          <div className="flex flex-wrap gap-2">
                              <button onClick={() => setActiveFeeling('All')} className={`px-3 py-1 border rounded-sm text-xs uppercase tracking-wider ${activeFeeling === 'All' ? 'bg-tea-gold text-tea-text border-tea-gold' : 'border-tea-gold/[0.08]'}`}>All</button>
                              {FEELINGS_LIST.map(f => (
                                  <button key={f} onClick={() => setActiveFeeling(f)} className={`px-3 py-1 border rounded-sm text-xs uppercase tracking-wider ${activeFeeling === f ? 'bg-tea-gold text-tea-text border-tea-gold' : 'border-tea-gold/[0.08]'}`}>{f}</button>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- Desktop: Sidebar + Content / Mobile: Full Width --- */}
      <div className="max-w-full mx-auto px-3 md:px-4 lg:px-6 pt-4 lg:flex lg:gap-8">
         {/* Desktop persistent filter sidebar */}
         <div className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-24 space-y-6">
               <div>
                  <h3 className="font-serif italic text-sm text-tea-text/50 mb-3">Type</h3>
                  <div className="flex flex-col gap-1.5">
                     <button onClick={() => setActiveType('All')} className={`text-left px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-colors ${activeType === 'All' ? 'bg-tea-elevated text-tea-text font-medium' : 'text-tea-text/60 hover:text-tea-text hover:bg-tea-text/5'}`}>All Types</button>
                     {TEA_TYPES.map(t => (
                        <button key={t} onClick={() => setActiveType(t)} className={`text-left px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-colors ${activeType === t ? 'bg-tea-elevated text-tea-text font-medium' : 'text-tea-text/60 hover:text-tea-text hover:bg-tea-text/5'}`}>{t}</button>
                     ))}
                  </div>
               </div>
               <div className="border-t border-tea-gold/[0.08] pt-6">
                  <h3 className="font-serif italic text-sm text-tea-text/50 mb-3">Feeling</h3>
                  <div className="flex flex-col gap-1.5">
                     <button onClick={() => setActiveFeeling('All')} className={`text-left px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-colors ${activeFeeling === 'All' ? 'bg-tea-gold text-tea-text font-medium' : 'text-tea-text/60 hover:text-tea-text hover:bg-tea-text/5'}`}>All</button>
                     {FEELINGS_LIST.map(f => (
                        <button key={f} onClick={() => setActiveFeeling(f)} className={`text-left px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-colors ${activeFeeling === f ? 'bg-tea-gold text-tea-text font-medium' : 'text-tea-text/60 hover:text-tea-text hover:bg-tea-text/5'}`}>{f}</button>
                     ))}
                  </div>
               </div>
               {(activeType !== 'All' || activeFeeling !== 'All' || specialFilter !== 'None') && (
                  <button onClick={clearFilters} className="text-xs text-tea-gold hover:text-tea-gold/80 transition-colors underline uppercase tracking-wider">
                     Clear All Filters
                  </button>
               )}
            </div>
         </div>

         {/* Main content area */}
         <div className="flex-1 min-w-0">
         {/* Results Count */}
         <div className="flex items-center justify-between mb-4 px-0">
            <p className="text-xs uppercase tracking-[0.15em] text-tea-text/50">
               {filteredInventory.length} {filteredInventory.length === 1 ? 'tea' : 'teas'}
               {(activeType !== 'All' || activeFeeling !== 'All' || specialFilter !== 'None') && (
                  <button
                     onClick={clearFilters}
                     className="ml-3 text-tea-gold hover:text-tea-gold/80 transition-colors underline lg:hidden"
                  >
                     Clear filters
                  </button>
               )}
            </p>
         </div>

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
