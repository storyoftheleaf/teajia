import React, { useState, useRef, useCallback, useEffect } from 'react';
import { api } from '../lib/api';

interface VoiceNoteCaptureProps {
  /** Called when transcription is confirmed by the user */
  onTranscribed: (text: string) => void;
  /** Optional extra class on the root element */
  className?: string;
}

type RecordingState = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'preview';

const MAX_RECORDING_SECONDS = 60;

export const VoiceNoteCapture: React.FC<VoiceNoteCaptureProps> = ({
  onTranscribed,
  className = '',
}) => {
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [transcription, setTranscription] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  };

  const startRecording = useCallback(async () => {
    setError(null);
    setState('requesting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone permission denied.');
      setState('idle');
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stopStream();
      if (timerRef.current) clearInterval(timerRef.current);
      if (autoStopRef.current) clearTimeout(autoStopRef.current);

      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
      chunksRef.current = [];

      setState('transcribing');
      try {
        const result = await api.transcribeAudio(blob);
        setTranscription(result.text || '');
        setState('preview');
      } catch {
        setError('Transcription failed. Please try again.');
        setState('idle');
      }
    };

    recorder.start(250);
    setState('recording');
    setElapsed(0);

    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);

    autoStopRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    }, MAX_RECORDING_SECONDS * 1000);
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const confirmTranscription = useCallback(() => {
    if (transcription.trim()) {
      onTranscribed(transcription.trim());
    }
    setTranscription('');
    setState('idle');
    setElapsed(0);
  }, [transcription, onTranscribed]);

  const discardTranscription = useCallback(() => {
    setTranscription('');
    setState('idle');
    setElapsed(0);
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Main control row */}
      <div className="flex items-center gap-2">
        {state === 'idle' && (
          <button
            type="button"
            onClick={startRecording}
            title="Record voice note"
            aria-label="Record voice note"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tea-surface border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-text-dim transition-colors text-xs"
          >
            {/* Microphone icon */}
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0014 0" />
              <line x1="12" y1="19" x2="12" y2="22" />
              <line x1="9" y1="22" x2="15" y2="22" />
            </svg>
            Voice note
          </button>
        )}

        {state === 'requesting' && (
          <span className="text-xs text-tea-text-dim italic">Requesting microphone…</span>
        )}

        {state === 'recording' && (
          <div className="flex items-center gap-2">
            {/* Animated recording dot */}
            <span className="w-2 h-2 rounded-full bg-tea-gold animate-pulse" aria-hidden="true" />
            <span className="text-xs text-tea-text-sec font-mono tabular-nums">{formatTime(elapsed)}</span>
            <span className="text-xs text-tea-text-dim">/ {formatTime(MAX_RECORDING_SECONDS)}</span>
            <button
              type="button"
              onClick={stopRecording}
              aria-label="Stop recording"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-tea-surface border border-tea-border text-tea-text-sec hover:text-tea-text hover:border-tea-text-dim transition-colors text-xs"
            >
              {/* Stop square icon */}
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="1" /></svg>
              Stop
            </button>
          </div>
        )}

        {state === 'transcribing' && (
          <div className="flex items-center gap-2 text-xs text-tea-text-dim italic">
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
            </svg>
            Transcribing…
          </div>
        )}
      </div>

      {/* Preview panel */}
      {state === 'preview' && (
        <div className="rounded-lg border border-tea-border bg-tea-surface p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-[0.15em] text-tea-text-dim">Transcription — confirm before adding</p>
          <textarea
            value={transcription}
            onChange={e => setTranscription(e.target.value)}
            rows={3}
            className="w-full bg-tea-bg border border-tea-border rounded-md px-3 py-2 text-sm text-tea-text outline-none focus:ring-2 focus:ring-tea-gold/40 resize-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={confirmTranscription}
              disabled={!transcription.trim()}
              className="px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold uppercase tracking-[0.12em] hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Add to notes
            </button>
            <button
              type="button"
              onClick={discardTranscription}
              className="px-3 py-1.5 rounded-md border border-tea-border text-xs text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-tea-text-sec">{error}</p>
      )}
    </div>
  );
};

export default VoiceNoteCapture;
