// Launch 5, M4: circles and series (src/lib/circles.ts). Reached as api.circles.
// Every route answers 404 until both switches open, and to anyone who is not
// the host of the circle or table named. Nothing here sends anything to anyone.
import type { CircleGuest, HostSeries, SeriesKind } from './circles';

interface CirclesApiDependencies {
  apiUrl: string;
  authedFetch: (url: string, init?: RequestInit) => Promise<any>;
}

export function createCirclesApi({ apiUrl, authedFetch }: CirclesApiDependencies) {
  const table = (id: string) => `${apiUrl}/api/me/tables/${encodeURIComponent(id)}`;
  return {
    list: (): Promise<{ circles: HostSeries[] }> => authedFetch(`${apiUrl}/api/me/circles`),
    make: (input: { name: string; kind: SeriesKind }): Promise<{ circle: HostSeries }> =>
      authedFetch(`${apiUrl}/api/me/circles`, { method: 'POST', body: JSON.stringify(input) }),
    /** Put one of the host's own tables in a circle, or take it out with null. */
    place: (tableId: string, circleId: string | null): Promise<{ ok: true }> =>
      authedFetch(`${table(tableId)}/circle`, { method: 'PUT', body: JSON.stringify({ circle_id: circleId }) }),
    /** Guests confirmed at an earlier table of this table's circle, by name. */
    guests: (tableId: string): Promise<{ circle: { id: string; name: string } | null; guests: CircleGuest[] }> =>
      authedFetch(`${table(tableId)}/circle-guests`),
    /** The host's yes for one of them, in one tap. Nothing is sent. */
    askBack: (tableId: string, attendeeId: string): Promise<{ ok: true; name: string; status: 'confirmed' }> =>
      authedFetch(`${table(tableId)}/circle-guests/${encodeURIComponent(attendeeId)}/ask`, { method: 'POST', body: '{}' }),
  };
}
