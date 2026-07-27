/**
 * notesSync, push unsynced notes and sessions to the server.
 * Mirrors the pattern used by teaCompassSync.ts.
 */

import { useNotesStore } from './notesStore';
import { api, hasToken } from './api';
import type { Note, NoteSession } from './notesStore';

const BACKGROUND_REQUEST = { background: true } as const;

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

  // Sync sessions first (notes may reference them)
  const unsyncedSessions = store.sessions.filter(s => !s.synced);
  if (unsyncedSessions.length > 0) {
    try {
      await api.notes.syncSessions(unsyncedSessions.map(sessionToPayload), BACKGROUND_REQUEST);
      store.markSessionSynced(unsyncedSessions.map(s => s.id));
    } catch {
      // Silent, retry next time
    }
  }

  // Sync notes (includes soft-deletes)
  const unsyncedNotes = store.notes.filter(n => !n.synced);
  if (unsyncedNotes.length === 0) return;

  try {
    await api.notes.sync(unsyncedNotes.map(noteToPayload), BACKGROUND_REQUEST);
    store.markSynced(unsyncedNotes.map(n => n.id));
  } catch {
    // Silent, stays unsynced for retry
  }
}

/** Hydrate notes from server on app start, merging with local unsynced notes */
export async function hydrateNotes(): Promise<void> {
  if (!hasToken()) return;

  try {
    const remote = await api.notes.getAll(BACKGROUND_REQUEST);
    const store = useNotesStore.getState();
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

    useNotesStore.setState({ notes: merged });
  } catch {
    // Offline or error, local state stands
  }
}
