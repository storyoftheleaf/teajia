// MCP server for Teajia — voice/agent control of this account's inventory.
//
// Speaks the Model Context Protocol over plain HTTP POST + JSON-RPC 2.0 (no SSE).
// One MCP token == one (account, user) pair scoped to its selected permissions.
// Tokens are minted in the admin and stored hashed.
//
// ── Scopes (seven total) ──
//   Read:               inventory:read, customers:read
//   Write — Operator:   stock:write, sales:write
//   Write — Owner:      catalog:write, customers:write, admin:write
//
// Owner-tier scopes (catalog:write, customers:write, admin:write) are gated at
// TWO points: (1) at mint time the UI only lets owner-tier users select them,
// and the server refuses to store them if the minting user is below owner tier;
// (2) on every request the creator's current platform role or active account
// membership is re-read. Demotion or bundle removal invalidates any token whose
// stored scopes now exceed that live authority.
//
// Mutating tools follow a confirm-pattern: first call returns a `preview`
// payload + `confirmation_token`; the model is expected to read the preview
// back to the user and then re-call with `confirm: <token>` to commit. The
// commit step short-circuits to a no-op if the token is unknown or expired.
//
// Stock + invoice writes go through the existing fulfillment path (so the
// `stock_ledger` audit trail, low-stock detection, and listing mirror all
// still fire). Nothing in this file touches D1 in a way that bypasses the
// admin UI's invariants.

import { combineToolModules, type ToolModule } from './mcpTools/registry';
import { PENDING_TTL_MS as TICKET_PENDING_TTL_MS } from './mcpTools/tickets';
import { transferToolModule } from './mcpTools/transfer';
import { curationTools } from './mcpTools/curation';
import { eventsToolModule } from './mcpTools/events';
import { writingToolModule } from './mcpTools/writing';
import { costCurrencyTools } from './mcpTools/costCurrency';
import { resolveShopFreightDefault, shippingPerGramUsd } from './shippingRate';
import { costNeedsCurrency, createMissingCost, currencyStated, costCurrencySourceFor, CURRENCY_SOURCE_STATED, COST_CURRENCY_REQUIRED, COST_REQUIRED_ON_CREATE } from './costCurrency';
import { REFRESHED_CURRENCIES, refreshedCurrencyName } from './exchangeRateFeed';
import {
  authorizeInvoiceLines,
  buildSettlementReversalStatements,
  buildSettlementStatements,
  SalesInvariantError,
  canonicalCurrency,
} from './teaMasterSales';
import {
  PAYMENT_EPSILON,
  PAYMENT_AMOUNT_CEILING,
  CLAIM_TOLERANCE_USD,
  PAYMENT_TEXT_LIMITS,
  roundUsd,
  paymentTextField,
  formatInvoiceNumber,
  loadInvoiceLedgerTotals,
  invoiceMoney,
  loadLedgerInvoice,
  reconcileLedgerWithColumn,
  recomputeInvoicePaymentStatus,
} from './invoiceDomain';
import type {
  InvoiceLedgerTotals,
  InvoiceMoney,
  LedgerInvoice,
  LedgerRecompute,
} from './invoiceDomain';
import {
  createCurateImport,
  addCurateImportSource,
  analyzeCurateImport,
  getCurateImport,
  updateCurateImportItem,
  updateCurateImportGroup,
  curateImportChat,
  finalizeCurateImportRequest,
  type CurateImportContext,
  type CurateFinalizeMovement,
} from './curateImports';
// A leaf module shared with index.ts, so no cycle. convert_order_request needs
// the same tea-versus-teaware rule the REST convert applies to its lines.
import { isTeaType } from '../../src/wisdom/vocabulary';
import { mergeProductTasting, readStoredTasting, tastingHasTerms, tastingTermLabel } from './curateImportTasting';

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
  OAUTH_REGISTER_LIMITER?: RateLimiterBinding;
  OAUTH_AUTHORIZE_LIMITER?: RateLimiterBinding;
  // Not yet provisioned in wrangler.toml — requested from the worker/schema
  // owner in todo/plans/order-process-notes.md (same [[unsafe.bindings]]
  // ratelimit pattern as PUBLIC_MCP_LIMITER/OAUTH_REGISTER_LIMITER). Optional
  // so this file works before and after that binding lands.
  PUBLIC_PREPARE_ORDER_LIMITER?: RateLimiterBinding;
  // The wider Env interface in index.ts has many more fields — only the ones
  // the MCP server actually reads are listed here so this module is portable.
  // Optional fields forwarded to intake (curate-import) tools:
  ANTHROPIC_API_KEY?: string;
  GROQ_API_KEY?: string;
  CURATE_IMPORT_ANALYSIS_MODEL?: string;
  CURATE_IMPORT_FALLBACK_MODEL?: string;
  CURATE_IMPORT_GROQ_VISION_MODEL?: string;
  MEDIA_BUCKET?: unknown;
  AI?: unknown;
  IMAGES?: unknown;
};

type RateLimiterBinding = { limit: (opts: { key: string }) => Promise<{ success: boolean }> };

// ── small JSON helpers (mirroring index.ts so we don't import its 16k lines) ──
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function rpcError(id: number | string | null, code: number, message: string, data?: unknown): Response {
  return json({ jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } });
}

function rpcResult(id: number | string | null, result: unknown): Response {
  return json({ jsonrpc: '2.0', id, result });
}

async function activeHeldGrams(
  env: Env,
  accountId: string,
  productId: string,
  excludeInvoiceId: string | null = null,
): Promise<number> {
  const row = excludeInvoiceId
    ? await env.DB.prepare(
      `SELECT COALESCE(SUM(held_grams),0) AS held FROM stock_holds
       WHERE account_id=? AND product_id=? AND invoice_id != ?
         AND (expires_at IS NULL OR expires_at>datetime('now'))`
    ).bind(accountId, productId, excludeInvoiceId).first() as any
    : await env.DB.prepare(
      `SELECT COALESCE(SUM(held_grams),0) AS held FROM stock_holds
       WHERE account_id=? AND product_id=? AND (expires_at IS NULL OR expires_at>datetime('now'))`
    ).bind(accountId, productId).first() as any;
  return Number(row?.held) || 0;
}

function authenticationDependencyUnavailable(): Response {
  return json({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32002, message: 'Authentication dependency unavailable' },
  }, 503);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64decodeUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

type TokenClaims = {
  sub: string;
  email: string;
  name?: string;
  active_account_id?: string | null;
  session_version?: number;
  exp?: number;
};

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

async function verifyJwt(request: Request, env: Env): Promise<TokenClaims | null> {
  const token = getBearerToken(request);
  if (!token) return null;
  try {
    const [header, payload, sig] = token.split('.');
    if (!header || !payload || !sig) return null;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(env.JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      new TextEncoder().encode(`${header}.${payload}`),
    );
    if (!valid) return null;
    const claims = JSON.parse(b64decodeUtf8(payload)) as TokenClaims;
    if (!claims.sub || !claims.email) return null;
    if (typeof claims.exp === 'number' && claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

type OAuthApprovalContext = {
  userId: string;
  userEmail: string;
  accountId: string;
  creatorTier: McpCreatorTier;
};

async function resolveOAuthApprovalContext(
  request: Request,
  env: Env,
  requestedAccountId: string | null,
): Promise<OAuthApprovalContext | Response> {
  const claims = await verifyJwt(request, env);
  if (!claims) {
    return corsJson({ error: 'unauthenticated', error_description: 'Login required before approval' }, 401);
  }

  const accountId = requestedAccountId || claims.active_account_id || null;
  if (!accountId) {
    return corsJson({ error: 'account_required', error_description: 'Select an account before approval' }, 400);
  }

  let user: { id: string; email: string | null; platform_role: string | null; session_version: number | null } | null;
  try {
    user = await env.DB.prepare('SELECT id, email, platform_role, session_version FROM users WHERE id = ?')
      .bind(claims.sub)
      .first() as typeof user;
    // Legacy local/test D1 adapters may only expose the pre-116 projection.
    // Production D1 returns the query above, including session_version.
    if (!user) {
      user = await env.DB.prepare('SELECT id, email, platform_role FROM users WHERE id = ?')
        .bind(claims.sub)
        .first() as typeof user;
    }
  } catch {
    return corsJson({ error: 'temporarily_unavailable', error_description: 'Authentication dependency unavailable' }, 503);
  }
  if (!user) {
    return corsJson({ error: 'unauthenticated', error_description: 'User no longer exists' }, 401);
  }
  if (Number(user.session_version || 0) !== Number(claims.session_version || 0)) {
    return corsJson({ error: 'unauthenticated', error_description: 'Session no longer valid' }, 401);
  }

  const platformRole = user.platform_role || null;
  if (platformRole === 'platform_owner' || platformRole === 'platform_admin') {
    const account = await env.DB.prepare('SELECT status FROM accounts WHERE id = ?')
      .bind(accountId)
      .first() as { status: string | null } | null;
    if (!account) return corsJson({ error: 'access_denied', error_description: 'Account not found' }, 403);
    if (account.status === 'suspended') {
      return corsJson({ error: 'access_denied', error_description: 'Account is suspended' }, 403);
    }
    // platform_owner unlocks platform-wide tools (exchange rates); platform_admin
    // gets account-owner tier on the target account.
    const tier: McpCreatorTier = platformRole === 'platform_owner' ? 'platform_owner' : 'account_owner';
    return { userId: user.id, userEmail: user.email || claims.email, accountId, creatorTier: tier };
  }

  const membership = await env.DB.prepare(
    `SELECT am.role, a.status
     FROM account_members am
     JOIN accounts a ON a.id = am.account_id
     WHERE am.user_id = ? AND am.account_id = ? AND am.status = 'active'`,
  ).bind(user.id, accountId).first() as { role: string; status: string | null } | null;

  if (!membership) {
    return corsJson({ error: 'access_denied', error_description: 'Account access denied' }, 403);
  }
  if (membership.status === 'suspended') {
    return corsJson({ error: 'access_denied', error_description: 'Account is suspended' }, 403);
  }
  if (membership.role !== 'owner') {
    return corsJson({ error: 'access_denied', error_description: 'Owner-tier access required for MCP OAuth approval' }, 403);
  }

  return { userId: user.id, userEmail: user.email || claims.email, accountId, creatorTier: 'account_owner' };
}

// ── token auth ──

type McpCreatorTier = 'platform_owner' | 'account_owner' | 'staff' | 'viewer';
const OWNER_TIERS: ReadonlySet<McpCreatorTier> = new Set(['platform_owner', 'account_owner']);

type McpAuth = {
  accountId: string;
  userId: string;
  userEmail: string;
  tokenId: string;
  scopes: McpScope[];
  creatorTier: McpCreatorTier;
};

const MCP_SCOPES = [
  'inventory:read', 'stock:write', 'customers:read', 'sales:read', 'sales:write',
  'catalog:write', 'customers:write', 'admin:write',
] as const;
type McpScope = typeof MCP_SCOPES[number];

// Scopes that require current owner-tier authority. Defense-in-depth: checked
// at mint and again against live authorization on every request.
const OWNER_TIER_SCOPES: ReadonlySet<McpScope> = new Set(['catalog:write', 'customers:write', 'admin:write']);

// A held write scope implicitly grants the matching read scope — so a token
// minted before `sales:read` existed (it only had `sales:write`) can still use
// the new invoice/summary read tools, and operators never have to think about
// granting read alongside write. Read tools check the read scope; write tools
// keep checking the write scope directly.
const SCOPE_IMPLIES: Partial<Record<McpScope, McpScope[]>> = {
  'stock:write': ['inventory:read'],
  'catalog:write': ['inventory:read'],
  'sales:write': ['sales:read', 'inventory:read'],
  'customers:write': ['customers:read'],
};

// Default set for tokens minted without explicit scope selection (legacy +
// OAuth flow). Does NOT include owner-tier scopes.
const DEFAULT_MCP_SCOPES: McpScope[] = ['inventory:read', 'stock:write', 'customers:read', 'sales:read', 'sales:write'];
const READ_ONLY_MCP_SCOPES: ReadonlySet<McpScope> = new Set([
  'inventory:read', 'customers:read', 'sales:read',
]);

function parseMcpScopes(raw: unknown): McpScope[] {
  if (!raw) return DEFAULT_MCP_SCOPES;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return DEFAULT_MCP_SCOPES;
    return parsed.filter((scope): scope is McpScope => MCP_SCOPES.includes(scope as McpScope));
  } catch {
    return DEFAULT_MCP_SCOPES;
  }
}

function hasMcpScope(auth: McpAuth, scope: McpScope): boolean {
  if (auth.scopes.includes(scope)) return true;
  return auth.scopes.some(held => SCOPE_IMPLIES[held]?.includes(scope));
}

function allowedMcpScopesForCurrentAuthority(
  tier: McpCreatorTier,
  permissionsJson: string | null,
): ReadonlySet<McpScope> {
  if (OWNER_TIERS.has(tier)) return new Set(MCP_SCOPES);
  if (tier === 'viewer') return READ_ONLY_MCP_SCOPES;

  const allowed = new Set<McpScope>(READ_ONLY_MCP_SCOPES);
  if (!permissionsJson) return allowed;
  try {
    const parsed = JSON.parse(permissionsJson) as { bundles?: unknown };
    if (!Array.isArray(parsed.bundles)) return allowed;
    if (parsed.bundles.includes('stock')) allowed.add('stock:write');
    if (parsed.bundles.includes('sell')) allowed.add('sales:write');
  } catch {
    // Malformed permissions grant no write authority.
  }
  return allowed;
}

// 401 with WWW-Authenticate header — required by the MCP OAuth spec so
// clients (Claude desktop/mobile) know to start the OAuth discovery flow.
// The `resource_metadata` parameter points clients at our protected-resource
// metadata document, which in turn points them at the auth server.
function unauthorized(request: Request, message: string): Response {
  const origin = originOf(request);
  const body = JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message } });
  return new Response(body, {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer realm="mcp", resource_metadata="${origin}/.well-known/oauth-protected-resource"`,
    },
  });
}

async function authenticateMcp(request: Request, env: Env): Promise<McpAuth | Response> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return unauthorized(request, 'Missing bearer token');
  }
  const plaintext = auth.slice(7).trim();
  if (!plaintext) return unauthorized(request, 'Empty bearer token');

  type McpTokenRow = {
    id: string;
    account_id: string;
    user_id: string;
    user_email: string;
    revoked_at: string | null;
    scopes: string | null;
    creator_tier: string | null;
    expires_at: number | null;
  };
  type CurrentUserRow = { id: string; email: string | null; platform_role: string | null };
  type CurrentMembershipRow = { role: string; permissions: string | null };

  const hash = await sha256Hex(plaintext);
  let row: McpTokenRow | null;
  try {
    row = await env.DB.prepare(
      'SELECT id, account_id, user_id, user_email, revoked_at, scopes, creator_tier, expires_at FROM mcp_tokens WHERE token_hash = ?'
    ).bind(hash).first() as McpTokenRow | null;
  } catch {
    return authenticationDependencyUnavailable();
  }

  if (!row || row.revoked_at) {
    return unauthorized(request, 'Invalid or revoked token');
  }

  // Enforce expiry. expires_at is unix seconds (nullable; NULL = legacy
  // non-expiring token). Expired tokens are treated exactly like revoked ones.
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (row.expires_at != null && (row.expires_at as number) < nowSeconds) {
    return unauthorized(request, 'Invalid or revoked token');
  }

  let user: CurrentUserRow | null;
  let account: { status: string | null } | null;
  try {
    user = await env.DB.prepare('SELECT id, email, platform_role FROM users WHERE id = ?')
      .bind(row.user_id).first() as CurrentUserRow | null;
    account = await env.DB.prepare('SELECT status FROM accounts WHERE id = ?')
      .bind(row.account_id).first() as { status: string | null } | null;
  } catch {
    return authenticationDependencyUnavailable();
  }
  if (!user || !account || account.status !== 'active') {
    return unauthorized(request, 'Invalid or revoked token');
  }

  let creatorTier: McpCreatorTier;
  let permissions: string | null = null;
  if (user.platform_role === 'platform_owner') {
    creatorTier = 'platform_owner';
  } else if (user.platform_role === 'platform_admin') {
    creatorTier = 'account_owner';
  } else {
    let membership: CurrentMembershipRow | null;
    try {
      membership = await env.DB.prepare(
        `SELECT am.role, am.permissions
           FROM account_members am
          WHERE am.user_id = ? AND am.account_id = ? AND am.status = 'active'`
      ).bind(user.id, row.account_id).first() as CurrentMembershipRow | null;
    } catch {
      return authenticationDependencyUnavailable();
    }
    if (!membership) return unauthorized(request, 'Invalid or revoked token');
    if (membership.role === 'owner') creatorTier = 'account_owner';
    else if (membership.role === 'staff') creatorTier = 'staff';
    else if (membership.role === 'viewer') creatorTier = 'viewer';
    else return unauthorized(request, 'Invalid or revoked token');
    permissions = membership.permissions;
  }

  const scopes = parseMcpScopes(row.scopes);
  const allowedScopes = allowedMcpScopesForCurrentAuthority(creatorTier, permissions);
  if (scopes.some(scope => !allowedScopes.has(scope))) {
    return unauthorized(request, 'Token scope no longer authorized');
  }

  // Bump last_used_at on every successful auth (best-effort; non-blocking).
  // NOTE: not wrapped in ctx.waitUntil — authenticateMcp's signature is
  // (request, env) and threading an ExecutionContext here would ripple a
  // signature change into index.ts (mcp.ts is imported BY index.ts). Left
  // best-effort: if the isolate is torn down before this commits, the only
  // loss is a slightly stale last_used_at, never a correctness issue.
  env.DB.prepare("UPDATE mcp_tokens SET last_used_at = datetime('now') WHERE id = ?")
    .bind(row.id).run().catch(() => {});

  return {
    accountId: row.account_id,
    userId: user.id,
    userEmail: user.email || row.user_email,
    tokenId: row.id,
    scopes,
    creatorTier,
  };
}

// ── confirmation token store ──
//
// Mutating tools issue a confirmation token on the first call (a preview),
// and require the model to re-call with that token to commit. We hold them in
// the worker's per-isolate memory with a 5-minute TTL — long enough for a
// voice round-trip, short enough that a stale token can't be replayed days
// later. If the isolate is recycled mid-confirm the user just runs the tool
// again; the cost of that is one re-confirm, not a wrong write.

type PendingMutation =
  | { kind: 'add_stock'; accountId: string; userEmail: string; productId: string; grams: number; note: string | null }
  | { kind: 'remove_stock'; accountId: string; userEmail: string; productId: string; grams: number; reason: string; note: string | null }
  | { kind: 'record_sale'; accountId: string; userEmail: string; actorUserId: string; actorRole: string; lines: { productId: string; grams: number; pricePerGramUsd: number }[]; customerId: string | null; customerName: string; customerWhatsapp: string | null; notes: string | null }
  | { kind: 'create_customer'; accountId: string; userEmail: string; name: string; whatsapp: string | null; email: string | null; phone: string | null; notes: string | null; tags: string[] }
  | { kind: 'update_customer'; accountId: string; userEmail: string; customerId: string; fields: Record<string, string | null> }
  | { kind: 'update_tea_pricing'; accountId: string; userEmail: string; productId: string; costAmount: number | null; costCurrency: string | null; retailPriceUsd: number | null; quantityPurchased: number | null; year: number | null; status: string | null; description: string | null; lore: string | null; terroir: string | null; processingNotes: string | null; stockVerifiedAt: string | null; shippingRatePerKg: number | null; tastingNotes: string[] | null; originCountry: string | null; originRegion: string | null; clearFields: string[] | null }
  | { kind: 'set_low_stock_threshold'; accountId: string; userEmail: string; productId: string; thresholdGrams: number }
  | { kind: 'update_invoice'; accountId: string; userEmail: string; invoiceId: string; fields: Record<string, string | null> }
  | { kind: 'void_invoice'; accountId: string; userEmail: string; invoiceId: string; reason: string | null }
  // ── Wave 3 ──
  | { kind: 'tag_customer'; accountId: string; userEmail: string; customerId: string; tag: string }
  | { kind: 'untag_customer'; accountId: string; userEmail: string; customerId: string; tag: string }
  | { kind: 'link_vendor'; accountId: string; userEmail: string; customerId: string; productId: string; note: string | null }
  | { kind: 'unlink_vendor'; accountId: string; userEmail: string; customerId: string; productId: string }
  | { kind: 'upsert_vendor_contact'; accountId: string; userEmail: string; name: string; company: string | null; phone: string | null; whatsapp: string | null; wechat: string | null; address: string | null; city: string | null; country: string | null; source: string | null; notes: string | null }
  | { kind: 'remove_vendor_contact'; accountId: string; userEmail: string; customerId: string }
  | { kind: 'link_vendor_products'; accountId: string; userEmail: string; customerId: string; productIds: string[]; note: string | null }
  | { kind: 'update_tea_catalog'; accountId: string; userEmail: string; productId: string; fields: Record<string, string | null> }
  | { kind: 'set_tasting'; accountId: string; userEmail: string; productId: string; tasting: Record<string, unknown>; touched: string[] }
  | { kind: 'set_archive_status'; accountId: string; userEmail: string; productId: string; archived: boolean; reason: string | null }
  | { kind: 'set_tea_visibility'; accountId: string; userEmail: string; productId: string; shownInShop: boolean; personal?: boolean; isPublic?: boolean }
  | { kind: 'fulfill_invoice'; accountId: string; userEmail: string; actorUserId: string; invoiceId: string }
  | { kind: 'update_account_settings'; accountId: string; userEmail: string; fields: Record<string, string | null> }
  | { kind: 'update_exchange_rate'; accountId: string; userEmail: string; currency: string; rateVsUsd: number; previousRate: number }
  | { kind: 'create_tea'; accountId: string; userEmail: string; product: NewTeaInput }
  | { kind: 'mark_invoice_paid'; accountId: string; userEmail: string; actorUserId: string; actorRole: string; invoiceId: string; invoiceNumber: string; paymentMethod: string; fulfillStock: boolean }
  // ── Round three: the order process ──
  | { kind: 'convert_order_request'; accountId: string; userEmail: string; inquiryId: string; reference: string | null; customerName: string }
  | { kind: 'confirm_payment'; accountId: string; userEmail: string; actorUserId: string; paymentId: string; invoiceId: string; invoiceNumber: string | null; customerName: string | null; amountUsd: number }
  | { kind: 'record_payment'; accountId: string; userEmail: string; actorUserId: string; invoiceId: string; invoiceNumber: string | null; customerName: string | null; amountUsd: number; method: string | null; reference: string | null; note: string | null }
  // ── Intake (Curate-import) ──
  | { kind: 'intake_finalize'; accountId: string; userEmail: string; userId: string; importId: string; idempotencyKey: string };

/* Defined in mcpTools/tickets.ts so the built-in tools and the module tools
   cannot drift on how long a confirmation stays good. */
const PENDING_TTL_MS = TICKET_PENDING_TTL_MS;

// Confirmation tickets are persisted in D1 (mcp_confirmation_tickets), NOT in
// module memory: Cloudflare may route the preview call and the confirm call to
// different isolates, and isolates are recycled freely — an in-memory Map loses
// pending mutations across both boundaries, surfacing as spurious
// `invalid_or_expired_confirmation_token` errors mid voice round-trip.
//
// We hand the model a random UUID and store only its SHA-256 hash, so a leaked
// ticket row can't be replayed. Consumption is a single atomic UPDATE…RETURNING
// guarded on `consumed_at IS NULL`, which makes confirms single-use even under
// concurrent calls.
async function issueConfirmationToken(env: Env, mutation: PendingMutation, tokenId: string | null): Promise<string> {
  const now = Date.now();
  // Opportunistically reap expired/spent rows so the table doesn't grow
  // unbounded (best-effort, non-blocking).
  env.DB.prepare('DELETE FROM mcp_confirmation_tickets WHERE expires_at < ?')
    .bind(now).run().catch(() => {});

  const token = crypto.randomUUID();
  const tokenHash = await sha256Hex(token);
  // Bind the issuing token's id so the confirm call can only be made by the
  // same token (see consumeConfirmationToken). Prevents a sibling token in the
  // same account/scope from confirming another token's pending mutation.
  await env.DB.prepare(
    `INSERT INTO mcp_confirmation_tickets (token_hash, account_id, kind, payload_json, expires_at, token_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(tokenHash, mutation.accountId, mutation.kind, JSON.stringify(mutation), now + PENDING_TTL_MS, tokenId).run();
  return token;
}

async function consumeConfirmationToken(env: Env, token: string, tokenId: string | null): Promise<PendingMutation | null> {
  const tokenHash = await sha256Hex(token);
  const now = Date.now();
  const row = await env.DB.prepare(
    `UPDATE mcp_confirmation_tickets SET consumed_at = ?
       WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?
     RETURNING payload_json, token_id`
  ).bind(now, tokenHash, now).first() as { payload_json: string; token_id: string | null } | null;
  if (!row) return null;
  // Bind the ticket to its issuing token. NULL token_id is tolerated for
  // backward-compat with any in-flight legacy tickets created before this
  // column existed. A mismatch means a different token is trying to confirm.
  if (row.token_id != null && row.token_id !== tokenId) return null;
  try { return JSON.parse(row.payload_json) as PendingMutation; } catch { return null; }
}

// ── tea name search helpers ──
//
// Token-based scoring — Fuse.js doesn't run server-side here without bundling
// a dependency, but the corpus per account is in the low thousands at most,
// so a hand-rolled prefix/contains/word-overlap scorer is plenty for voice.

function normalize(s: string | number | null | undefined): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9一-鿿\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Stock added via MCP (voice/agent) lands in the account's catch-all "Unsorted"
// intake batch — same default as the admin paths — so a tea is never batch-less
// and the inventory "Unsorted" filter honestly holds everything not assigned to a
// named shipment, regardless of which surface added it. Mirrors defaultBatchId() in index.ts.
async function resolveUnsortedBatchId(env: Env, accountId: string): Promise<string> {
  const existing = await env.DB.prepare(
    `SELECT id FROM batches WHERE account_id = ? AND label = 'Unsorted' LIMIT 1`
  ).bind(accountId).first<{ id: string }>();
  if (existing) return existing.id;
  const id = `unsorted_${accountId}`;
  await env.DB.prepare(
    `INSERT INTO batches (id, account_id, label, intake_date) VALUES (?, ?, 'Unsorted', NULL)`
  ).bind(id, accountId).run();
  return id;
}

function scoreMatch(query: string, fields: (string | null | undefined)[]): number {
  const q = normalize(query);
  if (!q) return 0;
  const qTokens = q.split(' ').filter(Boolean);

  let best = 0;
  for (const raw of fields) {
    const f = normalize(raw);
    if (!f) continue;
    if (f === q) return 1.0;
    if (f.startsWith(q)) best = Math.max(best, 0.9);
    if (f.includes(q)) best = Math.max(best, 0.75);
    const fTokens = f.split(' ').filter(Boolean);
    let hits = 0;
    for (const t of qTokens) if (fTokens.some(ft => ft === t || ft.startsWith(t))) hits += 1;
    if (qTokens.length > 0) best = Math.max(best, (hits / qTokens.length) * 0.7);
  }
  return best;
}

type ProductRow = {
  id: string;
  // Readable public address. Null only for rows predating 132_product_slugs.
  slug: string | null;
  given_name: string | null;
  product_name: string;
  chinese_name: string | null;
  type: string;
  form: string | null;
  year: string | null;
  origin_country: string | null;
  origin_region: string | null;
  vendor: string | null;
  stock_grams: number | null;
  quantity_units: number | null;
  low_stock_threshold: number | null;
  fixed_retail_price_usd: number | null;
  status: string | null;
};

function productSummary(p: ProductRow, score?: number) {
  const display = p.given_name || p.product_name;
  return {
    id: p.id,
    display_name: display,
    product_name: p.product_name,
    given_name: p.given_name,
    chinese_name: p.chinese_name,
    type: p.type,
    form: p.form,
    year: p.year,
    origin: [p.origin_region, p.origin_country].filter(Boolean).join(', ') || null,
    vendor: p.vendor,
    stock_grams: p.stock_grams ?? 0,
    quantity_units: p.quantity_units,
    low_stock_threshold: p.low_stock_threshold,
    fixed_retail_price_usd: p.fixed_retail_price_usd,
    status: p.status,
    ...(typeof score === 'number' ? { match_score: Math.round(score * 100) / 100 } : {}),
  };
}

// Input shape for create_tea. Mirrors the fields the admin product-create
// endpoint accepts, normalized to camelCase for the confirmation payload.
type NewTeaInput = {
  productName: string;
  givenName: string | null;
  chineseName: string | null;
  type: string;
  form: string | null;
  year: string | null;
  originCountry: string | null;
  originRegion: string | null;
  vendor: string | null;
  stockGrams: number;
  costAmount: number;
  costCurrency: string;
  /* NULL means Adrian did not say, so the tea follows the shop rate (85 Yuan/kg
     as of 2026-09) and keeps following it when he renegotiates. A number pins
     this tea, in its OWN cost currency, which is the same rule the column has
     everywhere else. */
  shippingRatePerKg: number | null;
  fixedRetailPriceUsd: number | null;
  lowStockThreshold: number;
  notes: string | null;
  status: string;
};

// ── tool: create_tea (preview / confirm) ──
//
// Creates a new tea product. To stay consistent with main's product-creation
// path (the admin POST /api/products endpoint), this writes the legacy
// `products` row AND mirrors a `tea_profiles` + `product_listings` pair, so the
// new tea is immediately visible in listing-based shop/inventory views and the
// `list_<id>` row that add_stock / record_sale mirror into actually exists.
async function toolCreateTea(env: Env, auth: McpAuth, args: any) {
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (confirm) {
    const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
    if (!pending || pending.kind !== 'create_tea') {
      return { error: 'invalid_or_expired_confirmation_token' };
    }
    return commitCreateTea(env, pending);
  }

  const productName = String(args?.product_name ?? args?.name ?? '').trim();
  if (!productName) throw new Error('product_name is required');
  const stockGrams = Math.max(0, Math.round(Number(args?.stock_grams ?? args?.grams ?? 0) || 0));

  /* Asked of the RAW argument, before any conversion, and this ordering is the
     whole point. `Number(args?.cost_amount ?? 0) || 0` used to run first, which
     turned "the call said nothing" into "the tea cost zero" and then handed
     that zero to the currency guard, which correctly let it pass because a
     zero amount needs no unit. So the agent door created free teas in silence
     while the form was being held to a rule it was not.

     Adrian's instruction: the price is not optional when a tea is added, and
     this door does not get a lesser requirement than the one with a form and
     someone watching. Absence is refused; a typed 0 is a gift and is kept. */
  const missingCost = createMissingCost({ amount: args?.cost_amount, currency: args?.cost_currency });
  if (missingCost) throw new Error(`${COST_REQUIRED_ON_CREATE} (missing: ${missingCost})`);

  const costAmount = Math.max(0, Number(args.cost_amount));
  /* Freight, optional and read the same way every other nullable number is:
     absent means nobody said, which is the shop rate, NOT zero. `?? null`
     before any coercion, because Number(undefined) is NaN and Number(null) is
     0, and a 0 here is Adrian saying this one tea ships free. */
  const rawShipping = args?.shipping_rate_per_kg;
  const shippingRatePerKg = rawShipping === undefined || rawShipping === null
    || (typeof rawShipping === 'string' && rawShipping.trim() === '')
    ? null
    : Number(rawShipping);
  if (shippingRatePerKg !== null && !Number.isFinite(shippingRatePerKg)) {
    throw new Error('shipping_rate_per_kg must be a number, or left out to follow the shop rate');
  }
  const fixedRetailPriceUsd = args?.fixed_retail_price_usd == null
    ? null
    : Math.max(0, Number(args.fixed_retail_price_usd) || 0);
  const lowStockThreshold = Math.max(0, Math.round(Number(args?.low_stock_threshold ?? 100) || 0));
  /* Belt and braces: the rule above already refuses an unstated currency on
     create, and this is the same shared rule the update path uses. Keeping the
     call here means removing the create check above cannot quietly reopen the
     currency hole as well as the cost one. */
  if (costNeedsCurrency({ amount: costAmount, payloadCurrency: args?.cost_currency })) {
    throw new Error(COST_CURRENCY_REQUIRED);
  }

  const product: NewTeaInput = {
    productName,
    givenName: args?.given_name ? String(args.given_name).trim() : productName,
    chineseName: args?.chinese_name ? String(args.chinese_name).trim() : null,
    type: args?.type ? String(args.type).trim() : 'Tea',
    form: args?.form ? String(args.form).trim() : null,
    year: args?.year != null ? String(args.year).trim() : null,
    originCountry: args?.origin_country ? String(args.origin_country).trim() : null,
    originRegion: args?.origin_region ? String(args.origin_region).trim() : null,
    vendor: args?.vendor ? String(args.vendor).trim() : null,
    stockGrams,
    costAmount,
    /* No `|| 'USD'`. A tea created with a cost and no currency used to be
       stored as dollars on the agent's say-so, which is the one door where
       nobody is looking at a form to notice. Refused below instead; a tea
       created with no cost at all keeps NULL, which is honest. */
    shippingRatePerKg,
    costCurrency: currencyStated(args?.cost_currency)
      ? canonicalCurrency(String(args.cost_currency).trim().toUpperCase())
      : null,
    fixedRetailPriceUsd,
    lowStockThreshold,
    notes: args?.notes ? String(args.notes).slice(0, 1000) : null,
    status: args?.status ? String(args.status).trim() : 'Active',
  };

  const token = await issueConfirmationToken(env, {
    kind: 'create_tea', accountId: auth.accountId, userEmail: auth.userEmail, product,
  }, auth.tokenId);
  return {
    preview: { action: 'create_tea', product },
    confirmation_token: token,
    expires_in_seconds: PENDING_TTL_MS / 1000,
  };
}

// Build the tea_profiles + product_listings mirror inserts for a newly created
// tea. Ported inline from index.ts's buildProductMirrorInserts (mcp.ts
// deliberately does not import index.ts) — kept narrow to the fields create_tea
// supplies. Teaware is never created through this tool, so no teaware branch.
function buildCreateTeaMirrorInserts(
  env: Env, productId: string, m: Extract<PendingMutation, { kind: 'create_tea' }>,
  costCurrencySource: string | null,
): D1PreparedStatement[] {
  const p = m.product;
  const baseSlug = String(p.productName + (p.year ? `-${p.year}` : '') || productId)
    .toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slug = `${baseSlug}-${productId.slice(0, 6)}`.replace(/-+/g, '-');

  const profileStatus = p.status === 'Archived' ? 'archived'
    : p.status === 'Draft' ? 'draft'
    : 'published';
  const listingStatus = p.status === 'Archived' ? 'archived' : 'active';

  return [
    env.DB.prepare(`
      INSERT INTO tea_profiles (
        id, slug, originated_by_account_id, curated_by_account_id,
        name, chinese_name, type, form,
        origin_country, origin_region, harvest_year,
        description, tasting_notes, canonical_photos,
        network_visible, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `prof_${productId}`, slug, m.accountId, m.accountId,
      p.productName, p.chineseName, p.type, p.form,
      p.originCountry, p.originRegion, p.year,
      p.notes, '[]', '[]',
      1, profileStatus,
    ),
    env.DB.prepare(`
      INSERT INTO product_listings (
        id, account_id, profile_id,
        stock_grams, low_stock_threshold,
        fixed_retail_price_usd, markup_multiplier,
        vendor, cost_amount, cost_currency, cost_currency_source,
        quantity_purchased,
        is_public, status,
        tasting, legacy_product_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      `list_${productId}`, m.accountId, `prof_${productId}`,
      p.stockGrams, p.lowStockThreshold,
      /* markup_multiplier NULL, not 2.5. The column was created DEFAULT 2.5
         while the shop priced at three, so every row carrying it disagreed with
         the shelf; migration 0013 cleared them and the REST create writes NULL
         for the same reason. Typing the old default back in here would rebuild
         the fault one tea at a time, through the door with no form and nobody
         watching. NULL means the listing follows SHOP_MARKUP_MULTIPLIER. */
      p.fixedRetailPriceUsd, null,
      p.vendor, p.costAmount, p.costCurrency,
      /* Handed in rather than worked out here, so this row and the products row
         cannot reach different answers about whether the currency was actually
         stated. The backlog reads products, but a mirror that drifts from it
         has stopped being a mirror. */
      costCurrencySource,
      p.stockGrams,
      1, listingStatus,
      '{}', productId,
    ),
  ];
}

async function commitCreateTea(env: Env, m: Extract<PendingMutation, { kind: 'create_tea' }>) {
  const id = crypto.randomUUID();
  const cols: Record<string, any> = {
    id,
    account_id: m.accountId,
    type: m.product.type,
    form: m.product.form,
    given_name: m.product.givenName,
    chinese_name: m.product.chineseName,
    product_name: m.product.productName,
    year: m.product.year,
    origin_country: m.product.originCountry,
    origin_region: m.product.originRegion,
    description: m.product.notes,
    status: m.product.status,
    vendor: m.product.vendor,
    stock_grams: m.product.stockGrams,
    cost_amount: m.product.costAmount,
    cost_currency: m.product.costCurrency,
    quantity_purchased: m.product.stockGrams,
    low_stock_threshold: m.product.lowStockThreshold,
    fixed_retail_price_usd: m.product.fixedRetailPriceUsd,
  };
  /* Named only when a rate was given. Left out, the column keeps its NULL,
     which is what "follow the shop rate" is stored as. Writing NULL explicitly
     would do the same thing here, but naming a column to say nothing is the
     habit that put a number on every row in the first place. */
  if (m.product.shippingRatePerKg !== null) cols.shipping_rate_per_kg = m.product.shippingRatePerKg;
  /* The agent door is exactly the one with no form and nobody watching, and it
     was writing a currency the caller had stated while leaving the provenance
     column NULL. NULL means nobody was ever asked, so the tea joined the
     backlog `set_cost_currency` corrects, and a vendor-wide answer of yuan
     would have overwritten a stated currency and repriced the tea. Computed
     once here and handed to the mirror, so the two rows cannot diverge. */
  const costCurrencySource = costCurrencySourceFor(m.product.costCurrency);
  if (costCurrencySource) cols.cost_currency_source = costCurrencySource;
  const names = Object.keys(cols);

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO products (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`
    ).bind(...names.map(name => cols[name])),
    ...buildCreateTeaMirrorInserts(env, id, m, costCurrencySource),
  ];

  if (m.product.stockGrams > 0) {
    const batchId = await resolveUnsortedBatchId(env, m.accountId);
    stmts.push(env.DB.prepare(
      `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, user_email, note, batch_id, account_id)
       VALUES (?, ?, ?, ?, 'PURCHASE_RECEIPT', ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), id, m.product.stockGrams, m.product.stockGrams,
      m.userEmail, 'MCP create_tea opening stock', batchId, m.accountId,
    ));
  }

  stmts.push(env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'PRODUCT_CREATED_MCP', ?, ?, 'product', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    `Product ${m.product.productName} created via MCP`,
    m.userEmail, id, m.accountId,
  ));

  await env.DB.batch(stmts);

  const row = await env.DB.prepare(
    `SELECT id, given_name, product_name, chinese_name, type, form, year,
            origin_country, origin_region, vendor, stock_grams, quantity_units,
            low_stock_threshold, fixed_retail_price_usd, status
       FROM products WHERE id = ? AND account_id = ?`
  ).bind(id, m.accountId).first() as ProductRow | null;

  return {
    committed: true,
    action: 'create_tea',
    product: row ? productSummary(row) : { id, product_name: m.product.productName },
  };
}

// ── tool: search_tea ──
async function toolSearchTea(env: Env, accountId: string, args: any) {
  const query = String(args?.query || '').trim();
  const limit = Math.min(Math.max(Number(args?.limit) || 5, 1), 20);
  if (!query) {
    return { matches: [], note: 'No query provided.' };
  }

  const { results } = await env.DB.prepare(
    `SELECT id, given_name, product_name, chinese_name, type, form, year,
            origin_country, origin_region, vendor, stock_grams, quantity_units,
            low_stock_threshold, fixed_retail_price_usd, status
       FROM products
      WHERE account_id = ? AND status != 'Archived'`
  ).bind(accountId).all();

  const scored = (results as unknown as ProductRow[])
    .map(p => ({
      product: p,
      score: scoreMatch(query, [p.given_name, p.product_name, p.chinese_name, p.origin_region, p.vendor, p.year]),
    }))
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    matches: scored.map(s => productSummary(s.product, s.score)),
    ambiguous: scored.length >= 2 && scored[0].score - scored[1].score < 0.1,
  };
}

// ── tool: get_tea ──
async function toolGetTea(env: Env, accountId: string, args: any) {
  const id = String(args?.id || '').trim();
  if (!id) throw new Error('id is required');

  const product = await env.DB.prepare(
    `SELECT id, given_name, product_name, chinese_name, type, form, year,
            origin_country, origin_region, vendor, stock_grams, quantity_units,
            low_stock_threshold, fixed_retail_price_usd, status,
            description, tasting_notes, cost_amount, cost_currency
       FROM products WHERE id = ? AND account_id = ?`
  ).bind(id, accountId).first() as ProductRow & { description?: string; tasting_notes?: string; cost_amount?: number; cost_currency?: string } | null;

  if (!product) return { error: 'not_found' };

  const ledger = await env.DB.prepare(
    `SELECT delta, balance_after, reason, source_invoice_number, user_email, note, created_at
       FROM stock_ledger WHERE product_id = ? ORDER BY created_at DESC LIMIT 10`
  ).bind(id).all();

  let tastingNotes: any = product.tasting_notes;
  if (typeof tastingNotes === 'string') {
    try { tastingNotes = JSON.parse(tastingNotes); } catch { tastingNotes = []; }
  }

  return {
    ...productSummary(product),
    description: product.description ?? null,
    tasting_notes: tastingNotes,
    cost_amount: product.cost_amount ?? null,
    cost_currency: product.cost_currency ?? null,
    recent_ledger: ledger.results,
  };
}

// ── tool: list_low_stock ──
async function toolListLowStock(env: Env, accountId: string) {
  const { results } = await env.DB.prepare(
    `SELECT id, given_name, product_name, chinese_name, type, form, year,
            origin_country, origin_region, vendor, stock_grams, quantity_units,
            low_stock_threshold, fixed_retail_price_usd, status
       FROM products
      WHERE account_id = ?
        AND status != 'Archived'
        AND low_stock_threshold IS NOT NULL
        AND stock_grams < low_stock_threshold
      ORDER BY (CAST(stock_grams AS REAL) / NULLIF(low_stock_threshold, 0)) ASC
      LIMIT 50`
  ).bind(accountId).all();

  return {
    items: (results as unknown as ProductRow[]).map(p => productSummary(p)),
    count: results.length,
  };
}

// ── tool: find_customer ──
async function toolFindCustomer(env: Env, accountId: string, args: any) {
  const query = String(args?.query || '').trim();
  if (!query) return { matches: [] };

  const { results } = await env.DB.prepare(
    `SELECT id, name, company, email, phone, whatsapp, city, country, preferred_currency
       FROM customers WHERE account_id = ?`
  ).bind(accountId).all();

  const scored = (results as any[])
    .map(c => ({
      customer: c,
      score: scoreMatch(query, [c.name, c.company, c.email, c.phone, c.whatsapp]),
    }))
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  // Tea Discovery disposition for the matched customers — keyed per-person by
  // email, so a tea master sees how each person likes to drink before replying.
  const emails = scored.map(s => s.customer.email).filter(Boolean) as string[];
  const dispositionByEmail = new Map<string, { name: string | null; level: string | null }>();
  if (emails.length > 0) {
    const placeholders = emails.map(() => '?').join(',');
    const { results: discRows } = await env.DB.prepare(
      `SELECT user_id, disposition_name, level FROM customer_tea_discovery WHERE user_id IN (${placeholders})`
    ).bind(...emails).all();
    for (const d of discRows as any[]) {
      dispositionByEmail.set(d.user_id, { name: d.disposition_name ?? null, level: d.level ?? null });
    }
  }

  return {
    matches: scored.map(s => {
      const disc = s.customer.email ? dispositionByEmail.get(s.customer.email) : undefined;
      return {
        id: s.customer.id,
        name: s.customer.name,
        company: s.customer.company,
        email: s.customer.email,
        phone: s.customer.phone,
        whatsapp: s.customer.whatsapp,
        city: s.customer.city,
        country: s.customer.country,
        preferred_currency: s.customer.preferred_currency,
        tea_disposition: disc ? disc.name : null,
        tea_level: disc ? disc.level : null,
        match_score: Math.round(s.score * 100) / 100,
      };
    }),
  };
}

// ── tool: get_account_context ──
//
// Lets the model orient itself before quoting prices or numbering invoices:
// which account it's on, the default currency + invoice prefix, the WhatsApp
// number used for checkout, and a few live counts. Without this the model
// silently assumes USD and has no idea how many invoices are unpaid.
async function toolGetAccountContext(env: Env, accountId: string) {
  const acct = await env.DB.prepare(
    `SELECT id, name, slug, currency_default, invoice_prefix, invoice_seq,
            whatsapp_number, contact_email, location_city, location_country,
            timezone, status,
            default_shipping_rate_per_kg, default_shipping_rate_currency
       FROM accounts WHERE id = ?`
  ).bind(accountId).first() as Record<string, any> | null;
  if (!acct) return { error: 'account_not_found' };

  const counts = await env.DB.prepare(
    `SELECT
        (SELECT COUNT(*) FROM products WHERE account_id = ?1 AND status != 'Archived') AS active_products,
        (SELECT COUNT(*) FROM products WHERE account_id = ?1 AND status != 'Archived'
           AND low_stock_threshold IS NOT NULL AND stock_grams < low_stock_threshold) AS low_stock,
        (SELECT COUNT(*) FROM invoices WHERE account_id = ?1 AND deleted_at IS NULL
           AND status != 'Void' AND COALESCE(payment_status, 'unpaid') != 'paid') AS unpaid_invoices,
        (SELECT COUNT(*) FROM customers WHERE account_id = ?1) AS customers`
  ).bind(accountId).first() as Record<string, any> | null;

  /* With last_updated, because the age of a rate is the thing that goes wrong
     and it is invisible in the number itself. Every price in the shop converts
     through these, so "when was this refreshed" has to be answerable in one
     call rather than by reading the database by hand. */
  const { results: rateRows } = await env.DB.prepare(
    'SELECT currency, rate_to_usd, last_updated FROM exchange_rates ORDER BY currency'
  ).all();
  const rates = (rateRows as Array<Record<string, any>>).map(r => {
    const stamp = r.last_updated ? new Date(`${String(r.last_updated).replace(' ', 'T')}Z`).getTime() : NaN;
    const ageHours = Number.isFinite(stamp) ? (Date.now() - stamp) / 3600000 : null;
    return {
      currency: r.currency,
      rate_to_usd: r.rate_to_usd,
      last_updated: r.last_updated ?? null,
      // The daily refresh runs every 24h, so past 36 it has missed at least one.
      stale: ageHours === null || ageHours > 36,
    };
  });

  return {
    account: {
      id: acct.id,
      name: acct.name,
      slug: acct.slug,
      default_currency: acct.currency_default,
      invoice_prefix: acct.invoice_prefix,
      next_invoice_seq: (Number(acct.invoice_seq) || 0) + 1,
      whatsapp_number: acct.whatsapp_number,
      contact_email: acct.contact_email,
      location: [acct.location_city, acct.location_country].filter(Boolean).join(', ') || null,
      timezone: acct.timezone,
      status: acct.status,
      /* The shop's freight rate, so a model quoting a price knows what is
         already inside the cost basis and does not add postage a second time.
         Null means this shop has never set one and the fallback applies. */
      freight_rate_per_kg: acct.default_shipping_rate_per_kg ?? null,
      freight_rate_currency: acct.default_shipping_rate_currency ?? null,
    },
    counts: counts ?? {},
    exchange_rates: rates,
  };
}

// ── tool: get_customer ──
//
// Full profile for one customer by id, including tags, lifetime spend, and the
// last 10 invoices. find_customer locates the id; this reads the dossier.
async function toolGetCustomer(env: Env, accountId: string, args: any) {
  const id = String(args?.id || '').trim();
  if (!id) throw new Error('id is required');

  const customer = await env.DB.prepare(
    `SELECT id, name, company, email, phone, whatsapp, address, city, country,
            preferred_currency, notes, source, created_at
       FROM customers WHERE id = ? AND account_id = ?`
  ).bind(id, accountId).first() as Record<string, any> | null;
  if (!customer) return { error: 'not_found' };

  const { results: tagRows } = await env.DB.prepare(
    'SELECT tag FROM customer_tags WHERE account_id = ? AND customer_id = ? ORDER BY tag ASC'
  ).bind(accountId, id).all();

  const { results: invoices } = await env.DB.prepare(
    `SELECT i.id, i.invoice_number, i.status, i.payment_status, i.created_at,
            COALESCE((SELECT SUM(quantity * price_at_sale) FROM invoice_line_items WHERE invoice_id = i.id), 0) AS total_usd
       FROM invoices i
      WHERE i.account_id = ? AND i.customer_id = ? AND i.deleted_at IS NULL
      ORDER BY i.created_at DESC LIMIT 10`
  ).bind(accountId, id).all();

  const lifetime = await env.DB.prepare(
    `SELECT
        COUNT(DISTINCT i.id) AS invoice_count,
        COALESCE(SUM(ili.quantity * ili.price_at_sale), 0) AS lifetime_spend_usd
       FROM invoices i
       JOIN invoice_line_items ili ON ili.invoice_id = i.id
      WHERE i.account_id = ? AND i.customer_id = ? AND i.deleted_at IS NULL AND i.status != 'Void'`
  ).bind(accountId, id).first() as Record<string, any> | null;

  return {
    ...customer,
    tags: (tagRows as any[]).map(r => r.tag),
    lifetime_spend_usd: Math.round(Number(lifetime?.lifetime_spend_usd || 0) * 100) / 100,
    invoice_count: Number(lifetime?.invoice_count || 0),
    recent_invoices: invoices,
  };
}

// ── tool: list_invoices ──
//
// The read side that voiding/fulfilling/marking-paid previously lacked — the
// model can now FIND an invoice id instead of guessing or relying on "most
// recent unpaid". Filterable by status, payment_status, customer, or free text.
async function toolListInvoices(env: Env, accountId: string, args: any) {
  const limit = Math.min(Math.max(Number(args?.limit) || 20, 1), 100);
  const wheres: string[] = ['i.account_id = ?', 'i.deleted_at IS NULL'];
  const binds: any[] = [accountId];

  if (args?.status) { wheres.push('i.status = ?'); binds.push(String(args.status)); }
  if (args?.payment_status) { wheres.push("COALESCE(i.payment_status, 'unpaid') = ?"); binds.push(String(args.payment_status)); }
  if (args?.customer_id) { wheres.push('i.customer_id = ?'); binds.push(String(args.customer_id)); }
  if (args?.unpaid_only) { wheres.push("COALESCE(i.payment_status, 'unpaid') != 'paid' AND i.status != 'Void'"); }
  if (args?.query) {
    const q = `%${String(args.query).trim()}%`;
    wheres.push('(i.invoice_number LIKE ? OR i.customer_name LIKE ?)');
    binds.push(q, q);
  }

  const { results } = await env.DB.prepare(
    `SELECT i.id, i.invoice_number, i.customer_name, i.customer_id, i.status,
            COALESCE(i.payment_status, 'unpaid') AS payment_status, i.created_at,
            COALESCE((SELECT SUM(quantity * price_at_sale) FROM invoice_line_items WHERE invoice_id = i.id), 0) AS total_usd
       FROM invoices i
      WHERE ${wheres.join(' AND ')}
      ORDER BY i.created_at DESC
      LIMIT ?`
  ).bind(...binds, limit).all();

  return {
    invoices: (results as any[]).map(r => ({ ...r, total_usd: Math.round(Number(r.total_usd) * 100) / 100 })),
    count: results.length,
  };
}

// ── tool: get_invoice ──
//
// Full invoice by id or invoice_number, with line items. Pairs with the write
// tools (update_invoice / void_invoice / fulfill_invoice / mark_invoice_paid).
async function toolGetInvoice(env: Env, accountId: string, args: any) {
  const id = args?.invoice_id ? String(args.invoice_id).trim() : '';
  const number = args?.invoice_number ? String(args.invoice_number).trim() : '';
  if (!id && !number) throw new Error('invoice_id or invoice_number is required');

  const invoice = id
    ? await env.DB.prepare(
        `SELECT * FROM invoices WHERE id = ? AND account_id = ? AND deleted_at IS NULL`
      ).bind(id, accountId).first() as Record<string, any> | null
    : await env.DB.prepare(
        `SELECT * FROM invoices WHERE invoice_number = ? AND account_id = ? AND deleted_at IS NULL`
      ).bind(number, accountId).first() as Record<string, any> | null;

  if (!invoice) return { error: 'invoice_not_found' };

  const { results: items } = await env.DB.prepare(
    `SELECT ili.product_id, ili.custom_name, ili.quantity, ili.price_at_sale,
            p.given_name, p.product_name,
            ROUND(ili.quantity * ili.price_at_sale, 2) AS line_total_usd
       FROM invoice_line_items ili
       LEFT JOIN products p ON p.id = ili.product_id AND p.account_id = ?
      WHERE ili.invoice_id = ? AND ili.account_id = ?`
  ).bind(accountId, invoice.id, accountId).all();

  const total = (items as any[]).reduce((s, l) => s + Number(l.line_total_usd || 0), 0);

  return {
    invoice: {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_name: invoice.customer_name,
      customer_id: invoice.customer_id,
      customer_whatsapp: invoice.customer_whatsapp,
      status: invoice.status,
      payment_status: invoice.payment_status ?? 'unpaid',
      payment_date: invoice.payment_date ?? null,
      payment_method: invoice.payment_method ?? null,
      inventory_deducted: !!invoice.inventory_deducted,
      notes: invoice.notes ?? null,
      created_at: invoice.created_at,
    },
    line_items: (items as any[]).map(l => ({
      product_id: l.product_id,
      product_name: l.given_name || l.product_name || l.custom_name || '(custom item)',
      grams: l.quantity,
      price_per_gram_usd: l.price_at_sale,
      line_total_usd: l.line_total_usd,
    })),
    total_usd: Math.round(total * 100) / 100,
  };
}

// ── tool: sales_summary ──
//
// Revenue + volume over a recent window, with the top teas by revenue. Answers
// "how did this week go?" — previously unanswerable through MCP.
async function toolSalesSummary(env: Env, accountId: string, args: any) {
  const days = Math.min(Math.max(Number(args?.days) || 30, 1), 365);
  const since = `-${days} days`;

  const totals = await env.DB.prepare(
    `SELECT
        COUNT(DISTINCT i.id) AS invoice_count,
        COUNT(DISTINCT CASE WHEN COALESCE(i.payment_status, 'unpaid') = 'paid' THEN i.id END) AS paid_count,
        COUNT(DISTINCT CASE WHEN COALESCE(i.payment_status, 'unpaid') != 'paid' THEN i.id END) AS unpaid_count,
        COALESCE(SUM(ili.quantity * ili.price_at_sale), 0) AS gross_revenue_usd,
        COALESCE(SUM(ili.quantity), 0) AS grams_sold
       FROM invoices i
       JOIN invoice_line_items ili ON ili.invoice_id = i.id
      WHERE i.account_id = ? AND i.deleted_at IS NULL AND i.status != 'Void'
        AND i.created_at >= datetime('now', ?)`
  ).bind(accountId, since).first() as Record<string, any> | null;

  const { results: topProducts } = await env.DB.prepare(
    `SELECT ili.product_id,
            COALESCE(p.given_name, p.product_name, ili.custom_name, '(custom)') AS product_name,
            SUM(ili.quantity) AS grams_sold,
            ROUND(SUM(ili.quantity * ili.price_at_sale), 2) AS revenue_usd
       FROM invoices i
       JOIN invoice_line_items ili ON ili.invoice_id = i.id
       LEFT JOIN products p ON p.id = ili.product_id AND p.account_id = ?
      WHERE i.account_id = ? AND i.deleted_at IS NULL AND i.status != 'Void'
        AND i.created_at >= datetime('now', ?)
      GROUP BY ili.product_id
      ORDER BY revenue_usd DESC
      LIMIT 5`
  ).bind(accountId, accountId, since).all();

  return {
    period_days: days,
    invoice_count: Number(totals?.invoice_count || 0),
    paid_count: Number(totals?.paid_count || 0),
    unpaid_count: Number(totals?.unpaid_count || 0),
    gross_revenue_usd: Math.round(Number(totals?.gross_revenue_usd || 0) * 100) / 100,
    grams_sold: Number(totals?.grams_sold || 0),
    top_products: topProducts,
  };
}

// ── tool: add_stock (preview / confirm) ──
async function toolAddStock(env: Env, auth: McpAuth, args: any) {
  const productId = String(args?.id || '').trim();
  const grams = Number(args?.grams);
  const note = args?.note ? String(args.note).slice(0, 500) : null;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!productId) throw new Error('id is required');
  if (!Number.isFinite(grams) || grams <= 0) throw new Error('grams must be a positive number');

  if (!confirm) {
    const product = await env.DB.prepare(
      'SELECT id, given_name, product_name, stock_grams FROM products WHERE id = ? AND account_id = ?'
    ).bind(productId, auth.accountId).first() as ProductRow | null;
    if (!product) return { error: 'not_found' };

    const current = Number(product.stock_grams || 0);
    const next = current + grams;
    const token = await issueConfirmationToken(env, {
      kind: 'add_stock', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, grams, note,
    }, auth.tokenId);
    return {
      preview: {
        action: 'add_stock',
        product: { id: product.id, name: product.given_name || product.product_name },
        delta_grams: grams,
        balance_before: current,
        balance_after: next,
        note,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'add_stock' || pending.productId !== productId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitAddStock(env, pending);
}

async function commitAddStock(env: Env, m: Extract<PendingMutation, { kind: 'add_stock' }>) {
  const product = await env.DB.prepare(
    'SELECT id, stock_grams, given_name, product_name FROM products WHERE id = ? AND account_id = ?'
  ).bind(m.productId, m.accountId).first() as { id: string; stock_grams: number; given_name: string | null; product_name: string } | null;
  if (!product) return { error: 'not_found' };

  const balanceAfter = Number(product.stock_grams || 0) + m.grams;
  const batchId = await resolveUnsortedBatchId(env, m.accountId);

  await env.DB.batch([
    env.DB.prepare('UPDATE products SET stock_grams = stock_grams + ? WHERE id = ? AND account_id = ?')
      .bind(m.grams, m.productId, m.accountId),
    env.DB.prepare(
      'UPDATE product_listings SET stock_grams = stock_grams + ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(m.grams, `list_${m.productId}`),
    env.DB.prepare(
      `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, user_email, note, batch_id, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), m.productId, m.grams, balanceAfter, 'PURCHASE_RECEIPT', m.userEmail, m.note ?? `MCP add_stock`, batchId, m.accountId),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), 'STOCK_ADDED_MCP',
      `+${m.grams}g via MCP — ${product.given_name || product.product_name}`,
      m.userEmail, 'product', m.productId, m.accountId,
    ),
  ]);

  return {
    committed: true,
    action: 'add_stock',
    product: { id: product.id, name: product.given_name || product.product_name },
    delta_grams: m.grams,
    balance_after: balanceAfter,
  };
}

// ── tool: remove_stock (preview / confirm) ──
async function toolRemoveStock(env: Env, auth: McpAuth, args: any) {
  const productId = String(args?.id || '').trim();
  const grams = Number(args?.grams);
  const reason = String(args?.reason || 'MANUAL_ADJUST').toUpperCase();
  const note = args?.note ? String(args.note).slice(0, 500) : null;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!productId) throw new Error('id is required');
  if (!Number.isFinite(grams) || grams <= 0) throw new Error('grams must be a positive number');
  const allowedReasons = ['MANUAL_ADJUST', 'WASTE', 'SAMPLE', 'PERSONAL'];
  if (!allowedReasons.includes(reason)) throw new Error(`reason must be one of: ${allowedReasons.join(', ')}`);

  if (!confirm) {
    const product = await env.DB.prepare(
      'SELECT id, given_name, product_name, stock_grams FROM products WHERE id = ? AND account_id = ?'
    ).bind(productId, auth.accountId).first() as ProductRow | null;
    if (!product) return { error: 'not_found' };

    const current = Number(product.stock_grams || 0);
    if (grams > current) {
      return {
        error: 'insufficient_stock',
        requested_grams: grams,
        available_grams: current,
        product: { id: product.id, name: product.given_name || product.product_name },
      };
    }
    const next = current - grams;
    const token = await issueConfirmationToken(env, {
      kind: 'remove_stock', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, grams, reason, note,
    }, auth.tokenId);
    return {
      preview: {
        action: 'remove_stock',
        product: { id: product.id, name: product.given_name || product.product_name },
        delta_grams: -grams,
        balance_before: current,
        balance_after: next,
        reason,
        note,
        warning: next === 0 ? 'This deduction will set stock to zero (product will be marked Sold Out).' : null,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'remove_stock' || pending.productId !== productId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitRemoveStock(env, pending);
}

async function commitRemoveStock(env: Env, m: Extract<PendingMutation, { kind: 'remove_stock' }>) {
  const product = await env.DB.prepare(
    'SELECT id, stock_grams, given_name, product_name, status FROM products WHERE id = ? AND account_id = ?'
  ).bind(m.productId, m.accountId).first() as { id: string; stock_grams: number; given_name: string | null; product_name: string; status: string } | null;
  if (!product) return { error: 'not_found' };

  const current = Number(product.stock_grams || 0);
  if (m.grams > current) {
    return { error: 'insufficient_stock', requested_grams: m.grams, available_grams: current };
  }

  // Atomic, conditional decrement. The earlier SELECT is advisory only — two
  // concurrent removes could both pass it and oversell. The `stock_grams >= ?`
  // guard makes the deduction safe under concurrency: if another writer got
  // there first and stock is now insufficient, the UPDATE matches no row and
  // we bail BEFORE writing the ledger/listing/sold-out rows. Run it standalone
  // (not in the batch) so we can branch on the RETURNING result.
  const decremented = await env.DB.prepare(
    'UPDATE products SET stock_grams = stock_grams - ? WHERE id = ? AND account_id = ? AND stock_grams >= ? RETURNING stock_grams'
  ).bind(m.grams, m.productId, m.accountId, m.grams).first() as { stock_grams: number } | null;
  if (!decremented) {
    // Re-read live stock for an accurate available figure in the error.
    const live = await env.DB.prepare('SELECT stock_grams FROM products WHERE id = ? AND account_id = ?')
      .bind(m.productId, m.accountId).first() as { stock_grams: number } | null;
    return { error: 'insufficient_stock', requested_grams: m.grams, available_grams: Number(live?.stock_grams ?? 0) };
  }
  const balanceAfter = Number(decremented.stock_grams);

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      'UPDATE product_listings SET stock_grams = MAX(0, stock_grams - ?), updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(m.grams, `list_${m.productId}`),
    env.DB.prepare(
      `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, user_email, note, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), m.productId, -m.grams, balanceAfter, m.reason, m.userEmail, m.note ?? `MCP remove_stock`, m.accountId),
  ];

  if (balanceAfter === 0 && product.status !== 'Sold Out') {
    stmts.push(env.DB.prepare(
      "UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ? AND account_id = ?"
    ).bind(m.productId, m.accountId));
  }

  stmts.push(env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    crypto.randomUUID(), 'STOCK_REMOVED_MCP',
    `-${m.grams}g via MCP (${m.reason}) — ${product.given_name || product.product_name}`,
    m.userEmail, 'product', m.productId, m.accountId,
  ));

  await env.DB.batch(stmts);

  return {
    committed: true,
    action: 'remove_stock',
    product: { id: product.id, name: product.given_name || product.product_name },
    delta_grams: -m.grams,
    balance_after: balanceAfter,
    reason: m.reason,
    sold_out: balanceAfter === 0,
  };
}

// ── tool: record_sale (preview / confirm) ──
//
// Creates an invoice and immediately fills it, going through the existing
// fulfillment path so stock_ledger, listing mirrors, low-stock alerts, and
// sold-out auto-archiving all fire correctly.

async function toolRecordSale(env: Env, auth: McpAuth, args: any) {
  const lines = Array.isArray(args?.lines) ? args.lines : [];
  const customerId = args?.customer_id ? String(args.customer_id) : null;
  const customerName = args?.customer_name ? String(args.customer_name).trim() : '';
  const customerWhatsapp = args?.customer_whatsapp ? String(args.customer_whatsapp).trim() : null;
  const notes = args?.notes ? String(args.notes).slice(0, 1000) : null;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (confirm) {
    const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
    if (!pending || pending.kind !== 'record_sale'
      || pending.accountId !== auth.accountId || pending.actorUserId !== auth.userId) {
      return { error: 'invalid_or_expired_confirmation_token' };
    }
    return commitRecordSale(env, pending, auth);
  }

  if (lines.length === 0) throw new Error('lines must be a non-empty array');
  if (!customerName && !customerId) throw new Error('customer_name or customer_id is required');

  // Validate every line and build a preview.
  const previewLines: Array<{
    product_id: string;
    product_name: string;
    grams: number;
    price_per_gram_usd: number;
    line_total_usd: number;
    available_grams: number;
    insufficient: boolean;
  }> = [];

  let customerNameResolved = customerName;
  if (customerId) {
    const c = await env.DB.prepare('SELECT name FROM customers WHERE id = ? AND account_id = ?')
      .bind(customerId, auth.accountId).first() as { name: string } | null;
    if (!c) return { error: 'customer_not_found' };
    if (!customerNameResolved) customerNameResolved = c.name;
  }

  for (const raw of lines) {
    const productId = String(raw?.product_id || '').trim();
    const grams = Number(raw?.grams);
    const pricePerGramUsd = Number(raw?.price_per_gram_usd);
    if (!productId) throw new Error('lines[].product_id is required');
    if (!Number.isFinite(grams) || grams <= 0) throw new Error('lines[].grams must be > 0');
    if (!Number.isFinite(pricePerGramUsd) || pricePerGramUsd < 0) throw new Error('lines[].price_per_gram_usd must be >= 0');

    const p = await env.DB.prepare(
      'SELECT id, given_name, product_name, stock_grams FROM products WHERE id = ? AND account_id = ?'
    ).bind(productId, auth.accountId).first() as ProductRow | null;
    if (!p) return { error: 'product_not_found', product_id: productId };

    const available = Math.max(0, Number(p.stock_grams || 0) - await activeHeldGrams(env, auth.accountId, productId));
    previewLines.push({
      product_id: productId,
      product_name: p.given_name || p.product_name,
      grams,
      price_per_gram_usd: pricePerGramUsd,
      line_total_usd: Math.round(grams * pricePerGramUsd * 100) / 100,
      available_grams: available,
      insufficient: grams > available,
    });
  }

  const insufficient = previewLines.filter(l => l.insufficient);
  if (insufficient.length > 0 && !confirm) {
    return {
      error: 'insufficient_stock',
      lines: insufficient,
      message: 'One or more line items exceed available stock. Adjust grams or restock first.',
    };
  }

  try {
    await authorizeInvoiceLines(env, {
      accountId: auth.accountId,
      actorUserId: auth.userId,
      actorRole: OWNER_TIERS.has(auth.creatorTier) ? 'owner' : 'staff',
      lines: previewLines.map(line => ({
        product_id: line.product_id, quantity: line.grams, price_at_sale: line.price_per_gram_usd,
      })),
    });
  } catch (error) {
    if (error instanceof SalesInvariantError) return { error: error.code, ...error.details };
    return { error: 'sales_authorization_unavailable' };
  }

  const total = previewLines.reduce((s, l) => s + l.line_total_usd, 0);

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'record_sale', accountId: auth.accountId, userEmail: auth.userEmail,
      actorUserId: auth.userId, actorRole: OWNER_TIERS.has(auth.creatorTier) ? 'owner' : 'staff',
      lines: previewLines.map(l => ({ productId: l.product_id, grams: l.grams, pricePerGramUsd: l.price_per_gram_usd })),
      customerId, customerName: customerNameResolved, customerWhatsapp, notes,
    }, auth.tokenId);
    return {
      preview: {
        action: 'record_sale',
        customer: { id: customerId, name: customerNameResolved, whatsapp: customerWhatsapp },
        lines: previewLines.map(l => ({
          product: { id: l.product_id, name: l.product_name },
          grams: l.grams, price_per_gram_usd: l.price_per_gram_usd, line_total_usd: l.line_total_usd,
          available_grams_before: l.available_grams,
        })),
        total_usd: Math.round(total * 100) / 100,
        notes,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  return { error: 'invalid_or_expired_confirmation_token' };
}

async function commitRecordSale(
  env: Env,
  m: Extract<PendingMutation, { kind: 'record_sale' }>,
  auth: McpAuth,
) {
  const currentActorRole = OWNER_TIERS.has(auth.creatorTier) ? 'owner' : 'staff';
  let authorizedLines;
  try {
    authorizedLines = await authorizeInvoiceLines(env, {
      accountId: m.accountId, actorUserId: auth.userId, actorRole: currentActorRole,
      lines: m.lines.map(line => ({ product_id: line.productId, quantity: line.grams, price_at_sale: line.pricePerGramUsd })),
    });
  } catch (error) {
    if (error instanceof SalesInvariantError) return { error: error.code, ...error.details };
    return { error: 'sales_authorization_unavailable' };
  }
  // Re-validate + fetch product metadata at commit time — the preview window
  // is 5min and stock could have changed via another channel.
  const productCache = new Map<string, { id: string; stock_grams: number; given_name: string | null; product_name: string; status: string; low_stock_threshold: number | null; source_compass_entry_id: string | null }>();
  for (const line of m.lines) {
    const p = await env.DB.prepare(
      'SELECT id, stock_grams, given_name, product_name, status, low_stock_threshold, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
    ).bind(line.productId, m.accountId).first() as any;
    if (!p) return { error: 'product_not_found', product_id: line.productId };
    productCache.set(line.productId, p);
  }

  // Aggregate duplicate product lines so one guarded write checks the complete
  // sale quantity. The write is added to the invoice mutation batch below;
  // forcing -1 on insufficient available stock invokes the nonnegative-stock
  // trigger and aborts the entire D1 transaction.
  const quantities = new Map<string, number>();
  for (const line of m.lines) {
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.grams);
  }
  const balances = new Map<string, number>();
  for (const [productId, grams] of quantities) {
    balances.set(productId, Number(productCache.get(productId)!.stock_grams || 0) - grams);
  }

  // Allocate invoice number using the existing per-account sequence.
  const seqRow = await env.DB.prepare(
    'UPDATE accounts SET invoice_seq = invoice_seq + 1 WHERE id = ? RETURNING invoice_seq, invoice_prefix'
  ).bind(m.accountId).first() as { invoice_seq: number; invoice_prefix: string | null } | null;
  const seq = seqRow?.invoice_seq ?? 1;
  const pfx = seqRow?.invoice_prefix || '';
  const invoiceNumber = formatInvoiceNumber(pfx || null, seq);

  const invoiceId = crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [];
  const stockOwners = [...new Set(authorizedLines.map(line => line.stock_owner_user_id))];
  const paymentRecipientUserId = stockOwners.length === 1 ? stockOwners[0] : null;

  // Invoice + line items, written as Filled with inventory_deducted=1 in one pass.
  // Stock has already been deducted above; this batch records the invoice,
  // ledger, listing mirror, and status side effects.
  stmts.push(env.DB.prepare(
    `INSERT INTO invoices
       (id, account_id, invoice_number, customer_name, customer_whatsapp, customer_id,
        display_currency, shipping_cost_usd, status, inventory_deducted, fulfilled_at, notes, payment_status,
        sold_by_user_id,payment_recipient_user_id)
     VALUES (?, ?, ?, ?, ?, ?, 'USD', 0, 'Filled', 1, datetime('now'), ?, 'unpaid',?,?)`
  ).bind(
    invoiceId, m.accountId, invoiceNumber,
    m.customerName, m.customerWhatsapp, m.customerId, m.notes, auth.userId, paymentRecipientUserId,
  ));

  for (const [productId, grams] of quantities) {
    stmts.push(env.DB.prepare(
      `UPDATE products SET stock_grams = CASE
         WHEN stock_grams - COALESCE((SELECT SUM(held_grams) FROM stock_holds
           WHERE account_id=? AND product_id=? AND (expires_at IS NULL OR expires_at>datetime('now'))),0) >= ?
         THEN stock_grams - ? ELSE -1 END
       WHERE id=? AND account_id=?`
    ).bind(m.accountId, productId, grams, grams, productId, m.accountId));
  }

  for (let lineIndex = 0; lineIndex < m.lines.length; lineIndex += 1) {
    const line = m.lines[lineIndex];
    const authorized = authorizedLines[lineIndex];

    const lineId = crypto.randomUUID();
    authorized.id = lineId;
    stmts.push(env.DB.prepare(
      `INSERT INTO invoice_line_items
       (id,account_id,invoice_id,product_id,quantity,price_at_sale,stock_owner_user_id,sales_grant_id,owner_share_type,owner_share_value)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    ).bind(lineId, m.accountId, invoiceId, line.productId, line.grams, line.pricePerGramUsd,
      authorized.stock_owner_user_id, authorized.sales_grant_id, authorized.owner_share_type, authorized.owner_share_value));
  }

  for (const [productId, grams] of quantities) {
    const p = productCache.get(productId)!;
    const currentStock = Number(p.stock_grams || 0);
    const balanceAfter = balances.get(productId)!;
    const threshold = Number(p.low_stock_threshold || 0);
    stmts.push(env.DB.prepare(
      'UPDATE product_listings SET stock_grams = MAX(0, stock_grams - ?), updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(grams, `list_${productId}`));

    stmts.push(env.DB.prepare(
      `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, source_invoice_id, source_invoice_number, user_email, note, account_id)
       SELECT ?, ?, ?, p.stock_grams, 'FULFILLMENT', ?, ?, ?, ?, ?
       FROM products p WHERE p.id=? AND p.account_id=?`
    ).bind(
      crypto.randomUUID(), productId, -grams,
      invoiceId, invoiceNumber, m.userEmail, 'MCP record_sale', m.accountId,
      productId, m.accountId,
    ));

    if (balanceAfter <= 0 && p.status !== 'Sold Out') {
      stmts.push(env.DB.prepare(
        "UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ? AND account_id = ?"
      ).bind(productId, m.accountId));
    } else if (threshold > 0 && balanceAfter < threshold && currentStock >= threshold) {
      stmts.push(env.DB.prepare(
        `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
         VALUES (?, 'low_stock_alert', ?, ?, 'product', ?, ?)`
      ).bind(
        crypto.randomUUID(),
        JSON.stringify({ productName: p.given_name || p.product_name, stockGrams: balanceAfter, threshold }),
        m.userEmail, productId, m.accountId,
      ));
    }
  }

  stmts.push(...buildSettlementStatements(env, {
    accountId: m.accountId,
    invoice: { id: invoiceId, sold_by_user_id: auth.userId },
    lines: authorizedLines,
  }));

  stmts.push(env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'INVOICE_CREATED_MCP', ?, ?, 'invoice', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    `Invoice ${invoiceNumber} created + filled via MCP for ${m.customerName} (${m.lines.length} items)`,
    m.userEmail, invoiceId, m.accountId,
  ));

  try {
    await env.DB.batch(stmts);
  } catch (error) {
    if (/stock_grams cannot be negative/i.test(String((error as Error)?.message || error))) {
      return { error: 'insufficient_stock_at_commit' };
    }
    throw error;
  }

  return {
    committed: true,
    action: 'record_sale',
    invoice: {
      id: invoiceId,
      invoice_number: invoiceNumber,
      status: 'Filled',
      customer_name: m.customerName,
      total_usd: Math.round(m.lines.reduce((s, l) => s + l.grams * l.pricePerGramUsd, 0) * 100) / 100,
      line_count: m.lines.length,
    },
    next_step_hint: 'Phase 2 will add a send_invoice tool to email the PDF; for now download or share from the admin UI.',
  };
}

// ── tool: create_customer (preview / confirm) ──
async function toolCreateCustomer(env: Env, auth: McpAuth, args: any) {
  const name = args?.name ? String(args.name).trim() : '';
  const whatsapp = args?.whatsapp ? String(args.whatsapp).trim() : null;
  const email = args?.email ? String(args.email).trim() : null;
  const phone = args?.phone ? String(args.phone).trim() : null;
  const notes = args?.notes ? String(args.notes).slice(0, 1000) : null;
  const tags: string[] = Array.isArray(args?.tags) ? args.tags.map(String) : [];
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!name) throw new Error('name is required');

  // Warn about potential duplicates (reuse find_customer scoring).
  const existing = await toolFindCustomer(env, auth.accountId, { query: name });
  const topMatch = (existing.matches as any[])[0];
  const duplicateWarning = topMatch && topMatch.match_score >= 0.7
    ? `Similar customer already exists: "${topMatch.name}" (id: ${topMatch.id}, score: ${topMatch.match_score}). Confirm to create a new record anyway.`
    : null;

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'create_customer', accountId: auth.accountId, userEmail: auth.userEmail,
      name, whatsapp, email, phone, notes, tags,
    }, auth.tokenId);
    return {
      preview: {
        action: 'create_customer',
        record: { name, whatsapp, email, phone, notes, tags },
        duplicate_warning: duplicateWarning,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'create_customer') {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitCreateCustomer(env, pending);
}

async function commitCreateCustomer(env: Env, m: Extract<PendingMutation, { kind: 'create_customer' }>) {
  const id = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO customers (id, account_id, name, whatsapp, email, phone, notes, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, m.accountId, m.name, m.whatsapp, m.email, m.phone, m.notes, JSON.stringify(m.tags)),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'CUSTOMER_CREATED_MCP', ?, ?, 'customer', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Customer "${m.name}" created via MCP`,
      m.userEmail, id, m.accountId,
    ),
  ]);
  return {
    committed: true,
    action: 'create_customer',
    customer: { id, name: m.name, whatsapp: m.whatsapp, email: m.email },
  };
}

// ── tool: update_customer (preview / confirm) ──
async function toolUpdateCustomer(env: Env, auth: McpAuth, args: any) {
  const customerId = String(args?.customer_id || '').trim();
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!customerId) throw new Error('customer_id is required');

  const allowed = ['name', 'whatsapp', 'email', 'phone', 'notes'] as const;
  const fields: Record<string, string | null> = {};
  for (const f of allowed) {
    if (f in (args || {})) fields[f] = args[f] ? String(args[f]).trim() : null;
  }
  if (Object.keys(fields).length === 0) throw new Error('At least one field to update is required');

  const customer = await env.DB.prepare(
    'SELECT id, name, whatsapp, email, phone, notes FROM customers WHERE id = ? AND account_id = ?'
  ).bind(customerId, auth.accountId).first() as Record<string, any> | null;
  if (!customer) return { error: 'customer_not_found' };

  if (!confirm) {
    const changes: Record<string, { old: any; new: any }> = {};
    for (const [k, v] of Object.entries(fields)) {
      changes[k] = { old: customer[k] ?? null, new: v };
    }
    const token = await issueConfirmationToken(env, {
      kind: 'update_customer', accountId: auth.accountId, userEmail: auth.userEmail,
      customerId, fields,
    }, auth.tokenId);
    return {
      preview: {
        action: 'update_customer',
        customer: { id: customerId, name: customer.name },
        changes,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'update_customer' || pending.customerId !== customerId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitUpdateCustomer(env, pending);
}

async function commitUpdateCustomer(env: Env, m: Extract<PendingMutation, { kind: 'update_customer' }>) {
  const cols = Object.keys(m.fields);
  if (cols.length === 0) return { committed: true, action: 'update_customer', changes: 0 };

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.batch([
    env.DB.prepare(`UPDATE customers SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
      .bind(...cols.map(c => m.fields[c]), m.customerId, m.accountId),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'CUSTOMER_UPDATED_MCP', ?, ?, 'customer', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Customer ${m.customerId} updated via MCP: ${cols.join(', ')}`,
      m.userEmail, m.customerId, m.accountId,
    ),
  ]);
  return {
    committed: true,
    action: 'update_customer',
    customer_id: m.customerId,
    updated_fields: cols,
  };
}

// ── tool: update_tea_pricing (preview / confirm) ──
async function toolUpdateTeaPricing(env: Env, auth: McpAuth, args: any) {
  const productId = String(args?.product_id || '').trim();
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!productId) throw new Error('product_id is required');

  const hasNewCost = 'cost_amount' in (args || {}) || 'cost_currency' in (args || {});
  const hasNewRetail = 'retail_price_usd' in (args || {});
  const hasNewQty = 'quantity_purchased' in (args || {});
  const hasNewDesc = typeof args?.description === 'string';
  const hasNewStockVerify = 'stock_verified' in (args || {});
  const hasNewShipping = 'shipping_rate_per_kg' in (args || {});
  const hasNewTasting = Array.isArray(args?.tasting_notes);
  const hasNewOrigin = 'origin_country' in (args || {}) || 'origin_region' in (args || {});
  const hasNewLore = typeof args?.lore === 'string';
  const hasNewTerroir = typeof args?.terroir === 'string';
  const hasNewProcessing = typeof args?.processing_notes === 'string';
  const hasNewYear = 'year' in (args || {});
  const hasNewStatus = typeof args?.status === 'string';
  const status: string | null = hasNewStatus ? String(args.status).trim() : null;
  if (!hasNewCost && !hasNewRetail && !hasNewQty && !hasNewYear && !hasNewStatus && !hasNewDesc && !hasNewStockVerify && !hasNewShipping && !hasNewTasting && !hasNewOrigin && !hasNewLore && !hasNewTerroir && !hasNewProcessing) {
    throw new Error('At least one of cost_amount, cost_currency, retail_price_usd, quantity_purchased, year, status, description, lore, terroir, processing_notes, stock_verified, shipping_rate_per_kg, tasting_notes, or origin_country/origin_region is required');
  }

  const costAmount: number | null = 'cost_amount' in (args || {}) ? Number(args.cost_amount) : null;
  const costCurrency: string | null = args?.cost_currency ? String(args.cost_currency).toUpperCase().trim() : null;
  const retailPriceUsd: number | null = 'retail_price_usd' in (args || {}) ? Number(args.retail_price_usd) : null;
  const quantityPurchased: number | null = 'quantity_purchased' in (args || {}) ? Math.round(Number(args.quantity_purchased)) : null;
  const year: number | null = hasNewYear ? Math.round(Number(args.year)) : null;
  const description: string | null = hasNewDesc ? String(args.description).slice(0, 2000) : null;
  const lore: string | null = hasNewLore ? String(args.lore).slice(0, 4000) : null;
  const terroir: string | null = hasNewTerroir ? String(args.terroir).slice(0, 4000) : null;
  const processingNotes: string | null = hasNewProcessing ? String(args.processing_notes).slice(0, 4000) : null;
  const shippingRatePerKg: number | null = hasNewShipping ? Number(args.shipping_rate_per_kg) : null;
  const tastingNotes: string[] | null = hasNewTasting
    ? args.tasting_notes.slice(0, 12).map((t: any) => String(t).trim()).filter(Boolean).slice(0, 8)
    : null;
  const originCountry: string | null = args?.origin_country ? String(args.origin_country).trim() : null;
  const originRegion: string | null = args?.origin_region ? String(args.origin_region).trim() : null;
  // Optional: list of text fields to clear to NULL (string fields only, whitelisted).
  /* shipping_rate_per_kg is clearable because clearing it is a real instruction:
     it hands the tea back to the shop rate, which then follows the shop rate
     forever. Writing 12, or 85, or any number is the opposite — it pins the tea
     to that figure and it goes stale the day the shop renegotiates. There is no
     other way to say it through this tool: a passed zero means free freight,
     and Number(null) is zero. */
  const CLEARABLE = new Set(['lore', 'experience', 'mood', 'terroir', 'processing_notes', 'shipping_rate_per_kg']);
  const clearFields: string[] | null = Array.isArray(args?.clear_fields)
    ? args.clear_fields.filter((f: any) => typeof f === 'string' && CLEARABLE.has(f)).slice(0, 10)
    : null;
  // stock_verified: true → mark verified now; false → clear it (needs verification); omit → leave unchanged
  const stockVerifiedAt: string | null = hasNewStockVerify
    ? (args.stock_verified ? new Date().toISOString() : null)
    : undefined as unknown as string | null;

  if (costAmount !== null && (!Number.isFinite(costAmount) || costAmount < 0)) throw new Error('cost_amount must be a non-negative number');
  if (retailPriceUsd !== null && (!Number.isFinite(retailPriceUsd) || retailPriceUsd < 0)) throw new Error('retail_price_usd must be a non-negative number');
  if (quantityPurchased !== null && (!Number.isFinite(quantityPurchased) || quantityPurchased < 0)) throw new Error('quantity_purchased must be a non-negative number');
  if (shippingRatePerKg !== null && (!Number.isFinite(shippingRatePerKg) || shippingRatePerKg < 0)) throw new Error('shipping_rate_per_kg must be a non-negative number');
  // Distinguish "not supplied" (undefined) from "explicitly cleared" (null/'').
  const hasStockVerifyExplicit = hasNewStockVerify;
  const stockVerifyForPending: string | null | undefined = hasNewStockVerify || stockVerifiedAt !== undefined
    ? stockVerifiedAt
    : undefined;

  const product = await env.DB.prepare(
    'SELECT id, type, given_name, product_name, cost_amount, cost_currency, fixed_retail_price_usd, quantity_purchased, shipping_rate_per_kg FROM products WHERE id = ? AND account_id = ?'
  ).bind(productId, auth.accountId).first() as Record<string, any> | null;
  if (!product) return { error: 'not_found' };
  /* An amount needs a unit. The row's own currency counts, since most calls
     move a cost on a tea whose currency was settled long ago; what is refused
     is a cost landing where neither the call nor the row has ever said. Same
     rule the REST door uses, from worker/src/costCurrency.ts. */
  if (costNeedsCurrency({
    amount: costAmount,
    payloadCurrency: costCurrency,
    existingCurrency: product.cost_currency,
  })) {
    throw new Error(COST_CURRENCY_REQUIRED);
  }

  if (!confirm) {
    const oldRetail = Number(product.fixed_retail_price_usd || 0);
    const newRetail = retailPriceUsd ?? oldRetail;

    // Margin warning: (retail_usd - cost_usd) / retail_usd < 30%.
    // retail_price_usd is already USD, but cost_amount is in cost_currency and
    // must be converted before comparison or the warning is meaningless for
    // non-USD costs (e.g. a 7.2-Yuan cost is ~$1, not $7.2). Convention:
    // exchange_rates.rate_to_usd is units-per-USD, so USD = amount / rate_to_usd.
    //
    // And retail_price_usd is PER GRAM while cost_amount is the TOTAL paid for
    // quantity_purchased grams, so the total has to be divided by the grams
    // before the two can be compared. Until 2026-09-09 it was not: a 2,000 g
    // cake bought for 1,200 yuan was read as 166 dollars a gram instead of
    // 0.08, and the preview told the operator a 0.50 dollar price was a loss
    // of 33,000 percent. Same shape addPricingFields divides out in index.ts,
    // and the same fault handleNetworkCatalog carried (audit MONEY-3). Freight
    // is in the basis too, as it is everywhere else the shop prices a gram.
    const newCostAmount = costAmount ?? Number(product.cost_amount || 0);
    const newQuantity = quantityPurchased ?? Number(product.quantity_purchased || 0);
    const newShippingRatePerKg: number | null = clearFields?.includes('shipping_rate_per_kg')
      ? null
      : (shippingRatePerKg ?? product.shipping_rate_per_kg ?? null);
    /* No `?? 'USD'`. A row whose currency nobody ever stated is not a row
       priced in dollars, and a margin warning computed from that guess is a
       confident number about money that is wrong by whatever the exchange rate
       is. The rest of this block already declines rather than guess when there
       is no rate; an unstated currency is the same situation one step earlier. */
    const newCostCurrency = (costCurrency ?? product.cost_currency ?? null) as string | null;

    let costUsd: number | null = null;
    if (currencyStated(newCostCurrency) && newQuantity > 0) {
      /* One read of the rate table serves both the cost currency and the shop
         freight rate. Table keys are canonical names ('Yuan', not 'CNY'), which
         is what stated cost currencies are stored as. */
      const rateRows = await env.DB.prepare(
        'SELECT currency, rate_to_usd FROM exchange_rates'
      ).all() as { results?: Array<{ currency: string; rate_to_usd: number }> };
      const rates = new Map<string, number>();
      for (const row of rateRows.results ?? []) {
        if (Number.isFinite(row.rate_to_usd) && row.rate_to_usd > 0) rates.set(row.currency, row.rate_to_usd);
      }
      const rateToUsd = newCostCurrency === 'USD' ? 1 : rates.get(newCostCurrency!);
      // No rate row → skip the warning rather than emit a false one.
      if (rateToUsd) {
        const account = await env.DB.prepare(
          'SELECT default_shipping_rate_per_kg, default_shipping_rate_currency FROM accounts WHERE id = ?'
        ).bind(auth.accountId).first() as { default_shipping_rate_per_kg?: number | null; default_shipping_rate_currency?: string | null } | null;
        const shopFreight = resolveShopFreightDefault(account, currency => rates.get(currency));
        costUsd = (newCostAmount / newQuantity) / rateToUsd + shippingPerGramUsd({
          storedRatePerKg: newShippingRatePerKg,
          rateToUsd,
          isTeaware: product.type === 'Teaware',
          shopDefaultPerKgUsd: shopFreight.perKgUsd,
        });
      }
    }

    const marginWarning = costUsd !== null && newRetail > 0 && (newRetail - costUsd) / newRetail < 0.3
      ? `Margin will be ${Math.round(((newRetail - costUsd) / newRetail) * 100)}% — below the 30% floor.`
      : null;

    const token = await issueConfirmationToken(env, {
      kind: 'update_tea_pricing', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, costAmount, costCurrency, retailPriceUsd, quantityPurchased, year, status, description, lore, terroir, processingNotes, stockVerifiedAt, shippingRatePerKg, tastingNotes, originCountry, originRegion, clearFields,
    }, auth.tokenId);
    return {
      preview: {
        action: 'update_tea_pricing',
        product: { id: product.id, name: product.given_name || product.product_name },
        changes: {
          cost_amount: { old: product.cost_amount ?? null, new: costAmount ?? product.cost_amount },
          cost_currency: { old: product.cost_currency ?? null, new: costCurrency ?? product.cost_currency },
          retail_price_usd: { old: product.fixed_retail_price_usd ?? null, new: retailPriceUsd ?? product.fixed_retail_price_usd },
          quantity_purchased: { old: product.quantity_purchased ?? null, new: quantityPurchased ?? product.quantity_purchased },
          year: { old: product.year ?? null, new: year ?? product.year },
          status: { old: product.status ?? null, new: status ?? product.status },
          shipping_rate_per_kg: { old: product.shipping_rate_per_kg ?? null, new: shippingRatePerKg ?? product.shipping_rate_per_kg ?? null },
          tasting_notes: hasNewTasting ? { new: tastingNotes } : undefined,
          origin_country: hasNewOrigin && originCountry !== null ? { new: originCountry } : undefined,
          origin_region: hasNewOrigin && originRegion !== null ? { new: originRegion } : undefined,
          description: hasNewDesc ? { changed: true } : undefined,
          lore: hasNewLore ? { changed: true } : undefined,
          terroir: hasNewTerroir ? { changed: true } : undefined,
          processing_notes: hasNewProcessing ? { changed: true } : undefined,
          stock_verified: hasNewStockVerify ? { new: args.stock_verified } : undefined,
        },
        margin_warning: marginWarning,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'update_tea_pricing' || pending.productId !== productId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitUpdateTeaPricing(env, pending);
}

async function commitUpdateTeaPricing(env: Env, m: Extract<PendingMutation, { kind: 'update_tea_pricing' }>) {
  const cols: string[] = [];
  const vals: any[] = [];
  if (m.costAmount !== null) { cols.push('cost_amount'); vals.push(m.costAmount); }
  if (m.costCurrency !== null) {
    cols.push('cost_currency'); vals.push(m.costCurrency);
    /* The call said what the money was in, so the row stops being one of the
       rows nobody ever asked. See migration 0014. */
    cols.push('cost_currency_source'); vals.push(CURRENCY_SOURCE_STATED);
  }
  if (m.retailPriceUsd !== null) { cols.push('fixed_retail_price_usd'); vals.push(m.retailPriceUsd); }
  if (m.quantityPurchased !== null) { cols.push('quantity_purchased'); vals.push(m.quantityPurchased); }
  if (m.year !== null) { cols.push('year'); vals.push(m.year); }
  if (m.status !== null) { cols.push('status'); vals.push(m.status); }
  if (m.shippingRatePerKg !== null) { cols.push('shipping_rate_per_kg'); vals.push(m.shippingRatePerKg); }
  if (m.tastingNotes !== null) { cols.push('tasting_notes'); vals.push(JSON.stringify(m.tastingNotes)); }
  if (m.originCountry !== null) { cols.push('origin_country'); vals.push(m.originCountry); }
  if (m.originRegion !== null) { cols.push('origin_region'); vals.push(m.originRegion); }
  if (m.description !== null) { cols.push('description'); vals.push(m.description); }
  if (m.lore !== null) { cols.push('lore'); vals.push(m.lore); }
  if (m.terroir !== null) { cols.push('terroir'); vals.push(m.terroir); }
  if (m.processingNotes !== null) { cols.push('processing_notes'); vals.push(m.processingNotes); }
  if (m.clearFields && m.clearFields.length) {
    for (const f of m.clearFields) { cols.push(f); vals.push(null); }
  }
  // Explicit stock-verification toggle: undefined = leave unchanged.
  if (m.stockVerifiedAt !== undefined) { cols.push('stock_verified_at'); vals.push(m.stockVerifiedAt); }

  if (cols.length === 0) return { committed: true, action: 'update_tea_pricing', changes: 0 };

  const sets = cols.map(c => `${c} = ?`).join(', ');

  // Mirror the About (canonical) content to tea_profiles — the single source the
  // storefront reads via the COALESCE joins. Without this, edits to the products
  // row silently never reach the customer-facing card (the divergence the
  // COALESCE refactor exists to prevent).
  const profileCols = [
    'name', 'chinese_name', 'type', 'form', 'origin_country', 'origin_region',
    'harvest_year', 'description', 'lore', 'processing_notes', 'terroir', 'mood',
    'experience', 'tasting_notes', 'image_url',
  ];
  const profileSets: string[] = [];
  const profileVals: any[] = [];
  for (const c of cols) {
    if (c === 'description') { profileSets.push('description = ?'); profileVals.push(profileCols.includes(c) ? vals[cols.indexOf(c)] : null); }
    else if (c === 'lore') { profileSets.push('lore = ?'); profileVals.push(vals[cols.indexOf(c)]); }
    else if (c === 'processing_notes') { profileSets.push('processing_notes = ?'); profileVals.push(vals[cols.indexOf(c)]); }
    else if (c === 'terroir') { profileSets.push('terroir = ?'); profileVals.push(vals[cols.indexOf(c)]); }
    else if (c === 'mood') { profileSets.push('mood = ?'); profileVals.push(vals[cols.indexOf(c)]); }
    else if (c === 'experience') { profileSets.push('experience = ?'); profileVals.push(vals[cols.indexOf(c)]); }
    else if (c === 'tasting_notes') { profileSets.push('tasting_notes = ?'); profileVals.push(vals[cols.indexOf(c)]); }
    else if (c === 'origin_country') { profileSets.push('origin_country = ?'); profileVals.push(vals[cols.indexOf(c)]); }
    else if (c === 'origin_region') { profileSets.push('origin_region = ?'); profileVals.push(vals[cols.indexOf(c)]); }
    // harvest_year is TEXT on purpose, so it can hold "2024 spring" as well as a
    // bare year. The tool takes year as a number, and binding a number to a TEXT
    // column stores it as a real, which reads back as "2019.0".
    else if (c === 'year') {
      const y = vals[cols.indexOf(c)];
      profileSets.push('harvest_year = ?');
      profileVals.push(typeof y === 'number' ? String(y) : y);
    }
  }

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(`UPDATE products SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
      .bind(...vals, m.productId, m.accountId),
  ];
  if (profileSets.length > 0) {
    profileSets.push("updated_at = datetime('now')");
    stmts.push(
      env.DB.prepare(`UPDATE tea_profiles SET ${profileSets.join(', ')} WHERE id = ?`)
        .bind(...profileVals, `prof_${m.productId}`)
    );
  }
  // Keep the listing in sync when status changes (mirrors the void/restock path).
  if (m.status !== null) {
    stmts.push(
      env.DB.prepare("UPDATE product_listings SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(m.status, `list_${m.productId}`)
    );
  }
  stmts.push(
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'PRICING_UPDATED_MCP', ?, ?, 'product', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Pricing/data updated via MCP for product ${m.productId}: ${cols.join(', ')}`,
      m.userEmail, m.productId, m.accountId,
    ),
  );

  await env.DB.batch(stmts);
  return {
    committed: true,
    action: 'update_tea_pricing',
    product_id: m.productId,
    updated_fields: cols,
  };
}

// ── tool: set_low_stock_threshold (preview / confirm) ──
async function toolSetLowStockThreshold(env: Env, auth: McpAuth, args: any) {
  const productId = String(args?.product_id || '').trim();
  const thresholdGrams = Number(args?.threshold_grams);
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!productId) throw new Error('product_id is required');
  if (!Number.isFinite(thresholdGrams) || thresholdGrams < 0) throw new Error('threshold_grams must be a non-negative number');

  const product = await env.DB.prepare(
    'SELECT id, given_name, product_name, stock_grams, low_stock_threshold FROM products WHERE id = ? AND account_id = ?'
  ).bind(productId, auth.accountId).first() as ProductRow | null;
  if (!product) return { error: 'not_found' };

  const currentStock = Number(product.stock_grams || 0);
  const oldThreshold = product.low_stock_threshold ?? null;

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'set_low_stock_threshold', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, thresholdGrams,
    }, auth.tokenId);
    return {
      preview: {
        action: 'set_low_stock_threshold',
        product: { id: product.id, name: product.given_name || product.product_name },
        threshold_old: oldThreshold,
        threshold_new: thresholdGrams,
        current_stock_grams: currentStock,
        would_be_flagged_low: thresholdGrams > 0 && currentStock < thresholdGrams,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'set_low_stock_threshold' || pending.productId !== productId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitSetLowStockThreshold(env, pending);
}

async function commitSetLowStockThreshold(env: Env, m: Extract<PendingMutation, { kind: 'set_low_stock_threshold' }>) {
  await env.DB.batch([
    env.DB.prepare("UPDATE products SET low_stock_threshold = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?")
      .bind(m.thresholdGrams, m.productId, m.accountId),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'THRESHOLD_UPDATED_MCP', ?, ?, 'product', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Low-stock threshold set to ${m.thresholdGrams}g via MCP for product ${m.productId}`,
      m.userEmail, m.productId, m.accountId,
    ),
  ]);
  return {
    committed: true,
    action: 'set_low_stock_threshold',
    product_id: m.productId,
    threshold_grams: m.thresholdGrams,
  };
}

// ── tool: update_invoice (preview / confirm) ──
async function toolUpdateInvoice(env: Env, auth: McpAuth, args: any) {
  const invoiceId = String(args?.invoice_id || '').trim();
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!invoiceId) throw new Error('invoice_id is required');

  const allowed = ['customer_id', 'customer_name', 'notes'] as const;
  const fields: Record<string, string | null> = {};
  for (const f of allowed) {
    if (f in (args || {})) fields[f] = args[f] ? String(args[f]).trim() : null;
  }
  if (Object.keys(fields).length === 0) throw new Error('At least one field to update is required');

  const invoice = await env.DB.prepare(
    'SELECT id, invoice_number, customer_id, customer_name, notes, status FROM invoices WHERE id = ? AND account_id = ?'
  ).bind(invoiceId, auth.accountId).first() as Record<string, any> | null;
  if (!invoice) return { error: 'invoice_not_found' };
  if (invoice.status === 'Void') return { error: 'void_invoice_cannot_be_modified' };

  if (!confirm) {
    const changes: Record<string, { old: any; new: any }> = {};
    for (const [k, v] of Object.entries(fields)) {
      changes[k] = { old: invoice[k] ?? null, new: v };
    }
    const token = await issueConfirmationToken(env, {
      kind: 'update_invoice', accountId: auth.accountId, userEmail: auth.userEmail,
      invoiceId, fields,
    }, auth.tokenId);
    return {
      preview: {
        action: 'update_invoice',
        invoice: { id: invoiceId, invoice_number: invoice.invoice_number, status: invoice.status },
        changes,
        note: 'Line items are not mutated by this tool — use void_invoice + record_sale to rebook.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'update_invoice' || pending.invoiceId !== invoiceId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitUpdateInvoice(env, pending);
}

async function commitUpdateInvoice(env: Env, m: Extract<PendingMutation, { kind: 'update_invoice' }>) {
  const cols = Object.keys(m.fields);
  if (cols.length === 0) return { committed: true, action: 'update_invoice', changes: 0 };

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.batch([
    env.DB.prepare(`UPDATE invoices SET ${sets} WHERE id = ? AND account_id = ?`)
      .bind(...cols.map(c => m.fields[c]), m.invoiceId, m.accountId),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'INVOICE_UPDATED_MCP', ?, ?, 'invoice', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Invoice ${m.invoiceId} updated via MCP: ${cols.join(', ')}`,
      m.userEmail, m.invoiceId, m.accountId,
    ),
  ]);
  return {
    committed: true,
    action: 'update_invoice',
    invoice_id: m.invoiceId,
    updated_fields: cols,
  };
}

// ── tool: void_invoice (preview / confirm) ──
async function toolVoidInvoice(env: Env, auth: McpAuth, args: any) {
  const invoiceId = String(args?.invoice_id || '').trim();
  const reason = args?.reason ? String(args.reason).slice(0, 500) : null;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!invoiceId) throw new Error('invoice_id is required');

  const invoice = await env.DB.prepare(
    'SELECT id, invoice_number, customer_name, customer_id, status, inventory_deducted FROM invoices WHERE id = ? AND account_id = ?'
  ).bind(invoiceId, auth.accountId).first() as Record<string, any> | null;
  if (!invoice) return { error: 'invoice_not_found' };
  if (invoice.status === 'Void') return { error: 'invoice_already_void' };

  const items = await env.DB.prepare(
    `SELECT ili.product_id, ili.quantity, p.given_name, p.product_name
       FROM invoice_line_items ili
       LEFT JOIN products p ON p.id = ili.product_id AND p.account_id = ?
      WHERE ili.invoice_id = ? AND ili.account_id = ?`
  ).bind(auth.accountId, invoiceId, auth.accountId).all();

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'void_invoice', accountId: auth.accountId, userEmail: auth.userEmail,
      invoiceId, reason,
    }, auth.tokenId);
    return {
      preview: {
        action: 'void_invoice',
        invoice: {
          id: invoiceId,
          invoice_number: invoice.invoice_number,
          customer_name: invoice.customer_name,
          status: invoice.status,
        },
        line_items: (items.results as any[]).map(item => ({
          product_id: item.product_id,
          product_name: item.given_name || item.product_name || '(custom item)',
          quantity_grams: item.quantity,
        })),
        stock_will_be_restored: !!invoice.inventory_deducted,
        reason,
        WARNING: 'This will permanently void the invoice. If inventory was deducted, stock will be added back. This cannot be undone.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'void_invoice' || pending.invoiceId !== invoiceId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitVoidInvoice(env, pending, invoice, items.results as any[]);
}

async function commitVoidInvoice(
  env: Env,
  m: Extract<PendingMutation, { kind: 'void_invoice' }>,
  invoice: Record<string, any>,
  lineItems: any[],
) {
  // Claim the invoice before restoring anything, exactly as the REST void does.
  // Reading the invoice and committing the restore are not one operation, so
  // two voids arriving together both restored the same stock. Voiding and
  // fulfilling contend for the same invoice, so they share one lease.
  const voidClaim = crypto.randomUUID();
  const voidClaimed = await env.DB.prepare(
    `UPDATE invoices SET fulfillment_claim_token = ?, fulfillment_claimed_at = datetime('now')
     WHERE id = ? AND account_id = ? AND status != 'Void'
       AND (fulfillment_claim_token IS NULL OR fulfillment_claimed_at IS NULL OR fulfillment_claimed_at < datetime('now', '-5 minutes'))
     RETURNING id`
  ).bind(voidClaim, m.invoiceId, m.accountId).first();
  if (!voidClaimed) return { error: 'invoice_being_changed_elsewhere' };

  const stmts: D1PreparedStatement[] = [];

  if (invoice.inventory_deducted) {
    for (const item of lineItems) {
      if (!item.product_id) continue;
      const product = await env.DB.prepare(
        'SELECT id, stock_grams, given_name, product_name, status, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
      ).bind(item.product_id, m.accountId).first() as any;
      if (!product) continue;

      const currentStock = Number(product.stock_grams || 0);
      const qty = Number(item.quantity) || 0;
      const newBalance = currentStock + qty;

      stmts.push(
        env.DB.prepare('UPDATE products SET stock_grams = stock_grams + ? WHERE id = ? AND account_id = ?')
          .bind(qty, item.product_id, m.accountId)
      );
      stmts.push(
        env.DB.prepare(
          'UPDATE product_listings SET stock_grams = stock_grams + ?, updated_at = datetime(\'now\') WHERE id = ?'
        ).bind(qty, `list_${item.product_id}`)
      );
      stmts.push(
        env.DB.prepare(
          `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, source_invoice_id, source_invoice_number, user_email, note, account_id)
           VALUES (?, ?, ?, ?, 'VOID', ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(), item.product_id, qty, newBalance,
          m.invoiceId, invoice.invoice_number, m.userEmail,
          `MCP void_invoice${m.reason ? ': ' + m.reason : ''}`, m.accountId,
        )
      );

      if (product.status === 'Sold Out' && newBalance > 0) {
        stmts.push(
          env.DB.prepare("UPDATE products SET status = 'Active', sold_out_at = NULL WHERE id = ? AND account_id = ?")
            .bind(item.product_id, m.accountId)
        );
        stmts.push(
          env.DB.prepare("UPDATE product_listings SET status = 'Active', updated_at = datetime('now') WHERE id = ?")
            .bind(`list_${item.product_id}`)
        );
        if (product.source_compass_entry_id) {
          stmts.push(
            env.DB.prepare("UPDATE tea_compass_entries SET status = 'in_stock', updated_at = datetime('now') WHERE id = ? AND status = 'depleted'")
              .bind(product.source_compass_entry_id)
          );
        }
      }
    }
  }

  stmts.push(
    env.DB.prepare('DELETE FROM stock_holds WHERE invoice_id = ? AND account_id = ?')
      .bind(m.invoiceId, m.accountId)
  );
  stmts.push(...buildSettlementReversalStatements(env, { accountId: m.accountId, invoiceId: m.invoiceId }));
  stmts.push(
    // Still holding the claim taken above; releasing it here means a successful
    // void never leaves the invoice leased.
    env.DB.prepare(
      `UPDATE invoices SET status = 'Void', inventory_deducted = 0,
         fulfillment_claim_token = NULL, fulfillment_claimed_at = NULL
       WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?`
    ).bind(m.invoiceId, m.accountId, voidClaim)
  );
  stmts.push(
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'INVOICE_VOIDED_MCP', ?, ?, 'invoice', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Invoice ${invoice.invoice_number} voided via MCP.${invoice.inventory_deducted ? ' Stock restored.' : ''}${m.reason ? ' Reason: ' + m.reason : ''}`,
      m.userEmail, m.invoiceId, m.accountId,
    )
  );

  try {
    await env.DB.batch(stmts);
  } catch (error) {
    // The batch rolled back, so nothing changed — but the claim was taken
    // outside it and would otherwise pin the invoice for five minutes.
    await env.DB.prepare(
      'UPDATE invoices SET fulfillment_claim_token = NULL, fulfillment_claimed_at = NULL WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?'
    ).bind(m.invoiceId, m.accountId, voidClaim).run().catch(() => {});
    throw error;
  }

  return {
    committed: true,
    action: 'void_invoice',
    invoice_id: m.invoiceId,
    invoice_number: invoice.invoice_number,
    stock_restored: !!invoice.inventory_deducted,
  };
}

// ── Wave 3 tools ──

// Helper: normalize a tag the same way the REST API does.
function normalizeTagMcp(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  return t.length > 50 ? t.slice(0, 50) : t;
}

// ── tool: tag_customer (preview / confirm) ──
async function toolTagCustomer(env: Env, auth: McpAuth, args: any) {
  const customerId = String(args?.customer_id || '').trim();
  const rawTag = args?.tag;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!customerId) throw new Error('customer_id is required');
  const tag = normalizeTagMcp(rawTag);
  if (!tag) throw new Error('tag must be a non-empty string');

  const customer = await env.DB.prepare(
    'SELECT id, name FROM customers WHERE id = ? AND account_id = ?'
  ).bind(customerId, auth.accountId).first() as { id: string; name: string } | null;
  if (!customer) return { error: 'customer_not_found' };

  const { results: existingTags } = await env.DB.prepare(
    'SELECT tag FROM customer_tags WHERE account_id = ? AND customer_id = ? ORDER BY tag ASC'
  ).bind(auth.accountId, customerId).all();
  const currentTags = (existingTags as any[]).map(r => r.tag as string);

  const alreadyPresent = currentTags.includes(tag);

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'tag_customer', accountId: auth.accountId, userEmail: auth.userEmail,
      customerId, tag,
    }, auth.tokenId);
    return {
      preview: {
        action: 'tag_customer',
        customer: { id: customerId, name: customer.name },
        current_tags: currentTags,
        tag_to_add: tag,
        already_present: alreadyPresent,
        note: alreadyPresent ? 'Tag already exists — confirming is a safe no-op.' : null,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'tag_customer' || pending.customerId !== customerId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitTagCustomer(env, pending);
}

async function commitTagCustomer(env: Env, m: Extract<PendingMutation, { kind: 'tag_customer' }>) {
  // INSERT OR IGNORE so idempotent — no error if tag already exists
  await env.DB.batch([
    env.DB.prepare(
      'INSERT OR IGNORE INTO customer_tags (id, account_id, customer_id, tag) VALUES (?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), m.accountId, m.customerId, m.tag),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'CUSTOMER_TAGGED_MCP', ?, ?, 'customer', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Tag "${m.tag}" added to customer ${m.customerId} via MCP`,
      m.userEmail, m.customerId, m.accountId,
    ),
  ]);
  return { committed: true, action: 'tag_customer', customer_id: m.customerId, tag: m.tag };
}

// ── tool: untag_customer (preview / confirm) ──
async function toolUntagCustomer(env: Env, auth: McpAuth, args: any) {
  const customerId = String(args?.customer_id || '').trim();
  const rawTag = args?.tag;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!customerId) throw new Error('customer_id is required');
  const tag = normalizeTagMcp(rawTag);
  if (!tag) throw new Error('tag must be a non-empty string');

  const customer = await env.DB.prepare(
    'SELECT id, name FROM customers WHERE id = ? AND account_id = ?'
  ).bind(customerId, auth.accountId).first() as { id: string; name: string } | null;
  if (!customer) return { error: 'customer_not_found' };

  const { results: existingTags } = await env.DB.prepare(
    'SELECT tag FROM customer_tags WHERE account_id = ? AND customer_id = ? ORDER BY tag ASC'
  ).bind(auth.accountId, customerId).all();
  const currentTags = (existingTags as any[]).map(r => r.tag as string);
  const tagPresent = currentTags.includes(tag);

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'untag_customer', accountId: auth.accountId, userEmail: auth.userEmail,
      customerId, tag,
    }, auth.tokenId);
    return {
      preview: {
        action: 'untag_customer',
        customer: { id: customerId, name: customer.name },
        current_tags: currentTags,
        tag_to_remove: tag,
        tag_present: tagPresent,
        note: tagPresent ? null : 'Tag is not currently applied — confirming is a safe no-op.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'untag_customer' || pending.customerId !== customerId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitUntagCustomer(env, pending);
}

async function commitUntagCustomer(env: Env, m: Extract<PendingMutation, { kind: 'untag_customer' }>) {
  await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM customer_tags WHERE account_id = ? AND customer_id = ? AND tag = ?'
    ).bind(m.accountId, m.customerId, m.tag),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'CUSTOMER_UNTAGGED_MCP', ?, ?, 'customer', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Tag "${m.tag}" removed from customer ${m.customerId} via MCP`,
      m.userEmail, m.customerId, m.accountId,
    ),
  ]);
  return { committed: true, action: 'untag_customer', customer_id: m.customerId, tag: m.tag };
}

// ── tool: link_vendor (preview / confirm) ──
// Links an existing customer record as the vendor for a product by setting
// products.vendor_id = customer.id.
async function toolLinkVendor(env: Env, auth: McpAuth, args: any) {
  const customerId = String(args?.customer_id || '').trim();
  const productId = String(args?.product_id || '').trim();
  const note = args?.note ? String(args.note).slice(0, 500) : null;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!customerId) throw new Error('customer_id is required');
  if (!productId) throw new Error('product_id is required');

  const [customer, product] = await Promise.all([
    env.DB.prepare('SELECT id, name FROM customers WHERE id = ? AND account_id = ?')
      .bind(customerId, auth.accountId).first() as Promise<{ id: string; name: string } | null>,
    env.DB.prepare('SELECT id, given_name, product_name, vendor_id FROM products WHERE id = ? AND account_id = ?')
      .bind(productId, auth.accountId).first() as Promise<{ id: string; given_name: string | null; product_name: string; vendor_id: string | null } | null>,
  ]);

  if (!customer) return { error: 'customer_not_found' };
  if (!product) return { error: 'product_not_found' };

  const existingLink = product.vendor_id === customerId;

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'link_vendor', accountId: auth.accountId, userEmail: auth.userEmail,
      customerId, productId, note,
    }, auth.tokenId);
    return {
      preview: {
        action: 'link_vendor',
        customer: { id: customerId, name: customer.name },
        product: { id: productId, name: product.given_name || product.product_name },
        already_linked: existingLink,
        current_vendor_id: product.vendor_id,
        note,
        warning: existingLink
          ? 'This customer is already the vendor for this product.'
          : (product.vendor_id
            ? `Product currently has a different vendor (id: ${product.vendor_id}). This will replace it.`
            : null),
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'link_vendor' || pending.customerId !== customerId || pending.productId !== productId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitLinkVendor(env, pending, customer.name, product.given_name || product.product_name);
}

async function commitLinkVendor(
  env: Env,
  m: Extract<PendingMutation, { kind: 'link_vendor' }>,
  customerName: string,
  productName: string,
) {
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE products SET vendor_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?"
    ).bind(m.customerId, m.productId, m.accountId),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'VENDOR_LINKED_MCP', ?, ?, 'product', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Vendor "${customerName}" linked to product "${productName}" via MCP${m.note ? ': ' + m.note : ''}`,
      m.userEmail, m.productId, m.accountId,
    ),
  ]);
  return {
    committed: true,
    action: 'link_vendor',
    customer_name: customerName,
    product_name: productName,
    customer_id: m.customerId,
    product_id: m.productId,
  };
}

// ── tool: unlink_vendor (preview / confirm) ──
async function toolUnlinkVendor(env: Env, auth: McpAuth, args: any) {
  const customerId = String(args?.customer_id || '').trim();
  const productId = String(args?.product_id || '').trim();
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!customerId) throw new Error('customer_id is required');
  if (!productId) throw new Error('product_id is required');

  const [customer, product] = await Promise.all([
    env.DB.prepare('SELECT id, name FROM customers WHERE id = ? AND account_id = ?')
      .bind(customerId, auth.accountId).first() as Promise<{ id: string; name: string } | null>,
    env.DB.prepare('SELECT id, given_name, product_name, vendor_id FROM products WHERE id = ? AND account_id = ?')
      .bind(productId, auth.accountId).first() as Promise<{ id: string; given_name: string | null; product_name: string; vendor_id: string | null } | null>,
  ]);

  if (!customer) return { error: 'customer_not_found' };
  if (!product) return { error: 'product_not_found' };

  if (product.vendor_id !== customerId) {
    return {
      error: 'link_not_found',
      message: `Customer "${customer.name}" is not currently linked as the vendor for "${product.given_name || product.product_name}".`,
      current_vendor_id: product.vendor_id,
    };
  }

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'unlink_vendor', accountId: auth.accountId, userEmail: auth.userEmail,
      customerId, productId,
    }, auth.tokenId);
    return {
      preview: {
        action: 'unlink_vendor',
        customer: { id: customerId, name: customer.name },
        product: { id: productId, name: product.given_name || product.product_name },
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'unlink_vendor' || pending.customerId !== customerId || pending.productId !== productId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitUnlinkVendor(env, pending, customer.name, product.given_name || product.product_name);
}

async function commitUnlinkVendor(
  env: Env,
  m: Extract<PendingMutation, { kind: 'unlink_vendor' }>,
  customerName: string,
  productName: string,
) {
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE products SET vendor_id = NULL, updated_at = datetime('now') WHERE id = ? AND account_id = ?"
    ).bind(m.productId, m.accountId),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'VENDOR_UNLINKED_MCP', ?, ?, 'product', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Vendor "${customerName}" unlinked from product "${productName}" via MCP`,
      m.userEmail, m.productId, m.accountId,
    ),
  ]);
  return {
    committed: true,
    action: 'unlink_vendor',
    customer_id: m.customerId,
    product_id: m.productId,
  };
}

// ── tool: upsert_vendor_contact (preview / confirm) ──
// Create a new vendor (customer tagged "vendor") with full contact details, or
// update an existing vendor by name. Scoped to stock:write (unlike the
// owner-tier link_vendor/unlink_vendor tools) so the operator token can
// persist vendor/source contacts for intake lots.
async function toolUpsertVendorContact(env: Env, auth: McpAuth, args: any) {
  const name = String(args?.name || '').trim().slice(0, 200);
  const confirm = args?.confirm ? String(args.confirm) : null;
  const company = args?.company != null ? String(args.company).trim().slice(0, 200) || null : null;
  const phone = args?.phone != null ? String(args.phone).trim().slice(0, 50) || null : null;
  const whatsapp = args?.whatsapp != null ? String(args.whatsapp).trim().slice(0, 50) || null : null;
  const wechat = args?.wechat != null ? String(args.wechat).trim().slice(0, 100) || null : null;
  const address = args?.address != null ? String(args.address).trim().slice(0, 500) || null : null;
  const city = args?.city != null ? String(args.city).trim().slice(0, 200) || null : null;
  const country = args?.country != null ? String(args.country).trim().slice(0, 100) || null : null;
  const source = args?.source != null ? String(args.source).trim().slice(0, 200) || null : null;
  const notes = args?.notes != null ? String(args.notes).trim().slice(0, 4000) || null : null;

  if (!name) throw new Error('name is required');

  const existing = await env.DB.prepare(
    'SELECT id, name FROM customers WHERE LOWER(name) = ? AND account_id = ?'
  ).bind(name.toLowerCase(), auth.accountId).first() as { id: string; name: string } | null;

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'upsert_vendor_contact', accountId: auth.accountId, userEmail: auth.userEmail,
      name, company, phone, whatsapp, wechat, address, city, country, source, notes,
    }, auth.tokenId);
    return {
      preview: {
        action: 'upsert_vendor_contact',
        vendor_name: name,
        mode: existing ? 'update_existing' : 'create_new',
        existing_id: existing ? existing.id : null,
        company, phone, whatsapp, wechat, address, city, country, source,
        has_notes: !!notes,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'upsert_vendor_contact' || pending.name !== name) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitUpsertVendorContact(env, pending, existing?.id ?? null);
}

async function commitUpsertVendorContact(
  env: Env,
  m: Extract<PendingMutation, { kind: 'upsert_vendor_contact' }>,
  existingId: string | null,
) {
  // The live customers table has NO `wechat` column (only added `line` via
  // archive migration 098; index.ts's `wechat` reference is a latent bug that
  // drops the value). WeChat is stored durably in the existing `contacts`
  // JSON array instead, alongside the real phone/whatsapp columns.
  const contacts: any[] = m.wechat ? [{ type: 'wechat', value: m.wechat }] : [];
  let customerId: string;
  if (existingId) {
    customerId = existingId;
    await env.DB.prepare(
      `UPDATE customers SET company = ?, phone = ?, whatsapp = ?, address = ?,
         city = ?, country = ?, source = ?, notes = ?, contacts = ?, tags = ?, updated_at = datetime('now')
       WHERE id = ? AND account_id = ?`
    ).bind(
      m.company, m.phone, m.whatsapp, m.address, m.city, m.country,
      m.source, m.notes, JSON.stringify(contacts), JSON.stringify(['vendor']), customerId, m.accountId,
    ).run();
  } else {
    customerId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO customers (id, account_id, type, name, company, phone, whatsapp,
         address, city, country, source, notes, contacts, tags, created_at, updated_at)
       VALUES (?, ?, 'vendor', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '["vendor"]', datetime('now'), datetime('now'))`
    ).bind(
      customerId, m.accountId, m.name, m.company, m.phone, m.whatsapp,
      m.address, m.city, m.country, m.source, m.notes, JSON.stringify(contacts),
    ).run();
  }
  await env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'VENDOR_CONTACT_UPSERT_MCP', ?, ?, 'customer', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    `Vendor contact ${existingId ? 'updated' : 'created'} for "${m.name}" via MCP${m.source ? ' (source: ' + m.source + ')' : ''}`,
    m.userEmail, customerId, m.accountId,
  ).run();
  return {
    committed: true,
    action: 'upsert_vendor_contact',
    mode: existingId ? 'updated' : 'created',
    vendor_id: customerId,
    vendor_name: m.name,
    wechat_stored_in: 'contacts',
  };
}

// ── tool: remove_vendor_contact (preview / confirm) ──
// Delete a vendor (customer tagged "vendor") that is no longer referenced.
// Guarded: refuses if any product still links to it as vendor_id, any invoice
// still references it, or any curate vendor group resolves to it. Scoped to
// stock:write so the operator can clean up duplicate/abandoned vendor rows.
async function toolRemoveVendorContact(env: Env, auth: McpAuth, args: any) {
  const customerId = String(args?.customer_id || '').trim();
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (!customerId) throw new Error('customer_id is required');

  const customer = await env.DB.prepare(
    'SELECT id, name, tags FROM customers WHERE id = ? AND account_id = ?'
  ).bind(customerId, auth.accountId).first() as { id: string; name: string; tags: string | null } | null;
  if (!customer) return { error: 'not_found' };

  let tags: string[] = [];
  try { tags = Array.isArray(JSON.parse(customer.tags || '[]')) ? JSON.parse(customer.tags || '[]') : []; } catch { tags = []; }
  const [productLinks, invoiceLinks, groupLinks] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE vendor_id = ? AND account_id = ?').bind(customerId, auth.accountId).first<{ n: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM invoices WHERE customer_id = ? AND account_id = ?').bind(customerId, auth.accountId).first<{ n: number }>(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM curate_import_vendor_groups WHERE resolved_vendor_customer_id = ? AND account_id = ?').bind(customerId, auth.accountId).first<{ n: number }>(),
  ]);
  const productCount = Number(productLinks?.n ?? 0);
  const invoiceCount = Number(invoiceLinks?.n ?? 0);
  const groupCount = Number(groupLinks?.n ?? 0);
  const referenced = productCount > 0 || invoiceCount > 0 || groupCount > 0;

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'remove_vendor_contact', accountId: auth.accountId, userEmail: auth.userEmail, customerId,
    }, auth.tokenId);
    return {
      preview: {
        action: 'remove_vendor_contact',
        vendor: { id: customerId, name: customer.name, is_vendor_tagged: tags.includes('vendor') },
        references: { products: productCount, invoices: invoiceCount, vendor_groups: groupCount },
        will_refuse: referenced,
        note: referenced ? 'This vendor is still referenced and will be refused on confirm.' : 'No references — the customer row will be deleted.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'remove_vendor_contact' || pending.customerId !== customerId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  if (referenced) return { error: 'vendor_still_referenced', references: { products: productCount, invoices: invoiceCount, vendor_groups: groupCount } };

  await env.DB.prepare('DELETE FROM customers WHERE id = ? AND account_id = ?')
    .bind(customerId, auth.accountId).run();
  await env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'VENDOR_CONTACT_REMOVE_MCP', ?, ?, 'customer', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    `Vendor contact removed for "${customer.name}" via MCP`,
    auth.userEmail, customerId, auth.accountId,
  ).run();
  return {
    committed: true,
    action: 'remove_vendor_contact',
    vendor_id: customerId,
    vendor_name: customer.name,
  };
}

// ── tool: link_vendor_products (preview / confirm) ──
// Batch-link an existing vendor (customer) to one or more products. Scoped to
// stock:write so the operator can attach a vendor to several intake teas at once.
async function toolLinkVendorProducts(env: Env, auth: McpAuth, args: any) {
  const customerId = String(args?.customer_id || '').trim();
  const productIds: string[] = Array.isArray(args?.product_ids)
    ? [...new Set((args.product_ids as unknown[]).map((p: unknown) => String(p).trim()).filter(Boolean))] as string[]
    : [];
  const note = args?.note ? String(args.note).slice(0, 500) : null;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!customerId) throw new Error('customer_id is required');
  if (productIds.length === 0) throw new Error('product_ids must be a non-empty array');

  const customer = await env.DB.prepare('SELECT id, name FROM customers WHERE id = ? AND account_id = ?')
    .bind(customerId, auth.accountId).first() as { id: string; name: string } | null;
  if (!customer) return { error: 'customer_not_found' };

  const placeholders = productIds.map(() => '?').join(', ');
  const products = await env.DB.prepare(
    `SELECT id, given_name, product_name, vendor_id FROM products
     WHERE account_id = ? AND id IN (${placeholders})`
  ).bind(auth.accountId, ...productIds).all() as any;
  const rows = (products.results || []) as { id: string; given_name: string | null; product_name: string; vendor_id: string | null }[];
  if (rows.length === 0) return { error: 'products_not_found' };
  const foundIds = new Set(rows.map(r => r.id));
  const missing = productIds.filter(id => !foundIds.has(id));

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'link_vendor_products', accountId: auth.accountId, userEmail: auth.userEmail,
      customerId, productIds, note,
    }, auth.tokenId);
    return {
      preview: {
        action: 'link_vendor_products',
        customer: { id: customerId, name: customer.name },
        products: rows.map(r => ({ id: r.id, name: r.given_name || r.product_name, current_vendor_id: r.vendor_id })),
        product_count: rows.length,
        missing_product_ids: missing.length ? missing : undefined,
        note,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'link_vendor_products' || pending.customerId !== customerId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitLinkVendorProducts(env, pending, rows, customer.name);
}

async function commitLinkVendorProducts(
  env: Env,
  m: Extract<PendingMutation, { kind: 'link_vendor_products' }>,
  rows: { id: string; given_name: string | null; product_name: string }[],
  customerName: string,
) {
  const statements: D1PreparedStatement[] = rows.map(r =>
    env.DB.prepare("UPDATE products SET vendor_id = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?")
      .bind(m.customerId, r.id, m.accountId)
  );
  statements.push(env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'VENDORS_LINKED_MCP', ?, ?, 'customer', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    `Vendor "${customerName}" linked to ${rows.length} product(s) via MCP${m.note ? ': ' + m.note : ''}`,
    m.userEmail, m.customerId, m.accountId,
  ));
  await env.DB.batch(statements as any);
  return {
    committed: true,
    action: 'link_vendor_products',
    vendor_name: customerName,
    vendor_id: m.customerId,
    linked_product_ids: m.productIds,
    product_count: rows.length,
  };
}

// ── tool: set_tasting (preview / confirm) ──
//
// The shop's own sensory claim about a tea: what it tastes of, what it feels
// like, its body, its finish, the colour of the liquor. This is the one field
// on a product that is written in Adrian's voice about a cup he has actually
// drunk, which is why it is owner-tier and why it stamps `tasting_source`
// as 'owner' the same way the admin editor does.
//
// Two things this tool is careful about, both of which would be silent:
//
// 1. It MERGES. `products.tasting` also carries the starred notes that the
//    product page reads out as quotes, the teaser line, and the brewing terms.
//    Writing the column wholesale from five arrays would delete all of them
//    without a word. Only the categories actually supplied are touched.
//
// 2. It refuses unknown terms rather than dropping them. A term id that is not
//    in the taxonomy renders on the page as its raw id, so silently discarding
//    one would publish a shorter claim than the caller asked for and say
//    nothing. `normalizeImportTasting` is the same validator the Curate import
//    path uses; there is deliberately not a second copy of the vocabulary here.
//
// Brewing is not settable here. The shared validator does not accept it, and
// widening the vocabulary for one tool would change what the import path
// accepts too.
const TASTING_CATEGORY_ARGS: Record<string, string> = {
  flavor: 'flavor',
  feeling: 'feeling',
  body: 'body',
  finish: 'finish',
  liquor_color: 'liquor-color',
};

function readStoredTastingForPreview(raw: unknown): Record<string, unknown> {
  return readStoredTasting(raw);
}

function termList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((t): t is string => typeof t === 'string') : [];
}

function readableTerms(value: unknown): string {
  const terms = termList(value);
  return terms.length ? terms.map(tastingTermLabel).join(' · ') : '(none)';
}

async function toolSetTasting(env: Env, auth: McpAuth, args: any) {
  const productId = String(args?.product_id || '').trim();
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (!productId) throw new Error('product_id is required');

  // Which categories the caller actually spoke about. Supplying an empty array
  // is how you clear one; omitting it leaves it exactly as it was.
  const supplied: Record<string, string[]> = {};
  for (const [argKey, category] of Object.entries(TASTING_CATEGORY_ARGS)) {
    if (args?.[argKey] === undefined) continue;
    if (!Array.isArray(args[argKey])) throw new Error(`${argKey} must be an array of term ids`);
    supplied[category] = args[argKey].map((t: any) => String(t).trim()).filter(Boolean);
  }
  const touched = Object.keys(supplied);
  if (touched.length === 0) {
    throw new Error(`At least one of ${Object.keys(TASTING_CATEGORY_ARGS).join(', ')} is required`);
  }

  const product = await env.DB.prepare(
    'SELECT id, given_name, product_name, tasting, tasting_source FROM products WHERE id = ? AND account_id = ?'
  ).bind(productId, auth.accountId).first() as Record<string, any> | null;
  if (!product) return { error: 'not_found' };

  // Validation and the merge both live in the taxonomy module, so the vocabulary
  // has one home in the worker and the merge can be tested without a database.
  const current = readStoredTastingForPreview(product.tasting);
  const { next } = mergeProductTasting(product.tasting, supplied);

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'set_tasting', accountId: auth.accountId, userEmail: auth.userEmail,
      productId: product.id as string, tasting: next, touched,
    }, auth.tokenId);
    const changes: Record<string, { old: string; new: string }> = {};
    for (const category of touched) {
      changes[category] = { old: readableTerms(current[category]), new: readableTerms(next[category]) };
    }
    // Say out loud what is being kept, so nobody has to trust that the merge
    // happened: these are the parts of the tasting this call does not touch.
    const preserved = Object.keys(current).filter(key => !touched.includes(key));
    return {
      preview: {
        action: 'set_tasting',
        product: { id: product.id, name: product.given_name || product.product_name },
        changes,
        untouched: preserved.length ? preserved : undefined,
        tasting_source: { old: product.tasting_source ?? null, new: tastingHasTerms(next) ? 'owner' : null },
        note: 'Saved as the shop\'s own tasting, in your voice, and shown to customers without a "potential profile" qualifier.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'set_tasting' || pending.productId !== product.id) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitSetTasting(env, pending);
}

async function commitSetTasting(env: Env, m: Extract<PendingMutation, { kind: 'set_tasting' }>) {
  // tasting_source follows the admin's own rule: terms present means the shop
  // is making the claim, nothing present means there is no claim to attribute.
  const source = tastingHasTerms(m.tasting) ? 'owner' : null;

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE products SET tasting = ?, tasting_source = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?"
    ).bind(JSON.stringify(m.tasting), source, m.productId, m.accountId),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'TASTING_UPDATED_MCP', ?, ?, 'product', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Tasting set via MCP for product ${m.productId}: ${m.touched.join(', ')}`,
      m.userEmail, m.productId, m.accountId,
    ),
  ]);

  return {
    committed: true,
    action: 'set_tasting',
    product_id: m.productId,
    updated_categories: m.touched,
    tasting_source: source,
  };
}

// ── tool: update_tea_catalog (preview / confirm) ──
// Edit catalog/identity fields (type, form, given_name, chinese_name,
// product_name, origin_country, origin_region, year, altitude, cultivar,
// teaware_category, material, capacity_ml) on an existing tea. Mirrors
// products + tea_profiles. Scoped stock:write so the operator token can use it.
const CATALOG_FIELDS: Record<string, string> = {
  product_name: 'product_name',
  given_name: 'given_name',
  chinese_name: 'chinese_name',
  type: 'type',
  form: 'form',
  origin_country: 'origin_country',
  origin_region: 'origin_region',
  year: 'year',
  altitude: 'altitude',
  cultivar: 'cultivar',
  teaware_category: 'teaware_category',
  material: 'material',
  capacity_ml: 'capacity_ml',
};

async function toolUpdateTeaCatalog(env: Env, auth: McpAuth, args: any) {
  if (!args?.product_id) return { error: 'product_id is required' };
  const productId = String(args.product_id);
  const fields: Record<string, string | null> = {};
  for (const [bodyKey, col] of Object.entries(CATALOG_FIELDS)) {
    if (args[bodyKey] !== undefined) {
      fields[col] = args[bodyKey] === null ? null : String(args[bodyKey]);
    }
  }
  const keys = Object.keys(fields);
  if (keys.length === 0) return { error: 'no_catalog_fields_supplied' };

  const row = await env.DB.prepare(
    `SELECT id, given_name, product_name, type, form, status FROM products WHERE account_id = ? AND (id = ? OR id LIKE ?)`
  ).bind(auth.accountId, productId, `${productId}-%`).first();
  if (!row) return { error: 'product_not_found' };

  const isConfirm = args?.confirm != null;
  if (!isConfirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'update_tea_catalog',
      accountId: auth.accountId,
      userEmail: auth.userEmail,
      productId: row.id as string,
      fields,
    }, auth.tokenId);
    return {
      preview: true,
      confirmation_token: token,
      product_id: row.id,
      product: (row.given_name || row.product_name) as string,
      current: {
        type: row.type,
        form: row.form,
      },
      will_update: Object.fromEntries(keys.map((c) => [c, fields[c]])),
    };
  }

  const pending = await consumeConfirmationToken(env, args.confirm, auth.tokenId);
  if (!pending || pending.kind !== 'update_tea_catalog' || pending.productId !== row.id) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitUpdateTeaCatalog(env, pending, (row.given_name || row.product_name) as string);
}

async function commitUpdateTeaCatalog(
  env: Env,
  m: Extract<PendingMutation, { kind: 'update_tea_catalog' }>,
  productName: string,
) {
  const now = new Date().toISOString();
  const changed = Object.keys(m.fields);

  // Map catalog body keys to products columns, then to tea_profiles columns.
  // tea_profiles mirrors by id = 'prof_' + productId, using its own column
  // names (name, harvest_year, chinese_name, type, form, origin_*). This is
  // the same mirror contract update_tea_pricing uses (mcp.ts ~line 2008).
  const profileMap: Record<string, string> = {
    product_name: 'name',
    given_name: 'name',
    chinese_name: 'chinese_name',
    type: 'type',
    form: 'form',
    origin_country: 'origin_country',
    origin_region: 'origin_region',
    year: 'harvest_year',
    altitude: 'altitude',
    cultivar: 'varietal',
    teaware_category: 'teaware_category',
    material: 'material',
    capacity_ml: 'capacity_ml',
  };

  const prodSets: string[] = [];
  const prodBinds: (string | null)[] = [];
  const profSets: string[] = [];
  const profBinds: (string | null)[] = [];
  for (const [col, val] of Object.entries(m.fields)) {
    prodSets.push(`${col} = ?`);
    prodBinds.push(val);
    const profCol = profileMap[col];
    if (profCol) {
      profSets.push(`${profCol} = ?`);
      profBinds.push(col === 'year' && val ? String(val) : val);
    }
  }
  prodSets.push("updated_at = datetime('now')");
  profSets.push("updated_at = datetime('now')");

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `UPDATE products SET ${prodSets.join(', ')} WHERE id = ? AND account_id = ?`
    ).bind(...prodBinds, m.productId, m.accountId),
  ];
  if (profSets.length > 0) {
    stmts.push(
      env.DB.prepare(
        `UPDATE tea_profiles SET ${profSets.join(', ')} WHERE id = ?`
      ).bind(...profBinds, `prof_${m.productId}`)
    );
  }
  stmts.push(
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'PRODUCT_CATALOG_UPDATE_MCP', ?, ?, 'product', ?, ?)`
    ).bind(crypto.randomUUID(), JSON.stringify({ fields: m.fields }), m.userEmail, m.productId, m.accountId)
  );

  await env.DB.batch(stmts);

  return {
    committed: true,
    action: 'update_tea_catalog',
    product_id: m.productId,
    product: productName,
    updated_fields: changed,
  };
}

// ── tool: set_archive_status (preview / confirm) ──
async function toolSetArchiveStatus(env: Env, auth: McpAuth, args: any) {
  const productId = String(args?.product_id || '').trim();
  const archived = Boolean(args?.archived);
  const reason = args?.reason ? String(args.reason).slice(0, 500) : null;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!productId) throw new Error('product_id is required');

  const product = await env.DB.prepare(
    'SELECT id, given_name, product_name, status FROM products WHERE id = ? AND account_id = ?'
  ).bind(productId, auth.accountId).first() as { id: string; given_name: string | null; product_name: string; status: string | null } | null;
  if (!product) return { error: 'not_found' };

  const currentlyArchived = product.status === 'Archived';
  const newStatus = archived ? 'Archived' : 'Active';

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'set_archive_status', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, archived, reason,
    }, auth.tokenId);
    return {
      preview: {
        action: 'set_archive_status',
        product: { id: productId, name: product.given_name || product.product_name },
        current_status: product.status,
        new_status: newStatus,
        already_in_target_state: currentlyArchived === archived,
        public_shop_effect: archived
          ? 'Product will be removed from all public shop listings.'
          : 'Product will be restored to public shop listings with Active status.',
        reason,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'set_archive_status' || pending.productId !== productId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitSetArchiveStatus(env, pending, product.given_name || product.product_name);
}

async function commitSetArchiveStatus(
  env: Env,
  m: Extract<PendingMutation, { kind: 'set_archive_status' }>,
  productName: string,
) {
  const newStatus = m.archived ? 'Archived' : 'Active';
  const newListingStatus = m.archived ? 'archived' : 'active';

  await env.DB.batch([
    env.DB.prepare(
      "UPDATE products SET status = ?, updated_at = datetime('now') WHERE id = ? AND account_id = ?"
    ).bind(newStatus, m.productId, m.accountId),
    env.DB.prepare(
      "UPDATE product_listings SET status = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(newListingStatus, `list_${m.productId}`),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'ARCHIVE_STATUS_SET_MCP', ?, ?, 'product', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Product "${productName}" ${m.archived ? 'archived' : 'unarchived'} via MCP${m.reason ? ': ' + m.reason : ''}`,
      m.userEmail, m.productId, m.accountId,
    ),
  ]);
  return {
    committed: true,
    action: 'set_archive_status',
    product_id: m.productId,
    product_name: productName,
    new_status: newStatus,
  };
}

// ── tool: set_tea_visibility (preview / confirm) ──
// Toggles whether a tea is listed in the public shop (shown_in_shop) WITHOUT
// changing its status. The product stays Active/archived-none — this only
// pulls it off (or puts it back on) the storefront listing. Owner-tier only,
// mirroring the REST PUT /api/products/:id/shown gate.
async function toolSetTeaVisibility(env: Env, auth: McpAuth, args: any) {
  const productId = String(args?.product_id || '').trim();
  const shownInShop = Boolean(args?.shown_in_shop);
  const personal = Boolean(args?.personal);
  const isPublic = args?.is_public != null ? Boolean(args.is_public) : undefined;
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!productId) throw new Error('product_id is required');

  const product = await env.DB.prepare(
    'SELECT id, given_name, product_name, status, shown_in_shop FROM products WHERE account_id = ? AND (id = ? OR id LIKE ?)'
  ).bind(auth.accountId, productId, `${productId}-%`).first() as
    { id: string; given_name: string | null; product_name: string; status: string | null; shown_in_shop: number | null } | null;
  if (!product) return { error: 'not_found' };

  const alreadyInTarget = product.shown_in_shop === (shownInShop ? 1 : 0);

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'set_tea_visibility', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, shownInShop, personal, isPublic,
    }, auth.tokenId);
    return {
      preview: {
        action: 'set_tea_visibility',
        product: { id: productId, name: product.given_name || product.product_name },
        current_shown_in_shop: product.shown_in_shop === 1,
        requested_shown_in_shop: shownInShop,
        marks_personal_collection: personal,
        sets_public_listing: isPublic,
        already_in_target_state: alreadyInTarget,
        note: 'status is NOT changed — the product remains Active/archived-none; this only flips its shop listing visibility.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'set_tea_visibility' || pending.productId !== productId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitSetTeaVisibility(env, pending, product.given_name || product.product_name);
}

async function commitSetTeaVisibility(
  env: Env,
  m: Extract<PendingMutation, { kind: 'set_tea_visibility' }>,
  productName: string,
) {
  const shown = m.shownInShop ? 1 : 0;
  const personal = m.personal ? 1 : 0;
  const publicFlag = m.isPublic === true ? 1 : 0;
  const idOrPrefix = m.productId;
  const idLike = `${idOrPrefix}-%`;
  // When marking personal collection, the tea is also pulled off the public
  // shop (is_public=0) and tagged inventory_purpose='personal', is_personal=1.
  // Passing is_public=true instead raises the public-listing flag (is_public=1)
  // so intake-created Draft items (which finalize sets to is_public=0) can be
  // published by the operator without owner-tier REST auth. Order matters:
  // public=1 wins, otherwise personal=1 zeroes is_public, otherwise unchanged.
  const inventoryPurpose = m.personal ? 'personal' : null;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE products SET shown_in_shop = ?,
        is_personal = CASE WHEN ? = 1 THEN 1 ELSE is_personal END,
        is_public = CASE WHEN ? = 1 THEN 1 WHEN ? = 1 THEN 0 ELSE is_public END,
        inventory_purpose = CASE WHEN ? = 1 THEN 'personal' ELSE inventory_purpose END,
        updated_at = datetime('now')
      WHERE account_id = ? AND (id = ? OR id LIKE ?)`
    ).bind(shown, personal, publicFlag, personal, personal, m.accountId, idOrPrefix, idLike),
    env.DB.prepare(
      `UPDATE product_listings SET shown_in_shop = ?,
        is_personal = CASE WHEN ? = 1 THEN 1 ELSE is_personal END,
        is_public = CASE WHEN ? = 1 THEN 1 WHEN ? = 1 THEN 0 ELSE is_public END,
        inventory_purpose = CASE WHEN ? = 1 THEN 'personal' ELSE inventory_purpose END,
        updated_at = datetime('now')
      WHERE id IN (SELECT 'list_' || id FROM products WHERE account_id = ? AND (id = ? OR id LIKE ?))`
    ).bind(shown, personal, publicFlag, personal, personal, m.accountId, idOrPrefix, idLike),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'SHOP_VISIBILITY_SET_MCP', ?, ?, 'product', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Product "${productName}" ${m.shownInShop ? 'shown in' : 'hidden from'} shop via MCP${m.personal ? ' and marked personal collection' : ''}${m.isPublic === true ? ' and set public listing' : ''} (status unchanged)`,
      m.userEmail, m.productId, m.accountId,
    ),
  ]);
  return {
    committed: true,
    action: 'set_tea_visibility',
    product_id: m.productId,
    product_name: productName,
    shown_in_shop: m.shownInShop,
    personal_collection: m.personal ? true : undefined,
  };
}

// ── tool: fulfill_invoice (preview / confirm) ──
// Deducts stock for all unfulfilled line items on a Draft invoice. Refuses
// if any line would underflow stock (negative balance).
async function toolFulfillInvoice(env: Env, auth: McpAuth, args: any) {
  const invoiceId = String(args?.invoice_id || '').trim();
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!invoiceId) throw new Error('invoice_id is required');

  const invoice = await env.DB.prepare(
    'SELECT id, invoice_number, customer_name, status, inventory_deducted,sold_by_user_id FROM invoices WHERE id = ? AND account_id = ?'
  ).bind(invoiceId, auth.accountId).first() as Record<string, any> | null;
  if (!invoice) return { error: 'invoice_not_found' };
  if (invoice.status === 'Void') return { error: 'void_invoice_cannot_be_fulfilled' };
  if (invoice.inventory_deducted) return { error: 'inventory_already_deducted', invoice_status: invoice.status };

  const { results: rawItems } = await env.DB.prepare(
    `SELECT ili.id,ili.product_id,ili.custom_name,ili.quantity,ili.price_at_sale,
            ili.stock_owner_user_id,ili.sales_grant_id,ili.owner_share_type,ili.owner_share_value,
            p.given_name,p.product_name,p.stock_grams
       FROM invoice_line_items ili
       LEFT JOIN products p ON p.id = ili.product_id AND p.account_id = ?
      WHERE ili.invoice_id = ? AND ili.account_id = ?`
  ).bind(auth.accountId, invoiceId, auth.accountId).all();

  // Aggregate duplicate product lines so underflow checks and deductions apply
  // to the invoice total, not per line: two 60g lines of the same product on
  // 100g stock must fail, and must never write two ledger rows that each claim
  // the same starting balance. Custom items (no product_id) pass through as-is.
  const byProduct = new Map<string, any>();
  const items: any[] = [];
  for (const raw of rawItems as any[]) {
    if (!raw.product_id) { items.push(raw); continue; }
    const existing = byProduct.get(raw.product_id);
    if (existing) {
      existing.quantity = (Number(existing.quantity) || 0) + (Number(raw.quantity) || 0);
    } else {
      const copy = { ...raw, quantity: Number(raw.quantity) || 0 };
      byProduct.set(raw.product_id, copy);
      items.push(copy);
    }
  }
  for (const item of items) {
    item.available_stock_grams = item.product_id
      ? Math.max(0, Number(item.stock_grams || 0) - await activeHeldGrams(env, auth.accountId, item.product_id, invoiceId))
      : 0;
  }

  // Build per-line summary + check for underflows.
  type LineCheck = {
    product_id: string | null;
    product_name: string;
    quantity_grams: number;
    stock_before: number;
    stock_after: number;
    underflow: boolean;
  };

  const lineChecks: LineCheck[] = items.map(item => {
    const qty = Number(item.quantity) || 0;
    const stock = Number(item.available_stock_grams) || 0;
    return {
      product_id: item.product_id ?? null,
      product_name: item.given_name || item.product_name || '(custom item)',
      quantity_grams: qty,
      stock_before: stock,
      stock_after: item.product_id ? stock - qty : 0,
      underflow: Boolean(item.product_id) && qty > stock,
    };
  });

  const underflowLines = lineChecks.filter(l => l.underflow);
  if (underflowLines.length > 0) {
    // Refuse even the preview — this is a hard block.
    return {
      error: 'stock_underflow',
      message: 'One or more line items would result in negative stock. Restock those products first.',
      underflow_lines: underflowLines.map(l => ({
        product_id: l.product_id,
        product_name: l.product_name,
        quantity_grams: l.quantity_grams,
        available_grams: l.stock_before,
        shortfall_grams: l.quantity_grams - l.stock_before,
      })),
    };
  }

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'fulfill_invoice', accountId: auth.accountId, userEmail: auth.userEmail,
      actorUserId: auth.userId, invoiceId,
    }, auth.tokenId);
    return {
      preview: {
        action: 'fulfill_invoice',
        invoice: {
          id: invoiceId,
          invoice_number: invoice.invoice_number,
          customer_name: invoice.customer_name,
          status: invoice.status,
        },
        line_deductions: lineChecks.map(l => ({
          product_name: l.product_name,
          quantity_grams: l.quantity_grams,
          stock_before: l.stock_before,
          stock_after: l.stock_after,
        })),
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'fulfill_invoice' || pending.invoiceId !== invoiceId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitFulfillInvoice(env, pending, invoice, items, rawItems as any[]);
}

async function commitFulfillInvoice(
  env: Env,
  m: Extract<PendingMutation, { kind: 'fulfill_invoice' }>,
  invoice: Record<string, any>,
  lineItems: any[],
  settlementLines: any[],
) {
  if (!invoice.sold_by_user_id) return { error: 'invoice_seller_snapshot_missing' };
  const fulfillmentClaim = crypto.randomUUID();
  // Same status clause as the REST fulfil handler, and load-bearing for the
  // same reason: voiding resets inventory_deducted to 0, so without it a
  // voided invoice could be fulfilled through this tool — deducting the stock
  // a second time and quietly reversing the void.
  const claimed = await env.DB.prepare(
    `UPDATE invoices SET fulfillment_claim_token = ?, fulfillment_claimed_at = datetime('now')
     WHERE id = ? AND account_id = ? AND inventory_deducted = 0
       AND status IN ('Draft', 'Pending')
       AND (fulfillment_claim_token IS NULL OR fulfillment_claimed_at IS NULL OR fulfillment_claimed_at < datetime('now', '-5 minutes'))
     RETURNING id`
  ).bind(fulfillmentClaim, m.invoiceId, m.accountId).first();
  if (!claimed) return { error: 'invoice_fulfillment_already_claimed' };
  const releaseClaim = () => env.DB.prepare(
    'UPDATE invoices SET fulfillment_claim_token = NULL, fulfillment_claimed_at = NULL WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?'
  ).bind(m.invoiceId, m.accountId, fulfillmentClaim).run();
  const stmts: D1PreparedStatement[] = [];

  for (const item of lineItems) {
    if (!item.product_id) continue; // custom items have no stock

    // Re-read stock at commit time for race-condition safety.
    const product = await env.DB.prepare(
      'SELECT id, stock_grams, given_name, product_name, status, low_stock_threshold, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
    ).bind(item.product_id, m.accountId).first() as any;
    if (!product) continue;

    const currentStock = Number(product.stock_grams || 0);
    const availableStock = currentStock - await activeHeldGrams(env, m.accountId, item.product_id, m.invoiceId);
    const qty = Number(item.quantity) || 0;
    if (qty > availableStock) {
      await releaseClaim().catch(() => {});
      // Abort — stock changed between preview and confirm.
      return {
        error: 'stock_underflow_at_commit',
        product_id: item.product_id,
        product_name: product.given_name || product.product_name,
        requested_grams: qty,
        available_grams: Math.max(0, availableStock),
        message: 'Stock changed between preview and commit. Re-run fulfill_invoice to get a fresh preview.',
      };
    }

    const newBalance = currentStock - qty;
    const threshold = Number(product.low_stock_threshold || 0);

    stmts.push(
      env.DB.prepare(`UPDATE products SET stock_grams = CASE
          WHEN stock_grams - COALESCE((SELECT SUM(held_grams) FROM stock_holds
            WHERE account_id=? AND product_id=? AND invoice_id!=?
              AND (expires_at IS NULL OR expires_at>datetime('now'))),0) >= ?
          THEN stock_grams - ? ELSE -1 END
        WHERE id = ? AND account_id = ?
          AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?)`)
        .bind(m.accountId, item.product_id, m.invoiceId, qty, qty, item.product_id, m.accountId,
          m.invoiceId, m.accountId, fulfillmentClaim)
    );
    stmts.push(
      env.DB.prepare(
        "UPDATE product_listings SET stock_grams = stock_grams - ?, updated_at = datetime('now') WHERE id = ? AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?)"
      ).bind(qty, `list_${item.product_id}`, m.invoiceId, m.accountId, fulfillmentClaim)
    );
    stmts.push(
      env.DB.prepare(
        `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, source_invoice_id, source_invoice_number, user_email, note, account_id)
         SELECT ?, ?, ?, p.stock_grams, 'FULFILLMENT', ?, ?, ?, ?, ? FROM products p
         WHERE p.id=? AND p.account_id=?
           AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?)`
      ).bind(
        crypto.randomUUID(), item.product_id, -qty,
        m.invoiceId, invoice.invoice_number as string, m.userEmail,
        'MCP fulfill_invoice', m.accountId, item.product_id, m.accountId,
        m.invoiceId, m.accountId, fulfillmentClaim,
      )
    );

    if (newBalance <= 0 && product.status !== 'Sold Out') {
      stmts.push(
        env.DB.prepare("UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?)")
          .bind(item.product_id, m.accountId, m.invoiceId, m.accountId, fulfillmentClaim)
      );
      stmts.push(
        env.DB.prepare("UPDATE product_listings SET status = 'Sold Out', updated_at = datetime('now') WHERE id = ? AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?)")
          .bind(`list_${item.product_id}`, m.invoiceId, m.accountId, fulfillmentClaim)
      );
      if (product.source_compass_entry_id) {
        stmts.push(
          env.DB.prepare("UPDATE tea_compass_entries SET status = 'depleted', updated_at = datetime('now') WHERE id = ? AND status = 'in_stock' AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?)")
            .bind(product.source_compass_entry_id, m.invoiceId, m.accountId, fulfillmentClaim)
        );
      }
    } else if (threshold > 0 && newBalance < threshold && currentStock >= threshold) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
           SELECT ?, 'low_stock_alert', ?, ?, 'product', ?, ? WHERE EXISTS (SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?)`
        ).bind(
          crypto.randomUUID(),
          JSON.stringify({ productName: product.given_name || product.product_name, stockGrams: newBalance, threshold }),
          m.userEmail, item.product_id, m.accountId, m.invoiceId, m.accountId, fulfillmentClaim,
        )
      );
    }
  }

  stmts.push(
    env.DB.prepare('DELETE FROM stock_holds WHERE invoice_id = ? AND account_id = ? AND EXISTS (SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?)')
      .bind(m.invoiceId, m.accountId, m.invoiceId, m.accountId, fulfillmentClaim)
  );
  stmts.push(...buildSettlementStatements(env, {
    accountId: m.accountId, invoice, lines: settlementLines,
  }));
  stmts.push(
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       SELECT ?, 'INVOICE_FULFILLED_MCP', ?, ?, 'invoice', ?, ?
       WHERE EXISTS (SELECT 1 FROM invoices WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?)`
    ).bind(
      crypto.randomUUID(),
      `Invoice ${invoice.invoice_number as string} fulfilled via MCP for ${invoice.customer_name as string} (${lineItems.length} item(s))`,
      m.userEmail, m.invoiceId, m.accountId, m.invoiceId, m.accountId, fulfillmentClaim,
    )
  );
  const finalizeIndex = stmts.length;
  stmts.push(
    env.DB.prepare("UPDATE invoices SET status = 'Filled', inventory_deducted = 1, fulfilled_at = COALESCE(fulfilled_at, datetime('now')), fulfillment_claim_token = NULL, fulfillment_claimed_at = NULL WHERE id = ? AND account_id = ? AND fulfillment_claim_token = ?")
      .bind(m.invoiceId, m.accountId, fulfillmentClaim)
  );

  try {
    const results = await env.DB.batch(stmts);
    if (Number(results[finalizeIndex]?.meta?.changes || 0) === 0) return { error: 'invoice_fulfillment_lease_lost' };
  } catch (error) {
    await releaseClaim().catch(() => {});
    if (/stock_grams cannot be negative/i.test(String((error as Error)?.message || error))) {
      return { error: 'stock_underflow_at_commit' };
    }
    throw error;
  }

  return {
    committed: true,
    action: 'fulfill_invoice',
    invoice_id: m.invoiceId,
    invoice_number: invoice.invoice_number,
    status: 'Filled',
    items_fulfilled: lineItems.filter(i => i.product_id).length,
  };
}

// ── tool: mark_invoice_paid (preview / confirm) ──
//
// Marks an invoice paid. Optionally also fulfills stock (fulfill_stock=true) by
// delegating to commitFulfillInvoice — for the "they paid and took it" case.
async function toolMarkInvoicePaid(env: Env, auth: McpAuth, args: any) {
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (confirm) {
    const suppliedInvoiceId = args?.invoice_id ? String(args.invoice_id).trim() : '';
    const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
    // Rebind guard: if the caller re-supplies invoice_id on confirm it must
    // match the previewed ticket (parity with add_stock/void_invoice/
    // fulfill_invoice). Empty arg means "trust the ticket" and is allowed.
    if (
      !pending ||
      pending.kind !== 'mark_invoice_paid' ||
      (suppliedInvoiceId && pending.invoiceId !== suppliedInvoiceId)
    ) {
      return { error: 'invalid_or_expired_confirmation_token' };
    }
    return commitMarkInvoicePaid(env, pending);
  }

  const invoiceId = args?.invoice_id ? String(args.invoice_id).trim() : '';
  const invoiceNumber = args?.invoice_number ? String(args.invoice_number).trim() : '';
  const paymentMethod = args?.payment_method ? String(args.payment_method).slice(0, 80) : 'mcp';
  const fulfillStock = Boolean(args?.fulfill_stock);

  const row = await findInvoiceForPayment(env, auth.accountId, invoiceId, invoiceNumber);
  if (row?.__duplicate_invoice_number) {
    return { error: 'duplicate_invoice_number', invoice_number: invoiceNumber, matches: row.matches };
  }
  if (!row) {
    return { error: 'invoice_not_found', invoice_id: invoiceId || null, invoice_number: invoiceNumber || null };
  }

  const token = await issueConfirmationToken(env, {
    kind: 'mark_invoice_paid', accountId: auth.accountId, userEmail: auth.userEmail,
    actorUserId: auth.userId, actorRole: OWNER_TIERS.has(auth.creatorTier) ? 'owner' : 'staff',
    invoiceId: row.id, invoiceNumber: row.invoice_number,
    paymentMethod, fulfillStock,
  }, auth.tokenId);
  return {
    preview: {
      action: 'mark_invoice_paid',
      invoice: row,
      payment_method: paymentMethod,
      stock_effect: fulfillStock
        ? 'also deduct invoice line items and mark invoice Filled'
        : 'payment only; stock is unchanged',
    },
    confirmation_token: token,
    expires_in_seconds: PENDING_TTL_MS / 1000,
  };
}

// Resolve the invoice for a payment: by id, by invoice number (flagging
// duplicates), or fall back to the most recent unpaid invoice on the account.
async function findInvoiceForPayment(
  env: Env,
  accountId: string,
  invoiceId: string,
  invoiceNumber: string,
): Promise<any | null> {
  if (invoiceId) {
    return env.DB.prepare(
      `SELECT id, invoice_number, customer_name, status, payment_status, payment_date
         FROM invoices WHERE id = ? AND account_id = ?`
    ).bind(invoiceId, accountId).first() as Promise<any | null>;
  }
  if (invoiceNumber) {
    const rows = await env.DB.prepare(
      `SELECT id, invoice_number, customer_name, status, payment_status, payment_date
         FROM invoices WHERE invoice_number = ? AND account_id = ?`
    ).bind(invoiceNumber, accountId).all();
    const matches = (rows.results ?? []) as any[];
    if (matches.length > 1) return { __duplicate_invoice_number: true, matches: matches.slice(0, 5) };
    return matches[0] ?? null;
  }
  return env.DB.prepare(
    `SELECT id, invoice_number, customer_name, status, payment_status, payment_date
       FROM invoices
      WHERE account_id = ? AND COALESCE(payment_status, 'unpaid') != 'paid'
      ORDER BY created_at DESC
      LIMIT 1`
  ).bind(accountId).first() as Promise<any | null>;
}

async function commitMarkInvoicePaid(env: Env, m: Extract<PendingMutation, { kind: 'mark_invoice_paid' }>) {
  const now = new Date().toISOString();
  const paymentResult = await env.DB.prepare(
    `UPDATE invoices
        SET payment_status = 'paid',
            payment_date = ?,
            payment_method = ?
      WHERE id = ? AND account_id = ? AND COALESCE(payment_status, 'unpaid') != 'paid'`
  ).bind(now, m.paymentMethod, m.invoiceId, m.accountId).run();
  const alreadyPaid = (paymentResult.meta?.changes ?? 0) === 0;

  if (!alreadyPaid) {
    await env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'INVOICE_MARKED_PAID_MCP', ?, ?, 'invoice', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Invoice ${m.invoiceNumber} marked paid via MCP`,
      m.userEmail, m.invoiceId, m.accountId,
    ).run();
  }

  // Optional stock fulfillment. main's commitFulfillInvoice needs the invoice
  // row + line items, and refuses if inventory is already deducted, so fetch
  // both here and skip cleanly when fulfillment is not applicable.
  let fulfillment: unknown = null;
  if (m.fulfillStock) {
    const invoice = await env.DB.prepare(
      'SELECT id, invoice_number, customer_name, status, inventory_deducted,sold_by_user_id FROM invoices WHERE id = ? AND account_id = ?'
    ).bind(m.invoiceId, m.accountId).first() as Record<string, any> | null;

    if (!invoice) {
      fulfillment = { error: 'invoice_not_found' };
    } else if (invoice.status === 'Void') {
      fulfillment = { error: 'void_invoice_cannot_be_fulfilled' };
    } else if (invoice.inventory_deducted) {
      fulfillment = { skipped: true, reason: 'inventory_already_deducted' };
    } else {
      const { results: lineItems } = await env.DB.prepare(
        `SELECT ili.id,ili.product_id,ili.custom_name,ili.quantity,ili.price_at_sale,
                ili.stock_owner_user_id,ili.sales_grant_id,ili.owner_share_type,ili.owner_share_value,
                p.given_name,p.product_name,p.stock_grams
           FROM invoice_line_items ili
           LEFT JOIN products p ON p.id = ili.product_id AND p.account_id = ?
          WHERE ili.invoice_id = ? AND ili.account_id = ?`
      ).bind(m.accountId, m.invoiceId, m.accountId).all();
      fulfillment = await commitFulfillInvoice(
        env,
        { kind: 'fulfill_invoice', accountId: m.accountId, userEmail: m.userEmail, actorUserId: m.actorUserId, invoiceId: m.invoiceId },
        invoice,
        lineItems as any[],
        lineItems as any[],
      );
    }
  }

  return {
    committed: true,
    action: 'mark_invoice_paid',
    invoice_id: m.invoiceId,
    invoice_number: m.invoiceNumber,
    payment_status: 'paid',
    payment_date: now,
    payment_method: m.paymentMethod,
    already_paid: alreadyPaid,
    fulfillment,
  };
}

// ============================================================================
// Round three: the order process, reachable by voice.
//
// Order requests arriving, turning one into a real order, customers reporting
// payments, confirming them. All of that existed only behind a screen. The
// tools below put it on this server so the shop can be run by talking to it.
//
// ── Where the money rules live ──
//
// index.ts imports THIS module (mcpFetch, publicMcpFetch, the OAuth handlers),
// so importing back would close a module cycle. Round three worked around that
// by COPYING eleven pieces of the money code here under a "keep in sync" note,
// which meant a change to what counts as paid had to be made twice or the
// screen and the spoken answer would quietly disagree about money.
//
// They now live in worker/src/invoiceDomain.ts, which imports neither file, and
// both import from it: PAYMENT_EPSILON, the text limits and caps, roundUsd,
// paymentTextField, formatInvoiceNumber, loadInvoiceLedgerTotals, invoiceMoney,
// loadLedgerInvoice, reconcileLedgerWithColumn, recomputeInvoicePaymentStatus.
// Anything else this file and index.ts must agree about belongs there too, not
// in a second copy here.
// ============================================================================

/** An amount as it should be heard rather than read. */
function usdWords(value: number): string {
  return `${roundUsd(value).toFixed(2)} US dollars`;
}

// SQLite writes datetime('now') as "YYYY-MM-DD HH:MM:SS" with no zone marker,
// and it is always UTC. Parsed naively that reads as local time, and an order
// that arrived an hour ago can be reported as waiting since tomorrow.
function parseSqlTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const raw = String(value).trim();
  const iso = /[TZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw.replace(' ', 'T')}Z`;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function toIsoTime(value: string | null | undefined): string | null {
  const ms = parseSqlTime(value);
  return ms == null ? null : new Date(ms).toISOString();
}

/** How long something has been waiting, in words a person would say. */
function waitedFor(value: string | null | undefined): string {
  const ms = parseSqlTime(value);
  if (ms == null) return 'an unknown time';
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks} weeks`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? '' : 's'}`;
}

/** "one", "two things", "three of the four": small counts read better as words. */
const SMALL_NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
function countWord(n: number): string {
  return n >= 0 && n < SMALL_NUMBERS.length ? SMALL_NUMBERS[n] : String(n);
}

/** "a, b and c", a list as it is spoken rather than as it is printed. */
function spokenList(parts: (string | null)[]): string {
  const kept = parts.filter(Boolean) as string[];
  if (kept.length === 0) return '';
  if (kept.length === 1) return kept[0];
  return `${kept.slice(0, -1).join(', ')} and ${kept[kept.length - 1]}`;
}

/**
 * The trailing qualifiers on a money sentence, comma-joined with no "and".
 * "40.00 US dollars by Bank transfer, reference ABC123, 2 days ago" reads
 * correctly aloud; the same parts through spokenList would land on
 * "reference ABC123 and 2 days ago", which does not.
 */
function spokenClause(parts: (string | null)[]): string {
  return (parts.filter(Boolean) as string[]).join(', ');
}

/** A fragment used as the start of a sentence. */
function startSentence(text: string): string {
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : text;
}

/** Mirrors ensureContactRelationship, index.ts, for the one kind convert needs. */
async function ensureBuyerRelationship(
  env: Env,
  accountId: string,
  customerId: string | null,
  invoiceId: string,
): Promise<void> {
  if (!customerId) return;
  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO contact_relationships
        (id, account_id, customer_id, kind, source, source_entity_type, source_entity_id)
       VALUES (?, ?, ?, 'buyer', 'workflow', 'invoice', ?)`
    ).bind(crypto.randomUUID(), accountId, customerId, invoiceId).run();
  } catch {
    // Keep the convert alive if a local database has not run migration 069 yet.
  }
}

/** One activity_logs row, best effort. Money must never fail because logging did. */
async function logOrderProcessActivity(
  env: Env,
  args: { accountId: string; userEmail: string; action: string; details: string; invoiceId: string },
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, ?, ?, ?, 'invoice', ?, ?)`
    ).bind(
      crypto.randomUUID(), args.action, args.details,
      args.userEmail, args.invoiceId, args.accountId,
    ).run();
  } catch { /* never fail the money move on a log */ }
}

// ── What needs Adrian ────────────────────────────────────────────────────────
//
// The same four questions Agent W's GET /api/attention answers, in the same
// shape (kind, id, label, meta, waiting_since, href), so the spoken answer and
// the screen can never disagree about what is waiting. It is a second copy of
// those queries only because of the import cycle described above; the rules are
// the frozen contract in todo/plans/order-process-round-3.md, not new ones.
//
// One query per kind, capped, never an N+1 across orders.

type AttentionKind = 'request' | 'unpriced' | 'claim' | 'unsent';

interface AttentionItem {
  kind: AttentionKind;
  id: string;
  label: string;
  meta: string | null;
  waiting_since: string;
  href: string;
  /** Not in W's REST shape. The identifier a voice caller would say back. */
  reference: string | null;
}

interface AttentionResult {
  items: AttentionItem[];
  counts: { requests: number; unpriced: number; claims: number; unsent: number };
}

/** How many rows each kind may contribute before the list is simply "lots". */
const ATTENTION_PER_KIND_CAP = 50;

function countInquiryItems(raw: unknown): number {
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/** Where a kind opens in the admin. Mirrors the links ActivityView already uses. */
function attentionHref(kind: AttentionKind, invoiceNumber: string | null): string {
  if (kind === 'request') return '/admin/activity?tab=inquiries';
  return invoiceNumber
    ? `/admin/activity?tab=orders&search=${encodeURIComponent(invoiceNumber)}`
    : '/admin/activity?tab=orders';
}

async function gatherAttention(env: Env, accountId: string): Promise<AttentionResult> {
  // 1. request. An order request nobody has answered. 'replied' and 'closed'
  //    have been answered; a converted request has become an order and is now
  //    the unpriced kind's problem, not this one's.
  const requestRows = await env.DB.prepare(
    `SELECT id, name, ref_number, items, created_at
       FROM inquiries
      WHERE account_id = ?
        AND converted_invoice_id IS NULL
        AND COALESCE(status, 'new') IN ('new', 'seen')
      ORDER BY created_at ASC
      LIMIT ?`
  ).bind(accountId, ATTENTION_PER_KIND_CAP).all();

  // 2. unpriced. An order that cannot be paid for as it stands: a converted
  //    request still sitting as a draft, or ANY live order carrying a line
  //    priced at nothing. A plain draft the operator is mid-composing does not
  //    nag, and a shipped order is water under the bridge. Same rule as
  //    /api/attention in index.ts, deliberately word for word.
  const unpricedRows = await env.DB.prepare(
    `SELECT i.id, i.invoice_number, i.customer_name, i.created_at,
            (SELECT COUNT(*) FROM invoice_line_items l
              WHERE l.invoice_id = i.id AND COALESCE(l.price_at_sale, 0) <= 0) AS zero_lines
       FROM invoices i
      WHERE i.account_id = ?
        AND i.deleted_at IS NULL
        AND i.status <> 'Void'
        AND i.fulfilled_at IS NULL
        AND (
          EXISTS (SELECT 1 FROM invoice_line_items l
                   WHERE l.invoice_id = i.id AND COALESCE(l.price_at_sale, 0) <= 0)
          OR (i.status = 'Draft'
              AND EXISTS (SELECT 1 FROM inquiries q
                           WHERE q.converted_invoice_id = i.id AND q.account_id = i.account_id))
        )
      ORDER BY i.created_at ASC
      LIMIT ?`
  ).bind(accountId, ATTENTION_PER_KIND_CAP).all();

  // 3. claim. A customer has reported a payment nobody has checked. A REPORT,
  //    not money. Only confirm_payment turns one into a settled payment.
  const claimRows = await env.DB.prepare(
    `SELECT p.id, p.invoice_id, p.amount_usd, p.method_label, p.reference, p.claimed_at,
            i.invoice_number, i.customer_name
       FROM invoice_payments p
       LEFT JOIN invoices i ON i.id = p.invoice_id
      WHERE p.account_id = ? AND p.status = 'claimed'
      ORDER BY p.claimed_at ASC
      LIMIT ?`
  ).bind(accountId, ATTENTION_PER_KIND_CAP).all();

  // 4. unsent. Fully paid and not yet fulfilled. The narrowing clause keeps
  //    this off every unpaid order in the account; the settled test itself is
  //    invoiceMoney's, applied below so the column-says-paid rule holds here
  //    exactly as it does on every other read.
  const unsentRows = await env.DB.prepare(
    `SELECT i.id, i.invoice_number, i.customer_name, i.payment_status,
            i.payment_date, i.created_at, i.shipping_cost_usd,
            COALESCE((SELECT SUM(quantity * price_at_sale)
                        FROM invoice_line_items WHERE invoice_id = i.id), 0) AS line_total
       FROM invoices i
      WHERE i.account_id = ?
        AND i.deleted_at IS NULL
        AND i.status <> 'Void'
        AND i.fulfilled_at IS NULL
        AND (COALESCE(i.payment_status, 'unpaid') IN ('paid', 'partial')
             OR EXISTS (SELECT 1 FROM invoice_payments ip
                         WHERE ip.invoice_id = i.id AND ip.status = 'confirmed'))
      ORDER BY COALESCE(i.payment_date, i.created_at) ASC
      LIMIT 200`
  ).bind(accountId).all();

  const unsentCandidates = (unsentRows.results ?? []) as Array<Record<string, any>>;
  const unsentLedger = await loadInvoiceLedgerTotals(env, unsentCandidates.map(r => r.id as string));

  const items: AttentionItem[] = [];

  for (const row of (requestRows.results ?? []) as Array<Record<string, any>>) {
    const who = String(row.name || 'someone');
    const ref = (row.ref_number as string | null) || null;
    const lines = countInquiryItems(row.items);
    items.push({
      kind: 'request',
      id: row.id as string,
      label: `Order request from ${who}${ref ? `, reference ${ref}` : ''}`,
      meta: startSentence(`${lines === 1 ? 'one item' : `${countWord(lines)} items`}, waiting ${waitedFor(row.created_at as string)}`),
      waiting_since: toIsoTime(row.created_at as string) ?? new Date().toISOString(),
      href: attentionHref('request', null),
      reference: ref,
    });
  }

  for (const row of (unpricedRows.results ?? []) as Array<Record<string, any>>) {
    const number = (row.invoice_number as string | null) || null;
    const zero = Number(row.zero_lines || 0);
    items.push({
      kind: 'unpriced',
      id: row.id as string,
      label: `Order ${number ?? 'with no number'} for ${String(row.customer_name || 'a customer')} still needs pricing`,
      meta: startSentence(zero > 0
        ? `${countWord(zero)} line${zero === 1 ? '' : 's'} at no price, waiting ${waitedFor(row.created_at as string)}`
        : `still a draft, waiting ${waitedFor(row.created_at as string)}`),
      waiting_since: toIsoTime(row.created_at as string) ?? new Date().toISOString(),
      href: attentionHref('unpriced', number),
      reference: number,
    });
  }

  for (const row of (claimRows.results ?? []) as Array<Record<string, any>>) {
    const number = (row.invoice_number as string | null) || null;
    const who = String(row.customer_name || 'A customer');
    const method = (row.method_label as string | null) || null;
    const ref = (row.reference as string | null) || null;
    items.push({
      kind: 'claim',
      id: row.id as string,
      label: `${who} says they paid ${usdWords(Number(row.amount_usd || 0))} on order ${number ?? 'with no number'}`,
      meta: startSentence(spokenClause([
        method ? `${method}` : null,
        ref ? `reference ${ref}` : null,
        `reported ${waitedFor(row.claimed_at as string)} ago`,
      ])),
      waiting_since: toIsoTime(row.claimed_at as string) ?? new Date().toISOString(),
      href: attentionHref('claim', number),
      reference: number,
    });
  }

  for (const row of unsentCandidates) {
    const total = roundUsd(Number(row.line_total || 0) + Number(row.shipping_cost_usd || 0));
    const money = invoiceMoney(total, row.payment_status as string | null, unsentLedger.get(row.id as string));
    if (!(money.total_usd > 0) || money.outstanding_usd > 0) continue;
    const number = (row.invoice_number as string | null) || null;
    const since = (row.payment_date as string | null) || (row.created_at as string | null);
    items.push({
      kind: 'unsent',
      id: row.id as string,
      label: `Order ${number ?? 'with no number'} for ${String(row.customer_name || 'a customer')} is paid and not sent`,
      meta: `${usdWords(money.paid_usd)} received, waiting ${waitedFor(since)}`,
      waiting_since: toIsoTime(since) ?? new Date().toISOString(),
      href: attentionHref('unsent', number),
      reference: number,
    });
    if (items.filter(item => item.kind === 'unsent').length >= ATTENTION_PER_KIND_CAP) break;
  }

  // Oldest waiter first, across all four kinds.
  items.sort((a, b) => a.waiting_since.localeCompare(b.waiting_since));

  return {
    items,
    counts: {
      requests: items.filter(item => item.kind === 'request').length,
      unpriced: items.filter(item => item.kind === 'unpriced').length,
      claims: items.filter(item => item.kind === 'claim').length,
      unsent: items.filter(item => item.kind === 'unsent').length,
    },
  };
}

// ── tool: whats_waiting ──
//
// The headline. It answers "what needs me right now" in words, oldest first,
// across all four kinds. Everything else in this round exists to act on one of
// the lines it reads out.
async function toolWhatsWaiting(env: Env, accountId: string, args: any) {
  const limit = Math.min(Math.max(Number(args?.limit) || 8, 1), 40);
  const kindArg = args?.kind ? String(args.kind).trim().toLowerCase() : '';
  const wanted: AttentionKind | null =
    kindArg === 'request' || kindArg === 'unpriced' || kindArg === 'claim' || kindArg === 'unsent'
      ? kindArg
      : null;

  const { items: all, counts } = await gatherAttention(env, accountId);
  const filtered = wanted ? all.filter(item => item.kind === wanted) : all;
  const shown = filtered.slice(0, limit);
  const total = filtered.length;

  if (total === 0) {
    return {
      spoken: wanted
        ? `Nothing of that kind is waiting on you.`
        : `Nothing is waiting on you right now. No unanswered order requests, no unpriced orders, no reported payments and nothing paid waiting to be sent.`,
      items: [], counts, total: 0, shown: 0,
    };
  }

  const breakdown = spokenList([
    counts.requests ? `${countWord(counts.requests)} order request${counts.requests === 1 ? '' : 's'}` : null,
    counts.unpriced ? `${countWord(counts.unpriced)} order${counts.unpriced === 1 ? '' : 's'} to price` : null,
    counts.claims ? `${countWord(counts.claims)} reported payment${counts.claims === 1 ? '' : 's'} to check` : null,
    counts.unsent ? `${countWord(counts.unsent)} paid order${counts.unsent === 1 ? '' : 's'} to send` : null,
  ]);

  const lines = [
    startSentence(`${countWord(total)} thing${total === 1 ? ' is' : 's are'} waiting on you.`),
    wanted ? '' : `${startSentence(breakdown)}.`,
    'Oldest first.',
    ...shown.map((item, index) => `${index + 1}. ${item.label}. ${item.meta ?? ''}`.trim()),
    total > shown.length ? startSentence(`${countWord(total - shown.length)} more after that.`) : '',
  ].filter(Boolean);

  return {
    spoken: lines.join('\n'),
    items: shown,
    counts,
    total,
    shown: shown.length,
  };
}

// ── tool: list_order_requests ──
//
// What has come in, with who, what and how long ago. The reference is what a
// voice caller says back to convert_order_request, so it leads every line.
async function toolListOrderRequests(env: Env, accountId: string, args: any) {
  const limit = Math.min(Math.max(Number(args?.limit) || 10, 1), 50);
  const statusArg = args?.status ? String(args.status).trim().toLowerCase() : 'unanswered';

  // Every column is qualified: the query joins invoices, which carries its own
  // `status`, so a bare one is ambiguous and the whole tool returns nothing.
  const wheres: string[] = ['i.account_id = ?'];
  const binds: any[] = [accountId];
  if (statusArg === 'unanswered') {
    wheres.push("i.converted_invoice_id IS NULL AND COALESCE(i.status, 'new') IN ('new', 'seen')");
  } else if (statusArg === 'converted') {
    wheres.push('i.converted_invoice_id IS NOT NULL');
  } else if (['new', 'seen', 'replied', 'closed'].includes(statusArg)) {
    wheres.push("COALESCE(i.status, 'new') = ?");
    binds.push(statusArg);
  } else if (statusArg !== 'all') {
    return { error: 'unknown_status', spoken: `I do not know the request status "${statusArg}". Try unanswered, new, seen, replied, closed, converted or all.` };
  }

  const { results } = await env.DB.prepare(
    `SELECT i.id, i.name, i.email, i.phone, i.ref_number, i.items, i.total_usd,
            i.currency, i.message, COALESCE(i.status, 'new') AS status,
            i.created_at, i.converted_invoice_id, i.source,
            inv.invoice_number AS converted_invoice_number
       FROM inquiries i
       LEFT JOIN invoices inv ON inv.id = i.converted_invoice_id
      WHERE ${wheres.join(' AND ')}
      ORDER BY i.created_at DESC
      LIMIT ?`
  ).bind(...binds, limit).all();

  const requests = ((results ?? []) as Array<Record<string, any>>).map(row => {
    let items: Array<Record<string, any>> = [];
    try {
      const parsed = JSON.parse(String(row.items || '[]'));
      if (Array.isArray(parsed)) items = parsed.filter(item => item && typeof item === 'object');
    } catch { /* an unreadable cart is an empty one, never a thrown tool call */ }
    return {
      request_id: row.id as string,
      reference: (row.ref_number as string | null) || null,
      name: (row.name as string | null) || null,
      email: (row.email as string | null) || null,
      phone: (row.phone as string | null) || null,
      status: row.status as string,
      source: (row.source as string | null) || null,
      message: (row.message as string | null) || null,
      created_at: toIsoTime(row.created_at as string),
      waited: waitedFor(row.created_at as string),
      already_converted: Boolean(row.converted_invoice_id),
      converted_invoice_id: (row.converted_invoice_id as string | null) || null,
      converted_invoice_number: (row.converted_invoice_number as string | null) || null,
      item_count: items.length,
      items: items.slice(0, 20).map(item => ({
        product_id: String(item.id || '') || null,
        name: String(item.name || 'Item'),
        grams: Number(item.quantityGrams ?? item.qty ?? 1) || 1,
      })),
      customer_total_usd: Number(row.total_usd || 0) || 0,
    };
  });

  if (requests.length === 0) {
    return {
      spoken: statusArg === 'unanswered'
        ? 'No order requests are waiting for an answer.'
        : `No order requests match ${statusArg}.`,
      requests: [], count: 0, status: statusArg,
    };
  }

  const lines = requests.map(request => {
    const what = request.items.length
      ? spokenList(request.items.slice(0, 4).map(item => `${item.name} ${item.grams} gram${item.grams === 1 ? '' : 's'}`))
      : 'no items listed';
    const tail = request.already_converted
      ? `Already an order, ${request.converted_invoice_number ?? 'number unknown'}.`
      : `Not answered yet. ${request.waited} old.`;
    return `${request.name || 'Someone'}${request.reference ? `, reference ${request.reference}` : ''}. ${what}. ${tail}`;
  });

  return {
    spoken: [
      startSentence(`${countWord(requests.length)} order request${requests.length === 1 ? '' : 's'}${statusArg === 'unanswered' ? ' waiting for an answer' : ''}.`),
      ...lines,
    ].join('\n'),
    requests,
    count: requests.length,
    status: statusArg,
  };
}

// ── tool: list_payment_claims ──
//
// Who says they have paid, how much, by what method and the reference they
// quoted. These are REPORTS. Nothing here is money until confirm_payment says
// so, and the spoken text says that out loud rather than trusting the model to
// remember it.
async function toolListPaymentClaims(env: Env, accountId: string, args: any) {
  const limit = Math.min(Math.max(Number(args?.limit) || 10, 1), 50);
  const statusArg = args?.status ? String(args.status).trim().toLowerCase() : 'claimed';
  if (!['claimed', 'confirmed', 'rejected', 'all'].includes(statusArg)) {
    return { error: 'unknown_status', spoken: `I do not know the payment status "${statusArg}". Try claimed, confirmed, rejected or all.` };
  }

  const wheres: string[] = ['p.account_id = ?'];
  const binds: any[] = [accountId];
  if (statusArg !== 'all') { wheres.push('p.status = ?'); binds.push(statusArg); }
  if (args?.invoice_id) { wheres.push('p.invoice_id = ?'); binds.push(String(args.invoice_id).trim()); }
  if (args?.invoice_number) { wheres.push('i.invoice_number = ?'); binds.push(String(args.invoice_number).trim()); }

  const { results } = await env.DB.prepare(
    `SELECT p.id, p.invoice_id, p.amount_usd, p.amount_original, p.currency,
            p.method_label, p.reference, p.note, p.status, p.claimed_by,
            p.claimed_at, p.confirmed_at,
            i.invoice_number, i.customer_name, i.status AS invoice_status,
            i.payment_status, i.shipping_cost_usd,
            COALESCE((SELECT SUM(quantity * price_at_sale)
                        FROM invoice_line_items WHERE invoice_id = i.id), 0) AS line_total
       FROM invoice_payments p
       LEFT JOIN invoices i ON i.id = p.invoice_id
      WHERE ${wheres.join(' AND ')}
      ORDER BY p.claimed_at ASC, p.created_at ASC
      LIMIT ?`
  ).bind(...binds, limit).all();

  const rows = (results ?? []) as Array<Record<string, any>>;
  const ledger = await loadInvoiceLedgerTotals(env, rows.map(row => row.invoice_id as string));

  const claims = rows.map(row => {
    const total = roundUsd(Number(row.line_total || 0) + Number(row.shipping_cost_usd || 0));
    const money = invoiceMoney(total, row.payment_status as string | null, ledger.get(row.invoice_id as string));
    return {
      payment_id: row.id as string,
      invoice_id: row.invoice_id as string,
      invoice_number: (row.invoice_number as string | null) || null,
      customer_name: (row.customer_name as string | null) || null,
      amount_usd: roundUsd(Number(row.amount_usd || 0)),
      amount_original: row.amount_original == null ? null : Number(row.amount_original),
      currency: (row.currency as string | null) || null,
      method: (row.method_label as string | null) || null,
      reference: (row.reference as string | null) || null,
      note: (row.note as string | null) || null,
      status: row.status as string,
      reported_by: row.claimed_by as string,
      reported_at: toIsoTime(row.claimed_at as string),
      waited: waitedFor(row.claimed_at as string),
      confirmed_at: toIsoTime(row.confirmed_at as string | null),
      order_total_usd: money.total_usd,
      order_paid_usd: money.paid_usd,
      order_outstanding_usd: money.outstanding_usd,
    };
  });

  if (claims.length === 0) {
    return {
      spoken: statusArg === 'claimed'
        ? 'No payments have been reported and left unchecked.'
        : `No payments match ${statusArg}.`,
      claims: [], count: 0, status: statusArg,
    };
  }

  const lines = claims.map(claim => [
    spokenClause([
      `${claim.customer_name || 'A customer'} says they sent ${usdWords(claim.amount_usd)} on order ${claim.invoice_number ?? 'with no number'}${claim.method ? ` by ${claim.method}` : ''}`,
      claim.reference ? `reference ${claim.reference}` : null,
      `${claim.waited} ago`,
    ]) + '.',
    `That order is ${usdWords(claim.order_total_usd)} with ${usdWords(claim.order_outstanding_usd)} still owing.`,
    `Payment id ${claim.payment_id}.`,
  ].join(' '));

  return {
    spoken: [
      startSentence(statusArg === 'claimed'
        ? `${countWord(claims.length)} reported payment${claims.length === 1 ? '' : 's'} waiting to be checked. A report is not money until you confirm it.`
        : `${countWord(claims.length)} payment${claims.length === 1 ? '' : 's'} with status ${statusArg}.`),
      ...lines,
      statusArg === 'claimed'
        ? 'Confirm them one at a time with confirm_payment, using the payment id.'
        : '',
    ].filter(Boolean).join('\n'),
    claims,
    count: claims.length,
    status: statusArg,
  };
}

// ── tool: convert_order_request (preview / confirm) ──
//
// Turns an order request into a real Draft order. Mirrors handleConvertInquiry
// in index.ts line for line, including the 409 when the request is already an
// order and the concurrent-claim unwind, so a voice convert and a click convert
// land in exactly the same place.

interface ConvertedLine {
  product_id: string | null;
  custom_name: string | null;
  quantity: number;
  price_at_sale: number;
  name: string;
}

/** Mirrors the line resolution in handleConvertInquiry, index.ts. */
async function resolveOrderRequestLines(
  env: Env,
  accountId: string,
  rawItems: unknown,
): Promise<ConvertedLine[] | null> {
  let items: Array<Record<string, any>> = [];
  try {
    const parsed = JSON.parse(String(rawItems || '[]'));
    if (Array.isArray(parsed)) items = parsed.filter(item => item && typeof item === 'object');
  } catch {
    items = [];
  }
  if (items.length === 0) return null;

  const productIds = [...new Set(items.map(item => String(item.id || '')).filter(Boolean))];
  const productRows = productIds.length
    ? await env.DB.prepare(
      `SELECT id, type, fixed_retail_price_usd,
              COALESCE(given_name, product_name) AS product_name
         FROM products
        WHERE account_id = ? AND id IN (${productIds.map(() => '?').join(', ')})`
    ).bind(accountId, ...productIds).all()
    : { results: [] as unknown[] };
  const products = new Map<string, Record<string, any>>();
  for (const row of (productRows.results ?? []) as Array<Record<string, any>>) {
    products.set(row.id as string, row);
  }

  return items.map(item => {
    const product = products.get(String(item.id || ''));
    const rawQuantity = Number(item.quantityGrams ?? item.qty ?? 1);
    const quantity = Math.max(1, Math.round(Number.isFinite(rawQuantity) ? rawQuantity : 1));
    const name = String(item.name || product?.product_name || 'Item');
    // Anything the shop no longer carries becomes a named custom line at zero,
    // so nothing is dropped and the price is set by hand.
    if (!product) {
      return { product_id: null, custom_name: name, quantity, price_at_sale: 0, name };
    }
    // Same linking rule as the collection-picks path: teas stay linked to the
    // product row, teaware is carried as a named line.
    const mayRemainLinked = isTeaType(String(product.type || ''));
    const catalogPrice = product.fixed_retail_price_usd == null ? null : Number(product.fixed_retail_price_usd);
    const fallbackPrice = Number(item.pricePerGram);
    const price = catalogPrice != null && Number.isFinite(catalogPrice)
      ? catalogPrice
      : (Number.isFinite(fallbackPrice) && fallbackPrice >= 0 ? fallbackPrice : 0);
    return {
      product_id: mayRemainLinked ? (product.id as string) : null,
      custom_name: mayRemainLinked ? null : (product.product_name as string) || name,
      quantity,
      price_at_sale: price,
      name: (product.product_name as string) || name,
    };
  });
}

async function toolConvertOrderRequest(env: Env, auth: McpAuth, args: any) {
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (confirm) {
    const suppliedId = args?.request_id ? String(args.request_id).trim() : '';
    const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
    if (
      !pending ||
      pending.kind !== 'convert_order_request' ||
      (suppliedId && pending.inquiryId !== suppliedId)
    ) {
      return {
        error: 'invalid_or_expired_confirmation_token',
        spoken: 'That confirmation has already been used or has expired. Ask again and I will read the request back before creating anything.',
      };
    }
    return commitConvertOrderRequest(env, pending);
  }

  const requestId = args?.request_id ? String(args.request_id).trim() : '';
  const reference = args?.reference ? String(args.reference).trim() : '';
  if (!requestId && !reference) {
    return { error: 'request_id_or_reference_required', spoken: 'Tell me which order request, by its id or its reference.' };
  }

  const inquiry = requestId
    ? await env.DB.prepare(
      `SELECT id, name, email, phone, items, currency, message, ref_number, converted_invoice_id, created_at
         FROM inquiries WHERE id = ? AND account_id = ?`
    ).bind(requestId, auth.accountId).first() as Record<string, any> | null
    : await env.DB.prepare(
      `SELECT id, name, email, phone, items, currency, message, ref_number, converted_invoice_id, created_at
         FROM inquiries WHERE ref_number = ? AND account_id = ?
        ORDER BY created_at DESC LIMIT 1`
    ).bind(reference, auth.accountId).first() as Record<string, any> | null;

  if (!inquiry) {
    return {
      error: 'order_request_not_found',
      request_id: requestId || null,
      reference: reference || null,
      spoken: `I cannot find an order request ${requestId ? `with that id` : `with reference ${reference}`}.`,
    };
  }
  // Same 409 the REST route returns, carrying the invoice it already became.
  if (inquiry.converted_invoice_id) {
    const existing = await env.DB.prepare(
      'SELECT invoice_number FROM invoices WHERE id = ? AND account_id = ?'
    ).bind(inquiry.converted_invoice_id, auth.accountId).first() as { invoice_number: string | null } | null;
    return {
      error: 'already_converted',
      status: 409,
      invoice_id: inquiry.converted_invoice_id as string,
      invoice_number: existing?.invoice_number ?? null,
      spoken: `That request is already an order${existing?.invoice_number ? `, ${existing.invoice_number}` : ''}. Nothing was created.`,
    };
  }

  const lines = await resolveOrderRequestLines(env, auth.accountId, inquiry.items);
  if (!lines) {
    return {
      error: 'no_items_to_price',
      status: 400,
      spoken: 'That request has no items to price, so there is nothing to turn into an order.',
    };
  }

  const total = roundUsd(lines.reduce((sum, line) => sum + line.quantity * line.price_at_sale, 0));
  const unpriced = lines.filter(line => !(line.price_at_sale > 0));

  const token = await issueConfirmationToken(env, {
    kind: 'convert_order_request',
    accountId: auth.accountId,
    userEmail: auth.userEmail,
    inquiryId: inquiry.id as string,
    reference: (inquiry.ref_number as string | null) || null,
    customerName: String(inquiry.name || 'Customer'),
  }, auth.tokenId);

  const spoken = [
    `Turning order request ${inquiry.ref_number || inquiry.id} from ${inquiry.name || 'a customer'} into a draft order.`,
    startSentence(`${countWord(lines.length)} line${lines.length === 1 ? '' : 's'}: ${spokenList(lines.slice(0, 6).map(line => `${line.name} ${line.quantity} gram${line.quantity === 1 ? '' : 's'}`))}${lines.length > 6 ? `, and ${countWord(lines.length - 6)} more` : ''}.`),
    total > 0 ? `That prices at ${usdWords(total)} from the catalogue.` : 'Nothing on it has a catalogue price yet.',
    unpriced.length
      ? startSentence(`${countWord(unpriced.length)} line${unpriced.length === 1 ? '' : 's'} land${unpriced.length === 1 ? 's' : ''} at no price for you to set: ${spokenList(unpriced.slice(0, 6).map(line => line.name))}.`)
      : '',
    'Nothing has changed yet. Call convert_order_request again with the confirmation token to create the draft.',
  ].filter(Boolean).join(' ');

  return {
    spoken,
    preview: {
      action: 'convert_order_request',
      request_id: inquiry.id,
      reference: inquiry.ref_number ?? null,
      customer_name: inquiry.name ?? null,
      customer_email: inquiry.email ?? null,
      customer_message: inquiry.message ?? null,
      line_count: lines.length,
      lines: lines.map(line => ({
        name: line.name,
        grams: line.quantity,
        price_per_gram_usd: line.price_at_sale,
        line_total_usd: roundUsd(line.quantity * line.price_at_sale),
        linked_to_product: Boolean(line.product_id),
      })),
      priced_total_usd: total,
      unpriced_line_count: unpriced.length,
      becomes: 'a Draft order you still have to price and send',
    },
    confirmation_token: token,
    expires_in_seconds: PENDING_TTL_MS / 1000,
  };
}

async function commitConvertOrderRequest(env: Env, m: Extract<PendingMutation, { kind: 'convert_order_request' }>) {
  const inquiry = await env.DB.prepare(
    `SELECT id, name, email, phone, items, currency, message, ref_number, converted_invoice_id
       FROM inquiries WHERE id = ? AND account_id = ?`
  ).bind(m.inquiryId, m.accountId).first() as Record<string, any> | null;
  if (!inquiry) {
    return { error: 'order_request_not_found', spoken: 'That order request is no longer there. Nothing was created.' };
  }
  if (inquiry.converted_invoice_id) {
    const existing = await env.DB.prepare(
      'SELECT invoice_number FROM invoices WHERE id = ? AND account_id = ?'
    ).bind(inquiry.converted_invoice_id, m.accountId).first() as { invoice_number: string | null } | null;
    return {
      error: 'already_converted',
      status: 409,
      invoice_id: inquiry.converted_invoice_id as string,
      invoice_number: existing?.invoice_number ?? null,
      spoken: `That request is already an order${existing?.invoice_number ? `, ${existing.invoice_number}` : ''}. Nothing was created.`,
    };
  }

  const lines = await resolveOrderRequestLines(env, m.accountId, inquiry.items);
  if (!lines) {
    return { error: 'no_items_to_price', status: 400, spoken: 'That request has no items to price. Nothing was created.' };
  }

  const customerName = String(inquiry.name || 'Customer');
  const contact = String(inquiry.email || '').trim();
  const phone = String(inquiry.phone || '').trim();
  const contactIsEmail = contact.includes('@');
  const customerWhatsapp = phone || (contactIsEmail ? null : contact) || null;
  const customer = await env.DB.prepare(
    `SELECT id FROM customers
      WHERE account_id = ?
        AND ((? <> '' AND lower(email) = lower(?)) OR (? <> '' AND whatsapp = ?))
      LIMIT 1`
  ).bind(
    m.accountId,
    contactIsEmail ? contact : '', contactIsEmail ? contact : '',
    customerWhatsapp || '', customerWhatsapp || '',
  ).first() as { id: string } | null;

  const invoiceId = crypto.randomUUID();
  const notes = [
    `From order request ${inquiry.ref_number || inquiry.id}. Review the prices and send.`,
    inquiry.message ? `Customer note: ${String(inquiry.message)}` : null,
  ].filter(Boolean).join('\n');

  const lineStmts = lines.map(line => env.DB.prepare(
    'INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, custom_name, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), m.accountId, invoiceId, line.product_id, line.custom_name, line.quantity, line.price_at_sale));

  // Invoice number from the account's sequence, retried on the unique index
  // collision.
  let invoiceNumber = '';
  let committed = false;
  let claimed = false;
  let lastErr: any = null;
  for (let attempt = 0; attempt < 3 && !committed; attempt++) {
    const seqRow = await env.DB.prepare(
      'UPDATE accounts SET invoice_seq = invoice_seq + 1 WHERE id = ? RETURNING invoice_seq, invoice_prefix'
    ).bind(m.accountId).first() as { invoice_seq: number; invoice_prefix: string | null } | null;
    const seq = seqRow?.invoice_seq ?? 1;
    const pfx = seqRow?.invoice_prefix || '';
    invoiceNumber = formatInvoiceNumber(pfx || null, seq);

    const invoiceStmt = env.DB.prepare(
      `INSERT INTO invoices (id, account_id, invoice_number, customer_name, customer_whatsapp, customer_id, display_currency, shipping_cost_usd, status, inventory_deducted, notes, payment_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Draft', 0, ?, 'unpaid')`
    ).bind(
      invoiceId, m.accountId, invoiceNumber, customerName, customerWhatsapp,
      customer?.id ?? null, String(inquiry.currency || 'USD'), 0, notes,
    );
    // Guarded so two converts of the same request cannot both win.
    const claimStmt = env.DB.prepare(
      `UPDATE inquiries SET converted_invoice_id = ?, status = 'replied'
        WHERE id = ? AND account_id = ? AND converted_invoice_id IS NULL`
    ).bind(invoiceId, m.inquiryId, m.accountId);
    const logStmt = env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'INVOICE_CREATED', ?, ?, 'invoice', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Draft invoice ${invoiceNumber} created from order request ${inquiry.ref_number || inquiry.id} for ${customerName} (${lines.length} item${lines.length === 1 ? '' : 's'}) via MCP`,
      m.userEmail, invoiceId, m.accountId,
    );

    try {
      const results = await env.DB.batch([invoiceStmt, ...lineStmts, claimStmt, logStmt]);
      claimed = Number(results[results.length - 2]?.meta?.changes || 0) > 0;
      committed = true;
    } catch (err: any) {
      lastErr = err;
      if (/UNIQUE|constraint/i.test(String(err?.message || err))) continue;
      console.error('commitConvertOrderRequest batch failed:', err);
      return { error: 'convert_failed', spoken: 'The order could not be created. Nothing was changed.' };
    }
  }
  if (!committed) {
    console.error('commitConvertOrderRequest: invoice create failed after retries:', lastErr);
    return { error: 'invoice_number_collision', spoken: 'I could not allocate an order number. Nothing was changed. Try again.' };
  }

  if (!claimed) {
    // A concurrent convert won the claim. Undo this call's invoice so the
    // request has exactly one order behind it, and point at the winner.
    await env.DB.batch([
      env.DB.prepare('DELETE FROM invoice_line_items WHERE invoice_id = ? AND account_id = ?').bind(invoiceId, m.accountId),
      env.DB.prepare('DELETE FROM invoices WHERE id = ? AND account_id = ?').bind(invoiceId, m.accountId),
    ]).catch(() => { /* leave the orphan rather than fail the response */ });
    const winner = await env.DB.prepare(
      'SELECT converted_invoice_id FROM inquiries WHERE id = ? AND account_id = ?'
    ).bind(m.inquiryId, m.accountId).first() as { converted_invoice_id: string | null } | null;
    return {
      error: 'already_converted',
      status: 409,
      invoice_id: winner?.converted_invoice_id ?? null,
      spoken: 'That request became an order while I was working. Nothing was created twice.',
    };
  }

  await ensureBuyerRelationship(env, m.accountId, customer?.id ?? null, invoiceId);

  const total = roundUsd(lines.reduce((sum, line) => sum + line.quantity * line.price_at_sale, 0));
  const unpriced = lines.filter(line => !(line.price_at_sale > 0)).length;

  return {
    committed: true,
    action: 'convert_order_request',
    request_id: m.inquiryId,
    reference: m.reference,
    invoice_id: invoiceId,
    invoice_number: invoiceNumber,
    status: 'Draft',
    line_count: lines.length,
    priced_total_usd: total,
    unpriced_line_count: unpriced,
    spoken: [
      `Order ${invoiceNumber} created for ${customerName} as a draft.`,
      total > 0 ? `It prices at ${usdWords(total)}.` : '',
      unpriced ? startSentence(`${countWord(unpriced)} line${unpriced === 1 ? '' : 's'} still need${unpriced === 1 ? 's' : ''} a price.`) : '',
      'Nothing has been sent to the customer.',
    ].filter(Boolean).join(' '),
  };
}

// ── tool: confirm_payment (preview / confirm) ──
//
// A customer's report becomes money here and nowhere else. Mirrors
// transitionInvoicePayment(…, 'confirmed') in index.ts: reconcile the column
// into the ledger first, then a guarded UPDATE so two confirms produce one
// change and one no-op, then recompute the invoice from the confirmed rows.
//
// One payment id per call, always. There is deliberately no "confirm every
// pending claim" argument: a sweep is how a misheard number becomes several
// wrong ones.
async function toolConfirmPayment(env: Env, auth: McpAuth, args: any) {
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (confirm) {
    const suppliedId = args?.payment_id ? String(args.payment_id).trim() : '';
    const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
    if (
      !pending ||
      pending.kind !== 'confirm_payment' ||
      (suppliedId && pending.paymentId !== suppliedId)
    ) {
      return {
        error: 'invalid_or_expired_confirmation_token',
        spoken: 'That confirmation has already been used or has expired. No money was recorded. Ask again and I will read the amount back first.',
      };
    }
    return commitConfirmPayment(env, pending);
  }

  const paymentId = args?.payment_id ? String(args.payment_id).trim() : '';
  if (!paymentId) {
    return {
      error: 'payment_id_required',
      spoken: 'Tell me which reported payment, by its payment id. Run list_payment_claims to see them. I will not confirm more than one at a time.',
    };
  }

  const row = await env.DB.prepare(
    `SELECT id, invoice_id, amount_usd, method_label, reference, note, status, claimed_by, claimed_at
       FROM invoice_payments WHERE id = ? AND account_id = ? LIMIT 1`
  ).bind(paymentId, auth.accountId).first() as Record<string, any> | null;
  if (!row) {
    return { error: 'payment_not_found', payment_id: paymentId, spoken: 'I cannot find a reported payment with that id.' };
  }
  if (row.status === 'confirmed') {
    return {
      error: 'already_confirmed',
      payment_id: paymentId,
      spoken: `That payment of ${usdWords(Number(row.amount_usd || 0))} is already confirmed. Nothing to do.`,
    };
  }

  const invoice = await loadLedgerInvoice(env, row.invoice_id as string, auth.accountId);
  if (!invoice) {
    return { error: 'invoice_not_found', payment_id: paymentId, spoken: 'The order behind that payment is gone. Nothing was recorded.' };
  }

  const ledger = await loadInvoiceLedgerTotals(env, [invoice.id]);
  const money = invoiceMoney(invoice.total_usd, invoice.payment_status, ledger.get(invoice.id));
  const amount = roundUsd(Number(row.amount_usd || 0));
  const owingAfter = Math.max(0, roundUsd(money.outstanding_usd - amount));
  const who = invoice.customer_name || 'the customer';
  const orderName = invoice.invoice_number ?? invoice.id;

  const token = await issueConfirmationToken(env, {
    kind: 'confirm_payment',
    accountId: auth.accountId,
    userEmail: auth.userEmail,
    actorUserId: auth.userId,
    paymentId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    customerName: invoice.customer_name,
    amountUsd: amount,
  }, auth.tokenId);

  // The money preview. Order, customer, amount, and what the order will owe
  // afterwards, in that order, so a misheard number is caught here rather than
  // after it has been recorded as received.
  const spoken = [
    `Confirming a reported payment.`,
    `Order ${orderName} for ${who}.`,
    `The order is ${usdWords(money.total_usd)}, with ${usdWords(money.paid_usd)} confirmed so far and ${usdWords(money.outstanding_usd)} owing.`,
    spokenClause([
      `${who} reported ${usdWords(amount)}${row.method_label ? ` by ${row.method_label}` : ''}`,
      row.reference ? `reference ${row.reference}` : null,
      `${waitedFor(row.claimed_at as string)} ago`,
    ]) + '.',
    owingAfter > 0
      ? `Confirming it records ${usdWords(amount)} as received and leaves ${usdWords(owingAfter)} owing.`
      : `Confirming it records ${usdWords(amount)} as received and leaves nothing owing, so the order is marked paid.`,
    `Nothing has changed yet. Call confirm_payment again with the confirmation token to record it.`,
  ].join(' ');

  return {
    spoken,
    preview: {
      action: 'confirm_payment',
      payment_id: paymentId,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_name: invoice.customer_name,
      reported_by: row.claimed_by,
      reported_at: toIsoTime(row.claimed_at as string),
      method: (row.method_label as string | null) || null,
      reference: (row.reference as string | null) || null,
      amount_usd: amount,
      order_total_usd: money.total_usd,
      confirmed_before_usd: money.paid_usd,
      outstanding_before_usd: money.outstanding_usd,
      outstanding_after_usd: owingAfter,
      becomes: owingAfter > 0 ? 'partial' : 'paid',
    },
    confirmation_token: token,
    expires_in_seconds: PENDING_TTL_MS / 1000,
  };
}

async function commitConfirmPayment(env: Env, m: Extract<PendingMutation, { kind: 'confirm_payment' }>) {
  const row = await env.DB.prepare(
    `SELECT id, invoice_id, amount_usd, status FROM invoice_payments
      WHERE id = ? AND account_id = ? LIMIT 1`
  ).bind(m.paymentId, m.accountId).first() as Record<string, any> | null;
  if (!row) {
    return { error: 'payment_not_found', spoken: 'That reported payment is no longer there. Nothing was recorded.' };
  }
  // The amount is what the preview read out. If it has moved since, refuse
  // rather than confirm a number nobody heard.
  if (roundUsd(Number(row.amount_usd || 0)) !== roundUsd(m.amountUsd)) {
    return {
      error: 'payment_changed_since_preview',
      spoken: `That payment is now ${usdWords(Number(row.amount_usd || 0))}, not the ${usdWords(m.amountUsd)} I read back. Nothing was recorded. Ask again.`,
    };
  }

  const invoice = await loadLedgerInvoice(env, row.invoice_id as string, m.accountId);
  if (!invoice) {
    return { error: 'invoice_not_found', spoken: 'The order behind that payment is gone. Nothing was recorded.' };
  }

  await reconcileLedgerWithColumn(env, invoice);

  const now = new Date().toISOString();
  const update = await env.DB.prepare(
    `UPDATE invoice_payments
        SET status = 'confirmed', confirmed_by_user_id = ?, confirmed_at = ?
      WHERE id = ? AND account_id = ? AND status IN ('claimed', 'rejected')`
  ).bind(m.actorUserId, now, m.paymentId, m.accountId).run();
  const changed = Number(update.meta?.changes || 0) > 0;

  const result = await recomputeInvoicePaymentStatus(env, invoice);
  if (changed) {
    await logOrderProcessActivity(env, {
      accountId: m.accountId, userEmail: m.userEmail,
      action: 'INVOICE_PAYMENT_CONFIRMED',
      details: `Payment of ${roundUsd(m.amountUsd).toFixed(2)} USD confirmed on invoice ${invoice.invoice_number ?? invoice.id} via MCP`,
      invoiceId: invoice.id,
    });
  }

  const orderName = invoice.invoice_number ?? invoice.id;
  return {
    committed: true,
    action: 'confirm_payment',
    changed,
    payment_id: m.paymentId,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    status: 'confirmed',
    ...result,
    spoken: changed
      ? [
        `Recorded. ${usdWords(m.amountUsd)} confirmed on order ${orderName}.`,
        result.outstanding_usd > 0
          ? `${usdWords(result.outstanding_usd)} still owing, so the order is part paid.`
          : `Nothing owing. The order is paid and now waiting to be sent.`,
      ].join(' ')
      : `That payment was already settled by something else. Order ${orderName} owes ${usdWords(result.outstanding_usd)}. Nothing was counted twice.`,
  };
}

// ── tool: record_payment (preview / confirm) ──
//
// Money Adrian saw arrive, with no customer report behind it. Mirrors
// handleRecordInvoicePayment in index.ts: the row lands confirmed in one step
// and the invoice is recomputed from it.
//
// There is no "the most recent unpaid order" fallback here, unlike
// mark_invoice_paid above. Guessing which order a spoken amount belongs to is
// not a guess money should make.
async function toolRecordPayment(env: Env, auth: McpAuth, args: any) {
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (confirm) {
    const suppliedId = args?.invoice_id ? String(args.invoice_id).trim() : '';
    const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
    if (
      !pending ||
      pending.kind !== 'record_payment' ||
      (suppliedId && pending.invoiceId !== suppliedId)
    ) {
      return {
        error: 'invalid_or_expired_confirmation_token',
        spoken: 'That confirmation has already been used or has expired. No money was recorded. Ask again and I will read the amount back first.',
      };
    }
    return commitRecordPayment(env, pending);
  }

  const invoiceId = args?.invoice_id ? String(args.invoice_id).trim() : '';
  const invoiceNumber = args?.invoice_number ? String(args.invoice_number).trim() : '';
  if (!invoiceId && !invoiceNumber) {
    return { error: 'invoice_id_or_number_required', spoken: 'Tell me which order this payment is for, by its id or its order number.' };
  }

  const rawAmount = args?.amount_usd ?? args?.amount;
  if (rawAmount == null || rawAmount === '') {
    return { error: 'amount_required', spoken: 'Tell me how much arrived, in US dollars.' };
  }
  const parsedAmount = Number(rawAmount);
  if (!Number.isFinite(parsedAmount)) {
    return { error: 'invalid_payment_amount', spoken: 'That amount is not a number I can record.' };
  }
  const amount = roundUsd(parsedAmount);
  if (amount <= 0) {
    return { error: 'invalid_payment_amount', spoken: 'A payment has to be more than zero.' };
  }
  if (amount > PAYMENT_AMOUNT_CEILING) {
    return { error: 'invalid_payment_amount', spoken: 'That amount is too large to be a real transfer. Nothing was recorded.' };
  }

  let resolvedId = invoiceId;
  if (!resolvedId) {
    const matches = await env.DB.prepare(
      `SELECT id FROM invoices WHERE invoice_number = ? AND account_id = ? AND deleted_at IS NULL`
    ).bind(invoiceNumber, auth.accountId).all();
    const rows = (matches.results ?? []) as Array<Record<string, any>>;
    if (rows.length > 1) {
      return {
        error: 'duplicate_invoice_number',
        invoice_number: invoiceNumber,
        spoken: `More than one order carries the number ${invoiceNumber}. Give me the order id instead. Nothing was recorded.`,
      };
    }
    resolvedId = (rows[0]?.id as string) || '';
  }

  const invoice = resolvedId ? await loadLedgerInvoice(env, resolvedId, auth.accountId) : null;
  if (!invoice) {
    return {
      error: 'invoice_not_found',
      invoice_id: invoiceId || null,
      invoice_number: invoiceNumber || null,
      spoken: `I cannot find that order. Nothing was recorded.`,
    };
  }
  if (String(invoice.status || '') === 'Void') {
    return { error: 'invoice_void', spoken: 'That order is void, so it cannot take a payment.' };
  }

  const ledger = await loadInvoiceLedgerTotals(env, [invoice.id]);
  const money = invoiceMoney(invoice.total_usd, invoice.payment_status, ledger.get(invoice.id));
  const owingAfter = Math.max(0, roundUsd(money.outstanding_usd - amount));
  const overpaid = roundUsd(amount - money.outstanding_usd);
  const method = paymentTextField(args?.method ?? args?.method_label, PAYMENT_TEXT_LIMITS.method);
  const reference = paymentTextField(args?.reference, PAYMENT_TEXT_LIMITS.reference);
  const note = paymentTextField(args?.note, PAYMENT_TEXT_LIMITS.note);
  const who = invoice.customer_name || 'the customer';
  const orderName = invoice.invoice_number ?? invoice.id;

  const token = await issueConfirmationToken(env, {
    kind: 'record_payment',
    accountId: auth.accountId,
    userEmail: auth.userEmail,
    actorUserId: auth.userId,
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    customerName: invoice.customer_name,
    amountUsd: amount,
    method, reference, note,
  }, auth.tokenId);

  // The second money preview. Same order of facts as confirm_payment: order,
  // customer, amount, and what the order will owe afterwards.
  const spoken = [
    `Recording a payment you have seen.`,
    `Order ${orderName} for ${who}.`,
    `The order is ${usdWords(money.total_usd)}, with ${usdWords(money.paid_usd)} confirmed so far and ${usdWords(money.outstanding_usd)} owing.`,
    spokenClause([
      `Recording ${usdWords(amount)}${method ? ` by ${method}` : ''}`,
      reference ? `reference ${reference}` : null,
    ]) + '.',
    overpaid > PAYMENT_EPSILON
      ? `That is ${usdWords(overpaid)} more than the balance, so the order will owe nothing and be marked paid.`
      : owingAfter > 0
        ? `That leaves ${usdWords(owingAfter)} owing.`
        : `That leaves nothing owing, so the order is marked paid.`,
    `Nothing has changed yet. Call record_payment again with the confirmation token to record it.`,
  ].join(' ');

  return {
    spoken,
    preview: {
      action: 'record_payment',
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      customer_name: invoice.customer_name,
      amount_usd: amount,
      method, reference, note,
      order_total_usd: money.total_usd,
      confirmed_before_usd: money.paid_usd,
      outstanding_before_usd: money.outstanding_usd,
      outstanding_after_usd: owingAfter,
      overpayment_usd: overpaid > PAYMENT_EPSILON ? overpaid : 0,
      becomes: owingAfter > 0 ? 'partial' : 'paid',
    },
    confirmation_token: token,
    expires_in_seconds: PENDING_TTL_MS / 1000,
  };
}

async function commitRecordPayment(env: Env, m: Extract<PendingMutation, { kind: 'record_payment' }>) {
  const invoice = await loadLedgerInvoice(env, m.invoiceId, m.accountId);
  if (!invoice) {
    return { error: 'invoice_not_found', spoken: 'That order is gone. Nothing was recorded.' };
  }
  if (String(invoice.status || '') === 'Void') {
    return { error: 'invoice_void', spoken: 'That order is void, so it cannot take a payment. Nothing was recorded.' };
  }

  // The operator is trusted with the number. An overpayment is a real thing
  // that happens with transfer fees, and the balance simply floors at zero.
  await reconcileLedgerWithColumn(env, invoice);

  const paymentId = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO invoice_payments
       (id, invoice_id, account_id, amount_usd, amount_original, currency,
        method_label, reference, note, status, claimed_by, claimed_at,
        confirmed_by_user_id, confirmed_at)
     VALUES (?, ?, ?, ?, NULL, 'USD', ?, ?, ?, 'confirmed', 'operator', ?, ?, ?)`
  ).bind(
    paymentId, invoice.id, invoice.account_id, roundUsd(m.amountUsd),
    m.method, m.reference, m.note, now, m.actorUserId, now,
  ).run();

  const result = await recomputeInvoicePaymentStatus(env, invoice);
  await logOrderProcessActivity(env, {
    accountId: m.accountId, userEmail: m.userEmail,
    action: 'INVOICE_PAYMENT_RECORDED',
    details: `Payment of ${roundUsd(m.amountUsd).toFixed(2)} USD recorded on invoice ${invoice.invoice_number ?? invoice.id} via MCP`,
    invoiceId: invoice.id,
  });

  const orderName = invoice.invoice_number ?? invoice.id;
  return {
    committed: true,
    action: 'record_payment',
    payment_id: paymentId,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    amount_usd: roundUsd(m.amountUsd),
    ...result,
    spoken: [
      `Recorded. ${usdWords(m.amountUsd)} on order ${orderName}.`,
      result.outstanding_usd > 0
        ? `${usdWords(result.outstanding_usd)} still owing, so the order is part paid.`
        : `Nothing owing. The order is paid and now waiting to be sent.`,
    ].join(' '),
  };
}

// ── tool: update_account_settings (preview / confirm) ──
// Wraps PUT /api/accounts/:id for the active account. Owner-tier only.
const ACCOUNT_SETTINGS_FIELDS = [
  'account_name', 'default_currency', 'contact_email', 'contact_phone',
  // Freight. Here as well as in Store Settings so the rate can be changed by
  // voice or by an agent from the shipping quote itself, which is where the
  // new number actually arrives. See worker/src/shippingRate.ts.
  'default_shipping_rate_per_kg', 'default_shipping_rate_currency',
] as const;
type AccountSettingsField = typeof ACCOUNT_SETTINGS_FIELDS[number];

// Maps our MCP-friendly field names to the actual accounts table columns.
const ACCOUNT_FIELD_MAP: Record<AccountSettingsField, string> = {
  account_name: 'name',
  default_currency: 'currency_default',
  contact_email: 'contact_email',
  contact_phone: 'whatsapp_number',
  default_shipping_rate_per_kg: 'default_shipping_rate_per_kg',
  default_shipping_rate_currency: 'default_shipping_rate_currency',
};

async function toolUpdateAccountSettings(env: Env, auth: McpAuth, args: any) {
  const targetAccountId = args?.account_id ? String(args.account_id).trim() : auth.accountId;
  const confirm = args?.confirm ? String(args.confirm) : null;

  // Collect provided fields (skip undefined).
  const requestedFields: Partial<Record<AccountSettingsField, string | null>> = {};
  for (const f of ACCOUNT_SETTINGS_FIELDS) {
    if (f in (args || {})) {
      /* A rate of zero is free freight, which is a thing Adrian can mean. The
         falsy check below would have turned it into NULL, and NULL means
         nobody has set a rate, so the shop would have gone back to charging
         the default. Same NULL-versus-zero distinction as the per-product
         column; see worker/src/shippingRate.ts. */
      const value = args[f];
      requestedFields[f] = (value === null || value === undefined || value === '')
        ? null
        : String(value).trim();
    }
  }
  if (Object.keys(requestedFields).length === 0) {
    throw new Error(`At least one setting field is required (${ACCOUNT_SETTINGS_FIELDS.join(', ')})`);
  }
  /* A freight rate is money, so it is checked here rather than trusted to the
     column type. A non-number would land as NULL and quietly turn into "this
     shop has never set a rate", which prices every untouched tea off the
     fallback instead of Adrian's. */
  const freight = requestedFields.default_shipping_rate_per_kg;
  if (freight !== undefined && freight !== null) {
    const n = Number(freight);
    if (!Number.isFinite(n) || n < 0) throw new Error('default_shipping_rate_per_kg must be a non-negative number');
  }
  /* And the currency has to be one the daily refresh covers, or the conversion
     silently freezes at whatever it was the day it was set. Normalised to the
     exchange table's own name so the rate resolves on read. */
  const freightCurrency = requestedFields.default_shipping_rate_currency;
  if (freightCurrency !== undefined && freightCurrency !== null) {
    const name = refreshedCurrencyName(freightCurrency);
    if (!name) {
      throw new Error(`default_shipping_rate_currency must be one the shop keeps current: ${[...REFRESHED_CURRENCIES].join(', ')}`);
    }
    requestedFields.default_shipping_rate_currency = name;
  }

  // Only allow editing the auth token's own account (or if platform_owner, any account).
  if (targetAccountId !== auth.accountId && auth.creatorTier !== 'platform_owner') {
    return {
      error: 'cross_account_denied',
      message: 'Only platform_owner tokens may update a different account.',
    };
  }

  const account = await env.DB.prepare(
    'SELECT id, name, currency_default, contact_email, whatsapp_number FROM accounts WHERE id = ?'
  ).bind(targetAccountId).first() as Record<string, any> | null;
  if (!account) return { error: 'account_not_found' };

  const changes: Record<string, { old: any; new: any }> = {};
  for (const [f, val] of Object.entries(requestedFields) as [AccountSettingsField, string | null][]) {
    const col = ACCOUNT_FIELD_MAP[f];
    changes[f] = { old: account[col] ?? null, new: val };
  }

  if (!confirm) {
    const fields: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(requestedFields) as [AccountSettingsField, string | null][]) {
      fields[k] = v;
    }
    const token = await issueConfirmationToken(env, {
      kind: 'update_account_settings', accountId: auth.accountId, userEmail: auth.userEmail,
      fields,
    }, auth.tokenId);
    return {
      preview: {
        action: 'update_account_settings',
        account: { id: targetAccountId, name: account.name },
        changes,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'update_account_settings') {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitUpdateAccountSettings(env, pending, targetAccountId, account.name as string);
}

async function commitUpdateAccountSettings(
  env: Env,
  m: Extract<PendingMutation, { kind: 'update_account_settings' }>,
  targetAccountId: string,
  accountName: string,
) {
  const setClauses: string[] = [];
  const vals: any[] = [];

  for (const [f, val] of Object.entries(m.fields) as [AccountSettingsField, string | null][]) {
    const col = ACCOUNT_FIELD_MAP[f];
    if (!col) continue;
    setClauses.push(`${col} = ?`);
    vals.push(val);
  }

  if (setClauses.length === 0) return { committed: true, action: 'update_account_settings', changes: 0 };

  const updatedFields = Object.keys(m.fields);
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE accounts SET ${setClauses.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).bind(...vals, targetAccountId),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'ACCOUNT_SETTINGS_UPDATED_MCP', ?, ?, 'account', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Account "${accountName}" settings updated via MCP: ${updatedFields.join(', ')}`,
      m.userEmail, targetAccountId, m.accountId,
    ),
  ]);

  return {
    committed: true,
    action: 'update_account_settings',
    account_id: targetAccountId,
    updated_fields: updatedFields,
  };
}

// ── tool: update_exchange_rate (preview / confirm) ──
// Platform-owner only. Cross-account effect: changes the rate used by ALL
// accounts for this currency. Extra guard: creator_tier must be 'platform_owner'.
async function toolUpdateExchangeRate(env: Env, auth: McpAuth, args: any) {
  // Extra platform-owner-only guard beyond the admin:write owner-tier gate.
  if (auth.creatorTier !== 'platform_owner') {
    return {
      error: 'platform_owner_required',
      message: 'update_exchange_rate requires a token minted by a platform_owner. This tool affects all accounts.',
    };
  }

  const currency = args?.currency ? String(args.currency).toUpperCase().trim() : '';
  const rateVsUsd = Number(args?.rate_vs_usd);
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!currency || !/^[A-Z]{3}$/.test(currency)) throw new Error('currency must be a valid 3-letter ISO code (e.g. CNY, AUD)');
  if (!Number.isFinite(rateVsUsd) || rateVsUsd <= 0) throw new Error('rate_vs_usd must be a positive number (units of currency per 1 USD)');

  const existing = await env.DB.prepare(
    'SELECT currency, rate_to_usd FROM exchange_rates WHERE currency = ?'
  ).bind(currency).first() as { currency: string; rate_to_usd: number } | null;
  if (!existing) return { error: 'currency_not_found', message: `Currency ${currency} is not in the exchange_rates table. Use the admin UI to create it first.` };

  const previousRate = Number(existing.rate_to_usd);

  if (!confirm) {
    const token = await issueConfirmationToken(env, {
      kind: 'update_exchange_rate', accountId: auth.accountId, userEmail: auth.userEmail,
      currency, rateVsUsd, previousRate,
    }, auth.tokenId);
    return {
      preview: {
        action: 'update_exchange_rate',
        currency,
        rate_old: previousRate,
        rate_new: rateVsUsd,
        example: `1 USD = ${rateVsUsd} ${currency}`,
        WARNING: 'This change affects all accounts using this currency. Proceed only if rates are confirmed.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'update_exchange_rate' || pending.currency !== currency) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitUpdateExchangeRate(env, pending);
}

async function commitUpdateExchangeRate(env: Env, m: Extract<PendingMutation, { kind: 'update_exchange_rate' }>) {
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE exchange_rates SET rate_to_usd = ?, last_updated = datetime('now') WHERE currency = ?"
    ).bind(m.rateVsUsd, m.currency),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'EXCHANGE_RATE_UPDATED_MCP', ?, ?, 'exchange_rate', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Exchange rate for ${m.currency} updated from ${m.previousRate} → ${m.rateVsUsd} via MCP`,
      m.userEmail, m.currency, m.accountId,
    ),
  ]);
  return {
    committed: true,
    action: 'update_exchange_rate',
    currency: m.currency,
    rate_old: m.previousRate,
    rate_new: m.rateVsUsd,
  };
}

// ── Intake (Curate-import) tools ────────────────────────────────────────────
//
// Thin wrappers over the existing curate-import REST handlers in
// curateImports.ts. Business logic lives there; these tools just construct
// synthetic Requests from MCP args, call the handler, and relay the result.

async function toolIntakeStart(env: Env, auth: McpAuth, args: any) {
  const title = (args?.title ? String(args.title).trim() : '') || `MCP import ${new Date().toISOString().slice(0, 10)}`;
  const pastedText: string | null = args?.pasted_text ? String(args.pasted_text) : null;
  const body: Record<string, unknown> = {
    idempotency_key: crypto.randomUUID(),
    title,
  };
  if (pastedText) { body.pasted_text = pastedText; body.source_kind = 'paste'; }
  const req = new Request('http://localhost/api/curate/imports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ctx: CurateImportContext = { accountId: auth.accountId, userId: auth.userId };
  const res = await createCurateImport(req, env as any, ctx);
  const data = await res.json() as any;
  if (!res.ok) return { error: data.error ?? 'create_failed', details: data };
  return { import_id: data.batch?.id ?? null, ...data };
}

async function toolIntakeAddSource(env: Env, auth: McpAuth, args: any) {
  const importId = String(args?.import_id ?? '').trim();
  if (!importId) return { error: 'import_id is required' };
  const kind = String(args?.kind ?? 'paste').trim();
  const body: Record<string, unknown> = { kind, idempotency_key: crypto.randomUUID() };
  if (args?.pasted_text) body.pasted_text = String(args.pasted_text);
  if (args?.r2_object_key) body.r2_object_key = String(args.r2_object_key);
  const req = new Request(`http://localhost/api/curate/imports/${importId}/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ctx: CurateImportContext = { accountId: auth.accountId, userId: auth.userId };
  const res = await addCurateImportSource(req, env as any, ctx, { id: importId });
  const data = await res.json() as any;
  if (!res.ok) return { error: data.error ?? 'add_source_failed', details: data };
  return data;
}

async function toolIntakeAnalyze(env: Env, auth: McpAuth, args: any) {
  const importId = String(args?.import_id ?? '').trim();
  if (!importId) return { error: 'import_id is required' };
  const body: Record<string, unknown> = {};
  if (Array.isArray(args?.source_ids)) body.source_ids = args.source_ids;
  const req = new Request(`http://localhost/api/curate/imports/${importId}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const ctx: CurateImportContext = { accountId: auth.accountId, userId: auth.userId };
  const res = await analyzeCurateImport(req, env as any, ctx, { id: importId });
  const data = await res.json() as any;
  if (!res.ok) return { error: data.error ?? 'analyze_failed', details: data };
  return data;
}

async function toolIntakeGetDraft(env: Env, auth: McpAuth, args: any) {
  const importId = String(args?.import_id ?? '').trim();
  if (!importId) return { error: 'import_id is required' };
  const req = new Request(`http://localhost/api/curate/imports/${importId}`, { method: 'GET' });
  const ctx: CurateImportContext = { accountId: auth.accountId, userId: auth.userId };
  const res = await getCurateImport(req, env as any, ctx, { id: importId });
  const data = await res.json() as any;
  if (!res.ok) return { error: data.error ?? 'not_found', details: data };
  return data;
}

async function toolIntakeUpdateItem(env: Env, auth: McpAuth, args: any) {
  const importId = String(args?.import_id ?? '').trim();
  const itemId = String(args?.item_id ?? '').trim();
  if (!importId) return { error: 'import_id is required' };
  if (!itemId) return { error: 'item_id is required' };
  const updates = args?.updates != null && typeof args.updates === 'object' ? args.updates : {};
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (args?.version != null) headers['If-Match'] = String(args.version);
  const req = new Request(`http://localhost/api/curate/imports/${importId}/items/${itemId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  });
  const ctx: CurateImportContext = { accountId: auth.accountId, userId: auth.userId };
  const res = await updateCurateImportItem(req, env as any, ctx, { id: importId, itemId });
  const data = await res.json() as any;
  if (res.status === 409) return { error: 'version_conflict', code: data.code ?? 'version_conflict', current_version: data.current_version, message: data.error };
  if (!res.ok) return { error: data.error ?? 'update_failed', details: data };
  return data;
}

async function toolIntakeSetGroupVendor(env: Env, auth: McpAuth, args: any) {
  const importId = String(args?.import_id ?? '').trim();
  const groupId = String(args?.group_id ?? '').trim();
  if (!importId) return { error: 'import_id is required' };
  if (!groupId) return { error: 'group_id is required' };
  const vendorCustomerId = args?.vendor_customer_id != null ? String(args.vendor_customer_id).trim() : null;
  const req = new Request(`http://localhost/api/curate/imports/${importId}/groups/${groupId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolved_vendor_customer_id: vendorCustomerId }),
  });
  const ctx: CurateImportContext = { accountId: auth.accountId, userId: auth.userId };
  const res = await updateCurateImportGroup(req, env as any, ctx, { id: importId, groupId });
  const data = await res.json() as any;
  if (!res.ok) return { error: data.error ?? 'update_group_failed', details: data };
  return data;
}

// intake_ask and intake_answer wrap POST /api/curate/imports/:id/chat (T1).
async function toolIntakeAsk(env: Env, auth: McpAuth, args: any) {
  const importId = String(args?.import_id ?? '').trim();
  const itemId = args?.item_id != null ? String(args.item_id) : null;
  const asksField = args?.asks_field ? String(args.asks_field) : null;
  const bodyText = args?.body ? String(args.body) : '';
  if (!importId) return { error: 'import_id is required' };
  if (!bodyText) return { error: 'body is required' };
  const req = new Request(`http://localhost/api/curate/imports/${importId}/chat`, { method: 'POST', body: JSON.stringify({ item_id: itemId, role: 'assistant', asks_field: asksField, body: bodyText, origin: 'agent' }) });
  const ctx: CurateImportContext = { accountId: auth.accountId, userId: auth.userId };
  const res = await curateImportChat(req, env as any, ctx, { id: importId });
  const data = await res.json() as any;
  if (!res.ok) return { error: data.error ?? 'chat_ask_failed', code: data.code, field: data.field, details: data };
  return data;
}

async function toolIntakeAnswer(env: Env, auth: McpAuth, args: any) {
  const importId = String(args?.import_id ?? '').trim();
  const itemId = args?.item_id != null ? String(args.item_id) : null;
  const answersField = args?.answers_field ? String(args.answers_field) : null;
  const bodyText = args?.body ? String(args.body) : '';
  const answerValue = args?.answer_value ?? null;
  const answerKind = args?.answer_kind ? String(args.answer_kind) : 'value';
  if (!importId) return { error: 'import_id is required' };
  if (!answersField) return { error: 'answers_field is required' };
  if (!bodyText) return { error: 'body is required' };
  const req = new Request(`http://localhost/api/curate/imports/${importId}/chat`, { method: 'POST', body: JSON.stringify({ item_id: itemId, role: 'operator', answers_field: answersField, answer_value: answerValue, answer_kind: answerKind, body: bodyText, origin: 'agent' }) });
  const ctx: CurateImportContext = { accountId: auth.accountId, userId: auth.userId };
  const res = await curateImportChat(req, env as any, ctx, { id: importId });
  const data = await res.json() as any;
  if (!res.ok) return { error: data.error ?? 'chat_answer_failed', code: data.code, field: data.field, details: data };
  return data;
}

async function toolIntakeFinalize(env: Env, auth: McpAuth, args: any) {
  const importId = String(args?.import_id ?? '').trim();
  if (!importId) return { error: 'import_id is required' };
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!confirm) {
    // Preview phase — fetch draft and summarise what will be created.
    const req = new Request(`http://localhost/api/curate/imports/${importId}`, { method: 'GET' });
    const ctx: CurateImportContext = { accountId: auth.accountId, userId: auth.userId };
    const res = await getCurateImport(req, env as any, ctx, { id: importId });
    const draft = await res.json() as any;
    if (!res.ok) return { error: draft.error ?? 'import_not_found', details: draft };
    const items: any[] = Array.isArray(draft.items) ? draft.items : [];
    const byDisposition: Record<string, number> = {};
    for (const item of items) {
      const d = String(item.parsed_data?.disposition ?? 'library_only');
      byDisposition[d] = (byDisposition[d] ?? 0) + 1;
    }
    const token = await issueConfirmationToken(env, {
      kind: 'intake_finalize',
      accountId: auth.accountId,
      userEmail: auth.userEmail,
      userId: auth.userId,
      importId,
      idempotencyKey: crypto.randomUUID(),
    }, auth.tokenId);
    return {
      preview: {
        action: 'intake_finalize',
        import_id: importId,
        title: draft.batch?.title ?? null,
        review_state: draft.batch?.review_state ?? null,
        item_count: items.length,
        by_disposition: byDisposition,
        note: 'Finalizing creates Draft products + Curate identities for all non-abandoned items. Stock movements are created for received/in_transit dispositions.',
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  // Confirm phase
  const pending = await consumeConfirmationToken(env, confirm, auth.tokenId);
  if (!pending || pending.kind !== 'intake_finalize' || pending.importId !== importId || pending.accountId !== auth.accountId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitIntakeFinalize(env, pending as Extract<PendingMutation, { kind: 'intake_finalize' }>);
}

async function commitIntakeFinalize(env: Env, m: Extract<PendingMutation, { kind: 'intake_finalize' }>) {
  const ctx: CurateImportContext = { accountId: m.accountId, userId: m.userId };

  const receiveLine: CurateFinalizeMovement = async (line, idempotencyKey) => {
    // Idempotency guard — replay safe under concurrent confirm calls.
    const prior = await env.DB.prepare(
      'SELECT id FROM stock_ledger WHERE account_id = ? AND idempotency_key = ?'
    ).bind(m.accountId, idempotencyKey).first<{ id: string }>();
    if (prior) return { movementId: prior.id };

    const amountCol = line.unit === 'g' ? 'stock_grams' : 'quantity_units';
    const product = await env.DB.prepare(
      `SELECT ${amountCol} FROM products WHERE id = ? AND account_id = ?`
    ).bind(line.productId, m.accountId).first<Record<string, number>>();
    const current = product ? Number(product[amountCol] ?? 0) : 0;
    const balanceAfter = current + line.quantity;
    const movementId = crypto.randomUUID();
    const fingerprint = JSON.stringify({ quantity: line.quantity, unit: line.unit, source_compass_entry_id: line.compassEntryId });

    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO stock_ledger (id, account_id, product_id, delta, balance_after, reason, movement_type, movement_unit, idempotency_key, inventory_receipt_line_id, source_compass_entry_id, note, movement_fingerprint)
         VALUES (?, ?, ?, ?, ?, 'RECEIPT', 'receipt', ?, ?, ?, ?, 'Curate import finalized via MCP', ?)`
      ).bind(movementId, m.accountId, line.productId, line.quantity, balanceAfter,
        line.unit === 'g' ? 'gram' : 'unit', idempotencyKey, line.id, line.compassEntryId ?? null, fingerprint),
      env.DB.prepare(
        `UPDATE products SET ${amountCol} = ?, stock_known_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND account_id = ?`
      ).bind(balanceAfter, line.productId, m.accountId),
    ]);
    return { movementId };
  };

  const req = new Request(`http://localhost/api/curate/imports/${m.importId}/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idempotency_key: m.idempotencyKey }),
  });
  const res = await finalizeCurateImportRequest(req, env as any, ctx, { id: m.importId }, receiveLine);
  const data = await res.json() as any;
  if (!res.ok) return { error: data.error ?? 'finalize_failed', ...data };
  return { committed: true, action: 'intake_finalize', import_id: m.importId, ...data };
}

// ── tool registry / JSON-RPC dispatch ──

const TOOL_DEFS = [
  {
    name: 'search_tea',
    scope: 'inventory:read',
    description: 'Fuzzy-search tea inventory by name, Chinese name, region, or vendor. Returns up to `limit` matches with stock + match score. Use this first whenever the user names a tea ambiguously.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search — partial names, regions, vendors all work.' },
        limit: { type: 'number', description: 'Max matches to return (default 5, max 20).', default: 5 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_tea',
    scope: 'inventory:read',
    description: 'Fetch full record for one tea by id, including last 10 stock-ledger entries.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },
  {
    name: 'list_low_stock',
    scope: 'inventory:read',
    description: 'List teas whose current stock has fallen below their per-product low-stock threshold.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'find_customer',
    scope: 'customers:read',
    description: 'Fuzzy-search customers by name, company, email, phone, or WhatsApp. Returns ids — use get_customer for the full dossier.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  {
    name: 'get_customer',
    scope: 'customers:read',
    description: 'Full profile for one customer by id: contact details, tags, lifetime spend, and the last 10 invoices. Use find_customer first to get the id.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Customer id from find_customer.' } },
      required: ['id'],
    },
  },
  {
    name: 'get_account_context',
    scope: 'inventory:read',
    description: 'Orientation for the active account: name, default currency, invoice prefix + next invoice number, WhatsApp checkout number, exchange rates with the age of each and a stale flag, the shop freight rate, and live counts (active products, low-stock, unpaid invoices, customers). Call this first when you need to quote prices or reason about currency.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_invoices',
    scope: 'sales:read',
    description: 'List invoices, newest first, with totals. Filter by status, payment_status, customer_id, unpaid_only, or a free-text query over invoice number / customer name. This is how you find an invoice id for void_invoice, fulfill_invoice, or update_invoice.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by invoice status (Draft, Filled, Void).' },
        payment_status: { type: 'string', description: 'Filter by payment status (unpaid, partial, paid).' },
        customer_id: { type: 'string', description: 'Only invoices for this customer.' },
        unpaid_only: { type: 'boolean', description: 'Shortcut for not-paid, not-void invoices.' },
        query: { type: 'string', description: 'Free-text match on invoice number or customer name.' },
        limit: { type: 'number', description: 'Max rows (default 20, max 100).', default: 20 },
      },
    },
  },
  {
    name: 'get_invoice',
    scope: 'sales:read',
    description: 'Full invoice by id or invoice_number, including line items and totals.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string' },
        invoice_number: { type: 'string', description: 'Used if invoice_id is omitted.' },
      },
    },
  },
  {
    name: 'sales_summary',
    scope: 'sales:read',
    description: 'Revenue and volume over the last N days (default 30): invoice count, paid vs unpaid, gross revenue, grams sold, and the top 5 teas by revenue. Answers "how did this week/month go?".',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Look-back window in days (default 30, max 365).', default: 30 },
      },
    },
  },
  {
    name: 'create_tea',
    scope: 'stock:write',
    description:
      'Create a new tea/product row in Teajia inventory. Two-step preview/confirm. Use this when the tea '
      + 'does not already exist yet; use add_stock for later restocks of an existing tea. '
      + 'cost_amount and cost_currency are REQUIRED and are not guessed: a cost stored without them is '
      + 'stored as zero, which is a free tea, and the shelf prices it accordingly. If you do not know what '
      + 'the tea cost or what it was paid in, ask rather than assuming dollars.',
    inputSchema: {
      type: 'object',
      properties: {
        product_name: { type: 'string', description: 'Required display/product name.' },
        given_name: { type: 'string', description: 'Optional shorter name shown in the UI. Defaults to product_name.' },
        chinese_name: { type: 'string' },
        type: { type: 'string', description: 'Tea type (e.g. "Pu-erh", "Oolong").', default: 'Tea' },
        form: { type: 'string', description: 'Physical form (e.g. "Cake", "Loose").' },
        year: { type: 'string', description: 'Harvest/production year.' },
        origin_country: { type: 'string' },
        origin_region: { type: 'string' },
        vendor: { type: 'string' },
        stock_grams: { type: 'number', description: 'Opening stock in grams. Writes a PURCHASE_RECEIPT ledger entry when > 0.' },
        cost_amount: {
          type: 'number',
          description:
            'REQUIRED. What the batch cost, in cost_currency. 0 is a valid answer for a gift or a free '
            + 'sample; omitting it is not, and is refused rather than stored as zero.',
        },
        cost_currency: {
          type: 'string',
          description:
            'REQUIRED. The currency that cost was actually paid in: Yuan, NT, IDR, MYR, JPY, AUD, HKD, USD. '
            + 'There is deliberately no default. A yuan invoice recorded as dollars prices the tea about '
            + 'seven times too high and nothing objects, because the number itself is fine.',
        },
        shipping_rate_per_kg: {
          type: 'number',
          description:
            'OPTIONAL, and usually left out. Leave it out and the tea follows the shop freight rate '
            + '(85 Yuan/kg, converted live), which is what Adrian pays to air-freight from China, and it '
            + 'keeps following that rate when he renegotiates it. Pass a number ONLY when this particular '
            + "tea cost more or less to ship. Written in the tea's OWN cost currency, not USD: on a tea "
            + 'bought in CNY, pass the CNY rate. A 0 means this tea genuinely ships free.',
        },
        fixed_retail_price_usd: { type: 'number', description: 'Optional fixed retail price; omit to use markup-based pricing.' },
        low_stock_threshold: { type: 'number', default: 100 },
        notes: { type: 'string', description: 'Optional description/notes.' },
        status: { type: 'string', description: 'Product status (Active, Draft, Archived).', default: 'Active' },
        confirm: { type: 'string', description: 'Confirmation token from the preview response. Omit on first call.' },
      },
      required: ['product_name', 'cost_amount', 'cost_currency'],
    },
  },
  {
    name: 'add_stock',
    scope: 'stock:write',
    description: 'Add grams to a tea\'s stock. Two-step: first call returns a preview + confirmation_token; re-call with the token in `confirm` to commit. Use reason "PURCHASE_RECEIPT" when restocking from a vendor.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        grams: { type: 'number', description: 'Positive grams to add.' },
        note: { type: 'string', description: 'Optional human-readable note (e.g. "from Yunnan trip Mar 2026").' },
        confirm: { type: 'string', description: 'Confirmation token from the preview response. Omit on first call.' },
      },
      required: ['id', 'grams'],
    },
  },
  {
    name: 'remove_stock',
    scope: 'stock:write',
    description: 'Deduct grams from a tea\'s stock outside of a sale (waste, samples, personal use). Two-step preview/confirm. For sales, use `record_sale` instead so it goes through the invoice path.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        grams: { type: 'number' },
        reason: { type: 'string', enum: ['MANUAL_ADJUST', 'WASTE', 'SAMPLE', 'PERSONAL'], default: 'MANUAL_ADJUST' },
        note: { type: 'string' },
        confirm: { type: 'string' },
      },
      required: ['id', 'grams'],
    },
  },
  {
    name: 'record_sale',
    scope: 'sales:write',
    description: 'Create + immediately fill an invoice for a multi-line tea sale. Stock is deducted through the same path the admin UI uses, so the ledger, low-stock alerts, and sold-out auto-archive all fire. Two-step preview/confirm. After commit, the invoice exists in the admin and can be downloaded as PDF there.',
    inputSchema: {
      type: 'object',
      properties: {
        lines: {
          type: 'array',
          description: 'One entry per tea sold.',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string' },
              grams: { type: 'number' },
              price_per_gram_usd: { type: 'number' },
            },
            required: ['product_id', 'grams', 'price_per_gram_usd'],
          },
        },
        customer_id: { type: 'string', description: 'Existing customer id (preferred). If omitted, supply customer_name.' },
        customer_name: { type: 'string', description: 'Free-text customer name (used when no customer_id is known).' },
        customer_whatsapp: { type: 'string' },
        notes: { type: 'string' },
        confirm: { type: 'string' },
      },
      required: ['lines'],
    },
  },
  // ── Wave 1 additions ──
  {
    name: 'create_customer',
    scope: 'customers:write',
    description: 'Create a new customer record. Two-step preview/confirm. On preview, warns if a similar customer already exists. Use find_customer first to avoid duplicates.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Customer full name (required).' },
        whatsapp: { type: 'string', description: 'WhatsApp number (with country code).' },
        email: { type: 'string' },
        phone: { type: 'string' },
        notes: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Optional tag list.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'update_customer',
    scope: 'customers:write',
    description: 'Update one or more fields on an existing customer record. Two-step preview/confirm. Shows old → new for each field before committing.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Customer id from find_customer.' },
        name: { type: 'string' },
        whatsapp: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        notes: { type: 'string' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'update_tea_pricing',
    scope: 'stock:write',
    description: 'Update cost, currency, retail price, and/or inventory data (quantity purchased, description, stock verification) for a tea product. Two-step preview/confirm. Shows margin before/after and warns below 30%.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        cost_amount: { type: 'number', description: 'Total purchase cost of the batch in cost_currency (e.g. 1260 for 7 cakes x 180).' },
        cost_currency: { type: 'string', description: 'Currency actually paid, e.g. CNY, MYR, NT, IDR, AUD, USD.' },
        retail_price_usd: { type: 'number', description: 'Fixed per-gram retail price in USD (optional; site auto-derives from cost if omitted).' },
        quantity_purchased: { type: 'number', description: 'Total grams purchased (e.g. 2490 for 7 x 357g cakes, 1000 for 1kg).' },
        year: { type: 'number', description: 'The year of the tea (e.g. 2025, 2019). Maps to the reference year.' },
        status: { type: 'string', description: 'Product status, e.g. Active or Sold Out. Keeps products + listing in sync.' },
        shipping_rate_per_kg: { type: 'number', description: 'Shipping freight per kg folded into the COST basis, so the markup multiplies it too. Written in the tea\'s OWN cost currency, not USD: on a tea bought in CNY, pass the CNY rate. Setting it PINS this tea to that figure; to hand it back to the shop rate (85 Yuan/kg, converted live) pass "shipping_rate_per_kg" in clear_fields instead. Not a separate sales charge.' },
        tasting_notes: { type: 'array', items: { type: 'string' }, description: 'Flavor/taste terms for the catalog tasting field (NOT the description). Up to 8.' },
        description: { type: 'string', description: 'Customer-facing "About this tea" (origin/character — NOT flavors; personal note space, shows only when present).' },
        lore: { type: 'string', description: 'Real, sourced historical/cultural background (terse, never fabricated).' },
        terroir: { type: 'string', description: 'Origin/terroir section copy (objective).' },
        processing_notes: { type: 'string', description: 'Processing/craft section copy (objective).' },
        origin_country: { type: 'string', description: 'Harvest country (not the trading house), e.g. Vietnam.' },
        origin_region: { type: 'string', description: 'Harvest region, e.g. Northern Vietnam wild tea trees, on the Yunnan border.' },
        stock_verified: { type: 'boolean', description: 'true = mark stock verified; false = set needs-verification flag. Omit to leave unchanged.' },
        clear_fields: { type: 'array', items: { type: 'string' }, description: 'Fields to blank rather than set: lore, experience, mood, terroir, processing_notes, shipping_rate_per_kg. Clearing shipping_rate_per_kg hands the tea back to the shop freight rate and it follows that rate from then on; anything else is ignored.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'set_low_stock_threshold',
    scope: 'stock:write',
    description: 'Set the low-stock alert threshold (in grams) for a tea. Two-step preview/confirm. Preview shows whether the product would immediately be flagged low at the new threshold.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        threshold_grams: { type: 'number', description: 'Low-stock alert fires when stock_grams falls below this. Use 0 to disable.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['product_id', 'threshold_grams'],
    },
  },
  {
    name: 'update_invoice',
    scope: 'sales:write',
    description: 'Update metadata (customer, notes) on an existing invoice without touching line items or stock. Two-step preview/confirm. Does NOT void or refund — for that use void_invoice.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice id.' },
        customer_id: { type: 'string', description: 'Link or re-link an existing customer record.' },
        customer_name: { type: 'string', description: 'Override the free-text customer name on the invoice.' },
        notes: { type: 'string', description: 'Invoice notes / memo.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'void_invoice',
    scope: 'sales:write',
    description: 'Void an invoice and restore stock for all line items (if inventory was deducted). Two-step preview/confirm with a prominent warning. Irreversible — only use when the sale did not happen or was cancelled.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice id to void.' },
        reason: { type: 'string', description: 'Optional reason for voiding (logged to activity history).' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['invoice_id'],
    },
  },
  // ── Wave 3 additions ──
  {
    name: 'tag_customer',
    scope: 'customers:write',
    description: 'Add a tag to a customer record. Two-step preview/confirm. Idempotent — safe to call even if the tag already exists. Use find_customer first to locate the customer id.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Customer id from find_customer.' },
        tag: { type: 'string', description: 'Tag to add (normalised to lowercase, max 50 chars).' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['customer_id', 'tag'],
    },
  },
  {
    name: 'untag_customer',
    scope: 'customers:write',
    description: 'Remove a tag from a customer record. Two-step preview/confirm. Idempotent — safe if the tag is already absent.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Customer id from find_customer.' },
        tag: { type: 'string', description: 'Tag to remove.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['customer_id', 'tag'],
    },
  },
  {
    name: 'link_vendor',
    scope: 'customers:write',
    description: 'Link a customer as the vendor (supplier) for a product. Two-step preview/confirm. Warns if the product already has a different vendor. Use search_tea and find_customer first.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Customer id of the vendor/supplier.' },
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        note: { type: 'string', description: 'Optional note about the sourcing relationship.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['customer_id', 'product_id'],
    },
  },
  {
    name: 'unlink_vendor',
    scope: 'customers:write',
    description: 'Remove the vendor link between a customer and a product. Two-step preview/confirm. Returns an error if the customer is not currently linked as the vendor.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Customer id of the vendor to unlink.' },
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['customer_id', 'product_id'],
    },
  },
  {
    name: 'upsert_vendor_contact',
    scope: 'stock:write',
    description: 'Create or update a vendor (customer tagged "vendor") with full contact details: name, company, phone, whatsapp, wechat, address, city, country, source, notes. Two-step preview/confirm. Scoped to stock:write so the operator can persist vendor/source contacts for intake lots (unlike the owner-tier link_vendor tool).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Vendor name (e.g. "Boyuan Tea Shop" or "Ruan Ying"). Matches existing by name for update.' },
        company: { type: 'string', description: 'Company / store name.' },
        phone: { type: 'string', description: 'Phone number.' },
        whatsapp: { type: 'string', description: 'WhatsApp number.' },
        wechat: { type: 'string', description: 'WeChat ID.' },
        address: { type: 'string', description: 'Physical/store address.' },
        city: { type: 'string', description: 'City.' },
        country: { type: 'string', description: 'Country.' },
        source: { type: 'string', description: 'Source tag, e.g. "Guangzhou Puer Masters" or a receipt reference.' },
        notes: { type: 'string', description: 'Free-text notes.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'remove_vendor_contact',
    scope: 'stock:write',
    description: 'Delete a vendor (customer tagged "vendor") that is no longer referenced. Refuses if any product links to it as vendor, any invoice references it, or any curate import vendor group resolves to it. Two-step preview/confirm. Use to clean up duplicate/abandoned vendor rows created by mistake.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Customer id of the vendor to remove (from find_customer or get_customer).' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['customer_id'],
    },
  },
  {
    name: 'link_vendor_products',
    scope: 'stock:write',
    description: 'Batch-link one vendor (customer) to one or more products by setting their vendor_id. Two-step preview/confirm. Scoped to stock:write so the operator can attach a vendor to several intake teas at once.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_id: { type: 'string', description: 'Customer id of the vendor (from upsert_vendor_contact response or find_customer).' },
        product_ids: { type: 'array', items: { type: 'string' }, description: 'Product ids (full 36-char UUIDs) to link to this vendor.' },
        note: { type: 'string', description: 'Optional sourcing note for the relationship.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['customer_id', 'product_ids'],
    },
  },
  {
    name: 'update_tea_catalog',
    scope: 'stock:write',
    description: 'Edit catalog/identity fields (type, form, product_name, given_name, chinese_name, origin_country, origin_region, year, altitude, cultivar, teaware_category, material, capacity_ml) on an existing tea. Mirrors products and tea_profiles. Two-step preview/confirm. Scoped to stock:write so the operator can correct type/form on intake teas.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id (full 36-char UUID) from search_tea/get_tea.' },
        type: { type: 'string', description: 'Tea type/category, e.g. Shou Puer, Sheng Puer, Dark, Oolong.' },
        form: { type: 'string', description: 'Physical form, e.g. Loose Leaf, Brick, Tuo, Cake.' },
        product_name: { type: 'string', description: 'Full display product name.' },
        given_name: { type: 'string', description: 'Short given name shown in listings.' },
        chinese_name: { type: 'string', description: 'Chinese name (if any).' },
        origin_country: { type: 'string', description: 'Country of origin.' },
        origin_region: { type: 'string', description: 'Region/area of origin.' },
        year: { type: 'string', description: 'Vintage year as a string (e.g. "1990s", "1993").' },
        altitude: { type: 'string', description: 'Altitude in meters.' },
        cultivar: { type: 'string', description: 'Cultivar/plant variety.' },
        teaware_category: { type: 'string', description: 'Teaware category if teaware.' },
        material: { type: 'string', description: 'Material (teaware).' },
        capacity_ml: { type: 'string', description: 'Capacity in ml (teaware).' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'set_tasting',
    scope: 'catalog:write',
    description: "Set the shop's own tasting for a tea: what it tastes of, how it feels, its body, finish and liquor colour. Two-step preview/confirm. Terms must be taxonomy ids (e.g. honey, stone-fruit, hui-gan, amber); unknown ids are refused, not dropped. Only the categories you supply change, so starred notes, the teaser and brewing survive. Pass an empty array to clear one category. Saves as the shop's own claim (tasting_source 'owner'), which is what removes the 'potential profile' qualifier on the product page.",
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        flavor: { type: 'array', items: { type: 'string' }, description: 'Taste term ids, e.g. ["honey","dried-fruit","malt","cocoa"]. Shown as the first line of the character card.' },
        feeling: { type: 'array', items: { type: 'string' }, description: 'Feeling term ids, e.g. ["grounding","feeling-warming"]. Shown under the taste line.' },
        body: { type: 'array', items: { type: 'string' }, description: 'Body term ids, e.g. ["medium","silky"].' },
        finish: { type: 'array', items: { type: 'string' }, description: 'Finish term ids, e.g. ["coating","finish-long","hui-gan"].' },
        liquor_color: { type: 'array', items: { type: 'string' }, description: 'Liquor colour term id, e.g. ["amber"].' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['product_id'],
    },
  },
  {
    name: 'set_archive_status',
    scope: 'catalog:write',
    description: 'Archive or un-archive a tea product. Archiving removes it from public shop listings. Two-step preview/confirm. Shows current and new status before committing.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        archived: { type: 'boolean', description: 'true to archive (remove from shop); false to restore.' },
        reason: { type: 'string', description: 'Optional reason (logged to activity history).' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['product_id', 'archived'],
    },
  },
  {
    name: 'set_tea_visibility',
    scope: 'stock:write',
    description: 'Show or hide a tea in the public shop listing WITHOUT archiving it. The product stays Active — this only flips shown_in_shop, so it lists in the shop or not while every record remains intact. Pass personal=true to ALSO mark the tea as personal collection (is_personal=1, inventory_purpose=personal, is_public=0) — use for taking a tea off the store and into the owner\'s personal collection. Pass is_public=true to ALSO raise the public-listing flag (is_public=1) — use for publishing intake-created Draft items that finalize leaves is_public=0. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        shown_in_shop: { type: 'boolean', description: 'true to list in the shop; false to hide from the shop (status unchanged).' },
        personal: { type: 'boolean', description: 'Optional. Also mark the tea as personal collection (is_personal=1, inventory_purpose=personal, is_public=0).' },
        is_public: { type: 'boolean', description: 'Optional. Also raise the public-listing flag (is_public=1) so the tea appears on the public shop. Use for publishing intake-created Draft items.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['product_id', 'shown_in_shop'],
    },
  },
  {
    name: 'fulfill_invoice',
    scope: 'sales:write',
    description: 'Deduct stock for all line items on an existing Draft invoice and mark it Filled. Refuses with a clear error if any line would result in negative stock — fix stock first. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice id to fulfill (must be in Draft status with inventory_deducted = 0).' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['invoice_id'],
    },
  },
  {
    name: 'mark_invoice_paid',
    scope: 'sales:write',
    description: 'Mark an invoice paid by id, by invoice number, or — if neither is given — the most recent unpaid invoice on the account. Set fulfill_stock=true when the same message also says the stock has left, to deduct line items and mark the invoice Filled in one step. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'Invoice id. Preferred when known.' },
        invoice_number: { type: 'string', description: 'Invoice number. Used if invoice_id is omitted.' },
        payment_method: { type: 'string', description: 'How payment was received (e.g. "cash", "bank transfer").', default: 'mcp' },
        fulfill_stock: { type: 'boolean', description: 'Also deduct stock and mark the invoice Filled. Skips cleanly if inventory was already deducted.', default: false },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: [],
    },
  },
  {
    name: 'update_account_settings',
    scope: 'admin:write',
    description: 'Update basic account settings (name, default currency, contact email/phone) and the shop freight rate. Two-step preview/confirm. Owner-tier only. Defaults to the active account if account_id is not specified.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Account id to update. Defaults to the token\'s account if omitted.' },
        account_name: { type: 'string', description: 'Display name for the account.' },
        default_currency: { type: 'string', description: '3-letter ISO currency code, e.g. AUD.' },
        contact_email: { type: 'string', description: 'Primary contact email for the account.' },
        contact_phone: { type: 'string', description: 'WhatsApp / primary phone number for the account.' },
        default_shipping_rate_per_kg: { type: 'number', description: 'Shop freight per kg, applied to every tea that has no rate of its own. Quoted in default_shipping_rate_currency and converted to USD live. Folded into the COST basis, so the markup multiplies it. Shop default is 85 Yuan/kg.' },
        default_shipping_rate_currency: { type: 'string', description: 'Currency the freight rate is quoted in: Yuan, USD, HKD. Must exist in the exchange rate table.' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
    },
  },
  {
    name: 'update_exchange_rate',
    scope: 'admin:write',
    description: 'Update the USD exchange rate for a platform currency. Platform-owner tokens only — this change affects all accounts. Two-step preview/confirm with a clear warning.',
    inputSchema: {
      type: 'object',
      properties: {
        currency: { type: 'string', description: '3-letter ISO currency code, e.g. CNY. Must already exist in the platform exchange rates table.' },
        rate_vs_usd: { type: 'number', description: 'How many units of the currency equal 1 USD (e.g. 7.25 for CNY).' },
        confirm: { type: 'string', description: 'Confirmation token from preview response.' },
      },
      required: ['currency', 'rate_vs_usd'],
    },
  },
  // ── Intake (Curate-import) ──
  {
    name: 'intake_start',
    scope: 'stock:write',
    description: 'Create a new Curate import draft. Optionally supply a title and/or pasted text (e.g. a vendor list or invoice photo OCR). Returns import_id — pass it to intake_add_source, intake_analyze, and eventually intake_finalize.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Human-readable label for this import (optional — defaults to today\'s date).' },
        pasted_text: { type: 'string', description: 'Raw text to attach as the first source (vendor list, invoice text, WeChat paste, etc.).' },
      },
    },
  },
  {
    name: 'intake_add_source',
    scope: 'stock:write',
    description: 'Add a source document to an existing Curate import draft. Use this to attach additional text (e.g. a second invoice page) or reference an already-uploaded R2 object key.',
    inputSchema: {
      type: 'object',
      properties: {
        import_id: { type: 'string', description: 'Import batch ID returned by intake_start.' },
        kind: { type: 'string', description: 'Source kind: wechat | invoice | vendor_list | photo | file | paste.', default: 'paste' },
        pasted_text: { type: 'string', description: 'Raw text content for this source.' },
        r2_object_key: { type: 'string', description: 'R2 object key for a previously uploaded file.' },
      },
      required: ['import_id', 'kind'],
    },
  },
  {
    name: 'intake_analyze',
    scope: 'stock:write',
    description: 'Run LLM analysis on a Curate import draft, extracting structured tea/teaware records from its sources. Pass source_ids to re-analyze specific sources only. Analysis runs asynchronously — poll intake_get_draft to check analysis_state.',
    inputSchema: {
      type: 'object',
      properties: {
        import_id: { type: 'string', description: 'Import batch ID.' },
        source_ids: { type: 'array', items: { type: 'string' }, description: 'Limit analysis to these source IDs (omit to analyze all).' },
      },
      required: ['import_id'],
    },
  },
  {
    name: 'intake_get_draft',
    scope: 'inventory:read',
    description: 'Fetch the full Curate import draft including batch metadata, sources, vendor groups, and all items with their parsed_data, uncertainty, version, and review_state. Use this to inspect analysis results and item versions before editing.',
    inputSchema: {
      type: 'object',
      properties: {
        import_id: { type: 'string', description: 'Import batch ID.' },
      },
      required: ['import_id'],
    },
  },
  {
    name: 'intake_update_item',
    scope: 'stock:write',
    description: 'Update fields on a single item in a Curate import draft. Supply version (from intake_get_draft) as the If-Match optimistic-concurrency token — the call returns version_conflict (409) if the item was updated concurrently. Pass updates as a flat object with any of: name, raw_text, parsed_data, uncertainty, reviewed_fields, confidence, review_state, category, position, source_id.',
    inputSchema: {
      type: 'object',
      properties: {
        import_id: { type: 'string', description: 'Import batch ID.' },
        item_id: { type: 'string', description: 'Item ID from intake_get_draft.' },
        version: { type: 'number', description: 'Current item version for optimistic concurrency (from intake_get_draft item.version). Omit to force-overwrite.' },
        updates: { type: 'object', description: 'Fields to update: name, raw_text, parsed_data, uncertainty, reviewed_fields, confidence, review_state, category, position, source_id.' },
      },
      required: ['import_id', 'item_id', 'updates'],
    },
  },
  {
    name: 'intake_set_group_vendor',
    scope: 'stock:write',
    description: 'Assign a vendor customer to a Curate import lot\'s vendor group, unblocking intake_finalize for stock-bearing items. Scoped to stock:write so the operator token can resolve vendor groups (the owner-tier REST bundle auth is not granted). Direct-handler wrapper over PUT /api/curate/imports/:id/groups/:groupId.',
    inputSchema: {
      type: 'object',
      properties: {
        import_id: { type: 'string', description: 'Import batch ID.' },
        group_id: { type: 'string', description: 'Vendor group ID from intake_get_draft (groups[].id).' },
        vendor_customer_id: { type: 'string', description: 'Customer id of the vendor (from upsert_vendor_contact or find_customer). Pass null to clear.' },
      },
      required: ['import_id', 'group_id', 'vendor_customer_id'],
    },
  },
  {
    name: 'intake_ask',
    scope: 'stock:write',
    description: 'Post a clarifying question (ask) on a Curate import draft or specific item. NOTE: the chat endpoint (THEN-T1) has not shipped yet — this tool currently returns not_implemented.',
    inputSchema: {
      type: 'object',
      properties: {
        import_id: { type: 'string', description: 'Import batch ID.' },
        item_id: { type: 'string', description: 'Optional item to attach the question to.' },
        asks_field: { type: 'string', description: 'The field or aspect being asked about.' },
        body: { type: 'string', description: 'The question body.' },
      },
      required: ['import_id', 'asks_field', 'body'],
    },
  },
  {
    name: 'intake_answer',
    scope: 'stock:write',
    description: 'Post an answer to a pending ask on a Curate import draft. NOTE: the chat endpoint (THEN-T1) has not shipped yet — this tool currently returns not_implemented.',
    inputSchema: {
      type: 'object',
      properties: {
        import_id: { type: 'string', description: 'Import batch ID.' },
        item_id: { type: 'string', description: 'Optional item the answer applies to.' },
        answers_field: { type: 'string', description: 'The field or aspect being answered.' },
        answer_value: { description: 'The answer value (any JSON type).' },
        answer_kind: { type: 'string', description: 'Kind of answer: value | skip | uncertain.' },
        body: { type: 'string', description: 'Free-text explanation or context.' },
      },
      required: ['import_id', 'answers_field', 'answer_value', 'answer_kind', 'body'],
    },
  },
  {
    name: 'intake_finalize',
    scope: 'stock:write',
    description: 'Finalize a Curate import draft, creating Draft products and Curate identities for all non-abandoned items. Items with received/in_transit disposition also generate inventory receipts and stock movements. Two-step preview/confirm: first call returns a preview + confirmation_token, second call with confirm: <token> commits.',
    inputSchema: {
      type: 'object',
      properties: {
        import_id: { type: 'string', description: 'Import batch ID.' },
        confirm: { type: 'string', description: 'Confirmation token from the preview response.' },
      },
      required: ['import_id'],
    },
  },
  // ── Round three: the order process ──
  {
    name: 'whats_waiting',
    scope: 'sales:read',
    description: 'What needs you right now, oldest first, in words: order requests nobody has answered, orders still unpriced, payments customers have reported and nobody has checked, and orders paid but not yet sent. Start here when asked "what needs me", "what is waiting" or "what should I do first".',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'How many waiting items to read out (default 8, max 40). The counts always cover everything.', default: 8 },
        kind: { type: 'string', description: 'Narrow to one kind: request, unpriced, claim or unsent. Omit for all four.' },
      },
    },
  },
  {
    name: 'list_order_requests',
    scope: 'sales:read',
    description: 'Order requests that have come in, with who sent them, what they asked for and how long ago. Use the reference it returns with convert_order_request.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'unanswered (default), new, seen, replied, closed, converted, or all.', default: 'unanswered' },
        limit: { type: 'number', description: 'Max requests to return (default 10, max 50).', default: 10 },
      },
    },
  },
  {
    name: 'convert_order_request',
    scope: 'sales:write',
    description: 'Turn an order request into a real Draft order, pricing what the shop still carries from the catalogue and leaving anything it does not as a named line at no price. Two-step preview/confirm: the first call reads the lines back and returns a confirmation_token, the second call with confirm: <token> creates the draft. Refuses a request that is already an order, and says which order it became. Nothing is sent to the customer.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The order request id, from list_order_requests or whats_waiting.' },
        reference: { type: 'string', description: 'The request reference the customer was given, if the id is not to hand.' },
        confirm: { type: 'string', description: 'Confirmation token from the preview response.' },
      },
    },
  },
  {
    name: 'list_payment_claims',
    scope: 'sales:read',
    description: 'Payments customers say they have sent: who, how much, by what method, the reference they quoted, and what the order still owes. These are REPORTS, not money. Only confirm_payment turns one into a settled payment.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'claimed (default, the ones waiting on you), confirmed, rejected, or all.', default: 'claimed' },
        invoice_id: { type: 'string', description: 'Narrow to one order by id.' },
        invoice_number: { type: 'string', description: 'Narrow to one order by its visible number.' },
        limit: { type: 'number', description: 'Max reports to return (default 10, max 50).', default: 10 },
      },
    },
  },
  {
    name: 'confirm_payment',
    scope: 'sales:write',
    description: 'Confirm ONE payment a customer reported, turning their report into money received. Two-step preview/confirm: the first call reads back the order, the customer, the amount and what the order will owe afterwards, and returns a confirmation_token; the second call with confirm: <token> records it. Takes exactly one payment_id and will not confirm several reports at once.',
    inputSchema: {
      type: 'object',
      properties: {
        payment_id: { type: 'string', description: 'The reported payment to confirm, from list_payment_claims or whats_waiting.' },
        confirm: { type: 'string', description: 'Confirmation token from the preview response.' },
      },
    },
  },
  {
    name: 'record_payment',
    scope: 'sales:write',
    description: 'Record money you saw arrive on an order, with no customer report behind it. Two-step preview/confirm: the first call reads back the order, the customer, the amount and what the order will owe afterwards, and returns a confirmation_token; the second call with confirm: <token> records it. The order must be named explicitly; there is no "most recent unpaid order" guess.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string', description: 'The order id.' },
        invoice_number: { type: 'string', description: 'The visible order number, if the id is not to hand.' },
        amount_usd: { type: 'number', description: 'How much arrived, in US dollars.' },
        method: { type: 'string', description: 'How it arrived, e.g. "Bank transfer" or "Cash".' },
        reference: { type: 'string', description: 'The transfer reference, if there is one.' },
        note: { type: 'string', description: 'Anything else worth keeping on the record.' },
        confirm: { type: 'string', description: 'Confirmation token from the preview response.' },
      },
    },
  },
] as const;

function mcpContent(payload: unknown) {
  // MCP tool results are returned as a `content` array of typed parts. We
  // serialize the structured payload as JSON inside a text part — Claude
  // handles JSON-in-text reliably and it keeps the contract simple for any
  // future non-Claude MCP client — AND we mirror it into `structuredContent`
  // (MCP 2025-06-18) so clients that prefer typed output can consume it
  // directly. `structuredContent` must be an object, so non-object payloads
  // are wrapped.
  const isObject = typeof payload === 'object' && payload !== null;
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: isObject ? payload : { value: payload },
    isError: isObject && 'error' in (payload as any),
  };
}

// The order-process tools are spoken back to a person, so their text part is a
// sentence rather than the JSON `mcpContent` emits. The structured half is
// unchanged and still carries every id, amount and timestamp, so a client that
// reads `structuredContent` loses nothing by the text being readable aloud.
//
// A payload with no `spoken` field falls through to `mcpContent`, so this is
// safe to point any tool at.
function mcpSpokenContent(payload: unknown) {
  const isObject = typeof payload === 'object' && payload !== null;
  const spoken = isObject && typeof (payload as any).spoken === 'string'
    ? (payload as any).spoken.trim()
    : '';
  if (!spoken) return mcpContent(payload);
  return {
    content: [{ type: 'text', text: spoken }],
    structuredContent: payload as Record<string, unknown>,
    isError: 'error' in (payload as any),
  };
}

// MCP tool annotations (2025-06-18) — behavioural hints clients use to decide
// what needs a human confirmation prompt and how to present a tool. Derived
// from sets rather than hand-written on each def to keep TOOL_DEFS lean.
const READ_ONLY_TOOLS = new Set([
  'search_tea', 'get_tea', 'list_low_stock', 'find_customer',
  'get_customer', 'get_account_context', 'list_invoices', 'get_invoice', 'sales_summary',
  'intake_get_draft',
  // Round three. These four read and nothing else; whats_waiting in particular
  // must be safe for a client to call on its own to answer "what needs me".
  'whats_waiting', 'list_order_requests', 'list_payment_claims',
]);
// Tools whose commit can destroy or reverse value. void_invoice and
// remove_stock unwind stock/sales; update_exchange_rate moves every account's
// prices.
const DESTRUCTIVE_TOOLS = new Set(['void_invoice', 'remove_stock', 'update_exchange_rate']);
// Confirming twice with the same args lands in the same end state.
const IDEMPOTENT_TOOLS = new Set([
  'tag_customer', 'untag_customer', 'link_vendor', 'unlink_vendor',
  'upsert_vendor_contact', 'remove_vendor_contact', 'link_vendor_products',
  'update_tea_catalog',
  'set_archive_status', 'set_low_stock_threshold', 'mark_invoice_paid', 'set_tasting',
  'update_customer', 'update_invoice', 'update_tea_pricing',
  'update_account_settings', 'update_exchange_rate', 'set_tea_visibility',
  'intake_analyze', 'intake_update_item', 'intake_set_group_vendor',
  // Round three. A second convert of the same request lands on the same order
  // (the claim is guarded and returns 409), and a second confirm of the same
  // payment row changes nothing and counts nothing twice.
  //
  // record_payment is deliberately NOT here: every confirmed call inserts
  // another payment row, so twice is twice the money. That is what a client
  // needs to know before it retries a call whose response it did not see.
  'convert_order_request', 'confirm_payment',
]);

/**
 * The hints a client reads before deciding whether it may call a tool
 * unprompted. For the built-in tools they come from the three sets above. A
 * module declares its own beside the tool it describes, which is the only place
 * a reader can check a hint against the handler it belongs to, so a declared
 * hint wins over the computed default.
 *
 * This mattered immediately: the seam used to overwrite a module's annotations
 * with the computed ones, so every module tool was advertised as a writing tool
 * whatever it actually did, and a careful client refuses to call a writing tool
 * on its own. A read-only tool nobody may call is not a tool.
 */
function annotationsFor(tool: { name: string; scope?: string; annotations?: Record<string, unknown> }) {
  /* A tool held behind a `:read` scope cannot write, because the scope check
     ran before the handler did. So read-only is derivable for module tools and
     does not need a second hand-kept list to fall out of step with the first.
     READ_ONLY_TOOLS stays authoritative for the built-in tools it was written
     for, several of which sit behind write scopes for other reasons. */
  const readOnly = READ_ONLY_TOOLS.has(tool.name) || (tool.scope?.endsWith(':read') ?? false);
  const computed = {
    readOnlyHint: readOnly,
    destructiveHint: DESTRUCTIVE_TOOLS.has(tool.name),
    idempotentHint: !readOnly && IDEMPOTENT_TOOLS.has(tool.name),
    openWorldHint: false,
  };
  return tool.annotations ? { ...computed, ...tool.annotations } : computed;
}

/**
 * Tool groups added after this file got long, each in its own module under
 * mcpTools/. See that folder's registry.ts for why: every tool used to touch
 * this file in four places, which is fine for one tool and unmergeable for six
 * written at once. The existing tools above are deliberately left where they
 * are; the point is to stop this file growing, not to rewrite what ships.
 *
 * Add a module here and its tools are scoped, listed, annotated, audited and
 * dispatched by the same code that serves the built-in ones.
 */
const TOOL_MODULES: ToolModule[] = [
  transferToolModule,
  curationTools,
  eventsToolModule,
  writingToolModule,
  costCurrencyTools,
];

const { defs: MODULE_TOOL_DEFS, handlers: MODULE_TOOL_HANDLERS } = combineToolModules(TOOL_MODULES);

function toolDefFor(name: string) {
  return TOOL_DEFS.find(tool => tool.name === name)
    ?? MODULE_TOOL_DEFS.find(tool => tool.name === name);
}

function visibleToolDefs(auth: McpAuth) {
  // Module tools are listed on the same terms as the built-in ones. A tool that
  // dispatches but never appears in tools/list is a tool nobody can find.
  return [...TOOL_DEFS, ...MODULE_TOOL_DEFS]
    .filter(tool => {
      const scope = tool.scope as McpScope;
      if (!hasMcpScope(auth, scope)) return false;
      // Owner-tier scoped tools are invisible without current owner authority.
      if (OWNER_TIER_SCOPES.has(scope) && !OWNER_TIERS.has(auth.creatorTier)) return false;
      return true;
    })
    .map(tool => {
      const { scope: _scope, ...rest } = tool;
      return { ...rest, annotations: annotationsFor(tool) };
    });
}

const AUDITED_TOOLS = new Set([
  'record_sale', 'add_stock', 'remove_stock',
  'create_customer', 'update_customer',
  'update_tea_pricing', 'set_low_stock_threshold', 'set_tasting',
  'update_invoice', 'void_invoice',
  // Wave 3
  'tag_customer', 'untag_customer', 'link_vendor', 'unlink_vendor',
  'upsert_vendor_contact', 'remove_vendor_contact', 'link_vendor_products',
  'update_tea_catalog',
  'set_archive_status', 'fulfill_invoice', 'update_account_settings', 'update_exchange_rate',
  'set_tea_visibility',
  // Ported tools
  'create_tea', 'mark_invoice_paid',
  // Round three
  'convert_order_request', 'confirm_payment', 'record_payment',
]);

/**
 * Every module tool that is not read-only, by construction rather than by a
 * second hand-maintained list. AUDITED_TOOLS above names the built-in tools one
 * at a time, which is fine for a list that grew a few entries at a time and is
 * a trap for a seam: a module added later would be dispatched, listed and
 * scoped by this file and silently missing from its audit trail, and nobody
 * finds a hole in a log by looking at it.
 */
const MODULE_AUDITED_TOOLS = new Set(
  MODULE_TOOL_DEFS.filter(def => !annotationsFor(def).readOnlyHint).map(def => def.name),
);

async function logMcpToolCall(env: Env, auth: McpAuth, toolName: string, args: any, result: unknown) {
  const shouldAudit = (AUDITED_TOOLS.has(toolName) || MODULE_AUDITED_TOOLS.has(toolName)) && (
    toolName === 'record_sale' ||
    typeof args?.confirm === 'string'
  );
  if (!shouldAudit) return;
  const failed = Boolean((result as any)?.isError);
  await env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'MCP_TOOL_CALL', ?, ?, 'mcp_token', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    JSON.stringify({ tool: toolName, token_id: auth.tokenId, confirmed: Boolean(args?.confirm), failed }),
    auth.userEmail,
    auth.tokenId,
    auth.accountId,
  ).run();
}

async function dispatchTool(env: Env, auth: McpAuth, name: string, args: any) {
  const tool = toolDefFor(name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);

  const scope = tool.scope as McpScope;

  // Scope check
  if (!hasMcpScope(auth, scope)) {
    return mcpContent({
      error: 'insufficient_mcp_scope',
      required_scope: scope,
      tool: name,
    });
  }

  // Owner-tier gate — defense in depth: reject even if scope is in the token
  // when the creator no longer has owner-tier authority.
  if (OWNER_TIER_SCOPES.has(scope) && !OWNER_TIERS.has(auth.creatorTier)) {
    return mcpContent({
      error: 'owner_tier_required',
      message: 'This tool requires current account-owner or platform-owner authority.',
      tool: name,
    });
  }

  let result;
  switch (name) {
    case 'search_tea': result = mcpContent(await toolSearchTea(env, auth.accountId, args)); break;
    case 'get_tea': result = mcpContent(await toolGetTea(env, auth.accountId, args)); break;
    case 'list_low_stock': result = mcpContent(await toolListLowStock(env, auth.accountId)); break;
    case 'find_customer': result = mcpContent(await toolFindCustomer(env, auth.accountId, args)); break;
    case 'get_customer': result = mcpContent(await toolGetCustomer(env, auth.accountId, args)); break;
    case 'get_account_context': result = mcpContent(await toolGetAccountContext(env, auth.accountId)); break;
    case 'list_invoices': result = mcpContent(await toolListInvoices(env, auth.accountId, args)); break;
    case 'get_invoice': result = mcpContent(await toolGetInvoice(env, auth.accountId, args)); break;
    case 'sales_summary': result = mcpContent(await toolSalesSummary(env, auth.accountId, args)); break;
    case 'create_tea': result = mcpContent(await toolCreateTea(env, auth, args)); break;
    case 'add_stock': result = mcpContent(await toolAddStock(env, auth, args)); break;
    case 'remove_stock': result = mcpContent(await toolRemoveStock(env, auth, args)); break;
    case 'record_sale': result = mcpContent(await toolRecordSale(env, auth, args)); break;
    case 'create_customer': result = mcpContent(await toolCreateCustomer(env, auth, args)); break;
    case 'update_customer': result = mcpContent(await toolUpdateCustomer(env, auth, args)); break;
    case 'update_tea_pricing': result = mcpContent(await toolUpdateTeaPricing(env, auth, args)); break;
    case 'set_tasting': result = mcpContent(await toolSetTasting(env, auth, args)); break;
    case 'set_low_stock_threshold': result = mcpContent(await toolSetLowStockThreshold(env, auth, args)); break;
    case 'update_invoice': result = mcpContent(await toolUpdateInvoice(env, auth, args)); break;
    case 'void_invoice': result = mcpContent(await toolVoidInvoice(env, auth, args)); break;
    // Wave 3
    case 'tag_customer': result = mcpContent(await toolTagCustomer(env, auth, args)); break;
    case 'untag_customer': result = mcpContent(await toolUntagCustomer(env, auth, args)); break;
    case 'link_vendor': result = mcpContent(await toolLinkVendor(env, auth, args)); break;
    case 'unlink_vendor': result = mcpContent(await toolUnlinkVendor(env, auth, args)); break;
    case 'upsert_vendor_contact': result = mcpContent(await toolUpsertVendorContact(env, auth, args)); break;
    case 'remove_vendor_contact': result = mcpContent(await toolRemoveVendorContact(env, auth, args)); break;
    case 'link_vendor_products': result = mcpContent(await toolLinkVendorProducts(env, auth, args)); break;
    case 'update_tea_catalog': result = mcpContent(await toolUpdateTeaCatalog(env, auth, args)); break;
    case 'set_archive_status': result = mcpContent(await toolSetArchiveStatus(env, auth, args)); break;
    case 'set_tea_visibility': result = mcpContent(await toolSetTeaVisibility(env, auth, args)); break;
    case 'fulfill_invoice': result = mcpContent(await toolFulfillInvoice(env, auth, args)); break;
    case 'mark_invoice_paid': result = mcpContent(await toolMarkInvoicePaid(env, auth, args)); break;
    case 'update_account_settings': result = mcpContent(await toolUpdateAccountSettings(env, auth, args)); break;
    case 'update_exchange_rate': result = mcpContent(await toolUpdateExchangeRate(env, auth, args)); break;
    // Intake (Curate-import) tools
    case 'intake_start': result = mcpContent(await toolIntakeStart(env, auth, args)); break;
    case 'intake_add_source': result = mcpContent(await toolIntakeAddSource(env, auth, args)); break;
    case 'intake_analyze': result = mcpContent(await toolIntakeAnalyze(env, auth, args)); break;
    case 'intake_get_draft': result = mcpContent(await toolIntakeGetDraft(env, auth, args)); break;
    case 'intake_update_item': result = mcpContent(await toolIntakeUpdateItem(env, auth, args)); break;
    case 'intake_set_group_vendor': result = mcpContent(await toolIntakeSetGroupVendor(env, auth, args)); break;
    case 'intake_ask': result = mcpContent(await toolIntakeAsk(env, auth, args)); break;
    case 'intake_answer': result = mcpContent(await toolIntakeAnswer(env, auth, args)); break;
    case 'intake_finalize': result = mcpContent(await toolIntakeFinalize(env, auth, args)); break;
    // Round three: the order process. These answer out loud, so their text
    // part is the sentence rather than the JSON.
    case 'whats_waiting': result = mcpSpokenContent(await toolWhatsWaiting(env, auth.accountId, args)); break;
    case 'list_order_requests': result = mcpSpokenContent(await toolListOrderRequests(env, auth.accountId, args)); break;
    case 'convert_order_request': result = mcpSpokenContent(await toolConvertOrderRequest(env, auth, args)); break;
    case 'list_payment_claims': result = mcpSpokenContent(await toolListPaymentClaims(env, auth.accountId, args)); break;
    case 'confirm_payment': result = mcpSpokenContent(await toolConfirmPayment(env, auth, args)); break;
    case 'record_payment': result = mcpSpokenContent(await toolRecordPayment(env, auth, args)); break;
    default: {
      /* A module tool reaches here having already passed the same scope and
         owner-tier checks as everything above, because those run off the tool
         definition and a module's definition is in the same list. */
      const handler = MODULE_TOOL_HANDLERS[name];
      if (!handler) throw new Error(`Unknown tool: ${name}`);
      result = mcpContent(await handler(env, auth, args));
      break;
    }
  }
  await logMcpToolCall(env, auth, name, args, result);
  return result;
}

const SERVER_INFO = {
  name: 'teajia-inventory',
  version: '0.5.0',
  description: 'Voice-controlled inventory, invoicing and the order process for Teajia. Ask whats_waiting first: it answers what needs you right now across order requests nobody has answered, orders still unpriced, payments customers have reported, and orders paid but not sent. Read tools also cover tea search, account context, customer dossiers, invoice lookup/listing, order requests, payment reports and sales summaries. Write tools cover turning an order request into a draft order, confirming a reported payment, recording a payment you saw arrive, creating teas, stock adjustments, creating/voiding/fulfilling invoices, marking invoices paid, customer create/update/tag, vendor linking, catalog archive + pricing, and (with owner-tier tokens) account settings and exchange rates.',
};

// Default to the current rev (structured output + tool annotations). We echo
// the client's requested protocolVersion when it sends one in `initialize`, so
// older clients negotiate down cleanly instead of being forced to our default.
const PROTOCOL_VERSION = '2025-06-18';

export async function mcpFetch(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') {
    // Lightweight health probe so you can curl /mcp to see it's up without auth.
    return json({
      ok: true,
      server: SERVER_INFO,
      protocol: PROTOCOL_VERSION,
      hint: 'POST a JSON-RPC 2.0 request with Bearer <mcp_token> to use this endpoint.',
    });
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const auth = await authenticateMcp(request, env);
  if (auth instanceof Response) return auth;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }

  const { jsonrpc, id = null, method, params } = body || {};
  if (jsonrpc !== '2.0' || typeof method !== 'string') {
    return rpcError(id ?? null, -32600, 'Invalid Request');
  }

  try {
    switch (method) {
      case 'initialize': {
        const requested = typeof params?.protocolVersion === 'string' ? params.protocolVersion : null;
        return rpcResult(id, {
          protocolVersion: requested || PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
        });
      }

      case 'tools/list':
        return rpcResult(id, { tools: visibleToolDefs(auth) });

      case 'tools/call': {
        const name = params?.name;
        const args = params?.arguments ?? {};
        if (typeof name !== 'string') return rpcError(id, -32602, 'tools/call requires `name`');
        const result = await dispatchTool(env, auth, name, args);
        return rpcResult(id, result);
      }

      case 'ping':
        return rpcResult(id, {});

      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err: any) {
    return rpcError(id, -32603, err?.message || 'Internal error');
  }
}

// ── admin REST handlers (token mint / list / revoke) ──
//
// These are wired into the regular Worker route table so they reuse the JWT
// + bundle middleware. They live here rather than in index.ts to keep the
// MCP surface co-located.

export async function mcpAdminMintToken(
  env: Env, accountId: string, userId: string, userEmail: string, label: string,
  requestedScopes?: McpScope[], creatorTier?: McpCreatorTier,
): Promise<{ id: string; token: string; prefix: string; scopes: McpScope[] }> {
  // Generate 32 bytes → 43-char base64url. That's 256 bits of entropy and
  // unambiguous when Adrian copies it.
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const plaintext = `tjmcp_${b64}`;
  const hash = await sha256Hex(plaintext);
  const prefix = plaintext.slice(0, 14); // "tjmcp_xxxxxxxx" — enough to distinguish, can't reconstruct
  const id = crypto.randomUUID();

  // Validate scopes: only allow owner-tier scopes if the creator is owner-tier.
  const tier: McpCreatorTier = creatorTier ?? 'account_owner';
  let scopes: McpScope[];
  if (requestedScopes && requestedScopes.length > 0) {
    // Filter to valid scopes; strip owner-tier scopes if creator is not owner-tier.
    scopes = requestedScopes.filter((s): s is McpScope => {
      if (!MCP_SCOPES.includes(s as McpScope)) return false;
      if (OWNER_TIER_SCOPES.has(s as McpScope) && !OWNER_TIERS.has(tier)) return false;
      return true;
    });
    if (scopes.length === 0) scopes = DEFAULT_MCP_SCOPES;
  } else {
    scopes = DEFAULT_MCP_SCOPES;
  }

  // Expire one year out. expires_at is unix seconds; enforced in authenticateMcp.
  const expiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  await env.DB.prepare(
    `INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, accountId, userId, userEmail, label.slice(0, 80), hash, prefix, JSON.stringify(scopes), tier, expiresAt).run();

  return { id, token: plaintext, prefix, scopes };
}

export async function mcpAdminListTokens(env: Env, accountId: string) {
  const { results } = await env.DB.prepare(
    `SELECT id, user_email, label, token_prefix, scopes, created_at, last_used_at, revoked_at
       FROM mcp_tokens WHERE account_id = ? ORDER BY created_at DESC`
  ).bind(accountId).all();
  return results;
}

export async function mcpAdminRevokeToken(env: Env, accountId: string, tokenId: string): Promise<boolean> {
  const result = await env.DB.prepare(
    `UPDATE mcp_tokens SET revoked_at = datetime('now')
       WHERE id = ? AND account_id = ? AND revoked_at IS NULL`
  ).bind(tokenId, accountId).run();
  return (result.meta?.changes ?? 0) > 0;
}

// ── OAuth 2.1 + dynamic client registration (MCP spec) ──
//
// Required so Claude desktop/mobile can connect via the Connectors UI rather
// than a manually-pasted token. Flow:
//
//   1. Client hits /mcp without a token → we return 401 + WWW-Authenticate
//      pointing at /.well-known/oauth-protected-resource.
//   2. Client GETs that document → it points at our auth server metadata.
//   3. Client GETs /.well-known/oauth-authorization-server → endpoint URLs.
//   4. Client POSTs /oauth/register → we mint a client_id (no secret, public).
//   5. Client opens /oauth/authorize?client_id=...&code_challenge=...
//      → we redirect to the existing Teajia login if not signed in, then
//      show a consent screen.
//   6. User approves → we 302 back to the redirect_uri with `code=`.
//   7. Client POSTs /oauth/token with the code + code_verifier → we PKCE-
//      verify, mint a fresh mcp_token row, return it as the access_token.
//   8. Client uses that bearer token on /mcp going forward (same code path
//      as the manually-minted tokens — they share the mcp_tokens table).

function corsJson(data: unknown, status = 200): Response {
  // The .well-known endpoints are fetched by the MCP client from outside
  // any browser origin we control, so they need permissive CORS.
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

async function enforceOAuthLimit(binding: RateLimiterBinding | undefined, request: Request): Promise<Response | null> {
  if (!binding) return null;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const result = await binding.limit({ key: ip });
    return result.success ? null : corsJson({ error: 'slow_down', error_description: 'Too many requests' }, 429);
  } catch {
    return corsJson({ error: 'temporarily_unavailable', error_description: 'Rate limit service unavailable' }, 503);
  }
}

// Allowlist of redirect_uri targets we will 302 to with an OAuth `code=`.
// Dynamic client registration (RFC 7591) lets ANY caller register a client,
// so validating the requested redirect_uri only against the client's own
// registered list is meaningless — the attacker registered the client. We
// therefore pin the redirect target to the legitimate MCP connector clients
// (Claude + ChatGPT web origins, their desktop custom schemes) plus localhost
// for dev. Anything else is an open-redirect / auth-code-exfil vector.
const OAUTH_REDIRECT_HOST_ALLOWLIST = [
  'claude.ai',
  'claude.com',
  'chatgpt.com',
  'chat.openai.com',
  'platform.openai.com',
];
const OAUTH_REDIRECT_SCHEME_ALLOWLIST = ['claude:', 'cursor:', 'vscode:'];

function isAllowedRedirectUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false; // unparseable → reject
  }

  // Custom desktop-client schemes (claude://, cursor://, vscode://).
  if (OAUTH_REDIRECT_SCHEME_ALLOWLIST.includes(parsed.protocol)) return true;

  // Local dev: http://localhost or http://127.0.0.1 on any port.
  if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
    return true;
  }

  // Web connector clients must be https with an allowlisted host (exact or
  // a subdomain). Exact/suffix match only — never `includes()`, which would
  // let `evil-claude.ai.attacker.com` slip through.
  if (parsed.protocol === 'https:') {
    const host = parsed.hostname.toLowerCase();
    return OAUTH_REDIRECT_HOST_ALLOWLIST.some(
      (base) => host === base || host.endsWith('.' + base),
    );
  }

  return false;
}

export function originOf(request: Request): string {
  const u = new URL(request.url);
  const forwarded = request.headers.get('X-Teajia-Public-Origin');
  if (forwarded) {
    try {
      const candidate = new URL(forwarded);
      const host = candidate.hostname.toLowerCase();
      const allowedHost = host === 'teajia.com' || host === 'www.teajia.com' ||
        host === 'teajiafinal.pages.dev' || host.endsWith('.teajiafinal.pages.dev');
      if (candidate.protocol === 'https:' && allowedHost && candidate.origin === forwarded.replace(/\/$/, '')) {
        return candidate.origin;
      }
    } catch { /* fall through to the direct request origin */ }
  }
  return `${u.protocol}//${u.host}`;
}

export function oauthProtectedResourceMetadata(request: Request): Response {
  const origin = originOf(request);
  return corsJson({
    resource: `${origin}/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ['header'],
    resource_documentation: `${origin}/admin/mcp-tokens`,
  });
}

export function oauthAuthorizationServerMetadata(request: Request): Response {
  const origin = originOf(request);
  return corsJson({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    grant_types_supported: ['authorization_code'],
    response_types_supported: ['code'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['mcp'],
  });
}

// POST /oauth/register — dynamic client registration (RFC 7591). Because
// registration is open, every requested redirect_uri is checked against the
// connector allowlist (see isAllowedRedirectUri) at registration time AND
// again at the authorize/decision step. Claude desktop/mobile and ChatGPT
// use a known, bounded set of schemes/hosts (claude://oauth,
// https://claude.ai/..., etc.), so this does not break legitimate clients.
export async function oauthRegister(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return corsJson({ error: 'invalid_request', error_description: 'POST required' }, 405);
  const limited = await enforceOAuthLimit(env.OAUTH_REGISTER_LIMITER, request);
  if (limited) return limited;

  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > 16_384) return corsJson({ error: 'invalid_client_metadata', error_description: 'Registration metadata too large' }, 400);

  let body: any;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 16_384) {
      return corsJson({ error: 'invalid_client_metadata', error_description: 'Registration metadata too large' }, 400);
    }
    body = JSON.parse(raw);
  } catch {
    return corsJson({ error: 'invalid_request', error_description: 'Body must be JSON' }, 400);
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return corsJson({ error: 'invalid_client_metadata', error_description: 'Registration metadata must be an object' }, 400);
  }
  const clientName = body.client_name === undefined ? 'Unknown Client' : body.client_name;
  if (typeof clientName !== 'string' || clientName.length < 1 || clientName.length > 120) {
    return corsJson({ error: 'invalid_client_metadata', error_description: 'client_name must be 1-120 characters' }, 400);
  }
  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0 || redirectUris.length > 10 || redirectUris.some((u: unknown) => typeof u !== 'string' || u.length > 2048)) {
    return corsJson({ error: 'invalid_redirect_uri', error_description: 'redirect_uris required' }, 400);
  }
  if (new Set(redirectUris).size !== redirectUris.length) {
    return corsJson({ error: 'invalid_redirect_uri', error_description: 'redirect_uris must be unique' }, 400);
  }
  // Reject the whole registration if ANY redirect_uri is off-allowlist — we
  // won't store a client we'd later refuse to redirect to anyway.
  const disallowed = redirectUris.find((u: string) => !isAllowedRedirectUri(u));
  if (disallowed) {
    return corsJson({
      error: 'invalid_redirect_uri',
      error_description: `redirect_uri not permitted: ${disallowed}`,
    }, 400);
  }
  const grantTypes = body.grant_types === undefined ? ['authorization_code'] : body.grant_types;
  const responseTypes = body.response_types === undefined ? ['code'] : body.response_types;
  if (!Array.isArray(grantTypes) || grantTypes.length !== 1 || grantTypes[0] !== 'authorization_code') {
    return corsJson({ error: 'invalid_client_metadata', error_description: 'Only authorization_code is supported' }, 400);
  }
  if (!Array.isArray(responseTypes) || responseTypes.length !== 1 || responseTypes[0] !== 'code') {
    return corsJson({ error: 'invalid_client_metadata', error_description: 'Only code response type is supported' }, 400);
  }
  if (body.token_endpoint_auth_method !== undefined && body.token_endpoint_auth_method !== 'none') {
    return corsJson({ error: 'invalid_client_metadata', error_description: 'Only public PKCE clients are supported' }, 400);
  }

  const redirectsJson = JSON.stringify(redirectUris);
  const grantsJson = JSON.stringify(grantTypes);
  const responsesJson = JSON.stringify(responseTypes);
  const existing = await env.DB.prepare(
    `SELECT id FROM oauth_clients
     WHERE client_name = ? AND redirect_uris = ? AND grant_types = ? AND response_types = ? LIMIT 1`
  ).bind(clientName, redirectsJson, grantsJson, responsesJson).first() as { id: string } | null;

  const id = existing?.id || crypto.randomUUID();
  if (!existing) {
    await env.DB.prepare(
      `INSERT INTO oauth_clients (id, client_name, redirect_uris, grant_types, response_types)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(id, clientName, redirectsJson, grantsJson, responsesJson).run();
  }

  // Per RFC 7591 section 3.2.1
  return corsJson({
    client_id: id,
    client_name: clientName,
    redirect_uris: redirectUris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: 'none',
  }, 201);
}

// GET /oauth/authorize — Claude opens this URL in a browser.
//
// Worker can't render HTML reliably (and we don't want a worker-side login
// form), so we send the user to the Teajia frontend's consent page. That page
// handles login (if needed) and the user-facing approve/deny. On approve it
// POSTs to /oauth/authorize/decision, which mints the auth code and hands back
// a redirect to Claude's redirect_uri.
//
// We DO NOT forward the OAuth params in the redirect query string. Claude
// mobile's in-app browser was observed to drop the query string on the 302
// follow, leaving the consent page with no
// client_id/code_challenge. Instead we persist the request in D1 and redirect
// to `/admin/oauth-consent/<request_id>` — a path segment, which survives the
// hop reliably. The consent page reads the id from the path and fetches the
// params back from /oauth/authorize/request/<id>.
//
// CRITICAL: this redirect must go to the FRONTEND origin, not the worker
// origin — the worker has no UI. We hard-code the live site because the
// worker has no other reliable way to discover the frontend URL.
// teajia.com is the real frontend (Pages project `teajiafinal`); the old
// teajia.pages.dev project is stale and was redirecting users to a dead site.
const FRONTEND_ORIGIN = 'https://teajia.com';
const AUTHORIZE_REQUEST_TTL_MS = 15 * 60 * 1000;

export async function oauthAuthorize(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') return corsJson({ error: 'invalid_request', error_description: 'GET required' }, 405);
  const limited = await enforceOAuthLimit(env.OAUTH_AUTHORIZE_LIMITER, request);
  if (limited) return limited;
  const url = new URL(request.url);
  const q = url.searchParams;
  const now = Date.now();

  const clientId = q.get('client_id') || '';
  const redirectUri = q.get('redirect_uri') || '';
  const responseType = q.get('response_type') || '';
  const codeChallenge = q.get('code_challenge') || '';
  const challengeMethod = q.get('code_challenge_method') || '';
  const state = q.get('state');
  const scope = q.get('scope');
  if (!clientId || clientId.length > 128 || redirectUri.length > 2048 || responseType !== 'code'
    || !/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge) || challengeMethod !== 'S256'
    || (state !== null && state.length > 512) || (scope !== null && scope !== '' && scope !== 'mcp')) {
    return corsJson({ error: 'invalid_request', error_description: 'Invalid authorization request' }, 400);
  }
  const client = await env.DB.prepare('SELECT redirect_uris, grant_types, response_types FROM oauth_clients WHERE id = ?')
    .bind(clientId).first() as { redirect_uris: string; grant_types: string; response_types: string } | null;
  if (!client) return corsJson({ error: 'invalid_request', error_description: 'Unknown client_id' }, 400);
  let registered: string[] = [];
  let registeredGrants: string[] = [];
  let registeredResponses: string[] = [];
  try {
    registered = JSON.parse(client.redirect_uris);
    registeredGrants = JSON.parse(client.grant_types);
    registeredResponses = JSON.parse(client.response_types);
  } catch { /* invalid stored client */ }
  if (!registeredGrants.includes('authorization_code') || !registeredResponses.includes('code')) {
    return corsJson({ error: 'unauthorized_client', error_description: 'Client is not registered for authorization code flow' }, 400);
  }
  if (!registered.includes(redirectUri) || !isAllowedRedirectUri(redirectUri)) {
    return corsJson({ error: 'invalid_redirect_uri', error_description: 'redirect_uri not registered' }, 400);
  }

  // Opportunistic cleanup of expired pending requests.
  env.DB.prepare('DELETE FROM oauth_authorize_requests WHERE expires_at < ?')
    .bind(now).run().catch(() => {});

  const existing = await env.DB.prepare(
    `SELECT id FROM oauth_authorize_requests
     WHERE client_id = ? AND redirect_uri = ? AND response_type = ? AND code_challenge = ?
       AND code_challenge_method = ? AND COALESCE(state, '') = ? AND COALESCE(scope, '') = ? AND expires_at >= ?
     LIMIT 1`
  ).bind(clientId, redirectUri, responseType, codeChallenge, challengeMethod, state || '', scope || '', now).first() as { id: string } | null;
  const id = existing?.id || crypto.randomUUID();
  if (!existing) await env.DB.prepare(
    `INSERT INTO oauth_authorize_requests
       (id, client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state, scope, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    clientId,
    redirectUri,
    responseType,
    codeChallenge,
    challengeMethod,
    state,
    scope,
    now + AUTHORIZE_REQUEST_TTL_MS,
  ).run();

  return Response.redirect(`${FRONTEND_ORIGIN}/admin/oauth-consent/${id}`, 302);
}

// GET /oauth/authorize/request/:id — the consent page fetches the stored
// authorize request (public OAuth params only) so it can render and POST a
// decision. Returns the client's display name for the consent copy.
export async function oauthAuthorizeRequestInfo(request: Request, env: Env, requestId: string): Promise<Response> {
  const now = Date.now();
  const row = await env.DB.prepare(
    `SELECT client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state, scope, expires_at
       FROM oauth_authorize_requests WHERE id = ?`
  ).bind(requestId).first() as Record<string, any> | null;

  if (!row || Number(row.expires_at) < now) {
    return corsJson({ error: 'not_found', error_description: 'Authorization request expired or unknown. Restart the connection from your app.' }, 404);
  }

  const client = await env.DB.prepare('SELECT client_name FROM oauth_clients WHERE id = ?')
    .bind(row.client_id).first() as { client_name: string } | null;

  return corsJson({
    request_id: requestId,
    client_id: row.client_id,
    client_name: client?.client_name || null,
    redirect_uri: row.redirect_uri,
    response_type: row.response_type,
    code_challenge: row.code_challenge,
    code_challenge_method: row.code_challenge_method,
    state: row.state ?? null,
    scope: row.scope ?? null,
  });
}

// Filter a requested scope list to those valid for the approving user's tier.
// Owner-tier scopes are stripped for non-owner tiers. Empty result falls back
// to the safe default set. Applied at both decision and token mint (defense in
// depth), mirroring mcpAdminMintToken.
function sanitizeScopesForTier(requested: unknown, tier: McpCreatorTier): McpScope[] {
  if (!Array.isArray(requested)) return DEFAULT_MCP_SCOPES;
  const filtered = requested.filter((s): s is McpScope => {
    if (!MCP_SCOPES.includes(s as McpScope)) return false;
    if (OWNER_TIER_SCOPES.has(s as McpScope) && !OWNER_TIERS.has(tier)) return false;
    return true;
  });
  return filtered.length > 0 ? Array.from(new Set(filtered)) : DEFAULT_MCP_SCOPES;
}

// POST /oauth/authorize/decision — called by the consent page after the user
// approves. The Teajia JWT is read from the Authorization header and verified
// server-side before we mint a short-lived auth code.
export async function oauthAuthorizeDecision(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return corsJson({ error: 'Method not allowed' }, 405);

  let body: any;
  try { body = await request.json(); } catch {
    return corsJson({ error: 'invalid_request' }, 400);
  }

  // Two shapes accepted: the new flow passes `request_id` (params are loaded
  // from the stored authorize request), the legacy flow passes the OAuth params
  // inline. `scopes` (an array) is the user's consent-screen selection.
  const { request_id, account_id, scopes: requestedScopes } = body || {};
  let { client_id, redirect_uri, code_challenge, code_challenge_method, state } = body || {};

  if (request_id) {
    const reqRow = await env.DB.prepare(
      `SELECT client_id, redirect_uri, code_challenge, code_challenge_method, state, expires_at
         FROM oauth_authorize_requests WHERE id = ?`
    ).bind(String(request_id)).first() as Record<string, any> | null;
    if (!reqRow || Number(reqRow.expires_at) < Date.now()) {
      return corsJson({ error: 'invalid_request', error_description: 'Authorization request expired or unknown' }, 400);
    }
    client_id = reqRow.client_id;
    redirect_uri = reqRow.redirect_uri;
    code_challenge = reqRow.code_challenge;
    code_challenge_method = reqRow.code_challenge_method;
    state = reqRow.state ?? null;
  }

  if (!client_id || !redirect_uri || !code_challenge || code_challenge_method !== 'S256') {
    return corsJson({ error: 'invalid_request', error_description: 'Missing required PKCE params' }, 400);
  }
  const approval = await resolveOAuthApprovalContext(
    request,
    env,
    typeof account_id === 'string' ? account_id : null,
  );
  if (approval instanceof Response) return approval;

  // Validate the redirect_uri against what the client registered with.
  const client = await env.DB.prepare('SELECT redirect_uris FROM oauth_clients WHERE id = ?')
    .bind(client_id).first() as { redirect_uris: string } | null;
  if (!client) return corsJson({ error: 'invalid_client' }, 400);
  let registered: string[] = [];
  try { registered = JSON.parse(client.redirect_uris); } catch {}
  if (!registered.includes(redirect_uri)) {
    return corsJson({ error: 'invalid_redirect_uri', error_description: 'redirect_uri not registered' }, 400);
  }
  // Defense in depth: even a registered redirect_uri must be on the connector
  // allowlist before we 302 a fresh auth code to it (clients registered before
  // this check existed, or via a tampered row, are caught here).
  if (!isAllowedRedirectUri(redirect_uri)) {
    return corsJson({ error: 'invalid_redirect_uri', error_description: 'redirect_uri not permitted' }, 400);
  }

  // Scopes the user granted on the consent screen, filtered to the approver's
  // tier. Persisted on the code so token mint honours the selection.
  const grantedScopes = sanitizeScopesForTier(requestedScopes, approval.creatorTier);

  // Mint a fresh single-use auth code (5 min TTL).
  const code = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO oauth_codes
       (code, client_id, redirect_uri, user_id, user_email, account_id, code_challenge, code_challenge_method, expires_at, scopes, creator_tier)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    code,
    client_id,
    redirect_uri,
    approval.userId,
    approval.userEmail,
    approval.accountId,
    code_challenge,
    code_challenge_method,
    expires,
    JSON.stringify(grantedScopes),
    approval.creatorTier,
  ).run();

  // Single-use authorize request — consume it now that a code is minted.
  if (request_id) {
    env.DB.prepare('DELETE FROM oauth_authorize_requests WHERE id = ?').bind(String(request_id)).run().catch(() => {});
  }

  // Build the redirect URL the browser should go to next.
  const sep = redirect_uri.includes('?') ? '&' : '?';
  const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
  const redirectTo = `${redirect_uri}${sep}code=${encodeURIComponent(code)}${stateParam}`;

  return corsJson({ redirect_to: redirectTo });
}

// POST /oauth/token — exchange auth code for an mcp_token.
export async function oauthToken(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return corsJson({ error: 'Method not allowed' }, 405);

  // Token endpoint accepts both application/x-www-form-urlencoded and JSON.
  let params: Record<string, string> = {};
  const ctype = request.headers.get('Content-Type') || '';
  if (ctype.includes('application/x-www-form-urlencoded')) {
    const text = await request.text();
    for (const part of text.split('&')) {
      const [k, v] = part.split('=');
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    }
  } else {
    try { params = await request.json() as Record<string, string>; } catch {
      return corsJson({ error: 'invalid_request' }, 400);
    }
  }

  if (params.grant_type !== 'authorization_code') {
    return corsJson({ error: 'unsupported_grant_type' }, 400);
  }
  const { code, client_id, redirect_uri, code_verifier } = params;
  if (!code || !client_id || !redirect_uri || !code_verifier) {
    return corsJson({ error: 'invalid_request', error_description: 'Missing parameters' }, 400);
  }

  // Look up the code, atomically marking it used.
  const codeRow = await env.DB.prepare(
    'SELECT * FROM oauth_codes WHERE code = ?'
  ).bind(code).first() as Record<string, any> | null;

  if (!codeRow) return corsJson({ error: 'invalid_grant', error_description: 'Unknown code' }, 400);
  if (codeRow.used_at) return corsJson({ error: 'invalid_grant', error_description: 'Code already used' }, 400);
  if (new Date(codeRow.expires_at as string).getTime() < Date.now()) {
    return corsJson({ error: 'invalid_grant', error_description: 'Code expired' }, 400);
  }
  if (codeRow.client_id !== client_id) return corsJson({ error: 'invalid_grant', error_description: 'Client mismatch' }, 400);
  if (codeRow.redirect_uri !== redirect_uri) return corsJson({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' }, 400);

  // Verify PKCE: SHA-256(verifier), base64url, must equal code_challenge.
  const verifierHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(code_verifier));
  const computed = btoa(String.fromCharCode(...new Uint8Array(verifierHash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  if (computed !== codeRow.code_challenge) {
    return corsJson({ error: 'invalid_grant', error_description: 'PKCE verification failed' }, 400);
  }

  const markUsed = await env.DB.prepare("UPDATE oauth_codes SET used_at = datetime('now') WHERE code = ? AND used_at IS NULL")
    .bind(code).run() as any;
  if (typeof markUsed?.meta?.changes === 'number' && markUsed.meta.changes === 0) {
    return corsJson({ error: 'invalid_grant', error_description: 'Code already used' }, 400);
  }

  // Mint an mcp_token row for this approval.
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const tokenB64 = btoa(String.fromCharCode(...tokenBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const accessToken = `tjmcp_${tokenB64}`;
  const tokenHash = await sha256Hex(accessToken);
  const tokenPrefix = accessToken.slice(0, 14);
  const tokenId = crypto.randomUUID();

  // Look up the client_name for a human-readable label.
  const clientRow = await env.DB.prepare('SELECT client_name FROM oauth_clients WHERE id = ?')
    .bind(client_id).first() as { client_name: string } | null;
  const label = `OAuth: ${clientRow?.client_name || 'Unknown'}`;

  // Honour the scopes + tier the user granted at consent. Re-filter by tier as
  // defense in depth in case the code row was tampered with. Older codes minted
  // before migration 082 have neither column → fall back to the safe default.
  const grantTier: McpCreatorTier =
    (['platform_owner', 'account_owner', 'staff', 'viewer'] as McpCreatorTier[]).includes(codeRow.creator_tier as McpCreatorTier)
      ? (codeRow.creator_tier as McpCreatorTier)
      : 'account_owner';
  let grantScopes: McpScope[] = DEFAULT_MCP_SCOPES;
  if (codeRow.scopes) {
    try { grantScopes = sanitizeScopesForTier(JSON.parse(codeRow.scopes as string), grantTier); } catch { /* keep default */ }
  }

  // Expire one year out. expires_at is unix seconds; enforced in authenticateMcp.
  const tokenExpiresAt = Math.floor(Date.now() / 1000) + 365 * 24 * 3600;
  await env.DB.prepare(
    `INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    tokenId,
    codeRow.account_id, codeRow.user_id, codeRow.user_email,
    label, tokenHash, tokenPrefix, JSON.stringify(grantScopes), grantTier, tokenExpiresAt,
  ).run();

  await env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'MCP_TOKEN_MINTED', ?, ?, 'mcp_token', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    `MCP OAuth token minted: ${label}`,
    codeRow.user_email,
    tokenId,
    codeRow.account_id,
  ).run();

  return corsJson({
    access_token: accessToken,
    token_type: 'Bearer',
    scope: grantScopes.join(' '),
    // No refresh token — clients can re-run the OAuth dance to get a new
    // access token, and the existing tokens stay valid in the meantime.
    // Most MCP clients treat the access token as long-lived by default.
  });
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC read-only MCP — unauthenticated catalog access for the shopping public
// ════════════════════════════════════════════════════════════════════════════
//
// Served at /mcp/public. Anyone's Claude/ChatGPT can browse the shop, read a
// tea's profile, and assemble a WhatsApp checkout link — but it can only READ,
// and only sees public-safe fields (no cost, no margin, no vendor, no exact
// stock grams). This is the on-brand bridge from AI discovery to the
// intentional human WhatsApp close: the model prepares the order, Adrian closes
// it. There is no write surface and no auth — every tool here is harmless to a
// stranger.
//
// Account scope: ?account=<slug>, else the platform-owner account.
//
// Abuse: a best-effort per-isolate token bucket caps requests; production
// should additionally front this with a Cloudflare rate-limiting rule (the
// isolate-local counter resets on recycle and isn't shared across colos).

const PUBLIC_SITE_ORIGIN = 'https://teajia.co';

type PublicAccount = {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string | null;
  currency_default: string | null;
  public_shop_path: string | null;
};

async function resolvePublicAccount(env: Env, slug: string | null): Promise<PublicAccount | null> {
  if (slug) {
    return env.DB.prepare(
      `SELECT id, name, slug, whatsapp_number, currency_default, public_shop_path
         FROM accounts WHERE slug = ? AND public_enabled = 1 AND status = 'active'`
    ).bind(slug).first() as Promise<PublicAccount | null>;
  }
  return env.DB.prepare(
    `SELECT id, name, slug, whatsapp_number, currency_default, public_shop_path
       FROM accounts WHERE is_platform_owner = 1 AND public_enabled = 1 AND status = 'active'
       LIMIT 1`
  ).first() as Promise<PublicAccount | null>;
}

// Public-safe projection — deliberately omits cost_amount, vendor, margins, and
// exact stock_grams (only an in_stock boolean leaks).
function publicProductSummary(p: ProductRow & { description?: string | null; tasting_notes?: string | null }) {
  return {
    id: p.id,
    name: p.given_name || p.product_name,
    chinese_name: p.chinese_name,
    type: p.type,
    form: p.form,
    year: p.year,
    origin: [p.origin_region, p.origin_country].filter(Boolean).join(', ') || null,
    price_per_gram_usd: p.fixed_retail_price_usd ?? null,
    in_stock: Number(p.stock_grams || 0) > 0,
    shop_url: `${PUBLIC_SITE_ORIGIN}/shop/product/${p.slug || p.id}`,
  };
}

const PUBLIC_PRODUCT_COLS =
  `id, slug, given_name, product_name, chinese_name, type, form, year,
   origin_country, origin_region, vendor, stock_grams, quantity_units,
   low_stock_threshold, fixed_retail_price_usd, status`;

async function publicSearchTea(env: Env, accountId: string, args: any) {
  const query = String(args?.query || '').trim();
  const limit = Math.min(Math.max(Number(args?.limit) || 8, 1), 20);
  if (!query) return { matches: [] };

  // Cap the candidate set fetched from D1. Scoring happens in app code below,
  // so an unbounded catalog would let one unauthenticated request full-scan
  // the whole products table (DoS / cost amplification).
  const { results } = await env.DB.prepare(
    `SELECT ${PUBLIC_PRODUCT_COLS} FROM products WHERE account_id = ? AND status = 'Active' LIMIT 200`
  ).bind(accountId).all();

  const scored = (results as unknown as ProductRow[])
    .map(p => ({ p, score: scoreMatch(query, [p.given_name, p.product_name, p.chinese_name, p.origin_region, p.year, p.type]) }))
    .filter(s => s.score > 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { matches: scored.map(s => publicProductSummary(s.p)) };
}

async function publicGetTea(env: Env, accountId: string, args: any) {
  const id = String(args?.id || '').trim();
  if (!id) throw new Error('id is required');
  const p = await env.DB.prepare(
    `SELECT ${PUBLIC_PRODUCT_COLS}, description, tasting_notes
       FROM products WHERE id = ? AND account_id = ? AND status = 'Active'`
  ).bind(id, accountId).first() as (ProductRow & { description?: string; tasting_notes?: string }) | null;
  if (!p) return { error: 'not_found' };

  let tasting: any = p.tasting_notes;
  if (typeof tasting === 'string') { try { tasting = JSON.parse(tasting); } catch { tasting = []; } }

  return { ...publicProductSummary(p), description: p.description ?? null, tasting_notes: tasting };
}

async function publicBrowseCatalog(env: Env, accountId: string, args: any) {
  const limit = Math.min(Math.max(Number(args?.limit) || 30, 1), 100);
  const wheres = ['account_id = ?', "status = 'Active'"];
  const binds: any[] = [accountId];
  if (args?.type) { wheres.push('type = ?'); binds.push(String(args.type)); }
  if (args?.in_stock_only) { wheres.push('stock_grams > 0'); }

  const { results } = await env.DB.prepare(
    `SELECT ${PUBLIC_PRODUCT_COLS} FROM products
      WHERE ${wheres.join(' AND ')}
      ORDER BY (stock_grams > 0) DESC, year DESC, product_name ASC
      LIMIT ?`
  ).bind(...binds, limit).all();

  return {
    items: (results as unknown as ProductRow[]).map(publicProductSummary),
    count: results.length,
  };
}

// Cap on the number of basket lines an unauthenticated caller can submit in
// one call, and the length of any customer-supplied string we persist. Item
// identity/name fields are also clamped before they reach the fuzzy matcher
// so a very long junk string can't inflate scoring cost.
const PUBLIC_PREPARE_ORDER_MAX_ITEMS = 20;
const PUBLIC_PREPARE_ORDER_MAX_STR = 200;

function clampStr(value: unknown, max: number): string {
  const s = typeof value === 'string' ? value.trim() : '';
  return s.length > max ? s.slice(0, max) : s;
}

// Same human-reference format the customer-facing cart uses (createHumanOrderRef
// in src/lib/publicCartDomain.ts) so a prepared-order reference reads like every
// other order reference in the shop, not a different scheme.
function createPreparedOrderRef(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `TJ-${year}${month}${day}-${suffix}`;
}

// Build a WhatsApp checkout link prefilled with the requested teas. The model
// assembles the basket; the human conversation closes it. Items resolve by id
// or by fuzzy name. Returns the link plus a readable summary and shop URLs.
//
// Also records what was prepared as an `inquiries` row (source 'ai_prepared')
// so a basket an AI assistant assembled isn't invisible to the shop just
// because the customer hasn't sent the WhatsApp message yet — see
// todo/plans/order-process-round-2.md item 4. Persisting is a bonus, never a
// gate: the customer must get their WhatsApp link even if the DB write fails,
// and this path never emails the shop owner (a prepared basket may never be
// sent; only a real inquiry/order should land in his inbox).
async function publicPrepareOrder(env: Env, account: PublicAccount, args: any) {
  const rawItems = (Array.isArray(args?.items) ? args.items : []).slice(0, PUBLIC_PREPARE_ORDER_MAX_ITEMS);
  if (rawItems.length === 0) throw new Error('items must be a non-empty array of { id|name, grams }');
  if (!account.whatsapp_number) return { error: 'whatsapp_unavailable', message: 'This shop has no WhatsApp number configured for checkout.' };

  // Cap the candidate set fetched from D1 — items are resolved/scored in app
  // code below, so an unbounded catalog would let one unauthenticated request
  // full-scan the whole products table (DoS / cost amplification).
  const { results: catalog } = await env.DB.prepare(
    `SELECT ${PUBLIC_PRODUCT_COLS} FROM products WHERE account_id = ? AND status = 'Active' LIMIT 200`
  ).bind(account.id).all();
  const products = catalog as unknown as ProductRow[];

  const lines: Array<{ id: string; name: string; grams: number; price_per_gram_usd: number | null; line_total_usd: number | null; in_stock: boolean; shop_url: string }> = [];
  const unresolved: string[] = [];

  for (const raw of rawItems) {
    const grams = Math.max(0, Number(raw?.grams) || 0);
    let match: ProductRow | undefined;
    const id = raw?.id ? clampStr(raw.id, 100) : '';
    const name = raw?.name ? clampStr(raw.name, 100) : '';
    if (id) {
      match = products.find(p => p.id === id);
    } else if (name) {
      const scored = products
        .map(p => ({ p, score: scoreMatch(name, [p.given_name, p.product_name, p.chinese_name, p.year]) }))
        .sort((a, b) => b.score - a.score);
      if (scored[0]?.score > 0.4) match = scored[0].p;
    }
    if (!match) { unresolved.push(name || id || '(unknown)'); continue; }
    const price = match.fixed_retail_price_usd ?? null;
    lines.push({
      id: match.id,
      name: match.given_name || match.product_name,
      grams,
      price_per_gram_usd: price,
      line_total_usd: price != null && grams > 0 ? Math.round(price * grams * 100) / 100 : null,
      in_stock: Number(match.stock_grams || 0) > 0,
      shop_url: `${PUBLIC_SITE_ORIGIN}/shop/product/${match.slug || match.id}`,
    });
  }

  if (lines.length === 0) return { error: 'no_items_resolved', unresolved };

  const estimatedTotal = lines.reduce((s, l) => s + (l.line_total_usd || 0), 0);
  const roundedTotal = estimatedTotal > 0 ? Math.round(estimatedTotal * 100) / 100 : 0;
  const msgLines = [
    `Hello! I'd like to order from ${account.name}:`,
    ...lines.map(l => `• ${l.grams ? l.grams + 'g ' : ''}${l.name}${l.price_per_gram_usd != null && l.grams ? ` — ~$${l.line_total_usd} USD` : ''}`),
    estimatedTotal > 0 ? `Estimated total: ~$${roundedTotal} USD (please confirm)` : '',
  ].filter(Boolean);
  const message = msgLines.join('\n');
  const digits = account.whatsapp_number.replace(/\D/g, '');

  // Contact details are optional here (unlike the cart/consult inquiry paths,
  // which require a name plus a contact string) — this row is a trace of what
  // an AI assembled, not a request the customer necessarily sent. Persisting
  // is best-effort; a D1 failure must not stop the customer getting their link.
  let reference: string | null = null;
  try {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    const refNumber = createPreparedOrderRef();
    const customerName = clampStr(args?.name, PUBLIC_PREPARE_ORDER_MAX_STR);
    const customerEmail = clampStr(args?.email, PUBLIC_PREPARE_ORDER_MAX_STR);
    const customerPhone = clampStr(args?.phone, PUBLIC_PREPARE_ORDER_MAX_STR) || null;
    const itemsJson = JSON.stringify(lines.map(l => ({
      id: l.id,
      name: l.name,
      category: 'tea',
      storeSlug: account.slug,
      quantityGrams: l.grams,
      pricePerGram: l.price_per_gram_usd ?? 0,
      totalPrice: l.line_total_usd ?? 0,
    })));
    await env.DB.prepare(
      `INSERT INTO inquiries
       (id, account_id, name, email, phone, items, total_usd, currency, message, source, ref_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, account.id, customerName, customerEmail, customerPhone,
      itemsJson, roundedTotal, 'USD', null, 'ai_prepared', refNumber,
    ).run();
    reference = refNumber;
  } catch {
    // Persistence is a bonus, never a gate — fall through with reference: null.
  }

  return {
    whatsapp_url: `https://wa.me/${digits}?text=${encodeURIComponent(message)}`,
    message_preview: message,
    lines,
    estimated_total_usd: estimatedTotal > 0 ? roundedTotal : null,
    unresolved: unresolved.length ? unresolved : undefined,
    reference,
    note: 'This opens a WhatsApp message to the shop — checkout is completed in conversation, not automatically. Prices are estimates; the shop confirms final pricing, shipping, and availability.',
  };
}

const PUBLIC_TOOL_DEFS = [
  {
    name: 'search_tea',
    description: 'Search this tea shop\'s public catalog by name, Chinese name, origin, year, or type. Returns purchasable teas with retail price and in-stock status.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number', description: 'Max matches (default 8, max 20).', default: 8 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_tea',
    description: 'Full public profile for one tea by id: description, tasting notes, origin, price, and a shop link.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'browse_catalog',
    description: 'Browse the public catalog, optionally filtered by tea type, in-stock first. Use this to see what the shop offers.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Filter by tea type (e.g. "Pu-erh", "Oolong").' },
        in_stock_only: { type: 'boolean' },
        limit: { type: 'number', description: 'Max items (default 30, max 100).', default: 30 },
      },
    },
  },
  {
    name: 'prepare_order',
    description: 'Assemble a WhatsApp checkout link for a basket of teas (each item is { id or name, grams }). Returns a wa.me link prefilled with the order and an estimated total, plus a reference number for the prepared basket. Checkout is completed by a human in the WhatsApp conversation — this tool never places an order itself, and the shop is not notified until the customer actually sends that message.',
    inputSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Teas to order. Each: { id?, name?, grams }. Provide id (from search_tea) when known, else name. Max 20 items.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              grams: { type: 'number' },
            },
          },
        },
        name: { type: 'string', description: 'Optional: customer name, if known.' },
        email: { type: 'string', description: 'Optional: customer email, if known.' },
        phone: { type: 'string', description: 'Optional: customer phone, if known.' },
      },
      required: ['items'],
    },
  },
] as const;

const PUBLIC_SERVER_INFO = {
  name: 'teajia-shop',
  version: '0.1.0',
  description: 'Public read-only access to a Teajia tea shop catalog, with a WhatsApp checkout-link builder. Read-only; no account data, costs, or margins are exposed.',
};

// Best-effort per-isolate rate limiter. Not a security boundary — front the
// route with a Cloudflare rate-limiting rule for real protection.
const PUBLIC_RATE = new Map<string, { count: number; resetAt: number }>();
const PUBLIC_RATE_LIMIT = 60;
const PUBLIC_RATE_WINDOW_MS = 60 * 1000;
function publicRateOk(ip: string): boolean {
  const now = Date.now();
  const e = PUBLIC_RATE.get(ip);
  if (!e || e.resetAt < now) { PUBLIC_RATE.set(ip, { count: 1, resetAt: now + PUBLIC_RATE_WINDOW_MS }); return true; }
  e.count += 1;
  return e.count <= PUBLIC_RATE_LIMIT;
}

// prepare_order writes an `inquiries` row, unlike the other public tools, so
// it gets a tighter budget on top of the general PUBLIC_RATE gate above.
// Two layers, same shapes already used elsewhere in this file/route:
//   1. In-memory per-isolate map (this Map) — always active today, same
//      best-effort pattern as PUBLIC_RATE. Not a security boundary: it resets
//      on cold start and doesn't span isolates.
//   2. An optional durable Cloudflare Rate Limiting binding
//      (PUBLIC_PREPARE_ORDER_LIMITER), same [[unsafe.bindings]] "ratelimit"
//      shape and optional-binding pattern as OAUTH_REGISTER_LIMITER /
//      OAUTH_AUTHORIZE_LIMITER above and PUBLIC_MCP_LIMITER in index.ts. Not
//      yet provisioned in wrangler.toml (requested in
//      todo/plans/order-process-notes.md) — engages automatically once it is.
const PUBLIC_PREPARE_ORDER_RATE = new Map<string, { count: number; resetAt: number }>();
const PUBLIC_PREPARE_ORDER_RATE_LIMIT = 5;
const PUBLIC_PREPARE_ORDER_RATE_WINDOW_MS = 60 * 1000;
function publicPrepareOrderRateOk(ip: string): boolean {
  const now = Date.now();
  const e = PUBLIC_PREPARE_ORDER_RATE.get(ip);
  if (!e || e.resetAt < now) { PUBLIC_PREPARE_ORDER_RATE.set(ip, { count: 1, resetAt: now + PUBLIC_PREPARE_ORDER_RATE_WINDOW_MS }); return true; }
  e.count += 1;
  return e.count <= PUBLIC_PREPARE_ORDER_RATE_LIMIT;
}

async function publicPrepareOrderRateCheck(env: Env, ip: string): Promise<boolean> {
  if (!publicPrepareOrderRateOk(ip)) return false;
  if (env.PUBLIC_PREPARE_ORDER_LIMITER) {
    try {
      const { success } = await env.PUBLIC_PREPARE_ORDER_LIMITER.limit({ key: ip });
      if (!success) return false;
    } catch {
      // A rate-limiter service hiccup must not block a real customer's
      // WhatsApp link — the in-memory gate above already ran.
    }
  }
  return true;
}

// prepare_order now performs a best-effort DB write (see publicPrepareOrder),
// so it no longer gets the blanket read-only/idempotent annotation the other
// three public tools share — an MCP client that inspects annotations should
// see this one truthfully.
function publicToolDefs() {
  return PUBLIC_TOOL_DEFS.map(t => ({
    ...t,
    annotations: t.name === 'prepare_order'
      ? { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
      : { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }));
}

export async function publicMcpFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const account = await resolvePublicAccount(env, url.searchParams.get('account'));

  if (request.method === 'GET') {
    return json({
      ok: true,
      server: PUBLIC_SERVER_INFO,
      protocol: PROTOCOL_VERSION,
      shop: account ? { name: account.name, slug: account.slug } : null,
      hint: 'POST a JSON-RPC 2.0 request. No auth required. Tools: search_tea, get_tea, browse_catalog, prepare_order.',
    });
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (!publicRateOk(ip)) return rpcError(null, -32000, 'Rate limit exceeded — slow down.');

  if (!account) return rpcError(null, -32001, 'No public shop available.');

  let body: any;
  try { body = await request.json(); } catch { return rpcError(null, -32700, 'Parse error'); }
  const { jsonrpc, id = null, method, params } = body || {};
  if (jsonrpc !== '2.0' || typeof method !== 'string') return rpcError(id ?? null, -32600, 'Invalid Request');

  try {
    switch (method) {
      case 'initialize': {
        const requested = typeof params?.protocolVersion === 'string' ? params.protocolVersion : null;
        return rpcResult(id, { protocolVersion: requested || PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } }, serverInfo: PUBLIC_SERVER_INFO });
      }
      case 'tools/list':
        return rpcResult(id, { tools: publicToolDefs() });
      case 'tools/call': {
        const name = params?.name;
        const args = params?.arguments ?? {};
        if (typeof name !== 'string') return rpcError(id, -32602, 'tools/call requires `name`');
        let payload: unknown;
        switch (name) {
          case 'search_tea': payload = await publicSearchTea(env, account.id, args); break;
          case 'get_tea': payload = await publicGetTea(env, account.id, args); break;
          case 'browse_catalog': payload = await publicBrowseCatalog(env, account.id, args); break;
          case 'prepare_order':
            if (!(await publicPrepareOrderRateCheck(env, ip))) return rpcError(id, -32000, 'Rate limit exceeded for order preparation — slow down.');
            payload = await publicPrepareOrder(env, account, args);
            break;
          default: return rpcError(id, -32601, `Unknown tool: ${name}`);
        }
        return rpcResult(id, mcpContent(payload));
      }
      case 'ping':
        return rpcResult(id, {});
      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err: any) {
    return rpcError(id, -32603, err?.message || 'Internal error');
  }
}
