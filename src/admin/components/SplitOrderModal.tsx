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
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-tea-text-sec hover:text-tea-text transition-colors" aria-label="Close">
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Scissors size={18} className="text-tea-gold" />
          <h3 className="text-lg font-serif text-tea-text">Split Order</h3>
        </div>
        <p className="text-xs text-tea-text-sec mb-4">Select items to move to a new invoice. Remaining items stay on {invoice?.invoice_number}.</p>

        {fetching ? (
          <div className="py-8 text-center text-tea-text-sec"><Loader2 className="animate-spin inline" /></div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar mb-6">
            {items.map((item: any) => {
              const isChecked = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    isChecked ? 'bg-tea-gold/8 border-tea-border' : 'bg-tea-surface border-tea-border hover:bg-tea-elevated/50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isChecked ? 'bg-tea-gold border-tea-gold' : 'border-tea-border'
                  }`}>
                    {isChecked && <Check size={12} className="text-tea-bg" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-tea-text font-medium truncate">{item.given_name || item.product_name || 'Unknown'}</div>
                    <div className="text-[10px] text-tea-text-sec">{item.quantity}g/u @ ${Number(item.price_at_sale).toFixed(2)}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex justify-between items-center pt-4 border-t border-tea-border">
          <span className="text-xs text-tea-text-sec">{selected.size} of {items.length} selected</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-tea-text-sec hover:text-tea-text transition-colors">Cancel</button>
            <button
              onClick={handleSplit}
              disabled={!canSplit || loading}
              className="px-5 py-2 text-sm font-medium bg-tea-gold text-tea-bg rounded-lg hover:bg-tea-gold/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <Scissors size={14} /> Split
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
