import type { CurateImportDetail, CurateImportFinalizeResult, CurateImportItem } from '../../../lib/api';
import { buildImportReviewModel, importItemNoun } from './importReviewDomain';
import type { ImportPanelState } from './importTypes';

export type ImportFolioPhase = 'evidence' | 'review' | 'added';

type ImportFolioCompletion = Pick<CurateImportFinalizeResult, 'items'>;

export interface ImportFolioPhaseContext {
  title: string;
  status: string;
}

export const folioPhase = (input: {
  phase: ImportPanelState['phase'];
  completion: boolean;
}): ImportFolioPhase => {
  if (input.completion) return 'added';
  return input.phase === 'review' ? 'review' : 'evidence';
};

export const partitionImportItems = <T extends { item: Pick<CurateImportItem, 'blocking_fields'> }>(rows: T[]) => ({
  needsReview: rows.filter(row => (row.item.blocking_fields?.length ?? 0) > 0),
  ready: rows.filter(row => (row.item.blocking_fields?.length ?? 0) === 0),
});

export const nextBlockingImportItemId = (
  items: Array<Pick<CurateImportItem, 'id' | 'blocking_fields'>>,
  currentId: string | null,
): string | null => {
  const blocked = items.filter(item => (item.blocking_fields?.length ?? 0) > 0);
  if (!blocked.length) return null;
  const currentIndex = blocked.findIndex(item => item.id === currentId);
  return blocked[(currentIndex + 1) % blocked.length]?.id ?? null;
};

export const folioPhaseContext = (
  phase: ImportFolioPhase,
  detail: CurateImportDetail | null,
  completion?: ImportFolioCompletion | null,
): ImportFolioPhaseContext => {
  if (phase === 'evidence') return { title: 'Add vendor record', status: 'Draft saved' };

  const items = detail?.items ?? [];
  if (phase === 'review') {
    const itemCount = items.length;
    const needsReviewCount = detail ? buildImportReviewModel(detail).needsReviewCount : 0;
    return {
      title: 'Review imported teas',
      status: `${needsReviewCount} of ${itemCount} ${needsReviewCount === 1 ? 'needs' : 'need'} attention`,
    };
  }

  const addedIds = new Set(completion?.items.map(item => item.id));
  const addedItems = completion ? items.filter(item => addedIds.has(item.id)) : items;
  const addedCount = completion?.items.length ?? items.length;
  return {
    title: 'Import complete',
    status: `${addedCount} ${importItemNoun(addedItems.length ? addedItems : items, addedCount)} added`,
  };
};

const numberLabel = (value: number, maximumFractionDigits = 2) => value.toLocaleString('en-US', { maximumFractionDigits });

const weightLabel = (grams: number): string | null => {
  if (!Number.isFinite(grams) || grams <= 0) return null;
  if (grams >= 1000 && Number.isInteger(grams / 10)) return `${numberLabel(grams / 1000)} kg`;
  return `${numberLabel(grams, 3)} g`;
};

export const importBatchSummary = (detail: CurateImportDetail): string => {
  const model = buildImportReviewModel(detail);
  const count = model.readyCount + model.needsReviewCount;
  const parts = [`${count} ${importItemNoun(detail.items, count)}`];
  const vendorGroups = model.groups.filter(group => group.vendorRequired);
  if (vendorGroups.length === 1) {
    const name = vendorGroups[0].resolved_vendor_name?.trim();
    parts.push(name || '1 vendor');
  } else if (vendorGroups.length > 1) {
    parts.push(`${vendorGroups.length} vendors`);
  }
  const weight = weightLabel(model.totalQuantityGrams);
  if (weight) parts.push(weight);
  parts.push(...model.currencyTotals.map(total => `${total.currency} ${numberLabel(total.amount)}`));
  return parts.join(' · ');
};
