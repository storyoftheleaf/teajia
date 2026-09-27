import { useEffect, useState } from 'react';
import { api, AUTH_TOKEN_CHANGED_EVENT, getTokenClaims, isTokenScopedToAccount } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { useQuery } from '@tanstack/react-query';

export function privateQueryKey(accountId: string | null, userId: string | null, tokenRevision: number) {
  return [accountId ?? 'no-account', userId ?? 'anonymous', tokenRevision] as const;
}

/** Private cache entries belong to one signed-in person operating one store. */
export function usePrivateQueryScope() {
  const accountId = useAppStore(state => state.activeAccountId);
  const [tokenRevision, setTokenRevision] = useState(0);
  useEffect(() => {
    const changed = () => setTokenRevision(revision => revision + 1);
    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, changed);
    return () => window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, changed);
  }, []);
  const claims = getTokenClaims();
  const ready = !!accountId && !!claims?.sub && isTokenScopedToAccount(accountId);
  return {
    key: privateQueryKey(accountId, claims?.sub ?? null, tokenRevision),
    ready,
  };
}

/** Shared by Pending and Activity so a query never changes shape between views. */
export function usePendingInvoicesSummary() {
  const scope = usePrivateQueryScope();
  const query = useQuery({
    queryKey: ['invoices-pending-summary', ...scope.key],
    enabled: scope.ready,
    staleTime: 30_000,
    queryFn: async () => {
      const data = (await api.invoices.list(200)) as any[];
      return data.filter(order => order.status === 'Pending');
    },
  });
  return { ...query, data: scope.ready ? query.data : undefined };
}
