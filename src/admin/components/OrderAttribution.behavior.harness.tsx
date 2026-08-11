import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api, type InvoiceAttribution } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { OrderAttribution } from './OrderAttribution';

interface PendingRequest {
  accountId: string | null;
  resolve: (value: InvoiceAttribution) => void;
  reject: () => void;
}

const requests: PendingRequest[] = [];
api.invoices.getAttribution = () => new Promise<InvoiceAttribution>((resolve, reject) => {
  requests.push({
    accountId: useAppStore.getState().activeAccountId,
    resolve,
    reject: () => reject(new Error('Unavailable')),
  });
});

const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
const root = createRoot(document.getElementById('root')!);
let accountId = 'account-a';

function render() {
  useAppStore.getState().setActiveAccountId(accountId);
  root.render(<QueryClientProvider client={client}><OrderAttribution invoiceId="invoice-1" accountId={accountId} /></QueryClientProvider>);
}

(window as any).orderAttributionTest = {
  mount(initialAccountId = 'account-a') { accountId = initialAccountId; render(); },
  setAccount(nextAccountId: string) { accountId = nextAccountId; render(); },
  requestAccounts() { return requests.map(request => request.accountId); },
  resolve(index: number, detail: InvoiceAttribution) { requests[index].resolve(detail); },
  reject(index: number) { requests[index].reject(); },
};
