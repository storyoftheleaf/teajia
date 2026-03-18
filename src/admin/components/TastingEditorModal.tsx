import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { X, Check, Copy, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Product } from '../types';
import type { TastingData } from '../../types';
import { TastingFlow } from '../../components/tasting/TastingFlow';
import {
  flattenTastingNotes,
  resolveTermLabel,
  resolveTermIcon,
  LIQUOR_COLORS,
  TERM_MAP,
} from '../../data/tastingTaxonomy';
import { api } from '../../lib/api';
import { useToast } from './Toast';
import { useQueryClient } from '@tanstack/react-query';
import { deriveMoodFromFeeling, buildTastingSyncPayload } from '../../lib/tastingUtils';

interface TastingEditorModalProps {
  product: Product;
  onClose: () => void;
  onSaved?: (product: Product, tastingData: TastingData, derivedMood: string) => void;
  allProducts?: Product[]; // For "Copy from" feature
}

export const TastingEditorModal: React.FC<TastingEditorModalProps> = ({
  product,
  onClose,
  onSaved,
  allProducts,
}) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [tastingData, setTastingData] = useState<TastingData>(product.tasting || {});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showCopyDropdown, setShowCopyDropdown] = useState(false);
  const [copySearch, setCopySearch] = useState('');
  const copyDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showCopyDropdown) return;
    const handleClick = (e: MouseEvent) => {
      if (copyDropdownRef.current && !copyDropdownRef.current.contains(e.target as Node)) {
        setShowCopyDropdown(false);
        setCopySearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showCopyDropdown]);

  // Products that have tasting data (for "Copy from" feature)
  const productsWithTasting = useMemo(() => {
    if (!allProducts) return [];
    return allProducts
      .filter(p => p.id !== product.id && p.tasting && Object.keys(p.tasting).length > 0)
      .sort((a, b) => (a.givenName || a.productName).localeCompare(b.givenName || b.productName));
  }, [allProducts, product.id]);

  const filteredCopyProducts = useMemo(() => {
    if (!copySearch.trim()) return productsWithTasting;
    const q = copySearch.toLowerCase();
    return productsWithTasting.filter(p =>
      (p.givenName || '').toLowerCase().includes(q) ||
      (p.productName || '').toLowerCase().includes(q) ||
      (p.type || '').toLowerCase().includes(q)
    );
  }, [productsWithTasting, copySearch]);

  const handleCopyFrom = useCallback((source: Product) => {
    if (source.tasting) {
      setTastingData({ ...source.tasting });
      setHasChanges(true);
      showToast(`Copied tasting data from ${source.givenName || source.productName}`, 'success');
    }
    setShowCopyDropdown(false);
    setCopySearch('');
  }, [showToast]);

  const handleChange = useCallback((data: TastingData) => {
    setTastingData(data);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const syncFields = buildTastingSyncPayload(tastingData);
      const payload: Record<string, any> = {
        tasting: Object.keys(tastingData).length > 0 ? tastingData : null,
        ...syncFields,
      };

      await api.products.update(product.id, payload);

      // Update cache
      queryClient.setQueryData(['products'], (old: Product[] | undefined) => {
        if (!old) return old;
        return old.map(p =>
          p.id === product.id
            ? { ...p, tasting: tastingData, ...syncFields }
            : p
        );
      });

      setHasChanges(false);
      const derivedMood = deriveMoodFromFeeling(tastingData);
      showToast('Tasting profile saved', 'success');
      onSaved?.(product, tastingData, derivedMood);
      onClose();
    } catch (err) {
      showToast('Failed to save tasting data', 'error');
    } finally {
      setSaving(false);
    }
  }, [product, tastingData, queryClient, showToast, onSaved, onClose]);

  const allNotes = flattenTastingNotes(tastingData);
  const noteCount = allNotes.length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-end md:items-center justify-center"
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="relative w-full max-w-2xl max-h-[95vh] bg-tea-bg rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col"
          style={{ boxShadow: '0 -4px 40px rgba(0,0,0,0.3)' }}
        >
          {/* Header — compact */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-tea-border shrink-0">
            {product.imageUrl && (
              <img src={product.imageUrl} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-tea-text truncate" style={{ fontFamily: 'var(--font-display)' }}>
                {product.givenName || product.productName}
                <span className="text-tea-text-dim font-normal ml-1.5">{product.type}</span>
                {noteCount > 0 && <span className="text-tea-gold ml-1.5 text-[10px]">{noteCount} notes</span>}
              </div>
            </div>

            {/* Copy from button */}
            {allProducts && productsWithTasting.length > 0 && (
              <div className="relative" ref={copyDropdownRef}>
                <button
                  onClick={() => setShowCopyDropdown(!showCopyDropdown)}
                  className="flex items-center gap-1 px-2 py-1 text-[10px] text-tea-text-sec bg-tea-surface rounded-lg hover:text-tea-text hover:bg-tea-elevated transition-colors"
                >
                  <Copy size={11} />
                  <span>Copy</span>
                </button>

                <AnimatePresence>
                  {showCopyDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-1 w-64 bg-tea-surface rounded-xl overflow-hidden z-50"
                      style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.3)' }}
                    >
                      <div className="p-2">
                        <input
                          type="text"
                          placeholder="Search teas..."
                          value={copySearch}
                          onChange={e => setCopySearch(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-tea-bg text-tea-text placeholder:text-tea-text-dim rounded-lg focus:outline-none"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-auto">
                        {filteredCopyProducts.length === 0 ? (
                          <div className="px-3 py-4 text-xs text-tea-text-dim text-center">No teas with tasting data</div>
                        ) : (
                          filteredCopyProducts.map(p => {
                            const count = flattenTastingNotes(p.tasting!).length;
                            return (
                              <button
                                key={p.id}
                                onClick={() => handleCopyFrom(p)}
                                className="w-full text-left px-3 py-2 hover:bg-tea-elevated/60 transition-colors flex items-center gap-2"
                              >
                                {p.imageUrl ? (
                                  <img src={p.imageUrl} alt="" className="w-7 h-7 rounded object-cover shrink-0" />
                                ) : (
                                  <div className="w-7 h-7 rounded bg-tea-elevated/50 shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="text-xs text-tea-text truncate">
                                    {p.givenName || p.productName}
                                  </div>
                                  <div className="text-[10px] text-tea-text-dim">
                                    {p.type} · {count} notes
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <button onClick={onClose} className="p-1 text-tea-text-dim hover:text-tea-text transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Tasting Flow */}
          <div className="flex-1 overflow-auto px-4 py-3">
            <TastingFlow mode="admin" value={tastingData} onChange={handleChange} teaType={product.type} />
          </div>

          {/* Save button — compact */}
          <div className="px-4 py-2 border-t border-tea-border bg-tea-surface/80 backdrop-blur-sm shrink-0">
            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                hasChanges
                  ? 'bg-tea-gold text-tea-bg hover:opacity-90 active:scale-[0.98]'
                  : 'bg-tea-border text-tea-text-dim cursor-not-allowed'
              }`}
            >
              {saving ? (
                <span className="animate-pulse">Saving...</span>
              ) : (
                <>
                  <Check size={14} />
                  {hasChanges ? 'Lock In' : 'No Changes'}
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
