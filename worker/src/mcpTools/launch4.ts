import { favouritesOpen } from '../../../src/lib/favouritesOpen';
import { teaTableOpen } from '../../../src/lib/teaTable';
import { TEA_TABLE_HOLD_DAYS, type TeaTableKind } from '../../../src/lib/teaTableContract';
import { FAVOURITE_KINDS, favouriteTarget, listFavourites, setFavourite, type FavouriteKind } from '../favourites';
import {
  holdTeaTablePiece, hostedTeaTableSession, isTeaTableHoldDays, isTeaTableKind, isTeaTablePlatformOwner,
  setTeaTableHidden, setTeaTableKeep, setTeaTableRecap, takeTastingOffTeaTable, teaTablePiece, teaTableRecapTarget,
} from '../teaTable';
import type { ToolAuth, ToolDefinition, ToolHandler, ToolModule } from './registry';
import { consumeTicket, INVALID_TICKET, issueTicket, previewEnvelope } from './tickets';

type Piece = { kind: TeaTableKind; id: string };
type Actions = {
  set_my_favourite: { kind: FavouriteKind; id: string; kept: boolean };
  set_tea_table_keep: Piece & { kept: boolean };
  set_my_recap_on_tea_table: { id: string; on_table: boolean };
  take_my_tasting_off_tea_table: { id: string };
  hold_tea_table_piece: Piece & { days: number };
  hide_tea_table_piece: Piece;
};
type Action = keyof Actions;
type Mutation<K extends Action> = { kind: K; accountId: string; userId: string; input: Actions[K] };
type Args = Record<string, unknown> | null | undefined;
type Preview<K extends Action> = { input: Actions[K]; title?: string; effect: string } | { error: string };

const notFound = { error: 'not_found' };
const invalid = { error: 'validation_failed' };
const notEligible = { error: 'recap_not_eligible' };
const notOnTable = { error: 'not_on_table' };
const ownerOnly = { error: 'platform_owner_only' };

function idOf(args: Args) {
  return typeof args?.id === 'string' ? args.id.trim() : '';
}

type PreviewAction<K extends Action> =
  (db: D1Database, auth: ToolAuth, args: Args) => Promise<Preview<K>>;
type ApplyAction<K extends Action> =
  (db: D1Database, auth: ToolAuth, input: Actions[K]) => Promise<object>;

function write<K extends Action>(
  action: K, preview: PreviewAction<K>, apply: ApplyAction<K>, ownerOnlyAction = false,
): ToolHandler {
  return async (env, auth, args: Args) => {
    if (ownerOnlyAction && !await isTeaTablePlatformOwner(env.DB, auth.userId)) return ownerOnly;
    if (args?.confirm !== undefined) {
      if (typeof args.confirm !== 'string' || !args.confirm) return INVALID_TICKET;
      const pending = await consumeTicket<Mutation<K>, K>(env, args.confirm, action, auth);
      if (!pending || pending.userId !== auth.userId) return INVALID_TICKET;
      const result = await apply(env.DB, auth, pending.input);
      return 'error' in result ? result : { committed: true, action, ...result };
    }
    const planned = await preview(env.DB, auth, args);
    if ('error' in planned) return planned;
    const token = await issueTicket<Mutation<K>>(env, {
      kind: action, accountId: auth.accountId, userId: auth.userId, input: planned.input,
    }, auth.tokenId);
    return previewEnvelope({ action, ...planned.input, title: planned.title, effect: planned.effect }, token);
  };
}

async function teaTableResult(response: Response): Promise<object> {
  const body = await response.json() as { code?: string; error?: string };
  return response.ok ? body : { error: body.code, message: body.error };
}

async function pieceTitle(db: D1Database, { kind, id }: Piece) {
  const piece = await teaTablePiece(db, kind, id);
  return piece?.kind === 'tasting' ? piece.tea.name : piece?.title;
}

const setMyFavourite = write('set_my_favourite', async (db, auth, args) => {
  const id = idOf(args);
  const { kind, kept } = args ?? {};
  if (!id || typeof kept !== 'boolean' || !FAVOURITE_KINDS.some(value => value === kind)) return invalid;
  const input = { kind: kind as FavouriteKind, id, kept };
  const target = await favouriteTarget(db, auth.userId, input.kind, id, kept);
  if (!target) return notFound;
  return { input, title: target.title, effect: kept ? 'Add to your favourites.' : 'Remove from your favourites.' };
}, async (db, auth, { kind, id, kept }) => {
  return await setFavourite(db, auth.userId, kind, id, kept) ? { kind, id, kept } : notFound;
});

