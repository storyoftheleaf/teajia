import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AUTH_TOKEN_CHANGED_EVENT, api, isTokenScopedToAccount, type SalesSettlement } from '../../lib/api';
import { selectIsOwnerTier, useAppStore } from '../../lib/store';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';

type ViewMode = 'loading' | 'error' | 'empty' | 'ready';

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2,
}).format(Number(value) || 0);
const date = (value: string) => new Intl.DateTimeFormat('en-US', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
}).format(new Date(value));
const statusLabel = (status: SalesSettlement['status']) => `${status.charAt(0).toUpperCase()}${status.slice(1)}`;

export function SettlementLedgerView({ mode, rows, isOwner, pendingId, error, success, onRetry, onRequestPaid, onDismissMessage }: {
  mode: ViewMode;
  rows: SalesSettlement[];
  isOwner: boolean;
  pendingId: string | null;
  error: string | null;
  success: string | null;
  onRetry: () => void;
  onRequestPaid: (row: SalesSettlement) => void;
  onDismissMessage: () => void;
}) {
  if (mode === 'loading') return <div role="status" aria-label="Loading settlements" className="space-y-3 border-y border-tea-border py-5">
    <span className="sr-only">Loading settlements</span>
    {[0, 1, 2].map(item => <div key={item} className="grid grid-cols-[1fr_7rem] gap-4"><div className="h-4 animate-pulse rounded-md bg-tea-accent-sub" /><div className="h-4 animate-pulse rounded-md bg-tea-accent-sub" /></div>)}
  </div>;
  if (mode === 'error') return <div role="alert" className="border-y border-tea-border py-6">
    <p className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>Settlements could not be loaded.</p>
    <button type="button" onClick={onRetry} className="tap-target mt-2 text-ui-12 font-medium text-tea-gold hover:text-tea-gold-lt active:scale-[0.98]">Retry</button>
  </div>;
  if (mode === 'empty') return <div className="border-y border-tea-border py-8">
    <p className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>No settlements yet.</p>
    <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 text-tea-text-sec`}>Settlements appear after eligible stock is fulfilled.</p>
  </div>;

  return <>
    {(error || success) && <div role={error ? 'alert' : 'status'} className="mb-3 flex min-h-[44px] items-center justify-between gap-3 border-y border-tea-border py-2 text-ui-12 text-tea-text-sec">
      <span>{error || success}</span><button type="button" onClick={onDismissMessage} className="tap-target shrink-0 text-tea-gold hover:text-tea-gold-lt">Dismiss</button>
    </div>}
    <div className="divide-y divide-tea-border border-y border-tea-border">
      {rows.map(row => <article key={row.id} className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 py-5 md:grid-cols-[1.1fr_1.5fr_1fr_1fr_0.8fr] md:items-center">
        <div className="min-w-0">
          <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Order</p>
          <p className="mt-1 break-words text-ui-13 font-medium text-tea-text">{row.invoice_number || row.invoice_id}</p>
          <p className="mt-1 text-ui-11 text-tea-text-sec">{date(row.created_at)}</p>
        </div>
        <div className="min-w-0">
          <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Tea</p>
          <p className="mt-1 break-words text-ui-13 text-tea-text">{row.product_name || 'Custom item'}</p>
        </div>
        <div className="min-w-0">
          <p className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-dim`}>Seller</p>
          <p className="mt-1 break-words text-ui-12 text-tea-text-sec">{row.seller_name || row.seller_user_id}</p>
          <p className={`${TYPOGRAPHY_CLASSES.label} mt-3 text-tea-text-dim`}>Stock owner</p>
          <p className="mt-1 break-words text-ui-12 text-tea-text-sec">{row.stock_owner_name || 'Account'}</p>
        </div>
        <dl className="min-w-0 space-y-1 text-ui-12">
          <div className="flex justify-between gap-2"><dt className="text-tea-text-dim">Gross</dt><dd className="num text-tea-text">{money(row.gross_amount)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-tea-text-dim">Owner</dt><dd className="num text-tea-text">{money(row.owner_amount)}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-tea-text-dim">Seller</dt><dd className="num text-tea-text">{money(row.seller_amount)}</dd></div>
        </dl>
        <div className="col-span-2 flex min-w-0 items-center justify-between gap-3 md:col-span-1 md:flex-col md:items-end">
          <span className="text-ui-11 font-medium uppercase tracking-[0.12em] text-tea-text-sec">{statusLabel(row.status)}</span>
          {isOwner && row.status === 'owed' && <button type="button" disabled={pendingId === row.id} onClick={() => onRequestPaid(row)} className="tap-target min-h-[44px] text-ui-12 font-medium text-tea-gold hover:text-tea-gold-lt disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]">{pendingId === row.id ? 'Updating' : 'Mark paid'}</button>}
        </div>
      </article>)}
    </div>
  </>;
}

