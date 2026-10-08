import React, { useMemo } from 'react';
import { entryHasDeliberateInput, useTeaCompassStore } from '../../lib/teaCompassStore';
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
  onShare?: () => void;
}

export const CaptureContextChips: React.FC<CaptureContextChipsProps> = ({
  category,
  vendorName,
  vendorOpen,
  onToggleVendor,
  batchMode,
  onToggleBatchMode,
  onShare,
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
    ? 'No table'
    : sessionEntries.length > 1
      ? `Table · ${sessionEntries.length}`
      : 'Table';

  const handleDiscard = (id: string) => {
    // A capture with anything in it asks first; an empty draft just goes.
    const target = sessionEntries.find((e) => e.id === id);
    if (target && entryHasDeliberateInput(target) && !window.confirm(`Discard ${target.name?.trim() || 'this capture'}?`)) return;
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
    <div className="curate-v2">
      <button
        type="button"
        onClick={() => setRunSheetOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={runSheetOpen}
        className="curate-v2-line w-full text-left"
        data-curate-action
      >
        <span className="curate-v2-label">Table</span>
        <span className={`flex-1 truncate text-right font-mono text-ui-13 ${runActive ? 'text-tea-text' : 'text-tea-gold'}`}>{runLabel}</span>
      </button>

      <button
        type="button"
        onClick={onToggleVendor}
        aria-expanded={vendorOpen}
        className="curate-v2-line w-full text-left"
        data-curate-action
      >
        <span className="curate-v2-label">Vendor</span>
        <span className={`flex-1 truncate text-right ${vendorName ? 'font-display text-ui-17 text-tea-text' : 'font-mono text-ui-13 text-tea-gold'}`}>{vendorName || 'choose'}</span>
      </button>

      <div className="curate-v2-line min-h-12 justify-end gap-5">
          <span className="curate-v2-label mr-auto">Entry</span>
          <SyncIndicator />
          {onShare && (
            <button type="button" onClick={onShare} aria-label="Share" className="curate-v2-word tap-target" data-curate-action>
              Share
            </button>
          )}
          <span className="md:hidden">
            <button
              type="button"
              onClick={() => startNewCapture(category)}
              aria-label="Start a new entry"
              className="curate-v2-word tap-target"
              data-curate-action
            >
              New tea
            </button>
          </span>
        </div>

      {/* Run sheet: this sitting's drafts plus the session controls that
          used to live in the strip above the card. */}
      <BottomSheet
        open={runSheetOpen}
        onOpenChange={setRunSheetOpen}
        title="This table"
        description="Captures from this sitting stay grouped together"
      >
        <div className="curate-v2 flex flex-col pb-1">
          {sessionEntries.map((entry) => {
            const isActive = entry.id === activeEntryId;
            return (
              <div key={entry.id} className="flex items-center border-b border-tea-border pr-2">
                <button
                  type="button"
                  onClick={() => { setActiveEntry(entry.id); setRunSheetOpen(false); }}
                  aria-pressed={isActive}
                  className="curate-v2-sheetrow min-w-0 flex-1 border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate">{entry.name || 'Untitled'}</span>
                  {isActive && <span className="font-mono text-ui-11 uppercase tracking-[0.16em] text-tea-gold">open</span>}
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscard(entry.id)}
                  aria-label={`Discard ${entry.name || 'untitled entry'}`}
                  className="curate-v2-word tap-target shrink-0 px-2 text-tea-text-sec"
                >
                  discard
                </button>
              </div>
            );
          })}

          <button type="button" onClick={() => { startNewCapture(category); setRunSheetOpen(false); }} className="curate-v2-sheetrow">
            <span>New entry</span>
          </button>

          {onToggleBatchMode && (
            <button
              type="button"
              onClick={() => { onToggleBatchMode(); setRunSheetOpen(false); }}
              aria-pressed={batchMode}
              className="curate-v2-sheetrow"
            >
              <span className="flex-1">Rapid entry</span>
              {batchMode && <span className="font-mono text-ui-11 uppercase tracking-[0.16em] text-tea-gold">on</span>}
            </button>
          )}

          <button type="button" onClick={handleStartNewRun} className="curate-v2-sheetrow">
            <span>Start a new table</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};

export default CaptureContextChips;
