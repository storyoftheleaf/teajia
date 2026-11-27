/**
 * The shop's other records, for agents: the places sessions are held
 * (venues and their spaces), the teaware collection, and the contributors whose
 * pages the Read section carries. Reads use the same SELECTs as the Manage
 * routes (/api/admin/venues, /api/admin/teaware, /api/admin/contributors).
 * `save_venue` adds or corrects a place with the columns the route's own
 * INSERT writes, previewed first.
 */
import type { ToolAuth, ToolDefinition, ToolEnv, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope, type TicketPayload } from './tickets';

const VENUE_FIELDS = ['name', 'address', 'map_link', 'area_hint', 'arrival_notes', 'website', 'instagram'] as const;
type VenueFields = Partial<Record<typeof VENUE_FIELDS[number], string | null>>;

interface SaveVenueTicket extends TicketPayload {
  kind: 'save_venue';
  venueId: string | null;
  fields: VenueFields;
  before: VenueFields | null;
}

const ownerTier = (_env: ToolEnv, auth: ToolAuth) => auth.creatorTier === 'account_owner' || auth.creatorTier === 'platform_owner';

async function listVenues(env: ToolEnv, auth: ToolAuth) {
  const venues = await env.DB.prepare('SELECT * FROM venues WHERE account_id = ? ORDER BY name ASC').bind(auth.accountId).all<Record<string, any>>();
  const spaces = await env.DB.prepare('SELECT * FROM venue_spaces WHERE account_id = ? ORDER BY venue_id, sort_order ASC, name ASC')
    .bind(auth.accountId).all<Record<string, any>>().catch(() => ({ results: [] as Array<Record<string, any>> }));
  const byVenue = new Map<string, Array<Record<string, any>>>();
  for (const s of spaces.results ?? []) byVenue.set(s.venue_id, [...(byVenue.get(s.venue_id) ?? []), s]);
  return {
    venues: (venues.results ?? []).map(v => ({ ...v, spaces: byVenue.get(v.id) ?? [] })),
    note: 'The address is shown to a guest only once they are approved; area_hint is what they see before.',
  };
}

async function saveVenue(env: ToolEnv, auth: ToolAuth, args: any) {
  const confirm = typeof args?.confirm === 'string' ? args.confirm.trim() : '';
  if (confirm) {
    const t = await consumeTicket<SaveVenueTicket, 'save_venue'>(env, confirm, 'save_venue', auth);
    if (!t) return INVALID_TICKET;
    if (t.venueId) {
      const cols = Object.keys(t.fields) as Array<keyof VenueFields>;
      const pin = cols.map(c => `COALESCE(${c}, '') = ?`).join(' AND ');
      const res = await env.DB.prepare(
        `UPDATE venues SET ${cols.map(c => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ? AND account_id = ? AND ${pin}`,
      ).bind(...cols.map(c => t.fields[c] ?? null), t.venueId, auth.accountId, ...cols.map(c => t.before?.[c] ?? '')).run();
      if (!res.meta?.changes) return { error: 'venue_changed', message: 'The place changed since the preview. Read it again with list_venues.' };
      return { committed: true, venue_id: t.venueId };
    }
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO venues (id, account_id, name, address, map_link, area_hint, arrival_notes, website, instagram, photos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
    ).bind(id, auth.accountId, t.fields.name, t.fields.address, t.fields.map_link ?? null, t.fields.area_hint ?? null,
      t.fields.arrival_notes ?? null, t.fields.website ?? null, t.fields.instagram ?? null).run();
    return { committed: true, venue_id: id };
  }

  const venueId = typeof args?.venue_id === 'string' && args.venue_id.trim() ? args.venue_id.trim() : null;
  const fields: VenueFields = {};
  for (const f of VENUE_FIELDS) {
    if (args?.[f] === null) fields[f] = null;
    else if (typeof args?.[f] === 'string') fields[f] = args[f].trim().slice(0, f === 'arrival_notes' ? 2000 : 500) || null;
  }
  if (!Object.keys(fields).length) return { error: 'nothing_to_save' };
  let before: VenueFields | null = null;
  if (venueId) {
    const row = await env.DB.prepare(`SELECT ${VENUE_FIELDS.join(', ')} FROM venues WHERE id = ? AND account_id = ?`).bind(venueId, auth.accountId).first<Record<string, any>>();
    if (!row) return { error: 'not_found', message: 'No place with that id in this shop.' };
    if (('name' in fields && !fields.name) || ('address' in fields && !fields.address)) return { error: 'name_and_address_stay', message: 'A place keeps a name and an address.' };
    before = Object.fromEntries(Object.keys(fields).map(k => [k, row[k] ?? null])) as VenueFields;
  } else if (!fields.name || !fields.address) {
    return { error: 'name_and_address_required', message: 'A new place needs a name and an address. Use the real address you were given; never guess one.' };
  }
  const token = await issueTicket<SaveVenueTicket>(env, { kind: 'save_venue', accountId: auth.accountId, venueId, fields, before }, auth.tokenId);
  return previewEnvelope({
    action: 'save_venue',
    read_back: venueId ? `Change ${Object.keys(fields).join(', ')} on this place.` : `Add the place "${fields.name}" at ${fields.address}.`,
    before,
    after: fields,
  }, token);
}

