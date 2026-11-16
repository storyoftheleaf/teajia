/**
 * notesStore, local-first unified note thread.
 *
 * Notes are anchored by tea_key (resolved products) or compass_entry_id (draft entries).
 * They sync to the server when online, exactly like compass entries.
 *
 * source_type:
 *   'manual' , typed by user
 *   'voice'  , transcribed from mic
 *   'tasting', injected artifact when a tasting session is saved
 *   'vendor' , attributed to vendor in the capture flow
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAppStore } from './store';
import { preserveLegacyLocalBytes } from './preserveLegacyLocalBytes';

export type NoteSourceType = 'manual' | 'voice' | 'tasting' | 'vendor';
export type NoteVisibility = 'private' | 'network' | 'public';

export interface Note {
  id: string;
  accountId: string;

  // Anchors
  teaKey?: string;
  compassEntryId?: string;
  sessionId?: string;

  // Content
  text: string;
  sourceType: NoteSourceType;
  tastingId?: string;
  tastingSnapshot?: Record<string, unknown>;  // TastingData snapshot for 'tasting' artifacts

  // Attribution
  authorId: string;
  authorName: string;

  // Privacy
  visibility: NoteVisibility;

  createdAt: string;

  // Sync
  synced: boolean;
  deleted?: boolean;  // soft-delete for sync
}

export interface NoteSession {
  id: string;
  accountId: string;
  title?: string;
  sessionDate: string;
  location?: string;
  createdAt: string;
  synced: boolean;
}

interface NotesState {
  notes: Note[];
  sessions: NoteSession[];
  personScopeKey: string | null;
  scopeRevision: number;
  notesByPerson: Record<string, Note[]>;
  sessionsByPerson: Record<string, NoteSession[]>;
  switchPerson: (accountId: string | null, userId: string | null) => void;

  // Actions
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'synced'>) => Note;
  updateNote: (id: string, text: string) => void;
  removeNote: (id: string) => void;
  addSession: (session: Omit<NoteSession, 'id' | 'createdAt' | 'synced'>) => NoteSession;

  // Queries
  getNotesForTea: (teaKey: string) => Note[];
  getNotesForCompassEntry: (compassEntryId: string) => Note[];
  getNotesForSession: (sessionId: string) => Note[];

  // Sync internals
  markSynced: (ids: string[]) => void;
  markSessionSynced: (ids: string[]) => void;

  /** When a compass entry is committed and gets a tea_key, migrate its notes */
  migrateCompassNotes: (compassEntryId: string, teaKey: string) => void;
}

export function notesPersonKey(accountId: string | null, userId: string | null): string | null {
  return accountId && userId ? `person:${encodeURIComponent(accountId)}:${encodeURIComponent(userId)}` : null;
}

const LEGACY_NOTES_KEY = '__legacy_unscoped__';

preserveLegacyLocalBytes('teajia-notes', 'teajia-notes-legacy-recovery', 1);

