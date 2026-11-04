// Shared module "voice-audio-drafts", owned by mandalacodes (shared/voice/audio-drafts.ts). Do not edit this copy: change it there, then run modules-sync.
/**
 * Saves a recording on the device while it is still being made, so a closed
 * tab, a crash or a dead battery loses at most the last second of audio.
 *
 * MediaRecorder hands over a chunk every second or so; each chunk is written
 * to IndexedDB as it arrives, under a draft that records the format, size and
 * length so far. Stopping joins the chunks into one Blob. A draft still on the
 * device when the page next opens is a recording that was interrupted, and can
 * be finished the same way.
 *
 * A project may name a `finished` store: finishing a draft then moves the
 * recording into it in the same transaction, so it is never in neither place.
 *
 * Owned here (mandalacodes) and copied one way into the other projects by
 * modules-sync; see i64os/substrate/directions/shared-modules.md.
 */

export interface AudioDraft {
  id: string;
  mimeType: string;
  byteSize: number;
  durationMs: number;
}

export interface AudioChunk { key: string; segmentId: string; index: number; blob: Blob; }

export interface AudioDraftStoreOptions {
  database: string;
  version: number;
  /** A store finished recordings move into, keyed by id, with optional indexes (name to key path). */
  finished?: { name: string; indexes?: Record<string, string> };
  /** Used in error messages, e.g. "Reflection". */
  label?: string;
}

const DRAFTS = 'drafts';
const CHUNKS = 'chunks';

