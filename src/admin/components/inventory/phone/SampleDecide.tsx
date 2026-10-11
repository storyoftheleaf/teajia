import React, { useEffect, useRef, useState } from 'react';
import { fmtNum } from '../../../../utils/formatNumber';
import { getThemeTextColor } from '../../../themeUtils';
import { useLedgerStore } from '../../../../lib/ledgerStore';
import { useTeaCompassStore } from '../../../../lib/teaCompassStore';
import {
  rateSample, setSampleQuote, setSampleRejected, useLiveEntry, wantSample, wantedAmount, wantsPieces,
} from './sampleDecisions';
import { splitItemCode } from '../sampleRows';
import type { SampleHolding } from './PhoneSamplesList';

// One sample (canvas Flow 1, plan samples-to-orders.md; revised 2026-10-11):
//   line 1  name (item code small beside it) · year · kind, house name under it
//   line 2  Cost (amount) · For (grams) · $/g, the first two tappable
//   line 3  how much he likes it, 1 to 10 on a slider (the tasting score's own
//           steps), then Taste | Reject | Want as one control
// Want asks how much before anything is added. Reject hides the row; a rejected
// row shows Restore instead of the control. A shelf product bought to sample
// uses the same row: its Curate record is made the first time it is rated,
// rejected or wanted (`resolveId`), and its cost is the product's own.

const whole = (n: number): string => fmtNum(n, Number.isInteger(n) ? 0 : 2);
const SYMBOL: Record<string, string> = { yuan: '¥', cny: '¥', rmb: '¥', usd: '$', nt: 'NT$', twd: 'NT$', hkd: 'HK$', idr: 'Rp' };
export const moneyMark = (c: unknown): string => SYMBOL[String(c || '').toLowerCase()] ?? (c ? `${String(c)} ` : '');
const label = 'text-ui-9 uppercase tracking-[0.1em] text-tea-text-dim';

/** The values a row shows: the live Curate entry when loaded, else what the server sent. */
function view(h: SampleHolding, live: ReturnType<typeof useLiveEntry>) {
  const e = h.entry;
  let tasting: Record<string, unknown> = {};
  try { tasting = live?.tasting ?? (typeof e.tasting === 'string' ? JSON.parse(e.tasting || '{}') : e.tasting ?? {}); } catch { tasting = {}; }
  const amount = live ? live.priceAmount : (e.price_amount == null ? undefined : Number(e.price_amount));
  const grams = live ? live.pricePerUnitGrams : (e.price_per_unit_grams == null ? undefined : Number(e.price_per_unit_grams));
  return {
    name: live?.name || e.name || e.chinese_name || '',
    houseName: (live ? live.shopName : e.shop_name) ?? '',
    year: live?.year ?? e.year,
    kind: live?.type ?? e.type ?? 'Tea',
    form: live?.form ?? e.form,
    currency: live?.priceCurrency ?? e.price_currency ?? '',
    amount: amount ?? null,
    grams: grams ?? null,
    quality: (tasting.quality as number | undefined) ?? null,
    rejected: (live?.decision ?? e.decision) === 'passed_on',
    category: live?.category ?? e.category,
  };
}

export function isRejected(h: SampleHolding, liveDecision: string | null | undefined): boolean {
  return (liveDecision ?? h.entry.decision) === 'passed_on';
}

