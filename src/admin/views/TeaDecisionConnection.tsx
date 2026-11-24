import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, BookOpen, Check, ChevronDown, Package, Plus, Search, ShoppingBag, UserRound } from 'lucide-react';
import { Modal } from '../../components/shared/Modal';
import { Button } from '../../components/shared/Button';
import { VendorFace } from '../../components/vendors/VendorFace';
import { VendorFacesButton, VendorFaceSheet } from '../../components/vendors/VendorFaceSheet';
import { filterFaceVendors, toFaceVendor, type FaceVendor } from '../../components/vendors/vendorFaces';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { API_URL, ApiError, authedFetch } from '../../lib/api';
import { usePrivateQueryScope } from '../hooks/usePrivateQueryScope';
import type { TeaConnection, TeaConnectionEdit, TeaReviewRef } from '../../../shared/catalog/teaConnection';

const BASE = API_URL + '/api/admin/catalog-review/teas/connection';
type Assignment = NonNullable<TeaConnection['vendor']>;
type Message = { text: string; error?: boolean };

function vendorTag(tags: unknown) {
  const values = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[,[\]"]+/) : [];
  return values.some(tag => String(tag).trim().toLowerCase() === 'vendor');
}

export function TeaDecisionConnection({ target, title, shop, wisdom, identity }: {
  target: TeaReviewRef; title: string; shop?: string; wisdom?: string;
  identity?: { evidence: string; action: string; label: string };
}) {
  const scope = usePrivateQueryScope();
  const [accountId, userId] = scope.key;
  const auth = { expectedAuth: { accountId, userId }, reportIncident: false, cache: 'no-store' as const };
  const queryClient = useQueryClient();
  const queryKey = ['tea-review-connection', ...scope.key, target.view, target.id];
  const url = BASE + '?' + new URLSearchParams(target);
  const query = useQuery<TeaConnection>({
    queryKey, enabled: scope.ready, retry: false,
    queryFn: ({ signal }) => authedFetch(url, { ...auth, signal }),
  });
  const [edit, setEdit] = useState<{ kind: 'vendor' | 'finding'; expected: TeaConnection }>();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>();
  const connection = scope.ready ? query.data : undefined;
  const missing = query.error instanceof ApiError && query.error.status === 404;
  const directoryKey = ['tea-review-vendors', ...scope.key];
  const directory = useQuery<FaceVendor[]>({
    queryKey: directoryKey, enabled: scope.ready && edit?.kind === 'vendor', retry: false,
    queryFn: async ({ signal }) => {
      const response = await authedFetch(API_URL + '/api/customers', { ...auth, signal });
      const rows = Array.isArray(response) ? response : response.customers;
      return (rows ?? []).filter((row: { tags?: unknown }) => vendorTag(row.tags)).map(toFaceVendor);
    },
  });

  function start(kind: 'vendor' | 'finding') {
    if (connection) {
      setMessage(undefined);
      setEdit({ kind, expected: connection });
    }
  }

  async function save(update: TeaConnectionEdit) {
    setSaving(true);
    setMessage(undefined);
    try {
      const { revision, stockId, vendorId, version } = update.expected;
      const body = { ...update, expected: { revision, stockId, vendorId, version } };
      const current: TeaConnection = await authedFetch(url, { ...auth, method: 'PUT',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      queryClient.setQueryData(queryKey, current);
      void queryClient.invalidateQueries({ queryKey: ['tea-review-connection', ...scope.key] });
      setEdit(undefined);
      setMessage({ text: update.action === 'finding' ? 'Finding saved.' : update.vendorId ? 'Vendor linked.' : 'Vendor link cleared.' });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        await query.refetch();
        setEdit(undefined);
        setMessage({ text: 'This review changed. Check the current record before trying again.', error: true });
      } else {
        setMessage({ text: 'The change could not be saved. Try again.', error: true });
      }
    } finally {
      setSaving(false);
    }
  }

  async function createVendor(name: string, chineseName: string): Promise<Assignment> {
    const result = await authedFetch(API_URL + '/api/customers', { ...auth, method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, chinese_name: chineseName || undefined, tags: ['vendor'] }) });
    if (typeof result?.id !== 'string') throw new Error('Vendor response missing ID');
    void queryClient.invalidateQueries({ queryKey: directoryKey });
    return { id: result.id, name: result.name || name };
  }

  const exactStockId = connection?.stockId;
  const hasLinks = exactStockId || shop || wisdom;
  const linkedFace = directory.data?.find(item => item.id === connection?.vendorId);
  return <div className="space-y-4">
    {identity && <section aria-label="Identity check" className="space-y-3 border-b border-tea-border pb-4">
      <div>
        <p className={T.label}>{connection?.finding?.resolved ? 'Resolution' : 'Next check'}</p>
        <p className={T.bodyLight + ' whitespace-pre-wrap break-words'}>{connection?.finding?.resolved ? connection.finding.text : identity.evidence}</p>
      </div>
      {connection?.finding && <p className="whitespace-pre-wrap break-words text-ui-13 text-tea-text-sec">
        {connection.finding.resolved ? 'Original check · ' + identity.evidence : 'Finding so far · ' + connection.finding.text}
      </p>}
      <Button type="button" variant="primary" size="sm" onClick={() => start('finding')} disabled={!connection}>
        {connection?.finding ? 'Update finding' : identity.action}
      </Button>
    </section>}

    {(connection?.canAssignVendor || hasLinks) && <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      {connection?.canAssignVendor && <section aria-label="Vendor and people" className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
          <h3 className={T.h3}>Vendor &amp; people</h3>
          <Button type="button" variant="secondary" size="sm" icon={<UserRound size={16} aria-hidden="true" />} onClick={() => start('vendor')}>
            {connection.vendorId ? 'Change vendor' : 'Choose vendor'}
          </Button>
        </div>
        <div className="flex min-w-0 items-center gap-2 border-y border-tea-border py-2 text-ui-13">
          {connection.vendor ? <>
            <span aria-hidden="true"><VendorFace name={connection.vendor.name} photo={linkedFace?.photo} size={24} /></span>
            <Link className="min-w-0 truncate text-tea-text hover:text-tea-gold" to={'/admin/vendors/' + encodeURIComponent(connection.vendor.id)}>{connection.vendor.name}</Link>
          </> : <span className="text-tea-text-sec">{connection.vendorId ? 'Vendor record unavailable' : 'No vendor linked'}</span>}
          {connection.vendorId && <span className="ml-auto shrink-0 text-tea-text-dim">{connection.stockId ? 'Linked in Stock' : 'Linked to intake'}</span>}
        </div>
        {!connection.stockId && <p className="pt-2 text-ui-12 text-tea-text-sec">Vendor links here belong to this intake. The Stock match is still open.</p>}
      </section>}
      {hasLinks && <section aria-label="Connections" className="min-w-0">
        <h3 className={T.h3}>Connections</h3>
        <ul className="mt-2 divide-y divide-tea-border border-y border-tea-border">
          {exactStockId && <li><Link className="btn-quiet btn-sm" to={'/admin/stock?panel=' + encodeURIComponent(exactStockId)}><Package size={16} aria-hidden="true" />Open Stock record</Link></li>}
          {wisdom && <li><Link className="btn-quiet btn-sm" to={wisdom}><BookOpen size={16} aria-hidden="true" />Tea Wisdom</Link></li>}
          {shop && <li><a className="btn-quiet btn-sm" href={shop}><ShoppingBag size={16} aria-hidden="true" />Shop listing<ArrowUpRight size={14} aria-hidden="true" /></a></li>}
        </ul>
      </section>}
    </div>}
    {!missing && query.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Connections are unavailable. <Button variant="quiet" size="sm" onClick={() => void query.refetch()}>Retry</Button></p>}
    {message && !edit && <p role={message.error ? 'alert' : 'status'} className="text-ui-13 text-tea-text-sec">{message.text}</p>}
    {edit?.kind === 'vendor' && <VendorEditor title={title} expected={edit.expected}
      vendors={directory.data ?? []} loading={directory.isPending} failed={directory.isError} retry={() => void directory.refetch()}
      saving={saving} error={message?.text} onCreate={createVendor}
      onCancel={() => setEdit(undefined)} onSave={vendorId => void save({ action: 'vendor', expected: edit.expected, vendorId })} />}
    {edit?.kind === 'finding' && identity && <FindingEditor title={title} action={identity.action} label={identity.label}
      expected={edit.expected} saving={saving} error={message?.text}
      onCancel={() => setEdit(undefined)} onSave={(text, resolved) => void save({ action: 'finding', expected: edit.expected, text, resolved })} />}
  </div>;
}

