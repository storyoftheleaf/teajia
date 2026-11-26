// Launch 5, M4: on the guests part of a table in a circle, the guests who had
// a seat at an earlier table of that circle, by name, each with one tap to
// ask them to this one. The tap is the host's yes: the guest has a seat, and
// the host tells them themselves. Nothing is sent, and nothing is counted.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import { hostSmallText, hostTableQueryKey, hostText, type HostTablePartProps } from './hostTableParts';

export function CircleGuests({ tableId, detail }: HostTablePartProps) {
  const queryClient = useQueryClient();
  const key = ['host-circle-guests', tableId] as const;
  const answer = useQuery({ queryKey: key, queryFn: () => api.circles.guests(tableId), retry: false });
  const ask = useMutation({
    mutationFn: (attendeeId: string) => api.circles.askBack(tableId, attendeeId),
    retry: false,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: key });
      void queryClient.invalidateQueries({ queryKey: hostTableQueryKey(tableId) });
    },
  });

  const circle = answer.data?.circle;
  if (!circle || detail.table.lifecycle_status !== 'published') return null;
  const guests = answer.data?.guests ?? [];

  return (
    <section aria-labelledby="circle-guests-heading" className="space-y-2 border-t border-tea-border pt-4" data-testid="circle-guests">
      <h2 id="circle-guests-heading" className={`${TYPOGRAPHY_CLASSES.h2} break-words`}>From {circle.name}</h2>
      {guests.length === 0 ? (
        <p className={hostSmallText}>Everyone from the earlier tables of this circle is already here.</p>
      ) : (
        <>
          <p className={hostSmallText}>Guests from an earlier table of this circle. Asking one gives them a seat; tell them yourself.</p>
          <ul className="space-y-2">
            {guests.map(guest => (
              <li key={guest.attendee_id} className="flex flex-wrap items-center justify-between gap-2">
                <span className={`${hostText} min-w-0 break-words`}>{guest.name}</span>
                <Button type="button" variant="secondary" className="tap-target" disabled={ask.isPending}
                  onClick={() => ask.mutate(guest.attendee_id)}>Ask to this table</Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {ask.isSuccess && <p className={hostSmallText} role="status">{ask.data.name} has a seat.</p>}
      {ask.isError && <p className={hostSmallText} role="alert">{(ask.error as Error).message || 'Could not save. Try again.'}</p>}
    </section>
  );
}
