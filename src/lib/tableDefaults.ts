// What the make-a-table form already knows, so it asks only for the day and
// the time (Adrian, 2026-11-27: "a form asks only what the site cannot already
// know, and fills in the rest as a default the person can change").
import type { HostedTableDoor, HostedTableSummary, YourTablePlace } from './hostingApi';

export const DEFAULT_SEATS = 6;

export interface TableFormDefaults { seats: number; door: HostedTableDoor; area: string }

/**
 * Seats and door come from the host's last table (door only while it is still
 * one the host may give); the area comes from the place named as their table, else the last table's.
 * Anything unknown falls back to the form's old starting values.
 */
export function tableFormDefaults(
  doors: HostedTableDoor[],
  lastTable: Pick<HostedTableSummary, 'seats' | 'door' | 'area_hint'> | undefined,
  places: YourTablePlace[] | undefined,
): TableFormDefaults {
  const seats = lastTable && Number.isInteger(lastTable.seats) && lastTable.seats >= 1 && lastTable.seats <= 40
    ? lastTable.seats : DEFAULT_SEATS;
  const last = lastTable?.door;
  const door = last && doors.includes(last) ? last : doors.includes('request') ? 'request' : doors[0] ?? 'request';
  const area = places?.find(place => place.is_table)?.area_hint?.trim() || lastTable?.area_hint?.trim() || '';
  return { seats, door, area };
}
