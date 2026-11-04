import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAppStore } from '../lib/store';
import {
  createResilientPendingTranscriptionRepository,
  createIndexedDbPendingTranscriptionRepository,
  createPendingTranscriptionService,
  firstPendingTranscription,
  type PendingTranscription,
  type PendingTranscriptionResult,
} from '../lib/pendingTranscriptions';
import { chooseRecorderMimeType } from '../../shared/voice/microphone';
import { createAudioDraftStore, type AudioDraft, type AudioDraftStore } from '../../shared/voice/audio-drafts';

export type RecorderState = 'idle' | 'recording' | 'transcribing' | 'error';

/* Teajia's transcription has always received webm first, so it keeps its own
   order; the choosing is the shared microphone module. */
const TEAJIA_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/wav'];

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return 'audio/mp4';
  return chooseRecorderMimeType((type) => MediaRecorder.isTypeSupported(type), TEAJIA_MIME_TYPES) ?? 'audio/mp4';
}

/* Every chunk of a recording is also saved on the device as it arrives (the
   shared audio-drafts module), so a tab closed or a phone that dies mid-note
   leaves the audio behind. Memory stays the main path; the draft is the
   backup, removed once the recording is safely in the transcription queue. */
export interface VoiceNoteDraft extends AudioDraft {
  userId: string;
  contextKey: string;
  startedAt: string;
}

const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_RECORDING_BYTES = 100;

const voiceDrafts = createAudioDraftStore<VoiceNoteDraft>({ database: 'teajia-voice-drafts', version: 1, label: 'Voice note' });

type CaptureRecording = (blob: Blob, contextKey: string, userId: string) => Promise<PendingTranscriptionResult>;
type DraftStore = Pick<AudioDraftStore<VoiceNoteDraft>, 'listDrafts' | 'listChunks' | 'discard'>;

/* A recording in progress is held: in this page by the set, and across tabs
   by a Web Lock where the browser has them. Handing over only takes a draft
   nobody holds, so an unfinished recording is never sent half-way, and two
   recorders never send the same interrupted one twice. */
const heldDrafts = new Set<string>();
const draftLock = (id: string) => `teajia-voice-draft:${id}`;

function holdDraft(id: string): () => void {
  heldDrafts.add(id);
  let released = false;
  let unlock: () => void = () => undefined;
  if (typeof navigator !== 'undefined' && navigator.locks) {
    void navigator.locks.request(draftLock(id), () => (released
      ? Promise.resolve()
      : new Promise<void>((resolve) => { unlock = resolve; }))).catch(() => undefined);
  }
  return () => { released = true; heldDrafts.delete(id); unlock(); };
}

async function withFreeDraft(id: string, run: () => Promise<void>): Promise<void> {
  if (heldDrafts.has(id)) return;
  if (typeof navigator !== 'undefined' && navigator.locks) {
    await navigator.locks.request(draftLock(id), { ifAvailable: true }, async (lock) => {
      if (lock && !heldDrafts.has(id)) await run();
    });
    return;
  }
  await run();
}

/**
 * Hands each interrupted recording for this person and entry to the
 * transcription queue, then removes its draft. A draft is removed only after
 * the queue has it, so a failure leaves it for the next try. Drafts older than
 * the queue keeps recordings, or with no usable audio, are removed.
 */
export async function recoverInterruptedRecordings(
  store: DraftStore,
  userId: string,
  contextKey: string,
  capture: CaptureRecording,
  options: { now?: number } = {},
): Promise<PendingTranscriptionResult[]> {
  const now = options.now ?? Date.now();
  const results: PendingTranscriptionResult[] = [];
  for (const draft of await store.listDrafts()) {
    if (heldDrafts.has(draft.id)) continue;
    const expired = now - Date.parse(draft.startedAt) > DRAFT_MAX_AGE_MS;
    if (!expired && (draft.userId !== userId || draft.contextKey !== contextKey)) continue;
    await withFreeDraft(draft.id, async () => {
      heldDrafts.add(draft.id);
      try {
        if (!expired) {
          const chunks = await store.listChunks(draft.id);
          const blob = new Blob(chunks.map((chunk) => chunk.blob), { type: draft.mimeType });
          if (blob.size >= MIN_RECORDING_BYTES) results.push(await capture(blob, draft.contextKey, draft.userId));
        }
        await store.discard(draft.id);
      } finally {
        heldDrafts.delete(draft.id);
      }
    });
  }
  return results;
}

/** Removes every interrupted recording belonging to someone who signed out. */
export async function discardDraftsForUser(store: DraftStore, userId: string): Promise<void> {
  for (const draft of await store.listDrafts()) {
    if (draft.userId === userId) await store.discard(draft.id);
  }
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
    void discardDraftsForUser(voiceDrafts, previousUserId).catch(() => undefined);
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
    let live = true;
    void (async () => {
      try {
        await recoverInterruptedRecordings(
          voiceDrafts,
          userId,
          contextKey,
          (blob, key, owner) => pendingService.capture(blob, key, owner),
        );
      } catch { /* Device storage unavailable: nothing was saved there to recover. */ }
      if (live) await showNextPending(contextKey, userId);
    })();
    return () => { live = false; };
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

      /* The device copy is best effort: if storage is unavailable the
         recording carries on in memory exactly as before. */
      const draftId = crypto.randomUUID();
      const startedAt = performance.now();
      let draftWrites: Promise<boolean> = voiceDrafts
        .begin({ id: draftId, mimeType, byteSize: 0, durationMs: 0, userId, contextKey, startedAt: new Date().toISOString() })
        .then(() => true, () => false);
      const releaseDraft = holdDraft(draftId);
      let chunkIndex = 0;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          const index = chunkIndex++;
          const data = e.data;
          draftWrites = draftWrites.then((saving) => saving
            ? voiceDrafts.append(draftId, index, data, performance.now() - startedAt).then(() => true, () => false)
            : false);
        }
      };
      const discardDraft = () => {
        void draftWrites
          .then((saving) => (saving ? voiceDrafts.discard(draftId) : undefined))
          .catch(() => undefined)
          .finally(releaseDraft);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size < MIN_RECORDING_BYTES) { discardDraft(); setState('idle'); return; }
        setState('transcribing');
        try {
          const result = await pendingService.capture(blob, contextKey, userId);
          discardDraft();
          await applyResult(result);
        } catch (err: unknown) {
          /* The device copy stays: the next visit to this entry hands it over. */
          void draftWrites.finally(releaseDraft);
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
