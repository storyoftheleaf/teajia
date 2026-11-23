import { Button } from '../../../components/shared/Button';
import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ImageOverlayModal } from '../../../components/shop/alcove/AlcoveModals';
import { TYPOGRAPHY_CLASSES as TYPE } from '../../../designTokens';
import { QUIET_LINK } from '../../../pages/wisdom/frame';
import { EMPTY, guidePath, potPath, type Auth, type Board, type ChangeShape, type Decision, type Pot } from './data';
import { useReviewPhotos } from './Photos';
import AddShapeReference from './AddShapeReference';
import { ShapeVerdict } from './ShapeVerdict';
import {
  loadShapeLibrary, loadShapePhoto, matchingShapes, shapeExemplars, SHAPE_FEATURES,
  SHAPE_LIBRARY_PATH, SHAPE_SILHOUETTES, type ShapeExemplar, type ShapeForm,
} from './shapeData';

const PAGE_SIZE = 12;
const surface = 'overflow-hidden rounded-md border border-tea-border bg-tea-surface';
const field = 'input-field min-h-tap w-full min-w-0';
type Zoom = { url: string; label: string };
type OnZoom = (zoom: Zoom) => void;

function ShapePhoto({ asset, label, auth, onZoom }: { asset: string; label: string; auth: Auth; onZoom?: OnZoom }) {
  const slot = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { accountId, userId } = auth;
  const key = JSON.stringify([accountId, userId, asset]);
  const [result, setResult] = useState<{ key: string; url?: string; failed?: boolean }>();
  useEffect(() => {
    if (!slot.current) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setVisible(true);
      observer.disconnect();
    });
    observer.observe(slot.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let url: string | undefined;
    void loadShapePhoto(asset, { accountId, userId }, controller.signal).then(blob => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setResult({ key, url });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ key, failed: true });
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset, key, accountId, userId, visible]);
  const url = result?.key === key ? result.url : undefined;
  const photo = url && <img className="h-full w-full object-contain" src={url} alt={label} />;
  return <div ref={slot} className="flex aspect-square items-center justify-center bg-tea-bg">
    {url && onZoom
      ? <Button variant="plain" className="block h-full w-full focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold" type="button"
          aria-label={'Enlarge ' + label} onClick={() => onZoom({ url, label })}>{photo}</Button>
      : photo}
    {result?.key === key && result.failed && <span className={TYPE.bodyLight}>Photo unavailable</span>}
  </div>;
}

function PotComparison({ pot, auth, originals, onZoom }: { pot: Pot; auth: Auth; originals: boolean; onZoom: OnZoom }) {
  const [selected, setSelected] = useState(() => {
    const main = pot.photos.findIndex(photo => /\b(front|main)\b/i.test(photo.role));
    return main < 0 ? 0 : main;
  });
  const photo = pot.photos[selected];
  const { urls, failed } = useReviewPhotos(photo ? [originals ? photo.originalSha256 : photo.sha256] : [], auth);
  const url = urls[0];
  const label = photo ? pot.name + ' · ' + photo.role : pot.name;
  return <section aria-label={'Compare with ' + pot.name} className={surface + ' grid min-w-0 grid-cols-2 items-center self-start sm:block'}>
    <h2 className={TYPE.h2 + ' col-span-2 px-3 py-2 break-words'}>{pot.name}</h2>
    {photo && <div className="flex aspect-square items-center justify-center bg-tea-bg">
      {url && <Button variant="plain" className="block h-full w-full focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold"
       type="button" aria-label={'Enlarge ' + label} onClick={() => onZoom({ url, label })}>
        <img className="h-full w-full object-contain" src={url} alt={label} />
      </Button>}
      {failed && <p role="status">Photo unavailable</p>}
    </div>}
    <div className="px-3 py-2">
      {pot.photos.length > 1 ? <div aria-label="Pot photo views" className="flex flex-wrap gap-x-2">
        {pot.photos.map((entry, index) => <Button variant="tab" type="button" key={entry.sha256}
          aria-pressed={index === selected} onClick={() => setSelected(index)}>{entry.role}</Button>)}
      </div> : <p className={TYPE.bodyLight}>{photo?.role ?? 'No review photo available'}</p>}
    </div>
  </section>;
}

