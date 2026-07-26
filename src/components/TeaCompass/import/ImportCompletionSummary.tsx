import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { CurateImportDetail, CurateImportFinalizeResult } from '../../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';
import { importDisposition, importItemNoun } from './importReviewDomain';

interface Props {
  detail: CurateImportDetail;
  result: CurateImportFinalizeResult;
  onClose: () => void;
  onNew: () => void;
}

type FinalizedRow = {
  item: CurateImportDetail['items'][number];
  compassEntryId: string;
  productId: string | null;
  identityDisposition: 'created' | 'reused';
  holdingDisposition: 'created' | 'reused' | null;
};

const UNGROUPED = '__ungrouped__';

const amount = (item: CurateImportDetail['items'][number]) => {
  const parsedExact = item.parsed_data.lineCostExact;
  const exactValue = item.line_cost_exact ?? (typeof parsedExact === 'string' ? parsedExact : null);
  const value = exactValue ?? (typeof item.line_cost === 'number' && Number.isFinite(item.line_cost) && Math.abs(item.line_cost) <= Number.MAX_SAFE_INTEGER ? `${item.line_cost}` : null);
  return value == null ? 'Cost not recorded' : `${item.currency || ''} ${value}`.trim();
};

const quantity = (item: CurateImportDetail['items'][number]) => {
  if (item.total_quantity_grams != null) {
    return item.total_quantity_grams >= 1000 && item.total_quantity_grams % 1000 === 0
      ? `${item.total_quantity_grams / 1000}kg`
      : `${item.total_quantity_grams}g`;
  }
  if (item.total_units != null) return `${item.total_units} ${item.total_units === 1 ? 'unit' : 'units'}`;
  return 'Quantity not recorded';
};

