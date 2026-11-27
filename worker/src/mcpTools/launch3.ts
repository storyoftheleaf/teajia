import { anyoneHostsOpen } from '../../../src/lib/anyoneHosts';
import { fewHostsOpen } from '../../../src/lib/fewHosts';
import { enteredTastingFlag } from '../sessionTasting';
import { fileReport, previewReport } from '../sessionReports';
import { cancelGuestSeat } from '../waitingList';
import type { Launch3Services, ToolAuth, ToolDefinition, ToolEnv, ToolHandler, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope } from './tickets';

const notAvailable = { error: 'not_available' };
const id = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const string = { type: 'string' };

type Arguments = Record<string, unknown>;
type Outcome = Record<string, unknown>;
type Action = (env: ToolEnv, auth: ToolAuth, services: Launch3Services, args: Arguments, preview: boolean) => Promise<Outcome>;

type Pending = {
  kind: string;
  accountId: string;
  userId: string;
  args: Arguments;
};

function writeTool(
  name: string, description: string, available: NonNullable<ToolDefinition['available']>,
  properties: Record<string, unknown>, required: string[], run: Action, scope: ToolDefinition['scope'],
) {
  const def: ToolDefinition = {
    name, scope, available,
    description: description + ' Preview first, then pass confirm with the confirmation token.',
    inputSchema: {
      type: 'object',
      properties: { ...properties, confirm: string },
      anyOf: [{ required }, { required: ['confirm'] }],
    },
  };
  const handler: ToolHandler = async (env, auth, args) => {
    if (!env.launch3) return notAvailable;
    if (args?.confirm !== undefined) {
      const confirmation = id(args.confirm);
      if (!confirmation) return INVALID_TICKET;
      const pending = await consumeTicket<Pending, string>(env, confirmation, name, auth);
      if (!pending || pending.userId !== auth.userId) return INVALID_TICKET;
      const result = await run(env, auth, env.launch3, pending.args, false);
      return 'error' in result ? result : { committed: true, action: name, ...result };
    }
    // Only declared input fields are retained in the ticket.
    const inputs = Object.fromEntries(Object.keys(properties).filter(key => args?.[key] !== undefined)
      .map(key => [key, args[key]]));
    const preview = await run(env, auth, env.launch3, inputs, true);
    if ('error' in preview) return preview;
    const ticket = await issueTicket<Pending>(env, { kind: name, accountId: auth.accountId, userId: auth.userId, args: inputs }, auth.tokenId);
    return previewEnvelope({ action: name, ...preview }, ticket);
  };
  return { def, handler };
}

// Project route results before returning them to an agent. Full route bodies
// may contain private event details, party sizes or waiting list information.
async function resultOf(response: Response, fallback: string, success: (body: Record<string, unknown>) => Outcome) {
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) return { error: typeof body.code === 'string' ? body.code : fallback };
  return success(body);
}

const report: Action = async (env, auth, services, args, preview) => {
  const kind = args.target_kind;
  if (kind !== 'session' && kind !== 'person') return { error: 'validation_failed' };
  const input: Parameters<typeof fileReport>[1] = {
    targetKind: kind, targetId: id(args.target_id),
    reason: typeof args.reason === 'string' ? args.reason : null, reporterUserId: auth.userId, reporterSeatId: null,
  };
  if (!preview) {
    const limited = await services.limitReport();
    if (limited) return resultOf(limited, 'rate_limit_unavailable', () => ({}));
  }
  const outcome = await (preview ? previewReport : fileReport)(env.DB, input);
  if ('refused' in outcome) return { error: outcome.refused.code };
  return preview
    ? { target_kind: kind, target_id: input.targetId, effect: 'Send this report to Teajia for review.' }
    : { received: true };
};

const releaseMySeat: Action = async (env, auth, _services, args, preview) => {
  const seat = await env.DB.prepare(
    'SELECT id, event_id, account_id FROM event_attendees WHERE id = ? AND user_id = ?',
  ).bind(id(args.attendee_id), auth.userId).first<{ id: string; event_id: string; account_id: string }>();
  if (!seat) return { error: 'guest_not_found' };
  if (preview) return { table_id: seat.event_id, attendee_id: seat.id, effect: 'Give back your seat.' };
  const result = await cancelGuestSeat(env.DB, {
    accountId: seat.account_id, eventId: seat.event_id, attendeeId: seat.id, userId: auth.userId,
  });
  return result ?? { error: 'state_conflict' };
};

type TableAction = (access: NonNullable<Awaited<ReturnType<Launch3Services['ownTable']>>>,
  auth: ToolAuth, services: Launch3Services, args: Arguments, preview: boolean) => Promise<Outcome>;

function atOwnTable(run: TableAction): Action {
  return async (_env, auth, services, args, preview) => {
    const access = await services.ownTable(auth, id(args.table_id));
    return access ? run(access, auth, services, args, preview) : { error: 'table_not_found' };
  };
}

const releaseGuestSeat = atOwnTable(async ({ table }, auth, services, args, preview) => {
  const attendeeId = id(args.attendee_id);
  return resultOf(await services.releaseGuest(table, attendeeId, auth.userEmail, preview), 'guest_not_found', () => preview
    ? { table_id: table.id, attendee_id: attendeeId, effect: 'Give back this guest’s seat.' }
    : { ok: true, status: 'cancelled' });
});

