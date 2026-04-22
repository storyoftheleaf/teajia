import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingBag, Plus, ChevronDown, Loader2, X, Trash2 } from 'lucide-react';
import { api, PurchaseOrder, PurchaseOrderItem } from '../../lib/api';
import { useProducts, useCustomers } from '../hooks/useAdminData';
import { useToast } from '../components/Toast';

const PO_STATUSES = ['pending', 'ordered', 'received', 'cancelled'] as const;
type PoStatus = typeof PO_STATUSES[number];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  ordered: 'Ordered',
  received: 'Received',
  cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-tea-elevated text-tea-text-sec',
  ordered: 'bg-tea-gold-lt text-tea-gold',
  received: 'bg-tea-elevated text-tea-text',
  cancelled: 'bg-tea-elevated text-tea-text-dim',
};

interface NewPoItem {
  product_id: string;
  product_name: string;
  quantity_grams: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── New PO Form ──
const NewPoForm: React.FC<{ onClose: () => void; onSubmit: (data: Parameters<typeof api.purchaseOrders.create>[0]) => Promise<void>; submitting: boolean }> = ({
  onClose, onSubmit, submitting,
}) => {
  const { data: products = [] } = useProducts();
  const { data: customers = [] } = useCustomers();
  const vendors = customers.filter(c => c.tags?.includes('vendor'));

  const [vendorId, setVendorId] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [items, setItems] = useState<NewPoItem[]>([{ product_id: '', product_name: '', quantity_grams: 0 }]);
  const [notes, setNotes] = useState('');

  const handleVendorChange = (id: string) => {
    setVendorId(id);
    const vendor = vendors.find(v => v.id === id);
    setVendorName(vendor?.name || '');
  };

  const addItem = () => setItems(prev => [...prev, { product_id: '', product_name: '', quantity_grams: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof NewPoItem, value: string | number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'product_id') {
        const p = products.find((pr: any) => pr.id === value);
        return { ...item, product_id: value as string, product_name: p ? (p.givenName || p.productName || '') : '' };
      }
      return { ...item, [field]: value };
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendorName.trim()) return;
    const validItems = items.filter(i => i.product_id && i.quantity_grams > 0);
    await onSubmit({
      vendor_name: vendorName.trim(),
      vendor_id: vendorId || undefined,
      items_json: JSON.stringify(validItems.map(i => ({
        product_id: i.product_id,
        product_name: i.product_name,
        quantity_grams: i.quantity_grams,
      } satisfies PurchaseOrderItem))),
      notes: notes.trim() || undefined,
      status: 'pending',
    });
  };

  const inputCls = 'w-full bg-transparent border-b border-tea-border py-1.5 text-sm text-tea-text outline-none focus:border-tea-gold transition-colors placeholder-tea-text-sec/50';
  const labelCls = 'block text-[10px] uppercase tracking-[0.15em] text-tea-text-dim mb-1';

  return (
    <div className="fixed inset-0 z-priority flex items-end sm:items-center justify-center bg-tea-bg/80 backdrop-blur-md" onClick={onClose}>
      <div className="bg-tea-surface border border-tea-border rounded-t-2xl sm:rounded-xl w-full max-w-lg max-h-[90dvh] flex flex-col overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-tea-border flex-shrink-0">
          <h2 className="text-sm font-semibold text-tea-text tracking-wide uppercase">New Purchase Order</h2>
          <button onClick={onClose} className="p-1.5 text-tea-text-sec hover:text-tea-text transition-colors rounded-md">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Vendor */}
          <div>
            <label className={labelCls}>Vendor / Source</label>
            {vendors.length > 0 ? (
              <select
                value={vendorId}
                onChange={e => handleVendorChange(e.target.value)}
                className={inputCls}
              >
                <option value="">Select vendor…</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="Vendor name"
                className={inputCls}
                required
              />
            )}
            {vendorId && !vendorName && (
              <input
                type="text"
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="Vendor name override"
                className={`${inputCls} mt-1`}
              />
            )}
          </div>

          {/* Line items */}
          <div>
            <label className={labelCls}>Line Items</label>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <select
                    value={item.product_id}
                    onChange={e => updateItem(idx, 'product_id', e.target.value)}
                    className="flex-1 bg-transparent border-b border-tea-border py-1.5 text-sm text-tea-text outline-none focus:border-tea-gold"
                  >
                    <option value="">Select product…</option>
                    {products
                      .filter((p: any) => p.type !== 'Teaware')
                      .map((p: any) => (
                        <option key={p.id} value={p.id}>{p.givenName || p.productName}</option>
                      ))}
                  </select>
                  <input
                    type="number"
                    value={item.quantity_grams || ''}
                    onChange={e => updateItem(idx, 'quantity_grams', parseInt(e.target.value) || 0)}
                    placeholder="g"
                    inputMode="numeric"
                    className="w-16 bg-transparent border-b border-tea-border py-1.5 text-sm text-right text-tea-text outline-none focus:border-tea-gold tabular-nums"
                  />
                  <span className="text-xs text-tea-text-dim shrink-0">g</span>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="p-1 text-tea-text-sec hover:text-tea-text transition-colors shrink-0">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 flex items-center gap-1.5 text-xs text-tea-text-sec hover:text-tea-gold transition-colors"
            >
              <Plus size={12} /> Add line item
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="w-full bg-transparent border border-tea-border rounded-lg px-3 py-2 text-sm text-tea-text outline-none focus:border-tea-gold resize-none placeholder-tea-text-sec/50 transition-colors"
            />
          </div>

          <div className="flex justify-between gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-tea-text-sec hover:text-tea-text transition-colors uppercase tracking-[0.15em]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !vendorName.trim()}
              className="px-6 py-2 bg-tea-accent text-tea-bg text-xs font-bold uppercase tracking-[0.15em] rounded-lg hover:bg-tea-gold/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <ShoppingBag size={13} />}
              Create PO
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Receive Stock Prompt ──
const ReceiveStockPrompt: React.FC<{
  po: PurchaseOrder;
  onConfirm: (productId: string, grams: number) => Promise<void>;
  onClose: () => void;
}> = ({ po, onConfirm, onClose }) => {
  const items: PurchaseOrderItem[] = (() => {
    try { return JSON.parse(po.items_json); } catch { return []; }
  })();

  const [confirming, setConfirming] = useState(false);

  if (!items.length) {
    return (
      <div className="fixed inset-0 z-priority flex items-center justify-center bg-tea-bg/80 backdrop-blur-md" onClick={onClose}>
        <div className="bg-tea-surface border border-tea-border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
          <p className="text-sm text-tea-text-sec text-center">No line items to receive.</p>
          <button onClick={onClose} className="mt-4 w-full text-xs text-tea-text-sec hover:text-tea-text">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-priority flex items-end sm:items-center justify-center bg-tea-bg/80 backdrop-blur-md" onClick={onClose}>
      <div className="bg-tea-surface border border-tea-border rounded-t-2xl sm:rounded-xl w-full max-w-md overflow-hidden shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-tea-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-tea-text">Add stock to inventory?</h3>
          <button onClick={onClose} className="p-1.5 text-tea-text-sec hover:text-tea-text"><X size={15} /></button>
        </div>
        <div className="p-5 space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-tea-text-sec">{item.product_name}</span>
              <span className="text-tea-gold tabular-nums font-medium">+{item.quantity_grams}g</span>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5 flex justify-between gap-3">
          <button onClick={onClose} className="px-4 py-2 text-xs text-tea-text-sec hover:text-tea-text uppercase tracking-[0.15em]">Skip</button>
          <button
            disabled={confirming}
            onClick={async () => {
              setConfirming(true);
              try {
                for (const item of items) {
                  if (item.product_id && item.quantity_grams > 0) {
                    await onConfirm(item.product_id, item.quantity_grams);
                  }
                }
                onClose();
              } finally {
                setConfirming(false);
              }
            }}
            className="px-6 py-2 bg-tea-accent text-tea-bg text-xs font-bold uppercase tracking-[0.15em] rounded-lg hover:bg-tea-gold/90 disabled:opacity-50 flex items-center gap-2"
          >
            {confirming ? <Loader2 size={12} className="animate-spin" /> : null}
            Add to stock
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ──
export const PurchaseOrdersPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isNewFormOpen, setIsNewFormOpen] = useState(false);
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);

  const { data: orders = [], isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ['purchase_orders'],
    queryFn: () => api.purchaseOrders.list(),
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof api.purchaseOrders.create>[0]) => api.purchaseOrders.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      setIsNewFormOpen(false);
      showToast('Purchase order created', 'success');
    },
    onError: (err: Error) => showToast(err.message || 'Failed to create PO', 'error'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.purchaseOrders.updateStatus(id, status),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['purchase_orders'] });
      if (vars.status === 'received') {
        const po = orders.find(o => o.id === vars.id);
        if (po) setReceivePo(po);
      }
    },
    onError: (err: Error) => showToast(err.message || 'Failed to update status', 'error'),
  });

  const incrementMutation = useMutation({
    mutationFn: ({ productId, amount }: { productId: string; amount: number }) =>
      api.rpc.incrementStock(productId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      showToast('Stock incremented', 'success');
    },
    onError: (err: Error) => showToast(err.message || 'Failed to add stock', 'error'),
  });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-tea-border bg-tea-bg flex-shrink-0">
        <ShoppingBag size={17} className="text-tea-text-sec shrink-0" />
        <h1 className="text-sm font-semibold text-tea-text tracking-wide flex-1">Purchase Orders</h1>
        <button
          onClick={() => setIsNewFormOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-tea-elevated border border-tea-border rounded-lg text-xs text-tea-text hover:border-tea-gold/40 transition-colors"
        >
          <Plus size={13} />
          New PO
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin text-tea-text-sec" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-tea-text-sec">
            <ShoppingBag size={28} className="mb-3 opacity-30" />
            <p className="text-sm font-serif italic">No purchase orders yet.</p>
            <button onClick={() => setIsNewFormOpen(true)} className="mt-3 text-xs text-tea-gold hover:underline">
              Create your first PO
            </button>
          </div>
        ) : (
          <div className="divide-y divide-tea-border">
            {orders.map(order => {
              const items: PurchaseOrderItem[] = (() => {
                try { return JSON.parse(order.items_json); } catch { return []; }
              })();
              return (
                <div key={order.id} className="px-4 md:px-6 py-4 hover:bg-tea-surface/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-serif text-tea-text">{order.vendor_name}</span>
                        <span className={`text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[order.status] || STATUS_STYLES.pending}`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </div>

                      {items.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                          {items.map((item, idx) => (
                            <span key={idx} className="text-xs text-tea-text-sec">
                              {item.product_name} <span className="text-tea-text-dim tabular-nums">{item.quantity_grams}g</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {order.notes && (
                        <p className="mt-1 text-xs text-tea-text-dim line-clamp-1">{order.notes}</p>
                      )}

                      <span className="text-[10px] text-tea-text-dim mt-1 block">{formatDate(order.created_at)}</span>
                    </div>

                    {/* Status selector */}
                    <div className="relative shrink-0">
                      <select
                        value={order.status}
                        onChange={e => statusMutation.mutate({ id: order.id, status: e.target.value })}
                        disabled={statusMutation.isPending}
                        className="appearance-none bg-tea-elevated border border-tea-border rounded-lg pl-3 pr-7 py-1.5 text-xs text-tea-text outline-none focus:border-tea-gold cursor-pointer"
                      >
                        {PO_STATUSES.map(s => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                      <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-tea-text-dim pointer-events-none" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New PO form modal */}
      {isNewFormOpen && (
        <NewPoForm
          onClose={() => setIsNewFormOpen(false)}
          onSubmit={async data => { await createMutation.mutateAsync(data); }}
          submitting={createMutation.isPending}
        />
      )}

      {/* Receive stock prompt */}
      {receivePo && (
        <ReceiveStockPrompt
          po={receivePo}
          onConfirm={async (productId, grams) => {
            await incrementMutation.mutateAsync({ productId, amount: grams });
          }}
          onClose={() => setReceivePo(null)}
        />
      )}
    </div>
  );
};
