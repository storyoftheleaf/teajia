import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useRates, useShopFreightDefault } from '../../admin/hooks/useAdminData';
import { curateShelfPreview } from './curatePricing';
import { FAST_TASTING, quotedUnit, readFast, type FastQuestion } from './curateV2Model';
import { CURRENCY_LABELS } from './PricingRow';
import { DEFAULT_GRAMS, type TeaCompassEntry } from './types';
import { Section } from './TodayView';

interface CompareViewProps {
  /** Teas already chosen, kept by the parent so leaving to open a tea and
   *  coming back returns to the same comparison. */
  chosen: string[];
  onChosenChange: (ids: string[]) => void;
  onOpenTea: (entryId: string) => void;
  onClose: () => void;
}

interface Figures {
  entry: TeaCompassEntry;
  perGram: number | null;
  shelf: number | null;
}

const PIECE_FORMS = ['Cake', 'Brick', 'Tuo'];

function gramsForPrice(e: TeaCompassEntry): number | null {
  if (e.form && PIECE_FORMS.includes(e.form)) return DEFAULT_GRAMS[e.form] ?? null;
  return e.pricePerUnitGrams && e.pricePerUnitGrams > 0 ? e.pricePerUnitGrams : null;
}

const answerLabel = (q: FastQuestion, ids: string[]) =>
  ids.map((id) => FAST_TASTING.find((x) => x.q === q)?.options.find((o) => o.id === id)?.label ?? '').filter(Boolean).join(', ');

/**
 * Compare, top to bottom. Pick a few teas; each becomes a card of one-line
 * figures, so nothing scrolls sideways however many are compared. The best
 * figure in each row across the cards is gold. Tapping a card opens that tea;
 * coming back lands on the same comparison.
 */