function VendorEditor({ title, expected, vendors, loading, failed, retry, saving, error, onCreate, onCancel, onSave }: {
  title: string; expected: TeaConnection; vendors: FaceVendor[]; loading: boolean; failed: boolean;
  retry: () => void; saving: boolean; error?: string; onCreate: (name: string, chineseName: string) => Promise<Assignment>;
  onCancel: () => void; onSave: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [faces, setFaces] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Assignment | null>(expected.vendor);
  const [vendorId, setVendorId] = useState(expected.vendorId);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [chineseName, setChineseName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const choices = filterFaceVendors(vendors, search);
  const duplicate = vendors.some(vendor => vendor.name.trim().toLowerCase() === name.trim().toLowerCase());
  const busy = saving || creating;

  function pick(vendor: Assignment) {
    setSelected(vendor);
    setVendorId(vendor.id);
    setOpen(false);
    setSearch('');
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || duplicate || loading || failed || creating) return;
    setCreating(true);
    setCreateError('');
    try {
      pick(await onCreate(name.trim(), chineseName.trim()));
      setAdding(false);
    } catch {
      setCreateError('The vendor could not be created. Try again.');
    } finally {
      setCreating(false);
    }
  }

  return <>
    <Modal isOpen={!faces} title="Vendor for this tea" onClose={() => { if (!busy) onCancel(); }} disableBackdropClose={busy}>
      <div className="space-y-3 px-4 py-4">
        <p className="text-ui-13 text-tea-text-sec">{title}</p>
        <div className="space-y-1 border-b border-tea-border pb-2">
          <p className={T.label}>Current link</p>
          <div className="flex min-w-0 items-center gap-2">
            {expected.vendor && <span aria-hidden="true"><VendorFace name={expected.vendor.name} photo={vendors.find(v => v.id === expected.vendorId)?.photo} size={24} /></span>}
            <p className="min-w-0 truncate">{expected.vendor?.name || (expected.vendorId ? 'Vendor record unavailable' : 'None')}</p>
          </div>
        </div>
        {adding ? <form className="space-y-3" onSubmit={event => void create(event)}>
          <label className="block text-ui-13">Vendor name<input className="input-field min-h-tap px-3 py-2" value={name} required maxLength={120} onChange={event => setName(event.target.value)} /></label>
          <label className="block text-ui-13">Chinese name<input className="input-field min-h-tap px-3 py-2" value={chineseName} maxLength={120} onChange={event => setChineseName(event.target.value)} /></label>
          {duplicate && <p className="text-ui-13 text-tea-text-sec">Choose the existing vendor by that name.</p>}
          {createError && <p role="alert" className="text-ui-13">{createError}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="quiet" size="sm" type="button" disabled={busy} onClick={() => setAdding(false)}>Back</Button>
            <Button variant="primary" size="sm" disabled={busy || !name.trim() || duplicate || loading || failed}>Create vendor</Button>
          </div>
        </form> : <>
          <p className={T.label} id="tea-review-vendor-label">Proposed vendor</p>
          <div className="flex min-w-0 items-center gap-1">
            <Button type="button" variant="plain" className="btn-field min-w-0 flex-1" aria-labelledby="tea-review-vendor-label tea-review-vendor-value"
              aria-expanded={open} aria-controls="tea-review-vendor-options" onClick={() => setOpen(value => !value)} disabled={busy}>
              <span className="min-w-0 truncate" id="tea-review-vendor-value">
                {selected?.name || (vendorId ? 'Current vendor' : expected.vendorId ? 'Clear vendor link' : 'Select existing vendor')}
              </span><ChevronDown size={16} className="shrink-0" aria-hidden="true" />
            </Button>
            <VendorFacesButton label="" onClick={() => { if (!busy) { setOpen(false); setFaces(true); } }} />
          </div>
          {open && <div id="tea-review-vendor-options" className="space-y-2 rounded-md border border-tea-border p-2">
            <label className="flex items-center gap-2">
              <Search size={16} className="shrink-0" aria-hidden="true" />
              <input type="search" aria-label="Search vendors" className="input-field min-h-tap min-w-0 px-3 py-2" value={search} onChange={event => setSearch(event.target.value)} />
            </label>
            {failed ? <p role="alert" className="text-ui-13">Vendors are unavailable. <Button variant="quiet" size="sm" onClick={retry}>Retry</Button></p> :
              loading ? <p role="status" className="text-ui-13">Looking up vendors…</p> :
              choices.length ? <ul className="max-h-52 overflow-y-auto">
                {choices.map(vendor => vendor.id && <li key={vendor.id}><Button type="button" variant="plain" disabled={busy}
                  className="btn-quiet w-full justify-start"
                  aria-pressed={vendor.id === vendorId}
                  onClick={() => pick({ id: vendor.id!, name: vendor.name })}>
                  <span aria-hidden="true"><VendorFace name={vendor.name} photo={vendor.photo} size={24} /></span>
                  <span className="min-w-0 truncate">{vendor.name}</span>
                  {vendor.id === vendorId && <Check size={14} aria-hidden="true" className="ml-auto shrink-0" />}
                </Button></li>)}
              </ul> : <p className="text-ui-13 text-tea-text-sec">No matching vendors.</p>}
          </div>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="quiet" size="sm" icon={<Plus size={16} aria-hidden="true" />} disabled={busy || loading || failed} onClick={() => setAdding(true)}>New vendor</Button>
            {expected.vendorId && <Button type="button" variant="quiet" size="sm" disabled={busy} onClick={() => {
              setSelected(null); setVendorId(null); setOpen(false);
            }}>Clear link</Button>}
          </div>
          <p className="text-ui-12 text-tea-text-sec">{expected.stockId ? 'Saves the private supplier link for this Stock record.' : 'Saves the supplier on this intake. The Stock match stays open.'}</p>
          {error && <p role="alert" className="text-ui-13">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tea-border pt-3">
            <Button type="button" variant="quiet" disabled={busy} onClick={onCancel}>Cancel</Button>
            <Button type="button" variant="primary" disabled={busy || vendorId === expected.vendorId}
              onClick={() => onSave(vendorId)}>{vendorId ? 'Save vendor' : 'Confirm clear'}</Button>
          </div>
        </>}
      </div>
    </Modal>
    <VendorFaceSheet open={faces} onClose={() => setFaces(false)} vendors={vendors}
      selectedName={selected?.name} loading={loading} onPick={vendor => {
        if (vendor.id) pick({ id: vendor.id, name: vendor.name });
      }} />
  </>;
}

function FindingEditor({ title, action, label, expected, saving, error, onCancel, onSave }: {
  title: string; action: string; label: string; expected: TeaConnection; saving: boolean; error?: string;
  onCancel: () => void; onSave: (text: string, resolved: boolean) => void;
}) {
  const [text, setText] = useState(expected.finding?.text || '');
  const [resolved, setResolved] = useState(expected.finding?.resolved || false);
  return <Modal isOpen title={expected.finding ? 'Update finding' : action}
    onClose={() => { if (!saving) onCancel(); }} disableBackdropClose={saving}>
    <form className="space-y-4 p-4" onSubmit={event => { event.preventDefault(); if (!saving && text.trim()) onSave(text, resolved); }}>
      <p className="text-ui-13 text-tea-text-sec">{title}</p>
      <label className="block text-ui-14">{label}
        <textarea className="input-field mt-1 px-3 py-2" cols={25} rows={4} value={text} required maxLength={4000} onChange={event => setText(event.target.value)} />
      </label>
      <label className="flex min-h-tap items-center gap-2 text-ui-13"><input type="checkbox" checked={resolved} onChange={event => setResolved(event.target.checked)} />This resolves the check</label>
      {error && <p role="alert" className="text-ui-13">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tea-border pt-3">
        <Button type="button" variant="quiet" disabled={saving} onClick={onCancel}>Cancel</Button>
        <Button variant="primary" disabled={saving || !text.trim()}>Save finding</Button>
      </div>
    </form>
  </Modal>;
}
