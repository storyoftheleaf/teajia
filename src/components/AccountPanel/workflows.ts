import type { AdminTool } from '../../admin/toolRegistry';
import type { Bundle } from '../../types';

export interface AccountWorkflowLink {
  id: string;
  label: string;
  route: string;
  category?: 'memory' | 'continue' | 'account' | 'operate' | 'support';
  status?: 'wired' | 'empty' | 'future';
}

export interface FirstDoorWorkflowLink extends AccountWorkflowLink {
  description: string;
  bundle?: Bundle;
}

export type ReadinessState = 'done' | 'next' | 'open';

export interface FirstDoorReadinessStep extends FirstDoorWorkflowLink {
  state: ReadinessState;
}

export interface FirstDoorReadinessInput {
  accountName?: string | null;
  locationLabel?: string | null;
  currencyLabel?: string | null;
  hasContact: boolean;
  isPublicEnabled: boolean;
  publicProductCount: number;
  sellableProductCount: number;
  wholesaleOrderCount: number;
  eventCount: number;
  memberCount: number;
}

export interface FirstDoorReadiness {
  completeCount: number;
  totalCount: number;
  nextStep: FirstDoorReadinessStep | null;
  steps: FirstDoorReadinessStep[];
}

export const MEMBER_MEMORY_LINKS: AccountWorkflowLink[] = [
  // 'saved' and 'history' removed 2026-07-11: the reading-history and saved-articles
  // pages were dead by construction (empty), so they were retired.
  { id: 'find-table', label: 'Find a Table', route: '/find-a-table', category: 'continue', status: 'wired' },
  { id: 'magazine', label: 'Read', route: '/read', category: 'continue', status: 'wired' },
  { id: 'settings', label: 'Settings', route: '/account/settings', category: 'account', status: 'wired' },
];

export const READER_EXPLORE_LINKS: AccountWorkflowLink[] = [
  { id: 'discover', label: 'Discover your tea', route: '/discover', category: 'continue', status: 'wired' },
  { id: 'magazine', label: 'Read', route: '/read', category: 'continue', status: 'wired' },
  { id: 'shop', label: 'Shop', route: '/shop', category: 'continue', status: 'wired' },
  { id: 'find-table', label: 'Find a Table', route: '/find-a-table', category: 'continue', status: 'wired' },
];

export const FIRST_DOOR_WORKFLOW: FirstDoorWorkflowLink[] = [
  {
    id: 'settings',
    label: 'Finish table settings',
    route: '/admin/account-settings',
    description: 'Set profile, currency, WhatsApp, and public storefront details.',
    category: 'operate',
    status: 'wired',
  },
  {
    id: 'carry-network',
    label: 'Carry from Network',
    route: '/admin/network?tab=catalog',
    description: 'Choose teas from Adrian or another trusted Teajia table.',
    bundle: 'catalog',
    category: 'operate',
    status: 'wired',
  },
  {
    id: 'inventory',
    label: 'Prepare inventory',
    route: '/admin/stock',
    description: 'Add stock, photos, pricing, and local availability.',
    bundle: 'stock',
    category: 'operate',
    status: 'wired',
  },
  {
    id: 'wholesale',
    label: 'Place first wholesale order',
    route: '/admin/network?tab=wholesale',
    description: 'Request the first shipment and track supplier replies.',
    bundle: 'sell',
    category: 'operate',
    status: 'wired',
  },
  {
    id: 'events',
    label: 'Open first session',
    route: '/admin/events',
    description: 'Create the first tasting, tea class, or shop gathering.',
    bundle: 'gather',
    category: 'operate',
    status: 'wired',
  },
  {
    id: 'access',
    label: 'Invite the team',
    route: '/admin/access',
    description: 'Give staff the exact bundles they need for opening day.',
    bundle: 'members',
    category: 'operate',
    status: 'wired',
  },
];

export const OPERATOR_SUPPORT_LINKS: AccountWorkflowLink[] = [
  {
    id: 'launch-playbook',
    label: 'Launch playbook',
    route: '/admin/launch-playbook',
    category: 'support',
    status: 'wired',
  },
  {
    id: 'members-access',
    label: 'Members & Access',
    route: '/admin/access',
    category: 'support',
    status: 'wired',
  },
  {
    id: 'storefront-preview',
    label: 'Storefront preview',
    route: '',
    category: 'support',
    status: 'wired',
  },
];

function isStepDone(stepId: string, input: FirstDoorReadinessInput): boolean {
  switch (stepId) {
    case 'settings':
      return Boolean(input.accountName && input.currencyLabel && input.hasContact && input.isPublicEnabled);
    case 'carry-network':
      return input.publicProductCount > 0;
    case 'inventory':
      return input.sellableProductCount > 0;
    case 'wholesale':
      return input.wholesaleOrderCount > 0;
    case 'events':
      return input.eventCount > 0;
    case 'access':
      return input.memberCount > 1;
    default:
      return false;
  }
}

export function buildFirstDoorReadiness(input: FirstDoorReadinessInput): FirstDoorReadiness {
  let nextAssigned = false;
  const steps = FIRST_DOOR_WORKFLOW.map((step): FirstDoorReadinessStep => {
    const done = isStepDone(step.id, input);
    if (done) return { ...step, state: 'done' };
    if (!nextAssigned) {
      nextAssigned = true;
      return { ...step, state: 'next' };
    }
    return { ...step, state: 'open' };
  });

  const completeCount = steps.filter(step => step.state === 'done').length;
  return {
    completeCount,
    totalCount: steps.length,
    nextStep: steps.find(step => step.state === 'next') ?? null,
    steps,
  };
}

export function staffToolsForPanel(tools: AdminTool[]): AdminTool[] {
  return tools.filter((tool) => tool.id !== 'settings' && tool.id !== 'mcp-tokens');
}