function SourceLink({ label, url }: { label: string; url?: string }) {
  if (!url?.startsWith('https://')) return null;
  return <a className={QUIET_LINK + ' break-words'} href={url} target="_blank" rel="noreferrer">{label} ↗</a>;
}

function Example({ example, auth, onZoom }: { example: ShapeExemplar; auth: Auth; onZoom: OnZoom }) {
  const views = [{ asset: example.asset, label: 'Reference photo', imageUrl: example.imageUrl }, ...(example.views ?? [])];
  const [selection, setSelection] = useState(0);
  const view = views[selection];
  return <article className={surface + ' min-w-0 self-start'}>
    <div className="px-3 py-2">
      <h2 className={TYPE.h2 + ' break-words'}>{example.title}</h2>
      <p className={TYPE.bodyLight + ' text-tea-text-sec'}>{[example.credit, example.tradition, example.sourceType].filter(Boolean).join(' · ')}</p>
      {example.reviewStatus && <p className={TYPE.bodyLight + ' mt-1 text-tea-text-sec'}>{example.reviewStatus}</p>}
    </div>
    <ShapePhoto asset={view.asset} label={example.title + ' · ' + view.label} auth={auth} onZoom={onZoom} />
    <div className="space-y-2 px-3 py-2">
      {views.length > 1 && <div aria-label="Reference photo views" className="flex flex-wrap gap-x-2">
        {views.map((entry, index) => <Button variant="tab" type="button" key={entry.asset}
          aria-pressed={index === selection} onClick={() => setSelection(index)}>{entry.label}</Button>)}
      </div>}
      {example.notes && <p className={TYPE.body}>{example.notes}</p>}
      <div className="flex flex-wrap gap-x-3">
        <SourceLink label="Source record" url={example.recordUrl} />
        <SourceLink label="Source photo" url={view.imageUrl} />
      </div>
      <p className={TYPE.bodyLight + ' text-tea-text-sec'}>{example.rights}</p>
    </div>
  </article>;
}

function ShapeDetails({ auth, form, pot, originals, reference, onSelect, onZoom, decision, onShape, onReload }: {
  auth: Auth; form: ShapeForm; pot?: Pot; originals: boolean; reference: string | null;
  onSelect: (asset: string) => void; onZoom: OnZoom;
  decision: Decision; onShape: ChangeShape; onReload: () => Promise<void>;
}) {
  const exemplars = shapeExemplars(form);
  const selected = exemplars.find(item => item.asset === reference) ?? exemplars[0];
  return <>
    <h1 className={TYPE.h1 + ' font-display'} lang="zh">{form.chinese}</h1>
    <p className={TYPE.body + ' text-tea-text-sec'}>{form.pinyin} · {form.silhouette} · {form.kind}</p>
    {exemplars.length > 1 && <label className="my-3 block">
      <span className={TYPE.label}>Reference example</span>
      <select className={field} value={selected.asset} onChange={event => onSelect(event.target.value)}>
        {exemplars.map(example => <option key={example.asset} value={example.asset}>{example.title} · {example.credit}</option>)}
      </select>
    </label>}
    <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
      {pot && <PotComparison key={pot.id} pot={pot} auth={auth} originals={originals} onZoom={onZoom} />}
      <Example key={selected.asset} example={selected} auth={auth} onZoom={onZoom} />
      {!pot && <ShapeFeatures form={form} />}
    </div>
    {pot && <ShapeVerdict key={pot.id + ':' + form.id} pot={pot} form={form} example={selected}
      decision={decision} onShape={onShape} onReload={onReload} />}
    {pot && <ShapeFeatures form={form} />}
  </>;
}

