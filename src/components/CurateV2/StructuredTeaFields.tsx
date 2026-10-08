import React, { useEffect, useId, useState } from 'react';
import { readRouteQuotes, type RouteQuote } from '../../lib/curateStructuredFields';
import type { TeaCompassEntry } from './types';

type StructuredTeaEntry = Pick<TeaCompassEntry, 'id' | 'type' | 'ageQuoted' | 'grade' | 'packSizeGrams' | 'packSizeLabel' | 'vendorItemNumber' | 'discountPercent' | 'shopName' | 'transportMode' | 'routeQuotes'>;
const inputClass = 'curate-v2-field';
const selectClass = 'curate-v2-select min-w-0 flex-1';
const buttonClass = 'curate-v2-word tap-target min-h-11 px-1 text-tea-text-sec hover:text-tea-text';

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
  return <div className="min-w-0">
    <label className="curate-v2-line" htmlFor={id}>
      <span className="curate-v2-label">{label}</span>
      <input id={id} aria-label={label} className={`${inputClass} ${number ? 'tabular-nums' : ''}`} type={number ? 'number' : 'text'} inputMode={number ? 'decimal' : undefined}
        min={minimum} max={maximum} step={number ? 'any' : undefined} value={draft}
        onChange={event => setDraft(event.target.value)} onBlur={commit} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} />
    </label>
    {error && <span id={`${id}-error`} role="alert" className="block px-4 pt-1 text-ui-13 text-tea-text-sec">{error}</span>}
  </div>;
}

type RouteDraft = { id: string; mode: string; label: string; amount: string; currency: string; basis: string; quantity: string; priceKind: string; destination: string };
const newRoute = (): RouteDraft => ({ id: crypto.randomUUID(), mode: '', label: '', amount: '', currency: '', basis: '', quantity: '', priceKind: '', destination: '' });

/** Shared by both Curate editors and private detail panels. Quotes record
 * evidence only; nothing here changes retail pricing, freight or inventory. */
export function StructuredTeaFields({ entry, onChange, routeOnly = false }: { entry: StructuredTeaEntry; onChange: (patch: Partial<StructuredTeaEntry>) => void; routeOnly?: boolean }) {
  const [draft, setDraft] = useState<RouteDraft | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setDraft(null); setError(''); }, [entry.id]);
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
  const routeField = (label: string, key: keyof RouteDraft, type: 'text' | 'number' = 'text') => <label className="curate-v2-line">
    <span className="curate-v2-label">{label}</span>
    <input className={`${inputClass} ${type === 'number' ? 'tabular-nums' : ''}`} type={type} step={type === 'number' ? 'any' : undefined} value={draft?.[key] ?? ''} onChange={event => set(key, event.target.value)} />
  </label>;
  const routeSelect = (label: string, key: keyof RouteDraft, options: Array<[string, string]>) => <label className="curate-v2-line">
    <span className="curate-v2-label">{label}</span>
    <select className={selectClass} value={draft?.[key] ?? ''} onChange={event => set(key, event.target.value)}>
      <option value="">Choose</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
    </select>
  </label>;
  return <details className="curate-v2 border-b border-tea-border" data-testid="structured-tea-fields">
    <summary className="curate-v2-label flex min-h-14 cursor-pointer items-center px-4">{routeOnly ? 'Route price quotes' : 'Tea details & sourcing'}</summary>
    <div className="pb-3">
      {!routeOnly && <div className="border-t border-tea-border">
        <Field label="Quoted age" value={entry.ageQuoted} onCommit={value => onChange({ ageQuoted: value as string | null })} />
        <Field label="Grade" value={entry.grade} onCommit={value => onChange({ grade: value as string | null })} />
        <Field label="Pack weight (g)" value={entry.packSizeGrams} number minimum={0} onCommit={value => onChange({ packSizeGrams: value as number | null })} />
        <Field label="Pack description" value={entry.packSizeLabel} onCommit={value => onChange({ packSizeLabel: value as string | null })} />
        <Field label="Vendor item number" value={entry.vendorItemNumber} onCommit={value => onChange({ vendorItemNumber: value as string | null })} />
        <Field label="Discount (%)" value={entry.discountPercent} number minimum={0} maximum={100} onCommit={value => onChange({ discountPercent: value as number | null })} />
        <Field label="Shop name" value={entry.shopName} onCommit={value => onChange({ shopName: value as string | null })} />
        <Field label="Shipping method" value={entry.transportMode} onCommit={value => onChange({ transportMode: value as string | null })} />
        <label className="curate-v2-line">
          <span className="curate-v2-label">Pu-erh processing</span>
          <select className={selectClass} value={entry.type === 'Sheng' || entry.type === 'Shou' ? entry.type : ''}
            onChange={event => { if (event.target.value) onChange({ type: event.target.value as TeaCompassEntry['type'] }); }}>
            <option value="">Use the tea type selected above</option><option value="Sheng">Sheng (raw)</option><option value="Shou">Shou (ripe)</option>
          </select>
        </label>
      </div>}
      <div>
        <p className="curate-v2-label px-4 pb-1 pt-4">Route price quotes</p>
        {routes.map(quote => <div key={quote.id} className="flex flex-wrap items-center gap-2 border-b border-tea-border px-4 py-2">
          <p className="min-w-0 flex-1 font-mono text-ui-13 leading-relaxed text-tea-text-sec">
            {quote.label || quote.mode}: {quote.amount} {quote.currency} / {quote.basis_quantity} {quote.basis}, {quote.price_kind === 'landed' ? 'landed' : 'tea only'}{quote.destination ? ` to ${quote.destination}` : ''}
          </p>
          <button type="button" className={buttonClass} onClick={() => editRoute(quote)} aria-label={`Edit ${quote.label || quote.mode} quote`}>Edit</button>
          <button type="button" className={buttonClass} onClick={() => onChange({ routeQuotes: routes.filter(row => row.id !== quote.id) })} aria-label={`Remove ${quote.label || quote.mode} quote`}>Remove</button>
        </div>)}
        {!draft && <div className="px-4 pt-2"><button type="button" className="curate-v2-frame is-tall" onClick={() => { setDraft(newRoute()); setError(''); }}>Add route quote</button></div>}
        {draft && <div role="group" aria-label="Route quote editor">
          <div className="border-t border-tea-border">
            {routeSelect('Route', 'mode', [['air', 'Air'], ['sea', 'Sea'], ['land', 'Land'], ['courier', 'Courier']])}
            {routeField('Quote label', 'label')}{routeField('Quoted amount', 'amount', 'number')}{routeField('Quote currency', 'currency')}
            {routeSelect('Price basis', 'basis', [['g', 'Gram'], ['kg', 'Kilogram'], ['piece', 'Piece'], ['total', 'Total']])}
            {routeField('Basis quantity', 'quantity', 'number')}
            {routeSelect('Price includes', 'priceKind', [['tea_only', 'Tea only'], ['landed', 'Tea and freight']])}
            {routeField('Destination', 'destination')}
          </div>
          {error && <p role="alert" className="px-4 pt-2 text-ui-13 text-tea-text-sec">{error}</p>}
          <div className="flex justify-between gap-2 px-4 pt-2">
            <button type="button" className={buttonClass} onClick={() => { setDraft(null); setError(''); }}>Cancel route quote</button>
            <button type="button" className="curate-v2-frame is-on is-tall" onClick={saveRoute}>Save route quote</button>
          </div>
        </div>}
      </div>
    </div>
  </details>;
}
