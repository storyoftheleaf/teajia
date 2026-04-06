import { useAppStore } from './store';

/** Returns true if the current user has platform_owner or platform_admin role */
export function usePlatformPrivilege(): boolean {
  const platformRole = useAppStore((s) => s.platformRole);
  return platformRole === 'platform_owner' || platformRole === 'platform_admin';
}
