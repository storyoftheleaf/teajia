import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, PenLine, LayoutGrid, BookOpen } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useLedgerStore } from '../../lib/ledgerStore';
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

  // Ledger draft count for badge
  const transactions = useLedgerStore((s) => s.transactions);
  const draftItemCount = transactions
    .filter((tx) => tx.status === 'draft')
    .reduce((sum, tx) => sum + tx.items.length, 0);

  // Mode: capture (editing an entry), browse (list), or ledger (transactions)
  const [mode, setMode] = useState<CompassMode>(initialMode || (activeEntryId ? 'capture' : 'browse'));

  // When activeEntryId changes externally, switch to capture mode
  useEffect(() => {
    if (activeEntryId && mode !== 'capture') {
      setMode('capture');
    }
  }, [activeEntryId]);

  const sessionEntries = getSessionEntries();
  const activeEntry = activeEntryId ? getEntry(activeEntryId) : null;
  const activeCategory: CompassCategory = activeEntry?.category || 'tea';

  const handleNewCapture = useCallback((category?: CompassCategory) => {
    startNewCapture(category || activeCategory);
    setMode('capture');
  }, [startNewCapture, activeCategory]);

  const handleCategorySwitch = useCallback((category: CompassCategory) => {
    // Always start a fresh capture — only vendor carries over
    startNewCapture(category);
    setMode('capture');
  }, [startNewCapture]);

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

  const handleSwitchMode = useCallback((newMode: CompassMode) => {
    if (newMode !== 'capture') {
      setActiveEntry(null);
    }
    setMode(newMode);
  }, [setActiveEntry]);

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
    { id: 'ledger', label: 'Ledger', icon: BookOpen, badge: draftItemCount > 0 ? draftItemCount : undefined },
  ];

  return (
    <div className="flex flex-col h-full relative surface-warm">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="p-2 -ml-1 text-tea-text-sec hover:text-tea-text transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CompassIcon className="w-5 h-5 text-tea-gold shrink-0" filled={mode === 'capture'} />
          <h2 className="text-tea-text font-serif text-base truncate">Tea Compass</h2>
          <SyncIndicator />
        </div>
      </div>

      {/* ── Mode tabs ── */}
      <div className="flex border-b border-tea-border px-4" role="tablist">
        {tabs.map((tab) => {
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleSwitchMode(tab.id)}
              role="tab"
              aria-selected={active}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] font-bold transition-colors relative ${
                active
                  ? 'text-tea-gold'
                  : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              {tab.label}
              {tab.badge != null && (
                <span className="badge-status badge-status-gold ml-1">
                  {tab.badge}
                </span>
              )}
              {active && (
                <motion.div
                  layoutId="compass-tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-tea-gold rounded-full shadow-[0_0_6px_rgba(184,146,78,0.4)]"
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

              {/* Tea / Teaware tab toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => handleCategorySwitch('tea')}
                  className={`flex-1 text-center py-2 text-sm ${activeCategory === 'tea' ? 'pill-active' : 'pill'}`}
                >
                  Tea
                </button>
                <button
                  type="button"
                  onClick={() => handleCategorySwitch('teaware')}
                  className={`flex-1 text-center py-2 text-sm ${activeCategory === 'teaware' ? 'pill-active' : 'pill'}`}
                >
                  Teaware
                </button>
              </div>

              <CaptureCard entryId={activeEntryId} onSwitchToLedger={() => handleSwitchMode('ledger')} />
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

      {/* ── Floating + button (capture & browse modes) ── */}
      {mode !== 'ledger' && (
        <motion.button
          type="button"
          onClick={() => handleNewCapture()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="fixed right-5 z-30 w-12 h-12 rounded-full bg-tea-gold text-tea-bg
                     shadow-lg flex items-center justify-center
                     bottom-[calc(1rem+44px+env(safe-area-inset-bottom,0px))]
                     lg:bottom-5"
          aria-label="New capture"
        >
          <Plus size={22} strokeWidth={2.5} />
        </motion.button>
      )}
    </div>
  );
};

export default TeaCompass;
