import React, { useState, useMemo, useCallback } from 'react';
import { Search, Check, ChevronLeft, Leaf, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Product } from '../types';
import type { TastingData } from '../../types';
import { TastingFlow } from '../../components/tasting/TastingFlow';
import {
  flattenTastingNotes,
  resolveTermLabel,
  resolveTermIcon,
} from '../../data/tastingTaxonomy';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { useQueryClient } from '@tanstack/react-query';

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
  const [tastingData, setTastingData] = useState<TastingData>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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

  const selectProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setTastingData(product.tasting || {});
    setHasChanges(false);
  }, []);

  const handleTastingChange = useCallback((data: TastingData) => {
    setTastingData(data);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedProduct) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        tasting: Object.keys(tastingData).length > 0 ? tastingData : null,
      };
      await api.products.update(selectedProduct.id, payload);

      // Update local cache
      queryClient.setQueryData(['products'], (old: Product[] | undefined) => {
        if (!old) return old;
        return old.map(p => p.id === selectedProduct.id ? { ...p, tasting: tastingData } : p);
      });

      setSelectedProduct(prev => prev ? { ...prev, tasting: tastingData } : prev);
      setHasChanges(false);
      showToast('Tasting notes locked in', 'success');
    } catch (err) {
      showToast('Failed to save tasting notes', 'error');
    } finally {
      setSaving(false);
    }
  }, [selectedProduct, tastingData, queryClient, showToast]);

  const handleBack = useCallback(() => {
    setSelectedProduct(null);
    setHasChanges(false);
  }, []);

  // Count how many notes a product has
  const noteCount = (p: Product) => {
    if (!p.tasting) return 0;
    return Object.values(p.tasting).reduce((sum, arr) => sum + (arr?.length || 0), 0);
  };

  // Tea type badge color
  const typeColor = (type: string) => {
    const colors: Record<string, string> = {
      Green: '#6b8e4e', White: '#c4b089', Yellow: '#c9a84c',
      Oolong: '#b07d3a', Red: '#a04040', Dark: '#5c4033',
      Sheng: '#7a8b3a', Shou: '#4a3728', Herbal: '#7b9e87',
      Matcha: '#5a7a3a', Flower: '#c47a9a',
    };
    return colors[type] || '#888';
  };

  return (
    <div className="h-full flex flex-col">
      <AnimatePresence mode="wait">
        {!selectedProduct ? (
          /* ── TEA LIST ── */
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <div className="px-4 pt-6 pb-4 md:px-6">
              <h1 className="text-xl font-serif text-tea-text mb-1">Tasting Notes</h1>
              <p className="text-xs text-tea-text-dim mb-4">Select a tea to edit its tasting profile</p>

              {/* Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim" />
                <input
                  type="text"
                  placeholder="Search teas..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-tea-surface border border-tea-border rounded-lg text-sm text-tea-text placeholder:text-tea-text-dim focus:outline-none focus:border-tea-gold/50"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-tea-text-dim">
                    <X size={14} />
                  </button>
                )}
              </div>
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
                  return (
                    <button
                      key={product.id}
                      onClick={() => selectProduct(product)}
                      className="w-full text-left bg-tea-surface border border-tea-border rounded-xl p-4 hover:border-tea-gold/40 transition-all duration-200 active:scale-[0.98] group"
                    >
                      <div className="flex items-start gap-3">
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
                            <span className="font-medium text-sm text-tea-text truncate">
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
                            <div className="text-xs text-tea-text-sec truncate">{product.productName}</div>
                          )}

                          {/* Tasting note pills preview */}
                          {count > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {flattenTastingNotes(product.tasting!).slice(0, 4).map(termId => {
                                const Icon = resolveTermIcon(termId);
                                return (
                                  <span
                                    key={termId}
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-tea-gold/10 text-tea-gold"
                                  >
                                    <Icon size={10} />
                                    {resolveTermLabel(termId)}
                                  </span>
                                );
                              })}
                              {count > 4 && (
                                <span className="text-[10px] px-1.5 py-0.5 text-tea-text-dim">
                                  +{count - 4} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="text-[11px] text-tea-text-dim mt-1.5 italic">No tasting notes yet</div>
                          )}
                        </div>

                        {/* Arrow indicator */}
                        <div className="text-tea-text-dim group-hover:text-tea-gold transition-colors shrink-0 self-center">
                          <ChevronLeft size={16} className="rotate-180" />
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        ) : (
          /* ── TASTING EDITOR CARD ── */
          <motion.div
            key="editor"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full"
          >
            {/* Back header */}
            <div className="px-4 pt-4 pb-3 md:px-6 flex items-center gap-3 border-b border-tea-border">
              <button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-lg text-tea-text-sec hover:text-tea-text hover:bg-tea-elevated/50 transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-tea-text truncate">
                  {selectedProduct.givenName || selectedProduct.productName}
                </div>
                <div className="text-xs text-tea-text-dim">{selectedProduct.type} · Edit tasting profile</div>
              </div>
              {selectedProduct.imageUrl && (
                <img
                  src={selectedProduct.imageUrl}
                  alt=""
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
              )}
            </div>

            {/* Tasting Flow */}
            <div className="flex-1 overflow-auto px-4 py-4 md:px-6">
              <TastingFlow mode="admin" value={tastingData} onChange={handleTastingChange} />
            </div>

            {/* Lock In button - sticky bottom */}
            <div className="px-4 py-4 md:px-6 border-t border-tea-border bg-tea-surface/80 backdrop-blur-sm">
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  hasChanges
                    ? 'bg-tea-gold text-tea-bg hover:opacity-90 active:scale-[0.98]'
                    : 'bg-tea-border text-tea-text-dim cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <span className="animate-pulse">Saving...</span>
                ) : (
                  <>
                    <Check size={16} />
                    {hasChanges ? 'Lock In Selection' : 'No Changes'}
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