async function listTeaware(env: ToolEnv, auth: ToolAuth, args: any) {
  const category = typeof args?.category === 'string' && args.category.trim() ? args.category.trim() : null;
  const { results } = await env.DB.prepare(
    `SELECT * FROM teaware_collection WHERE account_id = ? ${category ? 'AND category = ?' : ''} ORDER BY name LIMIT 200`,
  ).bind(auth.accountId, ...(category ? [category] : [])).all<Record<string, any>>();
  return { teaware: results ?? [], count: (results ?? []).length };
}

async function listContributors(env: ToolEnv, auth: ToolAuth) {
  const { results } = await env.DB.prepare(
    `SELECT co.id, co.display_name, co.chinese_name, co.role, co.location_line, co.active_since, co.account_id
       FROM contributors co
      WHERE co.account_id = ? OR EXISTS (
        SELECT 1 FROM contributor_accounts ca WHERE ca.contributor_id = co.id AND ca.account_id = ?)
      ORDER BY co.display_name`,
  ).bind(auth.accountId, auth.accountId).all<Record<string, any>>();
  return { contributors: results ?? [], count: (results ?? []).length, note: 'Names and roles only; contact details stay in Manage.' };
}

const defs: ToolDefinition[] = [
  {
    name: 'list_venues',
    scope: 'inventory:read',
    description: 'The places this shop holds sessions, with their spaces, address, the area guests see before approval, and arrival notes.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'save_venue',
    scope: 'stock:write',
    description: 'Add a place to hold sessions (name and the real address are required; never guess an address), or correct one by venue_id. Two-step: preview, then confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        venue_id: { type: 'string', description: 'Leave out to add a new place.' },
        name: { type: 'string' },
        address: { type: 'string' },
        map_link: { type: ['string', 'null'] },
        area_hint: { type: ['string', 'null'], description: 'What a guest sees before approval, e.g. "Da\'an District".' },
        arrival_notes: { type: ['string', 'null'] },
        website: { type: ['string', 'null'] },
        instagram: { type: ['string', 'null'] },
        confirm: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_teaware',
    scope: 'inventory:read',
    description: 'The shop\'s teaware collection: each piece, its category, material, maker, capacity and condition.',
    inputSchema: { type: 'object', properties: { category: { type: 'string' } }, additionalProperties: false },
  },
  {
    name: 'list_contributors',
    scope: 'customers:read',
    available: ownerTier,
    description: 'The people with a contributor page in Read: names, roles and where they are. For the shop owner.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

export const shopRecordTools: ToolModule = {
  area: 'shop-records',
  defs,
  handlers: { list_venues: listVenues, save_venue: saveVenue, list_teaware: listTeaware, list_contributors: listContributors },
};
