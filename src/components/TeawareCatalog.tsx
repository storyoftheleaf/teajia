
import React, { useState, useMemo } from 'react';
import { Icons } from './Icons';
import { TeawareAlcoveModal } from './shop/TeawareAlcoveModal';
import { CardGridItem } from './shared/CardGridItem';
import { CardImage } from './shared/CardImage';
import { CardThumbnail } from './shared/CardThumbnail';
import { PageHeader } from './shared/PageHeader';
import { PageHeaderTabs } from './shared/PageHeaderTabs';
import { ShopGridLayout } from './shared/ShopGridLayout';
import { SectionDivider } from './shared/SectionDivider';
import { TeaItem } from './TeaInventory';
import { useProductUrl } from '../hooks/useProductUrl';
import type { Product } from '../admin/types';

export interface TeawareCatalogProps {
  onAddToCart?: (item: TeaItem, qty: number, total: number) => void;
  externalInventory?: TeaItem[];
  hideHeader?: boolean;
  isAdmin?: boolean;
  adminProductMap?: Map<string, Product>;
  onAdminEdit?: (itemId: string) => void;
}

const CATEGORIES_META = [
  { id: 'brewing', label: 'Brewing', title: 'Brewing Vessels', description: 'Traditional vessels for the infusion. The heart of the ceremony.' },
  { id: 'serving', label: 'Serving', title: 'Serving & Drinking', description: 'Vessels for receiving the brew and platforms for the stage.' },
  { id: 'elements', label: 'Elements', title: 'Water & Heating', description: 'Essential foundations for temperature control and water quality.' },
  { id: 'ritual', label: 'Ritual', title: 'Preparation Tools', description: 'Implements for measuring, cleaning, and setting the mood.' }
];

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  ...CATEGORIES_META.map(c => ({ id: c.id, label: c.label })),
];

