import { API_URL, authedFetch } from './api';
import { useAppStore } from './store';

export type SitTea = { id?: string | null; name: string };
export type MemberSit = {
  id: string;
  date: string;
  title: string | null;
  description: string | null;
  tea: SitTea | null;
  note: string | null;
  role: 'host' | 'guest';
  invitePending: boolean;
};

export type MemberSitScope = { accountId: string | null; userId: string };

export const memberSitInvitePath = '/account/journey/sit-invite';
export const memberSitPath = (id: string): string => '/account/journey/sits/' + encodeURIComponent(id);
export const memberSitsKey = (scope: MemberSitScope) => ['member-private-sits', scope.userId, scope.accountId];

export function useMemberSitScope(): MemberSitScope | null {
  const userId = useAppStore(state => state.activeUserId);
  const accountId = useAppStore(state => state.activeAccountId);
  return userId ? { userId, accountId } : null;
}

export function isMemberSitScopeCurrent(scope: MemberSitScope): boolean {
  const active = useAppStore.getState();
  return active.activeUserId === scope.userId && active.activeAccountId === scope.accountId;
}

export function memberSitRequest<T>(
  scope: MemberSitScope,
  path = '',
  method = 'GET',
  body?: object,
): Promise<T> {
  return authedFetch(`${API_URL}/api/me/private-sits${path}`, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
    expectedAuth: scope,
    reportIncident: false,
  });
}

export function memberSitTitle(sit: MemberSit): string {
  return sit.title || 'Tea sit';
}
