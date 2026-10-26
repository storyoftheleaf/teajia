import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { ProductStoryView } from './ProductStoryView';
import { api, ApiError, getTokenClaims, setToken } from '../../lib/api';
import { useAppStore } from '../../lib/store';

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const requests: { kind: string; id?: string; account: string | null; user?: string }[] = [];
const pending: { resolve: (value: unknown) => void; reject: (error: Error) => void; account: string | null; user?: string; id: string }[] = [];
const identity = () => ({ account: useAppStore.getState().activeAccountId, user: getTokenClaims()?.sub });
const raw = (account: string | null, user: string | undefined, id: string) => ({
  id, account_id: account, product_name: `${account}-${user}-Tea`, given_name: `${account}-${user}-Tea`,
  type: 'Oolong', stock_grams: 120, retail_price_per_gram_usd: .25, cost_amount: 80, cost_currency: 'USD',
  quantity_purchased: 500, source_compass_entry_id: `${account}-origin`, description: 'The same complete fixture row used for list and detail.',
});
const token = (account: string, user: string) => {
  const enc = (v: object) => btoa(JSON.stringify(v));
  return `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ sub: user, active_account_id: account, exp: Math.floor(Date.now() / 1000) + 86400 * 30 })}.test`;
};
function confirm(account: string, user = 'operator') {
  setToken(token(account, user));
  useAppStore.setState({ activeAccountId: account });
}
api.products.list = async () => { requests.push({ kind: 'list', ...identity() }); throw new Error('Full inventory must not be loaded for a product story'); };
api.products.get = (id: string) => {
  const scope = identity(); requests.push({ kind: 'detail', id, ...scope });
  return new Promise((resolve, reject) => pending.push({ resolve, reject, id, ...scope }));
};
api.stockLedger.list = (async (id: string) => {
  const scope = identity(); requests.push({ kind: 'ledger', id, ...scope });
  return { entries: [{ id: `${scope.account}-receipt`, product_id: id, change_g: 40, reason: `${scope.account} delivery`, created_at: '2026-09-01' }] };
}) as any;
api.products.getEvents = (async (id: string) => {
  const scope = identity(); requests.push({ kind: 'events', id, ...scope });
  return [{ id: `${scope.account}-event`, title: `${scope.account} gathering`, eventDate: '2026-09-02' }];
}) as any;
api.compass.list = (async () => {
  const scope = identity(); requests.push({ kind: 'compass', ...scope });
  return [{ id: `${scope.account}-origin`, origin: `${scope.account} mountain`, vendor: `${scope.account} supplier` }];
}) as any;
api.events.getTastingNotes = (async (id: string) => {
  const scope = identity(); requests.push({ kind: 'tasting', id, ...scope });
  return [{ id: `${scope.account}-note`, impression: `${scope.account} floral peaches`, attendeeName: 'Guest' }];
}) as any;
confirm('account-a');
function Harness() {
  const navigate = useNavigate();
  (window as any).productStoryTest = {
    requests: () => requests,
    navigate,
    switchAccount: (account: string) => useAppStore.setState({ activeAccountId: account }),
    confirm,
    resolve: (index: number, overrides = {}) => { const p = pending[index]; p.resolve({ ...raw(p.account, p.user, p.id), ...overrides }); },
    reject: (index: number, status = 404) => pending[index].reject(new ApiError('Unavailable', status)),
    patchCachedName: () => client.setQueriesData<any[]>({ predicate: q => q.queryKey[0] === 'products' && q.queryKey[1] !== 'public' }, rows => rows?.map(row => ({ ...row, givenName: 'Updated tea' }))),
    refresh: () => client.invalidateQueries({ queryKey: ['products'] }),
    measurement: () => {
      const rows = Array.from({ length: 96 }, (_, i) => raw('account-a', 'operator', `tea-${i}`));
      return { before: { items: rows.length, bytes: new TextEncoder().encode(JSON.stringify(rows)).length }, after: { items: 1, bytes: new TextEncoder().encode(JSON.stringify(rows[0])).length } };
    },
  };
  return <Routes><Route path="/admin/products/:id/story" element={<ProductStoryView />} /><Route path="*" element={<div>Stock route</div>} /></Routes>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin/stock', '/admin/products/tea-shared/story']} initialIndex={1}><Harness /></MemoryRouter></QueryClientProvider>);
