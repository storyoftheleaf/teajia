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

export type YourTablePlace = { id: string; name: string; area_hint: string | null; is_table: boolean; shown?: boolean };

type Refused = { refused: { status: number; code: string; error: string } };
const refuse = (code: string, error: string, status = 400): Refused => ({ refused: { status, code, error } });

/** The host’s saved places by name, every one of them (review A6-3), and which one is their table. Their own page only. */
export async function readYourTable(db: D1Database, accountId: string): Promise<{ places: YourTablePlace[] }> {
  const rows = await db.prepare(
    `SELECT id, name, area_hint, is_host_table, shown_on_spaces FROM saved_locations
      WHERE account_id = ? ORDER BY name COLLATE NOCASE ASC, id ASC`,
  ).bind(accountId).all<Record<string, unknown>>();
  return {
    places: rows.results.map(row => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      area_hint: typeof row.area_hint === 'string' && row.area_hint.trim() ? row.area_hint : null,
      is_table: Number(row.is_host_table) === 1,
      // On the tea spaces page (step 3), by its area only.
      shown: Number(row.is_host_table) === 1 && Number(row.shown_on_spaces) === 1,
    })),
  };
}

/**
 * Mark one saved place as a tea space of the host's, with the area the public
 * is told. A host may have several (tea spaces, step 2, 2026-11-27); the
 * others are left as they are.
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
  await db.prepare(`UPDATE saved_locations SET is_host_table = 1, area_hint = ?, updated_at = datetime('now')
               WHERE id = ? AND account_id = ?`).bind(area, placeId, accountId).run();
  return readYourTable(db, accountId);
}

export const TEA_SPACE_NAME_MAX = 80;
/** The same ceiling as a table's kept places (WAY_MAX_PLACES in hostTableWay.ts). */
export const TEA_SPACE_PLACES_MAX = 50;

/**
 * Add a new tea space: a name and the area, nothing more (tea spaces, step 2).
 * It is kept as one of the host's saved places with no address yet; the way in
 * is added from a table's page as before.
 */
export async function addTeaSpace(db: D1Database, accountId: string, body: Record<string, unknown> | null):
  Promise<{ places: YourTablePlace[] } | Refused> {
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) return refuse('tea_space_name', 'Give your tea space a name.');
  if (name.length > TEA_SPACE_NAME_MAX) return refuse('tea_space_name', `Keep the name under ${TEA_SPACE_NAME_MAX} characters.`);
  const area = typeof body?.area_hint === 'string' ? body.area_hint.trim() : '';
  if (!area) return refuse('your_table_area', 'Write the area your tea space is in.');
  if (area.length > TABLE_AREA_MAX) return refuse('your_table_area', `Keep the area under ${TABLE_AREA_MAX} characters.`);
  if (/https?:\/\//i.test(area)) return refuse('your_table_area_address', 'Write only the area, not a link.');
  const count = await db.prepare('SELECT COUNT(*) AS n FROM saved_locations WHERE account_id = ?')
    .bind(accountId).first<{ n: number }>();
  if (Number(count?.n ?? 0) >= TEA_SPACE_PLACES_MAX) return refuse('table_way_places_full', `You can keep up to ${TEA_SPACE_PLACES_MAX} places.`, 409);
  await db.prepare(`INSERT INTO saved_locations (name, address, account_id, is_host_table, area_hint)
                    VALUES (?, '', ?, 1, ?)`).bind(name, accountId, area).run();
  return readYourTable(db, accountId);
}

/**
 * Undo: the place named (or, with none named, every place) stops being a tea
 * space. The places themselves stay.
 */
export async function undoYourTable(db: D1Database, accountId: string, placeId?: string | null): Promise<{ places: YourTablePlace[] }> {
  if (placeId) {
    await db.prepare(`UPDATE saved_locations SET is_host_table = 0, shown_on_spaces = 0, updated_at = datetime('now')
                       WHERE account_id = ? AND id = ? AND is_host_table = 1`).bind(accountId, placeId).run();
  } else {
    await db.prepare(`UPDATE saved_locations SET is_host_table = 0, shown_on_spaces = 0, updated_at = datetime('now')
                       WHERE account_id = ? AND is_host_table = 1`).bind(accountId).run();
  }
  return readYourTable(db, accountId);
}

/**
 * Say which of the host's tea spaces a table is in (tea spaces, step 2), or
 * none (null). Only a tea space of the table's own account; anything else
 * answers as if it did not exist. The table's address and way in stay as set.
 */
export async function setTableTeaSpace(db: D1Database, table: { id: string; account_id: string }, body: Record<string, unknown> | null):
  Promise<{ table_id: string; space: YourTablePlace | null } | Refused> {
  const raw = body?.place_id;
  if (raw !== null && typeof raw !== 'string') return refuse('tea_space_place', 'Choose one of your tea spaces, or none.');
  const placeId = typeof raw === 'string' ? raw.trim() : '';
  let space: YourTablePlace | null = null;
  if (placeId) {
    const row = await db.prepare(
      'SELECT id, name, area_hint FROM saved_locations WHERE id = ? AND account_id = ? AND is_host_table = 1',
    ).bind(placeId, table.account_id).first<{ id: string; name: string; area_hint: string | null }>();
    if (!row) return refuse('tea_space_place', 'That is not one of your tea spaces.', 404);
    space = { id: row.id, name: String(row.name ?? ''), area_hint: row.area_hint, is_table: true };
  }
  await db.prepare(`UPDATE events SET location_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
    .bind(space?.id ?? null, table.id, table.account_id).run();
  return { table_id: table.id, space };
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
