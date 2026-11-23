import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, type TeaChestAccount } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { teaChestStockAccountApi } from '../../lib/personalStockOfferApi';
import { Button } from '../shared/Button';

export function useTeaChestStockAccount(enabled = true) {
  const userId = useAppStore(state => state.activeUserId);
  return useQuery({
    queryKey: ['tea-chest-stock-account', userId],
    enabled,
    queryFn: teaChestStockAccountApi.get,
    staleTime: 60_000,
    retry: false,
  });
}

interface TeaChestStockLinksProps {
  account?: TeaChestAccount | null;
  loading: boolean;
  error: Error | null;
}

export function TeaChestStockLinks({ account, loading, error }: TeaChestStockLinksProps) {
  const open = useMutation({
    mutationFn: async (destination: '/admin/stock' | '/admin/orders') => {
      const target = account ?? (await teaChestStockAccountApi.create()).account;
      await api.accounts.switch(target.id);
      window.location.assign(destination);
    },
  });
  return (
    <section aria-label="Tea Chest Stock and Sales" className="space-y-2">
      {(error || open.error) && <p role="alert" className="text-ui-13 text-tea-text-sec">{(open.error ?? error)?.message}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={loading || open.isPending}
          onClick={() => open.mutate('/admin/stock')}>
          Open Stock
        </Button>
        <Button type="button" variant="secondary" disabled={loading || open.isPending}
          onClick={() => open.mutate('/admin/orders')}>
          Open Sales
        </Button>
        {account?.public_enabled === 1 && (
          <Link to={`/store/${encodeURIComponent(account.slug)}`} className="btn-quiet">View your shop</Link>
        )}
      </div>
    </section>
  );
}
