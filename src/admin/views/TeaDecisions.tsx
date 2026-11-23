import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { API_URL, authedFetch } from '../../lib/api';
import { usePrivateQueryScope } from '../hooks/usePrivateQueryScope';
import type { EditorialPassage, TeaEditorialBoard, TeaVerdict } from '../../../shared/catalog/teaEditorial';

const ROOT = '/admin/catalog-review/teas';
const URL = API_URL + '/api' + ROOT + '/decisions';
const tabs = [['intake','Photo intake'],['editorial','Editorial review'],['holds','Identity checks'],['histories','Named histories']] as const;
const labels: Record<TeaVerdict,string> = { approved:'Approved',declined:'Declined',withdrawn:'Withdrawn' };
type Entry = { id: string; title: string; status: string };

function PassageReview({ board, onDecide }: { board: TeaEditorialBoard;
  onDecide: (p: EditorialPassage, state: TeaVerdict) => Promise<void> }) {
  const [kind, setKind] = useState<EditorialPassage['kind']>('Lot opening');
  const [selected, setSelected] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const rows=board.passages.filter(p=>p.kind===kind);
  const passage=rows.find(p=>p.id===selected) ?? rows[0];
  if (!passage) return <p>No editorial passages in this packet.</p>;
  const verdict=board.verdicts[passage.id]?.decision;
  const next = rows.find(p => p.id !== passage.id && !board.verdicts[p.id]);
  const save=async (decision: TeaVerdict)=>{
    setBusy(true); setError('');
    try { await onDecide(passage,decision); }
    catch { setError('The decision could not be saved. Check the current passage and try again.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-4">
    <p className="text-tea-text-sec">Your decision applies to this wording. Publishing is separate.</p>
    <div className="flex flex-wrap gap-2">{(['Lot opening','Shared history'] as const).map(k=>
      <button className="btn-tab btn-sm" aria-pressed={kind===k} key={k} disabled={busy} onClick={()=>{setKind(k);setSelected('');setError('');}}>
        {k==='Lot opening'?'Lot openings':'Shared passages'} · {board.passages.filter(p=>p.kind===k).length}</button>)}</div>
    <label className="block">Passage<select className="btn-field mt-1 block w-full" value={passage.id} disabled={busy} onChange={e=>{setSelected(e.target.value);setError('');}}>
      {rows.map(p=><option key={p.id} value={p.id}>{p.title}{board.verdicts[p.id]?' · '+labels[board.verdicts[p.id].decision]:''}</option>)}</select></label>
    <article aria-label={passage.title} className="space-y-3 border-y border-tea-border py-4">
      <p>{passage.text}</p>
      <p className="text-tea-text-sec">{passage.scope}</p>
      <ul className="space-y-1">{passage.sources.map(s=><li key={s.url+s.locator}>
        <a className="underline" href={s.url}>{s.title}</a>{s.locator && <span className="text-tea-text-sec"> · {s.locator}</span>}</li>)}</ul>
      <p className="flex flex-wrap gap-x-3">{passage.lots.map(l=><a className="underline" href={l.url} key={l.url}>View {l.title}</a>)}</p>
    </article>
    <div className="flex flex-wrap items-center gap-2">
      <span role="status">{verdict?labels[verdict]:'Unreviewed'}</span>
      <button className="btn-primary btn-sm" disabled={busy||verdict==='approved'} onClick={()=>void save('approved')}>Approve wording</button>
      <button className="btn-secondary btn-sm" disabled={busy||verdict==='declined'} onClick={()=>void save('declined')}>Decline</button>
      {verdict && verdict!=='withdrawn' && <button className="btn-quiet btn-sm" disabled={busy} onClick={()=>void save('withdrawn')}>Withdraw decision</button>}
    </div>
    {verdict && next && <button className="btn-quiet btn-sm" disabled={busy} onClick={()=>{setSelected(next.id);setError('');}}>Next unreviewed passage →</button>}
    {error && <p role="alert">{error}</p>}
  </div>;
}

export function TeaDecisions({entries}:{entries: Entry[]}) {
  const [params,setParams]=useSearchParams();
  const view=tabs.find(([id])=>id===params.get('view'))?.[0] ?? 'intake';
  const scope=usePrivateQueryScope();
  const [accountId,userId]=scope.key;
  const auth={expectedAuth:{accountId,userId},reportIncident:false,cache:'no-store' as const};
  const query=useQuery<TeaEditorialBoard>({queryKey:['private-tea-decisions',...scope.key],enabled:scope.ready,retry:false,
    queryFn:({signal})=>authedFetch(URL,{...auth,signal})});
  const board=scope.ready?query.data:undefined;
  const decide=async(p:EditorialPassage,decision:TeaVerdict)=>{
    const version=board?.verdicts[p.id]?.version ?? 0;
    try { await authedFetch(URL+'/'+p.id,{...auth,method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision,revision:p.revision,version})}); }
    finally { await query.refetch({throwOnError:true}); }
  };
  const counts = { intake: entries.length, editorial: board?.passages.length, holds: board?.holds.length, histories: board?.histories.length };
  const statusGroups=[...new Set(entries.map(e=>e.status))];
  return <section className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-4 pb-nav-gap">
    <h1 className={T.h1}>Tea decisions</h1>
    <nav aria-label="Tea decision sections" className="flex flex-wrap gap-2">{tabs.map(([id,title])=><button key={id} className="btn-tab btn-sm"
      aria-pressed={view===id} onClick={()=>setParams(id==='intake'?{}:{view:id})}>{title}{counts[id] !== undefined && ' · '+counts[id]}</button>)}</nav>
    {view==='intake' && <>
      <p className="text-tea-text-sec">{entries.length} photographed teas. Stock checks and physical counts stay with intake.</p>
      {statusGroups.map(group=><section key={group}><h2 className={T.h3}>{group} · {entries.filter(e=>e.status===group).length}</h2>
        <ul className="divide-y divide-tea-border">{entries.filter(e=>e.status===group).map(e=><li key={e.id} className="py-2">
          <Link className="underline" to={ROOT+'/'+e.id}>{e.title}</Link>
          {board?.intake[e.id] && <p className="text-tea-text-sec">{board.intake[e.id].nextCheck}</p>}
        </li>)}</ul></section>)}</>}
    {!board && <p role="status">{query.isError?'Editorial decisions are unavailable for this account.':'Opening decision notes…'}</p>}
    {board && view==='editorial' && <PassageReview board={board} onDecide={decide} />}
    {board && view==='holds' && <><h2 className={T.h2}>Identity checks · {board.holds.length}</h2><p className="text-tea-text-sec">These histories need evidence from the packaging or supplier.</p>
      <ul className="divide-y divide-tea-border">{board.holds.map(h=><li className="py-3" key={h.url}><a className="underline" href={h.url}>{h.title}</a><p>{h.locator}</p></li>)}</ul></>}
    {board && view==='histories' && <><h2 className={T.h2}>Named histories · {board.histories.length}</h2>
      <ul className="divide-y divide-tea-border">{board.histories.map(h=><li className="flex flex-wrap items-baseline justify-between gap-2 py-2" key={h.url}>
        <a className="underline" href={h.url}>{h.title}</a><Link className="underline" to={h.wisdom}>Tea Wisdom</Link></li>)}</ul></>}
  </section>;
}
