import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Camera, LockKeyhole, Search } from 'lucide-react';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { API_URL, authedFetch } from '../../lib/api';
import { usePrivateQueryScope } from '../hooks/usePrivateQueryScope';
import type { TeaConnection, TeaIntakePage, TeaStockRecord } from '../../../shared/catalog/teaConnection';

export function stockHref(id: string) {
  return '/admin/stock?panel=' + encodeURIComponent(id);
}

export function stockDetails(record: TeaStockRecord) {
  return [record.chineseName, record.year, record.form].filter(Boolean).join(' · ');
}

export function TeaStockMatch({ intake, photoIndex, expected, saving, error, onCancel, onSaveFinding, onMatch }: {
  intake: TeaIntakePage; photoIndex: number; expected: TeaConnection; saving: boolean; error?: string;
  onCancel: () => void; onSaveFinding: (text: string) => void; onMatch: (stockId: string, evidence: string) => void;
}) {
  const formId = useId();
  const scope = usePrivateQueryScope();
  const [accountId, userId] = scope.key;
  const [mode, setMode] = useState<'finding' | 'link'>('finding');
  const [showPhoto, setShowPhoto] = useState(false);
  const [finding, setFinding] = useState(expected.finding?.text ?? '');
  const [evidence, setEvidence] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<TeaStockRecord>();
  const photoButton = useRef<HTMLButtonElement>(null);
  const backFromPhoto = useRef<HTMLButtonElement>(null);
  const photoViewed = useRef(false);
  const photo = intake.photos[photoIndex] || intake.photos[0];
  const options = useQuery<TeaStockRecord[]>({
    queryKey: ['tea-review-stock-options', ...scope.key, intake.id, expected.revision, search],
    enabled: scope.ready, retry: false,
    queryFn: ({ signal }) => authedFetch(API_URL + '/api/admin/catalog-review/teas/connection?' + new URLSearchParams({
      view: 'intake', id: intake.id, stockSearch: search,
    }), { expectedAuth: { accountId, userId }, signal, cache: 'no-store', reportIncident: false }),
  });
  const confirm = mode === 'link' ? Boolean(picked && evidence.trim()) : Boolean(finding.trim());
  const close = () => { if (!saving) onCancel(); };

  useEffect(() => {
    if (photoViewed.current) (showPhoto ? backFromPhoto : photoButton).current?.focus();
  }, [showPhoto]);

  return <Modal isOpen title="Find Stock match" onClose={close} disableBackdropClose={saving} clearBottomNav
    className="flex flex-col !overflow-hidden !bg-tea-elevated">
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4">
      <p className="text-ui-13 text-tea-text-sec">{intake.title}</p>
      {showPhoto ? <>
        <Button ref={backFromPhoto} type="button" variant="quiet" size="sm" onClick={() => setShowPhoto(false)}>
          <ArrowLeft size={16} aria-hidden="true" />Back to comparison
        </Button>
        <figure className="space-y-1">
          <img className="max-h-96 w-full rounded-md bg-tea-bg object-contain" src={photo} alt={'Source photo for ' + intake.title} />
          <figcaption className="text-ui-12 text-tea-text-sec">{intake.packageOnly ? 'Private package reference' : 'Private intake photo'}</figcaption>
        </figure>
      </> : <>
        <section aria-label="Stock match evidence" className="space-y-2 border-b border-tea-border pb-3">
          <div className={photo ? 'grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3' : ''}>
            <div className="min-w-0 space-y-2">
              {intake.comparisonFacts?.length ? <dl className="space-y-2">
                {intake.comparisonFacts.map(fact => <div key={fact.label}>
                  <dt className="text-ui-12 text-tea-text-dim">{fact.label}</dt>
                  <dd className="break-words text-ui-13 text-tea-text">{fact.value}</dd>
                </div>)}
              </dl> : <>
                <p className={T.label}>Recorded evidence</p>
                <p className="break-words text-ui-13 text-tea-text">{intake.evidence}</p>
              </>}
              {mode === 'finding' && !search && !!options.data?.length && <div>
                <p className="text-ui-12 text-tea-text-dim">Stock leads</p>
                <ul className="space-y-1 text-ui-13">{options.data.map(record => <li key={record.id}>
                  <Link to={stockHref(record.id)} className="break-words underline hover:text-tea-gold" target="_blank" rel="noreferrer">
                    {[record.name, stockDetails(record)].filter(Boolean).join(' · ')}
                  </Link>
                </li>)}</ul>
              </div>}
            </div>
            {photo && <div className="w-24 max-w-full rounded-md border border-tea-border">
              <img className="aspect-square w-full rounded-md bg-tea-bg object-cover" src={photo} alt="" />
              <Button ref={photoButton} type="button" variant="quiet" size="sm" className="w-full" onClick={() => {
                photoViewed.current = true; setShowPhoto(true);
              }}><Camera size={14} aria-hidden="true" />View photo</Button>
            </div>}
          </div>
          {intake.nextCheck && <p className="break-words text-ui-12 text-tea-text-sec">
            <strong className="text-tea-text">What would settle it?</strong> {intake.nextCheck}
          </p>}
        </section>
        <div className="flex flex-wrap gap-2" aria-label="Stock match action">
          <Button type="button" variant="chip" aria-pressed={mode === 'finding'} disabled={saving}
            onClick={() => { setSearch(''); setMode('finding'); }}>Keep unconfirmed</Button>
          <Button type="button" variant="chip" aria-pressed={mode === 'link'} disabled={saving}
            onClick={() => setMode('link')}>Link exact lot</Button>
        </div>
        {mode === 'link' && <>
          <form className="flex min-w-0 flex-wrap items-end gap-2" onSubmit={event => {
            event.preventDefault(); setPicked(undefined); setSearch(searchInput.trim());
          }}>
            <label className="min-w-0 flex-1 space-y-1 text-ui-13">Search Stock
              <input className="input-field min-h-tap px-3 py-2" type="search" value={searchInput} onChange={event => setSearchInput(event.target.value)}
                placeholder="Tea name or Stock ID" maxLength={128} />
            </label>
            <Button variant="secondary" disabled={saving || searchInput.trim().length < 2}>
              <Search size={16} aria-hidden="true" />Search
            </Button>
          </form>
          {options.isFetching && <p role="status" className="text-ui-13 text-tea-text-sec">Looking in Stock…</p>}
          {options.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Stock records are unavailable. <Button type="button" variant="quiet" size="sm" onClick={() => void options.refetch()}>Retry</Button></p>}
          {!!options.data?.length && <fieldset className="grid max-h-52 gap-1 overflow-y-auto">
            <legend className={T.label}>Select the exact Stock record</legend>
            {options.data.map(record => <label key={record.id} className="flex min-h-tap items-center gap-2 rounded-md border border-tea-border px-2 py-1 text-ui-13">
              <input type="radio" name="stock-record" checked={picked?.id === record.id} onChange={() => setPicked(record)} />
              <span className="min-w-0 flex-1 break-words"><strong>{record.name}</strong>
                {stockDetails(record) && <span className="block text-ui-12 text-tea-text-sec">{stockDetails(record)}</span>}</span>
              <Link className="btn-quiet btn-sm" to={stockHref(record.id)} target="_blank" rel="noreferrer"
                aria-label={'Open Stock record for ' + [record.name, record.year].filter(Boolean).join(' · ')}>Open</Link>
            </label>)}
          </fieldset>}
          {search && options.isSuccess && !options.data.length && <p className="text-ui-13 text-tea-text-sec">No matching Stock records.</p>}
        </>}
        <form id={formId} className="space-y-2" onSubmit={event => {
          event.preventDefault();
          if (!confirm || saving) return;
          if (mode === 'link' && picked) onMatch(picked.id, evidence);
          else if (mode === 'finding') onSaveFinding(finding);
        }}>
          {mode === 'finding' ? <label className="block text-ui-13">Private finding
            <textarea className="input-field mt-1 px-3 py-2" rows={3} value={finding} required maxLength={4000} onChange={event => setFinding(event.target.value)} />
          </label> : <label className="block text-ui-13">Evidence for this match
            <textarea className="input-field mt-1 px-3 py-2" rows={3} value={evidence} required maxLength={4000} onChange={event => setEvidence(event.target.value)} />
          </label>}
          <p className="flex items-center gap-1 text-ui-12 text-tea-text-sec"><LockKeyhole size={14} aria-hidden="true" />
            {mode === 'finding' ? 'The match stays in your Unconfirmed queue.' : 'Matching saves the private link and evidence.'}
          </p>
          {error && <p role="alert" className="text-ui-13 text-tea-text-sec">{error}</p>}
        </form>
      </>}
    </div>
    {!showPhoto && <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-tea-border px-4 py-2">
      <Button type="button" variant="quiet" disabled={saving} onClick={close}>Cancel</Button>
      <Button form={formId} variant="primary" disabled={saving || !confirm}>
        {mode === 'finding' ? 'Save private finding' : 'Confirm exact match'}
      </Button>
    </div>}
  </Modal>;
}
