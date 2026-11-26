import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  isMemberSitScopeCurrent, memberSitPath, memberSitRequest, memberSitsKey, memberSitTitle, useMemberSitScope,
  type MemberSit, type MemberSitScope, type SitTea,
} from '../../lib/memberPrivateSits';
import { Button } from '../shared/Button';
import { HOST_TABLE_PATH, hostedTablesOpen, useMayHost } from '../../hooks/useMayHost';
import { api, type HostedTableSummary } from '../../lib/api';

// Launch 3, slice J3 (todo/plans/guests-and-tea-masters-launch-3-run.md, hard
// question 1). While anyone may host (both switches open), the door that made
// a private sit makes a hosted table instead: it leads to the host's own
// "Host a table" page (/account/host, Launch 2), a by-request table with one
// seat or more. Old private sits are left exactly as they are, readable at
// their own addresses, and Journey lists them beside the person's hosted
// tables, read together at the moment of reading. Nothing old is rewritten.
const hostedTablePath = (id: string) => `${HOST_TABLE_PATH}/${encodeURIComponent(id)}`;

/** The table's day in its own time zone, written the way a sit's date is. */
function tableDay(table: Pick<HostedTableSummary, 'event_date' | 'timezone'>): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: table.timezone || undefined, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(table.event_date));
  } catch {
    return table.event_date.slice(0, 10);
  }
}

type JourneyEntry =
  | { kind: 'sit'; key: string; day: string; sit: MemberSit }
  | { kind: 'table'; key: string; day: string; table: HostedTableSummary };

function journeyEntries(sits: MemberSit[], tables: HostedTableSummary[]): JourneyEntry[] {
  const entries: JourneyEntry[] = [
    ...sits.map(sit => ({ kind: 'sit' as const, key: `sit-${sit.id}`, day: sit.date, sit })),
    ...tables.map(table => ({ kind: 'table' as const, key: `table-${table.id}`, day: tableDay(table), table })),
  ];
  // Newest first; the sort is stable, so the server's own order holds within a day.
  return entries.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

/** The door, once anyone may host: "Host a table" for a person who may host, nothing for anyone else. */
function HostTableDoor() {
  const { mayHost } = useMayHost();
  if (!mayHost) return null;
  return <Link to={HOST_TABLE_PATH} className="btn-primary btn-sm">Host a table</Link>;
}

function localDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function StartMemberSitButton({ tea }: { tea?: SitTea }) {
  const scope = useMemberSitScope();
  if (!scope) return null;
  return <StartSit key={JSON.stringify([scope.userId, scope.accountId, tea?.id, tea?.name])} scope={scope} tea={tea} />;
}

function StartSit({ scope, tea }: { scope: MemberSitScope; tea?: SitTea }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const draft = useRef<{ requestId: string; date: string } | null>(null);
  const create = useMutation({
    mutationFn: () => memberSitRequest<{ id: string }>(scope, '', 'POST', {
      ...(draft.current ??= { requestId: crypto.randomUUID(), date: localDate() }), tea,
    }),
    onSuccess: ({ id }) => {
      draft.current = null;
      if (!isMemberSitScopeCurrent(scope)) return;
      void queryClient.invalidateQueries({ queryKey: memberSitsKey(scope) });
      navigate(memberSitPath(id));
    },
  });
  return (
    <div>
      <Button type="button" size="sm" variant="primary" disabled={create.isPending} onClick={() => create.mutate()}>
        {create.isPending ? 'Starting…' : 'Start a sit'}
      </Button>
      {create.isError && <p className="text-ui-13 text-tea-text-sec mt-2" role="alert">Couldn’t start the sit. Try again.</p>}
    </div>
  );
}

export function MemberSitsJourney() {
  const scope = useMemberSitScope();
  if (!scope) return null;
  return <SitsArchive key={JSON.stringify([scope.userId, scope.accountId])} scope={scope} />;
}

function SitsArchive({ scope }: { scope: MemberSitScope }) {
  const archive = useQuery({
    queryKey: memberSitsKey(scope),
    queryFn: () => memberSitRequest<{ sits: MemberSit[] }>(scope),
    retry: false,
    gcTime: 0,
  });
  const tablesOpen = hostedTablesOpen();
  // The person's own hosted tables. Someone who has never hosted answers 404
  // here, which is read as none, never as a failure.
  const tables = useQuery({
    queryKey: ['me-tables', scope.userId],
    queryFn: () => api.tables.list().catch(() => ({ tables: [] as HostedTableSummary[] })),
    enabled: tablesOpen,
    retry: false,
    staleTime: 60_000,
  });
  const entries = journeyEntries(archive.data?.sits ?? [], tablesOpen ? tables.data?.tables ?? [] : []);
  return (
    <section className="my-6 border-y border-tea-border py-4" aria-labelledby="member-sits-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="member-sits-title" className="h2">{tablesOpen ? 'Sits and tables' : 'Private sits'}</h2>
        {tablesOpen ? <HostTableDoor /> : <StartSit scope={scope} />}
      </div>
      {archive.isError && (
        <Button type="button" variant="quiet" size="sm" disabled={archive.isFetching} onClick={() => void archive.refetch()}>
          Retry loading private sits
        </Button>
      )}
      {entries.length > 0 && (
        <ul className="divide-y divide-tea-border mt-2" data-testid="journey-sits-and-tables">
          {entries.map(entry => (
            <li key={entry.key} className="py-2">
              {entry.kind === 'sit' ? (
                <Link to={memberSitPath(entry.sit.id)} className="flex min-h-tap flex-wrap items-center justify-between gap-x-3 gap-y-1 hover:text-tea-gold">
                  <span className="break-words min-w-0">
                    <span className="text-ui-16">{memberSitTitle(entry.sit)}</span>
                    {entry.sit.tea && <span className="block text-ui-13 text-tea-text-sec">{entry.sit.tea.name}</span>}
                  </span>
                  <time className="text-ui-13 text-tea-text-sec" dateTime={entry.day}>{entry.day}</time>
                </Link>
              ) : (
                <Link to={hostedTablePath(entry.table.id)} className="flex min-h-tap flex-wrap items-center justify-between gap-x-3 gap-y-1 hover:text-tea-gold">
                  <span className="break-words min-w-0">
                    <span className="text-ui-16">{entry.table.title}</span>
                    <span className="block text-ui-13 text-tea-text-sec">{tableGuests(entry.table)}</span>
                  </span>
                  <time className="text-ui-13 text-tea-text-sec" dateTime={entry.day}>{entry.day}</time>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The host's own line about a table: who is coming. Only the host reads it. */
function tableGuests(table: HostedTableSummary): string {
  const { confirmed, requested } = table.guests;
  const coming = confirmed === 1 ? '1 guest coming' : `${confirmed} guests coming`;
  return requested > 0 ? `${coming}, ${requested} asking` : coming;
}
