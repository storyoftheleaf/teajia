
import React, { useState, useMemo } from 'react';
import type { Location } from 'react-router-dom';
import { Icons } from './Icons';
import { TeawareAlcoveModal } from './shop/TeawareAlcoveModal';
import { CardGridItem } from './shared/CardGridItem';
import { CardImage } from './shared/CardImage';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderActions } from './shared/PageHeaderActions';
import { ShopGridLayout } from './shared/ShopGridLayout';
import { TeaItem } from './TeaInventory';
import { TeaPlaceholder } from './shop/TeaPlaceholder';
import { useShopPrice } from './shop/shopPrice';
import { useProductModalRoute } from '../hooks/useProductModalRoute';
import { useAppStore } from '../lib/store';
import type { Product } from '../admin/types';

export interface TeawareCatalogProps {
  onAddToCart?: (item: TeaItem, qty: number, total: number) => void;
  externalInventory?: TeaItem[];
  hideHeader?: boolean;
  isAdmin?: boolean;
  adminProductMap?: Map<string, Product>;
  onAdminEdit?: (itemId: string) => void;
  modalLocation?: Location;
}

const CATEGORIES_META = [
  { id: 'pot', label: 'Pots & Kettles' },
  { id: 'cup', label: 'Cups & Bowls' },
  { id: 'tray', label: 'Trays & Mats' },
  { id: 'accessory', label: 'Accessories' },
  { id: 'decorative', label: 'Decorative' },
  { id: 'storage', label: 'Storage' },
];

