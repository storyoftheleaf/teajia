import { Button } from '../../../components/shared/Button';
import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ImageOverlayModal } from '../../../components/shop/alcove/AlcoveModals';
import { QUIET_LINK } from '../../../pages/wisdom/frame';
import { BASE, EMPTY, guidePath, KINDS, potPath, saveReview, type ChangeClay, type ClayAction, type Auth, type Board, type Decision, type Pot } from './data';
import { useReviewPhotos } from './Photos';
import { shapeLibraryPath } from './shapeData';

const FIELD_LABELS = { clay: 'Clay', color: 'Observed fired color', shape: 'Shape' };
const fieldClass = 'mt-1 block w-full min-w-0 rounded-md border border-tea-border bg-tea-surface p-2 text-tea-text';

export function Review({ board, pot, auth, draft: pending, onDraft, onSave, onReload, onClay }: {
  board: Board; pot: Pot; auth: Auth; onClay: ChangeClay; draft?: Decision; onDraft: (decision: Decision) => void; onSave: (decision: Decision) => void; onReload: () => Promise<void>;
}) {
  const [params, setParams] = useSearchParams();
  const originals = params.get('view') === 'original';
  const { urls, failed } = useReviewPhotos(pot.photos.map(p => originals ? p.originalSha256 : p.sha256), auth);
  const [zoom, setZoom] = useState<string | null>(null);
  const [draft, setDraft] = useState<Decision>(pending ?? board.decisions[pot.id] ?? EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [conflict, setConflict] = useState(false);
  const { entries } = board.reference;
  const idx = board.pots.findIndex(p => p.id === pot.id);
  const comparisons = pot.comparisonIds.flatMap(id => entries.filter(e => e.id === id));

  const clayGuesses = comparisons.filter(entry => entry.kind === 'clay');
  const otherComparisons = comparisons.filter(entry => entry.kind !== 'clay');

  async function chooseClay(id: string, action: ClayAction) {
    if (saving || conflict) return;
    setSaving(true);
    setMessage('');
    try {
      setDraft(await onClay(pot.id, id, action, draft.revision));
      setMessage(action === 'approve' ? (id ? 'Clay applied.' : 'Clay cleared.')
        : action === 'deny' ? 'Suggestion denied.' : 'Denial undone.');
    } catch (error) {
      setConflict(error instanceof Error && 'status' in error && error.status === 409);
      setMessage(error instanceof Error ? error.message : 'Unable to save the clay decision.');
    } finally { setSaving(false); }
  }

  function edit(key: 'note' | typeof KINDS[number], value: string) {
    const next = { ...draft, [key]: value };
    onDraft(next);
    setDraft(next);
    setMessage('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || conflict) return;
    setSaving(true);
    setMessage('');
    try {
      const saved = await saveReview(pot.id, draft, auth);
      onSave(saved);
      setDraft(saved);
      setMessage('Review saved.');
    } catch (error) {
      setConflict(error instanceof Error && 'status' in error && error.status === 409);
      setMessage(error instanceof Error ? error.message : 'Unable to save this review.');
    } finally { setSaving(false); }
  }
  return <>
    <h1 className="type-page-title font-display">{pot.name}</h1>
    <nav aria-label="Review navigation" className="my-2 flex flex-wrap gap-x-3 gap-y-1">
      <Link className={QUIET_LINK} to={BASE}>All pots</Link>
      <Link className={QUIET_LINK} to={potPath(pot.id) + '/listing'}>Listing preview</Link>
      <Link className={QUIET_LINK} to={guidePath(pot)}>Yixing Wisdom</Link>
      <Link className={QUIET_LINK} to={shapeLibraryPath(pot.id, false, originals)}>Compare shapes</Link>
      {idx > 0 && <Link className={QUIET_LINK} to={potPath(board.pots[idx - 1].id)}>Previous pot</Link>}
      {idx + 1 < board.pots.length && <Link className={QUIET_LINK} to={potPath(board.pots[idx + 1].id)}>Next pot</Link>}
    </nav>
    <div className="my-3 flex gap-3">
      {pot.photos.map((photo, i) => <figure className="m-0 min-w-0 max-w-64 flex-1" key={photo.sha256}>
        <Button variant="plain" type="button" className="block aspect-square w-full bg-tea-surface" aria-label={'Enlarge ' + photo.role}
         disabled={!urls[i]} onClick={() => setZoom(urls[i])}>
          {urls[i] && <img src={urls[i]} alt={photo.role} className="h-full w-full object-contain" />}
        </Button>
        <figcaption className="text-tea-text-dim">{photo.role}</figcaption>
      </figure>)}
    </div>
    {failed && <p role="status">Photo unavailable</p>}
    <Button variant="plain" type="button" className={QUIET_LINK} onClick={() => setParams(originals ? {} : { view: 'original' })}>
      {originals ? 'Show listing crops' : 'Compare original photos'}
    </Button>
    <h2 className="type-section-heading mt-4 font-display">Photo observations</h2>
    <p>{pot.observation}</p>
    {otherComparisons.length > 0 && <p className="flex flex-wrap items-baseline gap-x-2">Compare {otherComparisons.map(e =>
      <Link key={e.id} className={QUIET_LINK} to={guidePath(pot, e.id)}>{e.name}</Link>)}</p>}
    <h2 className="type-section-heading mt-4 font-display">Your confirmation</h2>
    <form onSubmit={submit}>
      <fieldset className="min-w-0" disabled={saving}>
        <section aria-label="Suggested clay" className="mb-3">
          {clayGuesses.length === 0 && <p className="text-tea-text-sec">No clay suggestion from these photos.</p>}
          {clayGuesses.map(entry => {
            const approved = draft.clay === entry.id;
            const denied = draft.rejectedClays?.includes(entry.id);
            return <div key={entry.id}>
              <p><strong>{approved ? 'Approved clay' : denied ? 'Denied suggestion' : 'Suggested clay'} · {entry.name}</strong></p>
              {pot.clayLead?.note && <p className="text-tea-text-sec">{pot.clayLead.note}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {approved ? <Button variant="secondary" type="button" disabled={conflict} onClick={() => void chooseClay('', 'approve')}>Clear approval</Button>
                  : denied ? <Button variant="secondary" type="button" disabled={conflict} onClick={() => void chooseClay(entry.id, 'undo')}>Undo denial</Button>
                    : <>
                      <Button variant="primary" type="button" disabled={conflict} onClick={() => void chooseClay(entry.id, 'approve')}>Approve {entry.name}</Button>
                      <Button variant="secondary" type="button" disabled={conflict} onClick={() => void chooseClay(entry.id, 'deny')}>Deny {entry.name}</Button>
                    </>}
              </div>
            </div>;
          })}
          {!clayGuesses.length && pot.clayLead?.note && <p className="text-tea-text-sec">{pot.clayLead.note}</p>}
        </section>
        <div className="grid gap-3 sm:grid-cols-3">
          {KINDS.map(kind => <label key={kind} className="min-w-0">{FIELD_LABELS[kind]}
            <select className={fieldClass} name={kind} value={draft[kind]} disabled={kind === 'clay' && conflict} onChange={e => kind === 'clay' ? void chooseClay(e.target.value, 'approve') : edit(kind, e.target.value)}>
              <option value="">Unconfirmed</option>
              {entries.filter(e => e.kind === kind).map(e => <option key={e.id} value={e.id}>{e.name}{e.chinese && ' · ' + e.chinese}</option>)}
            </select>
          </label>)}
        </div>
        <label className="mt-3 block">Private evidence note
          <textarea className={fieldClass} rows={2} maxLength={1600} value={draft.note} onChange={e => edit('note', e.target.value)} />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="primary" type="submit" disabled={conflict}>{saving ? 'Saving…' : 'Save review'}</Button>
          {message && <span role="status">{message}</span>}
          {conflict && <Button variant="secondary" type="button" onClick={async () => {
            try { await onReload(); } catch { setMessage('Reload failed. Try again.'); }
          }}>Reload saved choices</Button>}
        </div>
      </fieldset>
    </form>
    <ImageOverlayModal open={!!zoom} itemName={pot.name} expandedImageUrl={zoom} onClose={() => setZoom(null)} />
  </>;
}
