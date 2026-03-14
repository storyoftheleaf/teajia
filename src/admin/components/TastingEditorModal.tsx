import React, { useState, useCallback } from 'react';
import { X, Check } from 'lucide-react';
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

interface TastingEditorModalProps {
  product: Product;
  onClose: () => void;
  onSaved?: (product: Product, tastingData: TastingData, derivedMood: string) => void;
}

/**
 * Derive a mood string from feeling terms in tasting data.
 * e.g. ['calming', 'grounding'] → "Calming & Grounding"
 */
function deriveMoodFromFeeling(tasting: TastingData): string {
  const feelings = tasting.feeling || [];
  if (feelings.length === 0) return '';
  const labels = feelings.map(id => resolveTermLabel(id));
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} & ${labels[1]}`;
  return labels.slice(0, -1).join(', ') + ' & ' + labels[labels.length - 1];
}

export const TastingEditorModal: React.FC<TastingEditorModalProps> = ({
  product,
  onClose,
  onSaved,
}) => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [tastingData, setTastingData] = useState<TastingData>(product.tasting || {});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = useCallback((data: TastingData) => {
    setTastingData(data);
    setHasChanges(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        tasting: Object.keys(tastingData).length > 0 ? tastingData : null,
      };

      // Auto-sync mood from feeling terms
      const derivedMood = deriveMoodFromFeeling(tastingData);
      if (derivedMood) {
        payload.mood = derivedMood;
      }

      // Auto-sync tastingNotes from flavor terms
      const flavorTerms = tastingData.flavor || [];
      if (flavorTerms.length > 0) {
        payload.tastingNotes = flavorTerms.map(id => resolveTermLabel(id));
      }

      await api.products.update(product.id, payload);

      // Update cache
      queryClient.setQueryData(['products'], (old: Product[] | undefined) => {
        if (!old) return old;
        return old.map(p =>
          p.id === product.id
            ? { ...p, tasting: tastingData, mood: derivedMood || p.mood, tastingNotes: payload.tastingNotes || p.tastingNotes }
            : p
        );
      });

      setHasChanges(false);
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
          className="relative w-full max-w-2xl max-h-[90vh] bg-tea-bg rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col"
          style={{ boxShadow: '0 -4px 40px rgba(0,0,0,0.3)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-tea-border shrink-0">
            {product.imageUrl && (
              <img src={product.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-tea-text truncate" style={{ fontFamily: 'var(--font-display)' }}>
                {product.givenName || product.productName}
              </div>
              <div className="text-xs text-tea-text-dim">
                {product.type} · Tasting Profile
                {noteCount > 0 && <span className="text-tea-gold ml-1">({noteCount} notes)</span>}
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-tea-text-dim hover:text-tea-text transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Tasting Flow */}
          <div className="flex-1 overflow-auto px-5 py-4">
            <TastingFlow mode="admin" value={tastingData} onChange={handleChange} />
          </div>

          {/* Save button */}
          <div className="px-5 py-4 border-t border-tea-border bg-tea-surface/80 backdrop-blur-sm shrink-0">
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
