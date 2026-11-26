// The `guests` part of /account/host/:id (Launch 2, H4): who is coming, in
// three plain groups, with the host's yes or no in one tap. Since J9 the host
// can also give back a confirmed guest's seat (asked twice, since it cannot be
// undone here), and reads what happened to the seats.
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import type { HostedTableGuest } from '../../lib/hostingApi';
import { guestWhatsApp, hostSmallText, hostTableQueryKey, hostText, type HostTablePartProps } from './hostTableParts';
import { SeatNoticeList } from './SeatNoticeList';

const GROUPS: { key: string; heading: string; statuses: HostedTableGuest['status'][]; empty: string }[] = [
  { key: 'waiting', heading: 'Asked, waiting for your yes', statuses: ['requested', 'waitlist'], empty: 'Nobody is waiting.' },
  { key: 'coming', heading: 'Coming', statuses: ['confirmed'], empty: 'Nobody yet.' },
  { key: 'not-coming', heading: 'Not coming', statuses: ['denied', 'cancelled'], empty: 'Nobody.' },
];

export function HostTableGuests({ tableId, detail }: HostTablePartProps) {
  const queryClient = useQueryClient();
  const answer = useMutation({
    mutationFn: ({ guestId, yes }: { guestId: string; yes: boolean }): Promise<{ ok: true; status: string }> =>
      yes ? api.tables.sayYes(tableId, guestId) : api.tables.sayNo(tableId, guestId),
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey: hostTableQueryKey(tableId) }),
  });
  const release = useMutation({
    mutationFn: (guestId: string) => api.tables.releaseSeat(tableId, guestId),
    retry: false,
    onSettled: () => queryClient.invalidateQueries({ queryKey: hostTableQueryKey(tableId) }),
  });
  const open = detail.table.lifecycle_status === 'published';

  return (
    <section aria-labelledby="host-part-guests" data-host-part="guests" className="space-y-5">
      <h2 id="host-part-guests" className={TYPOGRAPHY_CLASSES.h2}>Guests</h2>
      {answer.isError && <p className={hostText} role="alert">{answer.error.message}</p>}
      {release.isError && <p className={hostText} role="alert">{release.error.message}</p>}
      {GROUPS.map(group => {
        const guests = detail.guests.filter(guest => group.statuses.includes(guest.status));
        return (
          <section key={group.key} aria-labelledby={`host-guests-${group.key}`} data-host-group={group.key} className="space-y-2">
            <h3 id={`host-guests-${group.key}`} className={TYPOGRAPHY_CLASSES.h3}>{group.heading}</h3>
            {guests.length === 0 && <p className={hostSmallText}>{group.empty}</p>}
            <ul className="space-y-2">
              {guests.map(guest => (
                <GuestRow key={guest.id} guest={guest} open={open}
                  busy={(answer.isPending && answer.variables?.guestId === guest.id) || (release.isPending && release.variables === guest.id)}
                  onAnswer={yes => answer.mutate({ guestId: guest.id, yes })}
                  onRelease={() => release.mutate(guest.id)} />
              ))}
            </ul>
          </section>
        );
      })}
      <SeatNoticeList notices={detail.notices ?? []} headingId="host-guests-notices" />
    </section>
  );
}

function offerTime(at: string): string {
  const parsed = Date.parse(at);
  if (!Number.isFinite(parsed)) return at;
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(parsed));
}

function GuestRow({ guest, open, busy, onAnswer, onRelease }: {
  guest: HostedTableGuest; open: boolean; busy: boolean; onAnswer: (yes: boolean) => void; onRelease: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const whatsapp = guestWhatsApp(guest);
  // A guest with a live offer is answered by the offer, not by the host.
  const waiting = open && (guest.status === 'requested' || (guest.status === 'waitlist' && !guest.offer_until));
  const releasable = open && guest.status === 'confirmed';
  return (
    <li className="space-y-1 rounded border border-tea-border bg-tea-surface p-3" data-host-guest={guest.id}>
      <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text`}>
        {guest.full_name}{guest.plus_one ? ` and ${guest.plus_one} more` : ''}
      </p>
      {guest.note && <p className={hostSmallText}>{guest.note}</p>}
      {guest.no_photographs && <p className={hostSmallText}>Please, no photographs of me</p>}
      {guest.status === 'waitlist' && (
        <p className={hostSmallText}>
          {guest.offer_until
            ? `Offered a seat that opened, until ${offerTime(guest.offer_until)}`
            : guest.offer_lapsed ? 'Was offered a seat and did not take it in time' : 'Waiting for a seat to open'}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {waiting && guest.status === 'requested' && (
          <Button type="button" size="sm" className="tap-target" disabled={busy} onClick={() => onAnswer(true)}
            aria-label={`Yes to ${guest.full_name}`}>Yes</Button>
        )}
        {waiting && (
          <Button type="button" size="sm" variant="secondary" className="tap-target" disabled={busy} onClick={() => onAnswer(false)}
            aria-label={`No to ${guest.full_name}`}>No</Button>
        )}
        {whatsapp && (
          <a className="btn-quiet btn-sm tap-target" href={whatsapp} target="_blank" rel="noreferrer">Message in WhatsApp</a>
        )}
        {releasable && !asking && (
          <Button type="button" size="sm" variant="secondary" className="tap-target" disabled={busy} onClick={() => setAsking(true)}
            aria-label={`Release the seat of ${guest.full_name}`}>Release seat</Button>
        )}
      </div>
      {releasable && asking && (
        <div className="flex flex-wrap items-center gap-2" data-host-release-ask={guest.id}>
          <p className={hostSmallText}>Give back {guest.full_name}’s seat? It goes to whoever has waited longest.</p>
          <Button type="button" size="sm" variant="secondary" className="tap-target" disabled={busy} onClick={() => setAsking(false)}>
            Keep it
          </Button>
          <Button type="button" size="sm" className="tap-target" disabled={busy}
            onClick={() => { setAsking(false); onRelease(); }} aria-label={`Yes, release the seat of ${guest.full_name}`}>
            Release
          </Button>
        </div>
      )}
    </li>
  );
}
