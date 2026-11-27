/**
 * The host's and Adrian's page actions that had no tool (review A11-10 and
 * A11-11, todo/review/findings/A11.md).
 *
 * Each tool here is the page's own route, called as the person the token
 * belongs to, through `env.pageRoutes` (handed in by index.ts, which owns the
 * route table; importing it here would be a cycle). So a tool keeps exactly
 * the page's rules: its switch, its ownership check, a stopped host's limits,
 * its validation and its rate limits. Nothing in this file decides who may do
 * what; it only says which route a tool is, what the preview shows, and what
 * an agent is told back.
 *
 * Every write previews first. The preview reads what the page would read (the
 * table, the guest book, the offer) and refuses what the page would refuse;
 * the route call it would make is kept in the ticket from tickets.ts, and is
 * made only on confirm, where the route checks everything again.
 *
 * Each tool is also listed only while the switch of the page it mirrors is
 * open, so a closed feature names no tool.
 */
import { anyoneHostsOpen } from '../../../src/lib/anyoneHosts';
import { circlesOpen } from '../../../src/lib/circles';
import { fewHostsOpen } from '../../../src/lib/fewHosts';
import { hostArticlesOpen } from '../../../src/lib/hostArticles';
import { teaTableOpen } from '../../../src/lib/teaTable';
import { yourTablePlaceOpen } from '../../../src/lib/yourTablePlace';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope } from './tickets';

/** One call to a page route. A form body is sent as multipart, as the page sends it. */
export type PageStep = {
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  path: string;
  body?: Record<string, unknown>;
  form?: Record<string, string | string[]>;
};

type Args = Record<string, unknown>;
type Body = Record<string, any>;
type Refusal = { error: string; message?: string };
type Planned = { step: PageStep; preview: Record<string, unknown> } | Refusal;

type Pending = { kind: string; accountId: string; userId: string; step: PageStep };

const notAvailable = { error: 'not_available' } as const;
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const seg = (value: unknown) => encodeURIComponent(text(value));
const isRefusal = (value: unknown): value is Refusal =>
  Boolean(value && typeof value === 'object' && typeof (value as Refusal).error === 'string');

async function run(env: ToolEnv, auth: ToolAuth, step: PageStep): Promise<{ ok: boolean; status: number; body: Body }> {
  const response = await env.pageRoutes!.call(auth, step);
  const raw = await response.text();
  let body: Body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
  return { ok: response.ok, status: response.status, body };
}

/** The page's refusal, as a code and its words. */
function refusalOf(answer: { status: number; body: Body }, fallback: string): Refusal {
  const code = typeof answer.body?.code === 'string' ? answer.body.code
    : answer.status === 404 ? 'not_found' : answer.status === 403 ? 'not_allowed' : fallback;
  return typeof answer.body?.error === 'string' ? { error: code, message: answer.body.error } : { error: code };
}

type Spec = {
  name: string;
  scope: ToolDefinition['scope'];
  available: (env: ToolEnv, auth: ToolAuth) => boolean;
  description: string;
  properties: Record<string, unknown>;
  required: string[];
  /** Reads what the page would read and plans the call; or refuses. */
  plan: (env: ToolEnv, auth: ToolAuth, args: Args) => Promise<Planned>;
  /** What an agent is told after the confirm. */
  result: (body: Body, env: ToolEnv) => Record<string, unknown>;
};

function writeTool(spec: Spec) {
  const def: ToolDefinition = {
    name: spec.name, scope: spec.scope, available: spec.available,
    description: `${spec.description} Preview first, then pass confirm with the confirmation token.`,
    inputSchema: {
      type: 'object',
      properties: { ...spec.properties, confirm: { type: 'string' } },
      anyOf: [{ required: spec.required }, { required: ['confirm'] }],
    },
  };
  const handler: ToolHandler = async (env, auth, args) => {
    if (!env.pageRoutes || !spec.available(env, auth)) return notAvailable;
    if (args?.confirm !== undefined) {
      const ticket = text(args.confirm);
      if (!ticket) return INVALID_TICKET;
      const pending = await consumeTicket<Pending, string>(env, ticket, spec.name, auth);
      if (!pending || pending.userId !== auth.userId) return INVALID_TICKET;
      const answer = await run(env, auth, pending.step);
      if (!answer.ok) return refusalOf(answer, 'refused');
      return { committed: true, action: spec.name, ...spec.result(answer.body, env) };
    }
    const planned = await spec.plan(env, auth, args ?? {});
    if (isRefusal(planned)) return planned;
    const token = await issueTicket<Pending>(env, {
      kind: spec.name, accountId: auth.accountId, userId: auth.userId, step: planned.step,
    }, auth.tokenId);
    return previewEnvelope({ action: spec.name, ...planned.preview }, token);
  };
  return { def, handler };
}

