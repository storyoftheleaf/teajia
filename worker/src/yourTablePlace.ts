// Launch 4, slice K4, "Add your table"
// (todo/plans/guests-and-tea-masters-launch-4-run.md, hard question 4).
//
// A table is a saved place in the host's own account (saved_locations, kept
// from a table's way in by Launch 2's H8, worker/src/hostTableWay.ts). A tea
// house is a public account. They never share a page. The host names one of
// their places as "your table" and writes the area it is in; the public sees
// that area and nothing else of it: never the address, the map link, the way
// in, a pin, or the place's id.
//
// Every write is scoped to the caller's own personal account by index.ts.
// Guard: worker/tests/your-table-place.test.ts.

export const TABLE_AREA_MAX = 80;

export type YourTablePlace = { id: string; name: string; area_hint: string | null; is_table: boolean };

type Refused = { refused: { status: number; code: string; error: string } };
const refuse = (code: string, error: string, status = 400): Refused => ({ refused: { status, code, error } });

/** The host’s saved places by name, every one of them (review A6-3), and which one is their table. Their own page only. */
export async function readYourTable(db: D1Database, accountId: string): Promise<{ places: YourTablePlace[] }> {
  const rows = await db.prepare(
    `SELECT id, name, area_hint, is_host_table FROM saved_locations
      WHERE account_id = ? ORDER BY name COLLATE NOCASE ASC, id ASC`,
  ).bind(accountId).all<Record<string, unknown>>();
  return {
    places: rows.results.map(row => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      area_hint: typeof row.area_hint === 'string' && row.area_hint.trim() ? row.area_hint : null,
      is_table: Number(row.is_host_table) === 1,
    })),
  };
}

/**
 * Name one saved place as the host's table, with the area the public is told.
 * Any other place of theirs stops being the table in the same write.
 */
export async function chooseYourTable(db: D1Database, accountId: string, body: Record<string, unknown> | null):
  Promise<{ places: YourTablePlace[] } | Refused> {
  const placeId = typeof body?.place_id === 'string' ? body.place_id.trim() : '';
  if (!placeId) return refuse('your_table_place', 'Choose one of your places.');
  const area = typeof body?.area_hint === 'string' ? body.area_hint.trim() : '';
  if (!area) return refuse('your_table_area', 'Write the area your table is in.');
  if (area.length > TABLE_AREA_MAX) return refuse('your_table_area', `Keep the area under ${TABLE_AREA_MAX} characters.`);
  const place = await db.prepare('SELECT id, address, map_link FROM saved_locations WHERE id = ? AND account_id = ?')
    .bind(placeId, accountId).first<{ id: string; address: string | null; map_link: string | null }>();
  // Another account's place answers as if it did not exist.
  if (!place) return refuse('your_table_place', 'That place is not one of yours.', 404);
  // The area is shown to anyone; the address never is. Refuse an area that
  // carries the place's address or map link, so it cannot be given away by accident.
  const lower = area.toLowerCase();
  for (const secret of [place.address, place.map_link]) {
    const value = String(secret ?? '').trim().toLowerCase();
    // The address usually names the area too, so only the whole address is refused.
    if (value && lower.includes(value)) {
      return refuse('your_table_area_address', 'Write only the area, not the address.');
    }
  }
  if (/https?:\/\//i.test(area)) return refuse('your_table_area_address', 'Write only the area, not a link.');
  await db.batch([
    db.prepare(`UPDATE saved_locations SET is_host_table = 0, updated_at = datetime('now')
                 WHERE account_id = ? AND is_host_table = 1 AND id <> ?`).bind(accountId, placeId),
    db.prepare(`UPDATE saved_locations SET is_host_table = 1, area_hint = ?, updated_at = datetime('now')
                 WHERE id = ? AND account_id = ?`).bind(area, placeId, accountId),
  ]);
  return readYourTable(db, accountId);
}

/** Undo: none of the host's places is their table. The places themselves stay. */
export async function undoYourTable(db: D1Database, accountId: string): Promise<{ places: YourTablePlace[] }> {
  await db.prepare(`UPDATE saved_locations SET is_host_table = 0, updated_at = datetime('now')
                     WHERE account_id = ? AND is_host_table = 1`).bind(accountId).run();
  return readYourTable(db, accountId);
}

/**
 * The columns a public session read adds, for a query with the session as
 * `event`. While K4 is closed they read nothing of saved_locations.
 * Only the area leaves: `your_table_area` is NULL unless the session's place
 * is the host's table in the session's own account.
 */
export function yourTableAreaSql(open: boolean, event = 'e'): string {
  if (!open) return 'NULL AS your_table_area, 0 AS at_your_table';
  const match = `FROM saved_locations yt WHERE yt.id = ${event}.location_id
      AND yt.account_id = ${event}.account_id AND yt.is_host_table = 1`;
  return `(SELECT yt.area_hint ${match}) AS your_table_area, EXISTS (SELECT 1 ${match}) AS at_your_table`;
}

/**
 * Take the two columns off a public row and put back, at most, one plain part:
 * `your_table: { area }` when the session is at the host's table.
 */
export function withYourTable<T extends Record<string, unknown>>(row: T): Omit<T, 'your_table_area' | 'at_your_table'> & { your_table?: { area: string | null } } {
  const { your_table_area: area, at_your_table: at, ...rest } = row;
  if (Number(at) !== 1) return rest;
  return { ...rest, your_table: { area: typeof area === 'string' && area.trim() ? area : null } };
}
