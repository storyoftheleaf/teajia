import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, BarChart3, ScrollText, Inbox, MessageSquare, RefreshCw } from 'lucide-react';
import { OrdersView } from './OrdersView';
import { RecordsView } from './SoldItemsView';
import { PendingView } from './PendingView';
import { usePendingAttendees } from '../hooks/useEventData';
import {
  api,
  ApiError,
  AUTH_TOKEN_CHANGED_EVENT,
  isTokenScopedToAccount,
  type InquiryRecord,
  type InquiryStatus,
} from '../../lib/api';
import { useToast } from './Toast';
import { Product } from '../types';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useAppStore } from '../../lib/store';

type ActivityTab = 'pending' | 'orders' | 'ledger' | 'log' | 'inquiries';
const VALID_TABS: ActivityTab[] = ['pending', 'orders', 'ledger', 'log', 'inquiries'];

interface ActivityViewProps {
  products: Product[];
}

function usePendingCount() {
  const { data: orders = [] } = useQuery({
    queryKey: ['invoices-pending-summary'],
    staleTime: 30_000,
    queryFn: async () => {
      const data = (await api.invoices.list(200)) as any[];
      return data.filter((o: any) => o.status === 'Pending');
    },
  });
  // Reuse the same hook (same queryKey + queryFn) as PendingView so the cache
  // is never poisoned by a raw-data queryFn registered here first.
  const { data: rsvps = [] } = usePendingAttendees();
  return (orders?.length ?? 0) + rsvps.length;
}

/**
 * How many orders carry a payment the customer has reported and Adrian has not
 * confirmed. This is the count that puts a number on the Orders tab, so a report
 * arriving is visible from the same place the rest of the admin's work is.
 *
 * It cannot ride the pending-summary cache above: that query filters to Pending
 * orders, and a report can land on a Filled order that is only part paid.
 */
function useClaimsPendingCount(accountId: string | null, tokenRevision: number) {
  const ready = Boolean(accountId) && isTokenScopedToAccount(accountId);
  const { data } = useQuery({
    queryKey: ['invoices-claims-summary', accountId, tokenRevision],
    staleTime: 60_000,
    enabled: ready,
    queryFn: async () => {
      const rows = await api.invoices.list(200);
      return rows.filter(row => (Number(row.payment?.claims_pending) || 0) > 0).length;
    },
  });
  return ready ? data ?? 0 : 0;
}

