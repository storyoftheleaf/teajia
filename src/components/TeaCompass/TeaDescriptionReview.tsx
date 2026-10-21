import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { syncCompassEntries } from '../../lib/teaCompassSync';
import { syncNotes } from '../../lib/notesSync';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import type { TeaCompassEntry } from './types';
import type { StagedArPassage } from './ArTeaSources';

export interface TeaDescriptionSource { id: string; title: string; text: string; url?: string }
export interface TeaDescriptionProposal {
  description: string;
  citations: Array<{ sourceId: string; quote: string }>;
  baseDescription: string | null;
  paragraphs?: Array<{ text: string; citations: Array<{ sourceId: string; quote: string }> }>;
}
export interface TeaDescriptionScope { accountId: string | null; userId: string | null; revision: number; entryId: string }
export const teaDescriptionSourceSignature = (sources: readonly TeaDescriptionSource[]) => JSON.stringify(sources.map(source => [source.id, source.title, source.text]));
const descriptionText = (value: string | null | undefined) => value ?? '';
const sameScope = (a: TeaDescriptionScope, b: TeaDescriptionScope) => a.accountId === b.accountId && a.userId === b.userId && a.revision === b.revision && a.entryId === b.entryId;
export function teaDescriptionReviewConflict(input: {
  capturedScope: TeaDescriptionScope; currentScope: TeaDescriptionScope;
  capturedSources: string; currentSources: string;
  baseDescription: string | null; currentDescription: string | null | undefined;
}): string | null {
  if (!sameScope(input.capturedScope, input.currentScope) || !input.currentScope.accountId || !input.currentScope.userId) return 'The shop or tea record changed. Draft from the current record again.';
  if (input.capturedSources !== input.currentSources) return 'The selected source material changed. Draft from the current selection again.';
  if (descriptionText(input.baseDescription) !== descriptionText(input.currentDescription)) return 'The description changed while this proposal was being reviewed. Your current description was kept.';
  return null;
}
function scopeFor(entryId: string): TeaDescriptionScope {
  const app = useAppStore.getState();
  const compass = useTeaCompassStore.getState();
  return { accountId: app.activeAccountId === compass.accountScopeId ? app.activeAccountId : null, userId: app.activeUserId, revision: compass.accountScopeRevision, entryId };
}
interface Review { proposal: TeaDescriptionProposal; scope: TeaDescriptionScope; signature: string; sourceTitles: Record<string, string> }
interface Accepted { scope: TeaDescriptionScope; previous: string | null; applied: string }

