import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authedFetch } from '../../lib/api';
import { useAppStore } from '../../lib/store';
import { KeptSetupPhotoContext } from '../events/PrivateKeptSetupPhotos';
import { Button } from '../shared/Button';
import { useJournalHydration } from '../../hooks/useJournalHydration';
import { keptSetupTastingHref } from '../../lib/keptSetupTasting';
import { KEPT_SETUPS_ENDPOINT, useKeptSetups } from '../../hooks/useKeptSetups';

export function KeptSetupsArchive() {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  if (!userId) return null;

  return <Archive key={JSON.stringify([accountId, userId])} accountId={accountId} userId={userId} />;
}

function Archive({ accountId, userId }: { accountId: string | null; userId: string }) {
  const expectedAuth = { accountId, userId };
  const journal = useAppStore(state => state.tastingJournal);
  const query = useKeptSetups(accountId, userId);
  const { canRead } = useJournalHydration(!!query.data?.setups.length);
  const remove = useMutation({
    mutationFn: (id: string) => authedFetch(KEPT_SETUPS_ENDPOINT + '/' + encodeURIComponent(id), { method: 'DELETE', expectedAuth }),
    onSuccess: () => query.refetch(),
  });

  if (!query.data?.setups.length && !query.isError) return null;

  return (
    <section id="saved-setups" aria-label="Saved setups" className="my-6 border-t border-tea-border pt-4">
      <h2 className="h2 mb-3">Saved setups</h2>
      {query.isError ? (
        <Button variant="quiet" type="button" onClick={() => void query.refetch()}>Retry saved setups</Button>
      ) : (
        <ul className="divide-y divide-tea-border">
          {query.data?.setups.map(setup => (
            <li key={setup.event_id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="h3">{setup.event_title}</h3>
                  <time dateTime={setup.event_date} className="text-ui-13 text-tea-text-sec">{setup.event_date.slice(0, 10)}</time>
                </div>
                <Button variant="quiet" type="button" disabled={remove.isPending}
                  aria-label={'Remove saved setup for ' + setup.event_title}
                  onClick={() => remove.mutate(setup.event_id)}>Remove save</Button>
              </div>
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-ui-14 text-tea-text-sec" aria-label="Teas in this setup">
                {setup.teas.map(tea => {
                  const href = canRead ? keptSetupTastingHref(journal, setup.event_id, setup.teas, tea) : null;
                  return <li key={tea.id}>{href
                    ? <Link to={href} className="tap-target underline underline-offset-4 hover:text-tea-text"
                        aria-label={`Open Journal tasting for ${tea.name}`}>{tea.name}</Link>
                    : tea.name}</li>;
                })}
              </ul>
              <KeptSetupPhotoContext setupId={setup.event_id} teas={setup.teas} />
            </li>
          ))}
        </ul>
      )}
      {remove.isError && <p role="alert" className="text-ui-13 text-tea-text-sec">{remove.error instanceof Error ? remove.error.message : 'Could not remove the saved setup. Try again.'}</p>}
    </section>
  );
}
