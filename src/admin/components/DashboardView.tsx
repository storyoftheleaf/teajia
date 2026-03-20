import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Loader2, DollarSign, PieChart as PieIcon, MapPin } from 'lucide-react';
import { Product } from '../types';
import { useRates } from '../hooks/useAdminData';
import { fmtDollars, fmtPct, fmtNum } from '../../utils/formatNumber';

const TooltipWrapper = (props: any) => (
    <RechartsTooltip 
        {...props}
        contentStyle={{ backgroundColor: '#141210', borderColor: '#26221D', color: '#E8E3D9', fontSize: '12px', borderRadius: '8px' }}
        itemStyle={{ color: '#E8E3D9' }}
        cursor={{fill: '#26221D', opacity: 0.4}}
    />
);

export const DashboardView = ({ products, isLoading }: { products: Product[], isLoading: boolean }) => {
  const { data: rates = [] } = useRates();

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

  if (isLoading || !metrics) {
    return <div className="p-12 text-center text-tea-text-sec flex justify-center items-center"><Loader2 className="animate-spin mr-2" /> Analyzing financial data...</div>;
  }

  // Colors
  const COLORS_CURRENCY = ['#C8A97E', '#859F85', '#A67B70', '#D4C586', '#8B8C89', '#5C544E'];
  const COLORS_TYPE = ['#C8A97E', '#DBC19D', '#E8E3D9', '#A39B8E', '#5C544E', '#26221D'];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 md:space-y-8 pb-24">
      <div className="flex justify-between items-end border-b border-tea-border pb-4 md:pb-6">
          <div>
            <h2 className="text-2xl md:text-5xl font-serif text-tea-text tracking-tight">Financial Intelligence</h2>
            <p className="text-tea-text-sec text-xs md:text-sm mt-1 md:mt-2 font-light tracking-wide">Real-time valuation based on current exchange rates.</p>
          </div>
      </div>

      {/* KPI Cards — horizontal scroll on mobile, grid on desktop */}
      <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-6 overflow-x-auto pb-2 md:pb-0 snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-lg relative overflow-hidden group hover:border-tea-gold/30 transition-colors duration-200 min-w-[260px] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink">
          <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 group-hover:opacity-10 transition-opacity text-tea-gold">
             <DollarSign size={60} strokeWidth={1} className="md:w-20 md:h-20" />
          </div>
          <p className="text-tea-text-sec text-[10px] md:text-xs uppercase tracking-[0.2em] mb-2 md:mb-4 font-bold">Total Asset Cost</p>
          <h3 className="text-2xl md:text-5xl font-serif font-light text-tea-text num">{fmtDollars(metrics.totalCostUSD)}</h3>
          <p className="text-[10px] md:text-xs text-tea-text-sec/70 mt-2 md:mt-4 num">Capital deployed</p>
        </div>

        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-lg relative overflow-hidden group hover:border-tea-gold/30 transition-colors duration-200 min-w-[260px] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink">
          <div className="absolute top-0 right-0 p-4 md:p-6 opacity-5 group-hover:opacity-10 transition-opacity text-tea-gold">
             <PieIcon size={60} strokeWidth={1} className="md:w-20 md:h-20" />
          </div>
          <p className="text-tea-text-sec text-[10px] md:text-xs uppercase tracking-[0.2em] mb-2 md:mb-4 font-bold">Retail Valuation</p>
          <h3 className="text-2xl md:text-5xl font-serif font-light text-tea-text num">{fmtDollars(metrics.totalRetailUSD)}</h3>
          <p className="text-[10px] md:text-xs text-tea-text-sec/70 mt-2 md:mt-4 num">At current prices</p>
        </div>

        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-lg relative overflow-hidden group hover:border-tea-gold/30 transition-colors duration-200 min-w-[260px] md:min-w-0 snap-center flex-shrink-0 md:flex-shrink">
          <p className="text-tea-text-sec text-[10px] md:text-xs uppercase tracking-[0.2em] mb-2 md:mb-4 font-bold">Unrealized P&L</p>
          <h3 className="text-2xl md:text-5xl font-serif font-light text-tea-gold num">+{fmtDollars(metrics.potentialProfit)}</h3>
          <p className="text-[10px] md:text-xs text-tea-text-sec/70 mt-2 md:mt-4 num">Margin: {fmtPct(metrics.totalCostUSD > 0 ? (metrics.potentialProfit / metrics.totalCostUSD) * 100 : 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">

        {/* CHART 1: Currency Exposure */}
        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-lg h-72 md:h-96">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <h4 className="text-sm font-medium text-tea-text font-serif">Capital Exposure by Currency</h4>
            <div className="text-[10px] md:text-xs text-tea-text-sec uppercase tracking-wider">USD Equiv.</div>
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
        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-lg h-auto md:h-96 flex flex-col">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <div>
              <h4 className="text-sm font-medium text-tea-text font-serif">Live Exchange Rates</h4>
              <div className="text-[10px] md:text-xs text-tea-text-sec uppercase tracking-wider">Base: 1 USD</div>
            </div>
            <div className="text-[10px] md:text-xs text-tea-gold bg-tea-gold/10 px-2 py-1 rounded-full flex items-center gap-1 border border-tea-gold/20">
              <span className="w-1.5 h-1.5 rounded-full bg-tea-gold animate-pulse"></span>
              Live
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 md:pr-2 space-y-2 md:space-y-3">
            {rates.filter(r => r.currency !== 'USD' && r.currency !== 'UNK').map(rate => (
              <div key={rate.currency} className="flex justify-between items-center p-2.5 md:p-3 bg-tea-bg/50 border border-tea-border rounded-lg">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-tea-surface border border-tea-border flex items-center justify-center text-[10px] md:text-xs font-bold text-tea-text-sec">
                    {rate.currency}
                  </div>
                  <span className="text-xs md:text-sm text-tea-text font-medium">
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
                  <div className="num text-tea-text text-sm md:text-base">{fmtNum(rate.rateToUSD)}</div>
                  <div className="text-[10px] md:text-xs text-tea-text-sec">per USD</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHART 3: Value by Region */}
        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-lg h-72 md:h-96">
          <div className="flex justify-between items-center mb-4 md:mb-6">
            <h4 className="text-sm font-medium text-tea-text font-serif">Asset Value by Terroir</h4>
            <MapPin className="w-4 h-4 text-tea-text-sec" />
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.regionValue} layout="vertical" margin={{ top: 5, right: 20, left: 30, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26221D" horizontal={false} />
              <XAxis type="number" stroke="#A39B8E" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
              <YAxis dataKey="name" type="category" stroke="#A39B8E" fontSize={10} tickLine={false} axisLine={false} width={80} />
              <TooltipWrapper formatter={(val: number) => `$${val.toLocaleString()}`} />
              <Bar dataKey="value" fill="#26221D" radius={[0, 4, 4, 0]} barSize={20}>
                {metrics.regionValue.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={index < 3 ? '#C8A97E' : '#26221D'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* CHART 4: Portfolio Composition */}
        <div className="bg-tea-surface border border-tea-border p-5 md:p-8 rounded-lg h-72 md:h-96 lg:col-span-2">
           <h4 className="text-sm font-medium text-tea-text font-serif mb-4 md:mb-6">Portfolio Distribution (Retail Value)</h4>
           <ResponsiveContainer width="100%" height="90%">
            <BarChart data={metrics.typeValue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#26221D" vertical={false} />
              <XAxis dataKey="name" stroke="#A39B8E" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#A39B8E" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
              <TooltipWrapper formatter={(val: number) => `$${val.toLocaleString()}`} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                 {metrics.typeValue.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS_TYPE[index % COLORS_TYPE.length]} />
                 ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};