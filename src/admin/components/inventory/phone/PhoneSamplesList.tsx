import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, X as XIcon } from 'lucide-react';
import { api } from '../../../../lib/api';
import { fmtNum } from '../../../../utils/formatNumber';
import { getThemeColor, getThemeTextColor } from '../../../themeUtils';

// Samples on the phone, drawn exactly like the Stock list: grouped by supplier,
// one slim row per tea, a sheet when you tap it. Only the data differs. A sample
// is a Curate tea with portions, not a shop product, so its grams change through
// the Curate correction door (api.curateWorkspace.correct), the same one the
// laptop samples screen and the agents use. Pressing Save is the confirmation:
// the sheet asks for the preview and confirms it in one go.

export type SamplePortion = { id: string; name: string; grams: number | null; status: string; compass_entry_id: string };
export type SampleHolding = { entry: Record<string, any>; stock_grams: number; sample_grams: number | null; samples: SamplePortion[] };

/** What Adrian usually takes for a tasting. */
export const DEFAULT_TASTE_GRAMS = 5;

const whole = (n: number): string => fmtNum(n, Number.isInteger(n) ? 0 : 2);
const COLS = 'grid grid-cols-[minmax(0,1fr)_34px_48px] gap-x-2.5 items-stretch';

function teaName(h: SampleHolding): string {
  return h.entry.name || h.entry.chinese_name || 'Unnamed tea';
}

export interface PhoneSamplesListProps {
  holdings: SampleHolding[];
  onEditTea: (id: string) => void;
  onOrder: (holding: SampleHolding) => void;
  onChanged: () => void | Promise<void>;
}

