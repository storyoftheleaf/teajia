import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, Leaf, Sparkles, Mic,
  Heart, ThumbsUp, Minus, ThumbsDown, ShoppingCart,
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import type { TastingData, CustomerTasting } from '../../types';
import { TastingFlow, ALL_SECTIONS, type SectionId } from './TastingFlow';
import { useAppStore } from '../../lib/store';
import { syncTastingJournal } from '../../lib/tastingJournalSync';
import { api, hasToken } from '../../lib/api';
import { resolveTermLabel, resolveTermIcon } from '../../data/tastingTaxonomy';

export interface TastingItem {
  id: string;
  name: string;
  type?: string;
  image?: string;
  /** Stamps sourceType on every journal entry automatically */
  sourceType?: 'product' | 'compass' | 'event' | 'sample';
  compassEntryId?: string;
  eventId?: string;
  eventTitle?: string;
  /** When set in adminMode, writes a live draft tea_review as the session progresses */
  teaKey?: string;
  /** Links the review back to the originating sample */
  sourceSampleId?: string;
}

type Verdict = 'love' | 'like' | 'neutral' | 'pass';

const VERDICT_OPTIONS: {
  id: Verdict;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
}[] = [
  { id: 'love',    label: 'Love it',  icon: Heart },
  { id: 'like',    label: 'Like it',  icon: ThumbsUp },
  { id: 'neutral', label: 'Neutral',  icon: Minus },
  { id: 'pass',    label: 'Pass',     icon: ThumbsDown },
];

interface TastingSessionProps {
  item: TastingItem;
  onClose: () => void;
  /**
   * ADMIN ONLY: bypasses the journal entirely and writes to the product record.
   * When provided with adminMode=true, the journal is never touched.
   */
  onSave?: (data: TastingData, verdict?: Verdict, wouldBuy?: boolean) => void;
  /**
   * CUSTOMER: fires after the journal write for domain-specific side effects
   * (e.g. updating the compass store entry, sample store).
   */
  onAfterSave?: (data: TastingData) => void;
  /** When true, onSave is the only write — no journal entry is created */
  adminMode?: boolean;
  /** Pre-populate with existing tasting data (admin edit flows) */
  initialData?: TastingData;
  showVerdict?: boolean;
  onOrderTea?: (item: TastingItem) => void;
}

const TeaLeafRating: React.FC<{ rating: number }> = ({ rating }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }, (_, i) => (
      <Leaf key={i} size={14}
        className={i < rating ? 'text-tea-gold fill-tea-gold' : 'text-tea-text-dim'}
        style={{ opacity: i < rating ? 1 : 0.25 }}
      />
    ))}
  </div>
);

