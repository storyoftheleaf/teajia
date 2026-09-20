import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { GOLD_OUTLINE, GOLD_OUTLINE_STYLE } from '../people/immersive';
import { api } from '../../lib/api';
import type { PayAccessGrant, PayAccessTable } from './types';

// Pay is private, and approval is permanent (migration 0022). The
// contributor's side of it, on Your Table under Payment: who asked, with
// Approve on the right and Decline on the left; the people who can see it;
// and the open share link, to copy or send on WhatsApp. Built to board 2 of
// the Creator Profiles canvas.

const PAY_ACCESS_KEY = ['profile', 'pay-access'] as const;

export function usePayAccess(enabled: boolean) {
  return useQuery<PayAccessTable | null>({
    queryKey: PAY_ACCESS_KEY,
    enabled,
    staleTime: 30_000,
    retry: false,
    // A reader with no public profile gets a 409 here; that is "nothing to
    // show", not a fault, so the query resolves to null instead of erroring.
    queryFn: async () => {
      try {
        return await api.profile.listPayAccess();
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : '';
        if (/profile_required|409|Create your public profile/i.test(message)) return null;
        throw cause;
      }
    },
  });
}

function sinceLine(grant: PayAccessGrant): string {
  const since = grant.user_since ? new Date(grant.user_since) : null;
  const year = since && !Number.isNaN(since.getTime()) ? since.getFullYear() : null;
  const via = grant.granted_via === 'link' ? 'opened your pay link' : 'asked from your page';
  return [year ? `account since ${year}` : null, via].filter(Boolean).join(' · ');
}

