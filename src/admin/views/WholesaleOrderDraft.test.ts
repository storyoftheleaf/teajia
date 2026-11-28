import { describe, expect, it } from 'vitest';
import { wholesaleQuoteIssue } from './WholesaleOrderDraft';

/**
 * Item 6: the catalog endpoint returns null for a listing whose
 * `quantity_purchased` is missing (it used to quote the total cost as a
 * per-gram price). `WholesaleOrderDraft.tsx` used to read that null with
 * `?? 0`, so a listing with no recorded price could be added to a draft
 * order at a unit price of zero. Nothing entered is NULL: a missing price
 * must refuse to be added, not become a free tea.
 */
const baseProfile = {
  type: 'Red',
  curator_account_id: 'supplier',
  wholesale_currency_caller: 'CNY',
  fx_unavailable: false,
  curator_listing_id: 'listing-1',
  wholesale_price_per_gram_caller: 0.5,
};

describe('wholesaleQuoteIssue', () => {
  it('accepts equivalent currency aliases and refuses different currencies or suppliers', () => {
    expect(wholesaleQuoteIssue(baseProfile, 'Yuan', 'supplier')).toBeNull();
    expect(wholesaleQuoteIssue(baseProfile, 'AUD', 'supplier')).toBeTruthy();
    expect(wholesaleQuoteIssue(baseProfile, 'CNY', 'other-supplier')).toBeTruthy();
  });

  it('refuses an unavailable rate or a piece-based listing', () => {
    expect(wholesaleQuoteIssue({ ...baseProfile, fx_unavailable: true }, null, null)).toBeTruthy();
    expect(wholesaleQuoteIssue({ ...baseProfile, type: 'Teaware' }, null, null)).toBeTruthy();
  });

  it('allows adding a listing with a recorded price and an active listing', () => {
    expect(wholesaleQuoteIssue(baseProfile, null, null)).toBeNull();
  });

  it('refuses a listing whose price is null, rather than treating it as free', () => {
    expect(wholesaleQuoteIssue({ ...baseProfile, wholesale_price_per_gram_caller: null }, null, null)).toBeTruthy();
  });

  it('allows a listing whose price is a deliberate zero', () => {
    expect(wholesaleQuoteIssue({ ...baseProfile, wholesale_price_per_gram_caller: 0 }, null, null)).toBeNull();
  });

  it('refuses a listing with no active supplier listing, price notwithstanding', () => {
    expect(wholesaleQuoteIssue({ ...baseProfile, curator_listing_id: null }, null, null)).toBeTruthy();
  });

  it('refuses when both the listing and the price are missing', () => {
    expect(wholesaleQuoteIssue({ ...baseProfile, curator_listing_id: null, wholesale_price_per_gram_caller: null }, null, null)).toBeTruthy();
  });
});
