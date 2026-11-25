import { describe, expect, it } from 'vitest';
import { ADMIN_BAR_TABS, getAdminBarTabs } from './adminBarTabs';
import type { AdminNavAccess } from './navigationConnections';

const noAccess: AdminNavAccess = {
  isAdmin: false, isOwnerTier: false,
  hasCatalog: false, hasStock: false, hasSell: false,
  hasGather: false, hasPublish: false, hasMembers: false,
};

describe('phone Manage permissions', () => {
  it('keeps Sales and People for a seller, then shows Sessions when access is added', () => {
    const seller = { ...noAccess, hasSell: true };
    expect(getAdminBarTabs('staff', seller).map(side => side.map(tab => tab.id))).toEqual([['orders'], ['people']]);
    expect(getAdminBarTabs('staff', { ...seller, hasGather: true }).map(side => side.map(tab => tab.id)))
      .toEqual([['orders'], ['events', 'people']]);
  });

  it('omits catalog-only Samples and Drafts for a member who can host', () => {
    expect(getAdminBarTabs('member', { ...noAccess, hasGather: true }).map(side => side.map(tab => tab.id)))
      .toEqual([[], ['events']]);
  });

  it('keeps full-access tab order and removes all restricted tabs when no bundles are present', () => {
    expect(getAdminBarTabs('shop', { ...noAccess, isAdmin: true })).toEqual(ADMIN_BAR_TABS.shop);
    expect(getAdminBarTabs('member', noAccess)).toEqual([[], []]);
  });
});
