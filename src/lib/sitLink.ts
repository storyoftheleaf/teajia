// A shared sit and its guest access, from worker/src/pourSit.ts.
import type { PublicSessionTea } from '../../shared/sessionTea';
import type { VenueGuide } from '../types/events';
import { API_URL, fetchWithTimeout } from './api';

export type SitLink = {
  access: 'casual' | 'confirmed';
  title: string;
  date: string;
  timezone: string | null;
  /** The sit is finished. A casual sit reaches this state when its day arrives. */
  happened: boolean;
  /** The signed-in guest has a confirmed seat with attendance recorded. */
  seated: boolean;
  note: string | null;
  teas: PublicSessionTea[];
  /** The way in, available while the sit's access window is open. */
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
export async function readSitLink(code: string, signInToken?: string | null): Promise<SitLink | { access: 'approval'; rsvp_path: string | null } | null> {
  const response = await request(encodeURIComponent(code), 'GET', signInToken);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('The sit could not be loaded.');
  const body = await response.json() as
    | { access: 'approval'; rsvp_path: string | null }
    | (Omit<SitLink, 'way'> & { way: (Omit<NonNullable<SitLink['way']>, 'guide'> & { guide: unknown }) | null });
  if (body.access === 'approval') return body;
  return { ...body, way: body.way ? { ...body.way, guide: readGuide(body.way.guide) } : null };
}

function readGuide(value: unknown): VenueGuide | null {
  let guide = value;
  if (typeof guide === 'string') {
    try { guide = JSON.parse(guide); } catch { return null; }
  }
  return guide && typeof guide === 'object' && Array.isArray((guide as VenueGuide).steps) ? guide as VenueGuide : null;
}

/** Open the guest's own thank-you. A casual sit also records the guest's seat here. */
export async function joinSit(code: string, signInToken: string): Promise<string | null> {
  const response = await request(`${encodeURIComponent(code)}/join`, 'POST', signInToken);
  if (!response.ok) return null;
  const body = await response.json() as { credential?: unknown };
  return typeof body.credential === 'string' ? body.credential : null;
}
