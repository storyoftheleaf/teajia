import React, { useState, useCallback } from 'react';
import { X, Check, ShoppingCart, StickyNote } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TastingData, CustomerTasting } from '../../types';
import type { InventoryItem } from '../../types';
import { TastingFlow } from './TastingFlow';
import { useAppStore } from '../../lib/store';
import {
  flattenTastingNotes,
  resolveTermLabel,
  resolveTermIcon,
  LIQUOR_COLORS,
  TERM_MAP,
} from '../../data/tastingTaxonomy';

interface TastingSessionProps {
  item: InventoryItem;
  onClose: () => void;
  onOrderTea?: (item: InventoryItem) => void;
}

export const TastingSession: React.FC<TastingSessionProps> = ({ item, onClose, onOrderTea }) => {
  const { addTasting } = useAppStore();
  const [tastingData, setTastingData] = useState<TastingData>({});
  const [personalNote, setPersonalNote] = useState('');
  const [phase, setPhase] = useState<'tasting' | 'saved'>('tasting');

  const hasNotes = Object.values(tastingData).some(arr => arr && arr.length > 0);

  const handleSave = useCallback(() => {
    const entry: CustomerTasting = {
      id: crypto.randomUUID(),
      teaId: item.id,
      teaName: item.name,
      teaType: item.type || '',
      teaImage: item.image || undefined,
      tasting: tastingData,
      personalNote: personalNote.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    addTasting(entry);
    setPhase('saved');
  }, [item, tastingData, personalNote, addTasting]);

  const allNotes = hasNotes ? flattenTastingNotes(tastingData) : [];

  return (
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
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full max-w-lg max-h-[90vh] bg-tea-bg rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col"
        style={{ boxShadow: '0 -4px 40px rgba(0,0,0,0.3)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-tea-border">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-tea-text truncate" style={{ fontFamily: 'var(--font-display)' }}>
              {phase === 'tasting' ? 'Tasting Session' : 'Saved'}
            </div>
            <div className="text-xs text-tea-text-dim truncate">
              {item.name}
            </div>
          </div>
          {item.image && (
            <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          )}
          <button onClick={onClose} className="p-1.5 text-tea-text-dim hover:text-tea-text transition-colors">
            <X size={18} />
          </button>
        </div>

        <AnimatePresence mode="wait">
          {phase === 'tasting' ? (
            <motion.div
              key="tasting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-auto flex flex-col"
            >
              {/* Tasting flow */}
              <div className="flex-1 overflow-auto px-5 py-4">
                <TastingFlow mode="customer" value={tastingData} onChange={setTastingData} />

                {/* Personal note */}
                <div className="mt-5">
                  <div className="flex items-center gap-2 mb-2">
                    <StickyNote size={12} className="text-tea-text-dim" />
                    <span className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim font-medium"
                      style={{ fontFamily: 'var(--font-display)' }}>
                      Personal Note
                    </span>
                  </div>
                  <textarea
                    value={personalNote}
                    onChange={e => setPersonalNote(e.target.value)}
                    placeholder="How was this session? Any thoughts to remember..."
                    rows={2}
                    className="w-full px-3 py-2 bg-tea-surface border border-tea-border rounded-lg text-sm text-tea-text placeholder:text-tea-text-dim/50 focus:outline-none focus:border-tea-gold/50 resize-none"
                    style={{ fontFamily: 'var(--font-body)' }}
                  />
                </div>
              </div>

              {/* Save button */}
              <div className="px-5 py-4 border-t border-tea-border bg-tea-surface/80 backdrop-blur-sm">
                <button
                  onClick={handleSave}
                  disabled={!hasNotes}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    hasNotes
                      ? 'bg-tea-gold text-tea-bg hover:opacity-90 active:scale-[0.98]'
                      : 'bg-tea-border text-tea-text-dim cursor-not-allowed'
                  }`}
                >
                  <Check size={16} />
                  Save to Journal
                </button>
              </div>
            </motion.div>
          ) : (
            /* Saved confirmation */
            <motion.div
              key="saved"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 overflow-auto px-5 py-6"
            >
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-full bg-tea-gold/15 flex items-center justify-center mx-auto mb-3">
                  <Check size={20} className="text-tea-gold" />
                </div>
                <div className="text-sm font-medium text-tea-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  Tasting Saved
                </div>
                <div className="text-xs text-tea-text-dim">Added to your tasting journal</div>
              </div>

              {/* Summary */}
              {allNotes.length > 0 && (
                <div className="border border-tea-border rounded-xl p-4 mb-4 bg-tea-surface/50">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    {allNotes.map((termId, idx) => {
                      const Icon = resolveTermIcon(termId);
                      const termInfo = TERM_MAP.get(termId);
                      const isColor = termInfo?.categoryId === 'liquor-color';
                      const hex = isColor ? LIQUOR_COLORS[termId] : null;
                      return (
                        <div key={termId} className="flex items-center gap-2 text-xs text-tea-text-sec"
                          style={{ fontFamily: 'var(--font-body)', opacity: 1 - idx * 0.03 }}>
                          {hex ? (
                            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: hex, border: '1px solid var(--tea-border)' }} />
                          ) : (
                            <Icon size={13} className="shrink-0 text-tea-gold" style={{ opacity: 0.7 }} />
                          )}
                          {resolveTermLabel(termId)}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {personalNote.trim() && (
                <div className="text-xs text-tea-text-dim italic mb-4 px-2" style={{ fontFamily: 'var(--font-body)' }}>
                  "{personalNote.trim()}"
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {onOrderTea && (
                  <button
                    onClick={() => { onOrderTea(item); onClose(); }}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-tea-gold text-tea-bg hover:opacity-90 active:scale-[0.98] transition-all"
                  >
                    <ShoppingCart size={16} />
                    Order This Tea
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl text-sm text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Done
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};
