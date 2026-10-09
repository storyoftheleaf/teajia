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
  'curate', 'inventory', 'orders', 'people', 'events', 'publish', 'settings',
];

describe('what the Manage navigation offers', () => {
  it('shows only Publish to a delegated publisher', () => {
    expect(getVisibleAdminItemIds({ ...NOTHING, hasPublish: true }, EVERY_ENTRY))
      .toEqual(['people', 'publish']);
  });

  it('offers nothing to someone with no capabilities at all', () => {
    expect(getVisibleAdminItemIds(NOTHING, EVERY_ENTRY)).toEqual([]);
  });

  it('keeps the complete navigation for the platform staff', () => {
    expect(getVisibleAdminItemIds({ ...NOTHING, isAdmin: true }, EVERY_ENTRY)).toEqual(EVERY_ENTRY);
  });

  /**
   * The regression this file now exists to hold. An invited shop owner used to
   * be handed one entry out of nine, because visibility asked the global account
   * type, which every invited person fails, instead of what they may do here.
   */
  it('gives an invited shop owner the whole workshop, not just Wisdom', () => {
    expect(getVisibleAdminItemIds(SHOP_OWNER, EVERY_ENTRY)).toEqual(EVERY_ENTRY);
  });

  it('gives a seller Sales and People without the owner-only workshop', () => {
    const seller: AdminNavAccess = { ...NOTHING, hasSell: true };
    const visible = getVisibleAdminItemIds(seller, EVERY_ENTRY);
    expect(visible).toEqual(['orders', 'people']);
  });

  it('keeps Settings for an access manager, opening on Members', () => {
    const accessManager: AdminNavAccess = { ...NOTHING, hasMembers: true };
    expect(getVisibleAdminItemIds(accessManager, EVERY_ENTRY)).toEqual(['people', 'settings']);
  });

  it('keeps People for a gatherer, who may not open Sales', () => {
    const gatherer: AdminNavAccess = { ...NOTHING, hasGather: true };
    const visible = getVisibleAdminItemIds(gatherer, EVERY_ENTRY);
    expect(visible).toContain('people');
    expect(visible).not.toContain('orders');
  });

  it('never offers an entry to someone the route behind it would turn away', () => {
    const stockOnly: AdminNavAccess = { ...NOTHING, hasStock: true };
    const visible = getVisibleAdminItemIds(stockOnly, EVERY_ENTRY);
    expect(visible).toContain('inventory');
    expect(visible).not.toContain('events');
    expect(visible).not.toContain('publish');
    expect(visible).not.toContain('curate');
  });
});
