import React, { useState } from 'react';
import { ChevronLeft, Trash2, ShoppingCart, Leaf } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../lib/store';
import type { CustomerTasting } from '../../types';
import {
  flattenTastingNotes,
  resolveTermLabel,
  resolveTermIcon,
  LIQUOR_COLORS,
  TERM_MAP,
  TASTING_CATEGORY_ORDER,
} from '../../data/tastingTaxonomy';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';

interface TastingJournalProps {
  onBack: () => void;
  onOrderTea?: (teaId: string) => void;
}

export const TastingJournal: React.FC<TastingJournalProps> = ({ onBack, onOrderTea }) => {
  const { tastingJournal, removeTasting } = useAppStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDelete = (id: string) => {
    if (confirmDelete === id) {
      removeTasting(id);
      setConfirmDelete(null);
      if (expandedId === id) setExpandedId(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-tea-border">
        <button onClick={onBack} className="p-1.5 -ml-1 text-tea-text-sec hover:text-tea-text transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div>
          <div className="text-sm font-medium text-tea-text" style={{ fontFamily: 'var(--font-display)' }}>
            Tasting Journal
          </div>
          <div className="text-[10px] text-tea-text-dim">
            {tastingJournal.length} {tastingJournal.length === 1 ? 'entry' : 'entries'}
          </div>
        </div>
      </div>

      {/* Journal list */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-2">
        {tastingJournal.length === 0 ? (
          <div className="text-center py-12">
            <Leaf size={24} className="mx-auto text-tea-text-dim/30 mb-3" />
            <div className="text-sm text-tea-text-dim" style={{ fontFamily: 'var(--font-body)' }}>
              No tastings yet
            </div>
            <div className="text-xs text-tea-text-dim/60 mt-1">
              Open any tea and tap the tasting icon to start
            </div>
          </div>
        ) : (
          tastingJournal.map(entry => {
            const isExpanded = expandedId === entry.id;
            const allNotes = flattenTastingNotes(entry.tasting);
            const previewNotes = allNotes.slice(0, 3);

            return (
              <div key={entry.id} className="border border-tea-border rounded-xl overflow-hidden bg-tea-surface">
                {/* Card header — tap to expand */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full text-left p-3.5 hover:bg-tea-elevated/30 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    {entry.teaImage ? (
                      <img src={entry.teaImage} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-tea-border/30 flex items-center justify-center shrink-0">
                        <Leaf size={16} className="text-tea-text-dim" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-tea-text truncate">{entry.teaName}</span>
                        {entry.teaType && (
                          <span className="text-[9px] text-tea-text-dim shrink-0">{entry.teaType}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] text-tea-text-dim">{formatDate(entry.createdAt)}</span>
                        {/* Rating as filled tea leaves */}
                        {(entry.tasting.rating ?? entry.rating ?? 0) > 0 && (
                          <span className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(i => (
                              <Leaf
                                key={i}
                                size={10}
                                className={i <= (entry.tasting.rating ?? entry.rating ?? 0) ? 'text-tea-gold fill-tea-gold' : 'text-tea-text-dim/20'}
                              />
                            ))}
                          </span>
                        )}
                      </div>

                      {/* Primary notes — emphasized */}
                      {entry.tasting.primaryNotes && entry.tasting.primaryNotes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {entry.tasting.primaryNotes.map(termId => {
                            const Icon = resolveTermIcon(termId);
                            return (
                              <span key={termId} className="tag text-xs font-semibold">
                                <Icon size={12} />
                                {resolveTermLabel(termId)}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Preview pills */}
                      <div className="flex flex-wrap gap-1">
                        {previewNotes.filter(t => !entry.tasting.primaryNotes?.includes(t)).slice(0, 3).map(termId => {
                          const Icon = resolveTermIcon(termId);
                          return (
                            <span key={termId} className="tag">
                              <Icon size={10} />
                              {resolveTermLabel(termId)}
                            </span>
                          );
                        })}
                        {allNotes.length > 3 && (
                          <span className="text-[10px] text-tea-text-dim self-center">+{allNotes.length - 3}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-3.5 pb-3.5 border-t border-tea-border pt-3">
                        {/* Category-grouped notes display */}
                        <div className="space-y-2.5 mb-3">
                          {TASTING_CATEGORY_ORDER
                            .map(catId => ({
                              categoryId: catId,
                              label: ({ flavor: 'FLAVOR', body: 'BODY', finish: 'FINISH', feeling: 'FEEL', 'liquor-color': 'COLOR', brewing: 'BREW' } as Record<string, string>)[catId] || catId.toUpperCase(),
                              terms: entry.tasting[catId as keyof typeof entry.tasting] as string[] | undefined,
                            }))
                            .filter(g => g.terms && g.terms.length > 0)
                            .map(group => (
                              <div key={group.categoryId}>
                                <div
                                  className="text-[9px] uppercase tracking-[0.15em] text-tea-text-dim font-medium mb-1 ml-0.5"
                                  style={{ fontFamily: 'var(--font-display)' }}
                                >
                                  {group.label}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {group.terms!.map(termId => {
                                    const isColor = group.categoryId === 'liquor-color';
                                    const hex = isColor ? LIQUOR_COLORS[termId] : null;
                                    const Icon = !isColor ? resolveTermIcon(termId) : null;
                                    return (
                                      <span key={termId} className="tag">
                                        {hex ? (
                                          <span className="shrink-0 rounded-full inline-block" style={{ width: 10, height: 10, background: hex }} />
                                        ) : Icon ? (
                                          <Icon size={11} className="shrink-0" />
                                        ) : null}
                                        {resolveTermLabel(termId)}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                        </div>

                        {/* Overall impression */}
                        {entry.tasting.overallImpression && (
                          <div className="text-xs text-tea-text-sec italic mb-2 px-1" style={{ fontFamily: 'var(--font-body)' }}>
                            "{entry.tasting.overallImpression}"
                          </div>
                        )}

                        {/* Personal note */}
                        {entry.personalNote && (
                          <div className="text-xs text-tea-text-dim italic mb-3 px-1" style={{ fontFamily: 'var(--font-body)' }}>
                            "{entry.personalNote}"
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          {onOrderTea && (
                            <button
                              onClick={() => onOrderTea(entry.teaId)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-tea-gold/10 text-tea-gold hover:bg-tea-gold/20 transition-colors"
                            >
                              <ShoppingCart size={12} />
                              Buy Again
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              confirmDelete === entry.id
                                ? 'bg-red-500/15 text-red-400'
                                : 'text-tea-text-dim hover:text-tea-text hover:bg-tea-elevated/50'
                            }`}
                          >
                            <Trash2 size={12} />
                            {confirmDelete === entry.id ? 'Confirm' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
