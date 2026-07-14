import type { CurateImportFinalizeResult, CurateImportItem, CurateImportVendorGroup } from '../../../lib/api';
import { importItemNoun } from './importReviewDomain';
import type { ImportPanelState } from './importTypes';

export type ImportFolioPhase = 'evidence' | 'review' | 'added';

type ImportFolioItem = Pick<CurateImportItem, 'id' | 'category' | 'blocking_fields'>;
type ImportFolioDetail = {
  items: ImportFolioItem[];
  groups: Array<Pick<CurateImportVendorGroup, 'id'>>;
};
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
  detail: ImportFolioDetail | null,
  completion?: ImportFolioCompletion | null,
): ImportFolioPhaseContext => {
  if (phase === 'evidence') return { title: 'Add vendor evidence', status: 'Draft saved' };

  const items = detail?.items ?? [];
  if (phase === 'review') {
    const itemCount = items.length;
    const vendorCount = detail?.groups.length ?? 0;
    const needsReviewCount = items.filter(item => (item.blocking_fields?.length ?? 0) > 0).length;
    return {
      title: `Review ${itemCount} ${importItemNoun(items, itemCount)} from ${vendorCount} ${vendorCount === 1 ? 'vendor' : 'vendors'}`,
      status: needsReviewCount ? `${needsReviewCount} need review` : 'Ready to add',
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
