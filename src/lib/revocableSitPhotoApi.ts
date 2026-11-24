import { API_URL, authedBlobFetch, authedFetch } from './api';

type ServedPhotoTea = { id: string; name: string };
export type SitPhotoReviewEntry = { id: string; credit: string; status: 'offered' | 'placed'; tea?: ServedPhotoTea; canShowInBrewing?: boolean };
type Identity = { accountId: string | null; userId: string };
type PublicRecapPhotoDetails = { id: string; credit: string; alt_text: string; observation: string | null; tea?: ServedPhotoTea; canShowInBrewing?: boolean };

const component = encodeURIComponent;
const ownerEndpoint = (eventId: string, photoId: string) =>
  `${API_URL}/api/me/kept-setups/${component(eventId)}/photos/${component(photoId)}/public-permission`;
const reviewEndpoint = (eventId: string) =>
  `${API_URL}/api/admin/events/${component(eventId)}/recap-photo-review`;
const publicEndpoint = (slug: string) => `${API_URL}/api/events/${component(slug)}/recap-photo`;
const options = (expectedAuth: Identity) => ({
  cache: 'no-store' as const, expectedAuth, background: true, reportIncident: false,
});

export const revocableSitPhotoApi = {
  ownerStatus: (eventId: string, photoId: string, scope: Identity): Promise<{
    eligible: boolean; permission: SitPhotoReviewEntry | null;
  }> => authedFetch(ownerEndpoint(eventId, photoId), options(scope)),
  offer: (eventId: string, photoId: string, permission: { id: string; credit: string; canShowInBrewing?: boolean }, scope: Identity):
    Promise<{ permission: SitPhotoReviewEntry }> => authedFetch(ownerEndpoint(eventId, photoId), {
    ...options(scope), method: 'PUT', body: JSON.stringify(permission),
  }),
  withdraw: (eventId: string, photoId: string, id: string, scope: Identity) =>
    authedFetch(ownerEndpoint(eventId, photoId), { ...options(scope), method: 'DELETE', body: JSON.stringify({ id }) }),
  forReview: (eventId: string, scope: Identity): Promise<{ published: boolean; permissions: SitPhotoReviewEntry[] }> =>
    authedFetch(reviewEndpoint(eventId), options(scope)),
  preview: (eventId: string, grantId: string, scope: Identity) =>
    authedBlobFetch(`${reviewEndpoint(eventId)}/${component(grantId)}`, options(scope)),
  approve: (eventId: string, grantId: string, placement: { alt_text: string; observation: string }, scope: Identity) =>
    authedFetch(`${reviewEndpoint(eventId)}/${component(grantId)}`, {
      ...options(scope), method: 'PUT', body: JSON.stringify(placement),
    }),
  forPublicRecap: async (slug: string, signal: AbortSignal, placement?: 'brewing' | 'essay') => {
    const url = publicEndpoint(slug);
    const purpose = placement ? `?placement=${component(placement)}` : '';
    // Read-only POSTs also bypass old clients' GET-only service-worker caches.
    const init = { method: 'POST', cache: 'no-store', credentials: 'omit', signal } as const;
    const status = await fetch(url + purpose, init);
    if (!status.ok) return null;
    const { photo } = await status.json() as { photo: PublicRecapPhotoDetails | null };
    if (!photo || (placement && !photo.canShowInBrewing)) return null;
    const image = await fetch(`${url}/${component(photo.id)}${purpose}`, init);
    if (!image.ok || image.headers.get('Content-Type') !== 'image/jpeg') return null;
    return { ...photo, image: await image.blob() };
  },
};

export const recapPhotoPublicQuery = ['public-recap-photo'] as const;
