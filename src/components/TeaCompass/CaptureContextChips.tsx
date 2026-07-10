import React, { useMemo } from 'react';
import { Check, ChevronDown, Plus, RotateCcw, X, Zap } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { CompassCategory } from './types';
import { BottomSheet } from '../shared/BottomSheet';
import { SyncIndicator } from './SyncIndicator';

/** Context chips row at the top of the capture card: Run + Vendor.
 *
 *  The Run chip binds to the EXISTING capture-session mechanism in the
 *  compass store (currentSessionId + sessionEntryIds). It replaces the old
 *  "+ / Batch / Untitled" strip: the bottom sheet it opens carries the
 *  session drafts, new-entry, rapid batch toggle, and start-new-run actions.
 *
 *  The Vendor chip is just the trigger; the existing VendorStrip stays the
 *  picker and expands below the row when the chip is tapped (1b replaces
 *  its internals with a real bottom sheet).
 */
interface CaptureContextChipsProps {
  category: CompassCategory;
  vendorName?: string;
  vendorOpen: boolean;
  onToggleVendor: () => void;
  batchMode?: boolean;
  onToggleBatchMode?: () => void;
}

const chipBase =
  'tap-target inline-flex min-w-0 items-center gap-1.5 rounded-full bg-tea-accent-sub px-3 py-1.5 text-ui-12 transition-colors hover:text-tea-text';

export const CaptureContextChips: React.FC<CaptureContextChipsProps> = ({
  category,
  vendorName,
  vendorOpen,
  onToggleVendor,
  batchMode,
  onToggleBatchMode,
}) => {
  const [runSheetOpen, setRunSheetOpen] = React.useState(false);

  const sessionEntryIds = useTeaCompassStore((s) => s.sessionEntryIds);
  const pendingEntries = useTeaCompassStore((s) => s.pendingEntries);
  const entries = useTeaCompassStore((s) => s.entries);
  const activeEntryId = useTeaCompassStore((s) => s.activeEntryId);
  const currentSessionId = useTeaCompassStore((s) => s.currentSessionId);
  const setActiveEntry = useTeaCompassStore((s) => s.setActiveEntry);
  const startNewCapture = useTeaCompassStore((s) => s.startNewCapture);
  const startNewRun = useTeaCompassStore((s) => s.startNewRun);
  const discardEntry = useTeaCompassStore((s) => s.discardEntry);

  const sessionEntries = useMemo(
    () =>
      sessionEntryIds
        .map((id) => pendingEntries.find((e) => e.id === id) ?? entries.find((e) => e.id === id))
        .filter((e): e is NonNullable<typeof e> => e !== undefined),
    [sessionEntryIds, pendingEntries, entries]
  );

  const runActive = currentSessionId != null;
  const runLabel = !runActive
    ? 'No run'
    : sessionEntries.length > 1
      ? `Run · ${sessionEntries.length}`
      : 'Run';

  const handleDiscard = (id: string) => {
    if (id === activeEntryId) {
      const remaining = sessionEntries.filter((e) => e.id !== id);
      discardEntry(id);
      if (remaining.length > 0) setActiveEntry(remaining[0].id);
      else startNewCapture(category);
    } else {
      discardEntry(id);
    }
  };

  const handleStartNewRun = () => {
    startNewRun();
    startNewCapture(category);
    setRunSheetOpen(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setRunSheetOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={runSheetOpen}
        className={`${chipBase} shrink-0 ${runActive ? 'text-tea-text' : 'text-tea-text-sec'}`}
      >
        <span className="truncate">{runLabel}</span>
        <ChevronDown size={12} className="shrink-0 text-tea-text-sec" />
      </button>

      <button
        type="button"
        onClick={onToggleVendor}
        aria-expanded={vendorOpen}
        className={`${chipBase} ${vendorName ? 'text-tea-text' : 'text-tea-text-sec'}`}
      >
        <span className="truncate">{vendorName || 'Vendor'}</span>
        <ChevronDown
          size={12}
          className={`shrink-0 text-tea-text-sec transition-transform ${vendorOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div className="ml-auto shrink-0 pl-1">
        <SyncIndicator />
      </div>

      {/* Run sheet: this sitting's drafts plus the session controls that
          used to live in the strip above the card. */}
      <BottomSheet
        open={runSheetOpen}
        onOpenChange={setRunSheetOpen}
        title="This run"
        description="Captures from this sitting stay grouped together"
      >
        <div className="flex flex-col gap-0.5 px-1 pb-1">
          {sessionEntries.map((entry) => {
            const isActive = entry.id === activeEntryId;
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-2 rounded-xl px-3 py-1 ${
                  isActive ? 'bg-tea-accent-sub' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => { setActiveEntry(entry.id); setRunSheetOpen(false); }}
                  className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left text-base text-tea-text"
                >
                  {isActive && <Check size={13} strokeWidth={3} className="shrink-0 text-tea-gold" />}
                  <span className="truncate">{entry.name || 'Untitled'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscard(entry.id)}
                  aria-label={`Discard ${entry.name || 'untitled entry'}`}
                  className="tap-target shrink-0 p-1.5 text-tea-text-dim transition-colors hover:text-tea-text-sec"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}

          <div className="my-1.5 border-t border-tea-border" />

          <button
            type="button"
            onClick={() => { startNewCapture(category); setRunSheetOpen(false); }}
            className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-left text-base font-medium text-tea-text transition-colors hover:bg-tea-accent-sub"
          >
            <Plus size={16} className="shrink-0 text-tea-text-sec" />
            New entry
          </button>

          {onToggleBatchMode && (
            <button
              type="button"
              onClick={() => { onToggleBatchMode(); setRunSheetOpen(false); }}
              aria-pressed={batchMode}
              className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-left text-base font-medium text-tea-text transition-colors hover:bg-tea-accent-sub"
            >
              <Zap size={16} className={`shrink-0 ${batchMode ? 'text-tea-gold' : 'text-tea-text-sec'}`} />
              <span className="flex-1">Rapid entry</span>
              {batchMode && <Check size={14} className="shrink-0 text-tea-gold" />}
            </button>
          )}

          <button
            type="button"
            onClick={handleStartNewRun}
            className="flex items-center gap-2.5 rounded-xl px-3 py-3 text-left text-base font-medium text-tea-text transition-colors hover:bg-tea-accent-sub"
          >
            <RotateCcw size={15} className="shrink-0 text-tea-text-sec" />
            Start a new run
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};

export default CaptureContextChips;
