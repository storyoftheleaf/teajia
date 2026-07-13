import { describe, expect, it, vi } from 'vitest';
import {
  createPendingTranscriptionService,
  type PendingTranscription,
  type PendingTranscriptionRepository,
} from './pendingTranscriptions';

function memoryRepository(): PendingTranscriptionRepository {
  const rows = new Map<string, PendingTranscription>();
  return {
    async get(id) { return rows.get(id) ?? null; },
    async list(contextKey) {
      return [...rows.values()].filter((row) => row.contextKey === contextKey);
    },
    async put(row) { rows.set(row.id, row); },
    async delete(id) { rows.delete(id); },
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

    const result = await service.capture(new Blob(['audio']), 'curate:entry-1');

    expect(observed[0]?.status).toBe('transcribing');
    expect(result).toEqual({ id: 'recording-1', contextKey: 'curate:entry-1', status: 'complete', text: 'Wuyi Rou Gui' });
    expect(await repository.get('recording-1')).toMatchObject({
      status: 'complete',
      transcript: 'Wuyi Rou Gui',
    });
    await service.acknowledge('recording-1');
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

    const failed = await service.capture(blob, 'curate:entry-2');
    const retained = await repository.get('recording-2');

    expect(failed).toMatchObject({ id: 'recording-2', status: 'failed' });
    expect(retained?.blob).toBe(blob);
    expect(retained?.attempts).toBe(1);

    const retried = await service.retry('recording-2');
    expect(transcribe).toHaveBeenNthCalledWith(2, blob);
    expect(retried).toEqual({ id: 'recording-2', contextKey: 'curate:entry-2', status: 'complete', text: 'retry transcript' });
    expect(await repository.get('recording-2')).toMatchObject({ status: 'complete', transcript: 'retry transcript' });
    await service.acknowledge('recording-2');
    expect(await repository.get('recording-2')).toBeNull();
  });

  it('restores failed recordings by context and discards only on explicit request', async () => {
    const repository = memoryRepository();
    const service = createPendingTranscriptionService({
      repository,
      createId: () => 'recording-3',
      transcribe: async () => { throw new Error('offline'); },
    });

    await service.capture(new Blob(['audio']), 'curate:entry-3');
    expect(await service.list('curate:entry-3')).toHaveLength(1);

    await service.discard('recording-3');
    expect(await service.list('curate:entry-3')).toEqual([]);
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

    const older = service.capture(new Blob(['old']), 'curate:same-entry');
    const newer = await service.capture(new Blob(['new']), 'curate:same-entry');
    resolveFirst?.({ text: 'old result' });

    expect(newer).toMatchObject({ status: 'complete', text: 'new result' });
    await expect(older).resolves.toEqual({ id: 'recording-1', status: 'superseded' });
  });
});
