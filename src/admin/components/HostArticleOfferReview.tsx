import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { HostArticleOfferForm } from '../../components/article/HostArticleOfferForm';
import { Button } from '../../components/shared/Button';
import { TYPOGRAPHY_CLASSES } from '../../designTokens';
import { hostArticleOffersApi, offerStatusLabel, useOfferScope, type HostArticleOffer } from '../../lib/hostArticleOffersApi';
import { useAdminBack } from '../hooks/useAdminBack';
import { historyIndex } from './adminHistory';

export function HostArticleOfferReview({ step, onStep }: { step: string; onStep: (step: string | null) => void }) {
  const scope = useOfferScope();
  const back = useAdminBack(step === 'inbox' ? '/admin/magazine' : '/admin/magazine?offerReview=inbox');
  const queryClient = useQueryClient();
  const queryKey = ['host-article-offer-inbox', scope?.userId, scope?.accountId];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => hostArticleOffersApi.inbox(scope!, signal),
    enabled: !!scope,
    staleTime: 0,
  });
  const offers = query.data?.offers ?? [];
  const offer = offers.find(item => item.id === step);

  function complete(result: HostArticleOffer) {
    queryClient.setQueryData<typeof query.data>(queryKey, current => current && ({
      offers: current.offers.map(item => item.id === result.id ? result : item),
    }));
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ['admin-articles'] });
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-tea-bg px-4 py-6 md:px-6 lg:px-10">
      <div className="max-w-3xl space-y-4">
        {historyIndex() === 0 && (
          <Button type="button" variant="quiet" className="tap-target"
            icon={<ArrowLeft size={16} aria-hidden="true" />} onClick={back}>
            {step === 'inbox' ? 'Back to Magazine' : 'Back to offers'}
          </Button>
        )}
        <h1 className={TYPOGRAPHY_CLASSES.h2}>{step === 'inbox' ? 'Article offers' : 'Review article offer'}</h1>
        {query.isPending ? (
          <p role="status" className="text-ui-14 text-tea-text-sec">Loading article offers…</p>
        ) : query.isError ? (
          <div className="flex flex-wrap items-center gap-2">
            <p role="alert" className="text-ui-14 text-tea-text-sec">Article offers could not be loaded.</p>
            <Button type="button" variant="quiet" className="tap-target" onClick={() => void query.refetch()}>Retry</Button>
          </div>
        ) : step === 'inbox' ? (
          offers.length > 0 ? (
            <ul className="divide-y divide-tea-border border-y border-tea-border">
              {offers.map(item => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0 space-y-1">
                    <p className="break-words text-ui-16 text-tea-text">{item.title}</p>
                    <p className="text-ui-13 text-tea-text-sec">{item.status === 'offered' ? 'Awaiting review' : offerStatusLabel(item)}</p>
                  </div>
                  <Button type="button" variant="secondary" className="tap-target" onClick={() => onStep(item.id)}>
                    {item.status === 'offered' ? 'Review offer' : 'View decision'}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ui-14 text-tea-text-sec">No article offers yet.</p>
          )
        ) : !offer || !scope ? (
          <p className="text-ui-14 text-tea-text-sec">Article offer unavailable.</p>
        ) : offer.status === 'offered' ? (
          <HostArticleOfferForm key={offer.id} scope={scope} offer={offer} onCancel={back} onComplete={complete} />
        ) : (
          <div className="space-y-2">
            <h2 className={`${TYPOGRAPHY_CLASSES.h3} break-words`}>{offer.title}</h2>
            <p role="status" className="text-ui-14 text-tea-text-sec">{offerStatusLabel(offer)}</p>
            {offer.status === 'published' && offer.slug && (
              <Link to={`/article/${encodeURIComponent(offer.slug)}`} className="tap-target inline-flex text-ui-14 text-tea-gold hover:underline">
                Read published article
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
