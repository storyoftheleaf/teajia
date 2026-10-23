import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowseCard } from '../components/TeaCompass/BrowseCard';
import { librarySupplierGroups } from '../components/TeaCompass/librarySupplierGroups';
import { entryNeedsTasting, type TeaCompassEntry } from '../components/TeaCompass/types';
import { shopOrderOf } from '../components/CurateV2/shopOrders';
import { libraryPurchaseStateOf } from '../lib/libraryPurchaseState';
import { toCamelCase } from '../lib/teaCompassSync';
import type { CuratePurchaseReceipt, PurchaseOrder } from '../lib/api';
import type { InventoryReceipt } from '../admin/types';
import type { RateRow } from '../lib/currency';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { useTheme } from '../context/ThemeContext';
import { beginLibraryPreviewAuthorization, clearLibraryPreviewSession, libraryPreviewFetchSnapshot, redeemLibraryPreviewCode } from '../lib/libraryPreviewSession';

interface Snapshot {
  entries: Array<Record<string, unknown>>;
  purchaseOrders: PurchaseOrder[];
  receipts: InventoryReceipt[];
  proposals: CuratePurchaseReceipt[];
  rates: RateRow[];
  accountId: string;
  expiresAt: number;
  ledgerDraftsAvailable: false;
}
/** Uses the production card and quantity resolver, with no admin session or sync loop. */
export default function LibraryPreviewPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const { toggleTheme } = useTheme();
  const requestRevision = useRef(0);
  async function refresh() {
    const revision = ++requestRevision.current;
    setLoading(true); setError(''); setSelected(null);
    try {
      const session = await redeemLibraryPreviewCode();
      const next = session ? await libraryPreviewFetchSnapshot<Snapshot>() : null;
      if (revision === requestRevision.current) setSnapshot(next);
    } catch (e) { if (revision === requestRevision.current) { setSnapshot(null); setError(e instanceof Error ? e.message : 'Could not load Library.'); } }
    finally { if (revision === requestRevision.current) setLoading(false); }
  }
  useEffect(() => { void refresh(); return () => { requestRevision.current++; }; }, []);
  useEffect(() => {
    if (!snapshot) return;
    const timer = window.setTimeout(() => { requestRevision.current++; setLoading(false); setSnapshot(null); setSelected(null); clearLibraryPreviewSession(); setError('Preview access expired. Connect again.'); }, Math.max(0, snapshot.expiresAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [snapshot]);
  const entries = useMemo(() => (snapshot?.entries ?? []).map(row => {
    const entry = toCamelCase(row);
    return entry;
  }), [snapshot]);
  const orders = useMemo(() => snapshot?.purchaseOrders.map(shopOrderOf) ?? [], [snapshot]);
  const stateFor = (entry: TeaCompassEntry) => libraryPurchaseStateOf({ entryId: entry.id, productId: entry.draftProductId, chosen: entry.decision === 'selected' }, [], orders, snapshot?.receipts ?? [], snapshot?.proposals ?? []);
  const filtered = entries.filter(entry => {
    if (filter === 'selected' && entry.decision !== 'selected') return false;
    if (filter === 'to_taste' && (snapshot?.entries.find(row => row.id === entry.id)?.preview_tasted || !entryNeedsTasting(entry))) return false;
    return [entry.name, entry.vendorName, entry.originRegion, entry.type].filter(Boolean).join(' ').toLowerCase().includes(query.toLowerCase());
  });
  const groups = librarySupplierGroups(filtered);
  const detail = entries.find(entry => entry.id === selected);
  return <main id="main-content" className="mx-auto max-w-7xl p-3 sm:p-5 text-tea-text">
    <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-tea-border pb-3">
      <div><p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>READ-ONLY DEVELOPMENT PREVIEW</p><h1 className={TYPOGRAPHY_CLASSES.h2}>Library · By supplier</h1></div>
      <div className="flex flex-wrap gap-2"><button className="min-h-11 rounded-md border border-tea-border px-3 text-ui-12" onClick={toggleTheme}>Light / dark</button>{snapshot && <><button className="min-h-11 rounded-md border border-tea-border px-3 text-ui-12" disabled={loading} onClick={() => void refresh()}>Refresh</button><button className="min-h-11 rounded-md border border-tea-border px-3 text-ui-12" onClick={() => { requestRevision.current++; setLoading(false); clearLibraryPreviewSession(); setSnapshot(null); setSelected(null); }}>Disconnect</button></>}</div>
    </header>
    {error && <p role="alert" className="mb-3 text-ui-13 text-tea-text-sec">{error}</p>}
    {loading && <p role="status" className="text-ui-13">Loading Library…</p>}
    {!snapshot && !loading && <section className="max-w-xl rounded-md border border-tea-border bg-tea-surface p-5 space-y-4"><h2 className={TYPOGRAPHY_CLASSES.h3}>Connect your real Library</h2><p className={TYPOGRAPHY_CLASSES.bodyLight}>Use your existing Teajia sign-in to allow this preview to read suppliers, quotes and recorded order quantities for eight hours. It cannot change records.</p><button className="min-h-11 rounded-md border border-tea-border bg-tea-elevated px-4 text-ui-13" onClick={() => void beginLibraryPreviewAuthorization().catch(e => setError(e.message))}>Connect Library</button></section>}
    {snapshot && <>
      <p className="mb-3 text-ui-12 text-tea-text-sec">Live recorded quotes, orders and receipts. Browser-only draft orders are not included. Actions open read-only details.</p>
      <div className="mb-4 flex flex-wrap items-center gap-2"><input className="min-h-11 min-w-0 flex-1 rounded-md border border-tea-border bg-tea-surface px-3 text-ui-16" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tea or supplier" aria-label="Search Library" />{[['all', 'All'], ['selected', 'Selected'], ['to_taste', 'To taste']].map(([value, label]) => <button key={value} className={`min-h-11 rounded-md border px-3 text-ui-12 ${filter === value ? 'border-tea-gold bg-tea-accent-sub' : 'border-tea-border'}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <div className="space-y-5">{groups.map(group => <section key={group.key} aria-label={group.label}><h2 className={`${TYPOGRAPHY_CLASSES.h3} mb-2`}>{group.label} <span className="text-ui-12 text-tea-text-dim">{group.entries.length}</span></h2><div className="library-card-layout"><div className="library-card-grid">{group.entries.map(entry => <BrowseCard key={entry.id} readOnly tastingRecorded={Boolean(snapshot.entries.find(row => row.id === entry.id)?.preview_tasted)} entry={entry} onEdit={setSelected} onOpenDetail={setSelected} onAcquire={setSelected} purchaseState={stateFor(entry)} rates={snapshot.rates} />)}</div></div></section>)}</div>
      {!filtered.length && <p className="py-6 text-ui-13 text-tea-text-sec">No matching teas.</p>}
      <p className="mt-5 text-ui-11 text-tea-text-dim">Access expires {new Date(snapshot.expiresAt).toLocaleTimeString()}. <a className="underline" href="https://www.teajia.com/dev/library-preview/authorize" target="_blank" rel="noreferrer">Manage or revoke connections</a></p>
    </>}
    {detail && <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/90 p-4" role="dialog" aria-modal="true" aria-labelledby="preview-detail-title"><section className="w-full max-w-lg rounded-md border border-tea-border bg-tea-surface p-5"><h2 id="preview-detail-title" className={TYPOGRAPHY_CLASSES.h2}>{detail.name}</h2><p className="mt-2 text-ui-13 text-tea-text-sec">Read-only preview. Pricing, ordering and tasting changes are disabled.</p><dl className="mt-4 space-y-2 text-ui-13"><div><dt className="text-tea-text-dim">Supplier</dt><dd>{detail.vendorName || 'Not recorded'}</dd></div><div><dt className="text-tea-text-dim">Quote</dt><dd>{detail.priceAmount == null ? 'Not recorded' : `${detail.priceAmount} ${detail.priceCurrency}`} / {detail.pricePerUnitGrams ? `${detail.pricePerUnitGrams}g` : 'weight not recorded'}</dd></div>{stateFor(detail).quantities.map(q => <div key={q.unit}><dt className="text-tea-text-dim">Order quantities ({q.unit})</dt><dd>{q.ordered} ordered · {q.received ?? 'Unknown'} received · {q.due ?? 'Unknown'} incoming</dd></div>)}</dl><button autoFocus className="mt-5 min-h-11 rounded-md border border-tea-border px-4 text-ui-13" onClick={() => setSelected(null)}>Close</button></section></div>}
  </main>;
}
