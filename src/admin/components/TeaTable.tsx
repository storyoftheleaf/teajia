import React, { useState, useMemo } from 'react';
import { Search, Loader2, AlertCircle, Plus, ArrowUpDown, ArrowUp, ArrowDown, EyeOff, Star, Sparkles, Pencil, Leaf, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import Fuse from 'fuse.js';
import { Product, Currency, ExchangeRate, ProductType } from '../types';
import { formatCurrency } from '../utils';
import { getThemeColor } from '../themeUtils';
import { TeaDetailsModal } from './TeaDetailsModal';

const ROW_HEIGHT = 36;

interface TeaTableProps {
  products: Product[];
  currency: Currency;
  rates: ExchangeRate[];
  onAdd: (product: Product) => void;
  isAdmin: boolean;
  isLoading: boolean;
  isError?: boolean;
  error?: Error | null;
  onEdit?: (product: Product) => void;
  onRefresh?: () => void;
  /** Skip default Active/non-Teaware/non-Personal filter — show all passed products */
  showAll?: boolean;
  /** Override header title */
  title?: string;
  /** Render custom content above the filter bar */
  headerSlot?: React.ReactNode;
  /** Inline mode — auto height instead of full viewport */
  inline?: boolean;
}

export const TeaTable: React.FC<TeaTableProps> = ({
  products, currency, rates, onAdd, isAdmin, isLoading, isError, error, onEdit, onRefresh, showAll, title, headerSlot, inline
}) => {
  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' }>({ key: 'productName', direction: 'asc' });

  const teaTypes: ProductType[] = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Sheng', 'Shou', 'Dark', 'Herbal', 'Misc'];

  const activeProducts = useMemo(() => {
    if (showAll) return products;
    return products.filter(p => {
      if (p.status !== 'Active' || p.type === 'Teaware' || p.isPersonal) return false;
      if (!isAdmin && !p.isPublic) return false;
      return true;
    });
  }, [products, isAdmin, showAll]);

  const fuse = useMemo(() => new Fuse(activeProducts, {
    keys: ['givenName', 'productName', 'originRegion', 'originCountry', 'year', 'tastingNotes'],
    threshold: 0.3,
    ignoreLocation: true,
  }), [activeProducts]);

  const filteredProducts = useMemo(() => {
    let result = activeProducts;
    if (searchQuery) {
      result = fuse.search(searchQuery).map(r => r.item);
    }
    if (filter === 'Featured') {
      result = result.filter(p => p.isFeatured);
    } else if (filter !== 'All') {
      result = result.filter(p => p.type === filter);
    }
    return result;
  }, [activeProducts, filter, searchQuery, fuse]);

  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortConfig.direction === 'asc'
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        }
        return sortConfig.direction === 'asc'
            ? (aVal < bVal ? -1 : 1)
            : (aVal > bVal ? -1 : 1);
    });
  }, [filteredProducts, sortConfig]);

  const handleSort = (key: keyof Product) => {
      setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
      }));
  };

  const getCount = (type: string) => {
    if (type === 'All') return activeProducts.length;
    return activeProducts.filter(p => p.type === type).length;
  };

  const SortHeader = ({ colKey, label, align = 'left' }: { colKey: keyof Product, label: string, align?: 'left' | 'right' | 'center' }) => (
      <th
        className={`px-4 py-2 cursor-pointer hover:text-tea-text transition-colors select-none border-b border-tea-border group text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-${align} truncate`}
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

  if (isLoading) {
    return <div className="p-12 text-center text-tea-text-sec font-serif italic"><Loader2 className="animate-spin inline mr-2" /> Accessing Archives...</div>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center h-full">
        <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20 mb-6">
          <AlertCircle className="text-red-400" size={32} />
        </div>
        <h2 className="text-lg font-serif text-tea-text mb-2">Failed to load catalog</h2>
        <p className="text-tea-text-sec text-sm mb-6 max-w-md">
          {error?.message || 'Could not connect to the server. Please check your connection and try again.'}
        </p>
        {onRefresh && (
          <button onClick={onRefresh} className="bg-tea-gold text-tea-bg px-6 py-3 rounded-xl text-sm font-medium hover:bg-tea-gold/90 transition-colors">
            Try Again
          </button>
        )}
      </div>
    );
  }

  const handleNext = () => {
    if (!selectedProduct) return;
    const currentIndex = sortedProducts.findIndex(p => p.id === selectedProduct.id);
    if (currentIndex < sortedProducts.length - 1) {
      setSelectedProduct(sortedProducts[currentIndex + 1]);
    }
  };

  const handlePrev = () => {
    if (!selectedProduct) return;
    const currentIndex = sortedProducts.findIndex(p => p.id === selectedProduct.id);
    if (currentIndex > 0) {
      setSelectedProduct(sortedProducts[currentIndex - 1]);
    }
  };

  return (
    <div className={`${inline ? '' : 'h-full overflow-hidden'} flex flex-col bg-tea-bg`}>

      {/* Header */}
      <div className="sticky top-0 z-30 bg-tea-bg/90 backdrop-blur-md border-b border-tea-border py-2.5">
        <div className="px-6 max-w-7xl mx-auto flex items-center gap-4">
          {headerSlot || (
            <div className="flex items-center gap-2 shrink-0">
              <Leaf size={16} className="text-tea-accent" />
              <h2 className="text-sm font-serif text-tea-text uppercase tracking-[0.15em]">
                {title || 'Tea Glossary'}
              </h2>
              <span className="text-tea-text-sec text-xs tracking-wide">
                — {sortedProducts.length} items
              </span>
            </div>
          )}

          <div className="relative w-48 ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-b border-tea-border rounded-none pl-9 pr-3 py-1.5 text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-tea-bg border-b border-tea-border px-6">
        <div className="max-w-7xl mx-auto flex flex-wrap gap-2 py-2.5" role="tablist" aria-label="Filter by tea type">
          <button
              onClick={() => setFilter('All')}
              role="tab"
              aria-selected={filter === 'All'}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-full border ${filter === 'All' ? 'bg-tea-gold text-tea-bg border-tea-gold' : 'text-tea-text-sec border-tea-border hover:border-tea-text-sec hover:text-tea-text'}`}
          >
              All
          </button>
          {activeProducts.some(p => p.isFeatured) && (
              <button
                  onClick={() => setFilter('Featured')}
                  role="tab"
                  aria-selected={filter === 'Featured'}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-full border flex items-center gap-1 ${filter === 'Featured' ? 'bg-tea-gold text-tea-bg border-tea-gold' : 'text-tea-gold/70 border-tea-border hover:border-tea-gold/60 hover:text-tea-gold'}`}
              >
                  <Star className={`w-3 h-3 ${filter === 'Featured' ? 'fill-tea-bg' : 'fill-tea-gold/70'}`} />
                  Featured
              </button>
          )}
          {teaTypes.map(type => {
            const count = getCount(type);
            if (count === 0) return null;
            const isActive = filter === type;
            return (
              <button
                  key={type}
                  onClick={() => setFilter(type)}
                  role="tab"
                  aria-selected={isActive}
                  className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-full border ${isActive ? 'bg-tea-gold text-tea-bg border-tea-gold' : 'text-tea-text-sec border-tea-border hover:border-tea-text-sec hover:text-tea-text'}`}
              >
                  {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className={`${inline ? '' : 'flex-1 overflow-auto custom-scrollbar'} bg-tea-bg md:px-6`}>

        {sortedProducts.length === 0 ? (
            <div className="text-center py-16 text-tea-text-sec font-serif italic">
                <AlertCircle size={32} className="inline opacity-30 mb-2" /><br />
                No entries found in glossary.<br />
                <button onClick={() => {setFilter('All'); setSearchQuery('')}} className="text-xs font-sans not-italic text-tea-text-sec hover:text-tea-text uppercase tracking-widest border-b border-transparent hover:border-tea-text-sec pb-1 mt-2 transition-colors">Reset</button>
            </div>
        ) : (
          <>
            {/* Mobile list */}
            <div className="md:hidden pb-24">
              {sortedProducts.map((product, idx) => {
                const dotColor = getThemeColor(product.type);
                return (
                  <button
                    key={product.id}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors active:bg-tea-surface/80 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'} ${!product.isPublic ? 'opacity-70' : ''}`}
                    onClick={() => setSelectedProduct(product)}
                  >
                    <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-tea-text text-sm font-serif truncate">{product.productName}</span>
                        {product.isFeatured && <Star size={10} className="flex-shrink-0 text-tea-accent fill-tea-accent" />}
                        {!product.isPublic && <EyeOff size={10} className="flex-shrink-0 text-tea-text-sec/40" />}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-tea-text-sec/70 mt-0.5">
                        <span>{product.type}</span>
                        {product.originRegion && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="truncate">{product.originRegion}</span>
                          </>
                        )}
                        {product.year && (
                          <>
                            <span className="opacity-40">·</span>
                            <span>{product.year}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs text-tea-text/80 tabular-nums">{formatCurrency(product.pricePerGramUSD, currency, rates)}</div>
                      {isAdmin && <div className="text-[10px] text-tea-text-sec/60 tabular-nums flex items-center gap-0.5 justify-end">{product.inTransit && <Package size={9} className="text-tea-gold" />}{Math.round(product.stockGrams)}g</div>}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="w-full max-w-7xl mx-auto bg-tea-surface min-h-full hidden md:block">
                <table className="w-full table-fixed border-collapse">
                    <colgroup>
                        <col className="w-[35%]" />
                        <col className="w-[12%]" />
                        <col className="w-[18%]" />
                        <col className="w-[10%]" />
                        {isAdmin && <col className="w-[10%]" />}
                        <col className="w-[10%]" />
                        <col className="w-[5%]" />
                    </colgroup>
                    <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                        <tr>
                            <SortHeader colKey="productName" label="Product" />
                            <SortHeader colKey="type" label="Cat." />
                            <SortHeader colKey="originRegion" label="Origin" />
                            <SortHeader colKey="year" label="Year" />
                            {isAdmin && <SortHeader colKey="stockGrams" label="Stock" align="right" />}
                            <SortHeader colKey="pricePerGramUSD" label="Price" align="right" />
                            <th className="px-4 py-2 border-b border-tea-border"></th>
                        </tr>
                    </thead>
                    <motion.tbody
                      initial="hidden"
                      animate="visible"
                      variants={{
                        visible: { transition: { staggerChildren: 0.03 } },
                        hidden: {}
                      }}
                    >
                        {sortedProducts.map(product => {
                            const isLowStock = product.stockGrams < product.lowStockThreshold;
                            const dotColor = getThemeColor(product.type);

                            return (
                                <motion.tr
                                    variants={{
                                      hidden: { opacity: 0, y: 10 },
                                      visible: { opacity: 1, y: 0 }
                                    }}
                                    key={product.id}
                                    onClick={() => setSelectedProduct(product)}
                                    className={`transition-colors border-b border-tea-border group hover:bg-tea-bg/50 cursor-pointer ${!product.isPublic ? 'opacity-70' : ''}`}
                                    style={{ height: ROW_HEIGHT }}
                                >
                                    <td className="px-4 align-middle overflow-hidden">
                                        <div className="flex flex-col justify-center h-full">
                                            <span className="text-sm font-serif text-tea-text tracking-wide group-hover:text-tea-gold transition-colors truncate flex items-center gap-2">
                                                {product.productName}
                                                {product.isFeatured && (
                                                    <Star className="w-3 h-3 fill-tea-gold text-tea-gold flex-shrink-0" />
                                                )}
                                                {isAdmin && !product.isPublic && (
                                                    <EyeOff className="w-3 h-3 text-tea-text-sec/70 flex-shrink-0" />
                                                )}
                                                {product.lore && (
                                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${product.isCustomWisdom ? 'bg-tea-gold' : 'bg-tea-text-sec/30'}`} title={product.isCustomWisdom ? "Edited lore" : "AI generated lore"} />
                                                )}
                                            </span>
                                            {product.givenName && (
                                                <span className="text-[10px] text-tea-text-sec font-sans mt-0.5 truncate block">
                                                    {product.givenName}
                                                </span>
                                            )}
                                        </div>
                                    </td>

                                    <td className="px-4 align-middle overflow-hidden">
                                        <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-tea-text-sec truncate">
                                            <span style={{ color: dotColor, fontSize: '10px' }}>&#9679;</span> {product.type}
                                        </span>
                                    </td>

                                    <td className="px-4 align-middle overflow-hidden">
                                        <span className="text-xs text-tea-text-sec font-sans truncate block">{product.originRegion}</span>
                                    </td>

                                    <td className="px-4 align-middle overflow-hidden">
                                        <span className="text-xs num text-tea-text-sec">{product.year || '-'}</span>
                                    </td>

                                    {isAdmin && (
                                        <td className="px-4 align-middle overflow-hidden text-right">
                                            <span className={`num text-xs inline-flex items-center gap-1 justify-end ${product.inTransit ? 'text-tea-gold font-medium' : isLowStock ? 'text-tea-gold font-medium' : 'text-tea-text-sec'}`}>
                                                {product.inTransit && <Package size={10} className="text-tea-gold" />}
                                                {Math.round(product.stockGrams)}g
                                            </span>
                                            {product.inTransit && (product as any).inTransitGrams > 0 && (
                                                <span className="block text-[10px] text-tea-gold/70 tabular-nums text-right">
                                                    +{(product as any).inTransitGrams}g
                                                    {(product as any).inTransitEta && (
                                                        <span className="text-tea-text-dim"> {new Date((product as any).inTransitEta).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                    )}
                                                </span>
                                            )}
                                        </td>
                                    )}

                                    <td className="px-4 align-middle overflow-hidden text-right">
                                        <span className="num text-xs text-tea-text">
                                            {formatCurrency(product.pricePerGramUSD, currency, rates)}
                                        </span>
                                    </td>

                                    <td className="px-4 align-middle text-right">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onAdd(product); }}
                                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity min-w-[44px] min-h-[44px] flex items-center justify-center text-tea-text-sec hover:text-tea-text"
                                            aria-label={`Add ${product.productName} to cart`}
                                        >
                                            <Plus size={14} />
                                        </button>
                                    </td>
                                </motion.tr>
                            );
                        })}
                    </motion.tbody>
                </table>
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
        onNext={handleNext}
        onPrev={handlePrev}
        isAdmin={isAdmin}
        onEdit={onEdit}
      />
    </div>
  );
};
