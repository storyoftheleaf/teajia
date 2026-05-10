import type { Bundle } from '../types';

export type AdminToolGroup = 'sell' | 'source' | 'gather' | 'publish' | 'teach' | 'network';

export interface AdminTool {
  id: string;
  label: string;
  group: AdminToolGroup;
  route: string;
  addedAt: string;
  // Tier gate. 'owner' = the active membership is owner (or platform tier).
  // 'platform' = caller is platform_owner/platform_admin.
  requires?: 'owner' | 'platform';
  // Bundle gate for staff/non-owner members. If set, the tool is visible to
  // any caller who holds the bundle (owners and platform tier always pass via
  // selectHasBundle short-circuit). Owners see all owner-tier tools regardless
  // of this field. If a tool has BOTH `requires: 'owner'` and `bundle`, set
  // `staffVisible` when a staff member with that bundle should also see it.
  bundle?: Bundle;
  staffVisible?: boolean;
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
  { id: 'activity', label: 'Activity', group: 'sell', route: '/admin/activity', addedAt: '2025-10-01', bundle: 'sell' },
  { id: 'quick-invoice', label: 'Quick Invoice', group: 'sell', route: '/admin/activity?qi=1', addedAt: '2025-11-10', bundle: 'sell' },
  { id: 'people', label: 'Customers', group: 'sell', route: '/admin/people', addedAt: '2025-10-01', bundle: 'sell' },
  { id: 'inventory', label: 'Inventory', group: 'sell', route: '/admin/inventory', addedAt: '2025-09-15', bundle: 'stock' },
  { id: 'purchase-orders', label: 'Purchase Orders', group: 'sell', route: '/admin/purchase-orders', addedAt: '2026-02-20', requires: 'owner', bundle: 'stock', staffVisible: true },

  { id: 'compass', label: 'Tea Compass', group: 'source', route: '/admin/compass', addedAt: '2025-09-01', bundle: 'catalog' },
  { id: 'capture', label: 'Quick Capture', group: 'source', route: '/admin/capture', addedAt: '2026-01-12', bundle: 'catalog' },
  { id: 'vendors', label: 'Vendors', group: 'source', route: '/admin/compass?tab=sourcing', addedAt: '2025-11-05', bundle: 'catalog' },

  { id: 'events', label: 'Events', group: 'gather', route: '/admin/events', addedAt: '2025-09-20', bundle: 'gather' },
  { id: 'venues', label: 'Venues', group: 'gather', route: '/admin/events?tab=venues', addedAt: '2026-02-02', bundle: 'gather' },
  { id: 'interest-signups', label: 'Interest Signups', group: 'gather', route: '/admin/events?tab=interest', addedAt: '2026-04-20', bundle: 'gather' },

  { id: 'magazine', label: 'Magazine', group: 'publish', route: '/admin/magazine', addedAt: '2026-01-28', requires: 'owner', bundle: 'publish', staffVisible: true },
  { id: 'collections', label: 'Collections', group: 'publish', route: '/admin/collections', addedAt: '2026-04-24', requires: 'owner', bundle: 'publish', staffVisible: true },

  { id: 'team', label: 'Team', group: 'teach', route: '/admin/people?tab=team', addedAt: '2025-12-05', requires: 'owner', bundle: 'members', staffVisible: true },
  { id: 'access', label: 'Members & Access', group: 'teach', route: '/admin/access', addedAt: '2026-04-26', requires: 'owner', bundle: 'members', staffVisible: true },
  { id: 'settings', label: 'Settings', group: 'teach', route: '/admin/account-settings', addedAt: '2026-04-27', requires: 'owner' },
  { id: 'mcp-tokens', label: 'Voice & Agent (MCP)', group: 'teach', route: '/admin/mcp-tokens', addedAt: '2026-05-09', requires: 'owner' },
  { id: 'platform-access', label: 'Platform Access', group: 'teach', route: '/admin/access/platform', addedAt: '2026-04-26', requires: 'platform' },
  { id: 'currency-rates', label: 'Exchange Rates', group: 'teach', route: '/admin/currency', addedAt: '2026-04-27', requires: 'platform' },

  // Network — Steps 2-6 of NETWORK_ROLLOUT_PLAN. Owner-gated as a proxy for the
  // bundles (catalog/sell/etc); the views themselves enforce the bundle gate
  // server-side and inline.
  { id: 'network-catalog', label: 'Carry from Network', group: 'network', route: '/admin/network?tab=catalog', addedAt: '2026-04-26', requires: 'owner', bundle: 'catalog', staffVisible: true },
  { id: 'network-suggestions', label: 'Suggestions', group: 'network', route: '/admin/network?tab=suggestions', addedAt: '2026-04-26', requires: 'owner', bundle: 'catalog', staffVisible: true },
  { id: 'network-wholesale', label: 'Wholesale', group: 'network', route: '/admin/network?tab=wholesale', addedAt: '2026-04-26', requires: 'owner', bundle: 'sell', staffVisible: true },
  { id: 'network-adoptions', label: 'Adoptions', group: 'network', route: '/admin/network?tab=adoptions', addedAt: '2026-04-26', requires: 'platform' },
];

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function isRecentlyAdded(tool: AdminTool, now: number = Date.now()): boolean {
  const added = new Date(tool.addedAt).getTime();
  if (Number.isNaN(added)) return false;
  return now - added < THIRTY_DAYS_MS;
}

export function toolsForRole(opts: { isOwner: boolean; isPlatform: boolean; bundles?: Bundle[] }): AdminTool[] {
  const bundles = new Set(opts.bundles ?? []);
  return ADMIN_TOOLS.filter(t => {
    // Platform tier sees everything.
    if (opts.isPlatform) return true;
    // Tier-restricted tools.
    if (t.requires === 'platform') return false;
    if (t.requires === 'owner') {
      if (opts.isOwner) return true;
      return !!t.staffVisible && !!t.bundle && bundles.has(t.bundle);
    }
    // Owners see all non-restricted tools regardless of bundle.
    if (opts.isOwner) return true;
    // Staff: a tool is visible if it has no gate, or if the staff holds its bundle.
    if (!t.bundle) return true;
    return bundles.has(t.bundle);
  });
}

export function groupTools(tools: AdminTool[]): Record<AdminToolGroup, AdminTool[]> {
  const out: Record<AdminToolGroup, AdminTool[]> = {
    sell: [], source: [], gather: [], publish: [], teach: [], network: [],
  };
  for (const t of tools) out[t.group].push(t);
  return out;
}
