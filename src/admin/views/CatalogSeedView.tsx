import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, Check, Search, X, Share2, ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import type { Product } from '../types';

interface NetworkStore {
  id: string;
  slug: string;
  name: string;
  tagline?: string;
  location_city?: string;
  location_country?: string;
}

interface CatalogSeedViewProps {
  products: Product[];
  isLoading: boolean;
}

export const CatalogSeedView: React.FC<CatalogSeedViewProps> = ({ products, isLoading }) => {
  const [stores, setStores] = useState<NetworkStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);

  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [targetAccountId, setTargetAccountId] = useState('');
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');

  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<{ count: number; storeName: string } | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);

  const [productSearch, setProductSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');

  useEffect(() => {
    let cancelled = false;
    setStoresLoading(true);
    api.network.getStores()
      .then((data) => {
        if (!cancelled) setStores(data);
      })
      .catch((err) => {
        if (!cancelled) setStoresError(err?.message || 'Failed to load network stores');
      })
      .finally(() => {
        if (!cancelled) setStoresLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const activeProducts = useMemo(() =>
    products.filter(p => p.status === 'Active'),
    [products]
  );

  const uniqueTypes = useMemo(() => {
    const types = new Set(activeProducts.map(p => p.type).filter(Boolean));
    return ['All', ...Array.from(types).sort()];
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    let list = activeProducts;
    if (typeFilter !== 'All') list = list.filter(p => p.type === typeFilter);
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      list = list.filter(p =>
        (p.givenName || '').toLowerCase().includes(q) ||
        (p.productName || '').toLowerCase().includes(q) ||
        (p.originRegion || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeProducts, typeFilter, productSearch]);

  const filteredStores = useMemo(() => {
    if (!storeSearch.trim()) return stores;
    const q = storeSearch.toLowerCase();
    return stores.filter(s => s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q));
  }, [stores, storeSearch]);

  const selectedStore = stores.find(s => s.id === targetAccountId);

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleSeed = async () => {
    if (!targetAccountId || selectedProductIds.size === 0) return;
    setSeedError(null);
    setSeedResult(null);
    setSeeding(true);
    try {
      const result = await api.catalog.seed(targetAccountId, Array.from(selectedProductIds));
      const storeName = selectedStore?.name || targetAccountId;
      setSeedResult({ count: result.seeded.length, storeName });
      setSelectedProductIds(new Set());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to share products';
      setSeedError(message);
    } finally {
      setSeeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={20} className="animate-spin text-tea-text-dim" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 pt-6 pb-4 space-y-1">
        <h1 className="text-base font-medium text-tea-text tracking-wide">Share to Network</h1>
        <p className="text-xs text-tea-text-dim">Push products from your inventory to another account in the network.</p>
      </div>

      {/* Target account selector */}
      <div className="px-4 pb-4">
        <p className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-2">Target Account</p>
        {storesLoading ? (
          <div className="flex items-center gap-2 text-tea-text-dim text-xs">
            <Loader2 size={13} className="animate-spin" />
            <span>Loading accounts…</span>
          </div>
        ) : storesError ? (
          <p className="text-xs text-red-400">{storesError}</p>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setStoreDropdownOpen(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-tea-surface border border-tea-border text-sm text-left hover:border-tea-text-dim transition-colors"
            >
              <span className={selectedStore ? 'text-tea-text' : 'text-tea-text-dim'}>
                {selectedStore ? selectedStore.name : 'Select a store…'}
              </span>
              <ChevronDown size={13} className="text-tea-text-dim shrink-0" />
            </button>

            {storeDropdownOpen && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-tea-surface border border-tea-border rounded-lg shadow-lg overflow-hidden">
                <div className="p-2 border-b border-tea-border">
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                    <input
                      type="text"
                      value={storeSearch}
                      onChange={e => setStoreSearch(e.target.value)}
                      placeholder="Search stores…"
                      className="w-full pl-7 pr-3 py-1.5 text-xs bg-tea-bg rounded-md outline-none text-tea-text placeholder:text-tea-text-dim"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredStores.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-tea-text-dim text-center">No stores found</p>
                  ) : filteredStores.map(store => (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => {
                        setTargetAccountId(store.id);
                        setStoreDropdownOpen(false);
                        setStoreSearch('');
                      }}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-tea-bg transition-colors flex items-center justify-between gap-2 ${
                        store.id === targetAccountId ? 'text-tea-gold' : 'text-tea-text'
                      }`}
                    >
                      <span>{store.name}</span>
                      {(store.location_city || store.location_country) && (
                        <span className="text-tea-text-dim text-[11px] shrink-0">
                          {[store.location_city, store.location_country].filter(Boolean).join(', ')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Product selection */}
      <div className="px-4 pb-2 flex items-center gap-2">
        <p className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim font-medium flex-1">
          Products <span className="text-tea-text-sec">{selectedProductIds.size > 0 ? `· ${selectedProductIds.size} selected` : ''}</span>
        </p>
        {filteredProducts.length > 0 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-[11px] text-tea-text-dim hover:text-tea-text-sec transition-colors"
          >
            {selectedProductIds.size === filteredProducts.length ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="px-4 pb-3 space-y-2">
        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
          <input
            type="text"
            value={productSearch}
            onChange={e => setProductSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-8 pr-8 py-2 text-xs bg-tea-surface border border-tea-border rounded-lg outline-none text-tea-text placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40 transition-colors"
          />
          {productSearch && (
            <button
              type="button"
              onClick={() => setProductSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text-sec transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {uniqueTypes.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                typeFilter === t
                  ? 'bg-tea-gold/15 text-tea-gold font-semibold'
                  : 'text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface/60'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      <div className="flex-1 px-4 pb-32 space-y-1.5 overflow-y-auto">
        {filteredProducts.length === 0 ? (
          <p className="text-xs text-tea-text-dim text-center py-8">No active products match your filters.</p>
        ) : filteredProducts.map(product => {
          const checked = selectedProductIds.has(product.id);
          const displayName = [product.givenName, product.productName].filter(Boolean).join(' ');
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => toggleProduct(product.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                checked
                  ? 'bg-tea-gold-lt border border-tea-border'
                  : 'bg-tea-surface border border-tea-border hover:border-tea-text-dim'
              }`}
            >
              <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                checked ? 'bg-tea-gold border-tea-border' : 'border-tea-border'
              }`}>
                {checked && <Check size={10} className="text-tea-bg" strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-tea-text truncate">{displayName || product.productName}</p>
                <p className="text-[11px] text-tea-text-dim">
                  {[product.type, product.originRegion].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className="text-[10px] text-tea-text-dim shrink-0">{product.stockGrams}g</span>
            </button>
          );
        })}
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-[calc(40px+env(safe-area-inset-bottom,0px))] md:bottom-0 left-0 right-0 px-4 py-3 bg-tea-bg/90 backdrop-blur-sm border-t border-tea-border">
        {seedResult && (
          <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-tea-gold/10 text-tea-gold text-xs font-medium">
            <Check size={13} strokeWidth={2.5} />
            <span>{seedResult.count} product{seedResult.count !== 1 ? 's' : ''} shared to {seedResult.storeName}</span>
          </div>
        )}
        {seedError && (
          <p className="mb-2 text-xs text-red-400 text-center">{seedError}</p>
        )}
        <button
          type="button"
          onClick={handleSeed}
          disabled={seeding || !targetAccountId || selectedProductIds.size === 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-tea-gold text-tea-bg text-sm font-semibold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-tea-gold/90 transition-colors"
        >
          {seeding ? (
            <><Loader2 size={15} className="animate-spin" /> Sharing…</>
          ) : (
            <><Share2 size={15} /> Share {selectedProductIds.size > 0 ? `${selectedProductIds.size} ` : ''}Product{selectedProductIds.size !== 1 ? 's' : ''}{selectedStore ? ` to ${selectedStore.name}` : ''}</>
          )}
        </button>
      </div>
    </div>
  );
};
