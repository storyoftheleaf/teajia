import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { canonicalCurrency } from '../../../lib/currency';
import type { ShippingRoute } from '../../../components/shared/routeFreight';
import { SHIPPING_ROUTES_KEY, useShippingRoutes } from '../../../components/shared/useShippingRoutes';
import { money } from '../../../components/shared/BuyingBasket';

// Shipping routes, set once (canvas Flow 3, plan samples-to-orders.md build 3).
// The buying basket estimates freight from these without asking. Each figure
// is tapped and typed; an empty field is "nobody said", never zero.

const MODE_WORD = { air: 'Air', sea: 'Boat' } as const;
const box = 'h-11 px-2.5 border border-tea-border rounded-md flex flex-col justify-center text-left min-w-0';
const label = 'font-sans text-ui-9 uppercase tracking-[0.1em] text-tea-text-dim leading-none mb-1';

/** Tap, type, Enter or leave the field to save; Escape keeps what was there. */
const Tap: React.FC<{ value: string; aria: string; placeholder: string; disabled: boolean; onSave: (text: string) => void; className?: string; inputMode?: 'decimal' | 'text'; width?: string }> =
  ({ value, aria, placeholder, disabled, onSave, className = '', inputMode = 'text', width = '' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  if (editing) {
    return <input ref={ref} aria-label={aria} inputMode={inputMode} value={draft} onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { setEditing(false); if (draft.trim() !== value) onSave(draft); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
      className={`min-w-0 bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 text-tea-text ${width} ${className}`} />;
  }
  return <button type="button" aria-label={aria} disabled={disabled} onClick={() => { setDraft(value); setEditing(true); }}
    className={`min-w-0 truncate text-left disabled:cursor-default ${value ? 'text-tea-text' : 'text-tea-text-dim'} ${className}`}>{value || placeholder}</button>;
};

const num = (n: number | null) => (n == null ? '' : String(n));

const RouteRow: React.FC<{ route: ShippingRoute; canEdit: boolean; onSave: (id: string, patch: Record<string, unknown>) => void; onRemove: (id: string) => void }> = ({ route: r, canEdit, onSave, onRemove }) => {
  const save = (field: string) => (text: string) => onSave(r.id, { [field]: text });
  const word = MODE_WORD[r.mode];
  const learned = r.learned
    ? `Your last ${r.learned.bills === 1 ? 'freight bill' : `${r.learned.bills} ${word.toLowerCase()} bills`} came to ${money(r.learned.per_kg, r.learned.currency)} a kilo.`
    : `No ${word.toLowerCase()} bills recorded yet${r.rate_per_kg == null ? (r.mode === 'air' ? '; the shop freight rate applies.' : '; boat freight is not estimated until it has a rate.') : '.'}`;
  return (
    <div data-testid="shipping-route" className="py-3 border-b border-tea-border last:border-b-0">
      <div className="flex items-baseline gap-2 min-w-0">
        <span className={`font-display text-ui-20 font-semibold ${r.mode === 'air' ? 'text-tea-gold-lt' : 'text-tea-text'}`}>{word}</span>
        <Tap value={r.carrier ?? ''} aria={`${word} carrier`} placeholder="carrier" disabled={!canEdit} onSave={save('carrier')} className="text-ui-13 flex-1" />
        <span className="ml-auto shrink-0 flex items-baseline gap-1 num text-ui-14">
          <Tap value={num(r.rate_per_kg)} aria={`${word} rate per kilo`} placeholder="rate" disabled={!canEdit} onSave={(t) => onSave(r.id, { rate_per_kg: t, rate_currency: r.rate_currency ?? 'Yuan' })} inputMode="decimal" width="w-14" className="text-right" />
          <Tap value={r.rate_currency ?? ''} aria={`${word} rate currency`} placeholder="¥" disabled={!canEdit} onSave={(t) => onSave(r.id, { rate_currency: canonicalCurrency(t) ?? t, rate_per_kg: r.rate_per_kg })} width="w-12" className="text-ui-12 text-tea-text-sec" />
          <span className="text-ui-12 text-tea-text-sec">/ kg</span>
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1 text-ui-12 text-tea-text-sec min-w-0">
        <span className="shrink-0">{r.mode === 'air' ? 'arrives at' : 'leaves from'}</span>
        <Tap value={r.destination ?? ''} aria={`${word} received at`} placeholder="add an address" disabled={!canEdit} onSave={save('destination')} className="text-ui-12 flex-1" />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2.5">
        <div className={box}><span className={label}>Packing adds</span>
          <span className="flex items-baseline num text-ui-15"><Tap value={num(r.packing_percent)} aria={`${word} packing percent`} placeholder="—" disabled={!canEdit} onSave={save('packing_percent')} inputMode="decimal" width="w-10" className="mr-0.5" /><span className="text-ui-12 text-tea-text-sec">%</span></span>
        </div>
        <div className={box}><span className={label}>Billed by</span>
          <span className="flex items-baseline num text-ui-15"><Tap value={num(r.billing_step_kg)} aria={`${word} billing step in kilos`} placeholder="—" disabled={!canEdit} onSave={save('billing_step_kg')} inputMode="decimal" width="w-10" className="mr-0.5" /><span className="text-ui-12 text-tea-text-sec">kg</span></span>
        </div>
        <div className={box}><span className={label}>Minimum</span>
          <span className="flex items-baseline num text-ui-15"><Tap value={num(r.minimum_kg)} aria={`${word} minimum kilos`} placeholder="—" disabled={!canEdit} onSave={save('minimum_kg')} inputMode="decimal" width="w-10" className="mr-0.5" /><span className="text-ui-12 text-tea-text-sec">kg</span></span>
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-3">
        <p className="text-ui-12 text-tea-text-sec">{learned}</p>
        {canEdit && <button type="button" onClick={() => onRemove(r.id)} className="ml-auto shrink-0 text-ui-12 text-tea-text-sec hover:text-tea-text">Remove</button>}
      </div>
    </div>
  );
};

export const ShippingRoutesSection: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const { data: routes = [], isLoading, isError } = useShippingRoutes();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const run = async (p: Promise<unknown>) => {
    setError('');
    try { await p; } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    void queryClient.invalidateQueries({ queryKey: SHIPPING_ROUTES_KEY });
  };
  return (
    <section aria-labelledby="shipping-routes-heading" className="mt-6 bg-tea-surface rounded-xl border border-tea-border p-5">
      <h2 id="shipping-routes-heading" className="label-caps text-tea-text-dim">Shipping routes</h2>
      <p className="mt-1 text-ui-12 text-tea-text-sec">Set once. The buying basket estimates freight from these, packing and rounding included. Shelf prices still use the freight rate above.</p>
      {isLoading ? <p className="py-3 text-ui-13 text-tea-text-sec">Loading…</p>
        : isError ? <p role="alert" className="py-3 text-ui-13 text-tea-error">Could not load the routes.</p>
        : routes.length === 0 ? <p className="py-3 text-ui-13 text-tea-text-sec">No routes yet. Air follows the shop freight rate until you add one.</p>
        : routes.map((r) => <RouteRow key={r.id} route={r} canEdit={canEdit}
            onSave={(id, patch) => void run(api.shippingRoutes.save(id, patch))}
            onRemove={(id) => void run(api.shippingRoutes.remove(id))} />)}
      {error && <p role="alert" className="mt-2 text-ui-12 text-tea-error">{error}</p>}
      {canEdit && (
        <div className="mt-3 flex gap-4 text-ui-13">
          <button type="button" onClick={() => void run(api.shippingRoutes.save(null, { mode: 'air' }))} className="text-tea-gold-lt hover:text-tea-gold">+ Air route</button>
          <button type="button" onClick={() => void run(api.shippingRoutes.save(null, { mode: 'sea' }))} className="text-tea-gold-lt hover:text-tea-gold">+ Boat route</button>
        </div>
      )}
    </section>
  );
};
