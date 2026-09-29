import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import type { Product } from '../types';
import { useRates } from '../hooks/useAdminData';
import { inventoryMetrics, type NamedValue } from '../lib/inventoryMetrics';
import { dashboardStockSignals } from '../lib/dashboardSignals';
import { fmtRecordDollars } from '../../utils/formatNumber';
import { api, getTokenClaims, type AttentionItem } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';

interface WeeklyRevenue { week: string; revenue: number; order_count: number }
interface InventoryAlert { id: string; product_name: string; stock_grams: number; last_sold_at: string | null }
interface RevenueData { weekly_revenue: WeeklyRevenue[]; inventory_age_alerts: InventoryAlert[] }
interface Customer { id: string; name: string; lifetime_usd: number; last_order_at?: string }
interface RFMData { top10: Customer[]; lapsed: Customer[]; new_this_month: Customer[] }
const ACTION: Record<AttentionItem['kind'], string> = {
  request: 'Reply to request', unpriced: 'Set the price', claim: 'Review payment', unsent: 'Prepare to send',
};
const rowClass = 'flex min-h-11 items-center justify-between gap-4 border-b border-tea-border py-3 text-left transition-colors hover:text-tea-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-tea-gold';

function ReadState({ failed, loading, retry }: { failed: boolean; loading: boolean; retry: () => void }) {
  if (failed) return <div className="flex flex-wrap items-center gap-3 py-4 text-tea-text-sec"><p className={T.bodyLight}>This part of the dashboard couldn’t load.</p><button onClick={retry} className={`tap-target underline underline-offset-4 ${T.link}`}>Try again</button></div>;
  if (loading) return <p role="status" className={`${T.bodyLight} py-4 text-tea-text-dim`}>Loading…</p>;
  return null;
}

function StockGroup({ title, products, note }: { title: string; products: Product[]; note: (p: Product) => string }) {
  return <div className="min-w-0">
    <h3 className={`${T.h3} flex items-baseline justify-between gap-3`}>{title}<span className={`${T.mono} text-tea-text-dim`}>{products.length}</span></h3>
    {products.length === 0 ? <p className={`${T.bodyLight} mt-3 text-tea-text-dim`}>Nothing to review here.</p> : products.slice(0, 4).map(p => <Link key={p.id} to={`/admin/stock?search=${encodeURIComponent(p.productName)}`} className={rowClass}>
      <span className="min-w-0"><span className={`${T.link} block break-words`}>{p.givenName || p.productName}</span><span className={`${T.accountMeta} mt-1 block text-tea-text-dim`}>{note(p)}</span></span><ArrowUpRight size={15} className="shrink-0" aria-hidden="true" />
    </Link>)}
    {products.length > 4 && <details className="mt-3"><summary className={`min-h-11 cursor-pointer py-3 ${T.link}`}>Show {products.length - 4} more</summary>{products.slice(4).map(p => <Link key={p.id} to={`/admin/stock?search=${encodeURIComponent(p.productName)}`} className={rowClass}><span className={`${T.link} break-words`}>{p.givenName || p.productName}</span><ArrowUpRight size={15} className="shrink-0" aria-hidden="true" /></Link>)}</details>}
  </div>;
}

function Breakdown({ title, values }: { title: string; values: NamedValue[] }) {
  return <div className="min-w-0"><h3 className={`${T.h3} mb-3`}>{title}</h3>{values.length ? values.map(item => <div key={item.name} className="flex flex-wrap justify-between gap-2 border-b border-tea-border py-3"><span className={`${T.link} break-words`}>{item.name}</span><span className={`${T.mono} text-tea-text-sec`}>{fmtRecordDollars(item.value)}</span></div>) : <p className={`${T.bodyLight} text-tea-text-dim`}>No stock to summarise.</p>}</div>;
}

