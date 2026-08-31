import { describe, expect, it } from 'vitest';

import { getVisibleAdminItemIds, type AdminNavAccess } from './navigationConnections';

const NOTHING: AdminNavAccess = {
  isAdmin: false,
  isOwnerTier: false,
  hasCatalog: false,
  hasStock: false,
  hasSell: false,
  hasGather: false,
  hasPublish: false,
  hasMembers: false,
};

/** What an invited shop owner carries: ordinary account type, every capability. */
const SHOP_OWNER: AdminNavAccess = {
  isAdmin: false,
  isOwnerTier: true,
  hasCatalog: true,
  hasStock: true,
  hasSell: true,
  hasGather: true,
  hasPublish: true,
  hasMembers: true,
};

const EVERY_ENTRY = [
  'dashboard', 'inventory', 'collections', 'business',
  'events', 'magazine', 'wisdom', 'network', 'settings',
];

describe('what the Manage navigation offers', () => {
  it('shows only the Wisdom entry to a delegated publisher', () => {
    expect(getVisibleAdminItemIds({ ...NOTHING, hasPublish: true }, ['dashboard', 'wisdom', 'events']))
      .toEqual(['wisdom']);
  });

  it('offers nothing to someone with no capabilities at all', () => {
    expect(getVisibleAdminItemIds(NOTHING, ['dashboard', 'wisdom', 'settings'])).toEqual([]);
  });

  it('keeps the complete navigation for the platform staff', () => {
    expect(getVisibleAdminItemIds({ ...NOTHING, isAdmin: true }, ['dashboard', 'wisdom', 'settings']))
      .toEqual(['dashboard', 'wisdom', 'settings']);
  });

  /**
   * The regression this file now exists to hold. An invited shop owner used to
   * be handed one entry out of nine, because visibility asked the global account
   * type, which every invited person fails, instead of what they may do here.
   */
  it('gives an invited shop owner the whole workshop, not just Wisdom', () => {
    expect(getVisibleAdminItemIds(SHOP_OWNER, EVERY_ENTRY)).toEqual(EVERY_ENTRY);
  });

  it('gives a seller the business entries without the owner-only workshop', () => {
    const seller: AdminNavAccess = { ...NOTHING, hasSell: true };
    const visible = getVisibleAdminItemIds(seller, EVERY_ENTRY);
    expect(visible).toContain('business');
    expect(visible).toContain('network');
    expect(visible).not.toContain('dashboard');
    expect(visible).not.toContain('inventory');
  });

  it('never offers an entry to someone the route behind it would turn away', () => {
    const stockOnly: AdminNavAccess = { ...NOTHING, hasStock: true };
    const visible = getVisibleAdminItemIds(stockOnly, EVERY_ENTRY);
    expect(visible).toContain('inventory');
    expect(visible).not.toContain('events');
    expect(visible).not.toContain('magazine');
  });
});
