// Tea spaces, step 3 (todo/plans/tea-spaces.md): the tea spaces page.
//
// One page of spaces. A tea house that Adrian shows on /tea-houses/work is
// public, so it is named, with the spaces inside it by name. A host's own tea
// space is a saved place in their own account: it appears only once its owner
// has turned it on (saved_locations.shown_on_spaces), and then by its area
// alone, with who serves there. Never its name, the address, the map link or
// the way in. Nothing ranks spaces: houses in Adrian's order, then spaces by
// area.
//
// Guard: worker/tests/tea-spaces-page.test.ts.

import { teaHousesOpen } from '../../src/lib/teaHouses';
import { CONTRIBUTOR_EFFECTIVELY_PUBLISHED_SQL } from './sessionHost';

export type TeaSpacesHouse = { name: string; slug: string; spaces: string[] };
export type TeaSpacesSpace = { id: string; area: string; served_by: { name: string; slug: string } | null };
export type TeaSpacesAnswer = { houses: TeaSpacesHouse[]; spaces: TeaSpacesSpace[] };

type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;

const clean = (value: unknown) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '');

export async function readTeaSpaces(db: D1Database): Promise<TeaSpacesAnswer> {
  const houseRows = (await db.prepare(
    `SELECT a.id, a.name, a.slug FROM tea_house_pages thp JOIN accounts a ON a.id = thp.house_account_id
      WHERE thp.is_shown = 1 ORDER BY thp.position ASC, a.name COLLATE NOCASE ASC`,
  ).all<{ id: string; name: string | null; slug: string | null }>()).results;
  const houses: TeaSpacesHouse[] = [];
  for (const row of houseRows) {
    if (!clean(row.name) || !clean(row.slug)) continue;
    const spaces = (await db.prepare(
      'SELECT name FROM venue_spaces WHERE account_id = ? ORDER BY sort_order ASC, name COLLATE NOCASE ASC',
    ).bind(row.id).all<{ name: string | null }>()).results.map(space => clean(space.name)).filter(Boolean);
    houses.push({ name: clean(row.name), slug: clean(row.slug), spaces });
  }

  const spaceRows = (await db.prepare(
    `SELECT sl.id, sl.area_hint,
            (SELECT c.display_name FROM contributors c WHERE c.user_id = a.personal_inventory_user_id
                AND ${CONTRIBUTOR_EFFECTIVELY_PUBLISHED_SQL} ORDER BY c.id LIMIT 1) AS host_name,
            (SELECT c.id FROM contributors c WHERE c.user_id = a.personal_inventory_user_id
                AND ${CONTRIBUTOR_EFFECTIVELY_PUBLISHED_SQL} ORDER BY c.id LIMIT 1) AS host_slug
       FROM saved_locations sl JOIN accounts a ON a.id = sl.account_id
      WHERE sl.is_host_table = 1 AND sl.shown_on_spaces = 1 AND a.personal_inventory_user_id IS NOT NULL
      ORDER BY sl.area_hint COLLATE NOCASE ASC, sl.id ASC`,
  ).all<{ id: string; area_hint: string | null; host_name: string | null; host_slug: string | null }>()).results;
  const spaces = spaceRows
    .filter(row => clean(row.area_hint))
    .map(row => ({
      id: String(row.id),
      area: clean(row.area_hint),
      served_by: clean(row.host_name) && clean(row.host_slug) ? { name: clean(row.host_name), slug: clean(row.host_slug) } : null,
    }));
  return { houses, spaces };
}

/** The owner turns one of their tea spaces on or off the tea spaces page. */
export async function setTeaSpaceShown(db: D1Database, accountId: string, placeId: string, shown: unknown):
  Promise<{ ok: true } | { refused: { status: number; code: string; error: string } }> {
  if (typeof shown !== 'boolean') return { refused: { status: 400, code: 'tea_space_shown', error: 'Say whether it is shown.' } };
  const result = await db.prepare(
    `UPDATE saved_locations SET shown_on_spaces = ?, updated_at = datetime('now')
      WHERE id = ? AND account_id = ? AND is_host_table = 1`,
  ).bind(shown ? 1 : 0, placeId, accountId).run();
  if (!result.meta?.changes) return { refused: { status: 404, code: 'tea_space_place', error: 'That is not one of your tea spaces.' } };
  return { ok: true };
}

export function teaSpacesPageRoutes<E extends { DB: D1Database; TEA_HOUSES_OPEN?: string }>(): Array<[string, string, Handler<E>]> {
  const read: Handler<E> = async (_request, env) => {
    if (!teaHousesOpen(env)) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(await readTeaSpaces(env.DB), { headers: { 'Cache-Control': 'public, max-age=120' } });
  };
  return [['GET', '/api/tea-spaces', read]];
}
