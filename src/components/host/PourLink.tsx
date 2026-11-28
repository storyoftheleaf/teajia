// The small way from a tea table or a tea space to the pour page (Adrian,
// 2026-11-27: "small little button"). A table opens the pour page pouring
// into that table, for every host: they pour from their own chest, and from
// the shop's shelf when they run its sessions or its owner named them
// (worker/src/tablePour.ts). A tea space opens the table that sits there today
// when there is one; with none, it opens the shop's pour page for today with
// the sit placed there (src/admin/views/PourView.tsx reads `place`), which
// only someone who runs the shop's sessions sees.
import { Link } from 'react-router-dom';
import type { HostedTableSummary } from '../../lib/hostingApi';
import { selectHasBundle, useAppStore } from '../../lib/store';

export function pourPath({ tableId, placeId }: { tableId?: string | null; placeId?: string | null }): string {
  if (tableId) return `/account/host/${encodeURIComponent(tableId)}?pour=1`;
  return placeId ? `/admin/pour?${new URLSearchParams({ place: placeId })}` : '/admin/pour';
}

/** A day as a calendar reads it in one time zone, or on this device where the zone cannot be read. */
function dayIn(at: Date, timezone: string | null): string {
  const format = (zone?: string) => new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  try { return format(timezone ?? undefined); } catch { return format(); }
}

/** The host's table at this tea space today, on the table's own clock: the one a pour there belongs to. */
export function tableAtSpaceToday(tables: HostedTableSummary[], placeId: string, now = new Date()): HostedTableSummary | null {
  return tables.find(table => {
    const at = new Date(table.event_date);
    return table.space_id === placeId && table.lifecycle_status !== 'cancelled' && !Number.isNaN(at.getTime())
      && dayIn(at, table.timezone) === dayIn(now, table.timezone);
  }) ?? null;
}

const linkClass = 'btn-secondary btn-sm tap-target';

/** Pour into one of the host's own tables. */
export function TablePourLink({ tableId }: { tableId: string }) {
  return <Link to={pourPath({ tableId })} className={linkClass} data-pour-link="table">Pour</Link>;
}

/** Pour today at a tea space: into the table there today when there is one, otherwise a sit from the shop's shelf. */
export function SpacePourLink({ placeId, tables }: { placeId: string; tables?: HostedTableSummary[] }) {
  const pours = useAppStore(state => selectHasBundle(state, 'gather'));
  const table = tableAtSpaceToday(tables ?? [], placeId);
  if (table) return <TablePourLink tableId={table.id} />;
  if (!pours) return null;
  return <Link to={pourPath({ placeId })} className={linkClass} data-pour-link="space">Pour</Link>;
}
