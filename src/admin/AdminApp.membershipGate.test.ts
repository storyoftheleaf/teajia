import { describe, expect, it } from 'vitest';
import { shouldShowNoMembershipGate } from './membershipGate';

describe('admin membership gate', () => {
  it('never treats platform tier as waiting for an invitation', () => {
    expect(shouldShowNoMembershipGate({
      isAuthenticated: true, isDevAdmin: false, platformRole: 'platform_owner', membershipCount: 0,
    })).toBe(false);
    expect(shouldShowNoMembershipGate({
      isAuthenticated: true, isDevAdmin: false, platformRole: 'platform_admin', membershipCount: 0,
    })).toBe(false);
  });

  it('continues to gate an ordinary authenticated user without memberships', () => {
    expect(shouldShowNoMembershipGate({
      isAuthenticated: true, isDevAdmin: false, platformRole: null, membershipCount: 0,
    })).toBe(true);
  });
});
