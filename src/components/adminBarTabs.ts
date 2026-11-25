import { getVisibleAdminItemIds, type AdminNavAccess } from './navigationConnections';

// The phone's admin bar: four words per role, two either side of the logo.
// These words must be the Manage column's words for the same rooms (see
// manageNav.ts); manageNav.oneWord.test.ts fails if a route here carries a
// different word from the column, or a word here leads somewhere else.

export type AdminTab = { id: string; label: string; path: string };

export type AdminBarRole = 'shop' | 'staff' | 'member';

export const ADMIN_BAR_TABS: Record<AdminBarRole, [AdminTab[], AdminTab[]]> = {
  shop: [
    [{ id: 'compass',   label: 'curate',  path: '/admin/compass' },
     { id: 'inventory', label: 'stock',   path: '/admin/stock' }],
    [{ id: 'orders',    label: 'sales',   path: '/admin/activity' },
     { id: 'events',    label: 'sessions', path: '/admin/events' }],
  ],
  staff: [
    [{ id: 'compass', label: 'curate',  path: '/admin/compass' },
     { id: 'orders',  label: 'sales',   path: '/admin/activity' }],
    [{ id: 'events',  label: 'sessions', path: '/admin/events' },
     { id: 'people',  label: 'people',  path: '/admin/people' }],
  ],
  member: [
    [{ id: 'compass', label: 'curate',  path: '/admin/compass' },
     { id: 'samples', label: 'samples', path: '/admin/compass?sampleOrder=manage' }],
    [{ id: 'capture', label: 'drafts',  path: '/admin/capture' },
     { id: 'events',  label: 'sessions', path: '/admin/events' }],
  ],
};

const tabRoomIds: Record<string, string> = {
  compass: 'curate', samples: 'curate', capture: 'curate',
};

export function getAdminBarTabs(role: AdminBarRole, access: AdminNavAccess): [AdminTab[], AdminTab[]] {
  const [left, right] = ADMIN_BAR_TABS[role];
  const roomId = (tab: AdminTab) => tabRoomIds[tab.id] ?? tab.id;
  const visible = new Set(getVisibleAdminItemIds(access, [...left, ...right].map(roomId)));
  const admitted = (tab: AdminTab) => visible.has(roomId(tab));
  return [left.filter(admitted), right.filter(admitted)];
}
