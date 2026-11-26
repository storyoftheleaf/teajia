// The area of a hosted table (Launch 2, check run H13, finding 1).
//
// One short line the host writes, such as "Ubud, near the market", kept in
// events.area_hint and shown on the session's public page. It is never the
// way to the house: a link is refused, and so is a line that carries the
// whole address or map link the host saved, for this table or for any of
// their kept places, so the address cannot be given away by accident. The
// same rule as Launch 4's yourTablePlace.ts, for one table.
//
// Every write is scoped to the caller's own table by index.ts
// (requireOwnHostedTable) or to the table being made.

export const TABLE_AREA_MAX = 80;

type AreaRefusal = { refused: { status: number; code: string; error: string } };
const refuse = (code: string, error: string): AreaRefusal => ({ refused: { status: 400, code, error } });

/**
 * The area from a request body. Undefined when the body does not name one,
 * null when it is cleared (left blank), else the trimmed line.
 */
export function readTableArea(body: Record<string, unknown> | null): string | null | undefined | AreaRefusal {
  if (!body || body.area === undefined) return undefined;
  if (body.area === null) return null;
  if (typeof body.area !== 'string') return refuse('hosted_table_area', 'Write the area as words.');
  const area = body.area.replace(/\s+/g, ' ').trim();
  if (!area) return null;
  if (area.length > TABLE_AREA_MAX) return refuse('hosted_table_area', `Keep the area under ${TABLE_AREA_MAX} characters.`);
  if (/https?:\/\/|www\./i.test(area)) {
    return refuse('hosted_table_area_address', 'Write only the area, not a link.');
  }
  return area;
}

export function isAreaRefusal(value: unknown): value is AreaRefusal {
  return Boolean(value && typeof value === 'object' && 'refused' in value);
}

/**
 * Refuse an area that carries the whole address or map link the host saved,
 * for this table (when it exists) or any of their kept places. The address
 * usually names the area too, so only the whole address is refused.
 */
export async function areaGivesAwayTheWay(
  db: D1Database, accountId: string, eventId: string | null, area: string,
): Promise<AreaRefusal | null> {
  const [table, places] = await Promise.all([
    eventId
      ? db.prepare('SELECT address_text, map_link FROM events WHERE id = ? AND account_id = ?')
        .bind(eventId, accountId).first<{ address_text: string | null; map_link: string | null }>()
      : Promise.resolve(null),
    db.prepare('SELECT address, map_link FROM saved_locations WHERE account_id = ? LIMIT 200')
      .bind(accountId).all<{ address: string | null; map_link: string | null }>(),
  ]);
  const secrets = [
    table?.address_text, table?.map_link,
    ...(places.results ?? []).flatMap(place => [place.address, place.map_link]),
  ];
  const lower = area.toLowerCase().replace(/\s+/g, ' ');
  for (const secret of secrets) {
    const value = String(secret ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (value && lower.includes(value)) return refuse('hosted_table_area_address', 'Write only the area, not the address.');
  }
  return null;
}
