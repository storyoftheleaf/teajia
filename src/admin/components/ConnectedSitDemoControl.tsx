import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Button } from '../../components/shared/Button';
import { Modal } from '../../components/shared/Modal';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { API_URL, ApiError, authedFetch } from '../../lib/api';
import { selectIsOwnerTier, useAppStore } from '../../lib/store';

const DEMO_ACCOUNT = 'acc_teajia_bali';
const OWNER_PATH = API_URL + '/api/admin/events/connected-sit-demo';
const publicKey = ['connected-sit-demo-availability'] as const;

type Scope = { accountId: string; userId: string };
type DemoStatus = { available: boolean };

export function ConnectedSitDemoControl() {
  const isOwner = useAppStore(selectIsOwnerTier);
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  if (!isOwner || accountId !== DEMO_ACCOUNT || !userId) return null;

  return <ScopedDemoControl key={JSON.stringify([accountId, userId])} scope={{ accountId, userId }} />;
}

function ScopedDemoControl({ scope }: { scope: Scope }) {
  const [confirm, setConfirm] = useState(false);
  const cache = useQueryClient();
  const ownerKey = ['connected-sit-demo-owner', scope.accountId, scope.userId];
  const request = (method: 'GET' | 'DELETE', signal?: AbortSignal): Promise<DemoStatus> =>
    authedFetch(OWNER_PATH, {
      method, cache: 'no-store', expectedAuth: scope, background: true, reportIncident: false,
    }, signal);

  const status = useQuery({
    queryKey: ownerKey,
    queryFn: ({ signal }) => request('GET', signal),
    retry: false,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: 'always',
  });
  const remove = useMutation({
    mutationFn: () => request('DELETE'),
    onSuccess: async result => {
      await Promise.all([
        cache.cancelQueries({ queryKey: ownerKey, exact: true }),
        cache.cancelQueries({ queryKey: publicKey }),
      ]);
      cache.setQueryData(ownerKey, result);
      cache.setQueryData(publicKey, false);
      setConfirm(false);
      await cache.invalidateQueries({ queryKey: publicKey });
    },
  });

  const denied = status.error instanceof ApiError && [401, 403, 404].includes(status.error.status);
  if (status.isPending || denied) return null;

  return (
    <section aria-label="Connected sit demo" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-tea-border bg-tea-surface p-3">
      <h2 className={TYPOGRAPHY_CLASSES.h3}>Connected sit demo</h2>
      {status.isError ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-ui-13 text-tea-text-sec">Couldn’t load demo status.</p>
          <Button type="button" size="sm" variant="quiet" onClick={() => void status.refetch()}>Try again</Button>
        </div>
      ) : status.data?.available ? (
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-quiet btn-sm tap-target" to="/demo/connected-sit">View demo</Link>
          <Button type="button" size="sm" variant="quiet" onClick={() => { remove.reset(); setConfirm(true); }}>
            Remove demo
          </Button>
        </div>
      ) : (
        <p role="status" className="text-ui-13 text-tea-text-sec">Demo removed from public view.</p>
      )}
      {confirm && (
        <Modal isOpen title="Remove connected sit demo?" initialFocus="container"
          onClose={() => { if (!remove.isPending) setConfirm(false); }}>
          <div className="space-y-3 p-4 pb-nav">
            <p className="text-tea-text-sec">This takes the demo off Brewing experiences and disables its direct link.</p>
            {remove.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Couldn’t remove the demo. Try again.</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" size="sm" variant="quiet" disabled={remove.isPending} onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
                Remove demo
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
