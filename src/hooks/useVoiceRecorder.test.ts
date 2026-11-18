import { describe, expect, it, vi } from 'vitest';
import { discardDraftsForUser, recoverInterruptedRecordings, type VoiceNoteDraft } from './useVoiceRecorder';

/* An in-memory stand-in for the device store: the hand-over rules are what is
   tested here; the store itself is tested where it is owned (mandalacodes). */
function fakeStore(drafts: Array<VoiceNoteDraft & { audio: string }>) {
  const rows = new Map(drafts.map((draft) => [draft.id, draft]));
  return {
    rows,
    listDrafts: async () => [...rows.values()],
    listChunks: async (id: string) => {
      const row = rows.get(id);
      return row ? [{ key: `${id}:0`, segmentId: id, index: 0, blob: new Blob([row.audio]) }] : [];
    },
    discard: async (id: string) => { rows.delete(id); },
  };
}

const NOW = Date.parse('2026-11-04T12:00:00Z');
const draft = (id: string, overrides: Partial<VoiceNoteDraft & { audio: string }> = {}) => ({
  id, mimeType: 'audio/webm', byteSize: 0, durationMs: 0,
  userId: 'u1', contextKey: 'journal:1', startedAt: '2026-11-04T11:00:00Z',
  audio: 'x'.repeat(200), ...overrides,
});
const done = (id: string) => ({ id, status: 'complete' as const, text: 'note', contextKey: 'journal:1' });

describe('handing over interrupted recordings', () => {
  it('sends this person and entry\'s interrupted recording to the queue, then removes the draft', async () => {
    const store = fakeStore([draft('a')]);
    const capture = vi.fn(async (_blob: Blob, _key: string, _owner: string) => done('a'));
    const results = await recoverInterruptedRecordings(store, 'u1', 'journal:1', capture as never, { now: NOW });
    expect(capture).toHaveBeenCalledOnce();
    expect(capture.mock.calls[0][1]).toBe('journal:1');
    expect(results).toHaveLength(1);
    expect(store.rows.size).toBe(0);
  });

  it('leaves another person\'s and another entry\'s recordings alone', async () => {
    const store = fakeStore([draft('other-user', { userId: 'u2' }), draft('other-entry', { contextKey: 'journal:2' })]);
    const capture = vi.fn();
    await recoverInterruptedRecordings(store, 'u1', 'journal:1', capture as never, { now: NOW });
    expect(capture).not.toHaveBeenCalled();
    expect([...store.rows.keys()]).toEqual(['other-user', 'other-entry']);
  });

  it('keeps the draft when the queue cannot take it, so the next visit tries again', async () => {
    const store = fakeStore([draft('a')]);
    const capture = vi.fn(async () => { throw new Error('storage unavailable'); });
    await expect(recoverInterruptedRecordings(store, 'u1', 'journal:1', capture as never, { now: NOW })).rejects.toThrow();
    expect(store.rows.has('a')).toBe(true);
  });

  it('removes drafts older than a week, and drafts with no usable audio, without sending them', async () => {
    const store = fakeStore([draft('old', { startedAt: '2026-10-01T00:00:00Z', userId: 'u2' }), draft('empty', { audio: 'x' })]);
    const capture = vi.fn();
    await recoverInterruptedRecordings(store, 'u1', 'journal:1', capture as never, { now: NOW });
    expect(capture).not.toHaveBeenCalled();
    expect(store.rows.size).toBe(0);
  });

  it('removes every interrupted recording of someone who signed out, and only theirs', async () => {
    const store = fakeStore([draft('mine'), draft('theirs', { userId: 'u2' })]);
    await discardDraftsForUser(store, 'u2');
    expect([...store.rows.keys()]).toEqual(['mine']);
  });
});

describe('acknowledging a durable transcript', () => {
  it('waits for attachment before clearing the original pending recording', async () => {
    const { acknowledgeVoiceTranscript } = await import('./useVoiceRecorder');
    let finish!: () => void;
    const attached = new Promise<void>(resolve => { finish = resolve; });
    const save = vi.fn(() => attached);
    const acknowledge = vi.fn(async () => {});
    const applying = acknowledgeVoiceTranscript(done('a'), 'u1', save, () => true, acknowledge);
    expect(acknowledge).not.toHaveBeenCalled();
    finish();
    await expect(applying).resolves.toBe('accepted');
    expect(acknowledge).toHaveBeenCalledExactlyOnceWith('a', 'u1');
  });

  it('keeps the original pending recording if the person changes during attachment', async () => {
    const { acknowledgeVoiceTranscript } = await import('./useVoiceRecorder');
    let finish!: () => void;
    let activeUser = 'u1';
    const save = () => new Promise<void>(resolve => { finish = resolve; });
    const acknowledge = vi.fn(async () => {});
    const applying = acknowledgeVoiceTranscript(done('a'), 'u1', save, () => activeUser === 'u1', acknowledge);
    activeUser = 'u2';
    finish();
    await expect(applying).resolves.toBe('superseded');
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it('preserves pending audio when the durable attachment fails', async () => {
    const { acknowledgeVoiceTranscript } = await import('./useVoiceRecorder');
    const acknowledge = vi.fn(async () => {});
    await expect(acknowledgeVoiceTranscript(done('a'), 'u1', async () => { throw new Error('offline'); }, () => true, acknowledge)).rejects.toThrow('offline');
    expect(acknowledge).not.toHaveBeenCalled();
  });
});
