import { useEffect, useRef, useState } from 'react';
import type { ArTeaSourceLink } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { awaitArJob, type StagedArPassage } from './ArTeaSources';

type Snapshot = { links: ArTeaSourceLink[]; staged: StagedArPassage[]; onStage: (source: StagedArPassage) => void };
export type LiveTranscriptStatus = 'idle' | 'checking' | 'current' | 'offline';
const fullSources = (snapshot: Snapshot) => [...new Set([...snapshot.links, ...snapshot.staged].filter(item => item.mode === 'full').map(item => item.sourceId))].sort();
const proofLifetime = 40 * 60_000;

/** Read-only subscription, split from React so cancellation and polling can be
 * exercised without a browser or any canonical record writer. */
export function subscribeLiveTeaTranscripts(options: {
  current: () => Snapshot;
  isCurrent: () => boolean;
  report: (status: LiveTranscriptStatus, message: string) => void;
  refreshed: Map<string, { requestId: string; at: number }>;
  signal: AbortSignal;
  force?: boolean;
}) {
  const { signal, refreshed } = options;
  let running = false;
  const valid = () => !signal.aborted && options.isCurrent();
  // Staged proofs came from a read the person just completed. Poll them on the
  // next tick; saved references, which may be old, always read again on open.
  if (!options.force) for (const source of options.current().staged.filter(item => item.mode === 'full')) {
    if (!refreshed.has(source.sourceId)) refreshed.set(source.sourceId, { requestId: source.requestId, at: Date.now() });
  }
  const read = async (initial = false) => {
    if (running || !valid() || document.visibilityState === 'hidden') return;
    const identities = fullSources(options.current()).filter(sourceId => !initial || options.force || !options.current().staged.some(item => item.sourceId === sourceId && item.mode === 'full'));
    if (!identities.length) return;
    running = true; options.report('checking', 'Checking original transcripts…');
    let failed = false;
    try {
      for (const sourceId of identities) {
        if (!valid()) return;
        try {
          const job = await awaitArJob({ kind: 'read', sourceId }, signal);
          if (!valid() || !fullSources(options.current()).includes(sourceId)) return;
          const source = job.result?.source;
          if (!source || source.id !== sourceId || !source.title?.trim() || !source.hash?.trim() || typeof source.text !== 'string' || !source.text.trim() || source.text.length > 200000) throw new Error('The complete original transcript is not available yet.');
          const previous = options.current().staged.find(item => item.sourceId === sourceId && item.mode === 'full');
          const saved = options.current().links.find(item => item.sourceId === sourceId);
          const changed = previous ? previous.hash !== source.hash || previous.text !== source.text || previous.title !== source.title : saved?.hash !== source.hash;
          const recorded = refreshed.get(sourceId);
          const expired = !recorded || (previous && recorded.requestId !== previous.requestId) || Date.now() - recorded.at > proofLifetime;
          if (!previous || changed || expired) {
            options.current().onStage({ requestId: job.id, sourceId, title: source.title, hash: source.hash, text: source.text, start: 0, end: source.text.length, mode: 'full' });
            refreshed.set(sourceId, { requestId: job.id, at: Date.now() });
          }
          if (!failed) options.report('current', changed ? 'Original changed. Working material is refreshing; review your public draft again.' : 'Original checked. Full transcript is current.');
        } catch (error) {
          if (!valid()) return;
          failed = true;
          options.report('offline', `${error instanceof Error ? error.message : 'Could not refresh AR Create.'} Last material remains visible. Open AR Create on the connected computer to refresh.`);
        }
      }
    } finally {
      running = false;
    }
  };
  void read(true);
  const timer = window.setInterval(() => void read(), 30_000);
  const visible = () => { if (document.visibilityState === 'visible') void read(); };
  document.addEventListener('visibilitychange', visible);
  const stop = () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  signal.addEventListener('abort', stop, { once: true });
  return () => { stop(); signal.removeEventListener('abort', stop); };
}

/** Refresh originals while open; subscription output remains unsaved material. */
export function useLiveTeaTranscripts(links: ArTeaSourceLink[], staged: StagedArPassage[], onStage: (source: StagedArPassage) => void, enabled = true) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const revision = useTeaCompassStore(state => state.accountScopeRevision);
  const scopeAccountId = useTeaCompassStore(state => state.accountScopeId);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<LiveTranscriptStatus>('idle');
  const [tick, setTick] = useState(0);
  const latest = useRef({ links, staged, onStage }); latest.current = { links, staged, onStage };
  const refreshed = useRef(new Map<string, { requestId: string; at: number }>());
  const identities = fullSources(latest.current).join('\n');
  const scope = `${accountId}:${userId}:${revision}`;
  const previousScope = useRef(scope);
  if (previousScope.current !== scope) { refreshed.current.clear(); previousScope.current = scope; }
  const lastTick = useRef(0);
  useEffect(() => {
    setStatus('idle'); setMessage('');
    if (!enabled || !identities || !accountId || !userId || scopeAccountId !== accountId) return;
    const controller = new AbortController();
    const force = tick !== lastTick.current; lastTick.current = tick;
    const stop = subscribeLiveTeaTranscripts({ current: () => latest.current, refreshed: refreshed.current, force,
      isCurrent: () => {
        const app = useAppStore.getState();
        const compass = useTeaCompassStore.getState();
        return app.activeAccountId === accountId && app.activeUserId === userId && compass.accountScopeId === accountId && compass.accountScopeRevision === revision;
      },
      report: (nextStatus, text) => { setStatus(nextStatus); setMessage(text); }, signal: controller.signal });
    return () => { controller.abort(); stop(); };
  }, [identities, tick, enabled, accountId, userId, revision, scopeAccountId]);
  return { message, checking: status === 'checking', status, refresh: () => setTick(value => value + 1) };
}
