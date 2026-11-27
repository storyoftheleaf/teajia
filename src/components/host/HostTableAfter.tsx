// The `after` part of /account/host/:id (Launch 2, H4): once the table's time
// has come, the host marks who came and copies each one their thank-you link.
// Below it sits the host's private guest book (GuestBookPrivate, H9).
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GuestBookReview } from '../../admin/components/GuestBookReview';
import { Button } from '../shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { anyoneHostsOpen } from '../../lib/anyoneHosts';
import { teaTableOpen } from '../../lib/teaTable';
import type { HostedTableGuest } from '../../lib/hostingApi';
import { GuestBookPrivate } from './GuestBookPrivate';
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
      {ended ? <WhoCame {...props} /> : <p className={hostText}>When the table has ended, mark who came here.</p>}
      {ended && <RecapLine tableId={props.tableId} />}
      {anyoneHostsOpen() && ['completed', 'archived'].includes(detail.table.lifecycle_status) &&
        <GuestBookReview eventId={props.tableId} reviewer="host" />}
      {begun && <GuestBookPrivate {...props} />}
    </section>
  );
}

/**
 * Who came, on the list itself once the table has ended (review A9-13,
 * W2-6): every guest who had a seat, ticked as coming until the host says
 * otherwise, one Save, and a thank-you link beside each guest saved as having
 * come. Recording one absence is untick and Save; a link is Save and Copy.
 * Who gets a link is unchanged: only a guest the worker has as having come.
 */
/**
 * The way to the recap from the table's own page (review W2-7): it is written
 * on that table's page in Manage. The Tea Table is named only while it is open.
 */
export function RecapLine({ tableId }: { tableId: string }) {
  const words = teaTableOpen() ? 'Write the recap and share it on the Tea Table' : 'Write the recap';
  return (
    <p className={hostText} data-host-recap-line>
      <Link className="btn-quiet tap-target" to={`/admin/events/${encodeURIComponent(tableId)}?tab=post-session`}>{words}</Link>
    </p>
  );
}

function WhoCame({ tableId, detail }: HostTablePartProps) {
  const coming = detail.guests.filter(guest => guest.status === 'confirmed');
  if (coming.length === 0) return <p className={hostSmallText}>Nobody had a seat at this table.</p>;
  return <MarkWhoCame key={coming.map(guest => `${guest.id}:${guest.attended}`).join(',')} tableId={tableId} guests={coming} />;
}

/** What the list starts from: everyone not saved as absent. */
export function startingWhoCame(guests: ReadonlyArray<Pick<HostedTableGuest, 'id' | 'attended'>>): Set<string> {
  return new Set(guests.filter(guest => guest.attended !== 0).map(guest => guest.id));
}

function MarkWhoCame({ tableId, guests }: { tableId: string; guests: HostedTableGuest[] }) {
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState(() => startingWhoCame(guests));
  const saved = guests.some(guest => guest.attended === 0 || guest.attended === 1);
  const changed = guests.some(guest => chosen.has(guest.id) !== (guest.attended === 1));
  const save = useMutation({
    mutationFn: () => api.tables.markWhoCame(tableId, [...chosen]),
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTableQueryKey(tableId) }),
  });
  const toggle = (id: string) => setChosen(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  return (
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); save.mutate(); }} data-host-who-came>
      <fieldset className="space-y-1">
        <legend className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>Who came</legend>
        {guests.map(guest => (
          <div key={guest.id} className="flex flex-wrap items-center justify-between gap-2">
            <label className={`${hostText} flex min-h-tap items-center gap-2`}>
              <input type="checkbox" className="accent-tea-gold" checked={chosen.has(guest.id)} onChange={() => toggle(guest.id)} />
              {guest.full_name}
            </label>
            {guest.attended === 1 && chosen.has(guest.id) && <ThanksRow tableId={tableId} guest={guest} />}
          </div>
        ))}
      </fieldset>
      {save.isError && <p className={hostSmallText} role="alert">{save.error.message}</p>}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {saved && !changed && !save.isPending && <p className={`${hostSmallText} mr-auto`} role="status">Saved.</p>}
        <Button type="submit" className="tap-target" disabled={save.isPending || (saved && !changed)}>
          {save.isPending ? 'Saving…' : 'Save who came'}
        </Button>
      </div>
    </form>
  );
}

function ThanksRow({ tableId, guest }: { tableId: string; guest: HostedTableGuest }) {
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  async function copy() {
    setBusy(true);
    try {
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
    <div className="flex flex-wrap items-center gap-2" data-host-came={guest.id}>
      <Button type="button" size="sm" variant="quiet" className="tap-target" disabled={busy} onClick={() => void copy()}
        aria-label={`Copy their thank-you link for ${guest.full_name}`}>Copy their thank-you link</Button>
      {feedback && <p className={`${hostSmallText} w-full`} role="status">{feedback}</p>}
    </div>
  );
}
