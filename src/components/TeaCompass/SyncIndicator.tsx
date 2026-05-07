import React, { useCallback, useState } from 'react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { syncCompassEntries } from '../../lib/teaCompassSync';

export const SyncIndicator: React.FC = () => {
  const unsyncedCount = useTeaCompassStore((s) => s.entries.filter(e => !e.synced).length);
  const [syncing, setSyncing] = useState(false);

  const handleSync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await syncCompassEntries();
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  const isPending = unsyncedCount > 0;

  return (
    <button
      type="button"
      onClick={handleSync}
      className="tap-target relative inline-flex items-center gap-1.5 px-1.5 h-6 rounded-md text-tea-text-dim hover:text-tea-text-sec transition-colors shrink-0"
      aria-label={
        syncing
          ? 'Syncing'
          : isPending
            ? `${unsyncedCount} entries pending sync — tap to sync now`
            : 'All synced'
      }
      title={syncing ? 'Syncing…' : isPending ? `${unsyncedCount} pending — tap to sync` : 'Synced'}
    >
      <span
        className={`block w-2 h-2 rounded-full transition-colors duration-300 ${
          syncing
            ? 'bg-tea-gold animate-pulse'
            : isPending
              ? 'bg-tea-gold'
              : 'bg-tea-gold-lt'
        }`}
      />
      {isPending && !syncing && (
        <span className="text-ui-9 font-semibold text-tea-gold tabular-nums">{unsyncedCount}</span>
      )}
    </button>
  );
};
