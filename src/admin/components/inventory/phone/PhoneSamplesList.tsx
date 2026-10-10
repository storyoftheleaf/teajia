import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, X as XIcon } from 'lucide-react';
import { api } from '../../../../lib/api';
import { fmtNum } from '../../../../utils/formatNumber';
import { getThemeTextColor } from '../../../themeUtils';
import { TASTING_TAXONOMY } from '../../../../data/tastingTaxonomy';
import { TapField } from './PhoneTeaSheet';
import { SampleDecideRow } from './SampleDecide';
import { BuyingEntry } from '../../../../components/shared/BuyingEntry';
import { useTeaCompassStore } from '../../../../lib/teaCompassStore';
import { useRates } from '../../../hooks/useAdminData';
import { rateToUsd } from '../../../../lib/currency';

// The same five tasting categories the laptop samples screen offers.
const TASTE_CATEGORIES = TASTING_TAXONOMY.categories.filter(c => ['body', 'finish', 'feeling', 'flavor', 'liquor-color'].includes(c.id));
const termLabel = (id: string): string => TASTE_CATEGORIES.flatMap(c => c.groups.flatMap(g => g.terms)).find(t => t.id === id)?.label ?? id;
const termCategory = (id: string): string | undefined => TASTE_CATEGORIES.find(c => c.groups.some(g => g.terms.some(t => t.id === id)))?.id;

// Samples on the phone, drawn exactly like the Stock list: grouped by supplier,
// one slim row per tea, a sheet when you tap it. Only the data differs. A sample
// is a Curate tea with portions, not a shop product, so its grams change through
// the Curate correction door (api.curateWorkspace.correct), the same one the
// laptop samples screen and the agents use. Pressing Save is the confirmation:
// the sheet asks for the preview and confirms it in one go.

export type SamplePortion = { id: string; name: string; grams: number | null; status: string; compass_entry_id: string };
export type SampleHolding = { entry: Record<string, any>; stock_grams: number; sample_grams: number | null; samples: SamplePortion[] };

export { DEFAULT_TASTE_GRAMS } from './groupStock';
import { DEFAULT_TASTE_GRAMS } from './groupStock';

const whole = (n: number): string => fmtNum(n, Number.isInteger(n) ? 0 : 2);
const COLS = 'grid grid-cols-[minmax(0,1fr)_34px_48px] gap-x-2.5 items-stretch';

function teaName(h: SampleHolding): string {
  return h.entry.name || h.entry.chinese_name || 'Unnamed tea';
}

export interface PhoneSamplesListProps {
  holdings: SampleHolding[];
  /** The Stock page's Supplier / Kind / Stage switch. Samples have no stage, so Stage groups by supplier. */
  groupBy?: 'vendor' | 'type' | 'stage' | 'none';
  /** Inside the Stock list: no header of its own, Stock's columns, and Stock's sort. */
  rowsOnly?: boolean;
  sortKey?: string | null;
  sortDir?: 'asc' | 'desc';
  onEditTea: (id: string) => void;
  onOrder: (holding: SampleHolding) => void;
  onChanged: () => void | Promise<void>;
}

type SampleSort = 'name' | 'year' | 'grams';

