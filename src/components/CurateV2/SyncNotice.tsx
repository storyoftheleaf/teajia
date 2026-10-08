import React, { useCallback, useState } from 'react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { syncCompassEntries } from '../../lib/teaCompassSync';

/**
 * When the shop could not be reached, say so on every screen of Curate, in a
 * plain sentence with the one thing to do. Teas typed at the table, a fast
 * tasting and a filed recording are all kept on this phone and sent in the
 * background; only a failed send needs the person to know, so nothing shows
 * while all is well (and nothing flashes while a save is simply in flight).
 */
export const SyncNotice: React.FC = () => {
  const failed = useTeaCompassStore((s) => s.syncError);
  const waiting = useTeaCompassStore((s) => s.entries.filter((e) => !e.synced).length);
  const [busy, setBusy] = useState(false);
  const retry = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try { await syncCompassEntries(); } finally { setBusy(false); }
  }, [busy]);
  if (!failed) return null;
  return (
    <div role="alert" data-testid="curate-sync-notice" className="flex shrink-0 items-baseline justify-between gap-3 border-b border-tea-border bg-tea-surface px-4 py-1.5">
      <p className="min-w-0 font-body text-ui-13 text-tea-error">
        {waiting > 0
          ? `${waiting} ${waiting === 1 ? 'change has' : 'changes have'} not reached the shop yet. ${waiting === 1 ? 'It is' : 'They are'} kept on this phone.`
          : 'The shop could not be reached. Your last change may not have been saved.'}
      </p>
      <button type="button" onClick={() => void retry()} disabled={busy} className="curate-v2-word tap-target shrink-0 disabled:opacity-60">
        {busy ? 'Trying…' : 'Try again'}
      </button>
    </div>
  );
};
