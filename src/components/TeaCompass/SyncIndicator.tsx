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
      className="relative w-5 h-5 flex items-center justify-center shrink-0"
      aria-label={isPending ? `${unsyncedCount} entries pending sync` : 'All synced'}
      title={isPending ? `${unsyncedCount} pending` : 'Synced'}
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
    </button>
  );
};
