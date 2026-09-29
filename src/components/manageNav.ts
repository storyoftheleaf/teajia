import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import {
  CalendarBlank, Receipt, AddressBook, BookOpen, Package, Compass, GearSix,
} from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { useAppStore, selectHasBundle, selectIsOwnerTier } from '../lib/store';
import { ADMIN_CONNECTION_ROUTES, getVisibleAdminItemIds } from './navigationConnections';

// The Manage rooms, in one place. Seven since 2026-09-29, each named for the
// job being done (bringing tea in, the shelf, selling, who you know, hosting,
// what the shop puts out, running the shop), with the screens that job uses
// under it. The plan and the reasoning: todo/plans/manage-regroup.md.
//
// The desktop column beside the rail and the phone's site panel both read
// this list, so a room added here appears on
// both, with the same word, and neither can drift from the other the way the
// tool registry and the sidebar once did (Customers vs People, Contributors
// vs Tea Masters). Visibility is decided by `getVisibleAdminItemIds`, one rule
// per entry, matching the gate on the route it leads to. One word per route:
// no two rows share a destination and no word leads to two places, which
// manageNav.oneWord.test.ts holds for this list and the phone's admin bar.

export interface ManageChild {
  id: string;
  path: string;
  label: string;
}

export interface ManageItem {
  id: string;
  label: string;
  path: string;
  Icon: ComponentType<IconProps>;
  children?: ManageChild[];
}

export interface ManageNav {
  /** Every room the signed-in person may open, Settings included. */
  items: ManageItem[];
  /**
   * Today, the owner's overview (the old Dashboard). It is not a room: the word
   * Manage at the top of the column opens it. Null for anyone its route refuses.
   */
  today: { label: string; path: string } | null;
  /** True when there is at least one room to show. */
  hasManageRoom: boolean;
  /** True when Settings is among the rooms (an owner-tier signal). */
  hasSettingsRoute: boolean;
  /** The curator bit: may create collections without any other capability. */
  canCreateCollections: boolean;
  /**
   * The rooms the ACTIVE TABLE grants, with the legacy platform-staff escape
   * hatch switched off. The rail may show a platform account every room at
   * every table; a door that opens onto a shop has to follow the table's own
   * grant, or a global owner sitting at a table as a member is handed a door
   * that refuses them on the other side.
   */
  tableItems: ManageItem[];
  hasTableRoom: boolean;
}

/** What the list itself depends on, beyond the per-room gates. */
export interface ManageListFlags {
  hasCatalog: boolean;
  hasSell: boolean;
  hasPublish: boolean;
  isAdmin: boolean;
  isOwnerTier: boolean;
  platformRole: unknown;
  /** The stock bundle; purchases open to it as well as to an owner. */
  hasStock?: boolean;
}

export const TODAY_PATH = '/admin/dashboard';

/**
 * Every Manage room before the gates, as a pure function so the one-word guard
 * can read the same list the column and the site panel render. A room shows
 * when its own route admits the person (navigationConnections.ts); each child
 * carries the gate of the route it opens, so a room never lists a door that
 * refuses.
 */