const setTeaTableKeepTool = write('set_tea_table_keep', async (db, auth, args) => {
  const id = idOf(args);
  const { kind, kept } = args ?? {};
  if (!id || !isTeaTableKind(kind) || typeof kept !== 'boolean') return invalid;
  const title = await pieceTitle(db, { kind, id });
  if (!title) {
    if (kept) return notFound;
    // A caller can let go of their keep after the piece leaves the table.
    const own = await db.prepare('SELECT 1 FROM tea_table_keeps WHERE user_id = ? AND item_kind = ? AND item_id = ?')
      .bind(auth.userId, kind, id).first();
    if (!own) return notFound;
  }
  return { input: { kind, id, kept }, title, effect: kept ? 'Keep this piece privately.' : 'Let go of your keep.' };
}, async (db, auth, { kind, id, kept }) =>
  teaTableResult(await setTeaTableKeep(db, auth.userId, kind, id, kept)));

const notHost = { error: 'not_host', message: 'Only a host of this session can do that.' };

/**
 * The page's rule for a recap (teaTable.ts hostOf, A4 review finding 7): the
 * platform owner, or a host of this session. Holding the shop is not enough
 * (A11-6). Read in the preview and again in the apply.
 */
async function mayPlaceRecap(db: D1Database, auth: ToolAuth, id: string) {
  return await isTeaTablePlatformOwner(db, auth.userId)
    || await hostedTeaTableSession(db, id, auth.accountId, auth.userId);
}

const setMyRecap = write('set_my_recap_on_tea_table', async (db, auth, args) => {
  const id = idOf(args);
  const onTable = args?.on_table;
  if (!id || typeof onTable !== 'boolean') return invalid;
  const recap = await teaTableRecapTarget(db, auth.accountId, id);
  if (!recap) return notFound;
  if (!await mayPlaceRecap(db, auth, id)) return notHost;
  if (onTable && !recap.eligible) return notEligible;
  return {
    input: { id, on_table: onTable }, title: recap.title,
    effect: onTable ? 'Show this recap on the Tea Table.' : 'Take this recap off the Tea Table.',
  };
}, async (db, auth, { id, on_table }) => {
  const recap = await teaTableRecapTarget(db, auth.accountId, id);
  if (!recap) return notFound;
  if (!await mayPlaceRecap(db, auth, id)) return notHost;
  if (on_table && !recap.eligible) return notEligible;
  return teaTableResult(await setTeaTableRecap(db, auth.accountId, auth.userId, id, on_table));
});

const takeMyTastingOff = write('take_my_tasting_off_tea_table', async (db, auth, args) => {
  const id = idOf(args);
  if (!id) return invalid;
  const tasting = await db.prepare(`SELECT COALESCE(NULLIF(p.given_name, ''), p.product_name) AS title, s.page_alone_at
    FROM member_tasting_shares s JOIN products p ON p.id = s.product_id AND p.account_id = s.account_id
    WHERE s.journal_entry_id = ? AND s.author_user_id = ? AND s.tea_table_at IS NOT NULL`)
    .bind(id, auth.userId).first<{ title: string; page_alone_at: string | null }>();
  if (!tasting) return notFound;
  // takeTastingOffTeaTable keeps it on the person's page only when they chose
  // their page by itself; otherwise it goes private everywhere (A11-8).
  const effect = tasting.page_alone_at
    ? 'Take this tasting off the Tea Table. It stays on your page.'
    : 'Take this tasting off the Tea Table. It was public only for the Tea Table, so it goes private everywhere, your page too.';
  return { input: { id }, title: tasting.title, effect };
}, async (db, auth, { id }) => teaTableResult(await takeTastingOffTeaTable(db, auth.userId, id)));

const holdPiece = write('hold_tea_table_piece', async (db, _auth, args) => {
  const id = idOf(args);
  const { kind, days } = args ?? {};
  if (!id || !isTeaTableKind(kind) || !isTeaTableHoldDays(days)) return invalid;
  const title = await pieceTitle(db, { kind, id });
  if (!title) return notOnTable;
  return { input: { kind, id, days }, title, effect: `Hold this piece at the top for ${days} ${days === 1 ? 'day' : 'days'} from confirmation.` };
}, async (db, auth, { kind, id, days }) =>
  teaTableResult(await holdTeaTablePiece(db, auth.userId, kind, id, days)), true);

