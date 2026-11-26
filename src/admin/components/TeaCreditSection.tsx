import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Leaf, Loader2 } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { hostCreditOpen } from '../../lib/hostCredit';
import { formatCredit, hostCreditApi, type ShopHostRow, type ShopTeaCredit } from '../../lib/hostCreditApi';
import { selectIsOwnerTier, useAppStore } from '../../lib/store';
import { useStepParam } from '../../hooks/useStepParam';
import { Button } from '../../components/shared/Button';
import { usePrivateQueryScope } from '../hooks/usePrivateQueryScope';
import { useAdminBack } from '../hooks/useAdminBack';

// Launch 5, M1: tea credit for hosts, in Sales > Waiting. The owner approves or
// declines each use of credit, gives an order over the shop's ceiling its
// second look, and sees what each host holds. Every figure comes from the
// worker (GET /api/host-credit); nothing here sets an amount. With
// HOST_CREDIT_OPEN off, or for anyone but the owner, nothing renders.

const LINE_WORD: Record<string, string> = { pending: 'Waiting', earned: 'Earned', reversed: 'Returned', void: 'Cancelled' };

function formatDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const hostName = (name: string | null | undefined) => name || 'A host';

const Heading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-ui-11 uppercase tracking-caps text-tea-text-sec mb-2">{children}</h3>
);

const Row: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => (
  <li aria-label={label} className="flex flex-wrap items-center justify-between gap-3 bg-tea-surface border border-tea-border rounded-xl px-3.5 py-3">
    {children}
  </li>
);

// Closed, nothing below is reached: no store read, no request.
export const TeaCreditSection: React.FC = () => (hostCreditOpen() ? <OwnerOnly /> : null);

const OwnerOnly: React.FC = () => {
  const isOwner = useAppStore(selectIsOwnerTier);
  return isOwner ? <TeaCreditSectionOpen /> : null;
};

