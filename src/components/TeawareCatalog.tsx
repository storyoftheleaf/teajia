
import React, { useState, useMemo } from 'react';
import type { Location } from 'react-router-dom';
import type { InventoryItem } from '../types';
import { Icons } from './Icons';
import { CardGridItem } from './shared/CardGridItem';
import { CardImage } from './shared/CardImage';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderActions } from './shared/PageHeaderActions';
import { ShopGridLayout } from './shared/ShopGridLayout';
import { TeaItem } from './TeaInventory';
import { TeaPlaceholder } from './shop/TeaPlaceholder';
import { splitOrigin, TeaLedgerRow } from './shop/TeaLedger';
import { TeawareCartControl } from './shop/TeawareCartControl';
import { TeawareGlyph, teawareVesselFor } from './shop/TeawareGlyph';
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

/**
 * What to print under a teaware name.
 *
 * `variant` is filled with the product name for most teaware, so printing it
 * raw repeated the title on every one of the rows. Prefer the category, which
 * says something the name does not, and fall back to the variant only when it
 * actually differs from the name.
 */
function teawareMeta(item: InventoryItem): string | null {
  const name = (item.name || '').trim().toLowerCase();
  const variant = (item.variant || '').trim();

  // What the piece is made of and how much it holds are the two things a
  // buyer weighs between two kettles, and neither is in the title.
  const facts = [
    item.material?.trim(),
    item.capacityMl ? `${item.capacityMl}ml` : null,
  ].filter(Boolean);
  if (facts.length) return facts.join(' \u00b7 ');

  // The category is a weak third: rows are already grouped under it, so it
  // tends to restate the heading. Better than nothing, better than the name.
  if (item.subcategory?.trim()) return item.subcategory.trim();
  if (variant && variant.toLowerCase() !== name) return variant;
  return null;
}

/** Origin is stored as the literal "Unknown" for teaware with no recorded source. */
/** Same reading as a tea row: China dropped, a long chain cut to its ends. */
function teawareOrigin(item: InventoryItem): string | null {
  const origin = (item.origin || '').trim();
  if (!origin || origin.toLowerCase() === 'unknown') return null;
  const { near, mid } = splitOrigin(origin);
  return [near, mid].filter(Boolean).join(', ') || null;
}

export const TeawareCatalog: React.FC<TeawareCatalogProps> = ({ onAddToCart, externalInventory = [], hideHeader = false, isAdmin = false, adminProductMap, onAdminEdit, modalLocation }) => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('LIST');

  // Alcove modal driven by the URL (/shop/product/:id + background state).
  const { openProduct } = useProductModalRoute(externalInventory, modalLocation);

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

      {/* The swipe-between-teas card used to open here. Tapping a tea is a real
          navigation to the product page now, one address with one rendering, so
          this never received an item again. Removed rather than left dark. */}
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
        <div className="flex items-center justify-between py-2 md:px-4">
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
      {/* No gutter of its own on a phone, the same as the tea shelf: the page
          already gives 16px, and a second 12px left the names 28px from the edge. */}
      <div className="max-w-full mx-auto pt-4 md:px-4">

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
                    <div className="-mx-4 px-4 md:mx-0 md:px-0 md:pl-2 pt-8 pb-2 first:pt-4 border-b border-tea-border">
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
                              {teawareMeta(item) && <span className="card-grid-badge">{teawareMeta(item)}</span>}
                              {teawareOrigin(item) && (
                                <span className="text-ui-10 text-tea-text-sec italic">{teawareOrigin(item)}</span>
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
                        {teawareMeta(item) && <span className="card-grid-badge">{teawareMeta(item)}</span>}
                        {teawareOrigin(item) && (
                          <span className="text-ui-10 text-tea-text-sec italic">{teawareOrigin(item)}</span>
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
                    <>
                      <div className="flex items-baseline justify-between gap-4 pt-9 first:pt-2 pb-2.5">
                        <h2 className="font-display text-ui-26 font-normal tracking-[0.02em] text-tea-text first-letter:uppercase">{group.label}</h2>
                        <span className="num text-ui-11 text-tea-text-dim tabular-nums">{String(group.items.length).padStart(2, '0')}</span>
                      </div>
                      <div className="-mx-4 px-4 h-px bg-tea-gold/20" aria-hidden="true" />
                    </>
                  )}

                  {group.items.map((item) => {
                    const isFavorite = userFavorites.has(item.id);
                    const vessel = teawareVesselFor(item);

                    // The tea shelf's own row, so a piece reads exactly like a
                    // tea: the Save tile where the heart was, the material
                    // leading the second line, the buy control on the right.
                    return (
                      <TeaLedgerRow
                        key={item.id}
                        item={item}
                        showType={false}
                        label={teawareMeta(item)}
                        mark={!item.year && vessel ? <TeawareGlyph vessel={vessel} className="h-[30px] w-[36px] text-tea-text-sec" /> : undefined}
                        saved={isFavorite}
                        onToggleSave={() => toggleFavoriteTea(item.id)}
                        onOpen={() => openProduct(item)}
                        trailing={
                          <div className="flex items-center gap-2">
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
                            {isAdmin && onAdminEdit && (
                              <button
                                onClick={(e) => { e.stopPropagation(); onAdminEdit(item.id); }}
                                className="tap-target p-1 text-tea-text-sec hover:text-tea-gold transition-colors"
                                title="Edit product"
                              >
                                <Icons.Edit className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <TeawareCartControl item={item} formatPrice={shopPrice.total} onAddToCart={onAddToCart} />
                          </div>
                        }
                      />
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