function readTool(spec: Omit<Spec, 'plan' | 'required'> & { step: (args: Args) => PageStep }) {
  const def: ToolDefinition = {
    name: spec.name, scope: spec.scope, available: spec.available,
    description: `${spec.description} Read only.`,
    inputSchema: { type: 'object', properties: spec.properties },
  };
  const handler: ToolHandler = async (env, auth, args) => {
    if (!env.pageRoutes || !spec.available(env, auth)) return notAvailable;
    const answer = await run(env, auth, spec.step(args ?? {}));
    return answer.ok ? spec.result(answer.body, env) : refusalOf(answer, 'refused');
  };
  return { def, handler };
}

/** The host's own table, read through the page's own GET (its ownership check). */
async function ownTable(env: ToolEnv, auth: ToolAuth, tableId: unknown): Promise<Body | Refusal> {
  if (!text(tableId)) return { error: 'table_not_found' };
  const answer = await run(env, auth, { method: 'GET', path: `/api/me/tables/${seg(tableId)}` });
  if (!answer.ok) return answer.status === 404 ? { error: 'table_not_found' } : refusalOf(answer, 'table_not_found');
  return answer.body;
}

const tableTitle = (body: Body) => body?.table?.title ?? body?.title ?? null;

// ── Switches, each the page's own ───────────────────────────────────────────

const hosting = (env: ToolEnv) => fewHostsOpen(env);
const circles = (env: ToolEnv) => circlesOpen(env) && fewHostsOpen(env);
const yourTable = (env: ToolEnv) => yourTablePlaceOpen(env) && fewHostsOpen(env);
const articles = (env: ToolEnv) => hostArticlesOpen(env);
const owner = (open: (env: ToolEnv) => boolean) =>
  (env: ToolEnv, auth: ToolAuth) => open(env) && auth.creatorTier === 'platform_owner';

const string = { type: 'string' };
const tableId = { type: 'string', description: 'The table\'s id, from list_my_tables.' };

// ── The host's (A11-10) ─────────────────────────────────────────────────────

const changeMyTable = writeTool({
  name: 'change_my_table', scope: 'catalog:write', available: hosting,
  description: 'Change the door, the seats or the area people are told of one of your own tables, before it happens.',
  properties: {
    table_id: tableId,
    door: { type: 'string', enum: ['request', 'link', 'open'] },
    seats: { type: 'integer', minimum: 1, maximum: 40 },
    area: { type: ['string', 'null'], maxLength: 80, description: 'The area people are told; never the address. Null clears it.' },
  },
  required: ['table_id'],
  plan: async (env, auth, args) => {
    const table = await ownTable(env, auth, args.table_id);
    if (isRefusal(table)) return table;
    const body: Record<string, unknown> = {};
    for (const key of ['door', 'seats', 'area'] as const) if (args[key] !== undefined) body[key] = args[key];
    if (!Object.keys(body).length) return { error: 'hosted_table_change', message: 'Say what to change.' };
    return {
      step: { method: 'PUT', path: `/api/me/tables/${seg(args.table_id)}`, body },
      preview: { table_id: text(args.table_id), title: tableTitle(table), change: body, effect: 'Change this table as you said. Nothing is sent to anyone.' },
    };
  },
  result: () => ({ ok: true }),
});

const markWhoCame = writeTool({
  name: 'mark_who_came', scope: 'sales:write', available: hosting,
  description: 'Once your table has begun, mark the guests who came. The table is then finished, so thank-you links open.',
  properties: { table_id: tableId, attendee_ids: { type: 'array', items: string } },
  required: ['table_id', 'attendee_ids'],
  plan: async (env, auth, args) => {
    const ids = args.attendee_ids;
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) return { error: 'hosted_table_came', message: 'Say who came.' };
    const table = await ownTable(env, auth, args.table_id);
    if (isRefusal(table)) return table;
    return {
      step: { method: 'PUT', path: `/api/me/tables/${seg(args.table_id)}/came`, body: { attendee_ids: ids } },
      preview: { table_id: text(args.table_id), title: tableTitle(table), came: ids, effect: 'Mark these guests as having come, and finish the table.' },
    };
  },
  result: () => ({ ok: true }),
});

