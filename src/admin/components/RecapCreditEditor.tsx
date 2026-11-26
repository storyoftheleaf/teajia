import { useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '../../components/shared/Button';
import { API_URL, ApiError, authedFetch } from '../../lib/api';
import { sitLinksQuery } from '../../lib/publicSitConnections';
import { SIT_CREDIT_ROLES, sitCreditLabel, type SitCreditRole } from '../../lib/sitCreditContract';
import { selectHasBundle, useAppStore } from '../../lib/store';

type Scope = { accountId: string; userId: string };
type Credit = { id: string; display_name: string; role: SitCreditRole };
type Credits = { people: Array<{ id: string; display_name: string }>; credits: Credit[] };

export function RecapCreditEditor({ eventId }: { eventId: string }) {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const canPublish = useAppStore(state => selectHasBundle(state, 'publish'));
  if (!accountId || !userId || !canPublish) return null;

  return <CreditForm key={JSON.stringify([accountId, userId, eventId])} eventId={eventId} scope={{ accountId, userId }} />;
}

function CreditForm({ eventId, scope }: { eventId: string; scope: Scope }) {
  const heading = useId();
  const [contributor, setContributor] = useState('');
  const [role, setRole] = useState<SitCreditRole>('guest_host');
  const [confirmed, setConfirmed] = useState(false);
  const client = useQueryClient();
  const endpoint = `${API_URL}/api/admin/events/${encodeURIComponent(eventId)}/recap-credits`;
  const options = { expectedAuth: scope, cache: 'no-store', background: true, reportIncident: false } as const;
  const queryKey = ['recap-credits', scope.accountId, scope.userId, eventId];
  const query = useQuery({
    queryKey,
    queryFn: (): Promise<Credits> => authedFetch(endpoint, options),
    gcTime: 0,
    retry: false,
  });
  const change = useMutation({
    mutationFn: ({ creditId }: { creditId?: string }) => creditId
      ? authedFetch(`${endpoint}/${encodeURIComponent(creditId)}`, { ...options, method: 'DELETE' })
      : authedFetch(endpoint, { ...options, method: 'POST', body: JSON.stringify({ contributor, role, confirmed }) }),
    onSuccess: async () => {
      setConfirmed(false);
      await Promise.all([
        client.invalidateQueries({ queryKey, exact: true }),
        client.invalidateQueries({ queryKey: sitLinksQuery }),
        client.invalidateQueries({ queryKey: ['event-recap-public'] }),
      ]);
    },
  });
  if (query.isPending || (query.error instanceof ApiError && [401, 403, 404].includes(query.error.status))) return null;

  return (
    <section aria-labelledby={heading} className="space-y-2 border-t border-tea-border pt-3">
      <h2 id={heading} className="type-section-heading">Public recap credits</h2>
      {query.isError && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-ui-13 text-tea-text-sec">Couldn’t load recap credits.</p>
          <Button variant="quiet" size="sm" onClick={() => void query.refetch()}>Try again</Button>
        </div>
      )}
      {!!query.data?.credits?.length && (
        <ul className="divide-y divide-tea-border">
          {query.data.credits.map(credit => (
            <li key={credit.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <p className="min-w-0 break-words text-ui-13 text-tea-text-sec">{credit.display_name} · {sitCreditLabel(credit.role)}</p>
              <Button type="button" variant="quiet" size="sm" className="tap-target"
                disabled={change.isPending} onClick={() => change.mutate({ creditId: credit.id })}>
                Remove credit<span className="sr-only"> for {credit.display_name}</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {query.data && ((query.data.people ?? []).length === 0 ? (
        <p className="text-ui-13 text-tea-text-sec">There are no published People profiles connected to this shop.</p>
      ) : (
        <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
          event.preventDefault();
          if (contributor && confirmed && !change.isPending) change.mutate({});
        }}>
          <label className="flex min-w-0 flex-col gap-1 text-ui-13 text-tea-text-sec">
            Person
            <select className="btn-field max-w-full" value={contributor}
              onChange={event => { setContributor(event.target.value); setConfirmed(false); }}>
              <option value="">Choose a person</option>
              {(query.data.people ?? []).map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-ui-13 text-tea-text-sec">
            Role
            <select className="btn-field max-w-full" value={role}
              onChange={event => { setRole(event.target.value as SitCreditRole); setConfirmed(false); }}>
              {SIT_CREDIT_ROLES.map(value => <option key={value} value={value}>{sitCreditLabel(value)}</option>)}
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-ui-13 text-tea-text-sec">
            <input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />
            They agreed to this public credit
          </label>
          <Button type="submit" variant="secondary" className="tap-target" disabled={!contributor || !confirmed || change.isPending}>
            Add public credit
          </Button>
        </form>
      ))}
      {change.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">Couldn’t update the recap credit. Try again.</p>}
    </section>
  );
}
