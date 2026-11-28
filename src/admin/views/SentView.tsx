import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { sendsApi } from '../../lib/sendsApi';
import { parseLedgerTime, relativeTime } from '../../lib/incidentWords';
import { useStepParam } from '../../hooks/useStepParam';
import { TYPOGRAPHY_CLASSES as T } from '../../designTokens';
import { SendRecordPanel } from '../components/SendRecordPanel';
import type { SendSummary } from '../types';

/**
 * Everything the shop has sent out, newest first: every invoice and every
 * collection link (Adrian, 2026-11-28: "the list for all the teas going out...
 * this has to not just live for me"). Each seller sees their own account's.
 * A row opens the full record of what happened to it (SendRecordPanel), as a
 * step in the address, so Back closes it.
 */
const KINDS = [
  { id: '', label: 'All' },
  { id: 'invoice', label: 'Invoices' },
  { id: 'collection', label: 'Collection links' },
] as const;

function day(value: string | null): string {
  const at = parseLedgerTime(value);
  return at === null ? '' : new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function sentLine(send: SendSummary): string {
  const parts: string[] = [];
  parts.push(`${send.teas} ${send.teas === 1 ? 'tea' : 'teas'}`);
  if (send.total_usd != null) parts.push(`$${send.total_usd.toFixed(2)}${send.payment_status === 'paid' ? ', paid' : ''}`);
  if (send.opened_times > 0) {
    parts.push(`opened ${send.opened_times === 1 ? 'once' : `${send.opened_times} times`}, last ${relativeTime(send.last_opened_at)}`);
  } else if (send.counted_before > 0) {
    parts.push(`${send.counted_before} earlier ${send.counted_before === 1 ? 'open' : 'opens'}, yours included`);
  } else {
    parts.push('not opened yet');
  }
  if (send.teas_opened > 0) parts.push(`${send.teas_opened} ${send.teas_opened === 1 ? 'tea' : 'teas'} looked at`);
  if (send.kind === 'collection' && send.orders > 0) parts.push(`${send.orders} ${send.orders === 1 ? 'order' : 'orders'}`);
  return parts.join(' · ');
}

const SentView: React.FC = () => {
  const [kind, setKind] = useStepParam('kind');
  const [q, setQ] = useStepParam('q');
  const [open, setOpen] = useStepParam('send');
  const { data, isLoading, isError } = useQuery({
    queryKey: ['sends', kind, q],
    queryFn: () => sendsApi.list({ kind: kind === 'invoice' || kind === 'collection' ? kind : undefined, q: q || undefined, limit: 200 }),
    staleTime: 30_000,
  });
  const sends = data?.sends ?? [];
  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-4">
      <h1 className={T.h1}>Everything sent</h1>
      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map(k => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id || null, { refine: true })}
            className={`min-h-tap px-3 rounded-xl border text-ui-13 transition-colors ${kind === k.id ? 'border-tea-gold text-tea-text' : 'border-tea-border text-tea-text-sec hover:text-tea-text'}`}
          >
            {k.label}
          </button>
        ))}
        <input
          type="search"
          value={q}
          onChange={event => setQ(event.target.value || null, { refine: true })}
          placeholder="Who it went to"
          aria-label="Who it went to"
          className="min-h-tap flex-1 min-w-[10rem] rounded-xl border border-tea-border bg-tea-surface px-3 text-ui-13 text-tea-text focus:border-tea-gold focus:outline-none"
        />
      </div>
      {isLoading && <p className="text-ui-13 text-tea-text-sec">Loading…</p>}
      {isError && <p className="text-ui-13 text-tea-text-sec">The list could not be read just now.</p>}
      {!isLoading && !isError && sends.length === 0 && <p className="text-ui-13 text-tea-text-sec">Nothing sent yet.</p>}
      <ul className="divide-y divide-tea-border rounded-xl border border-tea-border bg-tea-surface overflow-hidden">
        {sends.map(send => {
          const key = `${send.kind}:${send.id}`;
          const isOpen = open === key;
          return (
            <li key={key} className={send.live ? '' : 'opacity-60'}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : key)}
                aria-expanded={isOpen}
                className="w-full text-left px-4 py-3 hover:bg-tea-accent-sub transition-colors"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-ui-15 text-tea-text">
                    {send.to || 'Open link'}
                    <span className="text-tea-text-sec"> · {send.title}</span>
                  </span>
                  <span className="text-ui-12 text-tea-text-sec">{send.kind === 'invoice' ? 'Invoice' : 'Collection link'}, {day(send.sent_at)}</span>
                </span>
                <span className="block text-ui-12 text-tea-text-sec mt-1">{sentLine(send)}</span>
              </button>
              {isOpen && <SendRecordPanel kind={send.kind} id={send.id} className="mx-4 mb-3" />}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SentView;
