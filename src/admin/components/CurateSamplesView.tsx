import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { hydrateCompassEntries } from '../../lib/teaCompassSync';
import { CaptureCard } from '../../components/CurateV2/CaptureCard';
import { TASTING_TAXONOMY } from '../../data/tastingTaxonomy';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

type Portion = { id: string; name: string; grams: number | null; status: string; compass_entry_id: string };
type Holding = { entry: Record<string, any>; stock_grams: number; sample_grams: number | null; samples: Portion[] };
type Action = { kind: 'taste' | 'order' | 'measure'; holding: Holding; sample?: Portion };
type Review = { token: string; input: Record<string, unknown>; preview: Record<string, any>; kind: 'taste' | 'order' | 'measure' };
const control = 'min-h-11 w-full rounded-md border border-tea-border bg-tea-bg px-3 text-ui-14 text-tea-text focus:border-tea-gold focus:outline-none';
const button = 'tap-target min-h-11 rounded-md px-3 text-ui-13 text-tea-text-sec hover:bg-tea-accent-sub focus-visible:outline focus-visible:outline-tea-gold disabled:opacity-50';
const categories = TASTING_TAXONOMY.categories.filter(c => ['body','finish','feeling','flavor','liquor-color'].includes(c.id));

export function CurateSamplesView({ search = '' }: { search?: string }) {
 const accountId = useAppStore(s => s.activeAccountId);
 const client = useQueryClient();
 const holdings = useQuery<Holding[]>({ queryKey: ['curate-samples-only', accountId], queryFn: () => api.curateWorkspace.holdings(true), enabled: !!accountId });
 const [editing, setEditing] = useState<string | null>(null);
 const [action, setAction] = useState<Action | null>(null);
 const [amount, setAmount] = useState('');
 const [unit, setUnit] = useState('g');
 const [pieceGrams, setPieceGrams] = useState('');
 const [score, setScore] = useState('');
 const [terms, setTerms] = useState<Record<string, string[]>>({});
 const [review, setReview] = useState<Review | null>(null);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [message, setMessage] = useState('');
 useEffect(() => { setEditing(null); setAction(null); setReview(null); setError(''); setMessage(''); }, [accountId]);
 const refresh = async () => { await client.invalidateQueries({ queryKey: ['curate-samples-only', accountId] }); };
 const start = (next: Action) => {
  setAction(next); setAmount(''); setUnit('g'); setPieceGrams(next.holding.entry.pack_size_grams == null ? '' : String(next.holding.entry.pack_size_grams));
  setScore(''); setTerms({}); setReview(null); setError(''); setMessage('');
 };
 const edit = async (id: string) => {
  setBusy(true); setError('');
  try {
   await hydrateCompassEntries(accountId ?? undefined);
   if (!useTeaCompassStore.getState().entries.some(entry => entry.id === id)) throw new Error('The tea could not be loaded. Refresh samples and try again.');
   setEditing(id);
  } catch (e) { setError(e instanceof Error ? e.message : 'The tea could not be loaded.'); }
  finally { setBusy(false); }
 };
 const submit = async (event: React.FormEvent) => {
  event.preventDefault(); if (!action) return;
  setBusy(true); setError('');
  try {
   if (!amount.trim()) throw new Error(action.kind === 'taste' ? 'Enter the grams consumed, including zero if none.' : action.kind === 'measure' ? 'Enter the measured grams remaining, including zero if empty.' : 'Enter the quantity to order.');
   const quantity = Number(amount);
   if (!Number.isFinite(quantity) || quantity < 0 || (action.kind === 'order' && quantity === 0)) throw new Error('Enter a valid quantity.');
   const input: Record<string, unknown> = action.kind === 'measure' ? {action:'edit',entity:'sample',id:action.sample!.id,fields:{grams:quantity}} : action.kind === 'taste'
    ? { action: 'taste_sample', entity: 'sample', id: action.sample!.id, consumed_grams: quantity, ...(Object.keys(terms).length ? { tasting: terms } : {}), ...(score.trim() ? { score: Number(score) } : {}) }
    : { vendor_id: action.holding.entry.vendor_id, lines: [{ tea_id: action.holding.entry.id, quantity: { amount: quantity, unit }, ...(unit === 'piece' ? { piece_grams: Number(pieceGrams) } : {}) }] };
   const result = action.kind !== 'order' ? await api.curateWorkspace.correct(input) : await api.curateWorkspace.order(input);
   if (result.error || !result.confirmation_token) throw new Error(result.message || result.error || 'The change could not be reviewed.');
   setReview({ token: result.confirmation_token, input, preview: result.preview, kind: action.kind });
  } catch (e) { setError(e instanceof Error ? e.message : 'The change could not be reviewed.'); }
  finally { setBusy(false); }
 };
 const confirm = async () => {
  if (!review) return; setBusy(true); setError('');
  try {
   const result = review.kind !== 'order' ? await api.curateWorkspace.correct(review.input, review.token) : await api.curateWorkspace.order({ confirm: review.token });
   if (result.error) throw new Error(result.message || result.error);
   setMessage(review.kind === 'taste' ? 'Tasting recorded; sample grams updated.' : review.kind === 'measure' ? 'Measured sample weight recorded.' : 'Order created. The arrival waits for your approval into stock.');
   setReview(null); setAction(null); await refresh();
  } catch (e) { setReview(null); setError(e instanceof Error ? e.message : 'The change could not be confirmed. Review it again.'); }
  finally { setBusy(false); }
 };
 const rows = (holdings.data ?? []).filter(h => `${h.entry.name ?? ''} ${h.entry.chinese_name ?? ''} ${h.entry.vendor_name ?? ''}`.toLowerCase().includes(search.toLowerCase()));
 if (editing) return <div className="min-w-0 overflow-y-auto pb-nav-gap"><button className={button} onClick={async () => { setEditing(null); await refresh(); }}><ArrowLeft size={16} className="inline mr-2" />Back to samples</button><CaptureCard entryId={editing} onReturnToLibrary={() => { setEditing(null); void refresh(); }} onCommit={() => { void refresh(); }} /></div>;
 return <section aria-label="Samples-only inventory" className="min-w-0 flex-1 overflow-y-auto pb-nav-gap">
  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-5 border-b border-tea-border">
   <div className="min-w-0 flex-1"><h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Samples only</h2><p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-dim mt-1`}>Received and tasted teas with no full stock. Each physical portion keeps its own grams.</p></div>
   <button className={button} onClick={() => { void refresh(); }} disabled={holdings.isFetching} aria-label="Refresh samples"><RefreshCw size={16} /></button>
  </div>
  {error && <p role="alert" className="px-4 py-3 text-ui-14 text-tea-text">{error}</p>}
  {message && <p role="status" className="px-4 py-3 text-ui-14 text-tea-text">{message}</p>}
  {holdings.isLoading && <p role="status" className="flex items-center gap-2 p-4 text-ui-14 text-tea-text-dim"><Loader2 size={16} className="animate-spin" />Loading samples…</p>}
  {holdings.isError && <div role="alert" className="p-4 text-ui-14 text-tea-text">Samples could not be loaded.<button className={button} onClick={() => { void refresh(); }}>Try again</button></div>}
  {!holdings.isLoading && !holdings.isError && !rows.length && <p className={`${TYPOGRAPHY_CLASSES.bodyLight} p-4 text-tea-text-dim`}>{search ? 'No samples match this search.' : 'No received or tasted samples without full stock yet.'}</p>}
  {rows.map(holding => <article key={holding.entry.id} data-testid="curate-sample-row" className="min-w-0 border-b border-tea-border px-4 py-4">
   <div className="flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0"><h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text break-words`}>{holding.entry.name || holding.entry.chinese_name || 'Unnamed tea'}</h3><p className="mt-1 text-ui-13 text-tea-text-dim">{[holding.entry.year, holding.entry.type, holding.entry.vendor_name].filter(Boolean).join(' · ')}</p></div>
    <div className="flex flex-wrap gap-1"><button className={button} disabled={busy} onClick={() => { void edit(holding.entry.id); }}>Edit tea</button><button className={button} disabled={busy || !holding.entry.vendor_id || holding.entry.price_amount == null || !holding.entry.price_currency} onClick={() => start({ kind: 'order', holding })}>Order tea</button></div>
   </div>
   <dl className="flex flex-wrap gap-x-6 gap-y-2 my-3 text-ui-14"><div className="flex gap-2"><dt className="text-tea-text-dim">Sample remaining</dt><dd className="text-tea-text">{holding.sample_grams == null ? 'Not recorded' : `${holding.sample_grams} g`}</dd></div><div className="flex gap-2"><dt className="text-tea-text-dim">Full stock</dt><dd className="text-tea-text">{holding.stock_grams} g</dd></div></dl>
   {!holding.entry.vendor_id || holding.entry.price_amount == null || !holding.entry.price_currency ? <p className="text-ui-12 text-tea-text-dim mb-2">Add the vendor and quoted price in Edit tea before ordering.</p> : null}
   {holding.samples.map(sample => <div key={sample.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="text-ui-13 text-tea-text-sec">{sample.name || 'Sample portion'} · {sample.grams == null ? 'Weight not recorded' : `${sample.grams} g`} · {sample.status}</span><div className="flex flex-wrap gap-1"><button className={button} disabled={busy} onClick={() => start({kind:'measure',holding,sample})}>Record grams</button><button className={button} disabled={busy || sample.status === 'requested' || sample.grams == null} onClick={() => start({ kind: 'taste', holding, sample })}>Taste sample</button></div></div>)}
   {action && action.holding.entry.id === holding.entry.id && <form onSubmit={submit} className="mt-4 border-t border-tea-border pt-4 space-y-4">
    <h4 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{action.kind === 'taste' ? `Taste ${action.sample?.name || 'sample'}` : action.kind === 'measure' ? `Record weight of ${action.sample?.name || 'sample'}` : `Order ${holding.entry.name || 'tea'}`}</h4>
    {!review ? <>
     <div className="flex flex-wrap gap-3"><label className="min-w-0 flex-1 text-ui-13 text-tea-text-sec">{action.kind === 'taste' ? 'Grams consumed' : action.kind === 'measure' ? 'Measured grams remaining' : 'Quantity requested'}<input className={`${control} mt-1`} type="number" min={action.kind === 'order' ? 0.001 : 0} max={action.kind === 'taste' ? action.sample?.grams ?? undefined : undefined} step="any" required value={amount} onChange={e => setAmount(e.target.value)} /></label>
      {action.kind === 'order' && <label className="text-ui-13 text-tea-text-sec">Unit<select className={`${control} mt-1`} value={unit} onChange={e => setUnit(e.target.value)}><option value="g">Grams</option><option value="kg">Kilograms</option><option value="piece">Pieces</option></select></label>}
      {action.kind === 'taste' && <label className="text-ui-13 text-tea-text-sec">Score, optional<input className={`${control} mt-1`} type="number" min="1" max="10" step="1" value={score} onChange={e => setScore(e.target.value)} /></label>}
     </div>
     {action.kind === 'order' && unit === 'piece' && <label className="block text-ui-13 text-tea-text-sec">Grams per piece<input className={`${control} mt-1`} type="number" min="0.001" step="any" required value={pieceGrams} onChange={e => setPieceGrams(e.target.value)} /></label>}
     {action.kind === 'taste' && <><p className="text-ui-12 text-tea-text-dim">{action.sample?.grams} g remains in this portion. Enter 0 if nothing was consumed.</p><details><summary className="tap-target min-h-11 cursor-pointer text-ui-13 text-tea-text-sec">Tasting terms, optional</summary><div className="grid gap-3 sm:grid-cols-2">{categories.map(category => <label key={category.id} className="text-ui-13 text-tea-text-sec">{category.name}<select className={`${control} mt-1`} value="" onChange={e => { const term = e.target.value; if (term) setTerms(current => ({ ...current, [category.id]: [...new Set([...(current[category.id] ?? []), term])] })); }}><option value="">Add a term</option>{category.groups.map(group => <optgroup label={group.label} key={group.label}>{group.terms.map(term => <option value={term.id} key={term.id}>{term.label}</option>)}</optgroup>)}</select><span className="flex flex-wrap gap-1">{(terms[category.id] ?? []).map(term => <button type="button" className={button} key={term} onClick={() => setTerms(current => { const next = { ...current, [category.id]: current[category.id].filter(t => t !== term) }; if (!next[category.id].length) delete next[category.id]; return next; })}>{category.groups.flatMap(g => g.terms).find(t => t.id === term)?.label ?? term} ×</button>)}</span></label>)}</div></details></>}
     <div className="flex flex-wrap gap-2"><button type="button" className={button} onClick={() => setAction(null)} disabled={busy}>Cancel</button><button type="submit" className={`${button} text-tea-gold`} disabled={busy}>{busy ? 'Preparing review…' : action.kind === 'taste' ? 'Review tasting' : action.kind === 'measure' ? 'Review measurement' : 'Review order'}</button></div>
    </> : <div aria-label="Review change" className="space-y-3">
     {review.kind === 'measure' ? <p className="text-ui-14 text-tea-text">Record {(review.input.fields as {grams:number}).grams} g as the measured remaining weight. This does not consume the sample.</p> : review.kind === 'taste' ? <p className="text-ui-14 text-tea-text">Consume {String(review.input.consumed_grams)} g from this portion; {review.preview.changes?.find((c: any) => c.entity === 'sample')?.after?.grams ?? Number(action.sample!.grams) - Number(review.input.consumed_grams)} g will remain.{review.input.score != null ? ` Score: ${review.input.score}/10.` : ''}</p> : <><p className="text-ui-14 text-tea-text">{review.preview.read_back}</p><p className="text-ui-13 text-tea-text-dim">{review.preview.after_confirm}</p></>}
     {review.kind === 'taste' && Object.keys(terms).length > 0 && <p className="text-ui-13 text-tea-text-sec">Tasting: {Object.entries(terms).flatMap(([category, ids]) => ids.map(id => categories.find(c => c.id === category)?.groups.flatMap(g => g.terms).find(t => t.id === id)?.label ?? id)).join(', ')}</p>}
     <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={() => { setReview(null); setAction(null); }}>Cancel</button><button type="button" className={button} disabled={busy} onClick={() => setReview(null)}>Change details</button><button type="button" className={`${button} text-tea-gold`} disabled={busy} onClick={() => { void confirm(); }}>{busy ? 'Confirming…' : review.kind === 'taste' ? 'Confirm tasting' : review.kind === 'measure' ? 'Confirm measurement' : 'Confirm order'}</button></div>
    </div>}
   </form>}
  </article>)}
 </section>;
}
