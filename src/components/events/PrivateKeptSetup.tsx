import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { API_URL, ApiError, authedFetch } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { Button } from '../shared/Button';
import { KeptSetupPhotoContext } from './PrivateKeptSetupPhotos';

type SetupTeas = Array<{ id: string; name: string }>;

type AfterSitSetup = { cacheKey: string; deviceFallback: ReactNode };

type KeptSetupState = { saved: false } | { saved: true; saved_at: string; can_add_photos?: boolean };

const accessMessage = (error: unknown) => {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 403) return 'Use the account linked to this seat to save the setup.';
  if (error.status === 404) return 'This setup isn’t available to save yet.';
  if (error.status === 409) return 'Remove the private photos before removing this setup.';
  return null;
};

export function PrivateKeptSetup({ token, setupId, teas = [], afterSit }: {
  token: string; setupId: string; teas?: SetupTeas; afterSit?: AfterSitSetup;
}) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const location = useLocation();

  return (
    <section aria-label="Keep this setup" className="mt-4">
      {userId ? (
        <KeptSetupAction key={JSON.stringify([accountId, userId, afterSit?.cacheKey ?? token])}
          accountId={accountId} userId={userId} token={token} setupId={setupId} teas={teas} afterSit={afterSit} />
      ) : afterSit ? afterSit.deviceFallback : (
        <Link className="btn-secondary tap-target"
          to={`/signin?returnTo=${encodeURIComponent(location.pathname + location.search)}`}>
          Sign in to save this setup
        </Link>
      )}
    </section>
  );
}

function KeptSetupAction({ accountId, userId, token, setupId, teas, afterSit }: {
  accountId: string | null; userId: string; token: string; setupId: string; teas: SetupTeas; afterSit?: AfterSitSetup;
}) {
  const queryClient = useQueryClient();
  const queryKey = ['private-kept-setup', accountId, userId, afterSit?.cacheKey ?? token];
  const endpoint = afterSit ? `${API_URL}/api/after-sit/setup` :
    `${API_URL}/api/rsvp/${encodeURIComponent(token)}/kept-setup`;
  const requestOptions = { expectedAuth: { accountId, userId }, cache: 'no-store' } as const;
  function requestSetup(method: 'GET' | 'PUT' | 'DELETE', signal?: AbortSignal): Promise<KeptSetupState> {
    return authedFetch(endpoint, {
      ...requestOptions,
      signal,
      method: afterSit ? 'POST' : method,
      body: afterSit ? JSON.stringify({ credential: token, action: { GET: 'status', PUT: 'save', DELETE: 'remove' }[method] }) : undefined,
      retryTimeouts: true,
      ...(afterSit ? { referrerPolicy: 'no-referrer' as const, reportIncident: false } : {}),
    });
  }

  const setup = useQuery({
    queryKey,
    queryFn: ({ signal }) => requestSetup('GET', signal),
    retry: false,
  });
  const change = useMutation({
    mutationFn: (method: 'PUT' | 'DELETE') => requestSetup(method),
    onSuccess: async result => {
      await queryClient.cancelQueries({ queryKey });
      const active = useAppStore.getState();
      if (active.activeAccountId !== accountId || active.activeUserId !== userId) return;
      queryClient.setQueryData(queryKey, result);
      void queryClient.invalidateQueries({ queryKey: ['private-kept-setups'] });
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  if (setup.isPending) return <p role="status" className="text-ui-13 text-tea-text-sec">Checking saved setup…</p>;
  if (setup.isError) {
    const message = accessMessage(setup.error);
    if (afterSit && setup.error instanceof ApiError && setup.error.status === 403) {
      return <><p className="mb-2 text-ui-13 text-tea-text-sec">{message}</p>{afterSit.deviceFallback}</>;
    }
    if (message) return <p role="status" className="text-ui-13 text-tea-text-sec">{message}</p>;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p role="status" className="text-ui-13 text-tea-text-sec">Couldn’t check your saved setup.</p>
        <Button type="button" variant="quiet" className="tap-target" disabled={setup.isFetching}
          onClick={() => void setup.refetch()}>Retry</Button>
      </div>
    );
  }

  const saved = setup.data?.saved === true;
  const canOpenJourney = setup.data?.saved === true && (!afterSit || setup.data.can_add_photos === true);
  const status = change.isPending
    ? (saved ? 'Removing setup…' : 'Saving setup…')
    : saved ? 'Saved to Journey' : change.isSuccess ? 'Removed from Journey' : null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <p role="status" className={status ? 'text-ui-13 text-tea-text-sec' : 'sr-only'}>{status}</p>
        {saved ? (
          <>
            {canOpenJourney && <Link className="btn-secondary tap-target" to="/account/journey#saved-setups">View saved setup</Link>}
            <Button type="button" variant="quiet" className="tap-target" disabled={change.isPending}
              onClick={() => change.mutate('DELETE')}>Undo</Button>
          </>
        ) : (
          <Button type="button" className="tap-target" disabled={change.isPending}
            onClick={() => change.mutate('PUT')}>Save this setup</Button>
        )}
      </div>
      {canOpenJourney && <KeptSetupPhotoContext setupId={setupId} teas={teas} />}
      {saved && !canOpenJourney && (
        <p className="mt-2 text-ui-13 text-tea-text-sec">Switch to the sit’s shop in Your Table to open its Journey entry and photos.</p>
      )}
      {change.isError && (
        <p role="alert" className="mt-2 text-ui-13 text-tea-text-sec">
          {accessMessage(change.error) || (change.variables === 'DELETE'
            ? 'Couldn’t remove this setup. Try again.'
            : 'Couldn’t save this setup. Try again.')}
        </p>
      )}
    </>
  );
}