export function whatsappShareHref(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function CopyButton({ value, label, testId }: { value: string; label: string; testId?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" onClick={copy} data-testid={testId} className="tap-target inline-flex min-h-[36px] items-center rounded-[4px] bg-tea-accent-sub px-3 font-sans text-ui-11 uppercase tracking-[0.15em] text-tea-readgold hover:text-tea-gold-lt" aria-label={`Copy ${label}`}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

/** One pending request: name on the left, Decline left of Approve on the right. */
export function PayAccessRequestRow({ grant, onApprove, onDecline, busy }: { grant: PayAccessGrant; onApprove: () => void; onDecline: () => void; busy: boolean }) {
  return (
    <li className="py-4" data-testid="pay-access-request">
      <p className="font-display text-ui-20 leading-[1.15] text-tea-text">{grant.user_name} asked to see your payment details</p>
      <p className="mt-1 font-sans text-ui-12 text-tea-text-sec">{sinceLine(grant)}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <button type="button" onClick={onDecline} disabled={busy} className="tap-target px-1 font-sans text-ui-13 text-tea-text-sec hover:text-tea-text disabled:opacity-60">Decline</button>
        <button type="button" onClick={onApprove} disabled={busy} className={`${GOLD_OUTLINE} tap-target px-7`} style={GOLD_OUTLINE_STYLE}>Approve</button>
      </div>
    </li>
  );
}

export function PayAccessPanel({ contributorName, canShare }: { contributorName: string; canShare: boolean }) {
  const queryClient = useQueryClient();
  const query = usePayAccess(true);
  const refresh = () => queryClient.invalidateQueries({ queryKey: PAY_ACCESS_KEY });
  const approve = useMutation({ mutationFn: (id: string) => api.profile.approvePayAccess(id), onSuccess: refresh });
  const decline = useMutation({ mutationFn: (id: string) => api.profile.declinePayAccess(id), onSuccess: refresh });
  const mint = useMutation({ mutationFn: () => api.profile.mintPayShareLink(), onSuccess: refresh });
  const [showApproved, setShowApproved] = useState(false);

  if (query.isLoading) return <section id="pay-access" className="border-y border-tea-border py-8"><h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Who can see your payment details</h2><p className="mt-2 text-ui-13 text-tea-text-dim">Loading.</p></section>;
  if (query.isError) return <section id="pay-access" className="border-y border-tea-border py-8"><h2 className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Who can see your payment details</h2><p className="mt-2 text-ui-13 text-tea-text-sec">{query.error instanceof Error ? query.error.message : 'This could not be loaded.'}</p><button type="button" onClick={() => query.refetch()} className="tap-target mt-3 text-ui-13 text-tea-gold hover:text-tea-gold-lt">Retry</button></section>;
  const table = query.data;
  if (!table) return null;
  const busy = approve.isPending || decline.isPending;
  const shareText = table.share_link ? `Pay ${contributorName} on Teajia: ${table.share_link}` : '';

  return (
    <section id="pay-access" className="scroll-mt-6 border-y border-tea-border py-8" aria-labelledby="pay-access-heading" data-testid="pay-access-panel">
      <h2 id="pay-access-heading" className={`${TYPOGRAPHY_CLASSES.h3} text-tea-text`}>Who can see your payment details</h2>
      <p className="mt-2 max-w-[52ch] text-ui-13 text-tea-text-sec">Your bank and transfer details are never public. They open for accounts you approve, and for anyone you hand a pay link to. Approval is permanent.</p>

      {table.pending.length > 0 && (
        <ul className="mt-5 divide-y divide-tea-border border-t border-tea-border" aria-label="Requests">
          {table.pending.map(grant => (
            <PayAccessRequestRow key={grant.id} grant={grant} busy={busy} onApprove={() => approve.mutate(grant.id)} onDecline={() => decline.mutate(grant.id)} />
          ))}
        </ul>
      )}
      {(approve.isError || decline.isError) && <p role="alert" className="mt-2 text-ui-12 text-tea-text-sec">That could not be saved. Try again.</p>}

      <div className={`${table.pending.length ? 'mt-2' : 'mt-6'} border-t border-tea-border`}>
        <button type="button" onClick={() => setShowApproved(value => !value)} aria-expanded={showApproved} className="flex min-h-[52px] w-full items-center justify-between border-b border-tea-border text-left" data-testid="pay-access-people">
          <span className="font-display text-[24px] leading-[1.08] text-tea-text">People who can see it</span>
          <span className="font-sans text-ui-9 font-medium uppercase tracking-[0.18em] text-tea-text-dim">Approved · {table.approved.length}</span>
        </button>
        {showApproved && (
          <ul className="divide-y divide-tea-border border-b border-tea-border" aria-label="People who can see your payment details">
            {table.approved.length === 0 && <li className="py-3 text-ui-13 text-tea-text-dim">Nobody yet.</li>}
            {table.approved.map(grant => (
              <li key={grant.id} className="flex min-h-[48px] items-center justify-between gap-3 py-2">
                <span className="font-sans text-ui-13 text-tea-text">{grant.user_name}</span>
                <span className="font-sans text-ui-11 text-tea-text-sec">{sinceLine(grant)}</span>
              </li>
            ))}
          </ul>
        )}

        {canShare && (
          <div className="border-b border-tea-border py-4" data-testid="pay-access-share">
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-[24px] leading-[1.08] text-tea-text">Share pay link</span>
              <span className="font-sans text-ui-9 font-medium uppercase tracking-[0.18em] text-tea-text-dim">Send</span>
            </div>
            {table.share_link ? (
              <>
                <p className="mt-2 max-w-[48ch] text-ui-12 text-tea-text-sec">Whoever opens this link sees every payment method you have published. Opening it while signed in approves that account.</p>
                <div className="mt-3 flex min-h-[48px] items-center gap-2.5 rounded-md bg-tea-bg px-3">
                  <span className="min-w-0 flex-1 truncate font-sans text-ui-12 text-tea-text-sec" data-testid="pay-access-share-url">{table.share_link}</span>
                  <CopyButton value={table.share_link} label="pay link" testId="pay-access-share-copy" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a href={whatsappShareHref(shareText)} target="_blank" rel="noopener noreferrer" className={`${GOLD_OUTLINE} tap-target px-4`} style={GOLD_OUTLINE_STYLE}>Send on WhatsApp</a>
                  <CopyButtonWide value={table.share_link} />
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 max-w-[48ch] text-ui-12 text-tea-text-sec">Make one link you can send anyone who has bought tea from you. It opens your pay sheet directly, with the methods only. An invoice's link, from the orders list, carries the amount.</p>
                <button type="button" onClick={() => mint.mutate()} disabled={mint.isPending} className={`${GOLD_OUTLINE} tap-target mt-3`} style={GOLD_OUTLINE_STYLE} data-testid="pay-access-share-mint">
                  {mint.isPending ? 'Making the link' : 'Make a pay link'}
                </button>
                {mint.isError && <p role="alert" className="mt-2 text-ui-12 text-tea-text-sec">{mint.error instanceof Error ? mint.error.message : 'The link could not be made.'}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function CopyButtonWide({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" onClick={copy} className={`${GOLD_OUTLINE} tap-target px-4`} style={GOLD_OUTLINE_STYLE}>
      {copied ? 'Copied' : 'Copy link'}
    </button>
  );
}
