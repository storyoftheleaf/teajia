import React, { useState, useMemo } from 'react';
import { Loader2, Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, Pencil, EyeOff, Sparkles, Coffee, LayoutGrid, LayoutList } from 'lucide-react';
import { motion } from 'framer-motion';
import Fuse from 'fuse.js';
import { Product, Currency, ExchangeRate } from '../types';
import { formatCurrency } from '../utils';
import { TeaIllustration } from './TeaIllustration';
import { TeaDetailsModal } from './TeaDetailsModal';
import { fmtNum } from '../../utils/formatNumber';

// --- Card view component (product view) ---
const TeawareCard: React.FC<{
  product: Product;
  currency: Currency;
  rates: ExchangeRate[];
  onAdd: (product: Product) => void;
  isAdmin: boolean;
}> = ({ product, currency, rates, onAdd, isAdmin }) => (
  <motion.div
    variants={{
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 }
    }}
    className="group relative border border-tea-border bg-tea-surface overflow-hidden hover:border-tea-text-sec/50 transition-all duration-500 flex flex-col rounded-lg shadow-2xl"
  >
    <div className="aspect-[4/3] overflow-hidden relative bg-tea-bg/50 flex items-center justify-center">
      {product.imageUrl ? (
          <img src={product.imageUrl} alt={product.givenName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80 group-hover:opacity-100" loading="lazy" />
      ) : (
          <div className="w-1/2 h-1/2 opacity-30 group-hover:opacity-50 group-hover:scale-110 transition-all duration-700">
              <TeaIllustration type={product.type} />
          </div>
      )}
      <button onClick={() => onAdd(product)} className="absolute bottom-4 right-4 bg-tea-gold text-tea-bg p-3 rounded-full shadow-2xl opacity-0 translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 hover:scale-110" title="Add to Invoice">
        <Plus size={20} />
      </button>
    </div>
    <div className="p-6 flex-1 flex flex-col justify-between">
      <div>
        <h3 className="font-serif text-xl text-tea-text tracking-wide flex items-center gap-2">
            {product.givenName || product.productName}
            {isAdmin && !product.isPublic && (
                <EyeOff size={16} className="text-tea-text-sec/70" />
            )}
            {product.lore && (
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${product.isCustomWisdom ? 'bg-tea-gold' : 'bg-tea-text-sec/30'}`} title={product.isCustomWisdom ? "Edited lore" : "AI generated lore"} />
            )}
        </h3>
        <p className="text-ui-10 text-tea-text-sec uppercase tracking-[0.2em] mt-2">{product.originRegion}</p>
      </div>
      <div className="mt-6 pt-6 border-t border-tea-border flex justify-between items-end">
        <p className="text-sm text-tea-text-sec line-clamp-2 pr-4 font-light leading-relaxed">{product.description}</p>
        <p className="font-mono text-lg text-tea-text whitespace-nowrap">{formatCurrency(product.pricePerGramUSD, currency, rates)}</p>
      </div>
    </div>
  </motion.div>
);

// --- Main Component ---
export const TeawareCatalog = ({ products, currency, rates, onAdd, loading, isAdmin, onEdit }: { products: Product[], currency: Currency, rates: ExchangeRate[], onAdd: (p: Product) => void, loading: boolean, isAdmin: boolean, onEdit?: (product: Product) => void }) => {
  const [viewMode, setViewMode] = useState<'database' | 'product'>('database');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' }>({ key: 'teawareCategory', direction: 'asc' });
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Filter for Active Teaware items
  const teaware = useMemo(() => products.filter(p => {
    if (p.type !== 'Teaware' || p.status !== 'Active') return false;
    if (!isAdmin && !p.isPublic) return false;
    return true;
  }), [products, isAdmin]);

  // Search
  const fuse = useMemo(() => new Fuse(teaware, {
    keys: ['givenName', 'productName', 'material', 'teawareCategory', 'originRegion', 'description'],
    threshold: 0.3,
    ignoreLocation: true,
  }), [teaware]);

  const filtered = useMemo(() => {
    if (!searchQuery) return teaware;
    return fuse.search(searchQuery).map(r => r.item);
  }, [teaware, searchQuery, fuse]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortConfig.direction === 'asc' ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
    });
  }, [filtered, sortConfig]);

  const handleSort = (key: keyof Product) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const SortHeader = ({ colKey, label, align = 'left' }: { colKey: keyof Product, label: string, align?: 'left' | 'right' | 'center' }) => (
    <th
      className={`px-4 py-2 cursor-pointer hover:text-tea-text transition-colors select-none border-b border-tea-border group text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-${align} truncate`}
      onClick={() => handleSort(colKey)}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
        {label}
        <div className="flex-shrink-0 relative z-0 flex items-center">
          {sortConfig.key === colKey ? (
            sortConfig.direction === 'asc' ? <ArrowUp size={10} className="ml-1 text-tea-text-sec" /> : <ArrowDown size={10} className="ml-1 text-tea-text-sec" />
          ) : <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-100 text-tea-text-sec/50 ml-1 transition-opacity" />}
        </div>
      </div>
    </th>
  );

  const ROW_HEIGHT = 36;

  if (loading) {
    return <div className="p-12 text-center text-tea-text-sec font-serif italic"><Loader2 className="animate-spin inline mr-2" /> Loading teaware...</div>;
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">

      {/* --- HEADER CONTROLS (matches InventoryView) --- */}
      <div className="sticky top-0 z-sticky bg-tea-bg/90 backdrop-blur-md border-b border-tea-border px-4 md:px-6 lg:px-10 pt-6 pb-3">
        <div className="max-w-7xl mx-auto flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="h2 text-tea-text">Equipment</h1>
            <div className="label-caps text-tea-text-dim mt-1">Teaware · {sorted.length} items</div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
              <input
                type="text"
                placeholder="Search teaware..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-b border-tea-border rounded-none pl-9 pr-3 py-1.5 text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
              />
            </div>

            {/* View Toggle — icon button pair, no segmented pill */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('database')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'database' ? 'text-tea-text bg-tea-accent-sub' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                title="Database View"
                aria-label="Database view"
              >
                <LayoutList size={14} />
              </button>
              <button
                onClick={() => setViewMode('product')}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'product' ? 'text-tea-text bg-tea-accent-sub' : 'text-tea-text-dim hover:text-tea-text-sec'}`}
                title="Product View"
                aria-label="Product view"
              >
                <LayoutGrid size={14} />
              </button>
            </div>

            <button
              onClick={() => { if (products.length > 0) onAdd(products[0]); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors"
            >
              <Plus size={13} />
              <span>New</span>
            </button>
          </div>
        </div>
      </div>

      {/* --- CONTENT --- */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6">

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
            <Coffee size={28} strokeWidth={1.25} className="text-tea-text-dim mb-3" />
            <div className="font-display text-ui-17 text-tea-text">No teaware yet</div>
            <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
              Add equipment via the inventory tools or import from a vendor.
            </p>
          </div>
        ) : viewMode === 'product' ? (
          /* --- PRODUCT / CARD VIEW --- */
          <div className="max-w-7xl mx-auto py-6">
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{
                visible: { transition: { staggerChildren: 0.1 } },
                hidden: {}
              }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {sorted.map(product => (
                <TeawareCard key={product.id} product={product} currency={currency} rates={rates} onAdd={onAdd} isAdmin={isAdmin} />
              ))}
            </motion.div>
          </div>
        ) : (
          /* --- DATABASE / TABLE VIEW (default, matches InventoryView) --- */
          <>
            {/* Mobile list */}
            <div className="md:hidden pb-24">
              {sorted.map((product, idx) => (
                <button
                  key={product.id}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors active:bg-tea-surface/80 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'} ${!product.isPublic ? 'opacity-70' : ''}`}
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-tea-text text-sm font-serif truncate">{product.productName}</span>
                      {!product.isPublic && <EyeOff size={10} className="flex-shrink-0 text-tea-text-sec/40" />}
                    </div>
                    <div className="flex items-center gap-1.5 text-ui-10 text-tea-text-sec/70 mt-0.5">
                      {product.teawareCategory && <span className="capitalize">{product.teawareCategory}</span>}
                      {product.material && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="truncate">{product.material}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-tea-text/80 tabular-nums">
                      {product.quantityUnits ?? '-'} units
                    </div>
                    <div className="text-ui-10 text-tea-text-sec/60 tabular-nums">
                      {product.pricePerGramUSD != null ? `$${fmtNum(product.pricePerGramUSD)}` : '-'}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Desktop table */}
            <div className="w-full max-w-7xl mx-auto bg-tea-surface min-h-full hidden md:block">
              <table className="w-full table-fixed border-collapse">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[10%]" />
                  <col className="w-[8%]" />
                  <col className="w-[10%]" />
                  <col className="w-[10%]" />
                  <col className="w-[7%]" />
                </colgroup>
                <thead className="sticky top-0 z-sticky bg-tea-bg shadow-sm">
                  <tr>
                    <SortHeader colKey="productName" label="Product" />
                    <SortHeader colKey="teawareCategory" label="Category" />
                    <SortHeader colKey="material" label="Material" />
                    <SortHeader colKey="capacityMl" label="Capacity" align="right" />
                    <SortHeader colKey="quantityUnits" label="Units" align="right" />
                    <SortHeader colKey="costAmount" label="Cost" align="right" />
                    <SortHeader colKey="pricePerGramUSD" label="Retail" align="right" />
                    <th className="px-4 py-2 border-b border-tea-border"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((product) => (
                    <tr
                      key={product.id}
                      className={`transition-colors border-b border-tea-border group hover:bg-tea-bg/50 cursor-pointer ${!product.isPublic ? 'opacity-70' : ''}`}
                      style={{ height: ROW_HEIGHT }}
                      onClick={() => setSelectedProduct(product)}
                    >
                      {/* Product Name */}
                      <td className="px-4 align-middle overflow-hidden">
                        <div className="flex flex-col justify-center h-full">
                          <span className="text-sm font-serif text-tea-text tracking-wide group-hover:text-tea-readgold transition-colors truncate flex items-center gap-2">
                            {product.productName}
                            {product.lore && (
                              <span title={product.isCustomWisdom ? "Handcrafted Wisdom" : "AI Generated Wisdom"}>
                                {product.isCustomWisdom ? <Pencil size={10} className="text-tea-gold" /> : <Sparkles size={10} className="text-tea-text-sec" />}
                              </span>
                            )}
                          </span>
                          {product.givenName && (
                            <span className="text-ui-10 text-tea-text-sec font-sans mt-0.5 truncate block">
                              {product.givenName}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-4 align-middle overflow-hidden">
                        <span className="text-xs text-tea-text-sec font-sans capitalize truncate block">{product.teawareCategory || '-'}</span>
                      </td>

                      {/* Material */}
                      <td className="px-4 align-middle overflow-hidden">
                        <span className="text-xs text-tea-text-sec font-sans truncate block">{product.material || '-'}</span>
                      </td>

                      {/* Capacity */}
                      <td className="px-4 align-middle overflow-hidden text-right">
                        <span className="num text-xs text-tea-text-sec">{product.capacityMl ? `${product.capacityMl}ml` : '-'}</span>
                      </td>

                      {/* Units */}
                      <td className="px-4 align-middle overflow-hidden text-right">
                        <span className="num text-xs text-tea-text-sec">{product.quantityUnits ?? '-'}</span>
                      </td>

                      {/* Cost */}
                      <td className="px-4 align-middle overflow-hidden text-right">
                        <span className="num text-xs text-tea-text-sec">{product.costAmount > 0 ? product.costAmount.toLocaleString() : '-'}</span>
                      </td>

                      {/* Retail */}
                      <td className="px-4 align-middle overflow-hidden text-right">
                        <span className="num text-xs text-tea-text">{product.pricePerGramUSD != null ? fmtNum(product.pricePerGramUSD) : '-'}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 align-middle text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => onAdd(product)} className="text-tea-text-sec hover:text-tea-text p-1 transition-colors" title="Add to Invoice"><Plus size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {sorted.length === 0 && (
                <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
                  <Coffee size={28} strokeWidth={1.25} className="text-tea-text-dim mb-3" />
                  <div className="font-display text-ui-17 text-tea-text">Nothing here yet</div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Detail Modal */}
      <TeaDetailsModal
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        product={selectedProduct}
        onAdd={onAdd}
        currency={currency}
        rates={rates}
        onNext={selectedProduct ? (() => {
          const idx = sorted.findIndex(p => p.id === selectedProduct.id);
          if (idx < sorted.length - 1) setSelectedProduct(sorted[idx + 1]);
        }) : undefined}
        onPrev={selectedProduct ? (() => {
          const idx = sorted.findIndex(p => p.id === selectedProduct.id);
          if (idx > 0) setSelectedProduct(sorted[idx - 1]);
        }) : undefined}
        isAdmin={isAdmin}
        onEdit={onEdit}
      />
    </div>
  );
};
