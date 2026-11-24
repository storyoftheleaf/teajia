import { SIT_CREDIT_ROLES, type SitCreditRole } from '../../src/lib/sitCreditContract';
import { FAMILY_PAGE_NOT_HIDDEN_SQL } from './familyPersonTastings';

type Env = { DB: D1Database };
type Auth<E, Scope> = (request: Request, env: E) => Promise<Scope | { error: Response }>;
type Handler<E> = (request: Request, env: E, params: Record<string, string>) => Promise<Response>;

export const publicSitProfile = `(c.is_published = 1 OR (c.unpublished_at IS NULL AND EXISTS (
  SELECT 1 FROM articles ar WHERE ar.author_id = c.id AND ar.status = 'published'
))) AND ${FAMILY_PAGE_NOT_HIDDEN_SQL}`;

export const publishedSitRecap = `
  e.lifecycle_status IN ('completed','archived')
  AND e.recap_status = 'published' AND e.public_visibility = 'public'
  AND a.status = 'active' AND a.public_enabled = 1
  AND EXISTS (SELECT 1 FROM event_post_session ps WHERE ps.account_id = e.account_id AND ps.event_id = e.id)`;

const exactPublicCredit = `
  FROM event_contributors ec
  JOIN contributors c ON c.id = ec.contributor_id
  JOIN events e ON e.id = ec.event_id AND e.account_id = ec.account_id
  JOIN accounts a ON a.id = e.account_id
  LEFT JOIN sit_profile_placements p ON p.account_id = e.account_id AND p.event_id = e.id
    AND p.contributor_id = c.id AND p.role = ec.role
  WHERE ec.is_public = 1 AND ${publicSitProfile} AND ${publishedSitRecap}`;

const roleOrder = `CASE ec.role WHEN 'lead_host' THEN 0 WHEN 'co_host' THEN 1
  WHEN 'guest_host' THEN 2 WHEN 'photographer' THEN 3 ELSE 4 END`;
