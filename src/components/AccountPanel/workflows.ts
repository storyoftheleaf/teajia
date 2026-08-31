import type { AdminTool } from '../../admin/toolRegistry';

// The first-door readiness list that used to live here was built and never
// rendered. It is replaced by the joined tea master readiness model in
// src/components/readiness, which covers the person as well as the shop.

export interface AccountWorkflowLink {
  id: string;
  label: string;
  route: string;
  category?: 'memory' | 'continue' | 'account' | 'operate' | 'support';
  status?: 'wired' | 'empty' | 'future';
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

export function staffToolsForPanel(tools: AdminTool[]): AdminTool[] {
  return tools.filter((tool) => tool.id !== 'settings' && tool.id !== 'mcp-tokens');
}
