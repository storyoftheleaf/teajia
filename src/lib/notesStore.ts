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

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      sessions: [],

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
      // Purge fully synced soft-deletes on rehydration to keep storage lean
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.notes = state.notes.filter(n => !(n.deleted && n.synced));
      },
    }
  )
);