const sameTableAgain = atOwnTable(async ({ table, stopped }, auth, services, args, preview) => {
  if (stopped) return notAvailable;
  const date = id(args.event_date);
  const slug = id(args.slug);
  const response = await services.duplicate(table, auth.userId, slug, date, preview);
  const error = response.status === 409 ? 'slug_in_use' : response.status === 404 ? 'table_not_found' : 'invalid_table_copy';
  // The copy is made ready like a new table from the host's form (A11-2):
  // published, open by its link at once, on the door the host may give now.
  return resultOf(response, error, body => preview
    ? {
      table_id: table.id, event_date: body.event_date, timezone: body.timezone, slug, door: body.door,
      effect: copyEffect(String(body.door), typeof body.door_was === 'string' ? body.door_was : null),
    }
    : { table_id: body.id, slug: body.slug, lifecycle_status: body.lifecycle_status });
});

const DOOR_WORDS: Record<string, string> = { request: 'by request', link: 'by link', open: 'open' };
function copyEffect(door: string, doorWas: string | null) {
  const opens = `Make a copy of this table with its teas, published and open by its link at once, the same as a new table. Its door is ${DOOR_WORDS[door] ?? door}.`;
  return doorWas
    ? `${opens} The table it copies was ${DOOR_WORDS[doorWas] ?? doorWas}, a door you cannot give a new table now.`
    : opens;
}

const setSessionTasting = atOwnTable(async ({ table }, auth, services, args, preview) => {
  const flag = enteredTastingFlag(args.is_tasting);
  if (flag === undefined) return { error: 'invalid_tasting_flag' };
  const isTasting = flag === 1;
  if (preview) return { table_id: table.id, is_tasting: isTasting };
  return resultOf(await services.setTasting(table, auth.userId, isTasting), 'table_not_found', () => ({
    success: true, table_id: table.id, is_tasting: isTasting,
  }));
});

const changeHosting = (stopped: boolean): Action => async (env, auth, services, args, preview) => {
  const userId = id(args.user_id);
  if (preview) {
    const person = await env.DB.prepare('SELECT id, name FROM users WHERE id = ?')
      .bind(userId).first<{ id: string; name: string | null }>();
    return person ? { user_id: person.id, name: person.name, hosting_stopped: stopped } : { error: 'user_not_found' };
  }
  return resultOf(await services.setHostingStopped(auth, userId, stopped), 'user_not_found',
    () => ({ ok: true, user_id: userId, hosting_stopped: stopped }));
};

const ownerOnly = (env: ToolEnv, auth: ToolAuth) => fewHostsOpen(env) && auth.creatorTier === 'platform_owner';
// Every tool here but stopping a host is Launch 3's, so each needs its switch
// (A3). Stopping a host only takes something away, so it stays with Launch 2's
// switch, exactly as PUT /api/platform/users/:id/hosting-stopped does.
const launch3Open = (env: ToolEnv) => fewHostsOpen(env) && anyoneHostsOpen(env);
const tools = [
  writeTool('report', 'Report a session or person to Teajia.', anyoneHostsOpen,
    { target_kind: { type: 'string', enum: ['session', 'person'] }, target_id: string, reason: string },
    ['target_kind', 'target_id'], report, 'signed-in'),
  writeTool('release_my_seat', 'Give back your own seat using its attendee ID.', launch3Open,
    { attendee_id: string }, ['attendee_id'], releaseMySeat, 'signed-in'),
  writeTool('release_guest_seat', 'Release a confirmed guest’s seat at your own table.', launch3Open,
    { table_id: string, attendee_id: string }, ['table_id', 'attendee_id'], releaseGuestSeat, 'sales:write'),
  writeTool('same_table_again', 'Make a copy of your own table with a new slug and day. The copy is published and opens by its link at once, like a new table; a day already past is refused, and the door is one you may give a new table now.', launch3Open,
    { table_id: string, slug: string, event_date: { type: 'string', description: 'New start on the table\'s own clock, for example 2027-04-05T14:00.' } },
    ['table_id', 'slug', 'event_date'], sameTableAgain, 'catalog:write'),
  writeTool('set_session_tasting', 'Mark your own table as a tasting or clear that choice.',
    launch3Open,
    { table_id: string, is_tasting: { type: 'boolean' } }, ['table_id', 'is_tasting'], setSessionTasting, 'catalog:write'),
  writeTool('stop_host', 'Pause a person’s ability to make tables and confirm new guests. Platform owner only.', ownerOnly,
    { user_id: string }, ['user_id'], changeHosting(true), 'admin:write'),
  writeTool('let_host_again', 'Allow a person to host again. Platform owner only.', ownerOnly,
    { user_id: string }, ['user_id'], changeHosting(false), 'admin:write'),
];

export const launch3ToolModule: ToolModule = {
  area: 'launch_3',
  defs: tools.map(tool => tool.def),
  handlers: Object.fromEntries(tools.map(tool => [tool.def.name, tool.handler])),
};
