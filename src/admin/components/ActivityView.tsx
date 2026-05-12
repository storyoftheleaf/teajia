import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, BarChart3, ScrollText, Inbox, MessageSquare } from 'lucide-react';
import { OrdersView } from './OrdersView';
import { RecordsView } from './SoldItemsView';
import { PendingView } from './PendingView';
import { usePendingAttendees } from '../hooks/useEventData';
import { api } from '../../lib/api';
import { Product } from '../types';

type ActivityTab = 'pending' | 'orders' | 'ledger' | 'log' | 'inquiries';
const VALID_TABS: ActivityTab[] = ['pending', 'orders', 'ledger', 'log', 'inquiries'];

interface ActivityViewProps {
  products: Product[];
}

function usePendingCount() {
  const { data: orders = [] } = useQuery({
    queryKey: ['invoices-pending-summary'],
    staleTime: 30_000,
    queryFn: async () => {
      const data = (await api.invoices.list(200)) as any[];
      return data.filter((o: any) => o.status === 'Pending');
    },
  });
  // Reuse the same hook (same queryKey + queryFn) as PendingView so the cache
  // is never poisoned by a raw-data queryFn registered here first.
  const { data: rsvps = [] } = usePendingAttendees();
  return (orders?.length ?? 0) + rsvps.length;
}

export const ActivityView: React.FC<ActivityViewProps> = ({ products }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as ActivityTab | null;
  const activeTab: ActivityTab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'pending';
  const setActiveTab = (tab: ActivityTab) => setSearchParams({ tab }, { replace: true });
  const pendingCount = usePendingCount();

  const { data: inquiryData } = useQuery({
    queryKey: ['inquiries-new-count'],
    staleTime: 60_000,
    queryFn: async () => {
      const data = await api.inquiries.list('new') as any;
      return data?.inquiries ?? [];
    },
  });
  const newInquiryCount = inquiryData?.length ?? 0;

  const tabs: { id: ActivityTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'pending', label: 'Pending', icon: <Inbox size={15} />, badge: pendingCount },
    { id: 'orders', label: 'Orders', icon: <ClipboardList size={15} /> },
    { id: 'inquiries', label: 'Inquiries', icon: <MessageSquare size={15} />, badge: newInquiryCount || undefined },
    { id: 'ledger', label: 'Ledger', icon: <BarChart3 size={15} /> },
    { id: 'log', label: 'Log', icon: <ScrollText size={15} /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      {/* Page header */}
      <div className="px-4 md:px-6 lg:px-10 pt-6 pb-3 flex-shrink-0">
        <h1 className="h2 text-tea-text">Activity</h1>
        <div className="label-caps text-tea-text-dim mt-1">Orders, payments, and customer inquiries</div>
      </div>

      {/* Tab bar — bottom-border underline (§6) */}
      <div className="flex items-center gap-6 px-4 md:px-6 lg:px-10 border-b border-tea-border bg-tea-bg overflow-x-auto hide-scrollbar flex-shrink-0">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 py-2.5 text-ui-12 uppercase tracking-caps font-sans whitespace-nowrap transition-colors border-b ${
                isActive
                  ? 'text-tea-text border-tea-gold'
                  : 'text-tea-text-sec hover:text-tea-text border-transparent'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-1.5 text-tea-text-dim font-mono tabular-nums">
                  ({tab.badge})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content — RecordsView already has Archive/Log/Ledger as internal tabs,
          so we pass it the right initial tab via a key-based approach */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'pending' && <PendingView />}
        {activeTab === 'orders' && <OrdersView />}
        {activeTab === 'ledger' && <RecordsView products={products} initialTab="ledger" />}
        {activeTab === 'log' && <RecordsView products={products} initialTab="log" />}
        {activeTab === 'inquiries' && <InquiriesView />}
      </div>
    </div>
  );
};

// ── Inline InquiriesView ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  seen: 'Seen',
  replied: 'Replied',
  closed: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
  seen: 'bg-tea-elevated text-tea-text-sec',
  replied: 'bg-tea-green/10 text-tea-green ring-1 ring-inset ring-tea-green/40',
  closed: 'bg-tea-elevated text-tea-text-dim',
};

function InquiriesView() {
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-inquiries', filter],
    staleTime: 30_000,
    queryFn: async () => {
      const res = await api.inquiries.list(filter === 'all' ? undefined : filter) as any;
      return res?.inquiries ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'new' | 'seen' | 'replied' | 'closed' }) =>
      api.inquiries.updateStatus(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-inquiries'] });
      qc.invalidateQueries({ queryKey: ['inquiries-new-count'] });
    },
  });

  const inquiries: any[] = data ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="h3 text-tea-text">Inquiries</h2>
        <div className="flex items-center gap-6 border-b border-tea-border">
          {['all', 'new', 'seen', 'replied', 'closed'].map(s => {
            const isActive = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`py-2 text-ui-12 uppercase tracking-caps font-sans whitespace-nowrap transition-colors border-b ${
                  isActive
                    ? 'text-tea-text border-tea-gold'
                    : 'text-tea-text-sec hover:text-tea-text border-transparent'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <p className="text-tea-text-sec text-sm">Loading…</p>
      )}

      {!isLoading && inquiries.length === 0 && (
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <MessageSquare size={28} strokeWidth={1.25} className="text-tea-text-dim mb-3" />
          <div className="font-display text-ui-17 text-tea-text">No inquiries</div>
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
            {filter !== 'all' ? `Nothing with status "${STATUS_LABELS[filter]}" right now.` : 'New customer inquiries will appear here.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {inquiries.map((inq: any) => (
          <div key={inq.id} className="bg-tea-surface border border-tea-border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-tea-text font-medium text-sm">{inq.name}</p>
                <p className="text-tea-text-sec text-xs">{inq.email}</p>
                {inq.phone && <p className="text-tea-text-sec text-xs">{inq.phone}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {inq.source && inq.source !== 'cart' && (
                  <span className="text-ui-10 px-2 py-0.5 rounded-full bg-tea-gold/10 text-tea-text ring-1 ring-tea-gold/40 uppercase tracking-wider">
                    {inq.source}
                  </span>
                )}
                <span className={`text-ui-10 px-2 py-0.5 rounded-full ${STATUS_COLORS[inq.status] ?? STATUS_COLORS.seen}`}>
                  {STATUS_LABELS[inq.status] ?? inq.status}
                </span>
                <select
                  value={inq.status}
                  onChange={e => updateStatus.mutate({ id: inq.id, status: e.target.value as any })}
                  className="text-ui-10 bg-tea-bg border border-tea-border rounded px-1.5 py-0.5 text-tea-text-sec"
                >
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {(inq.items ?? []).length > 0 && (
              <div className="space-y-1 border-t border-tea-border pt-2">
                {inq.items.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-tea-text">{item.name}</span>
                    <span className="text-tea-text-sec num">{item.quantityGrams ?? item.qty ?? ''}g</span>
                  </div>
                ))}
                {inq.total_usd != null && (
                  <div className="flex justify-between text-xs font-medium pt-1 border-t border-tea-border">
                    <span className="text-tea-text-sec">Total</span>
                    <span className="text-tea-text num">${Number(inq.total_usd).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {inq.message && (
              <p className="text-tea-text-sec text-xs border-t border-tea-border pt-2">{inq.message}</p>
            )}

            <p className="text-tea-text-dim text-ui-10">{new Date(inq.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