export const PhoneSamplesList: React.FC<PhoneSamplesListProps> = ({ holdings, onEditTea, onOrder, onChanged }) => {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const groups = useMemo(() => {
    const byVendor = new Map<string, { label: string; rows: SampleHolding[] }>();
    for (const h of holdings) {
      const label = String(h.entry.vendor_name || 'No supplier').trim();
      const key = label.toLowerCase();
      if (!byVendor.has(key)) byVendor.set(key, { label, rows: [] });
      byVendor.get(key)!.rows.push(h);
    }
    return [...byVendor.entries()]
      .map(([key, g]) => ({ key, ...g, rows: g.rows.sort((a, b) => teaName(a).localeCompare(teaName(b))) }))
      .sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label));
  }, [holdings]);
  const expandAll = holdings.length <= 25;
  const focused = focusedId ? holdings.find(h => h.entry.id === focusedId) ?? null : null;

  return (
    <div data-testid="samples-phone" className={`stock-phone-tone ${focused ? 'pb-[300px]' : ''}`}>
      <div role="row" className="sticky top-0 z-sticky flex items-center bg-tea-bg pl-9 pr-3 border-b border-tea-border">
        <div className={`${COLS} flex-1`}>
          {(['Tea', 'Year', 'Sample'] as const).map((label, i) => (
            <span key={label} role="columnheader" className={`h-8 flex items-center ${i ? 'justify-end' : ''} text-ui-10 uppercase tracking-[0.06em] text-tea-text-dim`}>{label}</span>
          ))}
        </div>
      </div>
      {groups.map(group => {
        const isOpen = expandAll || open.has(group.key);
        const grams = group.rows.reduce((sum, h) => sum + Number(h.sample_grams ?? 0), 0);
        return (
          <section key={group.key} aria-label={group.label}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(prev => { const next = new Set(prev); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; })}
              className="w-full flex items-end justify-between gap-3 bg-tea-surface border-b border-tea-border pl-5 pr-4 pt-3 pb-2 text-left"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-display text-ui-20 font-semibold leading-none text-tea-text">{group.label}</span>
                  {isOpen ? <ChevronDown size={13} className="shrink-0 text-tea-text-dim" aria-hidden="true" /> : <ChevronRight size={13} className="shrink-0 text-tea-text-dim" aria-hidden="true" />}
                </span>
                <span className="block mt-1.5 text-ui-12 text-tea-text-sec tabular-nums">
                  {group.rows.length} {group.rows.length === 1 ? 'sample' : 'samples'} · {whole(grams)} g
                </span>
              </span>
            </button>
            {isOpen && group.rows.map(h => {
              const isFocused = focusedId === h.entry.id;
              const color = getThemeColor(String(h.entry.type || ''));
              const empty = h.sample_grams == null;
              return (
                <div key={h.entry.id} className={`relative flex items-center ${isFocused ? 'bg-tea-surface' : ''} after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-tea-border`}>
                  <span aria-hidden="true" className="ml-3 w-3.5 h-3.5 shrink-0 rounded-full border-2" style={{ borderColor: color, background: empty ? 'transparent' : color }} />{/* color-data: the tea kind's own colour */}
                  <button
                    type="button"
                    data-testid="curate-sample-row"
                    aria-expanded={isFocused}
                    onClick={() => setFocusedId(isFocused ? null : h.entry.id)}
                    className={`${COLS} flex-1 min-w-0 pl-2.5 pr-3 text-left min-h-[46px]`}
                  >
                    <span className="min-w-0 py-1.5 pr-2">
                      <span className={`block truncate font-display text-ui-17 font-semibold leading-tight ${isFocused ? 'text-tea-gold' : 'text-tea-text'}`}>{teaName(h)}</span>
                      <span className="block truncate text-ui-11 leading-tight" style={{ color: getThemeTextColor(String(h.entry.type || '')) }}>{h.entry.type || 'Tea'}</span>
                    </span>
                    <span className="flex items-center justify-end font-mono text-ui-13 tracking-tight text-tea-text tabular-nums">{h.entry.year || '—'}</span>
                    <span className="flex items-center justify-end font-mono text-ui-13 tracking-tight text-tea-text tabular-nums">{empty ? '—' : whole(Number(h.sample_grams))}</span>
                  </button>
                </div>
              );
            })}
          </section>
        );
      })}
      {focused && (
        <SampleSheet
          holding={focused}
          onClose={() => setFocusedId(null)}
          onEditTea={() => onEditTea(focused.entry.id)}
          onOrder={() => onOrder(focused)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
};

type Way = 'taste' | 'measure';

const PortionLine: React.FC<{ portion: SamplePortion; label: string; onChanged: () => void | Promise<void> }> = ({ portion, label, onChanged }) => {
  const [way, setWay] = useState<Way | null>(null);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (way) { inputRef.current?.focus(); inputRef.current?.select(); } }, [way]);
  const grams = portion.grams;
  const open = (w: Way) => { setWay(w); setError(''); setAmount(w === 'taste' ? String(DEFAULT_TASTE_GRAMS) : grams == null ? '' : String(grams)); };
  const typed = Number(amount);
  const valid = amount.trim() !== '' && Number.isFinite(typed) && typed >= 0;
  const left = way === 'taste' && valid && grams != null ? grams - typed : null;
  const tooMuch = left != null && left < 0;
  const canTaste = grams != null && portion.status !== 'requested';

  const save = async () => {
    if (!way || !valid || tooMuch || saving) return;
    setSaving(true); setError('');
    try {
      const command = way === 'taste'
        ? { action: 'taste_sample', entity: 'sample', id: portion.id, consumed_grams: typed }
        : { action: 'edit', entity: 'sample', id: portion.id, fields: { grams: typed } };
      const preview = await api.curateWorkspace.correct(command);
      if (preview.error || !preview.confirmation_token) throw new Error(preview.message || preview.error || 'Could not save.');
      const done = await api.curateWorkspace.correct(command, preview.confirmation_token);
      if (done.error) throw new Error(done.message || done.error);
      setWay(null);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="py-2.5 border-b border-tea-border">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-ui-10 uppercase tracking-[0.1em] text-tea-text-dim">{label}</span>
        <button type="button" disabled={!canTaste} onClick={() => open('taste')} aria-pressed={way === 'taste'} aria-label={`Log a tasting from ${label}`}
          className={`tap-target ml-auto flex items-center justify-center w-9 h-9 rounded-full border text-ui-20 leading-none disabled:opacity-40 ${way === 'taste' ? 'border-tea-gold text-tea-gold' : 'border-tea-border text-tea-text-sec'}`}>−</button>
        <button type="button" onClick={() => open('measure')} aria-pressed={way === 'measure'} aria-label={`Weigh ${label}`}
          className={`min-w-[72px] text-center font-mono text-ui-20 tabular-nums border-b border-dashed ${way === 'measure' ? 'border-tea-gold' : 'border-tea-border'} text-tea-text`}>
          {grams == null ? '—' : whole(grams)}<span className="ml-0.5 font-sans text-ui-11 text-tea-text-dim">g</span>
        </button>
      </div>
      {grams == null && !way && <p className="mt-1 text-right text-ui-11 text-tea-error">not weighed, tap the number to weigh it</p>}
      {way && (
        <form onSubmit={e => { e.preventDefault(); void save(); }} className="mt-2 grid gap-2">
          <div className="flex items-baseline gap-2 text-ui-13 text-tea-text-sec">
            <span className="shrink-0">{way === 'taste' ? 'Tasted' : 'Weighs now'}</span>
            <input
              ref={inputRef}
              aria-label={way === 'taste' ? 'Grams tasted' : 'Grams left in the sample'}
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') setWay(null); }}
              className="w-20 bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 text-right font-mono text-ui-17 tabular-nums text-tea-text"
            />
            <span className="shrink-0">g</span>
            <span className={`ml-auto min-w-0 truncate text-ui-12 ${tooMuch ? 'text-tea-error' : 'text-tea-text-sec'}`}>
              {tooMuch ? `only ${whole(grams ?? 0)} g there` : left != null ? `leaves ${whole(left)} g` : ''}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setWay(null)} className="text-ui-13 text-tea-text-sec hover:text-tea-text">Cancel</button>
            <button type="submit" disabled={!valid || tooMuch || saving} className="cta-solid rounded-full px-5 py-1.5 text-ui-13 disabled:opacity-50">{saving ? 'Saving' : 'Save'}</button>
          </div>
        </form>
      )}
      {error && <p role="alert" className="mt-1.5 text-ui-12 text-tea-error">{error}</p>}
    </div>
  );
};

