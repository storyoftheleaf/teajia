import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookmarkCheck, BookmarkPlus, Check, Droplets, FlaskConical, Mic, Square, Loader2, Share2, ShoppingCart, Layers, Plus, Search, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';
import { syncNotes } from '../../lib/notesSync';
import { useNotesStore } from '../../lib/notesStore';
import { useAppStore } from '../../lib/store';
import { useSampleStore } from '../../samples/sampleStore';
import type { SampleTasting } from '../../samples/types';
import { api, hasToken } from '../../lib/api';
import type { CompassCategory } from './types';
import { CompassIcon } from './CompassIcon';
import { SyncIndicator } from './SyncIndicator';
import { SessionStack } from './SessionStack';
import { CaptureCard, type CaptureCardActions } from './CaptureCard';
import { BrowseView } from './BrowseView';
import { LedgerView } from './LedgerView';
import { useVoiceRecorder } from './useVoiceRecorder';
import { usePlatformPrivilege } from '../../lib/permissions';
import { CompassShareModal } from './CompassShareModal';
import { BatchCaptureRow } from './BatchCaptureRow';
import { CompassEntryDetailPanel } from './CompassEntryDetailPanel';
import { LedgerOverviewPanel } from './LedgerOverviewPanel';
import { SampleCartPanel } from '../samples/SampleCartPanel';
import { useSampleCartStore } from '../../samples/sampleCartStore';

export type CompassMode = 'sourcing' | 'tasting' | 'buying';

interface TeaCompassProps {
  onBack?: () => void;
  /** Start directly on the ledger tab */
  initialMode?: CompassMode;
  /** Open a specific entry by ID */
  initialEntryId?: string;
  /** In sourcing mode, preselect the capture sub-tab (tea / teaware / samples) */
  initialCaptureOption?: 'tea' | 'teaware' | 'samples';
}

// ─── Desktop-only right column placeholder ───────────────────────────────────

const CompassRightEmptyState: React.FC<{
  mode: CompassMode;
  onNewCapture: () => void;
}> = ({ mode, onNewCapture }) => {
  const content = {
    sourcing: { title: 'Ready to capture', body: 'Select a session entry on the left, or start a new one.' },
    tasting: { title: 'Select an entry', body: 'Choose a tea from your library to view or edit its notes.' },
    buying:  { title: 'Transactions expand inline', body: 'Open a transaction on the left to see its line items.' },
  }[mode];
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] py-20 text-center">
      <CompassIcon className="w-8 h-8 text-tea-gold/20 mb-4" />
      <p className="font-serif text-ui-15 text-tea-text/50 mb-1.5 tracking-wide">{content.title}</p>
      <p className="text-ui-12 text-tea-text-dim max-w-[220px] leading-relaxed mb-6">{content.body}</p>
      {mode !== 'sourcing' && (
        <button
          type="button"
          onClick={onNewCapture}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-tea-gold/40 text-tea-gold text-ui-12 font-semibold hover:bg-tea-gold/10 transition-colors"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}
        >
          <Plus size={12} strokeWidth={2} />
          New Entry
        </button>
      )}
    </div>
  );
};

// ─── Main Tea Compass ────────────────────────────────────────────────────

