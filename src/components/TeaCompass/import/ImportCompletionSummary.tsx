import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import type { CurateImportDetail, CurateImportFinalizeResult } from '../../../lib/api';
import { TYPOGRAPHY_CLASSES } from '../../../designTokens';

interface Props {
  detail: CurateImportDetail;
  result: CurateImportFinalizeResult;
  onClose: () => void;
  onNew: () => void;
}

const amount = (item: CurateImportDetail['items'][number]) => {
  const value = item.line_cost_exact ?? item.line_cost;
  return value == null ? 'Cost not recorded' : `${item.currency || ''} ${value}`.trim();
};

const quantity = (item: CurateImportDetail['items'][number]) => item.total_quantity_grams
  ? `${item.total_quantity_grams >= 1000 ? `${Number((item.total_quantity_grams / 1000).toFixed(2))}kg` : `${item.total_quantity_grams}g`}`
  : item.total_units ? `${item.total_units} ${item.total_units === 1 ? 'unit' : 'units'}` : 'Quantity recorded';

export const ImportCompletionSummary: React.FC<Props> = ({ detail, result, onClose, onNew }) => {
  const sourceById = new Map(detail.items.map(item => [item.id, item]));
  const rows = result.items.flatMap(finalized => {
    const item = sourceById.get(finalized.id);
    if (!item) return [];
    return [{ item, compassEntryId: finalized.compassEntryId, productId: finalized.productId, identityDisposition: finalized.identityDisposition, holdingDisposition: finalized.holdingDisposition }];
  });
  const journey = result.journey?.name || 'No sourcing run';

  return (
    <section role="region" aria-label="Import complete" className="space-y-5">
      <div className="flex items-start gap-3 border-b border-tea-border pb-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tea-accent-sub text-tea-gold"><Check size={17} aria-hidden="true" /></span>
        <div>
          <h3 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Import complete</h3>
          <p className="mt-1 text-ui-13 leading-relaxed text-tea-text-sec">{rows.length} {rows.length === 1 ? 'item is' : 'items are'} now connected across the Library and Inventory.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2" aria-label="Created records">
        <div className="rounded-md border border-tea-border bg-tea-surface p-3"><strong className="block text-ui-20 font-medium text-tea-text">{rows.length}</strong><span className="text-ui-11 text-tea-text-sec">{rows.length} Library identities</span></div>
        <div className="rounded-md border border-tea-border bg-tea-surface p-3"><strong className="block text-ui-20 font-medium text-tea-text">{rows.length}</strong><span className="text-ui-11 text-tea-text-sec">{rows.length} Inventory holdings</span></div>
      </div>

      <div className="space-y-2">
        <p className="text-ui-10 uppercase tracking-[1.2px] text-tea-text-sec">{result.receipts.length} vendor {result.receipts.length === 1 ? 'receipt' : 'receipts'} · {journey}</p>
        {rows.map(({ item, compassEntryId, productId, identityDisposition, holdingDisposition }) => {
          return (
            <article key={item.id} className="rounded-md border border-tea-border bg-tea-surface p-3">
              <h4 className="break-words text-ui-14 font-medium text-tea-text">{item.english_name || item.name || item.raw_text}</h4>
              {item.original_name && <p className="mt-0.5 break-words font-chinese text-ui-12 text-tea-text-sec">{item.original_name}</p>}
              <p className="mt-2 text-ui-11 text-tea-text-sec">{quantity(item)} · {amount(item)}</p>
              <p className="mt-1 text-ui-11 text-tea-text-sec">Library identity {identityDisposition} · Inventory holding {holdingDisposition}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {compassEntryId && <a href={`/admin/compass?tab=library&entry=${encodeURIComponent(compassEntryId)}`} className="tap-target inline-flex min-h-11 items-center gap-1 text-ui-11 text-tea-gold">Open Library identity <ArrowRight size={13} aria-hidden="true" /></a>}
                {productId && <a href={`/admin/stock?panel=${encodeURIComponent(productId)}`} className="tap-target inline-flex min-h-11 items-center gap-1 text-ui-11 text-tea-gold">Open Inventory holding <ArrowRight size={13} aria-hidden="true" /></a>}
              </div>
            </article>
          );
        })}
      </div>

      {result.receipts.length > 0 && <div className="space-y-1" aria-label="Vendor receipts">
        {result.receipts.map(receipt => <a key={receipt.id} href={`/admin/stock?receipt=${encodeURIComponent(receipt.id)}`} className="tap-target flex min-h-11 items-center justify-between border-b border-tea-border text-ui-12 text-tea-gold"><span>{receipt.vendorName} receipt</span><ArrowRight size={14} aria-hidden="true" /></a>)}
      </div>}

      <div className="flex flex-wrap justify-between gap-3 border-t border-tea-border pt-3">
        <button type="button" onClick={onClose} className="tap-target min-h-11 text-ui-12 text-tea-text-sec hover:text-tea-text">Close summary</button>
        <button type="button" onClick={onNew} className="tap-target min-h-11 rounded-md bg-tea-gold px-4 text-ui-12 font-medium text-tea-bg">Start another import</button>
      </div>
    </section>
  );
};
