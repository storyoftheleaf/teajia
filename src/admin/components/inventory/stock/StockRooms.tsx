import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Button } from '../../../../components/shared/Button';
import type { Product } from '../../../types';
import { isLow, isUnchecked } from '../phone/groupStock';
import { StockGroupSwitch } from './StockRowEditing';
import { StockCountBar, teasOnScreen } from './StockCount';

// Stock as rooms (Adrian, 2026-11-25): on a laptop the groups stand in a room of
// their own on the left, the chosen group's teas fill the middle, and the open
// tea has the room on the right. "All" is the page as it was, every group in
// one list, so nothing that worked from the full list stops working.

export interface RoomGroup { key: string; label: string; items: readonly Product[] }

/** What the rooms can ask the page to do, wired to the page's own sheets. */
export interface RoomActions {
  rename: (supplier: Product) => void;
  details: (supplier: Product) => void;
  assign: (items: Product[]) => void;
  open?: (tea: Product) => void;
  recount?: (tea: Product, from: HTMLElement) => void;
  photo?: (tea: Product) => void;
  taste?: (tea: Product) => void;
  /** A count was saved to the stock ledger: put the new balance on the page. */
  counted?: (id: string, after: number, unit: 'g' | 'unit') => void;
}

/** "low" or "never counted": the two warnings a group carries, each a filter. */
type Flag = 'low' | 'uncounted';
const FLAG_TEST: Record<Flag, (product: Product) => boolean> = { low: isLow, uncounted: isUnchecked };

/** The narrowest laptop that still fits three rooms side by side. */
export const ROOMS_MIN_WIDTH = 1280;
/** The open tea's room listens for this to show one of its tabs. */
export const ROOM_TAB_EVENT = 'stock-room-tab';

function RailEntry({ label, count, on, low, uncounted, flag, onClick, onFlag, onMenu }: {
  label: string; count: number; on: boolean; low?: number; uncounted?: number; flag?: Flag | null;
  onClick: () => void; onFlag?: (flag: Flag) => void; onMenu?: (event: MouseEvent) => void;
}) {
  // A warning is its own small button inside the line: it opens the group
  // showing only those teas, and a second click shows the whole group again.
  const warn = (kind: Flag, text: string, tone: string, name = text) => <span role="button" tabIndex={0} aria-pressed={flag === kind} aria-label={name} title={name}
    data-room-flag={kind} className={`stock-room-flag ${tone}`}
    onClick={event => { event.stopPropagation(); onFlag?.(kind); }}
    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onFlag?.(kind); } }}>{text}</span>;
  return <Button variant="plain" type="button" aria-pressed={on} onClick={onClick} onContextMenu={onMenu} data-room-entry={label}
    className={`stock-room-entry ${on ? 'bg-tea-surface' : 'hover:bg-tea-surface'}`}>
    <span className="truncate font-display text-ui-17 leading-tight text-tea-text">{label}</span>
    <span className="font-mono text-ui-12 tabular-nums text-tea-text-sec">{count}</span>
    {(low || uncounted) ? <span className="col-span-2 truncate text-ui-11 leading-snug text-tea-text-sec">
      {low ? warn('low', String(low), 'text-tea-error', `${low} low`) : null}
      {low && uncounted ? ' · ' : null}
      {uncounted ? warn('uncounted', `${uncounted} never counted`, '') : null}
    </span> : null}
  </Button>;
}

/** A short menu that opens where the pointer is and closes on a click away. */
function PointerMenu({ at, label, items, onClose }: {
  at: { x: number; y: number }; label: string; items: ReadonlyArray<readonly [string, () => void]>; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // Opened near an edge, the menu moves in so every line stays on screen.
    const box = ref.current?.getBoundingClientRect();
    ref.current?.style.setProperty('--menu-x', `${Math.max(0, Math.min(at.x, window.innerWidth - (box?.width ?? 0) - 8))}px`);
    ref.current?.style.setProperty('--menu-y', `${Math.max(0, Math.min(at.y, window.innerHeight - (box?.height ?? 0) - 8))}px`);
    ref.current?.querySelector('button')?.focus();
  }, [at.x, at.y]);
  useEffect(() => {
    const away = (event: Event) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('pointerdown', away); window.removeEventListener('keydown', escape); };
  }, [onClose]);
  return <div ref={ref} role="menu" aria-label={`${label} actions`} data-testid="stock-room-menu" className="stock-room-menu z-modal">
    {items.map(([text, run]) => <Button key={text} variant="plain" type="button" role="menuitem" onClick={() => { onClose(); run(); }}>{text}</Button>)}
  </div>;
}

type Menu = { x: number; y: number; label: string; items: ReadonlyArray<readonly [string, () => void]> };

