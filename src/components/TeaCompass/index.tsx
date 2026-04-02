import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, PenLine, LayoutGrid, BookOpen } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { syncCompassEntries, hydrateCompassEntries } from '../../lib/teaCompassSync';
import { hasToken } from '../../lib/api';
import type { CompassCategory } from './types';
import { CompassIcon } from './CompassIcon';
import { SyncIndicator } from './SyncIndicator';
import { SessionStack } from './SessionStack';
import { CaptureCard } from './CaptureCard';
import { BrowseView } from './BrowseView';
import { LedgerView } from './LedgerView';
import { VoiceRecorder } from './VoiceRecorder';

export type CompassMode = 'capture' | 'browse' | 'ledger';

interface TeaCompassProps {
  onBack?: () => void;
  /** Start directly on the ledger tab */
  initialMode?: CompassMode;
}

// ─── Main Tea Compass ────────────────────────────────────────────────────

export const TeaCompass: React.FC<TeaCompassProps> = ({ onBack, initialMode }) => {
  const activeEntryId = useTeaCompassStore((s) => s.activeEntryId);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const getEntry = useTeaCompassStore((s) => s.getEntry);
  const getSessionEntries = useTeaCompassStore((s) => s.getSessionEntries);

  // Mode: capture (editing an entry), browse (list), or ledger (transactions)
  const [mode, setMode] = useState<CompassMode>(initialMode || 'capture');

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
  const activeCategory: CompassCategory = activeEntry?.category || 'tea';

  const handleNewCapture = useCallback((category?: CompassCategory) => {
    startNewCapture(category || activeCategory);
    setMode('capture');
  }, [startNewCapture, activeCategory]);

  const handleCategorySwitch = useCallback((category: CompassCategory) => {
    // If the current entry is still empty, just switch its category instead of creating a new one
    if (activeEntryId) {
      const current = getEntry(activeEntryId);
      if (current && !current.name && !current.notes && !current.type && current.photos.length === 0 && current.status === 'logged') {
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
      setMode('capture');
    },
    [setActiveEntry]
  );

  const handleCommitEntry = useCallback(() => {
    // After commit removes the entry from session, check if there are remaining session entries
    const remaining = getSessionEntries().filter(
      (e) => e.id !== activeEntryId &&
        (e.name || e.notes || e.type || e.photos.length > 0 || e.status !== 'logged')
    );
    if (remaining.length > 0) {
      // Switch to the most recent remaining session entry
      setActiveEntry(remaining[0].id);
    } else {
      // Start a fresh capture
      startNewCapture(
        activeEntryId ? getEntry(activeEntryId)?.category || 'tea' : 'tea'
      );
    }
  }, [getSessionEntries, activeEntryId, setActiveEntry, startNewCapture, getEntry]);

  const handleSwitchMode = useCallback((newMode: CompassMode) => {
    setMode(newMode);
  }, []);

  // ── Auto-sync & hydration ──
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!hasToken()) return;
    hydrateCompassEntries();
    syncCompassEntries();
    syncIntervalRef.current = setInterval(() => {
      const unsynced = useTeaCompassStore.getState().entries.filter(e => !e.synced);
      if (unsynced.length > 0) {
        syncCompassEntries();
      }
    }, 30_000);
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      if (hasToken()) syncCompassEntries();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      if (!activeEntryId) return;
      const latest = useTeaCompassStore.getState().entries.find(e => e.id === activeEntryId);
      if (!latest) return;
      const currentNotes = latest.notes || '';
      const delimiter = '\n\n';
      const updated = currentNotes.trim()
        ? currentNotes.trim() + delimiter + text
        : text;
      updateEntry(activeEntryId, { notes: updated });
    },
    [activeEntryId, updateEntry]
  );

  // Tab config
  const tabs: { id: CompassMode; label: string; icon: React.ComponentType<any>; badge?: number }[] = [
    { id: 'capture', label: 'Capture', icon: PenLine },
    { id: 'browse', label: 'Browse', icon: LayoutGrid },
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
      <div className="flex border-b border-tea-border/50 px-4" role="tablist">
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
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 pb-[calc(180px+env(safe-area-inset-bottom,0px))]" role="tabpanel" style={{ WebkitOverflowScrolling: 'touch' }}>
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

              {/* Tea / Teaware / Sample tab toggle */}
              <div className="flex gap-0 mb-3 rounded-md bg-tea-surface/30 p-0.5 relative">
                <motion.div
                  className="absolute top-0.5 bottom-0.5 rounded-[5px] bg-tea-surface shadow-sm"
                  animate={{
                    left: activeCategory === 'tea' ? '2px' : activeCategory === 'teaware' ? '33.33%' : '66.66%',
                    right: activeCategory === 'tea' ? '66.66%' : activeCategory === 'teaware' ? '33.33%' : '2px',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
                {(['tea', 'teaware', 'sample'] as CompassCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleCategorySwitch(cat)}
                    className={`flex-1 text-center py-1.5 text-[12px] font-medium rounded-[5px] transition-colors relative z-[1] ${
                      activeCategory === cat
                        ? 'text-tea-text'
                        : 'text-tea-text-dim hover:text-tea-text-sec'
                    }`}
                  >
                    {cat === 'tea' ? 'Tea' : cat === 'teaware' ? 'Teaware' : 'Sample'}
                  </button>
                ))}
              </div>

              <CaptureCard entryId={activeEntryId} onSwitchToLedger={() => handleSwitchMode('ledger')} onCommit={handleCommitEntry} />
            </motion.div>
          ) : mode === 'browse' ? (
            <motion.div
              key="browse"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
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
              <LedgerView embedded />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Voice recorder (capture mode only) ── */}
      {mode === 'capture' && (
        <VoiceRecorder onTranscript={handleVoiceTranscript} />
      )}

      {/* ── Floating + button (capture mode only — browse has its own inline button) ── */}
      {mode === 'capture' && (
        <motion.button
          type="button"
          onClick={() => handleNewCapture()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          className="fixed right-5 z-30 w-11 h-11 rounded-full bg-tea-gold text-tea-bg
                     shadow-[0_2px_12px_rgba(184,146,78,0.35)] flex items-center justify-center
                     bottom-[calc(1rem+44px+env(safe-area-inset-bottom,0px))]
                     lg:bottom-5"
          aria-label="New capture"
        >
          <Plus size={20} strokeWidth={2.5} />
        </motion.button>
      )}
    </div>
  );
};

export default TeaCompass;
