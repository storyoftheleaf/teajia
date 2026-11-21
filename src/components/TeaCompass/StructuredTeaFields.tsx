import React, { useEffect, useId, useState } from 'react';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { readRouteQuotes, type RouteQuote } from '../../lib/curateStructuredFields';
import type { TeaCompassEntry } from './types';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { TeaSourcingConnections, useTeaSupplierQuote } from '../curate/TeaSourcingConnections';

type StructuredTeaEntry = Pick<TeaCompassEntry, 'id'> & Partial<TeaCompassEntry>;
const inputClass = 'input-field min-h-tap min-w-0 px-3 py-2 text-ui-16';
const buttonClass = 'tap-target min-h-tap px-3 py-2 text-ui-12 text-tea-text-sec hover:text-tea-text';

function Field({ label, value, number, minimum, maximum, onCommit }: {
  label: string; value?: string | number | null; number?: boolean; minimum?: number; maximum?: number;
  onCommit: (value: string | number | null) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(String(value ?? ''));
  const [error, setError] = useState('');
  useEffect(() => { setDraft(String(value ?? '')); setError(''); }, [value]);
  const commit = () => {
    const text = draft.trim();
    if (!text) { setError(''); onCommit(null); return; }
    if (!number) { setError(''); onCommit(text); return; }
    const amount = Number(text);
    if (!Number.isFinite(amount) || (minimum != null && amount < minimum) || (maximum != null && amount > maximum) || (minimum === 0 && maximum == null && amount === 0)) {
      setError(maximum === 100 ? 'Enter a discount from 0 to 100.' : 'Enter a positive weight.');
      return;
    }
    setError(''); onCommit(amount);
  };
  return <label className="block min-w-0 space-y-1" htmlFor={id}>
    <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>{label}</span>
    <input id={id} aria-label={label} className={inputClass} type={number ? 'number' : 'text'} inputMode={number ? 'decimal' : undefined}
      min={minimum} max={maximum} step={number ? 'any' : undefined} value={draft}
      onChange={event => setDraft(event.target.value)} onBlur={commit} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
    {error && <span id={`${id}-error`} role="alert" className="block text-ui-12 text-tea-text-sec">{error}</span>}
  </label>;
}

type RouteDraft = { id: string; mode: string; label: string; amount: string; currency: string; basis: string; quantity: string; priceKind: string; destination: string };
const newRoute = (): RouteDraft => ({ id: crypto.randomUUID(), mode: '', label: '', amount: '', currency: '', basis: '', quantity: '', priceKind: '', destination: '' });

/** Tea-specific facts stay here; vendor, order, freight and quote facts are read from shared records. */
export function StructuredTeaFields({ entry, onChange, routeOnly = false, flat = false, leading }: { entry: StructuredTeaEntry; onChange: (patch: Partial<StructuredTeaEntry>) => void; routeOnly?: boolean; flat?: boolean; tightTop?: boolean; leading?: React.ReactNode; bare?: boolean }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { quoteLine } = useTeaSupplierQuote(entry);
  const [draft, setDraft] = useState<RouteDraft | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(null); setError(''); setDetailsOpen(false); }, [entry.id]);
  const routes = entry.routeQuotes ?? [];
  const set = (key: keyof RouteDraft, value: string) => setDraft(current => current ? { ...current, [key]: value } : current);
  const editRoute = (quote: RouteQuote) => {
    setDraft({ id: quote.id, mode: quote.mode, label: quote.label ?? '', amount: String(quote.amount), currency: quote.currency,
      basis: quote.basis, quantity: String(quote.basis_quantity), priceKind: quote.price_kind, destination: quote.destination ?? '' });
    setError('');
  };
  const saveRoute = () => {
    if (!draft) return;
    if (!draft.mode || !draft.amount.trim() || !draft.currency.trim() || !draft.basis || !draft.quantity.trim() || !draft.priceKind) {
      setError('Choose the route and price basis, and enter the amount, currency and quantity.'); return;
    }
    if (!Number.isFinite(Number(draft.amount)) || Number(draft.amount) < 0 || !Number.isFinite(Number(draft.quantity)) || Number(draft.quantity) <= 0) {
      setError('Enter a nonnegative amount and a positive basis quantity.'); return;
    }
    try {
      const [quote] = readRouteQuotes([{ id: draft.id, mode: draft.mode, amount: Number(draft.amount), currency: draft.currency,
        basis: draft.basis, basis_quantity: Number(draft.quantity), price_kind: draft.priceKind,
        ...(draft.label.trim() ? { label: draft.label.trim() } : {}), ...(draft.destination.trim() ? { destination: draft.destination.trim() } : {}) }]);
      onChange({ routeQuotes: readRouteQuotes([...routes.filter(row => row.id !== quote.id), quote]) });
      setDraft(null); setError('');
    } catch {
      setError('Check the stated currency and price basis. A piece quantity must be a whole number.');
    }
  };
  const routeField = (label: string, key: keyof RouteDraft, type: 'text' | 'number' = 'text') => <label className="block min-w-0 space-y-1">
    <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>{label}</span>
    <input className={inputClass} type={type} step={type === 'number' ? 'any' : undefined} value={draft?.[key] ?? ''} onChange={event => set(key, event.target.value)} />
  </label>;
  const routeSelect = (label: string, key: keyof RouteDraft, options: Array<[string, string]>) => <label className="block min-w-0 space-y-1">
    <span className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>{label}</span>
    <select className={inputClass} value={draft?.[key] ?? ''} onChange={event => set(key, event.target.value)}>
      <option value="">Choose</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select>
  </label>;
  const content = <section data-testid="structured-tea-fields" aria-label={routeOnly ? 'Route price quotes' : 'Tea details'}>
    <div className="space-y-4 pb-3">
      {leading}
      {!routeOnly && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Quoted age" value={entry.ageQuoted} onCommit={value => onChange({ ageQuoted: value as string | null })} />
        <Field label="Grade" value={entry.grade} onCommit={value => onChange({ grade: value as string | null })} />
        <Field label="Pack weight (g)" value={entry.packSizeGrams} number minimum={0} onCommit={value => onChange({ packSizeGrams: value as number | null })} />
        <Field label="Pack description" value={entry.packSizeLabel} onCommit={value => onChange({ packSizeLabel: value as string | null })} />
        {!quoteLine && <Field label="Vendor item number" value={entry.vendorItemNumber} onCommit={value => onChange({ vendorItemNumber: value as string | null })} />}

      </div>}
      {!routeOnly && <>
        <p className="text-ui-12 text-tea-text-sec">Pack weight is per cake, can or piece. The quoted weight above is what the supplier price covers.</p>
        <TeaSourcingConnections entry={entry} />

      </>}
      {routeOnly && <div className="space-y-2">
        <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Route price quotes</p>
        {routes.map(quote => <div key={quote.id} className="flex flex-wrap items-center gap-2 border-b border-tea-border py-2">
          <p className={`${TYPOGRAPHY_CLASSES.body} min-w-0 flex-1 text-tea-text-sec`}>
            {quote.label || quote.mode}: {quote.amount} {quote.currency} / {quote.basis_quantity} {quote.basis}, {quote.price_kind === 'landed' ? 'landed' : 'tea only'}{quote.destination ? ` to ${quote.destination}` : ''}
          </p>
          <button type="button" className={buttonClass} onClick={() => editRoute(quote)} aria-label={`Edit ${quote.label || quote.mode} quote`}>Edit</button>
          <button type="button" className={buttonClass} onClick={() => onChange({ routeQuotes: routes.filter(row => row.id !== quote.id) })} aria-label={`Remove ${quote.label || quote.mode} quote`}>Remove</button>
        </div>)}
        {!draft && <button type="button" className={buttonClass} onClick={() => { setDraft(newRoute()); setError(''); }}>Add route quote</button>}
        {draft && <div className="space-y-3" role="group" aria-label="Route quote editor">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {routeSelect('Route', 'mode', [['air', 'Air'], ['sea', 'Sea'], ['land', 'Land'], ['courier', 'Courier']])}
            {routeField('Quote label', 'label')}{routeField('Quoted amount', 'amount', 'number')}{routeField('Quote currency', 'currency')}
            {routeSelect('Price basis', 'basis', [['g', 'Gram'], ['kg', 'Kilogram'], ['piece', 'Piece'], ['total', 'Total']])}
            {routeField('Basis quantity', 'quantity', 'number')}
            {routeSelect('Price includes', 'priceKind', [['tea_only', 'Tea only'], ['landed', 'Tea and freight']])}
            {routeField('Destination', 'destination')}
          </div>
          {error && <p role="alert" className="text-ui-12 text-tea-text-sec">{error}</p>}
          <div className="flex justify-between gap-2">
            <button type="button" className={buttonClass} onClick={() => { setDraft(null); setError(''); }}>Cancel route quote</button>
            <button type="button" className={`${buttonClass} text-tea-gold`} onClick={saveRoute}>Save route quote</button>
          </div>
        </div>}
      </div>}
    </div>
  </section>;
  if (flat || routeOnly) return content;
  return <>
    <Button type="button" variant="quiet" size="sm" className="tap-target" aria-haspopup="dialog" onClick={() => setDetailsOpen(true)}>Tea details</Button>
    <Modal isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} title="Tea details">
      <div className="px-4 pb-4">{content}</div>
    </Modal>
  </>;
}