export const QuoteField: React.FC<{ value: number | null; aria: string; display: React.ReactNode; onSave: (text: string) => void; small?: boolean }> = ({ value, aria, display, onSave, small }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  const done = (save: boolean) => { setEditing(false); if (save && draft.trim() !== (value == null ? '' : String(value))) onSave(draft); };
  if (editing) {
    return (
      <input ref={ref} aria-label={aria} inputMode="decimal" value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={() => done(true)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') done(false); }}
        className={`w-full min-w-0 bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 font-mono ${small ? 'text-ui-13 w-14' : 'text-ui-16'} tabular-nums text-tea-text`} />
    );
  }
  return <button type="button" aria-label={aria} onClick={(e) => { e.stopPropagation(); setDraft(value == null ? '' : String(value)); setEditing(true); }} className={`text-left font-mono ${small ? 'text-ui-13' : 'text-ui-16'} tabular-nums text-tea-text`}>{display}</button>;
};

/**
 * The house name, typed in place. Empty shows a thin italic "name this" so it is
 * clear where to tap; Enter or leaving the field saves, Escape keeps what was there.
 */
export const HouseNameField: React.FC<{ value: string; aria: string; onSave: (text: string) => void; className?: string }> = ({ value, aria, onSave, className = '' }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);
  if (editing) {
    return <input ref={ref} aria-label={aria} value={draft} onChange={(e) => setDraft(e.target.value)} onClick={(e) => e.stopPropagation()}
      onBlur={() => { setEditing(false); if (draft.trim() !== value.trim()) onSave(draft.trim()); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
      className={`min-w-0 bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 text-tea-text ${className}`} />;
  }
  return <button type="button" aria-label={aria} onClick={(e) => { e.stopPropagation(); setDraft(value); setEditing(true); }}
    className={`min-w-0 truncate text-left hover:text-tea-gold ${value.trim() ? '' : 'italic font-light text-tea-text-sec'} ${className}`}>{value.trim() || 'name this'}</button>;
};

/** The item code, small and quiet: Adrian's own identifier, not part of the name. */
export const ItemCode: React.FC<{ code: string | null }> = ({ code }) =>
  code ? <span title="Item code" className="shrink-0 font-mono text-ui-9 tracking-[0.04em] text-tea-text-dim">{code}</span> : null;

/** How much he likes it, 1 to 10: the tasting score itself, on a slider with its ten steps. */
export const LikeSlider: React.FC<{ value: number | null; onChange: (v: number) => void; compact?: boolean }> = ({ value, onChange, compact }) => {
  const [local, setLocal] = useState<number | null>(value);
  useEffect(() => setLocal(value), [value]);
  return (
    <label className={`flex items-center gap-2 min-w-0 ${compact ? 'w-[200px]' : 'flex-1'}`}>
      <span className="sr-only">How much you like it, 1 to 10</span>
      <input type="range" min={1} max={10} step={1} value={local ?? 1}
        aria-valuetext={local == null ? 'not rated' : `${local} of 10`}
        onChange={(e) => { const v = Number(e.target.value); setLocal(v); onChange(v); }}
        className={`sample-like-slider flex-1 min-w-0 w-0 ${local == null ? 'is-unrated' : ''}`} />
      <span className="w-6 shrink-0 text-right font-mono tabular-nums text-ui-13 text-tea-text">{local ?? <span className="text-tea-text-dim">–</span>}</span>
    </label>
  );
};

/** The slider and Taste | Reject | Want, plus the "how much" step. Shared by the phone row and the Stock table. */
export const SampleDecideBar: React.FC<{ holding: SampleHolding; onTaste: () => void; compact?: boolean; resolveId?: () => Promise<string> }> = ({ holding, onTaste, compact, resolveId }) => {
  const id = String(holding.entry.id);
  const live = useLiveEntry(id);
  const v = view(holding, live);
  useLedgerStore((s) => s.transactions); // re-render when the order changes
  const wanted = wantedAmount(id);
  const pieces = wantsPieces({ priceAmount: v.amount ?? undefined, pricePerUnitGrams: v.grams ?? undefined, form: v.form, category: v.category });
  const [asking, setAsking] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const ensure = () => (resolveId ? resolveId() : Promise.resolve(id));
  const run = (p: () => Promise<void>) => { setError(''); p().catch(e => setError(e instanceof Error ? e.message : 'Could not save.')); };
  const ask = () => { setAmount(pieces ? '1' : String(v.grams ?? 100)); setAsking(true); };
  const n = Number(amount);
  const lineCost = v.amount != null && Number.isFinite(n) && n > 0 ? (pieces ? v.amount * n : v.grams ? (v.amount / v.grams) * n : null) : null;

  if (v.rejected) {
    return (
      <div className="flex items-center gap-3 text-ui-12">
        <span className="text-tea-text-dim">rejected</span>
        <button type="button" onClick={() => run(async () => setSampleRejected(await ensure(), false))} className="ml-auto text-tea-gold">Restore</button>
      </div>
    );
  }
  return (
    <div className="grid gap-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3">
        <LikeSlider value={v.quality} compact={compact} onChange={(q) => run(async () => rateSample(await ensure(), q))} />
        <div className={`ml-auto shrink-0 grid grid-cols-3 ${compact ? 'w-[180px]' : 'w-[200px]'} border border-tea-border rounded-md overflow-hidden text-ui-12`}>
          <button type="button" onClick={onTaste} className="h-8 text-tea-text-sec hover:text-tea-text">Taste</button>
          <button type="button" onClick={() => run(async () => setSampleRejected(await ensure(), true))} className="h-8 text-tea-error border-l border-tea-border">Reject</button>
          <button type="button" onClick={() => (wanted ? undefined : ask())} aria-pressed={!!wanted}
            className={`h-8 border-l border-tea-border ${wanted ? 'cta-solid' : 'text-tea-gold-lt'}`}>
            {wanted ? `${whole(wanted.amount)} ${wanted.unit}` : 'Want'}
          </button>
        </div>
      </div>
      {asking && (
        <form onSubmit={e => { e.preventDefault(); run(async () => { await wantSample(await ensure(), n); setAsking(false); }); }}
          className="flex items-center gap-2 px-2.5 py-1.5 border border-tea-border rounded-md text-ui-12 text-tea-text-sec whitespace-nowrap">
          <span>Want</span>
          <input aria-label={pieces ? 'How many pieces' : 'How many grams'} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} autoFocus
            className="w-14 bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 text-right font-mono text-ui-15 tabular-nums text-tea-text" />
          <span>{pieces ? (n === 1 ? 'piece' : 'pieces') : 'g'}</span>
          {lineCost != null && <span className="font-mono tabular-nums text-tea-text">{moneyMark(v.currency)}{whole(Math.round(lineCost))}</span>}
          <button type="button" onClick={() => setAsking(false)} className="ml-auto text-tea-text-sec hover:text-tea-text">Cancel</button>
          <button type="submit" disabled={!(n > 0)} className="text-tea-gold disabled:text-tea-text-dim">Add</button>
        </form>
      )}
      {error && <p role="alert" className="text-ui-12 text-tea-error">{error}</p>}
    </div>
  );
};

/** Where a row's edits go. A Curate sample writes to Curate; a shelf product to the product. */
export interface SampleRowWrites {
  quote: (field: 'amount' | 'grams', text: string) => Promise<void>;
  houseName: (text: string) => Promise<void>;
  resolveId?: () => Promise<string>;
}

export const curateWrites = (id: string): SampleRowWrites => ({
  quote: (field, text) => setSampleQuote(id, field, text),
  houseName: async (text) => { useTeaCompassStore.getState().updateEntry(id, { shopName: text || null }); },
});

/** The phone's sample row: three lines, as locked. */
export const SampleDecideRow: React.FC<{ holding: SampleHolding; onOpen: () => void; usdPerGram: (amount: number, grams: number, currency: string) => number | null; writes?: SampleRowWrites }> = ({ holding, onOpen, usdPerGram, writes }) => {
  const id = String(holding.entry.id);
  const live = useLiveEntry(id);
  const v = view(holding, live);
  const w = writes ?? curateWrites(id);
  const { code, name } = splitItemCode(v.name);
  const [error, setError] = useState('');
  const pg = v.amount != null && v.grams ? usdPerGram(v.amount, v.grams, String(v.currency)) : null;
  const save = (p: Promise<void>) => { setError(''); p.catch(e => setError(e instanceof Error ? e.message : 'Could not save.')); };
  return (
    <div data-testid="sample-decide-row" className={`px-4 py-2.5 border-b border-tea-border ${v.rejected ? 'opacity-60' : ''}`}>
      <div className="pb-1.5 border-b border-tea-border">
        <div className="flex items-baseline gap-2 min-w-0">
          <button type="button" onClick={onOpen} className="min-w-0 truncate text-left font-display text-[19px] font-semibold leading-tight text-tea-text">{name || 'Unnamed tea'}</button>
          <ItemCode code={code} />
          <span className="ml-auto shrink-0 text-ui-11 text-tea-text-sec">
            {v.year ? <span className="font-mono tabular-nums">{v.year}</span> : null}{v.year ? ' · ' : ''}
            <span style={{ color: getThemeTextColor(String(v.kind)) }}>{v.kind}</span>{v.form ? ` · ${v.form}` : ''}
          </span>
        </div>
        <HouseNameField value={v.houseName} aria={`House name for ${name || 'this tea'}`} onSave={(t) => save(w.houseName(t))} className="block text-ui-12 text-tea-text-sec" />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div className="h-11 px-2.5 border border-tea-border rounded-md flex flex-col justify-center">
          <span className={label}>Cost{v.currency ? ` · ${v.currency}` : ''}</span>
          <QuoteField value={v.amount} aria={`Cost of ${name}`} display={v.amount == null ? <span className="text-tea-text-dim">add</span> : whole(v.amount)} onSave={(t) => save(w.quote('amount', t))} />
        </div>
        <div className="h-11 px-2.5 border border-tea-border rounded-md flex flex-col justify-center">
          <span className={label}>For</span>
          <QuoteField value={v.grams} aria={`Grams that cost is for, ${name}`} display={v.grams == null ? <span className="text-tea-text-dim">add</span> : <>{whole(v.grams)}<span className="font-sans text-ui-10 text-tea-text-dim"> g</span></>} onSave={(t) => save(w.quote('grams', t))} />
        </div>
        <div className="h-11 px-1 flex flex-col justify-center text-right">
          <span className={label}>$/g</span>
          <span className="font-mono text-ui-16 tabular-nums text-tea-gold-lt">{pg == null ? '—' : fmtNum(pg)}</span>
        </div>
      </div>
      {error && <p role="alert" className="mt-1 text-ui-12 text-tea-error">{error}</p>}
      <div className="mt-2"><SampleDecideBar holding={holding} onTaste={onOpen} resolveId={w.resolveId} /></div>
    </div>
  );
};
