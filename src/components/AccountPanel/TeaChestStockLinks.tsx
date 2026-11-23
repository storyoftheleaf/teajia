import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, type TeaChestAccount } from '../../lib/api';

export function useTeaChestStockAccount() {
  return useQuery({
    queryKey: ['tea-chest-stock-account'],
    queryFn: api.cellar.getStockAccount,
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
      const target = account ?? (await api.cellar.createStockAccount()).account;
      await api.accounts.switch(target.id);
      window.location.assign(destination);
    },
  });
  return (
    <section aria-label="Tea Chest Stock and Sales" className="space-y-2">
      {(error || open.error) && <p role="alert" className="text-ui-13 text-tea-text-sec">{(open.error ?? error)?.message}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" disabled={loading || open.isPending}
          onClick={() => open.mutate('/admin/stock')}>
          Open Stock
        </button>
        <button type="button" className="btn-secondary" disabled={loading || open.isPending}
          onClick={() => open.mutate('/admin/orders')}>
          Open Sales
        </button>
        {account?.public_enabled === 1 && (
          <Link to={`/store/${encodeURIComponent(account.slug)}`} className="btn-quiet">View your shop</Link>
        )}
      </div>
    </section>
  );
}