export const TeaCompass: React.FC<TeaCompassProps> = ({ onBack, initialMode, initialEntryId, initialCaptureOption }) => {
  const activeEntryId = useTeaCompassStore((s) => s.activeEntryId);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const commitEntry = useTeaCompassStore((s) => s.commitEntry);
  const discardEntry = useTeaCompassStore((s) => s.discardEntry);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const getEntry = useTeaCompassStore((s) => s.getEntry);
  const isPendingEntry = useTeaCompassStore((s) =>
    s.activeEntryId != null && s.pendingEntries.some((e) => e.id === s.activeEntryId)
  );
  const getSessionEntries = useTeaCompassStore((s) => s.getSessionEntries);
  const activeCategory: CompassCategory = useTeaCompassStore((s) => {
    const id = s.activeEntryId;
    if (!id) return 'tea';
    const entry = s.pendingEntries.find((e) => e.id === id) ?? s.entries.find((e) => e.id === id);
    return entry?.category || 'tea';
  });

  const { activeAccountId, activeAccount } = useAppStore();
  const { addNote } = useNotesStore();

  const addSampleTasting = useSampleStore((s) => s.addTasting);
  const updateSampleStatus = useSampleStore((s) => s.updateSampleStatus);
  const samplesList = useSampleStore((s) => s.samples);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Mode: sourcing (editing an entry), tasting (list), or buying (transactions)
  const [mode, setMode] = useState<CompassMode>(initialMode || 'sourcing');

  // Incoming pending shares (not yet accepted into compass)
  const [shareModalOpen, setShareModalOpen] = useState(false);
  // Track dismissed IDs locally for instant UI removal before refetch
  const [dismissedShareIds, setDismissedShareIds] = useState<Set<string>>(new Set());
  // Track which share ID is being acted on for per-card loading state
  const [actingShareId, setActingShareId] = useState<string | null>(null);

  const { data: incomingShares } = useQuery({
    queryKey: ['compass-incoming'],
    queryFn: () => api.compass.getIncoming(),
    enabled: hasToken(),
    refetchInterval: 60_000,
    select: (data: any) => (data?.shares || []) as Array<{
      id: string;
      tea_key: string;
      shared_metadata: any;
      source_user_name?: string;
      source_account_name?: string;
    }>,
  });

  // Visible shares = server list minus optimistically dismissed ones
  const visibleShares = (incomingShares || []).filter(s => !dismissedShareIds.has(s.id));

  const acceptShareMutation = useMutation({
    mutationFn: (shareId: string) => api.compass.acceptShare(shareId),
    onMutate: (shareId) => {
      setActingShareId(shareId);
      // Optimistically remove from UI immediately
      setDismissedShareIds(prev => new Set([...prev, shareId]));
    },
    onSuccess: async () => {
      await hydrateCompassEntries();
      queryClient.invalidateQueries({ queryKey: ['compass-incoming'] });
    },
    onError: (_, shareId) => {
      // Restore if failed
      setDismissedShareIds(prev => { const s = new Set(prev); s.delete(shareId); return s; });
    },
    onSettled: () => setActingShareId(null),
  });

  const declineShareMutation = useMutation({
    mutationFn: (shareId: string) => api.compass.declineShare(shareId),
    onMutate: (shareId) => {
      setActingShareId(shareId);
      setDismissedShareIds(prev => new Set([...prev, shareId]));
    },
    onError: (_, shareId) => {
      setDismissedShareIds(prev => { const s = new Set(prev); s.delete(shareId); return s; });
    },
    onSettled: () => {
      setActingShareId(null);
      queryClient.invalidateQueries({ queryKey: ['compass-incoming'] });
    },
  });

  // Sync mode when the route's ?tab= param changes (e.g. bottom nav Ledger → Compass)
  useEffect(() => {
    setMode(initialMode || 'sourcing');
  }, [initialMode]);

  // Track whether the user navigated to Capture from the Library (to show back link)
  const [fromLibrary, setFromLibrary] = useState(false);

  // Batch entry mode — rapid-fire name + type row for vendor table sessions
  const [batchMode, setBatchMode] = useState(false);

  // Track just-committed entry for banner
  const [justCommitted, setJustCommitted] = useState<{ name: string; draftProductId?: string } | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open specific entry if initialEntryId is provided
  useEffect(() => {
    if (initialEntryId && getEntry(initialEntryId)) {
      setActiveEntry(initialEntryId);
      setMode('sourcing');
      setCaptureOption('tea');
    }
  }, [initialEntryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When activeEntryId changes externally, switch to sourcing mode
  useEffect(() => {
    if (activeEntryId && mode !== 'sourcing') {
      setMode('sourcing');
    }
  }, [activeEntryId]);

  // Auto-start a capture when opening in sourcing mode with no active entry
  useEffect(() => {
    if (mode === 'sourcing' && !activeEntryId) {
      startNewCapture(activeCategory);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sessionEntries = getSessionEntries();
  const activeEntry = activeEntryId ? getEntry(activeEntryId) : null;

  // ── Capture action bar state (Re-Taste / Want / Buy) ───────────────────
  const captureCardActionsRef = useRef<CaptureCardActions | null>(null);
  const hasTasting = !!(activeEntry?.tasting && Object.values(activeEntry.tasting).some(
    (v: unknown) => Array.isArray(v) ? v.length > 0 : v != null
  ));
  const isWantEntry = activeEntry?.status === 'want';

  const handleNewCapture = useCallback((category?: CompassCategory) => {
    startNewCapture(category || activeCategory);
    setFromLibrary(false);
    setMode('sourcing');
  }, [startNewCapture, activeCategory]);

  const handleCategorySwitch = useCallback((category: CompassCategory) => {
    // If the current entry is still empty, just switch its category instead of creating a new one
    if (activeEntryId) {
      const current = getEntry(activeEntryId);
      if (current && !current.name && !current.notes && !current.type && current.photos.length === 0 && current.status === 'noted') {
        updateEntry(activeEntryId, { category });
        return;
      }
    }
    startNewCapture(category);
    setMode('sourcing');
  }, [startNewCapture, activeEntryId, getEntry, updateEntry]);

  const handleSelectEntry = useCallback(
    (id: string) => {
      setActiveEntry(id);
      setMode('sourcing');
    },
    [setActiveEntry]
  );

  const handleEditEntry = useCallback(
    (id: string) => {
      setActiveEntry(id);
      setFromLibrary(true);
      setMode('sourcing');
    },
    [setActiveEntry]
  );

  const handleCommitEntry = useCallback(() => {
    // Always clear fromLibrary when committing — the new entry shouldn't inherit it
    setFromLibrary(false);

    // Capture committed entry info before it's removed from session
    const committed = activeEntryId ? getEntry(activeEntryId) : null;

    // If this compass entry is linked to a sample, write tasting data back
    if (committed?.isSample && committed.id && committed.tasting &&
        Object.values(committed.tasting).some((v) => Array.isArray(v) ? v.length > 0 : v != null)) {
      const linkedSample = samplesList.find((s) => s.compassEntryId === committed.id);
      if (linkedSample) {
        const tastingRecord: SampleTasting = {
          id: crypto.randomUUID(),
          tasterId: 'admin',
          tasting: committed.tasting,
          verdict: committed.sampleVerdict || 'neutral',
          wouldBuy: committed.sampleWouldBuy || false,
          personalNote: committed.notes || undefined,
          createdAt: new Date().toISOString(),
        };
        addSampleTasting(linkedSample.id, tastingRecord);
        // addTasting in sampleStore auto-advances status from untasted → tasted

        // Auto-advance sample status based on tasting verdict
        const verdict = committed.sampleVerdict;
        if (verdict === 'love' &&
            (linkedSample.status === 'untasted' || linkedSample.status === 'tasted')) {
          updateSampleStatus(linkedSample.id, 'favorite');
        } else if (verdict === 'pass' &&
                   linkedSample.status !== 'ordered' &&
                   linkedSample.status !== 'ordering' &&
                   linkedSample.status !== 'favorite') {
          updateSampleStatus(linkedSample.id, 'passed');
        }
        // 'like' and 'neutral' — addTasting already advances untasted → tasted
      }
    }

    if (committed) {
      setJustCommitted({ name: committed.name || 'Entry', draftProductId: committed.draftProductId });
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => setJustCommitted(null), 5000);
    }

    // After commit removes the entry from session, check if there are remaining session entries
    const remaining = getSessionEntries().filter(
      (e) => e.id !== activeEntryId &&
        (e.name || e.notes || e.type || e.photos.length > 0 || e.status !== 'noted')
    );
    if (remaining.length > 0) {
      setActiveEntry(remaining[0].id);
    } else {
      startNewCapture(
        activeEntryId ? getEntry(activeEntryId)?.category || 'tea' : 'tea'
      );
    }
  }, [getSessionEntries, activeEntryId, setActiveEntry, startNewCapture, getEntry, samplesList, addSampleTasting, updateSampleStatus, setFromLibrary]);

  const handleDiscardActive = useCallback(() => {
    if (!activeEntryId) return;
    const entry = getEntry(activeEntryId);
    const hasContent = entry && (
      entry.name.trim().length > 0 ||
      entry.photos.length > 0 ||
      entry.notes.trim().length > 0 ||
      (entry.tasting != null && Object.values(entry.tasting).some((v) => Array.isArray(v) ? v.length > 0 : v != null))
    );
    if (hasContent && !window.confirm('Discard this entry?')) return;

    // Grab remaining session entries before discarding
    const remaining = getSessionEntries().filter((e) => e.id !== activeEntryId);
    discardEntry(activeEntryId);

    if (remaining.length > 0) {
      setActiveEntry(remaining[0].id);
    } else {
      startNewCapture(activeCategory);
    }
  }, [activeEntryId, getEntry, getSessionEntries, discardEntry, setActiveEntry, startNewCapture, activeCategory]);

  const handleDiscardSessionEntry = useCallback((id: string) => {
    if (id === activeEntryId) {
      const remaining = getSessionEntries().filter((e) => e.id !== id);
      discardEntry(id);
      if (remaining.length > 0) {
        setActiveEntry(remaining[0].id);
      } else {
        startNewCapture(activeCategory);
      }
    } else {
      discardEntry(id);
    }
  }, [activeEntryId, getSessionEntries, discardEntry, setActiveEntry, startNewCapture, activeCategory]);

  const handleSwitchMode = useCallback((newMode: CompassMode) => {
    if (newMode === 'sourcing' && !activeEntryId) {
      startNewCapture(activeCategory);
    }
    setMode(newMode);
  }, [activeEntryId, startNewCapture, activeCategory]);

  // Compass + notes hydration / debounced push / online-retry all live
  // in `useCompassSync` and `useNotesSync` at the app root in `App.tsx`,
  // alongside `useFavoritesSync` / `useTastingJournalSync` / `useOfflineSync`.
  // Those hooks run while authenticated regardless of whether this view is
  // mounted, so compass + notes data stays fresh across navigation.

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      if (!activeEntryId) return;
      const entry = getEntry(activeEntryId);
      addNote({
        accountId: activeAccountId ?? 'guest',
        compassEntryId: activeEntryId,
        teaKey: entry?.teaKey,
        text,
        sourceType: 'voice',
        authorId: activeAccountId ?? 'guest',
        authorName: activeAccount?.name ?? 'You',
        visibility: 'private',
      });
      syncNotes().catch(() => {});
    },
    [activeEntryId, getEntry, addNote, activeAccountId, activeAccount]
  );

  const { state: voiceState, errorMessage: voiceError, handlePress: handleVoicePress } = useVoiceRecorder(handleVoiceTranscript);
  const isPlatformPrivileged = usePlatformPrivilege();

  const pendingIncomingCount = visibleShares.length;

  const [captureOption, setCaptureOption] = useState<'tea' | 'teaware' | 'samples'>(initialCaptureOption || 'tea');
  const sampleCartCount = useSampleCartStore((s) => s.items.length);
  const captureEntryInCart = useSampleCartStore((s) => !!activeEntryId && s.items.some((i) => i.id === activeEntryId));
  const addSampleCartItem = useSampleCartStore((s) => s.addItem);
  const removeSampleCartItem = useSampleCartStore((s) => s.removeItem);

  const showCaptureActionBar = mode === 'sourcing' && captureOption !== 'samples'
    && !!activeEntryId && activeEntry?.category !== 'teaware';

  // Tab-level search — shared across all tabs; cleared on tab switch
  const [tabSearchQuery, setTabSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Per-share preview expand state
  const [expandedShareIds, setExpandedShareIds] = useState<Set<string>>(new Set());

  // Desktop tasting: which entry is shown in the right detail panel
  const [tastingSelectedEntryId, setTastingSelectedEntryId] = useState<string | null>(null);

  // Reset search + tasting selection when switching tabs
  useEffect(() => {
    setTabSearchQuery('');
    setTastingSelectedEntryId(null);
  }, [mode]);

  const handleCaptureOption = useCallback((opt: 'tea' | 'teaware' | 'samples') => {
    setCaptureOption(opt);
    if (opt !== 'samples') handleCategorySwitch(opt as CompassCategory);
  }, [handleCategorySwitch]);

  // Tab config
  const tabs: { id: CompassMode; label: string; badge?: number }[] = [
    { id: 'sourcing', label: 'Source' },
    { id: 'tasting', label: 'Library', badge: pendingIncomingCount > 0 ? pendingIncomingCount : undefined },
    { id: 'buying', label: 'Ledger' },
  ];

  return (
    <div className="flex flex-col relative lg:h-full">

      {/* ── COMPACT HEADER: back + inline tabs + sync dot ── */}
      <div className="flex items-stretch border-b border-tea-border shrink-0 h-10" role="tablist">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center pl-3 pr-2 text-tea-text-dim hover:text-tea-text transition-colors shrink-0"
          aria-label="Back"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
        </button>
        {tabs.map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSwitchMode(tab.id)}
              role="tab"
              aria-selected={active}
              className={`relative shrink-0 px-2.5 text-ui-11 font-semibold tracking-[0.08em] uppercase transition-colors ${
                active ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'
              }`}
            >
              {tab.label}
              {tab.badge != null && (
                <span className="ml-1 text-ui-9 px-[5px] py-px rounded-full bg-tea-gold/20 text-tea-gold">{tab.badge}</span>
              )}
              {active && (
                <motion.div
                  layoutId="compass-tab-indicator"
                  className="absolute bottom-0 left-1 right-1 h-[2px] bg-tea-gold"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
        <div className="flex-1" />
        {mode !== 'sourcing' && (
          <div className="flex items-center pr-2">
            <button
              type="button"
              onClick={() => handleNewCapture()}
              className="pill pill-active flex items-center gap-1 text-ui-11"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <Plus size={11} strokeWidth={2} />
              New
            </button>
          </div>
        )}
        <div className="flex items-center pr-3">
          <SyncIndicator />
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="flex-1 min-h-0 flex flex-col">

        {/* ══════════════════════════════════════════════
            MOBILE PATH — hidden on lg+, original layout
            ══════════════════════════════════════════════ */}
        <div className="flex flex-col flex-1 min-h-0 lg:hidden">

          {/* Search bar — hidden on sourcing (chips strip takes that role) */}
          {mode !== 'sourcing' && (
            <div className="shrink-0 px-4 pt-2.5 pb-1">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={tabSearchQuery}
                  onChange={(e) => setTabSearchQuery(e.target.value)}
                  placeholder={
                    mode === 'tasting'
                      ? 'Search by name, region, vendor…'
                      : 'Search transactions…'
                  }
                  className="w-full bg-tea-surface border border-tea-border text-tea-text text-ui-13 rounded-lg pl-8 pr-8 py-2 outline-none placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40 transition-colors"
                />
                {tabSearchQuery && (
                  <button
                    type="button"
                    onClick={() => { setTabSearchQuery(''); searchInputRef.current?.focus(); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text-sec transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Session chips strip — pinned below header in sourcing mode */}
          {mode === 'sourcing' && captureOption !== 'samples' && (
            <div className="shrink-0 flex items-center gap-1.5 px-4 py-2 border-b border-tea-border overflow-x-auto scrollbar-hide">
              {sessionEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => handleSelectEntry(entry.id)}
                  className={`group relative flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full text-ui-11 border transition-colors shrink-0 ${
                    entry.id === activeEntryId
                      ? 'bg-tea-gold/15 text-tea-gold border-tea-gold/40 font-semibold'
                      : 'bg-transparent text-tea-text-dim border-tea-border hover:text-tea-text-sec'
                  }`}
                >
                  {entry.name || 'New entry'}
                  <span
                    role="button"
                    aria-label="Remove"
                    onClick={(e) => { e.stopPropagation(); handleDiscardSessionEntry(entry.id); }}
                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                  >
                    <X size={9} />
                  </span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleNewCapture()}
                className="whitespace-nowrap px-2.5 py-1 rounded-full text-ui-11 text-tea-text-dim border border-tea-border hover:text-tea-text-sec hover:border-tea-gold/40 transition-colors shrink-0"
              >
                +
              </button>
            </div>
          )}

          {/* Content area */}
          <div
            className={`flex-1 min-h-0 overflow-y-auto overscroll-contain ${
              mode === 'sourcing' && captureOption === 'samples' ? '' : 'px-4 pt-3'
            } ${
              mode === 'sourcing'
                ? showCaptureActionBar
                  ? 'pb-[calc(105px+44px+env(safe-area-inset-bottom,0px))] lg:pb-4'
                  : 'pb-[calc(53px+44px+env(safe-area-inset-bottom,0px))] lg:pb-4'
                : 'pb-3'
            }`}
            role="tabpanel"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <AnimatePresence mode="wait">
              {mode === 'sourcing' ? (
                <motion.div
                  key="sourcing"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Tea / Teaware / Samples 3-way toggle */}
                  <div className="flex gap-0 mb-3 rounded-md bg-tea-surface/30 p-0.5 relative">
                    <motion.div
                      className="absolute top-0.5 bottom-0.5 rounded-[5px] bg-tea-surface shadow-sm"
                      animate={{
                        left: captureOption === 'tea' ? '2px' : captureOption === 'teaware' ? '33.33%' : '66.66%',
                        right: captureOption === 'samples' ? '2px' : captureOption === 'teaware' ? '33.33%' : '66.66%',
                      }}
                      transition={{ duration: 0.1, ease: 'easeOut' }}
                    />
                    <button type="button" onClick={() => handleCaptureOption('tea')}
                      className={`flex-1 text-center py-1.5 text-ui-12 font-medium rounded-[5px] transition-colors relative z-[1] ${captureOption === 'tea' ? 'text-tea-text' : 'text-tea-text-dim hover:text-tea-text-sec'}`}>
                      Tea
                    </button>
                    <button type="button" onClick={() => handleCaptureOption('teaware')}
                      className={`flex-1 text-center py-1.5 text-ui-12 font-medium rounded-[5px] transition-colors relative z-[1] ${captureOption === 'teaware' ? 'text-tea-text' : 'text-tea-text-dim hover:text-tea-text-sec'}`}>
                      Teaware
                    </button>
                    <button type="button" onClick={() => handleCaptureOption('samples')}
                      className={`flex-1 text-center py-1.5 text-ui-12 font-medium rounded-[5px] transition-colors relative z-[1] ${captureOption === 'samples' ? 'text-tea-text' : 'text-tea-text-dim hover:text-tea-text-sec'}`}>
                      Samples{sampleCartCount > 0 && <span className="ml-1 text-ui-11 text-tea-gold tabular-nums">({sampleCartCount})</span>}
                    </button>
                  </div>

                  {captureOption === 'samples' ? (
                    <SampleCartPanel />
                  ) : (
                    <>
                      {/* Batch mode row — rapid-fire entry for vendor tables */}
                      {batchMode && (
                        <BatchCaptureRow />
                      )}

                      {/* Just-committed banner */}
                      <AnimatePresence>
                        {justCommitted && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-3"
                          >
                            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-tea-gold/10 text-tea-gold text-xs font-medium">
                              <Check size={14} strokeWidth={2.5} />
                              <span className="flex-1 truncate">{justCommitted.name} saved</span>
                              <button
                                type="button"
                                onClick={() => { setJustCommitted(null); setMode('tasting'); }}
                                className="flex items-center gap-1 text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
                              >
                                Sessions
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <CaptureCard
                        entryId={activeEntryId}
                        onSwitchToLedger={() => handleSwitchMode('buying')}
                        onCommit={handleCommitEntry}
                        onReturnToLibrary={fromLibrary ? () => { setFromLibrary(false); setMode('tasting'); } : undefined}
                        actionRef={captureCardActionsRef}
                      />
                    </>
                  )}
                </motion.div>
              ) : mode === 'tasting' ? (
                <motion.div
                  key="tasting"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Pending incoming shares — require explicit accept/decline */}
                  {visibleShares.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {/* Header row: count + bulk actions */}
                      <div className="flex items-center gap-2 px-0.5">
                        <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-medium flex-1">
                          {visibleShares.length} pending {visibleShares.length === 1 ? 'share' : 'shares'}
                        </p>
                        {visibleShares.length > 1 && (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => visibleShares.forEach((s) => acceptShareMutation.mutate(s.id))}
                              disabled={acceptShareMutation.isPending || declineShareMutation.isPending}
                              className="text-ui-11 text-tea-gold font-semibold hover:text-tea-gold/80 disabled:opacity-40 transition-colors"
                            >
                              Accept all
                            </button>
                            <span className="text-tea-border text-ui-10">·</span>
                            <button
                              type="button"
                              onClick={() => visibleShares.forEach((s) => declineShareMutation.mutate(s.id))}
                              disabled={acceptShareMutation.isPending || declineShareMutation.isPending}
                              className="text-ui-11 text-tea-text-dim font-medium hover:text-tea-text-sec disabled:opacity-40 transition-colors"
                            >
                              Decline all
                            </button>
                          </div>
                        )}
                      </div>

                      {visibleShares.map((share) => {
                        const meta = share.shared_metadata || {};
                        const from = share.source_user_name || share.source_account_name || 'A taster';
                        const isActing = actingShareId === share.id;
                        const isExpanded = expandedShareIds.has(share.id);
                        const toggleExpanded = () => setExpandedShareIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(share.id)) next.delete(share.id); else next.add(share.id);
                          return next;
                        });
                        return (
                          <div
                            key={share.id}
                            className="rounded-lg bg-tea-surface border border-tea-border px-3 py-2.5 space-y-2"
                          >
                            {/* Card header — always visible */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-ui-11 text-tea-text-sec mb-0.5">From {from}</p>
                                <p className="text-sm font-medium text-tea-text truncate">
                                  {meta.name || 'Unnamed card'}
                                </p>
                                {(meta.type || meta.year) && (
                                  <p className="text-ui-11 text-tea-text-dim">
                                    {[meta.type, meta.year].filter(Boolean).join(' · ')}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-start gap-2 shrink-0">
                                {meta.photo && (
                                  <img
                                    src={meta.photo}
                                    alt={meta.name}
                                    className="w-12 h-12 rounded-md object-cover border border-tea-border"
                                  />
                                )}
                                {/* Preview toggle */}
                                <button
                                  type="button"
                                  onClick={toggleExpanded}
                                  className="mt-0.5 p-1 text-tea-text-dim hover:text-tea-text-sec transition-colors"
                                  aria-label={isExpanded ? 'Collapse preview' : 'Expand preview'}
                                >
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              </div>
                            </div>

                            {/* Inline preview — expanded accordion */}
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.18 }}
                                  className="overflow-hidden"
                                >
                                  <div className="pt-1 pb-0.5 border-t border-tea-border space-y-1.5 text-ui-12">
                                    {meta.originRegion && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Origin</span>
                                        <span className="text-tea-text-sec">{meta.originRegion}</span>
                                      </div>
                                    )}
                                    {meta.season && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Season</span>
                                        <span className="text-tea-text-sec">{meta.season}</span>
                                      </div>
                                    )}
                                    {meta.form && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Form</span>
                                        <span className="text-tea-text-sec">{meta.form}</span>
                                      </div>
                                    )}
                                    {meta.teawareCategory && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Category</span>
                                        <span className="text-tea-text-sec">{meta.teawareCategory}</span>
                                      </div>
                                    )}
                                    {meta.material && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Material</span>
                                        <span className="text-tea-text-sec">{meta.material}</span>
                                      </div>
                                    )}
                                    {meta.capacityMl && (
                                      <div className="flex gap-2">
                                        <span className="text-tea-text-dim w-14 shrink-0">Capacity</span>
                                        <span className="text-tea-text-sec">{meta.capacityMl} ml</span>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            {/* Accept / Decline — always visible */}
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => acceptShareMutation.mutate(share.id)}
                                className="flex-1 py-1.5 rounded-md bg-tea-gold/10 text-tea-gold text-ui-11 font-semibold uppercase tracking-[0.08em] hover:bg-tea-gold/15 disabled:opacity-50 transition-colors"
                              >
                                {isActing ? '…' : 'Accept'}
                              </button>
                              <button
                                type="button"
                                disabled={isActing}
                                onClick={() => declineShareMutation.mutate(share.id)}
                                className="flex-1 py-1.5 rounded-md bg-tea-surface text-tea-text-dim text-ui-11 font-medium hover:text-tea-text-sec disabled:opacity-50 transition-colors border border-tea-border"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Co-tasting session quick-start */}
                  {hasToken() && (
                    <div className="mb-4 rounded-lg bg-tea-surface/40 border border-tea-border px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-ui-11 text-tea-text-sec font-medium">Co-Tasting</p>
                        <p className="text-ui-11 text-tea-text-dim mt-0.5">Taste with others and compare notes</p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const result = await api.sessions.create({ title: 'Tasting Session' });
                            if (result?.session?.id) navigate(`/session/${result.session.id}`);
                          } catch { /* ignore */ }
                        }}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold/10 text-tea-gold text-ui-11 font-semibold hover:bg-tea-gold/15 transition-colors"
                      >
                        <Plus size={11} strokeWidth={2.5} />
                        Start
                      </button>
                    </div>
                  )}

                  <BrowseView
                    onEditEntry={handleEditEntry}
                    onNewCapture={handleNewCapture}
                    externalSearchQuery={tabSearchQuery}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="buying"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <LedgerView
                    embedded
                    onOpenEntry={(entryId) => {
                      setActiveEntry(entryId);
                      setMode('sourcing');
                    }}
                    searchQuery={tabSearchQuery}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>


          {/* Mobile action bar — fixed, single compact row */}
          {mode === 'sourcing' && (
            <div className="fixed left-0 right-0 z-20 bottom-[calc(44px+env(safe-area-inset-bottom,0px))]">
              <AnimatePresence>
                {voiceError && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="text-ui-11 text-red-400 text-center px-4 py-1.5 border-t border-tea-border bg-tea-bg"
                  >
                    {voiceError}
                  </motion.p>
                )}
              </AnimatePresence>

              <div
                className="border-t border-tea-border bg-tea-surface flex items-stretch"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              >
                {/* Taste */}
                {showCaptureActionBar && (
                  <>
                    <button
                      type="button"
                      onClick={() => captureCardActionsRef.current?.openTasting()}
                      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium transition-colors ${
                        hasTasting ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'
                      }`}
                    >
                      <Droplets size={14} strokeWidth={1.5} />
                      {hasTasting ? 'Re-Taste' : 'Taste'}
                    </button>
                    <button
                      type="button"
                      onClick={() => activeEntryId && updateEntry(activeEntryId, { status: isWantEntry ? 'noted' : 'want' })}
                      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium transition-colors ${
                        isWantEntry ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'
                      }`}
                    >
                      {isWantEntry ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
                      {isWantEntry ? 'Wanted' : 'Want'}
                    </button>
                    <button
                      type="button"
                      onClick={() => captureCardActionsRef.current?.toggleBuy()}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium text-tea-text-dim hover:text-tea-text-sec transition-colors"
                    >
                      <ShoppingCart size={14} />
                      Buy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!activeEntryId || !activeEntry) return;
                        if (captureEntryInCart) {
                          removeSampleCartItem(activeEntryId);
                        } else {
                          addSampleCartItem({
                            id: activeEntryId,
                            name: activeEntry.name,
                            chineseName: activeEntry.chineseName,
                            type: activeEntry.type,
                            vendorName: activeEntry.vendorName,
                            compassEntryId: activeEntryId,
                          });
                        }
                      }}
                      className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium transition-colors ${
                        captureEntryInCart ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'
                      }`}
                    >
                      <FlaskConical size={14} strokeWidth={1.5} />
                      {captureEntryInCart ? 'Listed' : 'Sample'}
                    </button>
                    <div className="w-px self-stretch my-1.5 bg-tea-border" />
                  </>
                )}

                {/* Mic */}
                {isPlatformPrivileged && (
                  <>
                    <motion.button
                      type="button"
                      onClick={handleVoicePress}
                      disabled={voiceState === 'transcribing'}
                      className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium transition-colors ${
                        voiceState === 'recording'
                          ? 'text-tea-gold'
                          : voiceState === 'transcribing'
                            ? 'text-tea-text-dim cursor-wait'
                            : 'text-tea-text-dim hover:text-tea-text-sec'
                      }`}
                      aria-label={voiceState === 'recording' ? 'Stop recording' : 'Record note'}
                    >
                      {voiceState === 'recording' && (
                        <motion.span
                          className="absolute inset-0"
                          animate={{ opacity: [0.06, 0.12, 0.06] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          style={{ background: 'var(--tea-gold)' }}
                        />
                      )}
                      <span className="relative flex flex-col items-center gap-0.5">
                        {voiceState === 'recording' ? (
                          <Square size={14} fill="currentColor" />
                        ) : voiceState === 'transcribing' ? (
                          <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="block">
                            <Loader2 size={14} />
                          </motion.span>
                        ) : (
                          <Mic size={14} />
                        )}
                        Mic
                      </span>
                    </motion.button>
                  </>
                )}

                {/* Batch */}
                <button
                  type="button"
                  onClick={() => setBatchMode((v) => !v)}
                  className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium transition-colors ${
                    batchMode ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'
                  }`}
                  aria-label="Batch entry"
                >
                  <Layers size={14} strokeWidth={1.5} />
                  Batch
                </button>

                {/* Share */}
                {hasToken() && activeEntryId && (
                  <button
                    type="button"
                    onClick={() => setShareModalOpen(true)}
                    className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium text-tea-text-dim hover:text-tea-text-sec transition-colors"
                    aria-label="Share"
                  >
                    <Share2 size={14} strokeWidth={1.5} />
                    Share
                  </button>
                )}

                <div className="w-px self-stretch my-1.5 bg-tea-border" />

                {/* Done */}
                <button
                  type="button"
                  onClick={() => {
                    if (!activeEntryId) return;
                    commitEntry(activeEntryId);
                    handleCommitEntry();
                  }}
                  disabled={!activeEntryId || captureOption === 'samples'}
                  className="flex-[1.4] flex items-center justify-center py-2.5 text-tea-gold font-bold text-ui-13 disabled:opacity-30 transition-opacity"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
                  aria-label="Done"
                >
                  Done
                </button>
              </div>
            </div>
          )}

        </div>
        {/* END MOBILE */}

        {/* ══════════════════════════════════════════════════
            DESKTOP PATH — hidden on mobile, two-column split
            ══════════════════════════════════════════════════ */}
        <div className="hidden lg:flex flex-row flex-1 min-h-0 overflow-hidden">

          {/* ── LEFT COLUMN (300px) ── */}
          <div className="flex flex-col w-[300px] shrink-0 border-r border-tea-border overflow-hidden">

            {/* Search bar (desktop) */}
            <div className="shrink-0 px-4 pt-2.5 pb-1">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                <input
                  type="text"
                  value={tabSearchQuery}
                  onChange={(e) => setTabSearchQuery(e.target.value)}
                  placeholder={
                    mode === 'sourcing' ? 'Search entries…'
                    : mode === 'tasting' ? 'Search by name, region, vendor…'
                    : 'Search transactions…'
                  }
                  className="w-full bg-tea-surface border border-tea-border text-tea-text text-ui-13 rounded-lg pl-8 pr-8 py-2 outline-none placeholder:text-tea-text-dim focus:ring-1 focus:ring-tea-gold/40 transition-colors"
                />
                {tabSearchQuery && (
                  <button
                    type="button"
                    onClick={() => { setTabSearchQuery(''); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-tea-text-dim hover:text-tea-text-sec transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable left content */}
            <div
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pt-3 pb-4"
              style={{ WebkitOverflowScrolling: 'touch', scrollbarGutter: 'stable' }}
            >
              <AnimatePresence mode="wait">

                {/* SOURCING LEFT: toggle + SessionStack + banner + new-entry hint */}
                {mode === 'sourcing' && (
                  <motion.div
                    key="left-sourcing"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="flex flex-col gap-3"
                  >
                    {/* 3-way toggle: Tea / Teaware / Samples */}
                    <div className="flex gap-0 rounded-md bg-tea-surface/30 p-0.5 relative">
                      <motion.div
                        className="absolute top-0.5 bottom-0.5 rounded-[5px] bg-tea-surface shadow-sm"
                        animate={{
                          left: captureOption === 'tea' ? '2px' : captureOption === 'teaware' ? '33.33%' : '66.66%',
                          right: captureOption === 'samples' ? '2px' : captureOption === 'teaware' ? '33.33%' : '66.66%',
                        }}
                        transition={{ duration: 0.1, ease: 'easeOut' }}
                      />
                      <button type="button" onClick={() => handleCaptureOption('tea')}
                        className={`flex-1 text-center py-1.5 text-ui-12 font-medium rounded-[5px] transition-colors relative z-[1] ${captureOption === 'tea' ? 'text-tea-text' : 'text-tea-text-dim hover:text-tea-text-sec'}`}>
                        Tea
                      </button>
                      <button type="button" onClick={() => handleCaptureOption('teaware')}
                        className={`flex-1 text-center py-1.5 text-ui-12 font-medium rounded-[5px] transition-colors relative z-[1] ${captureOption === 'teaware' ? 'text-tea-text' : 'text-tea-text-dim hover:text-tea-text-sec'}`}>
                        Teaware
                      </button>
                      <button type="button" onClick={() => handleCaptureOption('samples')}
                        className={`flex-1 text-center py-1.5 text-ui-12 font-medium rounded-[5px] transition-colors relative z-[1] ${captureOption === 'samples' ? 'text-tea-text' : 'text-tea-text-dim hover:text-tea-text-sec'}`}>
                        Samples
                      </button>
                    </div>

                    {/* Sample cart — left panel when samples tab is active */}
                    {captureOption === 'samples' && (
                      <SampleCartPanel />
                    )}

                    {/* SessionStack */}
                    {captureOption !== 'samples' && (
                      <SessionStack
                        sessionEntries={sessionEntries}
                        activeEntryId={activeEntryId}
                        onSelectEntry={handleSelectEntry}
                        onDiscardEntry={handleDiscardSessionEntry}
                      />
                    )}

                    {/* Just-committed banner */}
                    <AnimatePresence>
                      {justCommitted && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-tea-gold/10 text-tea-gold text-xs font-medium">
                            <Check size={14} strokeWidth={2.5} />
                            <span className="flex-1 truncate">{justCommitted.name} saved</span>
                            <button
                              type="button"
                              onClick={() => { setJustCommitted(null); setMode('tasting'); }}
                              className="flex items-center gap-1 text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
                            >
                              Sessions
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* New entry hint button */}
                    {captureOption !== 'samples' && (
                      <button
                        type="button"
                        onClick={() => handleNewCapture()}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-tea-border text-tea-text-dim hover:text-tea-text-sec hover:border-tea-gold/40 text-ui-12 transition-colors"
                      >
                        <Plus size={12} />
                        New Entry
                      </button>
                    )}
                  </motion.div>
                )}

                {/* TASTING LEFT: shares + co-tasting + BrowseView */}
                {mode === 'tasting' && (
                  <motion.div
                    key="left-tasting"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Pending incoming shares */}
                    {visibleShares.length > 0 && (
                      <div className="mb-4 space-y-2">
                        {/* Header row: count + bulk actions */}
                        <div className="flex items-center gap-2 px-0.5">
                          <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-medium flex-1">
                            {visibleShares.length} pending {visibleShares.length === 1 ? 'share' : 'shares'}
                          </p>
                          {visibleShares.length > 1 && (
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => visibleShares.forEach((s) => acceptShareMutation.mutate(s.id))}
                                disabled={acceptShareMutation.isPending || declineShareMutation.isPending}
                                className="text-ui-11 text-tea-gold font-semibold hover:text-tea-gold/80 disabled:opacity-40 transition-colors"
                              >
                                Accept all
                              </button>
                              <span className="text-tea-border text-ui-10">·</span>
                              <button
                                type="button"
                                onClick={() => visibleShares.forEach((s) => declineShareMutation.mutate(s.id))}
                                disabled={acceptShareMutation.isPending || declineShareMutation.isPending}
                                className="text-ui-11 text-tea-text-dim font-medium hover:text-tea-text-sec disabled:opacity-40 transition-colors"
                              >
                                Decline all
                              </button>
                            </div>
                          )}
                        </div>

                        {visibleShares.map((share) => {
                          const meta = share.shared_metadata || {};
                          const from = share.source_user_name || share.source_account_name || 'A taster';
                          const isActing = actingShareId === share.id;
                          const isExpanded = expandedShareIds.has(share.id);
                          const toggleExpanded = () => setExpandedShareIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(share.id)) next.delete(share.id); else next.add(share.id);
                            return next;
                          });
                          return (
                            <div
                              key={share.id}
                              className="rounded-lg bg-tea-surface border border-tea-border px-3 py-2.5 space-y-2"
                            >
                              {/* Card header — always visible */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-ui-11 text-tea-text-sec mb-0.5">From {from}</p>
                                  <p className="text-sm font-medium text-tea-text truncate">
                                    {meta.name || 'Unnamed card'}
                                  </p>
                                  {(meta.type || meta.year) && (
                                    <p className="text-ui-11 text-tea-text-dim">
                                      {[meta.type, meta.year].filter(Boolean).join(' · ')}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-start gap-2 shrink-0">
                                  {meta.photo && (
                                    <img
                                      src={meta.photo}
                                      alt={meta.name}
                                      className="w-12 h-12 rounded-md object-cover border border-tea-border"
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={toggleExpanded}
                                    className="mt-0.5 p-1 text-tea-text-dim hover:text-tea-text-sec transition-colors"
                                    aria-label={isExpanded ? 'Collapse preview' : 'Expand preview'}
                                  >
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>
                                </div>
                              </div>

                              {/* Inline preview — expanded accordion */}
                              <AnimatePresence initial={false}>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="pt-1 pb-0.5 border-t border-tea-border space-y-1.5 text-ui-12">
                                      {meta.originRegion && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Origin</span>
                                          <span className="text-tea-text-sec">{meta.originRegion}</span>
                                        </div>
                                      )}
                                      {meta.season && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Season</span>
                                          <span className="text-tea-text-sec">{meta.season}</span>
                                        </div>
                                      )}
                                      {meta.form && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Form</span>
                                          <span className="text-tea-text-sec">{meta.form}</span>
                                        </div>
                                      )}
                                      {meta.teawareCategory && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Category</span>
                                          <span className="text-tea-text-sec">{meta.teawareCategory}</span>
                                        </div>
                                      )}
                                      {meta.material && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Material</span>
                                          <span className="text-tea-text-sec">{meta.material}</span>
                                        </div>
                                      )}
                                      {meta.capacityMl && (
                                        <div className="flex gap-2">
                                          <span className="text-tea-text-dim w-14 shrink-0">Capacity</span>
                                          <span className="text-tea-text-sec">{meta.capacityMl} ml</span>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              {/* Accept / Decline — always visible */}
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={isActing}
                                  onClick={() => acceptShareMutation.mutate(share.id)}
                                  className="flex-1 py-1.5 rounded-md bg-tea-gold/10 text-tea-gold text-ui-11 font-semibold uppercase tracking-[0.08em] hover:bg-tea-gold/15 disabled:opacity-50 transition-colors"
                                >
                                  {isActing ? '…' : 'Accept'}
                                </button>
                                <button
                                  type="button"
                                  disabled={isActing}
                                  onClick={() => declineShareMutation.mutate(share.id)}
                                  className="flex-1 py-1.5 rounded-md bg-tea-surface text-tea-text-dim text-ui-11 font-medium hover:text-tea-text-sec disabled:opacity-50 transition-colors border border-tea-border"
                                >
                                  Decline
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Co-tasting strip */}
                    {hasToken() && (
                      <div className="mb-4 rounded-lg bg-tea-surface/40 border border-tea-border px-3 py-2.5 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-ui-11 text-tea-text-sec font-medium">Co-Tasting</p>
                          <p className="text-ui-11 text-tea-text-dim mt-0.5">Taste with others and compare notes</p>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const result = await api.sessions.create({ title: 'Tasting Session' });
                              if (result?.session?.id) navigate(`/session/${result.session.id}`);
                            } catch { /* ignore */ }
                          }}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold/10 text-tea-gold text-ui-11 font-semibold hover:bg-tea-gold/15 transition-colors"
                        >
                          <Plus size={11} strokeWidth={2.5} />
                          Start
                        </button>
                      </div>
                    )}

                    <BrowseView
                      onEditEntry={handleEditEntry}
                      onNewCapture={handleNewCapture}
                      externalSearchQuery={tabSearchQuery}
                      onSelectEntry={(id) => setTastingSelectedEntryId(id)}
                      selectedEntryId={tastingSelectedEntryId}
                    />
                  </motion.div>
                )}

                {/* BUYING LEFT: LedgerView */}
                {mode === 'buying' && (
                  <motion.div
                    key="left-buying"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <LedgerView
                      embedded
                      onOpenEntry={(entryId) => {
                        setActiveEntry(entryId);
                        setMode('sourcing');
                      }}
                      searchQuery={tabSearchQuery}
                    />
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* Left column desktop FAB footer — Tasting + Buying only */}
            {mode !== 'sourcing' && (
              <div className="shrink-0 px-4 pb-4 pt-2 border-t border-tea-border">
                <button
                  type="button"
                  onClick={() => handleNewCapture()}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-tea-gold/40 text-tea-gold bg-tea-gold/5 hover:bg-tea-gold/10 text-ui-12 font-semibold tracking-[0.06em] transition-colors"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  <Plus size={13} strokeWidth={2} />
                  New Entry
                </button>
              </div>
            )}
          </div>
          {/* END LEFT COLUMN */}

          {/* ── RIGHT COLUMN (flex-1) ── */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

            {/* Right column scrollable content */}
            <div
              className={`flex-1 min-h-0 overscroll-contain ${
                mode === 'tasting' || mode === 'buying'
                  ? 'overflow-hidden'
                  : `overflow-y-auto ${mode === 'sourcing' && captureOption === 'samples' ? '' : 'px-4 pt-3'} pb-4`
              }`}
              style={{ WebkitOverflowScrolling: 'touch', scrollbarGutter: 'stable' }}
            >
              <AnimatePresence mode="wait">

                {/* SOURCING RIGHT: CaptureCard (samples cart lives in left column only) */}
                {mode === 'sourcing' && (
                  <motion.div
                    key="right-sourcing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {captureOption === 'samples' ? (
                      <div className="flex flex-col items-center justify-center h-full min-h-[300px] py-20 text-center">
                        <FlaskConical size={28} className="text-tea-gold/20 mb-4" />
                        <p className="font-serif text-ui-15 text-tea-text/50 mb-1.5 tracking-wide">Build your sample list</p>
                        <p className="text-ui-12 text-tea-text-dim max-w-[220px] leading-relaxed">
                          Use the flask icon on any tea card or the Sample button while capturing to add to your list.
                        </p>
                      </div>
                    ) : activeEntryId ? (
                      <>
                        {batchMode && <BatchCaptureRow />}
                        <CaptureCard
                          entryId={activeEntryId}
                          onSwitchToLedger={() => handleSwitchMode('buying')}
                          onCommit={handleCommitEntry}
                          onReturnToLibrary={fromLibrary ? () => { setFromLibrary(false); setMode('tasting'); } : undefined}
                          actionRef={captureCardActionsRef}
                        />
                      </>
                    ) : (
                      <CompassRightEmptyState mode="sourcing" onNewCapture={() => handleNewCapture()} />
                    )}
                  </motion.div>
                )}

                {/* TASTING RIGHT: entry detail panel or empty state */}
                {mode === 'tasting' && (
                  <motion.div
                    key="right-tasting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    {tastingSelectedEntryId ? (
                      <CompassEntryDetailPanel
                        entryId={tastingSelectedEntryId}
                        onEdit={(id) => { handleEditEntry(id); setTastingSelectedEntryId(null); }}
                        onClose={() => setTastingSelectedEntryId(null)}
                      />
                    ) : (
                      <CompassRightEmptyState mode="tasting" onNewCapture={() => handleNewCapture()} />
                    )}
                  </motion.div>
                )}

                {/* BUYING RIGHT: spending overview panel */}
                {mode === 'buying' && (
                  <motion.div
                    key="right-buying"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="h-full"
                  >
                    <LedgerOverviewPanel />
                  </motion.div>
                )}

              </AnimatePresence>
            </div>

            {/* Right column sticky action bar — Sourcing only, single compact row */}
            {mode === 'sourcing' && (
              <div className="shrink-0 border-t border-tea-border">
                <AnimatePresence>
                  {voiceError && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      className="text-ui-11 text-red-400 text-center px-4 py-1.5 border-b border-tea-border bg-tea-bg"
                    >
                      {voiceError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="flex items-stretch bg-tea-surface">
                  {/* Taste / Want / Buy */}
                  {showCaptureActionBar && (
                    <>
                      <button
                        type="button"
                        onClick={() => captureCardActionsRef.current?.openTasting()}
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium transition-colors ${
                          hasTasting ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'
                        }`}
                      >
                        <Droplets size={14} strokeWidth={1.5} />
                        {hasTasting ? 'Re-Taste' : 'Taste'}
                      </button>
                      <button
                        type="button"
                        onClick={() => activeEntryId && updateEntry(activeEntryId, { status: isWantEntry ? 'noted' : 'want' })}
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium transition-colors ${
                          isWantEntry ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'
                        }`}
                      >
                        {isWantEntry ? <BookmarkCheck size={14} /> : <BookmarkPlus size={14} />}
                        {isWantEntry ? 'Wanted' : 'Want'}
                      </button>
                      <button
                        type="button"
                        onClick={() => captureCardActionsRef.current?.toggleBuy()}
                        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium text-tea-text-dim hover:text-tea-text-sec transition-colors"
                      >
                        <ShoppingCart size={14} />
                        Buy
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!activeEntryId || !activeEntry) return;
                          if (captureEntryInCart) {
                            removeSampleCartItem(activeEntryId);
                          } else {
                            addSampleCartItem({
                              id: activeEntryId,
                              name: activeEntry.name,
                              chineseName: activeEntry.chineseName,
                              type: activeEntry.type,
                              vendorName: activeEntry.vendorName,
                              compassEntryId: activeEntryId,
                            });
                          }
                        }}
                        className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium transition-colors ${
                          captureEntryInCart ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'
                        }`}
                      >
                        <FlaskConical size={14} strokeWidth={1.5} />
                        {captureEntryInCart ? 'Listed' : 'Sample'}
                      </button>
                      <div className="w-px self-stretch my-1.5 bg-tea-border" />
                    </>
                  )}

                  {/* Mic */}
                  {isPlatformPrivileged && (
                    <motion.button
                      type="button"
                      onClick={handleVoicePress}
                      disabled={voiceState === 'transcribing'}
                      className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium transition-colors ${
                        voiceState === 'recording' ? 'text-tea-gold'
                        : voiceState === 'transcribing' ? 'text-tea-text-dim cursor-wait'
                        : 'text-tea-text-dim hover:text-tea-text-sec'
                      }`}
                      aria-label={voiceState === 'recording' ? 'Stop recording' : 'Record note'}
                    >
                      {voiceState === 'recording' && (
                        <motion.span
                          className="absolute inset-0"
                          animate={{ opacity: [0.06, 0.12, 0.06] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                          style={{ background: 'var(--tea-gold)' }}
                        />
                      )}
                      <span className="relative flex flex-col items-center gap-0.5">
                        {voiceState === 'recording' ? <Square size={14} fill="currentColor" />
                        : voiceState === 'transcribing' ? (
                          <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="block">
                            <Loader2 size={14} />
                          </motion.span>
                        ) : <Mic size={14} />}
                        Mic
                      </span>
                    </motion.button>
                  )}

                  {/* Batch */}
                  <button
                    type="button"
                    onClick={() => setBatchMode((v) => !v)}
                    className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium transition-colors ${
                      batchMode ? 'text-tea-gold' : 'text-tea-text-dim hover:text-tea-text-sec'
                    }`}
                    aria-label="Batch entry"
                  >
                    <Layers size={14} strokeWidth={1.5} />
                    Batch
                  </button>

                  {/* Share */}
                  {hasToken() && activeEntryId && (
                    <button
                      type="button"
                      onClick={() => setShareModalOpen(true)}
                      className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-ui-11 font-medium text-tea-text-dim hover:text-tea-text-sec transition-colors"
                      aria-label="Share"
                    >
                      <Share2 size={14} strokeWidth={1.5} />
                      Share
                    </button>
                  )}

                  <div className="w-px self-stretch my-1.5 bg-tea-border" />

                  {/* Done */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeEntryId) return;
                      commitEntry(activeEntryId);
                      handleCommitEntry();
                    }}
                    disabled={!activeEntryId || captureOption === 'samples'}
                    className="flex-[1.4] flex items-center justify-center py-2.5 text-tea-gold font-bold text-ui-13 disabled:opacity-30 transition-opacity"
                    style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}
                    aria-label="Done"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
            {/* END right action bar */}

          </div>
          {/* END RIGHT COLUMN */}

        </div>
        {/* END DESKTOP */}

      </div>
      {/* END BODY */}

      {/* Share modal — global, unchanged */}
      <AnimatePresence>
        {shareModalOpen && activeEntryId && (() => {
          const entry = getEntry(activeEntryId);
          return entry ? (
            <CompassShareModal
              entryId={activeEntryId}
              entryName={entry.name}
              synced={entry.synced}
              onClose={() => setShareModalOpen(false)}
            />
          ) : null;
        })()}
      </AnimatePresence>
    </div>
  );
};

export default TeaCompass;
