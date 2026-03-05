import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Loader2, Search, XCircle, Trash2, Eye, X, CheckSquare, PackageCheck } from 'lucide-react';
import { useRates } from '../hooks/useSupabase';
import { useToast } from './Toast';

export const OrdersView = () => {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const { data: rates = [] } = useRates();

  const [pageSize, setPageSize] = useState(50);
  const { data: orders = [], isLoading, refetch } = useQuery({
    queryKey: ['orders', pageSize],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(pageSize);

      if (error) throw error;
      return data;
    }
  });

  const handleView = async (invoice: any) => {
    // Fetch line items for this invoice
    const { data: items, error } = await supabase
      .from('invoice_line_items')
      .select('*, products(given_name, product_name)')
      .eq('invoice_id', invoice.id);

    if (error) {
        showToast("Could not load invoice details.", 'error');
        return;
    }
    setViewingInvoice({ ...invoice, items });
  };

  const handleFulfill = async (id: string, invoiceNumber: string) => {
    if (!confirm(`Mark ${invoiceNumber} as FILLED?\n\nThis will deduct stock from the inventory.`)) return;
    
    // Call RPC function to fulfill
    const { error } = await supabase.rpc('fulfill_invoice', { invoice_id_input: id });

    if (error) {
        showToast("Fulfillment failed: " + error.message, 'error');
    } else {
        refetch();
    }
  };

  const handleVoid = async (id: string, invoiceNumber: string) => {
    if (!confirm(`Are you sure you want to VOID invoice ${invoiceNumber}? This will attempt to restore inventory (if it was deducted).`)) return;

    // Check if this invoice had inventory deducted
    const { data: invoice } = await supabase.from('invoices').select('inventory_deducted').eq('id', id).single();

    if (invoice?.inventory_deducted) {
      // Restore inventory: fetch line items and add stock back
      const { data: items } = await supabase.from('invoice_line_items').select('product_id, quantity').eq('invoice_id', id);
      if (items) {
        for (const item of items) {
          await supabase.rpc('increment_stock', { product_id_input: item.product_id, amount: item.quantity });
        }
      }
    }

    const { error } = await supabase.from('invoices').update({ status: 'Void', inventory_deducted: false }).eq('id', id);

    if (error) {
        showToast("Void failed: " + error.message, 'error');
    } else {
        refetch();
    }
  };

  const handleDelete = async (id: string, invoiceNumber: string) => {
      if (!confirm(`Permanently DELETE invoice ${invoiceNumber}? \n\nUse this only for cleaning up invalid records.`)) return;

      // Delete line items first manually to be safe (if cascade isn't set up)
      await supabase.from('invoice_line_items').delete().eq('invoice_id', id);
      
      const { error } = await supabase.from('invoices').delete().eq('id', id);

      if (error) {
          showToast("Delete failed: " + error.message, 'error');
      } else {
          refetch();
      }
  };

  const filteredOrders = orders.filter((o: any) => 
    o.customer_name?.toLowerCase().includes(search.toLowerCase()) || 
    o.invoice_number?.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="p-12 text-center text-tea-muted flex justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-tea-border pb-6">
         <div>
            <h2 className="text-2xl font-serif text-tea-text">Order Management</h2>
            <p className="text-tea-muted text-sm mt-1">Fulfill pending orders and track history.</p>
         </div>
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-tea-muted" size={16} />
            <input 
              type="text" 
              placeholder="Search orders..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-tea-surface border border-tea-border rounded-lg pl-10 pr-4 py-2 text-sm text-tea-text outline-none focus:border-tea-muted transition-colors"
            />
         </div>
      </div>

      <div className="overflow-x-auto border border-tea-border rounded-xl bg-tea-surface">
        <table className="w-full text-left text-sm">
           <thead className="bg-tea-bg text-tea-muted font-medium uppercase text-xs tracking-[0.2em] border-b border-tea-border">
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
                 <tr><td colSpan={6} className="p-8 text-center text-tea-muted">No orders found.</td></tr>
             ) : (
                 filteredOrders.map((order: any) => {
                    const isPending = order.status === 'Pending';
                    const isVoid = order.status === 'Void';
                    const isFilled = order.status === 'Filled' || order.status === 'Completed';

                    return (
                     <tr key={order.id} className="hover:bg-tea-bg/50 group transition-colors">
                       <td className="p-4 text-tea-muted">{new Date(order.created_at).toLocaleDateString()}</td>
                       <td className="p-4 font-mono text-tea-text group-hover:text-tea-accent cursor-pointer transition-colors" onClick={() => handleView(order)}>{order.invoice_number}</td>
                       <td className="p-4 text-tea-text">{order.customer_name}</td>
                       <td className="p-4 text-right text-tea-text font-mono">
                           {order.display_currency} {order.shipping_cost_usd != null ? `(+$${Number(order.shipping_cost_usd).toFixed(0)} ship)` : ''}
                       </td>
                       <td className="p-4 text-center">
                         <span className={`text-xs px-2 py-1 rounded border font-medium uppercase tracking-wider ${
                            isVoid ? 'border-tea-muted/50 text-tea-muted bg-tea-muted/10' :
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
                             className="p-2 text-tea-muted hover:text-tea-text transition-colors"
                             title="View Details"
                         >
                            <Eye size={16} />
                         </button>
                         
                         {!isVoid && (
                             <button 
                                onClick={() => handleVoid(order.id, order.invoice_number)}
                                className="p-2 text-tea-muted hover:text-tea-muted/80 transition-colors"
                                title="Void Order"
                             >
                                <XCircle size={16} />
                             </button>
                         )}
                         <button 
                             onClick={() => handleDelete(order.id, order.invoice_number)}
                             className="p-2 text-tea-muted hover:text-tea-muted/80 transition-colors"
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

      {orders.length >= pageSize && (
        <div className="text-center pt-4">
          <button
            onClick={() => setPageSize(prev => prev + 50)}
            className="text-xs text-tea-muted hover:text-tea-text uppercase tracking-[0.2em] border border-tea-border px-4 py-2 rounded-lg hover:bg-tea-surface transition-colors"
          >
            Load More
          </button>
        </div>
      )}

      {/* INVOICE DETAILS MODAL */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-tea-bg border border-tea-border rounded-2xl w-full max-w-lg p-8 shadow-2xl relative">
                <button onClick={() => setViewingInvoice(null)} className="absolute top-6 right-6 text-tea-muted hover:text-tea-text transition-colors">
                    <X size={24} />
                </button>
                
                <div className="mb-8">
                    <h3 className="text-2xl font-serif text-tea-text mb-1">Invoice Details</h3>
                    <p className="text-tea-muted text-sm font-mono">{viewingInvoice.invoice_number}</p>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-muted">Customer</span>
                        <span className="text-tea-text font-medium">{viewingInvoice.customer_name}</span>
                    </div>
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-muted">Date</span>
                        <span className="text-tea-text font-medium">{new Date(viewingInvoice.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-muted">Status</span>
                        <span className={`font-medium ${viewingInvoice.status === 'Void' ? 'text-tea-muted' : viewingInvoice.status === 'Pending' ? 'text-tea-accent' : 'text-tea-text'}`}>{viewingInvoice.status}</span>
                    </div>
                    <div className="flex justify-between border-b border-tea-border pb-3">
                        <span className="text-tea-muted">Inventory Deducted</span>
                        <span className={`font-medium ${viewingInvoice.inventory_deducted ? 'text-tea-text' : 'text-tea-accent'}`}>{viewingInvoice.inventory_deducted ? 'Yes' : 'No'}</span>
                    </div>
                </div>

                <div className="bg-tea-surface border border-tea-border rounded-xl p-6 mb-8">
                    <h4 className="text-xs uppercase tracking-[0.2em] text-tea-muted mb-4">Items</h4>
                    <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                        {viewingInvoice.items?.map((item: any, i: number) => (
                            <div key={i} className="flex justify-between text-sm items-center">
                                <div>
                                    <div className="text-tea-text font-medium">{item.products?.given_name || 'Unknown Item'}</div>
                                    <div className="text-[10px] text-tea-muted">{item.products?.product_name}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-tea-text font-mono">{item.quantity}g/u</div>
                                    <div className="text-tea-muted text-xs font-mono">@ {item.price_at_sale} USD</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-end text-lg font-bold text-tea-text border-t border-tea-border pt-6">
                    <span className="text-sm font-normal text-tea-muted">Total (Shipping included)</span>
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