export const DashboardView = ({ products = [], isLoading }: { products?: Product[]; isLoading: boolean }) => {
  const activeAccountId = useAppStore(s => s.activeAccountId);
  const userScope = getTokenClaims()?.sub ?? 'anonymous';
  const scope = [activeAccountId ?? 'no-account', userScope];
  const { data: rates = [], isLoading: ratesLoading } = useRates();
  const attention = useQuery({ queryKey: ['dashboard-attention', ...scope], queryFn: () => api.attention.list(), staleTime: 60_000, retry: false });
  const revenue = useQuery({ queryKey: ['dashboard-revenue', ...scope], queryFn: async () => await api.analytics.revenue() as RevenueData, staleTime: 60_000, retry: false });
  const customers = useQuery({ queryKey: ['dashboard-rfm', ...scope], queryFn: async () => await api.analytics.rfm() as RFMData, staleTime: 60_000, retry: false });
  const metrics = useMemo(() => inventoryMetrics(products, rates), [products, rates]);
  const stock = useMemo(() => dashboardStockSignals(products), [products]);
  const weeks = revenue.data?.weekly_revenue ?? [];
  const salesTotal = weeks.reduce((total, w) => total + w.revenue, 0);
  const orderCount = weeks.reduce((total, w) => total + w.order_count, 0);
  const omitted = Array.from(metrics.costlessCurrencies.values()).reduce((sum, count) => sum + count, 0);
  const refresh = () => { void attention.refetch(); void revenue.refetch(); void customers.refetch(); };
  const refreshing = attention.isFetching || revenue.isFetching || customers.isFetching;

  return <>
    <header className="sticky top-0 z-sticky flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-tea-border bg-tea-bg/90 px-4 py-3 backdrop-blur-md md:px-6 lg:px-10">
      <h1 className={`${T.h2} text-tea-text`}>Today</h1>
      <button type="button" onClick={refresh} disabled={refreshing} className={`tap-target flex items-center gap-2 text-tea-text-sec disabled:opacity-50 ${T.link}`}><RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />Refresh</button>
    </header>
    <div className="mx-auto max-w-7xl space-y-10 px-4 pt-7 text-tea-text pb-nav-gap-lg md:px-6 lg:px-10">
      <section aria-labelledby="dashboard-attention">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className={`${T.label} mb-2 text-tea-text-dim`}>The working day</p><h2 id="dashboard-attention" className={T.h2}>What needs you</h2></div><Link to="/admin/activity?tab=orders" className={`tap-target ${T.link} text-tea-text-sec underline underline-offset-4`}>Open orders</Link></div>
        <ReadState failed={attention.isError} loading={attention.isPending} retry={() => void attention.refetch()} />
        {attention.isSuccess && attention.data.items.length === 0 && <p className={`${T.bodyLight} border-y border-tea-border py-5 text-tea-text-sec`}>No requests, prices, payment reports or paid orders waiting on you.</p>}
        {attention.isSuccess && attention.data.items.map(item => <Link key={`${item.kind}-${item.id}`} to={item.href} className={rowClass}>
          <span className="min-w-0"><span className={`${T.label} mb-1 block text-tea-gold`}>{ACTION[item.kind]}</span><span className={`${T.bodyLight} block break-words`}>{item.label}</span>{item.meta && <span className={`${T.accountMeta} block text-tea-text-dim`}>{item.meta}</span>}</span><ArrowUpRight size={18} className="shrink-0" aria-hidden="true" />
        </Link>)}
      </section>

      <section aria-labelledby="dashboard-stock"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 id="dashboard-stock" className={T.h2}>On the shelf</h2><Link to="/admin/stock" className={`tap-target ${T.link} underline underline-offset-4`}>Open stock</Link></div>
        {isLoading ? <p role="status" className={T.bodyLight}>Loading stock…</p> : products.length === 0 ? <p className={`${T.bodyLight} text-tea-text-sec`}>Your stock will appear here as you add it.</p> : <div className="grid gap-7 lg:grid-cols-3"><StockGroup title="Check the count" products={stock.recheck} note={() => 'Confirm what is on hand'} /><StockGroup title="Running low" products={stock.low} note={p => `${p.stockGrams} g on hand`} /><StockGroup title="On the way" products={stock.incoming} note={() => 'Review the incoming stock'} /></div>}
        {!isLoading && !ratesLoading && omitted > 0 && <div className="mt-5 border-l-2 border-tea-border pl-4"><p className={`${T.bodyLight} text-tea-text-sec`}>{omitted} {omitted === 1 ? 'tea is' : 'teas are'} left out of the cost total: {Array.from(metrics.costlessCurrencies.keys()).join(', ')} {metrics.costlessCurrencies.size === 1 ? 'has' : 'have'} no rate on file.</p><Link to="/admin/currency" className={`tap-target inline-flex items-center ${T.link} underline underline-offset-4`}>Set a rate</Link></div>}
      </section>

      <section aria-labelledby="dashboard-pulse" className="border-y border-tea-border py-6"><h2 id="dashboard-pulse" className={`${T.h2} mb-5`}>The business at a glance</h2>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-7 lg:grid-cols-4">
          {[['Fulfilled sales · 26 weeks', revenue.isSuccess ? fmtRecordDollars(salesTotal) : '—'], ['Orders · 26 weeks', revenue.isSuccess ? String(orderCount) : '—'], ['Stock at cost', isLoading || ratesLoading ? '—' : fmtRecordDollars(metrics.totalCostUSD)], ['Potential retail value', isLoading ? '—' : fmtRecordDollars(metrics.totalRetailUSD)]].map(([label, value]) => <div key={label} className="min-w-0"><dt className={`${T.label} text-tea-text-dim`}>{label}</dt><dd className="num mt-2 break-words text-ui-26 text-tea-text">{value}</dd></div>)}
        </dl>
        <ReadState failed={revenue.isError} loading={revenue.isPending} retry={() => void revenue.refetch()} />
        {revenue.isSuccess && <><p className={`${T.accountMeta} mt-5 text-tea-text-dim`}>Fulfilled invoice line items, grouped by the week the invoice was created. This is sales value, not cash received.</p>{weeks.length > 0 ? <div className="mt-5 h-48 min-w-0" aria-label="Fulfilled sales by invoice week"><ResponsiveContainer width="100%" height="100%"><LineChart data={weeks} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}><XAxis dataKey="week" stroke="var(--tea-text-dim)" fontSize={10} tickLine={false} axisLine={false} /><YAxis width={48} stroke="var(--tea-text-dim)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} /><Tooltip contentStyle={{ background: 'var(--tea-surface)', borderColor: 'var(--tea-border)', color: 'var(--tea-text)' }} formatter={(v: number) => [fmtRecordDollars(v), 'Sales']} /><Line dataKey="revenue" stroke="var(--tea-gold)" strokeWidth={2} dot={weeks.length === 1} /></LineChart></ResponsiveContainer></div> : <p className={`${T.bodyLight} mt-4 text-tea-text-dim`}>No fulfilled sales returned for this period.</p>}</>}
      </section>

      <section aria-labelledby="dashboard-people"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 id="dashboard-people" className={T.h2}>People to reconnect with</h2><Link to="/admin/people" className={`tap-target ${T.link} underline underline-offset-4`}>Open people</Link></div><ReadState failed={customers.isError} loading={customers.isPending} retry={() => void customers.refetch()} />
        {customers.isSuccess && <div className="grid gap-7 md:grid-cols-2">{[{ title: 'It’s been a while', note: 'No order in more than 90 days', people: customers.data.lapsed }, { title: 'First orders', note: 'New buyers in the last 30 days', people: customers.data.new_this_month }].map(group => <div key={group.title} className="min-w-0"><h3 className={T.h3}>{group.title}</h3><p className={`${T.accountMeta} mt-1 text-tea-text-dim`}>{group.note}</p>{group.people.length === 0 ? <p className={`${T.bodyLight} mt-3 text-tea-text-dim`}>Nobody in this group right now.</p> : group.people.slice(0, 6).map(person => <Link key={person.id} to={`/admin/people/${encodeURIComponent(person.id)}`} className={rowClass}><span className={`${T.link} break-words`}>{person.name}</span><ArrowUpRight size={15} className="shrink-0" aria-hidden="true" /></Link>)}</div>)}</div>}
      </section>

      {revenue.isSuccess && revenue.data.inventory_age_alerts.length > 0 && <section aria-labelledby="dashboard-resting"><h2 id="dashboard-resting" className={T.h2}>Worth revisiting</h2><p className={`${T.bodyLight} mt-2 text-tea-text-sec`}>Teas with no recorded sale, or none for 90 days. A prompt to review the selection.</p>{revenue.data.inventory_age_alerts.map(p => <Link key={p.id} to={`/admin/stock?search=${encodeURIComponent(p.product_name)}`} className={rowClass}><span className={`${T.link} min-w-0 break-words`}>{p.product_name}<span className={`${T.accountMeta} mt-1 block text-tea-text-dim`}>{p.last_sold_at ? 'No sale in 90+ days' : 'No recorded sale'} · {p.stock_grams} g on hand</span></span><ArrowUpRight size={15} className="shrink-0" aria-hidden="true" /></Link>)}</section>}

      <details className="border-t border-tea-border"><summary className={`cursor-pointer py-5 ${T.h3}`}>Explore the inventory</summary><p className={`${T.bodyLight} mb-5 text-tea-text-sec`}>Where the stock value sits. <Link to="/admin/currency" className="underline underline-offset-4">Review exchange rates</Link>.</p>{isLoading || ratesLoading ? <p className={T.bodyLight}>Loading inventory values…</p> : <div className="grid gap-7 md:grid-cols-3"><Breakdown title="Cost by currency" values={metrics.currencyExposure} /><Breakdown title="Retail by region" values={metrics.regionValue} /><Breakdown title="Retail by tea type" values={metrics.typeValue} /></div>}</details>
    </div>
  </>;
};
