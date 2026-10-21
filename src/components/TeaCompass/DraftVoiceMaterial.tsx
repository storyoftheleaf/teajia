import { useEffect, useRef, useState } from 'react';
import { Mic } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useVoiceRecorder } from './useVoiceRecorder';

interface DraftVoiceMaterialProps {
  entryId: string;
  onTranscript: (text: string) => void;
  onBusyChange?: (busy: boolean) => void;
}

interface VoiceDraftScope { entryId: string; accountId: string | null; userId: string | null; revision: number }
export function voiceDraftContext(scope: VoiceDraftScope): string {
  return `curate-working:${scope.userId ?? 'guest'}:${scope.accountId ?? 'guest'}:${scope.entryId}`;
}
export function voiceDraftScopeMatches(captured: VoiceDraftScope, current: VoiceDraftScope): boolean {
  return !!captured.accountId && !!captured.userId && captured.entryId === current.entryId
    && captured.accountId === current.accountId && captured.userId === current.userId && captured.revision === current.revision;
}
function currentScope(entryId: string): VoiceDraftScope {
  const app = useAppStore.getState();
  const compass = useTeaCompassStore.getState();
  return { entryId, accountId: app.activeAccountId === compass.accountScopeId ? app.activeAccountId : null, userId: app.activeUserId, revision: compass.accountScopeRevision };
}

/** The existing recorder holds audio privately for transcription/retry. Its
 * completed text goes only to the parent's draft; accepting this workspace is
 * the separate step that can add a canonical tea note. */
export function DraftVoiceMaterial(props: DraftVoiceMaterialProps) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const revision = useTeaCompassStore(state => state.accountScopeRevision);
  return <ScopedDraftVoiceMaterial key={`${accountId}:${userId}:${revision}:${props.entryId}`} {...props} />;
}

function ScopedDraftVoiceMaterial({ entryId, onTranscript, onBusyChange }: DraftVoiceMaterialProps) {
  const scope = currentScope(entryId);
  const scopeRef = useRef(scope);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const mounted = useRef(true);
  const [message, setMessage] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const context = voiceDraftContext(scopeRef.current);
  const voice = useVoiceRecorder((text, capturedContext) => {
    const clean = text.trim();
    if (!mounted.current || !clean || capturedContext !== context || !voiceDraftScopeMatches(scopeRef.current, currentScope(entryId)) || !useTeaCompassStore.getState().getEntry(entryId)) return false;
    onTranscriptRef.current(clean);
    setMessage('Voice memo added to working material. Not saved to the tea.');
    return true;
  }, context, scope.userId ?? 'guest');
  const busy = voice.state === 'recording' || voice.state === 'transcribing';
  const callbackRef = useRef(onBusyChange);
  callbackRef.current = onBusyChange;
  useEffect(() => { callbackRef.current?.(busy); return () => { callbackRef.current?.(false); }; }, [busy]);
  const ready = !!scope.accountId && !!scope.userId;
  const label = voice.state === 'recording' ? 'Stop recording' : voice.state === 'transcribing' ? 'Transcribing voice memo…' : 'Record a voice memo';
  return <section aria-label="Voice working material" className="min-w-0 space-y-2">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" aria-label={label} aria-pressed={voice.state === 'recording'} disabled={!ready || voice.state === 'transcribing' || voice.state === 'error'}
        onClick={() => { setMessage(''); voice.handlePress(); }} className="tap-target inline-flex min-h-11 items-center gap-2 rounded-md border border-tea-border px-3 text-ui-12 text-tea-text disabled:opacity-50">
        <Mic size={14} aria-hidden="true" />{label}
      </button>
      {voice.state === 'error' && !voice.pendingRecording && <button type="button" className="tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec" onClick={() => void voice.discardPending()}>Try recording again</button>}
      {voice.pendingRecording && <>
        <button type="button" disabled={voice.state === 'transcribing'} className="tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec" onClick={() => void voice.retryPending()}>Retry transcript</button>
        <button type="button" disabled={voice.state === 'transcribing'} className="tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec" onClick={() => void voice.discardPending()}>Discard recording</button>
      </>}
    </div>
    <p className="text-ui-11 text-tea-text-dim">Audio is held privately for transcription. Review the transcript here; only Save accepted changes adds it to this tea.</p>
    {voice.errorMessage && <p role="alert" className="text-ui-12 text-tea-text-sec">{voice.errorMessage}</p>}
    {message && <p role="status" className="text-ui-12 text-tea-text-sec">{message}</p>}
  </section>;
}
