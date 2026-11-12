import React, { useMemo } from 'react';
import { Check, ChevronDown, Plus, RotateCcw, Share2, X, Zap } from 'lucide-react';
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
  onShare?: () => void;
  /** 'row' (default): one line of chips. 'supplier' (the 'flow' form): one
   *  line, the vendor as the heading holding Run and `secondLine` beside it,
   *  the plus at the end. Share is not drawn there: the form puts
   *  CaptureShareButton elsewhere. */
  variant?: 'row' | 'supplier';
  secondLine?: React.ReactNode;
}

export const CaptureContextChips: React.FC<CaptureContextChipsProps> = ({
  category,
  vendorName,
  vendorOpen,
  onToggleVendor,
  batchMode,
  onToggleBatchMode,
  onShare,
  variant = 'row',
  secondLine,
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

  const runChip = (
      <button
        type="button"
        onClick={() => setRunSheetOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={runSheetOpen}
        className={`curate-support pill-quiet shrink-0 ${runSheetOpen ? 'pill-quiet-on' : ''}`}
        data-curate-action
      >
        <span className="truncate">{runLabel}</span>
        <ChevronDown size={12} className="shrink-0 text-tea-text-dim" />
      </button>
  );

  // The vendor chip, or (supplier header) the vendor as the heading: one control.
  const vendorButton = (asHeading: boolean) => (
      <button
        type="button"
        onClick={onToggleVendor}
        aria-expanded={vendorOpen}
        className={asHeading ? 'library-supplier-heading w-full' : `curate-support pill-quiet min-w-0 ${vendorOpen ? 'pill-quiet-on' : ''}`}
        data-curate-action
      >
        {asHeading ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className={`library-supplier-name !flex-initial truncate ${vendorName ? '' : 'text-tea-text-sec'}`}>{vendorName || 'Vendor'}</span>
            <ChevronDown
              size={14}
              className={`shrink-0 text-tea-text-dim transition-transform ${vendorOpen ? 'rotate-180' : ''}`}
            />
          </span>
        ) : (
          <>
            <span className="truncate">{vendorName || 'Vendor'}</span>
            <ChevronDown
              size={12}
              className={`shrink-0 text-tea-text-dim transition-transform ${vendorOpen ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>
  );

  const shareButton = <CaptureShareButton onShare={onShare} />;

  const newEntryButton = (
      <span className="ml-auto shrink-0 md:hidden">
        <button
          type="button"
          onClick={() => startNewCapture(category)}
          aria-label="Start a new entry"
          className="curate-support pill-quiet"
          data-curate-action
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </span>
  );

  const syncIndicator = (
      <div className="shrink-0 pl-1 md:ml-auto">
        <SyncIndicator />
      </div>
  );

  const runSheet = (
    <>
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
    </>
  );

  if (variant === 'supplier') {
    // The same controls, laid out like a Library supplier header: the vendor
    // is the heading, Run and the second line sit quieter beneath it.
    return (
      <div className="library-supplier-header curate-flow-where" data-testid="curate-supplier-header">
        {vendorButton(true)}
        <span className="curate-flow-where-dot" aria-hidden>·</span>
        {runChip}
        <span className="curate-flow-where-dot" aria-hidden>·</span>
        <div className="curate-flow-where-visit">{secondLine}</div>
        {newEntryButton}
        {syncIndicator}
        {runSheet}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {runChip}

      <span className="shrink-0 text-tea-text-dim" aria-hidden>·</span>

      {vendorButton(false)}

      {shareButton}

      {newEntryButton}

      {syncIndicator}

      {runSheet}
    </div>
  );
};

export default CaptureContextChips;

/** Share, one control: in the chip row ('classic'), or wherever the 'flow' form places it. */
export const CaptureShareButton: React.FC<{ onShare?: () => void }> = ({ onShare }) => (
    <>
      {onShare && (
        <button
          type="button"
          onClick={onShare}
          aria-label="Share"
          className="curate-support pill-quiet shrink-0"
          data-curate-action
        >
          <Share2 size={13} aria-hidden="true" />
        </button>
      )}
    </>
);
