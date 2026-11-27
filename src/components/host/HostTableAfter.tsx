// The `after` part of /account/host/:id (Launch 2, H4): once the table's time
// has come, the host marks who came and copies each one their thank-you link.
// Below it sits the host's private guest book (GuestBookPrivate, H9).
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GuestBookReview } from '../../admin/components/GuestBookReview';
import { Button } from '../shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { useStepParam } from '../../hooks/useStepParam';
import { api } from '../../lib/api';
import { anyoneHostsOpen } from '../../lib/anyoneHosts';
import type { HostedTableGuest } from '../../lib/hostingApi';
import { GuestBookPrivate } from './GuestBookPrivate';
import { HostTableLinks } from './HostTableLinks';
import { sessionMoment } from '../../../shared/sessionEnd';
import { hostSmallText, hostTableQueryKey, hostText, tableHasBegun, type HostTablePartProps } from './hostTableParts';

export function HostTableAfter(props: HostTablePartProps) {
  const { detail } = props;
  const begun = tableHasBegun(detail.table.event_date);
  // Who came is marked once the table has ended, by the same end the worker
  // reads (shared/sessionEnd.ts); saving it finishes the table (review A9-4).
  const ended = sessionMoment({
    event_date: detail.table.event_date, event_end_date: detail.table.event_end_date,
    timezone: detail.table.timezone, lifecycle_status: detail.table.lifecycle_status,
  }) === 'after';
  return (
    <section aria-labelledby="host-part-after" data-host-part="after" className="space-y-5">
      <h2 id="host-part-after" className={TYPOGRAPHY_CLASSES.h2}>After</h2>
      <HostTableLinks {...props} only={['recap', 'tea-table']} />
      {ended ? <WhoCame {...props} /> : <p className={hostText}>When the table has ended, mark who came here.</p>}
      {anyoneHostsOpen() && ['completed', 'archived'].includes(detail.table.lifecycle_status) &&
        <GuestBookReview eventId={props.tableId} reviewer="host" />}
      {begun && <GuestBookPrivate {...props} />}
    </section>
  );
}

function WhoCame({ tableId, detail }: HostTablePartProps) {
  const [marking, setMarking] = useStepParam('mark');
  const coming = detail.guests.filter(guest => guest.status === 'confirmed');
  const thanks = thanksGuests(coming);
  const unmarked = coming.some(guest => guest.attended == null);

  if (marking === 'came') {
    return <MarkWhoCame tableId={tableId} guests={coming} onDone={() => setMarking(null)} />;
  }
  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" className="tap-target" onClick={() => setMarking('came')}
        disabled={coming.length === 0}>Mark who came</Button>
      {coming.length === 0 && <p className={hostSmallText}>Nobody had a seat at this table.</p>}
      {thanks.length > 0 && (
        <ul className="space-y-2" aria-label="Who came">
          {thanks.map(guest => <ThanksRow key={guest.id} tableId={tableId} guests={coming} guest={guest} />)}
        </ul>
      )}
      {unmarked && <p className={hostSmallText}>Copying a thank-you link counts everyone you have not marked as having come. Change it under Mark who came.</p>}
    </div>
  );
}

function MarkWhoCame({ tableId, guests, onDone }: { tableId: string; guests: HostedTableGuest[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState(() => new Set(guests.filter(guest => guest.attended !== 0).map(guest => guest.id)));
  const save = useMutation({
    mutationFn: () => api.tables.markWhoCame(tableId, [...chosen]),
    retry: false,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: hostTableQueryKey(tableId) });
      onDone();
    },
  });
  const toggle = (id: string) => setChosen(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
      <fieldset className="space-y-1">
        <legend className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Who came</legend>
        {guests.map(guest => (
          <label key={guest.id} className={`${hostText} flex min-h-tap items-center gap-2`}>
            <input type="checkbox" className="accent-tea-gold" checked={chosen.has(guest.id)} onChange={() => toggle(guest.id)} />
            {guest.full_name}
          </label>
        ))}
      </fieldset>
      {save.isError && <p className={hostSmallText} role="alert">{save.error.message}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="quiet" className="tap-target" onClick={onDone}>Cancel</Button>
        <Button type="submit" className="tap-target" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
      </div>
    </form>
  );
}

/** Everyone who has a seat and is not marked as absent: each gets a thank-you link at once (review U1-7). */
export function thanksGuests(confirmed: HostedTableGuest[]): HostedTableGuest[] {
  return confirmed.filter(guest => guest.status === 'confirmed' && guest.attended !== 0);
}

function ThanksRow({ tableId, guest, guests }: { tableId: string; guest: HostedTableGuest; guests: HostedTableGuest[] }) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  async function copy() {
    setBusy(true);
    try {
      // A link is for a guest who came; until the host has marked who came, the tap marks them as the
      // Mark screen opens (everyone not marked absent) and then copies, one tap instead of four.
      if (guest.attended !== 1) {
        await api.tables.markWhoCame(tableId, thanksGuests(guests).map(each => each.id));
        await queryClient.invalidateQueries({ queryKey: hostTableQueryKey(tableId) });
      }
      const issued = await api.tables.thanksLink(tableId, guest.id);
      const url = new URL('/after-sit', window.location.origin);
      url.hash = issued.credential;
      await navigator.clipboard.writeText(url.href);
      setFeedback(`Copied. Send it only to ${guest.full_name}.`);
    } catch {
      setFeedback('Could not copy the link. Try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex flex-wrap items-center justify-between gap-2" data-host-came={guest.id}>
      <span className={`${TYPOGRAPHY_CLASSES.body} text-tea-text`}>{guest.full_name}</span>
      <Button type="button" size="sm" variant="quiet" className="tap-target" disabled={busy} onClick={() => void copy()}
        aria-label={`Copy their thank-you link for ${guest.full_name}`}>Copy their thank-you link</Button>
      {feedback && <p className={`${hostSmallText} w-full`} role="status">{feedback}</p>}
    </li>
  );
}
