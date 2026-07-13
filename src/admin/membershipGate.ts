export function shouldShowNoMembershipGate(input: {
  isAuthenticated: boolean;
  isDevAdmin: boolean;
  platformRole: string | null;
  membershipCount: number;
}): boolean {
  const isPlatformTier = input.platformRole === 'platform_owner' || input.platformRole === 'platform_admin';
  return input.isAuthenticated && !input.isDevAdmin && !isPlatformTier && input.membershipCount === 0;
}
