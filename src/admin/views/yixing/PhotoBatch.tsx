import { Button } from '../../../components/shared/Button';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ImageOverlayModal } from '../../../components/shop/alcove/AlcoveModals';
import { API_URL, authedFetch, type ApiRequestInit } from '../../../lib/api';
import { QUIET_LINK } from '../../../pages/wisdom/frame';
import { BASE, potPath, type Auth, type Pot } from './data';
import { useReviewPhotos } from './Photos';

type Photo = Pot['photos'][number];
type Change = {
  potId: string;
  slot: number;
  before: Photo;
  after: Photo;
  needsReview?: boolean;
};
type Proposal = { id: string | null; changes: Change[] };
type BatchProps = { auth: Auth; onApplied: () => Promise<unknown> };

const endpoint = API_URL + '/api/admin/yixing/photo-batch';
const requestOptions = (auth: Auth): ApiRequestInit => ({
  expectedAuth: auth, cache: 'no-store', reportIncident: false,
});
const changeKey = ({ potId, slot }: Change) => `${potId}/${slot}`;
const countLabel = (count: number) => `${count} replacement${count === 1 ? '' : 's'}`;

function Comparison({ change, auth, selected, disabled, onSelect }: {
  change: Change; auth: Auth; selected: boolean; disabled: boolean; onSelect: (checked: boolean) => void;
}) {
  const card = useRef<HTMLLIElement>(null);
  const [inView, setInView] = useState(false);
  const [zoom, setZoom] = useState<{ url: string; label: string } | null>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setInView(true);
      observer.disconnect();
    });
    if (card.current) observer.observe(card.current);
    return () => observer.disconnect();
  }, []);
  const { urls, failed } = useReviewPhotos(inView ? [change.before.sha256, change.after.sha256] : [], auth);
  const pot = 'Pot ' + change.potId.slice(-2);
  const slot = `Photo ${change.slot + 1}`;

  return <li ref={card} className="min-w-0 rounded-md border border-tea-border bg-tea-surface p-3">
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
      <h2 className="font-medium"><Link className={QUIET_LINK} to={potPath(change.potId)}>{pot}</Link> · {slot}</h2>
      {change.needsReview && <span className="text-ui-12 text-tea-text-sec">Check before replacing</span>}
    </div>
    <div className="grid grid-cols-2 gap-2">
      {([
        ['Current', change.before, urls[0]],
        ['Proposed', change.after, urls[1]],
      ] as const).map(([heading, photo, url]) => {
        const label = `${pot}, ${slot.toLowerCase()}, ${heading.toLowerCase()} ${photo.role.toLowerCase()}`;
        return <figure key={heading} className="m-0 min-w-0">
          <Button variant="plain" type="button" aria-label={'Enlarge ' + label} disabled={!url}
            className="block aspect-square w-full overflow-hidden rounded-md border border-tea-border bg-tea-bg focus-visible:ring-2 focus-visible:ring-tea-gold/50"
            onClick={() => setZoom({ url, label })}>
            {url && <img alt={label} src={url} className="h-full w-full object-contain" />}
          </Button>
          <figcaption className="mt-1 text-ui-12 text-tea-text-sec">
            <strong>{heading}</strong> · {photo.role}
          </figcaption>
        </figure>;
      })}
    </div>
    {failed && <p role="status" className="mt-1 text-ui-12">Photos unavailable. Reload to compare.</p>}
    <label className="mt-2 inline-flex min-h-tap cursor-pointer items-center gap-2">
      <input type="checkbox" checked={selected} disabled={disabled}
        aria-label={`Select replacement for ${pot}, ${slot.toLowerCase()}`}
        onChange={event => onSelect(event.target.checked)} />
      <span>Use proposed photo</span>
    </label>
    <ImageOverlayModal open={!!zoom} itemName={zoom?.label ?? ''} expandedImageUrl={zoom?.url ?? null} onClose={() => setZoom(null)} />
  </li>;
}

