import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { arCreateApi, type ArBridgeJob, type ArLibrarySource, type ArReadSource, type ArTeaSourceLink } from '../../lib/api';
import { usePrivateQueryScope } from '../../admin/hooks/usePrivateQueryScope';
import { useAppStore } from '../../lib/store';
import { syncCompassEntries } from '../../lib/teaCompassSync';
import { BottomSheet } from '../shared/BottomSheet';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';

const LINK_KEY = ['tea-ar-sources'] as const;
const CONNECTION_KEY = ['tea-ar-connection'] as const;
const action = 'tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50';
export function useArTeaSources(entryId: string) {
  const scope = usePrivateQueryScope();
  const query = useQuery({ queryKey: [...LINK_KEY, ...scope.key, entryId], enabled: scope.ready, queryFn: () => arCreateApi.links(entryId), staleTime: 30_000 });
  return { ...query, links: scope.ready ? query.data?.links ?? [] : [] };
}
function useConnection() {
  const scope = usePrivateQueryScope();
  return useQuery({ queryKey: [...CONNECTION_KEY, ...scope.key], enabled: scope.ready, queryFn: arCreateApi.status, staleTime: 15_000 });
}
function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); reject(new Error('Stopped')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve(); }, 1500);
    signal.addEventListener('abort', aborted, { once: true });
  });
}
export async function awaitArJob(input: { kind: 'search' | 'read'; query?: string; sourceId?: string }, signal: AbortSignal): Promise<ArBridgeJob> {
  let job = await arCreateApi.request(input);
  const until = Date.now() + 60_000;
  while (!signal.aborted && Date.now() < until) {
    if (job.status === 'complete') return job;
    if (job.status === 'error' || job.status === 'expired') throw new Error(job.error || 'AR Create could not read this material. Try again.');
    await pause(signal);
    if (!signal.aborted) job = await arCreateApi.job(job.id);
  }
  throw new Error('AR Create has not answered yet. Open it on the connected computer and try again.');
}
export function excerptLocation(source: string, excerpt: string, preferred = 0): { start: number; end: number } | null {
  if (!excerpt.trim() || excerpt.length > 12000) return null;
  const start = source.slice(preferred, preferred + excerpt.length) === excerpt ? preferred : source.indexOf(excerpt);
  return start < 0 ? null : { start, end: start + excerpt.length };
}
export function ArCreatePairing() {
  const location = useLocation();
  const navigate = useNavigate();
  const code = new URLSearchParams(location.search).get('arPair');
  const accountId = useAppStore(s => s.activeAccountId);
  const account = useAppStore(s => s.activeAccount);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!code) return null;
  const close = () => { const params = new URLSearchParams(location.search); params.delete('arPair'); navigate({ pathname: location.pathname, search: params.toString() }, { replace: true }); };
  return <BottomSheet open onOpenChange={open => { if (!open) close(); }} title="Connect AR Create">
    <div className="space-y-4 px-4 pb-4">
      <p className="text-ui-14 text-tea-text">Connect AR Create on your computer to {account?.name || 'your current store'}.</p>
      <p className="text-ui-12 text-tea-text-sec">You choose which talks and passages to link. The originals stay in AR Create.</p>
      {error && <p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>}
      <button type="button" className="cta-solid min-h-11 rounded-md px-4 text-ui-14" disabled={busy || !accountId} onClick={async () => {
        setBusy(true); setError('');
        try { await arCreateApi.claim(code); if (useAppStore.getState().activeAccountId !== accountId) return; await queryClient.invalidateQueries({ queryKey: CONNECTION_KEY }); close(); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not connect. Try again.'); }
        finally { setBusy(false); }
      }}>{busy ? 'Connecting…' : 'Connect to this store'}</button>
    </div>
  </BottomSheet>;
}
export function ArTalkLinks({ entryId, entryName, links }: { entryId: string; entryName?: string; links: ArTeaSourceLink[] }) {
  const accountId = useAppStore(s => s.activeAccountId);
  const userId = useAppStore(s => s.activeUserId);
  return <ArTalkLinksInner key={`${accountId}:${userId}:${entryId}`} entryId={entryId} entryName={entryName} links={links} />;
}
function ArTalkLinksInner({ entryId, entryName, links }: { entryId: string; entryName?: string; links: ArTeaSourceLink[] }) {
  const connection = useConnection();
  const accountId = useAppStore(s => s.activeAccountId);
  const userId = useAppStore(s => s.activeUserId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(entryName ?? '');
  const [results, setResults] = useState<ArLibrarySource[]>([]);
  const [searched, setSearched] = useState(false);
  const [source, setSource] = useState<ArReadSource | null>(null);
  const [requestId, setRequestId] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [preferred, setPreferred] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const current = () => useAppStore.getState().activeAccountId === accountId && useAppStore.getState().activeUserId === userId;
  const perform = async (operation: (signal: AbortSignal) => Promise<void>) => {
    controller.current?.abort(); const next = new AbortController(); controller.current = next;
    setBusy(true); setError(''); setMessage('');
    try { await operation(next.signal); }
    catch (failure) { if (!next.signal.aborted && current()) setError(failure instanceof Error ? failure.message : 'Could not read AR Create. Try again.'); }
    finally { if (!next.signal.aborted && current()) setBusy(false); }
  };
  const read = (id: string) => perform(async signal => {
    const job = await awaitArJob({ kind: 'read', sourceId: id }, signal);
    if (!current() || signal.aborted) return;
    const item = job.result?.source; if (!item) throw new Error('This source has no readable transcript yet.');
    const found = query.trim() ? item.text.toLowerCase().indexOf(query.trim().toLowerCase()) : 0;
    const start = Math.max(0, found - 800);
    setPreferred(start); setExcerpt(item.text.slice(start, start + 3000)); setSource(item); setRequestId(job.id); setOpen(true);
  });
  const close = () => { controller.current?.abort(); setBusy(false); setOpen(false); };
  return <div className="min-w-0 space-y-2" aria-label="AR Create talks">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" className={action} onClick={() => { setOpen(true); setError(''); }}>Link a talk from AR Create</button>
      {links.length > 0 && <span className="text-ui-11 text-tea-text-dim">{links.length} linked</span>}
    </div>
    {links.map(link => <details key={link.id} className="min-w-0 border-b border-tea-border pb-2">
      <summary className="min-h-11 cursor-pointer text-ui-12 text-tea-text-sec">{link.title}</summary>
      <p className="whitespace-pre-wrap break-words text-ui-12 text-tea-text-sec">{link.text}</p>
      <p className="mt-2 text-ui-11 text-tea-text-dim">Linked passage from AR Create. Original retained.</p>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className={action} onClick={() => void read(link.sourceId)}>Check original</button><button type="button" className={action} disabled={busy} onClick={() => void perform(async () => { await arCreateApi.remove(link.id); if (current()) await queryClient.invalidateQueries({ queryKey: LINK_KEY }); })}>Unlink</button></div>
    </details>)}
    {!open && error && <p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>}
    {message && <p role="status" className="text-ui-12 text-tea-text-sec">{message}</p>}
    <BottomSheet open={open} onOpenChange={value => { if (!value) close(); }} title="Link a talk" large>
      <div className="min-w-0 space-y-4 px-4 pb-4">
        {(!connection.data?.connected || connection.data?.canSearch === false) ? <div className="space-y-2"><p className="text-ui-14 text-tea-text">{connection.data?.canSearch === false ? 'This private library is connected by another person.' : connection.data?.paired ? 'Open AR Create on its connected computer.' : 'Connect AR Create once from its computer.'}</p><p className="text-ui-12 text-tea-text-sec">{connection.data?.canSearch === false ? 'The person who connected it can search and link talks. Reviewed passages remain available in this tea.' : connection.data?.paired ? 'The original talks stay there. Check the connection again when the computer is available.' : 'Open the connection link provided by the connector, choose your store, then return here. Your library can then be searched from this phone.'}</p><button type="button" className={action} onClick={() => void connection.refetch()}>Check connection</button></div> : <>
          <form className="flex gap-2" onSubmit={event => { event.preventDefault(); setSource(null); void perform(async signal => { const job = await awaitArJob({ kind: 'search', query: query.trim() }, signal); if (current() && !signal.aborted) { setResults(job.result?.sources ?? []); setSearched(true); } }); }}>
            <input className="input-field min-w-0 flex-1 px-3 py-2 text-ui-16" aria-label="Find a talk" maxLength={300} placeholder="Title, tea name or a phrase" value={query} onChange={event => setQuery(event.target.value)} />
            <button type="submit" className={action} disabled={busy || !query.trim()}>Search</button>
          </form>
          {busy && <p role="status" className="text-ui-12 text-tea-text-sec">Reading AR Create…</p>}
          {!source && searched && !busy && results.length === 0 && <p className="text-ui-12 text-tea-text-sec">No matching talks. Try a title or a short phrase from the conversation.</p>}
          {!source && results.map(item => <button key={item.id} type="button" className="min-h-11 w-full border-b border-tea-border py-3 text-left" disabled={busy} onClick={() => void read(item.id)}><span className={`${T.label} block text-tea-text`}>{item.title}</span>{item.snippet && <span className="mt-1 block text-ui-12 text-tea-text-sec line-clamp-3">{item.snippet}</span>}</button>)}
          {source && <section aria-label="Review linked passage" className="space-y-3">
            <h3 className={T.h3}>{source.title}</h3>
            <p className="text-ui-12 text-tea-text-sec">Keep a continuous passage from the talk. You can trim this excerpt before linking.</p>
            <textarea aria-label="Passage to link" className="input-field w-full min-w-0 px-3 py-2 text-ui-16" rows={7} value={excerpt} onChange={event => setExcerpt(event.target.value)} />
            <p className="text-ui-11 text-tea-text-dim">{excerpt.length.toLocaleString()} / 12,000 characters</p>
            {!excerptLocation(source.text, excerpt, preferred) && <p className="text-ui-12 text-tea-text-sec">{excerpt.length > 12000 ? 'Choose a shorter passage.' : 'Keep the words exactly as they appear in the source. Trim from the beginning or end.'}</p>}
            {links.some(link => link.sourceId === source.id && link.hash !== source.hash) && <p role="status" className="text-ui-12 text-tea-text-sec">The original has changed. Review this version before updating the linked passage.</p>}
            <button type="button" className="cta-solid min-h-11 rounded-md px-4 text-ui-12" disabled={busy || !excerptLocation(source.text, excerpt, preferred)} onClick={() => void perform(async () => {
              const range = excerptLocation(source.text, excerpt, preferred); if (!range) throw new Error('Keep an exact continuous passage from this source.');
              await syncCompassEntries(accountId ?? undefined);
              if (!current()) return;
              const existing = links.find(link => link.sourceId === source.id);
              await arCreateApi.link({ entryId, requestId, sourceId: source.id, title: source.title, hash: source.hash, text: excerpt, ...range, ...(existing ? { expectedHash: existing.hash, update: true } : {}) });
              if (current()) { await queryClient.invalidateQueries({ queryKey: LINK_KEY }); setOpen(false); setMessage('Talk linked to this tea. Ready to review with AI.'); }
            })}>{links.some(link => link.sourceId === source.id) ? 'Update linked passage' : 'Link this talk'}</button>
          </section>}
        </>}
        {error && <p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>}
      </div>
    </BottomSheet>
  </div>;
}
