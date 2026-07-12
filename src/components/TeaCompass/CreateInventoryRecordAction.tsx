import { Check, Loader2, PackagePlus, RefreshCw } from 'lucide-react';
import { useCommitAndPromote } from './useCommitAndPromote';
import { useTeaCompassStore } from '../../lib/teaCompassStore';

interface Props { entryId: string; productId?: string; onOpenInventory: (productId: string) => void }

/** Deliberate boundary between a Curate encounter and a physical Inventory record. */
export function CreateInventoryRecordAction({ entryId, productId, onOpenInventory }: Props) {
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
    <button type="button" onClick={() => onOpenInventory(linkedProductId)} className="pill flex items-center gap-1">
      <Check size={12} /> View in Inventory →
    </button>
  );
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button type="button" onClick={() => void createInventoryRecord(entryId)} disabled={busy} className="pill flex items-center gap-1 disabled:opacity-50">
        {busy ? <Loader2 size={12} className="animate-spin" /> : <PackagePlus size={12} />} Create Inventory record
      </button>
      {lastResult?.promotionError && <span className="inline-flex items-center gap-1 text-ui-10 text-tea-text-sec" role="status"><RefreshCw size={10} /> Queued until the connection returns</span>}
    </div>
  );
}
