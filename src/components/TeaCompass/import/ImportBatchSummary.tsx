import React from 'react';
import type { CurateJourney } from '../types';
import type { LookupState } from '../../../lib/api';
import type { ImportReviewModel } from './importReviewDomain';
import { ImportJourneyPicker } from './ImportJourneyPicker';

interface Props {
  model: ImportReviewModel;
  overview?: string | null;
  journeyId: string | null;
  journeyLookup: LookupState<CurateJourney>;
  busy: boolean;
  onRetryJourneys: () => void;
  onJourneyChange: (journeyId: string | null) => Promise<boolean>;
  onCreateJourney: (input: { name: string; season?: string; year?: number }) => Promise<boolean>;
  itemNoun: string;
}

const quantityLabel = (grams: number, units: number) => {
  const parts: string[] = [];
  if (grams) parts.push(grams >= 1000 ? `${Number((grams / 1000).toFixed(2))}kg` : `${grams}g`);
  if (units) parts.push(`${units} ${units === 1 ? 'unit' : 'units'}`);
  return parts.join(' + ') || 'Quantity needs review';
};

const currencyLabel = (currency: string, amount: number) => `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export const ImportBatchSummary: React.FC<Props> = ({ model, overview, journeyId, journeyLookup, busy, onRetryJourneys, onJourneyChange, onCreateJourney, itemNoun }) => (
  <section aria-labelledby="import-summary-heading" className="space-y-4 border-b border-tea-border pb-4">
    <h3 id="import-summary-heading" className="sr-only">Import batch context</h3>
    <p data-testid="import-batch-context" className="font-mono text-ui-11 text-tea-text-sec">
      {model.readyCount + model.needsReviewCount} {itemNoun} from {model.groups.length} {model.groups.length === 1 ? 'vendor' : 'vendors'} · {quantityLabel(model.totalQuantityGrams, model.totalUnits)}{model.currencyTotals.map(total => ` · ${currencyLabel(total.currency, total.amount)}`).join('')}
    </p>
    {overview && <div className="space-y-1"><p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-dim">AI reading</p><p className="max-w-[70ch] font-body text-ui-13 italic leading-relaxed text-tea-text-sec">{overview}</p></div>}
    <ImportJourneyPicker lookup={journeyLookup} journeyId={journeyId} busy={busy} onRetry={onRetryJourneys} onSelect={onJourneyChange} onCreate={onCreateJourney} />
  </section>
);
