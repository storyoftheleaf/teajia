import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, LayoutGrid, PenLine } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { CompassCategory } from './types';
import { CompassIcon } from './CompassIcon';
import { SessionStack } from './SessionStack';
import { OrderBar } from './OrderBar';
import { OrderSummary } from './OrderSummary';
import { CaptureCard } from './CaptureCard';
import { BrowseView } from './BrowseView';
import { VoiceRecorder } from './VoiceRecorder';

interface TeaCompassProps {
  onBack?: () => void;
}

// ─── Main Tea Compass ────────────────────────────────────────────────────

export const TeaCompass: React.FC<TeaCompassProps> = ({ onBack }) => {
  const activeEntryId = useTeaCompassStore((s) => s.activeEntryId);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const getEntry = useTeaCompassStore((s) => s.getEntry);
  const getSessionEntries = useTeaCompassStore((s) => s.getSessionEntries);
  const getBuyingEntries = useTeaCompassStore((s) => s.getBuyingEntries);

  const [orderOpen, setOrderOpen] = useState(false);

  const sessionEntries = getSessionEntries();
  const buyingEntries = getBuyingEntries();
  const isCaptureMode = activeEntryId !== null;
  const activeEntry = activeEntryId ? getEntry(activeEntryId) : null;
  const activeCategory: CompassCategory = activeEntry?.category || 'tea';

  const handleNewCapture = useCallback((category?: CompassCategory) => {
    startNewCapture(category || activeCategory);
  }, [startNewCapture, activeCategory]);

  const handleCategorySwitch = useCallback((category: CompassCategory) => {
    if (activeEntryId && activeEntry) {
      // Update the current entry's category
      const updates: Record<string, unknown> = { category };
      if (category === 'teaware') {
        updates.type = undefined;
        updates.form = undefined;
        updates.season = undefined;
        updates.storage = undefined;
      } else {
        updates.teawareCategory = undefined;
        updates.material = undefined;
        updates.capacityMl = undefined;
        updates.era = undefined;
      }
      updateEntry(activeEntryId, updates);
    } else {
      startNewCapture(category);
    }
  }, [activeEntryId, activeEntry, updateEntry, startNewCapture]);

  const handleSelectEntry = useCallback(
    (id: string) => {
      setActiveEntry(id);
    },
    [setActiveEntry]
  );

  const handleEditEntry = useCallback(
    (id: string) => {
      setActiveEntry(id);
    },
    [setActiveEntry]
  );

  const handleBackToBrowse = useCallback(() => {
    setActiveEntry(null);
  }, [setActiveEntry]);

  const handleViewOrder = useCallback(() => {
    setOrderOpen(true);
  }, []);

  const handleCloseOrder = useCallback(() => {
    setOrderOpen(false);
  }, []);

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      if (!activeEntryId) return;
      // Read latest entry from store to avoid stale closure
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

  return (
    <div className="flex flex-col h-full relative">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-tea-border">
        <button
          type="button"
          onClick={isCaptureMode ? handleBackToBrowse : onBack}
          className="p-1 -ml-1 text-tea-text-sec hover:text-tea-text transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <CompassIcon className="w-5 h-5 text-tea-gold shrink-0" filled={isCaptureMode} />
          <h2 className="text-tea-text font-medium text-base truncate">Tea Compass</h2>
        </div>

        {/* Mode indicator */}
        <span className="flex items-center gap-1 text-tea-text-dim text-xs">
          {isCaptureMode ? (
            <>
              <PenLine size={12} />
              Capture
            </>
          ) : (
            <>
              <LayoutGrid size={12} />
              Browse
            </>
          )}
        </span>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto px-4 py-3 pb-20">
        <AnimatePresence mode="wait">
          {isCaptureMode ? (
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

              <CaptureCard entryId={activeEntryId} />
            </motion.div>
          ) : (
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
          )}
        </AnimatePresence>
      </div>

      {/* ── Order bar (capture mode, when buying items exist) ── */}
      {isCaptureMode && (
        <div className="px-4 pb-3 lg:pb-3 pb-[calc(0.75rem+49px+env(safe-area-inset-bottom,0px))] lg:pb-3">
          <OrderBar buyingCount={buyingEntries.length} onViewOrder={handleViewOrder} />
        </div>
      )}

      {/* ── Voice recorder (capture mode only) ── */}
      {isCaptureMode && (
        <VoiceRecorder onTranscript={handleVoiceTranscript} />
      )}

      {/* ── Floating + button ── */}
      <motion.button
        type="button"
        onClick={() => handleNewCapture()}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed right-5 z-30 w-12 h-12 rounded-full bg-tea-gold text-tea-bg
                   shadow-lg flex items-center justify-center
                   bottom-[calc(1rem+49px+env(safe-area-inset-bottom,0px))]
                   lg:bottom-5"
        aria-label="New capture"
      >
        <Plus size={22} strokeWidth={2.5} />
      </motion.button>

      {/* ── Order Summary overlay ── */}
      <OrderSummary open={orderOpen} onClose={handleCloseOrder} />
    </div>
  );
};

export default TeaCompass;
