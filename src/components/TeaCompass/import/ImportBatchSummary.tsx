import React from 'react';
import type { CurateJourney } from '../types';
import type { CurateImportAnnotation, LookupState } from '../../../lib/api';
import type { ImportReviewModel } from './importReviewDomain';
import { ImportJourneyPicker } from './ImportJourneyPicker';

interface Props {
  model: ImportReviewModel;
  overview?: string | null;
  annotations?: CurateImportAnnotation[];
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
const vendorContext = (model: ImportReviewModel) => {
  const count = model.groups.filter(group => group.vendorRequired).length;
  return count ? ` from ${count} ${count === 1 ? 'vendor' : 'vendors'}` : '';
};

const annotationTitle = (annotation: CurateImportAnnotation) => annotation.label?.trim() || annotation.kind.replace(/_/g, ' ');
const annotationAmount = (annotation: CurateImportAnnotation) => [annotation.currency, annotation.amountExact].filter(Boolean).join(' ');

export const ImportBatchSummary: React.FC<Props> = ({ model, overview, annotations = [], journeyId, journeyLookup, busy, onRetryJourneys, onJourneyChange, onCreateJourney, itemNoun }) => (
  <section aria-labelledby="import-summary-heading" className="space-y-4 border-b border-tea-border pb-4">
    <h3 id="import-summary-heading" className="sr-only">Import batch context</h3>
    <p data-testid="import-batch-context" className="font-mono text-ui-11 text-tea-text-sec">
      {model.readyCount + model.needsReviewCount} {itemNoun}{vendorContext(model)} · {quantityLabel(model.totalQuantityGrams, model.totalUnits)}{model.currencyTotals.map(total => ` · ${currencyLabel(total.currency, total.amount)}`).join('')}
    </p>
    {overview && <div className="space-y-1"><p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-dim">AI reading</p><p className="max-w-[70ch] font-body text-ui-13 italic leading-relaxed text-tea-text-sec">{overview}</p></div>}
    {annotations.length > 0 && <section className="space-y-2" aria-label="Import notes"><p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-dim">Import notes</p><ul className="space-y-1">{annotations.map((annotation, index) => <li key={`${annotation.kind}-${annotation.sourceId || index}`} className="flex min-w-0 flex-wrap gap-x-2 text-ui-11 text-tea-text-sec"><span className="font-medium text-tea-text">{annotationTitle(annotation)}</span>{annotationAmount(annotation) && <span>{annotationAmount(annotation)}</span>}{annotation.sourceExcerpt && <span className="basis-full whitespace-pre-wrap break-words">{annotation.sourceExcerpt}</span>}</li>)}</ul></section>}
    <ImportJourneyPicker lookup={journeyLookup} journeyId={journeyId} busy={busy} onRetry={onRetryJourneys} onSelect={onJourneyChange} onCreate={onCreateJourney} />
  </section>
);
