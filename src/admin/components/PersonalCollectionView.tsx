import React, { useState, useMemo } from 'react';
import { Loader2, Search, UserCheck, ArrowUpDown, ArrowUp, ArrowDown, Pencil, AlertCircle, Sparkles } from 'lucide-react';
import Fuse from 'fuse.js';
import { Product } from '../types';
import { AddProductModal } from './AddProductModal';
import { useRates } from '../hooks/useAdminData';
import { formatCurrency } from '../utils';

// Reuse theme styles for consistency
const getThemeColor = (type: string) => {
  switch (type) {
    case 'Green': return '#859F85'; // Sage
    case 'Yellow': return '#D4C586'; // Straw
    case 'White': return '#D6D3CD'; // Bone
    case 'Oolong': return '#C4A484'; // Roasted Amber
    case 'Red': return '#A67B70'; // Terracotta
    case 'Dark': return '#8B8C89'; // Slate
    case 'Shou': return '#5C544E'; // Loam
    case 'Sheng': return '#98A67B'; // Raw Leaf
    case 'Herbal': return '#BFA09E'; // Dried Flower
    case 'Matcha': return '#6F8C60'; // Matcha
    case 'Flower': return '#B596A6'; // Lavender/Rose
    default: return '#737373';
  }
};

export const PersonalCollectionView = ({ products, isLoading, onRefresh }: { products: Product[], isLoading: boolean, onRefresh: () => void }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof Product; direction: 'asc' | 'desc' } | null>({ key: 'productName', direction: 'asc' });
  
  const { data: rates = [] } = useRates();

  const personalProducts = useMemo(() => {
    return products.filter(p => p.isPersonal);
  }, [products]);

  // Search Logic
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

  // Sort Logic
  const sortedProducts = useMemo(() => {
      if (!sortConfig) return filteredProducts;
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
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };

  const SortHeader = ({ colKey, label, align = 'left' }: { colKey: keyof Product, label: string, align?: 'left' | 'right' | 'center' }) => (
      <th 
        className={`py-3 px-4 cursor-pointer hover:text-tea-text transition-colors group select-none text-${align} border-b border-tea-border text-[10px] uppercase tracking-[0.2em] text-tea-text-sec`} 
        onClick={() => handleSort(colKey)}
      >
        <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : ''}`}>
           {label}
           {sortConfig?.key === colKey ? (
               sortConfig.direction === 'asc' ? <ArrowUp size={10} className="ml-1 text-tea-text-sec" /> : <ArrowDown size={10} className="ml-1 text-tea-text-sec" />
           ) : <ArrowUpDown size={10} className="ml-1 text-tea-border opacity-0 group-hover:opacity-100" />}
        </div>
      </th>
  );

  if (isLoading) {
    return <div className="p-12 text-center text-tea-text-sec flex justify-center items-center"><Loader2 className="animate-spin mr-2" /> Loading collection...</div>;
  }

  return (
    <div className="min-h-screen pb-24 md:pb-0 bg-tea-bg">
      
      {/* Header */}
      <div className="sticky top-0 z-30 bg-tea-bg/90 backdrop-blur-md border-b border-tea-border py-4">
        <div className="px-4 md:px-12 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-end gap-4">
            <div>
                <h2 className="text-2xl font-serif text-tea-text flex items-center gap-3">
                    <UserCheck size={20} className="text-tea-accent" /> Private Collection
                </h2>
                <p className="text-tea-text-sec text-xs uppercase tracking-[0.2em] mt-1">Personal Holding • Not Listed in Catalog</p>
            </div>
            <div className="relative w-full md:w-64">
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

      <div className="p-4 md:px-12 max-w-7xl mx-auto mt-6">
        {sortedProducts.length === 0 ? (
            <div className="py-24 text-center text-tea-text-sec border border-tea-border rounded-xl bg-tea-surface">
                <div className="flex flex-col items-center gap-4">
                    <AlertCircle size={32} opacity={0.3} />
                    <span className="font-serif italic">Your collection is empty.</span>
                    <p className="text-xs">Mark items as "Personal Collection" in the product editor.</p>
                </div>
            </div>
        ) : (
            <div className="rounded-xl border border-tea-border bg-tea-surface overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-tea-bg text-tea-text-sec font-serif uppercase tracking-[0.2em] text-xs border-b border-tea-border">
                            <tr>
                                <SortHeader colKey="productName" label="Product" />
                                <SortHeader colKey="type" label="Cat." />
                                <SortHeader colKey="year" label="Year" />
                                <SortHeader colKey="vendor" label="Source" />
                                <SortHeader colKey="stockGrams" label="Stock" align="right" />
                                <SortHeader colKey="costAmount" label="Batch Cost" align="right" />
                                <th className="py-3 px-4 text-right cursor-pointer group select-none text-[10px] uppercase tracking-[0.2em] text-tea-text-sec">
                                    <div className="flex items-center justify-end gap-1">Asset Value</div>
                                </th>
                                <th className="py-3 px-4 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-tea-border">
                            {sortedProducts.map(product => {
                                const dotColor = getThemeColor(product.type);
                                // Estimated Value = Cost Price * Stock (Asset Value)
                                // Calculates true underlying value based on what you paid + shipping
                                const estValue = product.stockGrams * product.costPerGramUSD;

                                return (
                                    <tr 
                                        key={product.id} 
                                        onClick={() => setEditingProduct(product)}
                                        className="hover:bg-tea-bg/50 transition-colors group cursor-pointer"
                                    >
                                        <td className="py-2 px-4">
                                            <div className="font-serif text-tea-text text-sm tracking-wide group-hover:text-tea-accent transition-colors flex items-center gap-2">
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
                                            </div>
                                            <div className="text-[10px] text-tea-text-sec font-sans mt-0.5">
                                                <span>{product.givenName}</span>
                                            </div>
                                        </td>
                                        <td className="py-2 px-4">
                                            <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-tea-text-sec">
                                                <span style={{ color: dotColor, fontSize: '10px' }}>●</span> {product.type}
                                            </span>
                                        </td>
                                        <td className="py-2 px-4 text-tea-text-sec text-xs font-serif italic">{product.year || 'N.V.'}</td>
                                        <td className="py-2 px-4 text-tea-text-sec text-xs">{product.vendor || 'Unknown'}</td>
                                        
                                        <td className="py-2 px-4 text-right font-mono text-xs text-tea-text">
                                            {product.stockGrams}g
                                        </td>
                                        
                                        <td className="py-2 px-4 text-right font-mono text-xs text-tea-text-sec">
                                            {product.costAmount > 0 
                                                ? `${product.costAmount} ${product.costCurrency}` 
                                                : '-'}
                                        </td>
                                        
                                        <td className="py-2 px-4 text-right font-mono text-xs text-tea-text">
                                            {formatCurrency(estValue, 'USD', rates)}
                                        </td>

                                        <td className="py-2 px-4 text-right">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingProduct(product); }}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity text-tea-text-sec hover:text-tea-text"
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
            </div>
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