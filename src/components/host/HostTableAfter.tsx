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
import { hostSmallText, hostTableQueryKey, hostText, tableHasBegun, type HostTablePartProps } from './hostTableParts';

export function HostTableAfter(props: HostTablePartProps) {
  const { detail } = props;
  const begun = tableHasBegun(detail.table.event_date);
  return (
    <section aria-labelledby="host-part-after" data-host-part="after" className="space-y-5">
      <h2 id="host-part-after" className={TYPOGRAPHY_CLASSES.h2}>After</h2>
      {begun ? <WhoCame {...props} /> : <p className={hostText}>When the table has begun, mark who came here.</p>}
      {anyoneHostsOpen() && ['completed', 'archived'].includes(detail.table.lifecycle_status) &&
        <GuestBookReview eventId={props.tableId} reviewer="host" />}
      {begun && <GuestBookPrivate {...props} />}
    </section>
  );
}

function WhoCame({ tableId, detail }: HostTablePartProps) {
  const [marking, setMarking] = useStepParam('mark');
  const coming = detail.guests.filter(guest => guest.status === 'confirmed');
  const came = coming.filter(guest => guest.attended === 1);

  if (marking === 'came') {
    return <MarkWhoCame tableId={tableId} guests={coming} onDone={() => setMarking(null)} />;
  }
  return (
    <div className="space-y-3">
      <Button type="button" variant="secondary" className="tap-target" onClick={() => setMarking('came')}
        disabled={coming.length === 0}>Mark who came</Button>
      {coming.length === 0 && <p className={hostSmallText}>Nobody had a seat at this table.</p>}
      {came.length > 0 && (
        <ul className="space-y-2" aria-label="Who came">
          {came.map(guest => <ThanksRow key={guest.id} tableId={tableId} guest={guest} />)}
        </ul>
      )}
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
    <li className="flex flex-wrap items-center justify-between gap-2" data-host-came={guest.id}>
      <span className={`${TYPOGRAPHY_CLASSES.body} text-tea-text`}>{guest.full_name}</span>
      <Button type="button" size="sm" variant="quiet" className="tap-target" disabled={busy} onClick={() => void copy()}
        aria-label={`Copy their thank-you link for ${guest.full_name}`}>Copy their thank-you link</Button>
      {feedback && <p className={`${hostSmallText} w-full`} role="status">{feedback}</p>}
    </li>
  );
}
