import { describe, expect, it } from 'vitest';
import {
  calculateSettlement,
  isGrantActive,
  resolveSalePermission,
  validateGrantTerms,
  type SalesGrantTerms,
} from '../src/teaMasterSales';

const validGrant: SalesGrantTerms = {
  id: 'grant-a',
  accountId: 'account-a',
  productId: 'product-a',
  sellerUserId: 'seller-a',
  priceFloor: 0.4,
  quantityLimit: 100,
  startsAt: '2026-08-01T00:00:00.000Z',
  expiresAt: '2026-09-01T00:00:00.000Z',
  revokedAt: null,
};

describe('Tea Master sale permission', () => {
  it('allows an owner-tier actor to sell any stock in the account', () => {
    expect(resolveSalePermission({
      actorRole: 'owner', actorUserId: 'owner-a', stockOwnerUserId: 'person-a', activeGrant: null,
    })).toEqual({ allowed: true, reason: 'account_owner' });
  });

  it('allows Sell staff to sell location-owned and their own stock', () => {
    expect(resolveSalePermission({
      actorRole: 'staff', actorUserId: 'seller-a', stockOwnerUserId: null, activeGrant: null,
    })).toEqual({ allowed: true, reason: 'location_stock' });
    expect(resolveSalePermission({
      actorRole: 'staff', actorUserId: 'seller-a', stockOwnerUserId: 'seller-a', activeGrant: null,
    })).toEqual({ allowed: true, reason: 'own_stock' });
  });

  it('requires a matching active grant for another person\'s stock', () => {
    expect(resolveSalePermission({
      actorRole: 'staff', actorUserId: 'seller-a', stockOwnerUserId: 'owner-a', activeGrant: null,
    })).toEqual({ allowed: false, reason: 'grant_required' });
    expect(resolveSalePermission({
      actorRole: 'staff', actorUserId: 'seller-a', stockOwnerUserId: 'owner-a', activeGrant: validGrant,
    })).toEqual({ allowed: true, reason: 'active_grant', grantId: 'grant-a' });
  });
});

describe('Tea Master grant terms', () => {
  it('rejects cross-account, cross-product and cross-seller grants', () => {
    for (const change of [
      { accountId: 'account-b' },
      { productId: 'product-b' },
      { sellerUserId: 'seller-b' },
    ]) {
      expect(validateGrantTerms({
        grant: { ...validGrant, ...change },
        accountId: 'account-a', productId: 'product-a', sellerUserId: 'seller-a',
        quantity: 10, unitPrice: 0.5, now: '2026-08-10T00:00:00.000Z',
      }).ok).toBe(false);
    }
  });

  it('rejects revoked, future and expired grants', () => {
    expect(isGrantActive({ ...validGrant, revokedAt: '2026-08-09T00:00:00.000Z' }, '2026-08-10T00:00:00.000Z')).toBe(false);
    expect(isGrantActive({ ...validGrant, startsAt: '2026-08-11T00:00:00.000Z' }, '2026-08-10T00:00:00.000Z')).toBe(false);
    expect(isGrantActive({ ...validGrant, expiresAt: '2026-08-10T00:00:00.000Z' }, '2026-08-10T00:00:00.000Z')).toBe(false);
  });

  it('rejects a price below the floor and quantity above the limit', () => {
    expect(validateGrantTerms({
      grant: validGrant, accountId: 'account-a', productId: 'product-a', sellerUserId: 'seller-a',
      quantity: 10, unitPrice: 0.39, now: '2026-08-10T00:00:00.000Z',
    })).toEqual({ ok: false, reason: 'price_below_floor' });
    expect(validateGrantTerms({
      grant: validGrant, accountId: 'account-a', productId: 'product-a', sellerUserId: 'seller-a',
      quantity: 101, unitPrice: 0.5, now: '2026-08-10T00:00:00.000Z',
    })).toEqual({ ok: false, reason: 'quantity_limit_exceeded' });
  });
});

describe('Tea Master settlement calculation', () => {
  it('calculates percent and fixed owner shares with currency rounding', () => {
    expect(calculateSettlement({ gross: 100, ownerShareType: 'percent', ownerShareValue: 80 }))
      .toEqual({ ownerAmount: 80, sellerAmount: 20 });
    expect(calculateSettlement({ gross: 100, ownerShareType: 'fixed', ownerShareValue: 35.555 }))
      .toEqual({ ownerAmount: 35.56, sellerAmount: 64.44 });
  });

  it('never creates negative owner or seller shares', () => {
    expect(calculateSettlement({ gross: 10, ownerShareType: 'percent', ownerShareValue: 150 }))
      .toEqual({ ownerAmount: 10, sellerAmount: 0 });
    expect(calculateSettlement({ gross: 10, ownerShareType: 'fixed', ownerShareValue: -5 }))
      .toEqual({ ownerAmount: 0, sellerAmount: 10 });
  });

  it('rejects non-finite and negative gross values', () => {
    expect(() => calculateSettlement({ gross: -1, ownerShareType: 'fixed', ownerShareValue: 1 })).toThrow(RangeError);
    expect(() => calculateSettlement({ gross: Number.NaN, ownerShareType: 'percent', ownerShareValue: 1 })).toThrow(RangeError);
  });
});
