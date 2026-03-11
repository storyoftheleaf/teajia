import React, { useState, useMemo } from 'react';
import { Search, Loader2, AlertCircle, Plus, ArrowUpDown, ArrowUp, ArrowDown, EyeOff, Star, Sparkles, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import Fuse from 'fuse.js';
import { Product, Currency, ExchangeRate, ProductType } from '../types';
import { formatCurrency } from '../utils';
import { getThemeColor } from '../themeUtils';
import { TeaDetailsModal } from './TeaDetailsModal';

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
}

export const TeaTable: React.FC<TeaTableProps> = ({
  products, currency, rates, onAdd, isAdmin, isLoading, isError, error, onEdit, onRefresh
}) => {
  const [filter, setFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>({ key: 'productName', direction: 'asc' });

  const teaTypes: ProductType[] = ['Green', 'White', 'Yellow', 'Oolong', 'Red', 'Sheng', 'Shou', 'Dark', 'Herbal', 'Matcha', 'Flower', 'Misc'];

  // Only show Active products AND NOT PERSONAL in the Catalog/POS view
  const activeProducts = useMemo(() => {
    return products.filter(p => {
      if (p.status !== 'Active' || p.type === 'Teaware' || p.isPersonal) return false;
      if (!isAdmin && !p.isPublic) return false;
      return true;
    });
  }, [products, isAdmin]);

  const fuse = useMemo(() => new Fuse(activeProducts, {
    keys: ['givenName', 'productName', 'originRegion', 'originCountry', 'year', 'tastingNotes'],
    threshold: 0.3,
  }), [activeProducts]);

  const filteredProducts = useMemo(() => {
    let result = activeProducts; 
    
    // Apply Search
    if (searchQuery) {
      result = fuse.search(searchQuery).map(r => r.item);
    }

    // Apply Filter
    if (filter === 'Featured') {
      result = result.filter(p => p.isFeatured);
    } else if (filter !== 'All') {
      result = result.filter(p => p.type === filter);
    }

    return result;
  }, [activeProducts, filter, searchQuery, fuse]);

  const sortedProducts = useMemo(() => {
    if (!sortConfig) return filteredProducts;
    
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
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const getCount = (type: string) => {
    if (type === 'All') return activeProducts.length;
    return activeProducts.filter(p => p.type === type).length;
  };

  const SortIcon = ({ colKey }: { colKey: keyof Product }) => {
      if (sortConfig?.key !== colKey) return <ArrowUpDown size={10} className="ml-1 text-tea-text-dim/30 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-40 transition-opacity" />;
      return sortConfig.direction === 'asc'
        ? <ArrowUp size={10} className="ml-1 text-tea-text-sec" />
        : <ArrowDown size={10} className="ml-1 text-tea-text-sec" />;
  };

  const HeaderCell = ({ colKey, label, align = 'left' }: { colKey: keyof Product, label: string, align?: 'left' | 'right' | 'center' }) => (
      <th 
        className={`py-4 px-4 cursor-pointer hover:text-tea-text transition-colors group select-none text-${align} border-b border-tea-border font-serif italic text-tea-text-dim uppercase tracking-[0.2em] text-xs sticky top-0 z-10 bg-tea-bg/90 backdrop-blur-md truncate`} 
        onClick={() => handleSort(colKey)}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
           {label}
           <SortIcon colKey={colKey} />
        </div>
      </th>
  );

  if (isLoading) {
    return <div className="p-12 text-center text-tea-text-dim flex justify-center items-center h-full"><Loader2 className="animate-spin mr-2" /> Accessing Archives...</div>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center h-full">
        <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20 mb-6">
          <AlertCircle className="text-red-400" size={32} />
        </div>
        <h2 className="text-lg font-serif text-tea-text mb-2">Failed to load catalog</h2>
        <p className="text-tea-text-dim text-sm mb-6 max-w-md">
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
    <div className="space-y-8 p-4 md:p-12 max-w-7xl mx-auto pb-24">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6">
        <div>
            <h2 className="text-4xl md:text-5xl font-serif text-tea-text mb-2 tracking-tight">Tea Glossary</h2>
            <p className="text-tea-text-dim text-sm font-light tracking-wide">Essential terms and definitions for inventory.</p>
        </div>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-end">
            {/* Search Input - Sleek Box */}
            <div className="relative w-full md:w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim group-focus-within:text-tea-gold transition-colors" size={14} />
                <input 
                type="text" 
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-b border-tea-border rounded-none pl-9 pr-3 py-2 text-sm text-tea-text outline-none focus:border-tea-gold transition-all font-sans placeholder-tea-text-dim/50"
                />
            </div>
        </div>
      </div>
      
      {/* Filters - Pills to Tags */}
      <div className="flex flex-wrap gap-2 w-full border-b border-tea-border pb-6" role="tablist" aria-label="Filter by tea type">
            <button
                onClick={() => setFilter('All')}
                role="tab"
                aria-selected={filter === 'All'}
                className={`px-4 py-2 md:py-1.5 text-xs md:text-[10px] font-bold uppercase tracking-[0.15em] transition-all rounded-full border focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none ${filter === 'All' ? 'bg-tea-text text-tea-bg border-tea-text' : 'text-tea-text-dim border-tea-border hover:border-tea-text-dim hover:text-tea-text'}`}
            >
                All
            </button>
            {activeProducts.some(p => p.isFeatured) && (
                <button
                    onClick={() => setFilter('Featured')}
                    role="tab"
                    aria-selected={filter === 'Featured'}
                    className={`px-4 py-2 md:py-1.5 text-xs md:text-[10px] font-bold uppercase tracking-[0.15em] transition-all rounded-full border flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none ${filter === 'Featured' ? 'bg-tea-gold text-tea-bg border-tea-gold' : 'text-tea-gold/70 border-tea-gold/30 hover:border-tea-gold/60 hover:text-tea-gold'}`}
                >
                    <Star size={10} className={filter === 'Featured' ? 'fill-tea-bg' : 'fill-tea-gold/70'} />
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
                    className={`px-4 py-2 md:py-1.5 text-xs md:text-[10px] font-bold uppercase tracking-[0.15em] transition-all rounded-full border focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none ${isActive ? `bg-tea-text text-tea-bg border-tea-text` : 'text-tea-text-dim border-tea-border hover:border-tea-text-dim hover:text-tea-text'}`}
                >
                    {type}
                </button>
              );
            })}
      </div>

      {/* ADVANCED TABLE */}
      {sortedProducts.length === 0 ? (
           <div className="py-24 text-center text-tea-text-dim border border-tea-border rounded-2xl bg-tea-surface/50">
               <div className="flex flex-col items-center gap-4">
                   <AlertCircle size={32} opacity={0.3} />
                   <span className="font-serif italic text-lg">No entries found in glossary.</span>
                   <button onClick={() => {setFilter('All'); setSearchQuery('')}} className="text-tea-text-dim text-xs hover:text-tea-text uppercase tracking-widest border-b border-transparent hover:border-tea-text-dim pb-1 transition-all">Reset</button>
               </div>
           </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-tea-border bg-tea-surface shadow-2xl">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed">
                    <colgroup>
                        <col className="w-[35%]" />
                        <col className="w-[12%]" />
                        <col className="w-[18%]" />
                        <col className="w-[10%]" />
                        {isAdmin && <col className="w-[10%]" />}
                        <col className="w-[10%]" />
                        <col className="w-[5%]" />
                    </colgroup>
                    <thead>
                        <tr>
                            <HeaderCell colKey="productName" label="Product" />
                            <HeaderCell colKey="type" label="Cat." />
                            <HeaderCell colKey="originRegion" label="Origin" />
                            <HeaderCell colKey="year" label="Year" />
                            {isAdmin && <HeaderCell colKey="stockGrams" label="Stock" align="right" />}
                            <HeaderCell colKey="pricePerGramUSD" label="Price" align="right" />
                            <th className="py-2 px-4 text-right border-b border-tea-border sticky top-0 z-10 bg-tea-bg/90 backdrop-blur-md"></th>
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
                                    className="group hover:bg-tea-bg/50 transition-colors cursor-pointer border-b border-tea-border last:border-0 h-[60px]"
                                >
                                    <td className="py-3 px-4 align-middle">
                                        <div className="flex flex-col justify-center h-full overflow-hidden">
                                            <span className="font-serif text-tea-text text-base tracking-wide group-hover:text-tea-gold transition-colors truncate flex items-center gap-2">
                                                {product.productName}
                                                {product.isFeatured && (
                                                    <Star size={12} className="fill-tea-gold text-tea-gold" />
                                                )}
                                                {isAdmin && !product.isPublic && (
                                                    <EyeOff size={12} className="text-tea-text-dim/70" />
                                                )}
                                                {product.showWisdom && product.lore && (
                                                    <span title={product.isCustomWisdom ? "Handcrafted Wisdom" : "AI Generated Wisdom"}>
                                                        {product.isCustomWisdom ? (
                                                            <Pencil size={10} className="text-tea-gold" />
                                                        ) : (
                                                            <Sparkles size={10} className="text-tea-text-dim" />
                                                        )}
                                                    </span>
                                                )}
                                            </span>
                                            {product.givenName && (
                                                <span className="text-[11px] text-tea-text-dim font-sans italic mt-0.5 truncate block">
                                                    {product.givenName}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    
                                    <td className="py-3 px-4 align-middle overflow-hidden">
                                        <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-tea-text-dim truncate">
                                            <span style={{ color: dotColor, fontSize: '10px' }}>●</span> {product.type}
                                        </span>
                                    </td>

                                    <td className="py-3 px-4 text-xs text-tea-text-dim font-sans align-middle truncate">
                                        {product.originRegion}
                                    </td>

                                    <td className="py-3 px-4 text-xs num text-tea-text-dim/70 align-middle truncate">
                                        {product.year || '-'}
                                    </td>

                                    {isAdmin && (
                                        <td className="py-3 px-4 text-right num text-xs align-middle truncate">
                                            <span className={isLowStock ? 'text-tea-gold font-medium' : 'text-tea-text-dim'}>
                                                {product.stockGrams}g
                                            </span>
                                        </td>
                                    )}

                                    <td className="py-3 px-4 text-right align-middle truncate">
                                        <span className="num text-tea-text text-sm">
                                            {formatCurrency(product.pricePerGramUSD, currency, rates)}
                                        </span>
                                    </td>

                                    <td className="py-3 px-4 text-right align-middle">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onAdd(product); }}
                                            className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-60 focus-visible:opacity-100 transition-opacity p-3 md:p-2 border border-tea-border rounded-full hover:bg-tea-gold hover:text-tea-bg text-tea-text-dim hover:border-tea-gold focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:outline-none"
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
        </div>
      )}

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