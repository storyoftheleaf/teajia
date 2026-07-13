import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import type { InvoiceWithItems, Product } from '../types';
import { openWhatsAppStatus, buildQuickInvoiceDraftParam } from '../../lib/whatsapp';
import { Loader2, Search, XCircle, Trash2, Eye, X, PackageCheck, Users, Scissors, Pencil, Package, MoreHorizontal, MessageCircle, Plus, Link2, StickyNote, Leaf, Check } from 'lucide-react';
import Fuse from 'fuse.js';
import { useProducts } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';
import { SplitOrderModal } from './SplitOrderModal';
import { EditOrderModal } from './EditOrderModal';
import { QuickInvoiceModal } from './QuickInvoiceModal';
import { Button } from '../../components/shared/Button';

const ROW_HEIGHT = 36;

type StatusFilter = 'all' | 'Draft' | 'Pending' | 'Filled' | 'Void';
type QuickInvoiceUrlPrefill = React.ComponentProps<typeof QuickInvoiceModal>['prefill'];

const VALID_DRAFT_CURRENCIES = new Set(['USD', 'NT', 'Yuan', 'IDR', 'JPY', 'MYR', 'HKD', 'AUD']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function decodeBase64UrlJson(value: string): unknown {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function parseQuickInvoiceDraft(value: string | null): QuickInvoiceUrlPrefill | null {
  if (!value) return null;
  try {
    const draft = decodeBase64UrlJson(value);
    if (!isRecord(draft)) return null;
    const items = Array.isArray(draft.items)
      ? draft.items
        .filter(isRecord)
        .map((item) => ({
          name: typeof item.name === 'string' ? item.name : 'Item',
          productId: typeof item.productId === 'string' ? item.productId : undefined,
          quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
          unit: item.unit === 'pcs' ? 'pcs' as const : 'g' as const,
          price: typeof item.price === 'number' ? item.price : undefined,
        }))
      : undefined;
    const currency = typeof draft.currency === 'string' && VALID_DRAFT_CURRENCIES.has(draft.currency)
      ? draft.currency as QuickInvoiceUrlPrefill extends { currency?: infer C } ? C : never
      : undefined;
    return {
      customerName: typeof draft.customerName === 'string' ? draft.customerName : undefined,
      vendorName: typeof draft.vendorName === 'string' ? draft.vendorName : undefined,
      currency,
      shipping: typeof draft.shipping === 'number' ? draft.shipping : undefined,
      notes: typeof draft.notes === 'string' ? draft.notes : undefined,
      items,
    };
  } catch {
    return null;
  }
}

function paymentLabel(order: Pick<DbOrder, 'payment_status' | 'payment_method'>): string {
  const status = order.payment_status || 'unpaid';
  if (status === 'paid') return order.payment_method ? `Paid · ${order.payment_method}` : 'Paid';
  if (status === 'partial') return 'Partial';
  return 'Unpaid';
}

function stockLabel(order: Pick<DbOrder, 'inventory_deducted' | 'status'>): string {
  if (order.status === 'Void') return 'Void';
  return order.inventory_deducted ? 'Stock gone' : 'Stock pending';
}

/** DB row shape returned by GET /api/invoices — extends InvoiceWithItems with computed fields */
interface DbOrder extends InvoiceWithItems {
  computed_total?: number;
  items?: DbOrderItem[];
}

/** DB row shape for individual invoice line items */
interface DbOrderItem {
  id?: string;
  product_id?: string;
  given_name?: string;
  product_name?: string;
  custom_name?: string | null;
  quantity: number;
  price_at_sale: number;
  product?: Pick<Product, 'givenName' | 'type'>;
}

/** Activity log entry for the invoice timeline */
interface ActivityLogEntry {
  id?: string;
  action: string;
  details?: string;
  user_email?: string;
  created_at: string;
}

export const OrdersView = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [viewingInvoice, setViewingInvoice] = useState<DbOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { data: products = [] } = useProducts();

  // Confirm modal state
  const [confirmState, setConfirmState] = useState<{
    type: 'fulfill' | 'void' | 'delete';
    invoice: DbOrder;
    stockImpact?: { name: string; current: number; after: number }[];
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Split & Edit modal state
  const [splitInvoice, setSplitInvoice] = useState<DbOrder | null>(null);
  const [editInvoice, setEditInvoice] = useState<DbOrder | null>(null);

  // Quick Invoice + link-later state
  const [showQuickInvoice, setShowQuickInvoice] = useState(false);
  const [quickInvoicePrefill, setQuickInvoicePrefill] = useState<QuickInvoiceUrlPrefill | null>(null);

  useEffect(() => {
    const draftParam = searchParams.get('draft');
    if (searchParams.get('qi') === '1' || draftParam) {
      const prefill = parseQuickInvoiceDraft(draftParam);
      setQuickInvoicePrefill(prefill);
      if (draftParam && !prefill) showToast('Could not read invoice draft link.', 'error');
      setShowQuickInvoice(true);
      setSearchParams(prev => {
        const n = new URLSearchParams(prev);
        n.delete('qi');
        n.delete('draft');
        return n;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams, showToast]);
  const [linkState, setLinkState] = useState<{ itemIndex: number; query: string } | null>(null);

  const productFuse = useMemo(() => new Fuse(products, {
    keys: ['givenName', 'productName'],
    threshold: 0.35,
    ignoreLocation: true,
  }), [products]);

  const linkSuggestions = useMemo(() => {
    if (!linkState?.query.trim()) return products.filter(p => p.status === 'Active').slice(0, 8);
    return productFuse.search(linkState.query).map(r => r.item).slice(0, 8);
  }, [linkState?.query, productFuse, products]);

  // Timeline state for invoice detail
  const [invoiceTimeline, setInvoiceTimeline] = useState<ActivityLogEntry[]>([]);

  const [pageSize, setPageSize] = useState(50);
  const { data: orders = [], isLoading, refetch } = useQuery<DbOrder[]>({
    queryKey: ['orders', pageSize],
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      return await api.invoices.list(pageSize) as DbOrder[];
    }
  });

  // Pipeline summary
  const summary = useMemo(() => {
    const draft = orders.filter((o) => o.status === 'Draft').length;
    const pending = orders.filter((o) => o.status === 'Pending').length;
    const filled = orders.filter((o) => o.status === 'Filled').length;
    const voided = orders.filter((o) => o.status === 'Void').length;
    const filledTotal = orders
      .filter((o) => o.status === 'Filled')
      .reduce((sum: number, o) => sum + (Number(o.computed_total) || 0) + (Number(o.shipping_cost_usd) || 0), 0);
    return { draft, pending, filled, voided, filledTotal };
  }, [orders]);

  const handleView = async (invoice: DbOrder) => {
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

  // Promote a Draft (e.g. created from a collection recipient's confirmed picks)
  // into a normal Pending order, so it can be edited and fulfilled.
  const acceptDraft = async (invoice: DbOrder) => {
    try {
      await api.invoices.update(invoice.id, { status: 'Pending' });
      setViewingInvoice((prev) => prev ? { ...prev, status: 'Pending' } : null);
      refetch();
      showToast(`Order ${invoice.invoice_number} accepted — ready to review and fulfil.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not accept this draft. Try again.', 'error');
    }
  };

  const openFulfillConfirm = async (invoice: DbOrder) => {
    // Fetch stock impact preview
    try {
      const items = await api.invoices.getItems(invoice.id) as DbOrderItem[];
      const impact = items.map((item) => {
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
        // Offer WhatsApp status notification
        const inv = confirmState.invoice;
        if (inv.customer_phone) {
          const items = (inv.items || []).map((it) => ({
            name: it.product?.givenName || it.product_name || 'Item',
            quantity: it.quantity,
            unit: it.product?.type === 'Teaware' ? 'u' : 'g',
            price: '', total: '',
          }));
          openWhatsAppStatus(inv.customer_phone, {
            status: 'filled',
            ref: inv.invoice_number,
            customerName: inv.customer_name,
            items,
          });
        }
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
      const action = confirmState?.type === 'void' ? 'void order' : confirmState?.type === 'delete' ? 'delete invoice' : 'update order status';
      showToast(`Could not ${action}: ${err.message}`, 'error');
    }
    setConfirmLoading(false);
    setConfirmState(null);
  };

  const handleLinkProduct = async (product: { id: string; givenName?: string; productName?: string }) => {
    if (!viewingInvoice || !linkState) return;
    const targetItem = (viewingInvoice.items || [])[linkState.itemIndex];
    if (!targetItem?.id) return;
    try {
      const result = await api.rpc.linkLineItem(viewingInvoice.id, targetItem.id, product.id);
      const updatedItems = (viewingInvoice.items || []).map((item, idx) => {
        if (idx !== linkState.itemIndex) return item;
        return { ...item, product_id: product.id, given_name: product.givenName, product_name: product.productName, custom_name: null };
      });
      setViewingInvoice((prev) => prev ? { ...prev, items: updatedItems } : null);
      setLinkState(null);
      const msg = result?.inventory_deducted ? 'Item linked & stock deducted.' : 'Item linked to inventory.';
      showToast(msg, 'success');
      queryClient.invalidateQueries({ queryKey: ['products'] });
    } catch (err: any) {
      showToast(`Could not link item to product: ${err.message}`, 'error');
    }
  };

  const filteredOrders = orders.filter((o) => {
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
      <div className="sticky top-0 z-dropdown bg-tea-bg/90 backdrop-blur-md border-b border-tea-border flex-shrink-0">
        {/* Row 1: filter + actions */}
        <div className="px-3 md:px-6 lg:px-10 max-w-5xl mx-auto flex items-center gap-2 md:gap-4 py-2.5 md:h-16 md:py-0">
          {/* Pipeline Summary — segmented filter */}
          <div className="flex items-center bg-tea-surface rounded-xl border border-tea-border p-0.5 overflow-x-auto hide-scrollbar min-w-0">
            {([
              { id: 'all',     label: 'All',     dot: null },
              { id: 'Draft',   label: 'Draft',   dot: 'bg-tea-gold-lt' },
              { id: 'Pending', label: 'Pending', dot: 'bg-amber-400' },
              { id: 'Filled',  label: 'Filled',  dot: 'bg-tea-gold' },
              { id: 'Void',    label: 'Void',    dot: 'bg-tea-text-dim' },
            ] as { id: StatusFilter; label: string; dot: string | null }[]).map(({ id, label, dot }) => {
              const count = id === 'all' ? orders.length
                : id === 'Draft' ? summary.draft
                : id === 'Pending' ? summary.pending
                : id === 'Filled' ? summary.filled
                : summary.voided;
              return (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-ui-10 uppercase tracking-[0.15em] rounded-md whitespace-nowrap transition-colors shrink-0 ${
                    statusFilter === id
                      ? 'bg-tea-bg text-tea-text shadow-sm'
                      : 'text-tea-text-sec hover:text-tea-text'
                  }`}
                >
                  {dot && <span className={`w-1.5 h-1.5 rounded-full ${dot} opacity-70`} />}
                  {label}
                  <span className={`text-ui-9 tabular-nums ${statusFilter === id ? 'text-tea-text-dim' : 'text-tea-text-dim/60'}`}>{count}</span>
                </button>
              );
            })}
          </div>

          {summary.filledTotal > 0 && (
            <span className="text-ui-10 text-tea-text-sec num hidden md:inline shrink-0">
              Revenue: ${summary.filledTotal.toFixed(0)}
            </span>
          )}

          <button
            onClick={() => setShowQuickInvoice(true)}
            className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-ui-10 uppercase tracking-[0.15em] text-tea-text border border-tea-border rounded-xl hover:border-tea-gold/50 hover:text-tea-gold transition-colors"
          >
            <Plus size={11} /> Invoice
          </button>
        </div>

        {/* Row 2 (mobile only): search — separated so it doesn't crowd the filter row */}
        <div className="px-3 pb-2 md:hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-b border-tea-border rounded-none pl-8 pr-3 py-1.5 text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
            />
          </div>
        </div>

        {/* Row 2 (desktop): search inline */}
        <div className="hidden md:block px-6 pb-2.5 -mt-1.5">
          <div className="max-w-5xl mx-auto flex justify-end">
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-b border-tea-border rounded-none pl-9 pr-3 py-1.5 text-xs text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto custom-scrollbar bg-tea-bg md:px-6">

        {/* Desktop table */}
        <div className="w-full max-w-5xl mx-auto bg-tea-surface min-h-full hidden md:block">
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[18%]" />
              <col className="w-[16%]" />
              <col className="w-[14%]" />
              <col className="w-[28%]" />
            </colgroup>
            <thead className="sticky top-0 z-sticky bg-tea-bg">
              <tr>
                <th className="px-4 py-2 border-b border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left">Date</th>
                <th className="px-4 py-2 border-b border-l border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left">Invoice #</th>
                <th className="px-4 py-2 border-b border-l border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left">Customer</th>
                <th className="px-4 py-2 border-b border-l border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-right">Total</th>
                <th className="px-4 py-2 border-b border-l border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left">Status</th>
                <th className="px-4 py-2 border-b border-l border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3 text-tea-text-sec">
                    <Package size={32} strokeWidth={1} className="opacity-40" />
                    <span className="font-serif italic">{search || statusFilter !== 'all' ? 'Nothing matched — try different words.' : 'No orders yet.'}</span>
                    {(search || statusFilter !== 'all') && (
                      <button onClick={() => { setSearch(''); setStatusFilter('all'); }} className="text-xs text-tea-gold hover:text-tea-gold/80 transition-colors">
                        Clear filters
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : (
                filteredOrders.map((order) => {
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
                      <td className="px-4 align-middle overflow-hidden border-l border-tea-border">
                        <span className="num text-xs text-tea-text group-hover:text-tea-gold cursor-pointer transition-colors" onClick={() => handleView(order)}>{order.invoice_number}</span>
                      </td>
                      <td className="px-4 align-middle overflow-hidden border-l border-tea-border">
                        <button
                          onClick={() => order.customer_id
                            ? navigate(`/admin/people/${order.customer_id}`)
                            : navigate(`/admin/people?search=${encodeURIComponent(order.customer_name || '')}`)}
                          className="text-xs text-tea-text hover:text-tea-gold transition-colors flex items-center gap-1.5 group/cust truncate"
                          title="View customer profile"
                        >
                          <Users size={12} className="opacity-0 group-hover/cust:opacity-100 transition-opacity text-tea-text-sec flex-shrink-0" />
                          <span className="truncate">{order.customer_name}</span>
                        </button>
                      </td>
                      <td className="px-4 align-middle overflow-hidden text-right border-l border-tea-border">
                        <div>
                          <span className="num text-xs text-tea-text">${total.toFixed(2)}</span>
                          <span className="text-ui-9 text-tea-text-sec ml-1">{order.display_currency}</span>
                        </div>
                        {Number(order.shipping_cost_usd) > 0 && (
                          <div className="text-ui-9 text-tea-text-sec/60 num">+${Number(order.shipping_cost_usd).toFixed(0)} ship</div>
                        )}
                      </td>
	                      <td className="px-4 align-middle text-left border-l border-tea-border">
	                        <div className="flex items-center justify-start gap-2 min-w-0">
	                          <span className={`badge-status shrink-0 ${
	                            isVoid ? 'badge-status-muted' :
	                            isPending ? 'badge-status-gold' :
                            'badge-status-default'
	                          }`}>
	                            {order.status}
	                          </span>
	                          {!isVoid && (
	                            <span className="text-ui-10 text-tea-text-sec truncate">
	                              <span className={order.payment_status === 'paid' ? 'text-tea-text' : 'text-tea-gold/90'}>
	                                {order.payment_status === 'paid' ? 'paid' : order.payment_status === 'partial' ? 'partial' : 'unpaid'}
	                              </span>
	                              <span className="text-tea-text-dim mx-1">·</span>
	                              <span className={order.inventory_deducted ? 'text-tea-text-sec' : 'text-tea-gold/90'}>
	                                {order.inventory_deducted ? 'stock gone' : 'stock pending'}
	                              </span>
	                            </span>
	                          )}
	                          {isPending && daysAge >= 7 && (
	                            <span className="text-ui-9 text-tea-gold/80 num shrink-0">{daysAge}d</span>
	                          )}
                          {order.notes && (
                            <span className="text-tea-text-dim shrink-0" title={order.notes}><StickyNote size={10} /></span>
                          )}
                          {order.source_event_title && (
                            <button
                              onClick={() => navigate(`/admin/events?search=${encodeURIComponent(order.source_event_title ?? '')}`)}
                              className="text-tea-text-dim hover:text-tea-text-sec transition-colors cursor-pointer shrink-0"
                              title={`Attributed to: ${order.source_event_title}`}
                            ><Leaf size={10} /></button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 align-middle border-l border-tea-border">
                        <div className="flex justify-start gap-1">
                          {isPending && (
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openFulfillConfirm(order)}
                                icon={<PackageCheck size={12} />}
                                title="Mark as Filled (Deduct Stock)"
                              >
                                FILL
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditInvoice(order)}
                                icon={<Pencil size={14} />}
                                title="Edit Order"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSplitInvoice(order)}
                                icon={<Scissors size={14} />}
                                title="Split Order"
                              />
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleView(order)}
                            icon={<Eye size={14} />}
                            title="View Details"
                          />
                          {!isVoid && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmState({ type: 'void', invoice: order })}
                              icon={<XCircle size={14} />}
                              title="Void Order"
                            />
                          )}
                          {isVoid && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmState({ type: 'delete', invoice: order })}
                              icon={<Trash2 size={14} />}
                              title="Delete Record"
                            />
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
        <div className="md:hidden px-3 pt-3 pb-24 space-y-2.5">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-tea-text-sec">
              <Package size={32} strokeWidth={1} className="opacity-40" />
              <span className="font-serif italic">{search || statusFilter !== 'all' ? 'Nothing matched — try different words.' : 'No orders yet.'}</span>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const isPending = order.status === 'Pending';
              const isVoid = order.status === 'Void';
              const total = (Number(order.computed_total) || 0) + (Number(order.shipping_cost_usd) || 0);
              const daysAge = isPending ? getDaysAge(order.created_at) : 0;
              // Left accent stripe colour reflects status at a glance.
              const accent = isPending ? 'bg-tea-gold' : isVoid ? 'bg-tea-text-dim' : 'bg-tea-border';

              return (
                <div
                  key={order.id}
                  className="relative flex bg-tea-surface border border-tea-border rounded-xl overflow-hidden"
                >
                  {/* Status accent stripe */}
                  <span className={`w-1 shrink-0 ${accent}`} aria-hidden />

                  <div className="flex-1 min-w-0 p-4">
                    {/* Headline row: customer name + status */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button
                          onClick={() => order.customer_id
                            ? navigate(`/admin/people/${order.customer_id}`)
                            : navigate(`/admin/people?search=${encodeURIComponent(order.customer_name || '')}`)}
                          className="block text-base font-serif text-tea-text hover:text-tea-gold transition-colors truncate text-left"
                        >
                          {order.customer_name}
                        </button>
                        <div className="flex items-center gap-1.5 mt-0.5 text-ui-11 text-tea-text-sec">
                          <span>{new Date(order.created_at).toLocaleDateString()}</span>
                          <span className="text-tea-text-dim">·</span>
                          <button
                            onClick={() => handleView(order)}
                            className="num hover:text-tea-text transition-colors"
                          >{order.invoice_number}</button>
                          {order.source_event_title && (
                            <button
                              onClick={() => navigate(`/admin/events?search=${encodeURIComponent(order.source_event_title ?? '')}`)}
                              className="text-tea-text-dim hover:text-tea-text-sec transition-colors"
                              title={`Attributed to: ${order.source_event_title}`}
                            ><Leaf size={11} /></button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPending && daysAge >= 7 && (
                          <span className="text-ui-10 text-tea-gold/80 num">{daysAge}d</span>
                        )}
                        <span className={`badge-status ${
                          isVoid ? 'badge-status-muted' :
                          isPending ? 'badge-status-gold' :
                          'badge-status-default'
                        }`}>
                          {order.status}
                        </span>
                      </div>
                    </div>

                    {/* Money + state */}
                    <div className="flex items-baseline gap-2 mt-3">
                      <span className="text-base text-tea-text num font-medium">${total.toFixed(2)}</span>
                      <span className="text-ui-11 text-tea-text-sec">{order.display_currency}</span>
                      {Number(order.shipping_cost_usd) > 0 && (
                        <span className="text-ui-10 text-tea-text-sec/60 num">+${Number(order.shipping_cost_usd).toFixed(0)} ship</span>
                      )}
                      {!isVoid && (
                        <span className="text-ui-11 ml-auto truncate text-right">
                          <span className={order.payment_status === 'paid' ? 'text-tea-text-sec' : 'text-tea-gold/90'}>
                            {order.payment_status === 'paid' ? 'paid' : order.payment_status === 'partial' ? 'partial' : 'unpaid'}
                          </span>
                          <span className="text-tea-text-dim mx-1">·</span>
                          <span className={order.inventory_deducted ? 'text-tea-text-sec' : 'text-tea-gold/90'}>
                            {order.inventory_deducted ? 'stock gone' : 'stock pending'}
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Action gutter */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-tea-border">
                      {isPending && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openFulfillConfirm(order)}
                          icon={<PackageCheck size={12} />}
                        >
                          FILL
                        </Button>
                      )}
                      <div className="flex-1" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="tap-target"
                        onClick={() => handleView(order)}
                        icon={<Eye size={16} />}
                      />
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
                </div>
              );
            })
          )}
        </div>

        {orders.length >= pageSize && (
          <div className="text-center py-4">
            <button
              onClick={() => setPageSize(prev => prev + 50)}
              className="text-xs text-tea-text-sec hover:text-tea-text uppercase tracking-[0.2em] border border-tea-border px-4 py-2 rounded-xl hover:bg-tea-surface transition-colors"
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {/* INVOICE DETAILS MODAL */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-tea-bg border border-tea-border rounded-xl w-full max-w-lg p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                <button onClick={() => { setViewingInvoice(null); setInvoiceTimeline([]); }} className="absolute top-6 right-6 text-tea-text-sec hover:text-tea-text transition-colors" aria-label="Close">
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
                          onClick={() => { setViewingInvoice(null); navigate(`/admin/people?search=${encodeURIComponent(viewingInvoice.customer_name || '')}`); }}
                          className="text-tea-text font-medium hover:text-tea-gold transition-colors"
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
	                        <span className={`font-medium ${viewingInvoice.status === 'Void' ? 'text-tea-text-sec' : viewingInvoice.status === 'Pending' ? 'text-tea-gold' : 'text-tea-text'}`}>{viewingInvoice.status}</span>
	                    </div>
	                    <div className="flex justify-between border-b border-tea-border pb-3">
	                        <span className="text-tea-text-sec">Payment</span>
	                        <span className={`font-medium ${viewingInvoice.payment_status === 'paid' ? 'text-tea-text' : 'text-tea-gold'}`}>
	                          {paymentLabel(viewingInvoice)}
	                        </span>
	                    </div>
	                    {viewingInvoice.payment_date && (
	                      <div className="flex justify-between border-b border-tea-border pb-3">
	                          <span className="text-tea-text-sec">Paid At</span>
	                          <span className="text-tea-text font-medium">{new Date(viewingInvoice.payment_date).toLocaleString()}</span>
	                      </div>
	                    )}
	                    <div className="flex justify-between border-b border-tea-border pb-3">
	                        <span className="text-tea-text-sec">Stock State</span>
	                        <span className={`font-medium ${viewingInvoice.inventory_deducted ? 'text-tea-text' : 'text-tea-gold'}`}>{stockLabel(viewingInvoice)}</span>
	                    </div>
                </div>

                {/* Source Event */}
                {viewingInvoice.source_event_title && (
                  <div className="bg-tea-surface border border-tea-border rounded-xl p-4 mb-6">
                    <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec mb-2">Source Event</h4>
                    <button
                      onClick={() => { setViewingInvoice(null); navigate(`/admin/events?search=${encodeURIComponent(viewingInvoice.source_event_title ?? '')}`); }}
                      className="text-sm text-tea-text hover:text-tea-gold transition-colors"
                    >
                      {viewingInvoice.source_event_title}
                    </button>
                  </div>
                )}

                {/* From collection */}
                {viewingInvoice.source_collection_id && (
                  <div className="bg-tea-surface border border-tea-border rounded-xl p-4 mb-6">
                    <h4 className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-2">From collection</h4>
                    <p className="text-ui-13 text-tea-text-sec">From a shared collection</p>
                  </div>
                )}

                {/* Notes */}
                {viewingInvoice.notes && (
                  <div className="bg-tea-surface border border-tea-border rounded-xl p-4 mb-6">
                    <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec mb-2">Notes</h4>
                    <p className="text-sm text-tea-text whitespace-pre-wrap">{viewingInvoice.notes}</p>
                  </div>
                )}

                <div className="bg-tea-surface border border-tea-border rounded-xl p-6 mb-8">
                    <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec mb-4">Items</h4>
                    <div className="space-y-3 max-h-56 overflow-y-auto custom-scrollbar pr-2">
                        {viewingInvoice.items?.map((item, i) => (
                            <div key={i} className="text-sm">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                    {item.product_id ? (
                                      <button
                                        onClick={() => { setViewingInvoice(null); navigate(`/admin/stock?panel=${encodeURIComponent(item.product_id ?? '')}`); }}
                                        className="text-tea-text font-medium hover:text-tea-gold transition-colors text-left truncate block"
                                      >
                                        {item.given_name || item.product_name || 'Unknown'}
                                      </button>
                                    ) : (
                                      <span className="text-tea-text font-medium">{item.custom_name || item.given_name || 'Custom Item'}</span>
                                    )}
                                    {item.product_name && item.product_id && <div className="text-ui-10 text-tea-text-sec">{item.product_name}</div>}
                                    {!item.product_id && (
                                      <div className="mt-1">
                                        {linkState?.itemIndex === i ? (
                                          <div className="relative">
                                            <input
                                              autoFocus
                                              type="text"
                                              value={linkState.query}
                                              onChange={e => setLinkState(s => s ? { ...s, query: e.target.value } : null)}
                                              placeholder="Search inventory…"
                                              className="w-full bg-tea-bg border border-tea-border rounded-xl px-2 py-1 text-xs text-tea-text outline-none focus:border-tea-gold/50 transition-colors"
                                            />
                                            {linkSuggestions.length > 0 && (
                                              <div className="absolute top-full left-0 right-0 mt-0.5 bg-tea-elevated border border-tea-border rounded-xl shadow-lg z-10 max-h-32 overflow-y-auto custom-scrollbar">
                                                {linkSuggestions.map((p) => (
                                                  <button
                                                    key={p.id}
                                                    onMouseDown={() => handleLinkProduct(p)}
                                                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-tea-surface transition-colors flex justify-between"
                                                  >
                                                    <span className="text-tea-text truncate">{p.givenName || p.productName}</span>
                                                    <span className="text-tea-text-dim shrink-0 ml-2">{p.stockGrams}g</span>
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                            <button onClick={() => setLinkState(null)} className="absolute -top-1 -right-1 text-tea-text-dim hover:text-tea-text">
                                              <X size={10} />
                                            </button>
                                          </div>
                                        ) : (
                                          <button
                                            onClick={() => setLinkState({ itemIndex: i, query: item.custom_name || item.given_name || '' })}
                                            className="flex items-center gap-1 text-ui-10 text-tea-text-dim hover:text-tea-gold transition-colors"
                                          >
                                            <Link2 size={9} /> Link to inventory
                                          </button>
                                        )}
                                      </div>
                                    )}
                                </div>
                                <div className="text-right ml-4 shrink-0">
                                    <div className="text-tea-text num">{item.quantity}g/u</div>
                                    <div className="text-tea-text-sec text-xs num">@ {item.price_at_sale} USD</div>
                                </div>
                              </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-end text-lg font-bold text-tea-text border-t border-tea-border pt-6">
                    <span className="text-sm font-normal text-tea-text-sec">Total (Shipping included)</span>
                    <span className="font-serif text-2xl text-tea-gold">
                      ${((viewingInvoice.items || []).reduce((sum, item) => sum + (item.quantity * item.price_at_sale), 0) + (Number(viewingInvoice.shipping_cost_usd) || 0)).toFixed(2)} USD
                    </span>
                </div>

                {/* Timeline */}
                {invoiceTimeline.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-tea-border">
                    <h4 className="text-xs uppercase tracking-[0.2em] text-tea-text-sec mb-4">Activity</h4>
                    <div className="space-y-3">
                      {invoiceTimeline.map((log, i) => (
                        <div key={log.id || i} className="flex items-start gap-3">
                          <div className="relative flex flex-col items-center">
                            <div className="w-2 h-2 rounded-full bg-tea-gold/60 mt-1.5" />
                            {i < invoiceTimeline.length - 1 && <div className="w-px flex-1 bg-tea-border mt-1" />}
                          </div>
                          <div className="pb-3">
                            <div className="text-xs text-tea-gold font-mono uppercase">{log.action}</div>
                            <div className="text-xs text-tea-text-sec">{log.details}</div>
                            <div className="text-ui-10 text-tea-text-sec/50 mt-0.5">
                              {new Date(log.created_at).toLocaleString()}
                              {log.user_email && ` · ${log.user_email}`}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingInvoice.status === 'Draft' && (
                     <div className="mt-8 pt-6 border-t border-tea-border flex flex-col gap-2">
                        <p className="text-ui-11 text-tea-text-sec leading-[1.5]">
                          A recipient confirmed these picks from a collection. Review the items and prices, then accept to turn it into an order you can fulfil.
                        </p>
                        <button
                            onClick={() => acceptDraft(viewingInvoice)}
                            className="w-full py-4 bg-tea-gold hover:bg-tea-gold/90 text-tea-bg font-bold uppercase tracking-[0.2em] text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-tea-gold/10"
                        >
                            <Check size={18} /> Accept &amp; Make Order
                        </button>
                     </div>
                )}

                {viewingInvoice.status === 'Pending' && (
                     <div className="mt-8 pt-6 border-t border-tea-border">
                        <button
                            onClick={() => { setViewingInvoice(null); openFulfillConfirm(viewingInvoice); }}
                            className="w-full py-4 bg-tea-gold hover:bg-tea-gold/90 text-tea-bg font-bold uppercase tracking-[0.2em] text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-tea-gold/10"
                        >
                            <PackageCheck size={18} /> Confirm Order & Deduct Stock
                        </button>
                     </div>
                )}

                {/* WhatsApp status notification — available for Pending/Filled orders with phone */}
                {viewingInvoice.customer_phone && viewingInvoice.status !== 'Void' && (
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        const customerPhone = viewingInvoice.customer_phone;
                        if (!customerPhone) return;
                        const items = (viewingInvoice.items || []).map((it) => ({
                          name: it.product?.givenName || it.product_name || 'Item',
                          quantity: it.quantity,
                          unit: it.product?.type === 'Teaware' ? 'u' : 'g',
                          price: '', total: '',
                        }));
                        const total = ((viewingInvoice.items || []).reduce((sum, it) => sum + (it.quantity * it.price_at_sale), 0) + (Number(viewingInvoice.shipping_cost_usd) || 0)).toFixed(2);
                        openWhatsAppStatus(customerPhone, {
                          status: viewingInvoice.status === 'Filled' ? 'filled' : 'confirmed',
                          ref: viewingInvoice.invoice_number,
                          customerName: viewingInvoice.customer_name,
                          items,
                          total: `$${total} USD`,
                        });
                      }}
                      className="w-full py-3 border border-tea-border rounded-xl text-xs uppercase tracking-[0.2em] text-tea-text-sec hover:text-tea-text hover:bg-tea-surface flex items-center justify-center gap-2 transition-all"
                    >
                      <MessageCircle size={14} /> Notify Customer via WhatsApp
                    </button>
                  </div>
                )}

                {/* Copy draft link — pre-fills QuickInvoiceModal with this order's items */}
                {viewingInvoice.items && viewingInvoice.items.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => {
                        const param = buildQuickInvoiceDraftParam({
                          customerName: viewingInvoice.customer_name || undefined,
                          items: (viewingInvoice.items || []).map((it) => ({
                            name: it.given_name || it.product_name || it.custom_name || 'Item',
                            quantity: it.quantity,
                            unit: it.product?.type === 'Teaware' ? 'pcs' as const : 'g' as const,
                            productId: it.product_id || undefined,
                            price: it.price_at_sale,
                          })),
                        });
                        const url = `${window.location.origin}/admin/orders?draft=${param}`;
                        navigator.clipboard.writeText(url).then(() => {
                          showToast('Draft link copied.', 'success');
                        });
                      }}
                      className="w-full py-3 border border-tea-border rounded-xl text-xs uppercase tracking-[0.2em] text-tea-text-sec hover:text-tea-text hover:bg-tea-surface flex items-center justify-center gap-2 transition-all"
                    >
                      <Link2 size={14} /> Copy Draft Link
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
            <h4 className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-3">Stock Impact</h4>
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
                    {item.after <= 0 && <span className="text-ui-9 text-tea-gold">(archive)</span>}
                  </div>
                </div>
              ))}
            </div>
            {confirmState.invoice?.status === 'Pending' && (
              <p className="text-xs text-tea-text-sec italic mt-2">
                Stock was reserved when this order was created. Fulfilling will finalize the deduction.
              </p>
            )}
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

      {/* QUICK INVOICE MODAL */}
      <QuickInvoiceModal
        isOpen={showQuickInvoice}
        onClose={() => {
          setShowQuickInvoice(false);
          setQuickInvoicePrefill(null);
        }}
        onSuccess={() => {
          setQuickInvoicePrefill(null);
          refetch();
        }}
        products={products}
        showToast={showToast}
        prefill={quickInvoicePrefill ?? undefined}
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
      <Button
        variant="ghost"
        size="sm"
        className="tap-target"
        onClick={() => setOpen(!open)}
        icon={<MoreHorizontal size={16} />}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 bottom-full mb-1 bg-tea-surface border border-tea-border rounded-xl shadow-2xl z-50 min-w-[140px] py-1 max-h-[min(240px,40vh)] overflow-y-auto">
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