export const ImportCompletionSummary: React.FC<Props> = ({ detail, result, onClose, onNew }) => {
  const sourceById = new Map(detail.items.map(item => [item.id, item]));
  const rows: FinalizedRow[] = result.items.flatMap(finalized => {
    const item = sourceById.get(finalized.id);
    if (!item) return [];
    return [{
      item,
      compassEntryId: finalized.compassEntryId,
      productId: finalized.productId,
      identityDisposition: finalized.identityDisposition,
      holdingDisposition: finalized.holdingDisposition,
    }];
  });
  const rowsByGroup = new Map<string, FinalizedRow[]>();
  rows.forEach(row => {
    const groupId = row.item.vendor_group_id?.trim() || UNGROUPED;
    rowsByGroup.set(groupId, [...(rowsByGroup.get(groupId) || []), row]);
  });
  const receiptsByGroup = new Map(result.receipts
    .filter(receipt => typeof receipt.groupId === 'string' && receipt.groupId.trim())
    .map(receipt => [receipt.groupId, receipt]));
  const journey = result.journey?.name || 'No sourcing run';
  const itemNoun = importItemNoun(rows.map(row => row.item), rows.length);
  const dispositionRows = (disposition: 'received' | 'in_transit' | 'library_only') => rows.filter(row => importDisposition(row.item) === disposition);
  const receivedRows = dispositionRows('received');
  const transitRows = dispositionRows('in_transit');
  const libraryRows = dispositionRows('library_only');
  const completionClauses = [
    receivedRows.length ? `${receivedRows.length} ${importItemNoun(receivedRows.map(row => row.item), receivedRows.length)} received` : null,
    transitRows.length ? `${transitRows.length} ${importItemNoun(transitRows.map(row => row.item), transitRows.length)} held in transit` : null,
    libraryRows.length ? `${libraryRows.length} ${importItemNoun(libraryRows.map(row => row.item), libraryRows.length)} saved` : null,
  ].filter((clause): clause is string => Boolean(clause));
  const completionSummary = completionClauses.length > 0 ? completionClauses.join(' · ') : `${rows.length} ${itemNoun} saved`;

  return (
    <section role="region" aria-label="Import complete" className="space-y-7">
      <header className="border-b border-tea-border pb-5">
        <p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-sec">Added to your records</p>
        <h3 className="mt-1 font-serif text-ui-28 font-normal leading-tight text-tea-text">Import complete</h3>
        <p className="mt-2 text-ui-13 leading-relaxed text-tea-text-sec">{completionSummary} · {journey}</p>
      </header>

      <div className="space-y-6" aria-label="Import ledger">
        {[...rowsByGroup.entries()].map(([groupId, groupRows]) => {
          const receipt = groupId === UNGROUPED ? undefined : receiptsByGroup.get(groupId);
          const detailGroup = detail.groups.find(group => group.id === groupId);
          const vendorName = receipt?.vendorName?.trim() || detailGroup?.resolved_vendor_name?.trim() || detailGroup?.proposed_vendor_name?.trim() || 'Vendor not recorded';
          const groupNoun = importItemNoun(groupRows.map(row => row.item), groupRows.length);
          const stockRows = groupRows.filter(row => importDisposition(row.item) !== 'library_only');
          const transitOnly = stockRows.length > 0 && stockRows.every(row => importDisposition(row.item) === 'in_transit');
          const receivedOnly = stockRows.length === groupRows.length && groupRows.every(row => importDisposition(row.item) === 'received');
          const groupKind = stockRows.length > 0 ? 'Vendor receipt' : 'Library records';
          const groupSummary = !stockRows.length
            ? `${groupRows.length} ${groupNoun} saved without stock`
            : transitOnly
              ? `${groupRows.length} ${groupNoun} held in transit`
              : receivedOnly
                ? `${groupRows.length} ${groupNoun} received`
                : `${groupRows.length} ${groupNoun} saved across destinations`;

          return (
            <section
              key={groupId}
              role="region"
              aria-label={`${vendorName} ${groupKind.toLocaleLowerCase()}`}
              data-testid="completion-vendor-ledger"
              className="overflow-hidden rounded-md border border-tea-border bg-tea-surface"
            >
              <header className="flex flex-wrap items-end justify-between gap-3 border-b border-tea-border p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-sec">{groupKind}</p>
                  <h4 className={`mt-1 break-words text-tea-text ${TYPOGRAPHY_CLASSES.h3}`}>{vendorName}</h4>
                  <p className="mt-1 text-ui-11 text-tea-text-sec">{groupSummary}</p>
                </div>
                {receipt?.id ? (
                  <a href={`/admin/stock?receipt=${encodeURIComponent(receipt.id)}`} className="tap-target inline-flex min-h-11 items-center gap-1 text-ui-11 text-tea-gold">
                    {transitOnly ? 'Open in-transit receipt' : 'Open receipt'} <ArrowRight size={13} aria-hidden="true" />
                  </a>
                ) : stockRows.length > 0 ? (
                  <p className="text-ui-11 text-tea-text-sec">Receipt unavailable</p>
                ) : null}
              </header>

              <div className="divide-y divide-tea-border">
                {groupRows.map(({ item, compassEntryId, productId, identityDisposition, holdingDisposition }) => (
                  <div key={item.id} data-testid="completion-ledger-row" className="p-4 sm:px-5">
                    <h5 className="break-words font-serif text-ui-17 font-normal leading-snug text-tea-text">{item.english_name || item.name || item.raw_text}</h5>
                    {item.original_name && <p className="mt-0.5 break-words font-chinese text-ui-12 text-tea-text-sec">{item.original_name}</p>}
                    <p className="mt-2 text-ui-11 text-tea-text-sec">{quantity(item)} · {amount(item)}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-ui-11 text-tea-text-sec">
                      <span>{item.category === 'teaware' ? 'Teaware' : 'Tea'} record {identityDisposition}</span>
                      <span>{importDisposition(item) === 'library_only' ? 'Library only · no Inventory holding' : importDisposition(item) === 'in_transit' ? `Inventory holding ${holdingDisposition} · awaiting receipt` : `Stock record ${holdingDisposition}`}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {compassEntryId && <a href={`/admin/compass?tab=library&entry=${encodeURIComponent(compassEntryId)}`} className="tap-target inline-flex min-h-11 items-center gap-1 text-ui-11 text-tea-gold">Open Library identity <ArrowRight size={13} aria-hidden="true" /></a>}
                      {productId && <a href={`/admin/stock?panel=${encodeURIComponent(productId)}`} className="tap-target inline-flex min-h-11 items-center gap-1 text-ui-11 text-tea-gold">Open Inventory holding <ArrowRight size={13} aria-hidden="true" /></a>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-between gap-3 border-t border-tea-border pt-3">
        <button type="button" onClick={onClose} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Close summary</button>
        <button type="button" onClick={onNew} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg">Start another import</button>
      </div>
    </section>
  );
};
