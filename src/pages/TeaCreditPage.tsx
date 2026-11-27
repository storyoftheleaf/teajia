import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { hasToken } from '../lib/api';
import { Icons } from '../components/Icons';
import { Button } from '../components/shared/Button';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { historyIndex } from '../admin/components/adminHistory';
import { formatCredit, hostCreditApi, type CreditLineStatus, type HostCreditBalanceView, type HostCreditLine, type OwnCreditOrder, type OwnSpendRequest } from '../lib/hostCreditApi';
import { hostCreditOpen } from '../lib/hostCredit';
import { TEA_CREDIT_PATH, hasTeaCredit, useMyTeaCredit } from '../hooks/useMyTeaCredit';
import { isNotHereYet } from '../lib/closedPart';
import { SiteNotFound } from '../components/SiteNotFound';
import { LoadFailed } from '../components/shared/LoadFailed';

// Launch 5, M1: a host's own tea credit, in Your Table. What is earned,
// waiting, held and ready to use, and the sessions it came from. Credit is in
// tea only: never paid out, never shown to a guest. A guest who bought is
// never named here; a line is the tea and the session the host knows.

const LINE_WORD: Record<CreditLineStatus, string> = {
  pending: 'Waiting',
  earned: 'Earned',
  reversed: 'Returned',
  void: 'Cancelled',
};

const ASK_WORD: Record<OwnSpendRequest['status'], string> = {
  held: 'Waiting for the shop',
  approved: 'Used',
  declined: 'Not used',
};

function formatDay(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

const Figure: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => (
  <div className="min-w-0 rounded-md border border-tea-border bg-tea-bg px-3 py-2.5">
    <div className="text-ui-11 uppercase tracking-caps text-tea-text-sec">{label}</div>
    <div className={`num mt-1 ${strong ? 'font-display text-ui-20 text-tea-text' : 'text-ui-16 text-tea-text'}`}>{value}</div>
  </div>
);

export const CreditBalanceCard: React.FC<{ balance: HostCreditBalanceView; showShop: boolean }> = ({ balance, showShop }) => {
  const earned = Math.max(0, balance.earned - balance.reversed);
  return (
    <section aria-label={showShop && balance.shop_name ? `Tea credit at ${balance.shop_name}` : 'Your tea credit'}
      className="rounded-xl border border-tea-border bg-tea-surface p-4 space-y-3">
      {showShop && balance.shop_name && <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>{balance.shop_name}</h2>}
      <div className="grid grid-cols-2 gap-2">
        <Figure label="Ready to use" value={formatCredit(balance.available, balance.currency)} strong />
        <Figure label="Earned" value={formatCredit(earned, balance.currency)} />
        <Figure label="Waiting" value={formatCredit(balance.pending, balance.currency)} />
        <Figure label="Held" value={formatCredit(balance.held, balance.currency)} />
      </div>
      <p className="text-ui-13 leading-relaxed text-tea-text-sec">
        Waiting credit is earned once the shop fills the order. Held credit is set aside for an order of yours until the shop approves it.
      </p>
      {balance.spent > 0 && (
        <p className="text-ui-13 text-tea-text-sec">Used on tea so far: <span className="num text-tea-text">{formatCredit(balance.spent, balance.currency)}</span></p>
      )}
      {balance.debt > 0 && (
        <p className="text-ui-13 text-tea-text-sec">An order that was returned took back <span className="num">{formatCredit(balance.debt, balance.currency)}</span>. New credit settles that first.</p>
      )}
    </section>
  );
};

const LineRow: React.FC<{ line: HostCreditLine; showShop: boolean }> = ({ line, showShop }) => {
  const from = [line.event_title ? `From ${line.event_title}` : 'From a session you hosted', showShop ? line.shop_name : null, formatDay(line.created_at)]
    .filter(Boolean).join(' · ');
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-md border border-tea-border bg-tea-surface px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-serif text-ui-16 text-tea-text break-words">{line.tea_name || 'Tea'}</div>
        <div className="text-ui-12 text-tea-text-sec mt-0.5 break-words">{from}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="num text-ui-14 text-tea-text">{formatCredit(line.credit_amount, line.credit_currency)}</div>
        <div className="text-ui-11 uppercase tracking-caps text-tea-text-sec mt-0.5">{LINE_WORD[line.status]}</div>
      </div>
    </li>
  );
};

const AskRow: React.FC<{ ask: OwnSpendRequest; showShop: boolean }> = ({ ask, showShop }) => (
  <li className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-md border border-tea-border bg-tea-surface px-3.5 py-3">
    <div className="min-w-0 flex-1">
      <div className="text-ui-14 text-tea-text break-words">{ask.invoice_number ? `Your order ${ask.invoice_number}` : 'Your order'}</div>
      <div className="text-ui-12 text-tea-text-sec mt-0.5">{[showShop ? ask.shop_name : null, formatDay(ask.requested_at)].filter(Boolean).join(' · ')}</div>
    </div>
    <div className="text-right shrink-0">
      <div className="num text-ui-14 text-tea-text">{formatCredit(ask.amount, ask.currency)}</div>
      <div className="text-ui-11 uppercase tracking-caps text-tea-text-sec mt-0.5">{ASK_WORD[ask.status]}</div>
    </div>
  </li>
);

