import { API_URL, authedFetch, type ApiRequestInit } from './api';

export const GUEST_BOOK_NOTE_LIMIT = 280;

export type GuestBookStatus = 'pending' | 'included' | 'passed';
export type GuestBookAction = 'include' | 'pass';

type SharedGuestBookEntry = { id: string; display_name: string; note: string };

export type GuestBookData = {
  entries: SharedGuestBookEntry[];
  own: { id: string; note: string; status: GuestBookStatus } | null;
};

export type GuestBookReviewEntry = SharedGuestBookEntry & {
  revision: number;
  status: GuestBookStatus;
};

type Identity = { accountId: string | null; userId: string };
type StaffIdentity = { accountId: string; userId: string };

function requestGuestBook(token: string, init: ApiRequestInit = {}) {
  return authedFetch(
    `${API_URL}/api/rsvp/${encodeURIComponent(token)}/guest-book`,
    { ...init, cache: 'no-store', background: true, reportIncident: false },
  );
}

function staffEndpoint(eventId: string) {
  return `${API_URL}/api/admin/events/${encodeURIComponent(eventId)}/guest-book`;
}

export function afterSitGuestBook<T>(credential: string, action: 'read' | 'send' | 'withdraw', expectedAuth: Identity, note?: string) {
  return authedFetch(`${API_URL}/api/after-sit/guest-book`, {
    method: 'POST', body: JSON.stringify({ credential, action, note }),
    cache: 'no-store', expectedAuth, background: true, reportIncident: false,
  }) as Promise<T>;
}

export const guestBookApi = {
  read: (token: string, expectedAuth?: StaffIdentity): Promise<GuestBookData> => requestGuestBook(token, { expectedAuth }),
  send: (token: string, note: string, expectedAuth?: StaffIdentity) => requestGuestBook(token, {
    method: 'PUT',
    expectedAuth,
    body: JSON.stringify({ note }),
  }),
  withdraw: (token: string, expectedAuth?: StaffIdentity) => requestGuestBook(token, { method: 'DELETE', expectedAuth }),
  listForReview: (eventId: string, expectedAuth: StaffIdentity): Promise<{ entries: GuestBookReviewEntry[] }> =>
    authedFetch(staffEndpoint(eventId), { expectedAuth, cache: 'no-store' }),
  review: (eventId: string, entry: GuestBookReviewEntry, action: GuestBookAction, expectedAuth: StaffIdentity) =>
    authedFetch(`${staffEndpoint(eventId)}/${encodeURIComponent(entry.id)}/review`, {
      method: 'POST',
      expectedAuth,
      body: JSON.stringify({ action, revision: entry.revision }),
    }),
};
