import React, { useEffect, useRef, useState } from 'react';
import { fmtNum } from '../../../../utils/formatNumber';
import { getThemeTextColor } from '../../../themeUtils';
import { useLedgerStore } from '../../../../lib/ledgerStore';
import {
  dotsFor, rateSample, setSampleQuote, setSampleRejected, useLiveEntry, wantSample, wantedAmount, wantsPieces,
} from './sampleDecisions';
import type { SampleHolding } from './PhoneSamplesList';

// One sample, as locked on 2026-10-10 (canvas Flow 1, plan samples-to-orders.md):
//   line 1  name · year · kind, a hairline under it
//   line 2  Cost (amount) · For (grams) · $/g, the first two tappable
//   line 3  rating 1 to 5 as dots, then Taste | Reject | Want as one control
// Want asks how much before anything is added. Reject hides the row; a rejected
// row shows Restore instead of the control.

const whole = (n: number): string => fmtNum(n, Number.isInteger(n) ? 0 : 2);
const SYMBOL: Record<string, string> = { yuan: '¥', cny: '¥', rmb: '¥', usd: '$', nt: 'NT$', twd: 'NT$', hkd: 'HK$', idr: 'Rp' };
const mark = (c: unknown): string => SYMBOL[String(c || '').toLowerCase()] ?? String(c || '');
const label = 'text-ui-9 uppercase tracking-[0.1em] text-tea-text-dim';

/** The values a row shows: the live Curate entry when loaded, else what the server sent. */
function view(h: SampleHolding, live: ReturnType<typeof useLiveEntry>) {
  const e = h.entry;
  let tasting: Record<string, unknown> = {};
  try { tasting = live?.tasting ?? (typeof e.tasting === 'string' ? JSON.parse(e.tasting || '{}') : e.tasting ?? {}); } catch { tasting = {}; }
  const amount = live ? live.priceAmount : (e.price_amount == null ? undefined : Number(e.price_amount));
  const grams = live ? live.pricePerUnitGrams : (e.price_per_unit_grams == null ? undefined : Number(e.price_per_unit_grams));
  return {
    name: live?.name || e.name || e.chinese_name || 'Unnamed tea',
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
        className={`w-full min-w-0 bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 font-mono ${small ? 'text-ui-13 w-12' : 'text-ui-16'} tabular-nums text-tea-text`} />
    );
  }
  return <button type="button" aria-label={aria} onClick={() => { setDraft(value == null ? '' : String(value)); setEditing(true); }} className={`text-left font-mono ${small ? 'text-ui-13' : 'text-ui-16'} tabular-nums text-tea-text${small ? ' border-b border-dashed border-tea-border' : ''}`}>{display}</button>;
};

/** Dots and Taste | Reject | Want, plus the "how much" step. Shared by the phone row and the laptop table. */
export const SampleDecideBar: React.FC<{ holding: SampleHolding; onTaste: () => void; compact?: boolean }> = ({ holding, onTaste, compact }) => {
  const id = String(holding.entry.id);
  const live = useLiveEntry(id);
  const v = view(holding, live);
  useLedgerStore((s) => s.transactions); // re-render when the order changes
  const wanted = wantedAmount(id);
  const pieces = wantsPieces({ priceAmount: v.amount ?? undefined, pricePerUnitGrams: v.grams ?? undefined, form: v.form, category: v.category });
  const [asking, setAsking] = useState(false);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const dots = dotsFor(v.quality);
  const run = (p: Promise<void>) => { setError(''); p.catch(e => setError(e instanceof Error ? e.message : 'Could not save.')); };
  const ask = () => { setAmount(pieces ? '1' : String(v.grams ?? 100)); setAsking(true); };
  const n = Number(amount);
  const lineCost = v.amount != null && Number.isFinite(n) && n > 0 ? (pieces ? v.amount * n : v.grams ? (v.amount / v.grams) * n : null) : null;

  if (v.rejected) {
    return (
      <div className="flex items-center gap-3 text-ui-12">
        <span className="text-tea-text-dim">rejected</span>
        <button type="button" onClick={() => run(setSampleRejected(id, false))} className="ml-auto text-tea-gold">Restore</button>
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <span role="radiogroup" aria-label="How much you like it" className="flex">
          {[1, 2, 3, 4, 5].map(d => (
            <button key={d} type="button" role="radio" aria-checked={d === dots} aria-label={`${d} of 5`} onClick={() => run(rateSample(id, d))}
              className={`relative flex items-center justify-center ${compact ? 'w-5 h-6' : 'w-6 h-8'} before:absolute before:-inset-y-1`}>
              <span className="w-[9px] h-[9px] rounded-full border-[1.5px] border-tea-gold" style={{ background: d <= dots ? 'var(--tea-gold)' : 'transparent' }} />
            </button>
          ))}
        </span>
        <div className={`ml-auto grid grid-cols-3 ${compact ? 'w-[180px]' : 'w-[200px]'} border border-tea-border rounded-md overflow-hidden text-ui-12`}>
          <button type="button" onClick={onTaste} className="h-8 text-tea-text-sec hover:text-tea-text">Taste</button>
          <button type="button" onClick={() => run(setSampleRejected(id, true))} className="h-8 text-tea-error border-l border-tea-border">Reject</button>
          <button type="button" onClick={() => (wanted ? undefined : ask())} aria-pressed={!!wanted}
            className={`h-8 border-l border-tea-border ${wanted ? 'cta-solid' : 'text-tea-gold-lt'}`}>
            {wanted ? `${whole(wanted.amount)} ${wanted.unit}` : 'Want'}
          </button>
        </div>
      </div>
      {asking && (
        <form onSubmit={e => { e.preventDefault(); run(wantSample(id, n).then(() => setAsking(false))); }}
          className="flex items-center gap-2 px-2.5 py-1.5 border border-tea-border rounded-md text-ui-12 text-tea-text-sec whitespace-nowrap">
          <span>Want</span>
          <input aria-label={pieces ? 'How many pieces' : 'How many grams'} inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} autoFocus
            className="w-14 bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 text-right font-mono text-ui-15 tabular-nums text-tea-text" />
          <span>{pieces ? (n === 1 ? 'piece' : 'pieces') : 'g'}</span>
          {lineCost != null && <span className="font-mono tabular-nums text-tea-text">{mark(v.currency)}{whole(Math.round(lineCost))}</span>}
          <button type="button" onClick={() => setAsking(false)} className="ml-auto text-tea-text-sec hover:text-tea-text">Cancel</button>
          <button type="submit" disabled={!(n > 0)} className="text-tea-gold disabled:text-tea-text-dim">Add</button>
        </form>
      )}
      {error && <p role="alert" className="text-ui-12 text-tea-error">{error}</p>}
    </div>
  );
};