const listCredits = `SELECT e.slug, e.title, e.event_date, ec.role ${exactPublicCredit}`;
const json = (value: unknown, status = 200) => Response.json(value, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

const formalSessionCardColumns = `
  e.slug, e.title, e.event_date,
  (SELECT session_notes FROM event_post_session ps
    WHERE ps.event_id = e.id AND ps.account_id = e.account_id LIMIT 1) AS writing,
  (SELECT CASE WHEN json_valid(ps.gallery_images) THEN json_extract(ps.gallery_images, '$[0]') END
    FROM event_post_session ps WHERE ps.event_id = e.id AND ps.account_id = e.account_id LIMIT 1) AS gallery_photo,
  (SELECT CASE WHEN json_valid(ps.tea_ledger) THEN
    CASE WHEN json_type(ps.tea_ledger, '$.served_teas') = 'array' THEN json_extract(ps.tea_ledger, '$.served_teas') END
    END FROM event_post_session ps WHERE ps.event_id = e.id AND ps.account_id = e.account_id LIMIT 1) AS served_teas_json,
  (SELECT json_group_array(json_object('id', menu.id, 'name', menu.name, 'type', menu.type))
    FROM (SELECT m.id, COALESCE(NULLIF(trim(m.custom_name), ''), p.product_name) AS name,
      p.type AS type
      FROM event_tea_menu m LEFT JOIN products p ON p.id = m.product_id AND p.account_id = m.account_id
      WHERE m.event_id = e.id AND m.account_id = e.account_id
        AND (m.reveal_date IS NULL OR datetime(m.reveal_date) <= datetime('now'))
      ORDER BY m.brew_order ASC NULLS LAST, m.id LIMIT 3) AS menu
    WHERE menu.name IS NOT NULL) AS teas_json`;

type SessionCardTea = { id: string; name: string; type: string | null };
type SessionCardRow = { slug: string; title: string; event_date: string; writing: string | null;
  gallery_photo: unknown; served_teas_json: string | null; teas_json: string; role?: SitCreditRole; host?: string };
function sessionCards(rows: SessionCardRow[], includeGallery = true) {
  return rows.map(({ writing, gallery_photo, served_teas_json, teas_json, ...row }) => ({
    ...row, writing: writing?.trim().slice(0, 280) ?? '',
    galleryPhoto: includeGallery && typeof gallery_photo === 'string' ? gallery_photo : null,
    teas: served_teas_json === null
      ? JSON.parse(teas_json) as SessionCardTea[]
      : (JSON.parse(served_teas_json) as unknown[]).slice(0, 3).flatMap(tea => {
        if (!tea || typeof tea !== 'object' || !('id' in tea) || !('name' in tea)
          || typeof tea.id !== 'string' || typeof tea.name !== 'string' || !tea.name.trim()) return [];
        return [{ id: tea.id, name: tea.name, type: null }];
      }),
  }));
}

export function publicSitRoutes<E extends Env>(deps: {
  requireUser: Auth<E, { userId: string }>;
  requireEditor: Auth<E, { accountId: string }>;
  /** The full profile card: people, photographs and poured teas (publicSessions.ts). */
  cards?: (env: E, contributor: string) => Promise<unknown[]>;
}): [string, string, Handler<E>][] {
  const fromProfile: Handler<E> = async (request, env, { slug }) => {
    const { DB } = env;
    const cards = new URL(request.url).searchParams.get('view') === 'cards';
    if (cards && deps.cards) return json({ recaps: await deps.cards(env, slug) });
    if (cards) {
      const recaps = await DB.prepare(`SELECT ${formalSessionCardColumns}, ec.role ${exactPublicCredit}
        AND c.id = ? AND p.event_id IS NOT NULL ORDER BY e.event_date DESC, e.id DESC LIMIT 16`)
        .bind(slug).all<SessionCardRow>();
      return json({ recaps: sessionCards(recaps.results) });
    }
    const recaps = await DB.prepare(`${listCredits}
      AND c.id = ? AND p.event_id IS NOT NULL ORDER BY e.event_date DESC, e.id DESC LIMIT 16`,
    ).bind(slug).all();
    return json({ recaps: recaps.results });
  };

  const recent: Handler<E> = async (_request, { DB }) => {
    const recaps = await DB.prepare(
      `SELECT ${formalSessionCardColumns}, a.name AS host
       FROM events e JOIN accounts a ON a.id = e.account_id
       WHERE e.network_discovery = 1 AND ${publishedSitRecap}
       ORDER BY e.event_date DESC, e.id DESC LIMIT 24`,
    ).all<SessionCardRow>();
    return json({ recaps: sessionCards(recaps.results, false) });
  };

  const myProfile: Handler<E> = async (request, env, { slug, eventSlug }) => {
    const actor = await deps.requireUser(request, env);
    if ('error' in actor) return actor.error;
    const { DB } = env;
    if (request.method === 'GET') {
      const recaps = await DB.prepare(
        `SELECT e.slug, e.title, e.event_date, ec.role, p.event_id IS NOT NULL AS shown
         ${exactPublicCredit} AND c.id = ? AND c.user_id = ?
         ORDER BY e.event_date DESC, e.id DESC, ${roleOrder} LIMIT 48`,
      ).bind(slug, actor.userId).all();
      return json({ recaps: recaps.results });
    }

    if (request.method === 'DELETE') {
      await DB.prepare(
        `DELETE FROM sit_profile_placements
         WHERE contributor_id = ? AND EXISTS (SELECT 1 FROM contributors WHERE id = ? AND user_id = ?)
         AND EXISTS (SELECT 1 FROM events WHERE id = sit_profile_placements.event_id
           AND account_id = sit_profile_placements.account_id AND slug = ?)`,
      ).bind(slug, slug, actor.userId, eventSlug).run();
      return json({ shown: false });
    }

    const body = await request.json().catch(() => null) as { role?: unknown } | null;
    if (!SIT_CREDIT_ROLES.includes(body?.role as SitCreditRole)) return json({ error: 'Choose your event credit.' }, 400);
    const result = await DB.prepare(
      `INSERT INTO sit_profile_placements (account_id, event_id, contributor_id, role)
       SELECT e.account_id, e.id, c.id, ec.role ${exactPublicCredit}
       AND c.id = ? AND c.user_id = ? AND e.slug = ? AND ec.role = ?
       ON CONFLICT(event_id, contributor_id) DO UPDATE SET role = excluded.role`,
    ).bind(slug, actor.userId, eventSlug, body?.role).run();
    return result.meta?.changes ? json({ shown: true }) : json({ error: 'This credit is unavailable.' }, 404);
  };

  const editCredits: Handler<E> = async (request, env, { eventId, creditId }) => {
    const editor = await deps.requireEditor(request, env);
    if ('error' in editor) return editor.error;
    const { DB } = env;
    const event = await DB.prepare(
      `SELECT id FROM events WHERE id = ? AND account_id = ? AND lifecycle_status IN ('completed','archived')`,
    ).bind(eventId, editor.accountId).first();
    if (!event) return json({ error: 'Completed sit unavailable.' }, 404);
    if (request.method === 'GET') {
      const [people, credits] = await DB.batch([
        DB.prepare(
          `SELECT c.id, c.display_name FROM contributor_accounts ca JOIN contributors c ON c.id = ca.contributor_id
           WHERE ca.account_id = ? AND ${publicSitProfile} ORDER BY c.display_name, c.id`,
        ).bind(editor.accountId),
        DB.prepare(
          `SELECT ec.id, c.display_name, ec.role
           FROM event_contributors ec JOIN contributors c ON c.id = ec.contributor_id
           WHERE ec.account_id = ? AND ec.event_id = ? AND ec.is_public = 1 ORDER BY ${roleOrder}, c.display_name, ec.id`,
        ).bind(editor.accountId, eventId),
      ]);
      return json({ people: people.results, credits: credits.results });
    }
    if (request.method === 'DELETE') {
      await DB.batch([
        DB.prepare(
          `DELETE FROM sit_profile_placements
           WHERE account_id = ? AND event_id = ? AND EXISTS (
             SELECT 1 FROM event_contributors ec WHERE ec.id = ? AND ec.event_id = sit_profile_placements.event_id
               AND ec.account_id = sit_profile_placements.account_id AND ec.contributor_id = sit_profile_placements.contributor_id
               AND ec.role = sit_profile_placements.role)`,
        ).bind(editor.accountId, eventId, creditId),
        DB.prepare('UPDATE event_contributors SET is_public = 0 WHERE account_id = ? AND event_id = ? AND id = ?')
          .bind(editor.accountId, eventId, creditId),
      ]);
      return json({ removed: true });
    }
    const body = await request.json().catch(() => null) as { contributor?: unknown; role?: unknown; confirmed?: unknown } | null;
    if (typeof body?.contributor !== 'string' || !SIT_CREDIT_ROLES.includes(body.role as SitCreditRole) || body.confirmed !== true) {
      return json({ error: 'Choose a person and role, then confirm their public credit.' }, 400);
    }
    const name = await DB.prepare(
      `INSERT INTO event_contributors (id, account_id, event_id, contributor_id, role, is_public)
       SELECT ?, ca.account_id, e.id, c.id, ?, 1
       FROM contributor_accounts ca JOIN contributors c ON c.id = ca.contributor_id
       JOIN events e ON e.account_id = ca.account_id AND e.id = ? AND e.lifecycle_status IN ('completed','archived')
       WHERE ca.account_id = ? AND c.id = ? AND ${publicSitProfile}
       ON CONFLICT(event_id, contributor_id, role) DO UPDATE SET is_public = 1`,
    ).bind(crypto.randomUUID(), body.role, eventId, editor.accountId, body.contributor).run();
    return name.meta?.changes ? json({ credited: true }) : json({ error: 'This published profile is unavailable in the sit’s shop.' }, 404);
  };

  return [
    ['POST', '/api/public/sit-links/recent', recent],
    ['GET', '/api/public/sit-links/people/:slug', fromProfile],
    ['GET', '/api/me/people/:slug/sit-placements', myProfile],
    ['PUT', '/api/me/people/:slug/sit-placements/:eventSlug', myProfile],
    ['DELETE', '/api/me/people/:slug/sit-placements/:eventSlug', myProfile],
    ['GET', '/api/admin/events/:eventId/recap-credits', editCredits],
    ['POST', '/api/admin/events/:eventId/recap-credits', editCredits],
    ['DELETE', '/api/admin/events/:eventId/recap-credits/:creditId', editCredits],
  ];
}
