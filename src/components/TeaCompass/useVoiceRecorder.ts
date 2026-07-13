import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import {
  createIndexedDbPendingTranscriptionRepository,
  createPendingTranscriptionService,
  type PendingTranscription,
  type PendingTranscriptionResult,
} from '../../lib/pendingTranscriptions';

export type RecorderState = 'idle' | 'recording' | 'transcribing' | 'error';

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
  if (MediaRecorder.isTypeSupported('audio/wav')) return 'audio/wav';
  return 'audio/mp4';
}

const pendingRepository = createIndexedDbPendingTranscriptionRepository();
const pendingService = createPendingTranscriptionService({
  repository: pendingRepository,
  transcribe: (blob) => api.transcribeAudio(blob),
});

export function useVoiceRecorder(
  onTranscript: (text: string, contextKey: string) => boolean | void,
  contextKey = 'curate:unassigned',
) {
  const [state, setState] = useState<RecorderState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingRecording, setPendingRecording] = useState<PendingTranscription | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const onTranscriptRef = useRef(onTranscript);
  const contextKeyRef = useRef(contextKey);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { contextKeyRef.current = contextKey; }, [contextKey]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void pendingService.list(contextKey).then(async (recordings) => {
      if (cancelled || !mountedRef.current) return;
      const recording = recordings.at(-1) ?? null;
      if (!recording) return;
      if (recording.status === 'complete' && recording.transcript) {
        const accepted = onTranscriptRef.current(recording.transcript, recording.contextKey);
        if (accepted !== false) await pendingService.acknowledge(recording.id);
        return;
      }
      setPendingRecording(recording);
      setErrorMessage(recording.error ?? 'Recording saved. Transcription pending.');
      setState('error');
    });
    return () => { cancelled = true; };
  }, [contextKey]);

  const applyResult = useCallback(async (result: PendingTranscriptionResult) => {
    if (!mountedRef.current) return;
    if (result.contextKey !== contextKeyRef.current) return;
    if (result.status === 'complete') {
      const accepted = onTranscriptRef.current(result.text, result.contextKey);
      if (accepted === false) {
        setState('idle');
        return;
      }
      await pendingService.acknowledge(result.id);
      if (!mountedRef.current) return;
      setPendingRecording(null);
      setErrorMessage(null);
      setState('idle');
      return;
    }
    if (result.status === 'superseded') {
      setState('idle');
      return;
    }
    const recordings = await pendingService.list(contextKey);
    if (!mountedRef.current) return;
    setPendingRecording(recordings.find((recording) => recording.id === result.id) ?? null);
    setErrorMessage(result.error);
    setState('error');
  }, [contextKey]);

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
          await applyResult(await pendingService.capture(blob, contextKey));
        } catch (err: unknown) {
          if (mountedRef.current) {
            const msg = err instanceof Error ? err.message : 'Recording storage unavailable.';
            setErrorMessage(`${msg} Keep this page open and try again.`);
            setState('error');
          }
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
  }, [applyResult, contextKey]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
  }, []);

  const handlePress = useCallback(() => {
    if (state === 'recording') stopRecording();
    else if (state === 'idle') startRecording();
  }, [state, startRecording, stopRecording]);

  const retryPending = useCallback(async () => {
    if (!pendingRecording) return;
    setState('transcribing');
    setErrorMessage(null);
    await applyResult(await pendingService.retry(pendingRecording.id));
  }, [applyResult, pendingRecording]);

  const discardPending = useCallback(async () => {
    if (pendingRecording) await pendingService.discard(pendingRecording.id);
    if (!mountedRef.current) return;
    setPendingRecording(null);
    setErrorMessage(null);
    setState('idle');
  }, [pendingRecording]);

  return { state, errorMessage, pendingRecording, handlePress, retryPending, discardPending };
}
