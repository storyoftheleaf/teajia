import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Loader2, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface StockLedgerPanelProps {
  productId: string;
  productName: string;
  onClose?: () => void;
}

const REASON_LABELS: Record<string, string> = {
  FULFILLMENT: 'Sale',
  VOID: 'Void Restore',
  MANUAL_ADJUST: 'Manual',
  PURCHASE_RECEIPT: 'Received',
  IMPORT: 'Import',
  CREATION: 'Created',
  WASTE: 'Waste',
  SAMPLE: 'Sample',
  SAMPLE_USE: 'Sample use',
  GIFT: 'Gift',
  RETURN: 'Return',
  RECOUNT: 'Recount',
  TRANSFER: 'Transfer',
  RECEIPT: 'Received',
  PERSONAL: 'Personal',
};

export const StockLedgerPanel: React.FC<StockLedgerPanelProps> = ({
  productId, productName, onClose,
}) => {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['stock_ledger', productId, limit, offset],
    enabled: !!productId,
    queryFn: () => api.stockLedger.list(productId, limit, offset),
  });

  const entries = data?.entries || [];
  const total = data?.total || 0;
  const hasNext = offset + limit < total;
  const hasPrev = offset > 0;

  return (
    <div className="inset-panel p-4">
      <div className="flex items-center justify-between mb-3">
        {onClose && (
          <button onClick={onClose} className="text-xs text-tea-text-sec active:text-tea-text transition-colors py-1.5 px-3 -ml-3 rounded-xl">Close</button>
        )}
        <h4 className="text-ui-13 uppercase tracking-[0.1em] text-tea-text-sec font-medium">Stock History</h4>
        {onClose && <div className="w-12" />}
      </div>
      <p className="text-sm text-tea-text font-serif mb-3">{productName}</p>

      {isLoading ? (
        <div className="py-6 text-center text-tea-text-sec"><Loader2 className="animate-spin inline" size={16} /></div>
      ) : entries.length === 0 ? (
        <div className="py-6 text-center text-tea-text-sec text-xs font-serif italic">No stock movements recorded.</div>
      ) : (
        <>
          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto custom-scrollbar">
            {entries.map((entry: any) => {
              const isPositive = entry.delta > 0;
              const before = entry.balance_before ?? Number(entry.balance_after) - Number(entry.delta);
              const reference = entry.source_invoice_number || entry.reference;
              const isUnits = entry.movement_unit === 'unit' || entry.unit === 'unit';
              const unitLabel = isUnits ? ' units' : 'g';
              const ariaUnit = isUnits ? 'units' : 'grams';
              return (
                <article key={entry.id} className="py-2 border-b border-tea-border last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                  <div className={`flex items-center gap-0.5 w-16 shrink-0 ${isPositive ? 'text-tea-gold' : 'text-tea-text-sec'}`}>
                    {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    <span className="text-ui-11 num font-medium">
                      {isPositive ? '+' : ''}{entry.delta}{unitLabel}
                    </span>
                  </div>
                  <span className="text-ui-11 text-tea-text-sec num shrink-0" aria-label={`Balance ${before} ${ariaUnit} to ${entry.balance_after} ${ariaUnit}`}>{before}{unitLabel} → {entry.balance_after}{unitLabel}</span>
                  <span className="badge-status badge-status-default text-ui-11">
                    {REASON_LABELS[entry.reason] || entry.reason}
                  </span>
                  {entry.batch_label && entry.batch_label !== 'Unsorted' && (
                    <span className="text-ui-10 text-tea-gold-lt truncate max-w-[7rem]" title={entry.batch_label}>
                      {entry.batch_label}
                    </span>
                  )}
                  {reference && (
                    <button
                      onClick={() => navigate(`/admin/orders?search=${encodeURIComponent(reference)}`)}
                      className="text-ui-10 text-tea-text-sec hover:text-tea-gold num truncate transition-colors"
                    >
                      {reference}
                    </button>
                  )}
                  <span className="text-ui-11 text-tea-text-sec ml-auto shrink-0">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                  </div>
                  {(entry.note || entry.user_email || entry.actor_email) && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-ui-11 text-tea-text-sec">
                      {(entry.user_email || entry.actor_email) && <span>{entry.user_email || entry.actor_email}</span>}
                      {entry.note && <span className="text-tea-text">{entry.note}</span>}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-tea-border">
              <span className="text-xs text-tea-text-sec">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
              <div className="flex gap-1">
                <button
                  aria-label="Previous stock history page"
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={!hasPrev}
                  className="p-2.5 text-tea-text-sec hover:text-tea-text disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  aria-label="Next stock history page"
                  onClick={() => setOffset(offset + limit)}
                  disabled={!hasNext}
                  className="p-2.5 text-tea-text-sec hover:text-tea-text disabled:opacity-50 transition-colors"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
