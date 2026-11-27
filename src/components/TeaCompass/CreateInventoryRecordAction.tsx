import { Check, Loader2, PackagePlus, RefreshCw } from 'lucide-react';
import { useCommitAndPromote } from './useCommitAndPromote';
import { useTeaCompassStore } from '../../lib/teaCompassStore';

interface Props { entryId: string; productId?: string; compact?: boolean; onOpenInventory: (productId: string) => void }

/** Deliberate boundary between a Curate encounter and a physical Stock record.
 * Worded "Stock" because that is what the menu calls it (Adrian, 2026-11-27). */
export function CreateInventoryRecordAction({ entryId, productId, compact, onOpenInventory }: Props) {
  const { createInventoryRecord, busy, lastResult } = useCommitAndPromote();
  // Subscribe to the durable entry link as well as the immediate hook result.
  // Responsive Library layouts can remount the card/detail action; the store
  // link ensures that remount still renders the completed Inventory state.
  const storedProductId = useTeaCompassStore((state) =>
    state.pendingEntries.find((entry) => entry.id === entryId)?.draftProductId
      ?? state.entries.find((entry) => entry.id === entryId)?.draftProductId,
  );
  const linkedProductId = productId ?? storedProductId ?? lastResult?.productId;
  if (linkedProductId) return (
    <button type="button" aria-label="View in Stock" onClick={() => onOpenInventory(linkedProductId)} className="pill flex items-center gap-1 text-ui-12">
      <Check size={12} /> {compact ? 'Stock' : 'View in Stock →'}
    </button>
  );
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button type="button" aria-label="Add to Stock" onClick={() => void createInventoryRecord(entryId)} disabled={busy} className="pill flex items-center gap-1 text-ui-12 disabled:opacity-50">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <PackagePlus size={12} />} Add to Stock
      </button>
      {lastResult?.promotionError && <span className="inline-flex items-center gap-1 text-ui-12 text-tea-text-sec" role="status"><RefreshCw size={12} /> {lastResult.retryQueued ? 'Queued until the connection returns' : `Could not add to Stock: ${lastResult.promotionError}`}</span>}
    </div>
  );
}
