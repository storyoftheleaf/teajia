import { Check, Loader2, PackagePlus, RefreshCw } from 'lucide-react';
import { useCommitAndPromote } from './useCommitAndPromote';

interface Props { entryId: string; productId?: string; onOpenInventory: (productId: string) => void }

/** Deliberate boundary between a Curate encounter and a physical Inventory record. */
export function CreateInventoryRecordAction({ entryId, productId, onOpenInventory }: Props) {
  const { createInventoryRecord, busy, lastResult } = useCommitAndPromote();
  const linkedProductId = productId ?? lastResult?.productId;
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
