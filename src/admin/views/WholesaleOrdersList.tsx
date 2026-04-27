import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAppStore, selectHasBundle } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import type { WholesaleOrderStatus, WholesaleOrderSummary } from '../../types';

// ── WholesaleOrdersList — Surface 9 (index) per docs/NETWORK_UI_BRIEF.md ─────
//
// /admin/network/wholesale
// All orders where the caller is buyer or supplier.
// Two filter dimensions: role (all / buyer / supplier) + state (open / closed).
// Wine-list rhythm rows. No pills, no status badges — type and space only.
// Sell bundle required.

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

function formatAmount(amount: number | null, currency: string): string {
  if (amount == null) return '';
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusLabel(status: WholesaleOrderStatus): string {
  return status.toUpperCase();
}

function isClosedStatus(status: WholesaleOrderStatus): boolean {
  return status === 'received' || status === 'cancelled';
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonRow: React.FC = () => (
  <div className="py-5 border-b border-tea-border animate-pulse">
    <div className="h-[17px] w-2/3 bg-tea-surface rounded-[2px] mb-2" />
    <div className="h-[12px] w-1/2 bg-tea-surface rounded-[2px] mb-2" />
    <div className="h-[13px] w-2/5 bg-tea-surface rounded-[2px]" />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Filter tab
// ─────────────────────────────────────────────────────────────────────────────

interface TabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const FilterTab: React.FC<TabProps> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`text-[14px] transition-colors ${
      active ? 'text-tea-gold' : 'text-tea-text-sec hover:text-tea-text'
    }`}
  >
    {children}
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Order row
// ─────────────────────────────────────────────────────────────────────────────

interface OrderRowProps {
  order: WholesaleOrderSummary;
  callerAccountId: string;
  onClick: () => void;
}

const OrderRow: React.FC<OrderRowProps> = ({ order, callerAccountId, onClick }) => {
  const isBuyer = order.buyer_account_id === callerAccountId;
  const partnerName = isBuyer ? order.supplier_name : order.buyer_name;
  const roleLabel = isBuyer ? 'Buying from' : 'Supplying to';

  // Preview: first item name + overflow count
  // WholesaleOrderSummary extends WholesaleOrder but doesn't carry item names,
  // so we surface what we can from order metadata.
  const dateLabel = formatDate(order.submitted_at ?? order.created_at);
  const partnerLine = [
    `${roleLabel} ${partnerName}`,
    dateLabel,
  ].filter(Boolean).join(' · ');

  const totalLine = order.total_amount != null
    ? `${formatAmount(order.total_amount, order.currency)} total`
    : order.subtotal_amount != null
      ? `${formatAmount(order.subtotal_amount, order.currency)} + shipping`
      : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left py-5 border-b border-tea-border hover:bg-tea-surface/30 transition-colors group last:border-b-0"
    >
      {/* Tea name preview */}
      <div className="font-display text-[17px] text-tea-text leading-[1.3] mb-1">
        {order.item_count === 1
          ? `${order.item_count} tea`
          : `${order.item_count} teas`}
      </div>

      {/* Role + partner + date */}
      <div className="text-tea-text-sec text-[12px] mb-1.5 leading-[1.5]">{partnerLine}</div>

      {/* Total + status */}
      {(totalLine || order.status) && (
        <div className="flex items-baseline gap-2 flex-wrap text-[13px] text-tea-text-sec">
          {totalLine && <span className="font-mono">{totalLine}</span>}
          {totalLine && order.status && <span aria-hidden>·</span>}
          {order.status && (
            <span className="text-[13px] text-tea-text-sec">{statusLabel(order.status)}</span>
          )}
        </div>
      )}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

type RoleFilter = 'all' | 'buyer' | 'supplier';
type StateFilter = 'open' | 'closed';

interface WholesaleOrdersListProps {
  /** When rendered inside the Network hub, drop the page-level top/bottom padding. */
  embedded?: boolean;
}

export const WholesaleOrdersList: React.FC<WholesaleOrdersListProps> = ({ embedded = false }) => {
  const hasSell = useAppStore(s => selectHasBundle(s, 'sell'));
  const accountId = useAppStore(s => s.activeAccountId ?? '');
  const navigate = useNavigate();
  const outerClass = embedded
    ? 'px-4 md:px-6 max-w-[640px] mx-auto'
    : 'px-4 md:px-6 pt-6 pb-nav-gap max-w-[640px] mx-auto';

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('open');
  const [orders, setOrders] = useState<WholesaleOrderSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const role: 'buyer' | 'supplier' | undefined =
        roleFilter === 'buyer' ? 'buyer'
        : roleFilter === 'supplier' ? 'supplier'
        : undefined;
      const data = await api.wholesale.listOrders({ role });
      // Filter by state client-side (open vs closed)
      const filtered = data.orders.filter(o =>
        stateFilter === 'closed' ? isClosedStatus(o.status) : !isClosedStatus(o.status),
      );
      setOrders(filtered);
    } catch (err: unknown) {
      if (orders === null) setOrders([]);
      setError("Couldn't reach the server. Showing the last known state.");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, stateFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load(); }, [load]);

  // Bundle gate
  if (!hasSell) {
    return (
      <div className={outerClass}>
        <p className="text-tea-text-sec italic text-[15px] leading-[1.65]">
          This page requires the Sell bundle. Ask your owner.
        </p>
      </div>
    );
  }

  // Count summary for subtitle
  const activeCount = orders?.filter(o => !isClosedStatus(o.status)).length ?? 0;
  const closedCount = orders?.filter(o => isClosedStatus(o.status)).length ?? 0;

  const subtitle =
    orders == null ? null
    : stateFilter === 'open'
      ? activeCount === 1 ? '1 active order.' : activeCount > 0 ? `${activeCount} active orders.` : null
      : closedCount === 1 ? '1 closed order.' : closedCount > 0 ? `${closedCount} closed orders.` : null;

  return (
    <div className={outerClass}>
      {/* Header */}
      <header className="mb-8">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>Wholesale</h1>
        {subtitle && (
          <p className="text-tea-text-sec italic text-[14px] leading-[1.6]">{subtitle}</p>
        )}
      </header>

      {/* Filter line */}
      <div className="flex items-baseline gap-x-3 gap-y-2 flex-wrap mb-8">
        {/* Role filters */}
        <FilterTab active={roleFilter === 'all'} onClick={() => setRoleFilter('all')}>All</FilterTab>
        <span className="text-tea-border" aria-hidden>·</span>
        <FilterTab active={roleFilter === 'buyer'} onClick={() => setRoleFilter('buyer')}>As buyer</FilterTab>
        <span className="text-tea-border" aria-hidden>·</span>
        <FilterTab active={roleFilter === 'supplier'} onClick={() => setRoleFilter('supplier')}>As supplier</FilterTab>

        {/* Spacer */}
        <span className="flex-1" aria-hidden />

        {/* State filters */}
        <FilterTab active={stateFilter === 'open'} onClick={() => setStateFilter('open')}>Pending</FilterTab>
        <span className="text-tea-border" aria-hidden>·</span>
        <FilterTab active={stateFilter === 'closed'} onClick={() => setStateFilter('closed')}>Closed</FilterTab>
      </div>

      {/* Error */}
      {error && (
        <p className="text-tea-text-sec italic text-[14px] mb-6 leading-[1.6]">{error}</p>
      )}

      {/* Skeletons */}
      {loading && orders === null && (
        <div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      )}

      {/* Empty state */}
      {!loading && orders !== null && orders.length === 0 && (
        <p className="text-tea-text-sec italic text-[15px] leading-[1.65]">
          No wholesale orders yet. Start one from a tea you carry, or from
          the network catalog. The supplier sees it on submit.
        </p>
      )}

      {/* Order rows */}
      {orders !== null && orders.length > 0 && (
        <div>
          {orders.map(o => (
            <OrderRow
              key={o.id}
              order={o}
              callerAccountId={accountId}
              onClick={() => navigate(`/admin/network/wholesale/${o.id}/timeline`)}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-10 pt-4 border-t border-tea-border">
        <button
          type="button"
          onClick={() => navigate('/admin/network/wholesale/new')}
          className="text-[14px] text-tea-text-sec hover:text-tea-gold transition-colors font-display tracking-[0.04em]"
        >
          Start a new order →
        </button>
      </div>
    </div>
  );
};
