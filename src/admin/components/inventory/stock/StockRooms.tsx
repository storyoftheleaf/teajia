import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Button } from '../../../../components/shared/Button';
import type { Product } from '../../../types';
import { isLow, isUnchecked } from '../phone/groupStock';
import { StockGroupSwitch } from './StockRowEditing';

// Stock as rooms (Adrian, 2026-11-25): on a laptop the groups stand in a room of
// their own on the left, the chosen group's teas fill the middle, and the open
// tea has the room on the right. "All" is the page as it was, every group in
// one list, so nothing that worked from the full list stops working.

export interface RoomGroup { key: string; label: string; items: readonly Product[] }

/** What a right-click on a supplier's name can do, wired to the page's own sheets. */
export interface RoomSupplierActions {
  rename: (supplier: Product) => void;
  details: (supplier: Product) => void;
  assign: (items: Product[]) => void;
}

/** The narrowest laptop that still fits three rooms side by side. */
export const ROOMS_MIN_WIDTH = 1280;

function RailEntry({ label, count, on, low, uncounted, onClick, onMenu }: {
  label: string; count: number; on: boolean; low?: number; uncounted?: number; onClick: () => void;
  onMenu?: (event: MouseEvent) => void;
}) {
  return <Button variant="plain" type="button" aria-pressed={on} onClick={onClick} onContextMenu={onMenu} data-room-entry={label}
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

/** The short menu a right-click on a supplier's name opens, where the pointer is. */
function SupplierMenu({ at, group, actions, onClose }: {
  at: { x: number; y: number }; group: RoomGroup; actions: RoomSupplierActions; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    ref.current?.style.setProperty('--menu-x', `${at.x}px`);
    ref.current?.style.setProperty('--menu-y', `${at.y}px`);
    ref.current?.querySelector('button')?.focus();
  }, [at.x, at.y]);
  useEffect(() => {
    const away = (event: Event) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', escape); };
  }, [onClose]);
  const supplier = group.items.find(product => product.vendor?.trim());
  const run = (action: () => void) => () => { onClose(); action(); };
  return <div ref={ref} role="menu" aria-label={`${group.label} actions`} data-testid="stock-room-menu" className="stock-room-menu z-modal">
    {supplier
      ? <>
        <Button variant="plain" type="button" role="menuitem" onClick={run(() => actions.rename(supplier))}>Rename</Button>
        <Button variant="plain" type="button" role="menuitem" onClick={run(() => actions.details(supplier))}>Supplier details</Button>
      </>
      : <Button variant="plain" type="button" role="menuitem" onClick={run(() => actions.assign([...group.items]))}>Assign a supplier</Button>}
  </div>;
}

/** The left room: every group by name, with its count and what needs attention. */
export function StockRoomsRail({ groups, value, onChange, total, allLabel, groupBy, onGroupBy, supplierActions }: {
  groups: readonly RoomGroup[]; value: string | null; onChange: (key: string | null) => void; total: number; allLabel: string;
  groupBy: string; onGroupBy: (value: string) => void; supplierActions?: RoomSupplierActions;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number; group: RoomGroup } | null>(null);
  const canMenu = groupBy === 'vendor' && !!supplierActions;
  return <nav aria-label="Groups" data-testid="stock-rooms-rail" className="stock-rooms-rail custom-scrollbar">
    <StockGroupSwitch placement="rail" value={groupBy} onChange={onGroupBy} />
    <RailEntry label={allLabel} count={total} on={value === null} onClick={() => onChange(null)} />
    {groups.map(group => <RailEntry key={group.key} label={group.label} count={group.items.length} on={value === group.key}
      low={group.items.filter(isLow).length} uncounted={group.items.filter(isUnchecked).length}
      onClick={() => onChange(value === group.key ? null : group.key)}
      onMenu={canMenu ? event => { event.preventDefault(); setMenu({ x: event.clientX, y: event.clientY, group }); } : undefined} />)}
    {menu && supplierActions && <SupplierMenu at={menu} group={menu.group} actions={supplierActions} onClose={() => setMenu(null)} />}
  </nav>;
}

/** Which room is open, and the rail to choose it from. `active` is null when the
 *  rooms are off or the chosen group is no longer on the page. */
export function useStockRooms(on: boolean, groups: readonly RoomGroup[] | null, total: number, allLabel: string, groupBy: string, onGroupBy: (value: string) => void, supplierActions?: RoomSupplierActions): {
  active: string | null; rail: ReactNode;
} {
  const [room, setRoom] = useState<string | null>(null);
  if (!on || !groups) return { active: null, rail: null };
  const active = room !== null && groups.some(group => group.key === room) ? room : null;
  // Suppliers read biggest first, as on the phone and in the drawing; types and
  // stages keep the order the list itself uses.
  const listed = groupBy === 'vendor' ? [...groups].sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label)) : groups;
  return { active, rail: <StockRoomsRail groups={listed} value={active} onChange={setRoom} total={total} allLabel={allLabel} groupBy={groupBy} onGroupBy={onGroupBy} supplierActions={supplierActions} /> };
}
