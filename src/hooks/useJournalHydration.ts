import { useEffect, useState, useSyncExternalStore } from 'react';
import { AUTH_TOKEN_CHANGED_EVENT } from '../lib/api';
import { useAppStore } from '../lib/store';
import { hydrateTastingJournal, isCurrentJournalScope } from '../lib/tastingJournalSync';

function subscribeToToken(listener: () => void): () => void {
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, listener);
  return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, listener);
}

export function useJournalHydration(enabled = true) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const sessionReady = useAppStore(state => state.isSessionReady);
  const tokenReady = useSyncExternalStore(
    subscribeToToken,
    () => isCurrentJournalScope(accountId, userId),
    () => false,
  );
  const scopeKey = JSON.stringify([userId, accountId]);
  const canRead = enabled && sessionReady && tokenReady;
  const [failure, setFailure] = useState<{ scopeKey: string; message: string } | null>(null);

  useEffect(() => {
    if (!canRead) return;
    let active = true;
    setFailure(null);
    hydrateTastingJournal().catch((error: unknown) => {
      if (active) setFailure({
        scopeKey,
        message: error instanceof Error ? error.message : 'Could not load journal',
      });
    });
    return () => { active = false; };
  }, [canRead, scopeKey]);

  return {
    scopeKey,
    canRead,
    fetchError: canRead && failure?.scopeKey === scopeKey ? failure.message : null,
  };
}
