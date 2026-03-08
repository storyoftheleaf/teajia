
import React, { useState, useMemo } from 'react';
import { Icons } from './Icons';
import { AlcoveModal } from './shop/AlcoveModal';
import { CardImage } from './shared/CardImage';
import { CardThumbnail } from './shared/CardThumbnail';
import { CardGridItem } from './shared/CardGridItem';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { PageHeaderActions } from './shared/PageHeaderActions';
import { fmtPrice, fmtPricePerGram } from '../utils/formatNumber';
import { ShopGridLayout } from './shared/ShopGridLayout';

import { HapticSlider } from './shared/HapticSlider';
import { InventoryItem } from '../types';
import { SALE_ITEM_IDS } from '../data/curatedCollections';
import { useAppStore } from '../lib/store';
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
  const { favoriteTeas, toggleFavoriteTea } = useAppStore();
  const userFavorites = useMemo(() => new Set(favoriteTeas), [favoriteTeas]);

  // Expanded Card State (Accordion)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Image Modal State
  const [viewItem, setViewItem] = useState<TeaItem | null>(null);

  // Local state for quantity selector map (id -> quantity)
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});

  // Unit multiplier for portion size (25g, 50g, 100g, 250g, etc.)
  const [unitMultiplier, setUnitMultiplier] = useState(() => {
    const saved = localStorage.getItem('teajia_unitMultiplier');
    return saved ? parseInt(saved) : 25;
  });

  // Touch gesture state for carousel swipe navigation
  const [zoomTouchStart, setZoomTouchStart] = useState<number | null>(null);
  const [zoomTouchStartTime, setZoomTouchStartTime] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);

  // Save unit multiplier to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('teajia_unitMultiplier', String(unitMultiplier));
  }, [unitMultiplier]);

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

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const toggleUserFavorite = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      toggleFavoriteTea(id);
  };

  const clearFilters = () => {
    setActiveType('All');
    setActiveFeeling('All');
    setSpecialFilter('None');
  };

  const updateQuantity = (id: string, qty: number) => {
      setSelectedQuantities(prev => ({...prev, [id]: qty}));
  };

  const handleZoomTouchStart = (e: React.TouchEvent) => {
    setZoomTouchStart(e.touches[0].clientX);
    setZoomTouchStartTime(Date.now());
    setSwipeOffset(0);
  };

  const handleZoomTouchMove = (e: React.TouchEvent) => {
    if (zoomTouchStart === null) return;
    const currentX = e.touches[0].clientX;
    const offset = currentX - zoomTouchStart;
    setSwipeOffset(offset);
  };

  const handleZoomTouchEnd = (e: React.TouchEvent) => {
    if (zoomTouchStart === null || zoomTouchStartTime === null || !viewItem) return;

    const touchEnd = e.changedTouches[0].clientX;
    const touchDuration = Date.now() - zoomTouchStartTime;
    const diff = zoomTouchStart - touchEnd;
    const distance = Math.abs(diff);

    // Calculate velocity (pixels per millisecond)
    const velocity = distance / touchDuration;

    // Adaptive threshold: lower for fast swipes, higher for slow swipes
    const BASE_THRESHOLD = 30;
    const VELOCITY_THRESHOLD = 0.3; // Fast swipe if > 0.3 px/ms
    const threshold = velocity > VELOCITY_THRESHOLD ? 20 : BASE_THRESHOLD;

    if (distance < threshold) {
      setZoomTouchStart(null);
      setZoomTouchStartTime(null);
      return;
    }

    // Find current item's position in ALL filtered inventory (not just current group)
    const currentIndex = filteredInventory.findIndex(item => item.id === viewItem.id);
    if (currentIndex === -1) {
      setZoomTouchStart(null);
      setZoomTouchStartTime(null);
      return;
    }

    let newItem: TeaItem | null = null;
    if (diff > 0) {
      // Swiped left - go to next item
      if (currentIndex < filteredInventory.length - 1) {
        newItem = filteredInventory[currentIndex + 1];
      }
    } else {
      // Swiped right - go to previous item
      if (currentIndex > 0) {
        newItem = filteredInventory[currentIndex - 1];
      }
    }

    if (newItem) {
      setViewItem(newItem);
      setSelectedQuantities(prev => {
        const newQty = { ...prev };
        if (!newQty[newItem!.id]) {
          newQty[newItem!.id] = 25;
        }
        return newQty;
      });
    }

    setZoomTouchStart(null);
    setZoomTouchStartTime(null);
    setSwipeOffset(0);
  };

  return (
    <div className="w-full pb-32 animate-[fadeIn_0.5s_ease-out]">

      {/* --- Alcove Detail Modal --- */}
      <AlcoveModal
        item={viewItem}
        items={filteredInventory}
        onClose={() => setViewItem(null)}
        onItemChange={(item) => setViewItem(item)}
        onAddToCart={(item, quantity, total) => {
          if (onAddToCart) onAddToCart(item, quantity, total);
          setViewItem(null);
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
          <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center p-0 md:p-4">
              <div className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity" onClick={() => setIsFilterOpen(false)}></div>
              <div className="relative w-full md:max-w-xl bg-tea-bg rounded-t-xl md:rounded-sm overflow-hidden flex flex-col max-h-[85vh] animate-[slideUp_0.3s_ease-out]">
                  <div className="px-6 py-3 border-b border-tea-border flex justify-between items-center bg-tea-surface">
                      <span className="text-xs uppercase tracking-[0.2em] text-tea-text font-semibold">Refine Collection</span>
                      <button onClick={() => setIsFilterOpen(false)}><Icons.Close className="w-4 h-4 text-tea-text/60" /></button>
                  </div>
                  <div className="p-6 overflow-y-auto text-tea-text flex-1">
                      <div className="mb-6">
                          <h3 className="font-serif italic text-sm text-tea-text/50 mb-2">Type</h3>
                          <div className="flex flex-wrap gap-2">
                              <button onClick={() => setActiveType('All')} className={`px-3 py-1 border rounded-sm text-xs uppercase tracking-wider ${activeType === 'All' ? 'bg-tea-bg text-tea-paper' : 'border-tea-border'}`}>All</button>
                              {TEA_TYPES.map(t => (
                                  <button key={t} onClick={() => setActiveType(t)} className={`px-3 py-1 border rounded-sm text-xs uppercase tracking-wider ${activeType === t ? 'bg-tea-bg text-tea-paper' : 'border-tea-border'}`}>{t}</button>
                              ))}
                          </div>
                      </div>
                      <div>
                          <h3 className="font-serif italic text-sm text-tea-text/50 mb-2">Feeling</h3>
                          <div className="flex flex-wrap gap-2">
                              <button onClick={() => setActiveFeeling('All')} className={`px-3 py-1 border rounded-sm text-xs uppercase tracking-wider ${activeFeeling === 'All' ? 'bg-tea-gold text-tea-paper border-tea-gold' : 'border-tea-border'}`}>All</button>
                              {FEELINGS_LIST.map(f => (
                                  <button key={f} onClick={() => setActiveFeeling(f)} className={`px-3 py-1 border rounded-sm text-xs uppercase tracking-wider ${activeFeeling === f ? 'bg-tea-gold text-tea-paper border-tea-gold' : 'border-tea-border'}`}>{f}</button>
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
               <div className="border-t border-tea-border pt-6">
                  <h3 className="font-serif italic text-sm text-tea-text/50 mb-3">Feeling</h3>
                  <div className="flex flex-col gap-1.5">
                     <button onClick={() => setActiveFeeling('All')} className={`text-left px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-colors ${activeFeeling === 'All' ? 'bg-tea-gold text-tea-paper font-medium' : 'text-tea-text/60 hover:text-tea-text hover:bg-tea-text/5'}`}>All</button>
                     {FEELINGS_LIST.map(f => (
                        <button key={f} onClick={() => setActiveFeeling(f)} className={`text-left px-3 py-1.5 rounded text-xs uppercase tracking-wider transition-colors ${activeFeeling === f ? 'bg-tea-gold text-tea-paper font-medium' : 'text-tea-text/60 hover:text-tea-text hover:bg-tea-text/5'}`}>{f}</button>
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
               {filteredInventory.map(item => (
                  <CardGridItem
                     key={item.id}
                     item={item}
                     title={item.name}
                     onCardClick={(item, e) => { e.stopPropagation(); setViewItem(item); }}
                     imageComponent={<CardImage src={item.image} alt={item.name} aspect="square" className="card-grid-image" />}
                     badgesComponent={
                        <span className="card-grid-badge">{item.type}</span>
                     }
                     priceDisplay={
                        <span className="card-grid-price">{fmtPricePerGram(parseFloat(item.price_per_gram))}</span>
                     }
                     descriptionComponent={
                        <p className="card-grid-description">{item.description}</p>
                     }
                  />
               ))}
            </ShopGridLayout>
         )}

         {/* LIST VIEW */}
         {viewMode === 'LIST' && filteredInventory.length > 0 && (
            <div className="flex flex-col px-0 animate-[fadeIn_0.5s_ease-out]">
               {groupedInventory.map((group) => (
                <React.Fragment key={group.type}>
                    
                    {/* Categorization Separator - Left Aligned & Bigger */}
                    {activeType === 'All' && specialFilter === 'None' && (
                        <div className="flex items-center gap-4 py-4 mt-6 first:mt-2 opacity-70">
                            <span className="text-sm uppercase tracking-[0.25em] text-tea-text font-serif shrink-0 pl-1">{group.type}</span>
                            <div className="h-[1px] bg-tea-text/10 flex-1"></div>
                        </div>
                    )}

                    {group.items.map((item) => {
                        const isExpanded = expandedId === item.id;
                        const isFavorite = userFavorites.has(item.id);
                        const isTeajiaFav = !!item.isFeatured;

                        const currentQty = selectedQuantities[item.id] || 25;
                        const maxStock = parseInt(item.stock_g) || 100;
                        // Price formula: use price_per_gram directly (already in $/gram)
                        const pricePerGram = parseFloat(item.price_per_gram || '0') || 0;
                        const totalPrice = pricePerGram > 0 ? Math.round(pricePerGram * currentQty * 100) / 100 : 0;

                        return (
                            <div
                                key={item.id}
                                className={`relative border-b border-tea-border transition-colors duration-300 ${isExpanded ? 'bg-tea-text/5' : 'hover:bg-tea-elevated/50'}`}
                            >
                                <div className="flex items-center py-3 lg:py-4 px-2 gap-4 lg:gap-6 cursor-pointer select-none group" onClick={() => toggleExpand(item.id)}>

                                    {/* 1. Thumbnail — larger on desktop */}
                                    <CardThumbnail
                                        src={item.image}
                                        alt={item.name}
                                        onClick={(e) => { e.stopPropagation(); setViewItem(item); }}
                                    />

                                    {/* 2. Text Content — desktop shows description inline */}
                                    <div className="flex-1 min-w-0 flex items-center justify-between">
                                        <div className="flex flex-col justify-center lg:flex-row lg:items-center lg:gap-6 lg:flex-1 min-w-0">
                                            {/* Title & Tags */}
                                            <div className="flex flex-col justify-center lg:min-w-[180px]">
                                                <div className="flex items-center gap-2">
                                                    <h3 className={`font-serif text-lg leading-none transition-colors ${isExpanded ? 'text-tea-gold' : 'text-tea-text group-hover:text-tea-text/90'}`}>
                                                        {item.name}
                                                    </h3>
                                                    {isTeajiaFav && <Icons.Seal className="w-3 h-3 text-tea-gold shrink-0 opacity-80" />}
                                                </div>
                                                <div className="text-[11px] uppercase tracking-wider text-tea-text/60 mt-1 truncate flex items-center gap-2">
                                                     <span className={`font-mono ${isExpanded ? 'text-tea-gold' : ''}`}>{item.year}</span>
                                                     <span className="opacity-50">•</span>
                                                     <span>{item.variant}</span>
                                                </div>
                                            </div>
                                            {/* Desktop inline description — hidden when expanded */}
                                            {!isExpanded && (
                                              <p className="hidden lg:block text-xs text-tea-text/50 line-clamp-1 flex-1 min-w-0">
                                                  {item.description}
                                              </p>
                                            )}
                                        </div>

                                        {/* Price & Controls */}
                                        <div className="flex items-center gap-4 shrink-0">
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
                                            <span className={`num text-sm tracking-wide ${isExpanded ? 'text-tea-gold' : 'text-tea-text/80'}`}>
                                                {fmtPricePerGram(pricePerGram)}
                                            </span>
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
                                            <button
                                                onClick={(e) => toggleUserFavorite(e, item.id)}
                                                className={`p-1 transition-colors ${isFavorite ? 'text-tea-gold' : 'text-tea-text/20 hover:text-tea-text/50/50'}`}
                                            >
                                                <Icons.Heart filled={isFavorite} className="w-3.5 h-3.5" />
                                            </button>
                                            <Icons.ChevronDown className={`w-3 h-3 text-tea-text/40 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>
                                </div>

                                {/* --- Expanded Content --- */}
                                <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    <div className="pl-20 pr-2 pb-3 pt-0">

                                        <p className="font-serif text-sm text-tea-text/80 mb-3 leading-relaxed max-w-2xl">
                                            {item.description}
                                        </p>

                                        {/* Controls */}
                                        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-tea-text/5 rounded-lg p-3 pr-4 border border-tea-border">

                                            {/* Slider */}
                                            <div className="flex-1 flex items-center gap-3 px-2">
                                                <div className="flex flex-col min-w-[60px]">
                                                    <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text/50">Qty</span>
                                                    <span className="num text-sm text-tea-text">
                                                        {currentQty}g <span className="opacity-30 mx-0.5">/</span> <span className="opacity-40">{maxStock}g</span>
                                                    </span>
                                                </div>

                                                <HapticSlider
                                                    min={25}
                                                    max={maxStock}
                                                    step={25}
                                                    value={currentQty}
                                                    onChange={(val) => updateQuantity(item.id, val)}
                                                    size="sm"
                                                />
                                            </div>

                                            {/* Add to cart + Details */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setViewItem(item); }}
                                                    className="text-tea-gold hover:text-tea-gold/80 text-[11px] uppercase tracking-[0.15em] font-medium py-2 px-3 rounded-lg transition-all border border-tea-gold/20 hover:border-tea-gold/40"
                                                >
                                                    Details
                                                </button>
                                                <button
                                                    onClick={() => onAddToCart && onAddToCart(item, currentQty, totalPrice)}
                                                    className="bg-tea-gold hover:bg-tea-gold/90 text-white text-xs uppercase tracking-[0.15em] font-medium py-2 px-4 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                                                >
                                                    <span>Add</span>
                                                    <span className="w-[1px] h-2.5 bg-white/30"></span>
                                                    <span className="num">{fmtPrice(totalPrice)}</span>
                                                </button>
                                            </div>
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
    </div>
  );
};