function ShapeFeatures({ form }: { form: ShapeForm }) {
  return <section aria-label="Form features" className="mt-3 min-w-0">
    <h2 className={TYPE.h2}>What to compare</h2>
    <dl className="divide-y divide-tea-border">
      {SHAPE_FEATURES.map(feature => <div className="grid gap-x-3 py-2 sm:grid-cols-3" key={feature}>
        <dt className={TYPE.label + ' capitalize'}>{feature}</dt>
        <dd className={TYPE.body + ' min-w-0 break-words sm:col-span-2'}>{form.features[feature]}</dd>
      </div>)}
      <div className="py-2">
        <dt className={TYPE.label}>Variants</dt>
        <dd className={TYPE.body + ' break-words'}>{form.variants}</dd>
      </div>
      <div className="py-2">
        <dt className={TYPE.label}>Near neighbors</dt>
        <dd className={TYPE.body + ' break-words'}>{form.nearNeighbors}</dd>
      </div>
    </dl>
    {!!form.supportingSources.length && <ul className="space-y-1" aria-label="Supporting sources">
      {form.supportingSources.map(source => <li key={source.url + source.title}><SourceLink label={source.title} url={source.url} /></li>)}
    </ul>}
  </section>;
}

export function ShapeLibrary({ board, auth, revision, onShape, onReload }: {
  board: Board; auth: Auth; revision: number; onShape: ChangeShape; onReload: () => Promise<void>;
}) {
  const { '*': child } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const [zoom, setZoom] = useState<Zoom | null>(null);
  const pot = board.pots.find(entry => entry.id === params.get('pot'));
  const fromListing = params.get('from') === 'listing';
  const originals = params.get('view') === 'original';
  const query = useQuery({
    queryKey: ['yixing-shape-library', auth.accountId, auth.userId, revision],
    queryFn: ({ signal }) => loadShapeLibrary(auth, signal), retry: false, gcTime: 0,
  });
  const library = query.data;
  const editing = child === 'add';
  const chosen = library?.forms.find(form => form.id === child);
  const selectedAsset = params.get('ref');
  const missingSelection = child && !editing && (!chosen ||
    (selectedAsset && !shapeExemplars(chosen).some(example => example.asset === selectedAsset)));
  const search = params.get('q') ?? '';
  const silhouette = SHAPE_SILHOUETTES.find(item => item === params.get('silhouette')) ?? '';
  const filtered = matchingShapes(library?.forms ?? [], search, silhouette);
  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(lastPage, Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1));

  function link(childPath = '', asset?: string) {
    const next = new URLSearchParams(params);
    next.delete('ref');
    if (!pot) {
      next.delete('pot'); next.delete('from'); next.delete('view');
    }
    if (asset) next.set('ref', asset);
    return SHAPE_LIBRARY_PATH + (childPath ? '/' + encodeURIComponent(childPath) : '') + (next.size ? '?' + next : '');
  }

  function filter(key: 'q' | 'silhouette', value: string) {
    const next = new URLSearchParams(params);
    next.delete('page');
    if (value) next.set(key, value); else next.delete(key);
    setParams(next, { replace: true });
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(params);
    next.set('page', String(nextPage));
    setParams(next);
  }

  const back = pot
    ? potPath(pot.id) + (fromListing ? '/listing' : originals ? '?view=original' : '')
    : guidePath();

  return <>
    <nav aria-label="Shape library navigation" className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link className="btn-quiet tap-target" to={back}>← Back to {pot?.name ?? 'Yixing Wisdom'}</Link>
        {!!child && <Link className={QUIET_LINK} to={link()}>All forms</Link>}
      </div>
      {!editing && library && <Link className="btn-secondary tap-target" to={link('add')}>Add shape reference</Link>}
    </nav>
    {query.isPending || (missingSelection && query.isFetching) ? <p role="status">Opening shape library…</p>
      : !library || (query.isError && missingSelection) ? <div role="alert">
        <p>{query.error?.message ?? 'Unable to open the shape library.'}</p>
        <Button variant="secondary" type="button" className="mt-2" onClick={() => void query.refetch()}>Try again</Button>
      </div>
      : editing ? <AddShapeReference auth={auth} forms={library.forms} onCancel={() => navigate(link())}
        onSaved={({ formId, asset }) => { void query.refetch(); navigate(link(formId, asset), { replace: true }); }} />
      : chosen ? <ShapeDetails auth={auth} pot={pot} originals={originals} form={chosen}
        decision={pot ? board.decisions[pot.id] ?? EMPTY : EMPTY} onShape={onShape} onReload={onReload}
        reference={selectedAsset} onSelect={asset => navigate(link(chosen.id, asset), { replace: true })} onZoom={setZoom} />
      : child ? <><h1 className={TYPE.h1}>Form unavailable</h1><Link className={QUIET_LINK} to={link()}>Browse the shape library</Link></>
      : <>
        <h1 className={TYPE.h1 + ' font-display'}>Shape Library</h1>
        <div className="my-3 grid gap-2 sm:grid-cols-2">
          <label className="min-w-0">
            <span className={TYPE.label}>Search shapes</span>
            <input type="search" className={field} value={search} onChange={event => filter('q', event.target.value)}
              placeholder="Chinese name, pinyin or maker" />
          </label>
          <label className="min-w-0">
            <span className={TYPE.label}>Silhouette</span>
            <select className={field} value={silhouette} onChange={event => filter('silhouette', event.target.value)}>
              <option value="">All silhouettes</option>
              {SHAPE_SILHOUETTES.map(item => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3">
          <p className={TYPE.bodyLight} role="status">{filtered.length} {filtered.length === 1 ? 'form' : 'forms'}</p>
          {lastPage > 1 && <nav aria-label="Form pages" className="flex flex-wrap items-center gap-x-2">
            <Button variant="quiet" className="tap-target" type="button" disabled={page === 1} onClick={() => goToPage(page - 1)}>Previous</Button>
            <span className={TYPE.bodyLight}>Page {page} of {lastPage}</span>
            <Button variant="quiet" className="tap-target" type="button" disabled={page === lastPage} onClick={() => goToPage(page + 1)}>Next</Button>
          </nav>}
        </div>
        <div className={pot ? 'grid min-w-0 items-start gap-3 sm:grid-cols-3' : undefined}>
          {pot && <PotComparison key={pot.id} pot={pot} auth={auth} originals={originals} onZoom={setZoom} />}
          <div className="min-w-0 sm:col-span-2">
            <ul className={'grid grid-cols-2 gap-3 ' + (pot ? 'lg:grid-cols-3' : 'sm:grid-cols-3 lg:grid-cols-4')}>
              {filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(form => <li className={surface + ' min-w-0'} key={form.id}>
                <Link className="block focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-tea-gold" to={link(form.id)}>
                  <ShapePhoto asset={form.exemplar.asset} label="" auth={auth} />
                  <div className="px-3 py-2">
                    <p className={TYPE.h3 + ' break-words'} lang="zh">{form.chinese}</p>
                    <p className={TYPE.bodyLight + ' text-tea-text-sec'}>{form.pinyin}</p>
                  </div>
                </Link>
              </li>)}
            </ul>
            {!filtered.length && <p className={TYPE.body}>No forms match these filters.</p>}
            {pot && <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className={TYPE.bodyLight + ' text-tea-text-sec'}>Leave the shape unconfirmed if the details differ.</p>
              <Link className={QUIET_LINK} to={back}>Return to {pot.name}</Link>
            </div>}
          </div>
        </div>
      </>}
    <ImageOverlayModal open={!!zoom} itemName={zoom?.label ?? ''} expandedImageUrl={zoom?.url ?? null} onClose={() => setZoom(null)} />
  </>;
}