const TeaCreditSectionOpen: React.FC = () => {
  const scope = usePrivateQueryScope();
  const queryClient = useQueryClient();
  const queryKey = ['host-credit', ...scope.key];
  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    enabled: scope.ready,
    staleTime: 30_000,
    retry: false,
    queryFn: () => hostCreditApi.shop(),
  });
  // One host's lines open as a step in the address, so back closes them.
  const [openHost, setOpenHost] = useStepParam('credit');
  const back = useAdminBack('/admin/activity?tab=waiting');
  const [notice, setNotice] = useState<{ id: string; text: string; confirm?: boolean } | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['host-credit'] });
  const decide = useMutation({
    mutationFn: (v: { id: string; approve: boolean; confirm?: boolean }): Promise<{ ok: true; status: 'approved' | 'declined' }> =>
      v.approve ? hostCreditApi.approveSpend(v.id, v.confirm) : hostCreditApi.declineSpend(v.id),
    onSuccess: () => { setNotice(null); void refresh(); },
    onError: (err, v) => {
      const code = err instanceof ApiError ? String(err.data?.code ?? '') : '';
      setNotice({ id: v.id, text: err instanceof Error ? err.message : 'That did not go through. Please try again.', confirm: code === 'host_credit_over_ceiling' });
    },
  });
  const approveOrder = useMutation({
    mutationFn: (invoiceId: string) => hostCreditApi.approveOrder(invoiceId),
    onSuccess: () => { setNotice(null); void refresh(); },
    onError: (err, invoiceId) => setNotice({ id: invoiceId, text: err instanceof Error ? err.message : 'That did not go through. Please try again.' }),
  });

  // A 403 or 404 means this person or this shop has no credit to manage: stay quiet.
  if (isError && error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;

  const held = (data?.spend_requests ?? []).filter(request => request.status === 'held');
  const secondLook = data?.second_look ?? [];
  const hosts = data?.hosts ?? [];
  const busy = decide.isPending || approveOrder.isPending;
  const chosen = openHost ? hosts.find(host => host.host_user_id === openHost) ?? null : null;

  return (
    <section aria-label="Tea credit">
      <div className="flex items-center gap-2 mb-3">
        <Leaf size={14} className="text-tea-text-sec" />
        <h2 className="text-ui-10 uppercase tracking-[0.15em] text-tea-text-sec">Tea credit</h2>
      </div>

      {(isLoading || !scope.ready) && !data ? (
        <div className="flex items-center justify-center py-6"><Loader2 size={18} className="animate-spin text-tea-text-dim" /></div>
      ) : isError || !data ? (
        <p className="text-sm text-tea-text-sec py-4">Tea credit could not be read just now.</p>
      ) : chosen ? (
        <HostLines data={data} host={chosen} onBack={back} />
      ) : (
        <div className="flex flex-col gap-6">
          <div>
            <Heading>Asked to use</Heading>
            {held.length === 0 ? <p className="text-sm text-tea-text-dim py-2">No credit waiting for you.</p> : (
              <ul className="flex flex-col gap-2.5">
                {held.map(request => (
                  <Row key={request.id} label={`${hostName(request.host_name)} asks to use ${formatCredit(request.amount, request.currency)}`}>
                    <div className="min-w-0 flex-1">
                      <span className="block font-serif text-base text-tea-text break-words">{hostName(request.host_name)}</span>
                      <span className="block text-ui-11 text-tea-text-sec mt-0.5">
                        {[request.invoice_number ? `On order ${request.invoice_number}` : 'On their order', formatDay(request.requested_at)].filter(Boolean).join(' · ')}
                      </span>
                      {notice?.id === request.id && <p role="alert" className="text-ui-12 text-tea-text mt-1.5">{notice.text}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="num text-sm text-tea-text font-medium">{formatCredit(request.amount, request.currency)}</span>
                      <Button variant="secondary" size="sm" disabled={busy} onClick={() => decide.mutate({ id: request.id, approve: false })}>Decline</Button>
                      <Button size="sm" disabled={busy} onClick={() => decide.mutate({ id: request.id, approve: true, confirm: notice?.id === request.id && notice.confirm })}>
                        {notice?.id === request.id && notice.confirm ? 'Approve anyway' : 'Approve'}
                      </Button>
                    </div>
                  </Row>
                ))}
              </ul>
            )}
          </div>

          {secondLook.length > 0 && (
            <div>
              <Heading>Waiting on a second look</Heading>
              <p className="text-ui-12 text-tea-text-sec mb-2">These orders earn more than the shop's limit for one order. Approve to let the credit through.</p>
              <ul className="flex flex-col gap-2.5">
                {secondLook.map(order => (
                  <Row key={order.invoice_id} label={`Order ${order.invoice_number ?? ''} for ${hostName(order.host_name)}`}>
                    <div className="min-w-0 flex-1">
                      <span className="block font-serif text-base text-tea-text break-words">{hostName(order.host_name)}</span>
                      <span className="block text-ui-11 text-tea-text-sec mt-0.5">
                        {[order.invoice_number ? `Order ${order.invoice_number}` : 'An order', order.event_title ? `from ${order.event_title}` : null].filter(Boolean).join(' · ')}
                      </span>
                      {notice?.id === order.invoice_id && <p role="alert" className="text-ui-12 text-tea-text mt-1.5">{notice.text}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className="num text-sm text-tea-text font-medium">{formatCredit(order.credit_amount, order.currency)}</span>
                      <Button size="sm" disabled={busy} onClick={() => approveOrder.mutate(order.invoice_id)}>Approve</Button>
                    </div>
                  </Row>
                ))}
              </ul>
            </div>
          )}

          <div>
            <Heading>Hosts</Heading>
            {hosts.length === 0 ? <p className="text-sm text-tea-text-dim py-2">No host has credit yet.</p> : (
              <ul className="flex flex-col gap-2.5">
                {hosts.map(host => (
                  <li key={`${host.host_user_id}:${host.currency}`}>
                    <Button variant="plain" onClick={() => setOpenHost(host.host_user_id)}
                      className="w-full flex flex-wrap items-center justify-between gap-3 bg-tea-surface border border-tea-border rounded-xl px-3.5 py-3 text-left hover:bg-tea-elevated transition-colors">
                      <span className="min-w-0 flex-1 font-serif text-base text-tea-text break-words">{hostName(host.host_name)}</span>
                      <HostFigures host={host} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

const HostFigures: React.FC<{ host: ShopHostRow }> = ({ host }) => (
  <span className="flex flex-wrap gap-x-4 gap-y-1 text-ui-11 text-tea-text-sec">
    <span>Ready <span className="num text-tea-text">{formatCredit(host.available, host.currency)}</span></span>
    <span>Earned <span className="num text-tea-text">{formatCredit(Math.max(0, host.earned - host.reversed), host.currency)}</span></span>
    <span>Waiting <span className="num text-tea-text">{formatCredit(host.pending, host.currency)}</span></span>
    <span>Held <span className="num text-tea-text">{formatCredit(host.held, host.currency)}</span></span>
  </span>
);

const HostLines: React.FC<{ data: ShopTeaCredit; host: ShopHostRow; onBack: () => void }> = ({ data, host, onBack }) => {
  const lines = data.lines.filter(line => line.host_user_id === host.host_user_id);
  const asks = data.spend_requests.filter(request => request.host_user_id === host.host_user_id);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="quiet" size="sm" onClick={onBack}>Back</Button>
        <span className="font-serif text-base text-tea-text break-words">{hostName(host.host_name)}</span>
      </div>
      <div className="bg-tea-surface border border-tea-border rounded-xl px-3.5 py-3"><HostFigures host={host} /></div>
      {asks.length > 0 && (
        <div>
          <Heading>Uses of credit</Heading>
          <ul className="flex flex-col gap-2">
            {asks.map(request => (
              <Row key={request.id} label={`Use of credit on ${request.invoice_number ?? 'an order'}`}>
                <span className="min-w-0 flex-1 text-ui-12 text-tea-text-sec">{[request.invoice_number ? `Order ${request.invoice_number}` : 'An order', formatDay(request.requested_at)].filter(Boolean).join(' · ')}</span>
                <span className="text-ui-12 text-tea-text-sec">{request.status === 'held' ? 'Waiting' : request.status === 'approved' ? 'Approved' : 'Declined'}</span>
                <span className="num text-sm text-tea-text">{formatCredit(request.amount, request.currency)}</span>
              </Row>
            ))}
          </ul>
        </div>
      )}
      <div>
        <Heading>Where it came from</Heading>
        {lines.length === 0 ? <p className="text-sm text-tea-text-dim py-2">Nothing yet.</p> : (
          <ul className="flex flex-col gap-2">
            {lines.map(line => (
              <Row key={line.id} label={`${line.tea_name ?? 'Tea'} on ${line.invoice_number ?? 'an order'}`}>
                <div className="min-w-0 flex-1">
                  <span className="block text-sm text-tea-text break-words">{line.tea_name || 'Tea'}</span>
                  <span className="block text-ui-11 text-tea-text-sec mt-0.5">
                    {[line.invoice_number ? `Order ${line.invoice_number}` : null, line.event_title ? `from ${line.event_title}` : null, formatDay(line.created_at)].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="text-ui-12 text-tea-text-sec">{LINE_WORD[line.status] ?? line.status}</span>
                <span className="num text-sm text-tea-text">{formatCredit(line.credit_amount, line.credit_currency)}</span>
              </Row>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
