import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { CommandPalette } from '../components/CommandPalette';
import { useProducts } from './useAdminData';
import { adminShellNeedsProducts } from '../productQueries';
import { api } from '../../lib/api';
import { useAppStore } from '../../lib/store';

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const calls = { lists: 0, rows: [] as string[] };
const raw = (id: string, stock = 10) => ({ id, product_name: id, stock_grams: stock, type: 'Green', account_id: 'account-a' });
api.products.list = async () => { calls.lists++; return [raw('a'), raw('b')]; };
api.customers.list = async () => [];
api.events.listAdmin = async () => [];
api.products.get = async (id: string) => { calls.rows.push(id); return raw(id, 50); };
useAppStore.setState({ activeAccountId: 'account-a' });
function ChildConsumer() {
  const { data = [] } = useProducts();
  return <div data-testid="child">{data.map(p => p.id).join(',')}</div>;
}
function Harness() {
  const location = useLocation(); const navigate = useNavigate();
  const [overlay, setOverlay] = useState(false);
  const query = useProducts({ enabled: adminShellNeedsProducts(location.pathname, { commandPalette: overlay }) });
  (window as any).productDemandTest = {
    calls: () => ({ ...calls, rows: [...calls.rows] }),
    navigate, overlay: setOverlay,
    refresh: (ids: string[]) => query.refreshProducts(ids),
    remove: (id: string) => query.removeProduct(id),
    fullRefresh: () => query.refetch(),
    ensure: () => query.ensureProducts(),
  };
  return <><div data-testid="rows">{(query.data ?? []).map(p => `${p.id}:${p.stockGrams}`).join(',')}</div>
    {location.pathname === '/admin/people' && <ChildConsumer />}
    <CommandPalette externalOpen={overlay} onOpenChange={setOverlay} onAddProduct={() => {}} /></>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin/account-settings']}><Harness /></MemoryRouter></QueryClientProvider>);