export interface DescriptionSelection { text: string; baseDescription: string | null; signature: string }
type DescriptionProps = { entry: TeaCompassEntry; sources: TeaDescriptionSource[]; stagedArSources?: StagedArPassage[]; onSelection?: (selection: DescriptionSelection | null) => void };
export function TeaDescriptionReview({ entry, sources, stagedArSources, onSelection }: DescriptionProps) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const revision = useTeaCompassStore(state => state.accountScopeRevision);
  return <DescriptionReview key={`${accountId}:${userId}:${revision}:${entry.id}`} entry={entry} sources={sources} stagedArSources={stagedArSources} onSelection={onSelection} />;
}
function DescriptionReview({ entry, sources, stagedArSources, onSelection }: DescriptionProps) {
  const [review, setReview] = useState<Review | null>(null);
  const [keep, setKeep] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [accepted, setAccepted] = useState<Accepted | null>(null);
  const live = useRef(true);
  const pending = useRef(false);
  const currentProps = useRef({ entryId: entry.id, signature: teaDescriptionSourceSignature(sources) });
  currentProps.current = { entryId: entry.id, signature: teaDescriptionSourceSignature(sources) };
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const ready = !!scopeFor(entry.id).accountId && !!scopeFor(entry.id).userId;
  const oversized = sources.length > 12 || sources.reduce((sum, source) => sum + source.text.length, 0) > 12000;
  const conflictFor = (candidate: Review) => teaDescriptionReviewConflict({
    capturedScope: candidate.scope, currentScope: scopeFor(currentProps.current.entryId), capturedSources: candidate.signature,
    currentSources: currentProps.current.signature, baseDescription: candidate.proposal.baseDescription,
    currentDescription: useTeaCompassStore.getState().getEntry(candidate.scope.entryId)?.description,
  });
  const generate = async () => {
    if (pending.current || !ready || !sources.length || oversized) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    const scope = scopeFor(entry.id);
    const selected = sources.map(source => ({ ...source }));
    const signature = teaDescriptionSourceSignature(selected);
    const before = useTeaCompassStore.getState().getEntry(entry.id);
    const initialDescription = descriptionText(before?.description);
    try {
      if (!before) throw new Error('This tea record is no longer available.');
      // Preview must never flush local edits or source links to the server.
      if (!onSelection) { await syncCompassEntries(scope.accountId!); await syncNotes(); }
      if (!live.current || !sameScope(scope, scopeFor(currentProps.current.entryId))) return;
      if (currentProps.current.signature !== signature) { setError('The selected source material changed. Draft from the current selection again.'); return; }
      if (!useTeaCompassStore.getState().getEntry(entry.id)?.synced) { setError('This tea record has not finished saving. Check the connection and try drafting again.'); return; }
      const proposal: TeaDescriptionProposal = await api.compass.proposeDescription({ entryId: entry.id, sources: selected.filter(source => !/^(staged-ar:|draft-note:|research:)/.test(source.id)), draftSources: selected.filter(source => /^(draft-note:|research:)/.test(source.id)), stagedArSources });
      if (!live.current || !sameScope(scope, scopeFor(currentProps.current.entryId))) return;
      const candidate: Review = { proposal, scope, signature, sourceTitles: Object.fromEntries(selected.map(source => [source.id, source.title])) };
      const conflict = conflictFor(candidate);
      if (conflict) { setError(conflict); return; }
      if (initialDescription !== descriptionText(proposal.baseDescription)) { setError('The saved description changed during drafting. Review the current description and draft again.'); return; }
      if (typeof proposal.description !== 'string' || !proposal.description.trim() || !Array.isArray(proposal.citations) || !proposal.citations.length) { setError('The draft did not include a supported description and sources. Try again.'); return; }
      setReview(candidate); setDraft(proposal.description); setAccepted(null); setKeep(false);
    } catch (failure) {
      if (live.current && sameScope(scope, scopeFor(currentProps.current.entryId))) setError(failure instanceof Error ? failure.message : 'Could not draft this description. Try again.');
    } finally { pending.current = false; if (live.current) setBusy(false); }
  };
  const apply = () => {
    if (!review || !draft.trim()) return;
    const conflict = conflictFor(review);
    if (conflict) { setError(conflict); return; }
    const store = useTeaCompassStore.getState();
    const latest = store.getEntry(review.scope.entryId);
    if (!latest) { setError('This tea record is no longer available.'); return; }
    const applied = draft.trim();
    store.updateEntry(latest.id, { description: applied });
    setAccepted({ scope: review.scope, previous: latest.description ?? null, applied });
    setReview(null); setError(''); setMessage('Description saved to this tea record.');
    void syncCompassEntries(review.scope.accountId!).catch(() => {});
  };
  const undo = () => {
    if (!accepted) return;
    const store = useTeaCompassStore.getState();
    const latest = store.getEntry(accepted.scope.entryId);
    if (!sameScope(accepted.scope, scopeFor(currentProps.current.entryId)) || !latest || descriptionText(latest.description) !== accepted.applied) { setError('The description changed after this save. Your later edits were kept.'); return; }
    store.updateEntry(latest.id, { description: accepted.previous });
    setAccepted(null); setError(''); setMessage('Previous description restored.');
    void syncCompassEntries(accepted.scope.accountId!).catch(() => {});
  };
  const visibleConflict = review ? conflictFor(review) : null;
  useEffect(() => {
    onSelection?.(review && keep && !visibleConflict && draft.trim() ? { text: draft.trim(), baseDescription: review.proposal.baseDescription, signature: review.signature } : null);
  }, [draft, keep, review, visibleConflict, onSelection]);
  return <section aria-label="Draft tea description" className="min-w-0 space-y-3" data-testid="tea-description-review">
    <button type="button" onClick={() => void generate()} disabled={busy || !ready || !sources.length || oversized}
      className="tap-target min-h-11 inline-flex items-center gap-2 rounded-md border border-tea-border px-3 text-left text-ui-12 text-tea-text disabled:opacity-50">
      {busy ? <Loader2 size={14} className="shrink-0 animate-spin" /> : <Sparkles size={14} className="shrink-0" />}
      {busy ? 'Drafting description…' : 'Draft description from selected material'}
    </button>
    {oversized && <p className="text-ui-12 text-tea-text-sec">Choose up to 12 sources and 12,000 characters. Full originals stay intact.</p>}
    {review && <div className="space-y-3 rounded-md border border-tea-border bg-tea-surface p-3">
      <p className="text-ui-12 text-tea-text-sec">A proposed description from your material. Review the wording and sources before saving.</p>
      <details><summary className={`${T.label} min-h-11 cursor-pointer`}>Current description</summary><p className="whitespace-pre-wrap break-words text-ui-13 text-tea-text-sec">{review.proposal.baseDescription || 'No description recorded.'}</p></details>
      <label className="block text-ui-12 text-tea-text-sec">Public description draft<textarea aria-label="Proposed description" value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} rows={12} className="input-field mt-1 w-full min-w-0 resize-y px-3 py-2 text-ui-16" /></label>
      <details><summary className={`${T.label} min-h-11 cursor-pointer`}>Sources used ({review.proposal.citations.length})</summary>
        <div className="space-y-3">{review.proposal.citations.map((citation, index) => <blockquote key={`${citation.sourceId}:${index}`} className="border-l border-tea-border pl-3">
          <p className="text-ui-11 text-tea-text-dim">{citation.sourceId === 'tea-record' ? 'Existing tea record' : review.sourceTitles[citation.sourceId] || citation.sourceId}</p>
          <p className="whitespace-pre-wrap break-words text-ui-13 text-tea-text-sec">{citation.quote}</p>
        </blockquote>)}</div>
      </details>
      <div className="flex flex-wrap items-center gap-3">{onSelection ? <label className="flex min-h-11 items-center gap-3 text-ui-13 text-tea-text"><input type="checkbox" checked={keep} disabled={!!visibleConflict || busy} onChange={event => setKeep(event.target.checked)} className="h-5 w-5 accent-tea-gold" />Save this description</label> : <button type="button" disabled={!draft.trim() || !!visibleConflict || busy} onClick={apply} className="cta-solid min-h-11 rounded-md px-4 text-ui-12 disabled:opacity-50">Use this description</button>}<button type="button" disabled={busy} onClick={() => { setReview(null); setError(''); }} className="tap-target min-h-11 px-2 text-ui-12 text-tea-text-sec">Discard draft</button></div>
    </div>}
    {(error || visibleConflict) && <p role="alert" className="text-ui-12 text-tea-text-sec">{error || visibleConflict}</p>}
    {message && <p role="status" className="text-ui-12 text-tea-text-sec">{message}</p>}
    {accepted && <button type="button" onClick={undo} className="tap-target min-h-11 text-ui-12 text-tea-gold">Undo description change</button>}
  </section>;
}
