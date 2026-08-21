import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api, setToken } from '../../lib/api';
import type { EligibleSalesProduct } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import type { Product } from '../types';
import { QuickInvoiceModal } from './QuickInvoiceModal';

type PendingRequest = {
  activeAccountId: string | null;
  headerAccountId: string | null;
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
  product('misc', 'Misc Item', 'Misc'),
  product('missing', 'Missing Type', 'MISSING_TYPE'),
  product('draft', 'Draft Tea', 'Oolong', 'Draft'),
  product('archived', 'Archived Tea', 'Oolong', 'Archived'),
];

const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  if (!url.includes('/api/sales/eligible-products')) return originalFetch(input, init);
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
  return new Promise<Response>((resolve, reject) => {
    requests.push({
      activeAccountId: useAppStore.getState().activeAccountId,
      headerAccountId: headers.get('X-Teajia-Account'),
      resolve: rows => resolve(new Response(JSON.stringify(rows), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })),
      reject,
    });
  });
};
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

const tokenForAccount = (accountId: string) => {
  const payload = btoa(JSON.stringify({ sub: 'tester', active_account_id: accountId, exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `test.${payload}.signature`;
};

const testApi = {
  mount(options: { accountId?: string; prefill?: Record<string, unknown> } = {}) {
    requests.length = 0;
    invoiceCalls.length = 0;
    toasts.length = 0;
    setToken(tokenForAccount(options.accountId || 'account-a'));
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
  setTokenAccount(accountId: string) { setToken(tokenForAccount(accountId)); },
  requestAccounts() { return requests.map(request => request.headerAccountId); },
  requestScopes() { return requests.map(request => ({ activeAccountId: request.activeAccountId, headerAccountId: request.headerAccountId })); },
  resolveRequest(index: number, rows: EligibleSalesProduct[]) { requests[index]?.resolve(rows); },
  rejectRequest(index: number, message = 'Unavailable') { requests[index]?.reject(new Error(message)); },
  invoiceCalls() { return invoiceCalls; },
  toasts() { return toasts; },
};

declare global { interface Window { quickInvoiceTest: typeof testApi } }
window.quickInvoiceTest = testApi;