export function mergeNotesPersistedState(stored: unknown, current: NotesState): NotesState {
  const persisted = (stored ?? {}) as Partial<NotesState>;
  const key = notesPersonKey(useAppStore.getState().activeAccountId, useAppStore.getState().activeUserId);
  const notesByPerson = { ...(persisted.notesByPerson ?? {}) };
  const sessionsByPerson = { ...(persisted.sessionsByPerson ?? {}) };
  const sourceKey = persisted.personScopeKey ?? LEGACY_NOTES_KEY;
  const archive = <T>(buckets: Record<string, T[]>, values: T[] | undefined) => {
    if (!values?.length) return;
    if (!buckets[sourceKey]) buckets[sourceKey] = values;
    else if (JSON.stringify(buckets[sourceKey]) !== JSON.stringify(values)) {
      buckets[`__facade_copy__:${sourceKey}`] = values;
    }
  };
  archive(notesByPerson, persisted.notes);
  archive(sessionsByPerson, persisted.sessions);
  return {
    ...current,
    notes: key ? notesByPerson[key] ?? [] : [],
    sessions: key ? sessionsByPerson[key] ?? [] : [],
    personScopeKey: key,
    notesByPerson, sessionsByPerson,
  };
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      sessions: [],
      personScopeKey: notesPersonKey(useAppStore.getState().activeAccountId, useAppStore.getState().activeUserId),
      scopeRevision: 0,
      notesByPerson: {},
      sessionsByPerson: {},
      switchPerson: (accountId, userId) => set(state => {
        const nextKey = notesPersonKey(accountId, userId);
        if (nextKey === state.personScopeKey) return state;
        const notesByPerson = { ...state.notesByPerson };
        const sessionsByPerson = { ...state.sessionsByPerson };
        if (state.personScopeKey) {
          notesByPerson[state.personScopeKey] = state.notes;
          sessionsByPerson[state.personScopeKey] = state.sessions;
        } else {
          // Pre-identity local notes have no trustworthy owner. Keep them for
          // restricted recovery without showing or uploading them as this user.
          if (state.notes.length) notesByPerson[LEGACY_NOTES_KEY] ??= state.notes;
          if (state.sessions.length) sessionsByPerson[LEGACY_NOTES_KEY] ??= state.sessions;
        }
        return {
          notes: nextKey ? notesByPerson[nextKey] ?? [] : [],
          sessions: nextKey ? sessionsByPerson[nextKey] ?? [] : [],
          personScopeKey: nextKey,
          scopeRevision: state.scopeRevision + 1,
          notesByPerson, sessionsByPerson,
        };
      }),

      addNote: (partial) => {
        const note: Note = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          synced: false,
          ...partial,
        };
        set(s => ({ notes: [...s.notes, note] }));
        return note;
      },

      updateNote: (id, text) => {
        set(s => ({
          notes: s.notes.map(n =>
            n.id === id ? { ...n, text, synced: false } : n
          ),
        }));
      },

      removeNote: (id) => {
        set(s => ({
          // Soft-delete for sync, server needs to know about removals
          notes: s.notes.map(n =>
            n.id === id ? { ...n, deleted: true, synced: false } : n
          ),
        }));
      },

      addSession: (partial) => {
        const session: NoteSession = {
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          synced: false,
          ...partial,
        };
        set(s => ({ sessions: [...s.sessions, session] }));
        return session;
      },

      getNotesForTea: (teaKey) =>
        get().notes.filter(n => n.teaKey === teaKey && !n.deleted),

      getNotesForCompassEntry: (compassEntryId) =>
        get().notes.filter(n => n.compassEntryId === compassEntryId && !n.deleted),

      getNotesForSession: (sessionId) =>
        get().notes.filter(n => n.sessionId === sessionId && !n.deleted),

      markSynced: (ids) => {
        const idSet = new Set(ids);
        set(s => ({
          // Purge hard-deleted notes that have been confirmed synced
          notes: s.notes
            .filter(n => !(idSet.has(n.id) && n.deleted))
            .map(n => idSet.has(n.id) ? { ...n, synced: true } : n),
        }));
      },

      markSessionSynced: (ids) => {
        const idSet = new Set(ids);
        set(s => ({
          sessions: s.sessions.map(n =>
            idSet.has(n.id) ? { ...n, synced: true } : n
          ),
        }));
      },

      migrateCompassNotes: (compassEntryId, teaKey) => {
        set(s => ({
          notes: s.notes.map(n =>
            n.compassEntryId === compassEntryId && !n.teaKey
              ? { ...n, teaKey, synced: false }
              : n
          ),
        }));
      },
    }),
    {
      name: 'teajia-notes',
      version: 1,
      migrate: state => state,
      partialize: state => {
        const notesByPerson = { ...state.notesByPerson };
        const sessionsByPerson = { ...state.sessionsByPerson };
        if (state.personScopeKey) {
          notesByPerson[state.personScopeKey] = state.notes;
          sessionsByPerson[state.personScopeKey] = state.sessions;
        }
        return {
          notes: state.notes, sessions: state.sessions,
          personScopeKey: state.personScopeKey,
          notesByPerson, sessionsByPerson,
        };
      },
      merge: mergeNotesPersistedState,
      // Purge fully synced soft-deletes on rehydration to keep storage lean
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.notes = state.notes.filter(n => !(n.deleted && n.synced));
      },
    }
  )
);

useAppStore.subscribe((state, previous) => {
  if (state.activeUserId !== previous.activeUserId || state.activeAccountId !== previous.activeAccountId) {
    useNotesStore.getState().switchPerson(state.activeAccountId, state.activeUserId);
  }
});
