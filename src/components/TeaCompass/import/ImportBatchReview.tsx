import React, { useMemo, useRef, useState } from 'react';
import type { CurateJourney } from '../types';
import type { CurateImportDetail, CurateImportItem, CurateImportItemUpdate, LookupState } from '../../../lib/api';
import { buildImportReviewModel, importItemNoun } from './importReviewDomain';
import { ImportBatchSummary } from './ImportBatchSummary';
import { ImportVendorGroup, type ImportVendorOption } from './ImportVendorGroup';
import { ImportEvidenceCard } from './ImportEvidenceCard';
import type { ImportIdentityOption, ImportHoldingOption } from './ImportItemRow';

interface ImportBatchReviewProps {
  detail: CurateImportDetail;
  journeyLookup: LookupState<CurateJourney>;
  vendorLookup: LookupState<ImportVendorOption>;
  identityLookup: LookupState<ImportIdentityOption>;
  holdingLookup: LookupState<ImportHoldingOption>;
  busyId: string | null;
  onRetryJourneys: () => void;
  onRetryVendors: () => void;
  onRetryIdentities: () => void;
  onRetryHoldings: () => void;
  onUpdate: (item: CurateImportItem, updates: CurateImportItemUpdate) => Promise<boolean>;
  onSetJourney: (journeyId: string | null) => Promise<boolean>;
  onCreateJourney: (input: { name: string; season?: string; year?: number }) => Promise<boolean>;
  onChangeVendor: (groupId: string, vendorId: string) => Promise<boolean>;
  onCreateVendor: (groupId: string, name: string) => Promise<boolean>;
  onFinalize: () => Promise<void>;
  onRetryAnalysis: (sourceIds?: string[]) => Promise<void>;
  onDefer: () => void;
  onNew: () => void;
  onAbandon: () => Promise<void>;
}

export const ImportBatchReview: React.FC<ImportBatchReviewProps> = ({ detail, journeyLookup, vendorLookup, identityLookup, holdingLookup, busyId, onRetryJourneys, onRetryVendors, onRetryIdentities, onRetryHoldings, onUpdate, onSetJourney, onCreateJourney, onChangeVendor, onCreateVendor, onFinalize, onRetryAnalysis, onDefer, onNew, onAbandon }) => {
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const abandonRef = useRef<HTMLButtonElement>(null);
  const model = useMemo(() => buildImportReviewModel(detail), [detail]);
  const itemCount = detail.items.length;
  const itemLabel = importItemNoun(detail.items, itemCount);
  const primaryCurrency = model.currencyTotals.length === 1 ? model.currencyTotals[0] : null;
  const failedSourceIds = detail.sources.filter(source => source.analysis_status === 'failed').map(source => source.id);
  const finalLabel = `Add ${itemCount} ${itemLabel} to Inventory`;
  return (
    <div className="space-y-5">
      <ImportBatchSummary model={model} overview={detail.batch.analysis_overview} journeyId={detail.batch.journey_id} journeyLookup={journeyLookup} busy={Boolean(busyId)} onRetryJourneys={onRetryJourneys} onJourneyChange={onSetJourney} onCreateJourney={onCreateJourney} itemNoun={itemLabel} />
      {(detail.batch.analysis_state === 'failed' || (!model.groups.length && detail.sources.length > 0)) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-tea-border bg-tea-surface p-3"><div><p className="text-ui-13 text-tea-text">Analysis did not finish</p><p className="text-ui-11 text-tea-text-sec">{detail.batch.analysis_error || 'Your saved evidence is ready to analyze again.'}</p></div>{failedSourceIds.length > 0 && <button type="button" disabled={Boolean(busyId)} onClick={() => void onRetryAnalysis(failedSourceIds)} className="tap-target min-h-11 rounded-md border border-tea-gold px-3 text-ui-12 text-tea-gold disabled:opacity-50">{busyId === '__analysis' ? 'Analyzing…' : 'Retry failed evidence'}</button>}</div>}
      {detail.sources.some(source => source.r2_object_key) && <div className="space-y-2" aria-label="Saved evidence">{detail.sources.filter(source => source.r2_object_key).map(source => <ImportEvidenceCard key={source.id} source={source} analysisBusy={busyId === `source:${source.id}`} disabled={Boolean(busyId) && busyId !== `source:${source.id}`} onRetry={sourceId => void onRetryAnalysis([sourceId])} />)}</div>}
      <div className="space-y-5">{model.groups.map(group => <ImportVendorGroup key={group.id} group={group} vendorLookup={vendorLookup} identityLookup={identityLookup} holdingLookup={holdingLookup} busyId={busyId} onRetryVendors={onRetryVendors} onRetryIdentities={onRetryIdentities} onRetryHoldings={onRetryHoldings} onUpdateItem={onUpdate} onChangeVendor={onChangeVendor} onCreateVendor={onCreateVendor} />)}</div>
      {!model.groups.length && <p className="rounded-md border border-tea-border bg-tea-surface p-4 text-ui-13 text-tea-text-sec">No analyzed teas yet. Retry analysis from this saved evidence.</p>}
      {confirmAbandon && <div role="group" aria-label="Abandon import confirmation" className="space-y-3 rounded-md border border-tea-border bg-tea-surface p-3"><p className="text-ui-12 text-tea-text">Keep the saved evidence, but permanently stop reviewing this import?</p><div className="flex justify-between gap-3"><button autoFocus type="button" disabled={Boolean(busyId)} onClick={() => { setConfirmAbandon(false); requestAnimationFrame(() => abandonRef.current?.focus()); }} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Cancel abandon</button><button type="button" disabled={Boolean(busyId)} onClick={() => void onAbandon()} className="tap-target min-h-11 text-ui-12 text-tea-gold disabled:opacity-50">Confirm abandon</button></div></div>}
      <div className="flex flex-wrap justify-between gap-2 border-t border-tea-border pt-3"><button ref={abandonRef} type="button" disabled={Boolean(busyId)} onClick={() => setConfirmAbandon(true)} aria-expanded={confirmAbandon} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Abandon import</button><div className="flex flex-wrap gap-3"><button type="button" disabled={Boolean(busyId)} onClick={onDefer} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text disabled:opacity-50">Review later</button><button type="button" disabled={Boolean(busyId)} onClick={onNew} className="tap-target min-h-11 text-ui-12 text-tea-gold disabled:opacity-50">New import</button></div></div>
      <div className="sticky bottom-0 bg-tea-elevated pb-nav-gap pt-3">
        {!model.canFinalize && <p className="mb-2 text-ui-11 text-tea-text-sec">Resolve {model.needsReviewCount ? `${model.needsReviewCount} tea ${model.needsReviewCount === 1 ? 'issue' : 'issues'}` : 'each vendor'} before adding stock.</p>}
        <button type="button" aria-label={finalLabel} disabled={Boolean(busyId) || !model.canFinalize} onClick={() => void onFinalize()} className="tap-target min-h-11 w-full rounded-md bg-tea-gold px-4 text-ui-13 font-medium text-tea-bg disabled:cursor-not-allowed disabled:opacity-50">{busyId === '__finalize' ? 'Adding to Inventory…' : `${finalLabel}${primaryCurrency ? ` · ${primaryCurrency.currency} ${primaryCurrency.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''}`}</button>
      </div>
    </div>
  );
};
