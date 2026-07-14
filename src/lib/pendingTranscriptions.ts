export type PendingTranscriptionStatus = 'pending' | 'transcribing' | 'failed' | 'complete';

export interface PendingTranscription {
  id: string;
  contextKey: string;
  userId: string;
  blob: Blob;
  status: PendingTranscriptionStatus;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  error?: string;
  transcript?: string;
  serverRecordingId?: string;
}

export interface PendingTranscriptionRepository {
  get(id: string): Promise<PendingTranscription | null>;
  list(contextKey: string, userId: string): Promise<PendingTranscription[]>;
  listForUser(userId: string): Promise<PendingTranscription[]>;
  put(recording: PendingTranscription): Promise<void>;
  delete(id: string): Promise<void>;
  deleteExpired(now: number): Promise<void>;
  deleteForUser(userId: string): Promise<void>;
}

export type PendingTranscriptionResult =
  | { id: string; contextKey: string; status: 'complete'; text: string }
  | { id: string; contextKey: string; status: 'failed'; error: string }
  | { id: string; contextKey: string; status: 'superseded' };

interface PendingTranscriptionServiceOptions {
  repository: PendingTranscriptionRepository;
  transcribe: (blob: Blob) => Promise<{ text: string; recording_id?: string }>;
  retryTranscription?: (recordingId: string) => Promise<{ text: string; recording_id?: string }>;
  discardTranscription?: (recordingId: string) => Promise<unknown>;
  createId?: () => string;
  now?: () => number;
  retentionMs?: number;
}

export interface PendingTranscriptionService {
  capture(blob: Blob, contextKey: string, userId: string): Promise<PendingTranscriptionResult>;
  retry(id: string, userId: string): Promise<PendingTranscriptionResult>;
  discard(id: string, userId: string): Promise<void>;
  acknowledge(id: string, userId: string): Promise<void>;
  list(contextKey: string, userId: string): Promise<PendingTranscription[]>;
  purgeUser(userId: string): Promise<void>;
}

const SAVED_FAILURE_MESSAGE = 'Transcription unavailable. Recording saved.';
const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

function serverRecordingIdFromError(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('data' in error)) return undefined;
  const data = error.data;
  if (!data || typeof data !== 'object' || !('recording_id' in data)) return undefined;
  return typeof data.recording_id === 'string' ? data.recording_id : undefined;
}

export function firstPendingTranscription(
  recordings: PendingTranscription[],
): PendingTranscription | undefined {
  return recordings.reduce<PendingTranscription | undefined>(
    (oldest, recording) => !oldest || recording.createdAt < oldest.createdAt ? recording : oldest,
    undefined,
  );
}

