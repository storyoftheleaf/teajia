import { api } from './api';
import { useAppStore } from './store';
import { useTeaCompassStore } from './teaCompassStore';
import { ensureCompassEncounterSaved } from './teaCompassSync';
import { notesPersonKey, useNotesStore, type Note } from './notesStore';
import type { VoiceRecording } from './pendingTranscriptions';
import type { TeaCompassEntry } from '../components/TeaCompass/types';

/** The Worker attaches the audio and private transcript together before device recovery is cleared. */
export async function saveRecordedTeaNote(entryId: string, recording?: VoiceRecording): Promise<boolean> {
  const { activeAccountId: accountId, activeUserId: userId } = useAppStore.getState();
  const initial = useTeaCompassStore.getState();
  if (!accountId || !userId || initial.accountScopeId !== accountId || initial.userScopeId !== userId || !initial.getEntry(entryId)) return false;
  if (!recording) throw new Error('Recording saved on this device. Retry to save its audio with this tea.');
  const revision = initial.accountScopeRevision;
  await ensureCompassEncounterSaved(entryId);
  const savedScope = useTeaCompassStore.getState();
  const savedApp = useAppStore.getState();
  if (savedApp.activeAccountId !== accountId || savedApp.activeUserId !== userId || savedScope.accountScopeId !== accountId || savedScope.userScopeId !== userId || savedScope.accountScopeRevision !== revision) return false;
  const result = await api.attachTranscription(recording.recordingId, entryId, { accountId, userId });
  const current = useTeaCompassStore.getState();
  const app = useAppStore.getState();
  if (app.activeAccountId !== accountId || app.activeUserId !== userId || current.accountScopeRevision !== revision) return false;

  const appendClip = (entry: TeaCompassEntry) => entry.id !== entryId ? entry : {
    ...entry,
    audioClips: [...entry.audioClips.filter(clip => clip.url !== result.clip.url), result.clip],
  };
  useTeaCompassStore.setState(state => ({
    entries: state.entries.map(appendClip),
    pendingEntries: state.pendingEntries.map(appendClip),
  }));
  const row = result.note;
  const note: Note = {
    id: row.id, accountId, compassEntryId: entryId, teaKey: row.tea_key ?? undefined,
    text: row.text, sourceType: 'voice', authorId: row.author_id ?? userId,
    authorName: row.author_name ?? 'You', visibility: 'private', createdAt: row.created_at, synced: true,
  };
  useNotesStore.setState(state => state.personScopeKey === notesPersonKey(accountId, userId)
    ? { notes: [...state.notes.filter(existing => existing.id !== note.id), note] } : state);
  return true;
}
