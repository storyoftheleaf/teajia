import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api, getTokenClaims, setToken, type SalesSettlement } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { SettlementLedger } from './SettlementLedger';

interface Request<T> { accountId: string | null; resolve: (value: T) => void; reject: () => void }
const listRequests: Request<SalesSettlement[]>[] = [];
const paidRequests: Array<Request<{ success: true }> & { id: string }> = [];

api.sales.listSettlements = () => new Promise((resolve, reject) => listRequests.push({
  accountId: getTokenClaims()?.active_account_id || null,
  resolve,
  reject: () => reject(new Error('Settlement ledger unavailable')),
}));
api.sales.markSettlementPaid = (id) => new Promise((resolve, reject) => paidRequests.push({
  id,
  accountId: getTokenClaims()?.active_account_id || null,
  resolve,
  reject: () => reject(new Error('Payment update failed')),
}));

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
const root = createRoot(document.getElementById('root')!);
let accountId = 'account-a';
let renderRevision = 0;
const tokenFor = (id: string) => `header.${btoa(JSON.stringify({ active_account_id: id }))}.signature`;
const membership = (id: string, role: 'owner' | 'staff') => ({ account_id: id, account_name: id, slug: id, role, bundles: ['sell'] as const });

function render(role: 'owner' | 'staff') {
  useAppStore.setState({ activeAccountId: accountId, memberships: [membership(accountId, role)], platformRole: null });
  root.render(<QueryClientProvider client={client}><SettlementLedger key={renderRevision} /></QueryClientProvider>);
}

(window as any).settlementLedgerTest = {
  mount(role: 'owner' | 'staff' = 'owner') {
    accountId = 'account-a';
    listRequests.length = 0;
    paidRequests.length = 0;
    client.clear();
    renderRevision += 1;
    setToken(tokenFor(accountId));
    render(role);
  },
  setAccount(next: string, role: 'owner' | 'staff' = 'owner') { accountId = next; render(role); },
  confirmAccount(next: string) { setToken(tokenFor(next)); },
  listAccounts: () => listRequests.map(request => request.accountId),
  resolveList(index: number, value: SalesSettlement[]) { listRequests[index].resolve(value); },
  rejectList(index: number) { listRequests[index].reject(); },
  paidIds: () => paidRequests.map(request => request.id),
  resolvePaid(index: number) { paidRequests[index].resolve({ success: true }); },
  rejectPaid(index: number) { paidRequests[index].reject(); },
};
