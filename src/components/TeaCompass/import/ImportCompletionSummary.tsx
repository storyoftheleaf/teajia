import React from 'react';
import { ArrowRight } from 'lucide-react';
import type { CurateImportDetail, CurateImportFinalizeResult } from '../../../lib/api';
import { importItemNoun } from './importReviewDomain';

interface Props {
  detail: CurateImportDetail;
  result: CurateImportFinalizeResult;
  onClose: () => void;
  onNew: () => void;
}

type FinalizedRow = {
  item: CurateImportDetail['items'][number];
  compassEntryId: string;
  productId: string;
  identityDisposition: 'created' | 'reused';
  holdingDisposition: 'created' | 'reused';
};

const UNGROUPED = '__ungrouped__';

const amount = (item: CurateImportDetail['items'][number]) => {
  const value = item.line_cost_exact ?? item.line_cost;
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

  return (
    <section role="region" aria-label="Import complete" className="space-y-7">
      <header className="border-b border-tea-border pb-5">
        <p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-sec">Added to your records</p>
        <h3 className="mt-1 font-serif text-ui-28 font-normal leading-tight text-tea-text">Import complete</h3>
        <p className="mt-2 text-ui-13 leading-relaxed text-tea-text-sec">{rows.length} {itemNoun} added · {journey}</p>
      </header>

      <div className="space-y-6" aria-label="Import ledger">
        {[...rowsByGroup.entries()].map(([groupId, groupRows]) => {
          const receipt = groupId === UNGROUPED ? undefined : receiptsByGroup.get(groupId);
          const vendorName = receipt?.vendorName?.trim() || 'Vendor not recorded';
          const groupNoun = importItemNoun(groupRows.map(row => row.item), groupRows.length);

          return (
            <section
              key={groupId}
              role="region"
              aria-label={`${vendorName} vendor receipt`}
              data-testid="completion-vendor-ledger"
              className="overflow-hidden rounded-md border border-tea-border bg-tea-surface"
            >
              <header className="flex flex-wrap items-end justify-between gap-3 border-b border-tea-border p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-sec">Vendor receipt</p>
                  <h4 className="mt-1 break-words font-display text-ui-28 font-normal leading-tight text-tea-text">{vendorName}</h4>
                  <p className="mt-1 text-ui-11 text-tea-text-sec">{groupRows.length} {groupNoun} received</p>
                </div>
                {receipt?.id ? (
                  <a href={`/admin/stock?receipt=${encodeURIComponent(receipt.id)}`} className="tap-target inline-flex min-h-11 items-center gap-1 text-ui-11 text-tea-gold">
                    Open received receipt <ArrowRight size={13} aria-hidden="true" />
                  </a>
                ) : (
                  <p className="text-ui-11 text-tea-text-sec">Receipt unavailable</p>
                )}
              </header>

              <div className="divide-y divide-tea-border">
                {groupRows.map(({ item, compassEntryId, productId, identityDisposition, holdingDisposition }) => (
                  <div key={item.id} data-testid="completion-ledger-row" className="p-4 sm:px-5">
                    <h5 className="break-words font-serif text-ui-17 font-normal leading-snug text-tea-text">{item.english_name || item.name || item.raw_text}</h5>
                    {item.original_name && <p className="mt-0.5 break-words font-chinese text-ui-12 text-tea-text-sec">{item.original_name}</p>}
                    <p className="mt-2 text-ui-11 text-tea-text-sec">{quantity(item)} · {amount(item)}</p>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-ui-11 text-tea-text-sec">
                      <span>Tea record {identityDisposition}</span>
                      <span>Stock record {holdingDisposition}</span>
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