export function SettlementLedger() {
  const accountId = useAppStore(state => state.activeAccountId);
  const isOwner = useAppStore(selectIsOwnerTier);
  const queryClient = useQueryClient();
  const [tokenRevision, setTokenRevision] = React.useState(0);
  const [confirming, setConfirming] = React.useState<SalesSettlement | null>(null);
  const [message, setMessage] = React.useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const tokenScoped = isTokenScopedToAccount(accountId);

  React.useEffect(() => {
    const onToken = () => setTokenRevision(value => value + 1);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, onToken);
    return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, onToken);
  }, []);
  React.useEffect(() => { setConfirming(null); setMessage(null); }, [accountId]);
  React.useEffect(() => { if (!isOwner) setConfirming(null); }, [isOwner]);

  const query = useQuery({
    queryKey: ['sales-settlements', accountId, tokenRevision], enabled: tokenScoped, retry: false, staleTime: 30_000,
    queryFn: async () => {
      const requestAccount = accountId;
      const rows = await api.sales.listSettlements();
      if (useAppStore.getState().activeAccountId !== requestAccount || !isTokenScopedToAccount(requestAccount)) throw new Error('Account scope changed');
      return rows;
    },
  });
  const mutation = useMutation({
    mutationFn: async (row: SalesSettlement) => {
      const requestAccount = accountId;
      await api.sales.markSettlementPaid(row.id);
      if (useAppStore.getState().activeAccountId !== requestAccount || !isTokenScopedToAccount(requestAccount)) throw new Error('Account scope changed');
      return row.id;
    },
    onSuccess: id => {
      queryClient.setQueryData<SalesSettlement[]>(['sales-settlements', accountId, tokenRevision], rows => rows?.map(row => row.id === id ? { ...row, status: 'paid' } : row));
      setConfirming(null); setMessage({ kind: 'success', text: 'Settlement marked paid.' });
    },
    onError: () => { setConfirming(null); setMessage({ kind: 'error', text: 'Settlement could not be marked paid. Retry from the owed row.' }); },
  });
  const rows = tokenScoped ? query.data || [] : [];
  const mode: ViewMode = !tokenScoped || query.isPending ? 'loading' : query.isError ? 'error' : rows.length === 0 ? 'empty' : 'ready';

  return <section aria-labelledby="settlement-ledger-title" className="min-w-0 px-4 py-6 md:px-6">
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-5">
        <h2 id="settlement-ledger-title" className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text`}>Settlements</h2>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-1 text-tea-text-sec`}>{isOwner ? 'Account sales split between stock owners and sellers.' : 'Sales in which you participated as seller or stock owner.'}</p>
      </div>
      <SettlementLedgerView mode={mode} rows={rows} isOwner={isOwner} pendingId={mutation.isPending ? mutation.variables?.id || null : null} error={message?.kind === 'error' ? message.text : null} success={message?.kind === 'success' ? message.text : null} onRetry={() => { void query.refetch(); }} onRequestPaid={setConfirming} onDismissMessage={() => setMessage(null)} />
    </div>
    {isOwner && confirming && <div role="dialog" aria-modal="true" aria-labelledby="settlement-confirm-title" className="fixed inset-0 z-modal flex items-center justify-center bg-tea-bg/90 p-4">
      <div className="w-full max-w-md rounded-md border border-tea-border bg-tea-elevated p-5">
        <h3 id="settlement-confirm-title" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Confirm settlement payment</h3>
        <p className={`${TYPOGRAPHY_CLASSES.bodyLight} mt-2 text-tea-text-sec`}>Mark {money(confirming.seller_amount)} for {confirming.seller_name || 'this seller'} as paid? This records the settlement only.</p>
        <div className="mt-6 flex justify-between gap-4 border-t border-tea-border pt-4">
          <button type="button" disabled={mutation.isPending} onClick={() => setConfirming(null)} className="tap-target min-h-[44px] text-ui-13 text-tea-text-sec hover:text-tea-text disabled:opacity-60">Cancel</button>
          <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate(confirming)} className="cta-solid tap-target min-h-[44px] px-4 text-ui-13 font-medium disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]">{mutation.isPending ? 'Marking paid' : 'Confirm paid'}</button>
        </div>
      </div>
    </div>}
  </section>;
}
