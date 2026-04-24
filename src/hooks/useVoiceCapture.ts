import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

export type VoiceCaptureState = 'idle' | 'recording' | 'transcribing';

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/wav')) return 'audio/wav';
  return 'audio/mp4';
}

/**
 * Shared voice capture primitive used by the tasting flow's silent press-and-hold
 * (on the NOTE tab) and the NotesPanel's explicit record button. Transcription
 * is routed through `api.transcribeAudio`; on success we call onTranscribed
 * with the trimmed text.
 */
export function useVoiceCapture({
  onTranscribed,
  onError,
}: {
  onTranscribed: (text: string) => void;
  onError?: (message: string) => void;
}) {
  const [state, setState] = useState<VoiceCaptureState>('idle');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const callbacksRef = useRef({ onTranscribed, onError });

  useEffect(() => {
    callbacksRef.current = { onTranscribed, onError };
  }, [onTranscribed, onError]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (state !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onerror = () => {
        if (!mountedRef.current) return;
        callbacksRef.current.onError?.('Recording failed.');
        setState('idle');
        stopStream();
      };
      recorder.onstop = async () => {
        stopStream();
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size < 100) {
          if (mountedRef.current) setState('idle');
          return;
        }
        if (mountedRef.current) setState('transcribing');
        try {
          const result = await api.transcribeAudio(blob);
          if (!mountedRef.current) return;
          const text = result.text?.trim();
          if (text) callbacksRef.current.onTranscribed(text);
        } catch (err: unknown) {
          if (!mountedRef.current) return;
          const msg = err instanceof Error ? err.message : '';
          callbacksRef.current.onError?.(msg || 'Transcription failed.');
        }
        if (mountedRef.current) setState('idle');
      };
      recorder.start(250);
      setState('recording');
    } catch {
      if (!mountedRef.current) return;
      setState('idle');
      callbacksRef.current.onError?.('Microphone access denied.');
    }
  }, [state, stopStream]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  return { state, start, stop };
}
