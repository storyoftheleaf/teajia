/**
 * Tea houses as Adrian's portfolio (Launch 4, K5 part two; the run sheet's
 * "Tea Houses as a portfolio (Adrian, 2026-11-26)"). "They are not just like
 * tea house facts. They are portfolio in what I contributed in them."
 *
 * Two tables (migration 0138): tea_house_pages, one row per house he has said
 * something about (his order of the houses, by hand, and whether its page is
 * shown), and tea_house_contributions, one row per part he did there (the
 * room and its layout, the teaware, the tea menu, training those who pour, the
 * opening sessions, the sourcing since) in his words, with photographs.
 *
 * Who writes: the platform owner alone, read from the database, never from the
 * token. Both tables belong to the platform owner's account (account_id).
 *
 * Who reads: anyone, only while the portfolio is open (TEA_HOUSES_OPEN), and
 * only a house whose page he marked shown, whose own account is public and
 * active, and which has at least one part in his words. A part with no row is
 * not shown, and nothing is written for him: a house with no words is in
 * Visit only. No answer carries a count, a score or a ranking; Work is in his
 * order and no other.
 */
import { teaHousesOpen } from '../../src/lib/teaHouses';
import {
  TEA_HOUSE_PARTS, TEA_HOUSE_PART_PHOTOS, TEA_HOUSE_WORDS_MAX, isTeaHousePart, teaHousePlace,
  type TeaHouseBuild, type TeaHouseContribution, type TeaHouseManage, type TeaHouseManageItem,
  type TeaHousePage, type TeaHousePart, type TeaHouseSummary, type TeaHouseWork,
} from '../../src/lib/teaHousesContract';

export type TeaHousesEnv = { DB: D1Database; TEA_HOUSES_OPEN?: string };
type Person = { userId: string };
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;
export interface TeaHousesDeps<E> {
  requireAuthenticatedUser(request: Request, env: E): Promise<Person | { error: Response }>;
}

const MEDIA_PREFIX = 'https://media.teajia.co/';
const MOST_HOUSES = 200;

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const privateJson = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
const refuse = (status: number, error: string, code: string) => privateJson({ error, code }, status);
const notFound = () => refuse(404, 'Not found', 'not_found');
const closed = () => Response.json({ error: 'Not found' }, { status: 404 });

/** The platform owner's account: the one the portfolio belongs to. */
const OWNER_ACCOUNT_SQL = `SELECT id FROM accounts WHERE is_platform_owner = 1`;

/** A house whose portfolio may be read. Needs hp (tea_house_pages) and a (accounts, the house). */
const SHOWN_HOUSE = `
  hp.is_shown = 1 AND hp.account_id IN (${OWNER_ACCOUNT_SQL})
  AND a.status = 'active' AND a.public_enabled = 1
  AND EXISTS (
    SELECT 1 FROM tea_house_contributions c
     WHERE c.house_account_id = hp.house_account_id AND c.account_id = hp.account_id AND trim(c.words) <> ''
  )`;

type HouseRow = {
  id: string; slug: string; name: string; location_city: string | null; location_country: string | null;
  cover_image_url: string | null;
};
type PartRow = { house_account_id: string; part: string; words: string; photographs: string | null };

function photographsOf(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((url): url is string => typeof url === 'string' && url.startsWith(MEDIA_PREFIX)) : [];
  } catch {
    return [];
  }
}

const partIndex = (part: string) => (TEA_HOUSE_PARTS as readonly string[]).indexOf(part);

function contributionsOf(rows: PartRow[]): TeaHouseContribution[] {
  return rows
    .filter(row => isTeaHousePart(row.part) && row.words.trim())
    .sort((a, b) => partIndex(a.part) - partIndex(b.part))
    .map(row => ({ part: row.part as TeaHousePart, words: row.words.trim(), photographs: photographsOf(row.photographs) }));
}

const summaryOf = (row: HouseRow): TeaHouseSummary => ({
  slug: row.slug, name: row.name, place: teaHousePlace(row.location_city, row.location_country),
});

