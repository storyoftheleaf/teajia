import React from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api, AUTH_TOKEN_CHANGED_EVENT, isTokenScopedToAccount, type InvoiceAttribution } from '../../lib/api';
import { useAppStore } from '../../lib/store';

type AttributionMode = 'loading' | 'error' | 'ready';

interface OrderAttributionViewProps {
  mode: AttributionMode;
  detail: InvoiceAttribution | null;
  onRetry: () => void;
}

const titleCase = (value: string) => `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

function stockOwnerLabel(detail: InvoiceAttribution): string {
  const names = [...new Set(detail.items.map(item => item.product_id ? (item.stock_owner_name || 'Not recorded') : 'No inventory'))];
  if (names.length === 0) return 'No inventory';
  if (names.length <= 2) return names.join(' + ');
  return `${names[0]} + ${names.length - 1} more`;
}

function paymentRecipientLabel(detail: InvoiceAttribution): string {
  if (detail.payment_recipient_kind === 'mixed') return 'Mixed recipients';
  if (detail.payment_recipient_kind === 'none') return 'No stock recipient';
  if (detail.payment_recipient_kind === 'unrecorded') return 'Not recorded';
  return detail.payment_recipient_name || 'Not recorded';
}

function settlementLabel(detail: InvoiceAttribution): string {
  if (detail.settlement_visibility === 'restricted') return detail.fulfilled_at ? 'Private' : 'Not created';
  const statuses = [...new Set(detail.items.map(item => item.settlement_status).filter((status): status is NonNullable<typeof status> => Boolean(status)))];
  if (statuses.length === 0) return 'Not created';
  return statuses.length === 1 ? titleCase(statuses[0]) : 'Mixed';
}

export const OrderAttributionView: React.FC<OrderAttributionViewProps> = ({ mode, detail, onRetry }) => {
  if (mode === 'loading') return (
    <div role="status" className="flex items-center gap-2 border-y border-tea-border py-4 text-ui-12 text-tea-text-sec">
      <Loader2 size={14} className="animate-spin" />Loading sales attribution
    </div>
  );
  if (mode === 'error' || !detail) return (
    <div role="alert" className="border-y border-tea-border py-4">
      <p className="text-ui-12 text-tea-text-sec">Sales attribution could not be loaded.</p>
      <button type="button" onClick={onRetry} className="tap-target mt-2 inline-flex items-center gap-1.5 text-ui-12 text-tea-gold hover:text-tea-gold-lt">
        <RefreshCw size={13} />Retry
      </button>
    </div>
  );

  const rows = [
    ['Seller', detail.seller_name || 'Not recorded'],
    ['Stock owner', stockOwnerLabel(detail)],
    ['Fulfilled by', detail.fulfilled_by_name || (detail.fulfilled_at ? 'Not recorded' : 'Not fulfilled')],
    ['Payment recipient', paymentRecipientLabel(detail)],
    ['Settlement', settlementLabel(detail)],
  ];
  return (
    <section aria-label="Sales attribution" className="mb-8">
      <h4 className={`${TYPOGRAPHY_CLASSES.label} mb-2 text-tea-text-dim`}>Sales attribution</h4>
      <dl className="divide-y divide-tea-border border-y border-tea-border">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-4 py-3">
            <dt className={`${TYPOGRAPHY_CLASSES.label} self-center text-tea-text-dim`}>{label}</dt>
            <dd className="min-w-0 break-words text-right text-ui-13 font-medium text-tea-text">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export const OrderAttribution: React.FC<{ invoiceId: string; accountId: string }> = ({ invoiceId, accountId }) => {
  const [tokenRevision, setTokenRevision] = React.useState(0);
  const tokenScoped = isTokenScopedToAccount(accountId);

  React.useEffect(() => {
    const handleTokenChange = () => setTokenRevision(revision => revision + 1);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChange);
    return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, handleTokenChange);
  }, []);

  const query = useQuery({
    queryKey: ['invoice-attribution', accountId, invoiceId, tokenRevision],
    queryFn: async () => {
      const detail = await api.invoices.getAttribution(invoiceId);
      if (useAppStore.getState().activeAccountId !== accountId || !isTokenScopedToAccount(accountId)) {
        throw new Error('Account scope changed');
      }
      return detail;
    },
    enabled: tokenScoped,
    staleTime: 60_000,
    retry: false,
  });
  return <OrderAttributionView
    mode={!tokenScoped || query.isPending ? 'loading' : query.isError ? 'error' : 'ready'}
    detail={tokenScoped ? query.data || null : null}
    onRetry={() => { void query.refetch(); }}
  />;
};
