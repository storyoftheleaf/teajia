/**
 * notesSync, push unsynced notes and sessions to the server.
 * Mirrors the pattern used by teaCompassSync.ts.
 */

import { useNotesStore } from './notesStore';
import { api, hasToken, isTokenScopedToAccount } from './api';
import type { Note, NoteSession } from './notesStore';
import { useAppStore } from './store';
import { notesPersonKey } from './notesStore';

const scopedRequest = (accountId: string, userId: string) => ({
  background: true as const, expectedAuth: { accountId, userId },
});

function noteToPayload(n: Note) {
  return {
    id: n.id,
    account_id: n.accountId,
    tea_key: n.teaKey ?? null,
    compass_entry_id: n.compassEntryId ?? null,
    session_id: n.sessionId ?? null,
    text: n.text,
    source_type: n.sourceType,
    tasting_id: n.tastingId ?? null,
    tasting_snapshot: n.tastingSnapshot ? JSON.stringify(n.tastingSnapshot) : null,
    author_id: n.authorId,
    author_name: n.authorName,
    visibility: n.visibility,
    created_at: n.createdAt,
    deleted: n.deleted ?? false,
  };
}

function sessionToPayload(s: NoteSession) {
  return {
    id: s.id,
    account_id: s.accountId,
    title: s.title ?? null,
    session_date: s.sessionDate,
    location: s.location ?? null,
    created_at: s.createdAt,
  };
}

export async function syncNotes(): Promise<void> {
  if (!hasToken()) return;
  const store = useNotesStore.getState();
  const { activeAccountId, activeUserId } = useAppStore.getState();
  const key = notesPersonKey(activeAccountId, activeUserId);
  const revision = store.scopeRevision;
  if (!key || store.personScopeKey !== key || !isTokenScopedToAccount(activeAccountId, activeUserId)) return;
  const stillCurrent = () => {
    const current = useNotesStore.getState();
    return current.personScopeKey === key && current.scopeRevision === revision &&
      isTokenScopedToAccount(activeAccountId, activeUserId);
  };

  // Sync sessions first (notes may reference them)
  const unsyncedSessions = store.sessions.filter(s => !s.synced && s.accountId === activeAccountId);
  if (unsyncedSessions.length > 0) {
    try {
      if (!stillCurrent()) return;
      await api.notes.syncSessions(unsyncedSessions.map(sessionToPayload), scopedRequest(activeAccountId!, activeUserId!));
      if (stillCurrent()) useNotesStore.getState().markSessionSynced(unsyncedSessions.map(s => s.id));
    } catch {
      // Silent, retry next time
    }
  }

  // Sync notes (includes soft-deletes)
  // An old voice note may carry an account id in authorId. It has no
  // trustworthy person provenance, so leave it local for restricted recovery.
  const unsyncedNotes = useNotesStore.getState().notes.filter(n =>
    !n.synced && n.accountId === activeAccountId && n.authorId === activeUserId
  );
  if (unsyncedNotes.length === 0) return;

  try {
    if (!stillCurrent()) return;
    await api.notes.sync(unsyncedNotes.map(noteToPayload), scopedRequest(activeAccountId!, activeUserId!));
    if (stillCurrent()) useNotesStore.getState().markSynced(unsyncedNotes.map(n => n.id));
  } catch {
    // Silent, stays unsynced for retry
  }
}

/** Hydrate notes from server on app start, merging with local unsynced notes */
export async function hydrateNotes(): Promise<void> {
  if (!hasToken()) return;
  const { activeAccountId, activeUserId } = useAppStore.getState();
  const key = notesPersonKey(activeAccountId, activeUserId);
  const initial = useNotesStore.getState();
  const revision = initial.scopeRevision;
  if (!key || initial.personScopeKey !== key || !isTokenScopedToAccount(activeAccountId, activeUserId)) return;

  try {
    const remote = await api.notes.getAll(scopedRequest(activeAccountId!, activeUserId!));
    const store = useNotesStore.getState();
    if (store.personScopeKey !== key || store.scopeRevision !== revision || !isTokenScopedToAccount(activeAccountId, activeUserId)) return;
    const localUnsynced = new Set(store.notes.filter(n => !n.synced).map(n => n.id));

    // Merge: remote notes that aren't locally unsynced get added/updated
    const remoteNotes = remote.notes.map((r: any) => ({
      id: r.id,
      accountId: r.account_id,
      teaKey: r.tea_key ?? undefined,
      compassEntryId: r.compass_entry_id ?? undefined,
      sessionId: r.session_id ?? undefined,
      text: r.text,
      sourceType: r.source_type,
      tastingId: r.tasting_id ?? undefined,
      tastingSnapshot: r.tasting_snapshot ? JSON.parse(r.tasting_snapshot) : undefined,
      authorId: r.author_id,
      authorName: r.author_name,
      visibility: r.visibility,
      createdAt: r.created_at,
      synced: true,
      deleted: false,
    }));

    const merged = [
      ...store.notes.filter(n => !n.synced), // keep local unsynced
      ...remoteNotes.filter((r: any) => !localUnsynced.has(r.id)), // add remote
    ];

    useNotesStore.setState(state => state.personScopeKey === key && state.scopeRevision === revision
      ? { notes: merged } : state);
  } catch {
    // Offline or error, local state stands
  }
}