const SampleSheet: React.FC<{
  holding: SampleHolding;
  onClose: () => void;
  onEditTea: () => void;
  onOrder: () => void;
  onChanged: () => void | Promise<void>;
}> = ({ holding, onClose, onEditTea, onOrder, onChanged }) => {
  const e = holding.entry;
  const canOrder = !!e.vendor_id && e.price_amount != null && !!e.price_currency;
  const portions = holding.samples.length ? holding.samples : [];
  return (
    <section aria-label={`${teaName(holding)}, at a glance`} className="sheet-behind-nav fixed left-0 right-0 z-drawer rounded-t-xl bg-tea-surface px-5 pt-2">
      <div aria-hidden="true" className="mx-auto mb-3 h-[3px] w-8 rounded-full bg-tea-elevated" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} aria-label="Close" className="-ml-2 -my-2 flex h-11 w-8 shrink-0 items-center justify-center text-tea-text-sec hover:text-tea-text"><XIcon size={16} aria-hidden="true" /></button>
        <span className="min-w-0 flex-1 truncate font-display text-ui-20 font-semibold leading-tight text-tea-text">{teaName(holding)}</span>
        <button type="button" onClick={onEditTea} className="shrink-0 text-ui-12 text-tea-gold">Full page ›</button>
      </div>
      <div className="ml-6 mt-0.5 flex items-center gap-1.5 text-ui-12 text-tea-text-sec min-w-0">
        <span className="shrink-0" style={{ color: getThemeTextColor(String(e.type || '')) }}>{e.type || 'Tea'}</span>
        {e.year ? <><span aria-hidden="true">·</span><span className="font-mono tabular-nums">{e.year}</span></> : null}
        {e.vendor_name ? <><span aria-hidden="true">·</span><span className="truncate">{e.vendor_name}</span></> : null}
      </div>
      <div className="mt-3 border-t border-tea-border">
        {portions.length === 0
          ? <p className="py-3 text-ui-13 text-tea-text-sec">No sample portion recorded. Add one on the full page.</p>
          : portions.map((p, i) => <PortionLine key={p.id} portion={p} label={p.name || (portions.length > 1 ? `Sample ${i + 1}` : 'Sample')} onChanged={onChanged} />)}
      </div>
      <div className="flex items-center justify-between gap-3 mt-3 mb-1">
        <span className="text-ui-12 text-tea-text-sec">{holding.stock_grams > 0 ? `${whole(holding.stock_grams)} g in full stock` : 'none in full stock'}</span>
        <button type="button" disabled={!canOrder} onClick={onOrder} className="text-ui-13 text-tea-gold disabled:text-tea-text-dim">{canOrder ? 'Order this tea' : 'Add supplier and price to order'}</button>
      </div>
    </section>
  );
};
