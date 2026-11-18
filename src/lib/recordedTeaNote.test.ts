import { beforeEach, expect, it, vi } from 'vitest';
import { saveRecordedTeaNote } from './recordedTeaNote';
import { api } from './api';
import { ensureCompassEncounterSaved } from './teaCompassSync';
import { useTeaCompassStore } from './teaCompassStore';
import { useAppStore } from './store';
import { notesPersonKey, useNotesStore } from './notesStore';
import { createEmptyEntry } from '../components/TeaCompass/types';

vi.mock('./api', () => ({ api: { attachTranscription: vi.fn() } }));
vi.mock('./teaCompassSync', () => ({ ensureCompassEncounterSaved: vi.fn().mockResolvedValue(undefined) }));
const clip = { url: '/api/transcriptions/recording-1/audio', timestamp: '2026-11-18T00:00:00Z', transcript: 'Spoken source' };
const recording = { recordingId: 'recording-1', audioUrl: clip.url, timestamp: clip.timestamp };
const note = { id: 'recording-recording-1', text: 'Spoken source', created_at: clip.timestamp };
const result = { recording_id: recording.recordingId, audio_url: clip.url, clip, note, entry: {} };

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ activeAccountId: 'account-1', activeUserId: 'user-1' });
  useTeaCompassStore.setState({ accountScopeId: 'account-1', userScopeId: 'user-1', accountScopeRevision: 1,
    entries: [{ ...createEmptyEntry('tea'), id: 'tea-1', name: 'Source tea', synced: true }], pendingEntries: [] });
  useNotesStore.setState({ notes: [], personScopeKey: notesPersonKey('account-1', 'user-1') });
  vi.mocked(api.attachTranscription).mockResolvedValue(result);
});

it('attaches to the saved encounter and shows the deterministic note and clip once on replay', async () => {
  await expect(saveRecordedTeaNote('tea-1', recording)).resolves.toBe(true);
  expect(ensureCompassEncounterSaved).toHaveBeenCalledWith('tea-1');
  expect(api.attachTranscription).toHaveBeenCalledWith('recording-1', 'tea-1', { accountId: 'account-1', userId: 'user-1' });
  await saveRecordedTeaNote('tea-1', recording);
  expect(useTeaCompassStore.getState().getEntry('tea-1')?.audioClips).toEqual([clip]);
  expect(useNotesStore.getState().notes).toEqual([expect.objectContaining({ id: note.id, compassEntryId: 'tea-1', visibility: 'private', synced: true })]);
});

it('leaves local attachment absent when the durable save fails', async () => {
  vi.mocked(api.attachTranscription).mockRejectedValue(new Error('offline'));
  await expect(saveRecordedTeaNote('tea-1', recording)).rejects.toThrow('offline');
  expect(useTeaCompassStore.getState().getEntry('tea-1')?.audioClips).toEqual([]);
  expect(useNotesStore.getState().notes).toEqual([]);
});

it('does not project the completed attachment into a different active person', async () => {
  vi.mocked(api.attachTranscription).mockImplementation(async () => {
    useAppStore.setState({ activeUserId: 'user-2' });
    return result;
  });
  await expect(saveRecordedTeaNote('tea-1', recording)).resolves.toBe(false);
  expect(useTeaCompassStore.getState().getEntry('tea-1')).toBeUndefined();
  expect(useNotesStore.getState().notes).toEqual([]);
});
