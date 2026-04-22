import React, { useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, ShoppingBag } from 'lucide-react';
import { useLedgerStore } from '../../lib/ledgerStore';
import type { LedgerLineItem, LedgerTransaction } from '../../lib/ledgerStore';
import { useAppStore } from '../../lib/store';
import { CompassIcon } from './CompassIcon';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', NT: 'NT$', Yuan: '¥', IDR: 'Rp', JPY: '¥', MYR: 'RM', HKD: 'HK$', AUD: 'A$', UNK: '',
};

function fmtAmount(amount: number, currency = 'USD'): string {
  const sym = CURRENCY_SYMBOLS[currency] || '';
  const decimals = ['NT', 'IDR', 'JPY'].includes(currency) ? 0 : 2;
  return `${sym}${amount.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function itemTotal(item: LedgerLineItem): number {
  if (item.priceIsPerGram && item.quantityGrams) return item.pricePerUnit * item.quantityGrams;
  if (!item.priceIsPerGram && item.quantityUnits) return item.pricePerUnit * item.quantityUnits;
  return item.pricePerUnit;
}

function txTotal(tx: LedgerTransaction): number {
  return tx.items.reduce((sum, item) => sum + itemTotal(item), 0);
}

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function getPrevMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

const SECTION_LABEL = 'text-[10px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-3';

// ─── Main component ───────────────────────────────────────────────────────────

export const LedgerOverviewPanel: React.FC = () => {
  const transactions = useLedgerStore((s) => s.transactions);
  const createTransaction = useLedgerStore((s) => s.createTransaction);
  const openPurchaseOrder = useAppStore((s) => s.openPurchaseOrder);
  const activeCurrency = useAppStore((s) => s.currency);

  const confirmed = useMemo(
    () => transactions.filter(
      (t) => t.direction === 'purchase' && t.status === 'confirmed' && t.currency === activeCurrency
    ),
    [transactions, activeCurrency]
  );

  const stats = useMemo(() => {
    const currentMonth = getCurrentMonth();
    const prevMonth = getPrevMonth();

    let totalAllTime = 0;
    let thisMonth = 0;
    let lastMonth = 0;
    const vendorMap = new Map<string, number>();
    const categoryMap: Record<string, number> = { Tea: 0, Teaware: 0, Samples: 0, Other: 0 };
    const categoryCountMap: Record<string, number> = { Tea: 0, Teaware: 0, Samples: 0, Other: 0 };

    for (const tx of confirmed) {
      const amount = txTotal(tx);
      totalAllTime += amount;

      const txMonth = tx.updatedAt.slice(0, 7);
      if (txMonth === currentMonth) thisMonth += amount;
      if (txMonth === prevMonth) lastMonth += amount;

      const vendor = tx.counterpartyName || 'Unknown';
      vendorMap.set(vendor, (vendorMap.get(vendor) ?? 0) + amount);

      for (const item of tx.items) {
        const t = (item.type || '').toLowerCase();
        let cat = 'Tea';
        if (t === 'teaware') cat = 'Teaware';
        else if (t === 'sample' || t === 'samples') cat = 'Samples';
        else if (t && !['white', 'green', 'yellow', 'oolong', 'black', 'dark', 'puer', 'pu-erh', 'puerh', 'raw', 'ripe', 'tea'].some((k) => t.includes(k))) {
          cat = 'Other';
        }
        categoryMap[cat] += itemTotal(item);
        categoryCountMap[cat] += 1;
      }
    }

    // Top 5 vendors by spend
    const topVendors = [...vendorMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const maxVendorAmount = topVendors[0]?.[1] ?? 1;

    const delta = thisMonth - lastMonth;

    return {
      totalAllTime,
      totalPurchases: confirmed.length,
      thisMonth,
      lastMonth,
      delta,
      topVendors,
      maxVendorAmount,
      categoryMap,
      categoryCountMap,
    };
  }, [confirmed]);

  const hasData = confirmed.length > 0;

  return (
    <div
      className="flex flex-col h-full overflow-y-auto px-6 py-5 space-y-6"
      style={{ scrollbarGutter: 'stable' }}
    >

      {/* ── Spending Overview ── */}
      <div>
        <p className={SECTION_LABEL}>Spending Overview</p>

        {hasData ? (
          <>
            {/* Total all-time */}
            <p className="font-serif text-3xl text-tea-gold tabular-nums leading-none">
              {fmtAmount(stats.totalAllTime, activeCurrency)}
            </p>
            <p className="text-[12px] text-tea-text-dim mt-1">
              {stats.totalPurchases} purchase{stats.totalPurchases !== 1 ? 's' : ''} in {activeCurrency}
            </p>

            {/* This month */}
            <div className="mt-5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-1.5">This Month</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-serif text-tea-text tabular-nums">
                  {fmtAmount(stats.thisMonth, activeCurrency)}
                </span>
                {stats.lastMonth > 0 && (
                  <span className="text-[11px] text-tea-text-dim tabular-nums">
                    {stats.delta >= 0 ? '+' : ''}
                    {fmtAmount(stats.delta, activeCurrency)} vs last month
                  </span>
                )}
              </div>
            </div>

            {/* Top vendors */}
            {stats.topVendors.length > 0 && (
              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-3">Top Vendors</p>
                <div className="space-y-3">
                  {stats.topVendors.map(([vendor, amount]) => {
                    const pct = Math.round((amount / stats.maxVendorAmount) * 100);
                    return (
                      <div key={vendor}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[12px] text-tea-text-sec flex-1 truncate">{vendor}</span>
                          <span className="text-[12px] text-tea-text-dim tabular-nums shrink-0">
                            {fmtAmount(amount, activeCurrency)}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-tea-gold/20">
                          <div
                            className="h-1 rounded-full bg-tea-gold/60"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* By category */}
            {Object.values(stats.categoryCountMap).some((c) => c > 0) && (
              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-2">By Category</p>
                <div className="divide-y divide-tea-border/50">
                  {(['Tea', 'Teaware', 'Samples', 'Other'] as const).map((cat) => {
                    const count = stats.categoryCountMap[cat];
                    if (count === 0) return null;
                    const total = Object.values(stats.categoryCountMap).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={cat} className="flex items-center justify-between py-1.5">
                        <span className="text-[12px] text-tea-text-sec">{cat}</span>
                        <span className="text-[12px] text-tea-text-dim tabular-nums">
                          {count} · {pct}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <CompassIcon className="w-8 h-8 text-tea-gold/20 mb-4" />
            <p className="font-serif text-[14px] text-tea-text/50 mb-1">No purchases recorded yet</p>
            <p className="text-[12px] text-tea-text-dim max-w-[200px] leading-relaxed">
              Confirm a purchase order to start tracking your tea spending.
            </p>
          </div>
        )}
      </div>

      {/* ── Quick Actions ── */}
      <div className="border-t border-tea-border pt-6">
        <p className={SECTION_LABEL}>Quick Actions</p>

        <button
          type="button"
          onClick={() => openPurchaseOrder()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-tea-gold/10 text-tea-gold text-[12px] font-semibold hover:bg-tea-gold/15 transition-colors mb-2"
        >
          <ShoppingBag size={13} />
          Purchase Order Builder
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => createTransaction('purchase', '', 'NT')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-tea-border text-tea-text-sec text-[12px] hover:bg-tea-surface transition-colors"
          >
            <ArrowDownLeft size={13} />
            Quick Note
          </button>
          <button
            type="button"
            onClick={() => createTransaction('sale', '', 'USD')}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-tea-border text-tea-text-sec text-[12px] hover:bg-tea-surface transition-colors"
          >
            <ArrowUpRight size={13} />
            Quick Sale
          </button>
        </div>
      </div>

    </div>
  );
};

export default LedgerOverviewPanel;
