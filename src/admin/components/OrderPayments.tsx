import React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type {
  InvoicePayment,
  InvoicePaymentRecord,
  RecordPaymentInput,
} from '../types';
import { ConfirmModal } from './ConfirmModal';
import { useToast } from './Toast';

/**
 * Payments on an order: the three numbers, the reports a customer has sent in,
 * and the history of what has actually been received.
 *
 * Teajia takes no card payments. A customer transfers money using the details
 * on a tea master's pay page, so the system only ever learns about a payment
 * two ways. Either the customer says they sent one, which is a REPORT and
 * changes nothing about what the order is owed, or Adrian sees the money in his
 * bank and records it, which is money. Every label in here exists to keep those
 * two apart. A report is never drawn as settled, never counted into Paid, and
 * never confirmed by a single stray click.
 *
 * The view is split from the container the way SettlementLedgerView is split
 * from SettlementLedger: the presentational half takes plain props so the
 * judgement in it can be tested without a query client.
 */

const MONEY = new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', minimumFractionDigits: 2,
});

export const money = (value: unknown): string => MONEY.format(Number(value) || 0);

const when = (value?: string | null): string => {
  if (!value) return '';
  const parsed = new Date(value.includes('T') || value.includes('Z') ? value : `${value.replace(' ', 'T')}Z`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/** A payment above the balance by less than a cent is the balance, not an overpayment. */
export const AMOUNT_TOLERANCE = 0.01;

export interface OrderPaymentTotals {
  total: number;
  paid: number;
  outstanding: number;
  claimsPending: number;
}

/**
 * The three numbers, read defensively. The worker owns them; this only keeps a
 * response that predates the payments work from rendering NaN.
 */
export function orderPaymentTotals(payment?: InvoicePayment | null): OrderPaymentTotals {
  const total = Number(payment?.total_usd) || 0;
  const paid = Number(payment?.paid_usd) || 0;
  const outstanding = payment?.outstanding_usd == null
    ? Math.max(0, total - paid)
    : Math.max(0, Number(payment.outstanding_usd) || 0);
  return { total, paid, outstanding, claimsPending: Number(payment?.claims_pending) || 0 };
}

/**
 * What a hand-recorded payment should start at.
 *
 * The outstanding balance, never the invoice total. After a part payment those
 * differ, and retyping the total is exactly the mistake this defaults away.
 */
export function defaultRecordAmount(payment?: InvoicePayment | null): string {
  const { outstanding } = orderPaymentTotals(payment);
  return outstanding > 0 ? outstanding.toFixed(2) : '';
}

/**
 * Refuse an impossible amount here rather than letting the server say no. The
 * server still validates, and its error is still surfaced.
 */
export function validateRecordAmount(raw: string, outstanding: number): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return 'Enter an amount.';
  const amount = Number(trimmed);
  if (!Number.isFinite(amount)) return 'Enter an amount as a number.';
  if (amount <= 0) return 'Enter an amount above zero.';
  if (amount > outstanding + AMOUNT_TOLERANCE) {
    return `That is more than the ${money(outstanding)} outstanding on this order.`;
  }
  return null;
}

export interface PaymentRowDescriptor {
  source: string;
  state: string;
  /** True only for a confirmed row. A customer report is never money. */
  countsAsPaid: boolean;
  /** True while the row is a report waiting on Adrian. */
  awaiting: boolean;
}

/**
 * The two words a payment row is allowed to say about itself. Kept in one
 * function so no surface can quietly invent a third reading.
 */
export function describePaymentRow(row: Pick<InvoicePaymentRecord, 'status' | 'claimed_by'>): PaymentRowDescriptor {
  const source = row.claimed_by === 'customer' ? 'Reported by customer' : 'Recorded by you';
  if (row.status === 'confirmed') {
    return { source, state: 'Confirmed', countsAsPaid: true, awaiting: false };
  }
  if (row.status === 'rejected') {
    return { source, state: 'Rejected', countsAsPaid: false, awaiting: false };
  }
  return { source, state: 'Awaiting confirmation', countsAsPaid: false, awaiting: true };
}

/**
 * The quiet marker on an order in the list. Uses the same voice as the "unpaid"
 * and "stock pending" words already in that row, because it means the same
 * thing: this order wants Adrian.
 *
 * It renders its own leading separator dot, so it belongs between two of those
 * words rather than at the end of the line.
 */
export const OrderClaimsFlag: React.FC<{
  payment?: InvoicePayment | null;
  className?: string;
}> = ({ payment, className = '' }) => {
  const count = Number(payment?.claims_pending) || 0;
  if (count < 1) return null;
  const full = count === 1
    ? 'The customer reported one payment. It is not confirmed yet.'
    : `The customer reported ${count} payments. They are not confirmed yet.`;
  return (
    <>
      <span className="text-tea-text-dim mx-1">·</span>
      <span className={`text-tea-gold/90 ${className}`} title={full}>
        {count} reported
      </span>
    </>
  );
};

interface RecordFormProps {
  outstanding: number;
  busy: boolean;
  serverError: string | null;
  defaultAmount: string;
  onSubmit: (input: RecordPaymentInput) => void;
}

const inputClass =
  'w-full bg-tea-bg border border-tea-border rounded-md px-2 py-1.5 text-ui-12 text-tea-text placeholder:text-tea-text-dim focus:border-tea-gold focus:ring-2 focus:ring-tea-gold/30 focus:outline-none transition-colors';

const RecordPaymentForm: React.FC<RecordFormProps> = ({
  outstanding, busy, serverError, defaultAmount, onSubmit,
}) => {
  const [amount, setAmount] = React.useState(defaultAmount);
  const [method, setMethod] = React.useState('');
  const [reference, setReference] = React.useState('');
  const [note, setNote] = React.useState('');
  const [touched, setTouched] = React.useState(false);

  // The default follows the balance: a confirmed part payment changes what is
  // left, and the field should already hold the new number.
  React.useEffect(() => { setAmount(defaultAmount); }, [defaultAmount]);

  const localError = validateRecordAmount(amount, outstanding);
  const error = touched ? localError : null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (localError) return;
    onSubmit({
      amount_usd: Number(amount.trim()),
      method_label: method.trim() || undefined,
      reference: reference.trim() || undefined,
      note: note.trim() || undefined,
    });
    setMethod('');
    setReference('');
    setNote('');
    setTouched(false);
  };

  return (
    <form onSubmit={submit} className="mt-4 pt-4 border-t border-tea-border">
      <h5 className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-3">Record a payment</h5>
      <div className="flex flex-wrap gap-2">
        <label className="min-w-[7rem] flex-1">
          <span className="block text-ui-10 text-tea-text-dim mb-1">Amount (USD)</span>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={error ? true : undefined}
            className={`${inputClass} num text-right`}
          />
        </label>
        <label className="min-w-[9rem] flex-[2]">
          <span className="block text-ui-10 text-tea-text-dim mb-1">Method</span>
          <input
            type="text"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            placeholder="Bank transfer"
            className={inputClass}
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        <label className="min-w-[9rem] flex-1">
          <span className="block text-ui-10 text-tea-text-dim mb-1">Reference</span>
          <input
            type="text"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            placeholder="What the transfer quoted"
            className={inputClass}
          />
        </label>
        <label className="min-w-[9rem] flex-1">
          <span className="block text-ui-10 text-tea-text-dim mb-1">Note</span>
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional"
            className={inputClass}
          />
        </label>
      </div>
      {(error || serverError) && (
        <p role="alert" className="mt-2 text-ui-11 text-tea-text-sec">{error || serverError}</p>
      )}
      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={busy}
          className="tap-target min-h-[44px] cta-solid px-4 rounded-xl text-ui-12 font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Recording' : 'Record payment'}
        </button>
      </div>
    </form>
  );
};

