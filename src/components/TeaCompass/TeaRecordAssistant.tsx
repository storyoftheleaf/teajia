import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { arCreateApi, api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useNotesStore } from '../../lib/notesStore';
import { plainFailure } from '../CurateV2/plainFailure';
import { SAID_LABEL } from '../CurateV2/saidFiling';
import { ArTalkLinks, useArTeaSources, type StagedArPassage } from './ArTeaSources';
import { TeaDescriptionReview, teaDescriptionSourceSignature, type DescriptionSelection } from './TeaDescriptionReview';
import { Modal } from '../shared/Modal';
import { syncCompassEntries } from '../../lib/teaCompassSync';
import { useQueryClient } from '@tanstack/react-query';
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
  const [open, setOpen] = useState(false);
  const [committing, setCommitting] = useState(false);
  useEffect(() => setOpen(false), [accountId, userId, revision, entry.id]);
  return <section className="border-t border-tea-border py-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className={T.h3}>Build this tea</h3><button type="button" className="tap-target min-h-11 rounded-md border border-tea-border px-3 text-ui-13 text-tea-text" onClick={() => setOpen(true)}>Build this tea</button></div>
    <p className="mt-1 text-ui-12 text-tea-text-sec">Bring your sources, reviewed details and description together.</p>
    <Modal isOpen={open} onClose={() => { if (!committing) setOpen(false); }} ariaLabel="Build this tea" variant="panel" hideClose>
      {open && <AssistantReview key={`${accountId}:${userId}:${revision}:${entry.id}`} entry={entry} onClose={() => setOpen(false)} onCommitChange={setCommitting} />}
    </Modal>
  </section>;
}