const guestThanksLink = writeTool({
  name: 'get_guest_thanks_link', scope: 'sales:write', available: hosting,
  description: 'Make the thank-you link for a guest who came to your table, to send them yourself. Nothing is sent by Teajia.',
  properties: { table_id: tableId, attendee_id: string },
  required: ['table_id', 'attendee_id'],
  plan: async (env, auth, args) => {
    const table = await ownTable(env, auth, args.table_id);
    if (isRefusal(table)) return table;
    return {
      step: { method: 'POST', path: `/api/me/tables/${seg(args.table_id)}/guests/${seg(args.attendee_id)}/thanks-link` },
      preview: { table_id: text(args.table_id), attendee_id: text(args.attendee_id), effect: 'Make this guest\'s thank-you link and give it to you.' },
    };
  },
  // The page copies /after-sit#<credential>; the credential never goes in a query.
  result: (body, env) => ({
    link: typeof body.credential === 'string'
      ? `${(env.APP_URL || 'https://www.teajia.com').replace(/\/$/, '')}/after-sit#${body.credential}` : null,
    expires_at: body.expires_at ?? null,
    note: 'Send it only to this guest.',
  }),
});

const reviewGuestBook = writeTool({
  name: 'review_guest_book', scope: 'catalog:write', available: hosting,
  description: 'Include or pass over a note a guest left in your finished table\'s guest book.',
  properties: { table_id: tableId, entry_id: string, decision: { type: 'string', enum: ['include', 'pass'] } },
  required: ['table_id', 'entry_id', 'decision'],
  plan: async (env, auth, args) => {
    if (args.decision !== 'include' && args.decision !== 'pass') return { error: 'validation_failed', message: 'Choose include or pass.' };
    const book = await run(env, auth, { method: 'GET', path: `/api/me/tables/${seg(args.table_id)}/guest-book` });
    if (!book.ok) return refusalOf(book, 'table_not_found');
    const entry = (book.body.entries ?? []).find((row: Body) => row.id === text(args.entry_id));
    if (!entry) return { error: 'entry_not_found' };
    return {
      step: {
        method: 'POST', path: `/api/me/tables/${seg(args.table_id)}/guest-book/${seg(args.entry_id)}/review`,
        body: { action: args.decision, revision: entry.revision },
      },
      preview: {
        table_id: text(args.table_id), entry_id: entry.id, by: entry.display_name ?? null, note: entry.note ?? null,
        decision: args.decision,
        effect: args.decision === 'include' ? 'Include this note in the table\'s guest book.' : 'Pass over this note.',
      },
    };
  },
  result: () => ({ ok: true }),
});

const setTableWay = writeTool({
  name: 'set_table_way', scope: 'catalog:write', available: hosting,
  description: 'Set the address and map link of one of your tables, which only a seated guest is shown. The steps and photographs you set on the page stay as they are.',
  properties: { table_id: tableId, address: { type: ['string', 'null'] }, map_link: { type: ['string', 'null'] } },
  required: ['table_id'],
  plan: async (env, auth, args) => {
    if (args.address === undefined && args.map_link === undefined) return { error: 'table_way_invalid', message: 'Say the address or the map link.' };
    const current = await run(env, auth, { method: 'GET', path: `/api/me/tables/${seg(args.table_id)}/way` });
    if (!current.ok) return current.status === 404 ? { error: 'table_not_found' } : refusalOf(current, 'table_not_found');
    const way = current.body.way ?? {};
    const body = {
      address: args.address === undefined ? way.address ?? null : args.address,
      map_link: args.map_link === undefined ? way.map_link ?? null : args.map_link,
      venue_guide: way.venue_guide ?? null,
    };
    return {
      step: { method: 'PUT', path: `/api/me/tables/${seg(args.table_id)}/way`, body },
      preview: {
        table_id: text(args.table_id), address: body.address, map_link: body.map_link,
        effect: 'Keep this as the way to your table. Only a guest with a seat is shown it.',
      },
    };
  },
  result: body => ({ ok: true, address: body.way?.address ?? null, map_link: body.way?.map_link ?? null }),
});

