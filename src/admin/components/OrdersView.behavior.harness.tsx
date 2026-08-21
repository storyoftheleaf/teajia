import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { api, getTokenClaims, setToken } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import type { AccountMembership } from '../../types';
import { ToastProvider } from './Toast';
import { OrdersView } from './OrdersView';

interface Pending<T> { accountId: string | null; resolve: (value: T) => void; reject: () => void }
const orderRequests: Pending<any[]>[] = [];
const itemRequests: Array<Pending<any[]> & { invoiceId: string }> = [];
const timelineRequests: Array<Pending<{ logs: any[] }> & { invoiceId: string }> = [];

api.products.list = async () => [];
api.invoices.list = () => new Promise((resolve, reject) => orderRequests.push({
  accountId: getTokenClaims()?.active_account_id || null, resolve,
  reject: () => reject(new Error('Orders unavailable')),
}));
api.invoices.getItems = (invoiceId) => new Promise((resolve, reject) => itemRequests.push({
  invoiceId, accountId: getTokenClaims()?.active_account_id || null, resolve,
  reject: () => reject(new Error('Items unavailable')),
}));
api.activityLogs.list = (params = {}) => new Promise((resolve, reject) => timelineRequests.push({
  invoiceId: params.entity_id || '', accountId: getTokenClaims()?.active_account_id || null, resolve,
  reject: () => reject(new Error('Timeline unavailable')),
}));

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const root = createRoot(document.getElementById('root')!);
const tokenFor = (id: string) => `header.${btoa(JSON.stringify({ active_account_id: id, sub: 'user-1' }))}.signature`;
const membership = (id: string): AccountMembership => ({ account_id: id, account_name: id, slug: id, role: 'owner', bundles: ['sell'] });
let renderRevision = 0;

function setAccount(id: string) {
  useAppStore.setState({ activeAccountId: id, memberships: [membership(id)], platformRole: null });
}

(window as any).ordersViewTest = {
  mount() {
    orderRequests.length = 0; itemRequests.length = 0; timelineRequests.length = 0; client.clear(); renderRevision += 1;
    setAccount('account-a'); setToken(tokenFor('account-a'));
    root.render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin/activity']}><ToastProvider><OrdersView key={renderRevision} /></ToastProvider></MemoryRouter></QueryClientProvider>);
  },
  setAccount,
  confirmAccount(id: string) { setToken(tokenFor(id)); },
  orderAccounts: () => orderRequests.map(request => request.accountId),
  resolveOrders(index: number, value: any[]) { orderRequests[index].resolve(value); },
  itemAccounts: () => itemRequests.map(request => request.accountId),
  resolveItems(index: number, value: any[]) { itemRequests[index].resolve(value); },
  timelineAccounts: () => timelineRequests.map(request => request.accountId),
  resolveTimeline(index: number, value: any[]) { timelineRequests[index].resolve({ logs: value }); },
};