function AssistantReview({ entry, onClose, onCommitChange }: { entry: TeaCompassEntry; onClose: () => void; onCommitChange: (value: boolean) => void }) {
  const queryClient = useQueryClient();
  const savedLinks = useRef(new Map<string, { hash: string }>());
  const [removals, setRemovals] = useState<string[]>([]);
  const removedLinks = useRef(new Set<string>());
  const [staged, setStaged] = useState<StagedArPassage[]>([]);
  const [keepPassages, setKeepPassages] = useState<Record<string, boolean>>({});
  const [description, setDescription] = useState<DescriptionSelection | null>(null);
  const [saving, setSaving] = useState(false);
  const notes = useNotesStore(state => state.notes);
  const arSources = useArTeaSources(entry.id);
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const scopeAccount = useTeaCompassStore(state => state.accountScopeId);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<TeaRecordReview | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [chosenSources, setChosenSources] = useState<Record<string, boolean>>({});
  const [excerpts, setExcerpts] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const pending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const scoped = !!accountId && !!userId && accountId === scopeAccount;
  const evidence = useMemo(() => {
    if (!scoped) return [];
    const saved = collectTeaRecordEvidence(entry, notes, accountId ?? '', arSources.links.filter(link => !removals.includes(link.id) && !staged.some(item => item.sourceId === link.sourceId)));
    return [...saved, ...staged.map(item => ({ id: `staged-ar:${item.requestId}:${item.sourceId}`, text: item.text, sources: [{ id: `staged-ar:${item.requestId}:${item.sourceId}`, label: `AR Create · ${item.title} · unsaved` }] }))];
  }, [entry, notes, accountId, scoped, arSources.links, staged, removals]);
  const selectedEvidence = useMemo(() => evidence.filter(item => chosenSources[item.id] !== false).map(item => ({ ...item, text: excerpts[item.id] ?? item.text })).filter(item => item.text.trim()), [evidence, chosenSources, excerpts]);
  const material = useMemo(() => teaRecordExtractionText(selectedEvidence, Infinity), [selectedEvidence]);
  const oversized = material.text.length > 4000;
  const alreadyReviewed = review?.request.text === material.text;

  const find = async () => {
    if (pending.current || !scoped || !material.text || alreadyReviewed || oversized) return;
    const scope = currentScope(entry.id);
    const current = useTeaCompassStore.getState().getEntry(entry.id);
    if (!current) { setError('This tea record is no longer available.'); return; }
    pending.current = true; setBusy(true); setError('');
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

  const descriptionSources = selectedEvidence.map(item => ({ id: item.id, title: item.sources.map(source => source.label).join('; '), text: item.text }));
  const stagedForProposal = staged.filter(item => selectedEvidence.some(source => source.id === `staged-ar:${item.requestId}:${item.sourceId}`)).map(item => {
    const text = selectedEvidence.find(source => source.id === `staged-ar:${item.requestId}:${item.sourceId}`)!.text;
    const offset = item.text.indexOf(text);
    return { ...item, text, start: offset < 0 ? -1 : item.start + offset, end: offset < 0 ? -1 : item.start + offset + text.length };
  });
  const kept = staged.filter(item => keepPassages[item.sourceId] !== false);
  const selectedCount = removals.length + kept.length + selected.length + (description ? 1 : 0);
  const save = async () => {
    if (saving || !selectedCount || !scoped) return;
    const scope = currentScope(entry.id);
    const store = useTeaCompassStore.getState();
    const latest = store.getEntry(entry.id);
    if (!latest || !latest.synced) { setError('Wait for this tea record to finish saving before accepting changes.'); return; }
    if (selected.length && (!review || !alreadyReviewed || !teaRecordScopeMatches(review.scope, scope))) { setError('The source material changed. Find tea details again before saving them.'); return; }
    if (description && (description.signature !== teaDescriptionSourceSignature(descriptionSources) || (latest.description ?? '') !== (description.baseDescription ?? ''))) { setError('The source material or description changed. Draft the description again before saving.'); return; }
    setSaving(true); onCommitChange(true); setError('');
    let linked = 0;
    try {
      for (const id of removals) {
        if (!mounted.current || !teaRecordScopeMatches(scope, currentScope(entry.id))) return;
        if (!removedLinks.current.has(id)) { await arCreateApi.remove(id); removedLinks.current.add(id); }
      }
      for (const passage of kept) {
        if (!mounted.current || !teaRecordScopeMatches(scope, currentScope(entry.id))) return;
        const existing = savedLinks.current.get(passage.sourceId) ?? arSources.links.find(link => link.sourceId === passage.sourceId);
        await arCreateApi.link({ entryId: entry.id, ...passage, ...(existing ? { expectedHash: existing.hash, update: true } : {}) });
        savedLinks.current.set(passage.sourceId, { hash: passage.hash });
        linked++;
      }
      if (!mounted.current || !teaRecordScopeMatches(scope, currentScope(entry.id))) return;
      const current = store.getEntry(entry.id);
      if (!current) throw new Error('This tea record is no longer available.');
      if (description && (current.description ?? '') !== (description.baseDescription ?? '')) throw new Error('Your description changed during saving. It was kept; review the draft again.');
      const patch = review ? applyReviewedTeaFacts(current, review.facts, selected) : {};
      if (description) Object.assign(patch, { description: description.text });
      if (Object.keys(patch).length) { store.updateEntry(entry.id, patch); await syncCompassEntries(scope.accountId!); }
      await queryClient.invalidateQueries({ queryKey: ['tea-ar-sources'] });
      if (!mounted.current || !teaRecordScopeMatches(scope, currentScope(entry.id))) return;
      if (Object.keys(patch).length && !store.getEntry(entry.id)?.synced) throw new Error('Accepted details are saved on this device and will sync when the connection returns.');
      onClose();
    } catch (failure) {
      if (mounted.current && teaRecordScopeMatches(scope, currentScope(entry.id))) setError(`${linked ? `${linked} passage${linked > 1 ? 's' : ''} linked. ` : ''}${plainFailure(failure, 'Saving accepted changes')}`);
    } finally { onCommitChange(false); if (mounted.current) setSaving(false); }
  };

  return <section className="flex h-full min-h-0 flex-col bg-tea-bg" aria-label="Tea record assistant" data-testid="tea-record-assistant">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-tea-border px-4 py-2 md:px-6">
      <div className="min-w-0"><h2 className={T.h3}>Build this tea</h2><p className="truncate text-ui-12 text-tea-text-sec">{entry.name || entry.chineseName || 'Tea record'}</p></div>
      <button type="button" onClick={onClose} disabled={saving} className="tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec">Discard changes</button>
    </header>
    <div inert={saving || undefined} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-6 lg:grid-cols-2 lg:gap-8">
        <section className="min-w-0 space-y-3" aria-label="Review passage">
          <h3 className={T.h3}>Source passage</h3>
          <p className="text-ui-12 text-tea-text-sec">Choose only the passage about this tea. Everything stays in review until you save.</p>
          <ArTalkLinks entryId={entry.id} entryName={entry.name || entry.chineseName} links={arSources.links.filter(link => !removals.includes(link.id))} onRemove={id => setRemovals(previous => [...new Set([...previous, id])])} onStage={passage => {
            const existing = arSources.links.find(link => link.sourceId === passage.sourceId);
            if (existing) setRemovals(previous => previous.filter(id => id !== existing.id));
            setStaged(previous => [...previous.filter(item => item.sourceId !== passage.sourceId), passage]);
            setKeepPassages(previous => ({ ...previous, [passage.sourceId]: true })); setError('');
          }} />
          {removals.map(id => <div key={id} className="flex flex-wrap items-center justify-between gap-2 text-ui-12 text-tea-text-sec"><span>Link marked for removal · {arSources.links.find(link => link.id === id)?.title}</span><button type="button" className="tap-target min-h-11 px-2" onClick={() => setRemovals(previous => previous.filter(value => value !== id))}>Keep link</button></div>)}
          {arSources.isError && <p className="text-ui-12 text-tea-text-sec">Linked talks could not refresh. Try again shortly.</p>}
          {!scoped && <p className="text-ui-12 text-tea-text-dim">Open this record in your signed-in shop to review its material.</p>}
          {!evidence.length && <p className="text-ui-12 text-tea-text-dim">No notes or transcripts yet. Choose a talk or add source material to this tea.</p>}
          {staged.map(passage => <label key={passage.sourceId} className="flex min-h-11 items-center gap-3 text-ui-12 text-tea-text"><input type="checkbox" checked={keepPassages[passage.sourceId] !== false} onChange={event => setKeepPassages(previous => ({ ...previous, [passage.sourceId]: event.target.checked }))} className="h-5 w-5 shrink-0 accent-tea-gold" /><span>Keep this passage<span className="block text-ui-11 text-tea-text-dim">{passage.title} · not saved</span></span></label>)}
    {evidence.length > 0 && <details className="min-w-0" open>
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
        </section>
        <section className="min-w-0 space-y-5" aria-label="Review AI results">
          <div className="space-y-2 border-b border-tea-border pb-3"><h3 className={T.h3}>Suggested details</h3><p className="text-ui-12 text-tea-text-sec">Choose the details to add. Existing answers are kept.</p>
            <button type="button" onClick={() => void find()} disabled={busy || saving || !scoped || !material.text || alreadyReviewed || oversized} className="tap-target inline-flex min-h-11 items-center gap-2 rounded-md border border-tea-border px-3 text-ui-12 text-tea-text disabled:opacity-50">
              {busy ? <Loader2 size={14} /> : <Sparkles size={14} />}{busy ? 'Finding details…' : alreadyReviewed ? 'Material reviewed' : 'Find tea details'}
            </button>
          </div>
          {oversized && <p role="status" className="text-ui-12 text-tea-text-dim">Choose fewer sources or shorten an excerpt to fit 4,000 characters.</p>}
          {!review && <p className="text-ui-12 text-tea-text-dim">AI suggestions will appear here for your review.</p>}
    {review && <div className="space-y-3">
      {review.request.shortened && <p role="status" className="text-ui-12 text-tea-text-dim">Some long sources were shortened for this review. Full originals remain below.</p>}
      {review.parts.length === 0 && <p className="text-ui-12 text-tea-text-sec">No details could be extracted from this material.</p>}
      {review.parts.length > 0 && review.facts.length === 0 && <p className="text-ui-12 text-tea-text-sec">No missing identity or quote details to add. Extracted material is shown below.</p>}
      {review.parts.map((part, index) => {
        const facts = review.facts.filter(fact => fact.partIndex === index);
        return <article key={index} className="min-w-0 space-y-2 border-b border-tea-border py-3">
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

    </div>}
          <div className="space-y-3 border-t border-tea-border pt-4"><h3 className={T.h3}>Working description</h3><details><summary className="min-h-11 cursor-pointer text-ui-12 text-tea-text-sec">Existing description</summary><p className="whitespace-pre-wrap break-words text-ui-13 text-tea-text-sec">{entry.description || 'No description recorded.'}</p></details>
            <TeaDescriptionReview entry={entry} sources={descriptionSources} stagedArSources={stagedForProposal} onSelection={setDescription} />
          </div>
        </section>
      </div>
    </div>
    <footer className="shrink-0 border-t border-tea-border bg-tea-bg px-4 pt-2 pb-nav-gap md:px-6">
      {error && <p role="alert" className="mb-2 text-ui-12 text-tea-text-sec">{error}</p>}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2"><p role="status" className="text-ui-11 text-tea-text-sec">{selectedCount ? `${selectedCount} accepted · same tea record` : 'Nothing saved. Select what to keep.'}</p>
        <button type="button" disabled={saving || busy || !selectedCount} onClick={() => void save()} className="cta-solid min-h-11 rounded-md px-4 text-ui-13 disabled:opacity-50">{saving ? 'Saving…' : 'Save accepted changes'}</button>
      </div>
    </footer>
  </section>;
}
