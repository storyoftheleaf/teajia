import React from 'react';
import type { CurateJourney } from '../types';
import type { ImportReviewModel } from './importReviewDomain';

interface Props {
  model: ImportReviewModel;
  overview?: string | null;
  journeyId: string | null;
  journeys: CurateJourney[];
  busy: boolean;
  onJourneyChange: (journeyId: string | null) => void;
}

const quantityLabel = (grams: number, units: number) => {
  const parts: string[] = [];
  if (grams) parts.push(grams >= 1000 ? `${Number((grams / 1000).toFixed(2))}kg` : `${grams}g`);
  if (units) parts.push(`${units} ${units === 1 ? 'unit' : 'units'}`);
  return parts.join(' + ') || 'Quantity needs review';
};

export const ImportBatchSummary: React.FC<Props> = ({ model, overview, journeyId, journeys, busy, onJourneyChange }) => (
  <section aria-labelledby="import-summary-heading" className="space-y-3 border-b border-tea-border pb-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h3 id="import-summary-heading" className="text-ui-14 font-medium text-tea-text">{model.readyCount + model.needsReviewCount} teas · {model.groups.length} {model.groups.length === 1 ? 'vendor' : 'vendors'}</h3>
      <span className="text-ui-11 text-tea-text-dim">{model.needsReviewCount ? `${model.needsReviewCount} need review` : 'Ready to add'}</span>
    </div>
    {overview && <p className="text-ui-13 leading-relaxed text-tea-text-sec">{overview}</p>}
    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-ui-11 text-tea-text-sec">
      <span>{quantityLabel(model.totalQuantityGrams, model.totalUnits)}</span>
      {model.currencyTotals.map(total => <span key={total.currency}>{total.currency} {total.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>)}
    </div>
    <label className="block text-ui-11 text-tea-text-sec">
      <span className="mb-1 block uppercase tracking-[1.2px] text-tea-text-dim">Sourcing run · optional</span>
      <select aria-label="Sourcing run" value={journeyId || ''} disabled={busy} onChange={event => onJourneyChange(event.target.value || null)} className="min-h-11 w-full rounded-md border border-tea-border bg-tea-surface px-3 text-ui-16 text-tea-text outline-none focus:border-tea-gold lg:text-ui-13">
        <option value="">No sourcing run</option>
        {journeys.map(journey => <option key={journey.id} value={journey.id}>{[journey.name, journey.season, journey.year].filter(Boolean).join(' · ')}</option>)}
      </select>
    </label>
  </section>
);