export const TastingSession: React.FC<TastingSessionProps> = ({
  item, onClose, onSave, onAfterSave, adminMode = false, initialData, showVerdict = false, onOrderTea,
}) => {
  const { addTasting, updateTasting, activeAccountId, tastingJournal } = useAppStore();
  const isGuest = !hasToken();
  const [tastingData, setTastingData] = useState<TastingData>(initialData ?? {});
  const [phase, setPhase] = useState<'tasting' | 'saved'>('tasting');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  // Live draft review (admin + teaKey only) — Mode 3 async collaborative tasting
  const draftReviewIdRef = useRef<string | null>(null);
  const isCreatingDraftRef = useRef(false);
  const draftDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStateRef = useRef(saveState);
  useEffect(() => { savedStateRef.current = saveState; }, [saveState]);

  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [wouldBuy, setWouldBuy] = useState(false);

  const [activeSectionId, setActiveSectionId] = useState<SectionId>('body');
  const [showNote, setShowNote] = useState(false);
  const [startNoteSignal, setStartNoteSignal] = useState(0);
  const [stopNoteSignal, setStopNoteSignal] = useState(0);
  const [sectionCounts, setSectionCounts] = useState<Record<SectionId, number>>({
    body: 0, throat: 0, state: 0, flavor: 0, appearance: 0,
  });

  // Long-press on Note
  const noteHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteDidLongPress = useRef(false);

  const handleNotePointerDown = useCallback((e: React.PointerEvent) => {
    noteDidLongPress.current = false;
    noteHoldTimer.current = setTimeout(() => {
      noteDidLongPress.current = true;
      setShowNote(true);
      setStartNoteSignal(s => s + 1); // fires every hold, not just first mount
      if (navigator.vibrate) navigator.vibrate(30);
    }, 350);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const handleNotePointerUp = useCallback(() => {
    if (noteHoldTimer.current) { clearTimeout(noteHoldTimer.current); noteHoldTimer.current = null; }
    if (!noteDidLongPress.current) {
      setShowNote(v => !v);
    } else {
      // Release after long-press: stop the recording
      setStopNoteSignal(s => s + 1);
    }
    noteDidLongPress.current = false;
  }, []);

  const handleNotePointerCancel = useCallback(() => {
    if (noteHoldTimer.current) { clearTimeout(noteHoldTimer.current); noteHoldTimer.current = null; }
    noteDidLongPress.current = false;
  }, []);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  // Cleanup draft on unmount if session was abandoned (not saved)
  useEffect(() => {
    return () => {
      if (draftReviewIdRef.current && savedStateRef.current !== 'saved') {
        api.teaReviews.remove(draftReviewIdRef.current).catch(() => {});
      }
      if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
    };
  }, []);

  // Draft-aware onChange — writes live state to tea_reviews when adminMode + teaKey
  const handleTastingChange = useCallback((data: TastingData) => {
    setTastingData(data);
    if (!adminMode || !item.teaKey) return;

    if (!draftReviewIdRef.current && !isCreatingDraftRef.current) {
      isCreatingDraftRef.current = true;
      api.teaReviews.create({
        tea_key: item.teaKey,
        source_sample_id: item.sourceSampleId,
        tasting: data as Record<string, unknown>,
        voice_notes: data.notes,
        status: 'draft',
        visibility: 'network',
      }).then((review: any) => {
        draftReviewIdRef.current = review.id;
        isCreatingDraftRef.current = false;
      }).catch(() => {
        isCreatingDraftRef.current = false;
      });
    } else if (draftReviewIdRef.current) {
      if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
      draftDebounceRef.current = setTimeout(() => {
        if (draftReviewIdRef.current) {
          api.teaReviews.update(draftReviewIdRef.current, {
            tasting: data as Record<string, unknown>,
            voice_notes: data.notes,
          }).catch(() => {});
        }
      }, 2000);
    }
  }, [adminMode, item.teaKey, item.sourceSampleId]);

  const hasArrayNotes = Object.values(tastingData).some(arr => Array.isArray(arr) && arr.length > 0);
  const hasCaptureData =
    tastingData.quality != null ||
    tastingData.cleanliness != null ||
    tastingData.clarity != null ||
    tastingData.huiGan != null ||
    (tastingData.notes?.length ?? 0) > 0;
  const hasNotes = hasArrayNotes || hasCaptureData;

  const handleSave = useCallback(() => {
    if (saveState !== 'idle') return;
    setSaveState('saving');

    try {
      // Submit draft review if one was created during this session
      if (draftReviewIdRef.current) {
        if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
        api.teaReviews.update(draftReviewIdRef.current, {
          tasting: tastingData as Record<string, unknown>,
          voice_notes: tastingData.notes,
          status: 'submitted',
        }).catch(() => {});
        draftReviewIdRef.current = null; // prevent cleanup on unmount from deleting it
      }

      if (adminMode && onSave) {
        // Admin flow: write to product record only, no journal entry
        onSave(tastingData);
      } else {
        // Customer flow: always write to journal
        const entryId = crypto.randomUUID();
        const entry: CustomerTasting = {
          id: entryId,
          teaId: item.id,
          teaName: item.name,
          teaType: item.type || '',
          teaImage: item.image,
          tasting: tastingData,
          personalNote: tastingData.notes?.join('\n') || tastingData.voiceNote?.trim() || undefined,
          rating: tastingData.quality ?? tastingData.rating,
          createdAt: new Date().toISOString(),
          sourceType: item.sourceType,
          compassEntryId: item.compassEntryId,
          eventId: item.eventId,
          eventTitle: item.eventTitle,
          accountId: activeAccountId ?? undefined,
        };
        addTasting(entry);
        setSavedEntryId(entryId);
        // Domain side effect (e.g. update compass store entry)
        onAfterSave?.(tastingData);
        // Fire-and-forget sync to server
        syncTastingJournal().catch(() => {});
      }
    } catch {
      setSaveState('idle');
      return;
    }

    setSaveState('saved');
    saveTimerRef.current = setTimeout(() => setPhase('saved'), 400);
  }, [item, tastingData, addTasting, onSave, onAfterSave, adminMode, activeAccountId, saveState]);

  const handleVerdictSelect = useCallback((v: Verdict) => {
    setVerdict(v);
    if (adminMode && onSave) {
      onSave(tastingData, v, wouldBuy);
    } else if (savedEntryId) {
      updateTasting(savedEntryId, { verdict: v, wouldBuy });
    }
  }, [savedEntryId, wouldBuy, updateTasting, onSave, adminMode, tastingData]);

  const handleWouldBuyToggle = useCallback(() => {
    const next = !wouldBuy;
    setWouldBuy(next);
    if (savedEntryId) updateTasting(savedEntryId, { wouldBuy: next });
  }, [wouldBuy, savedEntryId, updateTasting]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-0 z-priority bg-tea-bg flex flex-col"
      style={{
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-tea-border shrink-0"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {item.image && (
            <img src={item.image} alt="" className="w-8 h-8 rounded-md object-cover shrink-0" />
          )}
          <div className="min-w-0">
            <div
              className="text-sm font-medium text-tea-text truncate"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {item.name}
            </div>
            {item.type && (
              <div className="text-[10px] text-tea-text-dim">{item.type}</div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="pill text-xs text-tea-text-sec shrink-0 ml-3"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}
        >
          Cancel
        </button>
      </div>

      <AnimatePresence mode="wait">
        {phase === 'tasting' ? (

          /* ── Tasting phase ── */
          <motion.div
            key="tasting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 min-h-0 flex flex-col"
          >
            {/* TastingFlow fills all available space — fade bottom edge as scroll hint (#8) */}
            <div className="flex-1 min-h-0 overflow-hidden relative">
              <div className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none z-10"
                style={{ background: 'linear-gradient(to bottom, transparent, var(--tea-bg))' }}
              />
              <TastingFlow
                mode="customer"
                value={tastingData}
                onChange={handleTastingChange}
                teaType={item.type}
                activeSectionId={activeSectionId}
                onSectionChange={setActiveSectionId}
                showNote={showNote}
                startNoteSignal={startNoteSignal}
                stopNoteSignal={stopNoteSignal}
                onCountsChange={setSectionCounts}
              />
            </div>

            {/* Bottom bar — elevated surface (#10) */}
            <div
              className="shrink-0 border-t border-tea-border bg-tea-bg"
              style={{
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.25)',
              }}
            >
              {/* Section tabs + mic */}
              <LayoutGroup>
                <div className="flex">
                  {ALL_SECTIONS.map((section) => {
                    const isActive = section.id === activeSectionId;
                    const count = sectionCounts[section.id];
                    return (
                      <button
                        key={section.id}
                        onClick={() => {
                          setActiveSectionId(section.id);
                          setShowNote(false);
                        }}
                        className={`relative flex-1 flex items-center justify-center gap-1.5 py-3 transition-colors duration-200 ${
                          isActive ? 'text-tea-gold font-semibold' : 'text-tea-text/40 hover:text-tea-text/70'
                        }`}
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '11px',
                          letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {/* Active pill — hidden when note panel is open so it can slide to mic */}
                        {isActive && !showNote && (
                          <motion.div
                            layoutId="tasting-tab-bg"
                            className="absolute inset-x-1 top-1.5 bottom-1.5 rounded-md"
                            style={{ background: 'rgb(var(--tea-gold-rgb) / 0.08)' }}
                            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                          />
                        )}
                        <span className="relative z-[1]">{section.label}</span>
                        {count > 0 && (
                          <span className={`relative z-[1] text-[9px] font-bold ${isActive ? 'text-tea-gold' : 'text-tea-text-dim'}`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Mic — lives in the tab row as a 5th equal cell */}
                  <button
                    onPointerDown={handleNotePointerDown}
                    onPointerUp={handleNotePointerUp}
                    onPointerCancel={handleNotePointerCancel}
                    aria-pressed={showNote}
                    title="Tap to type · Hold to record"
                    className={`relative flex-1 flex items-center justify-center py-3 transition-colors duration-200 select-none ${
                      showNote
                        ? 'text-tea-gold'
                        : (tastingData.notes?.length ?? 0) > 0
                          ? 'text-tea-gold/60'
                          : 'text-tea-text/40 hover:text-tea-text/70'
                    }`}
                    style={{ touchAction: 'none' }}
                  >
                    {showNote && (
                      <motion.div
                        layoutId="tasting-tab-bg"
                        className="absolute inset-x-1 top-1.5 bottom-1.5 rounded-md"
                        style={{ background: 'rgb(var(--tea-gold-rgb) / 0.08)' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative z-[1] flex items-center gap-1">
                      <Mic size={14} />
                      {(tastingData.notes?.length ?? 0) > 0 && !showNote && (
                        <span className="text-[9px] font-bold">{tastingData.notes!.length}</span>
                      )}
                    </span>
                  </button>
                </div>
              </LayoutGroup>

              {/* Save */}
              <div className="px-3 pb-3">
                <button
                  onClick={handleSave}
                  disabled={!hasNotes || saveState !== 'idle'}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    saveState === 'saving' || saveState === 'saved'
                      ? 'bg-tea-gold text-tea-bg scale-[0.98]'
                      : hasNotes
                        ? 'border border-tea-gold/40 text-tea-gold hover:bg-tea-gold/8 active:scale-[0.98]'
                        : 'border border-tea-border text-tea-text-dim cursor-not-allowed'
                  }`}
                >
                  <motion.span
                    key={saveState}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-2"
                  >
                    <Check size={15} />
                    {saveState === 'idle' && 'Save'}
                    {saveState === 'saving' && 'Saving…'}
                    {saveState === 'saved' && 'Saved ✓'}
                  </motion.span>
                </button>
              </div>
            </div>
          </motion.div>

        ) : (

          /* ── Confirmation phase ── */
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 overflow-auto px-4 py-8"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 32px)' }}
          >
            {/* Particles */}
            <div className="relative">
              <style>{`
                @keyframes goldParticleFall {
                  0% { opacity: 1; transform: translateY(0) scale(1); }
                  50% { opacity: 0.7; }
                  100% { opacity: 0; transform: translateY(28px) scale(0.3); }
                }
                .gold-particle {
                  position: absolute; width: 4px; height: 4px;
                  border-radius: 50%; background: var(--tea-gold);
                  animation: goldParticleFall 0.9s ease-out forwards;
                  pointer-events: none;
                }
              `}</style>
              <div className="gold-particle" style={{ top: '10px', left: 'calc(50% - 20px)', animationDelay: '0s' }} />
              <div className="gold-particle" style={{ top: '6px',  left: 'calc(50% + 14px)', animationDelay: '0.1s' }} />
              <div className="gold-particle" style={{ top: '12px', left: 'calc(50% - 8px)',  animationDelay: '0.2s' }} />
              <div className="gold-particle" style={{ top: '8px',  left: 'calc(50% + 24px)', animationDelay: '0.15s' }} />
            </div>

            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-tea-gold/15 flex items-center justify-center mx-auto mb-3">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                >
                  <Check size={28} className="text-tea-gold" />
                </motion.div>
              </div>
              <div className="text-sm font-medium text-tea-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                Tasting Saved
              </div>
              <div className="text-xs text-tea-text-dim">Added to your journal</div>

              {tastingData.quality != null && (
                <div className="mt-2 flex justify-center">
                  <span className="text-tea-gold text-lg font-semibold" style={{ fontFamily: 'var(--font-mono)' }}>
                    {tastingData.quality}
                  </span>
                  <span className="text-tea-text-dim text-xs ml-1 self-end mb-0.5">/10</span>
                </div>
              )}
              {!tastingData.quality && tastingData.rating != null && tastingData.rating > 0 && (
                <div className="mt-2 flex justify-center">
                  <TeaLeafRating rating={tastingData.rating} />
                </div>
              )}
            </div>

            {(tastingData.cleanliness || tastingData.clarity || tastingData.body?.length || tastingData.huiGan) && (
              <div className="rounded-xl p-4 mb-3 bg-tea-surface/50">
                <div className="flex flex-wrap gap-1.5">
                  {tastingData.cleanliness && <span className="tag" style={{ textTransform: 'capitalize' }}>{tastingData.cleanliness}</span>}
                  {tastingData.clarity && <span className="tag" style={{ textTransform: 'capitalize' }}>{tastingData.clarity}</span>}
                  {tastingData.body?.map(b => <span key={b} className="tag" style={{ textTransform: 'capitalize' }}>{b}</span>)}
                  {tastingData.huiGan && <span className="tag"><Sparkles size={10} className="shrink-0 text-tea-gold" />Hui Gan</span>}
                </div>
              </div>
            )}

            {(tastingData.flavor?.length ?? 0) > 0 && (
              <div className="rounded-xl p-4 mb-3 bg-tea-surface/50">
                <div className="text-[9px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                  Taste
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tastingData.flavor!.map(termId => {
                    const Icon = resolveTermIcon(termId);
                    return (
                      <span key={termId} className="tag">
                        <Icon size={11} className="shrink-0 text-tea-gold" style={{ opacity: 0.7 }} />
                        {resolveTermLabel(termId)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {(tastingData.notes?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-1.5 mb-4">
                {tastingData.notes!.map((note, i) => (
                  <div key={i} className="text-xs text-tea-text-dim italic px-1" style={{ fontFamily: 'var(--font-body)' }}>
                    &ldquo;{note}&rdquo;
                  </div>
                ))}
              </div>
            )}

            {/* Account nudge — shown to guests after 3+ tastings */}
            {isGuest && !adminMode && tastingJournal.length >= 3 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mb-4 rounded-xl border border-tea-gold/20 bg-tea-gold/5 px-4 py-3"
              >
                <div className="text-xs font-medium text-tea-text mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>
                  Keep your tastings
                </div>
                <div className="text-[11px] text-tea-text-dim mb-2.5" style={{ fontFamily: 'var(--font-body)' }}>
                  You have {tastingJournal.length} tastings saved locally. Create a free account to sync them across devices and never lose them.
                </div>
                <button
                  onClick={() => window.dispatchEvent(new Event('open-account-panel'))}
                  className="text-[11px] font-semibold text-tea-gold hover:opacity-80 transition-opacity"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}
                >
                  Create account →
                </button>
              </motion.div>
            )}

            {/* Verdict — sourcing flows */}
            {showVerdict && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-2 mb-4"
              >
                <div
                  className="text-[10px] uppercase tracking-[0.18em] text-tea-text-dim font-medium mb-3"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Would you stock this?
                </div>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {VERDICT_OPTIONS.map(({ id, label, icon: Icon }) => {
                    const isActive = verdict === id;
                    return (
                      <motion.button
                        key={id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleVerdictSelect(id)}
                        aria-pressed={isActive}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all duration-150 ${
                          isActive
                            ? 'text-tea-gold border-tea-gold/40 bg-tea-gold/8'
                            : 'border-tea-border text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface'
                        }`}
                      >
                        <Icon size={18} />
                        <span className="text-[11px] font-medium" style={{ fontFamily: 'var(--font-display)' }}>
                          {label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
                <button
                  onClick={handleWouldBuyToggle}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm transition-all border ${
                    wouldBuy
                      ? 'border-tea-gold/30 bg-tea-gold/8 text-tea-gold font-medium'
                      : 'border-tea-border text-tea-text-dim hover:text-tea-text-sec'
                  }`}
                >
                  <ShoppingCart size={15} />
                  {wouldBuy ? 'Would order this' : 'Would you order it?'}
                </button>
              </motion.div>
            )}

            <div className="flex flex-col gap-2 mt-2">
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
    </motion.div>,
    document.body
  );
};
