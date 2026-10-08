import React, { useMemo } from 'react';
import { ArrowDownLeft, ArrowUpRight, ShoppingBag } from 'lucide-react';
import { useLedgerStore } from '../../lib/ledgerStore';
import { useTeaCompassStore } from '../../lib/teaCompassStore';
import { useAppStore } from '../../lib/store';
import { CompassIcon } from './CompassIcon';
import { useRates } from '../../admin/hooks/useAdminData';
import { formatCurrency } from '../../admin/utils';
import { rateToUsd } from '../../lib/currency';
import { purchaseSpendInUsd } from './curatePricing';
import { shopOrderAsTransaction, shopOrderIsSpend, useShopOrders } from './shopOrders';
import type { LedgerTransaction } from '../../lib/ledgerStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function getPrevMonth(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
}

const SECTION_LABEL = 'text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-3';

// ─── Main component ───────────────────────────────────────────────────────────

export const LedgerOverviewPanel: React.FC = () => {
  const transactions = useLedgerStore((s) => s.transactions);
  const createTransaction = useLedgerStore((s) => s.createTransaction);
  const openPurchaseOrder = useAppStore((s) => s.openPurchaseOrder);
  const { data: rates } = useRates();
  const activeCurrency = useAppStore((s) => s.currency);

  // Orders the shop holds that this device does not (made on another phone or
  // laptop) are spend too. An order the shop could not read the lines of still
  // has the dollars it recorded; one with neither is not counted.
  const shop = useShopOrders();
  const purchases = useMemo(() => {
    const held = new Set(transactions.map((t) => t.purchaseOrderId).filter(Boolean));
    const fromShop: LedgerTransaction[] = [];
    for (const order of shop.orders) {
      if (held.has(order.id) || !shopOrderIsSpend(order)) continue;
      const tx = shopOrderAsTransaction(order);
      const readable = tx.items.length > 0 && tx.items.every((item) => !item.unpriced) && !order.unreadableLines;
      if (readable) fromShop.push(tx);
      else if (order.totalUsd !== null) {
        fromShop.push({ ...tx, currency: 'USD', items: [{ id: 'shop-total', name: 'Order', type: 'Other', quantityUnits: 1, pricePerUnit: order.totalUsd, priceIsPerGram: false, currency: 'USD', addedAt: tx.createdAt }] });
      }
    }
    return [...transactions.filter((t) => t.direction === 'purchase' && t.status === 'confirmed'), ...fromShop];
  }, [transactions, shop.orders]);
  // Every confirmed purchase, whatever it was paid in, converted at the shop's
  // rates and shown in the currency the site is set to. This used to keep only
  // purchases paid in the display currency, so with the site on dollars every
  // yuan purchase vanished from the totals.
  const spend = useMemo(() => purchaseSpendInUsd(purchases, rates), [purchases, rates]);
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
    const categoryMap: Record<string, number> = { Tea: 0, Teaware: 0, Samples: 0, Other: 0 };
    const categoryCountMap: Record<string, number> = { Tea: 0, Teaware: 0, Samples: 0, Other: 0 };

    for (const { tx, usd: amount, itemsUsd } of confirmed) {
      totalAllTime += amount;

      const txMonth = tx.updatedAt.slice(0, 7);
      if (txMonth === currentMonth) thisMonth += amount;
      if (txMonth === prevMonth) lastMonth += amount;

      const vendor = tx.counterpartyName || 'Unknown';
      vendorMap.set(vendor, (vendorMap.get(vendor) ?? 0) + amount);

      tx.items.forEach((item, i) => {
        const t = (item.type || '').toLowerCase();
        let cat = 'Tea';
        if (t === 'teaware') cat = 'Teaware';
        else if (t === 'sample' || t === 'samples') cat = 'Samples';
        else if (t && !['white', 'green', 'yellow', 'oolong', 'black', 'dark', 'puer', 'pu-erh', 'puerh', 'raw', 'ripe', 'sheng', 'shou', 'red', 'herbal', 'tea'].some((k) => t.includes(k))) {
          cat = 'Other';
        }
        categoryMap[cat] += itemsUsd[i];
        categoryCountMap[cat] += 1;
      });
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

  const hasData = confirmed.length > 0 || unpriced.length > 0;

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
              {fmtAmount(stats.totalAllTime)}
            </p>
            <p className="text-ui-12 text-tea-text-dim mt-1">
              {stats.totalPurchases} purchase{stats.totalPurchases !== 1 ? 's' : ''}, shown in {shownIn} at today's rates
            </p>
            {unpriced.length > 0 && (
              <p className="text-ui-12 text-tea-text-sec mt-1" data-testid="ledger-unpriced">
                Not counted, no exchange rate yet: {unpriced.map(([cur, n]) => `${n} in ${cur}`).join(", ")}.
              </p>
            )}

            {/* This month */}
            <div className="mt-5">
              <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-1.5">This Month</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-serif text-tea-text tabular-nums">
                  {fmtAmount(stats.thisMonth)}
                </span>
                {stats.lastMonth > 0 && (
                  <span className="text-ui-11 text-tea-text-dim tabular-nums">
                    {fmtDelta(stats.delta)} vs last month
                  </span>
                )}
              </div>
            </div>

            {/* Top vendors */}
            {stats.topVendors.length > 0 && (
              <div className="mt-5">
                <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-3">Top Vendors</p>
                <div className="space-y-3">
                  {stats.topVendors.map(([vendor, amount]) => {
                    const pct = Math.round((amount / stats.maxVendorAmount) * 100);
                    return (
                      <div key={vendor}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-ui-12 text-tea-text-sec flex-1 truncate">{vendor}</span>
                          <span className="text-ui-12 text-tea-text-dim tabular-nums shrink-0">
                            {fmtAmount(amount)}
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
                <p className="text-ui-10 uppercase tracking-[0.12em] text-tea-text-dim font-medium mb-2">By Category</p>
                <div className="divide-y divide-tea-border/50">
                  {(['Tea', 'Teaware', 'Samples', 'Other'] as const).map((cat) => {
                    const count = stats.categoryCountMap[cat];
                    if (count === 0) return null;
                    const total = Object.values(stats.categoryCountMap).reduce((a, b) => a + b, 0);
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={cat} className="flex items-center justify-between py-1.5">
                        <span className="text-ui-12 text-tea-text-sec">{cat}</span>
                        <span className="text-ui-12 text-tea-text-dim tabular-nums">
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
            <p className="font-serif text-ui-14 text-tea-text/50 mb-1">No purchases recorded yet</p>
            <p className="text-ui-12 text-tea-text-dim max-w-[200px] leading-relaxed">
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
          className="w-full min-h-11 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-tea-gold/10 text-tea-gold text-ui-12 font-semibold hover:bg-tea-gold/15 transition-colors mb-2"
        >
          <ShoppingBag size={13} />
          Purchase Order Builder
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => createTransaction('purchase', '', useTeaCompassStore.getState().lastCurrency)}
            className="flex-1 min-h-11 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-tea-border text-tea-text-sec text-ui-12 hover:bg-tea-surface transition-colors"
          >
            <ArrowDownLeft size={13} />
            Quick Note
          </button>
          <button
            type="button"
            onClick={() => createTransaction('sale', '', 'USD')}
            className="flex-1 min-h-11 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-tea-border text-tea-text-sec text-ui-12 hover:bg-tea-surface transition-colors"
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
