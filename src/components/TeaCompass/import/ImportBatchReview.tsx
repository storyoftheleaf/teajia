import React, { useMemo, useRef, useState } from 'react';
import type { CurateJourney } from '../types';
import type { CurateImportDetail, CurateImportItem } from '../../../lib/api';
import { buildImportReviewModel } from './importReviewDomain';
import { ImportBatchSummary } from './ImportBatchSummary';
import { ImportVendorGroup, type ImportVendorOption } from './ImportVendorGroup';
import { ImportEvidenceCard } from './ImportEvidenceCard';

interface ImportBatchReviewProps {
  detail: CurateImportDetail;
  journeys: CurateJourney[];
  vendorOptions: ImportVendorOption[];
  busyId: string | null;
  onUpdate: (item: CurateImportItem, updates: Partial<CurateImportItem>) => Promise<boolean>;
  onSetJourney: (journeyId: string | null) => Promise<void>;
  onChangeVendor: (groupId: string, vendorId: string) => Promise<void>;
  onCreateVendor: (groupId: string, name: string) => Promise<void>;
  onFinalize: () => Promise<void>;
  onDefer: () => void;
  onNew: () => void;
  onAbandon: () => Promise<void>;
}

export const ImportBatchReview: React.FC<ImportBatchReviewProps> = ({ detail, journeys, vendorOptions, busyId, onUpdate, onSetJourney, onChangeVendor, onCreateVendor, onFinalize, onDefer, onNew, onAbandon }) => {
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const abandonRef = useRef<HTMLButtonElement>(null);
  const model = useMemo(() => buildImportReviewModel(detail), [detail]);
  const teaCount = detail.items.filter(item => item.category === 'tea').length;
  const primaryCurrency = model.currencyTotals.length === 1 ? model.currencyTotals[0] : null;
  const finalLabel = `Add ${teaCount} ${teaCount === 1 ? 'tea' : 'teas'} to Inventory`;
  return (
    <div className="space-y-5">
      <ImportBatchSummary model={model} overview={detail.batch.analysis_overview} journeyId={detail.batch.journey_id} journeys={journeys} busy={Boolean(busyId)} onJourneyChange={journeyId => void onSetJourney(journeyId)} />
      {detail.sources.some(source => source.r2_object_key) && <div className="space-y-2" aria-label="Saved evidence">{detail.sources.filter(source => source.r2_object_key).map(source => <ImportEvidenceCard key={source.id} source={source} />)}</div>}
      <div className="space-y-5">{model.groups.map(group => <ImportVendorGroup key={group.id} group={group} vendorOptions={vendorOptions} busyId={busyId} onUpdateItem={onUpdate} onChangeVendor={onChangeVendor} onCreateVendor={onCreateVendor} />)}</div>
      {!model.groups.length && <p className="rounded-md border border-tea-border bg-tea-surface p-4 text-ui-13 text-tea-text-sec">No analyzed teas yet. Retry analysis from this saved evidence.</p>}
      {confirmAbandon && <div role="alertdialog" aria-label="Confirm abandon import" className="space-y-3 rounded-md border border-tea-border bg-tea-surface p-3"><p className="text-ui-12 text-tea-text">Keep the evidence, but stop reviewing this import?</p><div className="flex justify-between gap-3"><button autoFocus type="button" onClick={() => { setConfirmAbandon(false); requestAnimationFrame(() => abandonRef.current?.focus()); }} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Cancel abandon</button><button type="button" disabled={Boolean(busyId)} onClick={() => void onAbandon()} className="tap-target min-h-11 text-ui-12 text-tea-gold disabled:opacity-50">Confirm abandon</button></div></div>}
      <div className="flex flex-wrap justify-between gap-2 border-t border-tea-border pt-3"><button ref={abandonRef} type="button" onClick={() => setConfirmAbandon(true)} aria-expanded={confirmAbandon} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Abandon import</button><div className="flex flex-wrap gap-3"><button type="button" onClick={onDefer} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Review later</button><button type="button" onClick={onNew} className="tap-target min-h-11 text-ui-12 text-tea-gold">New import</button></div></div>
      <div className="sticky bottom-0 bg-tea-elevated pb-nav-gap pt-3">
        {!model.canFinalize && <p className="mb-2 text-ui-11 text-tea-text-sec">Resolve {model.needsReviewCount ? `${model.needsReviewCount} tea ${model.needsReviewCount === 1 ? 'issue' : 'issues'}` : 'each vendor'} before adding stock.</p>}
        <button type="button" aria-label={finalLabel} disabled={Boolean(busyId) || !model.canFinalize} onClick={() => void onFinalize()} className="tap-target min-h-11 w-full rounded-md bg-tea-gold px-4 text-ui-13 font-medium text-tea-bg disabled:cursor-not-allowed disabled:opacity-50">{busyId === '__finalize' ? 'Adding to Inventory…' : `${finalLabel}${primaryCurrency ? ` · ${primaryCurrency.currency} ${primaryCurrency.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''}`}</button>
      </div>
    </div>
  );
};
