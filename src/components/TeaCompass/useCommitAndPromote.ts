import { useCallback, useState } from 'react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { syncCompassEntries } from '../../lib/teaCompassSync';
import { api, hasToken, isTransientApiError } from '../../lib/api';

export interface CommitResult {
  promoted: boolean;
  productId?: string;
  /** Set when a promotion attempt failed — caller can surface it. */
  promotionError?: string;
  retryQueued?: boolean;
}

/** Explicitly creates an Inventory record for an already captured encounter. */
export function useCommitAndPromote() {
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const addPendingPromotion = useTeaCompassStore((s) => s.addPendingPromotion);
  const removePendingPromotion = useTeaCompassStore((s) => s.removePendingPromotion);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<CommitResult | null>(null);

  const createInventoryRecord = useCallback(
    async (entryId: string): Promise<CommitResult> => {
      if (!hasToken()) {
        const result: CommitResult = { promoted: false };
        setLastResult(result);
        return result;
      }

      setBusy(true);
      try {
        // The compass entry might still be unsynced (the periodic sync
        // runs on a timer). Force a sync now so the worker can find it.
        await syncCompassEntries();
        const { id, alreadyPromoted } = await api.compass.promote(entryId);
        // Mirror the link locally so a re-promote click would no-op via
        // the worker's idempotency.
        updateEntry(entryId, { draftProductId: id, synced: false });
        removePendingPromotion(entryId);
        const result: CommitResult = { promoted: !alreadyPromoted, productId: id };
        setLastResult(result);
        return result;
      } catch (err) {
        const retryQueued = isTransientApiError(err);
        if (retryQueued) addPendingPromotion(entryId);
        else removePendingPromotion(entryId);
        const result: CommitResult = {
          promoted: false,
          promotionError: err instanceof Error ? err.message : 'Promotion failed',
          retryQueued,
        };
        setLastResult(result);
        return result;
      } finally {
        setBusy(false);
      }
    },
    [updateEntry, addPendingPromotion, removePendingPromotion],
  );

  return { createInventoryRecord, busy, lastResult };
}
