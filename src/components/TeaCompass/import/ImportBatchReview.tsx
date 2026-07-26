import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  onUpdate: (item: CurateImportItem, updates: CurateImportItemUpdate, retryCurrentDraft?: () => Promise<boolean>) => Promise<boolean>;
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
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [focusFinalAfterSave, setFocusFinalAfterSave] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const finalActionRef = useRef<HTMLButtonElement>(null);
  const model = useMemo(() => buildImportReviewModel(detail), [detail]);
  const primaryCurrency = model.currencyTotals.length === 1 ? model.currencyTotals[0] : null;
  const failedSourceIds = detail.sources.filter(source => source.analysis_status === 'failed').map(source => source.id);
  const finalLabel = importFinalActionLabel(detail.items);
  const blockerItems = model.groups.flatMap(group => group.items.map(row => ({ id: row.item.id, blocking_fields: row.blockingFields })));
  const vendorUnresolved = model.groups.some(group => !group.vendorResolved);
  useEffect(() => {
    if (confirmDelete) cancelDeleteRef.current?.focus();
  }, [confirmDelete]);
  useEffect(() => {
    if (!focusFinalAfterSave || model.needsReviewCount > 0 || busyId) return;
    requestAnimationFrame(() => {
      finalActionRef.current?.focus();
      setFocusFinalAfterSave(false);
    });
  }, [busyId, focusFinalAfterSave, model.needsReviewCount]);
  const focusEditor = (itemId: string) => requestAnimationFrame(() => {
    const row = document.querySelector<HTMLElement>(`[data-import-item-id="${CSS.escape(itemId)}"]`);
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (row?.querySelector<HTMLElement>('[data-import-editor] input:not([disabled]), [data-import-editor] select:not([disabled]), [data-import-editor] textarea:not([disabled])') || row)?.focus({ preventScroll: true });
  });
  const openIssue = (itemId: string) => {
    setOpenItemId(itemId);
    focusEditor(itemId);
  };
  const goToNextIssue = () => {
    const nextId = nextBlockingImportItemId(blockerItems, openItemId);
    if (!nextId) return;
    openIssue(nextId);
  };
  const itemSaved = (itemId: string) => {
    const savedIndex = blockerItems.findIndex(item => item.id === itemId);
    const remaining = savedIndex < 0
      ? blockerItems.filter(item => item.id !== itemId)
      : [...blockerItems.slice(savedIndex + 1), ...blockerItems.slice(0, savedIndex)].filter(item => item.id !== itemId);
    const nextId = nextBlockingImportItemId(remaining, null);
    setOpenItemId(nextId);
    if (nextId) focusEditor(nextId); else setFocusFinalAfterSave(true);
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
    buttonProps: { ref: finalActionRef },
  };
  const neutralActions: CurateActionSpec[] = confirmDelete ? [{
    label: 'Cancel',
    ariaLabel: 'Cancel delete import',
    disabled: Boolean(busyId),
    buttonProps: { ref: cancelDeleteRef },
    onClick: () => {
      setConfirmDelete(false);
      requestAnimationFrame(() => deleteRef.current?.focus());
    },
  }] : [
    { label: 'Delete', ariaLabel: 'Delete import', disabled: Boolean(busyId), buttonProps: { ref: deleteRef }, onClick: () => setConfirmDelete(true) },
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
        {annotations.length > 0 && <section className="space-y-2" aria-label="Import notes"><p className="curate-support text-tea-text-dim">Import notes</p><ul className="space-y-1">{annotations.map((annotation, index) => <li key={`${annotation.kind}-${annotation.sourceId || index}`} className="flex min-w-0 flex-wrap gap-x-2 text-ui-11 text-tea-text-sec"><span className="font-medium text-tea-text">{annotationTitle(annotation)}</span>{annotationAmount(annotation) && <span>{annotationAmount(annotation)}</span>}</li>)}</ul></section>}
      </div>}
      {(detail.batch.analysis_state === 'failed' || (!model.groups.length && detail.sources.length > 0)) && <div role="alert" className="curate-cluster flex flex-wrap items-center justify-between gap-3"><div><p className="text-ui-13 text-tea-text">Analysis did not finish</p><p className="text-ui-11 text-tea-text-sec">{savedRecordAnalysisMessage(detail.batch.analysis_error)}</p></div>{failedSourceIds.length > 0 && <button type="button" disabled={Boolean(busyId)} onClick={() => void onRetryAnalysis(failedSourceIds)} className="tap-target min-h-11 rounded-md border border-tea-gold px-3 text-ui-12 text-tea-gold disabled:opacity-50">{busyId === '__analysis' ? 'Analyzing…' : 'Retry failed records'}</button>}</div>}
      {detail.sources.some(source => source.r2_object_key) && <div className="curate-cluster space-y-2" aria-label="Saved records">{detail.sources.filter(source => source.r2_object_key).map(source => <ImportEvidenceCard key={source.id} source={source} analysisBusy={busyId === `source:${source.id}`} disabled={Boolean(busyId) && busyId !== `source:${source.id}`} onRetry={sourceId => void onRetryAnalysis([sourceId])} />)}</div>}
      {model.groups.map(group => <ImportVendorGroup key={group.id} group={group} vendorLookup={vendorLookup} identityLookup={identityLookup} holdingLookup={holdingLookup} busyId={busyId} openItemId={openItemId} onOpenItem={openIssue} onCloseItem={() => setOpenItemId(null)} onItemSaved={itemSaved} onRetryVendors={onRetryVendors} onRetryIdentities={onRetryIdentities} onRetryHoldings={onRetryHoldings} onUpdateItem={onUpdate} onChangeVendor={onChangeVendor} onCreateVendor={onCreateVendor} />)}
      {!model.groups.length && <p className="curate-cluster text-ui-13 text-tea-text-sec">No analyzed teas yet. Retry analysis from this saved record.</p>}
      <div role={confirmDelete ? 'group' : undefined} aria-label={confirmDelete ? 'Delete import confirmation' : undefined} className="curate-cluster space-y-2">
        {confirmDelete && <p className="text-ui-12 text-tea-text-sec">This import will be removed from your incomplete imports. Its saved record is retained for audit and recovery.</p>}
        {!confirmDelete && model.needsReviewCount > 0 && <p className="curate-support text-tea-text-sec">{model.needsReviewCount} {model.needsReviewCount === 1 ? 'decision' : 'decisions'} remaining</p>}
        {!confirmDelete && model.needsReviewCount === 0 && vendorUnresolved && <p className="curate-support text-tea-text-sec">Choose each vendor before saving these records.</p>}
        <CurateActionBand testId="import-review-actions" neutral={neutralActions} primary={primaryAction} columns={confirmDelete ? { base: 2 } : { base: 2, sm: 4 }} />
      </div>
    </div>
  );
};
