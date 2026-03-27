import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Loader2, Search, XCircle, Trash2, Eye, X, PackageCheck, Users, History, Scissors, Pencil, Package, MoreHorizontal, Clock } from 'lucide-react';
import { useRates, useProducts } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';
import { SplitOrderModal } from './SplitOrderModal';
import { EditOrderModal } from './EditOrderModal';
import { formatCurrency } from '../utils';

const ROW_HEIGHT = 36;

type StatusFilter = 'all' | 'Pending' | 'Filled' | 'Void';

export const OrdersView = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data: rates = [] } = useRates();
  const { data: products = [] } = useProducts();

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    type: 'fulfill' | 'void' | 'delete';
    invoice: any;
    stockImpact?: { name: string; current: number; after: number }[];
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Split & Edit modal state
  const [splitInvoice, setSplitInvoice] = useState<any | null>(null);
  const [editInvoice, setEditInvoice] = useState<any | null>(null);

  // Timeline state for invoice detail
  const [invoiceTimeline, setInvoiceTimeline] = useState<any[]>([]);

  const [pageSize, setPageSize] = useState(50);
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', pageSize],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      return await api.invoices.list(pageSize);
    }
  });

  // Pipeline summary
  const summary = useMemo(() => {
    const pending = orders.filter((o: any) => o.status === 'Pending').length;
    const filled = orders.filter((o: any) => o.status === 'Filled').length;
    const voided = orders.filter((o: any) => o.status === 'Void').length;
    const filledTotal = orders
      .filter((o: any) => o.status === 'Filled')
      .reduce((sum: number, o: any) => sum + (Number(o.computed_total) || 0) + (Number(o.shipping_cost_usd) || 0), 0);
    return { pending, filled, voided, filledTotal };
  }, [orders]);

  const handleView = async (invoice: any) => {
    try {
      const items = await api.invoices.getItems(invoice.id);
      setViewingInvoice({ ...invoice, items });
      // Fetch timeline
      try {
        const timeline = await api.activityLogs.list({ entity_id: invoice.id, limit: 20 });
        setInvoiceTimeline(timeline?.logs || []);
      } catch { setInvoiceTimeline([]); }
    } catch {
      showToast("Could not load invoice details.", 'error');
    }
  };

  const openFulfillConfirm = async (invoice: any) => {
    // Fetch stock impact preview
    try {
      const items = await api.invoices.getItems(invoice.id);
      const impact = items.map((item: any) => {
        const product = products.find(p => p.id === item.product_id);
        const current = product?.stockGrams || 0;
        return {
          name: item.given_name || item.product_name || 'Unknown',
          current,
          after: current - (Number(item.quantity) || 0),
        };
      });
      setConfirmState({ type: 'fulfill', invoice, stockImpact: impact });
    } catch {
      setConfirmState({ type: 'fulfill', invoice });
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmState) return;
    setConfirmLoading(true);
    try {
      if (confirmState.type === 'fulfill') {
        await api.rpc.fulfillInvoice(confirmState.invoice.id);
        showToast('Order fulfilled. Stock deducted.', 'success');
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } else if (confirmState.type === 'void') {
        await api.rpc.voidInvoice(confirmState.invoice.id);
        showToast('Order voided.', 'success');
        queryClient.invalidateQueries({ queryKey: ['products'] });
      } else if (confirmState.type === 'delete') {
        await api.invoices.delete(confirmState.invoice.id);
        showToast('Invoice deleted.', 'success');
      }
      refetch();
    } catch (err: any) {
      showToast(`Action failed: ${err.message}`, 'error');
    }
    setConfirmLoading(false);
    setConfirmState(null);
  };

  const filteredOrders = orders.filter((o: any) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return o.customer_name?.toLowerCase().includes(q) || o.invoice_number?.toLowerCase().includes(q);
  });

  const getDaysAge = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  if (isLoading) return <div className="p-12 text-center text-tea-text-sec font-serif italic"><Loader2 className="animate-spin inline" /></div>;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-tea-bg/90 backdrop-blur-md border-b border-tea-border py-2.5 flex-shrink-0">
        <div className="px-3 md:px-6 max-w-7xl mx-auto flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <History size={16} className="text-tea-accent" />
            <h2 className="text-sm font-serif text-tea-text uppercase tracking-[0.15em] hidden md:block">
              Orders
            </h2>
          </div>

          {/* Pipeline Summary — scrollable on mobile */}
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar">
            {(['all', 'Pending', 'Filled', 'Void'] as StatusFilter[]).map(status => {
              const count = status === 'all' ? orders.length
                : status === 'Pending' ? summary.pending
                : status === 'Filled' ? summary.filled
                : summary.voided;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`${statusFilter === status ? 'pill-active' : 'pill'} flex items-center gap-1`}
                >
                  {status === 'all' ? 'All' : status}
                  <span className="text-[9px] opacity-70">{count}</span>
                </button>
              );
            })}
          </div>

          {summary.filledTotal > 0 && (
            <span className="text-[10px] text-tea-text-sec num hidden md:inline">
              Revenue: ${summary.filledTotal.toFixed(0)}
            </span>
          )}

          <div className="relative w-28 md:w-48 ml-auto shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-b border-tea-border rounded-none pl-8 md:pl-9 pr-3 py-1.5 text-xs text-tea-text outline-none focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6">

        {/* Desktop table */}
        <div className="w-full max-w-7xl mx-auto bg-tea-surface min-h-full hidden md:block">
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[28%]" />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-tea-bg shadow-sm">
              <tr>
                <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Date</th>
                <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Invoice #</th>
                <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-left">Customer</th>
                <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-right">Total</th>
                <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-center">Status</th>
                <th className="px-4 py-2 border-b border-tea-border text-[10px] uppercase tracking-wider font-serif text-tea-text-sec text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3 text-tea-text-sec">
                    <Package size={32} strokeWidth={1} className="opacity-40" />
                    <span className="font-serif italic">{search || statusFilter !== 'all' ? 'No matching orders' : 'No orders yet'}</span>
                    {(search || statusFilter !== 'all') && (
                      <button onClick={() => { setSearch(''); setStatusFilter('all'); }} className="text-xs text-tea-gold hover:text-tea-gold/80 transition-colors">
                        Clear filters
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : (
                filteredOrders.map((order: any) => {
                  const isPending = order.status === 'Pending';
                  const isVoid = order.status === 'Void';
                  const isFilled = order.status === 'Filled';
                  const total = (Number(order.computed_total) || 0) + (Number(order.shipping_cost_usd) || 0);
                  const daysAge = isPending ? getDaysAge(order.created_at) : 0;

                  return (
                    <tr key={order.id} className="transition-colors border-b border-tea-border group hover:bg-tea-bg/50" style={{ height: ROW_HEIGHT }}>
                      <td className="px-4 align-middle overflow-hidden">
                        <span className="text-xs text-tea-text-sec">{new Date(order.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="px-4 align-middle overflow-hidden">
                        <span className="num text-xs text-tea-text group-hover:text-tea-accent cursor-pointer transition-colors" onClick={() => handleView(order)}>{order.invoice_number}</span>
                      </td>
                      <td className="px-4 align-middle overflow-hidden">
                        <button
                          onClick={() => navigate(`/admin/customers?search=${encodeURIComponent(order.customer_name || '')}`)}
                          className="text-xs text-tea-text hover:text-tea-accent transition-colors flex items-center gap-1.5 group/cust truncate"
                          title="View customer profile"
                        >
                          <Users size={12} className="opacity-0 group-hover/cust:opacity-100 transition-opacity text-tea-text-sec flex-shrink-0" />
                          <span className="truncate">{order.customer_name}</span>
                        </button>
                      </td>
                      <td className="px-4 align-middle overflow-hidden text-right">
                        <div>
                          <span className="num text-xs text-tea-text">${total.toFixed(2)}</span>
                          <span className="text-[9px] text-tea-text-sec ml-1">{order.display_currency}</span>
                        </div>
                        {Number(order.shipping_cost_usd) > 0 && (
                          <div className="text-[9px] text-tea-text-sec/60 num">+${Number(order.shipping_cost_usd).toFixed(0)} ship</div>
                        )}
                      </td>
                      <td className="px-4 align-middle text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`badge-status ${
                            isVoid ? 'badge-status-muted' :
                            isPending ? 'badge-status-gold' :
                            'badge-status-default'
                          }`}>
                            {order.status}
                          </span>
                          {isPending && daysAge >= 7 && (
                            <span className="text-[9px] text-tea-gold/80 num">{daysAge}d</span>
                          )}
                          {order.notes && (
                            <span className="text-tea-text-sec/50" title={order.notes}>📝</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 align-middle">
                        <div className="flex justify-center gap-1">
                          {isPending && (
                            <>
                              <button
                                onClick={() => openFulfillConfirm(order)}
                                className="pill-action"
                                title="Mark as Filled (Deduct Stock)"
                              >
                                <PackageCheck size={12} /> FILL
                              </button>
                              <button onClick={() => setEditInvoice(order)} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors" title="Edit Order">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => setSplitInvoice(order)} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors" title="Split Order">
                                <Scissors size={14} />
                              </button>
                            </>
                          )}
                          <button onClick={() => handleView(order)} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors" title="View Details">
                            <Eye size={14} />
                          </button>
                          {!isVoid && (
                            <button onClick={() => setConfirmState({ type: 'void', invoice: order })} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text-sec/80 transition-colors" title="Void Order">
                              <XCircle size={14} />
                            </button>
                          )}
                          {isVoid && (
                            <button onClick={() => setConfirmState({ type: 'delete', invoice: order })} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text-sec/80 transition-colors" title="Delete Record">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile list */}
        <div className="md:hidden pb-24">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-tea-text-sec">
              <Package size={32} strokeWidth={1} className="opacity-40" />
              <span className="font-serif italic">{search || statusFilter !== 'all' ? 'No matching orders' : 'No orders yet'}</span>
            </div>
          ) : (
            filteredOrders.map((order: any, idx: number) => {
              const isPending = order.status === 'Pending';
              const isVoid = order.status === 'Void';
              const total = (Number(order.computed_total) || 0) + (Number(order.shipping_cost_usd) || 0);
              const daysAge = isPending ? getDaysAge(order.created_at) : 0;

              return (
                <div
                  key={order.id}
                  className={`px-4 py-2.5 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-tea-text-sec">{new Date(order.created_at).toLocaleDateString()}</span>
                    <span className="text-xs text-tea-text num cursor-pointer hover:text-tea-accent transition-colors" onClick={() => handleView(order)}>{order.invoice_number}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-tea-text font-serif truncate">{order.customer_name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`badge-status ${
                        isVoid ? 'badge-status-muted' :
                        isPending ? 'badge-status-gold' :
                        'badge-status-default'
                      }`}>
                        {order.status}
                      </span>
                      {isPending && daysAge >= 7 && (
                        <span className="text-[9px] text-tea-gold/80 num">{daysAge}d</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-tea-border">
                    <span className="text-xs text-tea-text num">${total.toFixed(2)} {order.display_currency}</span>
                    <div className="flex-1" />
                    {isPending && (
                      <button onClick={() => openFulfillConfirm(order)} className="pill-action">
                        <PackageCheck size={12} /> FILL
                      </button>
                    )}
                    <button onClick={() => handleView(order)} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors"><Eye size={14} /></button>
                    {/* Mobile overflow — show ... menu for secondary actions */}
                    <MobileActions
                      isPending={isPending}
                      isVoid={isVoid}
                      onEdit={() => setEditInvoice(order)}
                      onSplit={() => setSplitInvoice(order)}
                      onVoid={() => setConfirmState({ type: 'void', invoice: order })}
                      onDelete={() => setConfirmState({ type: 'delete', invoice: order })}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {orders.length >= pageSize && (
          <div className="text-center py-4">
            <button
              onClick={() => setPageSize(prev => prev + 50)}
              className="text-xs text-tea-text-sec hover:text-tea-text uppercase tracking-[0.2em] border border-tea-border px-4 py-2 rounded-lg hover:bg-tea-surface transition-colors"
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {/* INVOICE DETAILS MODAL */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-tea-text/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-lg p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                <button onClick={() => { setViewingInvoice(null); setInvoiceTimeline([]); }} className="absolute top-6 right-6 text-tea-text-sec hover:text-tea-text transition-colors">
                    <X size={24} />
                </button>

                <div className="mb-8">
                    <h3 className="text-2xl font-serif text-tea-text mb-1">Invoice Details</h3>
                    <p className="text-tea-text-sec text-sm num">{viewingInvoice.invoice_number}</p>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-text-sec">Customer</span>
                        <button
                          onClick={() => { setViewingInvoice(null); navigate(`/admin/customers?search=${encodeURIComponent(viewingInvoice.customer_name || '')}`); }}
                          className="text-tea-text font-medium hover:text-tea-accent transition-colors"
                        >
                          {viewingInvoice.customer_name}
                        </button>
                    </div>
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-text-sec">Date</span>
                        <span className="text-tea-text font-medium">{new Date(viewingInvoice.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-text-sec">Status</span>
                        <span className={`font-medium ${viewingInvoice.status === 'Void' ? 'text-tea-text-sec' : viewingInvoice.status === 'Pending' ? 'text-tea-accent' : 'text-tea-text'}`}>{viewingInvoice.status}</span>
                    </div>
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-text-sec">Inventory Deducted</span>
                        <span className={`font-medium ${viewingInvoice.inventory_deducted ? 'text-tea-text' : 'text-tea-accent'}`}>{viewingInvoice.inventory_deducted ? 'Yes' : 'No'}</span>
                    </div>
                </div>

                {/* Notes */}
                {viewingInvoice.notes && (
                  <div className="bg-tea-surface border border-tea-border rounded-xl p-4 mb-6">
                    <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec mb-2">Notes</h4>
                    <p className="text-sm text-tea-text whitespace-pre-wrap">{viewingInvoice.notes}</p>
                  </div>
                )}

                <div className="bg-tea-surface border border-tea-border rounded-xl p-6 mb-8">
                    <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec mb-4">Items</h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                        {viewingInvoice.items?.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm items-center">
                                <div>
                                    <button
                                      onClick={() => { setViewingInvoice(null); navigate(`/admin/catalog?search=${encodeURIComponent(item.given_name || item.product_name || '')}`); }}
                                      className="text-tea-text font-medium hover:text-tea-accent transition-colors text-left"
                                    >
                                      {item.given_name || 'Unknown Item'}
                                    </button>
                                    <div className="text-[10px] text-tea-text-sec">{item.product_name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-tea-text num">{item.quantity}g/u</div>
                                    <div className="text-tea-text-sec text-xs num">@ {item.price_at_sale} USD</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-end text-lg font-bold text-tea-text border-t border-tea-border pt-6">
                    <span className="text-sm font-normal text-tea-text-sec">Total (Shipping included)</span>
                    <span className="font-serif text-2xl text-tea-accent">
                      ${((viewingInvoice.items || []).reduce((sum: number, item: any) => sum + (item.quantity * item.price_at_sale), 0) + (Number(viewingInvoice.shipping_cost_usd) || 0)).toFixed(2)} USD
                    </span>
                </div>

                {/* Timeline */}
                {invoiceTimeline.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-tea-border">
                    <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec mb-4">Activity</h4>
                    <div className="space-y-3">
                      {invoiceTimeline.map((log: any, i: number) => (
                        <div key={log.id || i} className="flex items-start gap-3">
                          <div className="relative flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-tea-gold/60 mt-1.5" />
                            {i < invoiceTimeline.length - 1 && <div className="w-px flex-1 bg-tea-border mt-1" />}
                          </div>
                          <div className="pb-3">
                            <div className="text-xs text-tea-accent font-mono uppercase">{log.action}</div>
                            <div className="text-xs text-tea-text-sec">{log.details}</div>
                            <div className="text-[10px] text-tea-text-sec/50 mt-0.5">
                              {new Date(log.created_at).toLocaleString()}
                              {log.user_email && ` · ${log.user_email}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingInvoice.status === 'Pending' && (
                     <div className="mt-8 pt-6 border-t border-tea-border">
                        <button
                            onClick={() => { setViewingInvoice(null); openFulfillConfirm(viewingInvoice); }}
                            className="w-full py-4 bg-tea-accent hover:bg-tea-accent/90 text-tea-bg font-bold uppercase tracking-[0.2em] text-xs rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-tea-accent/10"
                        >
                            <PackageCheck size={18} /> Confirm Order & Deduct Stock
                        </button>
                     </div>
                )}
            </div>
        </div>
      )}

      {/* CONFIRM MODAL */}
      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={handleConfirmAction}
        isLoading={confirmLoading}
        title={
          confirmState?.type === 'fulfill' ? `Fulfill ${confirmState.invoice?.invoice_number}?`
          : confirmState?.type === 'void' ? `Void ${confirmState?.invoice?.invoice_number}?`
          : `Delete ${confirmState?.invoice?.invoice_number}?`
        }
        description={
          confirmState?.type === 'fulfill' ? 'This will deduct stock from inventory for all items in this order.'
          : confirmState?.type === 'void' ? `This will mark the invoice as void.${confirmState?.invoice?.inventory_deducted ? ' Stock will be restored.' : ''}`
          : 'This will soft-delete this voided invoice. It can be recovered later.'
        }
        confirmLabel={
          confirmState?.type === 'fulfill' ? 'Fulfill & Deduct Stock'
          : confirmState?.type === 'void' ? 'Void Order'
          : 'Delete'
        }
        variant={confirmState?.type === 'fulfill' ? 'default' : 'destructive'}
      >
        {/* Stock Impact Preview for Fulfillment */}
        {confirmState?.type === 'fulfill' && confirmState.stockImpact && (
          <div className="bg-tea-surface border border-tea-border rounded-xl p-4">
            <h4 className="text-[10px] uppercase tracking-[0.2em] text-tea-text-sec mb-3">Stock Impact</h4>
            <div className="space-y-2">
              {confirmState.stockImpact.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-tea-text truncate mr-2">{item.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="num text-tea-text-sec">{item.current}g</span>
                    <span className="text-tea-text-sec">→</span>
                    <span className={`num font-medium ${item.after <= 0 ? 'text-tea-gold' : 'text-tea-text'}`}>
                      {item.after}g
                    </span>
                    {item.after <= 0 && <span className="text-[9px] text-tea-gold">(archive)</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ConfirmModal>

      {/* SPLIT ORDER MODAL */}
      <SplitOrderModal
        isOpen={!!splitInvoice}
        onClose={() => setSplitInvoice(null)}
        onSuccess={() => { refetch(); }}
        invoice={splitInvoice}
        showToast={showToast}
      />

      {/* EDIT ORDER MODAL */}
      <EditOrderModal
        isOpen={!!editInvoice}
        onClose={() => setEditInvoice(null)}
        onSuccess={() => { refetch(); }}
        invoice={editInvoice}
        showToast={showToast}
      />
    </div>
  );
};

// Mobile overflow menu for secondary actions
const MobileActions: React.FC<{
  isPending: boolean;
  isVoid: boolean;
  onEdit: () => void;
  onSplit: () => void;
  onVoid: () => void;
  onDelete: () => void;
}> = ({ isPending, isVoid, onEdit, onSplit, onVoid, onDelete }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors">
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 bg-tea-surface border border-tea-border rounded-lg shadow-2xl z-50 min-w-[140px] py-1 max-h-[min(240px,40vh)] overflow-y-auto">
            {isPending && (
              <>
                <button onClick={() => { setOpen(false); onEdit(); }} className="w-full text-left px-3 py-2 text-xs hover:bg-tea-elevated/50 flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors">
                  <Pencil size={12} /> Edit
                </button>
                <button onClick={() => { setOpen(false); onSplit(); }} className="w-full text-left px-3 py-2 text-xs hover:bg-tea-elevated/50 flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors">
                  <Scissors size={12} /> Split Order
                </button>
              </>
            )}
            {!isVoid && (
              <button onClick={() => { setOpen(false); onVoid(); }} className="w-full text-left px-3 py-2 text-xs hover:bg-tea-elevated/50 flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors">
                <XCircle size={12} /> Void
              </button>
            )}
            {isVoid && (
              <button onClick={() => { setOpen(false); onDelete(); }} className="w-full text-left px-3 py-2 text-xs hover:bg-tea-elevated/50 flex items-center gap-2 text-tea-text-sec hover:text-tea-text transition-colors">
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