function Selection({ proposal, auth, onApplied, reload }: BatchProps & {
  proposal: Proposal; reload: () => Promise<unknown>;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [needsReload, setNeedsReload] = useState(false);
  const picked = proposal.changes.filter(change => selected.has(changeKey(change)));
  const routine = proposal.changes.filter(change => !change.needsReview);

  function update(change: Change, checked: boolean) {
    setSelected(current => {
      const next = new Set(current);
      if (checked) next.add(changeKey(change));
      else next.delete(changeKey(change));
      return next;
    });
  }

  async function refresh() {
    await Promise.all([reload(), onApplied()]);
    setNeedsReload(false);
  }

  async function apply() {
    if (!proposal.id || !picked.length || saving || needsReload) return;
    setSaving(true);
    setError('');
    setStatus('');
    try {
      const { applied }: { applied: number } = await authedFetch(endpoint, {
        ...requestOptions(auth), method: 'PUT',
        body: JSON.stringify({ id: proposal.id, selections: picked.map(({ potId, slot }) => ({ potId, slot })) }),
      });
      setStatus(applied ? `Applied ${countLabel(applied)}.` : 'These photos are already current.');
      setSelected(new Set());
      setNeedsReload(true);
      await refresh();
    } catch (cause) {
      if (cause instanceof Error && 'status' in cause && cause.status === 409) setNeedsReload(true);
      setError(cause instanceof Error ? cause.message : 'Unable to save the photo replacements.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    {proposal.changes.length > 0 ? <>
      <p className="text-tea-text-sec">{countLabel(proposal.changes.length)} to review. Unchecked photos stay pending.</p>
      <div className="my-3 flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" disabled={saving || needsReload || !routine.some(change => !selected.has(changeKey(change)))}
          onClick={() => setSelected(current => new Set([...current, ...routine.map(changeKey)]))}>Select routine changes</Button>
        {picked.length > 0 && <Button type="button" variant="quiet" disabled={saving} onClick={() => setSelected(new Set())}>Clear selection</Button>}
        <Button type="button" variant="primary" disabled={saving || needsReload || !picked.length} onClick={() => void apply()}>
          {saving ? 'Saving…' : picked.length ? `Apply ${countLabel(picked.length)}` : 'Apply selected photos'}
        </Button>
      </div>
    </> : <p>No photo replacements to review.</p>}
    {status && <p role="status" className="my-2">{status}</p>}
    {error && <p role="alert" className="my-2">{error}</p>}
    {needsReload && <Button type="button" variant="secondary" className="mb-3" disabled={saving} onClick={async () => {
      setSaving(true);
      setError('');
      try { await refresh(); } catch { setError('Unable to reload the photo review. Try again.'); }
      finally { setSaving(false); }
    }}>Reload photo review</Button>}
    {proposal.changes.length > 0 && <ul className="grid gap-3 sm:grid-cols-2">
      {proposal.changes.map(change => <Comparison key={changeKey(change)} auth={auth} change={change}
        selected={selected.has(changeKey(change))} disabled={saving || needsReload} onSelect={checked => update(change, checked)} />)}
    </ul>}
  </>;
}

export function PhotoBatch({ auth, onApplied }: BatchProps) {
  const query = useQuery<Proposal>({
    queryKey: ['yixing-photo-batch', auth.accountId, auth.userId],
    queryFn: ({ signal }) => authedFetch(endpoint, { ...requestOptions(auth), signal }),
    retry: false,
    gcTime: 0,
  });
  return <>
    <nav className="mb-2" aria-label="Photo review navigation"><Link className={QUIET_LINK} to={BASE}>All pots</Link></nav>
    <h1 className="type-page-title font-display">Compare photo replacements</h1>
    {query.data ? <Selection key={query.data.id ?? 'empty'} proposal={query.data} auth={auth} onApplied={onApplied}
      reload={() => query.refetch({ throwOnError: true })} /> : query.isError ? <div className="mt-2">
      <p role="alert">{query.error.message}</p>
      <Button variant="secondary" className="mt-2" type="button" onClick={() => void query.refetch()}>Try again</Button>
    </div> : <p role="status">Loading photo review…</p>}
  </>;
}
