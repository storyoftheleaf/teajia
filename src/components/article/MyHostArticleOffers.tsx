import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { hostArticleOffersApi, offerStatusLabel, useOfferScope } from '../../lib/hostArticleOffersApi';
import { Button } from '../shared/Button';
import { HostArticleOfferForm } from './HostArticleOfferForm';
import { LoadFailed } from '../shared/LoadFailed';
import { PART_QUERY, partView } from '../../lib/closedPart';

export function MyHostArticleOffers({ writing, onStep }: { writing: boolean; onStep: (step: string | null) => void }) {
  const scope = useOfferScope();
  const queryClient = useQueryClient();
  const queryKey = ['my-host-article-offers', scope?.userId, scope?.accountId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => hostArticleOffersApi.mine(scope!, signal),
    enabled: !!scope,
    staleTime: 0,
    ...PART_QUERY,
  });
  const view = partView(query);
  // A 404 is the worker not open yet (A10-3): offers are not offered, quietly.
  const failed = view.state === 'failed';

  if (writing) {
    return (
      <section aria-labelledby="offer-article-heading" className="space-y-4">
        <h1 id="offer-article-heading" className={TYPOGRAPHY_CLASSES.h2}>Offer an article</h1>
        {scope && query.data?.can_offer ? (
          <>
            <p className="text-ui-14 text-tea-text-sec">Adrian will edit your article and decide whether to publish it.</p>
            <HostArticleOfferForm key={scope.userId} scope={scope} onCancel={() => onStep(null)}
              onComplete={(result, isCurrent) => {
                queryClient.setQueryData<typeof query.data>(queryKey, current => current && ({
                  ...current,
                  offers: [result, ...current.offers.filter(offer => offer.id !== result.id)],
                }));
                void queryClient.invalidateQueries({ queryKey });
                if (isCurrent) onStep(null);
              }} />
          </>
        ) : (
          <>
            <p role={failed ? 'alert' : 'status'} className="text-ui-14 text-tea-text-sec">
              {failed ? 'Your writing page could not be loaded.' : view.state === 'loading' ? 'Loading your writing page…' : 'Article offers are open to people who host.'}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="quiet" className="tap-target" onClick={() => onStep(null)}>Back to profile</Button>
              {failed && <Button type="button" variant="secondary" className="tap-target" onClick={() => void query.refetch()}>Try again</Button>}
            </div>
          </>
        )}
      </section>
    );
  }

  if (!scope || !query.data) {
    return view.state === 'failed'
      ? <LoadFailed className="mt-6" sentence="Your article offers could not be loaded just now." onRetry={view.retry} />
      : null;
  }
  const { can_offer: canOffer, offers = [] } = query.data;
  if (!canOffer && offers.length === 0) return null;

  return (
    <section aria-label="Your articles" className="mt-6 max-w-3xl space-y-3 border-y border-tea-border py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={TYPOGRAPHY_CLASSES.h3}>Your articles</h2>
        {canOffer && (
          <Button type="button" variant="secondary" className="tap-target" onClick={() => onStep('write')}>
            Offer an article
          </Button>
        )}
      </div>
      {offers.length > 0 && (
        <ul className="divide-y divide-tea-border">
          {offers.map(offer => (
            <li key={offer.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
              {offer.status === 'published' && offer.slug ? (
                <Link to={`/article/${encodeURIComponent(offer.slug)}`} className="tap-target inline-flex min-w-0 items-center break-words text-ui-16 text-tea-gold hover:underline">
                  {offer.title}
                </Link>
              ) : (
                <span className="min-w-0 break-words text-ui-16 text-tea-text">{offer.title}</span>
              )}
              <span className="text-ui-13 text-tea-text-sec">{offerStatusLabel(offer)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
