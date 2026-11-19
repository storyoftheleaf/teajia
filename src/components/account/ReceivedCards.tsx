import { Button } from '../shared/Button';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type ReceivedTeaCard } from '../../lib/api';
import { useAppStore } from '../../lib/store';

export function ReceivedCards() {
  const accountId = useAppStore(state => state.activeAccountId);
  const userId = useAppStore(state => state.activeUserId);
  const [params, setParams] = useSearchParams();
  const cardId = params.get('card');
  const scope = [accountId, userId];
  const cards = useQuery({
    queryKey: ['received-cards', ...scope],
    queryFn: () => api.receivedCards.list(),
    enabled: Boolean(accountId && userId && !cardId),
  });
  const detail = useQuery({
    queryKey: ['received-card', ...scope, cardId],
    queryFn: () => api.receivedCards.get(cardId!),
    enabled: Boolean(accountId && userId && cardId),
  });
  const select = (id: string | null) => setParams(current => {
    if (id) current.set('card', id);
    else current.delete('card');
    return current;
  });
  if (!accountId || !userId) return (
    <section aria-label="Received cards" className="mt-6">
      <Link to={`/signin?returnTo=${encodeURIComponent('/account/collection' + (params.toString() ? '?' + params.toString() : ''))}`}
        className="tap-target inline-flex text-ui-13 text-tea-text-sec">
        Sign in to open saved cards
      </Link>
    </section>
  );

  const query = cardId ? detail : cards;
  return (
    <section aria-label="Received cards" className="mt-6 border-t border-tea-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="h2 text-tea-text">Received cards</h2>
        {cardId && (
          <Button variant="plain" type="button" onClick={() => select(null)} className="tap-target text-ui-13 text-tea-text-sec">
            Back to cards
          </Button>
        )}
      </div>
      {query.isLoading ? <p className="text-ui-13 text-tea-text-sec">Loading cards…</p> : query.isError ? (
        <div className="flex flex-wrap items-center gap-3 text-ui-13 text-tea-text-sec">
          <p>{cardId ? 'This saved card is unavailable in this account.' : 'Could not load received cards.'}</p>
          <Button variant="plain" type="button" onClick={() => void query.refetch()} className="tap-target">Retry</Button>
        </div>
      ) : cardId ? (
        detail.data && <CardDetails card={detail.data.card} />
      ) : cards.data?.cards.length ? (
        <ul className="divide-y divide-tea-border">
          {cards.data.cards.map(card => (
            <li key={card.id}>
              <Button variant="plain" type="button" onClick={() => select(card.id)} className="tap-target w-full flex flex-wrap items-center justify-between gap-2 py-3 text-left text-tea-text">
                <span className="text-ui-15">{card.name}</span>
                <span className="text-ui-12 text-tea-text-sec">{[card.type, card.year].filter(value => value != null && value !== '').join(' · ')}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : <p className="text-ui-13 text-tea-text-sec">Cards you save from invitations appear here.</p>}
    </section>
  );
}

function CardDetails({ card }: { card: ReceivedTeaCard }) {
  return (
    <article className="rounded-md border border-tea-border bg-tea-surface p-4">
      <h3 className="h3 text-tea-text break-words">{card.name}</h3>
      {card.chinese_name && <p className="text-ui-15 text-tea-text-sec mt-1">{card.chinese_name}</p>}
      <p className="text-ui-13 text-tea-text-sec mt-2">
        {[card.type, card.form, card.year, card.origin_region, card.material,
          card.capacity_ml != null ? `${card.capacity_ml} ml` : null]
          .filter(value => value != null && value !== '').join(' · ')}
      </p>
    </article>
  );
}
