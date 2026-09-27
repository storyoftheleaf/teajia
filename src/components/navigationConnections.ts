export const ADMIN_CONNECTION_ROUTES = {
  teaMasters: '/admin/contributors',
  wisdom: '/admin/wisdom',
} as const;

export const PUBLIC_REFERENCE_ROUTES = {
  people: '/people',
  wisdom: '/wisdom',
} as const;

/**
 * What a person may actually do here, as the navigation sees it.
 *
 * `isAdmin` is the legacy global account type, which is set to ordinary user for
 * everyone invited to run a shop. It is kept only as a pass-everything escape
 * hatch for the platform's own staff; nothing else should be decided by it,
 * because deciding by it is what hid the whole workshop from the people who own
 * the shops.
 */
export interface AdminNavAccess {
  isAdmin: boolean;
  isOwnerTier: boolean;
  hasCatalog: boolean;
  hasStock: boolean;
  hasSell: boolean;
  hasGather: boolean;
  hasPublish: boolean;
  hasMembers: boolean;
}

/**
 * One rule per entry, each matching the gate on the route it leads to.
 *
 * They are written here rather than beside the icons so the two can be read
 * against each other in one place: an entry whose rule is looser than its route
 * is a locked door with a signpost, and an entry whose rule is tighter is a
 * screen nobody can find.
 */
const ADMIN_ITEM_ACCESS: Record<string, (access: AdminNavAccess) => boolean> = {
  dashboard: access => access.isOwnerTier,
  inventory: access => access.hasCatalog || access.hasStock,
  collections: access => access.hasPublish,
  // Orders is the activity screen, which admits the sell bundle and nothing else.
  orders: access => access.hasSell,
  // People admits any bundle (canUsePeople in AdminApp.tsx).
  people: access =>
    access.hasSell || access.hasGather || access.hasMembers || access.hasStock || access.hasPublish,
  events: access => access.hasGather,
  magazine: access => access.hasPublish,
  wisdom: access => access.hasPublish,
  network: access => access.hasCatalog || access.hasSell,
  // Members & Access follows the route's own gate, the members bundle, which an
  // owner holds implicitly.
  members: access => access.hasMembers || access.isOwnerTier,
  // Settings now lands on the shop's own settings, so it follows the same rule
  // as that screen rather than the one it used to be misrouted to.
  settings: access => access.isOwnerTier,
};

/**
 * Platform staff keep the complete Manage navigation. Everyone else sees the
 * entries their own capabilities open, which for a shop owner is nearly all of
 * them. Route protection remains the final authority.
 */
export function getVisibleAdminItemIds(
  access: AdminNavAccess,
  itemIds: readonly string[],
): string[] {
  if (access.isAdmin) return [...itemIds];
  return itemIds.filter(id => ADMIN_ITEM_ACCESS[id]?.(access) ?? false);
}
