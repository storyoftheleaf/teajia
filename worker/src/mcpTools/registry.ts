import type { CurateFinalizeMovement } from '../curateImports';
import type { StockMovementInput } from '../inventoryDomain';
import type { ReservePartySeatsInput } from '../eventDomain';
import type { OwnHostedTable } from '../hostTableGuests';

export interface Launch3Services {
  ownTable: (auth: ToolAuth, tableId: string) => Promise<{ table: OwnHostedTable; stopped: boolean } | null>;
  duplicate: (table: OwnHostedTable, userId: string, slug: string, date: string, preview: boolean) => Promise<Response>;
  setTasting: (table: OwnHostedTable, userId: string, isTasting: boolean) => Promise<Response>;
  releaseGuest: (table: OwnHostedTable, attendeeId: string, email: string, preview: boolean) => Promise<Response>;
  setHostingStopped: (auth: ToolAuth, userId: string, stopped: boolean) => Promise<Response>;
  limitReport: () => Promise<Response | null>;
}
/**
 * Where MCP tools added from here on live.
 *
 * `mcp.ts` is 7,700 lines because every tool touches it in four places: the
 * `PendingMutation` union, the `TOOL_DEFS` array, the dispatch switch, and its
 * own handler. That is survivable when one person adds one tool. It is not
 * survivable when six groups of tools are written at once, because all six edit
 * the same four spots and the merge is a coin toss.
 *
 * So a new tool group is a module in this folder that exports a `ToolModule`,
 * and `mcp.ts` gains it in one line. The existing fifty-three are deliberately
 * NOT being moved: a working MCP server is not worth destabilising to make a
 * file shorter, and the point here is to stop the file growing, not to rewrite
 * what already ships.
 *
 * What a module gets and what it owes:
 *
 *   - `defs` are ordinary tool definitions, the same shape `TOOL_DEFS` holds,
 *     so nothing new has to be learned to read one.
 *   - `handlers` are keyed by tool name and receive the same `(env, auth, args)`
 *     the switch passes today.
 *   - Scope is declared per tool and enforced by `mcp.ts` before a handler is
 *     ever reached, exactly as it is for the built-in tools. A module cannot
 *     widen its own authority.
 *   - A mutating tool follows the preview/confirm pattern by returning a
 *     preview on the first call and committing on the second, and it stores its
 *     own ticket through `confirm` so it never keeps state in module memory:
 *     Cloudflare may route preview and confirm to different isolates.
 */
/**
 * What a tool module needs from the environment. `mcp.ts` narrows the wider
 * `Env` in index.ts the same way and for the same reason: a module states what
 * it reads rather than inheriting everything the worker happens to have.
 */
export interface CurateReceiptService {
  accept: (scope: { accountId: string; userId: string; email?: string }, proposalId: string) => Promise<Response>;
}

export interface InventoryReceiptService {
  receiveLogistics?: (scope: { accountId:string; userId:string; email?:string|null }, lineId:string, input:Record<string,unknown>, shipmentLineId:string) => Promise<Response>;
  receive: (scope: { accountId:string; userId:string; email?:string|null }, lineId:string, input:Record<string,unknown>) => Promise<Response>;
  cancel: (scope: { accountId:string; userId:string; email?:string|null }, lineId:string) => Promise<Response>;
  receiveImport: (scope: { accountId:string; userId:string; email?:string|null }, line:Parameters<CurateFinalizeMovement>[0], key:string) => ReturnType<CurateFinalizeMovement>;
}

/**
 * The one stock-movement path, `applyStockMovement` in index.ts, handed in the
 * same way the receipt services are, because a module importing index.ts back
 * would be a cycle. It is the path the Manage stock edit takes, so a count made
 * by an agent lands with the same ledger line, listing mirror and sold-out and
 * counted stamps as one Adrian makes by hand, rather than a second copy of them.
 */
export interface StockMovementService {
  apply: (scope: { accountId:string; userId:string; email?:string|null }, productId:string, input:StockMovementInput) => Promise<{ status:number; value:unknown }>;
}

