/**
 * Circles and series over MCP (Launch 5, M4). The same actions a host has on
 * /account/host, so a host can say "make a circle called Thursday tea" and
 * "put Saturday's table in it" to an agent.
 *
 *  - make_circle (write): a circle or a series, by name.
 *  - put_table_in_circle (write): one of the host's own tables into one of
 *    their own circles, or out of it (circle_id null).
 *  - list_my_circles (read): the host's circles and series with their tables
 *    by name and day. Never an address, a guest or a count.
 *
 * Every rule lives in worker/src/circles.ts; this file only previews,
 * tickets and confirms. Both switches (CIRCLES_OPEN and FEW_HOSTS_OPEN) and
 * the caller's standing as a host are read again on the confirm, so a host
 * stopped between the preview and the confirm makes nothing new.
 */
import { circlesOpen } from '../../../src/lib/circles';
import { circleHost, circleTable, listHostSeries, makeSeries, placeTable, readSeriesInput } from '../circles';
import type { ToolAuth, ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope } from './tickets';

type Base = { accountId: string; userId: string };
type CirclesMutation =
  | (Base & { kind: 'make_circle'; name: string; seriesKind: 'circle' | 'series' })
  | (Base & { kind: 'put_table_in_circle'; tableId: string; circleId: string | null });

const NOT_AVAILABLE = { error: 'not_available', message: 'Circles are not available to this account.' } as const;
const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const refusal = (refused: { code: string; error: string }) => ({ error: refused.code, message: refused.error });

/** The caller as a host of circles, on the token's own account. */
const hostOf = (env: ToolEnv, auth: ToolAuth) => circleHost(env, auth.userId, auth.accountId);

const makeCircle: ToolHandler = async (env, auth, args) => {
  const host = await hostOf(env, auth);
  if (!host) return NOT_AVAILABLE;
  const confirm = text(args?.confirm);
  if (!confirm) {
    // The page's own reader, with no default: the page asks circle or series, so the tool does too (A11-12).
    const input = readSeriesInput({ name: args?.name, kind: args?.kind });
    if ('refused' in input) return refusal(input.refused);
    if (host.stopped) return { error: 'hosting_stopped', message: 'New tables are paused on your account.' };
    const token = await issueTicket<CirclesMutation>(env, {
      kind: 'make_circle', accountId: auth.accountId, userId: auth.userId, name: input.name, seriesKind: input.kind,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'make_circle', name: input.name, kind: input.kind,
      effect: `Makes a ${input.kind} called "${input.name}". Nothing is sent to anyone.`,
    }, token);
  }
  const pending = await consumeTicket<CirclesMutation, 'make_circle'>(env, confirm, 'make_circle', auth);
  if (!pending || pending.userId !== auth.userId) return INVALID_TICKET;
  const made = await makeSeries(env.DB, host, { name: pending.name, kind: pending.seriesKind });
  if ('refused' in made) return refusal(made.refused);
  return { committed: true, action: 'make_circle', circle_id: made.id, name: made.name, kind: made.kind };
};

const putTableInCircle: ToolHandler = async (env, auth, args) => {
  const host = await hostOf(env, auth);
  if (!host) return NOT_AVAILABLE;
  const confirm = text(args?.confirm);
  if (!confirm) {
    const tableId = text(args?.table_id);
    if (!tableId) throw new Error('table_id is required');
    if (args?.circle_id !== null && typeof args?.circle_id !== 'string') throw new Error('circle_id is required: a circle id, or null to take the table out');
    const circleId = args.circle_id === null ? null : text(args.circle_id);
    const preview = await placeTable(env.DB, host, tableId, circleId, true);
    if ('refused' in preview) return refusal(preview.refused);
    const table = await circleTable(env.DB, host, tableId);
    const token = await issueTicket<CirclesMutation>(env, {
      kind: 'put_table_in_circle', accountId: auth.accountId, userId: auth.userId, tableId, circleId,
    }, auth.tokenId);
    return previewEnvelope({
      action: 'put_table_in_circle',
      table: table ? { id: table.id, title: table.title, event_date: table.event_date } : { id: tableId },
      circle: preview.series,
      effect: preview.series
        ? `Puts the table in "${preview.series.name}". Nothing is sent to anyone.`
        : 'Takes the table out of its circle. Nothing is sent to anyone.',
    }, token);
  }
  const pending = await consumeTicket<CirclesMutation, 'put_table_in_circle'>(env, confirm, 'put_table_in_circle', auth);
  if (!pending || pending.userId !== auth.userId) return INVALID_TICKET;
  const placed = await placeTable(env.DB, host, pending.tableId, pending.circleId);
  if ('refused' in placed) return refusal(placed.refused);
  return { committed: true, action: 'put_table_in_circle', table_id: placed.table_id, circle: placed.series };
};

const listMyCircles: ToolHandler = async (env, auth) => {
  const host = await hostOf(env, auth);
  if (!host) return NOT_AVAILABLE;
  const circles = await listHostSeries(env.DB, host);
  return {
    circles: circles.map(circle => ({
      id: circle.id, name: circle.name, kind: circle.kind,
      tables: circle.tables.map(table => ({ id: table.id, title: table.title, event_date: table.event_date, timezone: table.timezone })),
    })),
  };
};

const HOSTS_ONLY = 'For hosts, on their own personal account.';
const confirmArg = { type: 'string', description: 'The confirmation token from the preview.' };
const available = (env: ToolEnv) => circlesOpen(env);

const defs: ToolDefinition[] = [
  {
    name: 'make_circle',
    scope: 'catalog:write',
    available,
    description: `Make a circle (a named table that meets again) or a series (several sessions under one name). ${HOSTS_ONLY} Two-step preview/confirm. Nothing is sent to anyone.`,
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'What to call it.' },
        kind: { type: 'string', enum: ['circle', 'series'], description: 'circle or series. Required, as on the page.' },
        confirm: confirmArg,
      },
      anyOf: [{ required: ['name', 'kind'] }, { required: ['confirm'] }],
    },
  },
  {
    name: 'put_table_in_circle',
    scope: 'catalog:write',
    available,
    description: `Put one of your own tables in one of your own circles or series, or pass circle_id null to take it out. ${HOSTS_ONLY} Two-step preview/confirm.`,
    inputSchema: {
      type: 'object',
      properties: {
        table_id: { type: 'string' },
        circle_id: { type: ['string', 'null'], description: 'The circle or series id, or null to take the table out.' },
        confirm: confirmArg,
      },
      anyOf: [{ required: ['table_id', 'circle_id'] }, { required: ['confirm'] }],
    },
  },
  {
    name: 'list_my_circles',
    scope: 'inventory:read',
    available,
    description: `Your own circles and series, newest first, each with its tables by name and day. ${HOSTS_ONLY} Read only.`,
    inputSchema: { type: 'object', properties: {} },
  },
];

export const circlesToolModule: ToolModule = {
  area: 'circles',
  defs,
  handlers: { make_circle: makeCircle, put_table_in_circle: putTableInCircle, list_my_circles: listMyCircles },
};
