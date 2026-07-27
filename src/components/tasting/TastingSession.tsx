import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, Leaf, Sparkles, Mic, Loader2,
  Heart, ThumbsUp, Minus, ThumbsDown, ShoppingCart,
  Thermometer, Timer, X,
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import type { TastingData, CustomerTasting } from '../../types';
import { TastingFlow, ALL_SECTIONS, type SectionId } from './TastingFlow';
import { useAppStore } from '../../lib/store';
import { syncTastingJournal } from '../../lib/tastingJournalSync';
import { injectTastingNote } from '../shared/NoteThread';
import { useNotesStore } from '../../lib/notesStore';
import { syncNotes } from '../../lib/notesSync';
import { api, hasToken } from '../../lib/api';
import { resolveTermLabel, resolveTermIcon } from '../../data/tastingTaxonomy';
import { NotesPanel } from './NotesPanel';
import { normalizeNotes, notesAsStrings } from '../../lib/noteEntries';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';
import { SampleIcon } from '../Icons';

export interface TastingItem {
  id: string;
  name: string;
  type?: string;
  image?: string;
  /** Stamps sourceType on every journal entry automatically */
  sourceType?: 'product' | 'compass' | 'event' | 'sample' | 'session';
  compassEntryId?: string;
  eventId?: string;
  eventTitle?: string;
  /** When set in adminMode, writes a live draft tea_review as the session progresses */
  teaKey?: string;
  /** Links the review back to the originating sample */
  sourceSampleId?: string;
  /**
   * When set, this is a fresh tasting on a tea that already has an entry. The
   * session opens with a blank profile (not pre-filled), and on save appends a
   * new TastingRecord to the entry instead of editing the note in place. The
   * string is the user-supplied reason ("different vessel", "aged a year", etc).
   */
  freshReason?: string;
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

const VESSEL_OPTIONS = ['Gaiwan', 'Yixing', 'Glass', 'Teapot', 'Other'] as const;

interface TastingSessionProps {
  item: TastingItem;
  onClose: () => void;
  /**
   * ADMIN ONLY: bypasses the journal entirely and writes to the product record.
   * When provided with adminMode=true, the journal is never touched.
   * Supports async saves. Errors are caught and surface in saveState.
   */
  onSave?: (data: TastingData, verdict?: Verdict, wouldBuy?: boolean) => void | Promise<void>;
  /**
   * CUSTOMER: fires after the journal write for domain-specific side effects
   * (e.g. updating the compass store entry, sample store).
   * Receives verdict + wouldBuy when set (sourcing flows).
   */
  onAfterSave?: (data: TastingData, verdict?: Verdict, wouldBuy?: boolean) => void;
  /** When true, onSave is the only write, and no journal entry is created */
  adminMode?: boolean;
  /** Pre-populate with existing tasting data (admin edit flows) */
  initialData?: TastingData;
  showVerdict?: boolean;
  onOrderTea?: (item: TastingItem) => void;
  /** Admin: opens the PO creation modal after a love/like verdict */
  onCreatePO?: () => void;
  /** Admin: receives generated description text for saving to product record */
  onWriteDescription?: (text: string) => void | Promise<void>;
  /** When true, creates a live draft tea_review even in non-adminMode (for admin co-tasting on SamplePage) */
  writeDraftReview?: boolean;
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

function generateDescription(data: TastingData): string {
  const parts: string[] = [];
  if (data.body?.length) parts.push(data.body.slice(0, 2).map(resolveTermLabel).filter(Boolean).join(', ') + ' body');
  if (data.flavor?.length) parts.push('notes of ' + data.flavor.slice(0, 3).map(resolveTermLabel).filter(Boolean).join(', '));
  if (data.cleanliness) parts.push(data.cleanliness + ' finish');
  if (data.huiGan) parts.push('hui gan');
  if (data.feeling?.length) parts.push(data.feeling.slice(0, 2).map(resolveTermLabel).filter(Boolean).join(', ') + ' effect');
  if (data.quality != null) parts.push(`scored ${data.quality}/10`);
  return parts.length ? parts.join('. ') + '.' : '';
}

export const TastingSession: React.FC<TastingSessionProps> = ({
  item, onClose, onSave, onAfterSave, adminMode = false, initialData, showVerdict = false, onOrderTea, onCreatePO, onWriteDescription, writeDraftReview = false,
}) => {
  const { addTasting, updateTasting, upsertTastingByProductId, activeAccountId, activeAccount, tastingJournal } = useAppStore();
  const { addNote } = useNotesStore();
  const isGuest = !hasToken();

  // Existing entry for this product, if any. In the new model, opening
  // TastingSession on a tea you've tasted before edits the entry's note in
  // place (default) instead of creating a new journal row. A freshReason on
  // the item bypasses the pre-fill: this is the friction path for a fully
  // new tasting (different vessel, aged tea, etc.) that nests under the
  // same entry as a new TastingRecord.
  const existingEntry = React.useMemo(() => {
    if (adminMode || !item.id || initialData || item.freshReason) return null;
    return tastingJournal.find(e => e.productId === item.id && !e.archived) ?? null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

  const [tastingData, setTastingData] = useState<TastingData>(initialData ?? existingEntry?.note.tasting ?? {});
  const [isContinuing, setIsContinuing] = useState(!!existingEntry);
  const [phase, setPhase] = useState<'tasting' | 'saved'>('tasting');

  useScrollLock(true);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  // Brewing context (admin mode)
  const [showBrewing, setShowBrewing] = useState(
    !!(initialData?.brewingVessel || initialData?.brewingTemp || initialData?.brewingTime)
  );

  // Live draft review (admin + teaKey only): Mode 3 async collaborative tasting
  const draftReviewIdRef = useRef<string | null>(null);
  const isCreatingDraftRef = useRef(false);
  const draftDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedStateRef = useRef(saveState);
  useEffect(() => { savedStateRef.current = saveState; }, [saveState]);

  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [wouldBuy, setWouldBuy] = useState(false);

  // Fresh-tasting flow: when a user explicitly starts a new tasting on a tea
  // they've already noted (different vessel, aged tea, etc.), they enter a
  // reason and the next save appends a TastingRecord rather than editing the
  // note in place. The reason is required (~10+ chars) so this stays the
  // friction path, not the default.
  const [freshReason, setFreshReason] = useState<string>(item.freshReason ?? '');
  const [freshPromptOpen, setFreshPromptOpen] = useState<boolean>(!!item.freshReason);
  const isFreshTasting = !!freshReason.trim();

  const [activeSectionId, setActiveSectionId] = useState<SectionId>('body');
  const [showNote, setShowNote] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);
  const [sectionCounts, setSectionCounts] = useState<Record<SectionId, number>>({
    body: 0, state: 0, flavor: 0, appearance: 0,
  });

  // NOTE tab press-and-hold: hold (>=150ms) starts silent capture; release or
  // a subsequent tap stops it. Short press (<150ms) toggles the panel.
  const noteTabHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteTabPressStartRef = useRef<number | null>(null);
  const noteTabRecordingStartedRef = useRef(false);
  const noteTabHandledInDownRef = useRef(false);
  const HOLD_THRESHOLD_MS = 150;

  const pushSilentNote = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const entry = {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `note-${Date.now()}`,
      text: trimmed,
      capturedAt: new Date().toISOString(),
    };
    setTastingData(prev => ({
      ...prev,
      notes: [...normalizeNotes(prev), entry],
    }));
  }, []);

