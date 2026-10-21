import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import { plainFailure } from '../CurateV2/plainFailure';
import { SAID_LABEL } from '../CurateV2/saidFiling';
import type { TeaCompassEntry } from './types';
import {
  applyReviewedTeaFacts, collectTeaRecordEvidence, loadTeaRecordReview, teaRecordExtractionText, teaRecordScopeMatches,
  type TeaRecordAssistantScope, type TeaRecordFact, type TeaRecordReview,
} from './teaRecordEvidence';

function detailValue(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.filter(item => typeof item === 'string' || typeof item === 'number').join(', ') || null;
  return null;
}

function currentScope(entryId: string): TeaRecordAssistantScope {
  const app = useAppStore.getState();
  const compass = useTeaCompassStore.getState();
  return { entryId, accountId: compass.accountScopeId === app.activeAccountId ? app.activeAccountId : null, userId: app.activeUserId, revision: compass.accountScopeRevision };
}

/** A review of existing evidence, embedded in the record. Extraction is read
 * only; applying selected missing facts uses the record's existing sync path. */
export function TeaRecordAssistant({ entry }: { entry: TeaCompassEntry }) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const revision = useTeaCompassStore(state => state.accountScopeRevision);
  return <AssistantReview key={`${accountId}:${userId}:${revision}:${entry.id}`} entry={entry} />;
}

