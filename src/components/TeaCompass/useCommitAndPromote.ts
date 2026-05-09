import { useCallback, useState } from 'react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useCompassSaveMode } from '../../lib/compassSaveMode';
import { syncCompassEntries } from '../../lib/teaCompassSync';
import { api, hasToken } from '../../lib/api';

export interface CommitResult {
  promoted: boolean;
  productId?: string;
  /** Set when a promotion attempt failed — caller can surface it. */
  promotionError?: string;
}

/**
 * Commits a compass entry locally, then — if the active save mode is 'inventory' —
 * syncs the entry to D1 and promotes it to a Draft product. Returns metadata so
 * the UI can show feedback ("Added to drafts queue").
 */
export function useCommitAndPromote() {
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<CommitResult | null>(null);

  const commitAndPromote = useCallback(
    async (entryId: string): Promise<CommitResult> => {
      const mode = useCompassSaveMode.getState().mode;
      if (mode !== 'inventory' || !hasToken()) {
        const result: CommitResult = { promoted: false };
        setLastResult(result);
        return result;
      }

      setBusy(true);
      try {
        // The compass entry might still be unsynced (the periodic sync runs on
        // a timer). Force a sync now so the worker can find the row.
        await syncCompassEntries();
        const { id, alreadyPromoted } = await api.compass.promote(entryId);
        // Mirror the link locally so the entry knows it's been promoted (and
        // a re-promote click would no-op via the worker's idempotency).
        updateEntry(entryId, { draftProductId: id, synced: false });
        const result: CommitResult = { promoted: !alreadyPromoted, productId: id };
        setLastResult(result);
        return result;
      } catch (err) {
        const result: CommitResult = {
          promoted: false,
          promotionError: err instanceof Error ? err.message : 'Promotion failed',
        };
        setLastResult(result);
        return result;
      } finally {
        setBusy(false);
      }
    },
    [updateEntry],
  );

  return { commitAndPromote, busy, lastResult };
}
