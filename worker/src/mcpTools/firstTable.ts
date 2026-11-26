/**
 * The first table over MCP: the reading and the thank-you of a session.
 *
 * Three tools, the same actions Manage offers a host.
 *
 *  - `set_session_reading` (write, preview then confirm): picks the published
 *    article shown on a session's thank-you, or clears it. The article is
 *    checked by `readableArticleFor`, the same check the event update route
 *    and the guest page use, so a draft or another shop's article is refused
 *    here exactly as it is there. The check runs at preview and again at
 *    confirm, because an article may be unpublished between the two.
 *  - `get_session_thanks` (read): what a guest's thank-you shows for a
 *    session, in the same shape as the after-sit recap body. It leaves out
 *    everything that belongs to a guest or to a link: no credential, no
 *    `thanks_ref`, no seat, no attendee, no kept-tea flag.
 *  - `list_readings` (read): the published articles a reading can be chosen
 *    from.
 *
 * Scopes follow events.ts: the reads take `inventory:read`, the write takes
 * `catalog:write` (it changes what a public page shows). Every query is bound
 * to the caller's account, so another shop's session is "not found".
 *
 * Tea paths are the page a poured tea opens. They come from `servedTeasOf`,
 * the function the recap uses. It needs a public product reader, which the
 * worker builds in index.ts from the shop catalogue and this module cannot
 * import; `publicTeaReader` below answers the one question the path needs
 * (is this a public product of an open shop) and carries no price fields, so
 * no price or offer can leak through this tool.
 */
import { readableArticleFor } from '../eventDomain';
import { servedTeasOf } from '../publicSessions';
import { sessionServedTeas } from '../sessionServedTeas';
import type { PublicProductReader } from '../sessionTeas';
import type { ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { INVALID_TICKET as expiredTicket, consumeTicket, issueTicket, previewEnvelope } from './tickets';

type ReadingMutation = {
  kind: 'set_session_reading'; accountId: string; userEmail: string;
  eventId: string; eventTitle: string; articleId: string | null; articleTitle: string | null;
};

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

type SessionRow = { id: string; account_id: string; title: string; event_date: string; reading_article_id: string | null };

async function loadSession(env: ToolEnv, accountId: string, eventId: string) {
  return env.DB.prepare(
    `SELECT id, account_id, title, event_date, reading_article_id FROM events WHERE id = ? AND account_id = ?`,
  ).bind(eventId, accountId).first<SessionRow>();
}

/** A public product of an open shop, with no price: enough for a tea's path and nothing more. */
function publicTeaReader(env: ToolEnv): PublicProductReader {
  return async (accountId, productId) => await env.DB.prepare(
    `SELECT p.id, p.slug, p.status FROM products p
       JOIN accounts a ON a.id = p.account_id AND a.status = 'active' AND a.public_enabled = 1
      WHERE p.account_id = ? AND (p.id = ? OR p.slug = ?) AND p.is_public = 1 AND p.shown_in_shop = 1
        AND p.status IN ('Active', 'Sold Out') AND p.personal_offer_withdrawn_at IS NULL`,
  ).bind(accountId, productId, productId).first<Record<string, unknown>>() ?? null;
}

const eventIdOf = (args: { event_id?: unknown }) => {
  const id = text(args?.event_id);
  if (!id) throw new Error('event_id is required');
  return id;
};

const setSessionReading: ToolHandler = async (env, auth, args) => {
  const confirm = text(args?.confirm);
  const eventId = eventIdOf(args);
  const session = await loadSession(env, auth.accountId, eventId);
  if (!session) return { error: 'event_not_found' };

  if (!confirm) {
    if (args?.article_id === undefined) throw new Error('article_id is required: an article id, or null for no reading');
    const articleId = args.article_id === null ? null : text(args.article_id);
    if (args.article_id !== null && !articleId) throw new Error('article_id must be an article id, or null for no reading');
    let article: { id: string; title: string } | null = null;
    if (articleId) {
      article = await readableArticleFor(env.DB, auth.accountId, articleId);
      if (!article) {
        return { error: 'article_not_readable', message: 'That article is not published in this shop, so it cannot be a reading. Use list_readings to see the ones that can.' };
      }
    }
    const current = session.reading_article_id
      ? await readableArticleFor(env.DB, auth.accountId, session.reading_article_id) : null;
    const token = await issueTicket<ReadingMutation>(env, {
      kind: 'set_session_reading', accountId: auth.accountId, userEmail: auth.userEmail,
      eventId: session.id, eventTitle: session.title,
      articleId: article?.id ?? null, articleTitle: article?.title ?? null,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'set_session_reading',
      session: { id: session.id, title: session.title, event_date: session.event_date },
      reading: article ? { id: article.id, title: article.title } : 'no reading',
      current_reading: current ? { id: current.id, title: current.title } : 'no reading',
      effect: article
        ? `Guests of "${session.title}" will see "${article.title}" on their thank-you.`
        : `"${session.title}" will have no reading on its thank-you.`,
    }, token);
  }

  const pending = await consumeTicket<ReadingMutation, 'set_session_reading'>(env, confirm, 'set_session_reading', auth);
  if (!pending || pending.eventId !== session.id) return expiredTicket;
  if (pending.articleId && !await readableArticleFor(env.DB, pending.accountId, pending.articleId)) {
    return { error: 'article_not_readable', message: 'That article is no longer published, so nothing was written. Pick another with list_readings.' };
  }
  const result = await env.DB.prepare(
    `UPDATE events SET reading_article_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?`,
  ).bind(pending.articleId, pending.eventId, pending.accountId).run();
  if (Number(result.meta?.changes || 0) === 0) return { error: 'event_not_found' };
  await env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), 'event_reading_set',
    pending.articleId
      ? `Set the reading of "${pending.eventTitle}" to "${pending.articleTitle}" via MCP`
      : `Cleared the reading of "${pending.eventTitle}" via MCP`,
    pending.userEmail, 'event', pending.eventId, pending.accountId).run();
  return { committed: true, action: 'set_session_reading', event_id: pending.eventId, article_id: pending.articleId };
};

