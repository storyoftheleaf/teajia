import { API_URL, authedBlobFetch, authedFetch } from './api';
import { useAppStore } from './store';

export type HostArticleOffer = {
  id: string;
  title: string;
  body: string;
  photos: string[];
  credit: boolean;
  status: 'offered' | 'published' | 'declined';
  slug: string | null;
  author_name: string | null;
  created_at: string;
};

export type OfferScope = { userId: string; accountId: string | null };

export function useOfferScope(): OfferScope | null {
  const userId = useAppStore(state => state.activeUserId);
  const accountId = useAppStore(state => state.activeAccountId);
  return userId ? { userId, accountId } : null;
}

const myOffers = '/api/me/article-offers';
const reviewOffers = '/api/admin/article-offers';

function request<T>(scope: OfferScope, path: string, body?: FormData, signal?: AbortSignal): Promise<T> {
  return authedFetch(`${API_URL}${path}`, {
    method: body ? 'POST' : 'GET',
    body,
    cache: 'no-store',
    expectedAuth: scope,
    reportIncident: false,
  }, signal);
}

export const hostArticleOffersApi = {
  mine: (scope: OfferScope, signal: AbortSignal) =>
    request<{ can_offer: boolean; offers: HostArticleOffer[] }>(scope, myOffers, undefined, signal),
  offer: (scope: OfferScope, body: FormData) =>
    request<HostArticleOffer>(scope, myOffers, body),
  inbox: (scope: OfferScope, signal: AbortSignal) =>
    request<{ offers: HostArticleOffer[] }>(scope, reviewOffers, undefined, signal),
  decide: (scope: OfferScope, id: string, body: FormData) =>
    request<HostArticleOffer>(scope, `${reviewOffers}/${encodeURIComponent(id)}`, body),
  photo: (scope: OfferScope, offerId: string, photoId: string, signal: AbortSignal) =>
    authedBlobFetch(
      `${API_URL}/api/article-offers/${encodeURIComponent(offerId)}/photos/${encodeURIComponent(photoId)}`,
      { expectedAuth: scope, cache: 'no-store', reportIncident: false },
      signal,
    ),
};

const OFFER_STATUS: Record<HostArticleOffer['status'], string> = {
  offered: 'With Adrian',
  published: 'Published',
  declined: 'Declined',
};

export function offerStatusLabel(offer: HostArticleOffer): string {
  return offer.status === 'published' && !offer.slug ? 'Taken offline' : OFFER_STATUS[offer.status];
}
