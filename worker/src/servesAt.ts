// Tea spaces, step 4 (todo/plans/tea-spaces.md): "Serves at tables" opens
// somewhere. The line under a name on the people list becomes a tap that
// opens that person's page at a short list: their own tea spaces first, then
// other spaces they have served in.
//
// Names only. No count, no dates, nothing that grows with how often. A
// private space (a host's saved place) shows as its area only: never its
// name, the address, the map link, the way in or the house it is in. A tea
// house that Adrian shows on /tea-houses/work is public, so it shows by its
// own name, with its page's slug.
//
// Opens with the line itself (acknowledgementOpen). Guard: worker/tests/serves-at.test.ts.

import { acknowledgementOpen } from './photographCredit';
import { CONTRIBUTOR_EFFECTIVELY_PUBLISHED_SQL } from './sessionHost';

export type ServesAtSpace = { label: string; house_slug?: string };
export type ServesAtAnswer = { own: ServesAtSpace[]; served: ServesAtSpace[] };

type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;

const HOST_ROLES = "('lead_host', 'co_host', 'guest_host')";

function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'public, max-age=300' } });
}

const clean = (value: unknown) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

/** Keep the first of each label, in the order given. */
function distinct(spaces: ServesAtSpace[], skip = new Set<string>()): ServesAtSpace[] {
  const seen = new Set(skip);
  const out: ServesAtSpace[] = [];
  for (const space of spaces) {
    const key = space.label.toLowerCase();
    if (!space.label || seen.has(key)) continue;
    seen.add(key);
    out.push(space);
  }
  return out;
}

export async function readServesAt(db: D1Database, slug: string): Promise<ServesAtAnswer | null> {
  const person = await db.prepare(
    `SELECT c.id, c.user_id FROM contributors c WHERE c.id = ? AND ${CONTRIBUTOR_EFFECTIVELY_PUBLISHED_SQL}`,
  ).bind(slug).first<{ id: string; user_id: string | null }>();
  if (!person) return null;

  // Their own spaces: the places they named as tea spaces in their own personal account. Area only.
  const own = person.user_id
    ? (await db.prepare(
      `SELECT sl.area_hint FROM saved_locations sl
         JOIN accounts a ON a.id = sl.account_id
        WHERE a.personal_inventory_user_id = ? AND sl.is_host_table = 1
        ORDER BY sl.area_hint COLLATE NOCASE ASC`,
    ).bind(person.user_id).all<{ area_hint: string | null }>()).results
      .map(row => ({ label: clean(row.area_hint) }))
    : [];

  // Where they have served: completed public sessions they hosted. A shown
  // tea house by its name; anywhere else by the area the session gave.
  const served = (await db.prepare(
    `SELECT DISTINCT
            CASE WHEN thp.is_shown = 1 THEN ha.name END AS house_name,
            CASE WHEN thp.is_shown = 1 THEN ha.slug END AS house_slug,
            COALESCE(NULLIF(trim(CASE WHEN sl.is_host_table = 1 THEN sl.area_hint END), ''),
                     NULLIF(trim(v.area_hint), ''),
                     NULLIF(trim(e.area_hint), '')) AS area
       FROM event_contributors ec
       JOIN events e ON e.id = ec.event_id AND e.account_id = ec.account_id
       JOIN accounts ha ON ha.id = e.account_id
       LEFT JOIN tea_house_pages thp ON thp.house_account_id = e.account_id
       LEFT JOIN saved_locations sl ON sl.id = e.location_id AND sl.account_id = e.account_id
       LEFT JOIN venues v ON v.id = e.venue_id AND v.account_id = e.account_id
      WHERE ec.contributor_id = ? AND ec.is_public = 1 AND ec.role IN ${HOST_ROLES}
        AND e.lifecycle_status IN ('completed', 'archived')
        AND e.event_date <= datetime('now')`,
  ).bind(person.id).all<{ house_name: string | null; house_slug: string | null; area: string | null }>()).results
    .map(row => clean(row.house_name)
      ? { label: clean(row.house_name), ...(clean(row.house_slug) ? { house_slug: clean(row.house_slug) } : {}) }
      : { label: clean(row.area) })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  const ownList = distinct(own);
  return { own: ownList, served: distinct(served, new Set(ownList.map(space => space.label.toLowerCase()))) };
}

export function servesAtRoutes<E extends { DB: D1Database; TEA_TABLE_OPEN?: string }>(): Array<[string, string, Handler<E>]> {
  const read: Handler<E> = async (_request, env, { slug }) => {
    // The same switch as the line itself (quiet acknowledgement opens with the Tea Table).
    if (!acknowledgementOpen(env)) return json({ error: 'Not found' }, 404);
    const answer = await readServesAt(env.DB, slug);
    return answer ? json(answer) : json({ error: 'Not found' }, 404);
  };
  return [['GET', '/api/public/people/:slug/spaces', read]];
}
