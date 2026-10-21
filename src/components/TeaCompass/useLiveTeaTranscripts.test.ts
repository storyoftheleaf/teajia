import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeLiveTeaTranscripts } from './useLiveTeaTranscripts';
import type { ArTeaSourceLink } from '../../lib/api';
import type { StagedArPassage } from './ArTeaSources';

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('./ArTeaSources', () => ({ awaitArJob: mocks.read }));
const source = { id: 'source-one', title: 'Shuixian conversation', hash: 'version-one', text: 'Complete Shuixian conversation, from the beginning to the end.' };
const passage = (overrides = {}): StagedArPassage => ({ requestId: 'first-read', sourceId: source.id, ...source, start: 0, end: source.text.length, mode: 'full', ...overrides });
const link: ArTeaSourceLink = { ...source, id: 'link-one', entryId: 'tea-one', sourceId: source.id, start: 0, end: source.text.length, mode: 'full' };
const listeners = new Set<() => void>();
let visibility: string;
const cleanups: Array<() => void> = [];
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-21T10:00:00Z')); mocks.read.mockReset(); visibility = 'visible'; listeners.clear();
  vi.stubGlobal('window', { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval });
  vi.stubGlobal('document', { get visibilityState() { return visibility; }, addEventListener: (_: string, listener: () => void) => listeners.add(listener), removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) });
  mocks.read.mockResolvedValue({ id: 'current-read', result: { source } });
});
afterEach(() => { cleanups.splice(0).forEach(stop => stop()); vi.unstubAllGlobals(); vi.useRealTimers(); });
function subscribe(initial: { links?: ArTeaSourceLink[]; staged?: StagedArPassage[]; current?: () => boolean; force?: boolean } = {}) {
  const snapshot = { links: initial.links ?? [], staged: initial.staged ?? [], onStage: vi.fn((next: StagedArPassage) => { snapshot.staged = [next]; }) };
  const controller = new AbortController(); const report = vi.fn();
  const stop = subscribeLiveTeaTranscripts({ current: () => snapshot, isCurrent: initial.current ?? (() => true), report, signal: controller.signal, refreshed: new Map(), force: initial.force });
  cleanups.push(() => { controller.abort(); stop(); });
  return { snapshot, report, controller, stop };
}
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('live full transcript subscription', () => {
  it('keeps a freshly staged proof and does not repeatedly stage or trigger AI for unchanged sources', async () => {
    const state = subscribe({ staged: [passage()] });
    expect(mocks.read).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(mocks.read).toHaveBeenCalledTimes(1);
    expect(state.snapshot.onStage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.snapshot.staged[0].requestId).toBe('first-read');
    expect(state.snapshot.onStage).not.toHaveBeenCalled();
  });
  it('reads a saved full link immediately and stages an unsaved fresh proof without canonical writes', async () => {
    const state = subscribe({ links: [link] }); await settle();
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith({ kind: 'read', sourceId: source.id }, state.controller.signal);
    expect(state.snapshot.onStage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ mode: 'full', requestId: 'current-read', text: source.text, start: 0, end: source.text.length }));
    expect(state.snapshot.links).toEqual([link]);
  });
  it('refreshes a changed original in its entirety, including unchanged-hash text changes', async () => {
    const state = subscribe({ staged: [passage()] });
    const revised = { ...source, text: `${source.text}\nA later correction.`, hash: source.hash };
    mocks.read.mockResolvedValueOnce({ id: 'new-read', result: { source: revised } });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.snapshot.onStage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ text: revised.text, end: revised.text.length, requestId: 'new-read' }));
    expect(state.report).toHaveBeenLastCalledWith('current', expect.stringContaining('Original changed'));
  });
  it('retains previous material offline, reports failure and recovers on the next poll', async () => {
    mocks.read.mockRejectedValueOnce(new Error('Computer disconnected'));
    const state = subscribe({ links: [link] }); await settle();
    expect(state.report).toHaveBeenLastCalledWith('offline', expect.stringContaining('Last material remains visible'));
    expect(state.snapshot.links).toEqual([link]); expect(state.snapshot.onStage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.snapshot.onStage).toHaveBeenCalledTimes(1);
  });
  it('does not poll hidden pages and checks when the page becomes visible', async () => {
    visibility = 'hidden'; const state = subscribe({ links: [link] });
    await vi.advanceTimersByTimeAsync(60_000); expect(mocks.read).not.toHaveBeenCalled();
    visibility = 'visible'; listeners.forEach(listener => listener()); await settle();
    expect(mocks.read).toHaveBeenCalledTimes(1); expect(state.snapshot.onStage).toHaveBeenCalledTimes(1);
  });
  it('aborts polling without resurrecting material after removal or disable/unmount', async () => {
    let resolve!: (value: unknown) => void;
    mocks.read.mockImplementation(() => new Promise(done => { resolve = done; }));
    const state = subscribe({ links: [link] });
    state.snapshot.links = []; state.controller.abort(); state.stop();
    resolve({ id: 'late-read', result: { source } }); await settle();
    expect(state.snapshot.onStage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000); expect(mocks.read).toHaveBeenCalledTimes(1); expect(listeners.size).toBe(0);
  });
  it('refuses a late result after user/account scope changes, even before effect cleanup', async () => {
    let current = true; let resolve!: (value: unknown) => void;
    mocks.read.mockImplementation(() => new Promise(done => { resolve = done; }));
    const state = subscribe({ links: [link], current: () => current });
    current = false; resolve({ id: 'wrong-scope', result: { source } }); await settle();
    expect(state.snapshot.onStage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(30_000); expect(mocks.read).toHaveBeenCalledTimes(1);
  });
  it('refuses a late result for a removed source even without abort', async () => {
    let resolve!: (value: unknown) => void;
    mocks.read.mockImplementation(() => new Promise(done => { resolve = done; }));
    const state = subscribe({ links: [link] }); state.snapshot.links = [];
    resolve({ id: 'removed-source', result: { source } }); await settle();
    expect(state.snapshot.onStage).not.toHaveBeenCalled();
  });
  it.each([{ ...source, id: 'wrong-source' }, { ...source, text: '' }, { ...source, text: 'x'.repeat(200001) }])('never replaces full text with invalid or truncated material %#', async invalid => {
    mocks.read.mockResolvedValue({ id: 'invalid-read', result: { source: invalid } });
    const state = subscribe({ links: [link] }); await settle();
    expect(state.snapshot.onStage).not.toHaveBeenCalled(); expect(state.report).toHaveBeenLastCalledWith('offline', expect.any(String));
  });
  it('allows explicit refresh of an initial staged proof and renews old proofs without changing source content', async () => {
    const state = subscribe({ staged: [passage()], force: true }); await settle();
    expect(mocks.read).toHaveBeenCalledTimes(1); expect(state.snapshot.onStage).toHaveBeenCalledTimes(1);
    expect(state.snapshot.staged[0].text).toBe(source.text);
    await vi.advanceTimersByTimeAsync(30_000); expect(state.snapshot.onStage).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 41 * 60_000);
    mocks.read.mockResolvedValue({ id: 'renewed-read', result: { source } });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.snapshot.onStage).toHaveBeenCalledTimes(2);
    expect(state.snapshot.staged[0]).toMatchObject({ requestId: 'renewed-read', text: source.text, hash: source.hash });
  });
});