export const TeawareCatalog: React.FC<TeawareCatalogProps> = ({ onAddToCart, externalInventory = [], hideHeader = false, isAdmin = false, adminProductMap, onAdminEdit, modalLocation }) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('LIST');

  // Alcove modal driven by the URL (/shop/product/:id + background state).
  const { viewItem, openProduct, navigateWithinModal, closeProduct } = useProductModalRoute(externalInventory, modalLocation);

  // The grid and the card it opens must quote one currency. `TeawareAlcoveCard`
  // has read `useShopPrice` since round seven; this catalogue still called the
  // raw dollar formatter, so a reader in Rupiah saw dollars in the grid and
  // Rupiah in the card they tapped. Same defect already fixed on the tea grid.
  const shopPrice = useShopPrice();

  // Persisted favorites via Zustand store (same as tea section)
  const { favoriteTeas, toggleFavoriteTea } = useAppStore();
  const userFavorites = useMemo(() => new Set(favoriteTeas), [favoriteTeas]);

  // Derive available categories from actual inventory
  const categories = useMemo(() => {
    const cats = new Set(externalInventory.map(item => item.subcategory).filter(Boolean));
    return CATEGORIES_META.filter(c => cats.has(c.id));
  }, [externalInventory]);

  // Filter by category
  const filteredItems = useMemo(() => {
    if (activeCategory === 'All') return externalInventory;
    return externalInventory.filter(item => item.subcategory === activeCategory);
  }, [activeCategory, externalInventory]);

  // Group items by category (for "All" view)
  const groupedItems = useMemo(() => {
    const groups: Record<string, TeaItem[]> = {};
    filteredItems.forEach(item => {
      const key = item.subcategory || 'other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    const order = CATEGORIES_META.map(c => c.id);
    return Object.keys(groups)
      .sort((a, b) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        return (idxA > -1 ? idxA : 999) - (idxB > -1 ? idxB : 999);
      })
      .map(key => ({
        id: key,
        label: CATEGORIES_META.find(c => c.id === key)?.label || key,
        items: groups[key]
      }));
  }, [filteredItems]);

  const clearFilters = () => setActiveCategory('All');

  return (
    <div className="w-full pb-32 animate-[fadeIn_0.5s_ease-out]">

      {/* --- DETAIL MODAL --- */}
      <TeawareAlcoveModal
        item={viewItem}
        items={externalInventory}
        onClose={closeProduct}
        onItemChange={navigateWithinModal}
        onAddToCart={(item, quantity, total) => {
          if (onAddToCart) onAddToCart(item, quantity, total);
          closeProduct();
        }}
        isAdmin={isAdmin}
        onEdit={onAdminEdit ? (item) => onAdminEdit(item.id) : undefined}
      />

      {/* --- HEADER --- */}
      {!hideHeader ? (
        <PageHeader
          title="Teaware"
          rightContent={
            <PageHeaderActions
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onReset={clearFilters}
              showReset={activeCategory !== 'All'}
              activeType={activeCategory}
            />
          }
        />
      ) : (
        /* Compact toolbar when embedded as a tab (hideHeader) */
        <div className="flex items-center justify-between px-3 md:px-4 lg:px-6 py-2">
          <PageHeaderActions
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onReset={clearFilters}
            showReset={activeCategory !== 'All'}
            activeType={activeCategory}
          />
        </div>
      )}

      {/* --- Inline Filter Chips + Content --- */}
      <div className="max-w-full mx-auto px-3 md:px-4 lg:px-6 pt-4">

        {/* Category filter chips, matching tea's type chips */}
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
            <span className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-dim shrink-0 mr-1">Category</span>
            <button
              onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveCategory('All'); }}
              className={`shrink-0 pill ${activeCategory === 'All' ? 'pill-active' : ''}`}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => { if ('vibrate' in navigator) navigator.vibrate?.(10); setActiveCategory(prev => prev === c.id ? 'All' : c.id); }}
                className={`shrink-0 pill ${activeCategory === c.id ? 'pill-active' : ''}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Item count + clear */}
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.15em] text-tea-text/50">
              {filteredItems.length} {filteredItems.length === 1 ? 'piece' : 'pieces'}
            </p>
            {activeCategory !== 'All' && (
              <button
                onClick={clearFilters}
                className="text-ui-11 text-tea-gold hover:text-tea-gold/80 transition-colors uppercase tracking-wider flex items-center gap-1.5"
              >
                <Icons.Close className="w-3 h-3" />
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="w-full">

          {/* Empty state */}
          {filteredItems.length === 0 && (
            <div className="text-center py-32">
              <Icons.Grid className="w-12 h-12 mx-auto mb-4 text-tea-text-dim" />
              <p className="font-serif italic text-tea-text/60 mb-2">No pieces match your filters</p>
              <button
                onClick={clearFilters}
                className="text-sm text-tea-gold hover:text-tea-gold/80 transition-colors underline"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* === GRID VIEW === */}
          {viewMode === 'GRID' && filteredItems.length > 0 && (
            activeCategory === 'All' ? (
              <div className="animate-[fadeIn_0.5s_ease-out]">
                {groupedItems.map((group) => (
                  <div key={group.id}>
                    {/* Category label, matching tea's style */}
                    <div className="pt-8 pb-2 first:pt-4 pl-2 border-b border-tea-border">
                      <span className="font-sans text-ui-10 uppercase tracking-[2px] text-tea-text-sec">{group.label}</span>
                    </div>
                    <ShopGridLayout>
                      {group.items.map(item => (
                        <CardGridItem
                          key={item.id}
                          item={item}
                          title={item.name}
                          onCardClick={(item, e) => { e.stopPropagation(); openProduct(item); }}
                          imageComponent={
                            <CardImage
                              src={item.image}
                              alt={item.name}
                              aspect="square"
                            />
                          }
                          badgesComponent={
                            <div className="flex items-center gap-1.5">
                              <span className="card-grid-badge">{item.variant}</span>
                              {item.origin && (
                                <span className="text-ui-10 text-tea-text-sec italic">{item.origin}</span>
                              )}
                            </div>
                          }
                          priceDisplay={
                            <span className="card-grid-price">
                              <span className="num">{shopPrice.total(parseFloat(item.price_50g ?? '0'))}</span>
                              <span className="text-tea-text-sec text-ui-10 ml-1">each</span>
                            </span>
                          }
                        />
                      ))}
                    </ShopGridLayout>
                  </div>
                ))}
              </div>
            ) : (
              <ShopGridLayout>
                {filteredItems.map(item => (
                  <CardGridItem
                    key={item.id}
                    item={item}
                    title={item.name}
                    onCardClick={(item, e) => { e.stopPropagation(); openProduct(item); }}
                    imageComponent={
                      <CardImage
                        src={item.image}
                        alt={item.name}
                        aspect="square"
                      />
                    }
                    badgesComponent={
                      <div className="flex items-center gap-1.5">
                        <span className="card-grid-badge">{item.variant}</span>
                        {item.origin && (
                          <span className="text-ui-10 text-tea-text-sec italic">{item.origin}</span>
                        )}
                      </div>
                    }
                    priceDisplay={
                      <span className="card-grid-price">
                        <span className="num">{shopPrice.total(parseFloat(item.price_50g ?? '0'))}</span>
                        <span className="text-tea-text-sec text-ui-10 ml-1">each</span>
                      </span>
                    }
                  />
                ))}
              </ShopGridLayout>
            )
          )}

          {/* === LIST VIEW, matching tea's row pattern === */}
          {viewMode === 'LIST' && filteredItems.length > 0 && (
            <div className="flex flex-col px-0 animate-[fadeIn_0.5s_ease-out]">
              {groupedItems.map((group) => (
                <React.Fragment key={group.id}>

                  {/* Category label, same style as tea type headers */}
                  {activeCategory === 'All' && (
                    <div className="pt-8 pb-2 first:pt-4 pl-2 border-b border-tea-border">
                      <span className="font-sans text-ui-10 uppercase tracking-[2px] text-tea-text-sec">{group.label}</span>
                    </div>
                  )}

                  {group.items.map((item) => {
                    const isFavorite = userFavorites.has(item.id);
                    const unitPrice = parseFloat(item.price_50g ?? '0');

                    return (
                      <div
                        key={item.id}
                        className="border-b border-tea-border hover:bg-tea-accent-sub/50 transition-colors cursor-pointer"
                        onClick={() => openProduct(item)}
                      >
                        <div className="flex items-center py-3 lg:py-4 px-2 gap-3">
                          {/* Thumbnail */}
                          <div className="w-12 h-12 rounded-md overflow-hidden shrink-0 bg-tea-elevated">
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
                            </div>
                            <div className="text-ui-13 mt-1 truncate flex items-center gap-2">
                              <span className="text-ui-10 uppercase tracking-wider text-tea-text-sec">{item.variant}</span>
                              {item.origin && (
                                <><span className="text-tea-text-dim">·</span>
                                <span className="font-body italic text-tea-text/40">{item.origin}</span></>
                              )}
                              {item.year && (
                                <><span className="text-tea-text-dim">·</span>
                                <span className="font-mono num text-ui-11 text-tea-gold/60">{item.year}</span></>
                              )}
                            </div>
                          </div>

                          {/* Right: heart + admin controls + price + chevron */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Favorite toggle */}
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleFavoriteTea(item.id); }}
                              className={`-my-1 p-1.5 transition-colors ${isFavorite ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}
                              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            >
                              <Icons.Heart filled={isFavorite} className="w-4 h-4" />
                            </button>
                            {/* Admin: stock indicator */}
                            {isAdmin && adminProductMap?.has(item.id) && (() => {
                              const ap = adminProductMap.get(item.id)!;
                              const stockColor = ap.stockGrams < 2 ? 'bg-tea-error' : ap.stockGrams < 5 ? 'bg-tea-gold' : 'bg-tea-leaf';
                              return (
                                <span className="hidden md:flex items-center gap-1.5" title={`${ap.stockGrams} in stock`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${stockColor}`} />
                                  <span className="text-ui-10 num text-tea-text/40">{ap.stockGrams}</span>
                                </span>
                              );
                            })()}
                            {/* Admin: edit button */}
                            {isAdmin && onAdminEdit && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onAdminEdit(item.id); }}
                                className="p-1 text-tea-text-sec hover:text-tea-gold transition-colors"
                                title="Edit product"
                              >
                                <Icons.Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <div className="text-right">
                              <span className="num text-sm text-tea-gold">{shopPrice.total(unitPrice)}</span>
                              <span className="text-tea-text-sec text-ui-10 ml-1">each</span>
                            </div>
                            <Icons.Next className="w-4 h-4 text-tea-text-sec shrink-0" />
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
