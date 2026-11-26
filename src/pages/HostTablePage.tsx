import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Button } from '../components/shared/Button';
import { TYPOGRAPHY_CLASSES } from '../designTokens';
import { useAuth } from '../hooks/useAuth';
import { useStepParam } from '../hooks/useStepParam';
import { api, hasToken, type HostedTableDoor } from '../lib/api';
import { authPagePath } from '../lib/authNavigation';
import { fewHostsOpen } from '../lib/fewHosts';
import { yourTablePlaceOpen } from '../lib/yourTablePlace';
import { YourTablePlaceSection } from '../components/host/YourTablePlace';
import { HostCirclesSection } from '../components/host/HostCircles';
import { circlesOpen } from '../lib/circles';

const textClass = `${TYPOGRAPHY_CLASSES.body} text-tea-text-sec`;
const fieldClass = 'btn-field block min-h-tap w-full min-w-0';
const labelClass = `${TYPOGRAPHY_CLASSES.label} grid min-w-0 gap-1 text-tea-text-sec`;

export default function HostTablePage() {
  return fewHostsOpen() ? <HostingAccess /> : null;
}

function HostingAccess() {
  const { pathname, search } = useLocation();
  const { user, isSessionReady } = useAuth();
  const signedIn = hasToken();
  const hosting = useQuery({
    queryKey: ['host-table-access', user?.email],
    queryFn: () => api.hosting.get(),
    enabled: signedIn && isSessionReady,
    staleTime: 60_000,
    retry: false,
  });

  if (!signedIn) return <Navigate replace to={authPagePath('signin', pathname + search)} />;

  let content: ReactNode;
  if (!isSessionReady || hosting.isPending) {
    content = <p className={textClass} role="status">Checking hosting access…</p>;
  } else if (hosting.isError) {
    content = <p className={textClass} role="alert">Could not check hosting access. Reload to try again.</p>;
  } else if (hosting.data.stopped) {
    // Launch 3: Teajia paused this person's hosting. Told to them alone, here.
    content = <p className={textClass}>New tables are paused on your account. Write to Teajia to talk it over.</p>;
  } else if (!hosting.data.doors?.length) {
    content = <p className={textClass}>Hosting opens by invitation for now.</p>;
  } else {
    content = (
      <>
        <MakeTable key={user?.email} doors={hosting.data.doors} />
        {yourTablePlaceOpen() && <YourTablePlaceSection />}
        {circlesOpen() && <HostCirclesSection />}
        <YourRecord />
      </>
    );
  }

  return (
    <main className="mx-auto w-full max-w-lg px-4 pt-6 pb-nav">
      {content}
    </main>
  );
}

/**
 * The host's record, theirs to take away (slice H11). Adrian's words,
 * 2026-11-26, said once on the host's own page. One JSON file, never a zip.
 */
