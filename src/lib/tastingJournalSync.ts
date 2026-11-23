import { useAppStore } from './store';
import { api, getTokenClaims, hasToken, isTokenScopedToAccount } from './api';
import type { CustomerTasting } from '../types';
import { fromApiRow, mergePulledJournal } from './tastingJournalRead';
import { createJournalRetry } from './tastingJournalRetry';

const BACKGROUND_REQUEST = { background: true } as const;

// Convert CustomerTasting → API payload shape (snake_case).
// `note` and `tastings` are sent as JSON strings; the worker stores them as TEXT.
function toApiPayload(entry: CustomerTasting): Record<string, any> {
  return {
    id: entry.id,
    product_id: entry.productId,
    product_name: entry.productName,
    product_type: entry.productType,
    product_image: entry.productImage ?? null,
    note: JSON.stringify(entry.note),
    tastings: JSON.stringify(entry.tastings),
    compass_entry_id: entry.compassEntryId ?? null,
    created_at: entry.createdAt,
    archived: entry.archived ? 1 : 0,
  };
}

export async function persistTastingJournalEntry(entry: CustomerTasting): Promise<void> {
  const { activeAccountId: accountId, activeUserId: userId } = useAppStore.getState();
  if (!userId || !isCurrentJournalScope(accountId, userId)) throw new Error('Sign in again to save this tasting.');
  await api.tastingJournal.sync([toApiPayload(entry)], { expectedAuth: { accountId, userId } });
  useAppStore.setState(state => {
    if (state.activeUserId !== userId || state.activeAccountId !== accountId) return state;
    return { tastingJournal: state.tastingJournal.map(item =>
      item.id === entry.id && JSON.stringify(item) === JSON.stringify(entry) ? { ...item, synced: true } : item,
    ) };
  });
}

/**
 * Syncs unsynced tasting journal entries to D1. Quick-note sentinel rows
 * (productId === 'quick-note') are skipped, and dropped from local state.
 */
export async function syncTastingJournal(): Promise<number> {
  if (!hasToken()) return 0;

  const { tastingJournal, activeAccountId: accountId, activeUserId: userId } = useAppStore.getState();
  if (!userId || !isCurrentJournalScope(accountId, userId)) return 0;
  // Drop legacy quick-note sentinels client-side. The server-side migration
  // also deletes them; this is the client's parallel pass.
  const validJournal = tastingJournal.filter(e => e.productId && e.productId !== 'quick-note');
  if (validJournal.length !== tastingJournal.length) {
    useAppStore.setState({ tastingJournal: validJournal });
  }

  const unsynced = validJournal.filter(e => !e.synced);
  if (unsynced.length === 0) return 0;

  try {
    const payload = unsynced.map(toApiPayload);
    // What was sent, so an entry edited while the request was in flight is
    // not marked as sent: it stays waiting and goes up on the next push.
    const sent = new Map(unsynced.map(u => [u.id, JSON.stringify(u)]));
    await api.tastingJournal.sync(payload, { ...BACKGROUND_REQUEST, expectedAuth: { accountId, userId } });

    useAppStore.setState(state => {
      if (state.activeUserId !== userId || state.activeAccountId !== accountId) return state;
      return { tastingJournal: state.tastingJournal.map(e =>
        sent.get(e.id) === JSON.stringify(e) ? { ...e, synced: true } : e
      ) };
    });

    return unsynced.length;
  } catch (err) {
    console.warn('[TastingJournal] Sync failed:', err);
    return 0;
  }
}

/**
 * Pushes waiting journal entries again, for when the browser comes back
 * online or the tab regains focus. Guests never reach the server, nothing is
 * sent when nothing is waiting, and two retries never run at once.
 */
export const retryPendingJournalSync = createJournalRetry({
  isSignedIn: hasToken,
  hasPending: () => useAppStore.getState().tastingJournal.some(
    e => !e.synced && !!e.productId && e.productId !== 'quick-note',
  ),
  push: syncTastingJournal,
});

export function isCurrentJournalScope(accountId: string | null, userId: string | null): boolean {
  if (!userId) return false;
  if (accountId) return isTokenScopedToAccount(accountId, userId);
  // Signed-in guests with no location membership still own a personal Journal.
  const claims = getTokenClaims();
  return claims?.sub === userId && !claims.active_account_id && !claims.memberships?.length;
}

/**
 * Pull the current account's Journal once even when the app and a Journal
 * door open together. A location switch can change the store before the JWT
 * refreshes, so the request and its merge both require the same identity.
 */
let currentPull: Promise<void> | undefined;

export async function hydrateTastingJournal(): Promise<void> {
  const { activeAccountId: accountId, activeUserId: userId, tastingJournal } = useAppStore.getState();
  if (!userId || !isCurrentJournalScope(accountId, userId)) return;
  if (currentPull) return currentPull;

  const atStart = new Map(tastingJournal.map(entry => [entry.productId, entry]));
  let scopeChanged = false;
  const stopWatching = useAppStore.subscribe(state => {
    if (state.activeAccountId === accountId && state.activeUserId === userId) return;
    scopeChanged = true;
    if (currentPull === pull) currentPull = undefined;
  });
  const pull = api.tastingJournal.list({
    ...BACKGROUND_REQUEST,
    ...(accountId ? { expectedAuth: { accountId, userId } } : {}),
  }).then(data => {
    if (scopeChanged || !isCurrentJournalScope(accountId, userId)) return;
    const rows = Array.isArray(data?.entries) ? data.entries : Array.isArray(data) ? data : [];
    const serverEntries = rows.filter(row => row?.id && (row.account_id == null || row.account_id === accountId))
      .map(fromApiRow);
    useAppStore.setState(state => ({
      tastingJournal: mergePulledJournal(state.tastingJournal, serverEntries, atStart),
    }));
  }).catch(error => {
    if (!scopeChanged && isCurrentJournalScope(accountId, userId)) throw error;
  }).finally(() => {
    stopWatching();
    if (currentPull === pull) currentPull = undefined;
  });
  currentPull = pull;
  return pull;
}
