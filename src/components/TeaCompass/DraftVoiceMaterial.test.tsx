import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAppStore } from '../../lib/store';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import { createEmptyEntry } from './types';
import { DraftVoiceMaterial, voiceDraftContext, voiceDraftScopeMatches } from './DraftVoiceMaterial';

const recorder = vi.hoisted(() => ({ captures: [] as Array<{ onTranscript: (text: string, context: string) => boolean | void; context: string; userId: string }>, state: 'idle', errorMessage: null as string | null, pendingRecording: null as unknown }));
vi.mock('./useVoiceRecorder', () => ({ useVoiceRecorder: (onTranscript: (text: string, context: string) => boolean | void, context: string, userId: string) => {
  recorder.captures.push({ onTranscript, context, userId });
  return { state: recorder.state, errorMessage: recorder.errorMessage, pendingRecording: recorder.pendingRecording, handlePress: vi.fn(), retryPending: vi.fn(), discardPending: vi.fn() };
} }));
const appBefore = useAppStore.getState();
const compassBefore = useTeaCompassStore.getState();
const notesBefore = useNotesStore.getState();
beforeEach(() => {
  recorder.captures.length = 0; recorder.state = 'idle'; recorder.errorMessage = null; recorder.pendingRecording = null;
  useAppStore.setState({ activeAccountId: 'shop-1', activeUserId: 'user-1' });
  useTeaCompassStore.setState({ accountScopeId: 'shop-1', accountScopeRevision: 3, entries: [{ ...createEmptyEntry('tea'), id: 'shuixian', name: 'Shuixian' }] });
});
afterEach(() => { useAppStore.setState(appBefore); useTeaCompassStore.setState(compassBefore); useNotesStore.setState(notesBefore); });
const render = (onTranscript = vi.fn()) => renderToStaticMarkup(<DraftVoiceMaterial entryId="shuixian" onTranscript={onTranscript} />);

describe('draft voice working material', () => {
  it('offers a recorder in a dedicated draft context without starting the microphone', () => {
    const html = render();
    expect(html).toContain('Record a voice memo');
    expect(html).toContain('only Save accepted changes adds it to this tea');
    expect(recorder.captures[0]).toMatchObject({ context: 'curate-working:user-1:shop-1:shuixian', userId: 'user-1' });
  });
  it('stages completed text without changing the tea or adding a canonical note', () => {
    const onTranscript = vi.fn();
    const tea = useTeaCompassStore.getState().getEntry('shuixian');
    const notes = useNotesStore.getState().notes;
    render(onTranscript);
    const capture = recorder.captures[0];
    expect(capture.onTranscript('  Our new sourcing note.  ', capture.context)).toBe(true);
    expect(onTranscript).toHaveBeenCalledExactlyOnceWith('Our new sourcing note.');
    expect(useTeaCompassStore.getState().getEntry('shuixian')).toBe(tea);
    expect(useNotesStore.getState().notes).toBe(notes);
  });
  it('refuses a late callback after the person or shop changes', () => {
    const onTranscript = vi.fn(); render(onTranscript);
    const capture = recorder.captures[0];
    useAppStore.setState({ activeAccountId: 'shop-2' });
    expect(capture.onTranscript('Wrong shop material.', capture.context)).toBe(false);
    expect(onTranscript).not.toHaveBeenCalled();
  });
  it('refuses another entry context and a changed account revision', () => {
    const onTranscript = vi.fn(); render(onTranscript);
    const capture = recorder.captures[0];
    expect(capture.onTranscript('Wrong tea.', 'curate-working:user-1:shop-1:other-tea')).toBe(false);
    useTeaCompassStore.setState({ accountScopeRevision: 4 });
    expect(capture.onTranscript('Stale scope.', capture.context)).toBe(false);
    expect(onTranscript).not.toHaveBeenCalled();
  });
  it('offers recovery actions for privately held pending audio', () => {
    recorder.state = 'error'; recorder.pendingRecording = { id: 'pending-voice' }; recorder.errorMessage = 'Transcription unavailable.';
    const html = render();
    expect(html).toContain('Retry transcript'); expect(html).toContain('Discard recording'); expect(html).toContain('Transcription unavailable.');
  });
  it('does not treat a guest or different scope revision as an eligible draft', () => {
    expect(voiceDraftContext({ entryId: 'tea', accountId: null, userId: null, revision: 0 })).toBe('curate-working:guest:guest:tea');
    const scope = { entryId: 'tea', accountId: 'shop', userId: 'user', revision: 1 };
    expect(voiceDraftScopeMatches(scope, { ...scope, revision: 2 })).toBe(false);
    expect(voiceDraftScopeMatches({ ...scope, accountId: null }, { ...scope, accountId: null })).toBe(false);
  });
});