export interface OrderPaymentsPanelViewProps {
  payment?: InvoicePayment | null;
  rows: InvoicePaymentRecord[];
  mode: 'loading' | 'error' | 'ready';
  /** Id of the row whose confirm or reject is in flight. */
  pendingRowId: string | null;
  recording: boolean;
  recordError: string | null;
  onRetry: () => void;
  onRequestConfirm: (row: InvoicePaymentRecord) => void;
  onReject: (row: InvoicePaymentRecord) => void;
  onRecord: (input: RecordPaymentInput) => void;
  className?: string;
}

export const OrderPaymentsPanelView: React.FC<OrderPaymentsPanelViewProps> = ({
  payment, rows, mode, pendingRowId, recording, recordError,
  onRetry, onRequestConfirm, onReject, onRecord, className = '',
}) => {
  const totals = orderPaymentTotals(payment);
  const claims = rows.filter((row) => row.status === 'claimed');
  const settled = rows.filter((row) => row.status !== 'claimed');

  return (
    <section className={`bg-tea-surface border border-tea-border rounded-xl p-4 ${className}`}>
      <h4 className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-3">Payments</h4>

      <dl className="text-ui-13">
        <div className="flex justify-between gap-3 py-1">
          <dt className="text-tea-text-sec">Total</dt>
          <dd className="num text-tea-text text-right">{money(totals.total)}</dd>
        </div>
        <div className="flex justify-between gap-3 py-1">
          <dt className="text-tea-text-sec">Paid</dt>
          <dd className="num text-tea-text text-right">{money(totals.paid)}</dd>
        </div>
        <div className="flex justify-between gap-3 py-1 border-t border-tea-border mt-1 pt-2">
          <dt className="text-tea-text-sec">Outstanding</dt>
          <dd className={`num text-right ${totals.outstanding > 0 ? 'text-tea-text' : 'text-tea-text-sec'}`}>
            {money(totals.outstanding)}
          </dd>
        </div>
      </dl>

      {mode === 'loading' && (
        <p role="status" className="mt-4 text-ui-11 text-tea-text-sec">Loading payments.</p>
      )}

      {mode === 'error' && (
        <div role="alert" className="mt-4">
          <p className="text-ui-11 text-tea-text-sec">Payments could not be loaded.</p>
          <button
            type="button"
            onClick={onRetry}
            className="tap-target mt-1 text-ui-12 font-medium text-tea-text-sec hover:text-tea-text"
          >
            Retry
          </button>
        </div>
      )}

      {mode === 'ready' && claims.length > 0 && (
        <div className="mt-4 pt-4 border-t border-tea-border">
          <h5 className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec">
            Reported by the customer
          </h5>
          <p className="text-ui-11 text-tea-text-sec leading-[1.5] mt-1">
            The customer says they sent this. Nothing changes on the order until you confirm it.
          </p>
          <ul className="mt-3 space-y-3">
            {claims.map((row) => {
              const busy = pendingRowId === row.id;
              return (
                <li key={row.id} className="border-t border-tea-border pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ui-13 text-tea-text-sec truncate">
                      {row.method_label || 'Method not given'}
                    </span>
                    <span className="num text-ui-13 text-tea-text text-right shrink-0">
                      {money(row.amount_usd)}
                    </span>
                  </div>
                  {row.reference && (
                    <p className="text-ui-11 text-tea-text-sec mt-0.5 break-words">
                      Reference: {row.reference}
                    </p>
                  )}
                  {row.note && (
                    <p className="text-ui-11 text-tea-text-sec mt-0.5 break-words">
                      Note: {row.note}
                    </p>
                  )}
                  <p className="text-ui-10 text-tea-text-dim mt-1">
                    {describePaymentRow(row).state} · {when(row.claimed_at || row.created_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onReject(row)}
                      className="tap-target min-h-[44px] text-ui-12 text-tea-text-sec hover:text-tea-text disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRequestConfirm(row)}
                      className="tap-target min-h-[44px] cta-solid px-4 rounded-xl text-ui-12 font-medium disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy ? 'Working' : 'Confirm payment'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {mode === 'ready' && settled.length > 0 && (
        <div className="mt-4 pt-4 border-t border-tea-border">
          <h5 className="text-ui-10 uppercase tracking-[0.2em] text-tea-text-sec mb-2">History</h5>
          <ul className="divide-y divide-tea-border">
            {settled.map((row) => {
              const descriptor = describePaymentRow(row);
              return (
                <li key={row.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block text-ui-12 text-tea-text truncate">
                      {row.method_label || 'Method not given'}
                    </span>
                    <span className="block text-ui-10 text-tea-text-dim">
                      {descriptor.source} · {descriptor.state} · {when(row.confirmed_at || row.claimed_at || row.created_at)}
                    </span>
                  </span>
                  <span
                    className={`num text-ui-12 text-right shrink-0 ${descriptor.countsAsPaid ? 'text-tea-text' : 'text-tea-text-sec'}`}
                  >
                    {money(row.amount_usd)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {mode === 'ready' && rows.length === 0 && (
        <p className="mt-4 pt-4 border-t border-tea-border text-ui-11 text-tea-text-sec">
          No payments recorded on this order yet.
        </p>
      )}

      {mode === 'ready' && (
        totals.outstanding > 0 ? (
          <RecordPaymentForm
            outstanding={totals.outstanding}
            busy={recording}
            serverError={recordError}
            defaultAmount={defaultRecordAmount(payment)}
            onSubmit={onRecord}
          />
        ) : (
          <p className="mt-4 pt-4 border-t border-tea-border text-ui-11 text-tea-text-sec">
            Nothing outstanding on this order.
          </p>
        )
      )}
    </section>
  );
};

export interface OrderPaymentsPanelProps {
  invoiceId: string;
  invoiceNumber?: string;
  payment?: InvoicePayment | null;
  /**
   * Fired after any write that moves money, so the caller can refresh the order
   * it is showing. The three numbers live on the invoice, not on this list.
   */
  onChanged?: () => void;
  className?: string;
}

export const OrderPaymentsPanel: React.FC<OrderPaymentsPanelProps> = ({
  invoiceId, invoiceNumber, payment, onChanged, className,
}) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [confirming, setConfirming] = React.useState<InvoicePaymentRecord | null>(null);
  const [pendingRowId, setPendingRowId] = React.useState<string | null>(null);
  const [recordError, setRecordError] = React.useState<string | null>(null);

  const query = useQuery<InvoicePaymentRecord[]>({
    queryKey: ['invoice-payments', invoiceId],
    staleTime: 30_000,
    retry: false,
    queryFn: () => api.invoices.getPayments(invoiceId),
  });

  const settleCaches = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['invoice-payments', invoiceId] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['invoices-pending-summary'] });
    queryClient.invalidateQueries({ queryKey: ['invoices-claims-summary'] });
    onChanged?.();
  }, [queryClient, invoiceId, onChanged]);

  const confirmMutation = useMutation({
    mutationFn: (row: InvoicePaymentRecord) => api.invoicePayments.confirm(row.id),
    onMutate: (row) => { setPendingRowId(row.id); },
    onSuccess: (_result, row) => {
      showToast(`${money(row.amount_usd)} confirmed on ${invoiceNumber || 'this order'}.`, 'success');
      setConfirming(null);
      settleCaches();
    },
    onError: (error: unknown) => {
      const detail = error instanceof Error && error.message ? `: ${error.message}` : '.';
      showToast(`Could not confirm that payment${detail}`, 'error');
    },
    onSettled: () => { setPendingRowId(null); },
  });

  const rejectMutation = useMutation({
    mutationFn: (row: InvoicePaymentRecord) => api.invoicePayments.reject(row.id),
    onMutate: (row) => { setPendingRowId(row.id); },
    onSuccess: () => {
      showToast('Report rejected. It stays on the order as rejected.', 'success');
      settleCaches();
    },
    onError: (error: unknown) => {
      const detail = error instanceof Error && error.message ? `: ${error.message}` : '.';
      showToast(`Could not reject that report${detail}`, 'error');
    },
    onSettled: () => { setPendingRowId(null); },
  });

  const recordMutation = useMutation({
    mutationFn: (input: RecordPaymentInput) => api.invoices.recordPayment(invoiceId, input),
    onMutate: () => { setRecordError(null); },
    onSuccess: (_result, input) => {
      showToast(`${money(input.amount_usd)} recorded on ${invoiceNumber || 'this order'}.`, 'success');
      settleCaches();
    },
    onError: (error: unknown) => {
      setRecordError(
        error instanceof Error && error.message
          ? error.message
          : 'That payment could not be recorded. Try again.',
      );
    },
  });

  const rows = query.data || [];
  const mode = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  return (
    <>
      <OrderPaymentsPanelView
        payment={payment}
        rows={rows}
        mode={mode}
        pendingRowId={pendingRowId}
        recording={recordMutation.isPending}
        recordError={recordError}
        onRetry={() => { void query.refetch(); }}
        onRequestConfirm={setConfirming}
        onReject={(row) => rejectMutation.mutate(row)}
        onRecord={(input) => recordMutation.mutate(input)}
        className={className}
      />
      <ConfirmModal
        isOpen={!!confirming}
        onClose={() => setConfirming(null)}
        onConfirm={() => { if (confirming) confirmMutation.mutate(confirming); }}
        isLoading={confirmMutation.isPending}
        title={confirming ? `Confirm ${money(confirming.amount_usd)} received?` : 'Confirm payment'}
        description={
          confirming
            ? `This records the money against ${invoiceNumber || 'this order'} and changes what it is owed. Confirm it only once the transfer has landed.`
            : undefined
        }
        confirmLabel="Confirm payment"
      >
        {confirming && (
          <dl className="bg-tea-bg border border-tea-border rounded-xl p-4 text-ui-12">
            <div className="flex justify-between gap-3 py-0.5">
              <dt className="text-tea-text-sec">Amount</dt>
              <dd className="num text-tea-text text-right">{money(confirming.amount_usd)}</dd>
            </div>
            <div className="flex justify-between gap-3 py-0.5">
              <dt className="text-tea-text-sec">Method</dt>
              <dd className="text-tea-text text-right break-words">{confirming.method_label || 'Not given'}</dd>
            </div>
            {confirming.reference && (
              <div className="flex justify-between gap-3 py-0.5">
                <dt className="text-tea-text-sec">Reference</dt>
                <dd className="text-tea-text text-right break-words">{confirming.reference}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3 py-0.5">
              <dt className="text-tea-text-sec">Reported</dt>
              <dd className="text-tea-text text-right">{when(confirming.claimed_at || confirming.created_at)}</dd>
            </div>
          </dl>
        )}
      </ConfirmModal>
    </>
  );
};
