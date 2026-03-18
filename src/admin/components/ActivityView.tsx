import React, { useState } from 'react';
import { ClipboardList, Archive, BarChart3, ScrollText } from 'lucide-react';
import { OrdersView } from './OrdersView';
import { RecordsView } from './SoldItemsView';
import { Product } from '../types';

type ActivityTab = 'orders' | 'archive' | 'ledger' | 'log';

interface ActivityViewProps {
  products: Product[];
}

export const ActivityView: React.FC<ActivityViewProps> = ({ products }) => {
  const [activeTab, setActiveTab] = useState<ActivityTab>('orders');

  const tabs: { id: ActivityTab; label: string; icon: React.ReactNode }[] = [
    { id: 'orders', label: 'Orders', icon: <ClipboardList size={15} /> },
    { id: 'archive', label: 'Archive', icon: <Archive size={15} /> },
    { id: 'ledger', label: 'Ledger', icon: <BarChart3 size={15} /> },
    { id: 'log', label: 'Log', icon: <ScrollText size={15} /> },
  ];

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden bg-tea-bg">
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
            </button>
          ))}
        </div>
      </div>

      {/* Content — RecordsView already has Archive/Log/Ledger as internal tabs,
          so we pass it the right initial tab via a key-based approach */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'orders' && <OrdersView />}
        {activeTab === 'archive' && <RecordsView products={products} initialTab="archive" />}
        {activeTab === 'ledger' && <RecordsView products={products} initialTab="ledger" />}
        {activeTab === 'log' && <RecordsView products={products} initialTab="log" />}
      </div>
    </div>
  );
};
