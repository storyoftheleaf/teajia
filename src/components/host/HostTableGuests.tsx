// The `guests` part of /account/host/:id (Launch 2, H4): who is coming, in
// three plain groups, with the host's yes or no in one tap.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import type { HostedTableGuest } from '../../lib/hostingApi';
import { guestWhatsApp, hostSmallText, hostTableQueryKey, hostText, type HostTablePartProps } from './hostTableParts';

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
  const open = detail.table.lifecycle_status === 'published';

  return (
    <section aria-labelledby="host-part-guests" data-host-part="guests" className="space-y-5">
      <h2 id="host-part-guests" className={TYPOGRAPHY_CLASSES.h2}>Guests</h2>
      {answer.isError && <p className={hostText} role="alert">{answer.error.message}</p>}
      {GROUPS.map(group => {
        const guests = detail.guests.filter(guest => group.statuses.includes(guest.status));
        return (
          <section key={group.key} aria-labelledby={`host-guests-${group.key}`} data-host-group={group.key} className="space-y-2">
            <h3 id={`host-guests-${group.key}`} className={TYPOGRAPHY_CLASSES.h3}>{group.heading}</h3>
            {guests.length === 0 && <p className={hostSmallText}>{group.empty}</p>}
            <ul className="space-y-2">
              {guests.map(guest => (
                <GuestRow key={guest.id} guest={guest} open={open} busy={answer.isPending && answer.variables?.guestId === guest.id}
                  onAnswer={yes => answer.mutate({ guestId: guest.id, yes })} />
              ))}
            </ul>
          </section>
        );
      })}
    </section>
  );
}

function GuestRow({ guest, open, busy, onAnswer }: {
  guest: HostedTableGuest; open: boolean; busy: boolean; onAnswer: (yes: boolean) => void;
}) {
  const whatsapp = guestWhatsApp(guest);
  const waiting = open && (guest.status === 'requested' || guest.status === 'waitlist');
  return (
    <li className="space-y-1 rounded border border-tea-border bg-tea-surface p-3" data-host-guest={guest.id}>
      <p className={`${TYPOGRAPHY_CLASSES.body} text-tea-text`}>
        {guest.full_name}{guest.plus_one ? ` and ${guest.plus_one} more` : ''}
      </p>
      {guest.note && <p className={hostSmallText}>{guest.note}</p>}
      {guest.no_photographs && <p className={hostSmallText}>Please, no photographs of me</p>}
      {guest.status === 'waitlist' && <p className={hostSmallText}>Waiting for a seat to open</p>}
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
      </div>
    </li>
  );
}