export function createPendingTranscriptionService({
  repository,
  transcribe,
  retryTranscription,
  discardTranscription,
  createId = () => crypto.randomUUID(),
  now = () => Date.now(),
  retentionMs = DEFAULT_RETENTION_MS,
}: PendingTranscriptionServiceOptions): PendingTranscriptionService {
  const latestAttemptByContext = new Map<string, number>();
  const userGeneration = new Map<string, number>();
  let nextAttempt = 0;

  const discardServerCopy = async (recordingId: string | undefined) => {
    if (!recordingId || !discardTranscription) return;
    try {
      await discardTranscription(recordingId);
    } catch {
      // Server-side retention remains the final cleanup backstop.
    }
  };

  const attempt = async (
    recording: PendingTranscription,
    generation = userGeneration.get(recording.userId) ?? 0,
  ): Promise<PendingTranscriptionResult> => {
    if ((userGeneration.get(recording.userId) ?? 0) !== generation) {
      await repository.delete(recording.id);
      return { id: recording.id, contextKey: recording.contextKey, status: 'superseded' };
    }
    const attemptNumber = ++nextAttempt;
    latestAttemptByContext.set(recording.contextKey, attemptNumber);
    const transcribing: PendingTranscription = {
      ...recording,
      status: 'transcribing',
      attempts: recording.attempts + 1,
      updatedAt: now(),
      error: undefined,
    };
    await repository.put(transcribing);

    try {
      const response = transcribing.serverRecordingId && retryTranscription
        ? await retryTranscription(transcribing.serverRecordingId)
        : await transcribe(transcribing.blob);
      if (
        latestAttemptByContext.get(transcribing.contextKey) !== attemptNumber
        || (userGeneration.get(transcribing.userId) ?? 0) !== generation
      ) {
        await discardServerCopy(response.recording_id ?? transcribing.serverRecordingId);
        await repository.delete(transcribing.id);
        return { id: transcribing.id, contextKey: transcribing.contextKey, status: 'superseded' };
      }

      const text = response.text.trim();
      if (!text) throw new Error('empty transcript');
      await repository.put({
        ...transcribing,
        status: 'complete',
        transcript: text,
        serverRecordingId: response.recording_id ?? transcribing.serverRecordingId,
        updatedAt: now(),
      });
      return { id: transcribing.id, contextKey: transcribing.contextKey, status: 'complete', text };
    } catch (error: unknown) {
      if (
        latestAttemptByContext.get(transcribing.contextKey) !== attemptNumber
        || (userGeneration.get(transcribing.userId) ?? 0) !== generation
      ) {
        await discardServerCopy(serverRecordingIdFromError(error) ?? transcribing.serverRecordingId);
        await repository.delete(transcribing.id);
        return { id: transcribing.id, contextKey: transcribing.contextKey, status: 'superseded' };
      }
      const failed: PendingTranscription = {
        ...transcribing,
        status: 'failed',
        updatedAt: now(),
        error: SAVED_FAILURE_MESSAGE,
        serverRecordingId: serverRecordingIdFromError(error) ?? transcribing.serverRecordingId,
      };
      await repository.put(failed);
      return { id: failed.id, contextKey: failed.contextKey, status: 'failed', error: SAVED_FAILURE_MESSAGE };
    }
  };

  return {
    async capture(blob, contextKey, userId) {
      const timestamp = now();
      const generation = userGeneration.get(userId) ?? 0;
      const recording: PendingTranscription = {
        id: createId(),
        contextKey,
        userId,
        blob,
        status: 'pending',
        attempts: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        expiresAt: timestamp + retentionMs,
      };
      await repository.put(recording);
      return attempt(recording, generation);
    },

    async retry(id, userId) {
      await repository.deleteExpired(now());
      const recording = await repository.get(id);
      if (!recording || recording.userId !== userId) {
        return { id, contextKey: 'unknown', status: 'failed', error: 'Saved recording not found.' };
      }
      return attempt(recording);
    },

    async discard(id, userId) {
      const recording = await repository.get(id);
      if (recording?.userId !== userId) return;
      if (recording.serverRecordingId && discardTranscription) {
        await discardTranscription(recording.serverRecordingId);
      }
      await repository.delete(id);
    },

    async acknowledge(id, userId) {
      const recording = await repository.get(id);
      if (recording?.userId !== userId) return;
      if (recording.serverRecordingId && discardTranscription) {
        await discardTranscription(recording.serverRecordingId);
      }
      await repository.delete(id);
    },

    async list(contextKey, userId) {
      await repository.deleteExpired(now());
      return repository.list(contextKey, userId);
    },

    async purgeUser(userId) {
      userGeneration.set(userId, (userGeneration.get(userId) ?? 0) + 1);
      const recordings = await repository.listForUser(userId);
      await Promise.all(recordings.map((recording) => discardServerCopy(recording.serverRecordingId)));
      await repository.deleteForUser(userId);
    },
  };
}

