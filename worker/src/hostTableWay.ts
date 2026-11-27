// The way to the house, from the host's side (Launch 2, slice H8:
// todo/plans/guests-and-tea-masters-launch-2-run.md, "Sol, H8").
//
// A host walks the way to their house once, a photograph and one line at each
// point that matters, and reuses it for every table there. The guide is
// events.venue_guide, the address and map link are events.address_text and
// events.map_link, and a place kept for next time is a saved_locations row in
// the host's own personal account. Who receives the guide is not decided
// here: sessionWalkthrough.ts gives it to a confirmed seat only, until the
// session ends, while the host's door is open (H7).
//
// Every function takes a table already proven to be the caller's own
// (requireOwnHostedTable in index.ts). A step photograph must be one uploaded
// into this account's venue-guide/ (or venues/) folder, so a guide can never
// point a guest's phone at somewhere else.

import type { OwnHostedTable } from './hostTableGuests';
import { bareWayPhotoUrl, guidePhotoUrls, signWayGuide, WAY_HOST, wayPhotoKey } from './wayMedia';

export const WAY_MAX_STEPS = 20;
export const WAY_STEP_MAX = 280;
export const WAY_NOTE_MAX = 500;
export const WAY_ADDRESS_MAX = 300;
export const WAY_LINK_MAX = 1000;
export const WAY_PLACE_NAME_MAX = 120;
export const WAY_MAX_PLACES = 50;

export type WayStep = { description: string; image_url?: string; /** A short film of the step, uploaded for the way in. */ video_url?: string };
export type WayGuide = {
  steps: WayStep[];
  /** A picture of the tea space itself, shown at the head of the way in. */
  space_image_url?: string;
  parking_notes?: string;
  transit_notes?: string;
  arrival_notes?: string;
  lost_phone?: string;
};
export type TableWay = { address: string | null; map_link: string | null; venue_guide: WayGuide | null; place_id: string | null };
export type WayPlace = { id: string; name: string; address: string | null; map_link: string | null; venue_guide: WayGuide | null };

type Refused = { refused: { status: number; code: string; error: string } };
const refuse = (code: string, error: string, status = 400): Refused => ({ refused: { status, code, error } });

const MEDIA_ORIGIN = 'https://media.teajia.co/';

