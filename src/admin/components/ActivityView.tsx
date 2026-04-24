import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Archive, BarChart3, ScrollText, Inbox, MessageSquare } from 'lucide-react';
import { OrdersView } from './OrdersView';
import { RecordsView } from './SoldItemsView';
import { PendingView } from './PendingView';
import { usePendingAttendees } from '../hooks/useEventData';
import { api } from '../../lib/api';
import { Product } from '../types';

type ActivityTab = 'pending' | 'orders' | 'archive' | 'ledger' | 'log' | 'inquiries';
const VALID_TABS: ActivityTab[] = ['pending', 'orders', 'archive', 'ledger', 'log', 'inquiries'];

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
    { id: 'archive', label: 'Archive', icon: <Archive size={15} /> },
    { id: 'ledger', label: 'Ledger', icon: <BarChart3 size={15} /> },
    { id: 'log', label: 'Log', icon: <ScrollText size={15} /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 md:px-6 py-2 border-b border-tea-border bg-tea-bg overflow-x-auto hide-scrollbar flex-shrink-0">
        <div className="flex items-center bg-tea-surface rounded-lg border border-tea-border p-0.5">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] rounded-md whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-tea-bg text-tea-text shadow-sm'
                  : 'text-tea-text-sec hover:text-tea-text'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge != null && tab.badge > 0 && (
                <span className="ml-0.5 text-[9px] bg-amber-400/20 text-amber-600 dark:text-amber-400 px-1 py-0 rounded-full num leading-4">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content — RecordsView already has Archive/Log/Ledger as internal tabs,
          so we pass it the right initial tab via a key-based approach */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'pending' && <PendingView />}
        {activeTab === 'orders' && <OrdersView />}
        {activeTab === 'archive' && <RecordsView products={products} initialTab="archive" />}
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
  new: 'bg-amber-400/20 text-amber-700 dark:text-amber-400',
  seen: 'bg-tea-surface text-tea-text-sec',
  replied: 'bg-emerald-400/20 text-emerald-700 dark:text-emerald-400',
  closed: 'bg-tea-surface text-tea-text-dim',
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
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-tea-text">Cart Inquiries</h2>
        <div className="flex gap-1">
          {['all', 'new', 'seen', 'replied', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-2.5 py-1 text-[10px] uppercase tracking-wider rounded transition-colors ${
                filter === s
                  ? 'bg-tea-gold/20 text-tea-gold font-semibold'
                  : 'bg-tea-surface text-tea-text-sec hover:text-tea-text'
              }`}
            >
              {s === 'all' ? 'All' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <p className="text-tea-text-sec text-sm">Loading…</p>
      )}

      {!isLoading && inquiries.length === 0 && (
        <p className="text-tea-text-sec text-sm">No inquiries{filter !== 'all' ? ` with status "${STATUS_LABELS[filter]}"` : ''}.</p>
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
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_COLORS[inq.status] ?? STATUS_COLORS.seen}`}>
                  {STATUS_LABELS[inq.status] ?? inq.status}
                </span>
                <select
                  value={inq.status}
                  onChange={e => updateStatus.mutate({ id: inq.id, status: e.target.value as any })}
                  className="text-[10px] bg-tea-bg border border-tea-border rounded px-1.5 py-0.5 text-tea-text-sec"
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

            <p className="text-tea-text-dim text-[10px]">{new Date(inq.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
