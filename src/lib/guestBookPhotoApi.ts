import { API_URL, authedBlobFetch, authedFetch } from './api';
import type { GuestBookAction, GuestBookStatus } from './guestBookApi';

export type GuestBookPhoto = { id: string; entry_key?: string; display_name: string; alt_text: string };
export type ReviewPhoto = GuestBookPhoto & { status: GuestBookStatus };
export type OwnPhoto = {
  id: string; tea_name: string | null; created_at: string; grant_id: string | null; status: GuestBookStatus | null; alt_text: string | null;
};
type Identity = { accountId: string | null; userId: string };
type GuestPhotoInput =
  | { action: 'photos-read' }
  | { action: 'photo-bytes'; grantId: string }
  | { action: 'photo-withdraw'; grantId: string }
  | { action: 'private-photo-preview'; photoId: string }
  | { action: 'photo-offer'; photoId: string; grantId: string; description: string };

function options(expectedAuth: Identity) {
  return { expectedAuth, cache: 'no-store', referrerPolicy: 'no-referrer', reportIncident: false } as const;
}
const guest = `${API_URL}/api/after-sit/guest-book`;
const guestOptions = (credential: string, input: GuestPhotoInput, identity: Identity) => ({
  ...options(identity), method: 'POST', body: JSON.stringify({ credential, ...input }), background: true,
});
const staff = (event: string) => `${API_URL}/api/admin/events/${encodeURIComponent(event)}/guest-book/photos`;
const owner = (event: string, photo: string) =>
  `${API_URL}/api/me/personal-kept-setups/${encodeURIComponent(event)}/photos/${encodeURIComponent(photo)}/guest-book`;

export const guestBookPhotoApi = {
  list: (credential: string, identity: Identity, signal?: AbortSignal): Promise<{ gallery: GuestBookPhoto[]; own: OwnPhoto[] }> =>
    authedFetch(guest, { ...guestOptions(credential, { action: 'photos-read' }, identity), signal }),
  read: (credential: string, input: Extract<GuestPhotoInput, { action: 'photo-bytes' } | { action: 'private-photo-preview' }>,
    identity: Identity, signal?: AbortSignal) => authedBlobFetch(guest, { ...guestOptions(credential, input, identity), signal }),
  offer: (credential: string, input: Extract<GuestPhotoInput, { action: 'photo-offer' }>, identity: Identity) =>
    authedFetch(guest, guestOptions(credential, input, identity)),
  withdraw: (credential: string, grantId: string, identity: Identity) =>
    authedFetch(guest, guestOptions(credential, { action: 'photo-withdraw', grantId }, identity)),
  staffList: (event: string, identity: Identity, signal?: AbortSignal): Promise<{ photos: ReviewPhoto[] }> =>
    authedFetch(staff(event), { ...options(identity), signal }),
  staffRead: (event: string, id: string, identity: Identity, signal?: AbortSignal) =>
    authedBlobFetch(`${staff(event)}/${encodeURIComponent(id)}`, { ...options(identity), signal }),
  staffReview: (event: string, photo: ReviewPhoto, action: GuestBookAction, identity: Identity) =>
    authedFetch(`${staff(event)}/${encodeURIComponent(photo.id)}`, {
      ...options(identity), method: 'PUT', body: JSON.stringify({ action, status: photo.status }),
    }),
  ownerStatus: (event: string, photo: string, identity: Identity): Promise<{ grant: { id: string; status: GuestBookStatus } | null }> =>
    authedFetch(owner(event, photo), options(identity)),
  ownerWithdraw: (event: string, photo: string, grantId: string, identity: Identity) =>
    authedFetch(owner(event, photo), { ...options(identity), method: 'DELETE', body: JSON.stringify({ grantId }) }),
};
