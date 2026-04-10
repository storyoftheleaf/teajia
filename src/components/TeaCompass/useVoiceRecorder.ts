import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';

export type RecorderState = 'idle' | 'recording' | 'transcribing' | 'error';

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/wav')) return 'audio/wav';
  return 'audio/mp4';
}

export function useVoiceRecorder(onTranscript: (text: string) => void) {
  const [state, setState] = useState<RecorderState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (state === 'error') {
      const t = setTimeout(() => { setState('idle'); setErrorMessage(null); }, 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size < 100) { setState('idle'); return; }
        setState('transcribing');
        try {
          const result = await api.transcribeAudio(blob);
          if (result.text?.trim()) onTranscript(result.text.trim());
          setState('idle');
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Transcription failed';
          setErrorMessage(msg);
          setState('error');
        }
      };

      recorder.start(250);
      setState('recording');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.toLowerCase().includes('denied') || msg.toLowerCase().includes('not allowed')) {
        setErrorMessage('Microphone access denied.');
      } else {
        setErrorMessage(msg || 'Could not start recording.');
      }
      setState('error');
    }
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  }, []);

  const handlePress = useCallback(() => {
    if (state === 'recording') stopRecording();
    else if (state === 'idle') startRecording();
  }, [state, startRecording, stopRecording]);

  return { state, errorMessage, handlePress };
}