const setYourTable = writeTool({
  name: 'set_your_table', scope: 'catalog:write', available: yourTable,
  description: 'Choose one of your saved places as your table, with the area people are told, or clear it (clear: true).',
  properties: { place_id: string, area: { type: 'string', maxLength: 80 }, clear: { type: 'boolean' } },
  required: [],
  plan: async (env, auth, args) => {
    const current = await run(env, auth, { method: 'GET', path: '/api/me/your-table' });
    if (!current.ok) return refusalOf(current, 'not_available');
    if (args.clear === true) {
      return { step: { method: 'DELETE', path: '/api/me/your-table' }, preview: { effect: 'Stop naming any place as your table.' } };
    }
    const placeId = text(args.place_id);
    const place = (current.body.places ?? []).find((row: Body) => row.id === placeId);
    if (!place) return { error: 'your_table_place', message: 'Choose one of your places.' };
    if (!text(args.area)) return { error: 'your_table_area', message: 'Write the area your table is in.' };
    return {
      step: { method: 'PUT', path: '/api/me/your-table', body: { place_id: placeId, area_hint: text(args.area) } },
      preview: { place: place.name ?? placeId, area: text(args.area), effect: 'Name this place as your table, shown by its area only.' },
    };
  },
  result: body => ({ ok: true, places: (body.places ?? []).map((row: Body) => ({ id: row.id, name: row.name, is_host_table: row.is_host_table })) }),
});

const askGuestBack = writeTool({
  name: 'ask_guest_back', scope: 'sales:write', available: circles,
  description: 'Ask an earlier guest of this table\'s circle back to this table, as your yes.',
  properties: { table_id: tableId, attendee_id: string },
  required: ['table_id', 'attendee_id'],
  plan: async (env, auth, args) => {
    const guests = await run(env, auth, { method: 'GET', path: `/api/me/tables/${seg(args.table_id)}/circle-guests` });
    if (!guests.ok) return refusalOf(guests, 'table_not_found');
    const list: Body[] = guests.body.guests ?? [];
    const guest = list.find(row => row.attendee_id === text(args.attendee_id));
    if (!guest) return { error: 'guest_not_found' };
    return {
      step: { method: 'POST', path: `/api/me/tables/${seg(args.table_id)}/circle-guests/${seg(args.attendee_id)}/ask` },
      preview: { table_id: text(args.table_id), guest: guest.name ?? null, effect: 'Ask this guest back to this table, as your yes.' },
    };
  },
  result: body => ({ ok: true, ...(typeof body.status === 'string' ? { status: body.status } : {}) }),
});

const offerArticle = writeTool({
  name: 'offer_article', scope: 'catalog:write', available: articles,
  description: 'Offer Teajia an article you wrote, words only; photographs are added on the page. credit says whether your name may appear.',
  properties: { title: { type: 'string', maxLength: 160 }, body: { type: 'string', maxLength: 40000 }, credit: { type: 'boolean' } },
  required: ['title', 'body', 'credit'],
  plan: async (env, auth, args) => {
    const title = text(args.title);
    const body = text(args.body);
    if (!title || title.length > 160 || !body || body.length > 40_000 || typeof args.credit !== 'boolean') {
      return { error: 'validation_failed', message: 'Give a title up to 160 characters, the article up to 40,000, and whether your name may appear.' };
    }
    const offers = await run(env, auth, { method: 'GET', path: '/api/me/article-offers' });
    if (!offers.ok) return refusalOf(offers, 'not_available');
    if (!offers.body.can_offer) return { error: 'not_allowed', message: 'Hosting a session opens article offers.' };
    return {
      step: {
        method: 'POST', path: '/api/me/article-offers',
        // The submission id makes a repeated confirm the same offer, as the page's form does.
        form: { submission_id: crypto.randomUUID(), credit: String(args.credit), title, body },
      },
      preview: { title, words: body.split(/\s+/).length, credit: args.credit, effect: 'Send this article to Teajia to read. Nothing is published until Adrian does.' },
    };
  },
  result: body => ({ offer_id: body.id ?? null, status: body.status ?? null }),
});

// ── Adrian's (A11-11) ───────────────────────────────────────────────────────

const setHostReach = writeTool({
  name: 'set_host_reach', scope: 'admin:write', available: owner(env => fewHostsOpen(env) && anyoneHostsOpen(env)),
  description: 'How far a host\'s open tables are shown: invitation (their link only), teajia (people signed in) or listed (the public sessions list). Platform owner only.',
  properties: { user_id: string, reach: { type: 'string', enum: ['invitation', 'teajia', 'listed'] } },
  required: ['user_id', 'reach'],
  plan: async (env, _auth, args) => {
    if (!['invitation', 'teajia', 'listed'].includes(text(args.reach))) return { error: 'validation_failed', message: 'Say invitation, teajia or listed.' };
    const person = await env.DB.prepare('SELECT id, name FROM users WHERE id = ?').bind(text(args.user_id)).first<{ id: string; name: string | null }>();
    if (!person) return { error: 'user_not_found' };
    return {
      step: { method: 'PUT', path: `/api/platform/users/${seg(args.user_id)}/host-reach`, body: { reach: text(args.reach) } },
      preview: { user_id: person.id, name: person.name, reach: text(args.reach), effect: 'Change how far this host\'s open tables are shown. Nobody is told.' },
    };
  },
  result: body => ({ ok: true, host_reach: body.host_reach ?? null }),
});

