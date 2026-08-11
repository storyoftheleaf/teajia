export const ADMIN_CONNECTION_ROUTES = {
  teaMasters: '/admin/contributors',
  wisdom: '/admin/wisdom',
} as const;

export const PUBLIC_REFERENCE_ROUTES = {
  people: '/people',
  wisdom: '/wisdom',
} as const;

/**
 * Admins keep the complete Manage navigation. A delegated publisher receives
 * only the Wisdom entry here; route protection remains the final authority.
 */
export function getVisibleAdminItemIds(
  isAdmin: boolean,
  hasPublishBundle: boolean,
  itemIds: readonly string[],
): string[] {
  if (isAdmin) return [...itemIds];
  if (hasPublishBundle) return itemIds.filter(id => id === 'wisdom');
  return [];
}
