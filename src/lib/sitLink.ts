// A sit's one link (/sit/<code>): what anyone holding it may read, and the
// seat a signed-in person takes by saying they were there. The worker side is
// worker/src/pourSit.ts.
import type { PublicSessionTea } from '../../shared/sessionTea';
import type { VenueGuide } from '../types/events';
import { API_URL, fetchWithTimeout } from './api';

export type SitLink = {
  title: string;
  date: string;
  timezone: string | null;
  /** The sit's day has come, so a guest can take their seat. */
  happened: boolean;
  /** The signed-in person already has a seat here. */
  seated: boolean;
  note: string | null;
  teas: PublicSessionTea[];
  /** The way in, present only until the day of the sit is over. */
  way: { place: string | null; address: string | null; map_link: string | null; ends_at: number | null; guide: VenueGuide | null } | null;
};

const request = (path: string, method: string, signInToken?: string | null) => fetchWithTimeout(`${API_URL}/api/sit/${path}`, {
  method,
  headers: signInToken ? { Authorization: `Bearer ${signInToken}` } : {},
  cache: 'no-store',
  credentials: 'omit',
  referrerPolicy: 'no-referrer',
  reportIncident: false,
});

/** The sit behind a code, or null when the code names none. */
export async function readSitLink(code: string, signInToken?: string | null): Promise<SitLink | null> {
  const response = await request(encodeURIComponent(code), 'GET', signInToken);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('The sit could not be loaded.');
  const body = await response.json() as Omit<SitLink, 'way'> & { way: (Omit<NonNullable<SitLink['way']>, 'guide'> & { guide: unknown }) | null };
  return { ...body, way: body.way ? { ...body.way, guide: readGuide(body.way.guide) } : null };
}

function readGuide(value: unknown): VenueGuide | null {
  let guide = value;
  if (typeof guide === 'string') {
    try { guide = JSON.parse(guide); } catch { return null; }
  }
  return guide && typeof guide === 'object' && Array.isArray((guide as VenueGuide).steps) ? guide as VenueGuide : null;
}

/** Take a seat at the sit. Returns the seat's own thank-you link, or null when the sit gives none. */
export async function joinSit(code: string, signInToken: string): Promise<string | null> {
  const response = await request(`${encodeURIComponent(code)}/join`, 'POST', signInToken);
  if (!response.ok) return null;
  const body = await response.json() as { credential?: unknown };
  return typeof body.credential === 'string' ? body.credential : null;
}
