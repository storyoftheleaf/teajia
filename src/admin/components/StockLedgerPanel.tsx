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
  IMPORT: 'Import',
  CREATION: 'Created',
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
          <button onClick={onClose} className="text-xs text-tea-text-sec active:text-tea-text transition-colors py-1.5 px-3 -ml-3 rounded-lg">Close</button>
        )}
        <h4 className="text-[13px] uppercase tracking-[0.1em] text-tea-text-sec font-medium">Stock History</h4>
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
              return (
                <div key={entry.id} className="flex items-center gap-2 py-1.5 border-b border-tea-border last:border-0">
                  <div className={`flex items-center gap-0.5 w-16 shrink-0 ${isPositive ? 'text-tea-gold' : 'text-tea-text-sec'}`}>
                    {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                    <span className="text-[11px] num font-medium">
                      {isPositive ? '+' : ''}{entry.delta}g
                    </span>
                  </div>
                  <span className="text-[11px] text-tea-text-sec num w-14 shrink-0">{entry.balance_after}g</span>
                  <span className="badge-status badge-status-default text-[11px]">
                    {REASON_LABELS[entry.reason] || entry.reason}
                  </span>
                  {entry.source_invoice_number && (
                    <button
                      onClick={() => navigate(`/admin/orders?search=${encodeURIComponent(entry.source_invoice_number)}`)}
                      className="text-[10px] text-tea-text-sec hover:text-tea-accent num truncate transition-colors"
                    >
                      {entry.source_invoice_number}
                    </button>
                  )}
                  <span className="text-[11px] text-tea-text-sec/50 ml-auto shrink-0">
                    {new Date(entry.created_at).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-tea-border">
              <span className="text-xs text-tea-text-sec">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                  disabled={!hasPrev}
                  className="p-2.5 text-tea-text-sec hover:text-tea-text disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
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