export const TeawareCatalog: React.FC<TeawareCatalogProps> = ({ onAddToCart, externalInventory = [], hideHeader = false, isAdmin = false, adminProductMap, onAdminEdit }) => {
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [viewItem, setViewItem] = useState<TeaItem | null>(null);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('LIST');

  // Sync modal state with URL (?product=ID)
  const { closeWithHistory } = useProductUrl(externalInventory, viewItem, setViewItem);

  // List View State
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [userFavorites, setUserFavorites] = useState<Set<string>>(new Set());

  const displayedItems = useMemo(() => {
    if (activeFilter === 'all') return externalInventory;
    return externalInventory.filter(item => item.subcategory === activeFilter);
  }, [activeFilter, externalInventory]);

  const groupedItems = useMemo(() => {
      const groups: Record<string, TeaItem[]> = {};
      displayedItems.forEach(item => {
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
  }, [displayedItems]);

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);
  const updateQuantity = (id: string, q: number) => setSelectedQuantities(prev => ({...prev, [id]: q}));
  const toggleFavorite = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setUserFavorites(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  // View mode toggle
  const viewModeToggle = (
    <div className="flex items-center gap-4 md:gap-6">
      <div className="flex items-center bg-tea-text/[0.06] rounded-lg p-0.5">
        <button
          onClick={() => setViewMode('GRID')}
          className={`p-1.5 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-tea-elevated text-tea-text shadow-sm' : 'text-tea-text/40 hover:text-tea-text'}`}
          title="Grid View"
        >
          <Icons.Grid className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setViewMode('LIST')}
          className={`p-1.5 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-tea-elevated text-tea-text shadow-sm' : 'text-tea-text/40 hover:text-tea-text'}`}
          title="Ledger View"
        >
          <Icons.List className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="pr-2 opacity-60 hidden md:block">
        <span className="text-xs uppercase tracking-[0.2em] text-tea-text">
          {displayedItems.length} Objects
        </span>
      </div>
    </div>
  );

  return (
    <div className="w-full pb-32 animate-[fadeIn_0.5s_ease-out]">

      {/* --- DETAIL MODAL --- */}
      <TeawareAlcoveModal
        item={viewItem}
        items={externalInventory}
        onClose={closeWithHistory}
        onItemChange={(item) => setViewItem(item)}
        onAddToCart={(item, quantity, total) => {
          if (onAddToCart) onAddToCart(item, quantity, total);
          closeWithHistory();
        }}
      />

      {/* --- HEADER (shared PageHeader) --- */}
      {!hideHeader ? (
        <PageHeader
          title="Teaware"
          rightContent={viewModeToggle}
        >
          <PageHeaderTabs
            tabs={FILTER_TABS}
            activeTab={activeFilter}
            onChange={setActiveFilter}
          />
        </PageHeader>
      ) : (
        /* Compact toolbar when embedded as a tab (hideHeader) */
        <div className="flex items-center justify-between px-3 md:px-4 lg:px-6 py-2">
          {viewModeToggle}
        </div>
      )}

      {/* --- CONTENT --- */}
      <div className="max-w-full mx-auto px-3 md:px-4 lg:px-6 pt-4">

          {activeFilter !== 'all' && viewMode === 'GRID' && (
              <div className="mb-8 animate-[fadeIn_0.3s_ease-out]">
                   {CATEGORIES_META.filter(c => c.id === activeFilter).map(cat => (
                       <div key={cat.id}>
                           <h3 className="text-2xl font-serif text-tea-text mb-1">{cat.title}</h3>
                           <p className="text-tea-text/60 font-serif italic text-sm">{cat.description}</p>
                       </div>
                   ))}
              </div>
          )}

          {displayedItems.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 opacity-40 animate-[fadeIn_0.3s_ease-out]">
                  <div className="w-16 h-16 border border-tea-text/20  rounded-full flex items-center justify-center mb-4">
                      <Icons.Grid className="w-6 h-6 text-tea-text/50" />
                  </div>
                  <p className="font-serif italic text-base text-tea-text/60">No objects found.</p>
              </div>
          )}

          {/* === MODE: GRID (with category group headers) === */}
          {viewMode === 'GRID' && displayedItems.length > 0 && (
              activeFilter === 'all' ? (
                  <div className="animate-[fadeIn_0.5s_ease-out]">
                      {groupedItems.map((group) => (
                          <div key={group.id}>
                              <SectionDivider label={group.label} />
                              <ShopGridLayout>
                                  {group.items.map(item => (
                                      <CardGridItem
                                        key={item.id}
                                        item={item}
                                        title={item.name}
                                        onCardClick={(item, e) => { e.stopPropagation(); setViewItem(item); }}
                                        imageComponent={
                                          <CardImage
                                            src={item.image}
                                            alt={item.name}
                                            aspect="square"
                                          />
                                        }
                                        badgesComponent={
                                          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                                            <span className="card-grid-badge">{item.variant}</span>
                                            <span className="card-grid-badge hidden md:inline">{item.origin}</span>
                                          </div>
                                        }
                                        priceDisplay={
                                          <span className="card-grid-price">${parseFloat(item.price_50g).toLocaleString()}</span>
                                        }
                                        descriptionComponent={
                                          <p className="card-grid-description">{item.description}</p>
                                        }
                                      />
                                  ))}
                              </ShopGridLayout>
                          </div>
                      ))}
                  </div>
              ) : (
                  <ShopGridLayout>
                      {displayedItems.map(item => (
                          <CardGridItem
                            key={item.id}
                            item={item}
                            title={item.name}
                            onCardClick={(item, e) => { e.stopPropagation(); setViewItem(item); }}
                            imageComponent={
                              <CardImage
                                src={item.image}
                                alt={item.name}
                                aspect="square"
                              />
                            }
                            badgesComponent={
                              <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                                <span className="card-grid-badge">{item.variant}</span>
                                <span className="card-grid-badge hidden md:inline">{item.origin}</span>
                              </div>
                            }
                            priceDisplay={
                              <span className="card-grid-price">${parseFloat(item.price_50g).toLocaleString()}</span>
                            }
                            descriptionComponent={
                              <p className="card-grid-description">{item.description}</p>
                            }
                          />
                      ))}
                  </ShopGridLayout>
              )
          )}

          {/* === MODE: LIST === */}
          {viewMode === 'LIST' && (
              <div className="flex flex-col px-0 animate-[fadeIn_0.5s_ease-out]">
                  {groupedItems.map((group) => (
                      <React.Fragment key={group.id}>
                          <SectionDivider label={group.label} />
                          {group.items.map((item) => {
                              const isExpanded = expandedId === item.id;
                              const isFavorite = userFavorites.has(item.id);
                              const currentQty = selectedQuantities[item.id] || 1;
                              const maxStock = parseInt(item.stock_g) || 1;
                              const unitPrice = parseFloat(item.price_50g);
                              const totalPrice = Math.round(unitPrice * currentQty);

                              return (
                                  <div key={item.id} className={`relative transition-colors duration-300 ${isExpanded ? 'bg-tea-text/5' : 'hover:bg-tea-elevated/50'}`} style={{ boxShadow: '0 1px 0 var(--tea-accent-sub)' }}>
                                      <div className="flex items-center py-3 px-2 gap-4 cursor-pointer select-none group" onClick={() => toggleExpand(item.id)}>
                                          <CardThumbnail
                                              src={item.image}
                                              alt={item.name}
                                              teaType={item.type}
                                              onClick={(e) => { e.stopPropagation(); setViewItem(item); }}
                                          />
                                          <div className="flex-1 min-w-0 flex items-center justify-between">
                                              <div className="flex flex-col justify-center">
                                                  <div className="flex items-center gap-2">
                                                      <h3 className={`font-serif text-lg md:text-xl leading-none transition-colors ${isExpanded ? 'text-tea-gold' : 'text-tea-text group-hover:text-tea-text/90 dark:group-hover:text-tea-text/90'}`}>{item.name}</h3>
                                                  </div>
                                                  <div className="text-[10px] md:text-[11px] uppercase tracking-wider text-tea-text/60 mt-1 truncate flex items-center gap-2">
                                                       <span className={`font-medium ${isExpanded ? 'text-tea-gold' : ''}`}>{item.variant}</span>
                                                       <span className="opacity-30">•</span>
                                                       <span className="font-mono opacity-80">{item.year}</span>
                                                  </div>
                                              </div>
                                              <div className="flex items-center gap-4 md:gap-6 shrink-0">
                                                  <div className="text-right hidden md:block">
                                                      <span className={`font-mono text-sm tracking-wide block ${isExpanded ? 'text-tea-gold' : 'text-tea-text/90'}`}>${unitPrice.toLocaleString()}</span>
                                                  </div>
                                                  {/* Admin: stock + edit */}
                                                  {isAdmin && adminProductMap?.has(item.id) && (() => {
                                                      const ap = adminProductMap.get(item.id)!;
                                                      const stockColor = ap.stockGrams < 2 ? 'bg-red-400' : ap.stockGrams < 5 ? 'bg-amber-400' : 'bg-emerald-400';
                                                      return (
                                                          <span className="hidden md:flex items-center gap-1.5" title={`${ap.stockGrams} in stock`}>
                                                              <span className={`w-1.5 h-1.5 rounded-full ${stockColor}`} />
                                                              <span className="text-[10px] font-mono text-tea-text/40">{ap.stockGrams}</span>
                                                          </span>
                                                      );
                                                  })()}
                                                  {isAdmin && onAdminEdit && (
                                                      <button onClick={(e) => { e.stopPropagation(); onAdminEdit(item.id); }} className="p-1 text-tea-text/20 hover:text-tea-gold transition-colors" title="Edit product">
                                                          <Icons.Edit className="w-3.5 h-3.5" />
                                                      </button>
                                                  )}
                                                  <button onClick={(e) => toggleFavorite(e, item.id)} className={`p-1 transition-colors ${isFavorite ? 'text-tea-gold' : 'text-tea-text/20 hover:text-tea-text/50'}`}><Icons.Heart filled={isFavorite} className="w-4 h-4" /></button>
                                                  <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-tea-text' : 'text-tea-text/30'}`}><Icons.ChevronDown className="w-4 h-4" /></div>
                                              </div>
                                          </div>
                                      </div>
                                      <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isExpanded ? 'max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                          <div className="pl-20 pr-2 pb-6 pt-2">
                                              <p className="font-serif text-sm md:text-base text-tea-text/80 mb-6 leading-relaxed max-w-3xl italic pl-4" style={{ boxShadow: 'inset 2px 0 0 var(--tea-border)' }}>"{item.description}"</p>
                                              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 bg-tea-text/[0.04] rounded-lg p-3 pr-4" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2), inset 0 1px 0 var(--tea-accent-sub)' }}>
                                                  <div className="flex items-center gap-4 px-2">
                                                      <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text/50">Quantity</span>
                                                      <div className="flex items-center rounded-[1px] bg-tea-text/25" style={{ boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.25), inset 0 1px 0 var(--tea-accent-sub)' }}>
                                                          <button onClick={() => updateQuantity(item.id, Math.max(1, currentQty - 1))} disabled={currentQty <= 1} className="px-3 py-1 hover:bg-tea-text/10 transition-colors text-tea-text  disabled:opacity-30">-</button>
                                                          <span className="px-3 py-1 font-mono text-sm min-w-[40px] text-center text-tea-text" style={{ boxShadow: 'inset 1px 0 0 var(--tea-border), inset -1px 0 0 var(--tea-border)' }}>{currentQty}</span>
                                                          <button onClick={() => updateQuantity(item.id, Math.min(maxStock, currentQty + 1))} disabled={currentQty >= maxStock} className="px-3 py-1 hover:bg-tea-text/10 transition-colors text-tea-text  disabled:opacity-30">+</button>
                                                      </div>
                                                      <span className="text-[10px] text-tea-text/40 font-mono">{maxStock} available</span>
                                                  </div>
                                                  <div className="flex-1"></div>
                                                  <button onClick={() => onAddToCart && onAddToCart(item, currentQty, totalPrice)} className="bg-tea-gold hover:bg-tea-gold/90 text-white text-xs uppercase tracking-[0.15em] font-medium py-3 px-8 rounded-lg transition-all active:scale-95 flex items-center justify-center gap-3 shadow-lg min-w-[200px]">
                                                      <span>Add to Cart</span>
                                                      <span className="w-[1px] h-3 bg-tea-gold/20"></span>
                                                      <span className="font-mono text-sm">${totalPrice.toLocaleString()}</span>
                                                  </button>
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
  );
};
