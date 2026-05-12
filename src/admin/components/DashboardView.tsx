import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import type { TooltipProps } from 'recharts';
import { Loader2, DollarSign, PieChart as PieIcon, MapPin, TrendingUp, AlertCircle, UserPlus, Clock } from 'lucide-react';
import { Product, Customer } from '../types';
import { useRates } from '../hooks/useAdminData';
import { fmtDollars, fmtPct, fmtNum } from '../../utils/formatNumber';
import { api } from '../../lib/api';

const TooltipWrapper = (props: TooltipProps<number, string>) => (
    <RechartsTooltip
        {...props}
        contentStyle={{ backgroundColor: 'var(--tea-bg)', borderColor: 'var(--tea-surface)', color: 'var(--tea-text)', fontSize: '12px', borderRadius: '8px' }}
        itemStyle={{ color: 'var(--tea-text)' }}
        cursor={{ fill: 'var(--tea-surface)', opacity: 0.4 }}
    />
);

export const DashboardView = ({ products = [], isLoading }: { products?: Product[], isLoading: boolean }) => {
  const navigate = useNavigate();
  const { data: rates = [] } = useRates();

  const [customers, setCustomers] = useState<Customer[]>([]);

  interface WeeklyRevenue { week: string; revenue: number; order_count: number; }
  interface RFMCustomer { id: string; name: string; email: string; lifetime_usd: number; order_count: number; last_order_at?: string; first_order_at?: string; }
  interface InventoryAlert { id: string; product_name: string; stock_grams: number; last_sold_at: string | null; }
  interface RFMData { top10: RFMCustomer[]; lapsed: RFMCustomer[]; new_this_month: RFMCustomer[]; }
  interface RevenueData { weekly_revenue: WeeklyRevenue[]; inventory_age_alerts: InventoryAlert[]; }

  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [rfmData, setRfmData] = useState<RFMData | null>(null);
  const [analyticsError, setAnalyticsError] = useState(false);

  useEffect(() => {
    api.customers.list().then((data: unknown) => {
      const list = Array.isArray(data) ? data : (data as { customers?: Customer[] }).customers ?? [];
      setCustomers(list as Customer[]);
    }).catch(() => {});

    Promise.all([
      api.analytics.revenue().then((d: unknown) => setRevenueData(d as RevenueData)),
      api.analytics.rfm().then((d: unknown) => setRfmData(d as RFMData)),
    ]).catch(() => setAnalyticsError(true));
  }, []);

  const handleChartClick = useCallback((dimension: string, value: string) => {
    navigate(`/admin/inventory?search=${encodeURIComponent(value)}`);
  }, [navigate]);

  const metrics = useMemo(() => {
    if (isLoading || products.length === 0) return null;

    let totalCostUSD = 0;
    let totalRetailUSD = 0;
    let currencyExposure: Record<string, number> = {};
    let regionValue: Record<string, number> = {};
    let typeValue: Record<string, number> = {};

    products.forEach(p => {
        // Skip archived items for valuation
        if (p.status === 'Archived') return;

        // 1. Currency Conversion Logic
        // We use the raw cost_amount stored in the product (in source currency)
        // Convert it to USD using the *current* real-time rate
        const rateObj = rates.find(r => r.currency === p.costCurrency);
        const rateToUSD = rateObj ? rateObj.rateToUSD : 1;
        
        // Calculate Cost per gram in USD based on CURRENT rates (removes "weirdness" of stale DB calculations)
        // Logic: (Total Batch Cost / Total Batch Weight) / Rate
        const validBatchWeight = p.quantityPurchased > 0 ? p.quantityPurchased : 1;
        const costPerGramRaw = p.costAmount / validBatchWeight;
        const costPerGramUSD = costPerGramRaw / rateToUSD;
        
        const itemTotalCostUSD = costPerGramUSD * p.stockGrams;
        const itemTotalRetailUSD = (p.fixedRetailPriceUSD ?? p.pricePerGramUSD) * p.stockGrams;

        totalCostUSD += itemTotalCostUSD;
        totalRetailUSD += itemTotalRetailUSD;

        // 2. Currency Exposure (Track Raw Spending in USD Terms)
        // Group by Source Currency to see "How much money do I have trapped in NTD?"
        const currencyKey = p.costCurrency || 'USD';
        currencyExposure[currencyKey] = (currencyExposure[currencyKey] || 0) + itemTotalCostUSD;

        // 3. Region Value
        const region = p.originRegion || 'Unknown';
        regionValue[region] = (regionValue[region] || 0) + itemTotalRetailUSD;

        // 4. Type Value
        const type = p.type || 'Misc';
        typeValue[type] = (typeValue[type] || 0) + itemTotalRetailUSD;
    });

    return {
        totalCostUSD,
        totalRetailUSD,
        potentialProfit: totalRetailUSD - totalCostUSD,
        currencyExposure: Object.entries(currencyExposure)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value),
        regionValue: Object.entries(regionValue)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8), // Top 8 regions
        typeValue: Object.entries(typeValue)
            .map(([name, value]) => ({ name, value }))
    };
  }, [products, rates, isLoading]);

  const customerMetrics = useMemo(() => {
    if (!customers.length) return null;

    const totalCustomers = customers.length;
    const withOrders = customers.filter((c) => (c.orderCount || 0) > 0);
    const totalRevenue = withOrders.reduce((sum: number, c) => sum + (c.totalSpentUSD || 0), 0);
    const avgOrderValue = withOrders.length > 0 ? totalRevenue / withOrders.reduce((sum: number, c) => sum + (c.orderCount || 0), 0) : 0;

    // Tag distribution
    const tagCounts: Record<string, number> = {};
    customers.forEach((c) => {
      const tags = Array.isArray(c.tags) ? c.tags : (typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : []);
      tags.forEach((t: string) => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
    });

    // Top customers by spend
    const topCustomers = [...withOrders]
      .sort((a, b) => (b.totalSpentUSD || 0) - (a.totalSpentUSD || 0))
      .slice(0, 5);

    // Event attendees (customers who've attended events)
    const eventAttendees = customers.filter((c) => (c.eventCount || 0) > 0).length;

    return {
      totalCustomers,
      activeCustomers: withOrders.length,
      totalRevenue,
      avgOrderValue,
      tagCounts,
      topCustomers,
      eventAttendees,
    };
  }, [customers]);

  if (isLoading || !metrics) {
    return <div className="p-12 text-center text-tea-text-sec flex justify-center items-center text-ui-13"><Loader2 className="animate-spin mr-2" size={18} /> Analyzing financial data...</div>;
  }

  // Colors
  const COLORS_CURRENCY = ['#C8A97E', '#859F85', '#A67B70', '#D4C586', '#8B8C89', '#5C544E'];
  const COLORS_TYPE = ['#C8A97E', '#DBC19D', '#E8E3D9', '#A39B8E', '#5C544E', '#26221D'];

  return (
    <>
    <div className="sticky top-0 z-sticky bg-tea-bg/90 backdrop-blur-md border-b border-tea-border flex-shrink-0 flex items-center h-16 px-4 md:px-6 lg:px-10">
      <h1 className="h2 text-tea-text">Dashboard</h1>
    </div>
    <div className="px-4 md:px-6 lg:px-10 pt-6 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-nav-gap-lg">

      {/* KPI Cards — horizontal scroll on mobile, grid on desktop */}
      <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-6 overflow-x-auto pb-2 md:pb-0 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-xl relative overflow-hidden min-w-[260px] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink">
          <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 text-tea-gold">
             <DollarSign size={60} strokeWidth={1} className="md:w-20 md:h-20" />
          </div>
          <p className="label-caps text-tea-text-dim mb-2 md:mb-4">Total Asset Cost</p>
          <h3 className="font-display font-light text-tea-text num text-ui-28 md:text-[44px] leading-tight">{fmtDollars(metrics.totalCostUSD)}</h3>
          <p className="text-ui-11 md:text-ui-12 text-tea-text-sec mt-2 md:mt-4 num">Capital deployed</p>
        </div>

        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-xl relative overflow-hidden min-w-[260px] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink">
          <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 text-tea-gold">
             <PieIcon size={60} strokeWidth={1} className="md:w-20 md:h-20" />
          </div>
          <p className="label-caps text-tea-text-dim mb-2 md:mb-4">Retail Valuation</p>
          <h3 className="font-display font-light text-tea-text num text-ui-28 md:text-[44px] leading-tight">{fmtDollars(metrics.totalRetailUSD)}</h3>
          <p className="text-ui-11 md:text-ui-12 text-tea-text-sec mt-2 md:mt-4 num">At current prices</p>
        </div>

        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-xl relative overflow-hidden min-w-[260px] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink">
          <p className="label-caps text-tea-text-dim mb-2 md:mb-4">Unrealized P&L</p>
          <h3 className="font-display font-light text-tea-gold num text-ui-28 md:text-[44px] leading-tight">+{fmtDollars(metrics.potentialProfit)}</h3>
          <p className="text-ui-11 md:text-ui-12 text-tea-text-sec mt-2 md:mt-4 num">Margin: {fmtPct(metrics.totalCostUSD > 0 ? (metrics.potentialProfit / metrics.totalCostUSD) * 100 : 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">

        {/* CHART 1: Currency Exposure */}
        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-xl h-72 md:h-96">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <h4 className="h3 text-tea-text">Capital Exposure by Currency</h4>
            <div className="label-caps text-tea-text-dim">USD Equiv.</div>
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={metrics.currencyExposure}
                cx="50%"
                cy="45%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
                style={{ cursor: 'pointer' }}
                onClick={(data) => data && handleChartClick('currency', data.name)}
              >
                {metrics.currencyExposure.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS_CURRENCY[index % COLORS_CURRENCY.length]} />
                ))}
              </Pie>
              <RechartsTooltip 
                 contentStyle={{ backgroundColor: '#141210', borderColor: '#26221D', color: '#E8E3D9', fontSize: '12px', borderRadius: '8px' }}
                 formatter={(value: number) => fmtDollars(value)}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                formatter={(value, entry: any) => <span className="text-tea-text-sec text-xs ml-1">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* CHART 2: Live Exchange Rates */}
        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-xl h-auto md:h-96 flex flex-col">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <div>
              <h4 className="h3 text-tea-text">Live Exchange Rates</h4>
              <div className="label-caps text-tea-text-dim">Base: 1 USD</div>
            </div>
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-ui-10 uppercase tracking-caps bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40">
              <span className="w-1.5 h-1.5 rounded-full bg-tea-gold animate-pulse"></span>
              Live
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-2 space-y-2 md:space-y-3">
            {rates.filter(r => r.currency !== 'USD' && r.currency !== 'UNK').map(rate => (
              <div key={rate.currency} className="flex justify-between items-center p-2.5 md:p-3 bg-tea-bg/50 border border-tea-border rounded-md">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-tea-elevated text-tea-text-sec font-display flex items-center justify-center text-ui-11">
                    {rate.currency}
                  </div>
                  <span className="text-ui-13 md:text-ui-14 text-tea-text">
                    {rate.currency === 'NT' ? 'TWD' :
                     rate.currency === 'Yuan' ? 'CNY' :
                     rate.currency === 'IDR' ? 'IDR' :
                     rate.currency === 'JPY' ? 'JPY' :
                     rate.currency === 'MYR' ? 'MYR' : rate.currency}
                    <span className="hidden md:inline">
                      {rate.currency === 'NT' ? ' — New Taiwan Dollar' :
                       rate.currency === 'Yuan' ? ' — Chinese Yuan' :
                       rate.currency === 'IDR' ? ' — Indonesian Rupiah' :
                       rate.currency === 'JPY' ? ' — Japanese Yen' :
                       rate.currency === 'MYR' ? ' — Malaysian Ringgit' : ''}
                    </span>
                  </span>
                </div>
                <div className="text-right">
                  <div className="num text-tea-text text-ui-14 md:text-ui-16">{fmtNum(rate.rateToUSD)}</div>
                  <div className="text-ui-11 text-tea-text-dim">per USD</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHART 3: Value by Region */}
        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-xl h-72 md:h-96">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <h4 className="h3 text-tea-text">Asset Value by Terroir</h4>
            <MapPin className="w-4 h-4 text-tea-text-sec" />
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.regionValue} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26221D" horizontal={false} />
              <XAxis type="number" stroke="#A39B8E" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
              <YAxis dataKey="name" type="category" stroke="#A39B8E" fontSize={10} tickLine={false} axisLine={false} width={80} />
              <TooltipWrapper formatter={(val: number) => `$${val.toLocaleString()}`} />
              <Bar dataKey="value" fill="#26221D" radius={[0, 4, 4, 0]} barSize={20} style={{ cursor: 'pointer' }} onClick={(data) => data && handleChartClick('region', data.name)}>
                {metrics.regionValue.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index < 3 ? '#C8A97E' : '#26221D'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CHART 4: Portfolio Composition */}
        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-xl h-72 md:h-96 lg:col-span-2">
           <h4 className="h3 text-tea-text mb-4 md:mb-6">Portfolio Distribution (Retail Value)</h4>
           <ResponsiveContainer width="100%" height="90%">
            <BarChart data={metrics.typeValue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26221D" vertical={false} />
              <XAxis dataKey="name" stroke="#A39B8E" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#A39B8E" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
              <TooltipWrapper formatter={(val: number) => `$${val.toLocaleString()}`} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} style={{ cursor: 'pointer' }} onClick={(data) => data && handleChartClick('type', data.name)}>
                 {metrics.typeValue.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_TYPE[index % COLORS_TYPE.length]} />
                 ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Analytics error state */}
      {analyticsError && (
        <div className="mt-8 flex items-center gap-2 text-ui-12 text-tea-text-sec bg-tea-surface border border-tea-border rounded-md px-4 py-3">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-tea-error" />
          Revenue and customer analytics failed to load. Check your session or try refreshing.
        </div>
      )}

      {/* Revenue over time */}
      {revenueData && revenueData.weekly_revenue.length > 0 && (
        <div className="mt-8">
          <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-xl h-64 md:h-80">
            <div className="flex items-center gap-2 mb-4 md:mb-6">
              <TrendingUp className="w-4 h-4 text-tea-gold" />
              <h4 className="h3 text-tea-text">Weekly Revenue (Last 6 Months)</h4>
            </div>
            <ResponsiveContainer width="100%" height="80%">
              <LineChart data={revenueData.weekly_revenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#26221D" vertical={false} />
                <XAxis dataKey="week" stroke="#A39B8E" fontSize={9} tickLine={false} axisLine={false}
                  tickFormatter={(w: string) => { const [, wk] = w.split('-W'); return `W${wk}`; }} />
                <YAxis stroke="#A39B8E" fontSize={10} tickLine={false} axisLine={false}
                  tickFormatter={(v: number) => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
                <RechartsTooltip
                  contentStyle={{ backgroundColor: '#141210', borderColor: '#26221D', color: '#E8E3D9', fontSize: '12px', borderRadius: '8px' }}
                  formatter={(v: number) => [`$${v.toFixed(0)}`, 'Revenue']}
                  labelFormatter={(w: string) => `Week ${w.split('-W')[1]}`}
                />
                <Line type="monotone" dataKey="revenue" stroke="#C8A97E" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#C8A97E' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Inventory age alerts */}
          {revenueData.inventory_age_alerts.length > 0 && (
            <div className="mt-4 bg-tea-surface border border-tea-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-4 h-4 text-tea-error" />
                <h4 className="label-caps text-tea-text-dim">Inventory Not Sold in 90+ Days</h4>
              </div>
              <div className="space-y-2">
                {revenueData.inventory_age_alerts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/admin/inventory?search=${encodeURIComponent(p.product_name)}`)}
                    className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-tea-accent-sub transition-colors text-left group"
                  >
                    <span className="text-ui-14 text-tea-text group-hover:text-tea-gold transition-colors truncate">{p.product_name}</span>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-ui-12 text-tea-text-dim num">{p.stock_grams}g in stock</span>
                      <span className="text-ui-10 text-tea-error">{p.last_sold_at ? 'stale' : 'never sold'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Customer Intelligence — RFM */}
      {(customerMetrics || rfmData) && (
        <div className="mt-8">
          <h2 className="label-caps text-tea-text-dim mb-4">
            Customer Intelligence
          </h2>

          {/* KPI cards */}
          {customerMetrics && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-tea-surface border border-tea-border rounded-xl p-4">
                <p className="label-caps text-tea-text-dim">Total Customers</p>
                <p className="font-display font-light text-tea-text mt-1 num text-ui-26">{customerMetrics.totalCustomers}</p>
              </div>
              <div className="bg-tea-surface border border-tea-border rounded-xl p-4">
                <p className="label-caps text-tea-text-dim">Active Buyers</p>
                <p className="font-display font-light text-tea-text mt-1 num text-ui-26">{customerMetrics.activeCustomers}</p>
              </div>
              <div className="bg-tea-surface border border-tea-border rounded-xl p-4">
                <p className="label-caps text-tea-text-dim">Total Revenue</p>
                <p className="font-display font-light text-tea-gold mt-1 num text-ui-26">${customerMetrics.totalRevenue.toFixed(0)}</p>
              </div>
              <div className="bg-tea-surface border border-tea-border rounded-xl p-4">
                <p className="label-caps text-tea-text-dim">Avg Order Value</p>
                <p className="font-display font-light text-tea-text mt-1 num text-ui-26">${customerMetrics.avgOrderValue.toFixed(0)}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top 10 by spend */}
            {rfmData && rfmData.top10.length > 0 && (
              <div className="bg-tea-surface border border-tea-border rounded-xl p-4 lg:col-span-1">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-3.5 h-3.5 text-tea-gold" />
                  <h3 className="label-caps text-tea-text-dim">Top by Spend</h3>
                </div>
                <div className="space-y-2">
                  {rfmData.top10.map((c, i) => (
                    <button key={c.id} onClick={() => navigate(`/admin/people?search=${encodeURIComponent(c.name)}`)}
                      className="flex items-center justify-between w-full px-1 py-1 rounded hover:bg-tea-accent-sub transition-colors text-left group">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-ui-10 font-mono text-tea-text-dim w-4 shrink-0">{i + 1}</span>
                        <span className="text-ui-14 text-tea-text group-hover:text-tea-gold transition-colors truncate">{c.name}</span>
                      </div>
                      <span className="text-ui-14 font-mono text-tea-gold shrink-0 ml-2">${c.lifetime_usd.toFixed(0)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Lapsed (>90 days) */}
            {rfmData && rfmData.lapsed.length > 0 && (
              <div className="bg-tea-surface border border-tea-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-tea-text-sec" />
                  <h3 className="label-caps text-tea-text-dim">Lapsed · 90+ Days</h3>
                </div>
                <div className="space-y-2">
                  {rfmData.lapsed.slice(0, 8).map((c) => (
                    <button key={c.id} onClick={() => navigate(`/admin/people?search=${encodeURIComponent(c.name)}`)}
                      className="flex items-center justify-between w-full px-1 py-1 rounded hover:bg-tea-accent-sub transition-colors text-left group">
                      <span className="text-ui-14 text-tea-text group-hover:text-tea-gold transition-colors truncate">{c.name}</span>
                      <span className="text-ui-10 text-tea-text-dim shrink-0 ml-2">
                        {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* New this month */}
            {rfmData && rfmData.new_this_month.length > 0 && (
              <div className="bg-tea-surface border border-tea-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <UserPlus className="w-3.5 h-3.5 text-tea-green" />
                  <h3 className="label-caps text-tea-text-dim">New This Month</h3>
                </div>
                <div className="space-y-2">
                  {rfmData.new_this_month.slice(0, 8).map((c) => (
                    <button key={c.id} onClick={() => navigate(`/admin/people?search=${encodeURIComponent(c.name)}`)}
                      className="flex items-center justify-between w-full px-1 py-1 rounded hover:bg-tea-accent-sub transition-colors text-left group">
                      <span className="text-ui-14 text-tea-text group-hover:text-tea-gold transition-colors truncate">{c.name}</span>
                      <span className="text-ui-10 text-tea-gold shrink-0 ml-2">${c.lifetime_usd.toFixed(0)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
};