export function createAudioDraftStore<D extends AudioDraft>(options: AudioDraftStoreOptions) {
  const label = options.label ?? 'Recording';
  const finishedName = options.finished?.name;

  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(options.database, options.version);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (options.finished && !database.objectStoreNames.contains(options.finished.name)) {
          const store = database.createObjectStore(options.finished.name, { keyPath: 'id' });
          for (const [index, keyPath] of Object.entries(options.finished.indexes ?? {})) store.createIndex(index, keyPath);
        }
        if (!database.objectStoreNames.contains(DRAFTS)) database.createObjectStore(DRAFTS, { keyPath: 'id' });
        if (!database.objectStoreNames.contains(CHUNKS)) {
          const chunks = database.createObjectStore(CHUNKS, { keyPath: 'key' });
          chunks.createIndex('segmentId', 'segmentId');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error(`Unable to open ${label.toLowerCase()} storage`));
    });
  }

  async function transact<T>(
    names: string[],
    mode: IDBTransactionMode,
    run: (stores: Record<string, IDBObjectStore>, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
  ): Promise<T> {
    const database = await open();
    return new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(names, mode);
      let result: T;
      let hasResult = false;
      const succeed = (value: T) => { result = value; hasResult = true; };
      const fail = (reason?: unknown) => {
        database.close();
        reject(reason ?? transaction.error ?? new Error(`${label} storage transaction failed`));
      };
      transaction.onerror = fail;
      transaction.onabort = fail;
      const stores = Object.fromEntries(names.map((name) => [name, transaction.objectStore(name)]));
      try { run(stores, succeed, fail); } catch (error) { fail(error); }
      transaction.oncomplete = () => {
        database.close();
        if (hasResult) resolve(result);
        else reject(new Error(`${label} storage transaction completed without a result`));
      };
    });
  }

  function requireFinished(): string {
    if (!finishedName) throw new Error(`${label} storage has no finished store`);
    return finishedName;
  }

  return {
    /** Start a draft before the first chunk arrives. */
    begin(draft: D): Promise<void> {
      return transact([DRAFTS], 'readwrite', (stores, resolve, reject) => {
        const request = stores[DRAFTS].put(draft);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    /** Write one chunk and grow the draft's size and length to match. */
    append(id: string, index: number, blob: Blob, durationMs: number): Promise<void> {
      return transact([DRAFTS, CHUNKS], 'readwrite', (stores, resolve, reject) => {
        const request = stores[DRAFTS].get(id);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const draft = request.result as D | undefined;
          if (!draft) return reject(new Error(`${label} draft not found`));
          const chunk: AudioChunk = { key: `${id}:${String(index).padStart(8, '0')}`, segmentId: id, index, blob };
          stores[CHUNKS].put(chunk);
          stores[DRAFTS].put({ ...draft, byteSize: draft.byteSize + blob.size, durationMs: Math.max(draft.durationMs, Math.round(durationMs)) });
          resolve();
        };
      });
    },

    listDrafts(): Promise<D[]> {
      return transact([DRAFTS], 'readonly', (stores, resolve, reject) => {
        const request = stores[DRAFTS].getAll();
        request.onsuccess = () => resolve(request.result as D[]);
        request.onerror = () => reject(request.error);
      });
    },

    listChunks(id: string): Promise<AudioChunk[]> {
      return transact([CHUNKS], 'readonly', (stores, resolve, reject) => {
        const request = stores[CHUNKS].index('segmentId').getAll(id);
        request.onsuccess = () => resolve((request.result as AudioChunk[]).sort((a, b) => a.index - b.index));
        request.onerror = () => reject(request.error);
      });
    },

    /**
     * Join a draft's chunks into one recording and remove the draft. With a
     * finished store, the recording is put there in the same transaction.
     */
    finalize(id: string): Promise<D & { blob: Blob }> {
      const names = finishedName ? [finishedName, DRAFTS, CHUNKS] : [DRAFTS, CHUNKS];
      return transact(names, 'readwrite', (stores, resolve, reject) => {
        const draftRequest = stores[DRAFTS].get(id);
        const chunksRequest = stores[CHUNKS].index('segmentId').getAll(id);
        const finish = () => {
          if (draftRequest.readyState !== 'done' || chunksRequest.readyState !== 'done') return;
          const draft = draftRequest.result as D | undefined;
          if (!draft) return reject(new Error(`${label} draft not found`));
          const chunks = (chunksRequest.result as AudioChunk[]).sort((a, b) => a.index - b.index);
          if (!chunks.length) return reject(new Error(`${label} draft has no audio chunks`));
          const blob = new Blob(chunks.map((chunk) => chunk.blob), { type: draft.mimeType });
          const recording = { ...draft, durationMs: Math.max(1, draft.durationMs), byteSize: blob.size, blob };
          if (finishedName) stores[finishedName].put(recording);
          stores[DRAFTS].delete(id);
          chunks.forEach((chunk) => stores[CHUNKS].delete(chunk.key));
          resolve(recording);
        };
        draftRequest.onsuccess = finish;
        chunksRequest.onsuccess = finish;
        draftRequest.onerror = () => reject(draftRequest.error);
        chunksRequest.onerror = () => reject(chunksRequest.error);
      });
    },

    /** Remove a draft and its chunks without keeping the audio. */
    discard(id: string): Promise<void> {
      return transact([DRAFTS, CHUNKS], 'readwrite', (stores, resolve, reject) => {
        const chunksRequest = stores[CHUNKS].index('segmentId').getAllKeys(id);
        chunksRequest.onerror = () => reject(chunksRequest.error);
        chunksRequest.onsuccess = () => {
          (chunksRequest.result as IDBValidKey[]).forEach((key) => stores[CHUNKS].delete(key));
          stores[DRAFTS].delete(id);
          resolve();
        };
      });
    },

    /** Put a finished recording directly (finished store only). */
    putFinished(value: D & { blob: Blob }): Promise<void> {
      const name = requireFinished();
      return transact([name], 'readwrite', (stores, resolve, reject) => {
        const request = stores[name].put(value);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    /** Finished recordings, in the order of the named index when given. */
    listFinished(index?: string): Promise<Array<D & { blob: Blob }>> {
      const name = requireFinished();
      return transact([name], 'readonly', (stores, resolve, reject) => {
        const request = index ? stores[name].index(index).getAll() : stores[name].getAll();
        request.onsuccess = () => resolve(request.result as Array<D & { blob: Blob }>);
        request.onerror = () => reject(request.error);
      });
    },

    removeFinished(id: string): Promise<void> {
      const name = requireFinished();
      return transact([name], 'readwrite', (stores, resolve, reject) => {
        const request = stores[name].delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    },

    /** Empty every store: drafts, chunks and finished recordings. */
    clear(): Promise<void> {
      const names = finishedName ? [finishedName, DRAFTS, CHUNKS] : [DRAFTS, CHUNKS];
      return transact(names, 'readwrite', (stores, resolve) => {
        names.forEach((name) => stores[name].clear());
        resolve();
      });
    },
  };
}

export type AudioDraftStore<D extends AudioDraft> = ReturnType<typeof createAudioDraftStore<D>>;