const OpenOrderRow: React.FC<{ order: OwnCreditOrder; showShop: boolean; busy: boolean; failed: boolean; onUse: () => void }> = ({ order, showShop, busy, failed, onUse }) => (
  <li className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-tea-border bg-tea-surface px-3.5 py-3">
    <div className="min-w-0 flex-1">
      <div className="text-ui-14 text-tea-text break-words">{order.invoice_number ? `Your order ${order.invoice_number}` : 'Your order'}</div>
      <div className="text-ui-12 text-tea-text-sec mt-0.5">{[showShop ? order.shop_name : null, `${formatCredit(order.may_use, order.currency)} of it can come from your credit`].filter(Boolean).join(' · ')}</div>
      {failed && <p role="alert" className="text-ui-12 text-tea-text mt-1">That did not go through. Please try again in a moment.</p>}
    </div>
    <Button size="sm" loading={busy} onClick={onUse}>Use my tea credit</Button>
  </li>
);

export default function TeaCreditPage() {
  const navigate = useNavigate();
  const authed = hasToken();
  const open = hostCreditOpen();
  const { data, isLoading, isError: readFailed, error, refetch } = useMyTeaCredit();
  // A 404 is the worker not open yet (A10-3): the address is not a page yet.
  const closed = readFailed && isNotHereYet(error);
  const isError = readFailed && !closed;
  const queryClient = useQueryClient();
  const [failedOrder, setFailedOrder] = useState<string | null>(null);
  // The worker works out the amount and holds it for the shop's approval.
  const use = useMutation({
    mutationFn: (invoiceId: string) => hostCreditApi.useOnOrder(invoiceId),
    onSuccess: () => { setFailedOrder(null); void queryClient.invalidateQueries({ queryKey: ['me', 'tea-credit'] }); },
    onError: (_error, invoiceId) => setFailedOrder(invoiceId),
  });

  useEffect(() => {
    if (open && !authed) navigate(`/signin?returnTo=${encodeURIComponent(TEA_CREDIT_PATH)}`, { replace: true });
  }, [open, authed, navigate]);

  if (!open || !authed) return null;
  if (closed) return <SiteNotFound />;

  const back = () => (historyIndex() > 0 ? navigate(-1) : navigate('/account'));
  const showShop = new Set((data?.balances ?? []).map(balance => balance.account_id)).size > 1;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 pb-nav-gap-lg">
      <Button variant="quiet" size="sm" onClick={back} icon={<Icons.Back className="w-4 h-4" />} className="mb-6">Back</Button>

      <header className="mb-6">
        <h1 className={`${TYPOGRAPHY_CLASSES.h2} text-tea-text mb-2`}>Tea credit</h1>
        <p className="text-ui-14 leading-relaxed text-tea-text-sec">
          When a guest orders tea from a session you hosted, a share comes back to you as credit. It is for tea from the shop, kept for as long as you like.
        </p>
      </header>

      {isLoading && <div className="h-40 rounded-xl border border-tea-border bg-tea-surface animate-pulse" aria-label="Loading your tea credit" />}

      {isError && !isLoading && (
        <LoadFailed className="rounded-xl border border-tea-border bg-tea-surface p-5" sentence="Your tea credit could not be read just now." onRetry={() => void refetch()} />
      )}

      {!isLoading && !isError && data && !hasTeaCredit(data) && (
        <p className="rounded-xl border border-tea-border bg-tea-surface p-5 text-ui-14 leading-relaxed text-tea-text-sec">
          No credit yet. When a guest orders tea from your thank-you or your page, it will appear here.
        </p>
      )}

      {!isLoading && !isError && data && hasTeaCredit(data) && (
        <div className="space-y-8">
          <div className="space-y-3">
            {data.balances.map(balance => <CreditBalanceCard key={`${balance.account_id}:${balance.currency}`} balance={balance} showShop={showShop} />)}
            <p className="text-ui-13 leading-relaxed text-tea-text-sec">To use it, choose "Use my tea credit" when you check out, or on an open order below. The shop looks over each use by hand.</p>
          </div>

          {(data.orders ?? []).some(order => order.may_use > 0) && (
            <section aria-label="Use it on an order" className="space-y-3">
              <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Use it on an order</h2>
              <ul className="space-y-2">
                {data.orders.filter(order => order.may_use > 0).map(order => (
                  <OpenOrderRow key={order.invoice_id} order={order} showShop={showShop}
                    busy={use.isPending && use.variables === order.invoice_id} failed={failedOrder === order.invoice_id}
                    onUse={() => use.mutate(order.invoice_id)} />
                ))}
              </ul>
            </section>
          )}

          {data.requests.length > 0 && (
            <section aria-label="Credit you asked to use" className="space-y-3">
              <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Asked to use</h2>
              <ul className="space-y-2">{data.requests.map(ask => <AskRow key={ask.id} ask={ask} showShop={showShop} />)}</ul>
            </section>
          )}

          {data.lines.length > 0 && (
            <section aria-label="Where your credit came from" className="space-y-3">
              <h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Where it came from</h2>
              <ul className="space-y-2">{data.lines.map(line => <LineRow key={line.id} line={line} showShop={showShop} />)}</ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
