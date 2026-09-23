import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import {
  CalendarBlank, SquaresFour, Receipt, AddressBook, BookOpen, Package, Stack, Compass, GearSix, Globe, UsersThree,
} from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { useAppStore, selectHasBundle, selectIsOwnerTier } from '../lib/store';
import { ADMIN_CONNECTION_ROUTES, getVisibleAdminItemIds } from './navigationConnections';

// The Manage rooms, in one place. The desktop column beside the rail and the
// phone's site panel both read this list, so a room added here appears on
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
}

/**
 * Every Manage room before the gates, as a pure function so the one-word guard
 * can read the same list the column and the site panel render.
 */
export function buildManageItems(f: ManageListFlags): ManageItem[] {
  return [
    { id: 'dashboard', label: 'Dashboard', Icon: SquaresFour, path: '/admin/dashboard' },
    {
      id: 'inventory', label: 'Stock', Icon: Package, path: '/admin/stock',
      children: [
        { id: 'catalog', path: '/admin/catalog', label: 'Tea Glossary' },
        { id: 'capture', path: '/admin/capture', label: 'Capture' },
        { id: 'compass', path: '/admin/compass', label: 'Curate' },
        // Carry from the network catalog into your own store. Gated by the
        // Catalog bundle, admins who can populate their own store.
        ...(f.hasCatalog ? [{ id: 'carry', path: '/admin/network?tab=catalog', label: 'Carry from network' }] : []),
      ],
    },
    { id: 'collections', label: 'Collections', Icon: Stack, path: '/admin/collections' },
    // Orders follows its route's one gate, the sell bundle. It used to sit
    // under a "Business" parent that showed for five capabilities while the
    // screen behind it accepted one.
    { id: 'orders', label: 'Orders', Icon: Receipt, path: '/admin/activity' },
    // People is its own room so a member who gathers or publishes, and so
    // cannot open Orders, still reaches the people they work with.
    {
      id: 'people', label: 'People', Icon: AddressBook, path: '/admin/people',
      children: f.isOwnerTier
        ? [{ id: 'contributors', path: ADMIN_CONNECTION_ROUTES.teaMasters, label: 'Tea Masters' }]
        : undefined,
    },
    { id: 'events', label: 'Events', Icon: CalendarBlank, path: '/admin/events' },
    {
      id: 'magazine', label: 'Magazine', Icon: BookOpen, path: '/admin/magazine',
      children: [
        // Tasting notes are published words, gated like the magazine itself.
        { id: 'tasting-notes', path: '/admin/tasting-notes', label: 'Tasting Notes' },
      ],
    },
    ...(f.isAdmin || f.hasPublish ? [{ id: 'wisdom', label: 'Wisdom', Icon: Compass, path: ADMIN_CONNECTION_ROUTES.wisdom }] : []),
    // Network, single hub entry. Catalog, suggestions, wholesale, adoptions
    // live inside as tabs. Render only if caller has at least one capability.
    ...(f.hasCatalog || f.hasSell || f.platformRole ? [{ id: 'network', label: 'Network', Icon: Globe, path: '/admin/network' }] : []),
    // Who may sign in to this table and what they may do. It was reachable only
    // through a tile in Your Table, so in practice a tea master could not find
    // the screen the operator guide told them to go to.
    { id: 'members', label: 'Members', Icon: UsersThree, path: '/admin/access' },
    { id: 'settings', label: 'Settings', Icon: GearSix, path: '/admin/settings' },
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

  const all = buildManageItems({ hasCatalog, hasSell, hasPublish, isAdmin: auth.isAdmin, isOwnerTier, platformRole });

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
    hasManageRoom: auth.isAuthenticated && (items.length > 0 || canCreateCollections),
    hasSettingsRoute: items.some(item => item.id === 'settings'),
    canCreateCollections,
    tableItems,
    hasTableRoom: auth.isAuthenticated && (tableItems.length > 0 || canCreateCollections),
  };
}