  const silentVoice = useVoiceCapture({ onTranscribed: pushSilentNote });

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); }, []);

  // Auto-save + close when Account or Search is opened
  const dismissHandlerRef = useRef<() => void>(null!);
  dismissHandlerRef.current = () => {
    if (phase === 'saved') { onClose(); return; }
    if (hasNotes && saveState === 'idle') { onAfterSave?.(tastingData); }
    onClose();
  };
  useEffect(() => {
    const handler = () => dismissHandlerRef.current();
    window.addEventListener('dismiss-tasting-overlay', handler);
    return () => window.removeEventListener('dismiss-tasting-overlay', handler);
  }, []);

  // Cleanup draft on unmount if session was abandoned (not saved)
  useEffect(() => {
    return () => {
      if (draftReviewIdRef.current && savedStateRef.current !== 'saved') {
        api.teaReviews.remove(draftReviewIdRef.current).catch(() => {});
      }
      if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
    };
  }, []);

  // Draft-aware onChange: writes live state to tea_reviews when adminMode (or writeDraftReview) + teaKey
  const handleTastingChange = useCallback((data: TastingData) => {
    setTastingData(data);
    if ((!adminMode && !writeDraftReview) || !item.teaKey) return;

    if (!draftReviewIdRef.current && !isCreatingDraftRef.current) {
      isCreatingDraftRef.current = true;
      api.teaReviews.create({
        tea_key: item.teaKey,
        source_sample_id: item.sourceSampleId,
        tasting: data as Record<string, unknown>,
        voice_notes: notesAsStrings(data),
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
            voice_notes: notesAsStrings(data),
          }).catch(() => {});
        }
      }, 2000);
    }
  }, [adminMode, writeDraftReview, item.teaKey, item.sourceSampleId]);

  const hasArrayNotes = Object.values(tastingData).some(arr => Array.isArray(arr) && arr.length > 0);
  const hasCaptureData =
    tastingData.quality != null ||
    tastingData.cleanliness != null ||
    tastingData.clarity != null ||
    tastingData.huiGan != null ||
    tastingData.tangGan != null ||
    (tastingData.notes?.length ?? 0) > 0;
  const hasNotes = hasArrayNotes || hasCaptureData;

  // Completeness: all four sections filled + quality score
  const isComplete =
    adminMode &&
    sectionCounts.body > 0 &&
    sectionCounts.state > 0 &&
    sectionCounts.flavor > 0 &&
    sectionCounts.appearance > 0 &&
    tastingData.quality != null;

  // In sourcing mode (showVerdict + !adminMode), verdict is required before saving
  const verdictRequired = showVerdict && !adminMode;
  const canSave = hasNotes && (saveState === 'idle' || saveState === 'error') && (!verdictRequired || verdict !== null);

  const handleCloseRequest = useCallback(() => {
    const hasUnsavedWork = phase === 'tasting' && hasNotes && saveState !== 'saved';
    if (hasUnsavedWork && !window.confirm('Discard unsaved tasting changes?')) return;
    onClose();
  }, [hasNotes, onClose, phase, saveState]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleCloseRequest();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleCloseRequest]);

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaveState('saving');

    try {
      // Submit draft review if one was created during this session
      if (draftReviewIdRef.current) {
        if (draftDebounceRef.current) clearTimeout(draftDebounceRef.current);
        api.teaReviews.update(draftReviewIdRef.current, {
          tasting: tastingData as Record<string, unknown>,
          voice_notes: notesAsStrings(tastingData),
          status: 'submitted',
        }).catch(() => {});
        draftReviewIdRef.current = null; // prevent cleanup on unmount from deleting it
      }

      // Admin saves go to the product record. The personal journal write below
      // also runs for admins, because the admin is also a customer of their
      // own platform: tasting a tea should appear in the journal regardless of
      // whether the tasting also updated the product profile.
      if (adminMode && onSave) {
        await onSave(tastingData);
      }

      {
        // Customer flow (also runs for admin): upsert by productId. If an
        // entry exists for this tea, edits the note in place. If this is a
        // fresh-tasting flow (item carries a freshReason), appends a new
        // TastingRecord instead.
        const recordId = crypto.randomUUID();
        const record = {
          id: recordId,
          createdAt: new Date().toISOString(),
          tasting: tastingData,
          reason: isFreshTasting ? freshReason.trim() : undefined,
          sourceType: item.sourceType,
          eventId: item.eventId,
          eventTitle: item.eventTitle,
        };
        const noteUpdates = {
          personalNote: tastingData.notes?.map(n => typeof n === 'string' ? n : n.text).join('\n') || tastingData.voiceNote?.trim() || undefined,
          rating: tastingData.quality ?? tastingData.rating,
          verdict: verdict ?? undefined,
          wouldBuy: wouldBuy || undefined,
        };
        const entryId = upsertTastingByProductId(
          item.id,
          item.name,
          item.type || '',
          item.image,
          record,
          noteUpdates,
          activeAccountId ?? undefined,
        );
        setSavedEntryId(entryId);
        // Inject tasting artifact into the shared note thread
        if (item.compassEntryId || item.teaKey) {
          injectTastingNote({
            teaKey: item.teaKey,
            compassEntryId: item.compassEntryId,
            tastingId: entryId,
            tastingData,
            authorId: activeAccountId ?? 'guest',
            authorName: activeAccount?.name ?? 'You',
            accountId: activeAccountId ?? 'guest',
          });
        }
        // Domain side effect (e.g. update compass store entry, sample store)
        // Pass verdict + wouldBuy so sourcing callers (SamplePage) can persist them
        onAfterSave?.(tastingData, verdict ?? undefined, wouldBuy || undefined);
        // Fire-and-forget sync to server
        syncTastingJournal().catch(() => {});
      }
    } catch {
      setSaveState('error');
      return;
    }

    setSaveState('saved');
    // Show confirmation screen for all modes
    setPhase('saved');
    // Pre-populate description draft from tasting data
    if (onWriteDescription) {
      setDescriptionDraft(generateDescription(tastingData));
    }
    // Admin: auto-close after 2s only when no action buttons need attention
    if (adminMode && !onCreatePO && !onWriteDescription) {
      saveTimerRef.current = setTimeout(() => onClose(), 2000);
    }
    // Customer: stays open until user taps Done
  }, [item, tastingData, verdict, wouldBuy, addTasting, onSave, onAfterSave, adminMode, activeAccountId, activeAccount, canSave, onClose, onCreatePO, onWriteDescription, phase]);

  const updateNoteFields = useCallback((updates: { verdict?: Verdict; wouldBuy?: boolean }) => {
    if (!savedEntryId) return;
    const current = useAppStore.getState().tastingJournal.find(t => t.id === savedEntryId);
    if (!current) return;
    updateTasting(savedEntryId, {
      note: {
        ...current.note,
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    });
  }, [savedEntryId, updateTasting]);

  const handleVerdictSelect = useCallback((v: Verdict) => {
    setVerdict(v);
    if (adminMode && onSave) {
      onSave(tastingData, v, wouldBuy);
    } else {
      updateNoteFields({ verdict: v, wouldBuy });
    }
  }, [updateNoteFields, wouldBuy, onSave, adminMode, tastingData]);

  const handleWouldBuyToggle = useCallback(() => {
    const next = !wouldBuy;
    setWouldBuy(next);
    if (adminMode && onSave) {
      onSave(tastingData, verdict ?? undefined, next);
      return;
    }
    updateNoteFields({ wouldBuy: next });
  }, [wouldBuy, updateNoteFields, onSave, adminMode, tastingData, verdict]);

  return createPortal(
    <div data-tasting-session-overlay className="fixed inset-0 z-priority lg:bg-black/75 lg:backdrop-blur-sm lg:flex lg:items-center lg:justify-center">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
      className="fixed inset-0 bg-tea-bg flex flex-col lg:relative lg:inset-auto lg:w-[540px] lg:h-[min(94vh,960px)] lg:rounded-xl lg:border lg:border-tea-border lg:overflow-hidden"
      style={{
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      {/* Header */}
      <div
        className="flex min-h-12 shrink-0 items-center gap-2 border-b border-tea-border py-1 pl-4 pr-2"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {item.image && (
            <img src={item.image} alt="" className="w-7 h-7 rounded object-cover shrink-0 opacity-80" loading="lazy" />
          )}
          <div className="min-w-0">
            <div
              className="text-sm font-medium text-tea-text truncate"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {item.name}
            </div>
            {item.type && (
              <div className="text-ui-10 text-tea-text-dim tracking-wide">{item.type}</div>
            )}
          </div>
        </div>

        {phase === 'tasting' && (
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            aria-label={saveState === 'error' ? 'Retry save' : 'Save'}
            className="tap-target min-h-11 shrink-0 px-2 text-ui-12 font-medium text-tea-gold transition-colors hover:text-tea-gold-lt disabled:text-tea-text-sec disabled:cursor-not-allowed"
          >
            {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Retry' : 'Save'}
          </button>
        )}

        <button
          type="button"
          onClick={handleCloseRequest}
          className="tap-target flex min-h-11 min-w-11 shrink-0 items-center justify-center text-tea-text-sec transition-colors hover:text-tea-text"
          aria-label="Close"
        >
          <X size={18} strokeWidth={1.75} aria-hidden />
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
            {/* Continuing banner. The default re-tasting flow edits the
                existing note in place. The "Start a new tasting" affordance
                opens an inline reason prompt for the friction path. */}
            {isContinuing && !isFreshTasting && (
              <div className="px-4 py-2 bg-tea-surface/60 border-b border-tea-border shrink-0">
                {!freshPromptOpen ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-ui-11 text-tea-text-sec italic" style={{ fontFamily: 'var(--font-body)' }}>
                      Adding to your note for this tea.
                    </span>
                    <button
                      type="button"
                      onClick={() => setFreshPromptOpen(true)}
                      className="text-ui-10 text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      Start a new tasting
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-ui-11 text-tea-text-sec leading-snug" style={{ fontFamily: 'var(--font-body)' }}>
                      Use this when something changed (different brew, aged tea, new pot). Otherwise just add to your note above.
                    </div>
                    <textarea
                      autoFocus
                      value={freshReason}
                      onChange={e => setFreshReason(e.target.value)}
                      placeholder="Why are you tasting this again?"
                      rows={2}
                      className="w-full bg-transparent text-ui-12 text-tea-text placeholder:text-tea-text-dim outline-none resize-none border border-tea-border rounded px-2 py-1.5"
                      style={{ fontFamily: 'var(--font-body)' }}
                    />
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => { setFreshPromptOpen(false); setFreshReason(''); }}
                        className="text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={freshReason.trim().length < 10}
                        onClick={() => { setTastingData({}); setIsContinuing(false); }}
                        className="text-ui-11 text-tea-gold hover:text-tea-gold-lt disabled:text-tea-text-dim disabled:cursor-not-allowed transition-colors"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        Begin new tasting
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fresh-tasting context banner. Appears once a fresh tasting is
                under way (the reason has been set). Shows the reason so the
                user can keep their head in the new context. */}
            {isFreshTasting && (
              <div className="px-4 py-2 bg-tea-gold/8 border-b border-tea-border shrink-0">
                <div className="text-ui-11 text-tea-text-sec leading-snug" style={{ fontFamily: 'var(--font-body)' }}>
                  <span className="text-tea-gold">New tasting:</span>{' '}
                  <span className="italic">{freshReason}</span>
                </div>
              </div>
            )}

            {/* Brewing context strip: admin mode only */}
            {adminMode && (
              <div className="shrink-0 border-b border-tea-border">
                <button
                  type="button"
                  onClick={() => setShowBrewing(v => !v)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-ui-11 text-tea-text-sec hover:text-tea-text transition-colors"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}
                >
                  <SampleIcon className="w-3 h-3 shrink-0 opacity-50" />
                  <span className="uppercase tracking-[0.1em]">
                    {tastingData.brewingVessel || tastingData.brewingTemp || tastingData.brewingTime
                      ? [tastingData.brewingVessel, tastingData.brewingTemp ? `${tastingData.brewingTemp}°C` : null, tastingData.brewingTime].filter(Boolean).join(' · ')
                      : 'Add brewing context'}
                  </span>
                </button>
                <AnimatePresence>
                  {showBrewing && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 flex flex-wrap gap-3">
                        {/* Vessel */}
                        <div className="flex flex-col gap-1">
                          <span className="text-ui-10 uppercase tracking-[0.1em] text-tea-text-dim" style={{ fontFamily: 'var(--font-display)' }}>Vessel</span>
                          <div className="flex flex-wrap gap-1">
                            {VESSEL_OPTIONS.map(v => (
                              <button
                                key={v}
                                type="button"
                                onClick={() => handleTastingChange({ ...tastingData, brewingVessel: tastingData.brewingVessel === v ? undefined : v })}
                                className={`text-ui-11 px-2.5 py-1 rounded-full transition-colors ${
                                  tastingData.brewingVessel === v
                                    ? 'bg-tea-gold/15 text-tea-gold'
                                    : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
                                }`}
                                style={{ fontFamily: 'var(--font-body)' }}
                              >
                                {v}
                              </button>
                            ))}
                          </div>
                        </div>
                        {/* Temp */}
                        <div className="flex flex-col gap-1">
                          <span className="text-ui-10 uppercase tracking-[0.1em] text-tea-text-dim" style={{ fontFamily: 'var(--font-display)' }}>
                            <Thermometer size={10} className="inline mr-0.5" />Temp
                          </span>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={50}
                              max={100}
                              value={tastingData.brewingTemp ?? ''}
                              onChange={e => handleTastingChange({ ...tastingData, brewingTemp: e.target.value ? Number(e.target.value) : undefined })}
                              placeholder="95"
                              className="w-16 px-2 py-1 bg-tea-surface border border-tea-border rounded text-ui-12 text-tea-text placeholder:text-tea-text-dim/40 focus:outline-none focus:border-tea-gold/50"
                              style={{ fontFamily: 'var(--font-mono)' }}
                            />
                            <span className="text-ui-11 text-tea-text-dim">°C</span>
                          </div>
                        </div>
                        {/* Time */}
                        <div className="flex flex-col gap-1">
                          <span className="text-ui-10 uppercase tracking-[0.1em] text-tea-text-dim" style={{ fontFamily: 'var(--font-display)' }}>
                            <Timer size={10} className="inline mr-0.5" />Time
                          </span>
                          <input
                            type="text"
                            value={tastingData.brewingTime ?? ''}
                            onChange={e => handleTastingChange({ ...tastingData, brewingTime: e.target.value || undefined })}
                            placeholder="30s"
                            className="w-16 px-2 py-1 bg-tea-surface border border-tea-border rounded text-ui-12 text-tea-text placeholder:text-tea-text-dim/40 focus:outline-none focus:border-tea-gold/50"
                            style={{ fontFamily: 'var(--font-mono)' }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Sourcing verdict: shown before save when showVerdict + customer mode */}
            {showVerdict && !adminMode && (
              <div className="shrink-0 px-4 py-2.5 border-b border-tea-border bg-tea-surface/40">
                <div
                  className="text-ui-10 uppercase tracking-[0.16em] text-tea-text-dim mb-2"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Sourcing verdict {!verdict && <span className="text-tea-gold/70 normal-case tracking-normal">(select before saving)</span>}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {VERDICT_OPTIONS.map(({ id, label, icon: Icon }) => {
                    const isActive = verdict === id;
                    return (
                      <motion.button
                        key={id}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setVerdict(isActive ? null : id)}
                        aria-pressed={isActive}
                        className={`flex flex-col items-center gap-1 py-2 rounded-xl border transition-all duration-150 ${
                          isActive
                            ? 'text-tea-gold border-tea-gold/40 bg-tea-gold/8'
                            : 'border-tea-border text-tea-text-dim hover:text-tea-text-sec hover:bg-tea-surface'
                        }`}
                      >
                        <Icon size={15} />
                        <span className="text-ui-10" style={{ fontFamily: 'var(--font-display)' }}>{label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Structured sections, or the Notes workspace when the NOTE tab is active */}
            <div className="flex-1 min-h-0 overflow-hidden relative">
              <div
                className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none z-10"
                style={{ background: 'linear-gradient(to bottom, transparent, var(--tea-bg))' }}
              />
              {showNote ? (
                <NotesPanel
                  notes={normalizeNotes(tastingData)}
                  onChange={(next) => setTastingData(prev => ({ ...prev, notes: next.length ? next : undefined }))}
                />
              ) : (
                <TastingFlow
                  mode={adminMode ? 'admin' : 'customer'}
                  value={tastingData}
                  onChange={handleTastingChange}
                  activeSectionId={activeSectionId}
                  onSectionChange={setActiveSectionId}
                  onCountsChange={setSectionCounts}
                  simplified={false}
                  teaType={item.type}
                />
              )}
            </div>

            {/* Bottom bar: a flat word taskbar. One crisp hairline separates it
                from the content above; no upward shadow haze (that read as smudged
                shading). Active state is a bronze word + a sliding underline rule,
                not a filled box, so it speaks the same language as the global nav
                capsule beneath it without touching that bar. */}
            <div
              className="shrink-0 border-t border-tea-border bg-tea-bg"
              style={{
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
            >
              {/* Section tabs + mic: the NOTE tab supports tap-to-open and hold-to-record */}
              <LayoutGroup>
                <div className="flex">
                  {ALL_SECTIONS.map((section) => {
                    const isActive = section.id === activeSectionId && !showNote;
                    const count = sectionCounts[section.id];
                    return (
                      <button
                        key={section.id}
                        onClick={() => { setActiveSectionId(section.id); setShowNote(false); }}
                        className={`relative flex-1 flex items-center justify-center py-3.5 transition-colors duration-200 ${
                          isActive ? 'text-tea-gold' : 'text-tea-text/45 hover:text-tea-text/75'
                        }`}
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: '12px',
                          fontWeight: isActive ? 800 : 300,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {/* Active = the word turns bronze + bold. No underline, no
                            box. The color/weight shift alone marks it, matching how
                            the global capsule below signals its active item. */}
                        <span className="relative z-[1] inline-flex items-baseline gap-1">
                          {section.label}
                          {/* Count as a quiet bronze superscript after the word. */}
                          {count > 0 && (
                            <span
                              className="tabular-nums"
                              style={{
                                fontSize: '9px',
                                letterSpacing: 0,
                                color: isActive ? 'var(--tea-gold)' : 'rgb(var(--tea-gold-rgb) / 0.5)',
                                transform: 'translateY(-2px)',
                              }}
                            >
                              {count}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}

                  {/* Hairline divider: separates the four senses (rate) from
                      Note (capture), so Note stops reading as a 5th sense. */}
                  <div className="w-px my-3 bg-tea-border shrink-0" aria-hidden />

                  {/* Note, the capture cell. Word + inline mic, matching the sense
                      tabs' weight. Tap to open panel; press-and-hold to silently
                      capture voice. */}
                  <button
                    type="button"
                    aria-pressed={showNote}
                    aria-label="Notes: tap to open, hold to record"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      // If already recording (e.g. from a previous hold that
                      // left the finger up), any tap stops it.
                      if (silentVoice.state === 'recording') {
                        silentVoice.stop();
                        noteTabHandledInDownRef.current = true;
                        return;
                      }
                      noteTabHandledInDownRef.current = false;
                      noteTabPressStartRef.current = Date.now();
                      noteTabRecordingStartedRef.current = false;
                      noteTabHoldTimerRef.current = setTimeout(() => {
                        noteTabRecordingStartedRef.current = true;
                        silentVoice.start();
                      }, HOLD_THRESHOLD_MS);
                    }}
                    onPointerUp={() => {
                      if (noteTabHandledInDownRef.current) {
                        noteTabHandledInDownRef.current = false;
                        return;
                      }
                      if (noteTabHoldTimerRef.current) {
                        clearTimeout(noteTabHoldTimerRef.current);
                        noteTabHoldTimerRef.current = null;
                      }
                      if (noteTabRecordingStartedRef.current) {
                        // Release-to-stop: the natural hold gesture's end.
                        silentVoice.stop();
                      } else {
                        setShowNote(v => !v);
                      }
                      noteTabPressStartRef.current = null;
                      noteTabRecordingStartedRef.current = false;
                    }}
                    onPointerCancel={() => {
                      if (noteTabHoldTimerRef.current) {
                        clearTimeout(noteTabHoldTimerRef.current);
                        noteTabHoldTimerRef.current = null;
                      }
                      if (noteTabRecordingStartedRef.current) silentVoice.stop();
                      noteTabPressStartRef.current = null;
                      noteTabRecordingStartedRef.current = false;
                      noteTabHandledInDownRef.current = false;
                    }}
                    onPointerLeave={() => {
                      if (noteTabHoldTimerRef.current) {
                        clearTimeout(noteTabHoldTimerRef.current);
                        noteTabHoldTimerRef.current = null;
                      }
                      // Keep recording if finger/cursor leaves, since the user may still be holding.
                    }}
                    className={`relative flex-1 flex items-center justify-center py-3.5 transition-colors duration-200 select-none touch-none ${
                      silentVoice.state === 'recording'
                        ? 'text-tea-gold'
                        : showNote
                          ? 'text-tea-gold'
                          : (tastingData.notes?.length ?? 0) > 0
                            ? 'text-tea-gold/60'
                            : 'text-tea-text/45 hover:text-tea-text/75'
                    }`}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '12px',
                      fontWeight: showNote || silentVoice.state === 'recording' ? 800 : 300,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {/* Active/recording = bronze + bold word, no underline.
                        same bronze-word language as the sense tabs. */}
                    <span className="relative z-[1] inline-flex items-center gap-1.5">
                      {silentVoice.state === 'transcribing' ? (
                        <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                          <Loader2 size={12} />
                        </motion.span>
                      ) : (
                        <Mic size={12} />
                      )}
                      <span className="inline-flex items-baseline gap-1">
                        {silentVoice.state === 'recording' ? 'Rec' : 'Note'}
                        {(tastingData.notes?.length ?? 0) > 0 && !showNote && silentVoice.state !== 'recording' && (
                          <span className="tabular-nums" style={{ fontSize: '9px', letterSpacing: 0, color: 'rgb(var(--tea-gold-rgb) / 0.5)', transform: 'translateY(-2px)' }}>
                            {tastingData.notes!.length}
                          </span>
                        )}
                      </span>
                    </span>
                  </button>
                </div>
              </LayoutGroup>

              {/* Completeness signal: admin only */}
              {adminMode && isComplete && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 pt-1.5 flex items-center gap-1.5"
                >
                  <Check size={11} className="text-tea-gold shrink-0" />
                  <span className="text-ui-10 text-tea-text-sec" style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}>
                    Profile complete
                  </span>
                </motion.div>
              )}

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
                {adminMode ? 'Profile Saved' : 'Tasting Saved'}
              </div>
              <div className="text-xs text-tea-text-dim">
                {adminMode ? 'Product tasting profile updated' : 'Added to your journal'}
              </div>

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

              {/* Brewing context summary */}
              {(tastingData.brewingVessel || tastingData.brewingTemp || tastingData.brewingTime) && (
                <div className="mt-2 flex items-center justify-center gap-2 text-ui-11 text-tea-text-dim" style={{ fontFamily: 'var(--font-body)' }}>
                  <SampleIcon className="w-[11px] h-[11px] opacity-50" />
                  {[tastingData.brewingVessel, tastingData.brewingTemp ? `${tastingData.brewingTemp}°C` : null, tastingData.brewingTime].filter(Boolean).join(' · ')}
                </div>
              )}
            </div>

            {(tastingData.cleanliness || tastingData.clarity || tastingData.body?.length || tastingData.huiGan || tastingData.tangGan) && (
              <div className="rounded-xl p-4 mb-3 bg-tea-surface/50">
                <div className="flex flex-wrap gap-1.5">
                  {tastingData.cleanliness && <span className="tag" style={{ textTransform: 'capitalize' }}>{tastingData.cleanliness}</span>}
                  {tastingData.clarity && <span className="tag" style={{ textTransform: 'capitalize' }}>{tastingData.clarity}</span>}
                  {tastingData.body?.map(b => <span key={b} className="tag" style={{ textTransform: 'capitalize' }}>{b}</span>)}
                  {tastingData.huiGan && <span className="tag"><Sparkles size={10} className="shrink-0 text-tea-gold" />回甘 Hui Gan</span>}
                  {tastingData.tangGan && <span className="tag"><Sparkles size={10} className="shrink-0 text-tea-gold" />汤感 Tang Gan</span>}
                </div>
              </div>
            )}

            {(tastingData.flavor?.length ?? 0) > 0 && (
              <div className="rounded-xl p-4 mb-3 bg-tea-surface/50">
                <div className="text-ui-9 uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
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
                {normalizeNotes(tastingData).map((note, i) => (
                  <div key={note.id || i} className="text-xs text-tea-text-dim italic px-1" style={{ fontFamily: 'var(--font-body)' }}>
                    &ldquo;{note.text}&rdquo;
                  </div>
                ))}
              </div>
            )}

            {/* Account nudge: shown to guests after 3+ tastings */}
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
                <div className="text-ui-11 text-tea-text-dim mb-2.5" style={{ fontFamily: 'var(--font-body)' }}>
                  You have {tastingJournal.length} tastings saved locally. Create a free account to sync them across devices and never lose them.
                </div>
                <button
                  onClick={() => window.dispatchEvent(new Event('open-account-panel'))}
                  className="text-ui-11 font-semibold text-tea-gold hover:opacity-80 transition-opacity"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}
                >
                  Create account →
                </button>
              </motion.div>
            )}

            {/* Verdict: sourcing flows (post-save, only if not yet selected pre-save) */}
            {showVerdict && !adminMode && verdict === null && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mt-2 mb-4"
              >
                <div
                  className="text-ui-10 uppercase tracking-[0.18em] text-tea-text-dim font-medium mb-3"
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
                        <span className="text-ui-11 font-medium" style={{ fontFamily: 'var(--font-display)' }}>
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

            {/* Admin: write description from tasting data */}
            {onWriteDescription && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-3 mb-2"
              >
                <div
                  className="text-ui-10 uppercase tracking-[0.18em] text-tea-text-dim mb-2"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Product Description
                </div>
                <textarea
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-tea-surface border border-tea-border rounded-md text-sm text-tea-text placeholder:text-tea-text-dim/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus:border-tea-gold/50 transition-colors resize-none"
                  style={{ fontFamily: 'var(--font-body)' }}
                  placeholder="Describe this tea…"
                />
                <button
                  onClick={async () => {
                    if (!descriptionDraft.trim()) return;
                    setSavingDescription(true);
                    try { await onWriteDescription(descriptionDraft.trim()); } catch { /* noop */ }
                    setSavingDescription(false);
                  }}
                  disabled={!descriptionDraft.trim() || savingDescription}
                  className="mt-2 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border border-tea-gold/40 text-tea-gold hover:bg-tea-gold/8 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {savingDescription ? (
                    <span className="w-4 h-4 border-2 border-tea-gold/30 border-t-tea-gold rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={14} />
                      Save Description
                    </>
                  )}
                </button>
              </motion.div>
            )}

            <div className="flex flex-col gap-2 mt-2">
              {/* Admin: create purchase order from verdict */}
              {onCreatePO && (verdict === 'love' || verdict === 'like') && (
                <button
                  onClick={() => { onCreatePO(); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-tea-gold text-tea-bg hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <ShoppingCart size={16} />
                  Create Purchase Order
                </button>
              )}
              {onOrderTea && (
                <button
                  onClick={() => { onOrderTea(item); onClose(); }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-tea-gold text-tea-bg hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <ShoppingCart size={16} />
                  Order This Tea
                </button>
              )}
              {(!adminMode || onCreatePO || onWriteDescription) && (
                <button
                  onClick={onClose}
                  className="w-full py-3 rounded-xl text-sm text-tea-text-sec hover:text-tea-text transition-colors"
                >
                  Done
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
    </div>,
    document.body
  );
};
