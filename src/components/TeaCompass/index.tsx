import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, PenLine, Library, BookOpen, Check, Mic, Square, Loader2, Share2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';
import { hydrateNotes, syncNotes } from '../../lib/notesSync';
import { useNotesStore } from '../../lib/notesStore';
import { useAppStore } from '../../lib/store';
import { api, hasToken } from '../../lib/api';
import type { CompassCategory } from './types';
import { CompassIcon } from './CompassIcon';
import { SyncIndicator } from './SyncIndicator';
import { SessionStack } from './SessionStack';
import { CaptureCard } from './CaptureCard';
import { BrowseView } from './BrowseView';
import { LedgerView } from './LedgerView';
import { useVoiceRecorder } from './useVoiceRecorder';
import { usePlatformPrivilege } from '../../lib/permissions';
import { CompassShareModal } from './CompassShareModal';

export type CompassMode = 'capture' | 'browse' | 'ledger';

interface TeaCompassProps {
  onBack?: () => void;
  /** Start directly on the ledger tab */
  initialMode?: CompassMode;
  /** Open a specific entry by ID */
  initialEntryId?: string;
}

// ─── Main Tea Compass ────────────────────────────────────────────────────

export const TeaCompass: React.FC<TeaCompassProps> = ({ onBack, initialMode, initialEntryId }) => {
  const activeEntryId = useTeaCompassStore((s) => s.activeEntryId);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const commitEntry = useTeaCompassStore((s) => s.commitEntry);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const getEntry = useTeaCompassStore((s) => s.getEntry);
  const getSessionEntries = useTeaCompassStore((s) => s.getSessionEntries);
  const activeCategory: CompassCategory = useTeaCompassStore((s) => {
    const id = s.activeEntryId;
    if (!id) return 'tea';
    const entry = s.pendingEntries.find((e) => e.id === id) ?? s.entries.find((e) => e.id === id);
    return entry?.category || 'tea';
  });

  const { activeAccountId, activeAccount } = useAppStore();
  const { addNote } = useNotesStore();

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Mode: capture (editing an entry), browse (list), or ledger (transactions)
  const [mode, setMode] = useState<CompassMode>(initialMode || 'capture');

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
    setMode(initialMode || 'capture');
  }, [initialMode]);

  // Track whether the user navigated to Capture from the Library (to show back link)
  const [fromLibrary, setFromLibrary] = useState(false);

  // Track just-committed entry for banner
  const [justCommitted, setJustCommitted] = useState<{ name: string; draftProductId?: string } | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Open specific entry if initialEntryId is provided
  useEffect(() => {
    if (initialEntryId && getEntry(initialEntryId)) {
      setActiveEntry(initialEntryId);
      setMode('capture');
    }
  }, [initialEntryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When activeEntryId changes externally, switch to capture mode
  useEffect(() => {
    if (activeEntryId && mode !== 'capture') {
      setMode('capture');
    }
  }, [activeEntryId]);

  // Auto-start a capture when opening in capture mode with no active entry
  useEffect(() => {
    if (mode === 'capture' && !activeEntryId) {
      startNewCapture(activeCategory);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sessionEntries = getSessionEntries();
  const activeEntry = activeEntryId ? getEntry(activeEntryId) : null;

  const handleNewCapture = useCallback((category?: CompassCategory) => {
    startNewCapture(category || activeCategory);
    setFromLibrary(false);
    setMode('capture');
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
    setMode('capture');
  }, [startNewCapture, activeEntryId, getEntry, updateEntry]);

  const handleSelectEntry = useCallback(
    (id: string) => {
      setActiveEntry(id);
      setMode('capture');
    },
    [setActiveEntry]
  );

  const handleEditEntry = useCallback(
    (id: string) => {
      setActiveEntry(id);
      setFromLibrary(true);
      setMode('capture');
    },
    [setActiveEntry]
  );

  const handleCommitEntry = useCallback(() => {
    // Capture committed entry info before it's removed from session
    const committed = activeEntryId ? getEntry(activeEntryId) : null;
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
  }, [getSessionEntries, activeEntryId, setActiveEntry, startNewCapture, getEntry]);

  const handleSwitchMode = useCallback((newMode: CompassMode) => {
    if (newMode === 'capture' && !activeEntryId) {
      startNewCapture(activeCategory);
    }
    setMode(newMode);
  }, [activeEntryId, startNewCapture, activeCategory]);

  // ── Notes hydration ──
  // Compass hydration / debounced push / online-retry all live in
  // `useCompassSync` (mounted at the app root in `App.tsx`), mirroring
  // `useFavoritesSync` / `useTastingJournalSync` / `useOfflineSync`. That
  // hook runs while authenticated regardless of whether this view is
  // mounted, so compass data stays fresh across navigation. Notes still
  // hydrate/push from here until a parallel `useNotesSync` hook exists.
  useEffect(() => {
    if (!hasToken()) return;
    hydrateNotes();
    syncNotes();
  }, []);

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

  // Tab config
  const tabs: { id: CompassMode; label: string; icon: React.ComponentType<any>; badge?: number }[] = [
    { id: 'capture', label: 'Capture', icon: PenLine },
    { id: 'browse', label: 'Encounters', icon: Library, badge: pendingIncomingCount > 0 ? pendingIncomingCount : undefined },
    { id: 'ledger', label: 'Ledger', icon: BookOpen },
  ];

  return (
    <div className="flex flex-col h-full relative surface-warm">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-1 text-tea-text-dim hover:text-tea-text transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} strokeWidth={1.5} />
        </button>

        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <CompassIcon className="w-5 h-5 text-tea-gold shrink-0" filled={mode === 'capture'} />
          <h2 className="text-tea-text font-serif text-[15px] tracking-wide truncate">Tea Compass</h2>
        </div>
        <SyncIndicator />
      </div>

      {/* ── Mode tabs ── */}
      <div className="flex border-b border-tea-border px-4" role="tablist">
        {tabs.map((tab) => {
          const active = mode === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSwitchMode(tab.id)}
              role="tab"
              aria-selected={active}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] uppercase tracking-[0.1em] font-semibold transition-colors relative ${
                active
                  ? 'text-tea-gold'
                  : 'text-tea-text-dim hover:text-tea-text-sec'
              }`}
            >
              <Icon size={13} strokeWidth={active ? 2 : 1.5} />
              {tab.label}
              {tab.badge != null && (
                <span className="badge-status badge-status-gold ml-1">
                  {tab.badge}
                </span>
              )}
              {active && (
                <motion.div
                  layoutId="compass-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-[2px] bg-tea-gold rounded-full shadow-[0_0_8px_rgba(184,146,78,0.3)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 pb-[calc(60px+44px+env(safe-area-inset-bottom,0px))] lg:pb-[60px]"
        role="tabpanel"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarGutter: 'stable' }}
      >
        <AnimatePresence mode="wait">
          {mode === 'capture' ? (
            <motion.div
              key="capture"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <SessionStack
                sessionEntries={sessionEntries}
                activeEntryId={activeEntryId}
                onSelectEntry={handleSelectEntry}
              />

              {/* Tea / Teaware tab toggle */}
              <div className="flex gap-0 mb-3 rounded-md bg-tea-surface/30 p-0.5 relative">
                <motion.div
                  className="absolute top-0.5 bottom-0.5 rounded-[5px] bg-tea-surface shadow-sm"
                  animate={{ left: activeCategory === 'tea' ? '2px' : '50%', right: activeCategory === 'teaware' ? '2px' : '50%' }}
                  transition={{ duration: 0.1, ease: 'easeOut' }}
                />
                <button
                  type="button"
                  onClick={() => handleCategorySwitch('tea')}
                  className={`flex-1 text-center py-1.5 text-[12px] font-medium rounded-[5px] transition-colors relative z-[1] ${
                    activeCategory === 'tea'
                      ? 'text-tea-text'
                      : 'text-tea-text-dim hover:text-tea-text-sec'
                  }`}
                >
                  Tea
                </button>
                <button
                  type="button"
                  onClick={() => handleCategorySwitch('teaware')}
                  className={`flex-1 text-center py-1.5 text-[12px] font-medium rounded-[5px] transition-colors relative z-[1] ${
                    activeCategory === 'teaware'
                      ? 'text-tea-text'
                      : 'text-tea-text-dim hover:text-tea-text-sec'
                  }`}
                >
                  Teaware
                </button>
              </div>

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
                        onClick={() => { setJustCommitted(null); setMode('browse'); }}
                        className="flex items-center gap-1 text-tea-text-sec hover:text-tea-text transition-colors shrink-0"
                      >
                        Encounters
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <CaptureCard
                entryId={activeEntryId}
                onSwitchToLedger={() => handleSwitchMode('ledger')}
                onCommit={handleCommitEntry}
                onReturnToLibrary={fromLibrary ? () => { setFromLibrary(false); setMode('browse'); } : undefined}
              />
            </motion.div>
          ) : mode === 'browse' ? (
            <motion.div
              key="browse"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Pending incoming shares — require explicit accept/decline */}
              {visibleShares.length > 0 && (
                <div className="mb-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim font-medium px-0.5">
                    Incoming — {visibleShares.length}
                  </p>
                  {visibleShares.map((share) => {
                    const meta = share.shared_metadata || {};
                    const from = share.source_user_name || share.source_account_name || 'A taster';
                    const isActing = actingShareId === share.id;
                    return (
                      <div
                        key={share.id}
                        className="rounded-lg bg-tea-surface border border-tea-border px-3 py-2.5 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[11px] text-tea-text-sec mb-0.5">From {from}</p>
                            <p className="text-sm font-medium text-tea-text truncate">
                              {meta.name || 'Unnamed card'}
                            </p>
                            {(meta.type || meta.year) && (
                              <p className="text-[11px] text-tea-text-dim">
                                {[meta.type, meta.year].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </div>
                          {meta.photo && (
                            <img
                              src={meta.photo}
                              alt={meta.name}
                              className="w-12 h-12 rounded-md object-cover shrink-0 border border-tea-border"
                            />
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={isActing}
                            onClick={() => acceptShareMutation.mutate(share.id)}
                            className="flex-1 py-1.5 rounded-md bg-tea-gold/10 text-tea-gold text-[11px] font-semibold uppercase tracking-[0.08em] hover:bg-tea-gold/15 disabled:opacity-50 transition-colors"
                          >
                            {isActing ? '…' : 'Accept'}
                          </button>
                          <button
                            type="button"
                            disabled={isActing}
                            onClick={() => declineShareMutation.mutate(share.id)}
                            className="flex-1 py-1.5 rounded-md bg-tea-surface text-tea-text-dim text-[11px] font-medium hover:text-tea-text-sec disabled:opacity-50 transition-colors border border-tea-border"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <BrowseView
                onEditEntry={handleEditEntry}
                onNewCapture={handleNewCapture}
              />
            </motion.div>
          ) : (
            <motion.div
              key="ledger"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <LedgerView
                embedded
                onOpenEntry={(entryId) => {
                  setActiveEntry(entryId);
                  setMode('capture');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Capture action bar ── */}
      {mode === 'capture' && (
        <>
          <AnimatePresence>
            {voiceError && (
              <motion.p
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="shrink-0 text-[11px] text-red-400 text-center px-4 py-1.5 border-t border-tea-border bg-tea-bg"
              >
                {voiceError}
              </motion.p>
            )}
          </AnimatePresence>

          <div
            className="shrink-0 border-t border-tea-border bg-tea-bg flex"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Record */}
            {isPlatformPrivileged && (
              <>
                <motion.button
                  type="button"
                  onClick={handleVoicePress}
                  disabled={voiceState === 'transcribing'}
                  className={`relative flex-1 flex items-center justify-center py-3 transition-colors ${
                    voiceState === 'recording'
                      ? 'text-tea-gold'
                      : voiceState === 'transcribing'
                        ? 'text-tea-text-dim cursor-wait'
                        : 'text-tea-text/40 hover:text-tea-text/70'
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
                  <span className="relative">
                    {voiceState === 'recording' ? (
                      <Square size={14} fill="currentColor" />
                    ) : voiceState === 'transcribing' ? (
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="block">
                        <Loader2 size={14} />
                      </motion.span>
                    ) : (
                      <Mic size={14} />
                    )}
                  </span>
                </motion.button>
                <div className="w-px self-stretch my-2 bg-tea-border" />
              </>
            )}

            {/* Share */}
            {hasToken() && activeEntryId && (
              <>
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="flex-1 flex items-center justify-center py-3 text-tea-text/40 hover:text-tea-text/70 transition-colors"
                  aria-label="Share"
                >
                  <Share2 size={14} strokeWidth={1.5} />
                </button>
                <div className="w-px self-stretch my-2 bg-tea-border" />
              </>
            )}

            {/* Done */}
            <button
              type="button"
              onClick={() => {
                if (!activeEntryId) return;
                commitEntry(activeEntryId);
                handleCommitEntry();
              }}
              disabled={!activeEntryId}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 text-tea-gold font-semibold text-sm disabled:opacity-30 transition-opacity"
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}
              aria-label="Done"
            >
              Done
            </button>
          </div>

          {/* Share modal */}
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
        </>
      )}
    </div>
  );
};

export default TeaCompass;
