import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import type { InvoiceWithItems, Product } from '../types';
import { openWhatsAppStatus } from '../../lib/whatsapp';
import { Loader2, Search, XCircle, Trash2, Eye, X, PackageCheck, Users, Scissors, Pencil, Package, MoreHorizontal, MessageCircle, Plus, Link2, StickyNote, Leaf } from 'lucide-react';
import Fuse from 'fuse.js';
import { useProducts } from '../hooks/useAdminData';
import { useToast } from './Toast';
import { ConfirmModal } from './ConfirmModal';
import { SplitOrderModal } from './SplitOrderModal';
import { EditOrderModal } from './EditOrderModal';
import { QuickInvoiceModal } from './QuickInvoiceModal';
import { STATUS_PILL_VARIANTS, STATUS_PILL_BASE, type StatusPillVariant } from '../constants';

const ROW_HEIGHT = 40;

/** Canonical mapping: order status → 5-variant status pill. */
const statusToVariant = (status: string | undefined): StatusPillVariant => {
  if (status === 'Filled') return 'success';
  if (status === 'Void') return 'archived';
  return 'draft'; // Pending and unknown fall back to draft (subdued)
};

/** Format a date like "MAR 12 2026" — used in the invoice detail header. */
const formatIssuedDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  return `${month} ${d.getDate()} ${d.getFullYear()}`;
};

