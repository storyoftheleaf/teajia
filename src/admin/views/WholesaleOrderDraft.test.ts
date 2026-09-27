import { describe, expect, it } from 'vitest';
import { canAddWholesaleProfile } from './WholesaleOrderDraft';
import type { NetworkCatalogProfile } from '../../types';

/**
 * Item 6: the catalog endpoint returns null for a listing whose
 * `quantity_purchased` is missing (it used to quote the total cost as a
 * per-gram price). `WholesaleOrderDraft.tsx` used to read that null with
 * `?? 0`, so a listing with no recorded price could be added to a draft
 * order at a unit price of zero. Nothing entered is NULL: a missing price
 * must refuse to be added, not become a free tea.
 */
const baseProfile: Pick<NetworkCatalogProfile, 'curator_listing_id' | 'wholesale_price_per_gram_caller'> = {
  curator_listing_id: 'listing-1',
  wholesale_price_per_gram_caller: 0.5,
};

describe('canAddWholesaleProfile', () => {
  it('allows adding a listing with a recorded price and an active listing', () => {
    expect(canAddWholesaleProfile(baseProfile)).toBe(true);
  });

  it('refuses a listing whose price is null, rather than treating it as free', () => {
    expect(canAddWholesaleProfile({ ...baseProfile, wholesale_price_per_gram_caller: null })).toBe(false);
  });

  it('allows a listing whose price is a deliberate zero', () => {
    expect(canAddWholesaleProfile({ ...baseProfile, wholesale_price_per_gram_caller: 0 })).toBe(true);
  });

  it('refuses a listing with no active supplier listing, price notwithstanding', () => {
    expect(canAddWholesaleProfile({ ...baseProfile, curator_listing_id: null })).toBe(false);
  });

  it('refuses when both the listing and the price are missing', () => {
    expect(canAddWholesaleProfile({ curator_listing_id: null, wholesale_price_per_gram_caller: null })).toBe(false);
  });
});