const listReports = readTool({
  name: 'list_reports', scope: 'admin:write', available: owner(anyoneHostsOpen),
  description: 'The open reports of sessions and people. Platform owner only.',
  properties: {},
  step: () => ({ method: 'GET', path: '/api/admin/session-reports' }),
  result: body => ({ reports: body.reports ?? [] }),
});

const resolveReport = writeTool({
  name: 'resolve_report', scope: 'admin:write', available: owner(anyoneHostsOpen),
  description: 'Close a report as acted on or dismissed. Platform owner only.',
  properties: { report_id: string, status: { type: 'string', enum: ['acted', 'dismissed'] } },
  required: ['report_id', 'status'],
  plan: async (env, auth, args) => {
    if (args.status !== 'acted' && args.status !== 'dismissed') return { error: 'validation_failed', message: 'Say acted or dismissed.' };
    const open = await run(env, auth, { method: 'GET', path: '/api/admin/session-reports' });
    if (!open.ok) return refusalOf(open, 'not_available');
    const report = (open.body.reports ?? []).find((row: Body) => row.id === text(args.report_id));
    if (!report) return { error: 'report_not_found' };
    return {
      step: { method: 'POST', path: `/api/admin/session-reports/${seg(args.report_id)}/resolve`, body: { status: args.status } },
      preview: { report_id: report.id, target_kind: report.target_kind ?? null, status: args.status, effect: `Close this report as ${args.status}. Nobody is told.` },
    };
  },
  result: body => ({ ok: true, status: body.status ?? null }),
});

const reviewArticleOffer = writeTool({
  name: 'review_article_offer', scope: 'admin:write', available: owner(articles),
  description: 'Publish or decline an article a host offered. Publishing keeps its words and photographs as offered unless you give a new title or body. Platform owner only.',
  properties: {
    offer_id: string, decision: { type: 'string', enum: ['publish', 'decline'] },
    title: { type: 'string', maxLength: 160 }, body: { type: 'string', maxLength: 40000 },
  },
  required: ['offer_id', 'decision'],
  plan: async (env, auth, args) => {
    if (args.decision !== 'publish' && args.decision !== 'decline') return { error: 'validation_failed', message: 'Choose publish or decline.' };
    const offers = await run(env, auth, { method: 'GET', path: '/api/admin/article-offers' });
    if (!offers.ok) return refusalOf(offers, 'not_available');
    const offer = (offers.body.offers ?? []).find((row: Body) => row.id === text(args.offer_id));
    if (!offer) return { error: 'not_found' };
    if (offer.status !== 'offered') return { error: 'already_reviewed' };
    const form: Record<string, string | string[]> = args.decision === 'decline'
      ? { action: 'decline' }
      : {
        action: 'publish', title: text(args.title) || offer.title, body: text(args.body) || offer.body,
        keep_photo: Array.isArray(offer.photos) ? offer.photos : [],
      };
    return {
      step: { method: 'POST', path: `/api/admin/article-offers/${seg(args.offer_id)}`, form },
      preview: {
        offer_id: offer.id, title: form.title ?? offer.title, by: offer.credit ? offer.author_name : 'unnamed', decision: args.decision,
        effect: args.decision === 'publish' ? 'Publish this article on Teajia.' : 'Decline this article. Nothing is published.',
      },
    };
  },
  result: body => ({ offer_id: body.id ?? null, status: body.status ?? null, slug: body.slug ?? null }),
});

const listTeaTable = readTool({
  name: 'list_tea_table', scope: 'admin:write', available: owner(teaTableOpen),
  description: 'Every piece put on the Tea Table, hidden ones too, with its keeps and any hold. Platform owner only.',
  properties: {},
  step: () => ({ method: 'GET', path: '/api/admin/tea-table' }),
  result: body => ({ items: body.items ?? [] }),
});

const tools = [
  changeMyTable, markWhoCame, guestThanksLink, reviewGuestBook, setTableWay, setYourTable, askGuestBack, offerArticle,
  setHostReach, listReports, resolveReport, reviewArticleOffer, listTeaTable,
];

export const pageActionsToolModule: ToolModule = {
  area: 'page_actions',
  defs: tools.map(tool => tool.def),
  handlers: Object.fromEntries(tools.map(tool => [tool.def.name, tool.handler])),
};

export default pageActionsToolModule;
