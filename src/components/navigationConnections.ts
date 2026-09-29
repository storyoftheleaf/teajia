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
  // Curate is the compass screen, which admits the catalog bundle.
  curate: access => access.hasCatalog,
  inventory: access => access.hasCatalog || access.hasStock,
  // Sales is the activity screen, which admits the sell bundle and nothing else.
  orders: access => access.hasSell,
  // People admits any bundle (canUsePeople in AdminApp.tsx).
  people: access =>
    access.hasSell || access.hasGather || access.hasMembers || access.hasStock || access.hasPublish,
  // Sessions: events, tastings and venues all admit the gather bundle.
  events: access => access.hasGather,
  // Publish opens on the magazine; collections, guest notes and wisdom share
  // its gate, the publish bundle.
  publish: access => access.hasPublish,
  // Settings opens the shop's settings for an owner, and Members & Access for
  // someone who holds only the members bundle (manageNav.ts picks the path).
  settings: access => access.isOwnerTier || access.hasMembers,
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
