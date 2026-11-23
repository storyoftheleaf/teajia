import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ImageOverlayModal } from '../../../components/shop/alcove/AlcoveModals';
import { QUIET_LINK } from '../../../pages/wisdom/frame';
import { BASE, EMPTY, guidePath, KINDS, potPath, saveReview, type Auth, type Board, type Decision, type Pot } from './data';
import { useReviewPhotos } from './Photos';

const FIELD_LABELS = { clay: 'Clay', color: 'Observed fired color', shape: 'Shape' };
const fieldClass = 'mt-1 block w-full min-w-0 rounded-md border border-tea-border bg-tea-surface p-2 text-tea-text';

export function Review({ board, pot, auth, draft: pending, onDraft, onSave, onReload }: {
  board: Board; pot: Pot; auth: Auth; draft?: Decision; onDraft: (decision: Decision) => void; onSave: (decision: Decision) => void; onReload: () => Promise<void>;
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
      {idx > 0 && <Link className={QUIET_LINK} to={potPath(board.pots[idx - 1].id)}>Previous pot</Link>}
      {idx + 1 < board.pots.length && <Link className={QUIET_LINK} to={potPath(board.pots[idx + 1].id)}>Next pot</Link>}
    </nav>
    <div className="my-3 flex gap-3">
      {pot.photos.map((photo, i) => <figure className="m-0 min-w-0 max-w-64 flex-1" key={photo.sha256}>
        <button type="button" className="block aspect-square w-full bg-tea-surface" aria-label={'Enlarge ' + photo.role}
          disabled={!urls[i]} onClick={() => setZoom(urls[i])}>
          {urls[i] && <img src={urls[i]} alt={photo.role} className="h-full w-full object-contain" />}
        </button>
        <figcaption className="text-tea-text-dim">{photo.role}</figcaption>
      </figure>)}
    </div>
    {failed && <p role="status">Photo unavailable</p>}
    <button type="button" className={QUIET_LINK} onClick={() => setParams(originals ? {} : { view: 'original' })}>
      {originals ? 'Show listing crops' : 'Compare original photos'}
    </button>
    <h2 className="type-section-heading mt-4 font-display">Photo observations</h2>
    <p>{pot.observation}</p>
    {pot.clayLead?.note && <p><strong>Visual clay lead · {pot.clayLead.label}</strong><br />{pot.clayLead.note}</p>}
    {comparisons.length > 0 && <p className="flex flex-wrap items-baseline gap-x-2">Compare {comparisons.map(e =>
      <Link key={e.id} className={QUIET_LINK} to={guidePath(pot, e.id)}>{e.name}</Link>)}</p>}
    <h2 className="type-section-heading mt-4 font-display">Your confirmation</h2>
    <p className="mb-2">Check the fired color in neutral light. Use supplier records, a maker’s statement or other material evidence to identify clay. Record an unlisted or mixed color in the private note. Choose Unconfirmed to clear a selection.</p>
    <form onSubmit={submit}>
      <fieldset className="min-w-0" disabled={saving}>
        <div className="grid gap-3 sm:grid-cols-3">
          {KINDS.map(kind => <label key={kind} className="min-w-0">{FIELD_LABELS[kind]}
            <select className={fieldClass} name={kind} value={draft[kind]} onChange={e => edit(kind, e.target.value)}>
              <option value="">Unconfirmed</option>
              {entries.filter(e => e.kind === kind).map(e => <option key={e.id} value={e.id}>{e.name}{e.chinese && ' · ' + e.chinese}</option>)}
            </select>
          </label>)}
        </div>
        <label className="mt-3 block">Private evidence note
          <textarea className={fieldClass} rows={2} maxLength={1600} value={draft.note} onChange={e => edit('note', e.target.value)} />
        </label>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary" disabled={conflict}>{saving ? 'Saving…' : 'Save review'}</button>
          {message && <span role="status">{message}</span>}
          {conflict && <button type="button" className="btn-secondary" onClick={async () => {
            try { await onReload(); } catch { setMessage('Reload failed. Try again.'); }
          }}>Reload saved choices</button>}
        </div>
      </fieldset>
    </form>
    <ImageOverlayModal open={!!zoom} itemName={pot.name} expandedImageUrl={zoom} onClose={() => setZoom(null)} />
  </>;
}
