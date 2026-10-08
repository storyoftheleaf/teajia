import React, { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
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
  /** Buy opens the tea's order part. */
  onBuy?: (entryId: string) => void;
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
export const CompareView: React.FC<CompareViewProps> = ({ chosen, onChosenChange, onOpenTea, onClose, onBuy }) => {
  const entries = useTeaCompassStore((s) => s.entries);
  const updateEntry = useTeaCompassStore((s) => s.updateEntry);
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
    const rank = (q: FastQuestion, order: string[]) => max(figures.map((f) => { const id = readFast(f.entry.tasting)[q][0]; const i = id ? order.indexOf(id) : -1; return i < 0 ? null : order.length - i; }));
    return {
      shelf: min(figures.map((f) => f.shelf)),
      perGram: min(figures.map((f) => f.perGram)),
      score: max(figures.map((f) => f.entry.tasting?.quality ?? null)),
      clean: rank('clean', ['clean', 'some-edge', 'rough']),
      drying: rank('drying', ['none', 'finish-dry', 'dry']),
      stays: rank('stays', ['lingering', 'finish-long', 'finish-medium', 'finish-short']),
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
          {chosen.length >= 2
            ? <button type="button" onClick={() => setPicking(false)} className="tap-target font-mono text-ui-13 text-tea-gold">Compare {chosen.length} teas</button>
            : <span className="text-ui-12 text-tea-text-sec tabular-nums">{chosen.length} picked, choose 2 or more</span>}
        </div>
        <div className="relative px-4 pb-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search teas" aria-label="Search teas"
            className="min-h-11 w-full rounded-[3px] border border-tea-border bg-transparent py-2 pl-3 pr-3 font-mono text-ui-16 text-tea-text outline-none placeholder:text-tea-text-dim focus:border-tea-gold" />
        </div>
        {shown.slice(0, 80).map((t) => {
          const on = chosen.includes(t.id);
          return (
            <button key={t.id} type="button" onClick={() => toggle(t.id)} aria-pressed={on} className="curate-v2-row w-full text-left">
              <span className={`h-4 w-4 shrink-0 rounded-[3px] border ${on ? 'border-tea-gold bg-tea-gold' : 'border-tea-text-sec'}`} aria-hidden="true" />
              <span className="curate-v2-name">{t.name}</span>
              {t.vendorName && <span className="min-w-0 font-mono text-ui-12 text-tea-text-sec !whitespace-normal">{t.vendorName}</span>}
              <span className="flex-1" />
              {t.year != null && <span className="text-ui-12 text-tea-text-sec tabular-nums">{t.year}</span>}
            </button>
          );
        })}
        <div className="pb-nav-gap" />
      </div>
    );
  }

  return (
    <div className="curate-v2 -mx-4">
      <div className="flex items-baseline gap-2 px-4 pb-2">
        <button type="button" onClick={onClose} className="tap-target -ml-1 self-center text-tea-text-sec hover:text-tea-text" aria-label="Back to teas"><ArrowLeft size={18} /></button>
        <span className="flex-1 font-display text-ui-26 text-tea-text">Compare</span>
        <button type="button" onClick={() => setPicking(true)} className="tap-target font-mono text-ui-13 text-tea-gold">Change teas</button>
      </div>
      <div className="grid gap-2.5 px-4" data-testid="compare-cards">
        {figures.map(({ entry, perGram, shelf }) => {
          const a = readFast(entry.tasting);
          const sym = CURRENCY_LABELS[entry.priceCurrency] ?? '';
          const pos = (q: FastQuestion, order: string[]) => { const id = a[q][0]; const i = id ? order.indexOf(id) : -1; return i < 0 ? null : order.length - i; };
          // Nine figures, three to a row, so a whole tea reads at a glance and three teas fit on one screen.
          const cells: Array<[string, string, boolean]> = [
            ['Paid', entry.priceAmount != null ? `${sym}${entry.priceAmount.toLocaleString()}` : '—', false],
            ['Per g', perGram != null ? `${sym}${perGram.toFixed(2)}` : '—', perGram != null && perGram === best.perGram],
            ['Shelf', shelf != null ? `$${shelf.toFixed(2)}` : '—', shelf != null && shelf === best.shelf],
            ['Score', entry.tasting?.quality != null ? String(entry.tasting.quality) : '—', entry.tasting?.quality != null && entry.tasting.quality === best.score],
            ['Clean', answerLabel('clean', a.clean) || '—', pos('clean', ['clean', 'some-edge', 'rough']) === best.clean && best.clean != null],
            ['Drying', answerLabel('drying', a.drying) || '—', pos('drying', ['none', 'finish-dry', 'dry']) === best.drying && best.drying != null],
            ['Body', answerLabel('weight', a.weight) || '—', false],
            ['Stays', answerLabel('stays', a.stays) || '—', pos('stays', ['lingering', 'finish-long', 'finish-medium', 'finish-short']) === best.stays && best.stays != null],
            ['Tastes', answerLabel('flavour', a.flavour.slice(0, 2)) || '—', false],
          ];
          const unit = quotedUnit(entry);
          return (
            <article key={entry.id} className="overflow-hidden rounded-md border border-tea-border bg-tea-surface/40">
              <div className="flex items-center gap-2 border-b border-tea-border pl-3 pr-1">
                <button type="button" onClick={() => onOpenTea(entry.id)} className="grid min-h-11 min-w-0 flex-1 py-1.5 text-left">
                  <span className="curate-v2-name">{entry.name}</span>
                  <span className="text-ui-12 text-tea-text-sec tabular-nums">{[entry.vendorName, entry.year, unit && `per ${unit}`].filter(Boolean).join(' · ')}</span>
                </button>
                <button type="button" onClick={() => updateEntry(entry.id, entry.sampleState ? { sampleState: null } : { sampleState: 'requested', isSample: true, decision: 'considering' })} aria-pressed={!!entry.sampleState} className={`tap-target px-2 font-mono text-ui-13 ${entry.sampleState ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}>Sample</button>
                <button type="button" onClick={() => { updateEntry(entry.id, { decision: 'selected' }); onBuy?.(entry.id); }} className={`tap-target px-2 font-mono text-ui-13 ${entry.decision === 'selected' ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'}`}>Buy</button>
              </div>
              <div className="grid grid-cols-3">
                {cells.map(([k, v, win], i) => (
                  <div key={k} className={`min-w-0 px-3 py-1.5 ${i % 3 ? 'border-l border-tea-border' : ''} ${i >= 3 ? 'border-t border-tea-border' : ''}`}>
                    <div className="curate-v2-label">{k}</div>
                    <div className={`truncate text-ui-14 tabular-nums ${win ? 'font-semibold text-tea-gold' : v === '—' ? 'text-tea-text-sec' : 'text-tea-text'}`}>{v}</div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      <p className="px-4 pt-2 text-ui-12 text-tea-text-sec">Gold is the better figure. Tap a name to open the tea.</p>
      <div className="pb-nav-gap" />
    </div>
  );
};
