import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { EligibleSalesProduct } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import type { Product } from '../types';
import { QuickInvoiceModal } from './QuickInvoiceModal';

type PendingRequest = {
  accountId: string | null;
  resolve: (rows: EligibleSalesProduct[]) => void;
  reject: (error: Error) => void;
};

const requests: PendingRequest[] = [];
const invoiceCalls: Array<{ invoice: unknown; items: unknown }> = [];
const toasts: Array<{ message: string; type?: string }> = [];

const product = (id: string, name: string, type: Product['type'] = 'Oolong', status: Product['status'] = 'Active'): Product => ({
  id, givenName: name, productName: name, type, status, form: type === 'Teaware' ? 'Other' : 'Loose',
  originCountry: '', originRegion: '', pricePerGramUSD: type === 'Teaware' ? 20 : 0.4,
  costPerGramUSD: 0, costAmount: 0, stockGrams: 100, lowStockThreshold: 0,
  description: '', tastingNotes: [], imageUrl: '', costCurrency: 'USD', quantityPurchased: 0,
  isPersonal: false, canReorder: false, isPublic: false, shownInShop: false,
});

const products = [
  product('tea-a', 'Account A Tea'),
  product('tea-b', 'Account B Tea'),
  product('tray', 'Tea Tray', 'Teaware'),
  product('draft', 'Draft Tea', 'Oolong', 'Draft'),
  product('archived', 'Archived Tea', 'Oolong', 'Archived'),
];

Object.assign(api.sales, {
  eligibleProducts: () => new Promise<EligibleSalesProduct[]>((resolve, reject) => {
    requests.push({ accountId: useAppStore.getState().activeAccountId, resolve, reject });
  }),
});
Object.assign(api.customers, { list: async () => [] });
Object.assign(api.rates, { list: async () => [] });
Object.assign(api.invoices, {
  create: async (invoice: unknown, items: unknown) => {
    invoiceCalls.push({ invoice, items });
    return { id: 'invoice-1', invoice_number: 'INV-1' };
  },
});

const root = createRoot(document.getElementById('root')!);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
let mountId = 0;

const testApi = {
  mount(options: { accountId?: string; prefill?: Record<string, unknown> } = {}) {
    requests.length = 0;
    invoiceCalls.length = 0;
    toasts.length = 0;
    useAppStore.setState({ activeAccountId: options.accountId || 'account-a' });
    root.render(
      <QueryClientProvider client={queryClient}>
        <QuickInvoiceModal
          key={++mountId}
          isOpen
          onClose={() => {}}
          onSuccess={() => {}}
          products={products}
          prefill={options.prefill as any}
          showToast={(message, type) => toasts.push({ message, type })}
        />
      </QueryClientProvider>,
    );
  },
  setAccount(accountId: string) { useAppStore.setState({ activeAccountId: accountId }); },
  requestAccounts() { return requests.map(request => request.accountId); },
  resolveRequest(index: number, rows: EligibleSalesProduct[]) { requests[index]?.resolve(rows); },
  rejectRequest(index: number, message = 'Unavailable') { requests[index]?.reject(new Error(message)); },
  invoiceCalls() { return invoiceCalls; },
  toasts() { return toasts; },
};

declare global { interface Window { quickInvoiceTest: typeof testApi } }
window.quickInvoiceTest = testApi;
