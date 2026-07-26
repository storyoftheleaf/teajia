import React, { useMemo, useState } from 'react';
import type { CurateJourney } from '../types';
import type { CurateImportAnnotation, CurateImportDetail, CurateImportItem, CurateImportItemUpdate, LookupState } from '../../../lib/api';
import { buildImportReviewModel, importFinalActionLabel } from './importReviewDomain';
import { ImportVendorGroup, type ImportVendorOption } from './ImportVendorGroup';
import { ImportEvidenceCard } from './ImportEvidenceCard';
import type { ImportIdentityOption, ImportHoldingOption } from './ImportItemRow';
import { importBatchSummary, nextBlockingImportItemId } from './importFolioPresentation';
import { savedRecordAnalysisMessage } from './importErrorMessage';
import { ImportJourneyPicker } from './ImportJourneyPicker';
import { CurateActionBand, type CurateActionSpec } from '../CuratePrimitives';

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

const annotationTitle = (annotation: CurateImportAnnotation) => annotation.label?.trim() || annotation.kind.replace(/_/g, ' ');
const annotationAmount = (annotation: CurateImportAnnotation) => [annotation.currency, annotation.amountExact].filter(Boolean).join(' ');

export const ImportBatchReview: React.FC<ImportBatchReviewProps> = ({ detail, journeyLookup, vendorLookup, identityLookup, holdingLookup, busyId, onRetryJourneys, onRetryVendors, onRetryIdentities, onRetryHoldings, onUpdate, onSetJourney, onCreateJourney, onChangeVendor, onCreateVendor, onFinalize, onRetryAnalysis, onDefer, onNew, onAbandon }) => {
  const [currentIssueId, setCurrentIssueId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const model = useMemo(() => buildImportReviewModel(detail), [detail]);
  const primaryCurrency = model.currencyTotals.length === 1 ? model.currencyTotals[0] : null;
  const failedSourceIds = detail.sources.filter(source => source.analysis_status === 'failed').map(source => source.id);
  const finalLabel = importFinalActionLabel(detail.items);
  const blockerItems = model.groups.flatMap(group => group.items.map(row => ({ id: row.item.id, blocking_fields: row.blockingFields })));
  const vendorUnresolved = model.groups.some(group => !group.vendorResolved);
  const goToNextIssue = () => {
    const nextId = nextBlockingImportItemId(blockerItems, currentIssueId);
    if (!nextId) return;
    setCurrentIssueId(nextId);
    const row = document.querySelector<HTMLElement>(`[data-import-item-id="${CSS.escape(nextId)}"]`);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row?.focus({ preventScroll: true });
  };
  const primaryAction: CurateActionSpec = confirmDelete ? {
    label: 'Delete import',
    ariaLabel: 'Delete import',
    busy: busyId === '__abandon',
    busyLabel: 'Deleting…',
    disabled: Boolean(busyId),
    onClick: () => void onAbandon(),
  } : model.needsReviewCount > 0 ? {
    label: 'Review next tea',
    ariaLabel: 'Review next tea',
    disabled: Boolean(busyId),
    onClick: goToNextIssue,
  } : {
    label: `${finalLabel}${primaryCurrency ? ` · ${primaryCurrency.currency} ${primaryCurrency.amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : ''}`,
    ariaLabel: finalLabel,
    busy: busyId === '__finalize',
    busyLabel: 'Saving records…',
    disabled: Boolean(busyId) || !model.canFinalize,
    onClick: () => void onFinalize(),
  };
  const neutralActions: CurateActionSpec[] = confirmDelete ? [{
    label: 'Cancel',
    ariaLabel: 'Cancel delete import',
    disabled: Boolean(busyId),
    onClick: () => setConfirmDelete(false),
  }] : [
    { label: 'Delete', ariaLabel: 'Delete import', disabled: Boolean(busyId), onClick: () => setConfirmDelete(true) },
    { label: 'Review later', disabled: Boolean(busyId), onClick: onDefer },
    { label: 'New import', disabled: Boolean(busyId), onClick: onNew },
  ];
  const annotations = detail.batch.analysis_annotations ?? [];
  return (
    <div className="curate-source-sheet">
      <section aria-labelledby="import-summary-heading">
        <h3 id="import-summary-heading" className="sr-only">Import batch context</h3>
        <p data-testid="import-batch-summary" className="curate-context-band px-2 py-2 text-ui-12 text-tea-text-sec">{importBatchSummary(detail)}</p>
        <div className="curate-cluster"><ImportJourneyPicker lookup={journeyLookup} journeyId={detail.batch.journey_id} busy={Boolean(busyId)} onRetry={onRetryJourneys} onSelect={onSetJourney} onCreate={onCreateJourney} /></div>
      </section>
      {(detail.batch.analysis_overview || annotations.length > 0) && <div className="curate-cluster space-y-3">
        {detail.batch.analysis_overview && <div className="space-y-1"><p className="curate-support text-tea-text-dim">AI reading</p><p className="max-w-[70ch] font-body text-ui-13 italic leading-relaxed text-tea-text-sec">{detail.batch.analysis_overview}</p></div>}
        {annotations.length > 0 && <section className="space-y-2" aria-label="Import notes"><p className="curate-support text-tea-text-dim">Import notes</p><ul className="space-y-1">{annotations.map((annotation, index) => <li key={`${annotation.kind}-${annotation.sourceId || index}`} className="flex min-w-0 flex-wrap gap-x-2 text-ui-11 text-tea-text-sec"><span className="font-medium text-tea-text">{annotationTitle(annotation)}</span>{annotationAmount(annotation) && <span>{annotationAmount(annotation)}</span>}{annotation.sourceExcerpt && <span className="basis-full whitespace-pre-wrap break-words">{annotation.sourceExcerpt}</span>}</li>)}</ul></section>}
      </div>}
      {(detail.batch.analysis_state === 'failed' || (!model.groups.length && detail.sources.length > 0)) && <div role="alert" className="curate-cluster flex flex-wrap items-center justify-between gap-3"><div><p className="text-ui-13 text-tea-text">Analysis did not finish</p><p className="text-ui-11 text-tea-text-sec">{savedRecordAnalysisMessage(detail.batch.analysis_error)}</p></div>{failedSourceIds.length > 0 && <button type="button" disabled={Boolean(busyId)} onClick={() => void onRetryAnalysis(failedSourceIds)} className="tap-target min-h-11 rounded-md border border-tea-gold px-3 text-ui-12 text-tea-gold disabled:opacity-50">{busyId === '__analysis' ? 'Analyzing…' : 'Retry failed records'}</button>}</div>}
      {detail.sources.some(source => source.r2_object_key) && <div className="curate-cluster space-y-2" aria-label="Saved records">{detail.sources.filter(source => source.r2_object_key).map(source => <ImportEvidenceCard key={source.id} source={source} analysisBusy={busyId === `source:${source.id}`} disabled={Boolean(busyId) && busyId !== `source:${source.id}`} onRetry={sourceId => void onRetryAnalysis([sourceId])} />)}</div>}
      {model.groups.map(group => <ImportVendorGroup key={group.id} group={group} vendorLookup={vendorLookup} identityLookup={identityLookup} holdingLookup={holdingLookup} busyId={busyId} onRetryVendors={onRetryVendors} onRetryIdentities={onRetryIdentities} onRetryHoldings={onRetryHoldings} onUpdateItem={onUpdate} onChangeVendor={onChangeVendor} onCreateVendor={onCreateVendor} />)}
      {!model.groups.length && <p className="curate-cluster text-ui-13 text-tea-text-sec">No analyzed teas yet. Retry analysis from this saved record.</p>}
      <div className="curate-cluster space-y-2">
        {confirmDelete && <p className="text-ui-12 text-tea-text-sec">This import will be removed from your incomplete imports. Its saved record is retained for audit and recovery.</p>}
        {!confirmDelete && model.needsReviewCount > 0 && <p className="curate-support text-tea-text-sec">{model.needsReviewCount} {model.needsReviewCount === 1 ? 'decision' : 'decisions'} remaining</p>}
        {!confirmDelete && model.needsReviewCount === 0 && vendorUnresolved && <p className="curate-support text-tea-text-sec">Choose each vendor before saving these records.</p>}
        <CurateActionBand testId="import-review-actions" neutral={neutralActions} primary={primaryAction} className={confirmDelete ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'} />
      </div>
    </div>
  );
};
