import { describe, expect, it, vi } from 'vitest';
import {
  createResilientPendingTranscriptionRepository,
  createPendingTranscriptionService,
  firstPendingTranscription,
  type PendingTranscription,
  type PendingTranscriptionRepository,
} from './pendingTranscriptions';

function memoryRepository(): PendingTranscriptionRepository {
  const rows = new Map<string, PendingTranscription>();
  return {
    async get(id) { return rows.get(id) ?? null; },
    async list(contextKey, userId) {
      return [...rows.values()].filter((row) => row.contextKey === contextKey && row.userId === userId);
    },
    async listForUser(userId) {
      return [...rows.values()].filter((row) => row.userId === userId);
    },
    async put(row) { rows.set(row.id, row); },
    async delete(id) { rows.delete(id); },
    async deleteExpired(now) {
      for (const [id, row] of rows) if (row.expiresAt <= now) rows.delete(id);
    },
    async deleteForUser(userId) {
      for (const [id, row] of rows) if (row.userId === userId) rows.delete(id);
    },
  };
}

describe('pending transcription service', () => {
  it('persists the recording before transcription and keeps the transcript until acknowledged', async () => {
    const repository = memoryRepository();
    const observed: Array<PendingTranscription | null> = [];
    const service = createPendingTranscriptionService({
      repository,
      createId: () => 'recording-1',
      transcribe: async (blob) => {
        observed.push(await repository.get('recording-1'));
        expect(blob.size).toBe(5);
        return { text: '  Wuyi Rou Gui  ' };
      },
    });

    const result = await service.capture(new Blob(['audio']), 'curate:user-1:entry-1', 'user-1');

    expect(observed[0]?.status).toBe('transcribing');
    expect(result).toEqual({ id: 'recording-1', contextKey: 'curate:user-1:entry-1', status: 'complete', text: 'Wuyi Rou Gui' });
    expect(await repository.get('recording-1')).toMatchObject({
      status: 'complete',
      transcript: 'Wuyi Rou Gui',
    });
    await service.acknowledge('recording-1', 'user-1');
    expect(await repository.get('recording-1')).toBeNull();
  });

  it('retains the same blob after provider failure and retries it losslessly', async () => {
    const repository = memoryRepository();
    const transcribe = vi.fn()
      .mockRejectedValueOnce(new Error('provider unavailable'))
      .mockResolvedValueOnce({ text: 'retry transcript' });
    const service = createPendingTranscriptionService({
      repository,
      createId: () => 'recording-2',
      transcribe,
    });
    const blob = new Blob(['irreplaceable audio'], { type: 'audio/webm' });

    const failed = await service.capture(blob, 'curate:user-1:entry-2', 'user-1');
    const retained = await repository.get('recording-2');

    expect(failed).toMatchObject({ id: 'recording-2', status: 'failed' });
    expect(retained?.blob).toBe(blob);
    expect(retained?.attempts).toBe(1);

    const retried = await service.retry('recording-2', 'user-1');
    expect(transcribe).toHaveBeenNthCalledWith(2, blob);
    expect(retried).toEqual({ id: 'recording-2', contextKey: 'curate:user-1:entry-2', status: 'complete', text: 'retry transcript' });
    expect(await repository.get('recording-2')).toMatchObject({ status: 'complete', transcript: 'retry transcript' });
    await service.acknowledge('recording-2', 'user-1');
    expect(await repository.get('recording-2')).toBeNull();
  });

  it('restores failed recordings by context and discards only on explicit request', async () => {
    const repository = memoryRepository();
    const service = createPendingTranscriptionService({
      repository,
      createId: () => 'recording-3',
      transcribe: async () => { throw new Error('offline'); },
    });

    await service.capture(new Blob(['audio']), 'curate:user-1:entry-3', 'user-1');
    expect(await service.list('curate:user-1:entry-3', 'user-1')).toHaveLength(1);

    await service.discard('recording-3', 'user-1');
    expect(await service.list('curate:user-1:entry-3', 'user-1')).toEqual([]);
  });

  it('marks an older overlapping result as superseded', async () => {
    const repository = memoryRepository();
    let resolveFirst: ((value: { text: string }) => void) | undefined;
    const first = new Promise<{ text: string }>((resolve) => { resolveFirst = resolve; });
    const transcribe = vi.fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce({ text: 'new result' });
    let nextId = 0;
    const service = createPendingTranscriptionService({
      repository,
      createId: () => `recording-${++nextId}`,
      transcribe,
    });

    const older = service.capture(new Blob(['old']), 'curate:user-1:same-entry', 'user-1');
    const newer = await service.capture(new Blob(['new']), 'curate:user-1:same-entry', 'user-1');
    resolveFirst?.({ text: 'old result' });

    expect(newer).toMatchObject({ status: 'complete', text: 'new result' });
    await expect(older).resolves.toEqual({ id: 'recording-1', contextKey: 'curate:user-1:same-entry', status: 'superseded' });
  });

  it('supersedes an older provider failure after a newer request completes', async () => {
    const repository = memoryRepository();
    let rejectFirst: ((reason: Error) => void) | undefined;
    const first = new Promise<{ text: string }>((_resolve, reject) => { rejectFirst = reject; });
    const transcribe = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce({ text: 'new result' });
    let nextId = 0;
    const service = createPendingTranscriptionService({
      repository,
      createId: () => `recording-${++nextId}`,
      transcribe,
    });

    const older = service.capture(new Blob(['old']), 'curate:user-1:same-entry', 'user-1');
    await expect(service.capture(new Blob(['new']), 'curate:user-1:same-entry', 'user-1')).resolves.toMatchObject({ status: 'complete' });
    rejectFirst?.(new Error('late provider failure'));

    await expect(older).resolves.toMatchObject({ status: 'superseded' });
    expect(await repository.get('recording-1')).toBeNull();
  });

  it('keeps a volatile recording and retries when persistent storage fails', async () => {
    const persistent = memoryRepository();
    persistent.put = vi.fn().mockRejectedValue(new Error('IndexedDB unavailable'));
    const repository = createResilientPendingTranscriptionRepository(persistent);
    const transcribe = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ text: 'recovered' });
    const service = createPendingTranscriptionService({ repository, createId: () => 'volatile-1', transcribe });
    const blob = new Blob(['irreplaceable audio']);

    await expect(service.capture(blob, 'curate:user-1:entry-1', 'user-1')).resolves.toMatchObject({ status: 'failed' });
    expect((await service.list('curate:user-1:entry-1', 'user-1'))[0]?.blob).toBe(blob);
    await expect(service.retry('volatile-1', 'user-1')).resolves.toMatchObject({ status: 'complete', text: 'recovered' });
  });

  it('retains the private server recording id and uses server retry and discard routes', async () => {
    const repository = memoryRepository();
    const providerFailure = Object.assign(new Error('provider unavailable'), {
      data: { recording_id: 'server-recording-1', retryable: true },
    });
    const transcribe = vi.fn().mockRejectedValue(providerFailure);
    const retryTranscription = vi.fn().mockResolvedValue({
      text: 'recovered privately',
      recording_id: 'server-recording-1',
    });
    const discardTranscription = vi.fn().mockResolvedValue({ ok: true });
    const service = createPendingTranscriptionService({
      repository,
      createId: () => 'local-recording-1',
      transcribe,
      retryTranscription,
      discardTranscription,
    });

    await service.capture(new Blob(['private audio']), 'curate:user-1:entry-1', 'user-1');
    expect(await repository.get('local-recording-1')).toMatchObject({
      status: 'failed',
      serverRecordingId: 'server-recording-1',
    });

    await expect(service.retry('local-recording-1', 'user-1')).resolves.toMatchObject({
      status: 'complete',
      text: 'recovered privately',
    });
    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(retryTranscription).toHaveBeenCalledWith('server-recording-1');

    await service.discard('local-recording-1', 'user-1');
    expect(discardTranscription).toHaveBeenCalledWith('server-recording-1');
    expect(await repository.get('local-recording-1')).toBeNull();
  });

  it('expires old audio and isolates retry, list, and discard by user', async () => {
    const repository = memoryRepository();
    let now = 1_000;
    const service = createPendingTranscriptionService({
      repository,
      createId: () => 'private-1',
      now: () => now,
      retentionMs: 500,
      transcribe: async () => { throw new Error('offline'); },
    });

    await service.capture(new Blob(['private']), 'curate:user-1:entry-1', 'user-1');
    expect(await service.list('curate:user-1:entry-1', 'user-2')).toEqual([]);
    await expect(service.retry('private-1', 'user-2')).resolves.toMatchObject({ status: 'failed' });
    await service.discard('private-1', 'user-2');
    expect(await repository.get('private-1')).not.toBeNull();

    now = 1_501;
    expect(await service.list('curate:user-1:entry-1', 'user-1')).toEqual([]);
    expect(await repository.get('private-1')).toBeNull();
  });

  it('purges every recording for the user on logout', async () => {
    const repository = memoryRepository();
    let nextId = 0;
    const service = createPendingTranscriptionService({
      repository,
      createId: () => `logout-${++nextId}`,
      transcribe: async () => { throw new Error('offline'); },
    });
    await service.capture(new Blob(['one']), 'curate:user-1:entry-1', 'user-1');
    await service.capture(new Blob(['two']), 'curate:user-1:entry-2', 'user-1');

    await service.purgeUser('user-1');

    expect(await service.list('curate:user-1:entry-1', 'user-1')).toEqual([]);
    expect(await service.list('curate:user-1:entry-2', 'user-1')).toEqual([]);
  });

  it('does not resurrect an in-flight recording after its user logs out', async () => {
    const repository = memoryRepository();
    let resolveTranscription: ((value: { text: string }) => void) | undefined;
    const transcription = new Promise<{ text: string }>((resolve) => { resolveTranscription = resolve; });
    const service = createPendingTranscriptionService({
      repository,
      createId: () => 'logout-in-flight',
      transcribe: () => transcription,
    });

    const capture = service.capture(new Blob(['private']), 'curate:user-1:entry-1', 'user-1');
    await service.purgeUser('user-1');
    resolveTranscription?.({ text: 'too late' });

    await expect(capture).resolves.toMatchObject({ status: 'superseded' });
    expect(await repository.get('logout-in-flight')).toBeNull();
  });

  it('returns pending rows in FIFO order so retry and discard can advance the queue', () => {
    const rows = [
      { id: 'new', createdAt: 20 },
      { id: 'old', createdAt: 10 },
    ] as PendingTranscription[];
    expect(firstPendingTranscription(rows)?.id).toBe('old');
  });
});
