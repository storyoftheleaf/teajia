import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Loader2, Search, XCircle, Trash2, Eye, X, CheckSquare, PackageCheck, Users } from 'lucide-react';
import { useRates } from '../hooks/useAdminData';
import { useToast } from './Toast';

export const OrdersView = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const { data: rates = [] } = useRates();

  const [pageSize, setPageSize] = useState(50);
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', pageSize],
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
      // Check if this invoice had inventory deducted by looking at current orders data
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

  if (isLoading) return <div className="p-12 text-center text-tea-text-dim flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-tea-border pb-6">
         <div>
            <h2 className="text-2xl font-serif text-tea-text">Order Management</h2>
            <p className="text-tea-text-dim text-sm mt-1">Fulfill pending orders and track history.</p>
         </div>
         <div className="relative w-full md:w-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-text-dim" size={16} />
            <input 
              type="text" 
              placeholder="Search orders..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-tea-surface border border-tea-border rounded-lg pl-10 pr-4 py-2 text-sm text-tea-text outline-none focus:border-tea-text-dim transition-colors"
            />
         </div>
      </div>

      <div className="hidden md:block overflow-x-auto border border-tea-border rounded-xl bg-tea-surface">
        <table className="w-full text-left text-sm">
           <thead className="bg-tea-bg text-tea-text-dim font-medium uppercase text-xs tracking-[0.2em] border-b border-tea-border">
             <tr>
               <th className="p-4">Date</th>
               <th className="p-4">Invoice #</th>
               <th className="p-4">Customer</th>
               <th className="p-4 text-right">Total</th>
               <th className="p-4 text-center">Status</th>
               <th className="p-4 text-center">Actions</th>
             </tr>
           </thead>
           <tbody className="divide-y divide-tea-border">
             {filteredOrders.length === 0 ? (
                 <tr><td colSpan={6} className="p-8 text-center text-tea-text-dim">No orders found.</td></tr>
             ) : (
                 filteredOrders.map((order: any) => {
                    const isPending = order.status === 'Pending';
                    const isVoid = order.status === 'Void';
                    const isFilled = order.status === 'Filled' || order.status === 'Completed';

                    return (
                     <tr key={order.id} className="hover:bg-tea-bg/50 group transition-colors">
                       <td className="p-4 text-tea-text-dim">{new Date(order.created_at).toLocaleDateString()}</td>
                       <td className="p-4 num text-tea-text group-hover:text-tea-accent cursor-pointer transition-colors" onClick={() => handleView(order)}>{order.invoice_number}</td>
                       <td className="p-4">
                         <button
                           onClick={() => navigate(`/admin/customers?search=${encodeURIComponent(order.customer_name || '')}`)}
                           className="text-tea-text hover:text-tea-accent transition-colors flex items-center gap-1.5 group/cust"
                           title="View customer profile"
                         >
                           <Users size={12} className="opacity-0 group-hover/cust:opacity-100 transition-opacity text-tea-text-dim" />
                           {order.customer_name}
                         </button>
                       </td>
                       <td className="p-4 text-right text-tea-text num">
                           {order.display_currency} {order.shipping_cost_usd != null ? `(+$${Number(order.shipping_cost_usd).toFixed(0)} ship)` : ''}
                       </td>
                       <td className="p-4 text-center">
                         <span className={`text-xs px-2 py-1 rounded border font-medium uppercase tracking-wider ${
                            isVoid ? 'border-tea-text-dim/50 text-tea-text-dim bg-tea-text-dim/10' :
                            isPending ? 'border-tea-accent/50 text-tea-accent bg-tea-accent/10' :
                            'border-tea-text/50 text-tea-text bg-tea-text/10'
                         }`}>
                           {order.status}
                         </span>
                       </td>
                       <td className="p-4 text-center flex justify-center gap-2">
                         {isPending && (
                             <button 
                                onClick={() => handleFulfill(order.id, order.invoice_number)}
                                className="px-3 py-1 bg-tea-accent/10 text-tea-accent border border-tea-accent/30 rounded-lg hover:bg-tea-accent/20 text-xs font-bold flex items-center gap-1 transition-colors"
                                title="Mark as Filled (Deduct Stock)"
                             >
                                <PackageCheck size={14} /> FILL
                             </button>
                         )}
                         
                         <button
                             onClick={() => handleView(order)}
                             className="p-2.5 text-tea-text-dim hover:text-tea-text transition-colors"
                             title="View Details"
                         >
                            <Eye size={16} />
                         </button>

                         {!isVoid && (
                             <button
                                onClick={() => handleVoid(order.id, order.invoice_number)}
                                className="p-2.5 text-tea-text-dim hover:text-tea-text-dim/80 transition-colors"
                                title="Void Order"
                             >
                                <XCircle size={16} />
                             </button>
                         )}
                         <button
                             onClick={() => handleDelete(order.id, order.invoice_number)}
                             className="p-2.5 text-tea-text-dim hover:text-tea-text-dim/80 transition-colors"
                             title="Delete Record"
                         >
                            <Trash2 size={16} />
                         </button>
                       </td>
                     </tr>
                    );
                 })
             )}
           </tbody>
        </table>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="md:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-tea-text-dim border border-tea-border rounded-xl bg-tea-surface">No orders found.</div>
        ) : (
          filteredOrders.map((order: any) => {
            const isPending = order.status === 'Pending';
            const isVoid = order.status === 'Void';
            const isFilled = order.status === 'Filled' || order.status === 'Completed';

            return (
              <div key={order.id} className="border border-tea-border rounded-xl bg-tea-surface p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-tea-text-dim">{new Date(order.created_at).toLocaleDateString()}</span>
                  <span className="text-sm text-tea-text num cursor-pointer hover:text-tea-accent transition-colors" onClick={() => handleView(order)}>{order.invoice_number}</span>
                </div>
                <div className="text-tea-text font-medium">{order.customer_name}</div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-tea-text num">{order.display_currency} {order.shipping_cost_usd != null ? `(+$${Number(order.shipping_cost_usd).toFixed(0)} ship)` : ''}</span>
                  <span className={`text-xs px-2 py-1 rounded border font-medium uppercase tracking-wider ${
                    isVoid ? 'border-tea-text-dim/50 text-tea-text-dim bg-tea-text-dim/10' :
                    isPending ? 'border-tea-accent/50 text-tea-accent bg-tea-accent/10' :
                    'border-tea-text/50 text-tea-text bg-tea-text/10'
                  }`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-tea-border">
                  {isPending && (
                    <button
                      onClick={() => handleFulfill(order.id, order.invoice_number)}
                      className="px-3 py-1.5 bg-tea-accent/10 text-tea-accent border border-tea-accent/30 rounded-lg hover:bg-tea-accent/20 text-xs font-bold flex items-center gap-1 transition-colors"
                      title="Mark as Filled (Deduct Stock)"
                    >
                      <PackageCheck size={14} /> FILL
                    </button>
                  )}
                  <div className="flex-1" />
                  <button onClick={() => handleView(order)} className="p-2.5 text-tea-text-dim hover:text-tea-text transition-colors" title="View Details">
                    <Eye size={16} />
                  </button>
                  {!isVoid && (
                    <button onClick={() => handleVoid(order.id, order.invoice_number)} className="p-2.5 text-tea-text-dim hover:text-tea-text-dim/80 transition-colors" title="Void Order">
                      <XCircle size={16} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(order.id, order.invoice_number)} className="p-2.5 text-tea-text-dim hover:text-tea-text-dim/80 transition-colors" title="Delete Record">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {orders.length >= pageSize && (
        <div className="text-center pt-4">
          <button
            onClick={() => setPageSize(prev => prev + 50)}
            className="text-xs text-tea-text-dim hover:text-tea-text uppercase tracking-[0.2em] border border-tea-border px-4 py-2 rounded-lg hover:bg-tea-surface transition-colors"
          >
            Load More
          </button>
        </div>
      )}

      {/* INVOICE DETAILS MODAL */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-lg p-8 shadow-2xl relative">
                <button onClick={() => setViewingInvoice(null)} className="absolute top-6 right-6 text-tea-text-dim hover:text-tea-text transition-colors">
                    <X size={24} />
                </button>
                
                <div className="mb-8">
                    <h3 className="text-2xl font-serif text-tea-text mb-1">Invoice Details</h3>
                    <p className="text-tea-text-dim text-sm num">{viewingInvoice.invoice_number}</p>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-text-dim">Customer</span>
                        <button
                          onClick={() => { setViewingInvoice(null); navigate(`/admin/customers?search=${encodeURIComponent(viewingInvoice.customer_name || '')}`); }}
                          className="text-tea-text font-medium hover:text-tea-accent transition-colors"
                        >
                          {viewingInvoice.customer_name}
                        </button>
                    </div>
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-text-dim">Date</span>
                        <span className="text-tea-text font-medium">{new Date(viewingInvoice.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-text-dim">Status</span>
                        <span className={`font-medium ${viewingInvoice.status === 'Void' ? 'text-tea-text-dim' : viewingInvoice.status === 'Pending' ? 'text-tea-accent' : 'text-tea-text'}`}>{viewingInvoice.status}</span>
                    </div>
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-text-dim">Inventory Deducted</span>
                        <span className={`font-medium ${viewingInvoice.inventory_deducted ? 'text-tea-text' : 'text-tea-accent'}`}>{viewingInvoice.inventory_deducted ? 'Yes' : 'No'}</span>
                    </div>
                </div>

                <div className="bg-tea-surface border border-tea-border rounded-xl p-6 mb-8">
                    <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-dim mb-4">Items</h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                        {viewingInvoice.items?.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm items-center">
                                <div>
                                    <div className="text-tea-text font-medium">{item.products?.given_name || 'Unknown Item'}</div>
                                    <div className="text-[10px] text-tea-text-dim">{item.products?.product_name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-tea-text num">{item.quantity}g/u</div>
                                    <div className="text-tea-text-dim text-xs num">@ {item.price_at_sale} USD</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-end text-lg font-bold text-tea-text border-t border-tea-border pt-6">
                    <span className="text-sm font-normal text-tea-text-dim">Total (Shipping included)</span>
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
