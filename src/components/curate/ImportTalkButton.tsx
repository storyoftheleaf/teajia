import React from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { useAppStore } from '../../lib/store';
import { Button } from '../shared/Button';

/** Talk about several teas in one go (intake plan step 3, Adrian 2026-11-27).
 *  The words land in the Import text, and Start import splits them into teas
 *  for him to confirm one by one, the same review a pasted WeChat list gets. */
export const ImportTalkButton: React.FC<{ disabled?: boolean; onTranscript: (text: string) => void }> = ({ disabled, onTranscript }) => {
  const userId = useAppStore(s => s.activeUserId) ?? 'guest';
  const accountId = useAppStore(s => s.activeAccountId) ?? 'guest';
  const context = `curate:${userId}:${accountId}:import`;
  const voice = useVoiceRecorder((text, capturedContext) => {
    if (capturedContext !== context) return false;
    if (text.trim()) onTranscript(text.trim());
    return true;
  }, context, userId);
  const label = voice.state === 'recording' ? 'Stop' : voice.state === 'transcribing' ? 'Writing it down…' : 'Talk';
  return (
    <>
      <Button variant="plain" type="button" disabled={disabled || voice.state === 'transcribing'} aria-pressed={voice.state === 'recording'}
        aria-label={voice.state === 'recording' ? 'Stop talking' : 'Talk about the teas'} onClick={voice.handlePress}
        className="tap-target inline-flex min-h-tap items-center gap-2 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">
        {voice.state === 'recording' ? <Square size={14} fill="currentColor" strokeWidth={0} /> : voice.state === 'transcribing' ? <Loader2 size={16} className="animate-spin" /> : <Mic size={16} />} {label}
      </Button>
      {voice.pendingRecording && <Button variant="plain" type="button" className="tap-target min-h-tap text-ui-12 text-tea-gold" onClick={() => void voice.retryPending()}>Try the words again</Button>}
      {voice.errorMessage && <p role="alert" className="basis-full text-ui-12 text-tea-text-sec">{voice.errorMessage}</p>}
    </>
  );
};
