import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { arCreateApi, type ArTeaSourceLink } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { Modal } from '../shared/Modal';
import { awaitArJob, type StagedArPassage } from './ArTeaSources';

const validId = (id: string) => /^[A-Za-z0-9_-]{1,160}$/.test(id);
const action = 'tap-target min-h-11 rounded-md px-3 text-ui-13 text-tea-text disabled:opacity-50';
export function ArTranscriptHandoff() {
  const location = useLocation(); const navigate = useNavigate();
  const sourceId = new URLSearchParams(location.search).get('arSource');
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const revision = useTeaCompassStore(state => state.accountScopeRevision);
  const [committing, setCommitting] = useState(false);
  const close = () => {
    if (committing) return;
    const query = new URLSearchParams(location.search); query.delete('arSource');
    navigate({ pathname: location.pathname, search: query.toString() }, { replace: true });
  };
  if (sourceId === null) return null;
  return <Modal isOpen ariaLabel="Link transcript to teas" variant="panel" hideClose onClose={close}>
    <TranscriptReview key={`${sourceId}:${accountId}:${userId}:${revision}`} sourceId={sourceId} onClose={close} onBusy={setCommitting} />
  </Modal>;
}
function TranscriptReview({ sourceId, onClose, onBusy }: { sourceId: string; onClose: () => void; onBusy: (busy: boolean) => void }) {
  const entries = useTeaCompassStore(state => state.entries);
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const accountName = useAppStore(state => state.activeAccount?.name);
  const scopeAccount = useTeaCompassStore(state => state.accountScopeId);
  const revision = useTeaCompassStore(state => state.accountScopeRevision);
  const [source, setSource] = useState<StagedArPassage | null>(null);
  const [links, setLinks] = useState<Array<Omit<ArTeaSourceLink, 'text'>>>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const mounted = useRef(true); const pending = useRef(false);
  const queryClient = useQueryClient();
  const ready = !!accountId && !!userId && accountId === scopeAccount;
  const current = () => mounted.current && useAppStore.getState().activeAccountId === accountId && useAppStore.getState().activeUserId === userId && useTeaCompassStore.getState().accountScopeId === accountId && useTeaCompassStore.getState().accountScopeRevision === revision;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!ready || !validId(sourceId)) return;
    const controller = new AbortController(); setLoading(true); setError('');
    void (async () => {
      try {
        const [job, existing] = await Promise.all([awaitArJob({ kind: 'read', sourceId }, controller.signal), arCreateApi.sourceLinks(sourceId)]);
        if (controller.signal.aborted || !current()) return;
        const original = job.result?.source;
        if (!original || original.id !== sourceId || !original.text.trim() || original.text.length > 200000) throw new Error('The complete transcript could not be read. Open the original in AR Create and try again.');
        setSource({ requestId: job.id, sourceId, title: original.title, hash: original.hash, text: original.text, start: 0, end: original.text.length, mode: 'full' });
        setLinks(existing.links); setSelected([]);
      } catch (failure) {
        if (!controller.signal.aborted && current()) setError(failure instanceof Error ? failure.message : 'Could not read AR Create. Open its connected computer and try again.');
      } finally { if (!controller.signal.aborted && current()) setLoading(false); }
    })();
    return () => controller.abort();
  }, [ready, sourceId, retry]);
  useEffect(() => { onBusy(saving); return () => onBusy(false); }, [saving, onBusy]);
  const upToDate = (link?: Omit<ArTeaSourceLink, 'text'>) => !!source && link?.mode === 'full' && link.hash === source.hash && link.start === 0 && link.end === source.text.length;
  const filtered = ready ? entries.filter(entry => entry.category !== 'teaware').filter(entry => [entry.name, entry.chineseName, entry.vendorName].some(value => value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))) : [];
  const save = async () => {
    if (pending.current || !current() || !source || !selected.length) return;
    const selectedEntries = selected.map(id => useTeaCompassStore.getState().getEntry(id));
    if (selectedEntries.some(entry => !entry?.synced)) { setError('Wait for the selected tea records to finish saving, then try again.'); return; }
    pending.current = true; onBusy(true); setSaving(true); setError(''); setMessage(''); let done = 0;
    try {
      for (const entryId of selected) {
        if (!current()) return;
        const existing = links.find(link => link.entryId === entryId);
        const result = await arCreateApi.link({ entryId, ...source, ...(existing ? { update: true, expectedHash: existing.hash } : {}) });
        if (!current()) return;
        setLinks(previous => [...previous.filter(link => link.entryId !== entryId), result.link]);
        setSelected(previous => previous.filter(id => id !== entryId)); done++;
      }
      if (!current()) return;
      await queryClient.invalidateQueries({ queryKey: ['tea-ar-sources'] });
      if (current()) setMessage(`${done} tea${done === 1 ? '' : 's'} linked to this transcript. Tea details and descriptions were kept.`);
    } catch (failure) {
      if (current()) setError(`${done ? `${done} linked. ` : ''}${failure instanceof Error ? failure.message : 'Could not link the remaining teas. Try again.'}`);
    } finally { pending.current = false; onBusy(false); if (current()) setSaving(false); }
  };
  return <section className="flex h-full min-h-0 flex-col bg-tea-bg">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-tea-border px-4 py-2 md:px-6"><div className="min-w-0"><h2 className={T.h3}>Link transcript to teas</h2><p className="truncate text-ui-12 text-tea-text-sec">{accountName || 'Your tea library'}</p></div><button type="button" disabled={saving} onClick={onClose} className={action}>Close</button></header>
    <div inert={saving || undefined} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
      <div className="mx-auto grid max-w-5xl min-w-0 gap-6 lg:grid-cols-2">
        <section className="min-w-0 space-y-3" aria-label="Transcript to link"><h3 className={T.h3}>{source?.title || 'From AR Create'}</h3>
          <p className="text-ui-13 text-tea-text-sec">Choose the existing teas discussed in this transcript. Each tea keeps the same record, notes and Inventory connection.</p>
          {!validId(sourceId) && <p role="alert" className="text-ui-13 text-tea-text-sec">This transcript link is incomplete. Open Link to tea library from AR Create again.</p>}
          {!ready && <p role="status" className="text-ui-13 text-tea-text-sec">Sign in and choose your shop to connect this transcript.</p>}
          {loading && <p role="status" className="text-ui-13 text-tea-text-sec">Reading the complete transcript and checking existing links…</p>}
          {source && <details><summary className="min-h-11 cursor-pointer text-ui-13 text-tea-text-sec">Review full transcript · {source.text.length.toLocaleString()} characters</summary><textarea aria-label="Transcript from AR Create" readOnly rows={12} value={source.text} className="input-field w-full min-w-0 px-3 py-2 text-ui-16" /></details>}
          <p className="text-ui-12 text-tea-text-dim">The original stays in AR Create. You can review AI working notes and write a public description inside each linked tea.</p>
          {error && <p role="alert" className="text-ui-13 text-tea-text-sec">{error}</p>}
          {ready && !loading && <button type="button" disabled={saving} className={action} onClick={() => { setSource(null); setSelected([]); setRetry(value => value + 1); }}>Refresh transcript and links</button>}
          {message && <p role="status" className="text-ui-13 text-tea-text">{message}</p>}
        </section>
        <section className="min-w-0 space-y-2" aria-label="Existing tea records"><h3 className={T.h3}>Choose teas</h3><input aria-label="Find an existing tea" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tea name, Chinese name or source" className="input-field w-full min-w-0 px-3 py-2 text-ui-16" />
          {source && !filtered.length && <p className="py-3 text-ui-13 text-tea-text-sec">No matching tea records in this shop. Add the tea in Library first, then return here.</p>}
          {filtered.map(entry => {
            const link = links.find(item => item.entryId === entry.id); const linked = upToDate(link);
            return <div key={entry.id} className="flex min-w-0 items-center gap-2 border-b border-tea-border py-2"><label className="flex min-h-11 min-w-0 flex-1 items-center gap-3"><input type="checkbox" aria-label={`Link ${entry.name || entry.chineseName || 'Untitled tea'}`} checked={selected.includes(entry.id)} disabled={!source || loading || saving || linked || (!selected.includes(entry.id) && selected.length >= 10)} onChange={() => setSelected(previous => previous.includes(entry.id) ? previous.filter(id => id !== entry.id) : [...previous, entry.id])} className="h-5 w-5 shrink-0 accent-tea-gold" /><span className="min-w-0 break-words text-ui-13 text-tea-text">{entry.name || entry.chineseName || 'Untitled tea'}<span className="mt-1 block text-ui-12 text-tea-text-sec">{linked ? 'Linked · current full transcript' : link ? 'Linked · select to refresh or use full transcript' : entry.teaKey ? 'Inventory · same tea record' : entry.type || 'Library'}</span></span></label>{link && <a className={`${action} shrink-0`} href={`/admin/compass?tab=library&entry=${encodeURIComponent(entry.id)}`}>Open tea</a>}</div>;
          })}
        </section>
      </div>
    </div>
    <footer className="shrink-0 border-t border-tea-border px-4 pt-2 pb-nav-gap md:px-6"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3"><p role="status" className="text-ui-12 text-tea-text-sec">{selected.length ? `${selected.length} selected` : 'Nothing selected'}</p><button type="button" disabled={saving || loading || !source || !selected.length} onClick={() => void save()} className="cta-solid min-h-11 rounded-md px-4 text-ui-13 disabled:opacity-50">{saving ? 'Linking…' : 'Link selected teas'}</button></div></footer>
  </section>;
}
