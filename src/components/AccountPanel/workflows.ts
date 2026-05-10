import type { AdminTool } from '../../admin/toolRegistry';
import type { Bundle } from '../../types';

export interface AccountWorkflowLink {
  id: string;
  label: string;
  route: string;
}

export interface FirstDoorWorkflowLink extends AccountWorkflowLink {
  description: string;
  bundle?: Bundle;
}

export const MEMBER_MEMORY_LINKS: AccountWorkflowLink[] = [
  { id: 'saved', label: 'Saved', route: '/account/saved' },
  { id: 'history', label: 'History', route: '/account/history' },
  { id: 'find-table', label: 'Find a Table', route: '/find-a-table' },
  { id: 'magazine', label: 'Magazine', route: '/magazine' },
  { id: 'settings', label: 'Settings', route: '/account/settings' },
];

export const READER_EXPLORE_LINKS: AccountWorkflowLink[] = [
  { id: 'magazine', label: 'The Magazine', route: '/magazine' },
  { id: 'shop', label: 'Shop', route: '/shop' },
  { id: 'find-table', label: 'Find a Table', route: '/find-a-table' },
];

export const FIRST_DOOR_WORKFLOW: FirstDoorWorkflowLink[] = [
  {
    id: 'settings',
    label: 'Finish table settings',
    route: '/admin/account-settings',
    description: 'Set profile, currency, WhatsApp, and public storefront details.',
  },
  {
    id: 'carry-network',
    label: 'Carry from Network',
    route: '/admin/network?tab=catalog',
    description: 'Choose teas from Adrian or another trusted Teajia table.',
    bundle: 'catalog',
  },
  {
    id: 'inventory',
    label: 'Prepare inventory',
    route: '/admin/inventory',
    description: 'Add stock, photos, pricing, and local availability.',
    bundle: 'stock',
  },
  {
    id: 'wholesale',
    label: 'Place first wholesale order',
    route: '/admin/network?tab=wholesale',
    description: 'Request the first shipment and track supplier replies.',
    bundle: 'sell',
  },
  {
    id: 'events',
    label: 'Open first session',
    route: '/admin/events',
    description: 'Create the first tasting, tea class, or shop gathering.',
    bundle: 'gather',
  },
  {
    id: 'access',
    label: 'Invite the team',
    route: '/admin/access',
    description: 'Give staff the exact bundles they need for opening day.',
    bundle: 'members',
  },
];

export function staffToolsForPanel(tools: AdminTool[]): AdminTool[] {
  return tools.filter((tool) => tool.id !== 'settings' && tool.id !== 'mcp-tokens');
}
