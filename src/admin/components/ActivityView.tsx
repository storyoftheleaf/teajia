import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Archive, BarChart3, ScrollText, Inbox } from 'lucide-react';
import { OrdersView } from './OrdersView';
import { RecordsView } from './SoldItemsView';
import { PendingView } from './PendingView';
import { usePendingAttendees } from '../hooks/useEventData';
import { api } from '../../lib/api';
import { Product } from '../types';

type ActivityTab = 'pending' | 'orders' | 'archive' | 'ledger' | 'log';
const VALID_TABS: ActivityTab[] = ['pending', 'orders', 'archive', 'ledger', 'log'];

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

  const tabs: { id: ActivityTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'pending', label: 'Pending', icon: <Inbox size={15} />, badge: pendingCount },
    { id: 'orders', label: 'Orders', icon: <ClipboardList size={15} /> },
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
      </div>
    </div>
  );
};
