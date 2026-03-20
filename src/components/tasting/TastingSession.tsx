import React, { useState, useCallback, useRef } from 'react';
import { X, Check, ShoppingCart, Leaf } from 'lucide-react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import type { TastingData, CustomerTasting, InventoryItem } from '../../types';
import { TastingFlow } from './TastingFlow';
import { useAppStore } from '../../lib/store';
import {
  flattenTastingNotes,
  resolveTermLabel,
  resolveTermIcon,
  LIQUOR_COLORS,
  TERM_MAP,
  TASTING_CATEGORY_ORDER,
} from '../../data/tastingTaxonomy';
import type { TastingCategoryId } from '../../data/tastingTaxonomy';

interface TastingSessionProps {
  item: InventoryItem;
  onClose: () => void;
  onOrderTea?: (item: InventoryItem) => void;
}

/** Category display labels */
const CATEGORY_DISPLAY_LABELS: Record<string, string> = {
  flavor: 'Flavor',
  body: 'Body',
  finish: 'Finish',
  feeling: 'Feel',
  'liquor-color': 'Color',
  brewing: 'Brew',
};

/** Render 1-5 tea leaf rating */
const TeaLeafRating: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }, (_, i) => (
      <Leaf
        key={i}
        size={14}
        className={i < rating ? 'text-tea-gold fill-tea-gold' : 'text-tea-text-dim'}
        style={{ opacity: i < rating ? 1 : 0.25 }}
      />
    ))}
  </div>
);

