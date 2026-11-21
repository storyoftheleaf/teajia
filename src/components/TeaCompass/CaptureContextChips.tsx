import React, { useMemo } from 'react';
import { Check, ChevronDown, Plus, RotateCcw, Share2, X, Zap } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import type { CompassCategory } from './types';
import { BottomSheet } from '../shared/BottomSheet';
import { SyncIndicator } from './SyncIndicator';
import { Button } from '../shared/Button';

/** Source header: vendor, one context action, new entry and save.
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
  entryId?: string;
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
  entryId,
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
        aria-label="Source context"
        title="Captures and optional sourcing context"
        className={`curate-support pill-quiet shrink-0 ${runSheetOpen ? 'pill-quiet-on' : ''}`}
        data-curate-action
      >
        <span>Context</span>
        <ChevronDown size={12} className="shrink-0 text-tea-text-dim" />
      </button>
  );

  // The vendor chip, or (supplier header) the vendor as the heading: one control.
  const vendorButton = (asHeading: boolean) => (
      <button
        type="button"
        onClick={onToggleVendor}
        aria-expanded={vendorOpen}
        title={asHeading ? vendorName : undefined}
        className={asHeading ? 'library-supplier-heading w-full' : `curate-support pill-quiet min-w-0 ${vendorOpen ? 'pill-quiet-on' : ''}`}
        data-curate-action
      >
        {asHeading ? (
          <span className="flex min-w-0 items-center gap-1.5">
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
      <span className="capture-context-new ml-auto shrink-0 md:hidden">
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
        <SyncIndicator entryId={entryId} />
      </div>
  );

  const runSheet = (
    <>
      {/* Run sheet: this sitting's drafts plus the session controls that
          used to live in the strip above the card. */}
      <BottomSheet
        open={runSheetOpen}
        onOpenChange={setRunSheetOpen}
        title="Source context"
        description="Drafts, trips and supplier visits"
        large
      >
        <section aria-label="Capture session" className="space-y-2 px-1 pb-3">
          <h3 className="px-3 text-ui-14 font-medium text-tea-text">Captures from this sitting</h3>
          <p className="px-3 text-ui-12 text-tea-text-sec">Switch drafts or start a fresh group.</p>
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
                  className="btn-quiet min-w-0 flex-1 justify-start text-left"
                >
                  {isActive && <Check size={13} strokeWidth={3} className="shrink-0 text-tea-gold" />}
                  <span className="truncate">{entry.name || 'Untitled'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDiscard(entry.id)}
                  aria-label={`Discard ${entry.name || 'untitled entry'}`}
                  className="btn-icon btn-sm tap-target shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center gap-2 px-3">
          <Button variant="secondary" size="sm"
            type="button"
            onClick={() => { startNewCapture(category); setRunSheetOpen(false); }}
            icon={<Plus size={14} aria-hidden />}
          >New entry</Button>

          {onToggleBatchMode && (
            <Button variant="secondary" size="sm"
              type="button"
              onClick={() => { onToggleBatchMode(); setRunSheetOpen(false); }}
              aria-pressed={batchMode}
              icon={<Zap size={14} aria-hidden />}
            >
              {batchMode ? 'Rapid entry on' : 'Rapid entry'}
            </Button>
          )}

          <Button type="button" variant="quiet" size="sm" onClick={handleStartNewRun} icon={<RotateCcw size={14} aria-hidden />}>New session</Button>
          </div>
        </section>
        {variant === 'supplier' && React.isValidElement<{ inline?: boolean; onClose?: () => void }>(secondLine)
          ? React.cloneElement(secondLine, { inline: true, onClose: () => setRunSheetOpen(false) })
          : null}
      </BottomSheet>
    </>
  );

  if (variant === 'supplier') {
    // Keep one clear row; long supplier names truncate before the controls.
    return (
      <div className="library-supplier-header curate-flow-where capture-context-toolbar" data-testid="curate-supplier-header">
        {vendorButton(true)}
        {runChip}
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