/** The shown houses in his order, each with its parts. */
async function readShown(db: D1Database, slug?: string): Promise<Array<{ house: HouseRow; parts: TeaHouseContribution[] }>> {
  const { results } = await db.prepare(
    `WITH shown AS (
       SELECT a.id, a.slug, a.name, a.location_city, a.location_country, a.cover_image_url,
              hp.account_id, hp.position
         FROM tea_house_pages hp JOIN accounts a ON a.id = hp.house_account_id
        WHERE ${SHOWN_HOUSE} ${slug ? 'AND a.slug = ?' : ''}
        ORDER BY hp.position, a.name, a.id
        LIMIT ${MOST_HOUSES}
     )
     SELECT shown.*, c.house_account_id, c.part, c.words, c.photographs
       FROM shown JOIN tea_house_contributions c
         ON c.house_account_id = shown.id AND c.account_id = shown.account_id
      ORDER BY shown.position, shown.name, shown.id`,
  ).bind(...(slug ? [slug] : [])).all<HouseRow & PartRow>();
  const byHouse = new Map<string, { house: HouseRow; parts: PartRow[] }>();
  for (const row of results ?? []) {
    const entry = byHouse.get(row.id);
    if (entry) entry.parts.push(row);
    else byHouse.set(row.id, { house: row, parts: [row] });
  }
  return [...byHouse.values()].flatMap(({ house, parts }) => {
    const visibleParts = contributionsOf(parts);
    return visibleParts.length ? [{ house, parts: visibleParts }] : [];
  });
}

/** Whether this person is the platform owner, read from the database, never from the token. */
async function isPlatformOwner(db: D1Database, userId: string): Promise<boolean> {
  const row = await db.prepare('SELECT platform_role FROM users WHERE id = ?').bind(userId).first<{ platform_role: string | null }>();
  return row?.platform_role === 'platform_owner';
}

async function ownerAccount(db: D1Database): Promise<string | null> {
  const row = await db.prepare(`${OWNER_ACCOUNT_SQL} ORDER BY created_at ASC, id ASC LIMIT 1`).first<{ id: string }>();
  return row?.id ?? null;
}