export function buildManageItems(f: ManageListFlags): ManageItem[] {
  const owner = f.isOwnerTier || f.isAdmin;
  return [
    // Bringing tea in. Curate is the phone bar's first word for every role, and
    // until now sat third under Stock on a laptop.
    {
      id: 'curate', label: 'Curate', Icon: Compass, path: '/admin/compass',
      children: [
        // The samples workspace, which Curate opens over its own screen.
        { id: 'samples', path: '/admin/compass?sampleOrder=manage', label: 'Samples' },
        // What the shop buys from its suppliers (a People tab until 2026-09-29).
        ...(owner || f.hasStock ? [{ id: 'purchases', path: '/admin/purchase-orders', label: 'Purchases' }] : []),
        // The network catalog: carrying other houses' teas into this shop.
        { id: 'network', path: '/admin/network?tab=catalog', label: 'Network' },
      ],
    },
    // The shelf.
    {
      id: 'inventory', label: 'Stock', Icon: Package, path: '/admin/stock',
      children: f.hasCatalog
        ? [
            // Teas still being written up before they go on the shelf (was
            // "Capture", a second word for the capturing Curate does).
            { id: 'drafts', path: '/admin/capture', label: 'Drafts' },
            { id: 'catalog', path: '/admin/catalog', label: 'Tea Glossary' },
          ]
        : undefined,
    },
    // Selling. Follows its route's one gate, the sell bundle.
    {
      id: 'orders', label: 'Sales', Icon: Receipt, path: '/admin/activity',
      children: [{ id: 'wholesale', path: '/admin/activity?tab=wholesale', label: 'Wholesale' }],
    },
    // Who you know. Its own room so a member who gathers or publishes, and so
    // cannot open Sales, still reaches the people they work with.
    { id: 'people', label: 'People', Icon: AddressBook, path: '/admin/people' },
    // Hosting. Tastings and venues had no door in the column before.
    {
      id: 'events', label: 'Sessions', Icon: CalendarBlank, path: '/admin/events',
      children: [
        { id: 'tastings', path: '/admin/tasting-events', label: 'Tastings' },
        { id: 'venues', path: '/admin/venues', label: 'Venues' },
      ],
    },
    // What the shop puts out. The room opens on the magazine, its first shelf.
    {
      id: 'publish', label: 'Publish', Icon: BookOpen, path: '/admin/magazine',
      children: [
        { id: 'collections', path: '/admin/collections', label: 'Collections' },
        // Tasting notes guests wrote, waiting to be published.
        { id: 'guest-notes', path: '/admin/tasting-notes', label: 'Guest notes' },
        { id: 'wisdom', path: '/admin/wisdom', label: 'Wisdom' },
        ...(owner ? [{ id: 'contributors', path: ADMIN_CONNECTION_ROUTES.teaMasters, label: 'Tea Masters' }] : []),
      ],
    },
    // Running the shop. An access manager who is not an owner may open Members
    // and nothing else here, so for them the room opens straight onto it.
    owner
      ? {
          id: 'settings', label: 'Settings', Icon: GearSix, path: '/admin/account-settings',
          children: [
            { id: 'members', path: '/admin/access', label: 'Members' },
            // Where products imply a relationship nobody recorded (a People tab until 2026-09-29).
            { id: 'audit', path: '/admin/audit', label: 'Audit' },
          ],
        }
      : { id: 'settings', label: 'Settings', Icon: GearSix, path: '/admin/access' },
  ];
}

export function useManageNav(): ManageNav {
  const auth = useAuth();
  const hasCatalog = useAppStore(s => selectHasBundle(s, 'catalog'));
  const hasSell = useAppStore(s => selectHasBundle(s, 'sell'));
  const hasPublish = useAppStore(s => selectHasBundle(s, 'publish'));
  const hasStock = useAppStore(s => selectHasBundle(s, 'stock'));
  const hasGather = useAppStore(s => selectHasBundle(s, 'gather'));
  const hasMembers = useAppStore(s => selectHasBundle(s, 'members'));
  const platformRole = useAppStore(s => s.platformRole);
  const isOwnerTier = useAppStore(selectIsOwnerTier);
  const canCreateCollections = auth.user?.canCreateCollections ?? false;

  const all = buildManageItems({ hasCatalog, hasSell, hasPublish, hasStock, isAdmin: auth.isAdmin, isOwnerTier, platformRole });

  const visibleIds = new Set(getVisibleAdminItemIds(
    { isAdmin: auth.isAdmin, isOwnerTier, hasCatalog, hasStock, hasSell, hasGather, hasPublish, hasMembers },
    all.map(item => item.id),
  ));
  const items = all.filter(item => visibleIds.has(item.id));
  const tableIds = new Set(getVisibleAdminItemIds(
    { isAdmin: false, isOwnerTier, hasCatalog, hasStock, hasSell, hasGather, hasPublish, hasMembers },
    all.map(item => item.id),
  ));
  const tableItems = all.filter(item => tableIds.has(item.id));

  return {
    items,
    // The dashboard route admits the owner tier and nobody else.
    today: isOwnerTier ? { label: 'Today', path: TODAY_PATH } : null,
    hasManageRoom: auth.isAuthenticated && (items.length > 0 || canCreateCollections),
    hasSettingsRoute: items.some(item => item.id === 'settings'),
    canCreateCollections,
    tableItems,
    hasTableRoom: auth.isAuthenticated && (tableItems.length > 0 || canCreateCollections),
  };
}

/**
 * Whether a Manage path is where the person is standing. A path with a query
 * (`/admin/network?tab=wholesale`) matches only when every parameter it names
 * agrees, so Sales' Wholesale and Curate's Network, two tabs of one screen,
 * light their own room and not each other's. A plain path also matches its own
 * detail pages (`/admin/events/123` is still Sessions).
 */
export function isManagePathActive(path: string, pathname: string, search = ''): boolean {
  const [base, query] = path.split('?');
  if (query) {
    if (pathname !== base) return false;
    const here = new URLSearchParams(search);
    return [...new URLSearchParams(query)].every(([k, v]) => here.get(k) === v);
  }
  return pathname === base || pathname.startsWith(base + '/');
}