export const PhoneSamplesList: React.FC<PhoneSamplesListProps> = ({ holdings, groupBy = 'vendor', rowsOnly = false, sortKey = null, sortDir = 'asc', onEditTea, onOrder, onChanged }) => {
  const [ownSort, setSort] = useState<{ key: SampleSort; dir: 'asc' | 'desc' }>({ key: 'name', dir: 'asc' });
  // In the Stock list the column headings above sort these rows too.
  const sort: { key: SampleSort; dir: 'asc' | 'desc' } = rowsOnly
    ? { key: sortKey === 'year' ? 'year' : sortKey === 'stockGrams' ? 'grams' : 'name', dir: sortDir }
    : ownSort;
  const cols = rowsOnly ? 'grid grid-cols-[minmax(0,1fr)_34px_40px_36px] gap-x-2.5 items-stretch' : COLS;
  const onSort = (key: SampleSort) => setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showRejected, setShowRejected] = useState(false);
  const liveDecisions = useTeaCompassStore((st) => st.entries);
  const decisionOf = (h: SampleHolding) => liveDecisions.find((e) => e.id === h.entry.id)?.decision ?? h.entry.decision;
  const rejectedCount = holdings.filter((h) => decisionOf(h) === 'passed_on').length;
  const shown = holdings.filter((h) => showRejected || decisionOf(h) !== 'passed_on');
  const { data: rates = [] } = useRates();
  const usdPerGram = (amount: number, grams: number, currency: string): number | null => {
    const r = currency ? rateToUsd(rates, currency) : null;
    return r == null || !grams ? null : amount / r / grams;
  };
  const groups = useMemo(() => {
    const byVendor = new Map<string, { label: string; rows: SampleHolding[] }>();
    for (const h of shown) {
      const label = groupBy === 'none' ? 'All samples' : groupBy === 'type' ? String(h.entry.type || 'No kind').trim() : String(h.entry.vendor_name || 'No supplier').trim();
      const key = label.toLowerCase();
      if (!byVendor.has(key)) byVendor.set(key, { label, rows: [] });
      byVendor.get(key)!.rows.push(h);
    }
    return [...byVendor.entries()]
      .map(([key, g]) => ({ key, ...g, rows: g.rows.sort((a, b) => {
        const d = sort.dir === 'asc' ? 1 : -1;
        if (sort.key === 'year') return d * (Number(a.entry.year || 0) - Number(b.entry.year || 0)) || teaName(a).localeCompare(teaName(b));
        if (sort.key === 'grams') return d * (Number(a.sample_grams ?? -1) - Number(b.sample_grams ?? -1)) || teaName(a).localeCompare(teaName(b));
        return d * teaName(a).localeCompare(teaName(b));
      }) }))
      .sort((a, b) => b.rows.length - a.rows.length || a.label.localeCompare(b.label));
  }, [shown, groupBy, sort]);
  const expandAll = holdings.length <= 25;
  const focused = focusedId ? holdings.find(h => h.entry.id === focusedId) ?? null : null;

  return (
    <div data-testid="samples-phone" className={`stock-phone-tone ${focused ? 'pb-[300px]' : ''}`}>
      {!rowsOnly && <div role="row" className="sticky top-0 z-sticky flex items-center bg-tea-bg pl-4 pr-3 border-b border-tea-border">
        <div className={`${COLS} flex-1`}>
          {([['name', 'Tea'], ['year', 'Year'], ['grams', 'Sample']] as const).map(([key, label], i) => {
            const on = sort.key === key;
            return (
              <button key={key} type="button" role="columnheader" aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} onClick={() => onSort(key)}
                className={`h-8 flex items-center ${i ? 'justify-end' : ''} text-ui-10 uppercase tracking-[0.06em] ${on ? 'text-tea-gold' : 'text-tea-text-dim'}`}>
                {label}{on ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
              </button>
            );
          })}
        </div>
      </div>}
      <BuyingEntry className="px-4 py-2.5" />
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
            {isOpen && group.rows.map(h => (
              <SampleDecideRow key={h.entry.id} holding={h} usdPerGram={usdPerGram} onOpen={() => setFocusedId(focusedId === h.entry.id ? null : h.entry.id)} />
            ))}
          </section>
        );
      })}
      {rejectedCount > 0 && (
        <button type="button" onClick={() => setShowRejected(v => !v)} aria-pressed={showRejected}
          className="w-full px-4 py-3 text-left text-ui-12 text-tea-text-sec hover:text-tea-text border-b border-tea-border">
          {showRejected ? 'Hide rejected' : `Rejected ${rejectedCount}, show`}
        </button>
      )}
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
  const [terms, setTerms] = useState<string[]>([]);
  const [score, setScore] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (way) { inputRef.current?.focus(); inputRef.current?.select(); } }, [way]);
  const grams = portion.grams;
  const open = (w: Way) => { setWay(w); setError(''); setTerms([]); setScore(''); setAmount(w === 'taste' ? String(DEFAULT_TASTE_GRAMS) : grams == null ? '' : String(grams)); };
  const typed = Number(amount);
  const scoreOk = score.trim() === '' || (Number.isInteger(Number(score)) && Number(score) >= 1 && Number(score) <= 10);
  const valid = amount.trim() !== '' && Number.isFinite(typed) && typed >= 0 && scoreOk;
  const left = way === 'taste' && valid && grams != null ? grams - typed : null;
  const tooMuch = left != null && left < 0;
  const canTaste = grams != null && portion.status !== 'requested';

  const save = async () => {
    if (!way || !valid || tooMuch || saving) return;
    setSaving(true); setError('');
    try {
      const command = way === 'taste'
        ? {
            action: 'taste_sample', entity: 'sample', id: portion.id, consumed_grams: typed,
            ...(terms.length ? { tasting: terms.reduce<Record<string, string[]>>((acc, id) => { const c = termCategory(id); if (c) acc[c] = [...(acc[c] ?? []), id]; return acc; }, {}) } : {}),
            ...(score.trim() ? { score: Number(score) } : {}),
          }
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

  const term = 'text-ui-10 uppercase tracking-[0.1em] text-tea-text-dim whitespace-nowrap';
  return (
    <div className="py-1.5 border-b border-tea-border">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className={term}>
            {label}{grams == null && <span className="text-tea-error normal-case tracking-normal"> · weigh it</span>}
          </div>
          <div className="flex items-baseline gap-2.5 mt-0.5">
            <button type="button" disabled={!canTaste} onClick={() => open('taste')} aria-label={`Log a tasting from ${label}`}
              className={`relative text-ui-16 leading-none before:absolute before:-inset-3 disabled:opacity-40 ${way === 'taste' ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}>−</button>
            <button type="button" onClick={() => open('measure')} aria-label={`Weigh ${label}`}
              className={`relative border-b border-dashed before:absolute before:-inset-y-2 before:-inset-x-1 font-mono text-ui-15 tabular-nums text-tea-text border-tea-border`}>
              {grams == null ? '—' : whole(grams)}<span className="ml-0.5 font-sans text-ui-10 text-tea-text-dim">g</span>
            </button>
          </div>
        </div>
        <span className="pb-0.5 text-ui-11 text-tea-text-sec">{portion.status}</span>
      </div>
      {way && (
        <form onSubmit={e => { e.preventDefault(); void save(); }} className="flex items-center h-10 gap-2 text-ui-13 text-tea-text-sec">
          <span className="shrink-0">{way === 'taste' ? 'Tasted' : 'Weighs'}</span>
          <input
            ref={inputRef}
            aria-label={way === 'taste' ? 'Grams tasted' : 'Grams left in the sample'}
            inputMode="decimal"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') setWay(null); }}
            className="w-14 bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 text-right font-mono text-ui-15 tabular-nums text-tea-text"
          />
          <span className="shrink-0">g</span>
          <span className={`min-w-0 truncate text-ui-11 ${tooMuch ? 'text-tea-error' : 'text-tea-text-dim'}`}>
            {tooMuch ? `only ${whole(grams ?? 0)} there` : left != null ? `leaves ${whole(left)}` : ''}
          </span>
          <button type="button" onClick={() => setWay(null)} className="ml-auto shrink-0 text-ui-13 text-tea-text-sec hover:text-tea-text">Cancel</button>
          <button type="submit" disabled={!valid || tooMuch || saving} className="shrink-0 text-ui-13 text-tea-gold disabled:text-tea-text-dim">{saving ? 'Saving' : 'Save'}</button>
        </form>
      )}
      {way === 'taste' && (
        // Tasting notes and a score ride along with the tasting, one compact row:
        // picked notes as small removable words, a picker to add one, the score at the end.
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-1.5 text-ui-12">
          {terms.map(id => (
            <button key={id} type="button" onClick={() => setTerms(prev => prev.filter(t => t !== id))} aria-label={`Remove ${termLabel(id)}`}
              className="text-tea-gold">{termLabel(id)} ×</button>
          ))}
          <select
            aria-label="Add a tasting note"
            value=""
            onChange={e => { const id = e.target.value; if (id) setTerms(prev => prev.includes(id) ? prev : [...prev, id]); }}
            className="bg-transparent border-0 p-0 text-ui-12 text-tea-text-sec focus:outline-none"
          >
            <option value="">{terms.length ? '+ note' : '+ tasting notes'}</option>
            {TASTE_CATEGORIES.map(c => (
              <optgroup key={c.id} label={c.name}>
                {c.groups.flatMap(g => g.terms).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </optgroup>
            ))}
          </select>
          <span className="ml-auto flex items-baseline gap-1 text-tea-text-sec">
            score
            <input
              aria-label="Score out of 10"
              inputMode="numeric"
              value={score}
              onChange={e => setScore(e.target.value)}
              className={`w-7 bg-transparent border-0 border-b border-tea-border focus:border-tea-gold outline-none p-0 text-center font-mono text-ui-13 tabular-nums ${scoreOk ? 'text-tea-text' : 'text-tea-error'}`}
            />
            /10
          </span>
        </div>
      )}
      {error && <p role="alert" className="pb-1 text-ui-12 text-tea-error">{error}</p>}
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
  const [renameError, setRenameError] = useState('');
  const rename = async (name: string) => {
    setRenameError('');
    try {
      const command = { action: 'edit', entity: 'tea', id: e.id, fields: { name } };
      const preview = await api.curateWorkspace.correct(command);
      if (preview.error || !preview.confirmation_token) throw new Error(preview.message || preview.error || 'Could not rename.');
      const done = await api.curateWorkspace.correct(command, preview.confirmation_token);
      if (done.error) throw new Error(done.message || done.error);
      await onChanged();
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Could not rename. Try again.');
    }
  };
  return (
    <section aria-label={`${teaName(holding)}, at a glance`} className="sheet-behind-nav fixed left-0 right-0 z-drawer rounded-t-xl bg-tea-surface px-4 pt-1.5">
      <div aria-hidden="true" className="mx-auto mb-1.5 h-[3px] w-8 rounded-full bg-tea-elevated" />
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} aria-label="Close" className="-ml-2 -my-2 flex h-11 w-8 shrink-0 items-center justify-center text-tea-text-sec hover:text-tea-text"><XIcon size={16} aria-hidden="true" /></button>
        <div className="min-w-0 flex-1">
          <TapField
            value={String(e.name || '')}
            label={`Rename ${teaName(holding)}`}
            display={teaName(holding)}
            className="block w-full truncate font-display text-[23px] font-semibold leading-tight text-tea-text"
            inputClassName="font-display text-[23px] font-semibold leading-tight"
            onSave={name => { void rename(name); }}
          />
        </div>
        <button type="button" onClick={onEditTea} className="shrink-0 text-ui-12 text-tea-gold">Full page ›</button>
      </div>
      <div className="ml-6 flex items-center gap-1.5 text-ui-12 text-tea-text-sec min-w-0">
        <span className="shrink-0" style={{ color: getThemeTextColor(String(e.type || '')) }}>{e.type || 'Tea'}</span>
        {e.year ? <><span aria-hidden="true">·</span><span className="font-mono tabular-nums">{e.year}</span></> : null}
        {e.vendor_name ? <><span aria-hidden="true">·</span><span className="truncate">{e.vendor_name}</span></> : null}
      </div>
      {renameError && <p role="alert" className="ml-6 text-ui-12 text-tea-error">{renameError}</p>}
      <div className="mt-2 border-t border-tea-border">
        {portions.length === 0
          ? <p className="py-3 text-ui-13 text-tea-text-sec">No sample portion recorded. Add one on the full page.</p>
          : portions.map((p, i) => <PortionLine key={p.id} portion={p} label={p.name || (portions.length > 1 ? `Sample ${i + 1}` : 'Sample')} onChanged={onChanged} />)}
      </div>
      <div className="flex items-center justify-between gap-3 h-9">
        <span className="text-ui-12 text-tea-text-sec">{holding.stock_grams > 0 ? `${whole(holding.stock_grams)} g in full stock` : 'none in full stock'}</span>
        <button type="button" disabled={!canOrder} onClick={onOrder} className="text-ui-13 text-tea-gold disabled:text-tea-text-dim">{canOrder ? 'Order this tea' : 'Add supplier and price to order'}</button>
      </div>
    </section>
  );
};