/** Whether a step photograph is one this account uploaded for the way in. */
export function isOwnWayPhoto(url: string, accountId: string): boolean {
  if (!url.startsWith(MEDIA_ORIGIN)) return false;
  const key = url.slice(MEDIA_ORIGIN.length).split(/[?#]/)[0];
  const prefix = `accounts/${accountId}/`;
  if (!key.startsWith(prefix)) return false;
  const rest = key.slice(prefix.length);
  return /^(?:venue-guide|venues)\/[A-Za-z0-9._-]+$/.test(rest);
}

function parseGuide(value: unknown): WayGuide | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as WayGuide;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.steps)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** The way to this table as it stands, and the host's saved places. */
export async function readTableWay(db: D1Database, table: Pick<OwnHostedTable, 'id' | 'account_id'>) {
  const [row, places] = await Promise.all([
    db.prepare('SELECT address_text, map_link, venue_guide, location_id FROM events WHERE id = ? AND account_id = ?')
      .bind(table.id, table.account_id).first<Record<string, unknown>>(),
    db.prepare(`SELECT id, name, address, map_link, venue_guide FROM saved_locations
                 WHERE account_id = ? ORDER BY name COLLATE NOCASE ASC, id ASC LIMIT ${WAY_MAX_PLACES}`)
      .bind(table.account_id).all<Record<string, unknown>>(),
  ]);
  const way: TableWay = {
    address: text(row?.address_text),
    map_link: text(row?.map_link),
    venue_guide: parseGuide(row?.venue_guide),
    place_id: text(row?.location_id),
  };
  return {
    way,
    places: places.results.map((place): WayPlace => ({
      id: String(place.id),
      name: String(place.name ?? ''),
      address: text(place.address),
      map_link: text(place.map_link),
      venue_guide: parseGuide(place.venue_guide),
    })),
  };
}

function optionalLine(body: Record<string, unknown>, field: string, max: number, words: string): string | null | Refused {
  const value = body[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return refuse('table_way_invalid', `Write ${words} as words.`);
  const trimmed = value.trim();
  if (trimmed.length > max) return refuse('table_way_too_long', `Keep ${words} under ${max} characters.`);
  return trimmed || null;
}

const isRefused = (value: unknown): value is Refused => typeof value === 'object' && value !== null && 'refused' in value;

export type TableWayInput = { address: string | null; map_link: string | null; venue_guide: WayGuide | null };

/** Read the way from a request body. Every part may be left empty. */
export function readTableWayInput(body: Record<string, unknown> | null, accountId: string): TableWayInput | Refused {
  if (!body || typeof body !== 'object') return refuse('table_way_invalid', 'Send the way in.');
  const address = optionalLine(body, 'address', WAY_ADDRESS_MAX, 'the address');
  if (isRefused(address)) return address;
  const mapLink = optionalLine(body, 'map_link', WAY_LINK_MAX, 'the map link');
  if (isRefused(mapLink)) return mapLink;
  if (mapLink && !/^https:\/\/[^\s]+$/i.test(mapLink)) return refuse('table_way_map_link', 'A map link starts with https://.');

  const guideInput = body.venue_guide;
  let guide: WayGuide | null = null;
  if (guideInput !== undefined && guideInput !== null) {
    if (typeof guideInput !== 'object' || Array.isArray(guideInput)) return refuse('table_way_invalid', 'Send the steps as a list.');
    const source = guideInput as Record<string, unknown>;
    const stepsInput = source.steps ?? [];
    if (!Array.isArray(stepsInput)) return refuse('table_way_invalid', 'Send the steps as a list.');
    if (stepsInput.length > WAY_MAX_STEPS) return refuse('table_way_too_many', `A way in has at most ${WAY_MAX_STEPS} steps.`);
    const steps: WayStep[] = [];
    for (const raw of stepsInput) {
      if (!raw || typeof raw !== 'object') return refuse('table_way_invalid', 'Each step is a line and a photograph.');
      const step = raw as Record<string, unknown>;
      const description = step.description === undefined || step.description === null ? '' : step.description;
      if (typeof description !== 'string') return refuse('table_way_invalid', 'Write each step as words.');
      if (description.trim().length > WAY_STEP_MAX) return refuse('table_way_too_long', `Keep each step under ${WAY_STEP_MAX} characters.`);
      const image = step.image_url === undefined || step.image_url === null || step.image_url === '' ? null : step.image_url;
      if (image !== null && (typeof image !== 'string' || !isOwnWayPhoto(image, accountId))) {
        return refuse('table_way_photo', 'Add each photograph through the editor on this page.');
      }
      const film = step.video_url === undefined || step.video_url === null || step.video_url === '' ? null : step.video_url;
      if (film !== null && (typeof film !== 'string' || !isOwnWayPhoto(film, accountId))) {
        return refuse('table_way_photo', 'Add each film through the editor on this page.');
      }
      // A step with neither words nor a photograph nor a film says nothing; leave it out.
      if (!description.trim() && !image && !film) continue;
      // Kept bare: the address handed out is signed per answer (wayMedia.ts).
      steps.push({
        description: description.trim(),
        ...(image ? { image_url: bareWayPhotoUrl(image) } : {}),
        ...(film ? { video_url: bareWayPhotoUrl(film) } : {}),
      });
    }
    const notes: Partial<WayGuide> = {};
    for (const [field, words] of [
      ['parking_notes', 'where to park'], ['transit_notes', 'how to come'],
      ['arrival_notes', 'what to bring or wear'], ['lost_phone', 'the number to call'],
    ] as const) {
      const line = optionalLine(source, field, WAY_NOTE_MAX, words);
      if (isRefused(line)) return line;
      if (line) notes[field] = line;
    }
    const space = source.space_image_url === undefined || source.space_image_url === null || source.space_image_url === '' ? null : source.space_image_url;
    if (space !== null && (typeof space !== 'string' || !isOwnWayPhoto(space, accountId))) {
      return refuse('table_way_photo', 'Add each photograph through the editor on this page.');
    }
    if (space) notes.space_image_url = bareWayPhotoUrl(space);
    if (steps.length || Object.keys(notes).length) guide = { steps, ...notes };
  }
  return { address, map_link: mapLink, venue_guide: guide };
}

/**
 * Any other door that writes a guide (the admin event form, saved places)
 * holds it to the same rule as the host's page: a step photograph is one this
 * account uploaded for the way in, or one the stored guide already names (an
 * older photograph uploaded as a flyer). Photographs are stored bare. Answers
 * the guide to store, as JSON or null.
 */
export function guardGuideWrite(value: unknown, accountId: string, stored: unknown): { venue_guide: string | null } | Refused {
  if (value === undefined || value === null || value === '') return { venue_guide: null };
  let guide: unknown = value;
  if (typeof value === 'string') {
    try { guide = JSON.parse(value); } catch { return refuse('table_way_invalid', 'Send the steps as a list.'); }
  }
  if (guide === null) return { venue_guide: null };
  if (typeof guide !== 'object' || Array.isArray(guide)) return refuse('table_way_invalid', 'Send the steps as a list.');
  const source = guide as Record<string, unknown>;
  const stepsInput = source.steps ?? [];
  if (!Array.isArray(stepsInput)) return refuse('table_way_invalid', 'Send the steps as a list.');
  const kept = guidePhotoUrls(stored);
  const steps: unknown[] = [];
  for (const raw of stepsInput) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return refuse('table_way_invalid', 'Each step is a line and a photograph.');
    const step = { ...(raw as Record<string, unknown>) };
    const image = step.image_url;
    if (image === undefined || image === null || image === '') {
      delete step.image_url;
    } else {
      if (typeof image !== 'string') return refuse('table_way_photo', 'Add each photograph through the editor on this page.');
      const bare = bareWayPhotoUrl(image);
      if (!isOwnWayPhoto(bare, accountId) && !kept.has(bare)) {
        return refuse('table_way_photo', 'Add each photograph through the editor on this page.');
      }
      step.image_url = bare;
    }
    // A film uploaded for the way in is stored bare like a photograph; any
    // other link (a film kept elsewhere) is left as it was written.
    if (typeof step.video_url === 'string' && wayPhotoKey(step.video_url)) {
      const bareFilm = bareWayPhotoUrl(step.video_url);
      if (!isOwnWayPhoto(bareFilm, accountId) && !kept.has(bareFilm)) {
        return refuse('table_way_photo', 'Add each film through the editor on this page.');
      }
      step.video_url = bareFilm;
    }
    steps.push(step);
  }
  const cleaned: Record<string, unknown> = { ...source, steps };
  const space = cleaned.space_image_url;
  if (space === undefined || space === null || space === '') {
    delete cleaned.space_image_url;
  } else {
    if (typeof space !== 'string') return refuse('table_way_photo', 'Add each photograph through the editor on this page.');
    const bare = bareWayPhotoUrl(space);
    if (!isOwnWayPhoto(bare, accountId) && !kept.has(bare)) {
      return refuse('table_way_photo', 'Add each photograph through the editor on this page.');
    }
    cleaned.space_image_url = bare;
  }
  return { venue_guide: JSON.stringify(cleaned) };
}

/** The way and saved places with their step photographs signed for the host. */
export async function signWayForHost<T extends { way: TableWay; places?: WayPlace[] } | { place: WayPlace }>(secret: string | undefined, answer: T): Promise<T> {
  const sign = async <G extends { venue_guide: WayGuide | null }>(item: G): Promise<G> =>
    ({ ...item, venue_guide: item.venue_guide ? await signWayGuide(secret, item.venue_guide, WAY_HOST) : null });
  if ('place' in answer) return { ...answer, place: await sign(answer.place) };
  return {
    ...answer,
    way: await sign(answer.way),
    ...(answer.places ? { places: await Promise.all(answer.places.map(sign)) } : {}),
  };
}

/** Save the way to this table. */
export async function saveTableWay(db: D1Database, table: Pick<OwnHostedTable, 'id' | 'account_id'>, input: TableWayInput) {
  await db.prepare(`UPDATE events SET address_text = ?, map_link = ?, venue_guide = ?, updated_at = datetime('now')
                     WHERE id = ? AND account_id = ?`)
    .bind(input.address, input.map_link, input.venue_guide ? JSON.stringify(input.venue_guide) : null, table.id, table.account_id)
    .run();
}

/**
 * Keep the way to this table as a place for next time, by name. A place of
 * the same name in the host's account is brought up to date; otherwise a new
 * one is made. The table then remembers which place it is.
 */
export async function keepTableWay(db: D1Database, table: Pick<OwnHostedTable, 'id' | 'account_id'>, nameInput: unknown):
  Promise<{ place: WayPlace } | Refused> {
  if (typeof nameInput !== 'string' || !nameInput.trim()) return refuse('table_way_place_name', 'Give the place a name.');
  const name = nameInput.trim();
  if (name.length > WAY_PLACE_NAME_MAX) return refuse('table_way_place_name', `Keep the place's name under ${WAY_PLACE_NAME_MAX} characters.`);
  const { way } = await readTableWay(db, table);
  if (!way.venue_guide?.steps.length) return refuse('table_way_empty', 'Add a step before keeping the way.', 409);
  const guide = JSON.stringify(way.venue_guide);
  const existing = await db.prepare('SELECT id FROM saved_locations WHERE account_id = ? AND lower(name) = lower(?) LIMIT 1')
    .bind(table.account_id, name).first<{ id: string }>();
  let id = existing?.id;
  if (id) {
    await db.prepare(`UPDATE saved_locations SET name = ?, address = ?, map_link = ?, venue_guide = ?, updated_at = datetime('now')
                       WHERE id = ? AND account_id = ?`)
      .bind(name, way.address ?? '', way.map_link, guide, id, table.account_id).run();
  } else {
    const count = await db.prepare('SELECT COUNT(*) AS n FROM saved_locations WHERE account_id = ?')
      .bind(table.account_id).first<{ n: number }>();
    if (Number(count?.n ?? 0) >= WAY_MAX_PLACES) return refuse('table_way_places_full', `You can keep up to ${WAY_MAX_PLACES} places.`, 409);
    id = crypto.randomUUID();
    await db.prepare(`INSERT INTO saved_locations (id, account_id, name, address, map_link, venue_guide)
                      VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, table.account_id, name, way.address ?? '', way.map_link, guide).run();
  }
  await db.prepare(`UPDATE events SET location_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
    .bind(id, table.id, table.account_id).run();
  return { place: { id, name, address: way.address, map_link: way.map_link, venue_guide: way.venue_guide } };
}