const hidePiece = write('hide_tea_table_piece', async (db, _auth, args) => {
  const id = idOf(args);
  const kind = args?.kind;
  if (!id || !isTeaTableKind(kind)) return invalid;
  const title = await pieceTitle(db, { kind, id });
  if (!title) return notFound;
  const effect = kind === 'tasting'
    ? 'Hide this tasting on the Tea Table and wherever the family shows it.'
    : 'Hide this recap on the Tea Table.';
  return { input: { kind, id }, title, effect };
}, async (db, auth, { kind, id }) => {
  if (!await teaTablePiece(db, kind, id)) return notFound;
  return teaTableResult(await setTeaTableHidden(db, auth.userId, kind, id, true));
}, true);

const favouritesGate: ToolDefinition['unavailable'] = env => favouritesOpen(env) ? undefined : 'feature_closed';
const tableGate: ToolDefinition['unavailable'] = env => teaTableOpen(env) ? undefined : 'feature_closed';
const moderationGate: ToolDefinition['unavailable'] = (env, auth) =>
  tableGate(env, auth) ?? (auth.creatorTier === 'platform_owner' ? undefined : 'platform_owner_only');

const id = { type: 'string', description: 'The item ID.' };
const kind = { type: 'string', enum: ['recap', 'tasting'] };
const kept = { type: 'boolean', description: 'True to keep, false to let go.' };
const confirm = { type: 'string', description: 'Token from the preview. Send it by itself to commit.' };

function writeSchema(properties: Record<string, unknown>) {
  return {
    type: 'object', properties: { ...properties, confirm },
    anyOf: [{ required: Object.keys(properties) }, { required: ['confirm'] }],
  };
}

const defs: ToolDefinition[] = [
  {
    name: 'list_my_favourites',
    scope: 'inventory:read',
    unavailable: favouritesGate,
    description: 'List your favourite articles, shop teas and Tea Chest teas.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'set_my_favourite',
    scope: 'stock:write',
    unavailable: favouritesGate,
    description: 'Add or remove one of your favourites. Preview first, then confirm.',
    inputSchema: writeSchema({ kind: { type: 'string', enum: FAVOURITE_KINDS }, id, kept }),
  },
  {
    name: 'set_tea_table_keep',
    scope: 'stock:write',
    unavailable: tableGate,
    description: 'Privately keep or let go of a Tea Table piece. Preview first, then confirm.',
    inputSchema: writeSchema({ kind, id, kept }),
  },
  {
    name: 'set_my_recap_on_tea_table',
    scope: 'catalog:write',
    unavailable: tableGate,
    description: 'Put the published recap of a session you host on the Tea Table, or take it off. Preview first, then confirm.',
    inputSchema: writeSchema({ id, on_table: { type: 'boolean' } }),
  },
  {
    name: 'take_my_tasting_off_tea_table',
    scope: 'stock:write',
    unavailable: tableGate,
    description: 'Take your tasting off the Tea Table. It stays on your page only if you had chosen your page by itself; otherwise it goes private. The preview says which. Preview first, then confirm.',
    inputSchema: writeSchema({ id }),
  },
  {
    name: 'hold_tea_table_piece',
    scope: 'admin:write',
    unavailable: moderationGate,
    description: 'Hold a Tea Table piece at the top for 1 to 14 days. Platform owner only. Preview first, then confirm.',
    inputSchema: writeSchema({
      kind, id, days: { type: 'integer', minimum: TEA_TABLE_HOLD_DAYS.least, maximum: TEA_TABLE_HOLD_DAYS.most },
    }),
  },
  {
    name: 'hide_tea_table_piece',
    scope: 'admin:write',
    unavailable: moderationGate,
    description: 'Hide a Tea Table piece. Platform owner only. Preview first, then confirm.',
    inputSchema: writeSchema({ kind, id }),
  },
];

export const launch4ToolModule: ToolModule = {
  area: 'launch4',
  defs,
  handlers: {
    list_my_favourites: (env, auth) => listFavourites(env.DB, auth.userId),
    set_my_favourite: setMyFavourite,
    set_tea_table_keep: setTeaTableKeepTool,
    set_my_recap_on_tea_table: setMyRecap,
    take_my_tasting_off_tea_table: takeMyTastingOff,
    hold_tea_table_piece: holdPiece,
    hide_tea_table_piece: hidePiece,
  },
};