export const ActivityView: React.FC<ActivityViewProps> = ({ products }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as ActivityTab | null;
  const activeTab: ActivityTab = rawTab && VALID_TABS.includes(rawTab) ? rawTab : 'pending';
  const setActiveTab = (tab: ActivityTab) => setSearchParams({ tab }, { replace: true });
  const pendingCount = usePendingCount();
  const activeAccountId = useAppStore(state => state.activeAccountId);
  const [tokenRevision, setTokenRevision] = React.useState(0);

  React.useEffect(() => {
    const handleTokenChange = () => setTokenRevision(revision => revision + 1);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChange);
    return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChange);
  }, []);

  const inquiryAccountReady = Boolean(activeAccountId) && isTokenScopedToAccount(activeAccountId);

  const inquiryCountQuery = useQuery({
    queryKey: ['inquiries-new-count', activeAccountId, tokenRevision],
    staleTime: 60_000,
    enabled: inquiryAccountReady,
    queryFn: async () => {
      const data = await api.inquiries.list('new');
      if (data.inquiries.some(inquiry => inquiry.account_id !== activeAccountId)) {
        throw new Error('Inquiry response account mismatch');
      }
      return data.inquiries;
    },
  });
  const newInquiryCount = !inquiryAccountReady || inquiryCountQuery.isError ? undefined : inquiryCountQuery.data?.length;
  const claimsPendingCount = useClaimsPendingCount(activeAccountId, tokenRevision);

  const tabs: { id: ActivityTab; label: string; icon: React.ReactNode; badge?: number; countUnavailable?: boolean }[] = [
    { id: 'pending', label: 'Pending', icon: <Inbox size={15} />, badge: pendingCount },
    { id: 'orders', label: 'Orders', icon: <ClipboardList size={15} />, badge: claimsPendingCount || undefined },
    {
      id: 'inquiries',
      label: 'Inquiries',
      icon: <MessageSquare size={15} />,
      badge: newInquiryCount || undefined,
      countUnavailable: inquiryAccountReady && inquiryCountQuery.isError,
    },
    { id: 'ledger', label: 'Ledger', icon: <BarChart3 size={15} /> },
    { id: 'log', label: 'Log', icon: <ScrollText size={15} /> },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-tea-bg">
      {/* Page header */}
      <div className="px-4 md:px-6 lg:px-10 pt-6 pb-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto">
          <h1 className="h2 text-tea-text">Activity</h1>
          <div className="label-caps text-tea-text-dim mt-1">Orders, payments, and customer inquiries</div>
        </div>
      </div>

      {/* Tab bar, bottom-border underline (§6) */}
      <div className="border-b border-tea-border bg-tea-bg flex-shrink-0">
        <div className="flex items-center gap-6 px-4 md:px-6 lg:px-10 max-w-7xl mx-auto overflow-x-auto hide-scrollbar">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <div key={tab.id} className="flex items-center">
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 py-2.5 text-ui-12 uppercase tracking-caps font-sans whitespace-nowrap transition-colors border-b ${
                  isActive
                    ? 'text-tea-text border-tea-gold'
                    : 'text-tea-text-sec hover:text-tea-text border-transparent'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span aria-label={`${tab.label} count ${tab.badge}`} className="ml-1.5 text-tea-text-dim font-mono tabular-nums">
                    ({tab.badge})
                  </span>
                )}
                {tab.countUnavailable && (
                  <span
                    aria-label="Inquiry count unavailable"
                    title="Inquiry count unavailable"
                    className="ml-1.5 text-tea-text-dim font-mono"
                  >
                    (?)
                  </span>
                )}
              </button>
              {tab.countUnavailable && (
                <button
                  type="button"
                  aria-label="Retry inquiry count"
                  title="Retry inquiry count"
                  onClick={() => { void inquiryCountQuery.refetch(); }}
                  className="tap-target ml-1 text-tea-text-sec hover:text-tea-text"
                >
                  <RefreshCw size={12} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
        </div>
      </div>

      {/* Content: RecordsView already has Archive/Log/Ledger as internal tabs,
          so we pass it the right initial tab via a key-based approach */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'pending' && <PendingView />}
        {activeTab === 'orders' && <OrdersView />}
        {activeTab === 'ledger' && <RecordsView products={products} initialTab="ledger" />}
        {activeTab === 'log' && <RecordsView products={products} initialTab="log" />}
        {activeTab === 'inquiries' && <InquiriesView accountId={activeAccountId} accountReady={inquiryAccountReady} />}
      </div>
    </div>
  );
};

// ── Inline InquiriesView ─────────────────────────────────────────────────────

const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: 'New',
  seen: 'Seen',
  replied: 'Replied',
  closed: 'Closed',
};

const STATUS_COLORS: Record<InquiryStatus, string> = {
  new: 'bg-tea-gold/10 text-tea-text ring-1 ring-inset ring-tea-gold/40',
  seen: 'bg-tea-elevated text-tea-text-sec',
  replied: 'bg-tea-green/10 text-tea-green ring-1 ring-inset ring-tea-green/40',
  closed: 'bg-tea-elevated text-tea-text-dim',
};

