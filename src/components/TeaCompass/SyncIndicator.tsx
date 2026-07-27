import React, { useCallback, useState } from 'react';
import { Cloud, CloudOff, Loader2 } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { syncCompassEntries } from '../../lib/teaCompassSync';

/**
 * SyncIndicator — surfaces only when something actually needs the user's
 * attention. The previous tiny gold dot read as decoration; users had no
 * way to tell it from an empty bullet point. The new version:
 *
 *   - all synced  → renders nothing (no chrome)
 *   - syncing     → spinner + "Syncing"
 *   - n unsynced  → cloud-off + count + "unsaved", tap to sync
 *
 * Gives the row real meaning when it shows up and disappears entirely
 * when there's nothing to communicate.
 */
export const SyncIndicator: React.FC = () => {
  const unsyncedCount = useTeaCompassStore((s) => s.entries.filter(e => !e.synced).length);
  const syncError = useTeaCompassStore((s) => s.syncError);
  const [syncing, setSyncing] = useState(false);
  const [showSavedFlash, setShowSavedFlash] = useState(false);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncCompassEntries();
      setShowSavedFlash(true);
      setTimeout(() => setShowSavedFlash(false), 1500);
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  const isPending = unsyncedCount > 0;

  // Quiet path — fully synced, no error, and not flashing the just-saved confirmation.
  if (!isPending && !syncing && !showSavedFlash && !syncError) return null;

  if (syncing) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2 h-7 rounded-md bg-tea-gold/[0.08] text-tea-gold text-ui-11 font-medium"
        aria-live="polite"
      >
        <Loader2 size={12} className="animate-spin" />
        <span>Syncing</span>
      </div>
    );
  }

  if (showSavedFlash) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2 h-7 rounded-md bg-tea-gold/[0.08] text-tea-gold text-ui-11 font-medium"
        aria-live="polite"
      >
        <Cloud size={12} />
        <span>Saved</span>
      </div>
    );
  }

  // Couldn't reach the server — say so plainly and offer a retry. Takes priority
  // over the neutral "unsaved" count so the user knows it's a connection problem,
  // not just work pending. This is the signal that was missing when changes
  // silently failed to save (e.g. on a blocked network).
  if (syncError) {
    return (
      <button
        type="button"
        onClick={handleSync}
        className="tap-target inline-flex items-center gap-1.5 px-2 h-7 rounded-md bg-tea-error/[0.10] text-tea-error border border-tea-error/30 hover:bg-tea-error/[0.16] transition-colors text-ui-11 font-medium"
        aria-label="Couldn't save to the server. Tap to retry."
        title="Couldn't reach the server. Tap to retry."
      >
        <CloudOff size={12} strokeWidth={1.75} />
        <span>Not saved. Retry</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSync}
      className="tap-target inline-flex items-center gap-1.5 px-2 h-7 rounded-md bg-tea-gold/[0.08] text-tea-gold border border-tea-gold/30 hover:bg-tea-gold/[0.14] transition-colors text-ui-11 font-medium"
      aria-label={`${unsyncedCount} unsaved ${unsyncedCount === 1 ? 'entry' : 'entries'}, tap to sync`}
      title={`${unsyncedCount} unsaved, tap to sync`}
    >
      <CloudOff size={12} strokeWidth={1.75} />
      <span className="tabular-nums">{unsyncedCount}</span>
      <span>unsaved</span>
    </button>
  );
};