function YourRecord() {
  const download = useMutation({
    mutationFn: api.hosting.record,
    retry: false,
    onSuccess: record => {
      const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `teajia-record-${record.made_at.slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    },
  });
  return (
    <section className="mt-8 space-y-2 border-t border-tea-border pt-4" data-testid="host-record">
      <p className={textClass}>Free to host, and your record is yours.</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className="tap-target" disabled={download.isPending}
          onClick={() => download.mutate()}>
          {download.isPending ? 'Preparing your record…' : 'Download my record'}
        </Button>
      </div>
      {download.isError && <p className={textClass} role="alert">Could not prepare your record. Try again in a moment.</p>}
    </section>
  );
}

function MakeTable({ doors }: { doors: HostedTableDoor[] }) {
  const [tableId, setTableId] = useStepParam('made');
  const saving = useRef(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timezoneLabel = new Intl.DateTimeFormat(undefined, { timeZone: timezone, timeZoneName: 'longGeneric' })
    .formatToParts().find(part => part.type === 'timeZoneName')?.value ?? timezone.replace(/_/g, ' ');
  const create = useMutation({
    mutationFn: api.tables.create,
    retry: false,
    onSuccess: table => setTableId(table.id),
  });
  const justMade = create.data?.id === tableId && create.variables
    ? { link: create.data.link, day: formatDay(create.variables.date, 'UTC') }
    : undefined;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current) return;
    const fields = new FormData(event.currentTarget);
    saving.current = true;
    create.mutate({
      date: String(fields.get('date')),
      time: String(fields.get('time')),
      timezone,
      seats: Number(fields.get('seats')),
      door: fields.get('door') === 'link' || fields.get('door') === 'open' ? fields.get('door') as 'link' | 'open' : 'request',
      name: String(fields.get('name')).trim() || null,
    }, { onSettled: () => { saving.current = false; } });
  }

  return (
    <div className="space-y-4">
      <h1 className={TYPOGRAPHY_CLASSES.h1}>{tableId ? 'Your table is ready' : 'Host a table'}</h1>
      {tableId && <TableLink key={tableId} id={tableId} justMade={justMade} />}
      <form hidden={Boolean(tableId)} className="space-y-3" onSubmit={submit}>
        <div className="flex flex-wrap gap-3">
          <label className={`${labelClass} flex-1`}>
            Day
            <input type="date" name="date" className={fieldClass} required />
          </label>
          <label className={`${labelClass} flex-1`}>
            Time
            <input type="time" name="time" className={fieldClass} required aria-describedby="table-timezone" />
          </label>
        </div>
        <p id="table-timezone" className={`${TYPOGRAPHY_CLASSES.bodyLight} text-tea-text-sec`}>Time zone: {timezoneLabel}</p>
        <div className="grid grid-cols-3 gap-3">
          <label className={labelClass}>
            Seats
            <input type="number" name="seats" className={fieldClass} defaultValue={6} min={1} max={40} step={1} required />
          </label>
          <label className={`${labelClass} col-span-2`}>
            Name (optional)
            <input type="text" name="name" className={fieldClass} maxLength={120} />
          </label>
        </div>
        <fieldset>
          <legend className={`${TYPOGRAPHY_CLASSES.label} text-tea-text-sec`}>How guests get a seat</legend>
          {doors.includes('request') && (
            <label className={`${textClass} flex min-h-tap items-center gap-2`}>
              <input type="radio" name="door" value="request" defaultChecked className="accent-tea-gold" />
              I say yes to each guest
            </label>
          )}
          {doors.includes('link') && (
            <label className={`${textClass} flex min-h-tap items-center gap-2`}>
              <input type="radio" name="door" value="link" defaultChecked={!doors.includes('request')} className="accent-tea-gold" />
              Anyone with the link has a seat
            </label>
          )}
          {doors.includes('open') && (
            <label className={`${textClass} flex min-h-tap items-center gap-2`}>
              <input type="radio" name="door" value="open" className="accent-tea-gold" />
              People on Teajia can find it, and I say yes to each guest
            </label>
          )}
        </fieldset>
        {create.isError && <p className={textClass} role="alert">{create.error.message}</p>}
        <div className="flex justify-end">
          <Button type="submit" className="tap-target" disabled={create.isPending}>
            {create.isPending ? 'Making the table…' : 'Make the table'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function formatDay(date: string, timezone?: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: timezone }).format(new Date(date));
}

function TableLink({ id, justMade }: { id: string; justMade?: { link: string; day: string } }) {
  const [feedback, setFeedback] = useState('');
  const { user } = useAuth();
  const { data, isError } = useQuery({
    queryKey: ['host-table-link', user?.email, id],
    queryFn: () => api.tables.get(id),
    enabled: !justMade,
    retry: false,
  });
  const table = data?.table;
  const details = justMade ?? (table && { link: table.link, day: formatDay(table.event_date, table.timezone ?? undefined) });
  if (!details) {
    return isError
      ? <p className={textClass} role="alert">Could not open the table link. Reload to try again.</p>
      : <p className={textClass} role="status">Opening the table link…</p>;
  }

  const { day, link } = details;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Join my tea table on ${day}. ${link}`)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setFeedback('Link copied.');
    } catch {
      setFeedback('Select the link above to copy it.');
    }
  }

  return (
    <div className="space-y-3">
      <p className={textClass}>{day}</p>
      <input className={fieldClass} type="text" aria-label="Table link" value={link} readOnly
        onFocus={event => event.target.select()} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" className="tap-target" onClick={() => void copyLink()}>Copy link</Button>
        <a className="btn-secondary tap-target" href={whatsapp} target="_blank" rel="noreferrer">Send in WhatsApp</a>
      </div>
      {feedback && <p className={textClass} role="status">{feedback}</p>}
      <Link className="btn-quiet tap-target" to={`/account/host/${encodeURIComponent(id)}`}>Open the table’s page</Link>
    </div>
  );
}
