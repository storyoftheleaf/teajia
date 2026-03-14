import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { Loader2, Search, XCircle, Trash2, Eye, X, PackageCheck, Users, History } from 'lucide-react';
import { useRates } from '../hooks/useAdminData';
import { useToast } from './Toast';

const ROW_HEIGHT = 36;

export const OrdersView = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const { data: rates = [] } = useRates();

  const [pageSize, setPageSize] = useState(50);
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', pageSize],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      return await api.invoices.list(pageSize);
    }
  });

  const handleView = async (invoice: any) => {
    try {
      const items = await api.invoices.getItems(invoice.id);
      setViewingInvoice({ ...invoice, items });
    } catch {
      showToast("Could not load invoice details.", 'error');
    }
  };

  const handleFulfill = async (id: string, invoiceNumber: string) => {
    if (!confirm(`Mark ${invoiceNumber} as FILLED?\n\nThis will deduct stock from the inventory.`)) return;
    try {
      await api.rpc.fulfillInvoice(id);
      refetch();
    } catch (err: any) {
      showToast("Fulfillment failed: " + err.message, 'error');
    }
  };

  const handleVoid = async (id: string, invoiceNumber: string) => {
    if (!confirm(`Are you sure you want to VOID invoice ${invoiceNumber}? This will attempt to restore inventory (if it was deducted).`)) return;
    try {
      const invoice = orders.find((o: any) => o.id === id);
      if (invoice?.inventory_deducted) {
        const items = await api.invoices.getItems(id);
        for (const item of items) {
          await api.rpc.incrementStock(item.product_id, item.quantity);
        }
      }
      await api.invoices.update(id, { status: 'Void', inventory_deducted: 0 });
      refetch();
    } catch (err: any) {
      showToast("Void failed: " + err.message, 'error');
    }
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
      if (!confirm(`Permanently DELETE invoice ${invoiceNumber}? \n\nUse this only for cleaning up invalid records.`)) return;
      try {
        await api.invoices.delete(id);
        refetch();
      } catch (err: any) {
        showToast("Delete failed: " + err.message, 'error');
      }
  };

  const filteredOrders = orders.filter((o: any) =>
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) ||
    o.invoice_number?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="p-12 text-center text-tea-text-sec font-serif italic"><Loader2 className="animate-spin inline" /></div>;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-tea-bg">

      {/* Header */}
      <div className="sticky top-0 z-30 bg-tea-bg/90 backdrop-blur-md border-b border-tea-border py-2.5">
        <div className="px-6 max-w-7xl mx-auto flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <History size={16} className="text-tea-accent" />
            <h2 className="text-sm font-serif text-tea-text uppercase tracking-[0.15em]">
              Orders
            </h2>
            <span className="text-tea-text-sec text-xs tracking-wide">
              — {filteredOrders.length} records
            </span>
          </div>

          <div className="relative w-48 ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-b border-tea-border rounded-none pl-9 pr-3 py-1.5 text-xs text-tea-text outline-none focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
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
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[24%]" />
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
                  <tr><td colSpan={6} className="text-center py-16 text-tea-text-sec font-serif italic">No orders found.</td></tr>
              ) : (
                  filteredOrders.map((order: any) => {
                    const isPending = order.status === 'Pending';
                    const isVoid = order.status === 'Void';

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
                          <span className="num text-xs text-tea-text">{order.display_currency} {order.shipping_cost_usd != null ? `(+$${Number(order.shipping_cost_usd).toFixed(0)} ship)` : ''}</span>
                        </td>
                        <td className="px-4 align-middle text-center">
                          <span className={`badge-status ${
                            isVoid ? 'badge-status-muted' :
                            isPending ? 'badge-status-gold' :
                            'badge-status-default'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-4 align-middle">
                          <div className="flex justify-center gap-1">
                            {isPending && (
                                <button
                                    onClick={() => handleFulfill(order.id, order.invoice_number)}
                                    className="pill-action"
                                    title="Mark as Filled (Deduct Stock)"
                                >
                                    <PackageCheck size={12} /> FILL
                                </button>
                            )}
                            <button onClick={() => handleView(order)} className="p-1 text-tea-text-sec hover:text-tea-text transition-colors" title="View Details">
                               <Eye size={14} />
                            </button>
                            {!isVoid && (
                                <button onClick={() => handleVoid(order.id, order.invoice_number)} className="p-1 text-tea-text-sec hover:text-tea-text-sec/80 transition-colors" title="Void Order">
                                   <XCircle size={14} />
                                </button>
                            )}
                            <button onClick={() => handleDelete(order.id, order.invoice_number)} className="p-1 text-tea-text-sec hover:text-tea-text-sec/80 transition-colors" title="Delete Record">
                               <Trash2 size={14} />
                            </button>
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
            <div className="text-center py-16 text-tea-text-sec font-serif italic">No orders found.</div>
          ) : (
            filteredOrders.map((order: any, idx: number) => {
              const isPending = order.status === 'Pending';
              const isVoid = order.status === 'Void';

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
                    <span className={`badge-status ${
                      isVoid ? 'badge-status-muted' :
                      isPending ? 'badge-status-gold' :
                      'badge-status-default'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-tea-border">
                    <span className="text-xs text-tea-text num">{order.display_currency}</span>
                    <div className="flex-1" />
                    {isPending && (
                      <button onClick={() => handleFulfill(order.id, order.invoice_number)} className="pill-action">
                        <PackageCheck size={12} /> FILL
                      </button>
                    )}
                    <button onClick={() => handleView(order)} className="p-1 text-tea-text-sec hover:text-tea-text transition-colors"><Eye size={14} /></button>
                    {!isVoid && (
                      <button onClick={() => handleVoid(order.id, order.invoice_number)} className="p-1 text-tea-text-sec hover:text-tea-text-sec/80 transition-colors"><XCircle size={14} /></button>
                    )}
                    <button onClick={() => handleDelete(order.id, order.invoice_number)} className="p-1 text-tea-text-sec hover:text-tea-text-sec/80 transition-colors"><Trash2 size={14} /></button>
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
            <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-lg p-8 shadow-2xl relative">
                <button onClick={() => setViewingInvoice(null)} className="absolute top-6 right-6 text-tea-text-sec hover:text-tea-text transition-colors">
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

                <div className="bg-tea-surface border border-tea-border rounded-xl p-6 mb-8">
                    <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec mb-4">Items</h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                        {viewingInvoice.items?.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm items-center">
                                <div>
                                    <div className="text-tea-text font-medium">{item.products?.given_name || 'Unknown Item'}</div>
                                    <div className="text-[10px] text-tea-text-sec">{item.products?.product_name}</div>
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

                {viewingInvoice.status === 'Pending' && (
                     <div className="mt-8 pt-6 border-t border-tea-border">
                        <button
                            onClick={() => { handleFulfill(viewingInvoice.id, viewingInvoice.invoice_number); setViewingInvoice(null); }}
                            className="w-full py-4 bg-tea-accent hover:bg-tea-accent/90 text-tea-bg font-bold uppercase tracking-[0.2em] text-xs rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-tea-accent/10"
                        >
                            <PackageCheck size={18} /> Confirm Order & Deduct Stock
                        </button>
                     </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};
