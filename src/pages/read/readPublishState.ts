/**
 * The Read stories' stored states, as the browser knows them: what Adrian set
 * by pressing Publish or Unpublish at the end of a story (migration 0030),
 * read once per page load from /api/public/read/publish-state and kept here so
 * every surface that names a story (the route gate, the index, the rail at the
 * foot of each piece, Craft, a person's page) reads the same answer.
 *
 * A failed or slow read leaves the states empty and marks them settled, which
 * means ARTICLE_LIVE decides: a bad minute never hides a live story. The read
 * is bounded so a stalled API cannot hold a visitor on the loader.
 *
 * No React, no store: a tiny external store `useSyncExternalStore` can watch,
 * plus the one write. The write goes through `authedFetch` so a session that
 * needs refreshing is refreshed exactly as every other admin write is.
 */
import type { ReadPublishOverrides, ReadPublishState } from './articleLive';
import { API_URL, hasSession, setReadPublishStateRequest } from '../../lib/api';

export type ReadPublishSnapshot = {
  /** Stored states by path. Empty until settled, and empty after a failure. */
  states: ReadPublishOverrides;
  /** True once the read answered or gave up; until then a visitor waits. */
  settled: boolean;
};

const READ_TIMEOUT_MS = 2500;

let snapshot: ReadPublishSnapshot = { states: {}, settled: false };
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: ReadPublishSnapshot) {
  snapshot = next;
  listeners.forEach((l) => l());
}

export function subscribeReadPublishState(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getReadPublishSnapshot(): ReadPublishSnapshot {
  return snapshot;
}

function asStates(body: unknown): ReadPublishOverrides | null {
  const states = (body as { states?: unknown } | null)?.states;
  if (!states || typeof states !== 'object' || Array.isArray(states)) return null;
  const out: Record<string, ReadPublishState> = {};
  for (const [path, state] of Object.entries(states as Record<string, unknown>)) {
    if (state === 'live' || state === 'draft') out[path] = state;
  }
  return out;
}

/**
 * Read the stored states once per page load. A signed-in browser skips its
 * short cache, so the owner who has just pressed a button and reloads sees
 * what they pressed rather than the answer from fifteen seconds before.
 */
export function loadReadPublishState(): Promise<void> {
  if (snapshot.settled) return Promise.resolve();
  if (inFlight) return inFlight;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  inFlight = fetch(`${API_URL}/api/public/read/publish-state`, {
    signal: controller.signal,
    cache: hasSession() ? 'no-cache' : 'default',
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(String(res.status));
      const states = asStates(await res.json());
      if (!states) throw new Error('shape');
      emit({ states, settled: true });
    })
    .catch(() => {
      // The map decides. Keep any states already known rather than forgetting
      // what this page was told a moment ago.
      emit({ states: snapshot.states, settled: true });
    })
    .finally(() => {
      clearTimeout(timer);
      inFlight = null;
    });
  return inFlight;
}

/** Publish or unpublish one story. Resolves to the new states; throws on refusal. */
export async function setReadPublishState(path: string, state: ReadPublishState): Promise<ReadPublishOverrides> {
  const body = await setReadPublishStateRequest(path, state);
  const states = asStates(body) ?? { ...snapshot.states, [path]: state };
  emit({ states, settled: true });
  return states;
}

/** Tests only: forget everything, as a fresh page load would. */
export function resetReadPublishStateForTests(next: ReadPublishSnapshot = { states: {}, settled: false }) {
  inFlight = null;
  emit(next);
}