export function createResilientPendingTranscriptionRepository(
  persistent: PendingTranscriptionRepository,
): PendingTranscriptionRepository {
  const volatile = new Map<string, PendingTranscription>();
  const tombstones = new Set<string>();

  return {
    async get(id) {
      if (tombstones.has(id)) return null;
      const volatileRow = volatile.get(id);
      if (volatileRow) return volatileRow;
      try {
        return await persistent.get(id);
      } catch {
        return null;
      }
    },

    async list(contextKey, userId) {
      let persisted: PendingTranscription[] = [];
      try {
        persisted = await persistent.list(contextKey, userId);
      } catch {
        // Volatile rows remain available while persistent storage is unavailable.
      }
      const merged = new Map(persisted.filter((row) => !tombstones.has(row.id)).map((row) => [row.id, row]));
      for (const row of volatile.values()) {
        if (row.contextKey === contextKey && row.userId === userId) merged.set(row.id, row);
      }
      return [...merged.values()].sort((a, b) => a.createdAt - b.createdAt);
    },

    async listForUser(userId) {
      let persisted: PendingTranscription[] = [];
      try {
        persisted = await persistent.listForUser(userId);
      } catch {
        // Volatile rows remain available while persistent storage is unavailable.
      }
      const merged = new Map(persisted.filter((row) => !tombstones.has(row.id)).map((row) => [row.id, row]));
      for (const row of volatile.values()) {
        if (row.userId === userId) merged.set(row.id, row);
      }
      return [...merged.values()].sort((a, b) => a.createdAt - b.createdAt);
    },

    async put(recording) {
      try {
        await persistent.put(recording);
        volatile.delete(recording.id);
        tombstones.delete(recording.id);
      } catch {
        volatile.set(recording.id, recording);
      }
    },

    async delete(id) {
      volatile.delete(id);
      tombstones.add(id);
      try {
        await persistent.delete(id);
        tombstones.delete(id);
      } catch {
        // Hide a stale persistent copy for the lifetime of this page.
      }
    },

    async deleteExpired(timestamp) {
      for (const [id, row] of volatile) if (row.expiresAt <= timestamp) volatile.delete(id);
      try {
        await persistent.deleteExpired(timestamp);
      } catch {
        // Volatile retention still applies when persistent storage is unavailable.
      }
    },

    async deleteForUser(userId) {
      for (const [id, row] of volatile) if (row.userId === userId) volatile.delete(id);
      try {
        await persistent.deleteForUser(userId);
      } catch {
        // Volatile user data is still isolated and removed immediately.
      }
    },
  };
}

const DATABASE_NAME = 'teajia-capture';
const DATABASE_VERSION = 1;
const STORE_NAME = 'pending-transcriptions';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Recording storage request failed.'));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Recording storage is unavailable.'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const completed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('Recording storage transaction failed.'));
      transaction.onabort = () => reject(transaction.error ?? new Error('Recording storage transaction aborted.'));
    });
    try {
      const result = await operation(transaction.objectStore(STORE_NAME));
      await completed;
      return result;
    } catch (error) {
      try {
        transaction.abort();
      } catch {
        // The transaction may already have aborted or completed.
      }
      await completed.catch(() => undefined);
      throw error;
    }
  } finally {
    database.close();
  }
}

export function createIndexedDbPendingTranscriptionRepository(): PendingTranscriptionRepository {
  return {
    get(id) {
      return withStore('readonly', async (store) => {
        const row = await requestResult(store.get(id) as IDBRequest<PendingTranscription | undefined>);
        return row ?? null;
      });
    },

    list(contextKey, userId) {
      return withStore('readonly', async (store) => {
        const rows = await requestResult(store.getAll() as IDBRequest<PendingTranscription[]>);
        return rows
          .filter((row) => row.contextKey === contextKey && row.userId === userId)
          .sort((a, b) => a.createdAt - b.createdAt);
      });
    },

    listForUser(userId) {
      return withStore('readonly', async (store) => {
        const rows = await requestResult(store.getAll() as IDBRequest<PendingTranscription[]>);
        return rows.filter((row) => row.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
      });
    },

    put(recording) {
      return withStore('readwrite', async (store) => {
        await requestResult(store.put(recording));
      });
    },

    delete(id) {
      return withStore('readwrite', async (store) => {
        await requestResult(store.delete(id));
      });
    },

    deleteExpired(timestamp) {
      return withStore('readwrite', async (store) => {
        const rows = await requestResult(store.getAll() as IDBRequest<PendingTranscription[]>);
        await Promise.all(rows
          .filter((row) => row.expiresAt == null || row.expiresAt <= timestamp)
          .map((row) => requestResult(store.delete(row.id))));
      });
    },

    deleteForUser(userId) {
      return withStore('readwrite', async (store) => {
        const rows = await requestResult(store.getAll() as IDBRequest<PendingTranscription[]>);
        await Promise.all(rows.filter((row) => row.userId === userId).map((row) => requestResult(store.delete(row.id))));
      });
    },
  };
}