async function readManage(db: D1Database, accountId: string): Promise<TeaHouseManage> {
  const [houses, pages, parts] = await Promise.all([
    db.prepare(
      `SELECT a.id, a.slug, a.name, a.location_city, a.location_country, a.public_enabled, a.status
         FROM accounts a
        WHERE (a.status = 'active' AND a.kind = 'location')
           OR a.id IN (SELECT house_account_id FROM tea_house_pages WHERE account_id = ?)
        LIMIT ${MOST_HOUSES}`,
    ).bind(accountId).all<HouseRow & { public_enabled: number | null; status: string | null }>(),
    db.prepare('SELECT house_account_id, position, is_shown FROM tea_house_pages WHERE account_id = ?')
      .bind(accountId).all<{ house_account_id: string; position: number; is_shown: number }>(),
    db.prepare('SELECT house_account_id, part, words, photographs FROM tea_house_contributions WHERE account_id = ?')
      .bind(accountId).all<PartRow>(),
  ]);
  const pageOf = new Map((pages.results ?? []).map(row => [row.house_account_id, row]));
  const partsOf = new Map<string, PartRow[]>();
  for (const row of parts.results ?? []) partsOf.set(row.house_account_id, [...(partsOf.get(row.house_account_id) ?? []), row]);
  const items: TeaHouseManageItem[] = (houses.results ?? []).map(house => {
    const page = pageOf.get(house.id);
    return {
      id: house.id,
      slug: house.slug,
      name: house.name,
      place: teaHousePlace(house.location_city, house.location_country),
      is_public: house.status === 'active' && Number(house.public_enabled) === 1,
      page: page ? { position: page.position, shown: page.is_shown === 1 } : null,
      parts: contributionsOf(partsOf.get(house.id) ?? []),
    };
  });
  // His houses first, in his order; then every other house by name.
  items.sort((a, b) => {
    if (a.page && b.page) return a.page.position - b.page.position || a.name.localeCompare(b.name);
    if (a.page) return -1;
    if (b.page) return 1;
    return a.name.localeCompare(b.name);
  });
  return { houses: items };
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

// ── Routes ──────────────────────────────────────────────────────────────────

export function teaHousesRoutes<E extends TeaHousesEnv>(deps: TeaHousesDeps<E>): [string, string, Handler<E>][] {
  /** The platform owner and the account the portfolio belongs to. Available while the portfolio is open. */
  const platformOwner = async (request: Request, env: E): Promise<(Person & { accountId: string }) | { error: Response }> => {
    if (!teaHousesOpen(env)) return { error: closed() };
    const person = await deps.requireAuthenticatedUser(request, env);
    if ('error' in person) return person;
    if (!(await isPlatformOwner(env.DB, person.userId))) return { error: refuse(403, 'Platform owner access required', 'platform_owner_only') };
    const accountId = await ownerAccount(env.DB);
    if (!accountId) return { error: refuse(409, 'There is no platform account to keep this in.', 'no_platform_account') };
    return { userId: person.userId, accountId };
  };

  /** A house he may write about: an account that exists. */
  const houseFor = async (env: E, houseId: string) => env.DB.prepare('SELECT id FROM accounts WHERE id = ?')
    .bind(houseId).first<{ id: string }>();

  /** The page row for a house, made at the end of his order the first time he writes about it. */
  const ensurePage = async (env: E, accountId: string, houseId: string, userId: string) => {
    await env.DB.prepare(
      `INSERT INTO tea_house_pages (house_account_id, account_id, position, is_shown, created_by)
       VALUES (?, ?, COALESCE((SELECT MAX(position) + 1 FROM tea_house_pages WHERE account_id = ?), 0), 0, ?)
       ON CONFLICT (house_account_id) DO NOTHING`,
    ).bind(houseId, accountId, accountId, userId).run();
  };

  // GET /api/tea-houses/work: the shown houses, in his order. The same for everyone.
  const work: Handler<E> = async (_request, env) => {
    if (!teaHousesOpen(env)) return closed();
    const shown = await readShown(env.DB);
    const body: TeaHouseWork = {
      houses: shown.map(({ house, parts }) => ({
        ...summaryOf(house),
        photograph: parts.flatMap(part => part.photographs)[0] ?? house.cover_image_url ?? null,
      })),
    };
    return json(body);
  };

  // GET /api/tea-houses/work/:slug: one house's page, his parts in his words.
  const page: Handler<E> = async (_request, env, params) => {
    if (!teaHousesOpen(env)) return closed();
    const [found] = await readShown(env.DB, params.slug);
    if (!found) return notFound();
    const body: TeaHousePage = { house: summaryOf(found.house), parts: found.parts };
    return json(body);
  };

  // GET /api/tea-houses/build: each part he has done, pointing at the houses where he did it.
  const build: Handler<E> = async (_request, env) => {
    if (!teaHousesOpen(env)) return closed();
    const shown = await readShown(env.DB);
    const body: TeaHouseBuild = {
      parts: TEA_HOUSE_PARTS
        .map(part => ({ part, houses: shown.filter(item => item.parts.some(p => p.part === part)).map(item => summaryOf(item.house)) }))
        .filter(entry => entry.houses.length > 0),
    };
    return json(body);
  };

  // GET /api/admin/tea-houses: every house, with what he has said about each.
  const manage: Handler<E> = async (request, env) => {
    const owner = await platformOwner(request, env);
    if ('error' in owner) return owner.error;
    return privateJson(await readManage(env.DB, owner.accountId));
  };

  // PUT /api/admin/tea-houses/:houseId/parts/:part { words, photographs }; DELETE takes the part off.
  const part: Handler<E> = async (request, env, params) => {
    const owner = await platformOwner(request, env);
    if ('error' in owner) return owner.error;
    if (!isTeaHousePart(params.part)) return refuse(400, 'Unknown part.', 'validation_failed');
    if (!(await houseFor(env, params.houseId))) return notFound();
    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM tea_house_contributions WHERE house_account_id = ? AND part = ? AND account_id = ?')
        .bind(params.houseId, params.part, owner.accountId).run();
      // A page with nothing left to say is not shown.
      await env.DB.prepare(
        `UPDATE tea_house_pages SET is_shown = 0, updated_at = datetime('now')
          WHERE house_account_id = ? AND account_id = ?
            AND NOT EXISTS (SELECT 1 FROM tea_house_contributions WHERE house_account_id = ? AND account_id = ?)`,
      ).bind(params.houseId, owner.accountId, params.houseId, owner.accountId).run();
      return privateJson(await readManage(env.DB, owner.accountId));
    }
    const body = await readBody(request);
    if (!body) return refuse(400, 'Expected JSON.', 'validation_failed');
    const words = typeof body.words === 'string' ? body.words.trim() : '';
    if (!words) return refuse(400, 'Say in a sentence or two what you did here.', 'words_required');
    if (words.length > TEA_HOUSE_WORDS_MAX) return refuse(400, 'That is longer than a part needs.', 'words_too_long');
    const photographs = Array.isArray(body.photographs) ? body.photographs : [];
    if (photographs.length > TEA_HOUSE_PART_PHOTOS) return refuse(400, `At most ${TEA_HOUSE_PART_PHOTOS} photographs on one part.`, 'too_many_photographs');
    if (!photographs.every(url => typeof url === 'string' && url.startsWith(MEDIA_PREFIX) && url.length <= 500)) {
      return refuse(400, 'A photograph must be one uploaded to Teajia.', 'validation_failed');
    }
    await ensurePage(env, owner.accountId, params.houseId, owner.userId);
    await env.DB.prepare(
      `INSERT INTO tea_house_contributions (id, account_id, house_account_id, part, words, photographs, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (house_account_id, part) DO UPDATE SET
         words = excluded.words, photographs = excluded.photographs, updated_at = datetime('now')
       WHERE tea_house_contributions.account_id = excluded.account_id`,
    ).bind(crypto.randomUUID(), owner.accountId, params.houseId, params.part, words, JSON.stringify(photographs), owner.userId).run();
    return privateJson(await readManage(env.DB, owner.accountId));
  };

  // PUT /api/admin/tea-houses/:houseId/page { shown }: show or keep back a house's page.
  const show: Handler<E> = async (request, env, params) => {
    const owner = await platformOwner(request, env);
    if ('error' in owner) return owner.error;
    const body = await readBody(request);
    if (!body || typeof body.shown !== 'boolean') return refuse(400, 'Say whether the page is shown.', 'validation_failed');
    const page = await env.DB.prepare('SELECT house_account_id FROM tea_house_pages WHERE house_account_id = ? AND account_id = ?')
      .bind(params.houseId, owner.accountId).first();
    if (!page) return notFound();
    if (body.shown) {
      const said = await env.DB.prepare(
        `SELECT 1 AS said FROM tea_house_contributions WHERE house_account_id = ? AND account_id = ? AND trim(words) <> '' LIMIT 1`,
      ).bind(params.houseId, owner.accountId).first();
      if (!said) return refuse(409, 'Say what you did in this house before its page is shown.', 'nothing_said');
    }
    await env.DB.prepare(`UPDATE tea_house_pages SET is_shown = ?, updated_at = datetime('now') WHERE house_account_id = ? AND account_id = ?`)
      .bind(body.shown ? 1 : 0, params.houseId, owner.accountId).run();
    return privateJson(await readManage(env.DB, owner.accountId));
  };

  // PUT /api/admin/tea-houses/order { houses: [id, ...] }: his order, by hand. Houses left out keep theirs, after these.
  const order: Handler<E> = async (request, env) => {
    const owner = await platformOwner(request, env);
    if ('error' in owner) return owner.error;
    const body = await readBody(request);
    const ids = body && Array.isArray(body.houses) ? body.houses : null;
    if (!ids || !ids.every(id => typeof id === 'string') || new Set(ids).size !== ids.length) {
      return refuse(400, 'Give the houses in order.', 'validation_failed');
    }
    const pages = await env.DB.prepare('SELECT house_account_id FROM tea_house_pages WHERE account_id = ? ORDER BY position ASC, house_account_id ASC')
      .bind(owner.accountId).all<{ house_account_id: string }>();
    const known = (pages.results ?? []).map(row => row.house_account_id);
    if (!(ids as string[]).every(id => known.includes(id))) return refuse(400, 'Only houses you have written about can be ordered.', 'validation_failed');
    const next = [...(ids as string[]), ...known.filter(id => !(ids as string[]).includes(id))];
    await env.DB.batch(next.map((id, position) => env.DB.prepare(
      `UPDATE tea_house_pages SET position = ?, updated_at = datetime('now') WHERE house_account_id = ? AND account_id = ?`,
    ).bind(position, id, owner.accountId)));
    return privateJson(await readManage(env.DB, owner.accountId));
  };

  return [
    ['GET', '/api/tea-houses/work', work],
    ['GET', '/api/tea-houses/work/:slug', page],
    ['GET', '/api/tea-houses/build', build],
    ['GET', '/api/admin/tea-houses', manage],
    ['PUT', '/api/admin/tea-houses/order', order],
    ['PUT', '/api/admin/tea-houses/:houseId/page', show],
    ['PUT', '/api/admin/tea-houses/:houseId/parts/:part', part],
    ['DELETE', '/api/admin/tea-houses/:houseId/parts/:part', part],
  ];
}
