// /account/host/:id: one of the host's own tables (Launch 2, slice H4).
// The parts are steps in the address through useStepParam
// (?part=guests|teas|way|after, guests by default), so back and forward walk
// between them. Each part is one component other slices fill; see
// src/components/host/hostTableParts.ts for the mount points.
//
// While Launch 2 is closed (on the site, or still on the worker), and for
// anyone who is not this table's host, the page is the site's own not-found
// page, the same as an address that never existed (A10-3, A10-8).
import { Suspense, lazy, useRef, type FormEvent, type ReactElement } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/shared/Button';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { anyoneHostsOpen } from '../lib/anyoneHosts';
import { HostTableAfter } from '../components/host/HostTableAfter';
import { HostTableGuests } from '../components/host/HostTableGuests';
import { HostTableHeader } from '../components/host/HostTableHeader';
import { HostTeaPicker } from '../components/host/HostTeaPicker';
import { WalkthroughEditor } from '../components/host/WalkthroughEditor';
import { CircleGuests } from '../components/host/CircleGuests';
import { circlesOpen } from '../lib/circles';
import {
  HOST_TABLE_PARTS, hostSmallText, hostTableQueryKey, hostText, type HostTablePart, type HostTablePartProps,
} from '../components/host/hostTableParts';
import { useAuth } from '../hooks/useAuth';
import { useStepParam } from '../hooks/useStepParam';
import { api, hasToken } from '../lib/api';
import { authPagePath } from '../lib/authNavigation';
import { fewHostsOpen } from '../lib/fewHosts';
import { PART_QUERY, partView } from '../lib/closedPart';
import { SiteNotFound } from '../components/SiteNotFound';
import { LoadFailed } from '../components/shared/LoadFailed';

// The shop's own pour page, given this table: it pours into the table's tea list (`?pour=1`).
const PourView = lazy(() => import('../admin/views/PourView'));

const PART_NAMES: Record<HostTablePart, string> = { guests: 'Guests', teas: 'Teas', way: 'The way in', after: 'After' };
const PART_COMPONENTS: Record<HostTablePart, (props: HostTablePartProps) => ReactElement> = {
  guests: HostTableGuests,
  teas: HostTeaPicker,
  way: WalkthroughEditor,
  after: HostTableAfter,
};

export default function HostedTablePage() {
  if (!fewHostsOpen()) return <SiteNotFound />;
  return <OwnTable />;
}

function OwnTable() {
  const { id = '' } = useParams();
  const { pathname, search } = useLocation();
  const { isSessionReady } = useAuth();
  const signedIn = hasToken();
  const table = useQuery({
    queryKey: hostTableQueryKey(id),
    queryFn: () => api.tables.get(id),
    enabled: signedIn && isSessionReady && Boolean(id),
    ...PART_QUERY,
  });
  const view = partView(table);
  const [pouring] = useStepParam('pour');

  if (!signedIn) return <Navigate replace to={authPagePath('signin', pathname + search)} />;
  if (!id || view.state === 'closed' || (table.error as { status?: number } | null)?.status === 403) return <SiteNotFound />;
  let content;
  if (!isSessionReady || view.state === 'loading' || view.state === 'off') content = <p className={hostText} role="status">Opening the table…</p>;
  else if (view.state === 'failed') content = <LoadFailed sentence="Could not open the table just now." onRetry={view.retry} />;
  else if (pouring) return <Suspense fallback={null}><PourView tableId={id} /></Suspense>;
  else content = <TableParts tableId={id} detail={view.data} />;
  return (
    <main className="mx-auto w-full max-w-lg px-4 pt-6 pb-nav" data-host-page="table">
      {content}
    </main>
  );
}

function TableParts(props: HostTablePartProps) {
  const [partValue, setPart] = useStepParam('part', 'guests');
  const part: HostTablePart = (HOST_TABLE_PARTS as readonly string[]).includes(partValue) ? partValue as HostTablePart : 'guests';
  const Part = PART_COMPONENTS[part];
  return (
    <div className="space-y-6">
      <HostTableHeader {...props} />
      {anyoneHostsOpen() && <SameTableAgain {...props} />}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Parts of the table">
        {HOST_TABLE_PARTS.map(name => (
          <button key={name} type="button" className="btn-tab tap-target" aria-pressed={part === name}
            data-active={part === name ? 'true' : undefined} onClick={() => setPart(name, { only: true })}>
            {PART_NAMES[name]}
          </button>
        ))}
      </div>
      <Part {...props} />
      {part === 'guests' && circlesOpen() && <CircleGuests {...props} />}
    </div>
  );
}

/**
 * The day and time a week after a table, on the table's own clock, for the
 * "Same table again" form (review A11-13). Falls back to the device's zone.
 */
export function aWeekOn(eventDate: string, timezone: string | null, now = Date.now()): { date: string; time: string } {
  const at = Date.parse(eventDate);
  // A table long past starts the next one a week from today, at its own time.
  const base = Number.isFinite(at) ? at : now;
  let next = base + 7 * 24 * 60 * 60 * 1000;
  while (next <= now) next += 7 * 24 * 60 * 60 * 1000;
  const format = (zone?: string) => new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(next));
  let parts: Intl.DateTimeFormatPart[];
  try { parts = format(timezone ?? undefined); } catch { parts = format(); }
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` };
}

/**
 * Same table again (review A11-13): one tap opens a form already filled from
 * this table, a week on; making it copies the table with its teas and way,
 * as the same_table_again tool does. The form is a step in the address.
 */
function SameTableAgain({ tableId, detail }: HostTablePartProps) {
  const [step, setStep] = useStepParam('again');
  const navigate = useNavigate();
  const saving = useRef(false);
  const start = aWeekOn(detail.table.event_date, detail.table.timezone);
  const make = useMutation({
    mutationFn: (when: { date: string; time: string }) => api.tables.again(tableId, when),
    retry: false,
    onSuccess: made => navigate(`/account/host/${encodeURIComponent(made.id)}`),
  });
  if (step !== 'form') {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className="tap-target" onClick={() => setStep('form')}>Same table again</Button>
      </div>
    );
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const fields = new FormData(event.currentTarget);
    saving.current = true;
    make.mutate({ date: String(fields.get('date')), time: String(fields.get('time')) }, { onSettled: () => { saving.current = false; } });
  }
  const labelClass = `${TYPOGRAPHY_CLASSES.label} grid min-w-0 flex-1 gap-1 text-tea-text-sec`;
  return (
    <form className="space-y-3 rounded border border-tea-border bg-tea-surface p-3" onSubmit={submit} data-host-again>
      <p className={hostText}>The same table, with its seats, door, area, teas and way in. Only the day is new.</p>
      <div className="flex flex-wrap gap-3">
        <label className={labelClass}>
          Day
          <input type="date" name="date" className="btn-field block min-h-tap w-full min-w-0" defaultValue={start.date} required />
        </label>
        <label className={labelClass}>
          Time
          <input type="time" name="time" className="btn-field block min-h-tap w-full min-w-0" defaultValue={start.time} required />
        </label>
      </div>
      {detail.table.timezone && <p className={hostSmallText}>Time zone: {detail.table.timezone.replace(/_/g, ' ')}</p>}
      {make.isError && <p className={hostSmallText} role="alert">{(make.error as Error).message}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="quiet" className="tap-target" onClick={() => setStep(null)}>Cancel</Button>
        <Button type="submit" className="tap-target" disabled={make.isPending}>{make.isPending ? 'Making the table…' : 'Make the table'}</Button>
      </div>
    </form>
  );
}
