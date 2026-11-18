import React, { useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, ShoppingBag } from 'lucide-react';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useAppStore } from '../../lib/store';
import { TeaCard, TeaCardMeta, TeaCardMetric, TeaCardTitle } from '../tea/TeaCard';
import { useRates } from '../../admin/hooks/useAdminData';
import { formatCurrency } from '../../admin/utils';
import { rateToUsd } from '../../lib/currency';
import { purchaseSpendInUsd } from './curatePricing';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function getPrevMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

// ─── Main component ───────────────────────────────────────────────────────────

export const LedgerOverviewPanel: React.FC = () => {
  const transactions = useLedgerStore((s) => s.transactions);
  const createTransaction = useLedgerStore((s) => s.createTransaction);
  const openPurchaseOrder = useAppStore((s) => s.openPurchaseOrder);
  const { data: rates } = useRates();
  const activeCurrency = useAppStore((s) => s.currency);

  // Every confirmed purchase, whatever it was paid in, converted at the shop's
  // rates and shown in the currency the site is set to. This used to keep only
  // purchases paid in the display currency, so with the site on dollars every
  // yuan purchase vanished from the totals.
  const spend = useMemo(
    () => purchaseSpendInUsd(
      transactions.filter((t) => t.direction === 'purchase' && t.status === 'confirmed'),
      rates,
    ),
    [transactions, rates]
  );
  const confirmed = spend.priced;
  const unpriced = Object.entries(spend.unpricedByCurrency);
  // The admin's formatter, which converts and then rounds once. The shop's
  // customer-facing total rounds up to a whole dollar first, which turned a
  // ¥700 purchase into ¥706.
  const shownIn = rateToUsd(rates, activeCurrency) ? activeCurrency : 'USD';
  const fmtAmount = (usd: number) => formatCurrency(usd, shownIn, rates ?? []);
  const fmtDelta = (usd: number) => `${usd >= 0 ? '+' : '−'}${fmtAmount(Math.abs(usd))}`;

  const stats = useMemo(() => {
    const currentMonth = getCurrentMonth();
    const prevMonth = getPrevMonth();

    let totalAllTime = 0;
    let thisMonth = 0;
    let lastMonth = 0;
    const vendorMap = new Map<string, number>();
    const categoryCountMap: Record<string, number> = { Tea: 0, Teaware: 0, Samples: 0, Other: 0 };

    for (const { tx, usd: amount } of confirmed) {
      totalAllTime += amount;

      const txMonth = tx.updatedAt.slice(0, 7);
      if (txMonth === currentMonth) thisMonth += amount;
      if (txMonth === prevMonth) lastMonth += amount;

      const vendor = tx.counterpartyName || 'Unknown';
      vendorMap.set(vendor, (vendorMap.get(vendor) ?? 0) + amount);

      tx.items.forEach(item => {
        const t = (item.type || '').toLowerCase();
        let cat = 'Tea';
        if (t === 'teaware') cat = 'Teaware';
        else if (t === 'sample' || t === 'samples') cat = 'Samples';
        else if (t && !['white', 'green', 'yellow', 'oolong', 'black', 'dark', 'puer', 'pu-erh', 'puerh', 'raw', 'ripe', 'tea'].some((k) => t.includes(k))) {
          cat = 'Other';
        }
        categoryCountMap[cat] += 1;
      });
    }

    // Top 5 vendors by spend
    const topVendors = [...vendorMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const delta = thisMonth - lastMonth;

    return {
      totalAllTime,
      totalPurchases: confirmed.length,
      thisMonth,
      lastMonth,
      delta,
      topVendors,
      categoryCountMap,
    };
  }, [confirmed]);

  const hasData = confirmed.length > 0 || unpriced.length > 0;

  return (
    <aside aria-label="Purchase spending" className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <TeaCard
        title={<TeaCardTitle as="h2">Spending</TeaCardTitle>}
        meta={<TeaCardMeta primary={`${stats.totalPurchases} priced ${stats.totalPurchases === 1 ? 'purchase' : 'purchases'}`} trailing={shownIn} />}
        metrics={hasData ? <>
          <TeaCardMetric label="Total">{fmtAmount(stats.totalAllTime)}</TeaCardMetric>
          <TeaCardMetric label="This month">{fmtAmount(stats.thisMonth)}</TeaCardMetric>
        </> : undefined}
      >
        {!hasData && <p className="px-3 py-2 text-ui-12 text-tea-text-sec">No purchases recorded yet.</p>}
        {stats.lastMonth > 0 && <p className="px-3 py-1 text-ui-12 text-tea-text-sec">{fmtDelta(stats.delta)} vs last month</p>}
        {unpriced.length > 0 && (
          <p className="px-3 py-1 text-ui-12 text-tea-text-sec" data-testid="ledger-unpriced">
            Missing exchange rates for {unpriced.map(([cur, n]) => `${n} in ${cur}`).join(', ')}.
          </p>
        )}
        {stats.topVendors.length > 0 && (
          <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1 border-t border-tea-border px-3 py-2 text-ui-12">
            {stats.topVendors.map(([vendor, amount]) => (
              <React.Fragment key={vendor}>
                <dt className="min-w-0 break-words text-tea-text-sec">{vendor}</dt>
                <dd className="tabular-nums text-tea-text">{fmtAmount(amount)}</dd>
              </React.Fragment>
            ))}
          </dl>
        )}
        {Object.values(stats.categoryCountMap).some(count => count > 0) && (
          <p className="flex flex-wrap gap-x-3 border-t border-tea-border px-3 py-2 text-ui-12 text-tea-text-sec">
            {Object.entries(stats.categoryCountMap).filter(([, count]) => count > 0).map(([category, count]) => (
              <span key={category}>{category} {count}</span>
            ))}
          </p>
        )}
      </TeaCard>
      <div className="flex flex-wrap gap-x-3">
        <button type="button" onClick={() => openPurchaseOrder()} className="tap-target inline-flex min-h-tap items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text">
          <ShoppingBag size={13} aria-hidden="true" /> Purchase Order Builder
        </button>
        <button type="button" onClick={() => createTransaction('purchase', '', 'NT')} className="tap-target inline-flex min-h-tap items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text">
          <ArrowDownLeft size={13} aria-hidden="true" /> Quick Note
        </button>
        <button type="button" onClick={() => createTransaction('sale', '', 'USD')} className="tap-target inline-flex min-h-tap items-center gap-1.5 text-ui-12 text-tea-text-sec hover:text-tea-text">
          <ArrowUpRight size={13} aria-hidden="true" /> Quick Sale
        </button>
      </div>
    </aside>
  );
};

export default LedgerOverviewPanel;
