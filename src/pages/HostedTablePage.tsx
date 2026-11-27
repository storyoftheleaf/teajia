// /account/host/:id: one of the host's own tables (Launch 2, slice H4).
// The parts are steps in the address through useStepParam
// (?part=guests|teas|way|after, guests by default), so back and forward walk
// between them. Each part is one component other slices fill; see
// src/components/host/hostTableParts.ts for the mount points.
//
// While Launch 2 is closed, and for anyone who is not this table's host, the
// page says the same thing: the table was not found.
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

const PART_NAMES: Record<HostTablePart, string> = { guests: 'Guests', teas: 'Teas', way: 'The way in', after: 'After' };
const PART_COMPONENTS: Record<HostTablePart, (props: HostTablePartProps) => ReactElement> = {
  guests: HostTableGuests,
  teas: HostTeaPicker,
  way: WalkthroughEditor,
  after: HostTableAfter,
};

function NotFound() {
  return <p className={hostText} role="status">This table was not found.</p>;
}

export default function HostedTablePage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 pt-6 pb-nav" data-host-page="table">
      {fewHostsOpen() ? <OwnTable /> : <NotFound />}
    </main>
  );
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
    retry: false,
  });

  if (!signedIn) return <Navigate replace to={authPagePath('signin', pathname + search)} />;
  if (!isSessionReady || table.isPending) return <p className={hostText} role="status">Opening the table…</p>;
  if (table.isError) {
    const status = (table.error as { status?: number }).status;
    return status === 404 || status === 403
      ? <NotFound />
      : <p className={hostText} role="alert">Could not open the table. Reload to try again.</p>;
  }
  return <TableParts tableId={id} detail={table.data} />;
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