/** The phone's sample row: three lines, as locked. */
export const SampleDecideRow: React.FC<{ holding: SampleHolding; onOpen: () => void; usdPerGram: (amount: number, grams: number, currency: string) => number | null }> = ({ holding, onOpen, usdPerGram }) => {
  const id = String(holding.entry.id);
  const live = useLiveEntry(id);
  const v = view(holding, live);
  const [error, setError] = useState('');
  const pg = v.amount != null && v.grams ? usdPerGram(v.amount, v.grams, String(v.currency)) : null;
  const save = (field: 'amount' | 'grams') => (text: string) => { setError(''); setSampleQuote(id, field, text).catch(e => setError(e instanceof Error ? e.message : 'Could not save.')); };
  return (
    <div data-testid="sample-decide-row" className={`px-4 py-2.5 border-b border-tea-border ${v.rejected ? 'opacity-60' : ''}`}>
      <button type="button" onClick={onOpen} className="w-full flex items-baseline gap-2 min-w-0 pb-1.5 border-b border-tea-border text-left">
        <span className="truncate font-display text-[19px] font-semibold leading-tight text-tea-text">{v.name}</span>
        <span className="ml-auto shrink-0 text-ui-11 text-tea-text-sec">
          {v.year ? <span className="font-mono tabular-nums">{v.year}</span> : null}{v.year ? ' · ' : ''}
          <span style={{ color: getThemeTextColor(String(v.kind)) }}>{v.kind}</span>{v.form ? ` · ${v.form}` : ''}
        </span>
      </button>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <div className="h-11 px-2.5 border border-tea-border rounded-md flex flex-col justify-center">
          <span className={label}>Cost{v.currency ? ` · ${v.currency}` : ''}</span>
          <QuoteField value={v.amount} aria={`Cost of ${v.name}`} display={v.amount == null ? <span className="text-tea-text-dim">add</span> : whole(v.amount)} onSave={save('amount')} />
        </div>
        <div className="h-11 px-2.5 border border-tea-border rounded-md flex flex-col justify-center">
          <span className={label}>For</span>
          <QuoteField value={v.grams} aria={`Grams that cost is for, ${v.name}`} display={v.grams == null ? <span className="text-tea-text-dim">add</span> : <>{whole(v.grams)}<span className="font-sans text-ui-10 text-tea-text-dim"> g</span></>} onSave={save('grams')} />
        </div>
        <div className="h-11 px-1 flex flex-col justify-center text-right">
          <span className={label}>$/g</span>
          <span className="font-mono text-ui-16 tabular-nums text-tea-gold-lt">{pg == null ? '—' : fmtNum(pg)}</span>
        </div>
      </div>
      {error && <p role="alert" className="mt-1 text-ui-12 text-tea-error">{error}</p>}
      <div className="mt-2"><SampleDecideBar holding={holding} onTaste={onOpen} /></div>
    </div>
  );
};
