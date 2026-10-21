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
import { DraftVoiceMaterial } from './DraftVoiceMaterial';
import { WorkingMaterialReview, type WorkingMaterialResult } from './WorkingMaterialReview';
import { useLiveTeaTranscripts } from './useLiveTeaTranscripts';
import { syncNotes } from '../../lib/notesSync';
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
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [draftNotes, setDraftNotes] = useState('');
  const [research, setResearch] = useState('');
  const [keepNotes, setKeepNotes] = useState(false);
  const [working, setWorking] = useState<WorkingMaterialResult | undefined>();
  const [workingKey, setWorkingKey] = useState('');
  const [workingBusy, setWorkingBusy] = useState(false);
  const [workingError, setWorkingError] = useState('');
  const [workingSelected, setWorkingSelected] = useState<string[]>([]);
  const savedNote = useRef<string | null>(null);

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
  useEffect(() => { onCommitChange(saving || voiceBusy); return () => onCommitChange(false); }, [saving, voiceBusy, onCommitChange]);
  const scoped = !!accountId && !!userId && accountId === scopeAccount;
  const evidence = useMemo(() => {
    if (!scoped) return [];
    const saved = collectTeaRecordEvidence(entry, notes, accountId ?? '', arSources.links.filter(link => link.mode !== 'full' && !removals.includes(link.id) && !staged.some(item => item.sourceId === link.sourceId)));
    return [...saved, ...staged.filter(item => item.mode !== 'full').map(item => ({ id: `staged-ar:${item.requestId}:${item.sourceId}`, text: item.text, sources: [{ id: `staged-ar:${item.requestId}:${item.sourceId}`, label: `AR Create · ${item.title} · unsaved` }] }))];
  }, [entry, notes, accountId, scoped, arSources.links, staged, removals]);
  const selectedEvidence = useMemo(() => evidence.filter(item => chosenSources[item.id] !== false).map(item => ({ ...item, text: excerpts[item.id] ?? item.text })).filter(item => item.text.trim()), [evidence, chosenSources, excerpts]);
  const material = useMemo(() => teaRecordExtractionText(selectedEvidence, Infinity), [selectedEvidence]);
  const oversized = material.text.length > 4000;
  const alreadyReviewed = review?.request.text === material.text;

  const fullSources = staged.filter(item => item.mode === 'full' && keepPassages[item.sourceId] !== false);
  const fullKey = JSON.stringify(fullSources.map(item => [item.sourceId, item.hash, item.text]));
  const fullKeyRef = useRef(fullKey); fullKeyRef.current = fullKey;
  const workingStale = !!working && workingKey !== fullKey;
  const stage = (passage: StagedArPassage) => {
    const existing = arSources.links.find(link => link.sourceId === passage.sourceId);
    if (existing) setRemovals(previous => previous.filter(id => id !== existing.id));
    setStaged(previous => [...previous.filter(item => item.sourceId !== passage.sourceId), passage]);
    setKeepPassages(previous => ({ ...previous, [passage.sourceId]: previous[passage.sourceId] ?? true }));
    setError('');
  };
  const liveSources = useLiveTeaTranscripts(arSources.links.filter(link => !removals.includes(link.id)), staged, stage, !saving);
  const analyzePending = useRef(false);
  const analyze = async () => {
    if (analyzePending.current || !scoped || !fullSources.length) return;
    const scope = currentScope(entry.id); const key = fullKey;
    analyzePending.current = true; setWorkingBusy(true); setWorkingError('');
    try {
      const result = await api.compass.workingMaterial({ entryId: entry.id, sources: fullSources });
      if (!mounted.current || !teaRecordScopeMatches(scope, currentScope(entry.id)) || fullKeyRef.current !== key) return;
      setWorking(result); setWorkingKey(key); setWorkingSelected([]);
    } catch (failure) {
      if (mounted.current && teaRecordScopeMatches(scope, currentScope(entry.id))) setWorkingError(plainFailure(failure, 'Reviewing the full transcript'));
    } finally { analyzePending.current = false; if (mounted.current) setWorkingBusy(false); }
  };
  // After the first review, edits to an original refresh derived material only.
  // Public writing remains a separate draft requiring review and acceptance.
  useEffect(() => {
    if (working && workingStale && !workingBusy && !workingError) void analyze();
  }, [fullKey, workingStale, workingBusy, workingError]);

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

  const excerptDescriptionSources = selectedEvidence.map(item => ({ id: item.id, title: item.sources.map(source => source.label).join('; '), text: item.text }));
  const excerptProposals = staged.filter(item => item.mode !== 'full').filter(item => selectedEvidence.some(source => source.id === `staged-ar:${item.requestId}:${item.sourceId}`)).map(item => {
    const text = selectedEvidence.find(source => source.id === `staged-ar:${item.requestId}:${item.sourceId}`)!.text;
    const offset = item.text.indexOf(text);
    return { ...item, text, start: offset < 0 ? -1 : item.start + offset, end: offset < 0 ? -1 : item.start + offset + text.length };
  });
  const fragments = !workingStale ? (working?.notes ?? []).filter(note => workingSelected.includes(note.id)).flatMap(note => {
    const source = fullSources.find(item => item.sourceId === note.sourceId);
    if (!source || source.text.slice(note.start, note.end) !== note.quote) return [];
    return [{ ...source, text: note.quote, start: note.start, end: note.end, mode: 'excerpt' as const, fragment: true }];
  }) : [];
  const fragmentSources = fragments.map(item => ({ id: `staged-ar:${item.requestId}:${item.sourceId}:${item.start}:${item.end}`, title: item.title, text: item.text }));
  const draftSources = [
    ...(draftNotes.trim() ? [{ id: 'draft-note:working', title: 'Your notes and voice memos', text: draftNotes.trim() }] : []),
    ...(research.trim() ? [{ id: 'research:working', title: 'Research and references supplied for review', text: research.trim() }] : []),
  ];
  const descriptionSources = [...excerptDescriptionSources, ...fragmentSources, ...draftSources];
  const stagedForProposal = [...excerptProposals, ...fragments];
  const workingNoteText = [draftNotes.trim(), research.trim() && `Research and references:\n${research.trim()}`,
    ...(!workingStale ? (working?.notes ?? []).filter(note => workingSelected.includes(note.id)).map(note => `${note.text}\nSource: ${note.title} [${note.start}:${note.end}]\n“${note.quote}”`) : []),
  ].filter(Boolean).join('\n\n');
  const kept = staged.filter(item => keepPassages[item.sourceId] !== false);
  const selectedCount = removals.length + kept.length + selected.length + (description ? 1 : 0) + (keepNotes && workingNoteText ? 1 : 0);
  const save = async () => {
    if (saving || voiceBusy || workingBusy || !selectedCount || !scoped) return;
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
      if (!mounted.current || !teaRecordScopeMatches(scope, currentScope(entry.id))) return;
      if (keepNotes && workingNoteText) {
        const noteStore = useNotesStore.getState();
        if (savedNote.current) noteStore.updateNote(savedNote.current, workingNoteText);
        else savedNote.current = noteStore.addNote({ accountId: scope.accountId!, compassEntryId: entry.id, teaKey: current.teaKey ?? undefined, text: workingNoteText, sourceType: 'manual', authorId: scope.userId!, authorName: 'You', visibility: 'private' }).id;
        await syncNotes();
      }
      await queryClient.invalidateQueries({ queryKey: ['tea-ar-sources'] });
      if (!mounted.current || !teaRecordScopeMatches(scope, currentScope(entry.id))) return;
      if (Object.keys(patch).length && !store.getEntry(entry.id)?.synced) throw new Error('Accepted details are saved on this device and will sync when the connection returns.');
      if (keepNotes && savedNote.current && !useNotesStore.getState().notes.find(note => note.id === savedNote.current)?.synced) throw new Error('Working notes are saved on this device and will sync when the connection returns.');
      onClose();
    } catch (failure) {
      if (mounted.current && teaRecordScopeMatches(scope, currentScope(entry.id))) setError(`${linked ? `${linked} passage${linked > 1 ? 's' : ''} linked. ` : ''}${plainFailure(failure, 'Saving accepted changes')}`);
    } finally { onCommitChange(false); if (mounted.current) setSaving(false); }
  };

  return <section className="flex h-full min-h-0 flex-col bg-tea-bg" aria-label="Tea record assistant" data-testid="tea-record-assistant">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-tea-border px-4 py-1 md:px-6">
      <div className="min-w-0"><h2 className={T.h3}>Build this tea</h2><p className="truncate text-ui-12 text-tea-text-sec">{entry.name || entry.chineseName || 'Tea record'}</p></div>
      <button type="button" onClick={onClose} disabled={saving || voiceBusy} className="tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec">Discard changes</button>
    </header>
    <div inert={saving || undefined} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 lg:overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 gap-6 lg:h-full lg:grid-cols-2 lg:gap-8">
        <section className="min-w-0 space-y-4 lg:overflow-y-auto lg:pr-2" aria-label="Working material">
          <div><h3 className={T.h3}>Working material</h3><p className="mt-1 text-ui-12 text-tea-text-sec">Your complete sources, private notes and research. This is the material you write from.</p></div>
          <ArTalkLinks entryId={entry.id} entryName={entry.name || entry.chineseName} links={arSources.links.filter(link => !removals.includes(link.id))} onRemove={id => {
            const sourceId = arSources.links.find(link => link.id === id)?.sourceId;
            setRemovals(previous => [...new Set([...previous, id])]);
            if (sourceId) { setStaged(previous => previous.filter(item => item.sourceId !== sourceId)); setKeepPassages(previous => ({ ...previous, [sourceId]: false })); }
          }} onStage={stage} />
          {fullSources.length > 0 && <div className="space-y-2 rounded-md border border-tea-border bg-tea-surface p-3">
            {fullSources.map(source => <details key={source.sourceId}><summary className="min-h-11 cursor-pointer break-words text-ui-13 text-tea-text">{source.title} · full transcript</summary><p className="text-ui-11 text-tea-text-dim">{source.text.length.toLocaleString()} characters · original remains in AR Create</p><textarea aria-label="Live full transcript" readOnly rows={7} value={source.text} className="input-field mt-2 w-full min-w-0 px-3 py-2 text-ui-16" /></details>)}
            <p role="status" className="text-ui-11 text-tea-text-sec">{liveSources.checking ? 'Checking the original…' : liveSources.message || 'Full transcript ready for review.'}</p>
            <button type="button" disabled={liveSources.checking} onClick={liveSources.refresh} className="tap-target min-h-11 text-ui-12 text-tea-text-sec">Refresh originals</button>
          </div>}
          <WorkingMaterialReview result={working} busy={workingBusy} stale={workingStale} selected={workingSelected} onToggle={id => setWorkingSelected(previous => previous.includes(id) ? previous.filter(value => value !== id) : [...previous, id])} onAnalyze={() => void analyze()} canAnalyze={scoped && fullSources.length > 0} error={workingError} />
          <DraftVoiceMaterial entryId={entry.id} onBusyChange={setVoiceBusy} onTranscript={text => { setDraftNotes(previous => [previous, text].filter(Boolean).join('\n\n')); setKeepNotes(false); }} />
          <label className="block text-ui-12 text-tea-text-sec">Your notes and voice transcripts<textarea aria-label="Working notes" value={draftNotes} onChange={event => setDraftNotes(event.target.value)} rows={4} maxLength={12000} className="input-field mt-1 w-full min-w-0 resize-y px-3 py-2 text-ui-16" placeholder="Add what you know about this tea. Voice memos appear here for correction." /></label>
          <details><summary className="min-h-11 cursor-pointer text-ui-12 text-tea-text-sec">Research and references</summary><label className="block text-ui-12 text-tea-text-sec">Confirmed background and source links<textarea aria-label="Research working material" value={research} onChange={event => setResearch(event.target.value)} rows={6} maxLength={12000} className="input-field mt-1 w-full min-w-0 resize-y px-3 py-2 text-ui-16" placeholder="Keep general regional history separate from facts about this particular lot. Include your references." /></label></details>
          {(draftNotes || research || workingSelected.length > 0) && <label className="flex min-h-11 items-center gap-3 text-ui-12 text-tea-text"><input type="checkbox" checked={keepNotes} disabled={workingStale || workingBusy} onChange={event => setKeepNotes(event.target.checked)} className="h-5 w-5 accent-tea-gold" />Keep these working notes in this tea record</label>}
          {removals.map(id => <div key={id} className="flex flex-wrap items-center justify-between gap-2 text-ui-12 text-tea-text-sec"><span>Link marked for removal · {arSources.links.find(link => link.id === id)?.title}</span><button type="button" className="tap-target min-h-11 px-2" onClick={() => setRemovals(previous => previous.filter(value => value !== id))}>Keep link</button></div>)}
          {arSources.isError && <p className="text-ui-12 text-tea-text-sec">Linked talks could not refresh. Try again shortly.</p>}
          {!scoped && <p className="text-ui-12 text-tea-text-dim">Open this record in your signed-in shop to review its material.</p>}
          {!evidence.length && !fullSources.length && !draftNotes && <p className="text-ui-12 text-tea-text-dim">No notes or transcripts yet. Choose a talk or add source material to this tea.</p>}
          {staged.map(passage => <label key={passage.sourceId} className="flex min-h-11 items-center gap-3 text-ui-12 text-tea-text"><input type="checkbox" checked={keepPassages[passage.sourceId] !== false} onChange={event => setKeepPassages(previous => ({ ...previous, [passage.sourceId]: event.target.checked }))} className="h-5 w-5 shrink-0 accent-tea-gold" /><span>{passage.mode === 'full' ? 'Keep this full transcript linked' : 'Keep this passage'}<span className="block text-ui-11 text-tea-text-dim">{passage.title} · not saved</span></span></label>)}
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
        <section className="min-w-0 space-y-5 lg:overflow-y-auto lg:pr-2" aria-label="Public description">
          <div className="space-y-3"><h3 className={T.h3}>Public description</h3><p className="text-ui-12 text-tea-text-sec">Write for the shop from the material you have reviewed. Supplier claims stay attributed; uncertain details and unrecorded tasting notes stay out.</p><TeaDescriptionReview entry={entry} sources={descriptionSources} stagedArSources={stagedForProposal} onSelection={setDescription} /></div>
          <details className="border-t border-tea-border pt-3"><summary className="min-h-11 cursor-pointer text-ui-12 text-tea-text-sec">Fill missing record details from notes or a passage</summary>
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
          </details>
        </section>
      </div>
    </div>
    <footer className="shrink-0 border-t border-tea-border bg-tea-bg px-4 pt-2 pb-nav-gap md:px-6">
      {error && <p role="alert" className="mb-2 text-ui-12 text-tea-text-sec">{error}</p>}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2"><p role="status" className="text-ui-11 text-tea-text-sec">{selectedCount ? `${selectedCount} accepted · same tea record` : 'Nothing saved. Select what to keep.'}</p>
        <button type="button" disabled={saving || busy || workingBusy || voiceBusy || !selectedCount} onClick={() => void save()} className="cta-solid min-h-11 rounded-md px-4 text-ui-13 disabled:opacity-50">{saving ? 'Saving…' : 'Save accepted changes'}</button>
      </div>
    </footer>
  </section>;
}