const getSessionThanks: ToolHandler = async (env, auth, args) => {
  const eventId = eventIdOf(args);
  const row = await env.DB.prepare(
    `SELECT e.id, e.account_id, e.title, e.event_date, e.reading_article_id,
        (SELECT s.session_notes FROM event_attendee_recaps s WHERE s.event_id = e.id AND s.account_id = e.account_id) AS host_note,
        COALESCE(NULLIF(trim(ps.playlist_url), ''), NULLIF(trim(e.playlist_url), '')) AS playlist_url,
        (SELECT json_group_array(json_object('id', tea.id, 'name', tea.name))
           FROM (${sessionServedTeas('e.account_id', 'e.id')}) AS tea) AS teas_json
       FROM events e
       LEFT JOIN event_post_session ps ON ps.event_id = e.id AND ps.account_id = e.account_id
      WHERE e.id = ? AND e.account_id = ?`,
  ).bind(eventId, auth.accountId).first<{
    id: string; account_id: string; title: string; event_date: string; reading_article_id: string | null;
    host_note: string | null; playlist_url: string | null; teas_json: string | null;
  }>();
  if (!row) return { error: 'event_not_found' };

  let named: { id: string; name: string }[] = [];
  try { named = JSON.parse(row.teas_json ?? '[]'); } catch { named = []; }
  const resolved = await servedTeasOf(env.DB, publicTeaReader(env), { id: row.id, account_id: row.account_id });
  const paths = new Map(resolved.map(tea => [tea.id, 'href' in tea ? tea.href ?? null : null]));
  const reading = row.reading_article_id ? await readableArticleFor(env.DB, row.account_id, row.reading_article_id) : null;
  return {
    event: { id: row.id, title: row.title, event_date: row.event_date },
    host_note: row.host_note,
    teas: named.map(tea => ({ id: tea.id, name: tea.name, path: paths.get(tea.id) ?? null })),
    playlist_url: row.playlist_url ?? null,
    reading: reading ? { slug: reading.slug, title: reading.title } : null,
  };
};

const listReadings: ToolHandler = async (env, auth) => {
  const { results } = await env.DB.prepare(
    `SELECT id, slug, title FROM articles WHERE account_id = ? AND status = 'published'
      ORDER BY datetime(published_at) DESC, title LIMIT 200`,
  ).bind(auth.accountId).all<{ id: string; slug: string; title: string }>();
  return { readings: results.map((row: { id: string; slug: string; title: string }) => ({ id: row.id, slug: row.slug, title: row.title })), count: results.length };
};

const defs: ToolDefinition[] = [
  {
    name: 'set_session_reading',
    scope: 'catalog:write',
    description: 'Pick the published article shown as the reading on a session\'s guest thank-you, or clear it with article_id null. A draft or another shop\'s article is refused; list_readings names the ones that can be chosen. Two-step preview/confirm; the preview shows the session title and the article title (or "no reading").',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'string', description: 'Session id from list_events.' },
        article_id: { type: ['string', 'null'], description: 'A published article id from list_readings, or null for no reading.' },
        confirm: { type: 'string', description: 'Confirmation token from the preview.' },
      },
      required: ['event_id'],
    },
  },
  {
    name: 'get_session_thanks',
    scope: 'inventory:read',
    description: 'What a guest\'s thank-you shows for a session: title, date, the host\'s note, the poured teas with the page each opens, the playlist and the reading. Read only. It never returns a guest\'s link or any secret.',
    inputSchema: {
      type: 'object',
      properties: { event_id: { type: 'string', description: 'Session id from list_events.' } },
      required: ['event_id'],
    },
  },
  {
    name: 'list_readings',
    scope: 'inventory:read',
    description: 'The published articles that can be a session\'s reading: id, slug and title. Read only.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export const firstTableToolModule: ToolModule = {
  area: 'first_table',
  defs,
  handlers: {
    set_session_reading: setSessionReading,
    get_session_thanks: getSessionThanks,
    list_readings: listReadings,
  },
};

export default firstTableToolModule;
