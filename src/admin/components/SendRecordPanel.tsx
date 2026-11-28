import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { sendsApi } from '../../lib/sendsApi';
import { parseLedgerTime, relativeTime } from '../../lib/incidentWords';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import type { SendRecord } from '../types';

/**
 * What happened to an invoice or a collection link after it was sent (Adrian,
 * 2026-11-28: "Make sure all these invoices and sample sending things are
 * getting saved, monitored and recorded, they're great sources for data").
 *
 * The record is the worker's (worker/src/sendRecords.ts): when it was opened
 * and by whom, which teas were looked at, saved, tasted and ordered, and for
 * an invoice the discount and every payment. The shop's own looks never count
 * as the person's. The Teajia connector reads the same record (get_send).
 *
 * Used on the order panel and under each link a collection was sent by.
 */
export const SendRecordPanel: React.FC<{ kind: 'invoice' | 'collection'; id: string; className?: string }> = ({ kind, id, className = '' }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['send-record', kind, id],
    queryFn: () => sendsApi.get(kind, id),
    staleTime: 30_000,
  });
  if (isLoading) return <p className={`text-ui-12 text-tea-text-sec ${className}`}>Reading what happened to it…</p>;
  // Anything but a record (an error page, an empty answer) reads as unreadable, never as a crash of the screen around it.
  if (isError || !data || !Array.isArray(data.teas) || !data.opens) return <p className={`text-ui-12 text-tea-text-sec ${className}`}>What happened to it could not be read just now.</p>;
  return <SendRecordBody record={data} className={className} />;
};

const usd = (n: number) => `$${n.toFixed(2)}`;

function when(value: string | null | undefined): string {
  const at = parseLedgerTime(value);
  if (at === null) return '';
  return new Date(at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function names(list: string[]): string {
  return list.length <= 2 ? list.join(' and ') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** The opening line, in words: whether, how often, when first and last, and by whom. */
export function openedWords(record: Pick<SendRecord, 'opens'>): string {
  const o = record.opens;
  if (o.times === 0 && !o.first_at) {
    const before = o.counted_before?.times ?? 0;
    return before > 0
      ? `Not opened since recording began. The earlier count, your own looks included, was ${before}.`
      : 'Not opened yet.';
  }
  const times = o.times === 1 ? 'once' : `${o.times} times`;
  const by = o.signed_in.length ? ` by ${names(o.signed_in)}` : o.visitors > 1 ? ` from ${o.visitors} places` : '';
  const span = o.first_at && o.last_at && o.first_at !== o.last_at
    ? `, first ${when(o.first_at)}, last ${relativeTime(o.last_at)}`
    : o.first_at ? `, ${when(o.first_at)}` : '';
  return `Opened ${times}${by}${span}.`;
}

export const SendRecordBody: React.FC<{ record: SendRecord; className?: string }> = ({ record, className = '' }) => {
  const money = record.money;
  return (
    <section aria-label="What happened to it" data-testid="send-record" className={`rounded-md border border-tea-border bg-tea-surface p-3 space-y-3 ${className}`}>
      <div className="space-y-1">
        <p className={`${T.label} text-tea-text-sec`}>What happened to it</p>
        <p className="text-ui-13 text-tea-text">{openedWords(record)}</p>
        {record.kept_by.length > 0 && (
          <p className="text-ui-13 text-tea-text-sec">
            {record.kind === 'invoice' ? 'Saved to the account of ' : 'Kept by '}{names(record.kept_by.map(k => k.name))}.
          </p>
        )}
      </div>

      {record.teas.length > 0 && (
        <ul className="divide-y divide-tea-border">
          {record.teas.map((tea, index) => {
            const marks = [
              tea.times_opened ? `looked at ${tea.times_opened === 1 ? 'once' : `${tea.times_opened} times`}` : null,
              tea.saved_by.length ? `saved by ${names(tea.saved_by)}` : null,
              tea.tasted_by.length ? `tasted by ${names([...new Set(tea.tasted_by.map(t => t.name))])}` : null,
              record.kind === 'collection' && tea.ordered ? 'ordered' : null,
            ].filter(Boolean);
            return (
              <li key={`${tea.product_id ?? 'line'}-${index}`} className="py-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-ui-13 text-tea-text min-w-0">
                  {tea.name}
                  {tea.amount && <span className="text-tea-text-sec"> · {tea.amount}</span>}
                </span>
                <span className="text-ui-12 text-tea-text-sec num">
                  {tea.price_usd == null ? 'shop price' : tea.price_usd === 0 ? 'free' : usd(tea.price_usd)}
                </span>
                {marks.length > 0 && <span className="basis-full text-ui-12 text-tea-text-sec">{marks.join(' · ')}</span>}
              </li>
            );
          })}
        </ul>
      )}

      {money && (
        <div className="space-y-1 text-ui-13 text-tea-text-sec num">
          {money.discount_usd > 0 && (
            <p>Discount{money.discount_percent != null ? ` ${money.discount_percent}%` : ''}: {usd(money.discount_usd)} off {usd(money.subtotal_usd)}</p>
          )}
          {money.shipping_usd > 0 && <p>Shipping {usd(money.shipping_usd)}</p>}
          <p className="text-tea-text">
            Total {usd(money.total_usd)}
            {money.paid_usd > 0 ? ` · paid ${usd(money.paid_usd)}` : ''}
            {money.claimed_usd > 0 ? ` · ${usd(money.claimed_usd)} reported, waiting for you` : ''}
            {money.paid_usd === 0 && money.claimed_usd === 0 ? ` · ${money.payment_status === 'paid' ? 'paid' : 'not paid yet'}` : ''}
          </p>
          {money.payments.map((p, index) => (
            <p key={index}>
              {usd(p.amount_usd)} {p.status === 'confirmed' ? 'received' : p.status === 'rejected' ? 'turned down' : 'reported'}
              {p.by === 'customer' ? ' by them' : ''}{p.method ? ` by ${p.method}` : ''}
              {p.claimed_at ? `, ${when(p.claimed_at)}` : ''}
            </p>
          ))}
        </div>
      )}

      {record.orders.length > 0 && (
        <div className="space-y-1">
          <p className={`${T.label} text-tea-text-sec`}>Ordered from it</p>
          {record.orders.map(order => (
            <p key={order.id} className="text-ui-13 text-tea-text num">
              {order.invoice_number ?? 'Order'} · {usd(order.total_usd)} · {order.payment_status === 'paid' ? 'paid' : 'not paid yet'}
              {order.created_at ? <span className="text-tea-text-sec"> · {when(order.created_at)}</span> : null}
            </p>
          ))}
        </div>
      )}
    </section>
  );
};
