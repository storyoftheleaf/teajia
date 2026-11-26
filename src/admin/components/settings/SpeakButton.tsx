import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square } from 'lucide-react';
import { api } from '../../../lib/api';
import { Button } from '../../../components/shared/Button';

/**
 * Say it instead of typing it. Records from the microphone and sends the
 * recording through the site's one transcription path (POST /api/transcribe,
 * via api.transcribeAudio, primed from the shared word library), then hands
 * the words back. The same recorder the tea record's inline microphone uses,
 * as a shared Button.
 */
function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/mp4';
  for (const mime of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav']) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return 'audio/mp4';
}

export function SpeakButton({ onWords, disabled }: { onWords: (words: string) => void; disabled?: boolean }) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [failed, setFailed] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mountedRef = useRef(true);
  useEffect(() => () => {
    mountedRef.current = false;
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  const start = async () => {
    setFailed(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const mime = pickMime();
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        if (blob.size < 100) { if (mountedRef.current) setState('idle'); return; }
        if (mountedRef.current) setState('transcribing');
        try {
          const result = await api.transcribeAudio(blob);
          if (mountedRef.current && result.text?.trim()) onWords(result.text.trim());
        } catch {
          if (mountedRef.current) setFailed(true);
        } finally {
          if (mountedRef.current) setState('idle');
        }
      };
      recorder.start(250);
      setState('recording');
    } catch {
      setFailed(true);
      setState('idle');
    }
  };
  const stop = () => recorderRef.current?.stop();

  const recording = state === 'recording';
  const transcribing = state === 'transcribing';
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled || transcribing}
        aria-label={recording ? 'Stop recording' : transcribing ? 'Writing it down' : 'Say it'}
        icon={recording ? <Square size={12} fill="currentColor" /> : transcribing ? <Loader2 size={12} className="animate-spin" /> : <Mic size={12} />}
      >
        {recording ? 'Stop' : transcribing ? 'Writing it down' : 'Say it'}
      </Button>
      {failed && <span role="status" className="text-ui-12 text-tea-text-sec">That did not come through. Try again, or type it.</span>}
    </span>
  );
}
