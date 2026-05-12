import React, { useState, useEffect } from 'react';
import { X, Scissors, Check, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface SplitOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  invoice: any;
  showToast: (msg: string, type?: string) => void;
}

export const SplitOrderModal: React.FC<SplitOrderModalProps> = ({
  isOpen, onClose, onSuccess, invoice, showToast,
}) => {
  const [items, setItems] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!isOpen || !invoice) return;
    setFetching(true);
    setSelected(new Set());
    api.invoices.getItems(invoice.id).then(data => {
      setItems(data || []);
      setFetching(false);
    }).catch(() => {
      showToast('Could not load invoice items', 'error');
      setFetching(false);
    });
  }, [isOpen, invoice]);

  if (!isOpen) return null;

  const toggleItem = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const canSplit = selected.size > 0 && selected.size < items.length;

  const handleSplit = async () => {
    if (!canSplit) return;
    setLoading(true);
    try {
      const result = await api.rpc.splitInvoice(invoice.id, Array.from(selected));
      showToast(`Split complete. New invoice: ${result.new_invoice_number}`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast('Split failed: ' + err.message, 'error');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-in fade-in duration-200">
      <button
        type="button"
        aria-hidden
        onClick={onClose}
        className="absolute inset-0 bg-tea-bg/70 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Split order"
        className="relative bg-tea-surface border border-tea-border rounded-xl shadow-2xl w-full max-w-md"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-tea-text-sec hover:text-tea-text transition-colors rounded-md p-1.5 tap-target"
          aria-label="Close"
        >
          <X size={16} />
        </button>

        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <Scissors size={14} className="text-tea-gold" />
            <h3 className="h3 text-tea-text">Split Order</h3>
          </div>
          <p className="text-ui-13 text-tea-text-sec mt-1">
            Select items to move to a new invoice. Remaining items stay on {invoice?.invoice_number}.
          </p>
        </div>

        <div className="px-5 py-4">
          {fetching ? (
            <div className="py-8 text-center text-tea-text-sec"><Loader2 className="animate-spin inline" size={20} /></div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              {items.map((item: any) => {
                const isChecked = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleItem(item.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-md border transition-colors text-left ${
                      isChecked ? 'bg-tea-gold/8 border-tea-border' : 'bg-tea-surface border-tea-border hover:bg-tea-accent-sub'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      isChecked ? 'bg-tea-gold border-tea-gold' : 'border-tea-border'
                    }`}>
                      {isChecked && <Check size={12} className="text-tea-bg" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-ui-14 text-tea-text truncate">{item.given_name || item.product_name || 'Unknown'}</div>
                      <div className="text-ui-11 text-tea-text-dim mt-0.5">{item.quantity}g/u @ ${Number(item.price_at_sale).toFixed(2)}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center gap-2 px-5 py-3 border-t border-tea-border bg-tea-bg/40 rounded-b-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs text-tea-text-sec hover:text-tea-text transition-colors"
            >
              Cancel
            </button>
            <span className="label-caps text-tea-text-dim">{selected.size} of {items.length} selected</span>
          </div>
          <button
            onClick={handleSplit}
            disabled={!canSplit || loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-xs font-semibold hover:bg-tea-gold/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-tea-gold/10"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : <Scissors size={13} />} Split
          </button>
        </div>
      </div>
    </div>
  );
};
