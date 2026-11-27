// /account/host/:id: one of the host's own tables (Launch 2, slice H4).
// The parts are steps in the address through useStepParam
// (?part=guests|teas|way|after, guests by default), so back and forward walk
// between them. Each part is one component other slices fill; see
// src/components/host/hostTableParts.ts for the mount points.
//
// While Launch 2 is closed (on the site, or still on the worker), and for
// anyone who is not this table's host, the page is the site's own not-found
// page, the same as an address that never existed (A10-3, A10-8).
import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { HostTableAfter } from '../components/host/HostTableAfter';
import { HostTableGuests } from '../components/host/HostTableGuests';
import { HostTableHeader } from '../components/host/HostTableHeader';
import { HostTeaPicker } from '../components/host/HostTeaPicker';
import { WalkthroughEditor } from '../components/host/WalkthroughEditor';
import { CircleGuests } from '../components/host/CircleGuests';
import { circlesOpen } from '../lib/circles';
import {
  HOST_TABLE_PARTS, hostTableQueryKey, hostText, type HostTablePart, type HostTablePartProps,
} from '../components/host/hostTableParts';
import { useAuth } from '../hooks/useAuth';
import { useStepParam } from '../hooks/useStepParam';
import { api, hasToken } from '../lib/api';
import { authPagePath } from '../lib/authNavigation';
import { fewHostsOpen } from '../lib/fewHosts';
import { PART_QUERY, partView } from '../lib/closedPart';
import { SiteNotFound } from '../components/SiteNotFound';
import { LoadFailed } from '../components/shared/LoadFailed';

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

  if (!signedIn) return <Navigate replace to={authPagePath('signin', pathname + search)} />;
  if (!id || view.state === 'closed' || (table.error as { status?: number } | null)?.status === 403) return <SiteNotFound />;
  let content;
  if (!isSessionReady || view.state === 'loading' || view.state === 'off') content = <p className={hostText} role="status">Opening the table…</p>;
  else if (view.state === 'failed') content = <LoadFailed sentence="Could not open the table just now." onRetry={view.retry} />;
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
