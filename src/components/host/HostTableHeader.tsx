// The top of the host's page for one table (Launch 2, H4): the day and time,
// the door in words, seats taken of seats, the link to send, and two quiet
// controls for the door and the seats while the table is still ahead.
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '../shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { api } from '../../lib/api';
import { HostTableLinks } from './HostTableLinks';
import { PourLink, pourDay } from './PourLink';
import type { HostedTableDoor } from '../../lib/hostingApi';
import {
  DOOR_WORDS, TABLE_AREA_HINT, doorOf, doorWords, hostSmallText, hostTableQueryKey, hostText, tableWhen, type HostTablePartProps,
} from './hostTableParts';

const fieldClass = 'btn-field block min-h-tap w-full min-w-0';
const labelClass = `${TYPOGRAPHY_CLASSES.label} grid min-w-0 gap-1 text-tea-text-sec`;

export function HostTableHeader({ tableId, detail }: HostTablePartProps) {
  const { table } = detail;
  const when = tableWhen(table.event_date, table.timezone);
  const [feedback, setFeedback] = useState('');
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Join my tea table on ${when}. ${table.link}`)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(table.link);
      setFeedback('Link copied.');
    } catch {
      setFeedback('Select the link above to copy it.');
    }
  }

  return (
    <header className="space-y-3">
      <h1 className={TYPOGRAPHY_CLASSES.h1}>{table.title}</h1>
      <p className={hostText}>{when}</p>
      <p className={hostText} data-host-door={table.door ?? 'request'}>{doorWords(table.door)}</p>
      <p className={hostText} data-host-seats>
        {table.seats_taken} of {table.seats} {table.seats === 1 ? 'seat' : 'seats'} taken
      </p>
      <input className={fieldClass} type="text" aria-label="Table link" value={table.link} readOnly
        onFocus={event => event.target.select()} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className="tap-target" onClick={() => void copyLink()}>Copy link</Button>
        <a className="btn-secondary tap-target" href={whatsapp} target="_blank" rel="noreferrer">Send in WhatsApp</a>
        <PourLink day={pourDay(table.event_date, table.timezone)} />
      </div>
      {feedback && <p className={hostSmallText} role="status">{feedback}</p>}
      <HostTableLinks tableId={tableId} detail={detail} only={['card']} />
      {table.lifecycle_status === 'published' && (
        <>
          <TableSettings key={`${table.door}-${table.seats}`} tableId={tableId} detail={detail} />
          <TableArea key={table.area_hint ?? ''} tableId={tableId} detail={detail} />
        </>
      )}
      {typeof table.is_tasting === 'boolean' && <TastingSwitch key={`${tableId}-${table.is_tasting}`} tableId={tableId} detail={detail} />}
    </header>
  );
}

function TableSettings({ tableId, detail }: HostTablePartProps) {
  const queryClient = useQueryClient();
  const { table, doors } = detail;
  const [door, setDoor] = useState<HostedTableDoor>(doorOf(table.door));
  const [seats, setSeats] = useState(String(table.seats));
  const change = useMutation({
    mutationFn: (next: { door?: HostedTableDoor; seats?: number }) => api.tables.change(tableId, next),
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTableQueryKey(tableId) }),
  });
  const seatsNumber = Number(seats);
  const changed = door !== doorOf(table.door) || seatsNumber !== table.seats;
  const tooFew = Number.isInteger(seatsNumber) && seatsNumber < table.seats_taken;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed || tooFew) return;
    const next: { door?: HostedTableDoor; seats?: number } = {};
    if (door !== doorOf(table.door)) next.door = door;
    if (seatsNumber !== table.seats) next.seats = seatsNumber;
    change.mutate(next);
  }

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={submit} aria-label="Door and seats">
      <label className={`${labelClass} flex-1`}>
        How guests get a seat
        <select className={fieldClass} value={door} onChange={event => setDoor(event.target.value as HostedTableDoor)}>
          {(['request', 'link', 'open'] as const).filter(option => doors.includes(option) || option === doorOf(table.door)).map(option => (
            <option key={option} value={option}>{DOOR_WORDS[option]}</option>
          ))}
        </select>
      </label>
      <label className={`${labelClass} w-24`}>
        Seats
        <input className={fieldClass} type="number" min={1} max={40} step={1} value={seats}
          onChange={event => setSeats(event.target.value)} />
      </label>
      <Button type="submit" variant="quiet" className="tap-target" disabled={!changed || tooFew || change.isPending}>
        {change.isPending ? 'Saving…' : 'Save'}
      </Button>
      {tooFew && (
        <p className={`${hostSmallText} w-full`} role="alert">
          {table.seats_taken} {table.seats_taken === 1 ? 'seat is' : 'seats are'} already taken, so the table needs at least {table.seats_taken}.
        </p>
      )}
      {change.isError && <p className={`${hostSmallText} w-full`} role="alert">{change.error.message}</p>}
    </form>
  );
}

/**
 * The area people are told, one short line, never the address (Launch 2,
 * check run H13, finding 1). The worker refuses a link or the saved address
 * (worker/src/hostTableArea.ts). Left blank, the public page names no place.
 */
function TableArea({ tableId, detail }: HostTablePartProps) {
  const queryClient = useQueryClient();
  const saved = detail.table.area_hint ?? '';
  const [area, setArea] = useState(saved);
  const change = useMutation({
    mutationFn: (next: string) => api.tables.change(tableId, { area: next.trim() || null }),
    retry: false,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTableQueryKey(tableId) }),
  });
  const changed = area.trim() !== saved;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed || change.isPending) return;
    change.mutate(area);
  }

  return (
    <form className="flex flex-wrap items-end gap-3" onSubmit={submit} aria-label="Area">
      <label className={`${labelClass} flex-1`}>
        Area
        <input className={fieldClass} type="text" maxLength={80} value={area} aria-describedby="host-table-area-hint"
          onChange={event => setArea(event.target.value)} />
      </label>
      <Button type="submit" variant="quiet" className="tap-target" disabled={!changed || change.isPending}>
        {change.isPending ? 'Saving…' : 'Save'}
      </Button>
      <p id="host-table-area-hint" className={`${hostSmallText} w-full`}>{TABLE_AREA_HINT}</p>
      {change.isError && <p className={`${hostSmallText} w-full`} role="alert">{change.error.message}</p>}
    </form>
  );
}

/**
 * "This is a tasting" (J13 finding 4): the host's own choice, the same write
 * as the set_session_tasting agent tool. On the day, a confirmed guest's page
 * then opens the tasting; nothing is sent to anyone.
 */
function TastingSwitch({ tableId, detail }: HostTablePartProps) {
  const queryClient = useQueryClient();
  const saved = detail.table.is_tasting === true;
  // What the host chose shows at once; a refusal puts the saved answer back.
  const [shown, setShown] = useState(saved);
  const change = useMutation({
    mutationFn: (next: boolean) => api.tables.setTasting(tableId, next),
    retry: false,
    onError: () => setShown(saved),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: hostTableQueryKey(tableId) }),
  });
  return (
    <div className="space-y-1">
      <label className={`${hostText} inline-flex min-h-tap cursor-pointer items-center gap-2`}>
        <input type="checkbox" role="switch" className="h-4 w-4 shrink-0 accent-tea-gold"
          checked={shown} aria-checked={shown} disabled={change.isPending}
          onChange={event => { setShown(event.target.checked); change.mutate(event.target.checked); }} data-testid="host-table-tasting" />
        This is a tasting
      </label>
      <p className={hostSmallText}>On the day, each guest with a seat can open the tasting from their own page.</p>
      {change.isError && <p className={hostSmallText} role="alert">{change.error.message}</p>}
    </div>
  );
}
