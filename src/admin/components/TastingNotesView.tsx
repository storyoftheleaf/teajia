import React, { useState, useMemo, useCallback } from 'react';
import { Search, Check, ChevronLeft, Leaf, X, ListChecks, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '../types';
import type { TastingData } from '../../types';
import { TastingSession } from '../../components/tasting/TastingSession';
import {
  flattenTastingNotes,
  resolveTermLabel,
  resolveTermIcon,
} from '../../data/tastingTaxonomy';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { useQueryClient } from '@tanstack/react-query';
import { buildTastingSyncPayload } from '../../lib/tastingUtils';

interface TastingNotesViewProps {
  products: Product[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const TastingNotesView: React.FC<TastingNotesViewProps> = ({ products, isLoading, onRefresh }) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Batch session state
  const [batchSelecting, setBatchSelecting] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [batchProducts, setBatchProducts] = useState<Product[]>([]);
  const [batchIndex, setBatchIndex] = useState(0);
  const batchMode = batchProducts.length > 0;

  // Filter to teas only (not teaware/misc) and sort by name
  const teaProducts = useMemo(() => {
    return products
      .filter(p => p.type !== 'Teaware' && p.type !== 'Misc')
      .sort((a, b) => (a.givenName || a.productName).localeCompare(b.givenName || b.productName));
  }, [products]);

  const filtered = useMemo(() => {
    if (!search.trim()) return teaProducts;
    const q = search.toLowerCase();
    return teaProducts.filter(p =>
      (p.givenName || '').toLowerCase().includes(q) ||
      (p.productName || '').toLowerCase().includes(q) ||
      (p.chineseName || '').toLowerCase().includes(q) ||
      (p.type || '').toLowerCase().includes(q)
    );
  }, [teaProducts, search]);

  const handleSave = useCallback(async (product: Product, tastingData: TastingData) => {
    const syncFields = buildTastingSyncPayload(tastingData);
    const payload: Record<string, unknown> = {
      tasting: Object.keys(tastingData).length > 0 ? tastingData : null,
      ...syncFields,
    };
    await api.products.update(product.id, payload);

    queryClient.setQueryData(['products'], (old: Product[] | undefined) => {
      if (!old) return old;
      return old.map(p => p.id === product.id ? { ...p, tasting: tastingData, ...syncFields } : p);
    });

    showToast('Tasting notes locked in', 'success');

    // In batch mode, advance to next tea
    if (batchMode && batchProducts.length > 0) {
      const nextIndex = batchIndex + 1;
      if (nextIndex < batchProducts.length) {
        setBatchIndex(nextIndex);
        setSelectedProduct(batchProducts[nextIndex]);
        showToast(`Advancing to ${batchProducts[nextIndex].givenName || batchProducts[nextIndex].productName} (${nextIndex + 1} of ${batchProducts.length})`, 'success');
      } else {
        showToast('Batch session complete!', 'success');
        setBatchProducts([]);
        setBatchIndex(0);
        setSelectedProduct(null);
      }
    } else {
      setSelectedProduct(null);
    }
  }, [queryClient, showToast, batchMode, batchProducts, batchIndex]);

  const handleClose = useCallback(() => {
    if (batchMode) {
      setBatchProducts([]);
      setBatchIndex(0);
    }
    setSelectedProduct(null);
  }, [batchMode]);

  // Toggle batch selection for a product
  const toggleBatchSelect = useCallback((productId: string) => {
    setBatchSelected(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }, []);

  // Start the batch session
  const startBatch = useCallback(() => {
    const selected = teaProducts.filter(p => batchSelected.has(p.id));
    if (selected.length === 0) return;
    setBatchProducts(selected);
    setBatchIndex(0);
    setBatchSelecting(false);
    setBatchSelected(new Set());
    setSelectedProduct(selected[0]);
  }, [teaProducts, batchSelected]);

  // Count how many notes a product has
  const noteCount = (p: Product) => {
    if (!p.tasting) return 0;
    return Object.values(p.tasting).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  };

  // Tea type badge color
  const typeColor = (type: string) => {
    const colors: Record<string, string> = {
      Green: '#6b8e4e', White: '#c4b089', Yellow: '#c9a84c',
      Oolong: '#b07d3a', Red: '#a04040', Dark: '#5c4033',
      Sheng: '#7a8b3a', Shou: '#4a3728', Herbal: '#7b9e87',
    };
    return colors[type] || '#888';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Full-screen TastingSession overlay when product is selected */}
      {selectedProduct && (
        <TastingSession
          item={{
            id: selectedProduct.id,
            name: selectedProduct.givenName || selectedProduct.productName,
            type: selectedProduct.type,
            image: selectedProduct.imageUrl || undefined,
          }}
          adminMode
          initialData={selectedProduct.tasting || {}}
          onClose={handleClose}
          onSave={(data) => handleSave(selectedProduct, data)}
        />
      )}

      {/* Tea list */}
      <div className="px-4 pt-6 pb-4 md:px-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl text-tea-text mb-0" style={{ fontFamily: 'var(--font-display)' }}>Tasting Notes</h1>
          <button
            onClick={() => {
              if (batchSelecting) {
                setBatchSelecting(false);
                setBatchSelected(new Set());
              } else {
                setBatchSelecting(true);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              batchSelecting
                ? 'bg-tea-gold/15 text-tea-gold'
                : 'bg-tea-surface text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated'
            }`}
          >
            <ListChecks size={14} />
            {batchSelecting ? 'Cancel' : 'Batch Session'}
          </button>
        </div>
        <p className="text-xs text-tea-text-dim mb-4" style={{ fontFamily: 'var(--font-body)' }}>
          {batchSelecting
            ? `Select teas for batch tasting (${batchSelected.size} selected)`
            : 'Select a tea to edit its tasting profile'}
        </p>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim" />
          <input
            type="text"
            placeholder="Search teas..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-tea-surface rounded-lg text-sm text-tea-text placeholder:text-tea-text-dim focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg"
            style={{ fontFamily: 'var(--font-body)' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-dim">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Batch start button */}
        {batchSelecting && batchSelected.size > 0 && (
          <motion.button
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={startBatch}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-tea-gold text-tea-bg hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <ArrowRight size={16} />
            Start Batch ({batchSelected.size} teas)
          </motion.button>
        )}
      </div>

      {/* Tea cards list */}
      <div className="flex-1 overflow-auto px-4 pb-6 md:px-6 space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-tea-text-dim text-sm">Loading teas...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-tea-text-dim text-sm">No teas found</div>
        ) : (
          filtered.map(product => {
            const count = noteCount(product);
            const isInBatch = batchSelected.has(product.id);
            return (
              <button
                key={product.id}
                onClick={() => {
                  if (batchSelecting) {
                    toggleBatchSelect(product.id);
                  } else {
                    setSelectedProduct(product);
                  }
                }}
                className={`w-full text-left bg-tea-surface rounded-xl p-4 transition-all duration-200 active:scale-[0.98] group ${
                  isInBatch ? 'ring-2 ring-tea-gold/50' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Batch checkbox */}
                  {batchSelecting && (
                    <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      isInBatch ? 'bg-tea-gold/20 text-tea-gold' : 'bg-tea-elevated text-tea-text-dim'
                    }`}>
                      {isInBatch && <Check size={13} />}
                    </div>
                  )}

                  {/* Tea image or type badge */}
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: `${typeColor(product.type)}20` }}
                    >
                      <Leaf size={18} style={{ color: typeColor(product.type) }} />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm text-tea-text truncate" style={{ fontFamily: 'var(--font-display)' }}>
                        {product.givenName || product.productName}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 font-medium"
                        style={{
                          background: `${typeColor(product.type)}18`,
                          color: typeColor(product.type),
                        }}
                      >
                        {product.type}
                      </span>
                    </div>

                    {product.givenName && product.productName && product.givenName !== product.productName && (
                      <div className="text-xs text-tea-text-sec truncate" style={{ fontFamily: 'var(--font-body)' }}>{product.productName}</div>
                    )}

                    {/* Tasting note pills preview */}
                    {count > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {flattenTastingNotes(product.tasting!).slice(0, 4).map(termId => {
                          const Icon = resolveTermIcon(termId);
                          return (
                            <span
                              key={termId}
                              className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full bg-tea-gold/10 text-tea-gold"
                            >
                              <Icon size={11} />
                              {resolveTermLabel(termId)}
                            </span>
                          );
                        })}
                        {count > 4 && (
                          <span className="text-[11px] px-1.5 py-0.5 text-tea-text-dim">
                            +{count - 4} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-tea-text-dim mt-1.5 italic" style={{ fontFamily: 'var(--font-body)' }}>No tasting notes yet</div>
                    )}
                  </div>

                  {/* Arrow indicator */}
                  {!batchSelecting && (
                    <div className="text-tea-text-dim group-hover:text-tea-gold transition-colors shrink-0 self-center">
                      <ChevronLeft size={16} className="rotate-180" />
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
