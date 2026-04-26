export type AdminToolGroup = 'sell' | 'source' | 'gather' | 'publish' | 'teach' | 'network';

export interface AdminTool {
  id: string;
  label: string;
  group: AdminToolGroup;
  route: string;
  addedAt: string;
  requires?: 'owner' | 'platform';
}

export const ADMIN_TOOL_GROUPS: { id: AdminToolGroup; label: string }[] = [
  { id: 'sell', label: 'Sell' },
  { id: 'source', label: 'Source' },
  { id: 'gather', label: 'Gather' },
  { id: 'publish', label: 'Publish' },
  { id: 'teach', label: 'Teach' },
  { id: 'network', label: 'Network' },
];

export const ADMIN_TOOLS: AdminTool[] = [
  { id: 'activity', label: 'Activity', group: 'sell', route: '/admin/activity', addedAt: '2025-10-01' },
  { id: 'quick-invoice', label: 'Quick Invoice', group: 'sell', route: '/admin/activity?qi=1', addedAt: '2025-11-10' },
  { id: 'people', label: 'Customers', group: 'sell', route: '/admin/people', addedAt: '2025-10-01' },
  { id: 'inventory', label: 'Inventory', group: 'sell', route: '/admin/inventory', addedAt: '2025-09-15' },
  { id: 'purchase-orders', label: 'Purchase Orders', group: 'sell', route: '/admin/purchase-orders', addedAt: '2026-02-20', requires: 'owner' },

  { id: 'compass', label: 'Tea Compass', group: 'source', route: '/admin/compass', addedAt: '2025-09-01' },
  { id: 'capture', label: 'Quick Capture', group: 'source', route: '/admin/capture', addedAt: '2026-01-12' },
  { id: 'vendors', label: 'Vendors', group: 'source', route: '/admin/compass?tab=sourcing', addedAt: '2025-11-05' },

  { id: 'events', label: 'Events', group: 'gather', route: '/admin/events', addedAt: '2025-09-20' },
  { id: 'venues', label: 'Venues', group: 'gather', route: '/admin/venues', addedAt: '2026-02-02' },
  { id: 'interest-signups', label: 'Interest Signups', group: 'gather', route: '/admin/events?tab=interest', addedAt: '2026-04-20' },

  { id: 'magazine', label: 'Magazine', group: 'publish', route: '/admin/magazine', addedAt: '2026-01-28', requires: 'owner' },
  { id: 'collections', label: 'Collections', group: 'publish', route: '/admin/collections', addedAt: '2026-04-24', requires: 'owner' },

  { id: 'team', label: 'Team', group: 'teach', route: '/admin/people?tab=team', addedAt: '2025-12-05', requires: 'owner' },
  { id: 'access', label: 'Members & Access', group: 'teach', route: '/admin/access', addedAt: '2026-04-26', requires: 'owner' },
  { id: 'account-settings', label: 'Account Settings', group: 'teach', route: '/admin/account-settings', addedAt: '2025-10-01', requires: 'owner' },
  { id: 'platform', label: 'Platform Admin', group: 'teach', route: '/admin/platform', addedAt: '2025-12-20', requires: 'platform' },
  { id: 'platform-access', label: 'Platform Access', group: 'teach', route: '/admin/access/platform', addedAt: '2026-04-26', requires: 'platform' },

  // Network — Steps 2-6 of NETWORK_ROLLOUT_PLAN. Owner-gated as a proxy for the
  // bundles (catalog/sell/etc); the views themselves enforce the bundle gate
  // server-side and inline.
  { id: 'network-catalog', label: 'Carry from Network', group: 'network', route: '/admin/network/catalog', addedAt: '2026-04-26', requires: 'owner' },
  { id: 'network-suggestions', label: 'Suggestions', group: 'network', route: '/admin/network/suggestions', addedAt: '2026-04-26', requires: 'owner' },
  { id: 'network-wholesale', label: 'Wholesale', group: 'network', route: '/admin/network/wholesale', addedAt: '2026-04-26', requires: 'owner' },
  { id: 'network-adoptions', label: 'Adoptions', group: 'network', route: '/admin/network/adoptions', addedAt: '2026-04-26', requires: 'platform' },
];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function isRecentlyAdded(tool: AdminTool, now: number = Date.now()): boolean {
  const added = new Date(tool.addedAt).getTime();
  if (Number.isNaN(added)) return false;
  return now - added < THIRTY_DAYS_MS;
}

export function toolsForRole(opts: { isOwner: boolean; isPlatform: boolean }): AdminTool[] {
  return ADMIN_TOOLS.filter(t => {
    if (!t.requires) return true;
    if (t.requires === 'owner') return opts.isOwner;
    if (t.requires === 'platform') return opts.isPlatform;
    return true;
  });
}

export function groupTools(tools: AdminTool[]): Record<AdminToolGroup, AdminTool[]> {
  const out: Record<AdminToolGroup, AdminTool[]> = {
    sell: [], source: [], gather: [], publish: [], teach: [], network: [],
  };
  for (const t of tools) out[t.group].push(t);
  return out;
}
