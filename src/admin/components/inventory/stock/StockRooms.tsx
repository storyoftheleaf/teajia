import { useState, type ReactNode } from 'react';
import { Button } from '../../../../components/shared/Button';
import type { Product } from '../../../types';
import { isLow, isUnchecked } from '../phone/groupStock';
import { StockGroupSwitch } from './StockRowEditing';

// Stock as rooms (Adrian, 2026-11-25): on a laptop the groups stand in a room of
// their own on the left, the chosen group's teas fill the middle, and the open
// tea has the room on the right. "All" is the page as it was, every group in
// one list, so nothing that worked from the full list stops working.

export interface RoomGroup { key: string; label: string; items: readonly Product[] }

/** The narrowest laptop that still fits three rooms side by side. */
export const ROOMS_MIN_WIDTH = 1280;

function RailEntry({ label, count, on, low, uncounted, onClick }: {
  label: string; count: number; on: boolean; low?: number; uncounted?: number; onClick: () => void;
}) {
  return <Button variant="plain" type="button" aria-pressed={on} onClick={onClick} data-room-entry={label}
    className={`stock-room-entry ${on ? 'bg-tea-surface' : 'hover:bg-tea-surface'}`}>
    <span className="truncate font-display text-ui-17 leading-tight text-tea-text">{label}</span>
    <span className="font-mono text-ui-12 tabular-nums text-tea-text-sec">{count}</span>
    {(low || uncounted) ? <span className="col-span-2 truncate text-ui-11 leading-snug text-tea-text-sec">
      {low ? <span className="text-tea-error">{low} low</span> : null}
      {low && uncounted ? ' · ' : null}
      {uncounted ? `${uncounted} never counted` : null}
    </span> : null}
  </Button>;
}

/** The left room: every group by name, with its count and what needs attention. */
export function StockRoomsRail({ groups, value, onChange, total, allLabel, groupBy, onGroupBy }: {
  groups: readonly RoomGroup[]; value: string | null; onChange: (key: string | null) => void; total: number; allLabel: string;
  groupBy: string; onGroupBy: (value: string) => void;
}) {
  return <nav aria-label="Groups" data-testid="stock-rooms-rail" className="stock-rooms-rail custom-scrollbar">
    <StockGroupSwitch placement="rail" value={groupBy} onChange={onGroupBy} />
    <RailEntry label={allLabel} count={total} on={value === null} onClick={() => onChange(null)} />
    {groups.map(group => <RailEntry key={group.key} label={group.label} count={group.items.length} on={value === group.key}
      low={group.items.filter(isLow).length} uncounted={group.items.filter(isUnchecked).length}
      onClick={() => onChange(value === group.key ? null : group.key)} />)}
  </nav>;
}

/** Which room is open, and the rail to choose it from. `active` is null when the
 *  rooms are off or the chosen group is no longer on the page. */
export function useStockRooms(on: boolean, groups: readonly RoomGroup[] | null, total: number, allLabel: string, groupBy: string, onGroupBy: (value: string) => void): {
  active: string | null; rail: ReactNode;
} {
  const [room, setRoom] = useState<string | null>(null);
  if (!on || !groups) return { active: null, rail: null };
  const active = room !== null && groups.some(group => group.key === room) ? room : null;
  return { active, rail: <StockRoomsRail groups={groups} value={active} onChange={setRoom} total={total} allLabel={allLabel} groupBy={groupBy} onGroupBy={onGroupBy} /> };
}