function AssistantReview({ entry }: { entry: TeaCompassEntry }) {
  const notes = useNotesStore(state => state.notes);
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const scopeAccount = useTeaCompassStore(state => state.accountScopeId);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<TeaRecordReview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [chosenSources, setChosenSources] = useState<Record<string, boolean>>({});
  const [excerpts, setExcerpts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  const pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const scoped = !!accountId && !!userId && accountId === scopeAccount;
  const evidence = useMemo(() => scoped ? collectTeaRecordEvidence(entry, notes, accountId ?? '') : [], [entry, notes, accountId, scoped]);
  const selectedEvidence = useMemo(() => evidence.filter(item => chosenSources[item.id] !== false).map(item => ({ ...item, text: excerpts[item.id] ?? item.text })).filter(item => item.text.trim()), [evidence, chosenSources, excerpts]);
  const material = useMemo(() => teaRecordExtractionText(selectedEvidence, Infinity), [selectedEvidence]);
  const oversized = material.text.length > 4000;
  const alreadyReviewed = review?.request.text === material.text;
  const displayedEvidence = review?.evidence ?? evidence;

  const find = async () => {
    if (pending.current || !scoped || !material.text || alreadyReviewed || oversized) return;
    const scope = currentScope(entry.id);
    const current = useTeaCompassStore.getState().getEntry(entry.id);
    if (!current) { setError('This tea record is no longer available.'); return; }
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await loadTeaRecordReview(current, useNotesStore.getState().notes, scope, () => currentScope(entry.id), input => api.compass.fileSaid(input), selectedEvidence);
      if (!mounted.current || !result || !teaRecordScopeMatches(scope, currentScope(entry.id))) return;
      setReview({ ...result, evidence }); setSelected([]);
    } catch (failure) {
      if (mounted.current && teaRecordScopeMatches(scope, currentScope(entry.id))) {
        setError(plainFailure(failure, 'Finding tea details'));
      }
    } finally {
      if (mounted.current) { pending.current = false; setBusy(false); }
    }
  };

  const toggle = (fact: TeaRecordFact) => setSelected(previous => {
    if (previous.includes(fact.id)) return previous.filter(id => id !== fact.id);
    const keys = Object.keys(fact.patch);
    const conflicts = new Set(review?.facts.filter(other => other.id !== fact.id && Object.keys(other.patch).some(key => keys.includes(key))).map(other => other.id));
    return [...previous.filter(id => !conflicts.has(id)), fact.id];
  });

  const apply = () => {
    if (!review || !selected.length) return;
    if (!teaRecordScopeMatches(review.scope, currentScope(entry.id))) { setReview(null); setSelected([]); setError('The shop or record changed. Review the current material again.'); return; }
    const store = useTeaCompassStore.getState();
    const latest = store.getEntry(entry.id);
    if (!latest) { setError('This tea record is no longer available.'); return; }
    const patch = applyReviewedTeaFacts(latest, review.facts, selected);
    if (Object.keys(patch).length) {
      store.updateEntry(entry.id, patch);
      setMessage('Reviewed details added. Existing answers were kept.');
    } else setMessage('Nothing added. These details already have an answer.');
    setSelected([]);
  };

  return <section aria-label="Tea record assistant" className="min-w-0 space-y-3 border-t border-tea-border pt-4" data-testid="tea-record-assistant">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className={T.h3}>Use your source material</h3>
      <button type="button" onClick={() => void find()} disabled={busy || !scoped || !material.text || alreadyReviewed || oversized}
        className="tap-target inline-flex min-h-11 items-center gap-2 rounded-md border border-tea-border px-3 text-ui-12 text-tea-text disabled:opacity-50">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{busy ? 'Finding details…' : alreadyReviewed ? 'Material reviewed' : 'Find tea details'}
      </button>
    </div>
    <p className="text-ui-12 text-tea-text-sec">Review suggested details before adding them. Sources stay intact.</p>
    {!scoped && <p className="text-ui-12 text-tea-text-dim">Open this record in your signed-in shop to review its material.</p>}
    {!evidence.length && <p className="text-ui-12 text-tea-text-dim">No notes or transcripts yet. Add source material to this tea first.</p>}
    {evidence.length > 0 && <details className="min-w-0">
      <summary className={`${T.label} min-h-11 cursor-pointer text-tea-text-sec`}>Material to review · {selectedEvidence.length} {selectedEvidence.length === 1 ? 'source' : 'sources'}</summary>
      <p className="mb-2 text-ui-11 text-tea-text-dim">Choose sources or shorten their excerpts. Up to 4,000 characters and 12 extracted parts per review.</p>
      <div className="space-y-3">{evidence.map(item => <div key={item.id} className="min-w-0 space-y-2">
        <label className="flex min-h-11 items-center gap-3 text-ui-12 text-tea-text-sec">
          <input type="checkbox" checked={chosenSources[item.id] !== false} disabled={busy} onChange={event => setChosenSources(previous => ({ ...previous, [item.id]: event.target.checked }))} className="h-5 w-5 shrink-0 accent-tea-gold" />
          <span className="break-words">{item.sources.map(source => source.label).join('; ')}</span>
        </label>
        {chosenSources[item.id] !== false && <label className="block text-ui-11 text-tea-text-dim">Excerpt to review
          <textarea value={excerpts[item.id] ?? item.text} disabled={busy} onChange={event => setExcerpts(previous => ({ ...previous, [item.id]: event.target.value }))} rows={3}
            className="input-field mt-1 w-full min-w-0 resize-y px-3 py-2 text-ui-16" />
        </label>}
      </div>)}</div>
      <p role="status" className="mt-2 text-ui-11 text-tea-text-dim">{material.text.length.toLocaleString()} / 4,000 characters{oversized ? '. Choose fewer sources or shorten an excerpt before finding details.' : ''}</p>
    </details>}
    {oversized && <p role="status" className="text-ui-12 text-tea-text-dim">Choose fewer sources or shorten an excerpt to fit 4,000 characters.</p>}
    {error && <p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>}
    {review && <div className="space-y-3">
      {review.request.shortened && <p role="status" className="text-ui-12 text-tea-text-dim">Some long sources were shortened for this review. Full originals remain below.</p>}
      {review.parts.length === 0 && <p className="text-ui-12 text-tea-text-sec">No details could be extracted from this material.</p>}
      {review.parts.length > 0 && review.facts.length === 0 && <p className="text-ui-12 text-tea-text-sec">No missing identity or quote details to add. Extracted material is shown below.</p>}
      {review.parts.map((part, index) => {
        const facts = review.facts.filter(fact => fact.partIndex === index);
        return <article key={index} className="min-w-0 space-y-2 rounded-md border border-tea-border bg-tea-surface p-3">
          <p className={`${T.label} text-tea-text-dim`}>{SAID_LABEL[part.kind]}</p>
          <p className="break-words text-ui-13 text-tea-text">{part.text}</p>
          {Object.keys(part.fields).length > 0 && <dl className="space-y-1 text-ui-12 text-tea-text-sec">{Object.entries(part.fields).filter(([, value]) => detailValue(value) !== null).map(([key, value]) => <div key={key} className="break-words"><dt className="inline capitalize text-tea-text-dim">{key.replace(/_/g, ' ')}: </dt><dd className="inline">{detailValue(value)}</dd></div>)}</dl>}
          {facts.map(fact => <label key={fact.id} className="flex min-h-11 items-center gap-3 text-ui-12 text-tea-text">
            <input type="checkbox" checked={selected.includes(fact.id)} onChange={() => toggle(fact)} className="h-5 w-5 shrink-0 accent-tea-gold" />
            <span className="min-w-0 break-words">{fact.label}</span>
          </label>)}
          {facts.length === 0 && <p className="text-ui-11 text-tea-text-dim">{part.kind === 'tea' || part.kind === 'price' ? 'Existing answers are kept; no applicable missing field.' : 'Kept as source material.'}</p>}
        </article>;
      })}
      {review.facts.length > 0 && <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={apply} disabled={!selected.length || busy} className="cta-solid min-h-11 rounded-md px-4 text-ui-12 disabled:opacity-50">Apply reviewed details</button>
        <p className="text-ui-11 text-tea-text-dim">Select the details to add. Existing answers are kept.</p>
      </div>}
    </div>}
    {message && <p role="status" className="text-ui-12 text-tea-text-sec">{message}</p>}
    {review && displayedEvidence.length > 0 && <details className="min-w-0" open={!!review}>
      <summary className={`${T.label} min-h-11 cursor-pointer text-tea-text-sec`}>Original material ({displayedEvidence.length})</summary>
      <div className="space-y-3">{displayedEvidence.map(item => <div key={item.id} className="min-w-0 border-l border-tea-border pl-3">
        <p className="text-ui-11 text-tea-text-dim">{item.sources.map(source => `${source.label}${source.at ? ` · ${new Date(source.at).toLocaleDateString()}` : ''}`).join('; ')}</p>
        <p className="whitespace-pre-wrap break-words text-ui-12 text-tea-text-sec">{item.text}</p>
        {review && !review.request.reviewedIds.includes(item.id) && <p className="text-ui-11 text-tea-text-dim">Not included in this review.</p>}
      </div>)}</div>
    </details>}
  </section>;
}
