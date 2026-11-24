import { API_URL, authedFetch, type ApiRequestInit } from './api';

export const GUEST_BOOK_NOTE_LIMIT = 280;

export type GuestBookStatus = 'pending' | 'included' | 'passed';
export type GuestBookAction = 'include' | 'pass';

type SharedGuestBookEntry = { id: string; entry_key?: string; display_name: string; note: string };

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
export type GuestBookEntryDraft = {
  note?: string;
  photo?: { photoId: string; grantId: string; description?: string };
};

function requestGuestBook(token: string, init: ApiRequestInit = {}) {
  return authedFetch(
    `${API_URL}/api/rsvp/${encodeURIComponent(token)}/guest-book`,
    { ...init, cache: 'no-store', background: true, reportIncident: false },
  );
}

function staffEndpoint(eventId: string) {
  return `${API_URL}/api/admin/events/${encodeURIComponent(eventId)}/guest-book`;
}

function requestAfterSitGuestBook<T>(credential: string, input: object, expectedAuth: Identity, signal?: AbortSignal) {
  return authedFetch(`${API_URL}/api/after-sit/guest-book`, {
    method: 'POST', body: JSON.stringify({ credential, ...input }),
    cache: 'no-store', referrerPolicy: 'no-referrer', expectedAuth, background: true, reportIncident: false, signal,
  }) as Promise<T>;
}

export const afterSitGuestBook = {
  read: (credential: string, identity: Identity, signal?: AbortSignal) =>
    requestAfterSitGuestBook<GuestBookData>(credential, { action: 'read' }, identity, signal),
  saveEntry: (credential: string, draft: GuestBookEntryDraft, identity: Identity) =>
    requestAfterSitGuestBook(credential, { action: 'entry-save', ...draft }, identity),
  withdrawEntry: (credential: string, identity: Identity) =>
    requestAfterSitGuestBook(credential, { action: 'entry-withdraw' }, identity),
  withdrawNote: (credential: string, identity: Identity) =>
    requestAfterSitGuestBook(credential, { action: 'withdraw' }, identity),
};

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
