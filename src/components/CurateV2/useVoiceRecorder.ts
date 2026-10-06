import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import {
  createResilientPendingTranscriptionRepository,
  createIndexedDbPendingTranscriptionRepository,
  createPendingTranscriptionService,
  firstPendingTranscription,
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

const pendingRepository = createResilientPendingTranscriptionRepository(
  createIndexedDbPendingTranscriptionRepository(),
);
const pendingService = createPendingTranscriptionService({
  repository: pendingRepository,
  transcribe: (blob) => api.transcribeAudio(blob),
  retryTranscription: (recordingId) => api.retryTranscription(recordingId),
  discardTranscription: (recordingId) => api.discardTranscription(recordingId),
});

let previousUserId = useAppStore.getState().activeUserId;
useAppStore.subscribe((store) => {
  const nextUserId = store.activeUserId;
  if (previousUserId && previousUserId !== nextUserId) {
    void pendingService.purgeUser(previousUserId);
  }
  previousUserId = nextUserId;
});

export function useVoiceRecorder(
  onTranscript: (text: string, contextKey: string) => boolean | void,
  contextKey = 'curate:guest:guest:unassigned',
  userId = 'guest',
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
  const userIdRef = useRef(userId);

  useEffect(() => { onTranscriptRef.current = onTranscript; }, [onTranscript]);
  useEffect(() => { contextKeyRef.current = contextKey; }, [contextKey]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const showNextPending = useCallback(async (targetContextKey: string, targetUserId: string) => {
    try {
      while (mountedRef.current) {
        const recordings = await pendingService.list(targetContextKey, targetUserId);
        if (
          !mountedRef.current
          || contextKeyRef.current !== targetContextKey
          || userIdRef.current !== targetUserId
        ) return;

        const recording = firstPendingTranscription(recordings);
        if (!recording) {
          setPendingRecording(null);
          setErrorMessage(null);
          if (mediaRecorderRef.current?.state !== 'recording') setState('idle');
          return;
        }

        if (recording.status === 'complete' && recording.transcript) {
          const accepted = onTranscriptRef.current(recording.transcript, recording.contextKey);
          if (accepted === false) {
            setPendingRecording(recording);
            setErrorMessage('Recording saved. Open its original entry to add the transcript.');
            setState('error');
            return;
          }
          await pendingService.acknowledge(recording.id, targetUserId);
          continue;
        }

        setPendingRecording(recording);
        setErrorMessage(recording.error ?? 'Recording saved. Transcription pending.');
        setState('error');
        return;
      }
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      const message = error instanceof Error ? error.message : 'Recording storage unavailable.';
      setErrorMessage(message);
      setState('error');
    }
  }, []);

  useEffect(() => {
    void showNextPending(contextKey, userId);
  }, [contextKey, showNextPending, userId]);

  const applyResult = useCallback(async (result: PendingTranscriptionResult) => {
    if (!mountedRef.current) return;
    if (result.contextKey !== contextKeyRef.current) return;
    if (result.status === 'complete') {
      const accepted = onTranscriptRef.current(result.text, result.contextKey);
      if (accepted === false) {
        const recordings = await pendingService.list(result.contextKey, userIdRef.current);
        if (!mountedRef.current || contextKeyRef.current !== result.contextKey) return;
        setPendingRecording(recordings.find((recording) => recording.id === result.id) ?? null);
        setErrorMessage('Recording saved. Open its original entry to add the transcript.');
        setState('error');
        return;
      }
      await pendingService.acknowledge(result.id, userIdRef.current);
      if (!mountedRef.current) return;
      await showNextPending(result.contextKey, userIdRef.current);
      return;
    }
    if (result.status === 'superseded') {
      await showNextPending(contextKeyRef.current, userIdRef.current);
      return;
    }
    await showNextPending(result.contextKey, userIdRef.current);
  }, [showNextPending]);

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
          await applyResult(await pendingService.capture(blob, contextKey, userId));
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
  }, [applyResult, contextKey, userId]);

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
    try {
      await applyResult(await pendingService.retry(pendingRecording.id, userId));
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Could not retry transcription.');
      setState('error');
    }
  }, [applyResult, pendingRecording, userId]);

  const discardPending = useCallback(async () => {
    try {
      if (pendingRecording) await pendingService.discard(pendingRecording.id, userId);
      await showNextPending(contextKey, userId);
    } catch (error: unknown) {
      if (!mountedRef.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Could not discard recording.');
      setState('error');
    }
  }, [contextKey, pendingRecording, showNextPending, userId]);

  return { state, errorMessage, pendingRecording, handlePress, retryPending, discardPending };
}
