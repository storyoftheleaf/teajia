import { describe, expect, it } from 'vitest';

import { getVisibleAdminItemIds } from './navigationConnections';

describe('LeftSidebar Wisdom access', () => {
  it('shows only the Wisdom manage entry to a non-admin with the Publish bundle', () => {
    expect(getVisibleAdminItemIds(false, true, ['dashboard', 'wisdom', 'settings'])).toEqual(['wisdom']);
  });

  it('does not expose manage entries to a non-admin without the Publish bundle', () => {
    expect(getVisibleAdminItemIds(false, false, ['dashboard', 'wisdom', 'settings'])).toEqual([]);
  });

  it('preserves the full manage navigation for admins', () => {
    expect(getVisibleAdminItemIds(true, true, ['dashboard', 'wisdom', 'settings'])).toEqual([
      'dashboard',
      'wisdom',
      'settings',
    ]);
  });
});