/** The left room: every group by name, with its count and what needs attention. */
export function StockRoomsRail({ groups, value, flag, onChange, onFlag, total, allLabel, groupBy, onGroupBy, onMenu, onCount }: {
  groups: readonly RoomGroup[]; value: string | null; flag: Flag | null; total: number; allLabel: string;
  onChange: (key: string | null) => void; onFlag: (key: string, flag: Flag) => void;
  groupBy: string; onGroupBy: (value: string) => void; onMenu?: (event: MouseEvent, group: RoomGroup) => void; onCount?: () => void;
}) {
  return <nav aria-label="Groups" data-testid="stock-rooms-rail" className="stock-rooms-rail custom-scrollbar">
    <StockGroupSwitch placement="rail" value={groupBy} onChange={onGroupBy} />
    {onCount ? <Button variant="plain" type="button" onClick={onCount} data-testid="stock-count-start" title="Type what is on the shelf, press Enter, and the next tea is ready"
      className="stock-room-count text-ui-12 text-tea-text-sec hover:text-tea-text">Count these teas</Button> : null}
    <RailEntry label={allLabel} count={total} on={value === null} onClick={() => onChange(null)} />
    {groups.map(group => <RailEntry key={group.key} label={group.label} count={group.items.length} on={value === group.key}
      low={group.items.filter(isLow).length} uncounted={group.items.filter(isUnchecked).length}
      flag={value === group.key ? flag : null}
      onClick={() => onChange(value === group.key && !flag ? null : group.key)}
      onFlag={kind => onFlag(group.key, kind)}
      onMenu={onMenu ? event => onMenu(event, group) : undefined} />)}
  </nav>;
}

/** Which room is open, the rail to choose it from, and the right-click menus.
 *  `active` is null when the rooms are off or the chosen group has left the page;
 *  `only` narrows the open group to its low or never-counted teas. */
export function useStockRooms(on: boolean, groups: readonly RoomGroup[] | null, total: number, allLabel: string, groupBy: string, onGroupBy: (value: string) => void, actions?: RoomActions): {
  active: string | null; rail: ReactNode; only: ((product: Product) => boolean) | null;
  onMenu?: (event: MouseEvent) => void; menu: ReactNode;
} {
  const [room, setRoom] = useState<string | null>(null);
  const [flag, setFlag] = useState<Flag | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [count, setCount] = useState<{ ids: string[]; from: number } | null>(null);
  if (!on || !groups) return { active: null, rail: null, only: null, menu: null };
  const active = room !== null && groups.some(group => group.key === room) ? room : null;
  const only = active && flag ? FLAG_TEST[flag] : null;
  // Suppliers read biggest first, as on the phone and in the drawing; types and
  // stages keep the order the list itself uses.
  const listed = groupBy === 'vendor' ? [...groups].sort((a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label)) : groups;

  const supplierMenu = groupBy === 'vendor' && actions ? (event: MouseEvent, group: RoomGroup) => {
    event.preventDefault();
    event.stopPropagation();
    const supplier = group.items.find(product => product.vendor?.trim());
    setMenu({ x: event.clientX, y: event.clientY, label: group.label, items: supplier
      ? [['Rename', () => actions.rename(supplier)], ['Supplier details', () => actions.details(supplier)]]
      : [['Assign a supplier', () => actions.assign([...group.items])]] });
  } : undefined;

  /** A right-click on a tea's line: the things done to one tea, without opening it first. */
  const teaMenu = actions?.open ? (event: MouseEvent) => {
    const line = (event.target as Element).closest<HTMLElement>('tr[data-product-id]');
    const id = line?.getAttribute('data-product-id');
    const tea = id ? groups.flatMap(group => group.items).find(product => product.id === id) : undefined;
    if (!line || !tea) return;
    event.preventDefault();
    const showTab = (tab: string) => window.setTimeout(() => window.dispatchEvent(new CustomEvent(ROOM_TAB_EVENT, { detail: tab })), 0);
    const items: Array<readonly [string, () => void]> = [
      ['Open', () => actions.open?.(tea)],
      ['Rename', () => { actions.open?.(tea); showTab('details'); }],
    ];
    if (actions.recount) items.push(['Recount', () => actions.recount?.(tea, line)]);
    if (actions.photo) items.push(['Photo', () => actions.photo?.(tea)]);
    if (actions.taste) items.push(['Taste', () => actions.taste?.(tea)]);
    if (actions.counted) items.push(['Count from here', () => { const ids = teasOnScreen(); setCount({ ids, from: Math.max(0, ids.indexOf(tea.id)) }); }]);
    setMenu({ x: event.clientX, y: event.clientY, label: tea.productName || 'Tea', items });
  } : undefined;

  return {
    active, only, onMenu: teaMenu,
    menu: <>{menu && <PointerMenu at={menu} label={menu.label} items={menu.items} onClose={() => setMenu(null)} />}
      {count && actions?.counted ? <StockCountBar key={count.ids[count.from] ?? 'count'} ids={count.ids} from={count.from} onCounted={actions.counted}
        find={id => groups.flatMap(group => group.items).find(product => product.id === id)} onClose={() => setCount(null)} /> : null}</>,
    rail: <StockRoomsRail groups={listed} value={active} flag={active ? flag : null} total={total} allLabel={allLabel}
      onChange={key => { setRoom(key); setFlag(null); setCount(null); }}
      onCount={actions?.counted ? () => setCount({ ids: teasOnScreen(), from: 0 }) : undefined}
      onFlag={(key, kind) => { setFlag(active === key && flag === kind ? null : kind); setRoom(key); setCount(null); }}
      groupBy={groupBy} onGroupBy={onGroupBy} onMenu={supplierMenu} />,
  };
}
