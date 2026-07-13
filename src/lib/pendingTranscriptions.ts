export type PendingTranscriptionStatus = 'pending' | 'transcribing' | 'failed' | 'complete';

export interface PendingTranscription {
  id: string;
  contextKey: string;
  blob: Blob;
  status: PendingTranscriptionStatus;
  attempts: number;
  createdAt: number;
  updatedAt: number;
  error?: string;
  transcript?: string;
}

export interface PendingTranscriptionRepository {
  get(id: string): Promise<PendingTranscription | null>;
  list(contextKey: string): Promise<PendingTranscription[]>;
  put(recording: PendingTranscription): Promise<void>;
  delete(id: string): Promise<void>;
}

export type PendingTranscriptionResult =
  | { id: string; contextKey: string; status: 'complete'; text: string }
  | { id: string; contextKey: string; status: 'failed'; error: string }
  | { id: string; contextKey: string; status: 'superseded' };

interface PendingTranscriptionServiceOptions {
  repository: PendingTranscriptionRepository;
  transcribe: (blob: Blob) => Promise<{ text: string }>;
  createId?: () => string;
  now?: () => number;
}

export interface PendingTranscriptionService {
  capture(blob: Blob, contextKey: string): Promise<PendingTranscriptionResult>;
  retry(id: string): Promise<PendingTranscriptionResult>;
  discard(id: string): Promise<void>;
  acknowledge(id: string): Promise<void>;
  list(contextKey: string): Promise<PendingTranscription[]>;
}

const SAVED_FAILURE_MESSAGE = 'Transcription unavailable. Recording saved.';

export function createPendingTranscriptionService({
  repository,
  transcribe,
  createId = () => crypto.randomUUID(),
  now = () => Date.now(),
}: PendingTranscriptionServiceOptions): PendingTranscriptionService {
  const latestByContext = new Map<string, string>();

  const attempt = async (recording: PendingTranscription): Promise<PendingTranscriptionResult> => {
    const transcribing: PendingTranscription = {
      ...recording,
      status: 'transcribing',
      attempts: recording.attempts + 1,
      updatedAt: now(),
      error: undefined,
    };
    await repository.put(transcribing);

    try {
      const response = await transcribe(transcribing.blob);
      if (latestByContext.get(transcribing.contextKey) !== transcribing.id) {
        await repository.delete(transcribing.id);
        return { id: transcribing.id, contextKey: transcribing.contextKey, status: 'superseded' };
      }

      const text = response.text.trim();
      if (!text) throw new Error('empty transcript');
      await repository.put({
        ...transcribing,
        status: 'complete',
        transcript: text,
        updatedAt: now(),
      });
      return { id: transcribing.id, contextKey: transcribing.contextKey, status: 'complete', text };
    } catch {
      const failed: PendingTranscription = {
        ...transcribing,
        status: 'failed',
        updatedAt: now(),
        error: SAVED_FAILURE_MESSAGE,
      };
      await repository.put(failed);
      return { id: failed.id, contextKey: failed.contextKey, status: 'failed', error: SAVED_FAILURE_MESSAGE };
    }
  };

  return {
    async capture(blob, contextKey) {
      const timestamp = now();
      const recording: PendingTranscription = {
        id: createId(),
        contextKey,
        blob,
        status: 'pending',
        attempts: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      latestByContext.set(contextKey, recording.id);
      await repository.put(recording);
      return attempt(recording);
    },

    async retry(id) {
      const recording = await repository.get(id);
      if (!recording) return { id, contextKey: 'unknown', status: 'failed', error: 'Saved recording not found.' };
      latestByContext.set(recording.contextKey, recording.id);
      return attempt(recording);
    },

    discard(id) {
      return repository.delete(id);
    },

    acknowledge(id) {
      return repository.delete(id);
    },

    list(contextKey) {
      return repository.list(contextKey);
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
    return await operation(transaction.objectStore(STORE_NAME));
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

    list(contextKey) {
      return withStore('readonly', async (store) => {
        const rows = await requestResult(store.getAll() as IDBRequest<PendingTranscription[]>);
        return rows
          .filter((row) => row.contextKey === contextKey)
          .sort((a, b) => a.createdAt - b.createdAt);
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
  };
}