/**
 * The seats a host's yes takes: the admin approval's own reservation,
 * `buildApprovalReservation` in index.ts, handed in for the same reason as
 * the stock path. The tool then takes the seats through the guarded
 * allocator `reservePartySeats`, exactly as PUT /api/me/tables/:id/guests/:id/yes.
 */
export interface HostSeatService {
  reservationFor: (attendee: Record<string, unknown> & { id: string; account_id: string; event_id: string; full_name: string },
    approvedGuests: number) => Promise<ReservePartySeatsInput | null>;
}

export interface ToolEnv {
  EDITORIAL_PILOT_ACCOUNT_ID?: string;
  FAVOURITES_OPEN?: string;
  TEA_TABLE_OPEN?: string;
  /** Launch 2's switch (src/lib/fewHosts.ts). The host tools answer "not available" unless it is open. */
  FEW_HOSTS_OPEN?: string;
  /** Launch 3's switch (src/lib/anyoneHosts.ts): anyone signed in may host by request. */
  ANYONE_HOSTS_OPEN?: string;
  /** Launch 5 M4's switch (src/lib/circles.ts): circles and series, with FEW_HOSTS_OPEN. */
  CIRCLES_OPEN?: string;
  /** The site's address, for a table's link. */
  APP_URL?: string;
  hostSeats?: HostSeatService;
  launch3?: Launch3Services;
  DB: D1Database;
  MEDIA_BUCKET?: R2Bucket;
  ATLAS_BUCKET?: R2Bucket;
  curateReceipts?: CurateReceiptService;
  inventoryReceipts?: InventoryReceiptService;
  stockMovements?: StockMovementService;
}

/** The scopes a module may ask for. Mirrors MCP_SCOPES in mcp.ts. */
export type ToolScope =
  | 'inventory:read' | 'stock:write' | 'customers:read' | 'sales:read'
  | 'sales:write' | 'catalog:write' | 'customers:write' | 'admin:write';

/** Who is calling, as mcp.ts has already established it. */
export interface ToolAuth {
  accountId: string;
  userId: string;
  userEmail: string;
  tokenId: string;
  creatorTier: string;
}

export interface ToolDefinition {
  name: string;
  /** Personal actions may require sign-in without a shop scope. */
  scope: ToolScope | 'signed-in';
  available?: (env: ToolEnv, auth: ToolAuth) => boolean;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  /** Return a refusal code when a feature or authority gate is closed. */
  unavailable?: (env: ToolEnv, auth: ToolAuth) => string | undefined;
}

export type ToolHandler = (env: ToolEnv, auth: ToolAuth, args: any) => Promise<unknown>;

export interface ToolModule {
  /** For the error a missing module produces, and for the docs. */
  area: string;
  defs: ToolDefinition[];
  handlers: Record<string, ToolHandler>;
}

/**
 * Fold several modules into one lookup, refusing a name that already exists.
 *
 * Two tools answering to one name is the four-freight-rates shape in a new
 * costume: whichever registered last wins, silently, and the other is dead code
 * that still reads as available. Better to fail at boot.
 */
export function combineToolModules(modules: ToolModule[]): {
  defs: ToolDefinition[];
  handlers: Record<string, ToolHandler>;
} {
  const defs: ToolDefinition[] = [];
  const handlers: Record<string, ToolHandler> = {};
  const seen = new Map<string, string>();
  for (const mod of modules) {
    for (const def of mod.defs) {
      const owner = seen.get(def.name);
      if (owner) throw new Error(`MCP tool '${def.name}' is defined by both ${owner} and ${mod.area}`);
      if (!mod.handlers[def.name]) throw new Error(`MCP tool '${def.name}' in ${mod.area} has no handler`);
      seen.set(def.name, mod.area);
      defs.push(def);
      handlers[def.name] = mod.handlers[def.name];
    }
    for (const name of Object.keys(mod.handlers)) {
      if (!mod.defs.some(d => d.name === name)) {
        throw new Error(`MCP handler '${name}' in ${mod.area} has no tool definition, so nothing can call it`);
      }
    }
  }
  return { defs, handlers };
}
