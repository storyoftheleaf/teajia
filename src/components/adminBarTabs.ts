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
    [{ id: 'orders',    label: 'orders',  path: '/admin/activity' },
     { id: 'events',    label: 'events',  path: '/admin/events' }],
  ],
  staff: [
    [{ id: 'compass', label: 'curate',  path: '/admin/compass' },
     { id: 'orders',  label: 'orders',  path: '/admin/activity' }],
    [{ id: 'events',  label: 'events',  path: '/admin/events' },
     { id: 'people',  label: 'people',  path: '/admin/people' }],
  ],
  member: [
    [{ id: 'compass', label: 'curate',  path: '/admin/compass' },
     { id: 'samples', label: 'samples', path: '/admin/samples' }],
    [{ id: 'capture', label: 'capture', path: '/admin/capture' },
     { id: 'events',  label: 'events',  path: '/admin/events' }],
  ],
};
