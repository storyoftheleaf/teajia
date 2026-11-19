export interface PrivateSessionReflection {
  attendee_id: string;
  event_id: string;
  title: string;
  event_date: string;
  reflection: string;
  updated_at: string;
}

export interface ReceivedTeaCard {
  id: string;
  entry_id: string;
  name: string;
  chinese_name: string | null;
  type: string | null;
  form: string | null;
  year: string | number | null;
  origin_region: string | null;
  category: string | null;
  material: string | null;
  capacity_ml: number | null;
  claimed_at: string;
}

type MemberFetch = (url: string, init?: RequestInit & {
  expectedAuth?: { accountId: string; userId: string };
}) => Promise<any>;

export function createMemberRecordsApi(fetcher: MemberFetch, API_URL: string) {
  const authedFetch = fetcher;
  return {
    sessionReflections: {
      list: (): Promise<{ reflections: PrivateSessionReflection[] }> =>
        authedFetch(`${API_URL}/api/me/session-reflections`),
      get: (token: string): Promise<{ reflection: string }> =>
        authedFetch(`${API_URL}/api/rsvp/${encodeURIComponent(token)}/reflection`),
      save: (token: string, reflection: string) =>
        authedFetch(`${API_URL}/api/rsvp/${encodeURIComponent(token)}/reflection`, {
          method: 'PUT', body: JSON.stringify({ reflection }),
        }),
      update: (id: string, reflection: string) =>
        authedFetch(`${API_URL}/api/me/session-reflections/${encodeURIComponent(id)}`, {
          method: 'PUT', body: JSON.stringify({ reflection }),
        }),
    },

    receivedCards: {
      list: (): Promise<{ cards: ReceivedTeaCard[] }> => authedFetch(`${API_URL}/api/me/received-cards`),
      get: (id: string): Promise<{ card: ReceivedTeaCard }> =>
        authedFetch(`${API_URL}/api/me/received-cards/${encodeURIComponent(id)}`),
    },
  };
}

export function createCompassInviteApi(authedFetch: MemberFetch, API_URL: string) {
  return {
    /** Public, fetch share metadata from an invite token (no auth required) */
    getInvite: async (token: string) => {
      // Token is injected by authedFetch (if present), no extra headers needed.
      return authedFetch(`${API_URL}/api/compass/invite/${token}`);
    },
    /** Authenticated, claim an invite link into the caller's compass */
    claimInvite: async (token: string, expectedAuth?: { accountId: string; userId: string }) => {
      return authedFetch(`${API_URL}/api/compass/invite/${token}/claim`, {
        method: 'POST',
        expectedAuth,
      });
    },
  };
}