export const CompareView: React.FC<CompareViewProps> = ({ chosen, onChosenChange, onOpenTea, onClose }) => {
  const entries = useTeaCompassStore((s) => s.entries);
  const { data: rates } = useRates();
  const freight = useShopFreightDefault();
  const [picking, setPicking] = useState(chosen.length < 2);
  const [query, setQuery] = useState('');

  const teas = useMemo(() => entries.filter((e) => e.category === 'tea' && e.name?.trim()), [entries]);

  const figures: Figures[] = useMemo(() => chosen
    .map((id) => teas.find((t) => t.id === id))
    .filter((e): e is TeaCompassEntry => !!e)
    .map((entry) => {
      const grams = gramsForPrice(entry);
      if (entry.priceAmount == null || !grams) return { entry, perGram: null, shelf: null };
      const preview = curateShelfPreview({ costAmount: entry.priceAmount, grams, currency: entry.priceCurrency, rates, shopFreightPerKgUsd: freight.perKgUsd });
      return { entry, perGram: entry.priceAmount / grams, shelf: preview?.retailPerGramUsd ?? null };
    }), [chosen, teas, rates, freight.perKgUsd]);

  const best = useMemo(() => {
    const min = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length > 1 ? Math.min(...v) : null; };
    const max = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x != null); return v.length > 1 ? Math.max(...v) : null; };
    return {
      shelf: min(figures.map((f) => f.shelf)),
      score: max(figures.map((f) => f.entry.tasting?.quality ?? null)),
    };
  }, [figures]);

  if (picking) {
    const shown = query.trim() ? teas.filter((t) => `${t.name} ${t.vendorName ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) : teas;
    const toggle = (id: string) => onChosenChange(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
    return (
      <div className="curate-v2 -mx-4">
        <div className="flex items-baseline gap-2 px-4 pb-2">
          <button type="button" onClick={onClose} className="tap-target -ml-1 self-center text-tea-text-sec hover:text-tea-text" aria-label="Back to teas"><ArrowLeft size={18} /></button>
          <span className="flex-1 font-display text-ui-26 text-tea-text">Compare</span>
          <span className="text-ui-12 text-tea-text-dim tabular-nums">{chosen.length} picked</span>
        </div>
        <div className="relative px-4 pb-2">
          <Search size={13} className="pointer-events-none absolute left-7 top-1/2 -translate-y-1/2 text-tea-text-dim" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teas" aria-label="Search teas"
            className="min-h-11 w-full rounded-md border border-tea-border bg-tea-surface py-2 pl-9 pr-3 text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold" />
        </div>
        {shown.slice(0, 80).map((t) => {
          const on = chosen.includes(t.id);
          return (
            <button key={t.id} type="button" onClick={() => toggle(t.id)} aria-pressed={on} className="curate-v2-row w-full text-left">
              <span className={`h-4 w-4 shrink-0 rounded-md border ${on ? 'border-tea-gold bg-tea-gold' : 'border-tea-border'}`} aria-hidden="true" />
              <span className="curate-v2-name">{t.name}</span>
              {t.vendorName && <span className="text-ui-12 text-tea-text-dim">{t.vendorName}</span>}
              <span className="flex-1" />
              {t.year != null && <span className="text-ui-12 text-tea-text-sec tabular-nums">{t.year}</span>}
            </button>
          );
        })}
        <div className="sticky bottom-0 bg-tea-bg px-4 pt-3 pb-nav-gap">
          <button type="button" disabled={chosen.length < 2} onClick={() => setPicking(false)} className="cta-solid min-h-11 w-full rounded-md text-ui-13 font-semibold disabled:opacity-40">
            Compare {chosen.length || ''} {chosen.length === 1 ? 'tea' : 'teas'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="curate-v2 -mx-4">
      <div className="flex items-baseline gap-2 px-4 pb-2">
        <button type="button" onClick={onClose} className="tap-target -ml-1 self-center text-tea-text-sec hover:text-tea-text" aria-label="Back to teas"><ArrowLeft size={18} /></button>
        <span className="flex-1 font-display text-ui-26 text-tea-text">Compare</span>
        <button type="button" onClick={() => setPicking(true)} className="tap-target text-ui-12 font-medium text-tea-gold">Change teas</button>
      </div>
      <div className="grid gap-3 px-4">
        {figures.map(({ entry, perGram, shelf }) => {
          const a = readFast(entry.tasting);
          const sym = CURRENCY_LABELS[entry.priceCurrency] ?? '';
          const rows: Array<[string, string, boolean?]> = [
            ['Paid', entry.priceAmount != null ? `${sym}${entry.priceAmount.toLocaleString()} ${quotedUnit(entry)}`.trim() : 'add'],
            ['Per gram', perGram != null ? `${sym}${perGram.toFixed(2)}` : '—'],
            ['Shelf', shelf != null ? `$${shelf.toFixed(2)} / g` : '—', shelf != null && shelf === best.shelf],
            ['Year', entry.year != null ? String(entry.year) : '—'],
            ['Score', entry.tasting?.quality != null ? `${entry.tasting.quality} / 10` : '—', entry.tasting?.quality != null && entry.tasting.quality === best.score],
            ['Clean', answerLabel('clean', a.clean) || '—'],
            ['Drying', answerLabel('drying', a.drying) || '—'],
            ['Body', answerLabel('weight', a.weight) || '—'],
            ['Tastes of', answerLabel('flavour', a.flavour) || '—'],
            ['Stays', answerLabel('stays', a.stays) || '—'],
          ];
          return (
            <button key={entry.id} type="button" onClick={() => onOpenTea(entry.id)} className="w-full rounded-md border border-tea-border bg-tea-surface/40 text-left transition-colors hover:border-tea-gold">
              <div className="flex items-baseline gap-2 border-b border-tea-border px-3 py-2.5">
                <span className="curate-v2-name min-w-0 flex-1 truncate font-display text-ui-20 text-tea-text">{entry.name}</span>
                {entry.vendorName && <span className="text-ui-12 text-tea-text-dim">{entry.vendorName}</span>}
                <span className="text-ui-12 text-tea-gold">Open ›</span>
              </div>
              {rows.map(([k, v, win]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 px-3 py-1.5">
                  <span className="curate-v2-label">{k}</span>
                  <span className={`truncate text-ui-13 tabular-nums ${win ? 'font-semibold text-tea-gold' : 'text-tea-text-sec'}`}>{v}</span>
                </div>
              ))}
            </button>
          );
        })}
      </div>
      <div className="pb-nav-gap" />
    </div>
  );
};