/** Format an activity event date like "Mar 12 · 2:14 PM". */
const formatEventDate = (dateStr: string) => {
  const d = new Date(dateStr);
  const month = d.toLocaleString('en-US', { month: 'short' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${month} ${d.getDate()} · ${time}`;
};

/** System actions render with a muted dot; everything else uses the gold dot. */
const SYSTEM_ACTIONS = new Set(['system', 'automation', 'webhook', 'cron']);

type StatusFilter = 'all' | 'Pending' | 'Filled' | 'Void';

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

  useEffect(() => {
    if (searchParams.get('qi') === '1') {
      setShowQuickInvoice(true);
      setSearchParams(prev => { const n = new URLSearchParams(prev); n.delete('qi'); return n; }, { replace: true });
    }
  }, [searchParams]);
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
    const pending = orders.filter((o) => o.status === 'Pending').length;
    const filled = orders.filter((o) => o.status === 'Filled').length;
    const voided = orders.filter((o) => o.status === 'Void').length;
    const filledTotal = orders
      .filter((o) => o.status === 'Filled')
      .reduce((sum: number, o) => sum + (Number(o.computed_total) || 0) + (Number(o.shipping_cost_usd) || 0), 0);
    return { pending, filled, voided, filledTotal };
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
      showToast(`Action failed: ${err.message}`, 'error');
    }
    setConfirmLoading(false);
    setConfirmState(null);
  };

  const handleLinkProduct = async (product: { id: string; givenName?: string; productName?: string }) => {
    if (!viewingInvoice || !linkState) return;
    const targetItem = (viewingInvoice.items || [])[linkState.itemIndex];
    if (!targetItem) return;
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
      showToast('Link failed: ' + err.message, 'error');
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

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 bg-tea-bg">
        <Loader2 size={28} strokeWidth={1.25} className="animate-spin text-tea-text-dim" />
        <div className="font-display text-ui-17 text-tea-text">Loading orders</div>
        <div className="text-ui-12 text-tea-text-dim">Pulling pipeline from the worker</div>
      </div>
    );
  }

  // Pre-compute totals for the invoice detail modal (subtotal, shipping, grand total).
  const invoiceTotals = (() => {
    if (!viewingInvoice) return { subtotal: 0, shipping: 0, total: 0 };
    const subtotal = (viewingInvoice.items || []).reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price_at_sale) || 0),
      0,
    );
    const shipping = Number(viewingInvoice.shipping_cost_usd) || 0;
    return { subtotal, shipping, total: subtotal + shipping };
  })();

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">

      {/* Header — sticky h-16 chrome row + filter rail */}
      <div className="sticky top-0 z-sticky bg-tea-bg/90 backdrop-blur-md border-b border-tea-border flex-shrink-0">
        {/* Title row — h-16, .h2 title left + .label-caps subtitle below */}
        <div className="px-4 md:px-6 lg:px-10 max-w-5xl mx-auto h-16 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="h2 text-tea-text">Orders</h1>
            <div className="label-caps text-tea-text-dim mt-0.5">
              PIPELINE · {orders.length}
              {summary.filledTotal > 0 && (
                <> · <span className="font-mono tabular-nums">${summary.filledTotal.toFixed(2)}</span> REVENUE</>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowQuickInvoice(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-tea-gold text-tea-bg text-ui-12 font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors shrink-0"
          >
            <Plus size={13} />
            <span>New Invoice</span>
          </button>
        </div>

        {/* Filter rail — underline tabs (canonical pattern, no shadow) */}
        <div className="px-3 md:px-6 lg:px-10 max-w-5xl mx-auto">
          <div className="flex items-center gap-6 border-b border-tea-border overflow-x-auto hide-scrollbar min-w-0">
            {([
              { id: 'all',     label: 'All' },
              { id: 'Pending', label: 'Pending' },
              { id: 'Filled',  label: 'Filled' },
              { id: 'Void',    label: 'Void' },
            ] as { id: StatusFilter; label: string }[]).map(({ id, label }) => {
              const count = id === 'all' ? orders.length
                : id === 'Pending' ? summary.pending
                : id === 'Filled' ? summary.filled
                : summary.voided;
              const isActive = statusFilter === id;
              return (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  className={`flex items-baseline gap-1.5 py-2.5 text-ui-12 uppercase tracking-caps font-sans border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-tea-text border-tea-gold'
                      : 'text-tea-text-sec hover:text-tea-text border-transparent'
                  }`}
                >
                  <span>{label}</span>
                  <span className="font-mono tabular-nums text-ui-10 text-tea-text-dim">{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search — mobile (full width) */}
        <div className="px-3 py-2 md:hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
            <input
              type="text"
              placeholder="Search orders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent border-b border-tea-border rounded-none pl-8 pr-3 py-1.5 text-ui-12 text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
            />
          </div>
        </div>

        {/* Search — desktop (inline, right-aligned) */}
        <div className="hidden md:block px-6 py-2">
          <div className="max-w-5xl mx-auto flex justify-end">
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-tea-text-sec" size={14} />
              <input
                type="text"
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent border-b border-tea-border rounded-none pl-9 pr-3 py-1.5 text-ui-12 text-tea-text outline-none focus-visible:ring-2 focus-visible:ring-tea-gold/50 focus-visible:ring-offset-1 focus-visible:ring-offset-tea-bg focus:border-tea-text-sec font-serif placeholder-tea-text-sec/50 transition-colors"
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
            <thead className="sticky top-0 z-sticky bg-tea-bg shadow-sm">
              <tr>
                <th className="px-4 py-2 border-b border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left">Date</th>
                <th className="px-4 py-2 border-b border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left">Invoice #</th>
                <th className="px-4 py-2 border-b border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-left">Customer</th>
                <th className="px-4 py-2 border-b border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-right">Total</th>
                <th className="px-4 py-2 border-b border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-center">Status</th>
                <th className="px-4 py-2 border-b border-tea-border text-ui-10 uppercase tracking-wider font-serif text-tea-text-sec text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Package size={28} strokeWidth={1.25} className="text-tea-text-dim" />
                    <div className="font-display text-ui-17 text-tea-text">
                      {search || statusFilter !== 'all' ? 'No matching orders' : 'No orders yet'}
                    </div>
                    <div className="text-ui-12 text-tea-text-dim">
                      {search || statusFilter !== 'all' ? 'Try a different search or status filter.' : 'New invoices will appear here.'}
                    </div>
                    {(search || statusFilter !== 'all') && (
                      <button
                        onClick={() => { setSearch(''); setStatusFilter('all'); }}
                        className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-ui-12"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                </td></tr>
              ) : (
                filteredOrders.map((order) => {
                  const isPending = order.status === 'Pending';
                  const isVoid = order.status === 'Void';
                  const total = (Number(order.computed_total) || 0) + (Number(order.shipping_cost_usd) || 0);
                  const daysAge = isPending ? getDaysAge(order.created_at) : 0;
                  const variant = statusToVariant(order.status);

                  return (
                    <tr key={order.id} className="transition-colors border-b border-tea-border group hover:bg-tea-bg/50" style={{ height: ROW_HEIGHT }}>
                      <td className="px-4 align-middle overflow-hidden">
                        <span className="text-ui-12 text-tea-text-sec font-mono tabular-nums">{new Date(order.created_at).toLocaleDateString()}</span>
                      </td>
                      <td className="px-4 align-middle overflow-hidden">
                        <button
                          onClick={() => handleView(order)}
                          className="font-mono tabular-nums text-ui-12 text-tea-text group-hover:text-tea-text transition-colors"
                        >
                          {order.invoice_number}
                        </button>
                      </td>
                      <td className="px-4 align-middle overflow-hidden">
                        <button
                          onClick={() => order.customer_id
                            ? navigate(`/admin/people/${order.customer_id}`)
                            : navigate(`/admin/people?search=${encodeURIComponent(order.customer_name || '')}`)}
                          className="font-display text-ui-15 text-tea-text hover:text-tea-text-sec transition-colors flex items-center gap-1.5 group/cust truncate text-left w-full"
                          title="View customer profile"
                        >
                          <Users size={12} className="opacity-0 group-hover/cust:opacity-100 transition-opacity text-tea-text-sec flex-shrink-0" />
                          <span className="truncate">{order.customer_name}</span>
                        </button>
                      </td>
                      <td className="px-4 align-middle overflow-hidden text-right">
                        <div className="font-mono tabular-nums text-ui-13 text-tea-text">
                          ${total.toFixed(2)}
                          <span className="text-ui-10 text-tea-text-dim ml-1">{order.display_currency}</span>
                        </div>
                        {Number(order.shipping_cost_usd) > 0 && (
                          <div className="text-ui-10 text-tea-text-dim font-mono tabular-nums">+${Number(order.shipping_cost_usd).toFixed(2)} ship</div>
                        )}
                      </td>
                      <td className="px-4 align-middle text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[variant]}`}>
                            {order.status}
                          </span>
                          {isPending && daysAge >= 7 && (
                            <span className="text-ui-10 text-tea-gold/80 font-mono tabular-nums">{daysAge}d</span>
                          )}
                          {order.notes && (
                            <span className="text-tea-text-dim" title={order.notes}><StickyNote size={10} /></span>
                          )}
                          {order.source_event_title && (
                            <button
                              onClick={() => navigate(`/admin/events?search=${encodeURIComponent(order.source_event_title)}`)}
                              className="text-tea-text-dim hover:text-tea-text-sec transition-colors cursor-pointer tap-target"
                              title={`Attributed to: ${order.source_event_title}`}
                            ><Leaf size={10} /></button>
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
                            <button onClick={() => setConfirmState({ type: 'void', invoice: order })} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors" title="Void Order">
                              <XCircle size={14} />
                            </button>
                          )}
                          {isVoid && (
                            <button onClick={() => setConfirmState({ type: 'delete', invoice: order })} className="p-1 min-h-[36px] min-w-[36px] flex items-center justify-center text-tea-text-sec hover:text-tea-text transition-colors" title="Delete Record">
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
        <div className="md:hidden pb-nav-gap-lg">
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Package size={28} strokeWidth={1.25} className="text-tea-text-dim" />
              <div className="font-display text-ui-17 text-tea-text">
                {search || statusFilter !== 'all' ? 'No matching orders' : 'No orders yet'}
              </div>
              <div className="text-ui-12 text-tea-text-dim">
                {search || statusFilter !== 'all' ? 'Try a different search or status filter.' : 'New invoices will appear here.'}
              </div>
              {(search || statusFilter !== 'all') && (
                <button
                  onClick={() => { setSearch(''); setStatusFilter('all'); }}
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-ui-12"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            filteredOrders.map((order, idx) => {
              const isPending = order.status === 'Pending';
              const isVoid = order.status === 'Void';
              const total = (Number(order.computed_total) || 0) + (Number(order.shipping_cost_usd) || 0);
              const daysAge = isPending ? getDaysAge(order.created_at) : 0;
              const variant = statusToVariant(order.status);

              return (
                <div
                  key={order.id}
                  className={`px-4 py-2.5 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-tea-surface/20'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-ui-10 text-tea-text-dim label-caps">{new Date(order.created_at).toLocaleDateString()}</span>
                    <button
                      onClick={() => handleView(order)}
                      className="font-mono tabular-nums text-ui-12 text-tea-text hover:text-tea-text-sec transition-colors"
                    >
                      {order.invoice_number}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-display text-ui-15 text-tea-text truncate">{order.customer_name}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[variant]}`}>
                        {order.status}
                      </span>
                      {isPending && daysAge >= 7 && (
                        <span className="text-ui-10 text-tea-gold/80 font-mono tabular-nums">{daysAge}d</span>
                      )}
                      {order.source_event_title && (
                        <button
                          onClick={() => navigate(`/admin/events?search=${encodeURIComponent(order.source_event_title)}`)}
                          className="text-tea-text-dim hover:text-tea-text-sec transition-colors cursor-pointer tap-target"
                          title={`Attributed to: ${order.source_event_title}`}
                        ><Leaf size={10} /></button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-tea-border">
                    <span className="font-mono tabular-nums text-ui-13 text-tea-text">
                      ${total.toFixed(2)}
                      <span className="text-ui-10 text-tea-text-dim ml-1">{order.display_currency}</span>
                    </span>
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
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-xs"
            >
              Load More
            </button>
          </div>
        )}
      </div>

      {/* INVOICE DETAILS MODAL — canonical invoice block + activity timeline */}
      {viewingInvoice && (() => {
        const inv = viewingInvoice;
        const statusVariant = statusToVariant(inv.status);
        return (
        <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-tea-bg border border-tea-border rounded-xl w-full max-w-lg p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
                <button
                  onClick={() => { setViewingInvoice(null); setInvoiceTimeline([]); }}
                  className="absolute top-5 right-5 text-tea-text-sec hover:text-tea-text transition-colors tap-target"
                  aria-label="Close"
                >
                    <X size={20} />
                </button>

                {/* Invoice block — canonical signature (bg-tea-surface border rounded-xl p-5) */}
                <div className="bg-tea-surface border border-tea-border rounded-xl p-5 mb-6">
                    <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
                        <h3 className="h3 text-tea-text">Invoice {inv.invoice_number}</h3>
                        <span className="label-caps text-tea-text-dim">
                          {inv.status.toUpperCase()} · {formatIssuedDate(inv.created_at)}
                        </span>
                    </div>

                    {/* Line items — name (truncated) + mono qty + right-aligned mono total */}
                    <div className="border-t border-tea-border">
                        {(inv.items || []).map((item, i) => {
                            const lineTotal = (Number(item.quantity) || 0) * (Number(item.price_at_sale) || 0);
                            const qtyUnit = item.product?.type === 'Teaware' ? 'u' : 'g';
                            const displayName = item.product_id
                              ? (item.given_name || item.product_name || 'Unknown')
                              : (item.custom_name || item.given_name || 'Custom Item');
                            return (
                              <div key={i} className="py-2 border-b border-tea-border">
                                <div className="flex justify-between items-baseline text-ui-14 text-tea-text">
                                    {item.product_id ? (
                                      <button
                                        onClick={() => { setViewingInvoice(null); navigate(`/admin/inventory?panel=${encodeURIComponent(item.product_id!)}`); }}
                                        className="flex-1 truncate text-left hover:text-tea-text-sec transition-colors"
                                      >
                                        {displayName}
                                      </button>
                                    ) : (
                                      <span className="flex-1 truncate">{displayName}</span>
                                    )}
                                    <span className="text-tea-text-sec text-ui-13 mx-4 font-mono tabular-nums">
                                      {item.quantity}{qtyUnit} × ${Number(item.price_at_sale).toFixed(2)}
                                    </span>
                                    <span className="font-mono tabular-nums w-20 text-right">${lineTotal.toFixed(2)}</span>
                                </div>
                                {!item.product_id && (
                                  <div className="mt-1.5">
                                    {linkState?.itemIndex === i ? (
                                      <div className="relative">
                                        <input
                                          autoFocus
                                          type="text"
                                          value={linkState.query}
                                          onChange={e => setLinkState(s => s ? { ...s, query: e.target.value } : null)}
                                          placeholder="Search inventory…"
                                          className="w-full bg-tea-bg border border-tea-border rounded-md px-2 py-1 text-ui-12 text-tea-text outline-none focus:border-tea-text-sec transition-colors"
                                        />
                                        {linkSuggestions.length > 0 && (
                                          <div className="absolute top-full left-0 right-0 mt-0.5 bg-tea-elevated border border-tea-border rounded-md shadow-lg z-popover max-h-32 overflow-y-auto custom-scrollbar">
                                            {linkSuggestions.map((p) => (
                                              <button
                                                key={p.id}
                                                onMouseDown={() => handleLinkProduct(p)}
                                                className="w-full text-left px-3 py-1.5 text-ui-12 hover:bg-tea-surface transition-colors flex justify-between items-baseline"
                                              >
                                                <span className="text-tea-text truncate font-display">{p.givenName || p.productName}</span>
                                                <span className="text-tea-text-dim font-mono tabular-nums shrink-0 ml-2">{p.stockGrams}g</span>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                        <button
                                          onClick={() => setLinkState(null)}
                                          className="absolute -top-1 -right-1 text-tea-text-sec hover:text-tea-text tap-target"
                                          aria-label="Cancel link"
                                        >
                                          <X size={10} />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => setLinkState({ itemIndex: i, query: item.custom_name || item.given_name || '' })}
                                        className="inline-flex items-center gap-1 text-ui-11 text-tea-text-dim hover:text-tea-text-sec transition-colors"
                                      >
                                        <Link2 size={10} /> Link to inventory
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                        })}
                    </div>

                    {/* Subtotal / shipping */}
                    <div className="pt-3 space-y-1.5 text-ui-13">
                        <div className="flex justify-between">
                            <span className="text-tea-text-sec">Subtotal</span>
                            <span className="text-tea-text font-mono tabular-nums">${invoiceTotals.subtotal.toFixed(2)}</span>
                        </div>
                        {invoiceTotals.shipping > 0 && (
                          <div className="flex justify-between">
                              <span className="text-tea-text-sec">Shipping</span>
                              <span className="text-tea-text font-mono tabular-nums">${invoiceTotals.shipping.toFixed(2)}</span>
                          </div>
                        )}
                    </div>

                    {/* Total — canonical signature */}
                    <div className="flex justify-between items-baseline pt-3 mt-2 border-t border-tea-border">
                        <span className="font-display text-ui-17 font-medium text-tea-text">Total</span>
                        <span className="font-mono text-ui-17 text-tea-text tabular-nums">
                          ${invoiceTotals.total.toFixed(2)}
                          <span className="text-ui-12 text-tea-text-dim ml-1">{inv.display_currency || 'USD'}</span>
                        </span>
                    </div>
                </div>

                {/* Meta strip — customer / date / status / inventory */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-6 text-ui-13">
                    <div>
                      <div className="label-caps text-tea-text-dim mb-0.5">Customer</div>
                      <button
                        onClick={() => { setViewingInvoice(null); navigate(`/admin/people?search=${encodeURIComponent(inv.customer_name || '')}`); }}
                        className="font-display text-ui-15 text-tea-text hover:text-tea-text-sec transition-colors text-left truncate block w-full"
                      >
                        {inv.customer_name}
                      </button>
                    </div>
                    <div>
                      <div className="label-caps text-tea-text-dim mb-0.5">Date</div>
                      <div className="text-tea-text font-mono tabular-nums">{new Date(inv.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="label-caps text-tea-text-dim mb-0.5">Status</div>
                      <span className={`${STATUS_PILL_BASE} ${STATUS_PILL_VARIANTS[statusVariant]}`}>
                        {inv.status}
                      </span>
                    </div>
                    <div>
                      <div className="label-caps text-tea-text-dim mb-0.5">Inventory</div>
                      <span className={`${STATUS_PILL_BASE} ${inv.inventory_deducted ? STATUS_PILL_VARIANTS.success : STATUS_PILL_VARIANTS.draft}`}>
                        {inv.inventory_deducted ? 'Deducted' : 'Reserved'}
                      </span>
                    </div>
                </div>

                {/* Source Event */}
                {inv.source_event_title && (
                  <div className="bg-tea-surface border border-tea-border rounded-xl p-4 mb-4">
                    <div className="label-caps text-tea-text-dim mb-1.5">Source Event</div>
                    <button
                      onClick={() => { setViewingInvoice(null); navigate(`/admin/events?search=${encodeURIComponent(inv.source_event_title)}`); }}
                      className="font-display text-ui-14 text-tea-text hover:text-tea-text-sec transition-colors"
                    >
                      {inv.source_event_title}
                    </button>
                  </div>
                )}

                {/* Notes */}
                {inv.notes && (
                  <div className="bg-tea-surface border border-tea-border rounded-xl p-4 mb-4">
                    <div className="label-caps text-tea-text-dim mb-1.5">Notes</div>
                    <p className="text-ui-13 text-tea-text whitespace-pre-wrap">{inv.notes}</p>
                  </div>
                )}

                {/* Activity timeline — canonical border-l + offset dots */}
                {invoiceTimeline.length > 0 && (
                  <div className="bg-tea-surface border border-tea-border rounded-xl p-5 mb-6">
                    <h4 className="h3 mb-1">Activity</h4>
                    <p className="text-ui-12 text-tea-text-dim mb-5">Customer audit thread</p>
                    <ul className="relative pl-5 border-l border-tea-border space-y-5">
                      {invoiceTimeline.map((log, i) => {
                        const isSystem = SYSTEM_ACTIONS.has((log.action || '').toLowerCase()) || /^(system|automation|webhook|cron)\./i.test(log.action || '');
                        const body = (log.details && log.details.trim()) ? log.details : log.action;
                        return (
                          <li key={log.id || i} className="relative">
                            <span className={`absolute -left-[22px] top-1.5 w-2 h-2 rounded-full ${isSystem ? 'bg-tea-text-dim' : 'bg-tea-gold'}`} />
                            <div className="label-caps text-tea-text-dim mb-0.5">
                              {formatEventDate(log.created_at)}
                              {log.user_email && (
                                <> · <span className="font-mono normal-case tracking-normal text-tea-text-dim">{log.user_email}</span></>
                              )}
                            </div>
                            <div className="text-ui-13 text-tea-text-sec">
                              {body.split(/(\$[0-9.]+|INV-[0-9]+)/).map((part, k) =>
                                /\$|INV-/.test(part) ? (
                                  <code key={k} className="font-mono text-tea-text">{part}</code>
                                ) : (
                                  <React.Fragment key={k}>{part}</React.Fragment>
                                )
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Footer actions */}
                <div className="space-y-2">
                  {inv.status === 'Pending' && (
                      <button
                          onClick={() => { setViewingInvoice(null); openFulfillConfirm(inv); }}
                          className="w-full inline-flex items-center justify-center gap-2 px-3 py-3 rounded-md bg-tea-gold text-tea-bg text-ui-12 font-semibold hover:bg-tea-gold/90 active:bg-tea-gold/80 transition-colors"
                      >
                          <PackageCheck size={16} /> Confirm Order & Deduct Stock
                      </button>
                  )}

                  {inv.customer_phone && inv.status !== 'Void' && (
                    <button
                      onClick={() => {
                        const items = (inv.items || []).map((it) => ({
                          name: it.product?.givenName || it.product_name || 'Item',
                          quantity: it.quantity,
                          unit: it.product?.type === 'Teaware' ? 'u' : 'g',
                          price: '', total: '',
                        }));
                        openWhatsAppStatus(inv.customer_phone!, {
                          status: inv.status === 'Filled' ? 'filled' : 'confirmed',
                          ref: inv.invoice_number,
                          customerName: inv.customer_name,
                          items,
                          total: `$${invoiceTotals.total.toFixed(2)} USD`,
                        });
                      }}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-3 rounded-md border border-tea-border text-tea-text-sec hover:text-tea-text hover:bg-tea-accent-sub transition-colors text-ui-12"
                    >
                      <MessageCircle size={14} /> Notify Customer via WhatsApp
                    </button>
                  )}
                </div>
            </div>
        </div>
        );
      })()}

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
        onClose={() => setShowQuickInvoice(false)}
        onSuccess={() => { refetch(); }}
        products={products}
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