export const TastingSession: React.FC<TastingSessionProps> = ({ item, onClose, onOrderTea }) => {
  const { addTasting, tastingJournal } = useAppStore();
  const [tastingData, setTastingData] = useState<TastingData>({});
  const [personalNote, setPersonalNote] = useState('');
  const [phase, setPhase] = useState<'tasting' | 'saved'>('tasting');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [noteExpanded, setNoteExpanded] = useState(false);

  // Drag-to-dismiss state
  const dragY = useMotionValue(0);
  const modalOpacity = useTransform(dragY, [0, 200], [1, 0.5]);
  const touchStartY = useRef<number | null>(null);

  // Previous tasting for this tea
  const previousTasting = tastingJournal.find(t => t.teaId === item.id);

  const hasNotes = Object.values(tastingData).some(arr => Array.isArray(arr) && arr.length > 0);

  const handleSave = useCallback(() => {
    if (saveState !== 'idle') return;
    setSaveState('saving');

    const entry: CustomerTasting = {
      id: crypto.randomUUID(),
      teaId: item.id,
      teaName: item.name,
      teaType: item.type || '',
      teaImage: item.image || undefined,
      tasting: tastingData,
      personalNote: personalNote.trim() || undefined,
      rating: tastingData.rating,
      createdAt: new Date().toISOString(),
    };
    addTasting(entry);

    setSaveState('saved');
    setTimeout(() => {
      setPhase('saved');
    }, 400);
  }, [item, tastingData, personalNote, addTasting, saveState]);

  const allNotes = hasNotes ? flattenTastingNotes(tastingData) : [];

  // Group saved notes by category for confirmation view
  const groupedSavedNotes = TASTING_CATEGORY_ORDER
    .map(catId => ({
      categoryId: catId,
      label: CATEGORY_DISPLAY_LABELS[catId] || catId,
      terms: tastingData[catId] || [],
    }))
    .filter(g => g.terms.length > 0);

  // Drag handle touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    const dy = Math.max(0, e.touches[0].clientY - touchStartY.current);
    dragY.set(dy);
  };
  const handleTouchEnd = () => {
    const currentY = dragY.get();
    if (currentY > 80) {
      onClose();
    } else {
      animate(dragY, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
    touchStartY.current = null;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal - full height on mobile, auto height with max on desktop */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ y: dragY, opacity: modalOpacity }}
        className="relative w-full max-w-lg md:max-w-2xl lg:max-w-4xl h-[100dvh] md:h-auto md:max-h-[90vh] bg-tea-bg md:rounded-2xl overflow-hidden flex flex-col"
      >
        {/* iOS-style drag handle - mobile only */}
        <div
          className="flex justify-center pt-2 pb-1 md:hidden cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-8 h-1 rounded-full bg-tea-border" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-tea-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div
                className="text-sm font-medium text-tea-text truncate"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {phase === 'tasting' ? 'Tasting Session' : 'Saved'}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="text-xs text-tea-text-dim truncate">{item.name}</div>
              {item.type && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-tea-gold/10 text-tea-gold font-medium shrink-0">
                  {item.type}
                </span>
              )}
            </div>
          </div>
          {item.image && (
            <img
              src={item.image}
              alt=""
              className="w-10 h-10 rounded-lg object-cover shrink-0"
            />
          )}
          <button
            onClick={onClose}
            className="p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-tea-text-dim hover:text-tea-text transition-colors"
            aria-label="Close tasting session"
          >
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
              className="flex-1 overflow-auto flex flex-col min-h-0"
            >
              {/* Tasting flow content area */}
              <div className="flex-1 overflow-auto px-5 py-4">
                {/* Previous tasting comparison */}
                {previousTasting && previousTasting.tasting && (
                  <div className="mb-4 px-3 py-2.5 rounded-lg bg-tea-surface/60">
                    <div
                      className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim mb-1.5 font-medium"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      Previous session
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {flattenTastingNotes(previousTasting.tasting).map(termId => (
                        <span
                          key={termId}
                          className="tag"
                          style={{ opacity: 0.45 }}
                        >
                          {resolveTermLabel(termId)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <TastingFlow
                  mode="customer"
                  value={tastingData}
                  onChange={setTastingData}
                  teaType={item.type}
                />
              </div>

              {/* Sticky bottom bar: personal note + save */}
              <div className="px-5 py-3 border-t border-tea-border bg-tea-surface/80 backdrop-blur-sm shrink-0">
                {/* Expandable note input */}
                <div className="mb-3">
                  {noteExpanded ? (
                    <textarea
                      value={personalNote}
                      onChange={e => setPersonalNote(e.target.value)}
                      onBlur={() => {
                        if (!personalNote.trim()) setNoteExpanded(false);
                      }}
                      placeholder="How was this session? Any thoughts to remember..."
                      rows={3}
                      autoFocus
                      className="w-full px-3 py-2 bg-tea-bg rounded-lg text-sm text-tea-text placeholder:text-tea-text-dim/50 focus:outline-none resize-none"
                      style={{ fontFamily: 'var(--font-body)' }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNoteExpanded(true)}
                      className="w-full px-3 py-2 text-left text-sm text-tea-text-dim/60 bg-tea-bg rounded-lg hover:text-tea-text-dim transition-colors truncate"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      {personalNote.trim() || 'Add note...'}
                    </button>
                  )}
                </div>

                {/* Save button with state transitions */}
                <button
                  onClick={handleSave}
                  disabled={!hasNotes || saveState !== 'idle'}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    saveState === 'saved'
                      ? 'bg-tea-gold text-tea-bg scale-[0.98]'
                      : hasNotes
                        ? 'bg-tea-gold text-tea-bg hover:opacity-90 active:scale-[0.98]'
                        : 'bg-tea-border text-tea-text-dim cursor-not-allowed'
                  }`}
                >
                  <motion.span
                    key={saveState}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                  >
                    <Check size={16} />
                    {saveState === 'idle' && 'Save to Journal'}
                    {saveState === 'saving' && 'Saving...'}
                    {saveState === 'saved' && 'Saved \u2713'}
                  </motion.span>
                </button>
              </div>
            </motion.div>
          ) : (
            /* Saved confirmation view */
            <motion.div
              key="saved"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 overflow-auto px-5 py-6"
            >
              {/* CSS-only particle animation: gold dots that fade and fall */}
              <div className="relative">
                <style>{`
                  @keyframes goldParticleFall {
                    0% { opacity: 1; transform: translateY(0) scale(1); }
                    50% { opacity: 0.7; }
                    100% { opacity: 0; transform: translateY(28px) scale(0.3); }
                  }
                  .gold-particle {
                    position: absolute;
                    width: 4px;
                    height: 4px;
                    border-radius: 50%;
                    background: var(--tea-gold);
                    animation: goldParticleFall 0.9s ease-out forwards;
                    pointer-events: none;
                  }
                `}</style>
                <div className="gold-particle" style={{ top: '10px', left: 'calc(50% - 20px)', animationDelay: '0s' }} />
                <div className="gold-particle" style={{ top: '6px', left: 'calc(50% + 14px)', animationDelay: '0.1s' }} />
                <div className="gold-particle" style={{ top: '12px', left: 'calc(50% - 8px)', animationDelay: '0.2s' }} />
                <div className="gold-particle" style={{ top: '8px', left: 'calc(50% + 24px)', animationDelay: '0.15s' }} />
              </div>

              <div className="text-center mb-6">
                {/* Large gold check circle */}
                <div className="w-16 h-16 rounded-full bg-tea-gold/15 flex items-center justify-center mx-auto mb-3">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                  >
                    <Check size={28} className="text-tea-gold" />
                  </motion.div>
                </div>
                <div
                  className="text-sm font-medium text-tea-text mb-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Tasting Saved
                </div>
                <div className="text-xs text-tea-text-dim">Added to your tasting journal</div>

                {/* Rating display as filled tea leaves */}
                {tastingData.rating && tastingData.rating > 0 && (
                  <div className="mt-2 flex justify-center">
                    <TeaLeafRating rating={tastingData.rating} />
                  </div>
                )}
              </div>

              {/* Summary terms grouped by category */}
              {groupedSavedNotes.length > 0 && (
                <div className="rounded-xl p-4 mb-4 bg-tea-surface/50 space-y-3">
                  {groupedSavedNotes.map(group => (
                    <div key={group.categoryId}>
                      <div
                        className="text-[9px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-1"
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {group.label}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {group.terms.map(termId => {
                          const Icon = resolveTermIcon(termId);
                          const termInfo = TERM_MAP.get(termId);
                          const isColor = termInfo?.categoryId === 'liquor-color';
                          const hex = isColor ? LIQUOR_COLORS[termId] : null;
                          return (
                            <span key={termId} className="tag">
                              {hex ? (
                                <span
                                  className="shrink-0 rounded-full"
                                  style={{ width: 10, height: 10, background: hex, display: 'inline-block' }}
                                />
                              ) : (
                                <Icon size={11} className="shrink-0 text-tea-gold" style={{ opacity: 0.7 }} />
                              )}
                              {resolveTermLabel(termId)}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Personal note display */}
              {personalNote.trim() && (
                <div
                  className="text-xs text-tea-text-dim italic mb-4 px-2"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  &ldquo;{personalNote.trim()}&rdquo;
                </div>
              )}

              {/* Post-save actions */}
              <div className="flex flex-col gap-2">
                {onOrderTea && (
                  <button
                    onClick={() => {
                      onOrderTea(item);
                      onClose();
                    }}
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
