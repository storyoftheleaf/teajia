import React, { useState, useMemo } from 'react';
import { Loader2, Search, UserCheck, ArrowUpDown, ArrowUp, ArrowDown, Pencil, AlertCircle, Sparkles } from 'lucide-react';
import Fuse from 'fuse.js';
import { Product } from '../types';
import { AddProductModal } from './AddProductModal';
import { useRates } from '../hooks/useAdminData';
import { formatCurrency } from '../utils';
import { getThemeColor } from '../themeUtils';

const ROW_HEIGHT = 36;

export const PersonalCollectionView = ({ products, isLoading, onRefresh }: { products: Product[], isLoading: boolean, onRefresh: () => void }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' }>({ key: 'productName', direction: 'asc' });

  const { data: rates = [] } = useRates();

  const personalProducts = useMemo(() => {
    return products.filter(p => p.isPersonal);
  }, [products]);

  const fuse = useMemo(() => new Fuse(personalProducts, {
    keys: ['givenName', 'productName', 'year', 'vendor', 'originRegion'],
    threshold: 0.3,
  }), [personalProducts]);

  const filteredProducts = useMemo(() => {
    let result = personalProducts;
    if (searchQuery) {
      result = fuse.search(searchQuery).map(r => r.item);
    }
    return result;
  }, [personalProducts, searchQuery, fuse]);

  const sortedProducts = useMemo(() => {
      return [...filteredProducts].sort((a, b) => {
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
  }, [filteredProducts, sortConfig]);

  const handleSort = (key: keyof Product) => {
      setSortConfig(prev => ({
        key,
        direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
      }));
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
    return <div className="p-12 text-center text-tea-text-sec font-serif italic"><Loader2 className="animate-spin inline mr-2" /> Loading collection...</div>;
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-tea-bg">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-tea-bg/90 backdrop-blur-md border-b border-tea-border py-2.5">
        <div className="px-6 max-w-7xl mx-auto flex items-center gap-4">
            <div className="flex items-center gap-2 shrink-0">
                <UserCheck size={16} className="text-tea-accent" />
                <h2 className="text-sm font-serif text-tea-text uppercase tracking-[0.15em]">
                    Private Collection
                </h2>
                <span className="text-tea-text-sec text-xs tracking-wide">
                    — {sortedProducts.length} items
                </span>
            </div>
            <div className="relative w-48 ml-auto">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
                <input
                type="text"
                placeholder="Search collection..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent border-b border-tea-border rounded-none pl-9 pr-3 py-1.5 text-xs text-tea-text outline-none focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
                />
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6">
        {sortedProducts.length === 0 ? (
            <div className="text-center py-16 text-tea-text-sec font-serif italic">
                <AlertCircle size={32} className="inline opacity-30 mb-2" /><br />
                Your collection is empty.<br />
                <span className="text-xs font-sans not-italic">Mark items as "Personal Collection" in the product editor.</span>
            </div>
        ) : (
          <>
            {/* Mobile list */}
            <div className="md:hidden pb-24">
              {sortedProducts.map((product, idx) => {
                const dotColor = getThemeColor(product.type);
                const estValue = product.stockGrams * product.costPerGramUSD;
                return (
                  <button
                    key={product.id}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors active:bg-tea-surface/80 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'}`}
                    onClick={() => setEditingProduct(product)}
                  >
                    <span className="flex-shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-tea-text text-sm font-serif truncate">{product.productName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-tea-text-sec/70 mt-0.5">
                        <span>{product.type}</span>
                        {product.vendor && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="truncate">{product.vendor}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-xs text-tea-text/80 tabular-nums">{product.stockGrams}g</div>
                      <div className="text-[10px] text-tea-text-sec/60 tabular-nums">{formatCurrency(estValue, 'USD', rates)}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="w-full max-w-7xl mx-auto bg-tea-surface min-h-full hidden md:block">
                <table className="w-full table-fixed border-collapse">
                    <colgroup>
                        <col className="w-[30%]" />
                        <col className="w-[10%]" />
                        <col className="w-[8%]" />
                        <col className="w-[14%]" />
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        <col className="w-[10%]" />
                        <col className="w-[6%]" />
                    </colgroup>
                    <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
                        <tr>
                            <SortHeader colKey="productName" label="Product" />
                            <SortHeader colKey="type" label="Cat." />
                            <SortHeader colKey="year" label="Year" />
                            <SortHeader colKey="vendor" label="Source" />
                            <SortHeader colKey="stockGrams" label="Stock" align="right" />
                            <SortHeader colKey="costAmount" label="Batch Cost" align="right" />
                            <th className="px-4 py-2 border-b border-tea-border text-right text-[10px] uppercase tracking-wider font-serif text-tea-text-sec">Asset Value</th>
                            <th className="px-4 py-2 border-b border-tea-border"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedProducts.map(product => {
                            const dotColor = getThemeColor(product.type);
                            const estValue = product.stockGrams * product.costPerGramUSD;

                            return (
                                <tr
                                    key={product.id}
                                    onClick={() => setEditingProduct(product)}
                                    className="transition-colors border-b border-tea-border group hover:bg-tea-bg/50 cursor-pointer"
                                    style={{ height: ROW_HEIGHT }}
                                >
                                    <td className="px-4 align-middle overflow-hidden">
                                        <div className="flex flex-col justify-center h-full">
                                            <span className="text-sm font-serif text-tea-text tracking-wide group-hover:text-tea-accent transition-colors truncate flex items-center gap-2">
                                                {product.productName || '—'}
                                                {product.showWisdom && product.lore && (
                                                    <span title={product.isCustomWisdom ? "Handcrafted Wisdom" : "AI Generated Wisdom"}>
                                                        {product.isCustomWisdom ? (
                                                            <Pencil size={10} className="text-tea-accent" />
                                                        ) : (
                                                            <Sparkles size={10} className="text-tea-text-sec" />
                                                        )}
                                                    </span>
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
                                        <span className="text-xs text-tea-text-sec font-serif italic">{product.year || 'N.V.'}</span>
                                    </td>
                                    <td className="px-4 align-middle overflow-hidden">
                                        <span className="text-xs text-tea-text-sec truncate block">{product.vendor || 'Unknown'}</span>
                                    </td>
                                    <td className="px-4 align-middle overflow-hidden text-right">
                                        <span className="num text-xs text-tea-text">{product.stockGrams}g</span>
                                    </td>
                                    <td className="px-4 align-middle overflow-hidden text-right">
                                        <span className="num text-xs text-tea-text-sec">
                                            {product.costAmount > 0
                                                ? `${product.costAmount} ${product.costCurrency}`
                                                : '-'}
                                        </span>
                                    </td>
                                    <td className="px-4 align-middle overflow-hidden text-right">
                                        <span className="num text-xs text-tea-text">{formatCurrency(estValue, 'USD', rates)}</span>
                                    </td>
                                    <td className="px-4 align-middle text-right">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setEditingProduct(product); }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-tea-text-sec hover:text-tea-text p-1"
                                        >
                                            <Pencil size={14} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
          </>
        )}
      </div>

      <AddProductModal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        initialData={editingProduct}
        onSuccess={() => { setEditingProduct(null); onRefresh(); }}
        rates={rates}
      />
    </div>
  );
};