function InquiriesView({ accountId, accountReady }: { accountId: string | null; accountReady: boolean }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [filter, setFilter] = React.useState<'all' | InquiryStatus>('all');
  /**
   * Inquiries converted in this session, so the card flips the moment the
   * request returns rather than waiting on the list refetch. The server field
   * is the source of truth; this only covers the gap.
   */
  const [convertedHere, setConvertedHere] = React.useState<Record<string, string>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-inquiries', accountId, filter],
    staleTime: 30_000,
    enabled: accountReady,
    queryFn: async () => {
      const res = await api.inquiries.list(filter === 'all' ? undefined : filter);
      if (res.inquiries.some(inquiry => inquiry.account_id !== accountId)) {
        throw new Error('Inquiry response account mismatch');
      }
      return res.inquiries;
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status, accountId: initiatingAccountId }: { id: string; status: InquiryStatus; accountId: string }) => {
      if (!isTokenScopedToAccount(initiatingAccountId)) {
        throw new Error('Account switch is still completing');
      }
      return api.inquiries.updateStatus(id, status);
    },
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ['admin-inquiries', variables.accountId] });
      qc.invalidateQueries({ queryKey: ['inquiries-new-count', variables.accountId] });
      if (variables.accountId === accountId) updateStatus.reset();
    },
    onSettled: (_result, _error, variables) => {
      if (variables.accountId !== accountId) updateStatus.reset();
    },
  });

  /**
   * Open the order an inquiry became. `?tab=orders&search=` is how the admin
   * already reaches one order from elsewhere, so this reuses it rather than
   * inventing a route. The invoice number reads better in the search box; the
   * id is the fallback when only that is known, which is why the orders list
   * matches on id too.
   */
  const openOrder = (reference: string) => {
    navigate(`/admin/activity?tab=orders&search=${encodeURIComponent(reference)}`);
  };

  const convert = useMutation({
    mutationFn: async ({ id, accountId: initiatingAccountId }: { id: string; accountId: string }) => {
      if (!isTokenScopedToAccount(initiatingAccountId)) {
        throw new Error('Account switch is still completing');
      }
      try {
        const result = await api.inquiries.convert(id);
        return { ...result, alreadyConverted: false };
      } catch (err) {
        // Two admin windows, one inquiry. The second one is not an error: the
        // order it wanted already exists, so treat it as arriving second.
        if (err instanceof ApiError && err.status === 409 && typeof err.data?.invoice_id === 'string') {
          return { invoice_id: err.data.invoice_id, invoice_number: '', alreadyConverted: true };
        }
        throw err;
      }
    },
    onSuccess: (result, variables) => {
      setConvertedHere(prev => ({ ...prev, [variables.id]: result.invoice_id }));
      qc.invalidateQueries({ queryKey: ['admin-inquiries', variables.accountId] });
      qc.invalidateQueries({ queryKey: ['inquiries-new-count', variables.accountId] });
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['invoices-pending-summary'] });
      showToast(
        result.alreadyConverted
          ? 'This inquiry was already turned into an order. Opening it.'
          : `Order ${result.invoice_number} created from this inquiry.`,
        'success',
      );
      openOrder(result.invoice_number || result.invoice_id);
    },
  });

  const submitConvert = (variables: { id: string; accountId: string }) => {
    convert.reset();
    convert.mutate(variables);
  };

  React.useEffect(() => {
    updateStatus.reset();
    convert.reset();
    setConvertedHere({});
  }, [accountId]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitStatusUpdate = (variables: { id: string; status: InquiryStatus; accountId: string }) => {
    updateStatus.reset();
    updateStatus.mutate(variables);
  };

  const inquiries = !accountReady || isError ? [] : data ?? [];
  const failedUpdate = updateStatus.isError && updateStatus.variables?.accountId === accountId
    ? updateStatus.variables
    : null;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="h3 text-tea-text">Inquiries</h2>
        <div className="flex items-center gap-6 border-b border-tea-border">
          {(['all', 'new', 'seen', 'replied', 'closed'] as const).map(s => {
            const isActive = filter === s;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`py-2 text-ui-12 uppercase tracking-caps font-sans whitespace-nowrap transition-colors border-b ${
                  isActive
                    ? 'text-tea-text border-tea-gold'
                    : 'text-tea-text-sec hover:text-tea-text border-transparent'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
      </div>

      {accountReady && isLoading && (
        <p className="text-tea-text-sec text-sm">Loading…</p>
      )}

      {accountReady && isError && (
        <div role="alert" className="rounded-md border border-tea-border bg-tea-surface px-4 py-3">
          <p className={`${TYPOGRAPHY_CLASSES.link} text-tea-text-sec`}>Could not load inquiries</p>
          <button
            type="button"
            onClick={() => { void refetch(); }}
            className={`${TYPOGRAPHY_CLASSES.link} tap-target mt-2 text-tea-gold hover:text-tea-gold-lt`}
          >
            Try again
          </button>
          {error instanceof Error && <span className="sr-only">{error.message}</span>}
        </div>
      )}

      {failedUpdate && (
        <div role="alert" className="rounded-md border border-tea-border bg-tea-surface px-4 py-3">
          <p className={`${TYPOGRAPHY_CLASSES.link} text-tea-text-sec`}>Could not update inquiry status.</p>
          <button
            type="button"
            onClick={() => submitStatusUpdate(failedUpdate)}
            className={`${TYPOGRAPHY_CLASSES.link} tap-target mt-2 text-tea-gold hover:text-tea-gold-lt`}
          >
            Try again
          </button>
        </div>
      )}

      {accountReady && !isLoading && !isError && inquiries.length === 0 && (
        <div className="flex flex-col items-center text-center max-w-sm mx-auto py-20 px-6">
          <MessageSquare size={28} strokeWidth={1.25} className="text-tea-text-dim mb-3" />
          <div className="font-display text-ui-17 text-tea-text">No inquiries</div>
          <p className="text-ui-12 text-tea-text-sec leading-relaxed mt-2">
            {filter !== 'all' ? `Nothing with status "${STATUS_LABELS[filter]}" right now.` : 'New customer inquiries will appear here.'}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {inquiries.map((inq: InquiryRecord) => {
          const convertedInvoiceId = inq.converted_invoice_id ?? convertedHere[inq.id] ?? null;
          const isConverting = convert.isPending && convert.variables?.id === inq.id;
          const convertFailed = convert.isError
            && convert.variables?.id === inq.id
            && convert.variables?.accountId === accountId;
          const convertErrorMessage = convert.error instanceof Error && convert.error.message
            ? convert.error.message
            : 'Could not turn this inquiry into an order.';
          return (
          <div key={inq.id} className="bg-tea-surface border border-tea-border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-tea-text font-medium text-sm">{inq.name}</p>
                <p className="text-tea-text-sec text-xs">{inq.email}</p>
                {inq.phone && <p className="text-tea-text-sec text-xs">{inq.phone}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {inq.source && inq.source !== 'cart' && (
                  <span className="text-ui-10 px-2 py-0.5 rounded-full bg-tea-gold/10 text-tea-text ring-1 ring-tea-gold/40 uppercase tracking-wider">
                    {inq.source}
                  </span>
                )}
                <span className={`text-ui-10 px-2 py-0.5 rounded-full ${STATUS_COLORS[inq.status] ?? STATUS_COLORS.seen}`}>
                  {STATUS_LABELS[inq.status] ?? inq.status}
                </span>
                <select
                  value={inq.status}
                  disabled={updateStatus.isPending}
                  aria-label={`Status for ${inq.name || inq.ref_number || 'inquiry'}`}
                  onChange={e => accountId && submitStatusUpdate({ id: inq.id, status: e.target.value as InquiryStatus, accountId })}
                  className="tap-target text-ui-10 bg-tea-bg border border-tea-border rounded px-1.5 py-0.5 text-tea-text-sec"
                >
                  {Object.entries(STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {(inq.items ?? []).length > 0 && (
              <div className="space-y-1 border-t border-tea-border pt-2">
                {inq.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-tea-text">{item.name}</span>
                    <span className="text-tea-text-sec num">{item.quantityGrams ?? item.qty ?? ''}g</span>
                  </div>
                ))}
                {inq.total_usd != null && (
                  <div className="flex justify-between text-xs font-medium pt-1 border-t border-tea-border">
                    <span className="text-tea-text-sec">Total</span>
                    <span className="text-tea-text num">${Number(inq.total_usd).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {inq.message && (
              <p className="text-tea-text-sec text-xs border-t border-tea-border pt-2">{inq.message}</p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-tea-border pt-2">
              <p className="text-tea-text-dim text-ui-10">{new Date(inq.created_at).toLocaleString()}</p>
              {convertedInvoiceId ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ui-10 text-tea-text-sec">Turned into an order</span>
                  <button
                    type="button"
                    onClick={() => openOrder(convertedInvoiceId)}
                    className="tap-target text-ui-10 uppercase tracking-caps text-tea-text-sec hover:text-tea-text transition-colors"
                  >
                    Open order
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={isConverting || !accountId}
                  onClick={() => accountId && submitConvert({ id: inq.id, accountId })}
                  className="tap-target text-ui-10 uppercase tracking-caps text-tea-text-sec hover:text-tea-text disabled:text-tea-text-dim transition-colors"
                >
                  {isConverting ? 'Turning into order…' : 'Turn into order'}
                </button>
              )}
            </div>

            {convertFailed && (
              <div role="alert" className="border-t border-tea-border pt-2">
                <p className="text-ui-11 text-tea-text-sec">{convertErrorMessage}</p>
                <button
                  type="button"
                  onClick={() => accountId && submitConvert({ id: inq.id, accountId })}
                  className={`${TYPOGRAPHY_CLASSES.link} tap-target mt-1 text-tea-gold hover:text-tea-gold-lt`}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
