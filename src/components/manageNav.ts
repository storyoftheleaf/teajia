import type { ComponentType } from 'react';
import type { IconProps } from '@phosphor-icons/react';
import {
  CalendarBlank, SquaresFour, Briefcase, BookOpen, Package, Stack, Compass, GearSix, Globe, UsersThree,
} from '@phosphor-icons/react';
import { useAuth } from '../hooks/useAuth';
import { useAppStore, selectHasBundle, selectIsOwnerTier } from '../lib/store';
import { ADMIN_CONNECTION_ROUTES, getVisibleAdminItemIds } from './navigationConnections';

// The Manage rooms, in one place. The desktop column beside the rail and the
// phone's site panel both read this list, so a room added here appears on
// both, with the same word, and neither can drift from the other the way the
// tool registry and the sidebar once did (Customers vs People, Contributors
// vs Tea Masters). Visibility is decided by `getVisibleAdminItemIds`, one rule
// per entry, matching the gate on the route it leads to.

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

  const all: ManageItem[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: SquaresFour, path: '/admin/dashboard' },
    {
      id: 'inventory', label: 'Stock', Icon: Package, path: '/admin/stock',
      children: [
        { id: 'catalog', path: '/admin/catalog', label: 'Tea Glossary' },
        { id: 'teaware', path: '/admin/teaware', label: 'Equipment' },
        { id: 'sources', path: '/admin/sources', label: 'Sources' },
        { id: 'personal', path: '/admin/personal', label: 'Collection' },
        { id: 'capture', path: '/admin/capture', label: 'Quick Capture' },
        { id: 'compass', path: '/admin/compass', label: 'Curate' },
        { id: 'tasting-notes', path: '/admin/tasting-notes', label: 'Tasting Notes' },
        // Carry from the network catalog into your own store. Gated by the
        // Catalog bundle, admins who can populate their own store.
        ...(hasCatalog ? [{ id: 'carry', path: '/admin/network?tab=catalog', label: 'Carry from network' }] : []),
      ],
    },
    { id: 'collections', label: 'Collections', Icon: Stack, path: '/admin/collections' },
    {
      id: 'business', label: 'Business', Icon: Briefcase, path: '/admin/activity',
      children: [
        { id: 'activity', path: '/admin/activity', label: 'Activity' },
        { id: 'people', path: '/admin/people', label: 'People' },
        ...(isOwnerTier ? [{ id: 'contributors', path: ADMIN_CONNECTION_ROUTES.teaMasters, label: 'Tea Masters' }] : []),
      ],
    },
    { id: 'events', label: 'Events', Icon: CalendarBlank, path: '/admin/events' },
    { id: 'magazine', label: 'Magazine', Icon: BookOpen, path: '/admin/magazine' },
    ...(auth.isAdmin || hasPublish ? [{ id: 'wisdom', label: 'Wisdom', Icon: Compass, path: ADMIN_CONNECTION_ROUTES.wisdom }] : []),
    // Network, single hub entry. Catalog, suggestions, wholesale, adoptions
    // live inside as tabs. Render only if caller has at least one capability.
    ...(hasCatalog || hasSell || platformRole ? [{ id: 'network', label: 'Network', Icon: Globe, path: '/admin/network' }] : []),
    // Who may sign in to this table and what they may do. It was reachable only
    // through a tile in Your Table, so in practice a tea master could not find
    // the screen the operator guide told them to go to.
    { id: 'members', label: 'Members', Icon: UsersThree, path: '/admin/access' },
    { id: 'settings', label: 'Settings', Icon: GearSix, path: '/admin/settings' },
  ];

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
