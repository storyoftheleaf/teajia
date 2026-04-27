interface Env {
  DB: D1Database;
  MEDIA_BUCKET: R2Bucket;
  ADMIN_PASSWORD_HASH: string;
  JWT_SECRET: string;
  ANTHROPIC_API_KEY: string;
  GEMINI_API_KEY: string;
  GROQ_API_KEY: string;
  // Optional — set SENDER_EMAIL + RESEND_API_KEY to enable transactional emails via Resend
  SENDER_EMAIL?: string;
  SENDER_NAME?: string;
  RESEND_API_KEY?: string;
  // Optional — set to enable Google OAuth sign-in
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  // Optional — set to 'true' to enable hard-coded dev admin credentials
  ENABLE_DEV_ADMIN?: string;
}

type Handler = (request: Request, env: Env, params: Record<string, string>) => Promise<Response>;

// ── Multi-account types ──
export interface AccountMembership {
  account_id: string;
  role: 'owner' | 'staff' | 'viewer';
  slug: string;
  account_name: string;
  // Tea Master vs Location vs Platform — read at the account level. Carried
  // here so the frontend can render role-adaptive UI without a second fetch.
  account_kind?: 'platform' | 'location' | 'master';
  // Bundle authorization (Members & Access). Six possible bundles:
  // catalog · stock · publish · gather · sell · members.
  // Resolution rules (handled in resolveBundles, not stored here):
  //   Platform Owner / Admin       → all six on every account
  //   Location Owner / Tea Master  → all six on own account (members locked-on)
  //   Member (staff)               → from account_members.permissions.bundles
  //   Viewer                       → none
  bundles?: Bundle[];
  is_platform_account?: boolean;
}

export type Bundle = 'catalog' | 'stock' | 'publish' | 'gather' | 'sell' | 'members';
export const ALL_BUNDLES: Bundle[] = ['catalog', 'stock', 'publish', 'gather', 'sell', 'members'];

export type PlatformRole = 'platform_owner' | 'platform_admin' | null;

export interface TokenClaims {
  sub: string;
  email: string;
  name: string;
  // Optional — callers pass `username` when present so the client can show
  // it without an extra /me round-trip.
  username?: string | null;
  // Legacy role field — kept for backwards compatibility with the old
  // requireAdmin/requireOwner helpers. New code should use memberships.
  role?: string;
  platform_role?: PlatformRole;
  memberships?: AccountMembership[];
  active_account_id?: string | null;
  iat?: number;
  exp?: number;
}

// ── JWT helpers ──
// Token lifetime: 30 days (was 7). Long-lived login keeps users signed in
// across long gaps without a refresh round-trip. We *also* slide the expiry
// every time an authenticated request is served (see maybeIssueRefreshedToken
// and the /api/auth/refresh endpoint) so regular users never see a kick-out.
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
// When a valid token has less than this many seconds left, /api/auth/me and
// /api/auth/refresh will issue a brand-new token. 14 days gives plenty of
// headroom for infrequent users.
const TOKEN_REFRESH_THRESHOLD_SECONDS = 60 * 60 * 24 * 14; // 14 days
// A recently-expired token (within this grace window) can still be refreshed —
// useful when a user reopens the browser after the deadline passes.
const TOKEN_REFRESH_GRACE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// UTF-8 safe base64 encode/decode. `btoa`/`atob` only accept Latin-1 code
// points, so any Unicode content (e.g. a Chinese name on the user profile)
// blows up with InvalidCharacterError and breaks login / profile updates /
// account switches. TextEncoder/TextDecoder round-trip cleanly.
function b64encodeUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function b64decodeUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// Simple JWT implementation using Web Crypto
async function createToken(
  secret: string,
  claims: Omit<TokenClaims, 'iat' | 'exp'>,
  ttlSeconds: number = TOKEN_TTL_SECONDS,
): Promise<string> {
  const header = b64encodeUtf8(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64encodeUtf8(JSON.stringify({ ...claims, iat: now, exp: now + ttlSeconds }));
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return `${data}.${sigB64}`;
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const [header, payload, sig] = token.split('.');
    if (!header || !payload || !sig) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${payload}`));
    if (!valid) return false;
    const claims = JSON.parse(b64decodeUtf8(payload));
    return claims.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

// Distinguishes between a missing token, an expired-but-valid-signature token,
// and a genuinely invalid (tampered / malformed) token. The 'reason' is included
// in every 401 response so the frontend can tell the difference between
// "session expired — try refreshing" vs "no token sent — don't trigger a logout".
type TokenClassification = 'valid' | 'expired' | 'invalid';

async function classifyToken(token: string, secret: string): Promise<TokenClassification> {
  try {
    const [header, payload, sig] = token.split('.');
    if (!header || !payload || !sig) return 'invalid';
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${payload}`));
    if (!valid) return 'invalid';
    const claims = JSON.parse(b64decodeUtf8(payload));
    return claims.exp > Math.floor(Date.now() / 1000) ? 'valid' : 'expired';
  } catch {
    return 'invalid';
  }
}

// Like verifyToken but also returns tokens that have expired within the grace
// window — used by the refresh endpoint so a user can reopen the tab a few
// days after expiry and silently get a new session.
async function verifyTokenAllowingGrace(token: string, secret: string): Promise<boolean> {
  try {
    const [header, payload, sig] = token.split('.');
    if (!header || !payload || !sig) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(sig), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${payload}`));
    if (!valid) return false;
    const claims = JSON.parse(b64decodeUtf8(payload));
    const now = Math.floor(Date.now() / 1000);
    return typeof claims.exp === 'number' && (now - claims.exp) < TOKEN_REFRESH_GRACE_SECONDS;
  } catch {
    return false;
  }
}

// Simple bcrypt-style comparison using stored hash
// Since Workers don't have bcrypt, we compare using a SHA-256 approach
// The auth endpoint accepts the password and compares against stored hash
async function checkPassword(password: string, storedHash: string): Promise<boolean> {
  // For bcrypt hashes, we can't verify in Workers without a library.
  // Instead, we'll use a SHA-256 comparison. The ADMIN_PASSWORD_HASH secret
  // should be set to the SHA-256 hex of the password.
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHash;
}

function isAuthed(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

function parseToken(token: string): TokenClaims | null {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(b64decodeUtf8(payload)) as TokenClaims;
  } catch {
    return null;
  }
}

// If the current token is within the refresh threshold of expiry, mint a
// fresh one (same claims, new iat/exp). Returns null when no refresh is
// needed so callers can skip the JWT signing cost. Callers include the
// returned token in a `refreshed_token` response field, which the client
// transparently swaps in.
async function maybeIssueRefreshedToken(
  env: Env,
  claims: TokenClaims,
): Promise<string | null> {
  if (typeof claims.exp !== 'number') return null;
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = claims.exp - now;
  if (secondsLeft > TOKEN_REFRESH_THRESHOLD_SECONDS) return null;

  // Refresh memberships from the DB so the new token also picks up any
  // account changes (adds/removals) that happened since the last login.
  const memberships = await loadMemberships(env, claims.sub);
  const activeAccountId = claims.active_account_id
    || memberships[0]?.account_id
    || null;

  return createToken(env.JWT_SECRET, {
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    role: claims.role,
    platform_role: claims.platform_role,
    memberships,
    active_account_id: activeAccountId,
    ...(claims as any).username ? { username: (claims as any).username } : {},
  } as Omit<TokenClaims, 'iat' | 'exp'>);
}

// ── Google OAuth state helpers ──
// State = hex_timestamp.hmac_sig — verifiable without server-side storage
async function signOAuthState(secret: string): Promise<string> {
  const ts = Date.now().toString(16);
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ts));
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${ts}.${sigHex}`;
}

async function verifyOAuthState(state: string, secret: string): Promise<boolean> {
  const dotIdx = state.lastIndexOf('.');
  if (dotIdx < 0) return false;
  const ts = state.slice(0, dotIdx);
  const givenSig = state.slice(dotIdx + 1);
  const tsNum = parseInt(ts, 16);
  if (isNaN(tsNum) || Date.now() - tsNum > 10 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(ts));
  const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return expectedSig === givenSig;
}

// ── Multi-account helpers ──
async function loadMemberships(env: Env, userId: string): Promise<AccountMembership[]> {
  try {
    const { results } = await env.DB.prepare(
      `SELECT am.account_id, am.role, am.permissions, a.slug, a.name, a.kind, a.is_platform_owner
       FROM account_members am
       JOIN accounts a ON a.id = am.account_id
       WHERE am.user_id = ? AND am.status = 'active'
       ORDER BY am.joined_at ASC`
    ).bind(userId).all();
    return (results as any[]).map(r => {
      const role = r.role as AccountMembership['role'];
      const kind = (r.kind as AccountMembership['account_kind']) || 'location';
      const bundles = resolveBundles(role, kind, r.permissions as string | null);
      return {
        account_id: r.account_id as string,
        role,
        slug: r.slug as string,
        account_name: r.name as string,
        account_kind: kind,
        bundles,
        ...(r.is_platform_owner ? { is_platform_account: true } : {}),
      };
    });
  } catch {
    return [];
  }
}

// Resolve the bundle set for a single membership row given role, account kind,
// and the raw permissions JSON. Platform-tier bypasses are handled in the
// requireBundle middleware (it short-circuits for platform_owner/admin claims),
// not here. This function only reasons about per-account membership state.
function resolveBundles(
  role: 'owner' | 'staff' | 'viewer',
  _kind: 'platform' | 'location' | 'master',
  permissionsJson: string | null
): Bundle[] {
  // Owners (Location or Tea Master) always get all six bundles on their own
  // account. Members bundle is locked-on for owners — they cannot revoke it
  // from themselves.
  if (role === 'owner') return [...ALL_BUNDLES];
  // Viewers have no write capabilities; bundles drive write permission.
  if (role === 'viewer') return [];
  // Staff: read bundles from account_members.permissions.bundles. Migration 047
  // backfilled this with ['catalog','stock','sell'] for existing staff. The
  // owner can edit it via PUT /api/accounts/:id/members/:userId/bundles.
  if (role === 'staff') {
    if (!permissionsJson) return [];
    try {
      const parsed = JSON.parse(permissionsJson);
      const arr = parsed?.bundles;
      if (!Array.isArray(arr)) return [];
      return arr.filter((b): b is Bundle => ALL_BUNDLES.includes(b as Bundle));
    } catch {
      return [];
    }
  }
  return [];
}

async function getAccountIdBySlug(env: Env, slug: string): Promise<string | null> {
  try {
    const row = await env.DB.prepare('SELECT id FROM accounts WHERE slug = ?').bind(slug).first();
    return row ? (row.id as string) : null;
  } catch {
    return null;
  }
}

const BALI_ACCOUNT_ID = 'acc_teajia_bali';

type AccountCtx = {
  accountId: string;
  userId: string;
  role: string;
  email: string;
  name: string;
  // Bundle set for this caller in this account, computed by getActiveAccount.
  // Platform Owner / Admin get all six bundles regardless of membership row.
  bundles: Bundle[];
  // True when caller is acting as platform tier (owner or admin) inside any account.
  isPlatform: boolean;
};

// Validate X-Teajia-Account header (or fall back to JWT active_account_id),
// verify the user has an active membership. Returns the account context or
// a Response to return to the caller.
async function getActiveAccount(
  request: Request,
  env: Env
): Promise<AccountCtx | { error: Response }> {
  const token = isAuthed(request);
  if (!token) {
    return { error: json({ error: 'Unauthorized', reason: 'no_token' }, 401) };
  }
  const status = await classifyToken(token, env.JWT_SECRET);
  if (status !== 'valid') {
    // 'expired' → client should attempt a silent refresh
    // 'invalid' → malformed or tampered; client should clear the session
    return { error: json({ error: 'Unauthorized', reason: status }, 401) };
  }
  const claims = parseToken(token);
  if (!claims) return { error: json({ error: 'Unauthorized', reason: 'invalid' }, 401) };

  // Re-verify platform_role from the DB on every request rather than trusting
  // the embedded JWT claim. Without this, a user demoted from platform_admin
  // would retain platform powers until their token expires (up to 30 days).
  // Tokens are signed and tamper-resistant, but signed claims still go stale.
  let dbPlatformRole: PlatformRole = null;
  try {
    const userRow = await env.DB.prepare('SELECT platform_role FROM users WHERE id = ?').bind(claims.sub).first();
    if (!userRow) {
      // User row missing — treat as fully unauthorized (account deleted, etc.)
      return { error: json({ error: 'Unauthorized', reason: 'invalid' }, 401) };
    }
    dbPlatformRole = (userRow.platform_role as PlatformRole) ?? null;
  } catch {
    // Fail closed: if we cannot verify platform role, do not honor the claim.
    return { error: json({ error: 'Auth check failed', reason: 'db_unavailable' }, 503) };
  }

  // Platform owner and platform admin bypass account membership checks —
  // they have access to every account, with all bundles. Suspension still applies.
  if (dbPlatformRole === 'platform_owner' || dbPlatformRole === 'platform_admin') {
    const headerAccount = request.headers.get('X-Teajia-Account');
    const requested = headerAccount || claims.active_account_id || null;
    if (!requested) return { error: json({ error: 'Account access denied' }, 403) };
    try {
      const acct = await env.DB.prepare('SELECT status FROM accounts WHERE id = ?').bind(requested).first();
      if (acct && acct.status === 'suspended') {
        return { error: json({ error: 'This account has been suspended. Reactivate via the platform admin panel.' }, 403) };
      }
    } catch {
      // Fail closed: if we cannot read the account status row, refuse.
      return { error: json({ error: 'Account check failed', reason: 'db_unavailable' }, 503) };
    }
    return {
      accountId: requested,
      userId: claims.sub,
      role: 'owner', // platform roles act as owner within any account
      email: claims.email,
      name: claims.name,
      bundles: [...ALL_BUNDLES],
      isPlatform: true,
    };
  }

  const headerAccount = request.headers.get('X-Teajia-Account');
  const requested = headerAccount || claims.active_account_id || null;
  if (!requested) {
    return { error: json({ error: 'Account access denied' }, 403) };
  }

  // Verify membership and resolve bundles. We always need bundles + kind from
  // the DB (the token's embedded memberships may be stale or missing the new
  // fields if minted before the bundle migration). For tokens that already
  // carry bundles in the membership claim, we still re-verify against the DB
  // on the first request after a deploy to avoid serving with stale auth.
  let membership: {
    role: 'owner' | 'staff' | 'viewer';
    permissions: string | null;
    kind: 'platform' | 'location' | 'master';
  } | null = null;

  // Resolve membership from the DB. Embedded token claims are NOT consulted as
  // a fallback — bundle revocations and role demotions take effect on the next
  // request, not when the token expires. If the DB query fails, fail closed.
  try {
    const row = await env.DB.prepare(
      `SELECT am.role, am.permissions, a.kind
       FROM account_members am
       JOIN accounts a ON a.id = am.account_id
       WHERE am.user_id = ? AND am.account_id = ? AND am.status = 'active'`
    ).bind(claims.sub, requested).first();
    if (row) {
      membership = {
        role: row.role as 'owner' | 'staff' | 'viewer',
        permissions: (row.permissions as string | null) ?? null,
        kind: ((row.kind as string) || 'location') as 'platform' | 'location' | 'master',
      };
    }
  } catch {
    return { error: json({ error: 'Membership check failed', reason: 'db_unavailable' }, 503) };
  }

  if (!membership) {
    return { error: json({ error: 'Account access denied' }, 403) };
  }

  // Block access to suspended accounts (platform roles bypass this earlier).
  try {
    const acct = await env.DB.prepare('SELECT status FROM accounts WHERE id = ?').bind(requested).first();
    if (acct && acct.status === 'suspended') {
      return { error: json({ error: 'This account has been suspended' }, 403) };
    }
  } catch {
    return { error: json({ error: 'Account check failed', reason: 'db_unavailable' }, 503) };
  }

  const bundles = resolveBundles(membership.role, membership.kind, membership.permissions);

  return {
    accountId: requested,
    userId: claims.sub,
    role: membership.role,
    email: claims.email,
    name: claims.name,
    bundles,
    isPlatform: false,
  };
}

async function requireAccount(
  request: Request,
  env: Env
): Promise<AccountCtx | { error: Response }> {
  return getActiveAccount(request, env);
}

async function requireAccountRole(
  request: Request,
  env: Env,
  allowedRoles: string[]
): Promise<AccountCtx | { error: Response }> {
  const ctx = await getActiveAccount(request, env);
  if ('error' in ctx) return ctx;
  // Platform roles already resolve as 'owner' from getActiveAccount — no extra check needed.
  if (!allowedRoles.includes(ctx.role)) {
    return { error: json({ error: 'Insufficient role for this account' }, 403) };
  }
  return ctx;
}

// Bundle-aware authorization (Members & Access). Use this for any handler
// whose access maps to a capability bundle. The authorization matrix lives in
// docs/NETWORK_ROLLOUT_PLAN.md.
//
// Examples:
//   requireBundle(request, env, 'catalog')  — edit canonical, carry teas, suggest edits
//   requireBundle(request, env, 'sell')     — wholesale orders, listing prices
//   requireBundle(request, env, 'members')  — invite, change bundles, remove members
//
// Owner-tier-only actions (transfer ownership, set per-partner margin override,
// suspend account) should additionally call requireOwnerTier. Platform-tier-only
// actions (adopt profile to network, transfer curation) should call requirePlatformAdmin.
async function requireBundle(
  request: Request,
  env: Env,
  bundle: Bundle
): Promise<AccountCtx | { error: Response }> {
  const ctx = await getActiveAccount(request, env);
  if ('error' in ctx) return ctx;
  if (ctx.bundles.includes(bundle)) return ctx;
  return {
    error: json({
      error: 'Insufficient bundle for this action',
      required_bundle: bundle,
    }, 403)
  };
}

// Some actions are reserved to the account's owner tier specifically (not just
// "anyone with the members bundle"). E.g. transferring ownership, configuring
// the per-partner wholesale margin override that defines a financial relationship.
// Platform Owner / Admin satisfy this by virtue of acting as 'owner' in any account.
async function requireOwnerTier(
  request: Request,
  env: Env
): Promise<AccountCtx | { error: Response }> {
  const ctx = await getActiveAccount(request, env);
  if ('error' in ctx) return ctx;
  if (ctx.role === 'owner') return ctx;
  return { error: json({ error: 'Owner-tier access required for this action' }, 403) };
}

// Resolve platform_role from the DB rather than trusting the JWT claim,
// so a demoted user loses platform powers immediately rather than at token
// expiry. Returns null if the user row is missing or DB is unavailable.
async function resolveDbPlatformRole(env: Env, userId: string): Promise<PlatformRole | 'db_error'> {
  try {
    const row = await env.DB.prepare('SELECT platform_role FROM users WHERE id = ?').bind(userId).first();
    if (!row) return null;
    return (row.platform_role as PlatformRole) ?? null;
  } catch {
    return 'db_error';
  }
}

// Require the caller to be the platform owner (only one user).
async function requirePlatformOwner(request: Request, env: Env): Promise<Response | null> {
  const token = isAuthed(request);
  if (!token) return json({ error: 'Unauthorized', reason: 'no_token' }, 401);
  const status = await classifyToken(token, env.JWT_SECRET);
  if (status !== 'valid') return json({ error: 'Unauthorized', reason: status }, 401);
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Unauthorized', reason: 'invalid' }, 401);
  const dbRole = await resolveDbPlatformRole(env, claims.sub);
  if (dbRole === 'db_error') return json({ error: 'Auth check failed', reason: 'db_unavailable' }, 503);
  if (dbRole !== 'platform_owner') {
    return json({ error: 'Platform owner access required' }, 403);
  }
  return null;
}

// Require the caller to be platform owner or platform admin.
async function requirePlatformAdmin(request: Request, env: Env): Promise<Response | null> {
  const token = isAuthed(request);
  if (!token) return json({ error: 'Unauthorized', reason: 'no_token' }, 401);
  const status = await classifyToken(token, env.JWT_SECRET);
  if (status !== 'valid') return json({ error: 'Unauthorized', reason: status }, 401);
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Unauthorized', reason: 'invalid' }, 401);
  const dbRole = await resolveDbPlatformRole(env, claims.sub);
  if (dbRole === 'db_error') return json({ error: 'Auth check failed', reason: 'db_unavailable' }, 503);
  if (dbRole !== 'platform_owner' && dbRole !== 'platform_admin') {
    return json({ error: 'Platform admin access required' }, 403);
  }
  return null;
}

// ── Audit & Ledger Helpers ──
function getUserEmail(request: Request): string | null {
  const token = isAuthed(request);
  if (!token) return null;
  const claims = parseToken(token);
  return claims?.email || null;
}

function buildActivityLog(
  env: Env, action: string, details: string,
  userEmail?: string | null, entityType?: string | null, entityId?: string | null,
  accountId?: string | null
) {
  return env.DB.prepare(
    'INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), action, details, userEmail || null, entityType || null, entityId || null, accountId || null);
}

function buildStockLedgerEntry(
  env: Env, productId: string, delta: number, balanceAfter: number, reason: string,
  userEmail?: string | null, invoiceId?: string | null, invoiceNumber?: string | null, note?: string | null,
  accountId?: string | null
) {
  return env.DB.prepare(
    'INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, source_invoice_id, source_invoice_number, user_email, note, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), productId, delta, balanceAfter, reason, invoiceId || null, invoiceNumber || null, userEmail || null, note || null, accountId || null);
}

// ── Profile / Listing mirror helpers (Step 2 write-through) ──────────────────
//
// During the transition from `products` to `tea_profiles` + `product_listings`,
// every legacy product write must mirror the change to the new tables so partner
// catalog browse and the network-wide views never see stale canonical data.
//
// Deterministic id mapping from migration 048:
//   tea_profiles.id     = 'prof_' + products.id
//   product_listings.id = 'list_' + products.id
//
// These helpers return D1 prepared statements (NOT awaited) so callers can
// batch them with their existing UPDATE products statement. Add the result
// to your extraStmts array — one DB.batch() call covers everything atomically.
//
// Both helpers no-op silently when no profile/listing exists for the product
// (e.g. teaware rows, which were excluded from the migration backfill).

// Columns shared 1:1 between products and tea_profiles. Listed in canonical
// shape so the mirror SQL knows which value to take from `body`.
const PROFILE_MIRROR_COLUMNS: Record<string, string> = {
  // body key                     →  tea_profiles column
  product_name:    'name',
  chinese_name:    'chinese_name',
  type:            'type',
  form:            'form',
  origin_country:  'origin_country',
  origin_region:   'origin_region',
  year:            'harvest_year',
  description:     'description',
  lore:            'lore',
  processing_notes:'processing_notes',
  terroir:         'terroir',
  mood:            'mood',
  experience:      'experience',
  tasting_notes:   'tasting_notes',
  image_url:       'image_url',
  additional_images: 'canonical_photos',
};

// Columns shared 1:1 between products and product_listings.
const LISTING_MIRROR_COLUMNS: Record<string, string> = {
  // body key                     →  product_listings column
  stock_grams:           'stock_grams',
  low_stock_threshold:   'low_stock_threshold',
  recheck_stock:         'recheck_stock',
  fixed_retail_price_usd:'fixed_retail_price_usd',
  markup_multiplier:     'markup_multiplier',
  vendor:                'vendor',
  vendor_id:             'vendor_id',
  cost_amount:           'cost_amount',
  cost_currency:         'cost_currency',
  shipping_rate_per_kg:  'shipping_rate_per_kg',
  quantity_purchased:    'quantity_purchased',
  source_compass_entry_id:'source_compass_entry_id',
  stock_verified_at:     'stock_verified_at',
  is_personal:           'is_personal',
  can_reorder:           'can_reorder',
  is_public:             'is_public',
  is_featured:           'is_featured',
  is_curated:            'is_curated',
  is_sample:             'is_sample',
  in_transit:            'in_transit',
  show_wisdom:           'show_wisdom',
  is_custom_wisdom:      'is_custom_wisdom',
  sold_out_at:           'sold_out_at',
  tasting:               'tasting',
  tasting_source:        'tasting_source',
};

// Build mirror statements for a product update. Pass the SAME body the
// products UPDATE used; this filters down to only the relevant columns and
// emits up to two prepared statements (profile mirror + listing mirror).
// Returns [] if no fields touch either mirror table.
function buildProductMirrorStmts(
  env: Env, productId: string, body: Record<string, any>
): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [];

  // Profile mirror — canonical content
  const profileCols: string[] = [];
  const profileVals: any[] = [];
  for (const bodyKey of Object.keys(body)) {
    const profileCol = PROFILE_MIRROR_COLUMNS[bodyKey];
    if (!profileCol) continue;
    profileCols.push(`${profileCol} = ?`);
    profileVals.push(body[bodyKey] ?? null);
  }
  if (profileCols.length > 0) {
    profileCols.push("updated_at = datetime('now')");
    stmts.push(
      env.DB.prepare(`UPDATE tea_profiles SET ${profileCols.join(', ')} WHERE id = ?`)
        .bind(...profileVals, `prof_${productId}`)
    );
  }

  // Listing mirror — inventory + per-account fields. Listing status mirrors
  // products.status: legacy 'Archived' → listing 'archived', anything else stays 'active'.
  const listingCols: string[] = [];
  const listingVals: any[] = [];
  for (const bodyKey of Object.keys(body)) {
    const listingCol = LISTING_MIRROR_COLUMNS[bodyKey];
    if (!listingCol) continue;
    listingCols.push(`${listingCol} = ?`);
    listingVals.push(body[bodyKey] ?? null);
  }
  if (body.status !== undefined) {
    listingCols.push('status = ?');
    listingVals.push(body.status === 'Archived' ? 'archived' : 'active');
  }
  if (listingCols.length > 0) {
    listingCols.push("updated_at = datetime('now')");
    stmts.push(
      env.DB.prepare(`UPDATE product_listings SET ${listingCols.join(', ')} WHERE id = ?`)
        .bind(...listingVals, `list_${productId}`)
    );
  }

  return stmts;
}

// Stock-only mirror for the dozens of stock adjustment sites (invoice deduct,
// invoice restore, deletion restore, etc.). Cheaper than the full mirror.
function buildListingStockDelta(
  env: Env, productId: string, delta: number
): D1PreparedStatement {
  return env.DB.prepare(
    `UPDATE product_listings SET stock_grams = stock_grams + ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(delta, `list_${productId}`);
}

// Mirror a product status change to the corresponding listing. Used by the
// sold-out / restored toggles (UPDATE products SET status = 'Sold Out' ...).
function buildListingStatusMirror(
  env: Env, productId: string, productStatus: string
): D1PreparedStatement {
  // Legacy products.status values: 'Active' | 'Sold Out' | 'Draft' | 'Archived'.
  // Only 'Archived' maps to listing.status='archived' (soft-delete = stopped carrying).
  // 'Sold Out' is just stock=0 and stays 'active' on the listing per Decision 13.
  const listingStatus = productStatus === 'Archived' ? 'archived' : 'active';
  return env.DB.prepare(
    `UPDATE product_listings SET status = ?, sold_out_at = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(listingStatus, productStatus === 'Sold Out' ? new Date().toISOString() : null, `list_${productId}`);
}

// Build INSERT statements for the profile + listing pair when a new tea product
// is created. Skips teaware. Mirrors the migration 048 backfill shape so old
// and new rows look identical regardless of which path created them.
function buildProductMirrorInserts(
  env: Env, productId: string, accountId: string, body: Record<string, any>
): D1PreparedStatement[] {
  // Teaware: no profile/listing row per the rollout plan.
  if (body.type === 'Teaware') return [];

  // Slug: same shape as migration backfill — tea_key (or name+year) + product id suffix.
  const baseSlug = String(body.tea_key || (body.product_name + (body.year ? `-${body.year}` : '')) || productId)
    .toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const slug = `${baseSlug}-${productId.slice(0, 6)}`.replace(/-+/g, '-');

  // network_visible: same gating as migration backfill.
  const networkVisible = (body.is_public === undefined || !!body.is_public)
    && !body.is_personal
    && !body.is_sample ? 1 : 0;

  // Status mapping: products legacy values → profile lifecycle.
  const profileStatus = body.status === 'Archived' ? 'archived'
    : body.status === 'Draft' ? 'draft'
    : 'published';
  const listingStatus = body.status === 'Archived' ? 'archived' : 'active';

  const profileInsert = env.DB.prepare(`
    INSERT INTO tea_profiles (
      id, slug, originated_by_account_id, curated_by_account_id,
      name, chinese_name, type, form,
      origin_country, origin_region, harvest_year,
      description, lore, processing_notes, terroir, mood, experience,
      tasting_notes, image_url, canonical_photos,
      network_visible, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    `prof_${productId}`, slug, accountId, accountId,
    body.product_name ?? null, body.chinese_name ?? null, body.type ?? null, body.form ?? null,
    body.origin_country ?? null, body.origin_region ?? null, body.year ?? null,
    body.description ?? null, body.lore ?? null, body.processing_notes ?? null,
    body.terroir ?? null, body.mood ?? null, body.experience ?? null,
    body.tasting_notes ?? '[]',
    body.image_url ?? null,
    body.additional_images ?? '[]',
    networkVisible, profileStatus
  );

  const listingInsert = env.DB.prepare(`
    INSERT INTO product_listings (
      id, account_id, profile_id,
      stock_grams, low_stock_threshold, recheck_stock,
      fixed_retail_price_usd, markup_multiplier,
      vendor, vendor_id, cost_amount, cost_currency,
      shipping_rate_per_kg, quantity_purchased, source_compass_entry_id,
      stock_verified_at,
      is_personal, can_reorder, is_public, is_featured, is_curated, is_sample, in_transit,
      show_wisdom, is_custom_wisdom,
      status, sold_out_at,
      tasting, tasting_source,
      legacy_product_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    `list_${productId}`, accountId, `prof_${productId}`,
    body.stock_grams ?? 0, body.low_stock_threshold ?? 100, body.recheck_stock ?? 0,
    body.fixed_retail_price_usd ?? null, body.markup_multiplier ?? 2.5,
    body.vendor ?? null, body.vendor_id ?? null, body.cost_amount ?? 0, body.cost_currency ?? 'USD',
    body.shipping_rate_per_kg ?? 0, body.quantity_purchased ?? null, body.source_compass_entry_id ?? null,
    body.stock_verified_at ?? null,
    body.is_personal ?? 0, body.can_reorder ?? 0, body.is_public ?? 1, body.is_featured ?? 0,
    body.is_curated ?? 0, body.is_sample ?? 0, body.in_transit ?? 0,
    body.show_wisdom ?? 1, body.is_custom_wisdom ?? 0,
    listingStatus, body.sold_out_at ?? null,
    body.tasting ?? '{}', body.tasting_source ?? null,
    productId
  );

  return [profileInsert, listingInsert];
}

async function requireAuth(request: Request, env: Env): Promise<Response | null> {
  const token = isAuthed(request);
  if (!token) return json({ error: 'Unauthorized', reason: 'no_token' }, 401);
  const status = await classifyToken(token, env.JWT_SECRET);
  if (status !== 'valid') return json({ error: 'Unauthorized', reason: status }, 401);
  return null;
}

async function requireAdmin(request: Request, env: Env): Promise<Response | null> {
  const token = isAuthed(request);
  if (!token) return json({ error: 'Unauthorized', reason: 'no_token' }, 401);
  const status = await classifyToken(token, env.JWT_SECRET);
  if (status !== 'valid') return json({ error: 'Unauthorized', reason: status }, 401);
  const claims = parseToken(token);
  if (!claims || (claims.role !== 'admin' && claims.role !== 'owner')) {
    return json({ error: 'Admin access required' }, 403);
  }
  return null;
}

async function requireOwner(request: Request, env: Env): Promise<Response | null> {
  const token = isAuthed(request);
  if (!token) return json({ error: 'Unauthorized', reason: 'no_token' }, 401);
  const status = await classifyToken(token, env.JWT_SECRET);
  if (status !== 'valid') return json({ error: 'Unauthorized', reason: status }, 401);
  const claims = parseToken(token);
  if (!claims || claims.role !== 'owner') {
    return json({ error: 'Owner access required' }, 403);
  }
  return null;
}

// Legacy SHA-256 — only used for env-admin env-var hash comparison
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// PBKDF2 — used for all new/changed user passwords in the DB
async function hashPasswordPBKDF2(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

// Verify against either PBKDF2 or legacy SHA-256 hash
async function verifyPasswordHash(password: string, storedHash: string): Promise<{ verified: boolean; isLegacy: boolean }> {
  if (storedHash.startsWith('pbkdf2:')) {
    const parts = storedHash.split(':');
    if (parts.length !== 4) return { verified: false, isLegacy: false };
    const iterations = parseInt(parts[1]);
    const salt = new Uint8Array((parts[2].match(/.{2}/g) ?? []).map((b: string) => parseInt(b, 16)));
    const expectedHash = parts[3];
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
    const computedHash = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return { verified: computedHash === expectedHash, isLegacy: false };
  }
  const legacyHash = await hashPassword(password);
  return { verified: legacyHash === storedHash, isLegacy: true };
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function cachedJson(data: unknown, maxAge: number, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
    },
  });
}

function swrJson(data: unknown, sMaxAge: number, swr: number, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=30, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
    },
  });
}

function cors(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Teajia-Account');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

// Simple path router
function matchRoute(method: string, path: string, routes: [string, string, Handler][]): { handler: Handler; params: Record<string, string> } | null {
  for (const [routeMethod, pattern, handler] of routes) {
    if (routeMethod !== method) continue;
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) continue;
    const params: Record<string, string> = {};
    let match = true;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { handler, params };
  }
  return null;
}

// ── Product pricing calculation (mirrors the Postgres view) ──
function addPricingFields(product: any, rates: Map<string, number>): any {
  const rate = rates.get(product.cost_currency) || 1;
  const isTeaware = product.type === 'Teaware';

  // For teaware, use quantity_units as the divisor (per-unit pricing)
  // For tea, use quantity_purchased (per-gram pricing)
  const qty = isTeaware
    ? (product.quantity_units || product.quantity_purchased || 0)
    : (product.quantity_purchased || 0);

  let costPerUnitUSD = 0;
  let retailPricePerUnitUSD = 0;

  if (qty > 0) {
    const costPerUnit = product.cost_amount / qty;
    // Shipping per gram only applies to tea, not teaware
    const shippingPerUnit = isTeaware ? 0 : (product.shipping_rate_per_kg || 0) / 1000;
    costPerUnitUSD = (costPerUnit + shippingPerUnit) / (rate || 1);
  }

  if (qty > 0) {
    retailPricePerUnitUSD = costPerUnitUSD * 3.0;
  }

  return {
    ...product,
    stock_grams: Math.round(product.stock_grams || 0),
    cost_per_gram_usd: Math.round(costPerUnitUSD * 100) / 100,
    retail_price_per_gram_usd: Math.round(retailPricePerUnitUSD * 100) / 100,
  };
}

// ── Route Handlers ──

const handleLogin: Handler = async (request, env) => {
  const body = await request.json() as { email?: string; identifier?: string; password?: string };
  // `identifier` is the preferred field (email or username); `email` kept for backwards compat.
  const identifier = (body.identifier ?? body.email ?? '').trim();
  const password = body.password;
  if (!identifier || !password) return json({ error: 'Email/username and password required' }, 400);

  const loginIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  if (!checkRateLimit(`login:${loginIp}`, 10, 60000)) {
    return json({ error: 'Too many login attempts. Please try again in a minute.' }, 429);
  }

  const computedHash = await hashPassword(password);

  // Try DB-based auth (users table) — match on email OR username (case-insensitive)
  try {
    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE lower(email) = lower(?) OR lower(username) = lower(?) LIMIT 1'
    ).bind(identifier, identifier).first();
    const { verified: dbVerified, isLegacy } = await verifyPasswordHash(password, user?.password_hash as string ?? '');
    if (user && dbVerified) {
      if (isLegacy) {
        const upgraded = await hashPasswordPBKDF2(password);
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(upgraded, user.id).run();
      }
      const memberships = await loadMemberships(env, user.id as string);
      const activeAccountId = memberships[0]?.account_id || null;
      const platformRole = (user.platform_role as PlatformRole) ?? null;
      const token = await createToken(env.JWT_SECRET, {
        sub: user.id as string,
        email: user.email as string,
        role: user.role as string,
        platform_role: platformRole,
        name: user.name as string,
        username: (user.username as string | null) ?? null,
        memberships,
        active_account_id: activeAccountId,
      });
      return json({
        token,
        user: { id: user.id, email: user.email, username: user.username ?? null, name: user.name, role: user.role, platform_role: platformRole },
        memberships,
        active_account_id: activeAccountId,
      });
    }
  } catch {
    // Table may not exist yet — fall through to env-based auth
  }

  // Dev backdoor — only active when ENABLE_DEV_ADMIN=true
  if (env.ENABLE_DEV_ADMIN === 'true' && identifier === 'aaa' && computedHash === '5c80565db6f29da0b01aa12522c37b32f121cbe47a861ef7f006cb22922dffa1') {
    // Ensure user exists in DB for consistency, and ensure they have a
    // membership in the Bali account with owner role.
    try {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO users (id, email, name, password_hash, role) VALUES ('dev-admin-aaa', 'aaa', 'Dev Admin', '5c80565db6f29da0b01aa12522c37b32f121cbe47a861ef7f006cb22922dffa1', 'owner')"
      ).run();
      await env.DB.prepare(
        `INSERT OR IGNORE INTO account_members (id, account_id, user_id, role, joined_at, status)
         VALUES (lower(hex(randomblob(16))), ?, 'dev-admin-aaa', 'owner', datetime('now'), 'active')`
      ).bind(BALI_ACCOUNT_ID).run();
    } catch { /* table may not exist yet */ }
    const memberships = await loadMemberships(env, 'dev-admin-aaa');
    const activeAccountId = memberships[0]?.account_id || BALI_ACCOUNT_ID;
    const token = await createToken(env.JWT_SECRET, {
      sub: 'dev-admin-aaa',
      email: 'aaa',
      role: 'owner',
      name: 'Dev Admin',
      memberships,
      active_account_id: activeAccountId,
    });
    return json({
      token,
      user: { id: 'dev-admin-aaa', email: 'aaa', name: 'Dev Admin', role: 'owner' },
      memberships,
      active_account_id: activeAccountId,
    });
  }

  // Fallback: check against env var hash (single admin)
  const storedHash = env.ADMIN_PASSWORD_HASH?.trim();
  if (storedHash && computedHash === storedHash) {
    // env-admin is mapped to Bali for legacy single-tenant behaviour.
    // Include account_kind and bundles so the frontend can render role-adaptive
    // UI without a second fetch even when this legacy path is used.
    const memberships: AccountMembership[] = [{
      account_id: BALI_ACCOUNT_ID,
      role: 'owner',
      slug: 'teajia-bali',
      account_name: 'Teajia Bali',
      account_kind: 'platform',
      bundles: [...ALL_BUNDLES],
    }];
    const token = await createToken(env.JWT_SECRET, {
      sub: 'env-admin',
      email: identifier,
      role: 'admin',
      name: 'Admin',
      memberships,
      active_account_id: BALI_ACCOUNT_ID,
    });
    return json({
      token,
      user: { id: 'env-admin', email: identifier, name: 'Admin', role: 'admin' },
      memberships,
      active_account_id: BALI_ACCOUNT_ID,
    });
  }

  return json({ error: 'Invalid credentials' }, 401);
};

const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;

const handleSignup: Handler = async (request, env) => {
  const body = await request.json() as { email?: string; password?: string; name?: string; username?: string };
  const email = body.email?.trim();
  const password = body.password;
  const name = body.name;
  const username = body.username?.trim() || null;

  if (!email || !password) return json({ error: 'Email and password required' }, 400);
  if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
  if (username !== null && !USERNAME_PATTERN.test(username)) {
    return json({ error: 'Username must be 3–32 chars, letters/numbers/._- only' }, 400);
  }

  const signupIp = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  if (!checkRateLimit(`signup:${signupIp}`, 5, 3600000)) {
    return json({ error: 'Too many signup attempts. Please try again later.' }, 429);
  }

  // Check if email already exists
  const existingEmail = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = lower(?)').bind(email).first();
  if (existingEmail) return json({ error: 'An account with this email already exists' }, 409);

  if (username) {
    const existingUsername = await env.DB.prepare('SELECT id FROM users WHERE lower(username) = lower(?)').bind(username).first();
    if (existingUsername) return json({ error: 'That username is already taken' }, 409);
  }

  const passwordHash = await hashPasswordPBKDF2(password);
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 32);

  await env.DB.prepare(
    'INSERT INTO users (id, email, username, name, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(id, email, username, name || '', passwordHash, 'user').run();

  // New users auto-join nothing — they must be invited to an account.
  // The empty memberships array is intentional; the frontend should show a
  // "waiting for invite" state until an account owner adds them.
  const memberships: AccountMembership[] = [];
  const token = await createToken(env.JWT_SECRET, {
    sub: id,
    email,
    role: 'user',
    name: name || '',
    username,
    memberships,
    active_account_id: null,
  });

  if (env.SENDER_EMAIL) {
    sendEmail(env, email, 'Welcome to Teajia', welcomeEmailHtml(name || 'there')).catch(() => {});
  }

  return json({
    token,
    user: { id, email, username, name: name || '', role: 'user' },
    memberships,
    active_account_id: null,
  }, 201);
};

const handleGetMe: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  // Sliding session — if the token is within 14 days of expiry, hand the
  // client a fresh one. The client picks this up automatically (see
  // `handleResponse` in src/lib/api.ts) so users never hit the 30-day wall
  // while they're actively using the app.
  const refreshedToken = await maybeIssueRefreshedToken(env, claims);

  // Try to fetch fresh user data from DB
  try {
    const user = await env.DB.prepare('SELECT id, email, username, name, role, phone, admin_request_status, created_at, can_create_collections FROM users WHERE id = ?').bind(claims.sub).first();
    if (user) {
      return json({ ...user, ...(refreshedToken ? { refreshed_token: refreshedToken } : {}) });
    }
  } catch {}

  // Fallback to token claims
  return json({
    id: claims.sub,
    email: claims.email,
    username: (claims as any).username ?? null,
    name: claims.name,
    role: claims.role,
    ...(refreshedToken ? { refreshed_token: refreshedToken } : {}),
  });
};

// POST /api/auth/refresh — issues a new token for the caller.
// Accepts a currently-valid token OR a recently-expired one (within the
// grace window). This lets a user reopen the app after a long break and
// silently get a new session without seeing a login screen. We don't issue
// tokens for users who no longer exist in the DB.
const handleRefreshToken: Handler = async (request, env) => {
  const token = isAuthed(request);
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const validNow = await verifyToken(token, env.JWT_SECRET);
  const validWithGrace = validNow || await verifyTokenAllowingGrace(token, env.JWT_SECRET);
  if (!validWithGrace) return json({ error: 'Invalid or expired token' }, 401);

  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  // Confirm the user still exists. If the user was deleted since the token
  // was issued we refuse the refresh instead of handing out a fresh token.
  let user: Record<string, unknown> | null = null;
  try {
    user = await env.DB.prepare(
      'SELECT id, email, username, name, role, platform_role FROM users WHERE id = ?'
    ).bind(claims.sub).first() as any;
  } catch {
    // If the users table is unavailable (e.g., early bootstrap), fall back
    // to claims so we at least don't kick out the dev admin.
  }

  const memberships = await loadMemberships(env, claims.sub);
  const activeAccountId = claims.active_account_id
    || memberships[0]?.account_id
    || null;

  const newToken = await createToken(env.JWT_SECRET, {
    sub: claims.sub,
    email: (user?.email as string) ?? claims.email,
    name: (user?.name as string) ?? claims.name,
    role: (user?.role as string) ?? claims.role ?? 'user',
    platform_role: (user?.platform_role as PlatformRole) ?? claims.platform_role ?? null,
    username: (user?.username as string | null) ?? (claims as any).username ?? null,
    memberships,
    active_account_id: activeAccountId,
  });

  return json({
    token: newToken,
    memberships,
    active_account_id: activeAccountId,
  });
};

// ── Change Password ──
const handleChangePassword: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  const { currentPassword, newPassword } = await request.json() as { currentPassword?: string; newPassword?: string };
  if (!currentPassword || !newPassword) return json({ error: 'Current and new password required' }, 400);
  if (newPassword.length < 6) return json({ error: 'New password must be at least 6 characters' }, 400);

  const user = await env.DB.prepare('SELECT id, password_hash FROM users WHERE id = ?').bind(claims.sub).first();
  if (!user) return json({ error: 'User not found' }, 404);

  const { verified: currentVerified } = await verifyPasswordHash(currentPassword, user.password_hash as string);
  if (!currentVerified) return json({ error: 'Current password is incorrect' }, 403);

  const newHash = await hashPasswordPBKDF2(newPassword);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, claims.sub).run();

  return json({ ok: true, message: 'Password changed successfully' });
};

// ── Delete Account ──
const handleDeleteAccount: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  const { password } = await request.json() as { password?: string };
  if (!password) return json({ error: 'Password required' }, 400);

  const user = await env.DB.prepare('SELECT id, password_hash, platform_role FROM users WHERE id = ?').bind(claims.sub).first();
  if (!user) return json({ error: 'User not found' }, 404);

  const { verified } = await verifyPasswordHash(password, user.password_hash as string);
  if (!verified) return json({ error: 'Incorrect password' }, 403);

  if ((user.platform_role as string) === 'owner') {
    return json({ error: 'Platform owner accounts cannot be deleted.' }, 403);
  }

  await env.DB.batch([
    env.DB.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').bind(claims.sub),
    env.DB.prepare('DELETE FROM account_members WHERE user_id = ?').bind(claims.sub),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(claims.sub),
  ]);

  return json({ ok: true });
};

// ── Verify Password (used by Transfer Ownership gate 3) ──
const handleVerifyPassword: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  const { password } = await request.json() as { password?: string };
  if (!password) return json({ error: 'Password required' }, 400);

  const user = await env.DB.prepare('SELECT id, password_hash FROM users WHERE id = ?').bind(claims.sub).first();
  if (!user) return json({ error: 'User not found' }, 404);

  const { verified: pwVerified } = await verifyPasswordHash(password, user.password_hash as string);
  if (!pwVerified) return json({ error: 'Incorrect password' }, 401);

  return json({ verified: true });
};

// ── Update Profile (name/email) ──
const handleUpdateProfile: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  const { name, email, username, phone } = await request.json() as { name?: string; email?: string; username?: string | null; phone?: string };

  if (email && email !== claims.email) {
    const existing = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?').bind(email, claims.sub).first();
    if (existing) return json({ error: 'Email already in use' }, 409);
  }

  // Normalize username: empty string → null (clear); trim otherwise.
  let normalizedUsername: string | null | undefined = undefined;
  if (username !== undefined) {
    const trimmed = (username ?? '').toString().trim();
    if (trimmed === '') {
      normalizedUsername = null;
    } else {
      if (!USERNAME_PATTERN.test(trimmed)) {
        return json({ error: 'Username must be 3–32 chars, letters/numbers/._- only' }, 400);
      }
      const existing = await env.DB.prepare('SELECT id FROM users WHERE lower(username) = lower(?) AND id != ?').bind(trimmed, claims.sub).first();
      if (existing) return json({ error: 'That username is already taken' }, 409);
      normalizedUsername = trimmed;
    }
  }

  const updates: string[] = [];
  const binds: any[] = [];
  if (name !== undefined) { updates.push('name = ?'); binds.push(name); }
  if (email !== undefined) { updates.push('email = ?'); binds.push(email); }
  if (normalizedUsername !== undefined) { updates.push('username = ?'); binds.push(normalizedUsername); }
  if (phone !== undefined) { updates.push('phone = ?'); binds.push(phone || null); }

  if (updates.length === 0) return json({ error: 'No fields to update' }, 400);

  binds.push(claims.sub);
  await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();

  const updatedUser = await env.DB.prepare('SELECT id, email, username, name, role, phone, admin_request_status, created_at FROM users WHERE id = ?').bind(claims.sub).first();

  // Issue fresh token with updated claims, preserving account context.
  const memberships = await loadMemberships(env, updatedUser!.id as string);
  const activeAccountId = (claims as TokenClaims).active_account_id
    || memberships[0]?.account_id
    || null;
  const newToken = await createToken(env.JWT_SECRET, {
    sub: updatedUser!.id as string,
    email: updatedUser!.email as string,
    role: updatedUser!.role as string,
    name: updatedUser!.name as string,
    username: (updatedUser!.username as string | null) ?? null,
    memberships,
    active_account_id: activeAccountId,
  });

  return json({ token: newToken, user: updatedUser });
};

// ── Request Admin Role ──
const handleRequestAdmin: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  if (claims.role === 'admin' || claims.role === 'owner') {
    return json({ error: 'You already have admin access' }, 400);
  }

  const user = await env.DB.prepare('SELECT id, admin_request_status FROM users WHERE id = ?').bind(claims.sub).first();
  if (!user) return json({ error: 'User not found' }, 404);
  if (user.admin_request_status === 'pending') return json({ error: 'Admin request already pending' }, 400);

  await env.DB.prepare(
    "UPDATE users SET admin_request_status = 'pending', admin_requested_at = datetime('now') WHERE id = ?"
  ).bind(claims.sub).run();

  return json({ ok: true, message: 'Admin access requested. An administrator will review your request.' });
};

// ── List All Users (admin/owner) ──
const handleListUsers: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const users = await env.DB.prepare(
    'SELECT id, email, username, name, role, admin_request_status, admin_requested_at, created_at FROM users ORDER BY created_at DESC'
  ).all();

  return json(users.results);
};

// ── Approve/Deny Admin Request (owner only) ──
const handleUpdateUserRole: Handler = async (request, env, params) => {
  const authErr = await requireOwner(request, env);
  if (authErr) return authErr;

  const userId = params.id;
  const { role, admin_request_status } = await request.json() as { role?: string; admin_request_status?: string };

  const user = await env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first();
  if (!user) return json({ error: 'User not found' }, 404);

  // Prevent changing owner role
  if (user.role === 'owner') return json({ error: 'Cannot modify owner account' }, 403);

  const updates: string[] = [];
  const binds: any[] = [];

  if (role && ['user', 'admin'].includes(role)) {
    updates.push('role = ?');
    binds.push(role);
  }
  if (admin_request_status && ['none', 'approved', 'denied'].includes(admin_request_status)) {
    updates.push('admin_request_status = ?');
    binds.push(admin_request_status);
  }

  if (updates.length === 0) return json({ error: 'No valid updates' }, 400);

  binds.push(userId);
  await env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();

  const updated = await env.DB.prepare(
    'SELECT id, email, username, name, role, admin_request_status, admin_requested_at, created_at FROM users WHERE id = ?'
  ).bind(userId).first();

  return json(updated);
};

// ── Delete User (owner only) ──
const handleDeleteUser: Handler = async (request, env, params) => {
  const authErr = await requireOwner(request, env);
  if (authErr) return authErr;

  const userId = params.id;
  const user = await env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first();
  if (!user) return json({ error: 'User not found' }, 404);
  if (user.role === 'owner') return json({ error: 'Cannot delete owner account' }, 403);

  await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return json({ ok: true });
};

// ── Generate Password Reset Token (admin/owner) ──
const handleCreateResetToken: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  const { userId } = await request.json() as { userId?: string };
  if (!userId) return json({ error: 'userId required' }, 400);

  const user = await env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(userId).first();
  if (!user) return json({ error: 'User not found' }, 404);

  // Generate a random reset token
  const resetToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 32);

  // Expires in 24 hours
  await env.DB.prepare(
    "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+24 hours'))"
  ).bind(id, userId, resetToken).run();

  return json({ token: resetToken, user: { id: user.id, email: user.email, name: user.name } });
};

// ── Forgot Password: Self-service reset token request (public) ──
// Creates a reset token for the given email and returns it directly.
// Note: Without an email delivery system, the token is returned in the response
// so the user can immediately set a new password. This is acceptable for a
// single-tenant internal tool. Do not expose to the public internet without
// adding email delivery + enumeration protections.
const handleForgotPassword: Handler = async (request, env) => {
  const { email } = await request.json() as { email?: string };
  if (!email) return json({ error: 'Email required' }, 400);

  const user = await env.DB.prepare(
    'SELECT id, email, name FROM users WHERE email = ?'
  ).bind(email).first();

  // Generic response shape whether or not the user exists
  if (!user) {
    return json({ ok: true, message: 'No account found with that email.' }, 404);
  }

  // Generate a random reset token (expires in 1 hour)
  const resetToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 32);

  await env.DB.prepare(
    "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+1 hour'))"
  ).bind(id, user.id, resetToken).run();

  // Try to email the reset link. When email succeeds we do NOT return the
  // token in the response (token belongs in the email only). When email
  // delivery is not configured or the send fails, we return the token so the
  // single-tenant in-app recovery flow still works — and surface
  // email_sent: false so the UI can show "couldn't send the email".
  const origin = new URL(request.url).origin;
  const resetUrl = `${origin}/reset-password?token=${resetToken}`;
  const emailSent = await sendEmail(
    env,
    user.email as string,
    'Reset your Teajia password',
    `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#3a2e24">
      <h2 style="font-size:20px;margin-bottom:8px">Reset your password</h2>
      <p style="color:#7a6a56;margin-bottom:24px;line-height:1.6">We received a request to reset the password on your Teajia account. Click the link below within the next hour to choose a new password.</p>
      <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#a8874d;color:#fefaf3;text-decoration:none;font-size:13px;letter-spacing:0.08em">Reset password</a>
      <p style="color:#9a8672;font-size:12px;margin-top:24px;line-height:1.6">If you didn't request this, you can safely ignore this email.</p>
    </div>`
  );

  if (emailSent) {
    return json({
      ok: true,
      email_sent: true,
      message: 'Check your email for a link to reset your password.',
    });
  }

  return json({
    ok: true,
    email_sent: false,
    token: resetToken,
    message: 'Reset token generated. Use it within the next hour to set a new password.',
  });
};

// ── Reset Password with Token (public) ──
const handleResetPassword: Handler = async (request, env) => {
  const { token, newPassword } = await request.json() as { token?: string; newPassword?: string };
  if (!token || !newPassword) return json({ error: 'Token and new password required' }, 400);
  if (newPassword.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);

  const resetRecord = await env.DB.prepare(
    "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 AND expires_at > datetime('now')"
  ).bind(token).first();

  if (!resetRecord) return json({ error: 'Invalid or expired reset token' }, 400);

  const newHash = await hashPasswordPBKDF2(newPassword);
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, resetRecord.user_id),
    env.DB.prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?').bind(resetRecord.id),
  ]);

  return json({ ok: true, message: 'Password has been reset successfully. You can now sign in.' });
};

// ── Google OAuth ──
const handleGoogleAuth: Handler = async (request, env) => {
  if (!env.GOOGLE_CLIENT_ID) return json({ error: 'Google OAuth not configured' }, 503);
  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/auth/google/callback`;
  const state = await signOAuthState(env.JWT_SECRET);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
};

const handleGoogleCallback: Handler = async (request, env) => {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) return Response.redirect(`${origin}/admin?oauth_error=${encodeURIComponent(errorParam)}`, 302);
  if (!code || !state) return Response.redirect(`${origin}/admin?oauth_error=missing_params`, 302);
  if (!await verifyOAuthState(state, env.JWT_SECRET)) return Response.redirect(`${origin}/admin?oauth_error=invalid_state`, 302);

  const redirectUri = `${origin}/api/auth/google/callback`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID!,
      client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) return Response.redirect(`${origin}/admin?oauth_error=token_exchange_failed`, 302);

  const { access_token } = await tokenRes.json() as { access_token: string };

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userInfoRes.ok) return Response.redirect(`${origin}/admin?oauth_error=userinfo_failed`, 302);

  const gUser = await userInfoRes.json() as { id: string; email: string; name: string };

  // Find by google_id first; fall back to email to link existing accounts
  let user = await env.DB.prepare('SELECT * FROM users WHERE google_id = ? LIMIT 1').bind(gUser.id).first() as any;
  if (!user) {
    user = await env.DB.prepare('SELECT * FROM users WHERE lower(email) = lower(?) LIMIT 1').bind(gUser.email).first() as any;
    if (user) {
      await env.DB.prepare('UPDATE users SET google_id = ? WHERE id = ?').bind(gUser.id, user.id).run();
    }
  }
  if (!user) {
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    await env.DB.prepare(
      'INSERT INTO users (id, email, username, name, password_hash, role, google_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, gUser.email, null, gUser.name, '', 'user', gUser.id).run();
    user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first() as any;
  }
  if (!user) return Response.redirect(`${origin}/admin?oauth_error=account_error`, 302);

  const memberships = await loadMemberships(env, user.id as string);
  const activeAccountId = memberships[0]?.account_id || null;
  const token = await createToken(env.JWT_SECRET, {
    sub: user.id as string,
    email: user.email as string,
    role: user.role as string,
    platform_role: (user.platform_role as PlatformRole) ?? null,
    name: user.name as string,
    username: (user.username as string | null) ?? null,
    memberships,
    active_account_id: activeAccountId,
  });

  return Response.redirect(`${origin}/admin#oauth_token=${token}`, 302);
};

const handleGetProducts: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  // Batch rates + products in a single D1 round-trip.
  // is_featured is derived from active shop-published Collections so the column
  // value (legacy) is never used for reads. The EXISTS subquery returns 1/0
  // which the client maps to isFeatured via the normal snake->camel transform.
  const [ratesResult, result] = await env.DB.batch([
    env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates'),
    env.DB.prepare(`SELECT p.*,
      (SELECT COUNT(*) > 0 FROM collection_items ci
         JOIN collections c ON c.id = ci.collection_id
         JOIN collection_publications cp ON cp.collection_id = c.id
        WHERE ci.product_id = p.id
          AND cp.target_type = 'shop'
          AND cp.unpublished_at IS NULL) AS is_featured_derived
      FROM products p
      WHERE p.account_id = ?
      ORDER BY p.created_at DESC`).bind(accountId),
  ]);
  const rates = new Map<string, number>();
  for (const r of ratesResult.results as any[]) {
    rates.set(r.currency as string, r.rate_to_usd as number);
  }

  const products = (result.results as any[]).map(p => {
    // Override the legacy is_featured column with the derived shop-collection
    // membership value. The DB column is no longer authoritative.
    p.is_featured = p.is_featured_derived ? 1 : 0;
    delete p.is_featured_derived;

    // Parse JSON array fields
    if (typeof p.tasting_notes === 'string') {
      try { p.tasting_notes = JSON.parse(p.tasting_notes); } catch { p.tasting_notes = []; }
    }
    if (typeof p.additional_images === 'string') {
      try { p.additional_images = JSON.parse(p.additional_images); } catch { p.additional_images = []; }
    }
    if (typeof p.tasting === 'string') {
      try { p.tasting = JSON.parse(p.tasting); } catch { p.tasting = {}; }
    }
    if (typeof p.mood_tags === 'string') {
      try { p.mood_tags = JSON.parse(p.mood_tags); } catch { p.mood_tags = []; }
    }
    if (typeof p.flavor_tags === 'string') {
      try { p.flavor_tags = JSON.parse(p.flavor_tags); } catch { p.flavor_tags = []; }
    }
    return addPricingFields(p, rates);
  });
  return json(products);
};

// Public-safe fields whitelist
const PUBLIC_FIELDS = [
  'id', 'type', 'given_name', 'chinese_name', 'product_name', 'year',
  'origin_country', 'origin_region', 'retail_price_per_gram_usd',
  'fixed_retail_price_usd', 'stock_grams', 'description', 'tasting_notes',
  'image_url', 'additional_images', 'status', 'is_personal', 'can_reorder', 'is_featured', 'is_curated',
  'lore', 'show_wisdom', 'processing_notes', 'terroir', 'mood', 'experience',
  'material', 'capacity_ml', 'teaware_category', 'quantity_units', 'tasting', 'tasting_source',
  'mood_tags', 'flavor_tags',
] as const;

// Legacy alias: resolves to Adrian's Bali store. New callers should use
// /api/s/teajia-bali/products.
const handleGetPublicProducts: Handler = async (_request, env) => {
  const products = await fetchPublicProductsForAccount(env, BALI_ACCOUNT_ID);
  return cachedJson(products, 60);
};

// GET /api/venues/public — publicly readable tea spaces for SpacesPage
const handleGetPublicVenues: Handler = async (_request, env) => {
  try {
    const [venuesResult, spacesResult] = await Promise.all([
      env.DB.prepare(
        'SELECT id, name, area_hint FROM venues WHERE account_id = ? ORDER BY name ASC'
      ).bind(BALI_ACCOUNT_ID).all(),
      env.DB.prepare(
        'SELECT id, venue_id, name, description FROM venue_spaces WHERE account_id = ? ORDER BY sort_order ASC, name ASC'
      ).bind(BALI_ACCOUNT_ID).all(),
    ]);

    const spacesByVenue = new Map<string, any[]>();
    for (const s of spacesResult.results as any[]) {
      if (!spacesByVenue.has(s.venue_id)) spacesByVenue.set(s.venue_id, []);
      spacesByVenue.get(s.venue_id)!.push(s);
    }

    const result = (venuesResult.results as any[]).flatMap(v => {
      const vspaces = spacesByVenue.get(v.id) || [];
      if (vspaces.length === 0) {
        return [{ id: v.id, name: v.name, description: null, location: v.area_hint, type: 'Tea Space', status: 'active', isPrivate: true }];
      }
      return vspaces.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description || null,
        location: v.area_hint,
        type: 'Private Tea Room',
        status: 'active',
        isPrivate: true,
      }));
    });

    return cachedJson(result, 300);
  } catch {
    return json([]);
  }
};

// ── Auto-resolve vendor name → vendor_id (find-or-create customer, account-scoped) ──
async function resolveVendorId(
  env: Env,
  vendorName: string | null | undefined,
  originCountry: string | undefined,
  accountId: string
): Promise<string | null> {
  if (!vendorName || !vendorName.trim()) return null;
  const name = vendorName.trim();
  const key = name.toLowerCase();

  // Check if a customer with this name already exists in this account
  const existing = await env.DB.prepare(
    'SELECT id, tags FROM customers WHERE LOWER(name) = ? AND account_id = ?'
  ).bind(key, accountId).first();

  if (existing) {
    // Ensure the vendor tag is present
    let tags: string[] = [];
    try { tags = JSON.parse(existing.tags as string || '[]'); } catch { tags = []; }
    if (!tags.includes('vendor')) {
      tags.push('vendor');
      await env.DB.prepare("UPDATE customers SET tags = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(JSON.stringify(tags), existing.id).run();
    }
    return existing.id as string;
  }

  // Create new customer tagged as vendor, scoped to this account
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO customers (id, account_id, name, country, tags, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, '["vendor"]', 'auto-linked from inventory', datetime('now'), datetime('now'))`
  ).bind(id, accountId, name, originCountry || null).run();

  return id;
}

const handleCreateProduct: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;

  // Basic validation
  const { product_name, year } = body;
  if (!product_name?.trim()) return new Response(JSON.stringify({ error: 'product_name is required' }), { status: 400 });
  if (year && (!/^\d{4}$/.test(String(year)) || Number(year) < 1900 || Number(year) > 2100)) {
    return new Response(JSON.stringify({ error: 'year must be a 4-digit number' }), { status: 400 });
  }
  // validate numeric fields are non-negative
  for (const field of ['price', 'cost', 'stock']) {
    if (body[field] !== undefined && Number(body[field]) < 0) {
      return new Response(JSON.stringify({ error: `${field} cannot be negative` }), { status: 400 });
    }
  }

  // Strip any client-supplied account_id — we force the current account.
  delete body.account_id;
  // Set quantity_purchased: use quantity_units for teaware, stock_grams for tea
  if (body.quantity_purchased == null) {
    body.quantity_purchased = body.type === 'Teaware'
      ? (body.quantity_units || 1)
      : (body.stock_grams || 0);
  }
  // Convert tasting_notes array to JSON string
  if (Array.isArray(body.tasting_notes)) body.tasting_notes = JSON.stringify(body.tasting_notes);
  if (Array.isArray(body.additional_images)) body.additional_images = JSON.stringify(body.additional_images);
  // Admin-created products with tasting data default to owner-authored unless
  // the caller explicitly says otherwise.
  // TODO(second-writer): see handleUpdateProduct for the upgrade path.
  if ('tasting' in body && body.tasting_source === undefined) {
    body.tasting_source = body.tasting && Object.keys(body.tasting).length > 0 ? 'owner' : null;
  }
  if (body.tasting && typeof body.tasting === 'object') body.tasting = JSON.stringify(body.tasting);
  // Convert booleans to integers for SQLite
  for (const key of ['is_personal', 'can_reorder', 'is_public', 'is_featured', 'is_curated', 'is_custom_wisdom', 'show_wisdom', 'is_sample', 'in_transit']) {
    if (body[key] !== undefined) body[key] = body[key] ? 1 : 0;
  }

  // Auto-resolve vendor → vendor_id (scoped to the active account)
  if (body.vendor && !body.vendor_id) {
    body.vendor_id = await resolveVendorId(env, body.vendor, body.origin_country, accountId);
  }

  body.account_id = accountId;
  const id = crypto.randomUUID();
  const cols = Object.keys(body);
  const placeholders = cols.map(() => '?').join(', ');
  const insertProduct = env.DB.prepare(`INSERT INTO products (id, ${cols.join(', ')}) VALUES (?, ${placeholders})`)
    .bind(id, ...cols.map(c => body[c] ?? null));

  // Mirror: create the profile + listing pair alongside the legacy product row
  // so partner catalog browse reflects the new tea immediately.
  const mirrorInserts = buildProductMirrorInserts(env, id, accountId, body);

  if (mirrorInserts.length > 0) {
    await env.DB.batch([insertProduct, ...mirrorInserts]);
  } else {
    await insertProduct.run();
  }

  // Write PURCHASE_RECEIPT ledger entry if product has initial stock
  const initialStock = Number(body.stock_grams) || 0;
  if (initialStock > 0) {
    await buildStockLedgerEntry(
      env, id, initialStock, initialStock, 'PURCHASE_RECEIPT',
      null, null, null, 'Initial stock from Tea Compass purchase', accountId
    ).run();
  }

  await auditPlatformActingWrite(env, ctx, 'product.created', 'product', id, {
    product_name: body.product_name, year: body.year ?? null,
  });

  return json({ id }, 201);
};

const handleBulkCreateProducts: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'catalog');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const { products } = await request.json() as { products: Record<string, any>[] };

  if (!Array.isArray(products) || products.length > 100) {
    return new Response(JSON.stringify({ error: 'Bulk create limited to 100 products per request' }), { status: 400 });
  }

  // Pre-resolve all vendor names to vendor_ids (batch for efficiency, scoped)
  const vendorCache: Record<string, string> = {};
  for (const raw of products) {
    if (raw.vendor && !raw.vendor_id) {
      const key = (raw.vendor as string).trim().toLowerCase();
      if (!vendorCache[key]) {
        const vid = await resolveVendorId(env, raw.vendor as string, raw.origin_country as string, accountId);
        if (vid) vendorCache[key] = vid;
      }
    }
  }

  // Duplicate check: fetch existing products for THIS account
  const existingProducts = await env.DB.prepare(
    'SELECT id, product_name, given_name, chinese_name, type FROM products WHERE account_id = ?'
  ).bind(accountId).all();
  const existingSet = new Set(
    (existingProducts.results as any[]).map(p => {
      const name = ((p.product_name || p.given_name || '') as string).toLowerCase().trim();
      const type = ((p.type || '') as string).toLowerCase().trim();
      return `${type}::${name}`;
    })
  );

  const toInsert: any[] = [];
  const skipped: string[] = [];

  for (const raw of products) {
    // Strip null/undefined/empty-string keys so we only INSERT columns with actual values
    const body: Record<string, any> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v !== null && v !== undefined && v !== '') body[k] = v;
    }
    // Never let clients cross accounts.
    delete body.account_id;
    body.account_id = accountId;

    // Check for duplicate by type + product_name or given_name
    const name = ((body.product_name || body.given_name || '') as string).toLowerCase().trim();
    const type = ((body.type || '') as string).toLowerCase().trim();
    const key = `${type}::${name}`;
    if (name && existingSet.has(key)) {
      skipped.push(body.product_name || body.given_name || 'unknown');
      continue;
    }
    existingSet.add(key); // Prevent duplicates within the same batch

    if (body.quantity_purchased == null) {
      body.quantity_purchased = body.type === 'Teaware'
        ? (body.quantity_units || 1)
        : (body.stock_grams || 0);
    }
    if (Array.isArray(body.tasting_notes)) body.tasting_notes = JSON.stringify(body.tasting_notes);
    if (Array.isArray(body.additional_images)) body.additional_images = JSON.stringify(body.additional_images);
    if (body.tasting && typeof body.tasting === 'object') body.tasting = JSON.stringify(body.tasting);
    for (const boolKey of ['is_personal', 'can_reorder', 'is_public', 'is_featured', 'is_curated', 'is_custom_wisdom', 'show_wisdom', 'is_sample', 'in_transit']) {
      if (body[boolKey] !== undefined) body[boolKey] = body[boolKey] ? 1 : 0;
    }
    // Apply cached vendor_id
    if (body.vendor && !body.vendor_id) {
      const vkey = (body.vendor as string).trim().toLowerCase();
      if (vendorCache[vkey]) body.vendor_id = vendorCache[vkey];
    }
    const id = crypto.randomUUID();
    const cols = Object.keys(body);
    const placeholders = cols.map(() => '?').join(', ');
    toInsert.push(
      env.DB.prepare(`INSERT INTO products (id, ${cols.join(', ')}) VALUES (?, ${placeholders})`)
        .bind(id, ...cols.map(c => body[c] ?? null))
    );
  }

  for (let i = 0; i < toInsert.length; i += 100) {
    await env.DB.batch(toInsert.slice(i, i + 100));
  }

  return json({ inserted: toInsert.length, skipped: skipped.length, skippedNames: skipped });
};

const handleUpdateProduct: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const userEmail = getUserEmail(request);
  const body = await request.json() as Record<string, any>;
  delete body.account_id;
  if (Array.isArray(body.tasting_notes)) body.tasting_notes = JSON.stringify(body.tasting_notes);
  if (Array.isArray(body.additional_images)) body.additional_images = JSON.stringify(body.additional_images);
  if (Array.isArray(body.mood_tags)) body.mood_tags = JSON.stringify(body.mood_tags);
  if (Array.isArray(body.flavor_tags)) body.flavor_tags = JSON.stringify(body.flavor_tags);
  // Any admin-authenticated write that mutates the tasting profile is, by
  // default, the owner's voice. Explicit callers (community aggregation,
  // seed scripts) can override by passing tasting_source themselves.
  //
  // TODO(second-writer): when a non-owner path starts writing tasting (e.g.
  // community aggregation sync), switch this to read-then-write: fetch the
  // current row's tasting_source and preserve it instead of defaulting to
  // 'owner'. Until then every write that omits tasting_source gets stamped
  // owner, which is correct while Adrian is the only writer.
  if ('tasting' in body && body.tasting_source === undefined) {
    body.tasting_source = body.tasting && Object.keys(body.tasting).length > 0 ? 'owner' : null;
  }
  if (body.tasting && typeof body.tasting === 'object') body.tasting = JSON.stringify(body.tasting);
  for (const key of ['is_personal', 'can_reorder', 'is_public', 'is_featured', 'is_curated', 'is_custom_wisdom', 'show_wisdom', 'is_sample', 'in_transit']) {
    if (body[key] !== undefined) body[key] = body[key] ? 1 : 0;
  }

  // Auto-resolve vendor → vendor_id
  if (body.vendor !== undefined && !body.vendor_id) {
    body.vendor_id = await resolveVendorId(env, body.vendor, body.origin_country, accountId);
  }

  // Stock change logging — scoped lookup
  const extraStmts: D1PreparedStatement[] = [];
  if (body.stock_grams !== undefined) {
    const current = await env.DB.prepare(
      'SELECT stock_grams, low_stock_threshold, given_name, product_name, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
    ).bind(params.id, accountId).first();
    if (current) {
      const oldStock = Number(current.stock_grams) || 0;
      const newStock = Number(body.stock_grams);
      const delta = newStock - oldStock;
      const threshold = Number(current.low_stock_threshold) || 0;
      if (delta !== 0) {
        const name = (current.given_name || current.product_name || params.id) as string;
        extraStmts.push(buildStockLedgerEntry(env, params.id, delta, newStock, 'MANUAL_ADJUST', userEmail, null, null, `Manual: ${oldStock}→${newStock}`, accountId));
        extraStmts.push(buildActivityLog(env, 'STOCK_ADJUSTED', `${name}: ${oldStock}g → ${newStock}g (${delta > 0 ? '+' : ''}${delta}g)`, userEmail, 'product', params.id, accountId));
        // Low-stock alert when stock transitions below the threshold
        if (threshold > 0 && newStock < threshold && oldStock >= threshold) {
          extraStmts.push(buildActivityLog(
            env, 'low_stock_alert',
            JSON.stringify({ productName: name, stockGrams: newStock, threshold }),
            userEmail, 'product', params.id, accountId
          ));
        }
        // Sync compass entry status on stock transitions
        if (current.source_compass_entry_id) {
          if (newStock <= 0 && oldStock > 0) {
            extraStmts.push(
              env.DB.prepare("UPDATE tea_compass_entries SET status = 'depleted', updated_at = datetime('now') WHERE id = ? AND status = 'in_stock'")
                .bind(current.source_compass_entry_id)
            );
          } else if (newStock > 0 && oldStock <= 0) {
            extraStmts.push(
              env.DB.prepare("UPDATE tea_compass_entries SET status = 'in_stock', updated_at = datetime('now') WHERE id = ? AND status = 'depleted'")
                .bind(current.source_compass_entry_id)
            );
          }
        }
      }
    } else {
      return json({ error: 'Product not found' }, 404);
    }
  }

  const ALLOWED_UPDATE_COLUMNS = new Set([
    'product_name', 'type', 'origin', 'year', 'harvest', 'form', 'price', 'cost',
    'stock', 'stock_unit', 'status', 'description', 'notes', 'tags', 'moods',
    'tasting_notes', 'brewing_notes', 'vendor', 'vendor_url', 'image_url',
    'altitude', 'cultivar', 'processing', 'format',
    // Extended product fields
    'given_name', 'chinese_name', 'origin_country', 'origin_region', 'stock_grams',
    'cost_amount', 'cost_currency', 'shipping_rate_per_kg', 'quantity_purchased',
    'low_stock_threshold', 'recheck_stock', 'markup_multiplier', 'fixed_retail_price_usd',
    'is_personal', 'can_reorder', 'is_public', 'is_featured', 'is_curated',
    'lore', 'is_custom_wisdom', 'show_wisdom', 'processing_notes', 'terroir',
    'mood', 'experience', 'material', 'capacity_ml', 'teaware_category',
    'additional_images', 'quantity_units', 'vendor_id', 'is_sample', 'in_transit',
    'in_transit_grams', 'in_transit_eta',
    'tasting', 'tasting_source',
    'sold_out_at', 'stock_verified_at', 'source_compass_entry_id',
    'updated_at', 'last_synced_at', 'tea_key', 'vendor_url',
    'wholesale_price', 'catalog_visible', 'price_per_gram_usd',
    'session_reserve_grams',
    'mood_tags', 'flavor_tags',
  ]);
  const cols = Object.keys(body).filter(k => ALLOWED_UPDATE_COLUMNS.has(k));
  if (cols.length === 0) return json({ success: true });
  const sets = cols.map(c => `${c} = ?`).join(', ');
  const updateStmt = env.DB.prepare(`UPDATE products SET ${sets} WHERE id = ? AND account_id = ?`)
    .bind(...cols.map(c => body[c] ?? null), params.id, accountId);

  // Mirror writes to tea_profiles + product_listings so partner catalog browse
  // and network views never see stale canonical data. No-op for teaware (no
  // profile/listing exists) since the UPDATE WHERE clauses won't match.
  const mirrorStmts = buildProductMirrorStmts(env, params.id, body);

  const allStmts = [updateStmt, ...extraStmts, ...mirrorStmts];
  if (allStmts.length > 1) {
    await env.DB.batch(allStmts);
  } else {
    await updateStmt.run();
  }

  await auditPlatformActingWrite(env, ctx, 'product.updated', 'product', params.id, {
    fields: Object.keys(body).slice(0, 20),
  });

  return json({ success: true });
};

const handleDeleteProduct: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  await env.DB.prepare('DELETE FROM products WHERE id = ? AND account_id = ?')
    .bind(params.id, accountId).run();

  await auditPlatformActingWrite(env, ctx, 'product.deleted', 'product', params.id, {});

  return json({ success: true });
};

const handleGetCatalog: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const tierRow = await env.DB.prepare('SELECT trust_tier FROM accounts WHERE id = ?').bind(accountId).first();
  const trust_tier = (tierRow?.trust_tier as string) || 'basic';

  const platformRow = await env.DB.prepare('SELECT id, whatsapp_number FROM accounts WHERE is_platform_owner = 1 LIMIT 1').first();
  if (!platformRow) return json({ error: 'Platform account not configured' }, 500);
  const platformId = platformRow.id as string;
  const platformWhatsapp = (platformRow.whatsapp_number as string) || null;

  if (accountId === platformId) return json({ error: 'Platform account uses inventory directly' }, 403);

  const result = await env.DB.prepare(
    `SELECT p.id, p.type, p.form, p.given_name, p.chinese_name, p.product_name, p.year,
            p.origin_country, p.origin_region,
            p.description, p.tasting_notes, p.image_url, p.additional_images, p.lore,
            p.show_wisdom, p.processing_notes, p.terroir, p.mood, p.experience,
            p.tea_key, p.tasting, p.status, p.is_curated, p.material,
            p.capacity_ml, p.teaware_category, p.quantity_units, p.stock_grams, p.wholesale_price,
            (SELECT COUNT(*) > 0 FROM collection_items ci
               JOIN collections c ON c.id = ci.collection_id
               JOIN collection_publications cp ON cp.collection_id = c.id
              WHERE ci.product_id = p.id
                AND cp.target_type = 'shop'
                AND cp.unpublished_at IS NULL) AS is_featured
     FROM products p
     WHERE p.account_id = ? AND p.catalog_visible = 1 AND p.status != 'Archived'
     ORDER BY p.type, p.given_name`
  ).bind(platformId).all();

  const products = (result.results as any[]).map(p => {
    if (typeof p.tasting_notes === 'string') {
      try { p.tasting_notes = JSON.parse(p.tasting_notes); } catch { p.tasting_notes = []; }
    }
    if (typeof p.additional_images === 'string') {
      try { p.additional_images = JSON.parse(p.additional_images); } catch { p.additional_images = []; }
    }
    if (typeof p.tasting === 'string') {
      try { p.tasting = JSON.parse(p.tasting); } catch { p.tasting = {}; }
    }

    const out: Record<string, any> = {
      id: p.id, type: p.type, form: p.form, given_name: p.given_name, chinese_name: p.chinese_name,
      product_name: p.product_name, year: p.year, origin_country: p.origin_country,
      origin_region: p.origin_region, description: p.description, tasting_notes: p.tasting_notes,
      image_url: p.image_url, additional_images: p.additional_images, lore: p.lore,
      show_wisdom: p.show_wisdom, processing_notes: p.processing_notes, terroir: p.terroir,
      mood: p.mood, experience: p.experience, tea_key: p.tea_key, tasting: p.tasting,
      status: p.status, is_featured: p.is_featured, is_curated: p.is_curated,
      material: p.material, capacity_ml: p.capacity_ml, teaware_category: p.teaware_category,
      quantity_units: p.quantity_units,
      is_available: (p.stock_grams || 0) > 0,
    };
    if (trust_tier === 'verified' || trust_tier === 'partner') {
      out.wholesale_price = p.wholesale_price;
    }
    return out;
  });

  return json({ products, trust_tier, platform_whatsapp: platformWhatsapp });
};

// ── Product Events (cross-link: which events featured this product) ──
// Public endpoint: auth is optional. Authenticated users see their account's
// events; unauthenticated users (public shop) fall back to the Bali account.
const handleGetProductEvents: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  const accountId = 'error' in ctx ? BALI_ACCOUNT_ID : ctx.accountId;

  const result = await env.DB.prepare(
    `SELECT e.id, e.slug, e.title, e.subtitle, e.event_date, e.event_end_date,
            e.location_name, e.status, e.flyer_image_url,
            etm.custom_name, etm.brew_order
     FROM event_tea_menu etm
     JOIN events e ON e.id = etm.event_id
     WHERE etm.product_id = ? AND e.account_id = ?
     ORDER BY e.event_date DESC`
  ).bind(params.id, accountId).all();

  return json(result.results);
};

// ── Exchange Rates ──
const handleGetRates: Handler = async (_request, env) => {
  const result = await env.DB.prepare('SELECT * FROM exchange_rates').all();
  return cachedJson(result.results, 3600);
};

// Normalise and validate a currency code. Codes are case-sensitive in this
// schema (e.g. 'NT', 'Yuan', 'USD'); we trim only and reject empty/oversize.
function validateCurrencyCode(raw: unknown): { ok: true; code: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'currency must be a string' };
  const code = raw.trim();
  if (!code) return { ok: false, error: 'currency is required' };
  if (code.length > 12) return { ok: false, error: 'currency code too long (max 12 chars)' };
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(code)) {
    return { ok: false, error: 'currency must be alphanumeric and start with a letter' };
  }
  return { ok: true, code };
}

function validateRate(raw: unknown): { ok: true; rate: number } | { ok: false; error: string } {
  const n = typeof raw === 'string' ? Number(raw) : (typeof raw === 'number' ? raw : NaN);
  if (!Number.isFinite(n)) return { ok: false, error: 'rate_to_usd must be a finite number' };
  if (n <= 0) return { ok: false, error: 'rate_to_usd must be greater than 0' };
  return { ok: true, rate: n };
}

// Count rows referencing a given currency across the main scoped tables. Used
// to gate deletion (in-use check) and to surface usage in the admin panel.
async function countCurrencyUsage(env: Env, code: string): Promise<number> {
  const queries = [
    'SELECT COUNT(*) as c FROM products WHERE cost_currency = ?',
    'SELECT COUNT(*) as c FROM customers WHERE preferred_currency = ?',
    'SELECT COUNT(*) as c FROM invoices WHERE display_currency = ?',
  ];
  let total = 0;
  for (const q of queries) {
    try {
      const row = await env.DB.prepare(q).bind(code).first();
      const c = (row as any)?.c;
      if (typeof c === 'number') total += c;
    } catch {
      // Table or column may not exist in older schemas; ignore.
    }
  }
  return total;
}

// GET /api/platform/exchange-rates — list with usage counts (Platform tier)
const handlePlatformListExchangeRates: Handler = async (request, env) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const result = await env.DB.prepare(
    'SELECT currency, rate_to_usd, last_updated FROM exchange_rates ORDER BY currency ASC'
  ).all();

  const rows = (result.results as any[]) || [];
  const enriched = await Promise.all(rows.map(async r => ({
    currency: r.currency,
    rate_to_usd: Number(r.rate_to_usd),
    last_updated: r.last_updated,
    usage_count: await countCurrencyUsage(env, r.currency as string),
  })));

  return json({ rates: enriched });
};

// POST /api/platform/exchange-rates — create a new currency (Platform tier)
const handlePlatformCreateExchangeRate: Handler = async (request, env) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const body = await request.json() as { currency?: unknown; rate_to_usd?: unknown };

  const codeCheck = validateCurrencyCode(body.currency);
  if (!codeCheck.ok) return json({ error: codeCheck.error }, 400);
  const rateCheck = validateRate(body.rate_to_usd);
  if (!rateCheck.ok) return json({ error: rateCheck.error }, 400);

  const existing = await env.DB.prepare('SELECT currency FROM exchange_rates WHERE currency = ?')
    .bind(codeCheck.code).first();
  if (existing) return json({ error: 'Currency already exists' }, 409);

  await env.DB.prepare(
    "INSERT INTO exchange_rates (currency, rate_to_usd, last_updated) VALUES (?, ?, datetime('now'))"
  ).bind(codeCheck.code, rateCheck.rate).run();

  await logPlatformAction(env, 'exchange_rate.created', claims.sub, claims.email,
    'exchange_rate', codeCheck.code, { rate_to_usd: rateCheck.rate });

  return json({ success: true, currency: codeCheck.code, rate_to_usd: rateCheck.rate });
};

// PUT /api/platform/exchange-rates/:currency — update an existing rate (Platform tier)
const handlePlatformUpdateExchangeRate: Handler = async (request, env, params) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const codeCheck = validateCurrencyCode(params.currency);
  if (!codeCheck.ok) return json({ error: codeCheck.error }, 400);

  const body = await request.json() as { rate_to_usd?: unknown };
  const rateCheck = validateRate(body.rate_to_usd);
  if (!rateCheck.ok) return json({ error: rateCheck.error }, 400);

  const existing = await env.DB.prepare('SELECT rate_to_usd FROM exchange_rates WHERE currency = ?')
    .bind(codeCheck.code).first();
  if (!existing) return json({ error: 'Currency not found' }, 404);
  const previousRate = Number((existing as any).rate_to_usd);

  await env.DB.prepare(
    "UPDATE exchange_rates SET rate_to_usd = ?, last_updated = datetime('now') WHERE currency = ?"
  ).bind(rateCheck.rate, codeCheck.code).run();

  await logPlatformAction(env, 'exchange_rate.updated', claims.sub, claims.email,
    'exchange_rate', codeCheck.code, { from: previousRate, to: rateCheck.rate });

  return json({ success: true, currency: codeCheck.code, rate_to_usd: rateCheck.rate });
};

// DELETE /api/platform/exchange-rates/:currency — delete if unused (Platform tier)
const handlePlatformDeleteExchangeRate: Handler = async (request, env, params) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const codeCheck = validateCurrencyCode(params.currency);
  if (!codeCheck.ok) return json({ error: codeCheck.error }, 400);

  if (codeCheck.code === 'USD') {
    return json({ error: 'USD is the base currency and cannot be deleted' }, 400);
  }

  const existing = await env.DB.prepare('SELECT currency FROM exchange_rates WHERE currency = ?')
    .bind(codeCheck.code).first();
  if (!existing) return json({ error: 'Currency not found' }, 404);

  const usage = await countCurrencyUsage(env, codeCheck.code);
  if (usage > 0) {
    return json({
      error: 'Currency is in use and cannot be deleted',
      usage_count: usage,
    }, 409);
  }

  await env.DB.prepare('DELETE FROM exchange_rates WHERE currency = ?').bind(codeCheck.code).run();

  await logPlatformAction(env, 'exchange_rate.deleted', claims.sub, claims.email,
    'exchange_rate', codeCheck.code, {});

  return json({ success: true });
};

// ── Invoices ──
const handleGetInvoices: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const includeDeleted = url.searchParams.get('include_deleted') === '1';

  const whereClause = includeDeleted
    ? 'WHERE i.account_id = ?'
    : 'WHERE i.account_id = ? AND i.deleted_at IS NULL';
  const result = await env.DB.prepare(
    `SELECT i.*, COALESCE(t.line_total, 0) as computed_total,
       ev.title as source_event_title, ev.slug as source_event_slug
     FROM invoices i
     LEFT JOIN (
       SELECT invoice_id, SUM(quantity * price_at_sale) as line_total
       FROM invoice_line_items GROUP BY invoice_id
     ) t ON t.invoice_id = i.id
     LEFT JOIN events ev ON ev.id = i.source_event_id
     ${whereClause}
     ORDER BY i.created_at DESC LIMIT ? OFFSET ?`
  ).bind(accountId, limit, offset).all();
  return json(result.results);
};

// Apply the active account's invoice_prefix (e.g. "TJB-", "TJA-") when the
// caller didn't supply their own prefix. Leaves explicit values alone so
// clients can still override.
async function prefixInvoiceNumber(env: Env, accountId: string, raw: string): Promise<string> {
  if (!raw) return raw;
  try {
    const acc = await env.DB.prepare('SELECT invoice_prefix FROM accounts WHERE id = ?')
      .bind(accountId).first();
    const prefix = (acc?.invoice_prefix as string) || '';
    if (prefix && !raw.startsWith(prefix)) return `${prefix}-${raw}`;
  } catch {}
  return raw;
}

const handleCreateInvoice: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const userEmail = getUserEmail(request);
  const body = await request.json() as { invoice: Record<string, any>; lineItems: Record<string, any>[] };
  const id = crypto.randomUUID();

  const seqRow = await env.DB.prepare(
    'UPDATE accounts SET invoice_seq = invoice_seq + 1 WHERE id = ? RETURNING invoice_seq, invoice_prefix'
  ).bind(accountId).first() as { invoice_seq: number; invoice_prefix: string | null } | null;
  const seq = seqRow?.invoice_seq ?? 1;
  const pfx = seqRow?.invoice_prefix || '';
  const invoiceNumber = pfx ? `${pfx}-${String(seq).padStart(5, '0')}` : String(seq).padStart(5, '0');
  const paymentStatus = body.invoice.payment_status || 'unpaid';

  const invoiceStmt = env.DB.prepare(
    `INSERT INTO invoices (id, account_id, invoice_number, customer_name, customer_whatsapp, customer_id, display_currency, shipping_cost_usd, status, inventory_deducted, notes, source_event_id, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    accountId,
    invoiceNumber,
    body.invoice.customer_name,
    body.invoice.customer_whatsapp || null,
    body.invoice.customer_id || null,
    body.invoice.display_currency,
    body.invoice.shipping_cost_usd || 0,
    body.invoice.status || 'Pending',
    0,
    body.invoice.notes || null,
    body.invoice.source_event_id || null,
    paymentStatus
  );

  const lineItemStmts = body.lineItems.map((item: Record<string, any>) =>
    env.DB.prepare(
      'INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, custom_name, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), accountId, id, item.product_id ?? null, item.custom_name ?? null, item.quantity, item.price_at_sale)
  );

  const logStmt = buildActivityLog(
    env, 'INVOICE_CREATED',
    `Invoice ${invoiceNumber} created for ${body.invoice.customer_name} (${body.lineItems.length} items)`,
    userEmail, 'invoice', id, accountId
  );

  await env.DB.batch([invoiceStmt, ...lineItemStmts, logStmt]);

  return json({ id, invoice_number: invoiceNumber }, 201);
};

const handleGetInvoiceItems: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const result = await env.DB.prepare(
    `SELECT ili.*, p.given_name, p.product_name
     FROM invoice_line_items ili
     LEFT JOIN products p ON ili.product_id = p.id
     WHERE ili.invoice_id = ? AND ili.account_id = ?`
  ).bind(params.id, accountId).all();
  return json(result.results);
};

const handleUpdateInvoice: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.account_id;
  const INVOICE_ALLOWED_COLS = new Set(['customer_name','customer_id','customer_phone','customer_email','status','notes','display_currency','amount_usd','shipping_cost_usd','message_text','paid_at','due_date','payment_method','currency_rate','source_event_id']);
  const cols = Object.keys(body).filter(k => INVOICE_ALLOWED_COLS.has(k));
  if (cols.length === 0) return json({ success: true });
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(`UPDATE invoices SET ${sets} WHERE id = ? AND account_id = ?`)
    .bind(...cols.map(c => body[c] ?? null), params.id, accountId).run();
  return json({ success: true });
};

const handleDeleteInvoice: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const userEmail = getUserEmail(request);
  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ? AND account_id = ?')
    .bind(params.id, accountId).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.status !== 'Void') return json({ error: 'Only Void invoices can be deleted' }, 400);

  await env.DB.batch([
    env.DB.prepare("UPDATE invoices SET deleted_at = datetime('now') WHERE id = ? AND account_id = ?")
      .bind(params.id, accountId),
    buildActivityLog(env, 'INVOICE_DELETED', `Invoice ${invoice.invoice_number} soft-deleted`, userEmail, 'invoice', params.id, accountId),
  ]);
  return json({ success: true });
};

// ── RPC: Fulfill Invoice ──
const handleFulfillInvoice: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'sell');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const userEmail = getUserEmail(request);
  const { invoice_id } = await request.json() as { invoice_id: string };

  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ? AND account_id = ?')
    .bind(invoice_id, accountId).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.inventory_deducted) return json({ error: 'Inventory already deducted' }, 400);

  const items = await env.DB.prepare(
    'SELECT * FROM invoice_line_items WHERE invoice_id = ? AND account_id = ?'
  ).bind(invoice_id, accountId).all();

  // Fetch current stock for all affected products — skip custom items (no product_id)
  const productIds = (items.results as any[]).filter(i => i.product_id).map(i => i.product_id);
  const products = new Map<string, any>();
  for (const pid of productIds) {
    const p = await env.DB.prepare(
      'SELECT id, stock_grams, low_stock_threshold, given_name, product_name, status, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
    ).bind(pid, accountId).first();
    if (p) products.set(pid as string, p);
  }

  const stmts: D1PreparedStatement[] = [];

  for (const item of items.results as any[]) {
    if (!item.product_id) continue; // custom line items have no stock to deduct
    const product = products.get(item.product_id as string);
    const currentStock = product ? Number(product.stock_grams) || 0 : 0;
    const qty = Number(item.quantity) || 0;
    const newBalance = currentStock - qty;
    const threshold = product ? Number(product.low_stock_threshold) || 0 : 0;

    stmts.push(
      env.DB.prepare('UPDATE products SET stock_grams = stock_grams - ? WHERE id = ? AND account_id = ?')
        .bind(qty, item.product_id, accountId)
    );
    stmts.push(buildListingStockDelta(env, item.product_id as string, -qty));
    stmts.push(buildStockLedgerEntry(
      env, item.product_id as string, -qty, newBalance, 'FULFILLMENT',
      userEmail, invoice_id, invoice.invoice_number as string, null, accountId
    ));

    if (newBalance <= 0 && product && product.status !== 'Sold Out') {
      stmts.push(
        env.DB.prepare("UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ? AND account_id = ?")
          .bind(item.product_id, accountId)
      );
      stmts.push(buildListingStatusMirror(env, item.product_id as string, 'Sold Out'));
      stmts.push(buildActivityLog(
        env, 'PRODUCT_SOLD_OUT',
        `${product.given_name || product.product_name} auto-archived (stock reached ${newBalance}g after fulfillment of ${invoice.invoice_number})`,
        userEmail, 'product', item.product_id as string, accountId
      ));
      // Set linked compass entry to depleted
      if (product.source_compass_entry_id) {
        stmts.push(
          env.DB.prepare("UPDATE tea_compass_entries SET status = 'depleted', updated_at = datetime('now') WHERE id = ? AND status = 'in_stock'")
            .bind(product.source_compass_entry_id)
        );
      }
    } else if (threshold > 0 && newBalance < threshold && currentStock >= threshold && product) {
      // Low-stock alert when fulfillment drops stock below the configured threshold
      const name = (product.given_name || product.product_name || item.product_id) as string;
      stmts.push(buildActivityLog(
        env, 'low_stock_alert',
        JSON.stringify({ productName: name, stockGrams: newBalance, threshold }),
        userEmail, 'product', item.product_id as string, accountId
      ));
    }
  }

  stmts.push(
    env.DB.prepare('DELETE FROM stock_holds WHERE invoice_id = ? AND account_id = ?')
      .bind(invoice_id, accountId)
  );

  stmts.push(
    env.DB.prepare("UPDATE invoices SET status = 'Filled', inventory_deducted = 1 WHERE id = ? AND account_id = ?")
      .bind(invoice_id, accountId)
  );

  stmts.push(buildActivityLog(
    env, 'FULFILLMENT',
    `Order ${invoice.invoice_number} marked as filled. Inventory deducted for ${items.results.length} item(s).`,
    userEmail, 'invoice', invoice_id, accountId
  ));

  try {
    await env.DB.batch(stmts);
  } catch (err: any) {
    console.error('handleFulfillInvoice batch failed:', err);
    return json({ error: 'Fulfillment failed — no changes were committed' }, 500);
  }

  // Post-fulfillment: populate customer's compass tasting queue (non-blocking)
  const customerUserId = (invoice as any).customer_user_id as string | null;
  if (customerUserId) {
    try {
      const now = new Date().toISOString();
      const recipientMembership = await env.DB.prepare(
        'SELECT account_id FROM account_members WHERE user_id = ? LIMIT 1'
      ).bind(customerUserId).first() as any;
      const targetAccountId = recipientMembership?.account_id;

      if (targetAccountId) {
        for (const item of items.results as any[]) {
          const product = products.get(item.product_id as string);
          if (!product?.source_compass_entry_id) continue;

          const sourceEntry = await env.DB.prepare(
            'SELECT * FROM tea_compass_entries WHERE id = ?'
          ).bind(product.source_compass_entry_id).first() as Record<string, any> | null;
          if (!sourceEntry) continue;

          // Check if recipient already has this tea in their queue
          const alreadyQueued = await env.DB.prepare(
            "SELECT id FROM tea_compass_entries WHERE user_id = ? AND account_id = ? AND source_entry_id = ? AND status IN ('available_to_taste', 'in_stock')"
          ).bind(customerUserId, targetAccountId, sourceEntry.id).first();
          if (alreadyQueued) continue;

          await env.DB.prepare(
            `INSERT INTO tea_compass_entries
               (id, user_id, account_id, name, chinese_name, type, form, year, season, origin_region,
                category, photos, tea_key, status, notes, quantity, price_currency,
                source_entry_id, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available_to_taste', '', 1, 'NT', ?, ?, ?)`
          ).bind(
            crypto.randomUUID(), customerUserId, targetAccountId,
            sourceEntry.name, sourceEntry.chinese_name, sourceEntry.type, sourceEntry.form,
            sourceEntry.year, sourceEntry.season, sourceEntry.origin_region,
            sourceEntry.category || 'tea', sourceEntry.photos || '[]', sourceEntry.tea_key,
            sourceEntry.id, now, now
          ).run();
        }

        // Auto-create member connection (sale source)
        const fulfiller = await env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(userEmail).first() as any;
        if (fulfiller) {
          const [ua, ub] = [fulfiller.id as string, customerUserId].sort();
          await env.DB.prepare(
            `INSERT OR IGNORE INTO member_connections (id, user_id_a, user_id_b, source, source_ref, created_at)
             VALUES (?, ?, ?, 'sale', ?, ?)`
          ).bind(crypto.randomUUID(), ua, ub, invoice_id, now).run();
        }
      }
    } catch (e) {
      console.error('Queue population after fulfillment failed (non-fatal):', e);
    }
  }

  // Send order confirmation email to customer (non-blocking, best-effort)
  const customerEmail = (invoice as any).customer_email as string | null;
  const customerName  = (invoice as any).customer_name  as string | null;
  if (customerEmail && env.SENDER_EMAIL) {
    const invoiceNumber = (invoice as any).invoice_number as string;
    const amountUsd     = (invoice as any).amount_usd     as number | null;
    const lineItems = (items.results as any[]).map(i => ({
      name: i.product_name || i.given_name || 'Item',
      qty:  i.quantity_grams ? `${i.quantity_grams}g` : (i.quantity != null ? `×${i.quantity}` : ''),
    }));
    const orderUrl = `https://teajia.app/order/${invoice_id}`;
    sendEmail(env, customerEmail, `Your Teajia order ${invoiceNumber} is confirmed`, fulfillmentEmailHtml(
      customerName || 'there',
      invoiceNumber,
      lineItems,
      amountUsd,
      orderUrl,
    )).catch(() => { /* non-critical */ });
  }

  return json({ success: true });
};

// ── RPC: Increment Stock (legacy, kept for backwards compat) ──
const handleIncrementStock: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'stock');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const { product_id, amount } = await request.json() as { product_id: string; amount: number };
  await env.DB.batch([
    env.DB.prepare('UPDATE products SET stock_grams = stock_grams + ? WHERE id = ? AND account_id = ?')
      .bind(amount, product_id, accountId),
    buildListingStockDelta(env, product_id, amount),
  ]);
  return json({ success: true });
};

// ── RPC: Void Invoice (atomic server-side) ──
const handleVoidInvoice: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'sell');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const userEmail = getUserEmail(request);
  const { invoice_id } = await request.json() as { invoice_id: string };

  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ? AND account_id = ?')
    .bind(invoice_id, accountId).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.status === 'Void') return json({ error: 'Invoice is already voided' }, 400);

  const stmts: D1PreparedStatement[] = [];

  if (invoice.inventory_deducted) {
    const items = await env.DB.prepare(
      'SELECT * FROM invoice_line_items WHERE invoice_id = ? AND account_id = ?'
    ).bind(invoice_id, accountId).all();

    for (const item of items.results as any[]) {
      if (!item.product_id) continue; // custom line items have no stock to restore
      const product = await env.DB.prepare(
        'SELECT id, stock_grams, given_name, product_name, status, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
      ).bind(item.product_id, accountId).first();
      const currentStock = product ? Number(product.stock_grams) || 0 : 0;
      const qty = Number(item.quantity) || 0;
      const newBalance = currentStock + qty;

      stmts.push(
        env.DB.prepare('UPDATE products SET stock_grams = stock_grams + ? WHERE id = ? AND account_id = ?')
          .bind(qty, item.product_id, accountId)
      );
      stmts.push(buildListingStockDelta(env, item.product_id as string, qty));
      stmts.push(buildStockLedgerEntry(
        env, item.product_id as string, qty, newBalance, 'VOID',
        userEmail, invoice_id, invoice.invoice_number as string, null, accountId
      ));

      if (product && product.status === 'Sold Out' && newBalance > 0) {
        stmts.push(
          env.DB.prepare("UPDATE products SET status = 'Active', sold_out_at = NULL WHERE id = ? AND account_id = ?")
            .bind(item.product_id, accountId)
        );
        stmts.push(buildListingStatusMirror(env, item.product_id as string, 'Active'));
        // Restore linked compass entry from depleted to in_stock
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
      .bind(invoice_id, accountId)
  );

  stmts.push(
    env.DB.prepare("UPDATE invoices SET status = 'Void', inventory_deducted = 0 WHERE id = ? AND account_id = ?")
      .bind(invoice_id, accountId)
  );
  stmts.push(buildActivityLog(
    env, 'INVOICE_VOIDED',
    `Invoice ${invoice.invoice_number} voided.${invoice.inventory_deducted ? ' Stock restored.' : ''}`,
    userEmail, 'invoice', invoice_id, accountId
  ));

  try {
    await env.DB.batch(stmts);
  } catch (err: any) {
    console.error('handleVoidInvoice batch failed:', err);
    return json({ error: 'Void failed — no changes were committed' }, 500);
  }
  return json({ success: true });
};

// ── RPC: Split Invoice ──
const handleSplitInvoice: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const userEmail = getUserEmail(request);
  const { invoice_id, line_item_ids } = await request.json() as { invoice_id: string; line_item_ids: string[] };

  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ? AND account_id = ?')
    .bind(invoice_id, accountId).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.status !== 'Pending') return json({ error: 'Only Pending invoices can be split' }, 400);

  const allItems = await env.DB.prepare(
    'SELECT * FROM invoice_line_items WHERE invoice_id = ? AND account_id = ?'
  ).bind(invoice_id, accountId).all();
  if (line_item_ids.length === 0 || line_item_ids.length >= allItems.results.length) {
    return json({ error: 'Must select a proper subset of items to split' }, 400);
  }

  const newId = crypto.randomUUID();
  const splitSeqRow = await env.DB.prepare(
    'UPDATE accounts SET invoice_seq = invoice_seq + 1 WHERE id = ? RETURNING invoice_seq, invoice_prefix'
  ).bind(accountId).first() as { invoice_seq: number; invoice_prefix: string | null } | null;
  const splitSeq = splitSeqRow?.invoice_seq ?? 1;
  const splitPfx = splitSeqRow?.invoice_prefix || '';
  const newNumber = splitPfx ? `${splitPfx}-${String(splitSeq).padStart(5, '0')}` : String(splitSeq).padStart(5, '0');

  const stmts: D1PreparedStatement[] = [];

  stmts.push(env.DB.prepare(
    `INSERT INTO invoices (id, account_id, invoice_number, customer_name, customer_whatsapp, customer_id, display_currency, shipping_cost_usd, status, inventory_deducted, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Pending', 0, ?)`
  ).bind(newId, accountId, newNumber, invoice.customer_name, invoice.customer_whatsapp, invoice.customer_id, invoice.display_currency, invoice.notes));

  for (const itemId of line_item_ids) {
    stmts.push(
      env.DB.prepare('UPDATE invoice_line_items SET invoice_id = ? WHERE id = ? AND account_id = ?')
        .bind(newId, itemId, accountId)
    );
  }

  stmts.push(buildActivityLog(env, 'INVOICE_SPLIT',
    `Invoice ${invoice.invoice_number} split. ${line_item_ids.length} item(s) moved to ${newNumber}.`,
    userEmail, 'invoice', invoice_id, accountId));
  stmts.push(buildActivityLog(env, 'INVOICE_SPLIT',
    `Invoice ${newNumber} created from split of ${invoice.invoice_number}.`,
    userEmail, 'invoice', newId, accountId));

  try {
    await env.DB.batch(stmts);
  } catch (err: any) {
    console.error('handleSplitInvoice batch failed:', err);
    return json({ error: 'Split failed — no changes were committed' }, 500);
  }
  return json({ original_id: invoice_id, new_id: newId, new_invoice_number: newNumber }, 201);
};

// ── Update Invoice Items (edit pending order) ──
const handleUpdateInvoiceItems: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const userEmail = getUserEmail(request);
  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ? AND account_id = ?')
    .bind(params.id, accountId).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);
  if (invoice.status !== 'Pending') return json({ error: 'Only Pending invoices can be edited' }, 400);

  const body = await request.json() as {
    lineItems?: { product_id: string; quantity: number; price_at_sale: number; custom_name?: string }[];
    shipping_cost_usd?: number;
    customer_name?: string;
    customer_id?: string;
    display_currency?: string;
    notes?: string;
  };

  const stmts: D1PreparedStatement[] = [];

  if (body.lineItems) {
    stmts.push(env.DB.prepare(
      'DELETE FROM invoice_line_items WHERE invoice_id = ? AND account_id = ?'
    ).bind(params.id, accountId));
    for (const item of body.lineItems) {
      stmts.push(env.DB.prepare(
        'INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, custom_name, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(crypto.randomUUID(), accountId, params.id, item.product_id ?? null, item.custom_name ?? null, item.quantity, item.price_at_sale));
    }
  }

  const updates: string[] = [];
  const vals: any[] = [];
  const ALLOWED_ITEM_UPDATES = new Set(['shipping_cost_usd','customer_name','customer_id','display_currency','notes','customer_phone','customer_email']);
  for (const [key, val] of Object.entries(body)) {
    if (key === 'lineItems') continue;
    if (!ALLOWED_ITEM_UPDATES.has(key)) continue;
    updates.push(`${key} = ?`);
    vals.push(val ?? null);
  }
  if (updates.length > 0) {
    stmts.push(
      env.DB.prepare(`UPDATE invoices SET ${updates.join(', ')} WHERE id = ? AND account_id = ?`)
        .bind(...vals, params.id, accountId)
    );
  }

  stmts.push(buildActivityLog(env, 'INVOICE_EDITED',
    `Invoice ${invoice.invoice_number} edited.${body.lineItems ? ` ${body.lineItems.length} line items.` : ''}`,
    userEmail, 'invoice', params.id, accountId));

  await env.DB.batch(stmts);
  return json({ success: true });
};

// ── RPC: Link Line Item to Product (with retroactive stock deduction if fulfilled) ──
const handleLinkLineItem: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const userEmail = getUserEmail(request);

  const { invoice_id, line_item_id, product_id } = await request.json() as {
    invoice_id: string; line_item_id: string; product_id: string;
  };

  const invoice = await env.DB.prepare('SELECT * FROM invoices WHERE id = ? AND account_id = ?')
    .bind(invoice_id, accountId).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);

  const lineItem = await env.DB.prepare(
    'SELECT * FROM invoice_line_items WHERE id = ? AND invoice_id = ? AND account_id = ?'
  ).bind(line_item_id, invoice_id, accountId).first();
  if (!lineItem) return json({ error: 'Line item not found' }, 404);

  const product = await env.DB.prepare(
    'SELECT id, stock_grams, low_stock_threshold, given_name, product_name, status, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
  ).bind(product_id, accountId).first();
  if (!product) return json({ error: 'Product not found' }, 404);

  const stmts: D1PreparedStatement[] = [];

  stmts.push(env.DB.prepare(
    'UPDATE invoice_line_items SET product_id = ?, custom_name = NULL WHERE id = ? AND invoice_id = ? AND account_id = ?'
  ).bind(product_id, line_item_id, invoice_id, accountId));

  if (invoice.inventory_deducted) {
    const qty = Number(lineItem.quantity);
    const newBalance = Number(product.stock_grams) - qty;

    stmts.push(env.DB.prepare(
      'UPDATE products SET stock_grams = stock_grams - ? WHERE id = ? AND account_id = ?'
    ).bind(qty, product_id, accountId));
    stmts.push(buildListingStockDelta(env, product_id, -qty));

    stmts.push(buildStockLedgerEntry(
      env, product_id, -qty, newBalance, 'FULFILLMENT',
      userEmail, invoice_id, invoice.invoice_number as string, 'retroactive link', accountId
    ));

    if (newBalance <= 0 && product.status !== 'Sold Out') {
      stmts.push(env.DB.prepare(
        "UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ? AND account_id = ?"
      ).bind(product_id, accountId));
      stmts.push(buildListingStatusMirror(env, product_id, 'Sold Out'));
      if (product.source_compass_entry_id) {
        stmts.push(env.DB.prepare(
          "UPDATE tea_compass_entries SET status = 'depleted', updated_at = datetime('now') WHERE id = ? AND status = 'in_stock'"
        ).bind(product.source_compass_entry_id));
      }
    }
  }

  const productName = (product.given_name || product.product_name) as string;
  stmts.push(buildActivityLog(env, 'INVOICE_EDITED',
    `Invoice ${invoice.invoice_number}: custom item linked to ${productName}.${invoice.inventory_deducted ? ' Stock deducted.' : ''}`,
    userEmail, 'invoice', invoice_id, accountId));

  await env.DB.batch(stmts);
  return json({ success: true, inventory_deducted: !!invoice.inventory_deducted });
};

// ── Stock Ledger ──
const handleGetStockLedger: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'stock');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const productId = url.searchParams.get('product_id');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  if (productId) {
    const [result, countRow] = await Promise.all([
      env.DB.prepare(
        `SELECT sl.*, p.given_name, p.product_name
         FROM stock_ledger sl
         LEFT JOIN products p ON sl.product_id = p.id
         WHERE sl.product_id = ? AND sl.account_id = ?
         ORDER BY sl.created_at DESC LIMIT ? OFFSET ?`
      ).bind(productId, accountId, limit, offset).all(),
      env.DB.prepare(
        `SELECT COUNT(*) as total FROM stock_ledger WHERE product_id = ? AND account_id = ?`
      ).bind(productId, accountId).first<{ total: number }>(),
    ]);
    return json({ entries: result.results, total: countRow?.total ?? 0 });
  }

  const [result, countRow] = await Promise.all([
    env.DB.prepare(
      `SELECT sl.*, p.given_name, p.product_name
       FROM stock_ledger sl
       LEFT JOIN products p ON sl.product_id = p.id
       WHERE sl.account_id = ?
       ORDER BY sl.created_at DESC LIMIT ? OFFSET ?`
    ).bind(accountId, limit, offset).all(),
    env.DB.prepare(
      `SELECT COUNT(*) as total FROM stock_ledger WHERE account_id = ?`
    ).bind(accountId).first<{ total: number }>(),
  ]);
  return json({ entries: result.results, total: countRow?.total ?? 0 });
};

// ── RPC: Reset Stock Verification ──
const handleResetStockVerification: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'stock');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  await env.DB.prepare('UPDATE products SET stock_verified_at = NULL WHERE account_id = ?')
    .bind(accountId).run();
  return json({ success: true });
};

// ── RPC: Truncate All Data (per-account, owner-tier only) ──
const handleTruncateAll: Handler = async (request, env) => {
  const ctx = await requireOwnerTier(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  await env.DB.batch([
    env.DB.prepare('DELETE FROM invoice_line_items WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM invoices WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM products WHERE account_id = ?').bind(accountId),
    env.DB.prepare('DELETE FROM activity_logs WHERE account_id = ?').bind(accountId),
  ]);
  return json({ success: true });
};

// ── Customers ──
const handleGetCustomers: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const typeFilter = url.searchParams.get('type'); // 'customer' | 'supplier' | null (all)
  const typeClause = typeFilter ? `AND c.type = '${typeFilter}'` : '';

  let result;
  try {
    result = await env.DB.prepare(`
      SELECT c.*,
        COUNT(DISTINCT i.id) as order_count,
        COALESCE(SUM(
          (SELECT SUM(ili.quantity * ili.price_at_sale) FROM invoice_line_items ili WHERE ili.invoice_id = i.id)
        ), 0) as total_spent_usd,
        MAX(i.created_at) as last_order_date,
        (SELECT COUNT(*) FROM event_attendees ea
         WHERE ea.customer_id = c.id AND ea.status = 'confirmed' AND ea.attended = 1
        ) as event_count
      FROM customers c
      LEFT JOIN invoices i ON i.customer_id = c.id AND i.status != 'Void' AND i.account_id = ?
      WHERE c.account_id = ? ${typeClause}
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `).bind(accountId, accountId).all();
  } catch {
    result = await env.DB.prepare(`
      SELECT c.*, 0 as order_count, 0 as total_spent_usd, NULL as last_order_date, 0 as event_count
      FROM customers c
      WHERE c.account_id = ? ${typeClause}
      ORDER BY c.created_at DESC
    `).bind(accountId).all();
  }

  // Attach contact tags (the new freeform admin tags, separate from the
  // legacy customers.tags JSON column).
  let tagMap = new Map<string, string[]>();
  try {
    const tagRows = await env.DB.prepare(
      `SELECT customer_id, tag FROM customer_tags WHERE account_id = ? ORDER BY tag ASC`
    ).bind(accountId).all();
    for (const row of (tagRows.results ?? []) as any[]) {
      const list = tagMap.get(row.customer_id) || [];
      list.push(row.tag);
      tagMap.set(row.customer_id, list);
    }
  } catch { /* tag table may not exist yet on older databases */ }

  const customers = (result.results as any[]).map(c => ({
    ...c,
    contacts: typeof c.contacts === 'string' ? JSON.parse(c.contacts || '[]') : (c.contacts ?? []),
    tags: typeof c.tags === 'string' ? JSON.parse(c.tags || '[]') : (c.tags ?? []),
    contact_tags: tagMap.get(c.id) || [],
  }));
  return json(customers);
};

const handleGetCustomer: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const customer = await env.DB.prepare(
    'SELECT * FROM customers WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first();
  if (!customer) return json({ error: 'Customer not found' }, 404);

  let orders: any[] = [];
  try {
    const result = await env.DB.prepare(
      'SELECT * FROM invoices WHERE customer_id = ? AND account_id = ? ORDER BY created_at DESC'
    ).bind(params.id, accountId).all();
    orders = result.results as any[];
  } catch { /* customer_id column may not exist yet */ }

  const parsed = {
    ...customer,
    contacts: typeof customer.contacts === 'string' ? JSON.parse(customer.contacts || '[]') : (customer.contacts ?? []),
    tags: typeof customer.tags === 'string' ? JSON.parse(customer.tags || '[]') : (customer.tags ?? []),
    orders,
  };
  return json(parsed);
};

const handleCreateCustomer: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.account_id;
  const id = crypto.randomUUID();

  if (Array.isArray(body.tags)) body.tags = JSON.stringify(body.tags);
  if (Array.isArray(body.contacts)) body.contacts = JSON.stringify(body.contacts);

  await env.DB.prepare(
    `INSERT INTO customers (id, account_id, type, name, company, email, phone, whatsapp, address, city, country, preferred_currency, tags, notes, source, contacts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    accountId,
    body.type || 'customer',
    body.name,
    body.company || null,
    body.email || null,
    body.phone || null,
    body.whatsapp || null,
    body.address || null,
    body.city || null,
    body.country || null,
    body.preferred_currency || 'USD',
    body.tags || '[]',
    body.notes || null,
    body.source || null,
    body.contacts || '[]'
  ).run();

  return json({ id }, 201);
};

const handleUpdateCustomer: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.account_id;
  if (Array.isArray(body.tags)) body.tags = JSON.stringify(body.tags);
  if (Array.isArray(body.contacts)) body.contacts = JSON.stringify(body.contacts);

  const CUSTOMER_ALLOWED_COLS = new Set(['name','email','phone','notes','tags','address','city','country','source','vip','preferred_currency','instagram','wechat','whatsapp','referred_by','type','company','contacts']);
  const cols = Object.keys(body).filter(k => CUSTOMER_ALLOWED_COLS.has(k));
  if (cols.length === 0) return json({ success: true });
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE customers SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.id, accountId).run();

  return json({ success: true });
};

const handleDeleteCustomer: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  try {
    await env.DB.prepare(
      'UPDATE invoices SET customer_id = NULL WHERE customer_id = ? AND account_id = ?'
    ).bind(params.id, accountId).run();
  } catch {}
  await env.DB.prepare('DELETE FROM customers WHERE id = ? AND account_id = ?')
    .bind(params.id, accountId).run();
  return json({ success: true });
};

const handleGetCustomerOrders: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  try {
    const orders = await env.DB.prepare(
      'SELECT * FROM invoices WHERE customer_id = ? AND account_id = ? ORDER BY created_at DESC'
    ).bind(params.id, accountId).all();
    return json(orders.results);
  } catch {
    return json([]);
  }
};

const handleGetCustomerTeas: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  try {
    const [purchasedResult, eventResult] = await Promise.all([
      env.DB.prepare(`
        SELECT
          p.id, p.product_name, p.given_name, p.chinese_name, p.type, p.image_url,
          p.origin_country, p.origin_region,
          SUM(ili.quantity) as total_quantity,
          COUNT(DISTINCT i.id) as order_count,
          MIN(i.created_at) as first_purchased,
          MAX(i.created_at) as last_purchased
        FROM invoice_line_items ili
        JOIN invoices i ON i.id = ili.invoice_id
        JOIN products p ON p.id = ili.product_id
        WHERE i.customer_id = ? AND i.status != 'Void' AND i.account_id = ?
        GROUP BY p.id
        ORDER BY last_purchased DESC
      `).bind(params.id, accountId).all(),

      // Teas tasted at events (via tasting notes → tea menu → product or custom)
      env.DB.prepare(`
        SELECT DISTINCT
          COALESCE(p.id, 'custom:' || etm.id) as id,
          COALESCE(p.product_name, etm.custom_name) as product_name,
          COALESCE(p.given_name, etm.custom_name) as given_name,
          p.chinese_name, COALESCE(p.type, etm.tea_type) as type, p.image_url,
          p.origin_country, COALESCE(p.origin_region, etm.origin_region) as origin_region,
          0 as total_quantity, 0 as order_count,
          NULL as first_purchased, NULL as last_purchased
        FROM event_tasting_notes etn
        JOIN event_attendees ea ON ea.id = etn.attendee_id
        JOIN event_tea_menu etm ON etm.id = etn.tea_menu_id
        LEFT JOIN products p ON p.id = etm.product_id
        WHERE ea.customer_id = ? AND ea.account_id = ?
      `).bind(params.id, accountId).all(),
    ]);

    // Merge: purchased rows first, then event-tasted rows not already in the set
    const seenIds = new Set<string>();
    const merged: any[] = [];
    for (const row of purchasedResult.results) {
      seenIds.add((row as any).id);
      merged.push({ ...(row as any), source: 'purchased' });
    }
    for (const row of eventResult.results) {
      const id = (row as any).id;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        merged.push({ ...(row as any), source: 'tasted_at_event' });
      }
    }

    return json(merged);
  } catch {
    return json([]);
  }
};

const handleGetCustomerEvents: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  try {
    const result = await env.DB.prepare(`
      SELECT
        e.id, e.slug, e.title, e.subtitle, e.event_date, e.event_end_date,
        e.location_name, e.status as event_status,
        ea.status as attendee_status, ea.attended, ea.access_tier,
        ea.plus_one, ea.created_at as rsvp_date
      FROM event_attendees ea
      JOIN events e ON e.id = ea.event_id
      WHERE ea.customer_id = ? AND ea.status != 'cancelled' AND ea.account_id = ?
      ORDER BY e.event_date DESC
    `).bind(params.id, accountId).all();
    return json(result.results);
  } catch {
    return json([]);
  }
};

// GET /api/admin/customers/:id/journey — aggregated journey stats for CustomerProfilePage
const handleGetCustomerJourney: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  try {
    const [eventsResult, teasResult, eventNotesResult, customer] = await Promise.all([
      env.DB.prepare(`
        SELECT COUNT(*) as attended
        FROM event_attendees ea
        JOIN events e ON e.id = ea.event_id
        WHERE ea.customer_id = ? AND ea.attended = 1 AND ea.account_id = ?
      `).bind(params.id, accountId).first<{ attended: number }>(),

      env.DB.prepare(`
        SELECT p.type, p.given_name, p.product_name,
          SUM(ili.quantity) as total_quantity
        FROM invoice_line_items ili
        JOIN invoices i ON i.id = ili.invoice_id
        JOIN products p ON p.id = ili.product_id
        WHERE i.customer_id = ? AND i.status != 'Void' AND i.account_id = ?
          AND p.type IS NOT NULL AND p.type != 'Teaware'
        GROUP BY p.id
        ORDER BY total_quantity DESC
      `).bind(params.id, accountId).all(),

      // Types + impressions tasted at events — fills portrait even when no invoices exist
      env.DB.prepare(`
        SELECT
          COALESCE(p.type, etm.tea_type) as type,
          COALESCE(p.given_name, etm.custom_name) as given_name,
          COALESCE(p.product_name, etm.custom_name) as product_name,
          etn.impression, e.title as event_title, e.slug as event_slug, e.event_date
        FROM event_tasting_notes etn
        JOIN event_attendees ea ON ea.id = etn.attendee_id
        JOIN event_tea_menu etm ON etm.id = etn.tea_menu_id
        LEFT JOIN products p ON p.id = etm.product_id
        JOIN events e ON e.id = ea.event_id
        WHERE ea.customer_id = ? AND ea.account_id = ?
          AND (COALESCE(p.type, etm.tea_type) IS NULL OR COALESCE(p.type, etm.tea_type) != 'Teaware')
        ORDER BY e.event_date DESC
      `).bind(params.id, accountId).all(),

      env.DB.prepare(
        'SELECT created_at FROM customers WHERE id = ? AND account_id = ?'
      ).bind(params.id, accountId).first<{ created_at: string }>(),
    ]);

    const rows = teasResult.results as any[];
    const teaTypeMap: Record<string, number> = {};
    for (const row of rows) {
      if (row.type) teaTypeMap[row.type] = (teaTypeMap[row.type] || 0) + 1;
    }
    // Merge event-tasted types so portrait works for customers who've attended but never ordered
    const impressions: Array<{ text: string; teaName: string; eventTitle: string; eventSlug?: string; date: string }> = [];
    for (const row of eventNotesResult.results as any[]) {
      if (row.type) teaTypeMap[row.type] = (teaTypeMap[row.type] || 0) + 1;
      if (row.impression) {
        impressions.push({
          text: row.impression,
          teaName: row.given_name || row.product_name || 'Unknown tea',
          eventTitle: row.event_title,
          eventSlug: row.event_slug || undefined,
          date: row.event_date,
        });
      }
    }
    // Favorites from invoices first, fall back to event notes
    const invoiceFavorites = rows.slice(0, 3).map((r: any) => r.given_name || r.product_name).filter(Boolean);
    const eventFavorites = (eventNotesResult.results as any[]).slice(0, 3).map((r: any) => r.given_name || r.product_name).filter(Boolean);
    const favorites = invoiceFavorites.length > 0 ? invoiceFavorites : eventFavorites;
    const sessionsAttended = eventsResult?.attended ?? 0;
    const milestones: string[] = [];
    if (sessionsAttended >= 1) milestones.push('First session');
    if (sessionsAttended >= 5) milestones.push('5 sessions');
    if (sessionsAttended >= 10) milestones.push('10 sessions');
    if (rows.length >= 10) milestones.push('10 teas explored');
    if (rows.length >= 25) milestones.push('25 teas explored');

    // Portrait — concise palate summary for admin briefing
    const topTypes = Object.entries(teaTypeMap).sort(([, a], [, b]) => b - a).slice(0, 2).map(([t]) => t.toLowerCase());
    const portraitParts: string[] = [];
    if (topTypes.length > 0) portraitParts.push(`Gravitates toward ${topTypes.join(' and ')}`);
    if (favorites.length > 0) portraitParts.push(`top teas: ${favorites.slice(0, 2).join(', ')}`);
    if (sessionsAttended >= 3) portraitParts.push(`${sessionsAttended} sessions attended`);
    const portrait = portraitParts.join(' · ');

    return json({ sessionsAttended, totalTeas: rows.length, teaTypeMap, favorites, milestones, impressions, memberSince: customer?.created_at ?? null, portrait });
  } catch {
    return json({ sessionsAttended: 0, totalTeas: 0, teaTypeMap: {}, favorites: [], milestones: [], impressions: [], memberSince: null, portrait: '' });
  }
};

const handleGetVendorProducts: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const result = await env.DB.prepare(`
    SELECT id, product_name, given_name, chinese_name, type, image_url,
      origin_country, origin_region, stock_grams, status, cost_amount, cost_currency
    FROM products
    WHERE vendor_id = ? AND account_id = ?
    ORDER BY product_name ASC
  `).bind(params.id, accountId).all();

  return json(result.results);
};

const handleLinkVendorProduct: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  const productId = body.product_id;
  if (!productId) return json({ error: 'product_id required' }, 400);

  await env.DB.prepare('UPDATE products SET vendor_id = ? WHERE id = ? AND account_id = ?')
    .bind(params.id, productId, accountId).run();

  return json({ success: true });
};

const handleUnlinkVendorProduct: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  await env.DB.prepare('UPDATE products SET vendor_id = NULL WHERE id = ? AND account_id = ?')
    .bind(params.productId, accountId).run();

  return json({ success: true });
};

// ── Customer tags ──
// Freeform admin-only tags. Storage is lowercase, trimmed; max 50 chars.
// See project_contact_tags_feature memory for the platform-wide intent.
function normalizeTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t.length > 50) return t.slice(0, 50);
  return t;
}

const handleListCustomerTags: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const { results } = await env.DB.prepare(
    `SELECT tag FROM customer_tags
     WHERE account_id = ? AND customer_id = ?
     ORDER BY tag ASC`
  ).bind(accountId, params.id).all();

  return json((results as any[]).map(r => r.tag));
};

const handleAddCustomerTag: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json().catch(() => ({})) as Record<string, any>;

  // Accept either { tag: string } or { tags: string[] } for batch add.
  const rawTags: unknown[] = Array.isArray(body.tags)
    ? body.tags
    : (body.tag !== undefined ? [body.tag] : []);
  const cleaned = Array.from(new Set(
    rawTags.map(normalizeTag).filter((t): t is string => !!t)
  ));
  if (cleaned.length === 0) return json({ error: 'tag required' }, 400);

  const customer = await env.DB.prepare(
    'SELECT id FROM customers WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first();
  if (!customer) return json({ error: 'Customer not found' }, 404);

  const stmts = cleaned.map(t => env.DB.prepare(
    `INSERT OR IGNORE INTO customer_tags (id, account_id, customer_id, tag)
     VALUES (?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), accountId, params.id, t));
  if (stmts.length === 1) {
    await stmts[0].run();
  } else {
    await env.DB.batch(stmts);
  }

  return json({ success: true, tags: cleaned });
};

const handleRemoveCustomerTag: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const tag = normalizeTag(decodeURIComponent(params.tag));
  if (!tag) return json({ error: 'tag required' }, 400);

  await env.DB.prepare(
    `DELETE FROM customer_tags
     WHERE account_id = ? AND customer_id = ? AND tag = ?`
  ).bind(accountId, params.id, tag).run();

  return json({ success: true });
};

// All distinct tags in the account, ordered by usage count desc.
// Powers autocomplete (Phase A) and the picker tag chips (Phase B).
const handleListAccountCustomerTags: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const { results } = await env.DB.prepare(
    `SELECT tag, COUNT(*) as count
     FROM customer_tags
     WHERE account_id = ?
     GROUP BY tag
     ORDER BY count DESC, tag ASC`
  ).bind(accountId).all();

  return json(results);
};

// Rename or merge a tag across the whole account. If the target name already
// exists on a customer that also has the old tag, the union is preserved and
// no duplicates are created. Empty target means delete the tag everywhere.
const handleRenameOrDeleteCustomerTag: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const from = normalizeTag(decodeURIComponent(params.tag));
  if (!from) return json({ error: 'tag required' }, 400);

  const body = await request.json().catch(() => ({})) as Record<string, any>;

  // Empty/null rename_to means "delete everywhere."
  const to = body.rename_to === null || body.rename_to === '' || body.rename_to === undefined
    ? null
    : normalizeTag(body.rename_to);

  if (to === null) {
    await env.DB.prepare(
      `DELETE FROM customer_tags WHERE account_id = ? AND tag = ?`
    ).bind(accountId, from).run();
    return json({ success: true, deleted: from });
  }

  if (to === from) return json({ success: true, renamed: 0 });

  // Insert new rows for every customer holding the old tag, ignoring
  // conflicts (which means the customer already had both). Then delete old.
  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO customer_tags (id, account_id, customer_id, tag)
       SELECT lower(hex(randomblob(8))), account_id, customer_id, ?
         FROM customer_tags WHERE account_id = ? AND tag = ?`
    ).bind(to, accountId, from),
    env.DB.prepare(
      `DELETE FROM customer_tags WHERE account_id = ? AND tag = ?`
    ).bind(accountId, from),
  ]);

  return json({ success: true, from, to });
};

// Recently shared-with customers across all active person/tag publications.
// Powers the "Recently shared with" row in the recipient picker.
const handleRecentRecipients: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const days = Math.max(1, Math.min(365, parseInt(url.searchParams.get('days') || '90', 10) || 90));
  const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get('limit') || '6', 10) || 6));
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString().replace('T', ' ').replace(/\..+$/, '');

  // json_each unrolls each recipient. We dedupe by customer_id, keeping the
  // most recent publication.
  const { results } = await env.DB.prepare(`
    WITH recent AS (
      SELECT
        json_extract(r.value, '$.customer_id') AS customer_id,
        json_extract(r.value, '$.name')        AS name,
        json_extract(r.value, '$.phone')       AS phone,
        cp.published_at                        AS published_at
      FROM collection_publications cp
      JOIN collections c ON c.id = cp.collection_id
      JOIN json_each(cp.recipients_json) r
      WHERE c.account_id = ?
        AND cp.unpublished_at IS NULL
        AND cp.published_at >= ?
        AND cp.target_type IN ('person','tag')
        AND json_extract(r.value, '$.customer_id') IS NOT NULL
    )
    SELECT customer_id, name, phone, MAX(published_at) AS last_published_at
      FROM recent
     GROUP BY customer_id
     ORDER BY last_published_at DESC
     LIMIT ?
  `).bind(accountId, cutoffIso, limit).all();

  return json(results || []);
};

// All customers carrying a given tag. Used by tag-expansion in the picker.
const handleListCustomersByTag: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const tag = normalizeTag(decodeURIComponent(params.tag));
  if (!tag) return json({ error: 'tag required' }, 400);

  const { results } = await env.DB.prepare(
    `SELECT c.id, c.name, c.phone, c.whatsapp
     FROM customer_tags ct
     JOIN customers c ON c.id = ct.customer_id
     WHERE ct.account_id = ? AND ct.tag = ? AND c.account_id = ?
     ORDER BY c.name ASC`
  ).bind(accountId, tag, accountId).all();

  return json(results);
};

// ── Cross-reference junction table handlers (article_products, module_products, project_products) ──
function makeXrefHandlers(tableName: string, fkColumn: string) {
  // These xref tables join articles/modules/projects (network-level content)
  // to products (account-scoped). We only need to scope the product side —
  // reads join through products.account_id, writes require the product
  // belongs to the caller's account.

  const list: Handler = async (request, env, params) => {
    const ctx = await requireAccount(request, env);
    if ('error' in ctx) return ctx.error;
    const { accountId } = ctx;
    const id = params.id;
    const { results } = await env.DB.prepare(
      `SELECT xr.*, p.given_name, p.product_name, p.type, p.image_url, p.origin_region
       FROM ${tableName} xr
       LEFT JOIN products p ON xr.product_id = p.id
       WHERE xr.${fkColumn} = ? AND p.account_id = ?
       ORDER BY xr.created_at DESC`
    ).bind(id, accountId).all();
    return json(results);
  };

  const link: Handler = async (request, env, params) => {
    const ctx = await requireAccount(request, env);
    if ('error' in ctx) return ctx.error;
    const { accountId } = ctx;
    const body = await request.json() as any;
    const productId = body.product_id;
    if (!productId) return json({ error: 'product_id required' }, 400);

    // Verify the product belongs to the caller's account before linking.
    const product = await env.DB.prepare(
      'SELECT id FROM products WHERE id = ? AND account_id = ?'
    ).bind(productId, accountId).first();
    if (!product) return json({ error: 'Product not found' }, 404);

    await env.DB.prepare(
      `INSERT OR IGNORE INTO ${tableName} (id, ${fkColumn}, product_id) VALUES (?, ?, ?)`
    ).bind(crypto.randomUUID(), params.id, productId).run();
    return json({ success: true }, 201);
  };

  const unlink: Handler = async (request, env, params) => {
    const ctx = await requireAccount(request, env);
    if ('error' in ctx) return ctx.error;
    const { accountId } = ctx;
    // Only allow unlinking products that belong to the caller's account.
    const product = await env.DB.prepare(
      'SELECT id FROM products WHERE id = ? AND account_id = ?'
    ).bind(params.productId, accountId).first();
    if (!product) return json({ error: 'Product not found' }, 404);
    await env.DB.prepare(
      `DELETE FROM ${tableName} WHERE ${fkColumn} = ? AND product_id = ?`
    ).bind(params.id, params.productId).run();
    return json({ success: true });
  };

  // Reverse lookup: get all articles/modules/projects for a product.
  const listByProduct: Handler = async (request, env, params) => {
    const ctx = await requireAccount(request, env);
    if ('error' in ctx) return ctx.error;
    const { accountId } = ctx;
    // Verify the product is in the caller's account.
    const product = await env.DB.prepare(
      'SELECT id FROM products WHERE id = ? AND account_id = ?'
    ).bind(params.id, accountId).first();
    if (!product) return json([]);
    const { results } = await env.DB.prepare(
      `SELECT * FROM ${tableName} WHERE product_id = ? ORDER BY created_at DESC`
    ).bind(params.id).all();
    return json(results);
  };

  return { list, link, unlink, listByProduct };
}

// Public (no-auth) xref list — used by Magazine / Learn / Consult colophons.
// Always scoped to the platform-owner (Bali) account, same as the legacy
// `/api/products/public` alias. Returns only PUBLIC_FIELDS — no cost, no
// vendor, no sourcing references. Network-level content (articles, modules,
// projects) is platform-wide, so the colophon always reads from Bali.
function makePublicXrefHandler(tableName: string, fkColumn: string): Handler {
  return async (_request, env, params) => {
    const id = params.id;
    const [ratesResult, result] = await env.DB.batch([
      env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates'),
      env.DB.prepare(
        `SELECT p.id, p.type, p.given_name, p.chinese_name, p.product_name, p.year,
                p.origin_country, p.origin_region, p.stock_grams, p.description,
                p.tasting_notes, p.image_url, p.additional_images, p.status,
                p.is_personal, p.can_reorder, p.is_curated, p.lore,
                p.show_wisdom, p.processing_notes, p.terroir, p.mood, p.experience,
                p.cost_amount, p.cost_currency, p.quantity_purchased,
                p.shipping_rate_per_kg, p.fixed_retail_price_usd,
                p.material, p.capacity_ml, p.teaware_category, p.quantity_units, p.tasting, p.tasting_source,
                (SELECT COUNT(*) > 0 FROM collection_items ci2
                   JOIN collections c2 ON c2.id = ci2.collection_id
                   JOIN collection_publications cp2 ON cp2.collection_id = c2.id
                  WHERE ci2.product_id = p.id
                    AND cp2.target_type = 'shop'
                    AND cp2.unpublished_at IS NULL) AS is_featured
         FROM ${tableName} xr
         JOIN products p ON xr.product_id = p.id
         WHERE xr.${fkColumn} = ?
           AND p.account_id = ?
           AND p.is_public = 1
           AND p.status = 'Active'
         ORDER BY xr.created_at DESC`
      ).bind(id, BALI_ACCOUNT_ID),
    ]);
    const rates = new Map<string, number>();
    for (const r of ratesResult.results as any[]) {
      rates.set(r.currency as string, r.rate_to_usd as number);
    }
    const products = (result.results as any[]).map(p => {
      if (typeof p.tasting_notes === 'string') {
        try { p.tasting_notes = JSON.parse(p.tasting_notes); } catch { p.tasting_notes = []; }
      }
      if (typeof p.additional_images === 'string') {
        try { p.additional_images = JSON.parse(p.additional_images); } catch { p.additional_images = []; }
      }
      if (typeof p.tasting === 'string') {
        try { p.tasting = JSON.parse(p.tasting); } catch { p.tasting = {}; }
      }
      const withPricing = addPricingFields(p, rates);
      const safe: Record<string, unknown> = {};
      for (const key of PUBLIC_FIELDS) {
        if (key in withPricing) safe[key] = (withPricing as Record<string, unknown>)[key];
      }
      return safe;
    });
    return cachedJson(products, 60);
  };
}

const articleProductXref = makeXrefHandlers('article_products', 'article_id');
const moduleProductXref = makeXrefHandlers('module_products', 'module_id');
const projectProductXref = makeXrefHandlers('project_products', 'project_id');

// ── Backfill: match existing invoices to customers (scoped) ──
const handleBackfillCustomerLinks: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const unlinked = await env.DB.prepare(
    `SELECT id, customer_name, customer_whatsapp FROM invoices
     WHERE customer_id IS NULL AND customer_name IS NOT NULL AND account_id = ?`
  ).bind(accountId).all();

  const customers = await env.DB.prepare(
    'SELECT id, name, whatsapp FROM customers WHERE account_id = ?'
  ).bind(accountId).all();

  const updates: D1PreparedStatement[] = [];
  for (const inv of unlinked.results as any[]) {
    const name = (inv.customer_name as string || '').toLowerCase().trim();
    if (!name) continue;

    let match = (customers.results as any[]).find(
      (c: any) => (c.name as string).toLowerCase().trim() === name
    );
    if (!match && inv.customer_whatsapp) {
      match = (customers.results as any[]).find(
        (c: any) => c.whatsapp && c.whatsapp === inv.customer_whatsapp
      );
    }

    if (match) {
      updates.push(
        env.DB.prepare('UPDATE invoices SET customer_id = ? WHERE id = ? AND account_id = ?')
          .bind(match.id, inv.id, accountId)
      );
    }
  }

  if (updates.length > 0) {
    for (let i = 0; i < updates.length; i += 100) {
      await env.DB.batch(updates.slice(i, i + 100));
    }
  }

  return json({ linked: updates.length, total_unlinked: unlinked.results.length });
};

// ── Auto-link vendors: create customer records from product vendor field (scoped) ──
const handleAutoLinkVendors: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const productsWithVendor = await env.DB.prepare(
    `SELECT id, vendor, origin_country FROM products
     WHERE vendor IS NOT NULL AND vendor != '' AND (vendor_id IS NULL OR vendor_id = '')
       AND account_id = ?`
  ).bind(accountId).all();

  if (productsWithVendor.results.length === 0) {
    return json({ created: 0, linked: 0, message: 'All products are already linked to vendor records.' });
  }

  const vendorGroups: Record<string, { normalizedName: string; originalName: string; country: string; productIds: string[] }> = {};
  for (const p of productsWithVendor.results as any[]) {
    const vendorName = (p.vendor as string).trim();
    const key = vendorName.toLowerCase();
    if (!vendorGroups[key]) {
      vendorGroups[key] = {
        normalizedName: key,
        originalName: vendorName,
        country: (p.origin_country as string) || '',
        productIds: [],
      };
    }
    vendorGroups[key].productIds.push(p.id as string);
  }

  const existingCustomers = await env.DB.prepare(
    'SELECT id, name, tags FROM customers WHERE account_id = ?'
  ).bind(accountId).all();
  const existingByName: Record<string, { id: string; tags: string }> = {};
  for (const c of existingCustomers.results as any[]) {
    existingByName[(c.name as string).toLowerCase().trim()] = { id: c.id as string, tags: c.tags as string };
  }

  let created = 0;
  let linked = 0;
  const linkUpdates: D1PreparedStatement[] = [];

  for (const key of Object.keys(vendorGroups)) {
    const group = vendorGroups[key];
    let customerId: string;

    if (existingByName[key]) {
      customerId = existingByName[key].id;
      let tags: string[] = [];
      try { tags = JSON.parse(existingByName[key].tags || '[]'); } catch { tags = []; }
      if (!tags.includes('vendor')) {
        tags.push('vendor');
        await env.DB.prepare('UPDATE customers SET tags = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .bind(JSON.stringify(tags), customerId).run();
      }
    } else {
      customerId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO customers (id, account_id, name, country, tags, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, '["vendor"]', 'auto-linked from inventory', datetime('now'), datetime('now'))`
      ).bind(customerId, accountId, group.originalName, group.country || null).run();
      created++;
    }

    for (const pid of group.productIds) {
      linkUpdates.push(
        env.DB.prepare('UPDATE products SET vendor_id = ? WHERE id = ? AND account_id = ?')
          .bind(customerId, pid, accountId)
      );
      linked++;
    }
  }

  if (linkUpdates.length > 0) {
    for (let i = 0; i < linkUpdates.length; i += 100) {
      await env.DB.batch(linkUpdates.slice(i, i + 100));
    }
  }

  return json({ created, linked, vendors: Object.keys(vendorGroups).length });
};

// ── AI Wisdom Generation ──
const handleGenerateWisdom: Handler = async (request, env) => {
  const authErr = await requireAdmin(request, env);
  if (authErr) return authErr;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
  }

  const { prompt } = await request.json() as { prompt: string };
  if (!prompt) return json({ error: 'prompt required' }, 400);

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      tools: [{
        name: 'generate_tea_wisdom',
        description: 'Output structured wisdom fields for a tea product.',
        input_schema: {
          type: 'object',
          properties: {
            lore: { type: 'string', description: 'Historical and geographical lore about the tea, written as 2-3 short paragraphs separated by newlines (\\n\\n). Each paragraph should be 1-2 sentences. Cover origin story, terroir significance, and cultural context. Write in an evocative but grounded style.' },
            tastingNotes: { type: 'array', items: { type: 'string' }, description: '3-4 distinct sensory tasting notes.' },
            chineseName: { type: 'string', description: 'Traditional Chinese name of the tea, if known.' },
            originRegion: { type: 'string', description: 'Specific origin region, e.g., "Nantou, Taiwan".' },
            processingNotes: { type: 'string', description: 'Processing notes, e.g., "Heavy charcoal roast over pine wood."' },
            terroir: { type: 'string', description: '1-2 sentences describing the growing environment: soil type, altitude, climate, geography.' },
            mood: { type: 'string', description: 'A short mood or feeling, e.g., "Grounding & Meditative".' },
            experience: { type: 'string', description: '1-2 sentences describing the feeling of drinking this tea.' },
          },
          required: ['lore', 'tastingNotes'],
          additionalProperties: false,
        },
      }],
      tool_choice: { type: 'tool', name: 'generate_tea_wisdom' },
    }),
  });

  if (!claudeRes.ok) {
    return json({ error: `Claude API error: ${claudeRes.status}` }, 502);
  }

  const claudeData = await claudeRes.json() as any;
  const toolUse = claudeData.content?.find((b: any) => b.type === 'tool_use');
  if (!toolUse) return json({ error: 'No structured output from Claude' }, 500);

  return json(toolUse.input);
};

// ── Audio Transcription (Groq Whisper) ──
const handleTranscribe: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  if (!env.GROQ_API_KEY) {
    return json({ error: 'GROQ_API_KEY not configured' }, 503);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return json({ error: 'Expected multipart/form-data' }, 400);
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return json({ error: 'No audio file provided' }, 400);

  // Forward to Groq Whisper API
  const groqForm = new FormData();
  groqForm.append('file', file, file.name || 'recording.webm');
  groqForm.append('model', 'whisper-large-v3-turbo');

  const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.GROQ_API_KEY}`,
    },
    body: groqForm,
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    return json({ error: `Groq API error: ${groqRes.status} — ${errText}` }, 502);
  }

  const result = await groqRes.json() as { text: string };
  return json({ text: result.text });
};

// ── Migrate Tasting Data (AI-assisted) ──
const TASTING_TAXONOMY_TERMS = `Flavor: floral, orchid, jasmine, osmanthus, rose, honeysuckle, honey, caramel, brown-sugar, vanilla, stone-fruit, peach, apricot, lychee, dried-fruit, citrus, plum, chestnut, almond, toasted-rice, roasted-grain, charcoal, toasted, cocoa, dark-chocolate, baked, camphor, sandalwood, cedar, pine, woody, earthy, mushroom, leather, smoky, mineral, stony, iron, slate, fresh-grass, herbaceous, seaweed, vegetal, bitter, astringent, savory, umami, medicinal, aged, hay
Body: light, medium, full, silky, smooth, crisp, oily, dry
Finish: finish-short, finish-medium, finish-long, lingering, hui-gan, sweet-return, finish-clean, finish-dry, finish-cooling, finish-warming, throat-opening, throat-depth, coating, expanding
Feeling: calming, grounding, settling, contemplative, energizing, uplifting, clearing, focusing, feeling-warming, feeling-cooling, softening, nourishing, expansive, opening
Liquor color: pale-gold, gold, amber, honey-color, copper, orange, reddish-brown, deep-brown, dark-chestnut, ink
Brewing: high-temp, medium-temp, low-temp, short-steeps, patient-steeps, flash-steeps, many-infusions, few-infusions, gaiwan, yixing, porcelain, glass, opens-slowly, peaks-mid-session`;

const handleMigrateTasting: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503);
  }

  // Fetch only this account's products that still have legacy tasting data.
  const result = await env.DB.prepare(
    `SELECT id, given_name, product_name, type, tasting_notes, mood, experience, description, terroir, processing_notes, tasting
     FROM products
     WHERE account_id = ? AND (tasting IS NULL OR tasting = '{}' OR tasting = '')`
  ).bind(accountId).all();

  const products = result.results;
  if (!products.length) {
    return json({ message: 'No products need migration', migrated: 0 });
  }

  const migrated: string[] = [];
  const errors: string[] = [];

  // Process in batches of 5 to avoid rate limits
  for (let i = 0; i < products.length; i += 5) {
    const batch = products.slice(i, i + 5);
    const promises = batch.map(async (p) => {
      const name = `${p.given_name || ''} ${p.product_name || ''}`.trim();
      const tastingNotes = typeof p.tasting_notes === 'string'
        ? (() => { try { return JSON.parse(p.tasting_notes as string); } catch { return []; } })()
        : (p.tasting_notes || []);

      if (!tastingNotes.length && !p.mood && !p.experience) {
        return; // Nothing to migrate
      }

      const prompt = `Map this tea's existing free-text data to structured taxonomy term IDs.

Tea: ${name} (${p.type})
Existing tasting notes: ${(tastingNotes as string[]).join(', ')}
Mood: ${p.mood || 'none'}
Experience: ${p.experience || 'none'}
Description: ${(p.description as string || '').slice(0, 200)}
Terroir: ${p.terroir || 'none'}
Processing: ${p.processing_notes || 'none'}

Available taxonomy term IDs:
${TASTING_TAXONOMY_TERMS}

Return arrays of matching term IDs for each category. Only include terms that are clearly supported by the data. Leave categories empty if no data supports them.`;

      try {
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': env.ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 512,
            messages: [{ role: 'user', content: prompt }],
            tools: [{
              name: 'map_tasting_data',
              description: 'Map free-text tea data to structured taxonomy term IDs.',
              input_schema: {
                type: 'object',
                properties: {
                  flavor: { type: 'array', items: { type: 'string' } },
                  body: { type: 'array', items: { type: 'string' } },
                  finish: { type: 'array', items: { type: 'string' } },
                  feeling: { type: 'array', items: { type: 'string' } },
                  'liquor-color': { type: 'array', items: { type: 'string' } },
                  brewing: { type: 'array', items: { type: 'string' } },
                },
                additionalProperties: false,
              },
            }],
            tool_choice: { type: 'tool', name: 'map_tasting_data' },
          }),
        });

        if (!claudeRes.ok) {
          errors.push(`${p.id}: Claude API ${claudeRes.status}`);
          return;
        }

        const claudeData = await claudeRes.json() as any;
        const toolUse = claudeData.content?.find((b: any) => b.type === 'tool_use');
        if (!toolUse?.input) {
          errors.push(`${p.id}: No structured output`);
          return;
        }

        // Clean: remove empty arrays
        const tasting: Record<string, string[]> = {};
        for (const [key, val] of Object.entries(toolUse.input)) {
          if (Array.isArray(val) && val.length > 0) {
            tasting[key] = val as string[];
          }
        }

        if (Object.keys(tasting).length > 0) {
          await env.DB.prepare('UPDATE products SET tasting = ? WHERE id = ? AND account_id = ?')
            .bind(JSON.stringify(tasting), p.id, accountId)
            .run();
          migrated.push(p.id as string);
        }
      } catch (err: any) {
        errors.push(`${p.id}: ${err.message}`);
      }
    });

    await Promise.all(promises);
  }

  return json({ migrated: migrated.length, errors, total: products.length });
};

// ── Activity Logs ──
const handleGetActivityLogs: Handler = async (request, env) => {
  const ctx = await requireOwnerTier(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const action = url.searchParams.get('action');
  const search = url.searchParams.get('search');
  const entityId = url.searchParams.get('entity_id');

  const conditions: string[] = ['account_id = ?'];
  const binds: any[] = [accountId];

  if (action) { conditions.push('action = ?'); binds.push(action); }
  if (search) { conditions.push('details LIKE ?'); binds.push(`%${search}%`); }
  if (entityId) { conditions.push('entity_id = ?'); binds.push(entityId); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const result = await env.DB.prepare(
    `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();

  const countResult = await env.DB.prepare(
    `SELECT COUNT(*) as total FROM activity_logs ${where}`
  ).bind(...binds).first();

  return json({ logs: result.results, total: countResult?.total || 0 });
};

// ── Image Upload (R2) — partitioned by account ──
const handleUploadImage: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  if (!env.MEDIA_BUCKET) {
    return json({ error: 'R2 media bucket not configured' }, 503);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return json({ error: 'Expected multipart/form-data' }, 400);
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) return json({ error: 'No file provided' }, 400);

  const ext = file.name.split('.').pop() || 'jpg';
  const key = `accounts/${accountId}/products/${crypto.randomUUID()}.${ext}`;

  await env.MEDIA_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const publicUrl = `https://media.teajia.co/${key}`;

  return json({ url: publicUrl, key }, 201);
};

// ── Extract Product Info from Image (Gemini Flash) ──
const handleExtractFromImage: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  if (!env.GEMINI_API_KEY) {
    return json({ error: 'GEMINI_API_KEY not configured' }, 503);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return json({ error: 'Expected multipart/form-data' }, 400);
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return json({ error: 'No image provided' }, 400);

  // Convert image to base64 for Gemini
  const arrayBuffer = await file.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  const mimeType = file.type || 'image/jpeg';

  // Also upload to R2 so the draft product has an image (account-partitioned)
  let imageUrl = '';
  if (env.MEDIA_BUCKET) {
    const ext = file.name.split('.').pop() || 'jpg';
    const key = `accounts/${accountId}/products/${crypto.randomUUID()}.${ext}`;
    await env.MEDIA_BUCKET.put(key, new Uint8Array(arrayBuffer), {
      httpMetadata: { contentType: mimeType },
    });
    imageUrl = `https://media.teajia.co/${key}`;
  }

  // Call Gemini Flash to extract product info from the image
  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
            {
              text: `You are a tea product data extractor. Analyze this image of a tea product (package, label, menu listing, or price tag) and extract as much information as possible.

Return ONLY a valid JSON object with these fields (omit any you can't determine):
{
  "givenName": "The tea's name in English (translate if needed)",
  "chineseName": "Chinese characters if visible",
  "productName": "Cultivar or botanical name if identifiable (e.g. Da Hong Pao, Tie Guan Yin)",
  "type": "One of: Green, Yellow, White, Oolong, Red, Dark, Sheng, Shou, Herbal, Teaware, Misc",
  "form": "One of: Loose Leaf, Cake, Tuo, Brick, Rolled, Ball, Powder, Bag, Other",
  "year": 2024,
  "originCountry": "Country of origin",
  "originRegion": "Specific region if visible",
  "vendor": "Brand or vendor name if visible",
  "costAmount": 0,
  "costCurrency": "One of: USD, NT, Yuan, IDR, JPY, MYR, HKD, UNK",
  "quantityPurchased": 0,
  "description": "Brief description based on what you see",
  "notes": "Any other useful info from the image (brewing instructions, tasting notes, etc.)"
}

Important:
- Translate all Chinese/Japanese/other text to English for givenName and description
- Keep chineseName in original characters
- For costAmount, extract the numeric price if visible
- For quantityPurchased, extract grams/weight if visible (always in grams)
- If you see a price like "NT$300" set costAmount=300 and costCurrency="NT"
- Return ONLY the JSON object, no markdown formatting or explanation`,
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    return json({ error: `Gemini API error: ${geminiRes.status}`, details: errText }, 502);
  }

  const geminiData = await geminiRes.json() as any;
  const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse the JSON from Gemini's response (strip markdown fences if present)
  let extracted: Record<string, any> = {};
  try {
    const jsonStr = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    extracted = JSON.parse(jsonStr);
  } catch {
    return json({ error: 'Failed to parse Gemini response', raw: rawText }, 500);
  }

  // Attach the uploaded image URL
  if (imageUrl) {
    extracted.imageUrl = imageUrl;
  }

  return json(extracted);
};

// ── Waitlist Cascade Helper ──
async function cascadeWaitlist(env: Env, eventId: string, claimWindowMinutes: number): Promise<void> {
  const next = await env.DB.prepare(
    `SELECT id FROM event_attendees
     WHERE event_id = ? AND status = 'waitlist'
     ORDER BY waitlist_position ASC, created_at ASC LIMIT 1`
  ).bind(eventId).first();

  if (next) {
    const expiresAt = new Date(Date.now() + claimWindowMinutes * 60 * 1000).toISOString();
    await env.DB.prepare(
      `UPDATE event_attendees SET claim_expires_at = ? WHERE id = ?`
    ).bind(expiresAt, next.id).run();

    // Create a waitlist_promotion notification
    await env.DB.prepare(
      `INSERT INTO event_notifications (id, event_id, attendee_id, type, message_template, status)
       VALUES (?, ?, ?, 'waitlist_promotion', 'A spot has opened up! Claim it before it expires.', 'pending')`
    ).bind(crypto.randomUUID(), eventId, next.id).run();
  }
}

// ── Event Public Routes ──

const handleGetEventBySlug: Handler = async (_request, env, params) => {
  const event = await env.DB.prepare(
    `SELECT e.id, e.slug, e.title, e.subtitle, e.description, e.flyer_image_url, e.event_date, e.event_end_date,
            e.location_name, e.address_text, e.map_link, e.guidelines_text, e.venue_guide, e.total_capacity, e.timezone, e.status,
            e.session_flow, e.playlist_url, e.event_format, e.gathering_type, e.area_hint, e.mood_hints, e.created_at,
            e.venue_id,
            v.photos AS venue_photos,
            a.location_country AS account_location_country
     FROM events e
     JOIN accounts a ON a.id = e.account_id
     LEFT JOIN venues v ON v.id = e.venue_id
     WHERE e.slug = ? AND e.status = 'active'`
  ).bind(params.slug).first();

  if (!event) return json({ error: 'Event not found' }, 404);

  const count = await env.DB.prepare(
    `SELECT COALESCE(SUM(1 + plus_one), 0) as total
     FROM event_attendees WHERE event_id = ? AND status = 'confirmed'`
  ).bind(event.id).first();

  const confirmedCount = (count?.total as number) || 0;

  // First names of guests who opted in to the public guest list
  const guestListRows = await env.DB.prepare(
    `SELECT full_name FROM event_attendees
     WHERE event_id = ? AND status = 'confirmed' AND show_in_guest_list = 1
     ORDER BY updated_at ASC LIMIT 20`
  ).bind(event.id).all();
  const confirmedNames = (guestListRows.results ?? []).map(
    (r) => (r.full_name as string).split(' ')[0]
  );

  let venuePhotos: string[] = [];
  if (event.venue_photos) {
    try { venuePhotos = JSON.parse(event.venue_photos as string); } catch { venuePhotos = []; }
  }

  return cachedJson({
    ...event,
    venue_photos: venuePhotos,
    confirmed_count: confirmedCount,
    confirmed_names: confirmedNames,
    seats_remaining: (event.total_capacity as number) - confirmedCount,
  }, 30);
};

// GET /api/events/:slug/recap — public post-session recap (no auth required)
// Only returns data for completed/closed events where the host has published
// a post-session record. The tea_menu always uses the public menu endpoint data
// so product IDs are available for shop links.
const handleGetPublicEventRecap: Handler = async (_request, env, params) => {
  // Resolve event by slug — only completed or closed events are accessible
  const event = await env.DB.prepare(
    `SELECT id, slug, title, subtitle, flyer_image_url, event_date, status
     FROM events WHERE slug = ? AND status IN ('closed', 'completed', 'archived')`
  ).bind(params.slug).first();

  if (!event) return json({ error: 'Recap not found or event is still upcoming' }, 404);

  const postSession = await env.DB.prepare(
    `SELECT id, session_notes, playlist_url, gallery_images, shared_tasting_notes
     FROM event_post_session WHERE event_id = ?`
  ).bind(event.id).first();

  if (!postSession) return json({ error: 'Post-session data not yet available' }, 404);

  // Parse JSON fields safely
  let galleryImages: string[] | null = null;
  if (postSession.gallery_images) {
    try { galleryImages = JSON.parse(postSession.gallery_images as string); } catch { galleryImages = null; }
  }
  let sharedTastingNotes: string[] | null = null;
  if (postSession.shared_tasting_notes) {
    try { sharedTastingNotes = JSON.parse(postSession.shared_tasting_notes as string); } catch { sharedTastingNotes = null; }
  }

  // Fetch tea menu for the event with product details for shop links
  const menuRows = await env.DB.prepare(
    `SELECT etm.id, etm.event_id, etm.product_id, etm.custom_name, etm.custom_description,
            etm.brew_order, etm.reveal_date,
            p.product_name, p.product_type, p.image_url as product_image_url
     FROM event_tea_menu etm
     LEFT JOIN products p ON p.id = etm.product_id
     WHERE etm.event_id = ?
     ORDER BY etm.brew_order ASC NULLS LAST`
  ).bind(event.id).all();

  const teaMenu = (menuRows.results ?? []).map((m) => ({
    id: m.id,
    eventId: m.event_id,
    productId: m.product_id || undefined,
    customName: m.custom_name || undefined,
    customDescription: m.custom_description || undefined,
    revealDate: m.reveal_date || undefined,
    brewOrder: m.brew_order != null ? Number(m.brew_order) : undefined,
    productName: m.product_name || undefined,
    productType: m.product_type || undefined,
    productImageUrl: m.product_image_url || undefined,
  }));

  return json({
    event: {
      id: event.id,
      slug: event.slug,
      title: event.title,
      subtitle: event.subtitle,
      event_date: event.event_date,
      flyer_image_url: event.flyer_image_url,
    },
    post_session: {
      id: postSession.id,
      event_id: event.id,
      session_notes: postSession.session_notes || undefined,
      playlist_url: postSession.playlist_url || undefined,
      gallery_images: galleryImages,
      shared_tasting_notes: sharedTastingNotes,
    },
    tea_menu: teaMenu,
  });
};

// GET /api/events — public upcoming events list
// Scoped to platform-owner accounts so multi-tenant events don't bleed through.
const handleListPublicEvents: Handler = async (_request, env, _params) => {
  const rows = await env.DB.prepare(
    `SELECT e.id, e.slug, e.title, e.subtitle, e.description, e.flyer_image_url, e.event_date,
            e.location_name, e.area_hint, e.mood_hints, e.total_capacity, e.timezone, e.status,
            COALESCE(SUM(CASE WHEN ea.status = 'confirmed' THEN 1 + ea.plus_one ELSE 0 END), 0) AS confirmed_count
     FROM events e
     JOIN accounts a ON a.id = e.account_id
     LEFT JOIN event_attendees ea ON ea.event_id = e.id
     WHERE e.status = 'active'
       AND e.event_date >= datetime('now')
       AND a.is_platform_owner = 1
     GROUP BY e.id
     ORDER BY e.event_date ASC
     LIMIT 20`
  ).all();

  const events = (rows.results ?? []).map((ev) => {
    const confirmedCount = (ev.confirmed_count as number) || 0;
    return {
      ...ev,
      confirmed_count: confirmedCount,
      seats_remaining: (ev.total_capacity as number) - confirmedCount,
    };
  });

  return swrJson(events, 300, 3600);
};

const handleRSVP: Handler = async (request, env, params) => {
  // Public RSVP — resolve the event's account so all inserts (customer,
  // attendee, activity log) are attributed to the right store.
  const event = await env.DB.prepare(
    `SELECT id, account_id, total_capacity, claim_window_minutes FROM events WHERE slug = ? AND status = 'active'`
  ).bind(params.slug).first();

  if (!event) return json({ error: 'Event not found' }, 404);
  const accountId = event.account_id as string;

  const body = await request.json() as Record<string, any>;
  const {
    full_name, phone_number, email,
    guest_requests, contact_method,
    plus_one, plus_one_name,
    photo_consent, notes, tea_preference, bringing_tea,
    show_in_guest_list,
  } = body;

  if (!full_name) return json({ error: 'full_name is required' }, 400);
  if (!phone_number && !email) return json({ error: 'phone_number or email is required' }, 400);

  const contactField = phone_number ? 'phone_number' : 'email';
  const contactValue = phone_number || email;
  const phoneSuffix = phone_number ? phone_number.replace(/\D/g, '').slice(-9) : null;
  const existing = phoneSuffix
    ? await env.DB.prepare(
        `SELECT magic_token, status FROM event_attendees
         WHERE event_id = ? AND (phone_number = ? OR (length(?) = 9 AND phone_number LIKE ?))`
      ).bind(event.id, phone_number, phoneSuffix, `%${phoneSuffix}`).first()
    : await env.DB.prepare(
        `SELECT magic_token, status FROM event_attendees WHERE event_id = ? AND ${contactField} = ?`
      ).bind(event.id, contactValue).first();

  if (existing) {
    return json({
      magic_token: existing.magic_token,
      status: existing.status,
      redirect_url: `/m/${existing.magic_token}`,
      existing: true,
    });
  }

  // Golden tier detection — look up customer within this account only.
  let accessTier = 'standard';
  let customerId: string | null = null;

  let customer: Record<string, unknown> | null = null;
  if (phone_number) {
    const suffix = phone_number.replace(/\D/g, '').slice(-9);
    customer = await env.DB.prepare(
      `SELECT id, tags FROM customers
       WHERE account_id = ?
       AND (phone = ? OR whatsapp = ?
            OR (length(?) = 9 AND (phone LIKE ? OR whatsapp LIKE ?)))`
    ).bind(accountId, phone_number, phone_number, suffix, `%${suffix}`, `%${suffix}`).first() as Record<string, unknown> | null;
  }
  if (!customer && email) {
    customer = await env.DB.prepare(
      `SELECT id, tags FROM customers WHERE email = ? AND account_id = ?`
    ).bind(email, accountId).first() as Record<string, unknown> | null;
  }

  if (customer) {
    customerId = customer.id as string;
    try {
      const tags = typeof customer.tags === 'string' ? JSON.parse(customer.tags) : customer.tags;
      if (Array.isArray(tags) && tags.some((t: string) => t.toLowerCase() === 'golden')) {
        accessTier = 'golden';
      }
    } catch {}
  } else {
    const newCustomerId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO customers (id, account_id, name, phone, email, whatsapp, contact_preference)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      newCustomerId,
      accountId,
      full_name,
      phone_number || null,
      email || null,
      phone_number || null,
      contact_method || 'whatsapp'
    ).run();
    customerId = newCustomerId;
  }

  const status = 'requested';
  const magicToken = crypto.randomUUID();

  let guestRequestsJson: string | null = null;
  if (Array.isArray(guest_requests) && guest_requests.length > 0) {
    const normalised = guest_requests.map((g: any) => ({
      nameHint: g.nameHint || g.name_hint || '',
      contact: g.contact || null,
      approved: null,
    }));
    guestRequestsJson = JSON.stringify(normalised);
  } else if (plus_one) {
    guestRequestsJson = JSON.stringify([{ nameHint: plus_one_name || 'guest', approved: null }]);
  }

  const attendeeId = crypto.randomUUID();

  const batchOps: ReturnType<typeof env.DB.prepare>[] = [
    env.DB.prepare(
      `INSERT INTO event_attendees
         (id, account_id, event_id, customer_id, full_name, phone_number, email, plus_one, plus_one_name,
          access_tier, status, magic_token, photo_consent, notes, tea_preference, bringing_tea,
          guest_requests, contact_method, source, show_in_guest_list)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      attendeeId,
      accountId,
      event.id,
      customerId,
      full_name,
      phone_number || null,
      email || null,
      plus_one ? 1 : 0,
      plus_one_name || null,
      accessTier,
      status,
      magicToken,
      photo_consent ? 1 : 0,
      notes || null,
      tea_preference || null,
      bringing_tea || null,
      guestRequestsJson,
      contact_method || 'whatsapp',
      'direct',
      show_in_guest_list ? 1 : 0
    ),
    buildActivityLog(env, 'rsvp_requested', `${full_name} requested a seat`, null, 'event_attendee', attendeeId, accountId),
  ];

  // If the user is authenticated and submitted a phone number they don't have
  // saved yet, persist it to their profile so future RSVPs pre-fill correctly.
  if (phone_number) {
    const rawToken = isAuthed(request);
    if (rawToken) {
      const valid = await verifyToken(rawToken, env.JWT_SECRET);
      if (valid) {
        const claims = parseToken(rawToken);
        if (claims?.sub) {
          const userRow = await env.DB.prepare(
            'SELECT phone FROM users WHERE id = ?'
          ).bind(claims.sub).first();
          if (userRow && !userRow.phone) {
            batchOps.push(
              env.DB.prepare('UPDATE users SET phone = ? WHERE id = ?')
                .bind(phone_number, claims.sub)
            );
          }
        }
      }
    }
  }

  await env.DB.batch(batchOps);

  return json({
    magic_token: magicToken,
    status,
    redirect_url: `/m/${magicToken}`,
  }, 201);
};

const handleGetEventAvailability: Handler = async (_request, env, params) => {
  const event = await env.DB.prepare(
    `SELECT id, total_capacity FROM events WHERE slug = ? AND status = 'active'`
  ).bind(params.slug).first();

  if (!event) return json({ error: 'Event not found' }, 404);

  const count = await env.DB.prepare(
    `SELECT COALESCE(SUM(1 + plus_one), 0) as total
     FROM event_attendees WHERE event_id = ? AND status = 'confirmed'`
  ).bind(event.id).first();

  const confirmedCount = (count?.total as number) || 0;
  const totalCapacity = event.total_capacity as number;

  return cachedJson({
    total_capacity: totalCapacity,
    confirmed_count: confirmedCount,
    seats_remaining: totalCapacity - confirmedCount,
    is_full: confirmedCount >= totalCapacity,
  }, 10);
};

const handleGetRSVP: Handler = async (_request, env, params) => {
  const attendee = await env.DB.prepare(
    `SELECT ea.*, e.title, e.subtitle, e.description, e.flyer_image_url, e.event_date, e.event_end_date,
            e.location_name, e.address_text, e.map_link, e.guidelines_text, e.venue_guide,
            e.timezone, e.status as event_status, e.session_flow, e.playlist_url, e.slug,
            e.briefing_cards, e.area_hint, e.mood_hints,
            v.photos AS venue_photos
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     LEFT JOIN venues v ON v.id = e.venue_id
     WHERE ea.magic_token = ?`
  ).bind(params.token).first();

  if (!attendee) return json({ error: 'RSVP not found' }, 404);

  // Parse JSON fields
  let sessionFlow = null;
  if (attendee.session_flow) {
    try { sessionFlow = JSON.parse(attendee.session_flow as string); } catch { sessionFlow = attendee.session_flow; }
  }
  let briefingCards = null;
  if (attendee.briefing_cards) {
    try { briefingCards = JSON.parse(attendee.briefing_cards as string); } catch {}
  }
  let moodHints = null;
  if (attendee.mood_hints) {
    try { moodHints = JSON.parse(attendee.mood_hints as string); } catch {}
  }
  let guestRequests = null;
  if (attendee.guest_requests) {
    try { guestRequests = JSON.parse(attendee.guest_requests as string); } catch {}
  }
  let venuePhotos: string[] = [];
  if (attendee.venue_photos) {
    try { venuePhotos = JSON.parse(attendee.venue_photos as string); } catch {}
  }

  // Address gating: only reveal full address + map to confirmed attendees
  const isConfirmed = attendee.status === 'confirmed';

  // Get revealed tea menu items
  const menu = await env.DB.prepare(
    `SELECT etm.*, p.given_name, p.product_name, p.chinese_name, p.type, p.image_url, p.description as product_description
     FROM event_tea_menu etm
     LEFT JOIN products p ON p.id = etm.product_id
     WHERE etm.event_id = ? AND (etm.reveal_date IS NULL OR etm.reveal_date <= datetime('now'))
     ORDER BY etm.brew_order ASC`
  ).bind(attendee.event_id).all();

  // Get guest invites for this attendee
  const guestInvites = await env.DB.prepare(
    `SELECT id, invite_token, name_hint, contact, claimed_by_name, status, created_at, claimed_at
     FROM guest_invites WHERE parent_attendee_id = ?`
  ).bind(attendee.id).all();

  return json({
    attendee: {
      id: attendee.id,
      full_name: attendee.full_name,
      phone_number: attendee.phone_number,
      email: attendee.email,
      plus_one: attendee.plus_one,
      plus_one_name: attendee.plus_one_name,
      access_tier: attendee.access_tier,
      status: attendee.status,
      magic_token: attendee.magic_token,
      photo_consent: attendee.photo_consent,
      notes: attendee.notes,
      tea_preference: attendee.tea_preference,
      bringing_tea: attendee.bringing_tea,
      waitlist_position: attendee.waitlist_position,
      claimed_at: attendee.claimed_at,
      claim_expires_at: attendee.claim_expires_at,
      attended: attendee.attended,
      created_at: attendee.created_at,
      guest_requests: guestRequests,
      contact_method: attendee.contact_method,
      first_visit_briefed: attendee.first_visit_briefed,
    },
    event: {
      slug: attendee.slug,
      title: attendee.title,
      subtitle: attendee.subtitle,
      description: attendee.description,
      flyer_image_url: attendee.flyer_image_url,
      event_date: attendee.event_date,
      event_end_date: attendee.event_end_date,
      location_name: attendee.location_name,
      // Full address + map only revealed to confirmed attendees
      address_text: isConfirmed ? attendee.address_text : null,
      map_link: isConfirmed ? attendee.map_link : null,
      area_hint: attendee.area_hint,
      guidelines_text: attendee.guidelines_text,
      venue_guide: isConfirmed ? attendee.venue_guide : null,
      venue_photos: isConfirmed ? venuePhotos : [],
      timezone: attendee.timezone,
      status: attendee.event_status,
      session_flow: sessionFlow,
      playlist_url: attendee.playlist_url,
      briefing_cards: briefingCards,
      mood_hints: moodHints,
    },
    tea_menu: menu.results,
    guest_invites: guestInvites.results,
  });
};

const handleUpdateRSVP: Handler = async (request, env, params) => {
  const attendee = await env.DB.prepare(
    `SELECT ea.*, e.total_capacity, e.claim_window_minutes, e.id as eid
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.magic_token = ?`
  ).bind(params.token).first();

  if (!attendee) return json({ error: 'RSVP not found' }, 404);

  const body = await request.json() as Record<string, any>;

  // Handle cancellation
  if (body.cancel) {
    await env.DB.prepare(
      `UPDATE event_attendees SET status = 'cancelled' WHERE id = ?`
    ).bind(attendee.id).run();

    // Cascade waitlist
    await cascadeWaitlist(env, attendee.eid as string, (attendee.claim_window_minutes as number) || 60);

    return json({ success: true, status: 'cancelled' });
  }

  // Handle guest list visibility toggle
  if (body.show_in_guest_list !== undefined) {
    await env.DB.prepare(
      `UPDATE event_attendees SET show_in_guest_list = ? WHERE id = ?`
    ).bind(body.show_in_guest_list ? 1 : 0, attendee.id).run();
    return json({ success: true });
  }

  // Handle plus_one change
  if (body.plus_one !== undefined) {
    const newPlusOne = body.plus_one ? 1 : 0;
    const oldPlusOne = (attendee.plus_one as number) || 0;

    if (newPlusOne > oldPlusOne && attendee.status === 'confirmed') {
      // Adding a plus one — check capacity
      const count = await env.DB.prepare(
        `SELECT COALESCE(SUM(1 + plus_one), 0) as total
         FROM event_attendees WHERE event_id = ? AND status = 'confirmed'`
      ).bind(attendee.eid).first();

      const confirmedTotal = (count?.total as number) || 0;
      const totalCapacity = attendee.total_capacity as number;

      if (confirmedTotal + 1 > totalCapacity) {
        return json({ error: 'No capacity for plus one' }, 409);
      }
    }

    await env.DB.prepare(
      `UPDATE event_attendees SET plus_one = ?, plus_one_name = ? WHERE id = ?`
    ).bind(newPlusOne, body.plus_one_name || null, attendee.id).run();

    // If removing plus one and there are waitlisted people, cascade
    if (newPlusOne < oldPlusOne) {
      await cascadeWaitlist(env, attendee.eid as string, (attendee.claim_window_minutes as number) || 60);
    }
  }

  return json({ success: true });
};

const handleClaimSpot: Handler = async (_request, env, params) => {
  const attendee = await env.DB.prepare(
    `SELECT ea.*, e.claim_window_minutes, e.id as eid
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.magic_token = ? AND ea.status = 'waitlist'`
  ).bind(params.token).first();

  if (!attendee) return json({ error: 'RSVP not found or not on waitlist' }, 404);

  if (!attendee.claim_expires_at) {
    return json({ error: 'No claim offer pending' }, 400);
  }

  const expiresAt = new Date(attendee.claim_expires_at as string);
  if (expiresAt <= new Date()) {
    // Expired — cascade to next
    await env.DB.prepare(
      `UPDATE event_attendees SET claim_expires_at = NULL WHERE id = ?`
    ).bind(attendee.id).run();

    await cascadeWaitlist(env, attendee.eid as string, (attendee.claim_window_minutes as number) || 60);

    return json({ error: 'Claim window has expired' }, 410);
  }

  // Claim the spot
  await env.DB.prepare(
    `UPDATE event_attendees SET status = 'confirmed', claimed_at = datetime('now'), claim_expires_at = NULL WHERE id = ?`
  ).bind(attendee.id).run();

  // Create spot_claimed notification
  await env.DB.prepare(
    `INSERT INTO event_notifications (id, event_id, attendee_id, type, message_template, status)
     VALUES (?, ?, ?, 'spot_claimed', 'You have claimed your spot!', 'sent')`
  ).bind(crypto.randomUUID(), attendee.eid, attendee.id).run();

  return json({ success: true, status: 'confirmed' });
};

const handleGetPostSession: Handler = async (_request, env, params) => {
  const attendee = await env.DB.prepare(
    `SELECT ea.event_id FROM event_attendees ea WHERE ea.magic_token = ?`
  ).bind(params.token).first();

  if (!attendee) return json({ error: 'RSVP not found' }, 404);

  const postSession = await env.DB.prepare(
    `SELECT * FROM event_post_session WHERE event_id = ?`
  ).bind(attendee.event_id).first();

  if (!postSession) return json({ error: 'Post-session data not yet available' }, 404);

  // Parse JSON fields
  let galleryImages = null;
  if (postSession.gallery_images) {
    try { galleryImages = JSON.parse(postSession.gallery_images as string); } catch { galleryImages = postSession.gallery_images; }
  }
  let teaLedger = null;
  if (postSession.tea_ledger) {
    try { teaLedger = JSON.parse(postSession.tea_ledger as string); } catch { teaLedger = postSession.tea_ledger; }
  }

  // Get aggregated tasting notes (anonymous)
  const notes = await env.DB.prepare(
    `SELECT etn.tea_menu_id, etn.rating, etn.impression, etn.is_favorite,
            etm.custom_name, p.given_name, p.product_name
     FROM event_tasting_notes etn
     LEFT JOIN event_tea_menu etm ON etm.id = etn.tea_menu_id
     LEFT JOIN products p ON p.id = etm.product_id
     WHERE etn.event_id = ?
     ORDER BY etm.brew_order ASC`
  ).bind(attendee.event_id).all();

  return json({
    ...postSession,
    gallery_images: galleryImages,
    tea_ledger: teaLedger,
    tasting_notes: notes.results,
  });
};

const handleSubmitTastingNotes: Handler = async (request, env, params) => {
  const attendee = await env.DB.prepare(
    `SELECT ea.id, ea.event_id, e.event_date
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.magic_token = ?`
  ).bind(params.token).first();

  if (!attendee) return json({ error: 'RSVP not found' }, 404);

  // Verify event date has passed
  const eventDate = new Date(attendee.event_date as string);
  if (eventDate > new Date()) {
    return json({ error: 'Tasting notes can only be submitted after the event' }, 400);
  }

  const notes = await request.json() as Array<{ tea_menu_id?: string; rating?: number; impression?: string; is_favorite?: boolean }>;
  if (!Array.isArray(notes)) return json({ error: 'Expected an array of tasting notes' }, 400);

  const stmts = notes.map(note =>
    env.DB.prepare(
      `INSERT INTO event_tasting_notes (id, event_id, attendee_id, tea_menu_id, rating, impression, is_favorite)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      attendee.event_id,
      attendee.id,
      note.tea_menu_id || null,
      note.rating || null,
      note.impression || null,
      note.is_favorite ? 1 : 0
    )
  );

  await env.DB.batch(stmts);

  return json({ success: true, count: notes.length }, 201);
};

const handleFindRSVP: Handler = async (request, env, params) => {
  const event = await env.DB.prepare(
    `SELECT id FROM events WHERE slug = ?`
  ).bind(params.slug).first();

  if (!event) return json({ error: 'Event not found' }, 404);

  let lookupField: string;
  let lookupValue: string;

  // Account-based lookup: authenticated request with no body
  const token = isAuthed(request);
  const contentLength = request.headers.get('content-length');
  const hasBody = contentLength !== null && contentLength !== '0';

  if (token && !hasBody) {
    const status = await classifyToken(token, env.JWT_SECRET);
    if (status !== 'valid') return json({ error: 'Unauthorized' }, 401);
    const claims = parseToken(token);
    if (!claims?.email) return json({ error: 'Account email not found' }, 400);
    lookupField = 'email';
    lookupValue = claims.email;
  } else {
    const body = await request.json() as { phone_number?: string; email?: string };
    if (body.phone_number) {
      lookupField = 'phone_number';
      lookupValue = body.phone_number;
    } else if (body.email) {
      lookupField = 'email';
      lookupValue = body.email;
    } else {
      return json({ error: 'phone_number or email is required' }, 400);
    }
  }

  const attendee = await env.DB.prepare(
    `SELECT magic_token, status FROM event_attendees WHERE event_id = ? AND ${lookupField} = ?`
  ).bind(event.id, lookupValue).first();

  if (!attendee) return json({ error: 'RSVP not found' }, 404);

  return json({
    magic_token: attendee.magic_token,
    status: attendee.status,
    redirect_url: `/m/${attendee.magic_token}`,
  });
};

// ── Event Admin Routes ──

const handleGetEvents: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const result = await env.DB.prepare(`
    SELECT e.*,
      COALESCE(SUM(CASE WHEN ea.status = 'confirmed' THEN 1 + ea.plus_one ELSE 0 END), 0) as confirmed_count,
      COALESCE(SUM(CASE WHEN ea.status = 'waitlist' THEN 1 ELSE 0 END), 0) as waitlist_count,
      COALESCE(SUM(CASE WHEN ea.status = 'requested' THEN 1 ELSE 0 END), 0) as requested_count,
      COUNT(ea.id) as total_attendees,
      COALESCE((SELECT COUNT(*) FROM interest_signups si WHERE si.event_id = e.id AND si.converted_at IS NULL), 0) as interest_count
    FROM events e
    LEFT JOIN event_attendees ea ON ea.event_id = e.id AND ea.status != 'cancelled'
    WHERE e.account_id = ?
    GROUP BY e.id
    ORDER BY e.event_date DESC
  `).bind(accountId).all();

  return json(result.results);
};

const handleGetEvent: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const result = await env.DB.prepare(`
    SELECT e.*,
      COALESCE(SUM(CASE WHEN ea.status = 'confirmed' THEN 1 + ea.plus_one ELSE 0 END), 0) as confirmed_count,
      COALESCE(SUM(CASE WHEN ea.status = 'waitlist' THEN 1 ELSE 0 END), 0) as waitlist_count,
      COALESCE(SUM(CASE WHEN ea.status = 'requested' THEN 1 ELSE 0 END), 0) as requested_count,
      COUNT(ea.id) as total_attendees,
      COALESCE((SELECT COUNT(*) FROM interest_signups si WHERE si.event_id = e.id AND si.converted_at IS NULL), 0) as interest_count
    FROM events e
    LEFT JOIN event_attendees ea ON ea.event_id = e.id AND ea.status != 'cancelled'
    WHERE e.id = ? AND e.account_id = ?
    GROUP BY e.id
  `).bind(params.id, accountId).first();

  if (!result) return json({ error: 'Event not found' }, 404);
  return json(result);
};

const handleCreateEvent: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  if (!body.slug || !body.title || !body.event_date || !body.total_capacity) {
    return json({ error: 'slug, title, event_date, and total_capacity are required' }, 400);
  }

  // Event slug must be unique globally (it's used in /api/events/:slug/public
  // and in shareable URLs across the network).
  const existingSlug = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(body.slug).first();
  if (existingSlug) return json({ error: 'An event with this slug already exists' }, 409);

  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO events (id, account_id, slug, title, subtitle, description, flyer_image_url, event_date, event_end_date,
       location_name, address_text, map_link, guidelines_text, venue_guide, total_capacity, claim_window_minutes,
       timezone, status, session_flow, playlist_url, location_id, event_format,
       venue_id, active_space_ids, gathering_type, area_hint, mood_hints, briefing_cards)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    accountId,
    body.slug,
    body.title,
    body.subtitle || null,
    body.description || null,
    body.flyer_image_url || null,
    body.event_date,
    body.event_end_date || null,
    body.location_name || null,
    body.address_text || null,
    body.map_link || null,
    body.guidelines_text || null,
    body.venue_guide || null,
    body.total_capacity,
    body.claim_window_minutes || 60,
    body.timezone || 'Asia/Taipei',
    body.status || 'draft',
    body.session_flow ? (typeof body.session_flow === 'string' ? body.session_flow : JSON.stringify(body.session_flow)) : null,
    body.playlist_url || null,
    body.location_id || null,
    body.event_format || 'private_tasting',
    body.venue_id || null,
    body.active_space_ids ? (typeof body.active_space_ids === 'string' ? body.active_space_ids : JSON.stringify(body.active_space_ids)) : null,
    body.gathering_type || null,
    body.area_hint || null,
    body.mood_hints ? (typeof body.mood_hints === 'string' ? body.mood_hints : JSON.stringify(body.mood_hints)) : null,
    body.briefing_cards ? (typeof body.briefing_cards === 'string' ? body.briefing_cards : JSON.stringify(body.briefing_cards)) : null
  ).run();

  return json({ id, slug: body.slug }, 201);
};

const handleUpdateEvent: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.account_id;

  if (body.session_flow && typeof body.session_flow !== 'string') {
    body.session_flow = JSON.stringify(body.session_flow);
  }
  if (body.active_space_ids && typeof body.active_space_ids !== 'string') {
    body.active_space_ids = JSON.stringify(body.active_space_ids);
  }
  if (body.mood_hints && typeof body.mood_hints !== 'string') {
    body.mood_hints = JSON.stringify(body.mood_hints);
  }
  if (body.briefing_cards && typeof body.briefing_cards !== 'string') {
    body.briefing_cards = JSON.stringify(body.briefing_cards);
  }
  if (body.event_format === undefined) delete body.event_format;

  const EVENT_ALLOWED_COLS = new Set(['title','subtitle','description','slug','status','event_date','event_end_date','end_date','location','location_name','capacity','total_capacity','price_usd','display_currency','event_format','gathering_type','notes','host_name','event_type','max_guests','booking_cutoff_hours','private','image_url','flyer_url','flyer_image_url','claim_window_minutes','venue_id','venue_space_id','active_space_ids','location_id','session_template_id','meta_json','session_flow','address_text','map_link','guidelines_text','area_hint','venue_guide','mood_hints','briefing_cards','timezone','playlist_url']);
  const cols = Object.keys(body).filter(k => EVENT_ALLOWED_COLS.has(k));
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE events SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.id, accountId).run();

  return json({ success: true });
};

const handleDeleteEvent: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  // F8: Release all stock holds for this event before archiving
  const eventHoldKey = `event:${params.id}`;
  await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM stock_holds WHERE invoice_id = ? AND account_id = ?'
    ).bind(eventHoldKey, accountId),
    env.DB.prepare(
      `UPDATE events SET status = 'archived', updated_at = datetime('now') WHERE id = ? AND account_id = ?`
    ).bind(params.id, accountId),
  ]);

  return json({ success: true });
};

const handleGetAttendees: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const result = await env.DB.prepare(
    `SELECT ea.*, c.name as customer_name_linked, c.tags as customer_tags
     FROM event_attendees ea
     LEFT JOIN customers c ON c.id = ea.customer_id
     JOIN events e ON e.id = ea.event_id
     WHERE ea.event_id = ? AND e.account_id = ?
     ORDER BY ea.status ASC, ea.created_at ASC`
  ).bind(params.id, accountId).all();

  // Batch journey preview: collect unique phones/emails, run 2 queries instead of N
  const attendees = result.results as Record<string, any>[];
  const phones = Array.from(new Set(attendees.map(a => a.phone_number).filter(Boolean))) as string[];
  const emails = Array.from(new Set(attendees.filter(a => !a.phone_number).map(a => a.email).filter(Boolean))) as string[];

  const journeyByPhone: Record<string, { sessions_attended: number; last_attended: string | null }> = {};
  const journeyByEmail: Record<string, { sessions_attended: number; last_attended: string | null }> = {};

  if (phones.length > 0) {
    const placeholders = phones.map(() => '?').join(',');
    const phoneRows = await env.DB.prepare(
      `SELECT ea2.phone_number, COUNT(*) as sessions_attended, MAX(e.event_date) as last_attended
       FROM event_attendees ea2
       JOIN events e ON e.id = ea2.event_id
       WHERE ea2.phone_number IN (${placeholders}) AND ea2.status = 'confirmed' AND ea2.attended = 1
       GROUP BY ea2.phone_number`
    ).bind(...phones).all();
    for (const row of phoneRows.results as Record<string, any>[]) {
      journeyByPhone[row.phone_number] = { sessions_attended: row.sessions_attended || 0, last_attended: row.last_attended || null };
    }
  }

  if (emails.length > 0) {
    const placeholders = emails.map(() => '?').join(',');
    const emailRows = await env.DB.prepare(
      `SELECT ea2.email, COUNT(*) as sessions_attended, MAX(e.event_date) as last_attended
       FROM event_attendees ea2
       JOIN events e ON e.id = ea2.event_id
       WHERE ea2.email IN (${placeholders}) AND ea2.status = 'confirmed' AND ea2.attended = 1
       GROUP BY ea2.email`
    ).bind(...emails).all();
    for (const row of emailRows.results as Record<string, any>[]) {
      journeyByEmail[row.email] = { sessions_attended: row.sessions_attended || 0, last_attended: row.last_attended || null };
    }
  }

  const attendeesWithJourney = attendees.map((attendee) => {
    const journey = attendee.phone_number
      ? journeyByPhone[attendee.phone_number]
      : attendee.email
        ? journeyByEmail[attendee.email]
        : null;
    return {
      ...attendee,
      customer_tags: typeof attendee.customer_tags === 'string'
        ? JSON.parse(attendee.customer_tags || '[]')
        : (attendee.customer_tags ?? []),
      journey_preview: journey || { sessions_attended: 0, last_attended: null },
    };
  });

  return json(attendeesWithJourney);
};

// GET /api/admin/pending-attendees — cross-event pending RSVPs
const handleGetPendingAttendees: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  // Step 1: fetch base pending attendees (no N+1 subquery)
  const result = await env.DB.prepare(
    `SELECT ea.id, ea.full_name, ea.phone_number, ea.email, ea.status,
            ea.created_at, ea.guest_requests, ea.notes, ea.access_tier,
            ea.customer_id, ea.contact_method, ea.magic_token, ea.photo_consent,
            ea.plus_one, ea.plus_one_name, ea.tea_preference,
            e.id as event_id, e.title as event_title, e.event_date
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE e.account_id = ? AND ea.status = 'requested'
     ORDER BY e.event_date ASC, ea.created_at ASC`
  ).bind(accountId).all();

  const attendees = result.results as Record<string, any>[];

  // Step 2: collect unique phones and emails for batch journey lookup
  const phones = Array.from(new Set(attendees.map(a => a.phone_number).filter(Boolean))) as string[];
  const emails = Array.from(new Set(attendees.filter(a => !a.phone_number).map(a => a.email).filter(Boolean))) as string[];

  const journeyByPhone: Record<string, { sessions_attended: number; last_attended: string | null }> = {};
  const journeyByEmail: Record<string, { sessions_attended: number; last_attended: string | null }> = {};

  // Step 3: batch journey queries (same pattern as handleGetAttendees)
  if (phones.length > 0) {
    const placeholders = phones.map(() => '?').join(',');
    const phoneRows = await env.DB.prepare(
      `SELECT ea2.phone_number, COUNT(*) as sessions_attended, MAX(e.event_date) as last_attended
       FROM event_attendees ea2
       JOIN events e ON e.id = ea2.event_id
       WHERE ea2.phone_number IN (${placeholders}) AND ea2.status = 'confirmed' AND ea2.attended = 1
       GROUP BY ea2.phone_number`
    ).bind(...phones).all();
    for (const row of phoneRows.results as Record<string, any>[]) {
      journeyByPhone[row.phone_number] = { sessions_attended: row.sessions_attended || 0, last_attended: row.last_attended || null };
    }
  }

  if (emails.length > 0) {
    const placeholders = emails.map(() => '?').join(',');
    const emailRows = await env.DB.prepare(
      `SELECT ea2.email, COUNT(*) as sessions_attended, MAX(e.event_date) as last_attended
       FROM event_attendees ea2
       JOIN events e ON e.id = ea2.event_id
       WHERE ea2.email IN (${placeholders}) AND ea2.status = 'confirmed' AND ea2.attended = 1
       GROUP BY ea2.email`
    ).bind(...emails).all();
    for (const row of emailRows.results as Record<string, any>[]) {
      journeyByEmail[row.email] = { sessions_attended: row.sessions_attended || 0, last_attended: row.last_attended || null };
    }
  }

  // Step 4: favorite_types via customer_id (top 2 tea types by order frequency)
  const customerIds = Array.from(new Set(attendees.map(a => a.customer_id).filter(Boolean))) as string[];
  const favoriteTypesMap: Record<string, string[]> = {};

  if (customerIds.length > 0) {
    const placeholders = customerIds.map(() => '?').join(',');
    const typeRows = await env.DB.prepare(
      `SELECT i.customer_id, p.type, COUNT(*) as cnt
       FROM invoice_line_items ili
       JOIN invoices i ON i.id = ili.invoice_id
       JOIN products p ON p.id = ili.product_id
       WHERE i.customer_id IN (${placeholders}) AND p.type IS NOT NULL
       GROUP BY i.customer_id, p.type
       ORDER BY cnt DESC`
    ).bind(...customerIds).all();
    for (const row of typeRows.results as Record<string, any>[]) {
      if (!favoriteTypesMap[row.customer_id]) {
        favoriteTypesMap[row.customer_id] = [];
      }
      if (favoriteTypesMap[row.customer_id].length < 2) {
        favoriteTypesMap[row.customer_id].push(row.type);
      }
    }
  }

  // Step 5: merge journey data into each attendee
  const enriched = attendees.map((attendee) => {
    const journey = attendee.phone_number
      ? journeyByPhone[attendee.phone_number]
      : attendee.email
        ? journeyByEmail[attendee.email]
        : null;
    return {
      ...attendee,
      sessions_attended: journey?.sessions_attended ?? 0,
      last_attended: journey?.last_attended ?? null,
      favorite_types: favoriteTypesMap[attendee.customer_id] ?? [],
    };
  });

  return json(enriched);
};

// Helper: verify event belongs to the caller's account. Returns a 404-style
// response when not found, so cross-account attempts look the same as
// non-existent events.
async function assertEventInAccount(env: Env, eventId: string, accountId: string): Promise<Response | null> {
  const row = await env.DB.prepare(
    'SELECT id FROM events WHERE id = ? AND account_id = ?'
  ).bind(eventId, accountId).first();
  if (!row) return json({ error: 'Event not found' }, 404);
  return null;
}

const handleUpdateAttendee: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.account_id;

  const attendee = await env.DB.prepare(
    `SELECT ea.*, e.claim_window_minutes, e.id as eid
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.id = ? AND e.account_id = ?`
  ).bind(params.id, accountId).first();

  if (!attendee) return json({ error: 'Attendee not found' }, 404);

  const ATTENDEE_ALLOWED_COLS = new Set(['status','notes','checked_in','attended','paid','payment_method','paid_amount','seat_assignment','guest_count','dietary_notes','rsvp_token','customer_id']);
  const cols = Object.keys(body).filter(k => ATTENDEE_ALLOWED_COLS.has(k));
  if (cols.length === 0) return json({ success: true });
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(`UPDATE event_attendees SET ${sets} WHERE id = ?`)
    .bind(...cols.map(c => body[c] ?? null), params.id).run();

  if (body.status === 'cancelled' && attendee.status !== 'cancelled') {
    await cascadeWaitlist(env, attendee.eid as string, (attendee.claim_window_minutes as number) || 60);
  }

  return json({ success: true });
};

const handleGetNotifications: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  const result = await env.DB.prepare(
    `SELECT en.*, ea.full_name, ea.phone_number
     FROM event_notifications en
     LEFT JOIN event_attendees ea ON ea.id = en.attendee_id
     WHERE en.event_id = ?
     ORDER BY en.created_at DESC`
  ).bind(params.id).all();

  return json(result.results);
};

const handleCreateNotifications: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  const attendees = await env.DB.prepare(
    `SELECT id FROM event_attendees WHERE event_id = ? AND status = 'confirmed'`
  ).bind(params.id).all();

  const stmts = (attendees.results as any[]).map(a =>
    env.DB.prepare(
      `INSERT INTO event_notifications (id, account_id, event_id, attendee_id, type, message_template, status)
       VALUES (?, ?, ?, ?, 'checkin_reminder', 'Reminder: Your tea session is coming up soon!', 'pending')`
    ).bind(crypto.randomUUID(), accountId, params.id, a.id)
  );

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }

  return json({ success: true, count: stmts.length }, 201);
};

const handleUpsertPostSession: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  const body = await request.json() as Record<string, any>;

  const teaLedger = body.tea_ledger ? (typeof body.tea_ledger === 'string' ? body.tea_ledger : JSON.stringify(body.tea_ledger)) : null;
  const galleryImages = body.gallery_images ? (typeof body.gallery_images === 'string' ? body.gallery_images : JSON.stringify(body.gallery_images)) : null;

  const existing = await env.DB.prepare(
    `SELECT id FROM event_post_session WHERE event_id = ?`
  ).bind(params.id).first();

  if (existing) {
    await env.DB.prepare(
      `UPDATE event_post_session SET tea_ledger = ?, playlist_url = ?, gallery_images = ?, session_notes = ? WHERE event_id = ?`
    ).bind(teaLedger, body.playlist_url || null, galleryImages, body.session_notes || null, params.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO event_post_session (id, account_id, event_id, tea_ledger, playlist_url, gallery_images, session_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), accountId, params.id, teaLedger, body.playlist_url || null, galleryImages, body.session_notes || null).run();
  }

  return json({ success: true });
};

const handleDuplicateEvent: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as { slug: string; event_date: string };
  if (!body.slug || !body.event_date) return json({ error: 'slug and event_date are required' }, 400);

  const existingSlug = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(body.slug).first();
  if (existingSlug) return json({ error: 'An event with this slug already exists' }, 409);

  const source = await env.DB.prepare('SELECT * FROM events WHERE id = ? AND account_id = ?')
    .bind(params.id, accountId).first();
  if (!source) return json({ error: 'Source event not found' }, 404);

  const newId = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO events (id, account_id, slug, title, subtitle, description, flyer_image_url, event_date, event_end_date,
       location_name, address_text, map_link, guidelines_text, venue_guide, total_capacity, claim_window_minutes,
       timezone, status, session_flow, playlist_url, event_format,
       venue_id, active_space_ids, gathering_type, area_hint, mood_hints, briefing_cards)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    newId,
    accountId,
    body.slug,
    source.title,
    source.subtitle,
    source.description,
    source.flyer_image_url,
    body.event_date,
    source.event_end_date,
    source.location_name,
    source.address_text,
    source.map_link,
    source.guidelines_text,
    source.venue_guide,
    source.total_capacity,
    source.claim_window_minutes,
    source.timezone,
    source.session_flow,
    source.playlist_url,
    source.event_format || 'private_tasting',
    source.venue_id || null,
    source.active_space_ids || null,
    source.gathering_type || null,
    source.area_hint || null,
    source.mood_hints || null,
    source.briefing_cards || null
  ).run();

  // F38: Clone tea menu entries (including all brewing fields)
  const menu = await env.DB.prepare(
    'SELECT * FROM event_tea_menu WHERE event_id = ? AND account_id = ?'
  ).bind(params.id, accountId).all();
  if (menu.results.length > 0) {
    const menuStmts = (menu.results as any[]).map(m =>
      env.DB.prepare(
        `INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, custom_description, reveal_date, brew_order, brewing_temp, brewing_time, vessel_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), accountId, newId,
        m.product_id, m.custom_name, m.custom_description, m.reveal_date, m.brew_order,
        m.brewing_temp ?? null, m.brewing_time ?? null, m.vessel_type ?? null
      )
    );
    await env.DB.batch(menuStmts);
  }

  return json({ id: newId, slug: body.slug }, 201);
};

const handleBatchAttendance: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  const body = await request.json() as { attendee_ids: string[]; attended: boolean };
  if (!Array.isArray(body.attendee_ids)) return json({ error: 'attendee_ids must be an array' }, 400);

  const attendedVal = body.attended ? 1 : 0;
  const stmts = body.attendee_ids.map(id =>
    env.DB.prepare('UPDATE event_attendees SET attended = ? WHERE id = ? AND event_id = ?')
      .bind(attendedVal, id, params.id)
  );

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }

  return json({ success: true, count: stmts.length });
};

const handleGetTeaMenu: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  const result = await env.DB.prepare(
    `SELECT etm.*, p.given_name, p.product_name, p.chinese_name, p.type, p.image_url
     FROM event_tea_menu etm
     LEFT JOIN products p ON p.id = etm.product_id
     WHERE etm.event_id = ?
     ORDER BY etm.brew_order ASC`
  ).bind(params.id).all();

  return json(result.results);
};

const handleUpsertTeaMenu: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  const items = await request.json() as Array<Record<string, any>>;
  if (!Array.isArray(items)) return json({ error: 'Expected an array of menu items' }, 400);

  const stmts: D1PreparedStatement[] = [];

  for (const item of items) {
    if (item.id) {
      stmts.push(
        env.DB.prepare(
          `UPDATE event_tea_menu SET product_id = ?, custom_name = ?, custom_description = ?, reveal_date = ?, brew_order = ?, tea_type = ?, origin_region = ?
           WHERE id = ? AND event_id = ?`
        ).bind(
          item.product_id || null,
          item.custom_name || null,
          item.custom_description || null,
          item.reveal_date || null,
          item.brew_order ?? null,
          item.tea_type || null,
          item.origin_region || null,
          item.id,
          params.id
        )
      );
    } else {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, custom_description, reveal_date, brew_order, tea_type, origin_region)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          crypto.randomUUID(),
          accountId,
          params.id,
          item.product_id || null,
          item.custom_name || null,
          item.custom_description || null,
          item.reveal_date || null,
          item.brew_order ?? null,
          item.tea_type || null,
          item.origin_region || null
        )
      );
    }
  }

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }

  // F8: Refresh stock holds for this event's tea menu based on seat count
  // We use invoice_id = 'event:{event_id}' as a stable sentinel to track event holds
  try {
    const eventRow = await env.DB.prepare(
      'SELECT total_capacity FROM events WHERE id = ? AND account_id = ?'
    ).bind(params.id, accountId).first() as any;

    const seatCount = Number(eventRow?.total_capacity) || 0;
    if (seatCount > 0) {
      const menuRows = await env.DB.prepare(
        `SELECT etm.product_id, p.serving_grams FROM event_tea_menu etm
         LEFT JOIN products p ON p.id = etm.product_id
         WHERE etm.event_id = ? AND etm.product_id IS NOT NULL`
      ).bind(params.id).all();

      const eventHoldKey = `event:${params.id}`;
      // Clear existing event holds then re-create from current menu
      const holdStmts: D1PreparedStatement[] = [
        env.DB.prepare(
          'DELETE FROM stock_holds WHERE invoice_id = ? AND account_id = ?'
        ).bind(eventHoldKey, accountId),
      ];

      for (const row of menuRows.results as any[]) {
        const servingGrams = Number(row.serving_grams) || 5;
        const heldGrams = seatCount * servingGrams;
        holdStmts.push(
          env.DB.prepare(
            'INSERT INTO stock_holds (id, account_id, invoice_id, product_id, held_grams) VALUES (?, ?, ?, ?, ?)'
          ).bind(crypto.randomUUID(), accountId, eventHoldKey, row.product_id, heldGrams)
        );
      }

      await env.DB.batch(holdStmts);
    }
  } catch {
    // Stock reservation is non-critical — don't fail the menu upsert if it errors
  }

  return json({ success: true, count: stmts.length });
};

const handleDeleteTeaMenuItem: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  await env.DB.prepare(
    'DELETE FROM event_tea_menu WHERE id = ? AND event_id = ?'
  ).bind(params.itemId, params.id).run();

  return json({ success: true });
};

const handleGetTastingNotes: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  const result = await env.DB.prepare(
    `SELECT etn.*, ea.full_name, ea.phone_number, etm.custom_name, p.given_name, p.product_name
     FROM event_tasting_notes etn
     JOIN event_attendees ea ON ea.id = etn.attendee_id
     LEFT JOIN event_tea_menu etm ON etm.id = etn.tea_menu_id
     LEFT JOIN products p ON p.id = etm.product_id
     WHERE etn.event_id = ?
     ORDER BY etm.brew_order ASC, ea.full_name ASC`
  ).bind(params.id).all();

  return json(result.results);
};

// ── Flyer Upload (R2) — partitioned by account ──
const handleUploadFlyer: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  if (!env.MEDIA_BUCKET) {
    return json({ error: 'R2 media bucket not configured' }, 503);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    return json({ error: 'Expected multipart/form-data' }, 400);
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) return json({ error: 'No file provided' }, 400);

  const ext = file.name.split('.').pop() || 'jpg';
  const key = `accounts/${accountId}/flyers/${crypto.randomUUID()}.${ext}`;

  await env.MEDIA_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const publicUrl = `https://media.teajia.co/${key}`;

  return json({ url: publicUrl, key }, 201);
};

// ── Saved Locations ──
const handleGetSavedLocations: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const result = await env.DB.prepare(
    'SELECT * FROM saved_locations WHERE account_id = ? ORDER BY name ASC'
  ).bind(accountId).all();
  return json(result.results);
};

const handleCreateSavedLocation: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const body = await request.json() as Record<string, any>;
  if (!body.name || !body.address) return json({ error: 'name and address are required' }, 400);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO saved_locations (id, account_id, name, address, map_link, guidelines, venue_guide)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, accountId, body.name, body.address, body.map_link || null, body.guidelines || null, body.venue_guide || null).run();
  return json({ id, name: body.name }, 201);
};

const handleUpdateSavedLocation: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const body = await request.json() as Record<string, any>;
  delete body.account_id;
  const LOCATION_ALLOWED_COLS = new Set(['name','address','city','country','notes','type','latitude','longitude','website','phone','map_link','guidelines','venue_guide']);
  const cols = Object.keys(body).filter(k => LOCATION_ALLOWED_COLS.has(k));
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE saved_locations SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.id, accountId).run();
  return json({ success: true });
};

const handleDeleteSavedLocation: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  await env.DB.prepare('DELETE FROM saved_locations WHERE id = ? AND account_id = ?')
    .bind(params.id, accountId).run();
  return json({ success: true });
};

// ── Venues ──

const handleGetVenues: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const venues = await env.DB.prepare(
    'SELECT * FROM venues WHERE account_id = ? ORDER BY name ASC'
  ).bind(accountId).all();
  const spaces = await env.DB.prepare(
    'SELECT * FROM venue_spaces WHERE account_id = ? ORDER BY venue_id, sort_order ASC, name ASC'
  ).bind(accountId).all();
  // Attach spaces to their venue
  const spacesByVenue: Record<string, any[]> = {};
  for (const s of spaces.results) {
    const vid = s.venue_id as string;
    if (!spacesByVenue[vid]) spacesByVenue[vid] = [];
    spacesByVenue[vid].push({ ...s, photos: s.photos ? JSON.parse(s.photos as string) : [], teaStyles: s.tea_styles ? JSON.parse(s.tea_styles as string) : [] });
  }
  const result = venues.results.map(v => ({
    ...v,
    photos: v.photos ? JSON.parse(v.photos as string) : [],
    spaces: spacesByVenue[v.id as string] || [],
  }));
  return json(result);
};

const handleCreateVenue: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const body = await request.json() as Record<string, any>;
  if (!body.name || !body.address) return json({ error: 'name and address are required' }, 400);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO venues (id, account_id, name, address, map_link, area_hint, arrival_notes, website, instagram, photos)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, accountId, body.name, body.address,
    body.map_link || null, body.area_hint || null, body.arrival_notes || null,
    body.website || null, body.instagram || null,
    body.photos ? JSON.stringify(body.photos) : null
  ).run();
  return json({ id, name: body.name }, 201);
};

const handleUpdateVenue: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const body = await request.json() as Record<string, any>;
  delete body.account_id;
  if (body.photos && typeof body.photos !== 'string') body.photos = JSON.stringify(body.photos);
  const VENUE_ALLOWED_COLS = new Set(['name','address','city','country','phone','email','website','description','notes','capacity','photos','status','instagram','wechat','type','map_link','area_hint','arrival_notes']);
  const cols = Object.keys(body).filter(k => VENUE_ALLOWED_COLS.has(k));
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE venues SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.id, accountId).run();
  return json({ success: true });
};

const handleDeleteVenue: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  await env.DB.prepare('DELETE FROM venues WHERE id = ? AND account_id = ?')
    .bind(params.id, accountId).run();
  return json({ success: true });
};

const handleCreateVenueSpace: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const body = await request.json() as Record<string, any>;
  if (!body.name || !body.capacity) return json({ error: 'name and capacity are required' }, 400);
  // Verify venue belongs to this account
  const venue = await env.DB.prepare('SELECT id FROM venues WHERE id = ? AND account_id = ?')
    .bind(params.id, accountId).first();
  if (!venue) return json({ error: 'Venue not found' }, 404);
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO venue_spaces (id, account_id, venue_id, name, capacity, description, photos, tea_styles, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, accountId, params.id, body.name, body.capacity,
    body.description || null,
    body.photos ? JSON.stringify(body.photos) : null,
    body.tea_styles ? JSON.stringify(body.tea_styles) : null,
    body.sort_order ?? 0
  ).run();
  return json({ id, name: body.name }, 201);
};

const handleUpdateVenueSpace: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const body = await request.json() as Record<string, any>;
  delete body.account_id;
  delete body.venue_id;
  if (body.photos && typeof body.photos !== 'string') body.photos = JSON.stringify(body.photos);
  if (body.tea_styles && typeof body.tea_styles !== 'string') body.tea_styles = JSON.stringify(body.tea_styles);
  const cols = Object.keys(body);
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE venue_spaces SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.spaceId, accountId).run();
  return json({ success: true });
};

const handleDeleteVenueSpace: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  await env.DB.prepare('DELETE FROM venue_spaces WHERE id = ? AND account_id = ?')
    .bind(params.spaceId, accountId).run();
  return json({ success: true });
};

const handleUploadVenuePhoto: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return json({ error: 'No file provided' }, 400);
  // Reuse the existing flyer upload bucket
  const key = `venues/${accountId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  await (env as any).FLYER_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const url = `https://flyers.teajia.com/${key}`;
  return json({ url }, 201);
};

const handleGetVenueEvents: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const result = await env.DB.prepare(`
    SELECT e.id, e.slug, e.title, e.event_date,
      e.total_capacity,
      COUNT(CASE WHEN a.status = 'confirmed' THEN 1 END) as confirmed_count
    FROM events e
    LEFT JOIN event_attendees a ON a.event_id = e.id
    WHERE e.account_id = ? AND e.venue_id = ?
    GROUP BY e.id
    ORDER BY e.event_date DESC
    LIMIT 20
  `).bind(accountId, params.id).all();
  return json(result.results);
};

// ── Newsletter ──

// Public: newsletter signup. We tag the subscription with an optional
// store_slug from the body, and resolve it to account_id for scoping.
const handleNewsletterSubscribe: Handler = async (request, env) => {
  const body = await request.json() as Record<string, any>;
  const email = (body.email || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email address' }, 400);
  }
  const source = typeof body.source === 'string' ? body.source.slice(0, 50) : 'website';
  // Default the subscription to Adrian's Bali store unless a specific
  // store_slug is provided in the body.
  let accountId: string | null = BALI_ACCOUNT_ID;
  if (typeof body.store_slug === 'string' && body.store_slug.trim()) {
    accountId = await getAccountIdBySlug(env, body.store_slug.trim());
    if (!accountId) return json({ error: 'Store not found' }, 404);
  }
  await env.DB.prepare(
    'INSERT OR IGNORE INTO newsletter_subscribers (account_id, email, source) VALUES (?, ?, ?)'
  ).bind(accountId, email, source).run();
  return json({ success: true });
};

const handleGetNewsletterSubscribers: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const { results } = await env.DB.prepare(
    'SELECT id, email, subscribed_at, source FROM newsletter_subscribers WHERE account_id = ? ORDER BY subscribed_at DESC'
  ).bind(accountId).all();
  return json({ subscribers: results });
};

// ── Cart Inquiries ──────────────────────────────────────────────────────────

const handleCreateInquiry: Handler = async (request, env) => {
  const body = await request.json() as Record<string, any>;
  const source = typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'cart';
  const name = (body.customer_name || body.name || '').trim();
  const contact = (body.customer_contact || body.email || '').trim();

  if (!name || !contact) {
    return json({ error: 'Name and contact are required' }, 400);
  }

  let itemsStr: string;
  let totalUsd: number | null;
  let message: string | null;
  let phone: string | null;

  if (source === 'consult') {
    const vision = typeof body.vision === 'string' ? body.vision.trim() : '';
    if (!vision) return json({ error: 'Message is required' }, 400);
    const interests: string[] = Array.isArray(body.interests) ? body.interests : [];
    const referral = typeof body.referral === 'string' ? body.referral.trim() : '';
    const location = typeof body.location === 'string' ? body.location.trim() : '';
    const parts = [vision];
    if (interests.length > 0) parts.push(`Interests: ${interests.join(', ')}`);
    if (location) parts.push(`Location: ${location}`);
    if (referral) parts.push(`Referral: ${referral}`);
    message = parts.join('\n\n');
    itemsStr = '[]';
    totalUsd = null;
    phone = (body.whatsapp || '').trim() || null;
  } else {
    const itemsRaw = body.items_json || body.items;
    if (!itemsRaw) return json({ error: 'Items are required' }, 400);
    itemsStr = typeof itemsRaw === 'string' ? itemsRaw : JSON.stringify(itemsRaw);
    totalUsd = body.total_estimate_usd ?? body.total_usd ?? null;
    message = body.notes || body.message || null;
    phone = body.phone || body.customer_location || null;
  }

  let accountId: string | null = BALI_ACCOUNT_ID;
  if (typeof body.store_slug === 'string' && body.store_slug.trim()) {
    accountId = await getAccountIdBySlug(env, body.store_slug.trim());
    if (!accountId) return json({ error: 'Store not found' }, 404);
  }
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 32);

  // `source` column added in migration 045_inquiry_source. Fall back without it
  // so deployments where the migration hasn't run yet still accept inquiries.
  try {
    await env.DB.prepare(
      'INSERT INTO inquiries (id, account_id, name, email, phone, items, total_usd, currency, message, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(id, accountId, name, contact, phone, itemsStr, totalUsd, body.currency || 'USD', message, source).run();
  } catch (err: any) {
    if (typeof err?.message === 'string' && err.message.includes('source')) {
      await env.DB.prepare(
        'INSERT INTO inquiries (id, account_id, name, email, phone, items, total_usd, currency, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(id, accountId, name, contact, phone, itemsStr, totalUsd, body.currency || 'USD', message).run();
    } else {
      throw err;
    }
  }
  return json({ id, ref_number: body.ref_number, source, success: true }, 201);
};

const handleGetInquiries: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || null;
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const query = status
    ? 'SELECT * FROM inquiries WHERE account_id = ? AND status = ? ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM inquiries WHERE account_id = ? ORDER BY created_at DESC LIMIT ?';
  const stmt = status
    ? env.DB.prepare(query).bind(accountId, status, limit)
    : env.DB.prepare(query).bind(accountId, limit);
  const { results } = await stmt.all();
  const parsed = (results || []).map((r: any) => ({ ...r, items: JSON.parse(r.items || '[]') }));
  return json({ inquiries: parsed });
};

const handleUpdateInquiryStatus: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const body = await request.json() as { status?: string };
  const status = body.status;
  const validStatuses = ['new', 'seen', 'replied', 'closed'];
  if (!status || !validStatuses.includes(status)) {
    return json({ error: `status must be one of: ${validStatuses.join(', ')}` }, 400);
  }
  const res = await env.DB.prepare(
    'UPDATE inquiries SET status = ? WHERE id = ? AND account_id = ?'
  ).bind(status, params.id, accountId).run();
  if (!res.meta.changes) return json({ error: 'Inquiry not found' }, 404);
  return json({ success: true });
};

// ── User Favorites (customer-facing; scoped to the currently active
// account so each store's product IDs don't collide with another's) ──
const handleGetUserFavorites: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);
  const userId = claims.sub;
  // Favorites are scoped to the currently active account if one is set;
  // callers without an account just see their global favorites.
  const headerAccount = request.headers.get('X-Teajia-Account') || claims.active_account_id || null;
  const query = headerAccount
    ? 'SELECT item_id FROM user_favorites WHERE user_id = ? AND account_id = ? ORDER BY created_at ASC'
    : 'SELECT item_id FROM user_favorites WHERE user_id = ? ORDER BY created_at ASC';
  const stmt = headerAccount
    ? env.DB.prepare(query).bind(userId, headerAccount)
    : env.DB.prepare(query).bind(userId);
  const { results } = await stmt.all();
  return json({ favorites: (results || []).map((r: any) => r.item_id) });
};

const handlePutUserFavorites: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);
  const userId = claims.sub;
  const headerAccount = request.headers.get('X-Teajia-Account') || claims.active_account_id || null;
  const body = await request.json() as { favorites: string[] };
  if (!Array.isArray(body.favorites)) {
    return json({ error: 'favorites must be an array of item IDs' }, 400);
  }
  if (headerAccount) {
    await env.DB.prepare(
      'DELETE FROM user_favorites WHERE user_id = ? AND account_id = ?'
    ).bind(userId, headerAccount).run();
    if (body.favorites.length > 0) {
      const stmt = env.DB.prepare(
        'INSERT OR IGNORE INTO user_favorites (user_id, account_id, item_id) VALUES (?, ?, ?)'
      );
      const batch = body.favorites.map((itemId: string) => stmt.bind(userId, headerAccount, itemId));
      await env.DB.batch(batch);
    }
  } else {
    await env.DB.prepare('DELETE FROM user_favorites WHERE user_id = ?').bind(userId).run();
    if (body.favorites.length > 0) {
      const stmt = env.DB.prepare(
        'INSERT OR IGNORE INTO user_favorites (user_id, item_id) VALUES (?, ?)'
      );
      const batch = body.favorites.map((itemId: string) => stmt.bind(userId, itemId));
      await env.DB.batch(batch);
    }
  }
  return json({ ok: true, count: body.favorites.length });
};

// ── Teaware Collection ──

const handleGetTeawareCollection: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const category = url.searchParams.get('category');

  let query = 'SELECT * FROM teaware_collection WHERE account_id = ?';
  const binds: any[] = [accountId];
  if (category) {
    query += ' AND category = ?';
    binds.push(category);
  }
  query += ' ORDER BY category, name';

  const result = await env.DB.prepare(query).bind(...binds).all();

  const items = result.results as any[];
  if (items.length > 0) {
    const ids = items.map(i => i.id as string);
    const placeholders = ids.map(() => '?').join(',');
    const photos = await env.DB.prepare(
      `SELECT * FROM teaware_photos WHERE teaware_id IN (${placeholders}) ORDER BY sort_order, created_at`
    ).bind(...ids).all();

    const photoMap = new Map<string, any[]>();
    for (const p of photos.results as any[]) {
      const tid = p.teaware_id as string;
      if (!photoMap.has(tid)) photoMap.set(tid, []);
      photoMap.get(tid)!.push(p);
    }
    for (const item of items) {
      item.photos = photoMap.get(item.id as string) || [];
    }
  }

  return json(items);
};

const handleGetTeawareItem: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const item = await env.DB.prepare(
    'SELECT * FROM teaware_collection WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first();
  if (!item) return json({ error: 'Not found' }, 404);

  const photos = await env.DB.prepare(
    'SELECT * FROM teaware_photos WHERE teaware_id = ? ORDER BY sort_order, created_at'
  ).bind(params.id).all();
  (item as any).photos = photos.results;

  return json(item);
};

const handleCreateTeawareItem: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  if (!body.name || !body.category) {
    return json({ error: 'name and category are required' }, 400);
  }

  const id = crypto.randomUUID();
  const cols = ['name', 'chinese_name', 'category', 'material', 'capacity_ml', 'origin',
    'artist', 'year_acquired', 'purchase_price', 'purchase_currency', 'description',
    'condition', 'is_favorite', 'notes'];
  const present = cols.filter(c => body[c] !== undefined);
  const placeholders = present.map(() => '?').join(', ');

  await env.DB.prepare(
    `INSERT INTO teaware_collection (id, account_id, ${present.join(', ')}) VALUES (?, ?, ${placeholders})`
  ).bind(id, accountId, ...present.map(c => body[c] ?? null)).run();

  return json({ id }, 201);
};

const handleUpdateTeawareItem: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.account_id;
  const cols = Object.keys(body);
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE teaware_collection SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.id, accountId).run();

  return json({ success: true });
};

const handleDeleteTeawareItem: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  // Verify ownership first so we don't delete photos for another account's item.
  const owned = await env.DB.prepare(
    'SELECT id FROM teaware_collection WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first();
  if (!owned) return json({ error: 'Not found' }, 404);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM teaware_photos WHERE teaware_id = ?').bind(params.id),
    env.DB.prepare('DELETE FROM teaware_collection WHERE id = ? AND account_id = ?').bind(params.id, accountId),
  ]);

  return json({ success: true });
};

// ── Teaware Photos ──

async function assertTeawareInAccount(env: Env, teawareId: string, accountId: string): Promise<Response | null> {
  const row = await env.DB.prepare(
    'SELECT id FROM teaware_collection WHERE id = ? AND account_id = ?'
  ).bind(teawareId, accountId).first();
  if (!row) return json({ error: 'Teaware item not found' }, 404);
  return null;
}

const handleAddTeawarePhoto: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertTeawareInAccount(env, params.id, accountId);
  if (guard) return guard;

  const body = await request.json() as { url: string; caption?: string; is_primary?: boolean };
  if (!body.url) return json({ error: 'url is required' }, 400);

  const id = crypto.randomUUID();

  if (body.is_primary) {
    await env.DB.prepare('UPDATE teaware_photos SET is_primary = 0 WHERE teaware_id = ?').bind(params.id).run();
  }

  const maxOrder = await env.DB.prepare(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM teaware_photos WHERE teaware_id = ?'
  ).bind(params.id).first();
  const sortOrder = ((maxOrder?.max_order as number) || 0) + 1;

  await env.DB.prepare(
    'INSERT INTO teaware_photos (id, account_id, teaware_id, url, caption, is_primary, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, accountId, params.id, body.url, body.caption || null, body.is_primary ? 1 : 0, sortOrder).run();

  return json({ id }, 201);
};

const handleDeleteTeawarePhoto: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertTeawareInAccount(env, params.id, accountId);
  if (guard) return guard;

  await env.DB.prepare('DELETE FROM teaware_photos WHERE id = ? AND teaware_id = ?')
    .bind(params.photoId, params.id).run();

  return json({ success: true });
};

const handleUpdateTeawarePhoto: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertTeawareInAccount(env, params.id, accountId);
  if (guard) return guard;

  const body = await request.json() as Record<string, any>;
  delete body.account_id;

  if (body.is_primary) {
    await env.DB.prepare('UPDATE teaware_photos SET is_primary = 0 WHERE teaware_id = ?').bind(params.id).run();
    body.is_primary = 1;
  } else if (body.is_primary === false) {
    body.is_primary = 0;
  }

  const cols = Object.keys(body);
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE teaware_photos SET ${sets} WHERE id = ? AND teaware_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.photoId, params.id).run();

  return json({ success: true });
};

const handleGetTeawareCategories: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const result = await env.DB.prepare(
    'SELECT category, COUNT(*) as count FROM teaware_collection WHERE account_id = ? GROUP BY category ORDER BY category'
  ).bind(accountId).all();

  return json(result.results);
};

// ── Tea Compass (personal field notes, scoped per account + user) ──

const handleGetCompassEntries: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const vendorId = url.searchParams.get('vendor_id');

  let query = 'SELECT * FROM tea_compass_entries WHERE user_id = ? AND account_id = ?';
  const binds: any[] = [userId, accountId];

  if (status) {
    query += ' AND status = ?';
    binds.push(status);
  }
  if (vendorId) {
    query += ' AND vendor_id = ?';
    binds.push(vendorId);
  }
  query += ' ORDER BY created_at DESC';

  const result = await env.DB.prepare(query).bind(...binds).all();
  return json({ entries: result.results });
};

const handleCreateCompassEntry: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.account_id;

  const id = body.id || crypto.randomUUID();
  const cols = [
    'name', 'chinese_name', 'type', 'form', 'year', 'season', 'storage',
    'origin_region', 'price_amount', 'price_currency', 'price_per_unit_grams',
    'category', 'teaware_category', 'material', 'capacity_ml', 'quantity', 'era',
    'vendor_id', 'vendor_name', 'linked_customer_id', 'notes', 'tasting', 'photos', 'audio_clips',
    'status', 'buy_quantity_grams', 'buy_quantity_units', 'buy_total',
    'draft_product_id', 'tea_key', 'created_at', 'updated_at',
  ];
  const present = cols.filter(c => body[c] !== undefined);
  const placeholders = ['id', 'user_id', 'account_id', ...present].map(() => '?').join(', ');
  const colNames = ['id', 'user_id', 'account_id', ...present].join(', ');

  await env.DB.prepare(
    `INSERT INTO tea_compass_entries (${colNames}) VALUES (${placeholders})`
  ).bind(id, userId, accountId, ...present.map(c => body[c] ?? null)).run();

  const created = await env.DB.prepare(
    'SELECT * FROM tea_compass_entries WHERE id = ? AND account_id = ?'
  ).bind(id, accountId).first();
  return json(created, 201);
};

const handleUpdateCompassEntry: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.id;
  delete body.user_id;
  delete body.account_id;

  const cols = Object.keys(body);
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE tea_compass_entries SET ${sets}, updated_at = datetime('now')
     WHERE id = ? AND user_id = ? AND account_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.id, userId, accountId).run();

  const updated = await env.DB.prepare(
    'SELECT * FROM tea_compass_entries WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first() as Record<string, any> | null;

  // Feature 2: Propagate tasting data to the linked draft product when tasting is updated.
  // If this compass entry has a promoted product (draft_product_id) and the update includes
  // tasting data, keep the product's tasting field in sync so compass notes are never lost.
  if (updated && updated.draft_product_id && body.tasting !== undefined) {
    try {
      const tastingJson = typeof body.tasting === 'string' ? body.tasting : JSON.stringify(body.tasting);
      await env.DB.prepare(
        `UPDATE products SET tasting = ?, updated_at = datetime('now')
         WHERE id = ? AND account_id = ?`
      ).bind(tastingJson, updated.draft_product_id, accountId).run();
    } catch {
      // Non-critical — product tasting sync failure must not break the compass update
    }
  }
  // End Feature 2

  return json(updated);
};

const handleDeleteCompassEntry: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  await env.DB.prepare(
    'DELETE FROM tea_compass_entries WHERE id = ? AND user_id = ? AND account_id = ?'
  ).bind(params.id, userId, accountId).run();

  return json({ success: true });
};

/* ─────────────────────────────────────────────────────────────────────────────
   NOTES — unified note thread (tea_key or compass_entry_id anchored)
───────────────────────────────────────────────────────────────────────────── */

const handleGetNotes: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const teaKey = url.searchParams.get('tea_key');
  const compassEntryId = url.searchParams.get('compass_entry_id');
  const sessionId = url.searchParams.get('session_id');

  let query = 'SELECT * FROM notes WHERE account_id = ? AND (deleted IS NULL OR deleted = 0)';
  const binds: unknown[] = [accountId];

  if (teaKey) { query += ' AND tea_key = ?'; binds.push(teaKey); }
  else if (compassEntryId) { query += ' AND compass_entry_id = ?'; binds.push(compassEntryId); }
  else if (sessionId) { query += ' AND session_id = ?'; binds.push(sessionId); }

  query += ' ORDER BY created_at ASC';

  const rows = await env.DB.prepare(query).bind(...binds).all();
  return json({ notes: rows.results ?? [] });
};

const handleSyncNotes: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as { notes: Record<string, any>[] };
  if (!Array.isArray(body.notes)) return json({ error: 'notes array required' }, 400);

  const now = new Date().toISOString();
  const stmts = body.notes.map(n => {
    if (n.deleted) {
      return env.DB.prepare('DELETE FROM notes WHERE id = ? AND account_id = ?').bind(n.id, accountId);
    }
    return env.DB.prepare(`
      INSERT INTO notes (id, account_id, tea_key, compass_entry_id, session_id,
        text, source_type, tasting_id, tasting_snapshot, author_id, author_name,
        visibility, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        text = excluded.text,
        tea_key = excluded.tea_key,
        visibility = excluded.visibility
    `).bind(
      n.id, accountId,
      n.tea_key ?? null, n.compass_entry_id ?? null, n.session_id ?? null,
      n.text, n.source_type ?? 'manual',
      n.tasting_id ?? null, n.tasting_snapshot ?? null,
      n.author_id, n.author_name,
      n.visibility ?? 'private',
      n.created_at ?? now,
    );
  });

  if (stmts.length > 0) await env.DB.batch(stmts);
  return json({ synced: stmts.length });
};

const handleSyncNoteSessions: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as { sessions: Record<string, any>[] };
  if (!Array.isArray(body.sessions)) return json({ error: 'sessions array required' }, 400);

  const stmts = body.sessions.map(s =>
    env.DB.prepare(`
      INSERT INTO note_sessions (id, account_id, title, session_date, location, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, location = excluded.location
    `).bind(s.id, accountId, s.title ?? null, s.session_date, s.location ?? null, s.created_at)
  );

  if (stmts.length > 0) await env.DB.batch(stmts);
  return json({ synced: stmts.length });
};

const handleSyncCompassEntries: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const body = await request.json() as { entries: Record<string, any>[] };
  if (!Array.isArray(body.entries)) {
    return json({ error: 'entries array required' }, 400);
  }

  const allCols = [
    'id', 'user_id', 'account_id', 'name', 'chinese_name', 'type', 'form', 'year', 'season', 'storage',
    'origin_region', 'price_amount', 'price_currency', 'price_per_unit_grams',
    'category', 'teaware_category', 'material', 'capacity_ml', 'quantity', 'era',
    'vendor_id', 'vendor_name', 'linked_customer_id', 'notes', 'tasting', 'photos', 'audio_clips',
    'status', 'buy_quantity_grams', 'buy_quantity_units', 'buy_total',
    'draft_product_id', 'created_at', 'updated_at',
  ];
  const placeholders = allCols.map(() => '?').join(', ');
  const colNames = allCols.join(', ');

  const stmts = body.entries.map(entry => {
    const values = allCols.map(c => {
      if (c === 'user_id') return userId;
      if (c === 'account_id') return accountId;
      return entry[c] ?? null;
    });
    return env.DB.prepare(
      `INSERT OR REPLACE INTO tea_compass_entries (${colNames}) VALUES (${placeholders})`
    ).bind(...values);
  });

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }

  return json({ synced: stmts.length });
};

// ── Event System V2 Handlers ──

// PUT /api/admin/attendees/:id/approve
const handleApproveAttendee: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const attendee = await env.DB.prepare(
    `SELECT ea.*, e.id as event_id, e.title as event_title, e.slug as event_slug FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.id = ? AND e.account_id = ?`
  ).bind(params.id, accountId).first();

  if (!attendee) return json({ error: 'Attendee not found' }, 404);

  const body = await request.json() as { approved_guests?: number; message?: string };
  const approvedGuests = body.approved_guests ?? 0;
  const userEmail = getUserEmail(request);

  // Guard against race conditions: only update if still in 'requested' status
  const updateResult = await env.DB.prepare(
    `UPDATE event_attendees SET status = 'confirmed' WHERE id = ? AND status = 'requested'`
  ).bind(params.id).run();

  if (updateResult.meta.changes === 0) {
    return json({ error: 'Attendee already processed' }, 409);
  }

  const stmts: D1PreparedStatement[] = [
    buildActivityLog(
      env,
      'attendee_approved',
      `Approved ${attendee.full_name}${body.message ? ': ' + body.message : ''}`,
      userEmail, 'event_attendee', params.id, accountId
    ),
  ];

  if (approvedGuests > 0) {
    let guestRequests: Array<{ nameHint: string; contact?: string | null; approved: boolean | null }> = [];
    if (attendee.guest_requests) {
      try { guestRequests = JSON.parse(attendee.guest_requests as string); } catch {}
    }

    for (let i = 0; i < approvedGuests; i++) {
      const inviteToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const nameHint = guestRequests[i]?.nameHint || null;
      const contact = guestRequests[i]?.contact || null;
      stmts.push(
        env.DB.prepare(
          `INSERT INTO guest_invites (id, account_id, event_id, parent_attendee_id, invite_token, name_hint, contact)
           VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?)`
        ).bind(accountId, attendee.event_id, params.id, inviteToken, nameHint, contact)
      );
    }
  }

  await env.DB.batch(stmts);

  // F9: Auto-link attendee to a customer record
  try {
    const att = attendee as any;
    const phone = att.phone_number as string | null;
    const email = att.email as string | null;

    let linkedCustomerId: string | null = att.customer_id as string | null;

    if (!linkedCustomerId && (phone || email)) {
      // Try to find existing customer by phone or email
      let existing: any = null;
      if (phone) {
        const s = phone.replace(/\D/g, '').slice(-9);
        existing = await env.DB.prepare(
          `SELECT id FROM customers WHERE account_id = ? AND (phone = ? OR whatsapp = ? OR (length(?) = 9 AND (phone LIKE ? OR whatsapp LIKE ?)))`
        ).bind(accountId, phone, phone, s, `%${s}`, `%${s}`).first();
      }
      if (!existing && email) {
        existing = await env.DB.prepare(
          `SELECT id FROM customers WHERE account_id = ? AND email = ?`
        ).bind(accountId, email).first();
      }

      if (existing) {
        linkedCustomerId = existing.id as string;
      } else {
        // Create a new customer record from attendee data
        linkedCustomerId = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO customers (id, account_id, name, phone, email, whatsapp, source)
           VALUES (?, ?, ?, ?, ?, ?, 'event')`
        ).bind(
          linkedCustomerId,
          accountId,
          att.full_name || null,
          phone || null,
          email || null,
          phone || null
        ).run();
      }

      // Update the attendee with the linked customer id
      await env.DB.prepare(
        'UPDATE event_attendees SET customer_id = ? WHERE id = ?'
      ).bind(linkedCustomerId, params.id).run();
    }
  } catch {
    // Auto-link is non-critical — don't fail the approval if it errors
  }

  const att = attendee as any;
  const ticketUrl = `${att.magic_token ? `/m/${att.magic_token}` : ''}`;
  const phone = att.phone_number as string | null;
  const whatsappNotifyUrl = phone
    ? (() => {
        const digits = phone.replace(/\D/g, '');
        const msg = `Your seat at ${att.event_title} is confirmed! View your ticket: ${ticketUrl}`;
        return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`;
      })()
    : null;

  return json({ success: true, status: 'confirmed', approved_guests: approvedGuests, whatsapp_notify_url: whatsappNotifyUrl });
};

// PUT /api/admin/attendees/:id/deny
const handleDenyAttendee: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const attendee = await env.DB.prepare(
    `SELECT ea.id, ea.full_name, ea.event_id, e.claim_window_minutes FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.id = ? AND e.account_id = ?`
  ).bind(params.id, accountId).first() as any;

  if (!attendee) return json({ error: 'Attendee not found' }, 404);

  const body = await request.json() as { message?: string };
  const userEmail = getUserEmail(request);

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE event_attendees SET status = 'denied', denial_message = ? WHERE id = ?`
    ).bind(body.message || null, params.id),
    buildActivityLog(
      env,
      'attendee_denied',
      `Denied ${attendee.full_name}${body.message ? ': ' + body.message : ''}`,
      userEmail, 'event_attendee', params.id, accountId
    ),
  ]);

  // F39: Auto-promote first waitlisted attendee when a spot is freed by denial
  await cascadeWaitlist(env, attendee.event_id as string, (attendee.claim_window_minutes as number) || 60);

  return json({ success: true, status: 'denied' });
};

// PUT /api/admin/attendees/:id/waitlist
const handleWaitlistAttendee: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const attendee = await env.DB.prepare(
    `SELECT ea.id, ea.full_name, ea.event_id FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.id = ? AND e.account_id = ?`
  ).bind(params.id, accountId).first();

  if (!attendee) return json({ error: 'Attendee not found' }, 404);

  const posRow = await env.DB.prepare(
    `SELECT COALESCE(MAX(waitlist_position), 0) + 1 as next_pos
     FROM event_attendees WHERE event_id = ? AND status = 'waitlist'`
  ).bind(attendee.event_id).first();

  const waitlistPosition = (posRow?.next_pos as number) || 1;
  const userEmail = getUserEmail(request);

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE event_attendees SET status = 'waitlist', waitlist_position = ? WHERE id = ?`
    ).bind(waitlistPosition, params.id),
    buildActivityLog(
      env,
      'attendee_waitlisted',
      `Moved ${attendee.full_name} to waitlist position ${waitlistPosition}`,
      userEmail, 'event_attendee', params.id, accountId
    ),
  ]);

  return json({ success: true, status: 'waitlist', waitlist_position: waitlistPosition });
};

// POST /api/admin/events/:id/complete (F7: Auto-draft invoice from event completion)
const handleCompleteEvent: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  // Mark event as completed
  await env.DB.prepare(
    `UPDATE events SET status = 'completed', updated_at = datetime('now') WHERE id = ? AND account_id = ?`
  ).bind(params.id, accountId).run();

  // Get tea menu — if empty, skip invoice creation
  const menuRows = await env.DB.prepare(
    `SELECT etm.product_id, etm.brew_order FROM event_tea_menu etm
     WHERE etm.event_id = ? AND etm.product_id IS NOT NULL`
  ).bind(params.id).all();

  if (menuRows.results.length === 0) {
    return json({ success: true, status: 'completed', invoices_created: 0 });
  }

  // Get all attended attendees
  const attendeesRows = await env.DB.prepare(
    `SELECT ea.id, ea.full_name, ea.phone_number, ea.email, ea.customer_id
     FROM event_attendees ea
     WHERE ea.event_id = ? AND ea.attended = 1`
  ).bind(params.id).all();

  const attendees = attendeesRows.results as any[];
  if (attendees.length === 0) {
    return json({ success: true, status: 'completed', invoices_created: 0 });
  }

  // Check which attendees already have a draft invoice for this event
  const existingInvoiceRows = await env.DB.prepare(
    `SELECT customer_name FROM invoices WHERE source_event_id = ? AND account_id = ?`
  ).bind(params.id, accountId).all();
  const existingNames = new Set((existingInvoiceRows.results as any[]).map((r: any) => r.customer_name));

  const stmts: D1PreparedStatement[] = [];
  let invoicesCreated = 0;

  for (const att of attendees) {
    if (existingNames.has(att.full_name)) continue;

    const invoiceId = crypto.randomUUID();
    const invoiceNumber = `EVT-${params.id.slice(0, 6).toUpperCase()}-${att.id.slice(0, 4).toUpperCase()}`;

    stmts.push(
      env.DB.prepare(
        `INSERT INTO invoices (id, account_id, invoice_number, customer_name, customer_whatsapp, customer_id, display_currency, shipping_cost_usd, status, inventory_deducted, payment_status, source_event_id)
         VALUES (?, ?, ?, ?, ?, ?, 'TWD', 0, 'Draft', 0, 'unpaid', ?)`
      ).bind(
        invoiceId,
        accountId,
        invoiceNumber,
        att.full_name,
        att.phone_number || null,
        att.customer_id || null,
        params.id
      )
    );

    // Add one line item per tea menu entry
    for (const menuItem of menuRows.results as any[]) {
      stmts.push(
        env.DB.prepare(
          'INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, custom_name, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), accountId, invoiceId, menuItem.product_id, null, 1, 0)
      );
    }

    invoicesCreated++;
  }

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }

  return json({ success: true, status: 'completed', invoices_created: invoicesCreated });
};

// GET /api/admin/events/:id/interest
const handleGetInterestSignups: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  const rows = await env.DB.prepare(
    `SELECT id, name, phone, email, created_at, converted_at, customer_id
     FROM interest_signups
     WHERE event_id = ? AND account_id = ?
     ORDER BY created_at DESC`
  ).bind(params.id, accountId).all();

  return json({ signups: rows.results ?? [] });
};

// POST /api/admin/events/:id/convert-interest (F12: Interest signup to RSVP conversion)
const handleConvertInterest: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  // Get all interest signups for this event
  const signupRows = await env.DB.prepare(
    `SELECT id, name, phone, email FROM interest_signups
     WHERE event_id = ? AND account_id = ?`
  ).bind(params.id, accountId).all();

  const signups = signupRows.results as any[];
  if (signups.length === 0) {
    return json({ success: true, converted: 0 });
  }

  // Get existing attendee emails to avoid duplicate RSVPs
  const existingRows = await env.DB.prepare(
    `SELECT email, phone_number FROM event_attendees WHERE event_id = ?`
  ).bind(params.id).all();
  const existingEmails = new Set((existingRows.results as any[]).map((r: any) => r.email).filter(Boolean));
  const existingPhones = new Set((existingRows.results as any[]).map((r: any) => r.phone_number).filter(Boolean));

  const stmts: D1PreparedStatement[] = [];
  let converted = 0;

  for (const signup of signups) {
    // Skip if already has an RSVP (by email or phone)
    if ((signup.email && existingEmails.has(signup.email)) ||
        (signup.phone && existingPhones.has(signup.phone))) {
      continue;
    }

    const attendeeId = crypto.randomUUID();
    const rsvpToken = crypto.randomUUID();

    stmts.push(
      env.DB.prepare(
        `INSERT INTO event_attendees
           (id, account_id, event_id, full_name, phone_number, email, status, magic_token, source)
         VALUES (?, ?, ?, ?, ?, ?, 'requested', ?, 'interest_conversion')`
      ).bind(
        attendeeId,
        accountId,
        params.id,
        signup.name || null,
        signup.phone || null,
        signup.email || null,
        rsvpToken
      )
    );

    // Mark the interest signup as converted
    stmts.push(
      env.DB.prepare(
        `UPDATE interest_signups SET converted_at = datetime('now') WHERE id = ?`
      ).bind(signup.id)
    );

    if (signup.email) existingEmails.add(signup.email);
    if (signup.phone) existingPhones.add(signup.phone);
    converted++;
  }

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }

  return json({ success: true, converted });
};

// POST /api/admin/events/:id/create-next (F40: Recurring event pattern)
const handleCreateNextEvent: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as { next_date: string; slug: string };
  if (!body.next_date || !body.slug) {
    return json({ error: 'next_date and slug are required' }, 400);
  }

  const existingSlug = await env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(body.slug).first();
  if (existingSlug) return json({ error: 'An event with this slug already exists' }, 409);

  const source = await env.DB.prepare('SELECT * FROM events WHERE id = ? AND account_id = ?')
    .bind(params.id, accountId).first() as any;
  if (!source) return json({ error: 'Source event not found' }, 404);

  const newId = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO events (id, account_id, slug, title, subtitle, description, flyer_image_url, event_date, event_end_date,
       location_name, address_text, map_link, guidelines_text, venue_guide, total_capacity, claim_window_minutes,
       timezone, status, session_flow, playlist_url, event_format, location_id,
       venue_id, active_space_ids, gathering_type, area_hint, mood_hints, briefing_cards)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    newId,
    accountId,
    body.slug,
    source.title,
    source.subtitle,
    source.description,
    source.flyer_image_url,
    body.next_date,
    null, // event_end_date — to be set manually
    source.location_name,
    source.address_text,
    source.map_link,
    source.guidelines_text,
    source.venue_guide,
    source.total_capacity,
    source.claim_window_minutes,
    source.timezone,
    source.session_flow,
    source.playlist_url,
    source.event_format || 'private_tasting',
    source.location_id || null,
    source.venue_id || null,
    source.active_space_ids || null,
    source.gathering_type || null,
    source.area_hint || null,
    source.mood_hints || null,
    source.briefing_cards || null
  ).run();

  // Clone tea menu (same as F38/duplicate pattern)
  const menu = await env.DB.prepare(
    'SELECT * FROM event_tea_menu WHERE event_id = ? AND account_id = ?'
  ).bind(params.id, accountId).all();

  if (menu.results.length > 0) {
    const menuStmts = (menu.results as any[]).map(m =>
      env.DB.prepare(
        `INSERT INTO event_tea_menu (id, account_id, event_id, product_id, custom_name, custom_description, reveal_date, brew_order, brewing_temp, brewing_time, vessel_type)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), accountId, newId,
        m.product_id, m.custom_name, m.custom_description, null, m.brew_order,
        m.brewing_temp ?? null, m.brewing_time ?? null, m.vessel_type ?? null
      )
    );
    await env.DB.batch(menuStmts);
  }

  return json({ id: newId, slug: body.slug }, 201);
};

// POST /api/admin/events/:id/approve-batch
const handleApproveBatch: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const guard = await assertEventInAccount(env, params.id, accountId);
  if (guard) return guard;

  const body = await request.json() as {
    attendee_ids: string[];
    approved_guests_map?: Record<string, number>;
  };

  if (!Array.isArray(body.attendee_ids) || body.attendee_ids.length === 0) {
    return json({ error: 'attendee_ids must be a non-empty array' }, 400);
  }

  const approvedGuestsMap = body.approved_guests_map || {};
  const userEmail = getUserEmail(request);
  const stmts: D1PreparedStatement[] = [];
  type AttendeeRow = { id: string; phone_number: string | null; email: string | null; customer_id: string | null };
  const rows: AttendeeRow[] = [];

  for (const attendeeId of body.attendee_ids) {
    const attendee = await env.DB.prepare(
      `SELECT id, full_name, guest_requests, phone_number, email, customer_id FROM event_attendees WHERE id = ? AND event_id = ?`
    ).bind(attendeeId, params.id).first();

    if (!attendee) continue;
    rows.push({ id: attendeeId, phone_number: (attendee as any).phone_number, email: (attendee as any).email, customer_id: (attendee as any).customer_id });

    stmts.push(
      env.DB.prepare(
        `UPDATE event_attendees SET status = 'confirmed' WHERE id = ?`
      ).bind(attendeeId)
    );

    stmts.push(
      buildActivityLog(
        env,
        'attendee_approved',
        `Batch approved ${attendee.full_name}`,
        userEmail, 'event_attendee', attendeeId, accountId
      )
    );

    const approvedGuests = approvedGuestsMap[attendeeId] ?? 0;
    if (approvedGuests > 0) {
      let guestRequests: Array<{ nameHint: string; contact?: string | null; approved: boolean | null }> = [];
      if (attendee.guest_requests) {
        try { guestRequests = JSON.parse(attendee.guest_requests as string); } catch {}
      }
      for (let i = 0; i < approvedGuests; i++) {
        const inviteToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
        const nameHint = guestRequests[i]?.nameHint || null;
        const contact = guestRequests[i]?.contact || null;
        stmts.push(
          env.DB.prepare(
            `INSERT INTO guest_invites (id, account_id, event_id, parent_attendee_id, invite_token, name_hint, contact)
             VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?)`
          ).bind(accountId, params.id, attendeeId, inviteToken, nameHint, contact)
        );
      }
    }
  }

  if (stmts.length > 0) {
    await env.DB.batch(stmts);
  }

  // Auto-link customer records (non-critical, same logic as single approval)
  for (const row of rows) {
    if (row.customer_id || (!row.phone_number && !row.email)) continue;
    try {
      let linkedId: string | null = null;
      if (row.phone_number) {
        const s = row.phone_number.replace(/\D/g, '').slice(-9);
        const found = await env.DB.prepare(
          `SELECT id FROM customers WHERE account_id = ? AND (phone = ? OR whatsapp = ? OR (length(?) = 9 AND (phone LIKE ? OR whatsapp LIKE ?)))`
        ).bind(accountId, row.phone_number, row.phone_number, s, `%${s}`, `%${s}`).first();
        if (found) linkedId = found.id as string;
      }
      if (!linkedId && row.email) {
        const found = await env.DB.prepare(
          `SELECT id FROM customers WHERE account_id = ? AND email = ?`
        ).bind(accountId, row.email).first();
        if (found) linkedId = found.id as string;
      }
      if (!linkedId) {
        linkedId = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO customers (id, account_id, name, phone, email, whatsapp, source)
           SELECT ?, ?, full_name, phone_number, email, phone_number, 'event'
           FROM event_attendees WHERE id = ?`
        ).bind(linkedId, accountId, row.id).run();
      }
      await env.DB.prepare('UPDATE event_attendees SET customer_id = ? WHERE id = ?')
        .bind(linkedId, row.id).run();
    } catch {}
  }

  return json({ success: true, approved_count: body.attendee_ids.length });
};

// GET /api/admin/events/:id/share
const handleGetEventShareMessages: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'gather');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const event = await env.DB.prepare(
    `SELECT id, slug, title, event_date, area_hint, flyer_image_url FROM events WHERE id = ? AND account_id = ?`
  ).bind(params.id, accountId).first();

  if (!event) return json({ error: 'Event not found' }, 404);

  let eventDate = 'Date TBD';
  if (event.event_date) {
    const parsedDate = new Date(event.event_date as string);
    if (!isNaN(parsedDate.getTime())) {
      eventDate = parsedDate.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
    }
  }

  const eventUrl = `https://teajia.co/e/${event.slug}`;
  const areaHint = event.area_hint || 'Taipei';

  const whatsappText =
    `*${event.title}*\n${eventDate}\n${areaHint}\n\nRequest your seat: ${eventUrl}`;

  const emailSubject = event.title as string;

  const emailHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;padding:40px 24px">
  <tr><td align="center" style="padding-bottom:32px">
    ${event.flyer_image_url ? `<img src="${event.flyer_image_url}" width="420" style="border-radius:8px;max-width:100%;display:block" alt="${event.title}">` : ''}
  </td></tr>
  <tr><td style="padding-bottom:8px">
    <p style="margin:0;font-size:24px;letter-spacing:-0.02em;color:#1a1410">${event.title}</p>
  </td></tr>
  <tr><td style="padding-bottom:24px">
    <p style="margin:0;font-size:13px;letter-spacing:0.05em;text-transform:uppercase;color:#7a6955">${eventDate} &bull; ${areaHint}</p>
  </td></tr>
  <tr><td style="padding-bottom:40px">
    <a href="${eventUrl}" style="display:inline-block;padding:14px 32px;background:#1a1410;color:#f5f0eb;text-decoration:none;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;border-radius:2px">Request Your Seat</a>
  </td></tr>
</table>
</body>
</html>`;

  return json({
    whatsapp_text: whatsappText,
    email_subject: emailSubject,
    email_html: emailHtml,
    event_url: eventUrl,
  });
};

// POST /api/guest-invite/:token/claim
const handleClaimGuestInvite: Handler = async (request, env, params) => {
  const invite = await env.DB.prepare(
    `SELECT gi.*, e.id as event_id, e.account_id as account_id, e.title as event_title, e.event_date
     FROM guest_invites gi
     JOIN events e ON e.id = gi.event_id
     WHERE gi.invite_token = ?`
  ).bind(params.token).first();

  if (!invite) return json({ error: 'Invite not found' }, 404);
  if (invite.status !== 'pending') {
    return json({ error: `Invite already ${invite.status}` }, 409);
  }
  if (invite.event_date && new Date(invite.event_date as string) < new Date()) {
    await env.DB.prepare(`UPDATE guest_invites SET status = 'expired' WHERE invite_token = ?`)
      .bind(params.token).run();
    return json({ error: 'This invite has expired' }, 410);
  }
  const accountId = invite.account_id as string;

  const body = await request.json() as { name: string; phone?: string; email?: string };
  if (!body.name) return json({ error: 'name is required' }, 400);
  if (!body.phone && !body.email) return json({ error: 'phone or email is required' }, 400);

  const magicToken = crypto.randomUUID();
  const newAttendeeId = crypto.randomUUID();
  const contactMethod = body.phone ? 'whatsapp' : 'email';

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO event_attendees
         (id, account_id, event_id, full_name, phone_number, email, contact_method, status, magic_token, source, access_tier)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, 'guest_invite', 'standard')`
    ).bind(
      newAttendeeId,
      accountId,
      invite.event_id,
      body.name,
      body.phone || null,
      body.email || null,
      contactMethod,
      magicToken
    ),
    env.DB.prepare(
      `UPDATE guest_invites
       SET status = 'claimed', claimed_by_name = ?, claimed_by_phone = ?, claimed_by_email = ?,
           claimed_attendee_id = ?, claimed_at = datetime('now')
       WHERE invite_token = ?`
    ).bind(
      body.name,
      body.phone || null,
      body.email || null,
      newAttendeeId,
      params.token
    ),
    buildActivityLog(
      env,
      'guest_invite_claimed',
      `${body.name} claimed guest invite for event ${invite.event_title}`,
      null, 'event_attendee', newAttendeeId, accountId
    ),
  ]);

  // Auto-link customer record for claimed guest (non-critical)
  try {
    let linkedId: string | null = null;
    if (body.phone) {
      const s = body.phone.replace(/\D/g, '').slice(-9);
      const found = await env.DB.prepare(
        `SELECT id FROM customers WHERE account_id = ? AND (phone = ? OR whatsapp = ? OR (length(?) = 9 AND (phone LIKE ? OR whatsapp LIKE ?)))`
      ).bind(accountId, body.phone, body.phone, s, `%${s}`, `%${s}`).first();
      if (found) linkedId = found.id as string;
    }
    if (!linkedId && body.email) {
      const found = await env.DB.prepare(
        `SELECT id FROM customers WHERE account_id = ? AND email = ?`
      ).bind(accountId, body.email).first();
      if (found) linkedId = found.id as string;
    }
    if (!linkedId) {
      linkedId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO customers (id, account_id, name, phone, email, whatsapp, source)
         VALUES (?, ?, ?, ?, ?, ?, 'event')`
      ).bind(linkedId, accountId, body.name, body.phone || null, body.email || null, body.phone || null).run();
    }
    await env.DB.prepare('UPDATE event_attendees SET customer_id = ? WHERE id = ?')
      .bind(linkedId, newAttendeeId).run();
  } catch {}

  return json({ magic_token: magicToken, redirect_url: `/m/${magicToken}` }, 201);
};

// GET /api/guest-invite/:token
const handleGetGuestInvite: Handler = async (_request, env, params) => {
  const invite = await env.DB.prepare(
    `SELECT gi.id, gi.invite_token, gi.name_hint, gi.status, gi.created_at, gi.claimed_at,
            gi.claimed_by_name,
            e.title as event_title, e.event_date, e.area_hint, e.flyer_image_url, e.slug as event_slug
     FROM guest_invites gi
     JOIN events e ON e.id = gi.event_id
     WHERE gi.invite_token = ?`
  ).bind(params.token).first();

  if (!invite) return json({ error: 'Invite not found' }, 404);

  return json(invite);
};

// POST /api/events/:slug/interest
const handleEventInterest: Handler = async (request, env, params) => {
  const event = await env.DB.prepare(
    `SELECT id, account_id FROM events WHERE slug = ?`
  ).bind(params.slug).first();

  if (!event) return json({ error: 'Event not found' }, 404);
  const accountId = event.account_id as string;

  const body = await request.json() as { name?: string; phone?: string; email?: string };
  const name = body.name?.trim() || '';
  const phone = body.phone?.trim() || '';
  const email = body.email?.trim() || '';

  if (!name && !phone && !email) {
    return json({ error: 'At least one of name, phone, or email is required' }, 400);
  }

  // Match existing customer within the event's account only.
  let customerId: string | null = null;
  if (phone) {
    const c = await env.DB.prepare(
      `SELECT id FROM customers WHERE (phone = ? OR whatsapp = ?) AND account_id = ?`
    ).bind(phone, phone, accountId).first();
    if (c) customerId = c.id as string;
  } else if (email) {
    const c = await env.DB.prepare(
      `SELECT id FROM customers WHERE email = ? AND account_id = ?`
    ).bind(email, accountId).first();
    if (c) customerId = c.id as string;
  }

  // Dedup: if same phone or email already signed up for this event, just update name silently
  if (phone || email) {
    const existing = await env.DB.prepare(
      `SELECT id FROM interest_signups WHERE event_id = ? AND (${phone ? 'phone = ?' : 'email = ?'})`
    ).bind(event.id, phone || email).first();
    if (existing) {
      if (name) {
        await env.DB.prepare(`UPDATE interest_signups SET name = ? WHERE id = ?`)
          .bind(name, existing.id).run();
      }
      return json({ success: true }, 200);
    }
  }

  await env.DB.prepare(
    `INSERT INTO interest_signups (id, account_id, event_id, customer_id, name, phone, email)
     VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?, ?, ?)`
  ).bind(accountId, event.id, customerId, name || null, phone || null, email || null).run();

  return json({ success: true }, 201);
};

// POST /api/verify/request
const handleVerifyRequest: Handler = async (request, env) => {
  const body = await request.json() as { contact: string; method: 'whatsapp' | 'email' };
  if (!body.contact) return json({ error: 'contact is required' }, 400);
  if (!body.method || !['whatsapp', 'email'].includes(body.method)) {
    return json({ error: 'method must be whatsapp or email' }, 400);
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

  // Find or create customer by contact
  const isEmail = body.method === 'email';
  const existingCustomer = isEmail
    ? await env.DB.prepare(`SELECT id, verification_code, verification_expires FROM customers WHERE email = ?`).bind(body.contact).first()
    : await env.DB.prepare(`SELECT id, verification_code, verification_expires FROM customers WHERE phone = ? OR whatsapp = ?`)
        .bind(body.contact, body.contact).first();

  // Rate limit: if a non-expired code was issued less than 60 seconds ago, reject
  if (existingCustomer && existingCustomer.verification_code && existingCustomer.verification_expires) {
    const expiresAt = new Date(existingCustomer.verification_expires as string);
    const now = new Date();
    if (expiresAt > now) {
      // Code expires in at most 10 minutes from creation; if more than 9 minutes remain, it was issued < 60s ago
      const msRemaining = expiresAt.getTime() - now.getTime();
      if (msRemaining > 9 * 60 * 1000) {
        return json({ error: 'Please wait before requesting another code' }, 429);
      }
    }
  }

  if (existingCustomer) {
    await env.DB.prepare(
      `UPDATE customers SET verification_code = ?, verification_expires = ? WHERE id = ?`
    ).bind(code, expires, existingCustomer.id).run();
  } else {
    const newId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO customers (id, name, phone, email, whatsapp, contact_preference, verification_code, verification_expires)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      newId,
      null,
      isEmail ? null : body.contact,
      isEmail ? body.contact : null,
      isEmail ? null : body.contact,
      body.method,
      code,
      expires
    ).run();
  }

  // NOTE: Actual WhatsApp/email delivery is not yet implemented.
  // Return code in response for now — remove before production.
  return json({ success: true, code, expires, _note: 'Delivery not yet implemented — code returned for development' });
};

// POST /api/verify/confirm
const handleVerifyConfirm: Handler = async (request, env) => {
  const body = await request.json() as { contact: string; code: string };
  if (!body.contact || !body.code) return json({ error: 'contact and code are required' }, 400);

  const customer = await env.DB.prepare(
    `SELECT id, name, phone, email, verification_code, verification_expires
     FROM customers WHERE phone = ? OR whatsapp = ? OR email = ?`
  ).bind(body.contact, body.contact, body.contact).first();

  if (!customer) return json({ error: 'No account found for this contact' }, 404);

  const expires = customer.verification_expires ? new Date(customer.verification_expires as string) : null;
  if (!expires || expires <= new Date()) {
    return json({ error: 'Verification code has expired' }, 401);
  }

  // Parse attempt-prefixed code: stored as "N:123456" where N is fail count, or plain "123456"
  const storedRaw = (customer.verification_code as string) || '';
  let failCount = 0;
  let storedCode = storedRaw;
  const prefixMatch = storedRaw.match(/^(\d+):(.+)$/);
  if (prefixMatch) {
    failCount = parseInt(prefixMatch[1], 10);
    storedCode = prefixMatch[2];
  }

  if (storedCode !== body.code) {
    failCount += 1;
    if (failCount >= 3) {
      // Invalidate the code after 3 failed attempts
      await env.DB.prepare(
        `UPDATE customers SET verification_code = NULL, verification_expires = NULL WHERE id = ?`
      ).bind(customer.id).run();
      return json({ error: 'Too many attempts. Please request a new code.' }, 429);
    }
    // Store incremented fail count back
    await env.DB.prepare(
      `UPDATE customers SET verification_code = ? WHERE id = ?`
    ).bind(`${failCount}:${storedCode}`, customer.id).run();
    return json({ error: 'Invalid verification code' }, 401);
  }

  // Clear the code after successful verify
  await env.DB.prepare(
    `UPDATE customers SET verification_code = NULL, verification_expires = NULL WHERE id = ?`
  ).bind(customer.id).run();

  // Fetch all magic tokens for this customer's event attendees
  const attendees = await env.DB.prepare(
    `SELECT ea.magic_token, ea.status, ea.event_id, e.title as event_title, e.event_date
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.phone_number = ? OR ea.email = ?
     ORDER BY e.event_date DESC`
  ).bind(body.contact, body.contact).all();

  return json({
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
    },
    attendances: attendees.results,
  });
};

// GET /api/journey/:phone
const handleGetJourney: Handler = async (request, env, params) => {
  const phone = decodeURIComponent(params.phone);
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return json({ error: 'token is required' }, 401);
  }

  // Verify the token matches a magic_token belonging to this phone number
  const tokenRow = await env.DB.prepare(
    `SELECT id FROM event_attendees WHERE magic_token = ? AND phone_number = ?`
  ).bind(token, phone).first();

  if (!tokenRow) {
    return json({ error: 'Invalid or expired token' }, 403);
  }

  const customer = await env.DB.prepare(
    `SELECT id, name FROM customers WHERE phone = ? OR whatsapp = ?`
  ).bind(phone, phone).first();

  if (!customer) return json({ error: 'No journey found for this contact' }, 404);

  // All confirmed+attended sessions
  const sessions = await env.DB.prepare(
    `SELECT ea.id as attendee_id, ea.event_id, e.title, e.event_date, e.flyer_image_url
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.phone_number = ? AND ea.status = 'confirmed' AND ea.attended = 1
     ORDER BY e.event_date ASC`
  ).bind(phone).all();

  const sessionsAttended = sessions.results.length;
  const seals = (sessions.results as Record<string, any>[]).map(s => ({
    event_id: s.event_id,
    title: s.title,
    date: s.event_date,
    flyer_url: s.flyer_image_url || null,
  }));

  // Tasting notes across all sessions
  const eventIds = (sessions.results as Record<string, any>[]).map(s => s.event_id);
  let teaTypeMap: Record<string, number> = {};
  let favorites: string[] = [];
  let impressions: Array<{ text: string; tea_name: string; event_title: string; date: string }> = [];
  let totalTeas = 0;

  if (eventIds.length > 0) {
    // Fetch tasting notes for this attendee across all events
    const attendeeIds = (sessions.results as Record<string, any>[]).map(s => s.attendee_id);
    const placeholders = attendeeIds.map(() => '?').join(', ');

    const notes = await env.DB.prepare(
      `SELECT etn.impression, etn.is_favorite, etn.tea_menu_id,
              etm.custom_name, p.given_name, p.product_name, p.type,
              e.title as event_title, e.event_date
       FROM event_tasting_notes etn
       LEFT JOIN event_tea_menu etm ON etm.id = etn.tea_menu_id
       LEFT JOIN products p ON p.id = etm.product_id
       JOIN event_attendees ea ON ea.id = etn.attendee_id
       JOIN events e ON e.id = ea.event_id
       WHERE etn.attendee_id IN (${placeholders})`
    ).bind(...attendeeIds).all();

    totalTeas = notes.results.length;

    for (const n of notes.results as Record<string, any>[]) {
      const teaType = n.type as string | null;
      if (teaType) {
        teaTypeMap[teaType] = (teaTypeMap[teaType] || 0) + 1;
      }
      if (n.is_favorite) {
        const teaName = n.custom_name || n.given_name || n.product_name || 'Unknown tea';
        favorites.push(teaName);
      }
      if (n.impression) {
        impressions.push({
          text: n.impression,
          tea_name: n.custom_name || n.given_name || n.product_name || 'Unknown tea',
          event_title: n.event_title,
          date: n.event_date,
        });
      }
    }
  }

  // Compute milestones based on sessions attended
  const milestoneMarks: Record<number, string> = { 1: '初', 3: '三', 5: '五', 7: '七', 10: '十', 20: '廿', 50: '半百' };
  const milestones = Object.entries(milestoneMarks)
    .filter(([count]) => sessionsAttended >= parseInt(count))
    .map(([, mark]) => mark);

  return json({
    customer: { id: customer.id, name: customer.name },
    sessions_attended: sessionsAttended,
    total_teas: totalTeas,
    tea_type_map: teaTypeMap,
    favorites,
    impressions,
    milestones,
    seals,
  });
};

// ── Samples ──

function stripSampleSource(sample: Record<string, any>): Record<string, any> {
  const { source_id, source_name, source_contact, notes, ...rest } = sample;
  return rest;
}

function parseSampleRow(row: Record<string, any>): Record<string, any> {
  return {
    ...row,
    photos: row.photos ? JSON.parse(row.photos) : [],
    source_contact: row.source_contact ? JSON.parse(row.source_contact) : null,
  };
}

function parseSampleSetRow(row: Record<string, any>): Record<string, any> {
  return {
    ...row,
    shared_with: row.shared_with ? JSON.parse(row.shared_with) : [],
    panel_account_ids: row.panel_account_ids ? JSON.parse(row.panel_account_ids) : [],
  };
}

function parseTastingRow(row: Record<string, any>): Record<string, any> {
  return {
    ...row,
    tasting: row.tasting ? JSON.parse(row.tasting) : {},
  };
}

// Public: GET /api/samples/:id
const handleGetSample: Handler = async (request, env, params) => {
  const sample = await env.DB.prepare('SELECT * FROM tea_samples WHERE id = ?').bind(params.id).first();
  if (!sample) return json({ error: 'Sample not found' }, 404);

  const tastings = await env.DB.prepare(
    'SELECT * FROM tea_sample_tastings WHERE sample_id = ? ORDER BY created_at DESC'
  ).bind(params.id).all();

  let parsed = parseSampleRow(sample as Record<string, any>);

  // Strip source info for unauthenticated users
  const token = isAuthed(request);
  const authed = token ? await verifyToken(token, env.JWT_SECRET) : false;
  if (!authed) {
    parsed = stripSampleSource(parsed);
  }

  return json({
    ...parsed,
    tastings: (tastings.results as Record<string, any>[]).map(parseTastingRow),
  });
};

// Public: GET /api/samples/set/:setId
const handleGetSamplesBySet: Handler = async (request, env, params) => {
  const set = await env.DB.prepare('SELECT * FROM tea_sample_sets WHERE id = ?').bind(params.setId).first();
  if (!set) return json({ error: 'Sample set not found' }, 404);

  const samples = await env.DB.prepare(
    'SELECT * FROM tea_samples WHERE set_id = ? ORDER BY created_at DESC'
  ).bind(params.setId).all();

  const token = isAuthed(request);
  const authed = token ? await verifyToken(token, env.JWT_SECRET) : false;

  const parsedSamples = (samples.results as Record<string, any>[]).map(s => {
    const parsed = parseSampleRow(s);
    return authed ? parsed : stripSampleSource(parsed);
  });

  return json({
    set: parseSampleSetRow(set as Record<string, any>),
    samples: parsedSamples,
  });
};

// Public/Guest: POST /api/samples/:id/tastings
// Resolve account from the sample row so tastings carry the same account_id.
const handleAddSampleTasting: Handler = async (request, env, params) => {
  const sample = await env.DB.prepare(
    'SELECT id, account_id FROM tea_samples WHERE id = ?'
  ).bind(params.id).first();
  if (!sample) return json({ error: 'Sample not found' }, 404);
  const accountId = (sample.account_id as string) || BALI_ACCOUNT_ID;

  const body = await request.json() as Record<string, any>;
  const id = crypto.randomUUID();

  let tasterId = 'guest_' + crypto.randomUUID().slice(0, 8);
  let tasterName = body.tasterName || 'Guest';
  const token = isAuthed(request);
  if (token) {
    const valid = await verifyToken(token, env.JWT_SECRET);
    if (valid) {
      const claims = parseToken(token);
      if (claims?.email) tasterId = claims.email;
      if (claims?.name) tasterName = claims.name;
    }
  }

  await env.DB.prepare(
    `INSERT INTO tea_sample_tastings (id, account_id, sample_id, taster_id, taster_name, tasting, rating, verdict, would_buy, personal_note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    accountId,
    params.id,
    tasterId,
    tasterName,
    JSON.stringify(body.tasting || {}),
    body.rating ?? null,
    body.verdict || 'neutral',
    body.wouldBuy ? 1 : 0,
    body.personalNote || null,
  ).run();

  await env.DB.prepare(
    "UPDATE tea_samples SET updated_at = datetime('now') WHERE id = ?"
  ).bind(params.id).run();

  // Mirror to tea_reviews for authenticated admins so tastings aggregate cross-account
  const authedToken = isAuthed(request);
  if (authedToken) {
    const authedClaims = parseToken(authedToken);
    const reviewUserId = authedClaims?.sub;
    const reviewAccountId = authedClaims?.active_account_id || accountId;
    // Derive tea_key from the sample (use stored tea_key or fall back to sample id)
    const sampleFull = await env.DB.prepare(
      'SELECT tea_key, name, type, year FROM tea_samples WHERE id = ?'
    ).bind(params.id).first() as Record<string, any> | null;
    const teaKey = sampleFull?.tea_key ||
      `${(sampleFull?.name || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${sampleFull?.year || 'unknown'}`;

    if (reviewUserId && teaKey) {
      const reviewId = crypto.randomUUID();
      const now = new Date().toISOString();
      const voiceNotes = body.voiceNotes || (body.personalNote ? [body.personalNote] : null);
      await env.DB.prepare(
        `INSERT INTO tea_reviews (id, tea_key, author_user_id, author_account_id,
          visibility, tasting, voice_notes, rating, verdict, would_buy,
          source_sample_id, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'network', ?, ?, ?, ?, ?, ?, 'submitted', ?, ?)`
      ).bind(
        reviewId, teaKey, reviewUserId, reviewAccountId,
        JSON.stringify(body.tasting || {}),
        voiceNotes ? JSON.stringify(voiceNotes) : null,
        body.rating ?? null,
        body.verdict || 'neutral',
        body.wouldBuy ? 1 : 0,
        params.id,
        now, now,
      ).run();
    }
  }

  // ── Feature 3: Auto-tag customer from sample verdict ─────────────────────
  const verdict = body.verdict || 'neutral';
  // tasterId is email if the user is authenticated (set above), otherwise it's a guest UUID
  const tasterEmailForTag: string | null =
    tasterId.includes('@') ? tasterId
    : (typeof body.email === 'string' && body.email ? body.email : null);

  if (tasterEmailForTag && (verdict === 'love' || verdict === 'like' || verdict === 'pass')) {
    try {
      const sampleMeta = await env.DB.prepare(
        'SELECT type FROM tea_samples WHERE id = ?'
      ).bind(params.id).first() as Record<string, any> | null;

      const customer = await env.DB.prepare(
        `SELECT id, tags FROM customers WHERE account_id = ? AND email = ? LIMIT 1`
      ).bind(accountId, tasterEmailForTag).first() as Record<string, any> | null;

      if (customer) {
        const rawTags = customer.tags as string | null;
        const currentTags: string[] = (() => {
          try { return JSON.parse(rawTags || '[]'); }
          catch { return rawTags ? rawTags.split(',').map((t: string) => t.trim()).filter(Boolean) : []; }
        })();
        const tagSet = new Set<string>(currentTags);

        if (verdict === 'love' || verdict === 'like') {
          const teaType = ((sampleMeta?.type as string | undefined) || '').toLowerCase();
          const typeTagMap: Record<string, string> = {
            sheng: 'sheng-lover', oolong: 'oolong-lover',
            shou: 'puerh-lover', dark: 'puerh-lover',
            white: 'white-tea-lover', green: 'green-lover',
            red: 'red-tea-lover', yellow: 'yellow-tea-lover',
          };
          for (const [key, tag] of Object.entries(typeTagMap)) {
            if (teaType.includes(key)) { tagSet.add(tag); break; }
          }
        }

        if (verdict === 'pass') {
          const passResult = await env.DB.prepare(
            `SELECT COUNT(*) as cnt FROM tea_sample_tastings tst
             JOIN tea_samples s ON s.id = tst.sample_id
             WHERE s.account_id = ? AND tst.taster_id = ? AND tst.verdict = 'pass'`
          ).bind(accountId, tasterId).first() as Record<string, any> | null;
          if (((passResult?.cnt as number) || 0) >= 3) {
            tagSet.add('selective');
          }
        }

        const updatedTags = Array.from(tagSet);
        const changed = updatedTags.length !== currentTags.length
          || updatedTags.some(t => !currentTags.includes(t));
        if (changed) {
          await env.DB.prepare(
            `UPDATE customers SET tags = ?, updated_at = datetime('now') WHERE id = ?`
          ).bind(JSON.stringify(updatedTags), customer.id).run();
        }
      }
    } catch {
      // Non-critical — auto-tagging failure must not break the tasting submission
    }
  }
  // ── End Feature 3 ──────────────────────────────────────────────────────────

  const created = await env.DB.prepare('SELECT * FROM tea_sample_tastings WHERE id = ?').bind(id).first();
  return json(parseTastingRow(created as Record<string, any>), 201);
};

// ── Compass Sharing ─────────────────────────────────────────────────────────

// POST /api/compass/share
// Share a capture card to known accounts (direct push) and/or generate an invite link.
const handleCompassShare: Handler = async (request, env) => {
  const auth = await requireAccount(request, env);
  if ('error' in auth) return (auth as any).error;
  const { accountId, userId } = auth as any;

  const body = await request.json() as {
    entry_id: string;
    target_account_ids?: string[];
    generate_invite_link?: boolean;
  };
  if (!body.entry_id) return json({ error: 'entry_id required' }, 400);

  // Fetch the compass entry (must belong to caller)
  const entry = await env.DB.prepare(
    'SELECT * FROM tea_compass_entries WHERE id = ? AND user_id = ? AND account_id = ?'
  ).bind(body.entry_id, userId, accountId).first() as Record<string, any> | null;
  if (!entry) return json({ error: 'Entry not found or not yours' }, 404);

  // Get caller identity for the invite page
  const caller = await env.DB.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first() as any;
  const account = await env.DB.prepare('SELECT name FROM accounts WHERE id = ?').bind(accountId).first() as any;

  const teaKey = entry.tea_key || [entry.name, entry.type, entry.year, entry.origin_region]
    .filter(Boolean).join('-').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');

  const sharedMetadata = JSON.stringify({
    name: entry.name,
    chineseName: entry.chinese_name,
    type: entry.type,
    form: entry.form,
    year: entry.year,
    season: entry.season,
    originRegion: entry.origin_region,
    category: entry.category,
    teaKey,
    photo: entry.photos ? JSON.parse(entry.photos)?.[0] : null,
    teawareCategory: entry.teaware_category,
    material: entry.material,
    capacityMl: entry.capacity_ml,
  });

  const now = new Date().toISOString();
  const shares: any[] = [];
  let inviteLink: string | null = null;

  // Direct push to known accounts
  const targetAccountIds: string[] = body.target_account_ids || [];
  for (const targetId of targetAccountIds) {
    const shareId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO compass_shares (id, source_entry_id, source_account_id, source_user_id,
        source_user_name, source_account_name, tea_key, shared_metadata,
        target_account_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(shareId, body.entry_id, accountId, userId,
      caller?.name || null, account?.name || null,
      teaKey, sharedMetadata, targetId, now).run();
    shares.push({ id: shareId, target_account_id: targetId });
  }

  // Invite link for external/unregistered tasters
  if (body.generate_invite_link) {
    const token = crypto.randomUUID().replace(/-/g, '');
    const shareId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO compass_shares (id, source_entry_id, source_account_id, source_user_id,
        source_user_name, source_account_name, tea_key, shared_metadata,
        invite_token, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).bind(shareId, body.entry_id, accountId, userId,
      caller?.name || null, account?.name || null,
      teaKey, sharedMetadata, token, now).run();
    shares.push({ id: shareId, invite_token: token });
    inviteLink = `/share/${token}`;
  }

  return json({ shares, invite_link: inviteLink }, 201);
};

// GET /api/compass/incoming — pending shares for the caller's active account
const handleCompassIncoming: Handler = async (request, env) => {
  const auth = await requireAccount(request, env);
  if ('error' in auth) return (auth as any).error;
  const { accountId } = auth as any;

  const result = await env.DB.prepare(
    `SELECT * FROM compass_shares WHERE target_account_id = ? AND status = 'pending' ORDER BY created_at DESC`
  ).bind(accountId).all();

  const shares = (result.results as Record<string, any>[]).map(s => ({
    ...s,
    shared_metadata: s.shared_metadata ? JSON.parse(s.shared_metadata) : {},
  }));
  return json({ shares });
};

// POST /api/compass/shares/:id/accept — create a compass entry, mark share accepted
const handleCompassAcceptShare: Handler = async (request, env, params) => {
  const auth = await requireAccount(request, env);
  if ('error' in auth) return (auth as any).error;
  const { accountId, userId } = auth as any;

  const share = await env.DB.prepare(
    `SELECT * FROM compass_shares WHERE id = ? AND target_account_id = ? AND status = 'pending'`
  ).bind(params.id, accountId).first() as Record<string, any> | null;
  if (!share) return json({ error: 'Share not found or already handled' }, 404);

  const meta = share.shared_metadata ? JSON.parse(share.shared_metadata as string) : {};
  const entryId = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO tea_compass_entries
       (id, user_id, account_id, name, chinese_name, type, form, year, season,
        origin_region, category, teaware_category, material, capacity_ml,
        photos, tea_key, status, notes, quantity, price_currency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'incoming', '', 1, 'NT', ?, ?)`
  ).bind(
    entryId, userId, accountId,
    meta.name || '', meta.chineseName || null, meta.type || null, meta.form || null,
    meta.year || null, meta.season || null, meta.originRegion || null,
    meta.category || 'tea', meta.teawareCategory || null, meta.material || null, meta.capacityMl || null,
    meta.photo ? JSON.stringify([meta.photo]) : '[]',
    meta.teaKey || share.tea_key,
    now, now
  ).run();

  await env.DB.prepare(
    `UPDATE compass_shares SET status = 'accepted', claimed_by_user_id = ?, claimed_at = ? WHERE id = ?`
  ).bind(userId, now, params.id).run();

  const created = await env.DB.prepare('SELECT * FROM tea_compass_entries WHERE id = ?').bind(entryId).first();
  return json({ entry: created, share_id: params.id });
};

// POST /api/compass/shares/:id/decline
const handleCompassDeclineShare: Handler = async (request, env, params) => {
  const auth = await requireAccount(request, env);
  if ('error' in auth) return (auth as any).error;
  const { accountId } = auth as any;

  const share = await env.DB.prepare(
    `SELECT id FROM compass_shares WHERE id = ? AND target_account_id = ? AND status = 'pending'`
  ).bind(params.id, accountId).first();
  if (!share) return json({ error: 'Share not found or already handled' }, 404);

  await env.DB.prepare(
    `UPDATE compass_shares SET status = 'declined' WHERE id = ?`
  ).bind(params.id).run();
  return json({ success: true });
};

// GET /api/compass/invite/:token — public, returns share metadata
const handleCompassGetInvite: Handler = async (request, env, params) => {
  const share = await env.DB.prepare(
    `SELECT * FROM compass_shares WHERE invite_token = ? AND status = 'pending'`
  ).bind(params.token).first() as Record<string, any> | null;
  if (!share) return json({ error: 'Invite not found or already used' }, 404);

  return json({
    id: share.id,
    tea_key: share.tea_key,
    shared_metadata: share.shared_metadata ? JSON.parse(share.shared_metadata as string) : {},
    source_user_name: share.source_user_name,
    source_account_name: share.source_account_name,
    created_at: share.created_at,
  });
};

// POST /api/compass/invite/:token/claim — authenticated user claims into their compass
const handleCompassClaimInvite: Handler = async (request, env, params) => {
  const auth = await requireAccount(request, env);
  if ('error' in auth) return (auth as any).error;
  const { accountId, userId } = auth as any;

  const share = await env.DB.prepare(
    `SELECT * FROM compass_shares WHERE invite_token = ? AND status = 'pending'`
  ).bind(params.token).first() as Record<string, any> | null;
  if (!share) return json({ error: 'Invite not found or already used' }, 404);

  const meta = share.shared_metadata ? JSON.parse(share.shared_metadata as string) : {};
  const entryId = crypto.randomUUID();
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO tea_compass_entries
       (id, user_id, account_id, name, chinese_name, type, form, year, season,
        origin_region, category, teaware_category, material, capacity_ml,
        photos, tea_key, status, notes, quantity, price_currency, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'incoming', '', 1, 'NT', ?, ?)`
  ).bind(
    entryId, userId, accountId,
    meta.name || '', meta.chineseName || null, meta.type || null, meta.form || null,
    meta.year || null, meta.season || null, meta.originRegion || null,
    meta.category || 'tea', meta.teawareCategory || null, meta.material || null, meta.capacityMl || null,
    meta.photo ? JSON.stringify([meta.photo]) : '[]',
    meta.teaKey || share.tea_key,
    now, now
  ).run();

  // Mark claimed — keep share open for other claimers (invite links are multi-use by default)
  await env.DB.prepare(
    `UPDATE compass_shares SET claimed_by_user_id = ?, claimed_at = ? WHERE id = ?`
  ).bind(userId, now, share.id).run();

  const created = await env.DB.prepare('SELECT * FROM tea_compass_entries WHERE id = ?').bind(entryId).first();
  return json({ entry: created });
};

// ── Tea Reviews (cross-account, keyed by tea_key) ──────────────────────────

// GET /api/tea-reviews?tea_key=&product_id=&source_sample_id=&visibility=
// Public to network reviews when unauthenticated; auth unlocks account-private reviews and drafts from others.
const handleGetTeaReviews: Handler = async (request, env) => {
  const url = new URL(request.url);
  const tea_key = url.searchParams.get('tea_key');
  const product_id = url.searchParams.get('product_id');
  const source_sample_id = url.searchParams.get('source_sample_id');
  const visibility = url.searchParams.get('visibility');

  if (!tea_key && !product_id && !source_sample_id) return json({ error: 'tea_key, product_id, or source_sample_id required' }, 400);

  const token = isAuthed(request);
  const claims = token ? parseToken(token) : null;
  const authorAccountId = claims?.active_account_id || null;
  const userId = claims?.sub || null;

  // Build visibility filter
  // Authenticated users see network + their account-private + their own private + drafts from others in network
  let visFilter = `r.visibility = 'network' AND r.status = 'submitted'`;
  if (authorAccountId) {
    visFilter = `(r.visibility = 'network' OR (r.visibility = 'account' AND r.author_account_id = ?) OR (r.visibility = 'private' AND r.author_user_id = ?))`;
  }

  // Build WHERE clause — support filtering by any of the three keys
  const whereParts: string[] = [];
  const keyBinds: any[] = [];
  if (tea_key) { whereParts.push(`r.tea_key = ?`); keyBinds.push(tea_key); }
  if (product_id) { whereParts.push(`r.product_id = ?`); keyBinds.push(product_id); }
  if (source_sample_id) { whereParts.push(`r.source_sample_id = ?`); keyBinds.push(source_sample_id); }
  if (visibility) { whereParts.push(`r.visibility = ?`); keyBinds.push(visibility); }
  const where = whereParts.join(' AND ');

  let query: string;
  let binds: any[];
  if (authorAccountId) {
    query = `SELECT r.*, u.name as author_name, a.name as author_account_name, a.slug as author_account_slug
             FROM tea_reviews r
             LEFT JOIN users u ON u.id = r.author_user_id
             LEFT JOIN accounts a ON a.id = r.author_account_id
             WHERE ${where} AND ${visFilter}
             ORDER BY r.status ASC, r.updated_at DESC`;
    binds = [...keyBinds, authorAccountId, userId];
  } else {
    query = `SELECT r.*, u.name as author_name, a.name as author_account_name, a.slug as author_account_slug
             FROM tea_reviews r
             LEFT JOIN users u ON u.id = r.author_user_id
             LEFT JOIN accounts a ON a.id = r.author_account_id
             WHERE ${where} AND r.visibility = 'network' AND r.status = 'submitted'
             ORDER BY r.updated_at DESC`;
    binds = [...keyBinds];
  }

  const result = await env.DB.prepare(query).bind(...binds).all();
  // Parse JSON fields
  const rows = (result.results as Record<string, any>[]).map(r => ({
    ...r,
    tasting: r.tasting ? JSON.parse(r.tasting) : null,
    voice_notes: r.voice_notes ? JSON.parse(r.voice_notes) : [],
    brew_params: r.brew_params ? JSON.parse(r.brew_params) : null,
  }));
  return json(rows);
};

// POST /api/tea-reviews
const handleCreateTeaReview: Handler = async (request, env) => {
  const auth = await requireAccount(request, env);
  if ('error' in auth) return (auth as any).error;
  const { accountId, userId } = auth as any;

  const body: any = await request.json();
  if (!body.tea_key) return json({ error: 'tea_key required' }, 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO tea_reviews (id, tea_key, product_id, product_account_id, author_user_id, author_account_id,
      visibility, session_date, rating, notes, voice_notes, tasting, brew_params,
      source_sample_id, verdict, would_buy, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.tea_key, body.product_id || null, body.product_id ? accountId : null,
    userId, accountId,
    body.visibility || 'network',
    body.session_date || null,
    body.rating || null,
    body.notes || null,
    body.voice_notes ? JSON.stringify(body.voice_notes) : null,
    body.tasting ? JSON.stringify(body.tasting) : null,
    body.brew_params ? JSON.stringify(body.brew_params) : null,
    body.source_sample_id || null,
    body.verdict || null,
    body.would_buy ? 1 : 0,
    body.status || 'submitted',
    now, now
  ).run();

  const created = await env.DB.prepare('SELECT * FROM tea_reviews WHERE id = ?').bind(id).first() as Record<string, any>;
  return json({
    ...created,
    tasting: created?.tasting ? JSON.parse(created.tasting) : null,
    voice_notes: created?.voice_notes ? JSON.parse(created.voice_notes) : [],
    brew_params: created?.brew_params ? JSON.parse(created.brew_params) : null,
  }, 201);
};

// PUT /api/tea-reviews/:id
const handleUpdateTeaReview: Handler = async (request, env, params) => {
  const auth = await requireAccount(request, env);
  if ('error' in auth) return (auth as any).error;
  const { userId } = auth as any;

  const existing = await env.DB.prepare(
    'SELECT * FROM tea_reviews WHERE id = ? AND author_user_id = ?'
  ).bind(params.id, userId).first();
  if (!existing) return json({ error: 'Not found or not your review' }, 404);

  const body: any = await request.json();
  const allowed = ['visibility', 'session_date', 'rating', 'notes', 'tasting', 'brew_params',
                   'voice_notes', 'status', 'verdict', 'would_buy'];
  const updates: string[] = [];
  const vals: any[] = [];
  for (const k of allowed) {
    if (body[k] !== undefined) {
      updates.push(`${k} = ?`);
      const v = body[k];
      vals.push(Array.isArray(v) || (v !== null && typeof v === 'object') ? JSON.stringify(v) : v);
    }
  }
  if (!updates.length) return json({ error: 'Nothing to update' }, 400);
  updates.push('updated_at = ?');
  vals.push(new Date().toISOString(), params.id, userId);

  await env.DB.prepare(
    `UPDATE tea_reviews SET ${updates.join(', ')} WHERE id = ? AND author_user_id = ?`
  ).bind(...vals).run();

  const updated = await env.DB.prepare('SELECT * FROM tea_reviews WHERE id = ?').bind(params.id).first() as Record<string, any>;
  return json({
    ...updated,
    tasting: updated?.tasting ? JSON.parse(updated.tasting) : null,
    voice_notes: updated?.voice_notes ? JSON.parse(updated.voice_notes) : [],
    brew_params: updated?.brew_params ? JSON.parse(updated.brew_params) : null,
  });
};

// DELETE /api/tea-reviews/:id
const handleDeleteTeaReview: Handler = async (request, env, params) => {
  const auth = await requireAccount(request, env);
  if ('error' in auth) return (auth as any).error;
  const { userId } = auth as any;

  const existing = await env.DB.prepare(
    'SELECT id FROM tea_reviews WHERE id = ? AND author_user_id = ?'
  ).bind(params.id, userId).first();
  if (!existing) return json({ error: 'Not found or not your review' }, 404);

  await env.DB.prepare('DELETE FROM tea_reviews WHERE id = ?').bind(params.id).run();
  return json({ ok: true });
};

// Customer: GET /api/tasting-journal. Returns the new shape with `note` and
// `tastings` JSON columns. Legacy rows (pre-migration) still parse via the
// client's tolerant fromApiRow.
const handleGetTastingJournal: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  const email = getUserEmail(request);
  const claims = parseToken(isAuthed(request)!);
  const headerAccount = request.headers.get('X-Teajia-Account') || claims?.active_account_id || null;

  let query = 'SELECT * FROM customer_tasting_journal WHERE user_id = ?';
  const binds: any[] = [email];
  if (headerAccount) {
    query += ' AND account_id = ?';
    binds.push(headerAccount);
  }
  query += ' ORDER BY created_at DESC';

  const { results } = await env.DB.prepare(query).bind(...binds).all();

  // Pass JSON strings through verbatim. The client parses them. This avoids
  // double-stringification and keeps the worker handler narrow.
  return json(results);
};

// Customer: POST /api/tasting-journal. Accepts the new shape (one entry per
// productId, with `note` and `tastings` JSON). Upserts on (user_id, product_id).
// Quick-note sentinel rows are rejected.
const handleAddTastingEntry: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  const email = getUserEmail(request);
  const claims = parseToken(isAuthed(request)!);
  const headerAccount = request.headers.get('X-Teajia-Account') || claims?.active_account_id || null;
  const body = await request.json() as any;

  if (!body.product_id || body.product_id === 'quick-note') {
    return json({ error: 'product_id required (quick-note removed)' }, 400);
  }

  const id = body.id || crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO customer_tasting_journal
      (id, account_id, user_id, product_id, product_name, product_type, product_image, note, tastings, compass_entry_id, archived, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, product_id) DO UPDATE SET
      product_name = excluded.product_name,
      product_type = excluded.product_type,
      product_image = excluded.product_image,
      note = excluded.note,
      tastings = excluded.tastings,
      compass_entry_id = excluded.compass_entry_id,
      archived = excluded.archived
  `).bind(
    id,
    headerAccount,
    email,
    body.product_id,
    body.product_name || null,
    body.product_type || null,
    body.product_image || null,
    typeof body.note === 'string' ? body.note : JSON.stringify(body.note || {}),
    typeof body.tastings === 'string' ? body.tastings : JSON.stringify(body.tastings || []),
    body.compass_entry_id || null,
    body.archived ? 1 : 0,
    body.created_at || new Date().toISOString()
  ).run();

  return json({ id, success: true }, 201);
};

// Customer: DELETE /api/tasting-journal/:id
const handleDeleteTastingEntry: Handler = async (request, env, params) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  const email = getUserEmail(request);

  await env.DB.prepare(
    'DELETE FROM customer_tasting_journal WHERE id = ? AND user_id = ?'
  ).bind(params.id, email).run();

  return json({ success: true });
};

// Customer: POST /api/tasting-journal/sync. Bulk upsert by (user_id, product_id).
const handleSyncTastingJournal: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  const email = getUserEmail(request);
  const claims = parseToken(isAuthed(request)!);
  const headerAccount = request.headers.get('X-Teajia-Account') || claims?.active_account_id || null;
  const body = await request.json() as any;
  const entries = Array.isArray(body) ? body : (body.entries || []);

  if (!Array.isArray(entries)) return json({ error: 'entries must be an array' }, 400);

  const valid = entries.filter((e: any) => e.product_id && e.product_id !== 'quick-note');

  const stmts = valid.map((e: any) =>
    env.DB.prepare(`
      INSERT INTO customer_tasting_journal
        (id, account_id, user_id, product_id, product_name, product_type, product_image, note, tastings, compass_entry_id, archived, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, product_id) DO UPDATE SET
        product_name = excluded.product_name,
        product_type = excluded.product_type,
        product_image = excluded.product_image,
        note = excluded.note,
        tastings = excluded.tastings,
        compass_entry_id = excluded.compass_entry_id,
        archived = excluded.archived
    `).bind(
      e.id || crypto.randomUUID(),
      headerAccount,
      email,
      e.product_id,
      e.product_name || null,
      e.product_type || null,
      e.product_image || null,
      typeof e.note === 'string' ? e.note : JSON.stringify(e.note || {}),
      typeof e.tastings === 'string' ? e.tastings : JSON.stringify(e.tastings || []),
      e.compass_entry_id || null,
      e.archived ? 1 : 0,
      e.created_at || new Date().toISOString()
    )
  );

  if (stmts.length > 0) await env.DB.batch(stmts);
  return json({ synced: stmts.length });
};

// Public (auth required): POST /api/samples/request
// Customer-facing sample request — inserts into tea_samples with status 'requested'
// and stores request metadata (quantity_grams, user_id, note) in the notes field as JSON.
const handleRequestSample: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;

  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  const body = await request.json() as {
    product_id?: string;
    quantity_grams?: number;
    note?: string;
    account_id?: string;
  };

  const { product_id, quantity_grams, note } = body;
  if (!product_id) return json({ error: 'product_id required' }, 400);
  if (!quantity_grams || quantity_grams <= 0) return json({ error: 'quantity_grams must be positive' }, 400);

  // Resolve account_id from JWT (active_account_id) or the body fallback
  const accountId = (claims.active_account_id as string | null | undefined) || body.account_id;
  if (!accountId) return json({ error: 'No active account' }, 400);

  // Look up the product name for the sample record
  const product = await env.DB.prepare(
    'SELECT given_name, product_name, type FROM products WHERE id = ? AND account_id = ?'
  ).bind(product_id, accountId).first() as { given_name?: string; product_name?: string; type?: string } | null;

  if (!product) return json({ error: 'Product not found' }, 404);
  if (product.type === 'Teaware') return json({ error: 'Samples are only available for tea products' }, 400);

  const sampleName = `${product.given_name || product.product_name || 'Tea'} sample`;
  const metaNotes = JSON.stringify({ quantity_grams, note: note || '', requested_by_user_id: claims.sub });

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO tea_samples (id, account_id, name, product_id, status, grams, notes, user_id, created_by)
     VALUES (?, ?, ?, ?, 'requested', ?, ?, ?, ?)`
  ).bind(id, accountId, sampleName, product_id, quantity_grams, metaNotes, claims.sub, claims.email || 'customer').run();

  return json({ id, status: 'requested' }, 201);
};

// Admin: GET /api/admin/samples
const handleListSamples: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const setId = url.searchParams.get('setId');
  const status = url.searchParams.get('status');

  let query = 'SELECT * FROM tea_samples WHERE account_id = ?';
  const binds: any[] = [accountId];

  if (setId) {
    query += ' AND set_id = ?';
    binds.push(setId);
  }
  if (status) {
    query += ' AND status = ?';
    binds.push(status);
  }
  query += ' ORDER BY created_at DESC';

  const result = await env.DB.prepare(query).bind(...binds).all();
  return json({ samples: (result.results as Record<string, any>[]).map(parseSampleRow) });
};

// Admin: POST /api/admin/samples
const handleCreateSample: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.account_id;
  const id = body.id || crypto.randomUUID();
  const userEmail = getUserEmail(request);

  const cols = [
    'name', 'chinese_name', 'type', 'form', 'year', 'origin_region',
    'source_id', 'source_name', 'source_contact', 'product_id',
    'compass_entry_id', 'set_id', 'status', 'grams', 'notes', 'photos',
    'created_by', 'user_id',
  ];
  const present = cols.filter(c => body[c] !== undefined);
  const allCols = ['id', 'account_id', ...present];
  if (!present.includes('user_id')) allCols.push('user_id');
  if (!present.includes('created_by')) allCols.push('created_by');

  const placeholders = allCols.map(() => '?').join(', ');
  const colNames = allCols.join(', ');

  const values: any[] = [id, accountId];
  for (const c of present) {
    let val = body[c] ?? null;
    if ((c === 'photos' || c === 'source_contact') && typeof val === 'object') {
      val = JSON.stringify(val);
    }
    values.push(val);
  }
  if (!present.includes('user_id')) values.push(userId);
  if (!present.includes('created_by')) values.push(userEmail || 'admin');

  await env.DB.prepare(
    `INSERT INTO tea_samples (${colNames}) VALUES (${placeholders})`
  ).bind(...values).run();

  await buildActivityLog(env, 'sample_created', `Sample ${body.name || id} created`, userEmail, 'sample', id, accountId).run();

  const created = await env.DB.prepare(
    'SELECT * FROM tea_samples WHERE id = ? AND account_id = ?'
  ).bind(id, accountId).first();
  return json(parseSampleRow(created as Record<string, any>), 201);
};

// Admin: PUT /api/admin/samples/:id
const handleUpdateSample: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.id;
  delete body.user_id;
  delete body.created_by;
  delete body.account_id;

  const cols = Object.keys(body);
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);

  for (const c of cols) {
    if ((c === 'photos' || c === 'source_contact') && typeof body[c] === 'object') {
      body[c] = JSON.stringify(body[c]);
    }
  }

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE tea_samples SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.id, accountId).run();

  const userEmail = getUserEmail(request);
  await buildActivityLog(env, 'sample_updated', `Sample ${params.id} updated`, userEmail, 'sample', params.id, accountId).run();

  const updated = await env.DB.prepare(
    'SELECT * FROM tea_samples WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first();
  if (!updated) return json({ error: 'Sample not found' }, 404);
  return json(parseSampleRow(updated as Record<string, any>));
};

// Admin: DELETE /api/admin/samples/:id
const handleDeleteSample: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  // Verify ownership before deleting joined tastings.
  const owned = await env.DB.prepare(
    'SELECT id FROM tea_samples WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first();
  if (!owned) return json({ error: 'Sample not found' }, 404);

  await env.DB.prepare('DELETE FROM tea_sample_tastings WHERE sample_id = ?').bind(params.id).run();
  await env.DB.prepare('DELETE FROM tea_samples WHERE id = ? AND account_id = ?')
    .bind(params.id, accountId).run();

  const userEmail = getUserEmail(request);
  await buildActivityLog(env, 'sample_deleted', `Sample ${params.id} deleted`, userEmail, 'sample', params.id, accountId).run();

  return json({ success: true });
};

// Admin: GET /api/admin/sample-sets
const handleListSampleSets: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const result = await env.DB.prepare(
    'SELECT * FROM tea_sample_sets WHERE account_id = ? ORDER BY created_at DESC'
  ).bind(accountId).all();
  return json({ sets: (result.results as Record<string, any>[]).map(parseSampleSetRow) });
};

// Admin: POST /api/admin/sample-sets
const handleCreateSampleSet: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.account_id;
  const id = body.id || crypto.randomUUID();

  const cols = ['name', 'source_id', 'source_name', 'purpose', 'notes', 'shared_with', 'user_id'];
  const present = cols.filter(c => body[c] !== undefined);
  const allCols = ['id', 'account_id', ...present];
  if (!present.includes('user_id')) allCols.push('user_id');

  const placeholders = allCols.map(() => '?').join(', ');
  const colNames = allCols.join(', ');

  const values: any[] = [id, accountId];
  for (const c of present) {
    let val = body[c] ?? null;
    if (c === 'shared_with' && typeof val === 'object') {
      val = JSON.stringify(val);
    }
    values.push(val);
  }
  if (!present.includes('user_id')) values.push(userId);

  await env.DB.prepare(
    `INSERT INTO tea_sample_sets (${colNames}) VALUES (${placeholders})`
  ).bind(...values).run();

  const userEmail = getUserEmail(request);
  await buildActivityLog(env, 'sample_set_created', `Sample set ${body.name || id} created`, userEmail, 'sample_set', id, accountId).run();

  const created = await env.DB.prepare(
    'SELECT * FROM tea_sample_sets WHERE id = ? AND account_id = ?'
  ).bind(id, accountId).first();
  return json(parseSampleSetRow(created as Record<string, any>), 201);
};

// Admin: PUT /api/admin/sample-sets/:id
const handleUpdateSampleSet: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.id;
  delete body.user_id;
  delete body.account_id;

  const cols = Object.keys(body);
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);

  if (cols.includes('shared_with') && typeof body.shared_with === 'object') {
    body.shared_with = JSON.stringify(body.shared_with);
  }

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE tea_sample_sets SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.id, accountId).run();

  const userEmail = getUserEmail(request);
  await buildActivityLog(env, 'sample_set_updated', `Sample set ${params.id} updated`, userEmail, 'sample_set', params.id, accountId).run();

  const updated = await env.DB.prepare(
    'SELECT * FROM tea_sample_sets WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first();
  if (!updated) return json({ error: 'Sample set not found' }, 404);
  return json(parseSampleSetRow(updated as Record<string, any>));
};

// Admin: DELETE /api/admin/sample-sets/:id
const handleDeleteSampleSet: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const owned = await env.DB.prepare(
    'SELECT id FROM tea_sample_sets WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first();
  if (!owned) return json({ error: 'Sample set not found' }, 404);

  const samples = await env.DB.prepare(
    'SELECT id FROM tea_samples WHERE set_id = ? AND account_id = ?'
  ).bind(params.id, accountId).all();
  const sampleIds = (samples.results as Record<string, any>[]).map(s => s.id);

  if (sampleIds.length > 0) {
    const placeholders = sampleIds.map(() => '?').join(', ');
    await env.DB.prepare(
      `DELETE FROM tea_sample_tastings WHERE sample_id IN (${placeholders})`
    ).bind(...sampleIds).run();
  }

  await env.DB.prepare('DELETE FROM tea_samples WHERE set_id = ? AND account_id = ?')
    .bind(params.id, accountId).run();
  await env.DB.prepare('DELETE FROM tea_sample_sets WHERE id = ? AND account_id = ?')
    .bind(params.id, accountId).run();

  const userEmail = getUserEmail(request);
  await buildActivityLog(env, 'sample_set_deleted', `Sample set ${params.id} deleted (${sampleIds.length} samples)`, userEmail, 'sample_set', params.id, accountId).run();

  return json({ success: true });
};

// ── Stock Holds ──

const handleReserveStock: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'stock');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const body = await request.json() as any;
  const { invoice_id } = body;

  if (!invoice_id) return json({ error: 'invoice_id required' }, 400);

  // Verify the invoice is in our account.
  const invoice = await env.DB.prepare(
    'SELECT id FROM invoices WHERE id = ? AND account_id = ?'
  ).bind(invoice_id, accountId).first();
  if (!invoice) return json({ error: 'Invoice not found' }, 404);

  const { results: items } = await env.DB.prepare(
    'SELECT product_id, quantity FROM invoice_line_items WHERE invoice_id = ? AND account_id = ?'
  ).bind(invoice_id, accountId).all();

  if (!items.length) return json({ error: 'No line items found' }, 400);

  await env.DB.prepare('DELETE FROM stock_holds WHERE invoice_id = ? AND account_id = ?')
    .bind(invoice_id, accountId).run();

  // Holds expire in 48 hours — abandoned drafts won't lock stock forever
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const stmts = (items as any[]).map((item: any) =>
    env.DB.prepare(
      'INSERT INTO stock_holds (id, account_id, invoice_id, product_id, held_grams, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), accountId, invoice_id, item.product_id, item.quantity, expiresAt)
  );

  if (stmts.length > 0) await env.DB.batch(stmts);

  return json({ held: items.length });
};

const handleReleaseStock: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'stock');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;
  const body = await request.json() as any;
  const { invoice_id } = body;

  if (!invoice_id) return json({ error: 'invoice_id required' }, 400);

  // Release the specific invoice's holds and opportunistically clean expired holds
  await env.DB.batch([
    env.DB.prepare('DELETE FROM stock_holds WHERE invoice_id = ? AND account_id = ?')
      .bind(invoice_id, accountId),
    env.DB.prepare("DELETE FROM stock_holds WHERE account_id = ? AND expires_at IS NOT NULL AND expires_at <= datetime('now')")
      .bind(accountId),
  ]);

  return json({ released: true });
};

const handleGetAvailableStock: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const productId = url.searchParams.get('product_id');

  if (!productId) return json({ error: 'product_id required' }, 400);

  const product = await env.DB.prepare(
    'SELECT stock_grams FROM products WHERE id = ? AND account_id = ?'
  ).bind(productId, accountId).first() as any;

  if (!product) return json({ error: 'Product not found' }, 404);

  const held = await env.DB.prepare(
    "SELECT COALESCE(SUM(held_grams), 0) as total_held FROM stock_holds WHERE product_id = ? AND account_id = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
  ).bind(productId, accountId).first() as any;

  const totalStock = Number(product.stock_grams) || 0;
  const totalHeld = Number(held.total_held) || 0;

  return json({
    stock_grams: totalStock,
    held_grams: totalHeld,
    available_grams: totalStock - totalHeld,
  });
};

// ── Accounts / Network ──

// GET /api/accounts/me — current user's memberships + active_account_id
const handleGetAccountsMe: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  const memberships = await loadMemberships(env, claims.sub);
  const activeAccountId = claims.active_account_id
    || memberships[0]?.account_id
    || null;
  return json({ memberships, active_account_id: activeAccountId });
};

// POST /api/accounts/switch — body { account_id }; reissue token
const handleSwitchAccount: Handler = async (request, env) => {
  const authErr = await requireAuth(request, env);
  if (authErr) return authErr;
  const token = isAuthed(request)!;
  const claims = parseToken(token);
  if (!claims) return json({ error: 'Invalid token' }, 401);

  const body = await request.json() as { account_id?: string };
  if (!body.account_id) return json({ error: 'account_id required' }, 400);

  const memberships = await loadMemberships(env, claims.sub);
  const isMember = memberships.some(m => m.account_id === body.account_id);
  const isPlatform = claims.platform_role === 'platform_owner' || claims.platform_role === 'platform_admin';
  if (!isMember && !isPlatform) return json({ error: 'Account access denied' }, 403);

  // Platform owners switching into a non-member account: verify the target exists.
  if (!isMember && isPlatform) {
    const exists = await env.DB.prepare('SELECT id FROM accounts WHERE id = ?')
      .bind(body.account_id).first();
    if (!exists) return json({ error: 'Account not found' }, 404);
    await logPlatformAction(env, 'platform.acting_as.entered', claims.sub, claims.email,
      'account', body.account_id, {});
  }

  const newToken = await createToken(env.JWT_SECRET, {
    sub: claims.sub,
    email: claims.email,
    name: claims.name,
    role: claims.role,
    platform_role: claims.platform_role,
    memberships,
    active_account_id: body.account_id,
  });

  return json({ token: newToken, active_account_id: body.account_id, memberships });
};

// GET /api/accounts/:id — account profile (auth, must be member)
const handleGetAccount: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) {
    // Must be member of the requested account specifically.
    const row = await env.DB.prepare(
      `SELECT role FROM account_members WHERE user_id = ? AND account_id = ? AND status = 'active'`
    ).bind(ctx.userId, params.id).first();
    if (!row) return json({ error: 'Account access denied' }, 403);
  }
  const acc = await env.DB.prepare('SELECT * FROM accounts WHERE id = ?').bind(params.id).first();
  if (!acc) return json({ error: 'Account not found' }, 404);
  return json(acc);
};

// PUT /api/accounts/:id — update account profile (owner-tier only)
const handleUpdateAccount: Handler = async (request, env, params) => {
  const ctx = await requireOwnerTier(request, env);
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) return json({ error: 'Account access denied' }, 403);

  const body = await request.json() as Record<string, any>;
  // Guard against changing immutable/privileged fields.
  delete body.id;
  delete body.is_platform_owner;
  delete body.created_at;

  const cols = Object.keys(body);
  if (cols.length === 0) return json({ error: 'No fields to update' }, 400);
  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE accounts SET ${sets}, updated_at = datetime('now') WHERE id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.id).run();

  const acc = await env.DB.prepare('SELECT * FROM accounts WHERE id = ?').bind(params.id).first();
  return json(acc);
};

// GET /api/accounts/:id/features
const handleGetAccountFeatures: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) return json({ error: 'Account access denied' }, 403);

  const account = await env.DB.prepare(
    'SELECT trust_tier, is_platform_owner FROM accounts WHERE id = ?'
  ).bind(params.id).first() as { trust_tier: string | null; is_platform_owner: number } | null;
  if (!account) return json({ error: 'Account not found' }, 404);

  const { results: overrides } = await env.DB.prepare(
    'SELECT feature, enabled FROM account_features WHERE account_id = ?'
  ).bind(params.id).all();

  const plan = planFeaturesForAccount(account.trust_tier, account.is_platform_owner === 1);
  const features = effectiveFeatures(plan, overrides as { feature: string; enabled: number }[]);
  return json({ features });
};

// GET /api/accounts/:id/members
const handleGetAccountMembers: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) return json({ error: 'Account access denied' }, 403);

  const { results } = await env.DB.prepare(
    `SELECT am.id, am.account_id, am.user_id, am.role, am.permissions, am.status, am.joined_at, am.invited_at,
            u.email, u.name, u.platform_role, u.can_create_collections
     FROM account_members am
     LEFT JOIN users u ON u.id = am.user_id
     WHERE am.account_id = ?
     ORDER BY am.joined_at ASC`
  ).bind(params.id).all();
  const members = (results as any[]).map(row => ({
    ...row,
    can_create_collections: Boolean(row.can_create_collections),
  }));
  return json({ members });
};

// POST /api/accounts/:id/members — invite by email (Members bundle)
const handleInviteAccountMember: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'members');
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) return json({ error: 'Account access denied' }, 403);

  const body = await request.json() as { email?: string; role?: string };
  const email = (body.email || '').trim().toLowerCase();
  const role = body.role || 'staff';
  if (!email) return json({ error: 'email required' }, 400);
  if (!['owner', 'staff', 'viewer'].includes(role)) {
    return json({ error: 'invalid role' }, 400);
  }

  // Find or create user. Inactive users get a temporary password that they
  // can reset via the standard reset-token flow.
  let user = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  let createdUser = false;
  if (!user) {
    const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    const tempPassword = crypto.randomUUID().replace(/-/g, '');
    const tempHash = await hashPasswordPBKDF2(tempPassword);
    await env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, '', ?, 'user')"
    ).bind(uid, email, tempHash).run();
    user = { id: uid };
    createdUser = true;
  }

  // Create or update membership. Use 'invited' status for new users so the
  // frontend can show pending state until they accept.
  const membershipStatus = createdUser ? 'invited' : 'active';
  await env.DB.prepare(
    `INSERT OR REPLACE INTO account_members
       (id, account_id, user_id, role, invited_by_user_id, invited_at, joined_at, status)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'), datetime('now'), ?)`
  ).bind(params.id, user.id, role, ctx.userId, membershipStatus).run();

  // Generate an invite/reset link for new users so they can set their password.
  let inviteLink: string | null = null;
  if (createdUser) {
    const inviteToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const resetId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    await env.DB.prepare(
      "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+14 days'))"
    ).bind(resetId, user.id, inviteToken).run();
    inviteLink = `/invite/${inviteToken}`;
  }

  return json({ success: true, user_id: user.id, created_user: createdUser, invite_link: inviteLink }, 201);
};

// PUT /api/accounts/:id/members/:userId — update role/status (owner-tier only)
// Role changes can promote a member to owner, which is effectively a tier change.
// Reserved to owner-tier specifically; the Members bundle alone is insufficient.
const handleUpdateAccountMember: Handler = async (request, env, params) => {
  const ctx = await requireOwnerTier(request, env);
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) return json({ error: 'Account access denied' }, 403);

  const body = await request.json() as { role?: string; status?: string };
  const updates: string[] = [];
  const binds: any[] = [];
  if (body.role) {
    if (!['owner', 'manager', 'staff', 'viewer'].includes(body.role)) {
      return json({ error: 'invalid role' }, 400);
    }
    updates.push('role = ?');
    binds.push(body.role);
  }
  if (body.status) {
    updates.push('status = ?');
    binds.push(body.status);
  }
  if (updates.length === 0) return json({ error: 'No fields to update' }, 400);

  binds.push(params.id, params.userId);
  await env.DB.prepare(
    `UPDATE account_members SET ${updates.join(', ')} WHERE account_id = ? AND user_id = ?`
  ).bind(...binds).run();

  return json({ success: true });
};

// DELETE /api/accounts/:id/members/:userId — remove (Members bundle)
const handleDeleteAccountMember: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'members');
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) return json({ error: 'Account access denied' }, 403);

  if (params.userId === ctx.userId) {
    return json({ error: 'Cannot remove yourself from an account' }, 400);
  }

  await env.DB.prepare(
    'DELETE FROM account_members WHERE account_id = ? AND user_id = ?'
  ).bind(params.id, params.userId).run();

  return json({ success: true });
};

// GET /api/accounts/:id/access — roster with per-member bundle resolution (Members bundle)
const handleGetAccountAccess: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'members');
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) return json({ error: 'Account access denied' }, 403);

  const account = await env.DB.prepare(
    'SELECT kind FROM accounts WHERE id = ?'
  ).bind(params.id).first() as { kind: string } | null;
  if (!account) return json({ error: 'Account not found' }, 404);
  const accountKind = (account.kind || 'location') as 'platform' | 'location' | 'master';

  const { results } = await env.DB.prepare(
    `SELECT am.user_id, am.role, am.permissions, am.status, am.joined_at, am.invited_at,
            u.email, u.name, u.username
     FROM account_members am
     LEFT JOIN users u ON u.id = am.user_id
     WHERE am.account_id = ?`
  ).bind(params.id).all();

  const rolePriority = (role: string) => role === 'owner' ? 0 : role === 'staff' ? 1 : 2;

  const members = (results as any[])
    .map(row => ({
      user_id: row.user_id as string,
      email: (row.email as string) || '',
      name: (row.name as string) || '',
      username: (row.username as string | null) ?? null,
      role: row.role as 'owner' | 'staff' | 'viewer',
      bundles: resolveBundles(row.role as 'owner' | 'staff' | 'viewer', accountKind, row.permissions as string | null),
      status: (row.status as string) || 'active',
      joined_at: (row.joined_at as string) || null,
      invited_at: (row.invited_at as string) || null,
    }))
    .sort((a, b) => {
      const rDiff = rolePriority(a.role) - rolePriority(b.role);
      if (rDiff !== 0) return rDiff;
      const aTime = a.joined_at ?? '';
      const bTime = b.joined_at ?? '';
      return aTime < bTime ? -1 : aTime > bTime ? 1 : 0;
    });

  return json({ members });
};

// PUT /api/accounts/:id/members/:userId/bundles — replace bundle set wholesale (Members bundle)
const handleUpdateMemberBundles: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'members');
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) return json({ error: 'Account access denied' }, 403);

  const body = await request.json() as { bundles?: unknown };
  if (!Array.isArray(body.bundles)) return json({ error: 'bundles must be an array' }, 400);
  const invalid = (body.bundles as unknown[]).filter(b => !ALL_BUNDLES.includes(b as Bundle));
  if (invalid.length > 0) {
    return json({ error: `Invalid bundle(s): ${invalid.join(', ')}. Valid: ${ALL_BUNDLES.join(', ')}` }, 400);
  }
  const newBundles = body.bundles as Bundle[];

  const member = await env.DB.prepare(
    'SELECT role, status, permissions FROM account_members WHERE account_id = ? AND user_id = ?'
  ).bind(params.id, params.userId).first() as { role: string; status: string; permissions: string | null } | null;

  if (!member || member.status !== 'active') return json({ error: 'Member not found or not active in this account' }, 404);
  if (member.role === 'owner') {
    return json({ error: 'Cannot set bundles for owner-tier member; owners always have all bundles.' }, 400);
  }

  let existing: Record<string, unknown> = {};
  if (member.permissions) {
    try { existing = JSON.parse(member.permissions); } catch { /* ignore malformed */ }
  }
  const previousBundles = Array.isArray(existing.bundles) ? (existing.bundles as string[]) : [];
  const updatedPermissions = JSON.stringify({ ...existing, bundles: newBundles });

  await env.DB.prepare(
    'UPDATE account_members SET permissions = ? WHERE account_id = ? AND user_id = ?'
  ).bind(updatedPermissions, params.id, params.userId).run();

  await logPlatformAction(env, 'member.bundles_updated', ctx.userId, ctx.email, 'member', `${params.id}:${params.userId}`, {
    previous_bundles: previousBundles,
    new_bundles: newBundles,
  }, params.id);

  return json({ success: true, bundles: newBundles });
};

// GET /api/accounts/:id/activity — per-account audit log.
// Visible to: any active member of the account, plus platform owners/admins.
// Returns platform_audit_log rows where account_id = :id, newest first.
const handleGetAccountActivity: Handler = async (request, env, params) => {
  const ctx = await getActiveAccount(request, env);
  if ('error' in ctx) return ctx.error;

  // Membership check: if not platform-acting, must be a member of the requested account.
  if (!ctx.isPlatform && params.id !== ctx.accountId) {
    return json({ error: 'Account access denied' }, 403);
  }
  if (!ctx.isPlatform) {
    const row = await env.DB.prepare(
      `SELECT 1 FROM account_members WHERE user_id = ? AND account_id = ? AND status = 'active'`
    ).bind(ctx.userId, params.id).first();
    if (!row) return json({ error: 'Account access denied' }, 403);
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  const { results } = await env.DB.prepare(
    `SELECT id, action, actor_id, actor_email, target_type, target_id, details, created_at,
            account_id, actor_account_id
     FROM platform_audit_log
     WHERE account_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(params.id, limit, offset).all();

  const entries = (results as any[]).map(r => ({
    ...r,
    details: (() => { try { return JSON.parse(r.details as string); } catch { return r.details; } })(),
  }));

  return json({ entries, limit, offset });
};

// ── Platform Audit Log Helper ─────────────────────────────────────────────────

async function logPlatformAction(
  env: Env,
  action: string,
  actorId: string,
  actorEmail: string,
  targetType: string,
  targetId: string,
  details: Record<string, any> = {},
  accountId?: string | null,
  actorAccountId?: string | null
): Promise<void> {
  try {
    // Default account_id to target_id when the target is an account, so legacy
    // call sites (which don't pass accountId) still produce per-account-filterable rows.
    const acct = accountId ?? (targetType === 'account' ? targetId : null);
    // actor_account_id = the account context the actor was operating in when
    // this fired. Distinct from `acct` (the action's target). Defaults to acct
    // so legacy callers — which historically pass ctx.accountId as accountId —
    // keep their meaning. Cross-account / acting-as call sites should pass it
    // explicitly so the UI can render "Operating as X".
    const actorAcct = actorAccountId ?? acct;
    await env.DB.prepare(
      `INSERT INTO platform_audit_log (action, actor_id, actor_email, target_type, target_id, details, account_id, actor_account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(action, actorId, actorEmail, targetType, targetId, JSON.stringify(details), acct, actorAcct).run();
  } catch {
    // Non-critical — never let logging failure break the actual operation
  }
}

// Auto-log a platform owner/admin acting inside an account that isn't theirs.
// No-op when the actor is editing their own account, so normal admin work
// doesn't pollute the per-account audit log.
async function auditPlatformActingWrite(
  env: Env,
  ctx: { userId: string; email: string; accountId: string; isPlatform: boolean },
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, any> = {}
): Promise<void> {
  if (!ctx.isPlatform) return;
  // Determine if the active account is one the user actually owns/staffs.
  // We do this lazily here; if they're a member of ctx.accountId, skip the log.
  try {
    const row = await env.DB.prepare(
      `SELECT 1 FROM account_members WHERE user_id = ? AND account_id = ? AND status = 'active'`
    ).bind(ctx.userId, ctx.accountId).first();
    if (row) return; // acting in own account — not cross-account
  } catch {}
  // For acting-as writes: target account = ctx.accountId, AND the actor's
  // active context is also ctx.accountId. Pass both so the audit row clearly
  // says "Adrian, while acting as <account>, did X to <account>".
  await logPlatformAction(
    env, action, ctx.userId, ctx.email, targetType, targetId, details,
    ctx.accountId, ctx.accountId
  );
}

// ── Email Helper (Resend — optional) ──────────────────────────────────────────

async function sendEmail(
  env: Env,
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!env.SENDER_EMAIL || !env.RESEND_API_KEY) return false;
  try {
    const from = env.SENDER_NAME
      ? `${env.SENDER_NAME} <${env.SENDER_EMAIL}>`
      : env.SENDER_EMAIL;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function fulfillmentEmailHtml(
  customerName: string,
  orderRef: string,
  lineItems: { name: string; qty: string }[],
  amountUsd: number | null,
  orderUrl: string,
): string {
  const rows = lineItems.map(i =>
    `<tr><td style="padding:6px 0;border-bottom:1px solid #e8e0d4;font-size:14px;color:#3a2e24">${i.name}</td>` +
    `<td style="padding:6px 0;border-bottom:1px solid #e8e0d4;font-size:14px;color:#7a6a56;text-align:right">${i.qty}</td></tr>`
  ).join('');
  const totalRow = amountUsd != null
    ? `<tr><td style="padding:10px 0 0;font-size:14px;font-weight:bold;color:#3a2e24">Total</td>` +
      `<td style="padding:10px 0 0;font-size:14px;font-weight:bold;color:#3a2e24;text-align:right">$${amountUsd.toFixed(2)}</td></tr>`
    : '';
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;padding:40px 24px">
<tr><td>
  <p style="font-size:22px;font-weight:bold;color:#3a2e24;margin:0 0 4px">Teajia</p>
  <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#9a8672;margin:0 0 32px">Order Confirmation</p>
  <p style="font-size:15px;color:#3a2e24;margin:0 0 8px">Hello ${customerName},</p>
  <p style="font-size:14px;color:#7a6a56;line-height:1.6;margin:0 0 24px">
    Your order <strong style="color:#3a2e24">${orderRef}</strong> has been confirmed. We'll be in touch shortly to arrange delivery.
  </p>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e8e0d4;margin-bottom:24px">
    ${rows}${totalRow}
  </table>
  <a href="${orderUrl}" style="display:inline-block;padding:12px 24px;background:#a8874d;color:#fff;text-decoration:none;font-size:13px;letter-spacing:0.08em">
    View Order Status
  </a>
  <p style="font-size:12px;color:#9a8672;margin-top:32px;line-height:1.6">
    Questions? Reply to this email or message us on WhatsApp.<br>
    — The Teajia Team
  </p>
</td></tr>
</table>
</body>
</html>`;
}

function inviteEmailHtml(inviteUrl: string, accountName: string): string {
  return `
    <div style="font-family:serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#2a2a2a">
      <h2 style="font-size:20px;margin-bottom:8px">You've been invited to Teajia</h2>
      <p style="color:#666;margin-bottom:24px">You've been added as an owner of <strong>${accountName}</strong>.</p>
      <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#b8924e;color:#fff;text-decoration:none;border-radius:6px;font-size:14px">
        Set up your account
      </a>
      <p style="color:#999;font-size:12px;margin-top:24px">This link expires in 14 days.</p>
    </div>`;
}

function welcomeEmailHtml(name: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0eb;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;padding:40px 24px">
<tr><td>
  <p style="font-size:22px;font-weight:bold;color:#3a2e24;margin:0 0 4px">Teajia</p>
  <p style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#9a8672;margin:0 0 32px">Welcome</p>
  <p style="font-size:15px;color:#3a2e24;margin:0 0 8px">Hello ${name},</p>
  <p style="font-size:14px;color:#7a6a56;line-height:1.6;margin:0 0 24px">
    Your Teajia account is ready. Browse the collection, explore the journal, and reach out whenever you'd like to discuss tea.
  </p>
  <a href="https://teajia.com" style="display:inline-block;padding:12px 24px;background:#a8874d;color:#fff;text-decoration:none;font-size:13px;letter-spacing:0.08em">
    Explore Teajia
  </a>
  <p style="font-size:12px;color:#9a8672;margin-top:32px;line-height:1.6">
    — The Teajia Team
  </p>
</td></tr>
</table>
</body>
</html>`;
}

// ── Platform Admin Endpoints ─────────────────────────────────────────────────

// ── Plan-based feature defaults ─────────────────────────────────────────────
// Features listed here are ON by default for the given trust_tier.
// Platform accounts (is_platform_owner) get everything.
// The account_features table stores overrides: explicit 0 disables a plan feature,
// explicit 1 enables a feature not in the plan.

const ALL_KNOWN_FEATURES = ['compass', 'catalog_sharing', 'ai_wisdom_generation'] as const;

const PLAN_FEATURES: Record<string, readonly string[]> = {
  basic:    [],
  verified: ['compass'],
  partner:  ['compass', 'catalog_sharing'],
  platform: ['compass', 'catalog_sharing', 'ai_wisdom_generation'],
};

function planFeaturesForAccount(trustTier: string | null, isPlatformOwner: boolean): Set<string> {
  const tier = isPlatformOwner ? 'platform' : (trustTier ?? 'basic');
  return new Set(PLAN_FEATURES[tier] ?? []);
}

function effectiveFeatures(
  planFeatures: Set<string>,
  overrides: { feature: string; enabled: number }[],
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const f of ALL_KNOWN_FEATURES) result[f] = planFeatures.has(f);
  for (const o of overrides) result[o.feature] = o.enabled === 1;
  return result;
}

// GET /api/platform/users — all users with platform_role + account memberships summary
const handlePlatformListUsers: Handler = async (request, env) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const { results } = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.username, u.platform_role, u.created_at,
            GROUP_CONCAT(am.account_id || ':' || am.role) as memberships_raw
     FROM users u
     LEFT JOIN account_members am ON am.user_id = u.id AND am.status = 'active'
     GROUP BY u.id
     ORDER BY
       CASE u.platform_role
         WHEN 'platform_owner' THEN 0
         WHEN 'platform_admin' THEN 1
         ELSE 2
       END, u.created_at ASC`
  ).all();

  const users = (results as any[]).map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    username: u.username,
    platform_role: u.platform_role ?? null,
    created_at: u.created_at,
    memberships: u.memberships_raw
      ? u.memberships_raw.split(',').map((s: string) => {
          const [account_id, role] = s.split(':');
          return { account_id, role };
        })
      : [],
  }));

  return json({ users });
};

// PUT /api/platform/users/:id/platform-role — set platform_role (platform_owner only)
const handlePlatformSetUserRole: Handler = async (request, env, params) => {
  const authErr = await requirePlatformOwner(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  if (params.id === claims.sub) {
    return json({ error: 'Cannot change your own platform role' }, 400);
  }

  const body = await request.json() as { platform_role?: string | null };
  const allowed = [null, 'platform_admin'];
  // platform_owner cannot be granted via API — only via direct DB access
  if (!allowed.includes(body.platform_role as any)) {
    return json({ error: 'Invalid platform_role. Allowed: null, platform_admin' }, 400);
  }

  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(params.id).first();
  if (!user) return json({ error: 'User not found' }, 404);

  const prev = await env.DB.prepare('SELECT platform_role, email FROM users WHERE id = ?').bind(params.id).first();
  await env.DB.prepare('UPDATE users SET platform_role = ? WHERE id = ?')
    .bind(body.platform_role ?? null, params.id).run();

  await logPlatformAction(env, 'platform_role.changed', claims.sub, claims.email,
    'user', params.id, { from: (prev as any)?.platform_role ?? null, to: body.platform_role ?? null, email: (prev as any)?.email });

  return json({ success: true, platform_role: body.platform_role ?? null });
};

// GET /api/platform/accounts — all accounts with their enabled features
const handlePlatformListAccounts: Handler = async (request, env) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const { results: accounts } = await env.DB.prepare(
    `SELECT a.id, a.slug, a.name, a.location_city, a.location_country,
            a.is_platform_owner, a.public_enabled, a.status, a.trust_tier, a.created_at,
            COUNT(am.user_id) as member_count
     FROM accounts a
     LEFT JOIN account_members am ON am.account_id = a.id AND am.status = 'active'
     GROUP BY a.id
     ORDER BY a.is_platform_owner DESC, a.name ASC`
  ).all();

  const { results: features } = await env.DB.prepare(
    'SELECT account_id, feature, enabled FROM account_features'
  ).all();

  const overridesByAccount = (features as any[]).reduce((acc, f) => {
    if (!acc[f.account_id]) acc[f.account_id] = [];
    acc[f.account_id].push({ feature: f.feature, enabled: f.enabled });
    return acc;
  }, {} as Record<string, { feature: string; enabled: number }[]>);

  const result = (accounts as any[]).map(a => {
    const isPlatform = a.is_platform_owner === 1;
    const plan = planFeaturesForAccount(a.trust_tier, isPlatform);
    return {
      ...a,
      is_platform_owner: isPlatform,
      public_enabled: a.public_enabled === 1,
      member_count: a.member_count ?? 0,
      features: effectiveFeatures(plan, overridesByAccount[a.id] ?? []),
    };
  });

  return json({ accounts: result });
};

// PUT /api/platform/accounts/:id/features/:feature — toggle a feature on/off
const handlePlatformToggleFeature: Handler = async (request, env, params) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const body = await request.json() as { enabled: boolean };

  const account = await env.DB.prepare('SELECT id FROM accounts WHERE id = ?').bind(params.id).first();
  if (!account) return json({ error: 'Account not found' }, 404);

  await env.DB.prepare(
    `INSERT INTO account_features (account_id, feature, enabled, enabled_by, enabled_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(account_id, feature) DO UPDATE SET
       enabled = excluded.enabled,
       enabled_by = excluded.enabled_by,
       enabled_at = excluded.enabled_at`
  ).bind(params.id, params.feature, body.enabled ? 1 : 0, claims.sub).run();

  await logPlatformAction(env, 'feature.toggled', claims.sub, claims.email,
    'feature', `${params.id}:${params.feature}`, { feature: params.feature, enabled: body.enabled });

  return json({ success: true, account_id: params.id, feature: params.feature, enabled: body.enabled });
};

// PUT /api/platform/accounts/:id/status — suspend or reactivate an account
const handlePlatformSetAccountStatus: Handler = async (request, env, params) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const body = await request.json() as { status: 'active' | 'suspended' };
  if (!['active', 'suspended'].includes(body.status)) {
    return json({ error: 'status must be active or suspended' }, 400);
  }

  const account = await env.DB.prepare('SELECT id, name, is_platform_owner FROM accounts WHERE id = ?').bind(params.id).first();
  if (!account) return json({ error: 'Account not found' }, 404);
  if (account.is_platform_owner) return json({ error: 'Cannot suspend the primary platform account' }, 400);

  await env.DB.prepare('UPDATE accounts SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(body.status, params.id).run();

  await logPlatformAction(env, `account.${body.status}`, claims.sub, claims.email,
    'account', params.id, { name: account.name });

  return json({ success: true, status: body.status });
};

// POST /api/platform/accounts/:id/suspend — suspend an account (Platform tier)
const handlePlatformSuspendAccount: Handler = async (request, env, params) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const body = await request.json().catch(() => ({})) as { reason?: string };

  const account = await env.DB.prepare('SELECT id, name, kind FROM accounts WHERE id = ?').bind(params.id).first();
  if (!account) return json({ error: 'Account not found' }, 404);
  if ((account.kind as string) === 'platform') return json({ error: 'Cannot suspend the platform account' }, 400);

  await env.DB.prepare("UPDATE accounts SET status = 'suspended', updated_at = datetime('now') WHERE id = ?")
    .bind(params.id).run();

  await logPlatformAction(env, 'account.suspended', claims.sub, claims.email,
    'account', params.id, { name: account.name, reason: body.reason || null });

  return json({ success: true });
};

// POST /api/platform/accounts/:id/reactivate — reactivate a suspended account (Platform tier)
const handlePlatformReactivateAccount: Handler = async (request, env, params) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const body = await request.json().catch(() => ({})) as { note?: string };

  const account = await env.DB.prepare('SELECT id, name, status FROM accounts WHERE id = ?').bind(params.id).first();
  if (!account) return json({ error: 'Account not found' }, 404);
  if ((account.status as string) !== 'suspended') return json({ error: 'Account is not suspended' }, 400);

  await env.DB.prepare("UPDATE accounts SET status = 'active', updated_at = datetime('now') WHERE id = ?")
    .bind(params.id).run();

  await logPlatformAction(env, 'account.reactivated', claims.sub, claims.email,
    'account', params.id, { name: account.name, note: body.note || null });

  return json({ success: true });
};

// PUT /api/platform/accounts/:id/trust-tier — set trust tier
const handlePlatformSetTrustTier: Handler = async (request, env, params) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const body = await request.json() as { trust_tier: string };
  const allowed = ['basic', 'verified', 'partner'];
  if (!allowed.includes(body.trust_tier)) {
    return json({ error: `trust_tier must be one of: ${allowed.join(', ')}` }, 400);
  }

  const account = await env.DB.prepare('SELECT id, name, trust_tier FROM accounts WHERE id = ?').bind(params.id).first();
  if (!account) return json({ error: 'Account not found' }, 404);

  await env.DB.prepare('UPDATE accounts SET trust_tier = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(body.trust_tier, params.id).run();

  await logPlatformAction(env, 'account.trust_tier_changed', claims.sub, claims.email,
    'account', params.id, { from: account.trust_tier, to: body.trust_tier, name: account.name });

  return json({ success: true, trust_tier: body.trust_tier });
};

// POST /api/platform/users/:id/resend-invite — generate a new invite link
const handlePlatformResendInvite: Handler = async (request, env, params) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const user = await env.DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(params.id).first();
  if (!user) return json({ error: 'User not found' }, 404);

  // Invalidate old tokens
  await env.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').bind(params.id).run();

  const inviteToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const resetId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  await env.DB.prepare(
    "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+14 days'))"
  ).bind(resetId, params.id, inviteToken).run();

  const inviteLink = `/invite/${inviteToken}`;

  // Try to send email if configured
  let emailSent = false;
  const body = await request.json().catch(() => ({})) as { account_name?: string };
  if (env.SENDER_EMAIL && user.email) {
    const inviteUrl = `https://teajia.app${inviteLink}`;
    emailSent = await sendEmail(
      env,
      user.email as string,
      'Your Teajia invite',
      inviteEmailHtml(inviteUrl, body.account_name || 'Teajia')
    );
  }

  await logPlatformAction(env, 'user.invite_resent', claims.sub, claims.email,
    'user', params.id, { email: user.email, email_sent: emailSent });

  return json({ success: true, invite_link: inviteLink, email_sent: emailSent });
};

// GET /api/platform/audit-log — recent platform actions
// Optional filters: account_id, actor_id, action (exact match), limit (default 50, max 200), offset (default 0)
const handlePlatformAuditLog: Handler = async (request, env) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0');
  const filterAccountId = url.searchParams.get('account_id') || null;
  const filterActorId = url.searchParams.get('actor_id') || null;
  const filterAction = url.searchParams.get('action') || null;

  const conditions: string[] = [];
  const binds: (string | number)[] = [];

  if (filterAccountId) {
    conditions.push("target_id = ?");
    binds.push(filterAccountId);
  }
  if (filterActorId) {
    conditions.push("actor_id = ?");
    binds.push(filterActorId);
  }
  if (filterAction) {
    conditions.push("action = ?");
    binds.push(filterAction);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  binds.push(limit, offset);

  const { results } = await env.DB.prepare(
    `SELECT id, action, actor_id, actor_email, target_type, target_id, details, created_at,
            account_id, actor_account_id
     FROM platform_audit_log
     ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`
  ).bind(...binds).all();

  // Parse details JSON so the client doesn't have to
  const entries = (results as any[]).map(r => ({
    ...r,
    details: (() => {
      try { return JSON.parse(r.details as string); } catch { return r.details; }
    })(),
  }));

  return json({ entries, limit, offset });
};

// PUT /api/accounts/:id/members/:userId/permissions — set per-member feature permissions (Members bundle)
// @deprecated Use the bundles endpoint introduced in sub-step 0.4 (PUT .../bundles)
// for granular bundle assignment. This endpoint remains for backward compatibility
// with the legacy TeamView UI; it will be retired in sub-step 0.6 alongside TeamView.
const handleUpdateMemberPermissions: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'members');
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) return json({ error: 'Account access denied' }, 403);

  const body = await request.json() as Record<string, boolean>;

  // Only allow toggling features that are actually enabled for this account
  const { results: featureRows } = await env.DB.prepare(
    'SELECT feature FROM account_features WHERE account_id = ? AND enabled = 1'
  ).bind(params.id).all();
  const enabledFeatures = new Set((featureRows as any[]).map(r => r.feature as string));

  const sanitised: Record<string, boolean> = {};
  for (const [feature, enabled] of Object.entries(body)) {
    if (enabledFeatures.has(feature)) sanitised[feature] = Boolean(enabled);
  }

  await env.DB.prepare(
    'UPDATE account_members SET permissions = ? WHERE account_id = ? AND user_id = ?'
  ).bind(JSON.stringify(sanitised), params.id, params.userId).run();

  return json({ success: true, permissions: sanitised });
};

// POST /api/accounts/:id/transfer-ownership — owner-tier only
const handleTransferOwnership: Handler = async (request, env, params) => {
  const ctx = await requireOwnerTier(request, env);
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) return json({ error: 'Account access denied' }, 403);

  const body = await request.json() as { new_owner_user_id: string };
  if (!body.new_owner_user_id) return json({ error: 'new_owner_user_id required' }, 400);
  if (body.new_owner_user_id === ctx.userId) return json({ error: 'You are already the owner' }, 400);

  // Verify the target is an active member of this account
  const target = await env.DB.prepare(
    `SELECT user_id, role FROM account_members WHERE account_id = ? AND user_id = ? AND status = 'active'`
  ).bind(params.id, body.new_owner_user_id).first();
  if (!target) return json({ error: 'Target user is not an active member of this account' }, 404);

  // Demote current owner to staff, promote target to owner
  await env.DB.batch([
    env.DB.prepare('UPDATE account_members SET role = \'staff\' WHERE account_id = ? AND user_id = ?')
      .bind(params.id, ctx.userId),
    env.DB.prepare('UPDATE account_members SET role = \'owner\' WHERE account_id = ? AND user_id = ?')
      .bind(params.id, body.new_owner_user_id),
  ]);

  await logPlatformAction(env, 'account.ownership_transferred', ctx.userId, ctx.email,
    'account', params.id,
    { previous_owner_user_id: ctx.userId, new_owner_user_id: body.new_owner_user_id },
    params.id);

  return json({ success: true, new_owner_user_id: body.new_owner_user_id });
};

// POST /api/platform/accounts — create a new account + assign first owner
const handlePlatformCreateAccount: Handler = async (request, env) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const body = await request.json() as {
    slug?: string;
    name?: string;
    invoice_prefix?: string;
    location_city?: string;
    location_country?: string;
    currency_default?: string;
    timezone?: string;
    whatsapp_number?: string;
    contact_email?: string;
    public_enabled?: boolean;
    owner_email?: string;
  };

  const slug = (body.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const name = (body.name || '').trim();
  if (!slug || !name) return json({ error: 'slug and name are required' }, 400);
  if (!body.invoice_prefix) return json({ error: 'invoice_prefix is required' }, 400);

  // Check slug uniqueness
  const existing = await env.DB.prepare('SELECT id FROM accounts WHERE slug = ?').bind(slug).first();
  if (existing) return json({ error: `Slug "${slug}" is already taken` }, 409);

  const accountId = `acc_${slug.replace(/-/g, '_')}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO accounts (id, slug, name, invoice_prefix, location_city, location_country,
       currency_default, timezone, whatsapp_number, contact_email, public_enabled,
       status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
  ).bind(
    accountId, slug, name,
    (body.invoice_prefix || '').toUpperCase(),
    body.location_city || null,
    body.location_country || null,
    body.currency_default || 'USD',
    body.timezone || 'UTC',
    body.whatsapp_number || null,
    body.contact_email || null,
    body.public_enabled !== false ? 1 : 0,
    now, now
  ).run();

  // Seed ai_wisdom_generation as disabled (platform admin can enable later)
  await env.DB.prepare(
    `INSERT OR IGNORE INTO account_features (account_id, feature, enabled, enabled_by)
     VALUES (?, 'ai_wisdom_generation', 0, ?)`
  ).bind(accountId, claims.sub).run();

  // Find or create owner user
  let inviteLink: string | null = null;
  if (body.owner_email) {
    const ownerEmail = body.owner_email.trim().toLowerCase();
    let user = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?').bind(ownerEmail).first();
    let createdUser = false;

    if (!user) {
      const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
      const tempHash = await hashPasswordPBKDF2(crypto.randomUUID().replace(/-/g, ''));
      await env.DB.prepare(
        "INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, '', ?, 'user')"
      ).bind(uid, ownerEmail, tempHash).run();
      user = { id: uid };
      createdUser = true;
    }

    await env.DB.prepare(
      `INSERT OR REPLACE INTO account_members
         (id, account_id, user_id, role, invited_by_user_id, invited_at, joined_at, status)
       VALUES (lower(hex(randomblob(16))), ?, ?, 'owner', ?, datetime('now'), datetime('now'), ?)`
    ).bind(accountId, user.id, claims.sub, createdUser ? 'invited' : 'active').run();

    if (createdUser) {
      const inviteToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const resetId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
      await env.DB.prepare(
        "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+14 days'))"
      ).bind(resetId, user.id, inviteToken).run();
      inviteLink = `/invite/${inviteToken}`;
    }
  }

  // Try to send invite email if owner was newly created
  let emailSent = false;
  if (inviteLink && body.owner_email && env.SENDER_EMAIL) {
    const inviteUrl = `https://teajia.app${inviteLink}`;
    emailSent = await sendEmail(env, body.owner_email, `You've been invited to manage ${name} on Teajia`, inviteEmailHtml(inviteUrl, name));
  }

  await logPlatformAction(env, 'account.created', claims.sub, claims.email,
    'account', accountId, { slug, name, owner_email: body.owner_email || null });

  return json({ success: true, account_id: accountId, slug, invite_link: inviteLink, email_sent: emailSent }, 201);
};

// GET /api/platform/applications — pending account application queue (Platform tier)
const handlePlatformListApplications: Handler = async (request, env) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const kindFilter = url.searchParams.get('kind');

  const validStatuses = ['pending', 'approved', 'declined', 'withdrawn'];
  const validKinds = ['location', 'master'];

  const conditions: string[] = [];
  const binds: any[] = [];

  if (statusFilter) {
    if (!validStatuses.includes(statusFilter)) {
      return json({ error: `status must be one of: ${validStatuses.join(', ')}` }, 400);
    }
    conditions.push('status = ?');
    binds.push(statusFilter);
  }
  if (kindFilter) {
    if (!validKinds.includes(kindFilter)) {
      return json({ error: `kind must be one of: ${validKinds.join(', ')}` }, 400);
    }
    conditions.push('proposed_account_kind = ?');
    binds.push(kindFilter);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(
    `SELECT id, applicant_email, applicant_name, proposed_account_kind, note,
            status, decided_by_user_id, decided_at, decision_note, created_at
     FROM account_applications
     ${where}
     ORDER BY created_at DESC`
  ).bind(...binds).all();

  return json({ applications: results });
};

// POST /api/platform/applications/:id/decide — approve or decline a pending application (Platform tier)
const handlePlatformDecideApplication: Handler = async (request, env, params) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const body = await request.json() as {
    decision?: string;
    decision_note?: string;
    trust_tier?: string;
  };

  if (!body.decision || !['approve', 'decline'].includes(body.decision)) {
    return json({ error: 'decision must be "approve" or "decline"' }, 400);
  }

  const app = await env.DB.prepare(
    'SELECT * FROM account_applications WHERE id = ?'
  ).bind(params.id).first();
  if (!app) return json({ error: 'Application not found' }, 404);
  if ((app as any).status !== 'pending') {
    return json({ error: 'Application is not pending' }, 400);
  }

  const now = new Date().toISOString();

  if (body.decision === 'decline') {
    await env.DB.prepare(
      `UPDATE account_applications
       SET status = 'declined', decided_by_user_id = ?, decided_at = ?, decision_note = ?
       WHERE id = ?`
    ).bind(claims.sub, now, body.decision_note || null, params.id).run();

    await logPlatformAction(env, 'application.declined', claims.sub, claims.email,
      'application', params.id, { decision_note: body.decision_note || null });

    return json({ success: true });
  }

  // Approve path
  const validTiers = ['basic', 'verified', 'partner'];
  const trustTier = body.trust_tier && validTiers.includes(body.trust_tier)
    ? body.trust_tier
    : 'basic';

  const applicantEmail = (app as any).applicant_email as string;
  const applicantName = (app as any).applicant_name as string | null;
  const accountKind = (app as any).proposed_account_kind as string;

  // Derive slug and invoice prefix from name or email local-part
  const baseName = applicantName || applicantEmail.split('@')[0];
  const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const invoicePrefix = baseName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'NEW';

  // Ensure slug uniqueness
  const existingSlug = await env.DB.prepare('SELECT id FROM accounts WHERE slug = ?').bind(slug).first();
  const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

  const accountId = `acc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  await env.DB.prepare(
    `INSERT INTO accounts
       (id, slug, name, contact_email, currency_default, trust_tier, kind, status, public_enabled,
        invoice_prefix, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'USD', ?, ?, 'active', 1, ?, ?, ?)`
  ).bind(
    accountId, finalSlug,
    applicantName || applicantEmail,
    applicantEmail,
    trustTier, accountKind,
    invoicePrefix,
    now, now
  ).run();

  // Find or create user
  let user = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?')
    .bind(applicantEmail.toLowerCase()).first();
  let createdUser = false;
  if (!user) {
    const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    const tempHash = await hashPasswordPBKDF2(crypto.randomUUID().replace(/-/g, ''));
    await env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'user')"
    ).bind(uid, applicantEmail, applicantName || '', tempHash).run();
    user = { id: uid };
    createdUser = true;
  }

  // Create owner membership
  await env.DB.prepare(
    `INSERT OR REPLACE INTO account_members
       (id, account_id, user_id, role, invited_by_user_id, invited_at, joined_at, status)
     VALUES (lower(hex(randomblob(16))), ?, ?, 'owner', ?, datetime('now'), datetime('now'), 'active')`
  ).bind(accountId, user.id, claims.sub).run();

  // Generate claim link
  let claimLink: string | null = null;
  if (createdUser) {
    const inviteToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const resetId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    await env.DB.prepare(
      "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+14 days'))"
    ).bind(resetId, user.id, inviteToken).run();
    claimLink = `/invite/${inviteToken}`;
  }

  // Mark application approved
  await env.DB.prepare(
    `UPDATE account_applications
     SET status = 'approved', decided_by_user_id = ?, decided_at = ?, decision_note = ?
     WHERE id = ?`
  ).bind(claims.sub, now, body.decision_note || null, params.id).run();

  await logPlatformAction(env, 'application.approved', claims.sub, claims.email,
    'application', params.id,
    { account_id: accountId, user_id: user.id, trust_tier: trustTier, account_kind: accountKind });

  return json({ success: true, account_id: accountId, user_id: user.id, claim_link: claimLink }, 201);
};

// POST /api/platform/tea-masters/invite — create Tea Master account + owner in one shot (Platform tier)
const handlePlatformInviteTeaMaster: Handler = async (request, env) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const body = await request.json() as {
    email?: string;
    name?: string;
    note?: string;
  };

  const email = (body.email || '').trim().toLowerCase();
  if (!email) return json({ error: 'email is required' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Invalid email format' }, 400);
  }

  const displayName = (body.name || '').trim() || null;
  const baseName = displayName || email.split('@')[0];
  const slug = baseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const invoicePrefix = baseName.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'NEW';

  const existingSlug = await env.DB.prepare('SELECT id FROM accounts WHERE slug = ?').bind(slug).first();
  const finalSlug = existingSlug ? `${slug}-${Date.now().toString(36)}` : slug;

  const accountId = `acc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO accounts
       (id, slug, name, contact_email, currency_default, trust_tier, kind, status, public_enabled,
        invoice_prefix, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'USD', 'verified', 'master', 'active', 1, ?, ?, ?)`
  ).bind(accountId, finalSlug, displayName || email, email, invoicePrefix, now, now).run();

  // Find or create user
  let user = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ?')
    .bind(email).first();
  let createdUser = false;
  if (!user) {
    const uid = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    const tempHash = await hashPasswordPBKDF2(crypto.randomUUID().replace(/-/g, ''));
    await env.DB.prepare(
      "INSERT INTO users (id, email, name, password_hash, role) VALUES (?, ?, ?, ?, 'user')"
    ).bind(uid, email, displayName || '', tempHash).run();
    user = { id: uid };
    createdUser = true;
  }

  // Create owner membership
  await env.DB.prepare(
    `INSERT OR REPLACE INTO account_members
       (id, account_id, user_id, role, invited_by_user_id, invited_at, joined_at, status)
     VALUES (lower(hex(randomblob(16))), ?, ?, 'owner', ?, datetime('now'), datetime('now'), 'active')`
  ).bind(accountId, user.id, claims.sub).run();

  // Generate claim link
  let claimLink: string | null = null;
  if (createdUser) {
    const inviteToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const resetId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
    await env.DB.prepare(
      "INSERT INTO password_reset_tokens (id, user_id, token, expires_at) VALUES (?, ?, ?, datetime('now', '+14 days'))"
    ).bind(resetId, user.id, inviteToken).run();
    claimLink = `/invite/${inviteToken}`;
  }

  // Try to send invite email if Resend is configured. If it fails or env vars
  // are missing, the invite is still valid — surface email_sent: false so the
  // admin UI can prompt the operator to share the claim link manually.
  let emailSent = false;
  if (claimLink) {
    const origin = new URL(request.url).origin;
    const inviteUrl = `${origin}${claimLink}`;
    emailSent = await sendEmail(
      env,
      email,
      `You've been invited as a Tea Master on Teajia`,
      inviteEmailHtml(inviteUrl, displayName || 'Teajia')
    );
  }

  await logPlatformAction(env, 'tea_master.invited', claims.sub, claims.email,
    'account', accountId,
    { email, name: displayName, note: body.note || null, user_id: user.id, email_sent: emailSent });

  return json({
    success: true,
    account_id: accountId,
    user_id: user.id,
    claim_link: claimLink,
    email_sent: emailSent,
  }, 201);
};

// POST /api/platform/accounts/:id/upgrade-to-location — promote Tea Master account to Location (Platform tier)
const handlePlatformUpgradeToLocation: Handler = async (request, env, params) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;
  const account = await env.DB.prepare('SELECT id, kind, name FROM accounts WHERE id = ?')
    .bind(params.id).first();
  if (!account) return json({ error: 'Account not found' }, 404);
  if ((account as any).kind !== 'master') {
    return json({ error: 'Only Tea Master accounts can be upgraded to Location' }, 400);
  }

  const body = await request.json() as {
    location_name?: string;
    location_city?: string;
    location_country?: string;
    timezone?: string;
  };

  const updates: string[] = ['kind = \'location\'', 'updated_at = datetime(\'now\')'];
  const binds: any[] = [];
  const updatedFields: string[] = ['kind'];

  if (body.location_name) {
    updates.push('name = ?');
    binds.push(body.location_name);
    updatedFields.push('name');
  }
  if (body.location_city) {
    updates.push('location_city = ?');
    binds.push(body.location_city);
    updatedFields.push('location_city');
  }
  if (body.location_country) {
    updates.push('location_country = ?');
    binds.push(body.location_country);
    updatedFields.push('location_country');
  }
  if (body.timezone) {
    updates.push('timezone = ?');
    binds.push(body.timezone);
    updatedFields.push('timezone');
  }

  binds.push(params.id);
  await env.DB.prepare(
    `UPDATE accounts SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...binds).run();

  await logPlatformAction(env, 'account.upgraded_to_location', claims.sub, claims.email,
    'account', params.id,
    { previous_kind: 'master', new_kind: 'location', updated_fields: updatedFields });

  return json({ success: true });
};

// GET /api/network/stores — PUBLIC list of accounts with public_enabled = 1
const handleGetNetworkStores: Handler = async (_request, env) => {
  const { results } = await env.DB.prepare(
    `SELECT id, slug, name, tagline, logo_url, location_city, location_country
     FROM accounts
     WHERE public_enabled = 1 AND status = 'active'
     ORDER BY is_platform_owner DESC, name ASC`
  ).all();
  return cachedJson(results, 300);
};

// GET /api/s/:slug — PUBLIC account profile
const handleGetPublicAccount: Handler = async (_request, env, params) => {
  const acc = await env.DB.prepare(
    `SELECT id, slug, name, tagline, description, logo_url, cover_image_url,
            location_city, location_country, whatsapp_number, currency_default
     FROM accounts
     WHERE slug = ? AND public_enabled = 1 AND status = 'active'`
  ).bind(params.slug).first();
  if (!acc) return json({ error: 'Store not found' }, 404);
  return cachedJson(acc, 300);
};

// Shared helper: fetch public products for an account (mirrors PUBLIC_FIELDS
// whitelist used by the legacy /api/products/public endpoint).
async function fetchPublicProductsForAccount(
  env: Env,
  accountId: string
): Promise<Record<string, unknown>[]> {
  const [ratesResult, result] = await env.DB.batch([
    env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates'),
    env.DB.prepare(
      `SELECT id, type, given_name, chinese_name, product_name, year,
              origin_country, origin_region, stock_grams, description,
              tasting_notes, image_url, additional_images, status,
              is_personal, can_reorder, is_curated, lore, show_wisdom,
              processing_notes, terroir, mood, experience,
              cost_amount, cost_currency, quantity_purchased,
              shipping_rate_per_kg, fixed_retail_price_usd,
              material, capacity_ml, teaware_category, quantity_units, tasting, tasting_source,
              mood_tags, flavor_tags,
              (SELECT COUNT(*) > 0 FROM collection_items ci
                 JOIN collections c ON c.id = ci.collection_id
                 JOIN collection_publications cp ON cp.collection_id = c.id
                WHERE ci.product_id = p.id
                  AND cp.target_type = 'shop'
                  AND cp.unpublished_at IS NULL) AS is_featured
       FROM products p
       WHERE p.is_public = 1 AND p.status = 'Active' AND p.account_id = ?
       ORDER BY p.created_at DESC`
    ).bind(accountId),
  ]);
  const rates = new Map<string, number>();
  for (const r of ratesResult.results as any[]) {
    rates.set(r.currency as string, r.rate_to_usd as number);
  }
  return (result.results as any[]).map(p => {
    if (typeof p.tasting_notes === 'string') {
      try { p.tasting_notes = JSON.parse(p.tasting_notes); } catch { p.tasting_notes = []; }
    }
    if (typeof p.additional_images === 'string') {
      try { p.additional_images = JSON.parse(p.additional_images); } catch { p.additional_images = []; }
    }
    if (typeof p.tasting === 'string') {
      try { p.tasting = JSON.parse(p.tasting); } catch { p.tasting = {}; }
    }
    if (typeof p.mood_tags === 'string') {
      try { p.mood_tags = JSON.parse(p.mood_tags); } catch { p.mood_tags = []; }
    }
    if (typeof p.flavor_tags === 'string') {
      try { p.flavor_tags = JSON.parse(p.flavor_tags); } catch { p.flavor_tags = []; }
    }
    const withPricing = addPricingFields(p, rates);
    const safe: Record<string, unknown> = {};
    for (const key of PUBLIC_FIELDS) {
      if (key in withPricing) safe[key] = (withPricing as Record<string, unknown>)[key];
    }
    return safe;
  });
}

// GET /api/s/:slug/products — PUBLIC products for a store
// Short 10s cache so admin tasting edits reflect quickly on the public page;
// product data changes throughout the day and we don't want a 60s stale window
// when the owner is actively curating.
const handleGetPublicAccountProducts: Handler = async (_request, env, params) => {
  const accountId = await getAccountIdBySlug(env, params.slug);
  if (!accountId) return json({ error: 'Store not found' }, 404);
  const products = await fetchPublicProductsForAccount(env, accountId);
  return cachedJson(products, 10);
};

// GET /api/s/:slug/events — PUBLIC active events for a store
const handleGetPublicAccountEvents: Handler = async (_request, env, params) => {
  const accountId = await getAccountIdBySlug(env, params.slug);
  if (!accountId) return json({ error: 'Store not found' }, 404);

  const { results } = await env.DB.prepare(
    `SELECT e.id, e.slug, e.title, e.subtitle, e.description, e.flyer_image_url,
            e.event_date, e.event_end_date, e.location_name, e.area_hint,
            e.total_capacity, e.timezone, e.status,
            COALESCE(a.confirmed_count, 0) as confirmed_count,
            e.total_capacity - COALESCE(a.confirmed_count, 0) as seats_remaining
     FROM events e
     LEFT JOIN (
       SELECT event_id, SUM(1 + plus_one) as confirmed_count
       FROM event_attendees WHERE status = 'confirmed'
       GROUP BY event_id
     ) a ON a.event_id = e.id
     WHERE e.status = 'active' AND e.account_id = ?
     ORDER BY e.event_date ASC`
  ).bind(accountId).all();
  return cachedJson(results, 60);
};

// ── Purchase Orders ──

const handleListPurchaseOrders: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'stock');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const { results } = await env.DB.prepare(
    'SELECT * FROM purchase_orders WHERE account_id = ? ORDER BY created_at DESC'
  ).bind(accountId).all();

  return json(results);
};

const handleCreatePurchaseOrder: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'stock');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  if (!body.vendor_name?.trim()) return json({ error: 'vendor_name is required' }, 400);

  const id = crypto.randomUUID();
  const cols = ['id', 'account_id', 'vendor_name', 'vendor_id', 'vendor_contact', 'items_json', 'total_usd', 'display_currency', 'status', 'message_text', 'notes', 'created_at', 'updated_at'];
  await env.DB.prepare(
    `INSERT INTO purchase_orders (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`
  ).bind(
    id, accountId,
    body.vendor_name?.trim() || null,
    body.vendor_id || null,
    body.vendor_contact || null,
    body.items_json || '[]',
    body.total_usd || 0,
    body.display_currency || 'USD',
    body.status || 'pending',
    body.message_text || null,
    body.notes || null,
    new Date().toISOString(),
    new Date().toISOString(),
  ).run();

  return json({ id }, 201);
};

const handleUpdatePurchaseOrder: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'stock');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as { status?: string; notes?: string; message_text?: string };
  const allowed = ['status', 'notes', 'message_text'];
  const cols = Object.keys(body).filter(k => allowed.includes(k));
  if (cols.length === 0) return json({ success: true });

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE purchase_orders SET ${sets}, updated_at = ? WHERE id = ? AND account_id = ?`
  ).bind(...cols.map(c => (body as Record<string, any>)[c]), new Date().toISOString(), params.id, accountId).run();

  return json({ success: true });
};

// ── Me / Profile ──

const handleGetMyProfile: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const [profile, queueCount, wishlistCount, connectionCount] = await Promise.all([
    env.DB.prepare('SELECT * FROM user_taste_profile WHERE user_id = ? AND account_id = ?')
      .bind(userId, accountId).first() as Promise<Record<string, any> | null>,
    env.DB.prepare(
      "SELECT COUNT(*) as c FROM tea_compass_entries WHERE user_id = ? AND account_id = ? AND status = 'available_to_taste' AND deleted_at IS NULL"
    ).bind(userId, accountId).first<{ c: number }>(),
    env.DB.prepare(
      "SELECT COUNT(*) as c FROM tea_compass_entries WHERE user_id = ? AND account_id = ? AND status = 'want' AND deleted_at IS NULL"
    ).bind(userId, accountId).first<{ c: number }>(),
    env.DB.prepare(
      'SELECT COUNT(*) as c FROM member_connections WHERE user_id_a = ? OR user_id_b = ?'
    ).bind(userId, userId).first<{ c: number }>(),
  ]);

  return json({
    profile: profile ? {
      preferred_types: JSON.parse(profile.preferred_types || '{}'),
      preferred_notes: JSON.parse(profile.preferred_notes || '{}'),
      preferred_regions: JSON.parse(profile.preferred_regions || '{}'),
      verdict_counts: JSON.parse(profile.verdict_counts || '{}'),
      total_tastings: profile.total_tastings,
      last_updated: profile.last_updated,
    } : null,
    queue_count: queueCount?.c || 0,
    wishlist_count: wishlistCount?.c || 0,
    connection_count: connectionCount?.c || 0,
  });
};

const handleGetMyQueue: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const result = await env.DB.prepare(
    "SELECT * FROM tea_compass_entries WHERE user_id = ? AND account_id = ? AND status = 'available_to_taste' AND deleted_at IS NULL ORDER BY taste_order DESC, updated_at DESC"
  ).bind(userId, accountId).all();

  return json({ entries: result.results });
};

const handleGetMyWishlist: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const result = await env.DB.prepare(
    "SELECT * FROM tea_compass_entries WHERE user_id = ? AND account_id = ? AND status = 'want' AND deleted_at IS NULL ORDER BY updated_at DESC"
  ).bind(userId, accountId).all();

  return json({ entries: result.results });
};

const handleMemberSearch: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ members: [] });

  const result = await env.DB.prepare(
    `SELECT u.id, u.name, u.username, u.email, am.role
     FROM users u
     JOIN account_members am ON am.user_id = u.id AND am.account_id = ?
     WHERE u.id != ? AND (u.name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)
     LIMIT 20`
  ).bind(accountId, userId, `%${q}%`, `%${q}%`, `%${q}%`).all();

  return json({ members: result.results });
};

// GET /api/me/journey — auth-based personal journey (no phone/magic-token required)
const handleGetMyJourney: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  // Fetch user email (used as taster_id in sample tastings)
  const userRow = await env.DB.prepare(
    `SELECT email FROM users WHERE id = ? LIMIT 1`
  ).bind(userId).first() as Record<string, any> | null;
  const userEmail = userRow?.email || '';

  // Find the customer record linked to this user account
  const customer = await env.DB.prepare(
    `SELECT id, name, created_at FROM customers WHERE user_id = ? AND account_id = ? LIMIT 1`
  ).bind(userId, accountId).first() as Record<string, any> | null;

  const emptyBase = {
    hasLinkedCustomer: false,
    sessionsAttended: 0,
    totalTeas: 0,
    memberSince: null,
    teaTypeMap: {} as Record<string, number>,
    regionMap: {} as Record<string, number>,
    favorites: [] as string[],
    impressions: [] as Array<{ text: string; teaName: string; eventTitle: string; date: string }>,
    milestones: [] as string[],
    seals: [] as Array<{ eventId: string; title: string; date: string; flyerUrl: string | null }>,
    samples: [] as Array<Record<string, any>>,
    compass: [] as Array<Record<string, any>>,
    portrait: '',
  };

  // Compass and sample queries run regardless of customer linkage
  const [compassResult, samplesResult] = await Promise.all([
    env.DB.prepare(
      `SELECT id, name, chinese_name, type, form, year, origin_region, status, notes, created_at
       FROM tea_compass_entries
       WHERE user_id = ? AND account_id = ? AND status NOT IN ('incoming')
       ORDER BY created_at DESC LIMIT 50`
    ).bind(userId, accountId).all(),
    env.DB.prepare(
      `SELECT tst.id, tst.verdict, tst.would_buy, tst.personal_note, tst.created_at as tasting_date,
              ts.name, ts.chinese_name, ts.type, ts.origin_region, ts.id as sample_id
       FROM tea_sample_tastings tst
       JOIN tea_samples ts ON ts.id = tst.sample_id
       JOIN tea_sample_sets tss ON tss.id = ts.sample_set_id AND tss.account_id = ?
       WHERE tst.taster_id = ? OR tst.taster_id = ?
       ORDER BY tst.created_at DESC LIMIT 30`
    ).bind(accountId, userId, userEmail).all(),
  ]);

  const compass = (compassResult.results as Record<string, any>[]).map(c => ({
    id: c.id,
    name: c.name,
    chineseName: c.chinese_name || null,
    type: c.type || null,
    region: c.origin_region || null,
    form: c.form || null,
    year: c.year ? String(c.year) : null,
    status: c.status,
    notes: c.notes || null,
    createdAt: c.created_at,
  }));

  const samples = (samplesResult.results as Record<string, any>[]).map(s => ({
    id: s.id,
    sampleId: s.sample_id,
    name: s.name,
    chineseName: s.chinese_name || null,
    type: s.type || null,
    region: s.origin_region || null,
    verdict: s.verdict,
    wouldBuy: Boolean(s.would_buy),
    note: s.personal_note || null,
    tastingDate: s.tasting_date,
  }));

  if (!customer) {
    return json({ ...emptyBase, compass, samples });
  }

  // Sessions attended
  const sessions = await env.DB.prepare(
    `SELECT ea.id as attendee_id, ea.event_id, e.title, e.slug, e.event_date, e.flyer_image_url
     FROM event_attendees ea
     JOIN events e ON e.id = ea.event_id
     WHERE ea.customer_id = ? AND ea.status = 'confirmed' AND ea.attended = 1
     ORDER BY e.event_date ASC`
  ).bind(customer.id).all();

  const sessionsAttended = sessions.results.length;
  const seals = (sessions.results as Record<string, any>[]).map(s => ({
    eventId: s.event_id,
    title: s.title,
    slug: s.slug || null,
    date: s.event_date,
    flyerUrl: s.flyer_image_url || null,
  }));

  let teaTypeMap: Record<string, number> = {};
  let regionMap: Record<string, number> = {};
  let favorites: string[] = [];
  let impressions: Array<{ text: string; teaName: string; eventTitle: string; date: string }> = [];
  let totalTeas = 0;

  if (sessions.results.length > 0) {
    const attendeeIds = (sessions.results as Record<string, any>[]).map(s => s.attendee_id);
    const placeholders = attendeeIds.map(() => '?').join(', ');

    const notes = await env.DB.prepare(
      `SELECT etn.impression, etn.is_favorite, etn.tea_menu_id,
              COALESCE(etm.custom_name, p.given_name, p.product_name) as tea_name,
              COALESCE(p.type, etm.tea_type) as type,
              COALESCE(p.origin_region, etm.origin_region) as origin_region,
              e.title as event_title, e.event_date
       FROM event_tasting_notes etn
       LEFT JOIN event_tea_menu etm ON etm.id = etn.tea_menu_id
       LEFT JOIN products p ON p.id = etm.product_id
       JOIN event_attendees ea ON ea.id = etn.attendee_id
       JOIN events e ON e.id = ea.event_id
       WHERE etn.attendee_id IN (${placeholders})`
    ).bind(...attendeeIds).all();

    totalTeas = notes.results.length;
    for (const n of notes.results as Record<string, any>[]) {
      if (n.type) teaTypeMap[n.type] = (teaTypeMap[n.type] || 0) + 1;
      if (n.origin_region) regionMap[n.origin_region] = (regionMap[n.origin_region] || 0) + 1;
      if (n.is_favorite) favorites.push(n.tea_name || 'Unknown tea');
      if (n.impression) {
        impressions.push({
          text: n.impression,
          teaName: n.tea_name || 'Unknown tea',
          eventTitle: n.event_title,
          date: n.event_date,
        });
      }
    }
  }

  // Also fold compass regions into regionMap for the portrait
  for (const c of compass) {
    if (c.region) regionMap[c.region] = (regionMap[c.region] || 0) + 1;
  }
  for (const s of samples) {
    if (s.region) regionMap[s.region] = (regionMap[s.region] || 0) + 1;
    if (s.type) teaTypeMap[s.type] = (teaTypeMap[s.type] || 0) + 1;
  }

  const milestoneMarks: Record<number, string> = { 1: '初', 3: '三', 5: '五', 7: '七', 10: '十', 20: '廿', 50: '半百' };
  const milestones = Object.entries(milestoneMarks)
    .filter(([count]) => sessionsAttended >= parseInt(count))
    .map(([, mark]) => mark);

  // Portrait — deterministic summary sentence
  const topTypes = Object.entries(teaTypeMap).sort(([, a], [, b]) => b - a).slice(0, 2).map(([t]) => t.toLowerCase());
  const topRegions = Object.entries(regionMap).sort(([, a], [, b]) => b - a).slice(0, 2).map(([r]) => r);
  const lovedSamples = samples.filter(s => s.verdict === 'love').length;
  const portraitParts: string[] = [];
  if (topTypes.length > 0) portraitParts.push(`Your palate leans toward ${topTypes.join(' and ')}${topRegions.length > 0 ? `, from ${topRegions.join(' and ')}` : ''}`);
  if (favorites.length > 0) portraitParts.push(`${favorites.length} tea${favorites.length !== 1 ? 's' : ''} from the table stood out enough to mark`);
  if (lovedSamples > 0) portraitParts.push(`${lovedSamples} sample${lovedSamples !== 1 ? 's' : ''} earned a love`);
  if (compass.length > 0) portraitParts.push(`${compass.length} ${compass.length === 1 ? 'tea has' : 'teas have'} made it into your collection`);
  const portrait = portraitParts.length >= 2 ? portraitParts.join('. ') + '.' : '';

  return json({
    hasLinkedCustomer: true,
    customerName: customer.name,
    sessionsAttended,
    totalTeas,
    memberSince: customer.created_at,
    teaTypeMap,
    regionMap,
    favorites,
    impressions,
    milestones,
    seals,
    samples,
    compass,
    portrait,
  });
};

// ── Co-Tasting Sessions ──

const handleCreateSession: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const body = await request.json() as {
    title?: string;
    entry_ids?: string[];
    member_ids?: string[];
  };

  const sessionId = crypto.randomUUID();
  const inviteToken = crypto.randomUUID().replace(/-/g, '');
  const now = new Date().toISOString();

  await env.DB.prepare(
    `INSERT INTO tasting_sessions (id, account_id, created_by_user_id, title, status, invite_token, max_participants, created_at)
     VALUES (?, ?, ?, ?, 'active', ?, 4, ?)`
  ).bind(sessionId, accountId, userId, body.title || null, inviteToken, now).run();

  // Add creator as first member
  await env.DB.prepare(
    `INSERT INTO tasting_session_members (id, session_id, user_id, joined_at) VALUES (?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), sessionId, userId, now).run();

  // Add teas from entry_ids
  const entryIds: string[] = body.entry_ids || [];
  for (let i = 0; i < entryIds.length; i++) {
    const entry = await env.DB.prepare(
      'SELECT id, name, tea_key, type, form, year, origin_region, photos FROM tea_compass_entries WHERE id = ? AND account_id = ?'
    ).bind(entryIds[i], accountId).first() as Record<string, any> | null;
    if (!entry) continue;

    const metadata = JSON.stringify({
      name: entry.name, type: entry.type, form: entry.form,
      year: entry.year, originRegion: entry.origin_region,
      photo: entry.photos ? JSON.parse(entry.photos)?.[0] : null,
    });

    await env.DB.prepare(
      `INSERT INTO tasting_session_teas (id, session_id, compass_entry_id, tea_name, tea_key, tea_metadata, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), sessionId, entry.id, entry.name, entry.tea_key || null, metadata, i).run();
  }

  // Pre-add invited members
  const memberIds: string[] = body.member_ids || [];
  for (const mid of memberIds) {
    if (mid === userId) continue;
    await env.DB.prepare(
      `INSERT OR IGNORE INTO tasting_session_members (id, session_id, user_id, joined_at) VALUES (?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), sessionId, mid, now).run();
  }

  const session = await env.DB.prepare('SELECT * FROM tasting_sessions WHERE id = ?').bind(sessionId).first();
  return json({ session, invite_token: inviteToken }, 201);
};

const handleGetSession: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const session = await env.DB.prepare(
    'SELECT * FROM tasting_sessions WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first() as Record<string, any> | null;
  if (!session) return json({ error: 'Session not found' }, 404);

  const [teas, members] = await Promise.all([
    env.DB.prepare('SELECT * FROM tasting_session_teas WHERE session_id = ? ORDER BY position').bind(params.id).all(),
    env.DB.prepare(
      `SELECT tsm.*, u.name, u.username FROM tasting_session_members tsm
       LEFT JOIN users u ON u.id = tsm.user_id
       WHERE tsm.session_id = ?`
    ).bind(params.id).all(),
  ]);

  // Only return verdicts for teas the caller has already submitted
  const myVerdicts = await env.DB.prepare(
    'SELECT * FROM tasting_session_verdicts WHERE session_id = ? AND user_id = ?'
  ).bind(params.id, userId).all();

  return json({
    session,
    teas: teas.results.map((t: any) => ({
      ...t,
      tea_metadata: t.tea_metadata ? JSON.parse(t.tea_metadata) : {},
    })),
    members: members.results,
    my_verdicts: myVerdicts.results,
  });
};

const handleGetSessionByToken: Handler = async (request, env, params) => {
  const session = await env.DB.prepare(
    "SELECT * FROM tasting_sessions WHERE invite_token = ? AND status = 'active'"
  ).bind(params.token).first() as Record<string, any> | null;
  if (!session) return json({ error: 'Session not found or no longer active' }, 404);

  const teas = await env.DB.prepare(
    'SELECT * FROM tasting_session_teas WHERE session_id = ? ORDER BY position'
  ).bind(session.id).all();

  return json({
    session: { id: session.id, title: session.title, invite_token: session.invite_token, max_participants: session.max_participants },
    teas: teas.results.map((t: any) => ({
      id: t.id, tea_name: t.tea_name, position: t.position,
      tea_metadata: t.tea_metadata ? JSON.parse(t.tea_metadata) : {},
    })),
  });
};

const handleJoinSession: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { userId } = ctx;

  const session = await env.DB.prepare(
    "SELECT * FROM tasting_sessions WHERE id = ? AND status = 'active'"
  ).bind(params.id).first() as Record<string, any> | null;
  if (!session) return json({ error: 'Session not found or not active' }, 404);

  const memberCount = await env.DB.prepare(
    'SELECT COUNT(*) as c FROM tasting_session_members WHERE session_id = ?'
  ).bind(params.id).first<{ c: number }>();
  if ((memberCount?.c || 0) >= (session.max_participants || 4)) {
    return json({ error: 'Session is full' }, 400);
  }

  const now = new Date().toISOString();
  const user = await env.DB.prepare('SELECT name, username FROM users WHERE id = ?').bind(userId).first() as any;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO tasting_session_members (id, session_id, user_id, user_name, joined_at) VALUES (?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), params.id, userId, user?.name || user?.username || null, now).run();

  return json({ success: true, session_id: params.id });
};

const handleSubmitSessionVerdict: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { userId } = ctx;

  const body = await request.json() as {
    verdict?: string;
    tasting_data?: Record<string, any>;
    notes?: string;
  };

  const sessionTea = await env.DB.prepare(
    'SELECT * FROM tasting_session_teas WHERE id = ? AND session_id = ?'
  ).bind(params.teaId, params.id).first();
  if (!sessionTea) return json({ error: 'Session tea not found' }, 404);

  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO tasting_session_verdicts (id, session_id, session_tea_id, user_id, verdict, tasting_data, notes, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_tea_id, user_id) DO UPDATE SET
       verdict = excluded.verdict, tasting_data = excluded.tasting_data,
       notes = excluded.notes, submitted_at = excluded.submitted_at`
  ).bind(
    crypto.randomUUID(), params.id, params.teaId, userId,
    body.verdict || null,
    body.tasting_data ? JSON.stringify(body.tasting_data) : null,
    body.notes || null, now
  ).run();

  // Update taste profile silently
  if (body.verdict) {
    const session = await env.DB.prepare('SELECT account_id FROM tasting_sessions WHERE id = ?').bind(params.id).first() as any;
    if (session) {
      await _upsertTasteProfile(env, userId, session.account_id, body.verdict, body.tasting_data);
    }
  }

  return json({ success: true });
};

const handleGetSessionVerdicts: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const session = await env.DB.prepare(
    'SELECT * FROM tasting_sessions WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first() as Record<string, any> | null;
  if (!session) return json({ error: 'Session not found' }, 404);

  // Verdicts are visible to all authenticated members of the session's account
  const verdicts = await env.DB.prepare(
    `SELECT tsv.*, u.name as user_name, sst.tea_name, sst.position
     FROM tasting_session_verdicts tsv
     JOIN tasting_session_teas sst ON sst.id = tsv.session_tea_id
     LEFT JOIN users u ON u.id = tsv.user_id
     WHERE tsv.session_id = ?
     ORDER BY sst.position, tsv.submitted_at`
  ).bind(params.id).all();

  return json({
    verdicts: (verdicts.results as any[]).map(v => ({
      ...v,
      tasting_data: v.tasting_data ? JSON.parse(v.tasting_data) : null,
    })),
  });
};

const handleCompleteSession: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const session = await env.DB.prepare(
    'SELECT * FROM tasting_sessions WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first() as Record<string, any> | null;
  if (!session) return json({ error: 'Session not found' }, 404);
  if (session.created_by_user_id !== userId) return json({ error: 'Only the session host can complete it' }, 403);

  await env.DB.prepare(
    "UPDATE tasting_sessions SET status = 'completed', completed_at = ? WHERE id = ?"
  ).bind(new Date().toISOString(), params.id).run();

  return json({ success: true });
};

// ── Member Connections ──

const handleGetConnections: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { userId } = ctx;

  const result = await env.DB.prepare(
    `SELECT mc.*,
       u.name as other_name, u.username as other_username
     FROM member_connections mc
     JOIN users u ON u.id = CASE WHEN mc.user_id_a = ? THEN mc.user_id_b ELSE mc.user_id_a END
     WHERE mc.user_id_a = ? OR mc.user_id_b = ?
     ORDER BY mc.created_at DESC`
  ).bind(userId, userId, userId).all();

  return json({ connections: result.results });
};

const handleInviteConnection: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const body = await request.json() as { to_user_id: string; pending_share_id?: string };
  if (!body.to_user_id) return json({ error: 'to_user_id required' }, 400);
  if (body.to_user_id === userId) return json({ error: 'Cannot connect with yourself' }, 400);

  // Check if connection already exists
  const [ua, ub] = [userId, body.to_user_id].sort();
  const existing = await env.DB.prepare(
    'SELECT id FROM member_connections WHERE user_id_a = ? AND user_id_b = ?'
  ).bind(ua, ub).first();
  if (existing) return json({ error: 'Already connected' }, 409);

  const now = new Date().toISOString();
  const inviteId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO connection_invites (id, from_user_id, to_user_id, pending_share_id, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`
  ).bind(inviteId, userId, body.to_user_id, body.pending_share_id || null, now).run();

  return json({ invite_id: inviteId }, 201);
};

const handleAcceptConnectionInvite: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { userId } = ctx;

  const invite = await env.DB.prepare(
    "SELECT * FROM connection_invites WHERE id = ? AND to_user_id = ? AND status = 'pending'"
  ).bind(params.id, userId).first() as Record<string, any> | null;
  if (!invite) return json({ error: 'Invite not found or already handled' }, 404);

  const [ua, ub] = [invite.from_user_id as string, userId].sort();
  const now = new Date().toISOString();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR IGNORE INTO member_connections (id, user_id_a, user_id_b, source, source_ref, created_at)
       VALUES (?, ?, ?, 'share', ?, ?)`
    ).bind(crypto.randomUUID(), ua, ub, invite.pending_share_id || null, now),
    env.DB.prepare(
      "UPDATE connection_invites SET status = 'accepted', resolved_at = ? WHERE id = ?"
    ).bind(now, params.id),
  ]);

  return json({ success: true });
};

// ── Entry Feedback (aggregate verdicts from sessions) ──

const handleGetEntryFeedback: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const entry = await env.DB.prepare(
    'SELECT tea_key FROM tea_compass_entries WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first() as Record<string, any> | null;
  if (!entry) return json({ error: 'Entry not found' }, 404);

  // Aggregate verdicts from tasting sessions where this entry was used
  const sessionVerdicts = await env.DB.prepare(
    `SELECT tsv.verdict, tsv.notes, tsv.tasting_data, u.name as user_name, tsv.submitted_at
     FROM tasting_session_verdicts tsv
     JOIN tasting_session_teas sst ON sst.id = tsv.session_tea_id
     LEFT JOIN users u ON u.id = tsv.user_id
     WHERE sst.compass_entry_id = ?
     ORDER BY tsv.submitted_at DESC
     LIMIT 50`
  ).bind(params.id).all();

  // Aggregate anonymous table verdicts by tea_key
  const tableVerdicts = entry.tea_key ? await env.DB.prepare(
    `SELECT av.verdict, av.notes, av.tasting_data, av.created_at
     FROM anonymous_verdicts av
     JOIN table_share_tokens tst ON tst.token = av.table_token
     WHERE tst.source_entry_id = ?
     ORDER BY av.created_at DESC
     LIMIT 50`
  ).bind(params.id).all() : { results: [] };

  const counts: Record<string, number> = { love: 0, like: 0, neutral: 0, pass: 0 };
  const all = [...(sessionVerdicts.results as any[]), ...(tableVerdicts.results as any[])];
  for (const v of all) {
    if (v.verdict && counts[v.verdict] !== undefined) counts[v.verdict]++;
  }

  return json({
    counts,
    total: all.length,
    session_verdicts: (sessionVerdicts.results as any[]).map(v => ({
      ...v, tasting_data: v.tasting_data ? JSON.parse(v.tasting_data) : null,
    })),
    table_verdicts: (tableVerdicts.results as any[]).map(v => ({
      ...v, tasting_data: v.tasting_data ? JSON.parse(v.tasting_data) : null,
    })),
  });
};

// ── Table Share (QR at-table tasting) ──

const handleCreateTableShare: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const entry = await env.DB.prepare(
    'SELECT id FROM tea_compass_entries WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first();
  if (!entry) return json({ error: 'Entry not found' }, 404);

  const token = crypto.randomUUID().replace(/-/g, '');
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO table_share_tokens (id, token, source_entry_id, account_id, created_by_user_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), token, params.id, accountId, userId, expiresAt, now).run();

  return json({ token, url: `/t/${token}` }, 201);
};

const handleGetTableCard: Handler = async (request, env, params) => {
  const tokenRow = await env.DB.prepare(
    'SELECT * FROM table_share_tokens WHERE token = ? AND expires_at > ?'
  ).bind(params.token, new Date().toISOString()).first() as Record<string, any> | null;
  if (!tokenRow) return json({ error: 'Card not found or expired' }, 404);

  const entry = await env.DB.prepare(
    `SELECT name, chinese_name, type, form, year, season, origin_region, photos, tea_key, notes
     FROM tea_compass_entries WHERE id = ?`
  ).bind(tokenRow.source_entry_id).first() as Record<string, any> | null;
  if (!entry) return json({ error: 'Entry not found' }, 404);

  // Aggregate latest verdict per browser token (handles re-votes correctly)
  const counts = await env.DB.prepare(
    `SELECT verdict, COUNT(*) as c FROM (
       SELECT browser_token, verdict FROM anonymous_verdicts
       WHERE table_token = ?
       GROUP BY browser_token HAVING created_at = MAX(created_at)
     ) GROUP BY verdict`
  ).bind(params.token).all();

  const verdictCounts: Record<string, number> = { love: 0, like: 0, neutral: 0, pass: 0 };
  for (const row of counts.results as any[]) {
    if (row.verdict && verdictCounts[row.verdict] !== undefined) {
      verdictCounts[row.verdict] = row.c;
    }
  }

  return json({
    entry: {
      name: entry.name,
      chineseName: entry.chinese_name,
      type: entry.type,
      form: entry.form,
      year: entry.year,
      season: entry.season,
      originRegion: entry.origin_region,
      photo: entry.photos ? JSON.parse(entry.photos)?.[0] : null,
      teaKey: entry.tea_key,
    },
    verdictCounts,
    token: params.token,
  });
};

const handleSubmitTableVerdict: Handler = async (request, env, params) => {
  const tokenRow = await env.DB.prepare(
    'SELECT * FROM table_share_tokens WHERE token = ? AND expires_at > ?'
  ).bind(params.token, new Date().toISOString()).first() as Record<string, any> | null;
  if (!tokenRow) return json({ error: 'Card not found or expired' }, 404);

  const body = await request.json() as {
    browser_token: string;
    verdict: string;
    notes?: string;
    tasting_data?: Record<string, any>;
  };
  if (!body.browser_token || !body.verdict) return json({ error: 'browser_token and verdict required' }, 400);

  const validVerdicts = ['love', 'like', 'neutral', 'pass'];
  if (!validVerdicts.includes(body.verdict)) return json({ error: 'Invalid verdict' }, 400);

  const now = new Date().toISOString();
  // Delete any previous verdict from this browser token for this card, then insert fresh
  await env.DB.batch([
    env.DB.prepare('DELETE FROM anonymous_verdicts WHERE browser_token = ? AND table_token = ?')
      .bind(body.browser_token, params.token),
    env.DB.prepare(
      `INSERT INTO anonymous_verdicts (id, browser_token, table_token, source_entry_id, verdict, notes, tasting_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), body.browser_token, params.token, tokenRow.source_entry_id,
      body.verdict, body.notes || null,
      body.tasting_data ? JSON.stringify(body.tasting_data) : null, now
    ),
  ]);

  return json({ success: true });
};

// ── Gift Sample (admin creates $0 gift order → populates recipient's queue) ──

const handleGiftSample: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId } = ctx;

  const body = await request.json() as {
    customer_user_id: string;
    entry_ids: string[];
    note?: string;
  };
  if (!body.customer_user_id || !body.entry_ids?.length) {
    return json({ error: 'customer_user_id and entry_ids required' }, 400);
  }

  const now = new Date().toISOString();

  // Create compass entries in recipient's account with status = available_to_taste
  const created: string[] = [];
  for (const entryId of body.entry_ids) {
    const entry = await env.DB.prepare(
      'SELECT * FROM tea_compass_entries WHERE id = ? AND account_id = ?'
    ).bind(entryId, accountId).first() as Record<string, any> | null;
    if (!entry) continue;

    const newId = crypto.randomUUID();
    // Find recipient's account membership
    const recipientMembership = await env.DB.prepare(
      'SELECT account_id FROM account_members WHERE user_id = ? LIMIT 1'
    ).bind(body.customer_user_id).first() as any;
    const targetAccountId = recipientMembership?.account_id || accountId;

    await env.DB.prepare(
      `INSERT INTO tea_compass_entries
         (id, user_id, account_id, name, chinese_name, type, form, year, season, origin_region,
          category, photos, tea_key, status, notes, quantity, price_currency,
          source_entry_id, is_sample, sample_grams, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'available_to_taste', ?, 1, 'NT', ?, 1, ?, ?, ?)`
    ).bind(
      newId, body.customer_user_id, targetAccountId,
      entry.name, entry.chinese_name, entry.type, entry.form,
      entry.year, entry.season, entry.origin_region, entry.category || 'tea',
      entry.photos || '[]', entry.tea_key,
      body.note || `Gifted sample from Teajia`, entry.id,
      entry.sample_grams || null, now, now
    ).run();
    created.push(newId);

    // Auto-create member connection (gift source)
    const [ua, ub] = [userId, body.customer_user_id].sort();
    await env.DB.prepare(
      `INSERT OR IGNORE INTO member_connections (id, user_id_a, user_id_b, source, source_ref, created_at)
       VALUES (?, ?, ?, 'gift', ?, ?)`
    ).bind(crypto.randomUUID(), ua, ub, entryId, now).run();
  }

  return json({ created_entry_ids: created }, 201);
};

// ── Helper: upsert taste profile silently ──
async function _upsertTasteProfile(
  env: Env, userId: string, accountId: string,
  verdict: string, tastingData?: Record<string, any>
) {
  try {
    const existing = await env.DB.prepare(
      'SELECT * FROM user_taste_profile WHERE user_id = ? AND account_id = ?'
    ).bind(userId, accountId).first() as Record<string, any> | null;

    const now = new Date().toISOString();
    if (!existing) {
      const verdictCounts: Record<string, number> = { love: 0, like: 0, neutral: 0, pass: 0 };
      if (verdict && verdictCounts[verdict] !== undefined) verdictCounts[verdict] = 1;
      await env.DB.prepare(
        `INSERT INTO user_taste_profile (id, user_id, account_id, verdict_counts, total_tastings, last_updated)
         VALUES (?, ?, ?, ?, 1, ?)`
      ).bind(crypto.randomUUID(), userId, accountId, JSON.stringify(verdictCounts), now).run();
    } else {
      const verdictCounts = JSON.parse(existing.verdict_counts || '{}');
      if (verdict && verdictCounts[verdict] !== undefined) {
        verdictCounts[verdict] = (verdictCounts[verdict] || 0) + 1;
      }
      await env.DB.prepare(
        `UPDATE user_taste_profile SET verdict_counts = ?, total_tastings = total_tastings + 1, last_updated = ?
         WHERE user_id = ? AND account_id = ?`
      ).bind(JSON.stringify(verdictCounts), now, userId, accountId).run();
    }
  } catch { /* silent — profile is non-critical */ }
}

// ── Articles ──

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const handleListArticles: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') || 'all';
  const statusClause = statusFilter !== 'all'
    ? `AND status = '${statusFilter}'`
    : `AND status != 'archived'`;

  const rows = await env.DB.prepare(
    `SELECT id, account_id, title, subtitle, author_id, slug, status, category, tags,
            cover_image_url, layout_template, reading_time_mins, published_at, created_at, updated_at,
            substr(json_extract(blocks, '$[0].text'), 1, 120) AS blocks_preview
     FROM articles
     WHERE account_id = ? ${statusClause}
     ORDER BY updated_at DESC`
  ).bind(accountId).all();

  const results = rows.results.map((r: any) => ({
    ...r,
    tags: r.tags ? JSON.parse(r.tags) : [],
  }));
  return json(results);
};

const handleGetArticle: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const row = await env.DB.prepare(
    'SELECT * FROM articles WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first() as Record<string, any> | null;
  if (!row) return json({ error: 'Article not found' }, 404);

  return json({
    ...row,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    blocks: row.blocks ? JSON.parse(row.blocks as string) : [],
  });
};

const handleCreateArticle: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  if (!body.title) return json({ error: 'title is required' }, 400);

  const id = crypto.randomUUID();
  const slug = body.slug ? body.slug : slugify(body.title);
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags) : (body.tags || '[]');
  const blocks = Array.isArray(body.blocks) ? JSON.stringify(body.blocks) : (body.blocks || '[]');

  await env.DB.prepare(
    `INSERT INTO articles (id, account_id, title, subtitle, author_id, slug, status, category, tags, cover_image_url, blocks, layout_template, reading_time_mins)
     VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    accountId,
    body.title,
    body.subtitle || null,
    body.author_id || null,
    slug,
    body.category || null,
    tags,
    body.cover_image_url || null,
    blocks,
    body.layout_template || null,
    body.reading_time_mins || null,
  ).run();

  const created = await env.DB.prepare(
    'SELECT * FROM articles WHERE id = ?'
  ).bind(id).first() as Record<string, any>;

  return json({
    ...created,
    tags: created.tags ? JSON.parse(created.tags as string) : [],
    blocks: created.blocks ? JSON.parse(created.blocks as string) : [],
  }, 201);
};

const handleUpdateArticle: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const body = await request.json() as Record<string, any>;
  delete body.id;
  delete body.account_id;
  delete body.created_at;

  if (Array.isArray(body.tags)) body.tags = JSON.stringify(body.tags);
  if (Array.isArray(body.blocks)) body.blocks = JSON.stringify(body.blocks);

  const ARTICLE_ALLOWED_COLS = new Set([
    'title', 'subtitle', 'author_id', 'slug', 'status', 'category', 'tags',
    'cover_image_url', 'blocks', 'layout_template', 'reading_time_mins', 'published_at',
  ]);
  const cols = Object.keys(body).filter(k => ARTICLE_ALLOWED_COLS.has(k));
  if (cols.length === 0) return json({ success: true });

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.prepare(
    `UPDATE articles SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`
  ).bind(...cols.map(c => body[c] ?? null), params.id, accountId).run();

  const updated = await env.DB.prepare(
    'SELECT * FROM articles WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first() as Record<string, any> | null;
  if (!updated) return json({ error: 'Article not found' }, 404);

  return json({
    ...updated,
    tags: updated.tags ? JSON.parse(updated.tags as string) : [],
    blocks: updated.blocks ? JSON.parse(updated.blocks as string) : [],
  });
};

const handlePublishArticle: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const existing = await env.DB.prepare(
    'SELECT id, published_at FROM articles WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first() as Record<string, any> | null;
  if (!existing) return json({ error: 'Article not found' }, 404);

  const publishedAt = existing.published_at || new Date().toISOString();
  await env.DB.prepare(
    `UPDATE articles SET status = 'published', published_at = ?, updated_at = datetime('now')
     WHERE id = ? AND account_id = ?`
  ).bind(publishedAt, params.id, accountId).run();

  const updated = await env.DB.prepare(
    'SELECT * FROM articles WHERE id = ?'
  ).bind(params.id).first() as Record<string, any>;

  return json({
    ...updated,
    tags: updated.tags ? JSON.parse(updated.tags as string) : [],
    blocks: updated.blocks ? JSON.parse(updated.blocks as string) : [],
  });
};

const handleUnpublishArticle: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const existing = await env.DB.prepare(
    'SELECT id FROM articles WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first();
  if (!existing) return json({ error: 'Article not found' }, 404);

  await env.DB.prepare(
    `UPDATE articles SET status = 'draft', updated_at = datetime('now')
     WHERE id = ? AND account_id = ?`
  ).bind(params.id, accountId).run();

  const updated = await env.DB.prepare(
    'SELECT * FROM articles WHERE id = ?'
  ).bind(params.id).first() as Record<string, any>;

  return json({
    ...updated,
    tags: updated.tags ? JSON.parse(updated.tags as string) : [],
    blocks: updated.blocks ? JSON.parse(updated.blocks as string) : [],
  });
};

const handleDeleteArticle: Handler = async (request, env, params) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const existing = await env.DB.prepare(
    'SELECT id FROM articles WHERE id = ? AND account_id = ?'
  ).bind(params.id, accountId).first();
  if (!existing) return json({ error: 'Article not found' }, 404);

  await env.DB.prepare(
    `UPDATE articles SET status = 'archived', updated_at = datetime('now')
     WHERE id = ? AND account_id = ?`
  ).bind(params.id, accountId).run();

  return json({ success: true });
};

const handleGetPublicArticles: Handler = async (request, env) => {
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  const rows = await env.DB.prepare(
    `SELECT id, account_id, title, subtitle, author_id, slug, status, category, tags,
            cover_image_url, layout_template, reading_time_mins, published_at, created_at, updated_at
     FROM articles
     WHERE status = 'published'
     ORDER BY published_at DESC
     LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  const results = rows.results.map((r: any) => ({
    ...r,
    tags: r.tags ? JSON.parse(r.tags) : [],
  }));
  return json(results);
};

const handleGetPublicArticle: Handler = async (request, env, params) => {
  const row = await env.DB.prepare(
    `SELECT * FROM articles WHERE slug = ? AND status = 'published'`
  ).bind(params.slug).first() as Record<string, any> | null;
  if (!row) return json({ error: 'Article not found' }, 404);

  return json({
    ...row,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    blocks: row.blocks ? JSON.parse(row.blocks as string) : [],
  });
};

// ── Analytics ─────────────────────────────────────────────────────────────────

// GET /api/analytics/revenue — weekly revenue from fulfilled invoices (last 26 weeks)
// Also returns the 10 oldest active products (by last sale date) as inventory age alerts.
const handleGetRevenueAnalytics: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const [revenueRows, ageRows] = await Promise.all([
    env.DB.prepare(
      `SELECT strftime('%Y-%W', created_at) as week,
              SUM(total_usd) as revenue,
              COUNT(*) as order_count
       FROM invoices
       WHERE status = 'fulfilled'
         AND account_id = ?
         AND created_at >= datetime('now', '-26 weeks')
       GROUP BY week
       ORDER BY week ASC`
    ).bind(accountId).all(),
    env.DB.prepare(
      `SELECT p.id, p.product_name, p.stock_grams,
              MAX(i.created_at) as last_sold_at
       FROM products p
       LEFT JOIN invoice_line_items ili ON ili.product_id = p.id
       LEFT JOIN invoices i ON i.id = ili.invoice_id AND i.status = 'fulfilled' AND i.account_id = ?
       WHERE p.status = 'Active' AND p.is_public = 1 AND p.account_id = ?
       GROUP BY p.id
       HAVING last_sold_at IS NULL OR last_sold_at < datetime('now', '-90 days')
       ORDER BY last_sold_at ASC NULLS FIRST
       LIMIT 10`
    ).bind(accountId, accountId).all(),
  ]);

  return json({
    weekly_revenue: revenueRows.results ?? [],
    inventory_age_alerts: ageRows.results ?? [],
  });
};

// GET /api/customers/rfm — Recency / Frequency / Monetary segmentation
// Returns top 10 by lifetime spend, lapsed (>90 days), and new (<30 days).
const handleGetCustomerRFM: Handler = async (request, env) => {
  const ctx = await requireAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const [top10Rows, lapsedRows, newRows] = await Promise.all([
    env.DB.prepare(
      `SELECT c.id, c.name, c.email,
              COUNT(DISTINCT i.id) as order_count,
              COALESCE(SUM(i.total_usd), 0) as lifetime_usd,
              MAX(i.created_at) as last_order_at
       FROM customers c
       JOIN invoices i ON i.customer_id = c.id AND i.status = 'fulfilled'
       WHERE c.account_id = ?
       GROUP BY c.id
       ORDER BY lifetime_usd DESC
       LIMIT 10`
    ).bind(accountId).all(),
    env.DB.prepare(
      `SELECT c.id, c.name, c.email,
              MAX(i.created_at) as last_order_at,
              COALESCE(SUM(i.total_usd), 0) as lifetime_usd
       FROM customers c
       JOIN invoices i ON i.customer_id = c.id AND i.status = 'fulfilled'
       WHERE c.account_id = ?
       GROUP BY c.id
       HAVING last_order_at < datetime('now', '-90 days')
       ORDER BY last_order_at ASC
       LIMIT 20`
    ).bind(accountId).all(),
    env.DB.prepare(
      `SELECT c.id, c.name, c.email,
              MIN(i.created_at) as first_order_at,
              COALESCE(SUM(i.total_usd), 0) as lifetime_usd
       FROM customers c
       JOIN invoices i ON i.customer_id = c.id AND i.status = 'fulfilled'
       WHERE c.account_id = ?
       GROUP BY c.id
       HAVING first_order_at >= datetime('now', '-30 days')
       ORDER BY first_order_at DESC
       LIMIT 20`
    ).bind(accountId).all(),
  ]);

  return json({
    top10: top10Rows.results ?? [],
    lapsed: lapsedRows.results ?? [],
    new_this_month: newRows.results ?? [],
  });
};

// ── Collections (Phase 1) ──
// Persistent curator-driven product sets + link-gated person publications.
// Phase 1: Person audience only. target_type reserves store/event/shop for later phases.

function shortId(len = 10): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, len);
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')    // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'collection';
}

function buildCollectionSlug(title: string): string {
  return `${slugifyTitle(title)}-${shortId(4)}`;
}

async function loadCollectionOr404(
  env: Env,
  id: string,
  accountId: string
): Promise<{ row: any } | { error: Response }> {
  const row = await env.DB.prepare(
    `SELECT id, account_id, title, note, hero_image_url, status,
            created_by_user_id, curator_user_id, curator_display_name,
            created_at, updated_at
       FROM collections
      WHERE id = ? AND account_id = ?`
  ).bind(id, accountId).first();
  if (!row) return { error: json({ error: 'Collection not found' }, 404) };
  return { row };
}

const handleListCollections: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status');
  const productId = url.searchParams.get('product_id');
  const isOwner = ctx.role === 'owner';

  let sql = `
    SELECT c.id, c.title, c.note, c.hero_image_url, c.status,
           c.curator_display_name,
           c.created_at, c.updated_at,
           (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id) AS item_count,
           (SELECT COUNT(*) FROM collection_publications p
              WHERE p.collection_id = c.id AND p.unpublished_at IS NULL) AS active_publication_count,
           (SELECT MAX(p.published_at) FROM collection_publications p
              WHERE p.collection_id = c.id AND p.unpublished_at IS NULL) AS last_published_at
      FROM collections c
     WHERE c.account_id = ?`;
  const binds: any[] = [ctx.accountId];
  if (!isOwner) {
    sql += ` AND c.curator_user_id = ?`;
    binds.push(ctx.userId);
  }
  if (statusFilter && ['draft', 'active', 'archived'].includes(statusFilter)) {
    sql += ` AND c.status = ?`;
    binds.push(statusFilter);
  }
  if (productId) {
    sql += ` AND EXISTS (SELECT 1 FROM collection_items ci WHERE ci.collection_id = c.id AND ci.product_id = ?)`;
    binds.push(productId);
  }
  sql += ` ORDER BY c.updated_at DESC LIMIT 200`;

  const { results } = await env.DB.prepare(sql).bind(...binds).all();

  // Enrich with first three product image URLs for thumbnails.
  const ids = (results as any[]).map(r => r.id);
  let thumbMap = new Map<string, string[]>();
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const thumbRows = await env.DB.prepare(
      `SELECT ci.collection_id, p.image_url
         FROM collection_items ci
         JOIN products p ON p.id = ci.product_id
        WHERE ci.collection_id IN (${placeholders})
        ORDER BY ci.collection_id, ci.position`
    ).bind(...ids).all();
    for (const r of (thumbRows.results ?? []) as any[]) {
      const existing = thumbMap.get(r.collection_id) ?? [];
      if (existing.length < 3 && r.image_url) {
        existing.push(r.image_url);
        thumbMap.set(r.collection_id, existing);
      }
    }
  }

  const rows = (results as any[]).map(r => ({
    ...r,
    thumbnails: thumbMap.get(r.id) ?? [],
  }));
  return json({ collections: rows });
};

const handleGetCollection: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;
  const found = await loadCollectionOr404(env, params.id, ctx.accountId);
  if ('error' in found) return found.error;

  const isOwner = ctx.role === 'owner';
  if (!isOwner && found.row.curator_user_id !== ctx.userId) {
    return json({ error: 'Forbidden' }, 403);
  }

  const items = await env.DB.prepare(
    `SELECT ci.id, ci.collection_id, ci.product_id, ci.position, ci.item_note,
            p.type AS product_type,
            COALESCE(p.given_name, p.product_name) AS product_name,
            p.chinese_name, p.year, p.origin_country, p.origin_region,
            p.image_url, p.status AS product_status, p.stock_grams, p.quantity_units,
            p.tasting_notes, p.description
       FROM collection_items ci
       JOIN products p ON p.id = ci.product_id
      WHERE ci.collection_id = ?
      ORDER BY ci.position ASC`
  ).bind(params.id).all();

  const pubs = await env.DB.prepare(
    `SELECT id, collection_id, target_type, target_id, slug, recipients_json,
            published_at, unpublished_at, view_count
       FROM collection_publications
      WHERE collection_id = ?
      ORDER BY published_at DESC`
  ).bind(params.id).all();

  const publications = ((pubs.results ?? []) as any[]).map(p => ({
    ...p,
    recipients: p.recipients_json ? JSON.parse(p.recipients_json) : [],
  }));

  return json({
    collection: found.row,
    items: items.results ?? [],
    publications,
  });
};

const handleCreateCollection: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;
  const isOwner = ctx.role === 'owner';

  // Non-owners must have can_create_collections flag.
  if (!isOwner) {
    const userRow = await env.DB.prepare(
      `SELECT can_create_collections FROM users WHERE id = ?`
    ).bind(ctx.userId).first();
    if (!userRow || !userRow.can_create_collections) {
      return json({ error: 'Insufficient permissions to create collections' }, 403);
    }
  }

  const body = await request.json() as any;
  const title = (body.title || '').trim();
  if (!title) return json({ error: 'Title required' }, 400);

  // Set curator attribution for non-owners with the flag.
  const curatorUserId = !isOwner ? ctx.userId : null;
  const curatorDisplayName = !isOwner ? ((body.curator_display_name || '').trim() || null) : null;

  const id = newId('col');
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO collections (id, account_id, title, note, hero_image_url, status,
                              created_by_user_id, curator_user_id, curator_display_name,
                              created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`
  ).bind(
    id, ctx.accountId, title,
    body.note || null, body.hero_image_url || null,
    ctx.userId, curatorUserId, curatorDisplayName, now, now
  ).run();

  const productIds: string[] = Array.isArray(body.initial_product_ids) ? body.initial_product_ids : [];
  if (productIds.length) {
    const stmts = productIds.map((pid: string, idx: number) =>
      env.DB.prepare(
        `INSERT INTO collection_items (id, collection_id, product_id, position)
         VALUES (?, ?, ?, ?)`
      ).bind(newId('ci'), id, pid, idx + 1)
    );
    await env.DB.batch(stmts);
  }

  return json({ id }, 201);
};

const handlePatchCollection: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;
  const found = await loadCollectionOr404(env, params.id, ctx.accountId);
  if ('error' in found) return found.error;

  const isOwner = ctx.role === 'owner';
  if (!isOwner && found.row.curator_user_id !== ctx.userId) {
    return json({ error: 'Forbidden' }, 403);
  }

  const body = await request.json() as any;
  const updates: string[] = [];
  const binds: any[] = [];
  for (const field of ['title', 'note', 'hero_image_url', 'status', 'curator_display_name']) {
    if (field in body) {
      if (field === 'status' && !['draft', 'active', 'archived'].includes(body.status)) {
        return json({ error: 'Invalid status' }, 400);
      }
      updates.push(`${field} = ?`);
      binds.push(body[field]);
    }
  }
  if (!updates.length) return json({ ok: true });
  updates.push(`updated_at = ?`);
  binds.push(new Date().toISOString());
  binds.push(params.id);

  await env.DB.prepare(
    `UPDATE collections SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...binds).run();
  return json({ ok: true });
};

const handleAddCollectionItems: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;
  const found = await loadCollectionOr404(env, params.id, ctx.accountId);
  if ('error' in found) return found.error;

  const body = await request.json() as any;
  const productIds: string[] = Array.isArray(body.product_ids) ? body.product_ids : [];
  if (!productIds.length) return json({ error: 'product_ids required' }, 400);

  const maxRow = await env.DB.prepare(
    `SELECT COALESCE(MAX(position), 0) AS max_pos FROM collection_items WHERE collection_id = ?`
  ).bind(params.id).first();
  let pos = (maxRow?.max_pos as number) || 0;

  // Filter products that aren't already in the collection.
  const existing = await env.DB.prepare(
    `SELECT product_id FROM collection_items WHERE collection_id = ?`
  ).bind(params.id).all();
  const have = new Set((existing.results as any[]).map(r => r.product_id));
  const toInsert = productIds.filter(pid => !have.has(pid));

  if (toInsert.length) {
    const stmts = toInsert.map(pid => {
      pos += 1;
      return env.DB.prepare(
        `INSERT INTO collection_items (id, collection_id, product_id, position)
         VALUES (?, ?, ?, ?)`
      ).bind(newId('ci'), params.id, pid, pos);
    });
    await env.DB.batch(stmts);
  }

  await env.DB.prepare(
    `UPDATE collections SET updated_at = ? WHERE id = ?`
  ).bind(new Date().toISOString(), params.id).run();

  return json({ added: toInsert.length, skipped: productIds.length - toInsert.length });
};

const handleRemoveCollectionItem: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;
  const found = await loadCollectionOr404(env, params.id, ctx.accountId);
  if ('error' in found) return found.error;

  await env.DB.prepare(
    `DELETE FROM collection_items WHERE id = ? AND collection_id = ?`
  ).bind(params.itemId, params.id).run();

  await env.DB.prepare(
    `UPDATE collections SET updated_at = ? WHERE id = ?`
  ).bind(new Date().toISOString(), params.id).run();

  return json({ ok: true });
};

const handlePatchCollectionItem: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;
  const found = await loadCollectionOr404(env, params.id, ctx.accountId);
  if ('error' in found) return found.error;

  const body = await request.json() as any;

  // Reorder: swap with neighbor.
  if (body.direction === 'up' || body.direction === 'down') {
    const current = await env.DB.prepare(
      `SELECT id, position FROM collection_items WHERE id = ? AND collection_id = ?`
    ).bind(params.itemId, params.id).first();
    if (!current) return json({ error: 'Item not found' }, 404);
    const op = body.direction === 'up' ? '<' : '>';
    const ord = body.direction === 'up' ? 'DESC' : 'ASC';
    const neighbor = await env.DB.prepare(
      `SELECT id, position FROM collection_items
        WHERE collection_id = ? AND position ${op} ?
        ORDER BY position ${ord} LIMIT 1`
    ).bind(params.id, current.position).first();
    if (!neighbor) return json({ ok: true }); // already at boundary

    await env.DB.batch([
      env.DB.prepare(`UPDATE collection_items SET position = ? WHERE id = ?`)
        .bind(neighbor.position, current.id),
      env.DB.prepare(`UPDATE collection_items SET position = ? WHERE id = ?`)
        .bind(current.position, neighbor.id),
    ]);
    return json({ ok: true });
  }

  if ('item_note' in body) {
    await env.DB.prepare(
      `UPDATE collection_items SET item_note = ? WHERE id = ? AND collection_id = ?`
    ).bind(body.item_note, params.itemId, params.id).run();
    return json({ ok: true });
  }

  return json({ error: 'No valid update' }, 400);
};

const handlePublishCollection: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;
  const found = await loadCollectionOr404(env, params.id, ctx.accountId);
  if ('error' in found) return found.error;

  const body = await request.json() as any;
  const targetType = body.target_type || 'person';
  if (targetType !== 'person' && targetType !== 'store' && targetType !== 'tag') {
    // Phases 3-4 (event, shop) not yet implemented.
    return json({ error: `target_type '${targetType}' not yet supported` }, 400);
  }

  let recipients: any[] = [];
  let targetId: string | null = null;

  if (targetType === 'person') {
    recipients = Array.isArray(body.recipients) ? body.recipients : [];
    if (recipients.length === 0) {
      return json({ error: 'At least one recipient is required' }, 400);
    }
  } else if (targetType === 'tag') {
    // Tag audience: snapshot matching customers into recipients_json so the
    // publication is stable even if tag membership later changes.
    const tag = normalizeTag(body.target_id ?? body.tag);
    if (!tag) return json({ error: 'tag is required for tag target' }, 400);

    // Idempotent: drop anyone who already has an active publication of this
    // collection on the person/tag track.
    const activePubs = await env.DB.prepare(
      `SELECT recipients_json FROM collection_publications
        WHERE collection_id = ? AND unpublished_at IS NULL
          AND target_type IN ('person','tag')`
    ).bind(params.id).all();
    const alreadyIds = new Set<string>();
    for (const p of (activePubs.results ?? []) as any[]) {
      const rs = p.recipients_json ? JSON.parse(p.recipients_json) : [];
      for (const r of rs) if (r?.customer_id) alreadyIds.add(r.customer_id);
    }

    const matched = await env.DB.prepare(
      `SELECT c.id, c.name, c.phone, c.whatsapp
         FROM customer_tags ct
         JOIN customers c ON c.id = ct.customer_id
        WHERE ct.account_id = ? AND ct.tag = ? AND c.account_id = ?
        ORDER BY c.name ASC`
    ).bind(ctx.accountId, tag, ctx.accountId).all();

    recipients = ((matched.results ?? []) as any[])
      .filter(c => !alreadyIds.has(c.id))
      .map(c => ({ customer_id: c.id, name: c.name, phone: c.phone || c.whatsapp || undefined }));

    if (recipients.length === 0) {
      return json({ error: `No new recipients for tag "${tag}" (everyone already has this collection)` }, 400);
    }
    targetId = tag;
  } else {
    // store: target_id is the receiving account.
    targetId = typeof body.target_id === 'string' ? body.target_id : '';
    if (!targetId) return json({ error: 'target_id (account) is required for store target' }, 400);
    if (targetId === ctx.accountId) {
      return json({ error: 'Cannot publish a collection to your own account' }, 400);
    }
    // Verify the target is a real account.
    const targetAcct = await env.DB.prepare(
      `SELECT id FROM accounts WHERE id = ? AND status != 'suspended'`
    ).bind(targetId).first();
    if (!targetAcct) return json({ error: 'Target store not found' }, 404);
  }

  // Require at least one item.
  const itemCount = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM collection_items WHERE collection_id = ?`
  ).bind(params.id).first();
  if (!itemCount || (itemCount.n as number) === 0) {
    return json({ error: 'Collection must contain at least one item before publishing' }, 400);
  }

  // Human-readable slug with short hash suffix for uniqueness.
  const coll = found.row as { title: string };
  let slug = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = buildCollectionSlug(coll.title);
    const exists = await env.DB.prepare(
      `SELECT 1 FROM collection_publications WHERE slug = ?`
    ).bind(candidate).first();
    if (!exists) { slug = candidate; break; }
  }
  if (!slug) return json({ error: 'Slug generation failed' }, 500);

  const pubId = newId('pub');
  await env.DB.prepare(
    `INSERT INTO collection_publications
       (id, collection_id, target_type, target_id, slug, recipients_json, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    pubId, params.id, targetType, targetId,
    slug, (targetType === 'person' || targetType === 'tag') ? JSON.stringify(recipients) : null,
    ctx.userId
  ).run();

  // Auto-promote draft → active on first publish.
  await env.DB.prepare(
    `UPDATE collections SET status = CASE WHEN status = 'draft' THEN 'active' ELSE status END,
                            updated_at = ?
      WHERE id = ?`
  ).bind(new Date().toISOString(), params.id).run();

  return json({ id: pubId, slug }, 201);
};

const handleUnpublish: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;
  const found = await loadCollectionOr404(env, params.id, ctx.accountId);
  if ('error' in found) return found.error;

  await env.DB.prepare(
    `UPDATE collection_publications SET unpublished_at = ?
      WHERE id = ? AND collection_id = ?`
  ).bind(new Date().toISOString(), params.pubId, params.id).run();

  return json({ ok: true });
};

// ── Shop-audience publications (Phase 3) ──────────────────────────────────────
// Publishing a collection to the shop makes it publicly visible on the
// storefront via GET /api/collections/shop (no auth). The collection itself
// remains owned by the originating account; the publication row carries
// target_type='shop' and target_id=NULL.

// POST /api/collections/:id/publish-shop
// Idempotent: returns 200 with the existing row if already active.
const handlePublishToShop: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;
  const found = await loadCollectionOr404(env, params.id, ctx.accountId);
  if ('error' in found) return found.error;

  const isOwner = ctx.role === 'owner';
  if (!isOwner && found.row.curator_user_id !== ctx.userId) {
    return json({ error: 'Forbidden' }, 403);
  }

  // Require at least one item before publishing.
  const itemCount = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM collection_items WHERE collection_id = ?`
  ).bind(params.id).first();
  if (!itemCount || (itemCount.n as number) === 0) {
    return json({ error: 'Collection must contain at least one item before publishing' }, 400);
  }

  // Idempotent: return existing active shop publication if one exists.
  const existing = await env.DB.prepare(
    `SELECT id, collection_id, target_type, target_id, slug,
            published_at, unpublished_at, view_count
       FROM collection_publications
      WHERE collection_id = ?
        AND target_type = 'shop'
        AND unpublished_at IS NULL
      LIMIT 1`
  ).bind(params.id).first();
  if (existing) {
    return json({ publication: existing, created: false });
  }

  // Generate a slug for consistency with other audiences.
  const coll = found.row as { title: string };
  let slug = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = buildCollectionSlug(coll.title);
    const taken = await env.DB.prepare(
      `SELECT 1 FROM collection_publications WHERE slug = ?`
    ).bind(candidate).first();
    if (!taken) { slug = candidate; break; }
  }
  if (!slug) return json({ error: 'Slug generation failed' }, 500);

  const pubId = newId('pub');
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO collection_publications
       (id, collection_id, target_type, target_id, slug, recipients_json, created_by_user_id)
     VALUES (?, ?, 'shop', NULL, ?, NULL, ?)`
  ).bind(pubId, params.id, slug, ctx.userId).run();

  // Auto-promote draft -> active on first publish.
  await env.DB.prepare(
    `UPDATE collections SET status = CASE WHEN status = 'draft' THEN 'active' ELSE status END,
                            updated_at = ?
      WHERE id = ?`
  ).bind(now, params.id).run();

  await logPlatformAction(env, 'collection.published_to_shop', ctx.userId, ctx.email, 'collection', params.id, {
    publication_id: pubId,
    slug,
    collection_title: coll.title,
    account_id: ctx.accountId,
  });

  const row = await env.DB.prepare(
    `SELECT id, collection_id, target_type, target_id, slug,
            published_at, unpublished_at, view_count
       FROM collection_publications WHERE id = ?`
  ).bind(pubId).first();

  return json({ publication: row, created: true }, 201);
};

// POST /api/collections/:id/unpublish-shop
// Sets unpublished_at on the active shop publication for this collection.
const handleUnpublishFromShop: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;
  const found = await loadCollectionOr404(env, params.id, ctx.accountId);
  if ('error' in found) return found.error;

  const isOwner = ctx.role === 'owner';
  if (!isOwner && found.row.curator_user_id !== ctx.userId) {
    return json({ error: 'Forbidden' }, 403);
  }

  const pub = await env.DB.prepare(
    `SELECT id FROM collection_publications
      WHERE collection_id = ?
        AND target_type = 'shop'
        AND unpublished_at IS NULL
      LIMIT 1`
  ).bind(params.id).first();

  if (!pub) {
    return json({ error: 'No active shop publication for this collection' }, 404);
  }

  await env.DB.prepare(
    `UPDATE collection_publications SET unpublished_at = ? WHERE id = ?`
  ).bind(new Date().toISOString(), pub.id).run();

  await logPlatformAction(env, 'collection.unpublished_from_shop', ctx.userId, ctx.email, 'collection', params.id, {
    publication_id: pub.id,
    account_id: ctx.accountId,
  });

  return json({ ok: true });
};

// POST /api/products/:id/featured
// Sets or clears the "Featured" shop-published collection membership for a product.
// Body: { featured: boolean }
// The handler finds-or-creates a per-account system collection identified by
// is_featured_collection=1 (added in migration 054). It then adds/removes the
// product and publishes/unpublishes the collection to the shop audience as needed.
const handleSetProductFeatured: Handler = async (request, env, params) => {
  const ctx = await getActiveAccount(request, env);
  if ('error' in ctx) return ctx.error;
  const { accountId, userId, email } = ctx;

  const body = await request.json() as { featured?: boolean };
  const featured = Boolean(body.featured);

  // Verify the product belongs to this account.
  const product = await env.DB.prepare(
    `SELECT id FROM products WHERE id = ? AND account_id = ?`
  ).bind(params.id, accountId).first();
  if (!product) return json({ error: 'Product not found' }, 404);

  // Find or create the account's system Featured collection.
  let collectionRow = await env.DB.prepare(
    `SELECT id FROM collections WHERE account_id = ? AND is_featured_collection = 1 LIMIT 1`
  ).bind(accountId).first();

  if (!collectionRow) {
    const collId = newId('col');
    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO collections (id, account_id, title, status, is_featured_collection, created_by_user_id, created_at, updated_at)
       VALUES (?, ?, 'Featured', 'active', 1, ?, ?, ?)`
    ).bind(collId, accountId, userId, now, now).run();
    collectionRow = { id: collId };
  }

  const collectionId = collectionRow.id as string;

  if (featured) {
    // Add product to the collection (idempotent via UNIQUE constraint).
    const existingItem = await env.DB.prepare(
      `SELECT id FROM collection_items WHERE collection_id = ? AND product_id = ?`
    ).bind(collectionId, params.id).first();

    if (!existingItem) {
      const maxPos = await env.DB.prepare(
        `SELECT COALESCE(MAX(position), 0) AS max_pos FROM collection_items WHERE collection_id = ?`
      ).bind(collectionId).first();
      const position = ((maxPos?.max_pos as number) || 0) + 1;
      await env.DB.prepare(
        `INSERT INTO collection_items (id, collection_id, product_id, position) VALUES (?, ?, ?, ?)`
      ).bind(newId('ci'), collectionId, params.id, position).run();
    }

    // Publish to shop if not already active.
    const activePub = await env.DB.prepare(
      `SELECT id FROM collection_publications
        WHERE collection_id = ? AND target_type = 'shop' AND unpublished_at IS NULL
        LIMIT 1`
    ).bind(collectionId).first();

    if (!activePub) {
      let slug = '';
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = buildCollectionSlug('Featured');
        const taken = await env.DB.prepare(
          `SELECT 1 FROM collection_publications WHERE slug = ?`
        ).bind(candidate).first();
        if (!taken) { slug = candidate; break; }
      }
      if (!slug) return json({ error: 'Slug generation failed' }, 500);
      const pubId = newId('pub');
      await env.DB.prepare(
        `INSERT INTO collection_publications
           (id, collection_id, target_type, target_id, slug, recipients_json, created_by_user_id)
         VALUES (?, ?, 'shop', NULL, ?, NULL, ?)`
      ).bind(pubId, collectionId, slug, userId).run();

      await logPlatformAction(env, 'product.featured.published_collection', userId, email, 'collection', collectionId, {
        publication_id: pubId, product_id: params.id, account_id: accountId,
      });
    }
  } else {
    // Remove product from the collection.
    await env.DB.prepare(
      `DELETE FROM collection_items WHERE collection_id = ? AND product_id = ?`
    ).bind(collectionId, params.id).run();

    // If the collection is now empty, unpublish it.
    const remaining = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM collection_items WHERE collection_id = ?`
    ).bind(collectionId).first();

    if ((remaining?.n as number) === 0) {
      await env.DB.prepare(
        `UPDATE collection_publications SET unpublished_at = ?
          WHERE collection_id = ? AND target_type = 'shop' AND unpublished_at IS NULL`
      ).bind(new Date().toISOString(), collectionId).run();
    }
  }

  await logPlatformAction(env, featured ? 'product.featured' : 'product.unfeatured', userId, email, 'product', params.id, {
    collection_id: collectionId, account_id: accountId,
  });

  return json({ ok: true, featured });
};

// GET /api/collections/shop
// Public, no auth. Returns the 20 most recently published active shop
// collections, each with full collection metadata, curator attribution,
// and in-stock active items.
const handleGetShopCollections: Handler = async (_request, env) => {
  // Fetch active shop publications, newest first, capped at 20.
  const { results: pubs } = await env.DB.prepare(
    `SELECT cp.id AS publication_id,
            cp.slug,
            cp.published_at,
            cp.view_count,
            c.id AS collection_id,
            c.account_id,
            c.title,
            c.note,
            c.hero_image_url,
            c.status AS collection_status,
            c.curator_user_id,
            c.curator_display_name,
            u.name AS curator_user_name
       FROM collection_publications cp
       JOIN collections c ON c.id = cp.collection_id
       LEFT JOIN users u ON u.id = c.curator_user_id
      WHERE cp.target_type = 'shop'
        AND cp.unpublished_at IS NULL
        AND c.status = 'active'
      ORDER BY cp.published_at DESC
      LIMIT 20`
  ).all();

  if (!pubs || pubs.length === 0) {
    return json({ collections: [] });
  }

  // Batch-fetch items for all returned collections.
  const collectionIds = (pubs as any[]).map((p: any) => p.collection_id);
  const placeholders = collectionIds.map(() => '?').join(',');

  const { results: allItems } = await env.DB.prepare(
    `SELECT ci.collection_id,
            ci.id AS item_id,
            ci.position,
            ci.item_note,
            p.id AS product_id,
            p.type AS product_type,
            COALESCE(p.given_name, p.product_name) AS product_name,
            p.chinese_name,
            p.year,
            p.origin_country,
            p.origin_region,
            p.image_url,
            p.description,
            p.tasting_notes,
            p.stock_grams,
            p.quantity_units
       FROM collection_items ci
       JOIN products p ON p.id = ci.product_id
      WHERE ci.collection_id IN (${placeholders})
        AND p.status = 'Active'
      ORDER BY ci.collection_id, ci.position ASC`
  ).bind(...collectionIds).all();

  // Group items by collection.
  const itemsByCollection = new Map<string, any[]>();
  for (const item of (allItems ?? []) as any[]) {
    const list = itemsByCollection.get(item.collection_id) ?? [];
    const outOfStock = item.product_type === 'Teaware'
      ? (item.quantity_units ?? 0) <= 0
      : (item.stock_grams ?? 0) <= 0;
    if (!outOfStock) {
      list.push({
        item_id: item.item_id,
        position: item.position,
        item_note: item.item_note,
        product_id: item.product_id,
        product_type: item.product_type,
        product_name: item.product_name,
        chinese_name: item.chinese_name,
        year: item.year,
        origin_country: item.origin_country,
        origin_region: item.origin_region,
        image_url: item.image_url,
        description: item.description,
        tasting_notes: (() => {
          if (!item.tasting_notes) return null;
          if (typeof item.tasting_notes === 'string') {
            try { return JSON.parse(item.tasting_notes); } catch { return null; }
          }
          return item.tasting_notes;
        })(),
      });
    }
    itemsByCollection.set(item.collection_id, list);
  }

  const collections = (pubs as any[]).map((p: any) => ({
    publication_id: p.publication_id,
    slug: p.slug,
    published_at: p.published_at,
    view_count: p.view_count,
    collection: {
      id: p.collection_id,
      account_id: p.account_id,
      title: p.title,
      note: p.note,
      hero_image_url: p.hero_image_url,
      status: p.collection_status,
      curator_display_name: p.curator_user_id
        ? (p.curator_display_name || p.curator_user_name || null)
        : null,
    },
    items: itemsByCollection.get(p.collection_id) ?? [],
  }));

  return json({ collections });
};

const handleNeedsAttention: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;

  // OOS/archived products that appear in at least one active (non-unpublished) publication.
  // OOS = tea with stock_grams <= 0, or teaware with quantity_units <= 0.
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT ci.id AS item_id,
            ci.collection_id,
            c.title AS collection_title,
            p.id AS product_id,
            COALESCE(p.given_name, p.product_name) AS product_name,
            p.type AS product_type,
            p.status AS product_status,
            p.stock_grams,
            p.quantity_units,
            CASE
              WHEN p.status <> 'Active' THEN 'archived'
              WHEN p.type = 'Teaware' AND COALESCE(p.quantity_units, 0) <= 0 THEN 'out_of_stock'
              WHEN p.type <> 'Teaware' AND COALESCE(p.stock_grams, 0) <= 0 THEN 'out_of_stock'
              ELSE NULL
            END AS issue
       FROM collection_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN collections c ON c.id = ci.collection_id
      WHERE c.account_id = ?
        AND c.status = 'active'
        AND EXISTS (
          SELECT 1 FROM collection_publications cp
           WHERE cp.collection_id = c.id AND cp.unpublished_at IS NULL
        )
        AND (
          p.status <> 'Active'
          OR (p.type = 'Teaware' AND COALESCE(p.quantity_units, 0) <= 0)
          OR (p.type <> 'Teaware' AND COALESCE(p.stock_grams, 0) <= 0)
        )
      ORDER BY c.updated_at DESC
      LIMIT 50`
  ).bind(ctx.accountId).all();

  return json({ items: results ?? [] });
};

// ── Inbound (store-target) collections ──────────────────────────────────────
// A store account is the recipient of one or more `target_type='store'`
// publications. These handlers expose those publications to the recipient and
// let them import items into their own inventory.

const handleListInboundCollections: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;

  const { results } = await env.DB.prepare(
    `SELECT cp.id AS publication_id,
            cp.slug,
            cp.published_at,
            cp.unpublished_at,
            cp.recipient_seen_at,
            c.id AS collection_id,
            c.title,
            c.note,
            c.hero_image_url,
            c.account_id AS publisher_account_id,
            a.name AS publisher_account_name,
            (SELECT COUNT(*) FROM collection_items ci WHERE ci.collection_id = c.id) AS item_count,
            (SELECT COUNT(*) FROM collection_items ci
                JOIN products p ON p.id = ci.product_id
              WHERE ci.collection_id = c.id
                AND EXISTS (
                  SELECT 1 FROM products p2
                   WHERE p2.account_id = ?
                     AND p2.imported_via_publication_id = cp.id
                     AND p2.imported_from_product_id = ci.product_id
                )) AS imported_count
       FROM collection_publications cp
       JOIN collections c ON c.id = cp.collection_id
       JOIN accounts a ON a.id = c.account_id
      WHERE cp.target_type = 'store'
        AND cp.target_id = ?
        AND cp.unpublished_at IS NULL
      ORDER BY cp.published_at DESC
      LIMIT 200`
  ).bind(ctx.accountId, ctx.accountId).all();

  // Thumbnails for each inbound collection (first 3 product images).
  const ids = (results as any[]).map(r => r.collection_id);
  const thumbMap = new Map<string, string[]>();
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const thumbRows = await env.DB.prepare(
      `SELECT ci.collection_id, p.image_url
         FROM collection_items ci
         JOIN products p ON p.id = ci.product_id
        WHERE ci.collection_id IN (${placeholders})
        ORDER BY ci.collection_id, ci.position`
    ).bind(...ids).all();
    for (const r of (thumbRows.results ?? []) as any[]) {
      const existing = thumbMap.get(r.collection_id) ?? [];
      if (existing.length < 3 && r.image_url) {
        existing.push(r.image_url);
        thumbMap.set(r.collection_id, existing);
      }
    }
  }

  const rows = (results as any[]).map(r => ({
    ...r,
    thumbnails: thumbMap.get(r.collection_id) ?? [],
  }));

  const unread_count = rows.filter(r => !r.recipient_seen_at).length;
  return json({ inbound: rows, unread_count });
};

const handleGetInboundCollection: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;

  const pub = await env.DB.prepare(
    `SELECT cp.id AS publication_id, cp.slug, cp.target_id,
            cp.published_at, cp.unpublished_at, cp.recipient_seen_at,
            c.id AS collection_id, c.title, c.note, c.hero_image_url,
            c.account_id AS publisher_account_id,
            c.curator_display_name,
            a.name AS publisher_account_name,
            a.tagline AS publisher_tagline
       FROM collection_publications cp
       JOIN collections c ON c.id = cp.collection_id
       JOIN accounts a ON a.id = c.account_id
      WHERE cp.id = ?
        AND cp.target_type = 'store'
        AND cp.target_id = ?`
  ).bind(params.pubId, ctx.accountId).first();

  if (!pub) return json({ error: 'Inbound collection not found' }, 404);
  if (pub.unpublished_at) return json({ error: 'No longer available' }, 410);

  const items = await env.DB.prepare(
    `SELECT ci.id AS item_id, ci.product_id, ci.position, ci.item_note,
            p.type AS product_type,
            COALESCE(p.given_name, p.product_name) AS product_name,
            p.chinese_name, p.year, p.origin_country, p.origin_region,
            p.image_url, p.tasting_notes, p.description,
            (SELECT id FROM products
               WHERE account_id = ?
                 AND imported_from_product_id = ci.product_id
                 AND imported_via_publication_id = ?
               LIMIT 1) AS imported_product_id
       FROM collection_items ci
       JOIN products p ON p.id = ci.product_id
      WHERE ci.collection_id = ?
      ORDER BY ci.position ASC`
  ).bind(ctx.accountId, params.pubId, pub.collection_id).all();

  // Stamp seen_at on first view.
  if (!pub.recipient_seen_at) {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE collection_publications SET recipient_seen_at = ? WHERE id = ?`
    ).bind(now, params.pubId).run();
    (pub as any).recipient_seen_at = now;
  }

  return json({
    publication: pub,
    items: items.results ?? [],
  });
};

const handleImportInboundItems: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'publish');
  if ('error' in ctx) return ctx.error;

  const body = await request.json() as { product_ids?: string[] };
  const productIds = Array.isArray(body.product_ids) ? body.product_ids : [];
  if (productIds.length === 0) return json({ error: 'product_ids required' }, 400);

  // Verify the publication targets this account and includes those items.
  const pub = await env.DB.prepare(
    `SELECT cp.id, cp.collection_id
       FROM collection_publications cp
      WHERE cp.id = ?
        AND cp.target_type = 'store'
        AND cp.target_id = ?
        AND cp.unpublished_at IS NULL`
  ).bind(params.pubId, ctx.accountId).first();
  if (!pub) return json({ error: 'Inbound collection not found' }, 404);

  // Filter to only items actually in the collection.
  const validRows = await env.DB.prepare(
    `SELECT ci.product_id
       FROM collection_items ci
      WHERE ci.collection_id = ?
        AND ci.product_id IN (${productIds.map(() => '?').join(',')})`
  ).bind(pub.collection_id, ...productIds).all();
  const valid = new Set((validRows.results as any[]).map(r => r.product_id));
  const toImport = productIds.filter(id => valid.has(id));
  if (toImport.length === 0) return json({ imported: [], skipped: productIds.length });

  // Skip already-imported.
  const existingRows = await env.DB.prepare(
    `SELECT imported_from_product_id FROM products
      WHERE account_id = ?
        AND imported_via_publication_id = ?
        AND imported_from_product_id IN (${toImport.map(() => '?').join(',')})`
  ).bind(ctx.accountId, params.pubId, ...toImport).all();
  const already = new Set((existingRows.results as any[]).map(r => r.imported_from_product_id));
  const fresh = toImport.filter(id => !already.has(id));
  if (fresh.length === 0) {
    return json({ imported: [], skipped: productIds.length, reason: 'all already imported' });
  }

  const sourceRows = await env.DB.prepare(
    `SELECT * FROM products WHERE id IN (${fresh.map(() => '?').join(',')})`
  ).bind(...fresh).all();

  const COPY_COLS = [
    'type', 'form', 'given_name', 'chinese_name', 'product_name', 'year',
    'origin_country', 'origin_region', 'description', 'tasting_notes', 'image_url',
    'additional_images', 'lore', 'show_wisdom', 'processing_notes', 'terroir', 'mood',
    'experience', 'tea_key', 'tasting', 'material', 'capacity_ml', 'teaware_category',
    'quantity_units', 'is_featured', 'is_curated', 'can_reorder',
  ];

  const stmts: D1PreparedStatement[] = [];
  const imported: Array<{ source_id: string; new_id: string }> = [];

  for (const src of sourceRows.results as any[]) {
    const id = newId('prd');
    imported.push({ source_id: src.id, new_id: id });
    const cols = [
      'id', 'account_id', 'status', 'is_public', 'stock_grams', 'fixed_retail_price_usd',
      'imported_from_product_id', 'imported_via_publication_id',
      ...COPY_COLS,
    ];
    const vals = [
      id, ctx.accountId, 'Draft', 0, 0, null,
      src.id, params.pubId,
      ...COPY_COLS.map(c => src[c] ?? null),
    ];
    const placeholders = cols.map(() => '?').join(', ');
    stmts.push(
      env.DB.prepare(
        `INSERT INTO products (${cols.join(', ')}) VALUES (${placeholders})`
      ).bind(...vals)
    );
  }

  await env.DB.batch(stmts);

  return json({
    imported,
    skipped: productIds.length - imported.length,
  });
};

// Public — no auth, link-gated by slug.
const handleGetPublicCollection: Handler = async (_request, env, params) => {
  const pub = await env.DB.prepare(
    `SELECT id, collection_id, slug, unpublished_at, view_count
       FROM collection_publications
      WHERE slug = ?`
  ).bind(params.slug).first();
  if (!pub) return json({ error: 'Not found' }, 404);
  if (pub.unpublished_at) return json({ error: 'No longer available' }, 410);

  const collection = await env.DB.prepare(
    `SELECT c.id, c.title, c.note, c.hero_image_url, c.status,
            c.curator_user_id, c.curator_display_name,
            u.name AS curator_user_name
       FROM collections c
       LEFT JOIN users u ON u.id = c.curator_user_id
      WHERE c.id = ?`
  ).bind(pub.collection_id).first();
  if (!collection || collection.status === 'archived') {
    return json({ error: 'No longer available' }, 410);
  }

  // Account for WhatsApp deep link.
  const account = await env.DB.prepare(
    `SELECT id, name, whatsapp_number FROM accounts WHERE id = (
       SELECT account_id FROM collections WHERE id = ?
     )`
  ).bind(pub.collection_id).first();

  const items = await env.DB.prepare(
    `SELECT ci.id, ci.position, ci.item_note,
            p.id AS product_id, p.type AS product_type,
            COALESCE(p.given_name, p.product_name) AS product_name,
            p.chinese_name, p.year, p.origin_country, p.origin_region,
            p.image_url, p.description, p.tasting_notes,
            p.status AS product_status, p.stock_grams, p.quantity_units
       FROM collection_items ci
       JOIN products p ON p.id = ci.product_id
      WHERE ci.collection_id = ?
      ORDER BY ci.position ASC`
  ).bind(pub.collection_id).all();

  const visibleItems = ((items.results ?? []) as any[])
    .filter(i => i.product_status === 'Active')
    .map(i => {
      if (typeof i.tasting_notes === 'string') {
        try { i.tasting_notes = JSON.parse(i.tasting_notes); } catch { i.tasting_notes = []; }
      }
      const outOfStock = i.product_type === 'Teaware'
        ? (i.quantity_units ?? 0) <= 0
        : (i.stock_grams ?? 0) <= 0;
      return { ...i, out_of_stock: outOfStock };
    });

  return json({
    collection: {
      title: collection.title,
      note: collection.note,
      hero_image_url: collection.hero_image_url,
      curator_display_name: collection.curator_user_id
        ? (collection.curator_display_name || collection.curator_user_name || null)
        : null,
    },
    items: visibleItems,
    account: account ? { name: account.name, whatsapp_number: account.whatsapp_number } : null,
    publication: { slug: pub.slug, view_count: pub.view_count },
  });
};

// Public — increment view_count (sessionStorage-guarded client call).
const handlePublicCollectionView: Handler = async (_request, env, params) => {
  const pub = await env.DB.prepare(
    `SELECT id, unpublished_at FROM collection_publications WHERE slug = ?`
  ).bind(params.slug).first();
  if (!pub || pub.unpublished_at) return json({ ok: false }, 404);
  await env.DB.prepare(
    `UPDATE collection_publications SET view_count = view_count + 1 WHERE id = ?`
  ).bind(pub.id).run();
  return json({ ok: true });
};

// PUT /api/accounts/:id/members/:userId/curator — promote/demote curator flag (owner only)
// @deprecated Curator flag is superseded by Tea Master tier (accounts.kind = 'master').
// Per Members & Access decision §2: "Tea Master is the canonical curator tier."
// This endpoint and the underlying users.can_create_collections column remain
// in place because TeamView still calls it from src/admin/views/TeamView.tsx.
// Retire this handler when TeamView is removed; convert any active curators to
// Tea Master accounts via POST /api/platform/accounts/:id/upgrade-to-location
// or by setting accounts.kind = 'master' directly.
const handleSetCuratorFlag: Handler = async (request, env, params) => {
  const ctx = await requireAccountRole(request, env, ['owner']);
  if ('error' in ctx) return ctx.error;
  if (params.id !== ctx.accountId) return json({ error: 'Account access denied' }, 403);
  const member = await env.DB.prepare(
    `SELECT user_id FROM account_members WHERE account_id = ? AND user_id = ?`
  ).bind(params.id, params.userId).first();
  if (!member) return json({ error: 'User is not a member of this account' }, 404);
  const body = await request.json() as { can_create_collections?: boolean };
  const flag = body.can_create_collections ? 1 : 0;
  await env.DB.prepare(
    `UPDATE users SET can_create_collections = ? WHERE id = ?`
  ).bind(flag, params.userId).run();
  return json({ ok: true, can_create_collections: Boolean(flag) });
};

// ── Network Catalog ──

// GET /api/network/catalog
// Returns tea_profiles that the caller can carry (Step 2 of Network Rollout).
// Filters: network_visible=1, status='published', curated_by != caller account,
// caller has no existing active product_listing for this profile.
// Requires the Catalog bundle on the caller's account.
//
// Pricing resolution per profile (Decision 7 in NETWORK_ROLLOUT_PLAN.md):
//   1. account_wholesale_overrides[profile.id, caller.account_id].margin_pct_override
//   2. profile.wholesale_margin_pct (if not NULL)
//   3. wholesale_margin_defaults[tier].default_margin_pct
//   4. 50 (hardcoded fallback)
//
// Trust tier lookup: if caller's account.kind = 'master', use tier 'tea_master'
// for the wholesale_margin_defaults lookup, even though accounts.trust_tier
// defaults to 'verified' for Tea Masters at invite time. This correctly applies
// the tea_master margin seed (48%) for all master accounts.
// If kind != 'master', use accounts.trust_tier directly.
//
// TODO: add pagination when catalog grows past ~500 profiles.
const handleNetworkCatalog: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'catalog');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  // Fetch caller's account metadata (kind, trust_tier, currency_default)
  const callerAccount = await env.DB.prepare(
    'SELECT kind, trust_tier, currency_default FROM accounts WHERE id = ?'
  ).bind(accountId).first() as {
    kind: string;
    trust_tier: string;
    currency_default: string;
  } | null;

  if (!callerAccount) return json({ error: 'Caller account not found' }, 404);

  // Determine which tier key to use for wholesale_margin_defaults lookup.
  // Tea Master accounts (kind='master') use the 'tea_master' tier row even though
  // their accounts.trust_tier is 'verified' — the seed table has a distinct row for it.
  const marginTier = callerAccount.kind === 'master' ? 'tea_master' : (callerAccount.trust_tier || 'basic');
  const callerCurrency = callerAccount.currency_default || 'USD';

  // Batch: exchange rates + tier default margin + profiles in one round-trip
  const [ratesResult, tierDefaultResult, profilesResult] = await env.DB.batch([
    env.DB.prepare('SELECT currency, rate_to_usd FROM exchange_rates'),
    env.DB.prepare(
      'SELECT default_margin_pct FROM wholesale_margin_defaults WHERE trust_tier = ?'
    ).bind(marginTier),
    env.DB.prepare(`
      SELECT
        p.id, p.slug, p.name, p.chinese_name,
        p.type, p.form,
        p.origin_country, p.origin_region, p.varietal, p.harvest_year,
        p.description, p.image_url, p.canonical_photos,
        p.wholesale_margin_pct,
        p.created_at,
        p.curated_by_account_id   AS curator_account_id,
        p.originated_by_account_id AS originator_account_id,
        a.name  AS curator_account_name,
        a.slug  AS curator_account_slug,
        ao.name AS originator_account_name,
        a.currency_default AS curator_currency,
        -- Pull the curator's own listing for this profile so we have the
        -- canonical retail reference the rest of the network prices off.
        -- The listing id is what wholesale order items reference; expose it
        -- so the draft view can build supplier_listing_id without a second fetch.
        cl.id                     AS curator_listing_id,
        cl.fixed_retail_price_usd AS curator_fixed_retail_usd,
        cl.cost_amount            AS curator_cost_amount,
        cl.cost_currency          AS curator_cost_currency,
        cl.markup_multiplier      AS curator_markup_multiplier
      FROM tea_profiles p
      JOIN accounts a  ON a.id  = p.curated_by_account_id
      JOIN accounts ao ON ao.id = p.originated_by_account_id
      -- Curator's own listing for this profile. LEFT JOIN because in rare
      -- cases (a profile created before any listing was made) it could be
      -- missing; we degrade to null pricing rather than dropping the row.
      LEFT JOIN product_listings cl
             ON cl.profile_id  = p.id
            AND cl.account_id  = p.curated_by_account_id
            AND cl.status      = 'active'
      WHERE p.network_visible = 1
        AND p.status = 'published'
        AND p.curated_by_account_id != ?
        AND NOT EXISTS (
          SELECT 1 FROM product_listings pl
          WHERE pl.account_id  = ?
            AND pl.profile_id  = p.id
            AND pl.status      = 'active'
        )
      ORDER BY p.created_at DESC
    `).bind(accountId, accountId),
  ]);

  // Build exchange rate map: currency -> rate_to_usd (i.e. 1 unit = N USD)
  const rates = new Map<string, number>();
  for (const r of ratesResult.results as any[]) {
    rates.set(r.currency as string, r.rate_to_usd as number);
  }

  const tierDefaultMargin: number = (tierDefaultResult.results[0] as any)?.default_margin_pct ?? 50;

  // Fetch per-profile wholesale overrides for this caller in a second pass.
  // At small network scale (100-200 profiles) this is acceptable. The profiles
  // query above cannot join overrides inline without a correlated subquery per row.
  const profileIds = (profilesResult.results as any[]).map(p => p.id as string);
  let overrideMap = new Map<string, number>(); // profile_id -> margin_pct_override

  if (profileIds.length > 0) {
    // D1 does not support IN (?, ?, ...) with dynamic binding via batch, so we
    // build the placeholders manually. Safe: values are profile IDs from our own DB.
    const placeholders = profileIds.map(() => '?').join(', ');
    const overrideResult = await env.DB.prepare(
      `SELECT profile_id, margin_pct_override
       FROM account_wholesale_overrides
       WHERE buyer_account_id = ?
         AND profile_id IN (${placeholders})`
    ).bind(accountId, ...profileIds).all();

    for (const row of overrideResult.results as any[]) {
      overrideMap.set(row.profile_id as string, row.margin_pct_override as number);
    }
  }

  // Build response profiles with computed pricing
  const profiles = (profilesResult.results as any[]).map(p => {
    // Parse JSON array fields
    let canonicalPhotos: any[] = [];
    if (typeof p.canonical_photos === 'string') {
      try { canonicalPhotos = JSON.parse(p.canonical_photos); } catch { canonicalPhotos = []; }
    }

    // Resolve effective wholesale margin via Decision 7 chain
    let marginPct: number;
    if (overrideMap.has(p.id)) {
      marginPct = overrideMap.get(p.id)!;
    } else if (p.wholesale_margin_pct != null) {
      marginPct = p.wholesale_margin_pct as number;
    } else {
      marginPct = tierDefaultMargin;
    }

    // Pricing: the curator's own listing (joined above) gives the retail reference
    // the rest of the network prices off. Two ways the curator's listing expresses retail:
    //   1. fixed_retail_price_usd  → an explicit per-gram retail in USD
    //   2. cost_amount + markup_multiplier → derived per-gram retail in cost_currency
    // If neither is set (rare), return null prices and the frontend shows "Price on request".
    const curatorCurrency: string = p.curator_currency || 'USD';

    // Currency conversion helper: convert an amount from fromCurrency to toCurrency via USD.
    // Returns null when a required rate is missing.
    const convert = (amount: number, fromCurrency: string, toCurrency: string): number | null => {
      if (fromCurrency === toCurrency) return amount;
      const fromRate = rates.get(fromCurrency); // units per USD
      const toRate   = rates.get(toCurrency);   // units per USD
      if (!fromRate || !toRate) return null;
      return (amount / fromRate) * toRate;
    };

    let retailPricePerGramCurator: number | null = null;
    let wholesalePricePerGramCaller: number | null = null;
    let fxUnavailable = false;

    // Resolve the curator's retail per gram in the curator's display currency.
    if (p.curator_fixed_retail_usd != null) {
      // fixed_retail_price_usd is already per-gram in USD. Convert to curator's currency.
      const inCuratorCurrency = convert(p.curator_fixed_retail_usd as number, 'USD', curatorCurrency);
      if (inCuratorCurrency === null) {
        retailPricePerGramCurator = p.curator_fixed_retail_usd as number;
        fxUnavailable = true;
      } else {
        retailPricePerGramCurator = inCuratorCurrency;
      }
    } else if (p.curator_cost_amount != null && p.curator_cost_amount > 0) {
      // Cost-based: cost_per_gram (in cost_currency) * markup → retail in cost_currency.
      // Then convert to curator currency for display.
      const costCurrency = (p.curator_cost_currency as string) || 'USD';
      const markup = (p.curator_markup_multiplier as number) ?? 2.5;
      // cost_amount is the total cost for quantity_purchased; without that here,
      // we treat cost_amount as already per-gram. This matches how the legacy
      // products API returns it (see addPricingFields). Acceptable for browse.
      const retailInCostCurrency = (p.curator_cost_amount as number) * markup;
      const converted = convert(retailInCostCurrency, costCurrency, curatorCurrency);
      if (converted === null) {
        retailPricePerGramCurator = retailInCostCurrency;
        fxUnavailable = true;
      } else {
        retailPricePerGramCurator = converted;
      }
    }

    // Compute the caller's effective wholesale once retail is known.
    //   wholesale = retail_in_curator_currency * (marginPct / 100)  → convert to caller currency
    if (retailPricePerGramCurator !== null) {
      const wholesaleInCuratorCurrency = retailPricePerGramCurator * (marginPct / 100);
      const converted = convert(wholesaleInCuratorCurrency, curatorCurrency, callerCurrency);
      if (converted === null) {
        fxUnavailable = true;
        wholesalePricePerGramCaller = wholesaleInCuratorCurrency;
      } else {
        wholesalePricePerGramCaller = converted;
      }
    }

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      chinese_name: p.chinese_name ?? null,
      type: p.type ?? null,
      form: p.form ?? null,
      origin_country: p.origin_country ?? null,
      origin_region: p.origin_region ?? null,
      varietal: p.varietal ?? null,
      harvest_year: p.harvest_year ?? null,
      description: p.description ?? null,
      image_url: p.image_url ?? null,
      canonical_photos: canonicalPhotos,
      curator_account_id: p.curator_account_id,
      curator_account_name: p.curator_account_name,
      curator_account_slug: p.curator_account_slug,
      curator_listing_id: p.curator_listing_id ?? null,
      originator_account_id: p.originator_account_id,
      originator_account_name: p.originator_account_name,
      retail_currency: curatorCurrency,
      retail_price_per_gram_curator: retailPricePerGramCurator,
      wholesale_margin_pct_for_caller: marginPct,
      wholesale_price_per_gram_caller: wholesalePricePerGramCaller,
      wholesale_currency_caller: callerCurrency,
      fx_unavailable: fxUnavailable,
    };
  });

  return json({ profiles });
};

// POST /api/listings/carry
// Step 2 of Network Rollout — partner creates a product_listing from a network-visible
// tea_profile, copying the curator's canonical_photos into listing_photos so the partner
// starts with real photos. Requires the Catalog bundle on the caller's account.
//
// Body: { profile_id, initial_stock_grams, initial_price_amount, initial_price_currency }
//
// id generation: lower(hex(randomblob(16))) — matches the DEFAULT used by the migration
// for all listing rows, making the lineage of carry-created listings indistinguishable
// from migrated ones in queries. The legacy 'list_<product.id>' prefix was migration-only;
// new carry listings use the schema default. No 'list_carry_' prefix is added because
// D1's DEFAULT already generates the same opaque hex id, and relying on the schema default
// keeps the INSERT minimal and the id column semantics consistent.
//
// FX handling: initial_price_amount is in initial_price_currency. We convert to USD per-gram
// for fixed_retail_price_usd using the exchange_rates table. If the rate is unavailable for
// that currency, we store the amount as-is (treating it as USD for now). The listing edit
// flow (PUT /api/listings/:id, Step 2 polish phase) can correct this later.
const handleCarryListing: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'catalog');
  if ('error' in ctx) return ctx.error;
  const { accountId, userId, email } = ctx;

  // Parse + validate body
  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const profileId = typeof body.profile_id === 'string' ? body.profile_id.trim() : '';
  if (!profileId) return json({ error: 'profile_id is required' }, 400);

  const stockGrams = Number(body.initial_stock_grams);
  if (!isFinite(stockGrams) || stockGrams < 0) {
    return json({ error: 'initial_stock_grams must be a number >= 0' }, 400);
  }

  const priceAmount = Number(body.initial_price_amount);
  if (!isFinite(priceAmount) || priceAmount < 0) {
    return json({ error: 'initial_price_amount must be a number >= 0' }, 400);
  }

  const priceCurrency = typeof body.initial_price_currency === 'string'
    ? body.initial_price_currency.trim().toUpperCase()
    : '';
  if (!priceCurrency) return json({ error: 'initial_price_currency is required' }, 400);

  // 1. Look up the profile — must exist, be published, and be network-visible
  const profile = await env.DB.prepare(
    `SELECT id, name, status, network_visible, curated_by_account_id, canonical_photos
     FROM tea_profiles WHERE id = ?`
  ).bind(profileId).first() as {
    id: string;
    name: string;
    status: string;
    network_visible: number;
    curated_by_account_id: string;
    canonical_photos: string | null;
  } | null;

  if (!profile) return json({ error: 'Tea profile not found' }, 404);

  if (profile.status !== 'published' || profile.network_visible !== 1) {
    return json({ error: 'This tea is not currently available in the network catalog.' }, 400);
  }

  // 2. Refuse self-carry — curator can't carry their own tea from the network
  if (profile.curated_by_account_id === accountId) {
    return json({ error: "You already curate this tea — you can't carry it from yourself." }, 400);
  }

  // 3. Refuse double-carry — friendly 409 rather than letting UNIQUE constraint surface
  const existing = await env.DB.prepare(
    `SELECT id FROM product_listings
     WHERE account_id = ? AND profile_id = ? AND status = 'active'`
  ).bind(accountId, profileId).first();

  if (existing) {
    return json({ error: "You're already carrying this tea." }, 409);
  }

  // 4. Copy canonical_photos verbatim as the listing's starting photos (Decision 4)
  const listingPhotos = profile.canonical_photos ?? '[]';

  // 5. Convert initial_price_amount → USD per-gram for fixed_retail_price_usd
  //    Fetch only the two rates we need (caller currency + USD is a no-op).
  let fixedRetailPriceUsd: number = priceAmount; // fallback: store as-is
  if (priceCurrency !== 'USD') {
    const rateRow = await env.DB.prepare(
      'SELECT rate_to_usd FROM exchange_rates WHERE currency = ?'
    ).bind(priceCurrency).first() as { rate_to_usd: number } | null;

    if (rateRow && isFinite(rateRow.rate_to_usd) && rateRow.rate_to_usd > 0) {
      // rate_to_usd: 1 unit of currency = rate_to_usd USD
      fixedRetailPriceUsd = priceAmount / rateRow.rate_to_usd;
    }
    // If rate unavailable, fixedRetailPriceUsd stays as priceAmount (acceptable degradation;
    // listing edit flow can correct after FX data is refreshed).
  }

  // 6. Insert the product_listing row.
  //    id uses lower(hex(randomblob(16))) — same DEFAULT the schema uses; generated inline
  //    in the INSERT rather than via JS crypto to keep id generation in one place (D1).
  //    is_public = 1: carried teas default to publicly listed; partner can hide later.
  const insertResult = await env.DB.prepare(`
    INSERT INTO product_listings
      (id, account_id, profile_id, stock_grams, fixed_retail_price_usd,
       listing_photos, status, is_public)
    VALUES
      (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'active', 1)
    RETURNING id
  `).bind(accountId, profileId, stockGrams, fixedRetailPriceUsd, listingPhotos).first() as
    { id: string } | null;

  if (!insertResult) {
    return json({ error: 'Failed to create listing' }, 500);
  }

  const newListingId = insertResult.id;

  // 7. Audit log
  await logPlatformAction(
    env,
    'listing.carried',
    userId,
    email,
    'listing',
    newListingId,
    {
      profile_id: profileId,
      profile_name: profile.name,
      price_amount: priceAmount,
      price_currency: priceCurrency,
      stock_grams: stockGrams,
    }
  );

  // 8. Return 201 — frontend refetches on InventoryView landing
  return json({ listing_id: newListingId, profile_id: profileId }, 201);
};

// GET /api/listings/:id
// Step 3 frontend fetch — returns the listing row joined to its tea_profile.
// Caller must own the listing (account_id matches). Returns 404 if not found
// or if the listing belongs to a different account. Catalog bundle required.
const handleGetListing: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'catalog');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const listingId = url.pathname.split('/').pop() ?? '';
  if (!listingId) return json({ error: 'listing id required' }, 400);

  const row = await env.DB.prepare(`
    SELECT
      l.id              AS listing_id,
      l.account_id,
      l.profile_id,
      l.stock_grams,
      l.fixed_retail_price_usd,
      l.store_note,
      l.listing_photos,
      l.is_sample,
      l.status          AS listing_status,
      l.created_at      AS listing_created_at,
      p.id              AS profile_id_check,
      p.slug,
      p.name,
      p.chinese_name,
      p.type,
      p.form,
      p.origin_country,
      p.origin_region,
      p.varietal,
      p.harvest_year,
      p.description,
      p.lore,
      p.processing_notes,
      p.terroir,
      p.mood,
      p.experience,
      p.image_url,
      p.canonical_photos,
      p.status          AS profile_status,
      p.curated_by_account_id,
      p.originated_by_account_id,
      a.name            AS curated_by_name,
      a.kind            AS curated_by_kind,
      p.adoption_decision,
      p.suggested_for_network_at,
      p.adoption_decline_note
    FROM product_listings l
    JOIN tea_profiles p ON p.id = l.profile_id
    LEFT JOIN accounts a ON a.id = p.curated_by_account_id
    WHERE l.id = ? AND l.account_id = ?
  `).bind(listingId, accountId).first() as Record<string, unknown> | null;

  if (!row) return json({ error: 'Listing not found or not yours.' }, 404);

  // Parse JSON arrays
  let listing_photos: string[] = [];
  let canonical_photos: string[] = [];
  try { listing_photos = JSON.parse(row.listing_photos as string || '[]'); } catch { listing_photos = []; }
  try { canonical_photos = JSON.parse(row.canonical_photos as string || '[]'); } catch { canonical_photos = []; }

  return json({
    listing: {
      id: row.listing_id,
      account_id: row.account_id,
      profile_id: row.profile_id,
      stock_grams: row.stock_grams,
      fixed_retail_price_usd: row.fixed_retail_price_usd,
      store_note: row.store_note,
      listing_photos,
      is_sample: !!row.is_sample,
      status: row.listing_status,
      created_at: row.listing_created_at,
    },
    profile: {
      id: row.profile_id,
      slug: row.slug,
      name: row.name,
      chinese_name: row.chinese_name,
      type: row.type,
      form: row.form,
      origin_country: row.origin_country,
      origin_region: row.origin_region,
      varietal: row.varietal,
      harvest_year: row.harvest_year,
      description: row.description,
      lore: row.lore,
      processing_notes: row.processing_notes,
      terroir: row.terroir,
      mood: row.mood,
      experience: row.experience,
      image_url: row.image_url,
      canonical_photos,
      status: row.profile_status,
      curated_by_account_id: row.curated_by_account_id,
      curated_by_kind: row.curated_by_kind,
      originated_by_account_id: row.originated_by_account_id,
      curated_by_name: row.curated_by_name,
      adoption_decision: row.adoption_decision,
      suggested_for_network_at: row.suggested_for_network_at,
      adoption_decline_note: row.adoption_decline_note,
    },
  });
};

// PUT /api/listings/:id
// Body: {
//   stock_grams?,
//   price_amount? + price_currency?,   // preferred: server converts to USD/gram
//   fixed_retail_price_usd?,           // legacy: raw USD/gram, kept for compat
//   store_note?,
//   is_sample?,
// }
// Partner edits their own listing fields. Catalog bundle required.
// Caller must own the listing. ALLOW_LIST is enforced — no canonical fields,
// no account_id changes, no profile_id swaps.
const handleUpdateListing: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'catalog');
  if ('error' in ctx) return ctx.error;
  const { accountId, userId, email } = ctx;

  const url = new URL(request.url);
  const listingId = url.pathname.split('/').pop() ?? '';
  if (!listingId) return json({ error: 'listing id required' }, 400);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  // Verify caller owns the listing
  const owned = await env.DB.prepare(
    'SELECT id FROM product_listings WHERE id = ? AND account_id = ?'
  ).bind(listingId, accountId).first();
  if (!owned) return json({ error: 'Listing not found or not yours.' }, 404);

  const updates: string[] = [];
  const binds: any[] = [];

  // Stock
  if (body.stock_grams !== undefined) {
    const n = Number(body.stock_grams);
    if (!isFinite(n) || n < 0) return json({ error: 'stock_grams must be >= 0' }, 400);
    updates.push('stock_grams = ?');
    binds.push(Math.floor(n));
  }

  // Retail price — preferred path: price_amount + price_currency, server
  // converts to USD/gram via exchange_rates (1 unit of currency = N USD per
  // the existing rate convention). The frontend now sends this shape so
  // partners think in their own currency without client-side conversion.
  if (body.price_amount !== undefined) {
    if (body.price_amount === null) {
      updates.push('fixed_retail_price_usd = NULL');
    } else {
      const amount = Number(body.price_amount);
      if (!isFinite(amount) || amount < 0) {
        return json({ error: 'price_amount must be a number >= 0' }, 400);
      }
      const currency = typeof body.price_currency === 'string' ? body.price_currency.trim().toUpperCase() : '';
      if (!currency) {
        return json({ error: 'price_currency required when price_amount is set' }, 400);
      }
      // Convert to USD per gram. The amount the partner enters is per-100g
      // (matching the catalog browse + listing edit display), so divide by 100.
      let usdPerGram: number;
      if (currency === 'USD') {
        usdPerGram = amount / 100;
      } else {
        const rateRow = await env.DB.prepare(
          'SELECT rate_to_usd FROM exchange_rates WHERE currency = ?'
        ).bind(currency).first() as { rate_to_usd: number } | null;
        if (!rateRow || !isFinite(rateRow.rate_to_usd) || rateRow.rate_to_usd <= 0) {
          return json({ error: `No FX rate available for ${currency}` }, 400);
        }
        // exchange_rates convention: rate_to_usd is units-per-USD (e.g. IDR=16210),
        // so USD = amount / rate_to_usd.
        usdPerGram = (amount / rateRow.rate_to_usd) / 100;
      }
      updates.push('fixed_retail_price_usd = ?');
      binds.push(usdPerGram);
    }
  } else if (body.fixed_retail_price_usd !== undefined) {
    // Legacy direct-USD path. Kept so older callers keep working.
    if (body.fixed_retail_price_usd === null) {
      updates.push('fixed_retail_price_usd = NULL');
    } else {
      const n = Number(body.fixed_retail_price_usd);
      if (!isFinite(n) || n < 0) return json({ error: 'fixed_retail_price_usd must be >= 0' }, 400);
      updates.push('fixed_retail_price_usd = ?');
      binds.push(n);
    }
  }

  // Store note (free text, capped to 4000 chars to match other prose fields)
  if (body.store_note !== undefined) {
    if (body.store_note === null) {
      updates.push('store_note = NULL');
    } else if (typeof body.store_note === 'string') {
      updates.push('store_note = ?');
      binds.push(body.store_note.slice(0, 4000));
    } else {
      return json({ error: 'store_note must be a string or null' }, 400);
    }
  }

  // Sample-available toggle
  if (body.is_sample !== undefined) {
    updates.push('is_sample = ?');
    binds.push(body.is_sample ? 1 : 0);
  }

  if (updates.length === 0) {
    return json({ error: 'No editable fields supplied.' }, 400);
  }

  updates.push("updated_at = datetime('now')");
  binds.push(listingId);

  await env.DB.prepare(
    `UPDATE product_listings SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...binds).run();

  // Audit only when the change is meaningful (skip for store_note-only blurs;
  // they're noisy). Pricing + stock + sample changes are audited.
  const auditedFields = Object.keys(body).filter(k =>
    ['stock_grams', 'fixed_retail_price_usd', 'price_amount', 'is_sample'].includes(k)
  );
  if (auditedFields.length > 0) {
    await logPlatformAction(
      env, 'listing.updated', userId, email,
      'product_listing', listingId,
      { fields: auditedFields, account_id: accountId }
    );
  }

  return json({ ok: true });
};

// ── Profile suggestions (Step 3 — editorial governance) ─────────────────────
// Partners propose canonical changes by editing tea cards directly. Each card
// submission becomes a bundle (profile_suggestions) with one or more per-field
// rows (profile_suggestion_fields). The curator reviews per-field — accepting
// some, rejecting others — and accepted changes write to canonical immediately.
//
// Authorization (per the matrix in NETWORK_ROLLOUT_PLAN.md):
//   POST /api/profiles/:id/suggestions      — Catalog bundle
//   GET  /api/profiles/:id/suggestions      — Catalog bundle (curator view of one profile)
//   GET  /api/suggestions/incoming          — Catalog bundle (curator's whole queue)
//   POST /api/suggestions/:id/decide        — Catalog bundle on the curator account
//
// Per Decision 25: NO rationale field on the partner's submission. The change
// itself is the argument; the curator can leave a per-field reject_note.

// Whitelist of canonical fields a partner can suggest. Other tea_profiles
// columns are intentionally not editable via suggestions:
//   slug, originated_by_account_id, curated_by_account_id (immutable / Platform-only)
//   wholesale_margin_pct, network_visible, status (curator ops, not editorial)
//   flavor_tags, mood_tags, tasting_notes (live in tasting per Decision 23)
//   canonical_photos (photo suggestion is its own flow per Surface 5; deferred)
const PROFILE_SUGGESTABLE_FIELDS = new Set([
  'name',
  'chinese_name',
  'type',
  'form',
  'origin_country',
  'origin_region',
  'varietal',
  'harvest_year',
  'description',
  'lore',
  'processing_notes',
  'terroir',
  'mood',
  'experience',
  'image_url',
]);

// POST /api/profiles/:id/suggestions
// Body: { fields: [{ field_name, current_value, proposed_value }, ...] }
// Creates a new bundle + per-field rows. The current_value the partner sends
// is stored as a snapshot — used by the curator to detect drift if canonical
// changes between submission and review.
const handleCreateProfileSuggestion: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'catalog');
  if ('error' in ctx) return ctx.error;
  const { accountId, userId, email } = ctx;

  const profileId = params.id;
  if (!profileId) return json({ error: 'Profile id required' }, 400);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const fields = Array.isArray(body.fields) ? body.fields : null;
  if (!fields || fields.length === 0) {
    return json({ error: 'fields[] required (at least one field change)' }, 400);
  }
  if (fields.length > 20) {
    return json({ error: 'A single suggestion bundle can include at most 20 field changes.' }, 400);
  }

  // Validate each field row
  const cleaned: { field_name: string; current_value: string | null; proposed_value: string }[] = [];
  for (const f of fields) {
    if (typeof f.field_name !== 'string' || !PROFILE_SUGGESTABLE_FIELDS.has(f.field_name)) {
      return json({ error: `Field '${f.field_name}' is not editable via suggestions.` }, 400);
    }
    if (typeof f.proposed_value !== 'string' || f.proposed_value.length === 0) {
      return json({ error: `field_name='${f.field_name}': proposed_value required and must be non-empty string.` }, 400);
    }
    if (f.proposed_value.length > 8000) {
      return json({ error: `field_name='${f.field_name}': proposed_value too long (>8000 chars).` }, 400);
    }
    cleaned.push({
      field_name: f.field_name,
      current_value: typeof f.current_value === 'string' ? f.current_value : null,
      proposed_value: f.proposed_value,
    });
  }

  // Profile must exist; partner can't suggest against a profile they curate.
  const profile = await env.DB.prepare(
    'SELECT id, name, curated_by_account_id, status FROM tea_profiles WHERE id = ?'
  ).bind(profileId).first() as { id: string; name: string; curated_by_account_id: string; status: string } | null;

  if (!profile) return json({ error: 'Tea profile not found' }, 404);
  if (profile.curated_by_account_id === accountId) {
    return json({ error: "You curate this tea — edit it directly instead of suggesting." }, 400);
  }

  // Create bundle + field rows in one batch
  const suggestionId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  const stmts = [
    env.DB.prepare(
      `INSERT INTO profile_suggestions (id, profile_id, suggested_by_account_id, suggested_by_user_id, status)
       VALUES (?, ?, ?, ?, 'pending')`
    ).bind(suggestionId, profileId, accountId, userId),
    ...cleaned.map(f =>
      env.DB.prepare(
        `INSERT INTO profile_suggestion_fields (id, suggestion_id, field_name, current_value, proposed_value, status)
         VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 'pending')`
      ).bind(suggestionId, f.field_name, f.current_value, f.proposed_value)
    ),
  ];
  await env.DB.batch(stmts);

  await logPlatformAction(
    env, 'suggestion.created', userId, email,
    'suggestion', suggestionId,
    { profile_id: profileId, profile_name: profile.name, field_count: cleaned.length, fields: cleaned.map(f => f.field_name) }
  );

  return json({ suggestion_id: suggestionId, field_count: cleaned.length }, 201);
};

// GET /api/profiles/:id/suggestions
// Returns all suggestions for a single profile. Useful for "Adrian, show me
// every pending suggestion against Silver Needle." Curator-only on the profile.
const handleListProfileSuggestions: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'catalog');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const profileId = params.id;
  if (!profileId) return json({ error: 'Profile id required' }, 400);

  // Curator-only — partners read suggestions they themselves submitted via the
  // incoming queue. Only the curator of a profile sees ALL suggestions for it.
  const profile = await env.DB.prepare(
    'SELECT curated_by_account_id FROM tea_profiles WHERE id = ?'
  ).bind(profileId).first() as { curated_by_account_id: string } | null;
  if (!profile) return json({ error: 'Tea profile not found' }, 404);
  if (profile.curated_by_account_id !== accountId) {
    return json({ error: 'Only the curator can list suggestions for this profile.' }, 403);
  }

  const [bundlesResult, fieldsResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT s.id, s.profile_id, s.status, s.created_at, s.updated_at,
             s.suggested_by_account_id, a.name AS suggested_by_account_name,
             s.suggested_by_user_id, u.name AS suggested_by_user_name, u.email AS suggested_by_email
      FROM profile_suggestions s
      JOIN accounts a ON a.id = s.suggested_by_account_id
      LEFT JOIN users u ON u.id = s.suggested_by_user_id
      WHERE s.profile_id = ?
      ORDER BY s.created_at DESC
    `).bind(profileId),
    env.DB.prepare(`
      SELECT f.id, f.suggestion_id, f.field_name, f.current_value, f.proposed_value,
             f.status, f.reject_note, f.decided_at
      FROM profile_suggestion_fields f
      JOIN profile_suggestions s ON s.id = f.suggestion_id
      WHERE s.profile_id = ?
      ORDER BY f.created_at ASC
    `).bind(profileId),
  ]) as [{ results: any[] }, { results: any[] }];

  // Group fields under their bundles
  const bundles = (bundlesResult.results as any[]).map((b: any) => ({
    ...b,
    fields: (fieldsResult.results as any[]).filter((f: any) => f.suggestion_id === b.id),
  }));

  return json({ suggestions: bundles });
};

// GET /api/suggestions/incoming
// Curator's full incoming queue — all pending/partial bundles across every
// profile they curate. Surface 6 (Adrian's review queue).
const handleIncomingSuggestions: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'catalog');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  // Optional ?status= filter (default: pending + partial)
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status'); // 'pending' | 'partial' | 'resolved' | 'withdrawn' | null
  const statusClause = statusFilter
    ? 'AND s.status = ?'
    : "AND s.status IN ('pending', 'partial')";

  const params = [accountId];
  if (statusFilter) params.push(statusFilter);

  const [bundlesResult, fieldsResult] = await env.DB.batch([
    env.DB.prepare(`
      SELECT s.id, s.profile_id, s.status, s.created_at, s.updated_at,
             p.name AS profile_name, p.slug AS profile_slug,
             s.suggested_by_account_id, a.name AS suggested_by_account_name,
             s.suggested_by_user_id, u.name AS suggested_by_user_name, u.email AS suggested_by_email
      FROM profile_suggestions s
      JOIN tea_profiles p ON p.id = s.profile_id
      JOIN accounts a ON a.id = s.suggested_by_account_id
      LEFT JOIN users u ON u.id = s.suggested_by_user_id
      WHERE p.curated_by_account_id = ?
        ${statusClause}
      ORDER BY s.created_at DESC
    `).bind(...params),
    env.DB.prepare(`
      SELECT f.id, f.suggestion_id, f.field_name, f.current_value, f.proposed_value,
             f.status, f.reject_note, f.decided_at
      FROM profile_suggestion_fields f
      JOIN profile_suggestions s ON s.id = f.suggestion_id
      JOIN tea_profiles p ON p.id = s.profile_id
      WHERE p.curated_by_account_id = ?
        ${statusClause}
      ORDER BY f.created_at ASC
    `).bind(...params),
  ]) as [{ results: any[] }, { results: any[] }];

  const bundles = (bundlesResult.results as any[]).map((b: any) => ({
    ...b,
    fields: (fieldsResult.results as any[]).filter((f: any) => f.suggestion_id === b.id),
  }));

  return json({ suggestions: bundles });
};

// POST /api/suggestions/:id/decide
// Body: { decisions: [{ field_id, status: 'accepted'|'rejected', reject_note? }, ...] }
// Per Decision 3: per-field accept/reject. Accepted fields write to canonical
// IMMEDIATELY (one batch, atomic). The bundle status is recomputed from the
// resulting field statuses: all decided → 'resolved', some pending → 'partial'.
const handleDecideSuggestion: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'catalog');
  if ('error' in ctx) return ctx.error;
  const { accountId, userId, email } = ctx;

  const suggestionId = params.id;
  if (!suggestionId) return json({ error: 'Suggestion id required' }, 400);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const decisions = Array.isArray(body.decisions) ? body.decisions : null;
  if (!decisions || decisions.length === 0) {
    return json({ error: 'decisions[] required' }, 400);
  }

  // Look up the bundle + verify the caller curates the underlying profile
  const bundle = await env.DB.prepare(`
    SELECT s.id, s.profile_id, s.status, p.curated_by_account_id
    FROM profile_suggestions s
    JOIN tea_profiles p ON p.id = s.profile_id
    WHERE s.id = ?
  `).bind(suggestionId).first() as { id: string; profile_id: string; status: string; curated_by_account_id: string } | null;

  if (!bundle) return json({ error: 'Suggestion not found' }, 404);
  if (bundle.curated_by_account_id !== accountId) {
    return json({ error: 'Only the curator of this profile can decide its suggestions.' }, 403);
  }
  if (bundle.status === 'withdrawn' || bundle.status === 'resolved') {
    return json({ error: `Suggestion is ${bundle.status} — no further decisions accepted.` }, 400);
  }

  // Load all field rows for this bundle, by id, so we can validate decisions
  const { results: fieldRows } = await env.DB.prepare(
    `SELECT id, field_name, proposed_value, status FROM profile_suggestion_fields WHERE suggestion_id = ?`
  ).bind(suggestionId).all() as { results: any[] };
  const fieldsById = new Map(fieldRows.map((f: any) => [f.id as string, f]));

  // Validate every decision references a field in this bundle and isn't already decided
  const cleanedDecisions: { field_id: string; status: 'accepted' | 'rejected'; reject_note: string | null; field_name: string; proposed_value: string }[] = [];
  for (const d of decisions) {
    if (typeof d.field_id !== 'string') return json({ error: 'decision.field_id required' }, 400);
    if (d.status !== 'accepted' && d.status !== 'rejected') {
      return json({ error: `decision.status must be 'accepted' or 'rejected' (got '${d.status}')` }, 400);
    }
    const f = fieldsById.get(d.field_id);
    if (!f) return json({ error: `field_id '${d.field_id}' is not part of this suggestion bundle.` }, 400);
    if (f.status !== 'pending') {
      return json({ error: `field_id '${d.field_id}' is already ${f.status}.` }, 400);
    }
    cleanedDecisions.push({
      field_id: d.field_id,
      status: d.status,
      reject_note: typeof d.reject_note === 'string' ? d.reject_note.slice(0, 500) : null,
      field_name: f.field_name as string,
      proposed_value: f.proposed_value as string,
    });
  }

  // Build the batch:
  //   1. UPDATE each decided field row
  //   2. UPDATE tea_profiles.<field_name> for each accepted decision
  //   3. UPDATE the bundle status (recomputed from resulting per-field statuses)
  const stmts: D1PreparedStatement[] = [];
  const now = new Date().toISOString();

  for (const d of cleanedDecisions) {
    stmts.push(
      env.DB.prepare(
        `UPDATE profile_suggestion_fields
         SET status = ?, reject_note = ?, decided_at = ?
         WHERE id = ?`
      ).bind(d.status, d.reject_note, now, d.field_id)
    );
    if (d.status === 'accepted') {
      // Whitelist already enforced at submission; defensive double-check here.
      if (!PROFILE_SUGGESTABLE_FIELDS.has(d.field_name)) continue;
      stmts.push(
        env.DB.prepare(
          `UPDATE tea_profiles SET ${d.field_name} = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(d.proposed_value, bundle.profile_id)
      );
    }
  }

  // Recompute bundle status: any pending → 'partial' (or stays 'pending' if no decisions in this batch),
  // none pending → 'resolved'.
  const decidedIds = new Set(cleanedDecisions.map(d => d.field_id));
  const remainingPending = fieldRows.filter((f: any) => !decidedIds.has(f.id) && f.status === 'pending').length;
  const newBundleStatus = remainingPending === 0 ? 'resolved' : 'partial';

  stmts.push(
    env.DB.prepare(
      `UPDATE profile_suggestions
       SET status = ?, reviewed_by_user_id = ?, reviewed_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(newBundleStatus, userId, now, now, suggestionId)
  );

  await env.DB.batch(stmts);

  await logPlatformAction(
    env, 'suggestion.decided', userId, email,
    'suggestion', suggestionId,
    {
      profile_id: bundle.profile_id,
      decisions: cleanedDecisions.map(d => ({ field_name: d.field_name, status: d.status })),
      bundle_status: newBundleStatus,
    }
  );

  return json({
    suggestion_id: suggestionId,
    bundle_status: newBundleStatus,
    decisions_recorded: cleanedDecisions.length,
  });
};

// ── Wholesale orders (Step 4 — cross-account transactional layer) ───────────
//
// Per docs/NETWORK_ROLLOUT_PLAN.md Step 4 + docs/NETWORK_UI_BRIEF.md Surfaces 8 + 9.
//
// Lifecycle:
//   draft → submitted → confirmed → shipped → received
//         ↓
//      replied (supplier asked for adjustments) → submitted (again)
//      cancelled (terminal, before ship)
//
// Authorization:
//   Buyer-side actions (create, edit draft, submit, mark received):
//     requireBundle('sell') on the buyer account.
//   Supplier-side actions (reply, confirm, ship):
//     requireBundle('sell') on the supplier account.
//   Cancel: either party with Sell bundle on their account.
//   View: anyone with Sell bundle on either account.
//
// Conservative defaults documented earlier in the conversation:
//   - Cancel before ship: simple terminal state, stock unaffected (none was
//     deducted yet — supplier stock decrements only on receive).
//   - Partial fulfillment: explicitly rejected (400) until a future phase.
//   - Buyer's listing on receive: auto-created if missing.
//   - Currency: snapshot at submit, never touched again.
//   - Audit log: every transition.

type WholesaleOrderRow = {
  id: string;
  supplier_account_id: string;
  buyer_account_id: string;
  status: string;
  currency: string;
  subtotal_amount: number | null;
  shipping_amount: number | null;
  total_amount: number | null;
  shipping_address: string | null;
  tracking_number: string | null;
  carrier: string | null;
  buyer_notes: string | null;
  supplier_notes: string | null;
  invoice_id_supplier: string | null;
  invoice_id_buyer: string | null;
  submitted_at: string | null;
  replied_at: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
  cancelled_at: string | null;
  cancelled_by_account_id: string | null;
  cancel_reason: string | null;
  last_nudge_at: string | null;
  nudge_count: number;
  created_at: string;
  updated_at: string;
};

// Helper: load order by id, ensuring caller is buyer or supplier.
// Returns the order row OR an error response (with 404 for not-found and
// 403 if caller's account isn't on either side).
async function loadWholesaleOrder(
  env: Env, orderId: string, callerAccountId: string
): Promise<{ order: WholesaleOrderRow } | { error: Response }> {
  const order = await env.DB.prepare(
    'SELECT * FROM wholesale_orders WHERE id = ?'
  ).bind(orderId).first() as WholesaleOrderRow | null;
  if (!order) return { error: json({ error: 'Wholesale order not found' }, 404) };
  if (order.supplier_account_id !== callerAccountId && order.buyer_account_id !== callerAccountId) {
    return { error: json({ error: 'You are not a party to this order' }, 403) };
  }
  return { order };
}

// Helper: recompute subtotal_amount + total_amount from current line items.
// Called after add/edit/remove items in a draft. Doesn't touch shipping_amount
// (set by supplier on confirm).
async function rebuildOrderTotals(env: Env, orderId: string, currency: string): Promise<{ subtotal: number; total: number }> {
  const sumRow = await env.DB.prepare(
    `SELECT COALESCE(SUM(line_total), 0) AS subtotal
     FROM wholesale_order_items WHERE order_id = ?`
  ).bind(orderId).first() as { subtotal: number };
  const subtotal = Number(sumRow.subtotal || 0);
  // total = subtotal + shipping_amount; we don't know shipping yet so keep
  // total = subtotal until supplier confirms with a freight quote.
  await env.DB.prepare(
    `UPDATE wholesale_orders
     SET subtotal_amount = ?, total_amount = ?, currency = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(subtotal, subtotal, currency, orderId).run();
  return { subtotal, total: subtotal };
}

// POST /api/wholesale/orders
// Body: {
//   supplier_account_id: string,
//   currency: string,
//   shipping_address?: string,
//   buyer_notes?: string,
//   items: [{ supplier_listing_id, grams, unit_price_amount, unit_price_currency }],
// }
// Buyer creates a draft. Items are validated against supplier's listings —
// each must exist, be active, and belong to the supplier account.
const handleCreateWholesaleOrder: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'sell');
  if ('error' in ctx) return ctx.error;
  const { accountId: buyerAccountId, userId, email } = ctx;

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const supplierAccountId = typeof body.supplier_account_id === 'string' ? body.supplier_account_id.trim() : '';
  if (!supplierAccountId) return json({ error: 'supplier_account_id required' }, 400);
  if (supplierAccountId === buyerAccountId) {
    return json({ error: "You can't place a wholesale order with yourself." }, 400);
  }

  const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : '';
  if (!currency) return json({ error: 'currency required' }, 400);

  // Verify supplier exists and isn't suspended
  const supplier = await env.DB.prepare(
    'SELECT id, status FROM accounts WHERE id = ?'
  ).bind(supplierAccountId).first() as { id: string; status: string } | null;
  if (!supplier) return json({ error: 'Supplier account not found' }, 404);
  if (supplier.status === 'suspended') return json({ error: 'Supplier account is suspended.' }, 400);

  // Items optional on create — buyer can add via PUT later — but if provided, validate.
  const items = Array.isArray(body.items) ? body.items : [];
  type ValidatedItem = {
    supplier_listing_id: string;
    profile_id: string;
    grams: number;
    unit_price_amount: number;
    unit_price_currency: string;
    line_total: number;
  };
  const validatedItems: ValidatedItem[] = [];
  for (const it of items) {
    if (typeof it.supplier_listing_id !== 'string') return json({ error: 'item.supplier_listing_id required' }, 400);
    const grams = Number(it.grams);
    const unitPrice = Number(it.unit_price_amount);
    if (!isFinite(grams) || grams <= 0) return json({ error: 'item.grams must be > 0' }, 400);
    if (!isFinite(unitPrice) || unitPrice < 0) return json({ error: 'item.unit_price_amount must be >= 0' }, 400);
    const unitCur = typeof it.unit_price_currency === 'string' ? it.unit_price_currency.trim().toUpperCase() : '';
    if (!unitCur) return json({ error: 'item.unit_price_currency required' }, 400);

    const listing = await env.DB.prepare(
      'SELECT id, account_id, profile_id, status FROM product_listings WHERE id = ?'
    ).bind(it.supplier_listing_id).first() as { id: string; account_id: string; profile_id: string; status: string } | null;
    if (!listing) return json({ error: `item.supplier_listing_id '${it.supplier_listing_id}' not found` }, 404);
    if (listing.account_id !== supplierAccountId) {
      return json({ error: `item.supplier_listing_id '${it.supplier_listing_id}' does not belong to this supplier` }, 400);
    }
    if (listing.status !== 'active') {
      return json({ error: `Supplier listing '${it.supplier_listing_id}' is not active` }, 400);
    }
    validatedItems.push({
      supplier_listing_id: listing.id,
      profile_id: listing.profile_id,
      grams,
      unit_price_amount: unitPrice,
      unit_price_currency: unitCur,
      line_total: grams * unitPrice,
    });
  }

  // Insert order + items in one batch
  const orderId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  const stmts: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO wholesale_orders
         (id, supplier_account_id, buyer_account_id, status, currency,
          shipping_address, buyer_notes)
       VALUES (?, ?, ?, 'draft', ?, ?, ?)`
    ).bind(orderId, supplierAccountId, buyerAccountId, currency,
           typeof body.shipping_address === 'string' ? body.shipping_address : null,
           typeof body.buyer_notes === 'string' ? body.buyer_notes : null),
    ...validatedItems.map(it =>
      env.DB.prepare(
        `INSERT INTO wholesale_order_items
           (id, order_id, supplier_listing_id, profile_id, grams,
            unit_price_amount, unit_price_currency, line_total)
         VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?)`
      ).bind(orderId, it.supplier_listing_id, it.profile_id, it.grams,
             it.unit_price_amount, it.unit_price_currency, it.line_total)
    ),
  ];
  await env.DB.batch(stmts);

  if (validatedItems.length > 0) {
    await rebuildOrderTotals(env, orderId, currency);
  }

  await logPlatformAction(
    env, 'wholesale.created', userId, email, 'wholesale_order', orderId,
    { supplier_account_id: supplierAccountId, currency, item_count: validatedItems.length }
  );

  return json({ order_id: orderId }, 201);
};

// PUT /api/wholesale/orders/:id
// Body: { shipping_address?, buyer_notes?, items? }
// Buyer edits a draft (or replied) order. Supplier may also edit confirmed-state
// fields (carrier, tracking) via the transition endpoint, not here.
// If items[] is provided, it REPLACES all current items (cleaner than per-item
// add/remove for the small ranges we expect, < 30 items per order).
const handleUpdateWholesaleOrder: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'sell');
  if ('error' in ctx) return ctx.error;
  const { accountId, userId, email } = ctx;

  const orderId = params.id;
  if (!orderId) return json({ error: 'Order id required' }, 400);

  const loaded = await loadWholesaleOrder(env, orderId, accountId);
  if ('error' in loaded) return loaded.error;
  const { order } = loaded;

  // Only the buyer can edit, and only in draft or replied state.
  if (order.buyer_account_id !== accountId) {
    return json({ error: 'Only the buyer can edit this order.' }, 403);
  }
  if (order.status !== 'draft' && order.status !== 'replied') {
    return json({ error: `Order is ${order.status} — not editable.` }, 400);
  }

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }

  const stmts: D1PreparedStatement[] = [];
  const updates: string[] = [];
  const binds: any[] = [];

  if (typeof body.shipping_address === 'string' || body.shipping_address === null) {
    updates.push('shipping_address = ?');
    binds.push(body.shipping_address);
  }
  if (typeof body.buyer_notes === 'string' || body.buyer_notes === null) {
    updates.push('buyer_notes = ?');
    binds.push(body.buyer_notes);
  }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    binds.push(orderId);
    stmts.push(env.DB.prepare(
      `UPDATE wholesale_orders SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...binds));
  }

  // Replace items if provided
  let itemsReplaced = false;
  if (Array.isArray(body.items)) {
    itemsReplaced = true;
    if (body.items.length > 30) {
      return json({ error: 'Order limited to 30 items.' }, 400);
    }

    type ValidatedItem = {
      supplier_listing_id: string;
      profile_id: string;
      grams: number;
      unit_price_amount: number;
      unit_price_currency: string;
      line_total: number;
    };
    const validated: ValidatedItem[] = [];
    for (const it of body.items) {
      if (typeof it.supplier_listing_id !== 'string') return json({ error: 'item.supplier_listing_id required' }, 400);
      const grams = Number(it.grams);
      const unitPrice = Number(it.unit_price_amount);
      if (!isFinite(grams) || grams <= 0) return json({ error: 'item.grams must be > 0' }, 400);
      if (!isFinite(unitPrice) || unitPrice < 0) return json({ error: 'item.unit_price_amount must be >= 0' }, 400);
      const unitCur = typeof it.unit_price_currency === 'string' ? it.unit_price_currency.trim().toUpperCase() : '';
      if (!unitCur) return json({ error: 'item.unit_price_currency required' }, 400);

      const listing = await env.DB.prepare(
        'SELECT id, account_id, profile_id, status FROM product_listings WHERE id = ?'
      ).bind(it.supplier_listing_id).first() as { id: string; account_id: string; profile_id: string; status: string } | null;
      if (!listing) return json({ error: `Listing '${it.supplier_listing_id}' not found` }, 404);
      if (listing.account_id !== order.supplier_account_id) {
        return json({ error: `Listing '${it.supplier_listing_id}' is not from this order's supplier` }, 400);
      }
      if (listing.status !== 'active') {
        return json({ error: `Listing '${it.supplier_listing_id}' is not active` }, 400);
      }
      validated.push({
        supplier_listing_id: listing.id,
        profile_id: listing.profile_id,
        grams, unit_price_amount: unitPrice, unit_price_currency: unitCur,
        line_total: grams * unitPrice,
      });
    }

    stmts.push(env.DB.prepare('DELETE FROM wholesale_order_items WHERE order_id = ?').bind(orderId));
    for (const it of validated) {
      stmts.push(env.DB.prepare(
        `INSERT INTO wholesale_order_items
           (id, order_id, supplier_listing_id, profile_id, grams,
            unit_price_amount, unit_price_currency, line_total)
         VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?)`
      ).bind(orderId, it.supplier_listing_id, it.profile_id, it.grams,
             it.unit_price_amount, it.unit_price_currency, it.line_total));
    }
  }

  if (stmts.length === 0) return json({ ok: true });

  await env.DB.batch(stmts);

  if (itemsReplaced) {
    await rebuildOrderTotals(env, orderId, order.currency);
  }

  await logPlatformAction(env, 'wholesale.updated', userId, email,
    'wholesale_order', orderId, { items_replaced: itemsReplaced });

  return json({ ok: true });
};

// POST /api/wholesale/orders/:id/transition
// Body: { to: 'submitted'|'replied'|'confirmed'|'shipped'|'received'|'cancelled',
//         shipping_amount?, tracking_number?, carrier?, supplier_notes?,
//         cancel_reason? }
// Single dispatch endpoint for every status change. Validates the transition
// is legal from the current state and that the caller is the right party,
// then runs the side effects atomically.
const handleTransitionWholesaleOrder: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'sell');
  if ('error' in ctx) return ctx.error;
  const { accountId, userId, email } = ctx;

  const orderId = params.id;
  if (!orderId) return json({ error: 'Order id required' }, 400);

  const loaded = await loadWholesaleOrder(env, orderId, accountId);
  if ('error' in loaded) return loaded.error;
  const { order } = loaded;

  let body: any;
  try { body = await request.json(); } catch { body = {}; }

  const to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
  const validTargets = new Set(['submitted', 'replied', 'confirmed', 'shipped', 'received', 'cancelled']);
  if (!validTargets.has(to)) return json({ error: `to must be one of ${[...validTargets].join(', ')}` }, 400);

  const isBuyer = order.buyer_account_id === accountId;
  const isSupplier = order.supplier_account_id === accountId;
  const now = new Date().toISOString();
  const stmts: D1PreparedStatement[] = [];

  // Validate the transition is legal AND the caller is the right party.
  // Each branch builds the appropriate UPDATE statement.
  if (to === 'submitted') {
    if (!isBuyer) return json({ error: 'Only the buyer can submit.' }, 403);
    if (order.status !== 'draft' && order.status !== 'replied') {
      return json({ error: `Cannot submit from ${order.status}.` }, 400);
    }
    // Refuse to submit an empty order
    const itemCount = await env.DB.prepare(
      'SELECT COUNT(*) AS c FROM wholesale_order_items WHERE order_id = ?'
    ).bind(orderId).first() as { c: number };
    if (!itemCount || itemCount.c === 0) {
      return json({ error: 'Cannot submit an empty order.' }, 400);
    }
    if (!order.shipping_address) {
      return json({ error: 'Cannot submit without a shipping address.' }, 400);
    }
    stmts.push(env.DB.prepare(
      `UPDATE wholesale_orders SET status = 'submitted', submitted_at = ?, updated_at = ? WHERE id = ?`
    ).bind(now, now, orderId));
  }
  else if (to === 'replied') {
    if (!isSupplier) return json({ error: 'Only the supplier can reply with adjustments.' }, 403);
    if (order.status !== 'submitted') {
      return json({ error: `Cannot reply from ${order.status}.` }, 400);
    }
    const supplierNotes = typeof body.supplier_notes === 'string' ? body.supplier_notes : null;
    stmts.push(env.DB.prepare(
      `UPDATE wholesale_orders SET status = 'replied', replied_at = ?, supplier_notes = ?, updated_at = ? WHERE id = ?`
    ).bind(now, supplierNotes, now, orderId));
  }
  else if (to === 'confirmed') {
    if (!isSupplier) return json({ error: 'Only the supplier can confirm.' }, 403);
    if (order.status !== 'submitted') {
      return json({ error: `Cannot confirm from ${order.status}.` }, 400);
    }
    const shippingAmount = body.shipping_amount !== undefined ? Number(body.shipping_amount) : 0;
    if (!isFinite(shippingAmount) || shippingAmount < 0) {
      return json({ error: 'shipping_amount must be a number >= 0' }, 400);
    }
    const supplierNotes = typeof body.supplier_notes === 'string' ? body.supplier_notes : null;
    const newTotal = (order.subtotal_amount || 0) + shippingAmount;
    stmts.push(env.DB.prepare(
      `UPDATE wholesale_orders
       SET status = 'confirmed', confirmed_at = ?,
           shipping_amount = ?, total_amount = ?,
           supplier_notes = COALESCE(?, supplier_notes),
           updated_at = ?
       WHERE id = ?`
    ).bind(now, shippingAmount, newTotal, supplierNotes, now, orderId));
  }
  else if (to === 'shipped') {
    if (!isSupplier) return json({ error: 'Only the supplier can mark shipped.' }, 403);
    if (order.status !== 'confirmed') {
      return json({ error: `Cannot ship from ${order.status}.` }, 400);
    }
    const tracking = typeof body.tracking_number === 'string' ? body.tracking_number.trim() : '';
    const carrier = typeof body.carrier === 'string' ? body.carrier.trim() : '';
    if (!tracking) return json({ error: 'tracking_number required' }, 400);
    if (!carrier) return json({ error: 'carrier required' }, 400);
    stmts.push(env.DB.prepare(
      `UPDATE wholesale_orders
       SET status = 'shipped', shipped_at = ?,
           tracking_number = ?, carrier = ?, updated_at = ?
       WHERE id = ?`
    ).bind(now, tracking, carrier, now, orderId));
  }
  else if (to === 'received') {
    if (!isBuyer) return json({ error: 'Only the buyer can mark received.' }, 403);
    if (order.status !== 'shipped') {
      return json({ error: `Cannot receive from ${order.status}.` }, 400);
    }
    // Side effects fire — see processReceiveSideEffects below.
    const sideEffectStmts = await processReceiveSideEffects(env, order, userId);
    stmts.push(...sideEffectStmts);
    stmts.push(env.DB.prepare(
      `UPDATE wholesale_orders
       SET status = 'received', received_at = ?, updated_at = ?
       WHERE id = ?`
    ).bind(now, now, orderId));
  }
  else if (to === 'cancelled') {
    // Either party can cancel before ship.
    if (!isBuyer && !isSupplier) return json({ error: 'Forbidden' }, 403);
    if (order.status === 'shipped' || order.status === 'received' || order.status === 'cancelled') {
      return json({ error: `Cannot cancel an order that is ${order.status}.` }, 400);
    }
    const reason = typeof body.cancel_reason === 'string' ? body.cancel_reason : null;
    stmts.push(env.DB.prepare(
      `UPDATE wholesale_orders
       SET status = 'cancelled', cancelled_at = ?, cancelled_by_account_id = ?,
           cancel_reason = ?, updated_at = ?
       WHERE id = ?`
    ).bind(now, accountId, reason, now, orderId));
  }

  await env.DB.batch(stmts);

  await logPlatformAction(env, `wholesale.${to}`, userId, email,
    'wholesale_order', orderId,
    { from: order.status, to, by_account: accountId });

  return json({ ok: true, status: to });
};

// Receive side effects:
//   1. Decrement supplier's listing stock for each line item
//   2. For each line item, find buyer's listing for the same profile
//      (or create one) and increment its stock
//   3. Generate two invoice rows (one per account)
//
// All in one batch so it commits atomically.
async function processReceiveSideEffects(
  env: Env, order: WholesaleOrderRow, _actorUserId: string
): Promise<D1PreparedStatement[]> {
  const items = await env.DB.prepare(
    `SELECT id, supplier_listing_id, profile_id, grams, unit_price_amount, unit_price_currency, line_total
     FROM wholesale_order_items WHERE order_id = ?`
  ).bind(order.id).all();

  const stmts: D1PreparedStatement[] = [];

  for (const item of items.results as any[]) {
    const grams = Number(item.grams);

    // 1. Decrement supplier listing stock (also mirror to legacy products table
    //    via the deterministic listing→product id mapping if it exists).
    stmts.push(env.DB.prepare(
      `UPDATE product_listings
       SET stock_grams = MAX(0, COALESCE(stock_grams, 0) - ?), updated_at = datetime('now')
       WHERE id = ?`
    ).bind(grams, item.supplier_listing_id));
    // Mirror to legacy products: listing id is 'list_<product_id>' (per migration 048
    // deterministic shape), so the product id is the suffix after 'list_'. Carry-created
    // listings (no legacy product) won't match — that's fine, the UPDATE just no-ops.
    const legacyProductId = (item.supplier_listing_id as string).startsWith('list_')
      ? (item.supplier_listing_id as string).slice(5)
      : null;
    if (legacyProductId) {
      stmts.push(env.DB.prepare(
        `UPDATE products SET stock_grams = MAX(0, COALESCE(stock_grams, 0) - ?), updated_at = datetime('now')
         WHERE id = ? AND account_id = ?`
      ).bind(grams, legacyProductId, order.supplier_account_id));
    }

    // 2. Find buyer's listing for this profile, or create one.
    const buyerListing = await env.DB.prepare(
      `SELECT id FROM product_listings WHERE account_id = ? AND profile_id = ?`
    ).bind(order.buyer_account_id, item.profile_id).first() as { id: string } | null;

    let buyerListingId: string;
    if (buyerListing) {
      buyerListingId = buyerListing.id;
      stmts.push(env.DB.prepare(
        `UPDATE product_listings
         SET stock_grams = COALESCE(stock_grams, 0) + ?, updated_at = datetime('now'),
             status = CASE WHEN status = 'archived' THEN 'active' ELSE status END
         WHERE id = ?`
      ).bind(grams, buyerListingId));
    } else {
      // Auto-create a new listing for the buyer. Defaults: status=active, is_public=1.
      // No price set — buyer will refine on the listing edit page.
      buyerListingId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
      stmts.push(env.DB.prepare(
        `INSERT INTO product_listings
           (id, account_id, profile_id, stock_grams, listing_photos, status, is_public)
         VALUES (?, ?, ?, ?, '[]', 'active', 1)`
      ).bind(buyerListingId, order.buyer_account_id, item.profile_id, grams));
    }
    // Link the order item to whichever buyer listing now holds the stock
    stmts.push(env.DB.prepare(
      `UPDATE wholesale_order_items SET buyer_listing_id = ? WHERE id = ?`
    ).bind(buyerListingId, item.id));
  }

  // 3. Generate bilateral invoices.
  // Supplier's outgoing invoice (account = supplier; customer = buyer account name)
  // Buyer's incoming invoice (account = buyer; customer = supplier account name)
  // Both reference the wholesale_order via `notes` for audit traceability.
  const supplierAccount = await env.DB.prepare(
    'SELECT name, invoice_prefix FROM accounts WHERE id = ?'
  ).bind(order.supplier_account_id).first() as { name: string; invoice_prefix: string | null };
  const buyerAccount = await env.DB.prepare(
    'SELECT name, invoice_prefix FROM accounts WHERE id = ?'
  ).bind(order.buyer_account_id).first() as { name: string; invoice_prefix: string | null };

  const supplierInvoiceId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  const buyerInvoiceId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
  const supplierPrefix = supplierAccount?.invoice_prefix || 'WS';
  const buyerPrefix = buyerAccount?.invoice_prefix || 'WS';
  const orderShortId = order.id.slice(0, 8).toUpperCase();

  stmts.push(env.DB.prepare(
    `INSERT INTO invoices (account_id, id, invoice_number, customer_name, display_currency, status, notes)
     VALUES (?, ?, ?, ?, ?, 'Paid', ?)`
  ).bind(
    order.supplier_account_id, supplierInvoiceId,
    `${supplierPrefix}-WS-${orderShortId}`,
    buyerAccount?.name || 'Wholesale buyer',
    order.currency,
    `Wholesale order ${order.id}. See wholesale_orders table.`
  ));
  stmts.push(env.DB.prepare(
    `INSERT INTO invoices (account_id, id, invoice_number, customer_name, display_currency, status, notes)
     VALUES (?, ?, ?, ?, ?, 'Paid', ?)`
  ).bind(
    order.buyer_account_id, buyerInvoiceId,
    `${buyerPrefix}-WS-${orderShortId}`,
    supplierAccount?.name || 'Wholesale supplier',
    order.currency,
    `Wholesale order ${order.id}. See wholesale_orders table.`
  ));

  // Persist the invoice ids back onto the order
  stmts.push(env.DB.prepare(
    `UPDATE wholesale_orders SET invoice_id_supplier = ?, invoice_id_buyer = ? WHERE id = ?`
  ).bind(supplierInvoiceId, buyerInvoiceId, order.id));

  return stmts;
}

// POST /api/wholesale/orders/:id/nudge
// Per Surface 9: gentle reminder buyer can send when supplier sits on a
// submitted order. Throttled — last_nudge_at must be at least 24 hours ago.
const handleNudgeWholesaleOrder: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'sell');
  if ('error' in ctx) return ctx.error;
  const { accountId, userId, email } = ctx;

  const orderId = params.id;
  if (!orderId) return json({ error: 'Order id required' }, 400);

  const loaded = await loadWholesaleOrder(env, orderId, accountId);
  if ('error' in loaded) return loaded.error;
  const { order } = loaded;

  if (order.buyer_account_id !== accountId) {
    return json({ error: 'Only the buyer can nudge.' }, 403);
  }
  if (order.status !== 'submitted' && order.status !== 'confirmed') {
    return json({ error: `Cannot nudge an order that is ${order.status}.` }, 400);
  }
  if (order.last_nudge_at) {
    const last = new Date(order.last_nudge_at).getTime();
    const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
    if (last > dayAgo) {
      return json({ error: 'Already nudged in the last 24 hours.' }, 429);
    }
  }

  await env.DB.prepare(
    `UPDATE wholesale_orders
     SET last_nudge_at = datetime('now'), nudge_count = nudge_count + 1, updated_at = datetime('now')
     WHERE id = ?`
  ).bind(orderId).run();

  await logPlatformAction(env, 'wholesale.nudged', userId, email,
    'wholesale_order', orderId, { status: order.status });

  return json({ ok: true });
};

// GET /api/wholesale/orders
// Query params:
//   role=buyer|supplier (default: returns orders where caller is on either side)
//   status=draft|submitted|... (optional filter)
// Returns the list of orders with item counts (not full items).
const handleListWholesaleOrders: Handler = async (request, env) => {
  const ctx = await requireBundle(request, env, 'sell');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const url = new URL(request.url);
  const role = url.searchParams.get('role');
  const statusFilter = url.searchParams.get('status');

  let where: string;
  const binds: any[] = [];
  if (role === 'buyer') { where = 'buyer_account_id = ?'; binds.push(accountId); }
  else if (role === 'supplier') { where = 'supplier_account_id = ?'; binds.push(accountId); }
  else { where = '(buyer_account_id = ? OR supplier_account_id = ?)'; binds.push(accountId, accountId); }
  if (statusFilter) { where += ' AND status = ?'; binds.push(statusFilter); }

  const { results } = await env.DB.prepare(`
    SELECT o.*,
           sa.name AS supplier_name, sa.slug AS supplier_slug,
           ba.name AS buyer_name, ba.slug AS buyer_slug,
           (SELECT COUNT(*) FROM wholesale_order_items WHERE order_id = o.id) AS item_count
    FROM wholesale_orders o
    LEFT JOIN accounts sa ON sa.id = o.supplier_account_id
    LEFT JOIN accounts ba ON ba.id = o.buyer_account_id
    WHERE ${where}
    ORDER BY o.updated_at DESC
  `).bind(...binds).all();

  return json({ orders: results });
};

// GET /api/wholesale/orders/:id
// Detail view including all items joined to profile names for display.
const handleGetWholesaleOrder: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'sell');
  if ('error' in ctx) return ctx.error;
  const { accountId } = ctx;

  const orderId = params.id;
  if (!orderId) return json({ error: 'Order id required' }, 400);

  const loaded = await loadWholesaleOrder(env, orderId, accountId);
  if ('error' in loaded) return loaded.error;
  const { order } = loaded;

  const [supplierAccount, buyerAccount, itemsResult] = await Promise.all([
    env.DB.prepare('SELECT id, name, slug, currency_default FROM accounts WHERE id = ?').bind(order.supplier_account_id).first(),
    env.DB.prepare('SELECT id, name, slug, currency_default FROM accounts WHERE id = ?').bind(order.buyer_account_id).first(),
    env.DB.prepare(`
      SELECT i.*, p.name AS profile_name, p.slug AS profile_slug, p.image_url AS profile_image
      FROM wholesale_order_items i
      LEFT JOIN tea_profiles p ON p.id = i.profile_id
      WHERE i.order_id = ?
      ORDER BY i.created_at ASC
    `).bind(orderId).all(),
  ]);

  return json({
    order,
    supplier: supplierAccount,
    buyer: buyerAccount,
    items: (itemsResult as any).results,
  });
};

// ── Network adoption queue (Step 6 — cross-pollination) ────────────────────
//
// Per docs/NETWORK_ROLLOUT_PLAN.md Step 6:
// A partner who originates a tea profile (one Adrian doesn't yet curate) can
// flag it as a candidate for network-wide adoption. Adrian (or another platform
// tier user) reviews and either adopts (transferring curated_by_account_id to
// the platform account, making the profile visible to all partners' catalog
// browse) or declines.
//
// Three endpoints:
//   POST /api/network/profiles/:id/suggest-for-network  — partner flags own profile (Catalog)
//   GET  /api/network/adoption-queue                    — Adrian's review queue (Platform tier)
//   POST /api/network/profiles/:id/adopt                — adopt or decline (Platform tier)

// POST /api/network/profiles/:id/suggest-for-network
// Body: { note?: string }
// Partner flags a profile they originated. Refuses if:
//   - profile is already curated by the platform account (already-canonical)
//   - profile already has a pending suggestion
//   - caller is not the originator
const handleSuggestProfileForNetwork: Handler = async (request, env, params) => {
  const ctx = await requireBundle(request, env, 'catalog');
  if ('error' in ctx) return ctx.error;
  const { accountId, userId, email } = ctx;

  const profileId = params.id;
  if (!profileId) return json({ error: 'Profile id required' }, 400);

  let body: any;
  try { body = await request.json(); } catch { body = {}; }
  const note = typeof body.note === 'string' ? body.note.slice(0, 1000) : null;

  // Look up the profile and its current curator account
  const profile = await env.DB.prepare(
    `SELECT p.id, p.name, p.originated_by_account_id, p.curated_by_account_id,
            p.adoption_decision, a.kind AS curator_kind
     FROM tea_profiles p
     LEFT JOIN accounts a ON a.id = p.curated_by_account_id
     WHERE p.id = ?`
  ).bind(profileId).first() as {
    id: string; name: string;
    originated_by_account_id: string;
    curated_by_account_id: string;
    adoption_decision: string | null;
    curator_kind: string | null;
  } | null;

  if (!profile) return json({ error: 'Profile not found' }, 404);
  if (profile.originated_by_account_id !== accountId) {
    return json({ error: "You can only suggest profiles you originated." }, 403);
  }
  if (profile.curator_kind === 'platform') {
    return json({ error: "This profile is already curated by Teajia." }, 400);
  }
  if (profile.adoption_decision === 'pending') {
    return json({ error: "This profile is already pending adoption review." }, 409);
  }

  // Note: a profile that was previously declined CAN be re-suggested. The
  // adoption_decision overwrites — Adrian sees a fresh pending entry.
  await env.DB.prepare(
    `UPDATE tea_profiles
     SET suggested_for_network_at = datetime('now'),
         suggested_for_network_by_user_id = ?,
         suggested_for_network_note = ?,
         adoption_decision = 'pending',
         adoption_decided_at = NULL,
         adoption_decided_by_user_id = NULL,
         adoption_decline_note = NULL,
         updated_at = datetime('now')
     WHERE id = ?`
  ).bind(userId, note, profileId).run();

  await logPlatformAction(
    env, 'profile.suggested_for_network', userId, email,
    'tea_profile', profileId,
    { profile_name: profile.name, originator_account_id: accountId, note }
  );

  return json({ ok: true }, 201);
};

// GET /api/network/adoption-queue?status=pending|adopted|declined
// Platform tier only. Lists profiles that have been flagged.
// Default filter: status=pending (Adrian's actionable queue).
const handleAdoptionQueue: Handler = async (request, env) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get('status') || 'pending';
  if (!['pending', 'adopted', 'declined'].includes(statusFilter)) {
    return json({ error: "status must be 'pending', 'adopted', or 'declined'" }, 400);
  }

  const { results } = await env.DB.prepare(`
    SELECT
      p.id, p.slug, p.name, p.chinese_name,
      p.type, p.form, p.origin_country, p.origin_region,
      p.varietal, p.harvest_year, p.description, p.image_url,
      p.suggested_for_network_at, p.suggested_for_network_note,
      p.adoption_decision, p.adoption_decided_at, p.adoption_decline_note,
      p.originated_by_account_id,
      ao.name AS originator_account_name,
      ao.slug AS originator_account_slug,
      p.suggested_for_network_by_user_id,
      u.name AS suggested_by_user_name,
      u.email AS suggested_by_user_email
    FROM tea_profiles p
    JOIN accounts ao ON ao.id = p.originated_by_account_id
    LEFT JOIN users u ON u.id = p.suggested_for_network_by_user_id
    WHERE p.adoption_decision = ?
    ORDER BY p.suggested_for_network_at DESC
  `).bind(statusFilter).all();

  return json({ profiles: results });
};

// POST /api/network/profiles/:id/adopt
// Body: { decision: 'adopted'|'declined', decline_note?: string }
// Platform tier only. On 'adopted': transfers curated_by_account_id to the
// platform account, audits, the profile becomes visible in every partner's
// catalog browse. On 'declined': records the decision + note, originator
// stays as curator.
const handleAdoptProfile: Handler = async (request, env, params) => {
  const authErr = await requirePlatformAdmin(request, env);
  if (authErr) return authErr;

  const claims = parseToken(isAuthed(request)!)!;

  const profileId = params.id;
  if (!profileId) return json({ error: 'Profile id required' }, 400);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Invalid JSON body' }, 400); }
  const decision = body.decision;
  if (decision !== 'adopted' && decision !== 'declined') {
    return json({ error: "decision must be 'adopted' or 'declined'" }, 400);
  }
  const declineNote = decision === 'declined' && typeof body.decline_note === 'string'
    ? body.decline_note.slice(0, 1000)
    : null;

  const profile = await env.DB.prepare(
    `SELECT id, name, adoption_decision, originated_by_account_id, curated_by_account_id
     FROM tea_profiles WHERE id = ?`
  ).bind(profileId).first() as {
    id: string; name: string;
    adoption_decision: string | null;
    originated_by_account_id: string;
    curated_by_account_id: string;
  } | null;

  if (!profile) return json({ error: 'Profile not found' }, 404);
  if (profile.adoption_decision !== 'pending') {
    return json({ error: `Profile is not pending adoption (status: ${profile.adoption_decision || 'never suggested'}).` }, 400);
  }

  // Find the platform account for the curator transfer.
  // Adrian's account has kind='platform'; there should be exactly one.
  const platformAccount = await env.DB.prepare(
    "SELECT id FROM accounts WHERE kind = 'platform' LIMIT 1"
  ).first() as { id: string } | null;
  if (!platformAccount) {
    return json({ error: 'Platform account not found — cannot adopt.' }, 500);
  }

  const now = new Date().toISOString();
  const stmts: D1PreparedStatement[] = [];

  if (decision === 'adopted') {
    // Transfer curation to the platform account. Originator stays unchanged
    // (it's immutable lineage per Decision 10).
    stmts.push(env.DB.prepare(
      `UPDATE tea_profiles
       SET curated_by_account_id = ?,
           adoption_decision = 'adopted',
           adoption_decided_at = ?,
           adoption_decided_by_user_id = ?,
           adoption_decline_note = NULL,
           network_visible = 1,
           status = 'published',
           updated_at = datetime('now')
       WHERE id = ?`
    ).bind(platformAccount.id, now, claims.sub, profileId));
  } else {
    // Decline: record decision + note. Curator unchanged.
    stmts.push(env.DB.prepare(
      `UPDATE tea_profiles
       SET adoption_decision = 'declined',
           adoption_decided_at = ?,
           adoption_decided_by_user_id = ?,
           adoption_decline_note = ?,
           updated_at = datetime('now')
       WHERE id = ?`
    ).bind(now, claims.sub, declineNote, profileId));
  }

  await env.DB.batch(stmts);

  // Resolve applicant correlation for the audit row. Closes Finding #37.
  // The originating account's contact_email is the applicant. We additionally
  // look up the most recent approved account_application for that email so
  // reviewers can jump from the audit log back to the original onboarding
  // record. Both fields are best-effort — older accounts may have no
  // application row, in which case application_id is null.
  let applicantEmail: string | null = null;
  let applicationId: string | null = null;
  let originatorTrustTier: string | null = null;
  try {
    const originator = await env.DB.prepare(
      `SELECT contact_email, trust_tier FROM accounts WHERE id = ?`
    ).bind(profile.originated_by_account_id).first() as
      { contact_email: string | null; trust_tier: string | null } | null;
    applicantEmail = originator?.contact_email ?? null;
    originatorTrustTier = originator?.trust_tier ?? null;
    if (applicantEmail) {
      const app = await env.DB.prepare(
        `SELECT id FROM account_applications
          WHERE lower(applicant_email) = lower(?) AND status = 'approved'
          ORDER BY decided_at DESC LIMIT 1`
      ).bind(applicantEmail).first() as { id: string } | null;
      applicationId = app?.id ?? null;
    }
  } catch {
    // Non-fatal — audit logging must not block the decision.
  }

  await logPlatformAction(
    env, `profile.adoption_${decision}`, claims.sub, claims.email,
    'tea_profile', profileId,
    {
      decision,
      profile_name: profile.name,
      originator_account_id: profile.originated_by_account_id,
      applicant_email: applicantEmail,
      application_id: applicationId,
      trust_tier: originatorTrustTier,
      previous_curator_id: profile.curated_by_account_id,
      new_curator_id: decision === 'adopted' ? platformAccount.id : profile.curated_by_account_id,
      decline_note: declineNote,
    }
  );

  return json({ ok: true, decision });
};

// ── Routes ──
const routes: [string, string, Handler][] = [
  // Auth
  ['POST', '/api/auth/login', handleLogin],
  ['POST', '/api/auth/signup', handleSignup],
  ['POST', '/api/auth/refresh', handleRefreshToken],
  ['GET', '/api/auth/me', handleGetMe],
  ['PUT', '/api/auth/change-password', handleChangePassword],
  ['POST', '/api/auth/verify-password', handleVerifyPassword],
  ['DELETE', '/api/auth/account', handleDeleteAccount],
  ['PUT', '/api/auth/profile', handleUpdateProfile],
  ['POST', '/api/auth/request-admin', handleRequestAdmin],
  ['POST', '/api/auth/forgot-password', handleForgotPassword],
  ['POST', '/api/auth/reset-password', handleResetPassword],
  ['GET', '/api/auth/google', handleGoogleAuth],
  ['GET', '/api/auth/google/callback', handleGoogleCallback],

  // Accounts / Multi-store
  ['GET', '/api/accounts/me', handleGetAccountsMe],
  ['POST', '/api/accounts/switch', handleSwitchAccount],
  ['GET', '/api/accounts/:id', handleGetAccount],
  ['PUT', '/api/accounts/:id', handleUpdateAccount],
  ['GET', '/api/accounts/:id/features', handleGetAccountFeatures],
  ['GET', '/api/accounts/:id/members', handleGetAccountMembers],
  ['POST', '/api/accounts/:id/members', handleInviteAccountMember],
  ['PUT', '/api/accounts/:id/members/:userId', handleUpdateAccountMember],
  ['DELETE', '/api/accounts/:id/members/:userId', handleDeleteAccountMember],
  ['GET', '/api/accounts/:id/access', handleGetAccountAccess],
  ['GET', '/api/accounts/:id/activity', handleGetAccountActivity],
  ['PUT', '/api/accounts/:id/members/:userId/bundles', handleUpdateMemberBundles],

  // Platform admin
  ['GET',  '/api/platform/users', handlePlatformListUsers],
  ['PUT',  '/api/platform/users/:id/platform-role', handlePlatformSetUserRole],
  ['POST', '/api/platform/users/:id/resend-invite', handlePlatformResendInvite],
  ['GET',  '/api/platform/accounts', handlePlatformListAccounts],
  ['POST', '/api/platform/accounts', handlePlatformCreateAccount],
  ['PUT',  '/api/platform/accounts/:id/status', handlePlatformSetAccountStatus],
  ['POST', '/api/platform/accounts/:id/suspend', handlePlatformSuspendAccount],
  ['POST', '/api/platform/accounts/:id/reactivate', handlePlatformReactivateAccount],
  ['PUT',  '/api/platform/accounts/:id/trust-tier', handlePlatformSetTrustTier],
  ['PUT',  '/api/platform/accounts/:id/features/:feature', handlePlatformToggleFeature],
  ['GET',  '/api/platform/audit-log', handlePlatformAuditLog],
  ['GET',  '/api/platform/applications', handlePlatformListApplications],
  ['POST', '/api/platform/applications/:id/decide', handlePlatformDecideApplication],
  ['POST', '/api/platform/tea-masters/invite', handlePlatformInviteTeaMaster],
  ['POST', '/api/platform/accounts/:id/upgrade-to-location', handlePlatformUpgradeToLocation],
  // Account member management
  ['PUT',  '/api/accounts/:id/members/:userId/permissions', handleUpdateMemberPermissions],
  ['PUT',  '/api/accounts/:id/members/:userId/curator', handleSetCuratorFlag],
  ['POST', '/api/accounts/:id/transfer-ownership', handleTransferOwnership],

  // Network (public)
  ['GET', '/api/network/stores', handleGetNetworkStores],

  // ── Network (authenticated — partner/catalog) ──
  ['GET',  '/api/network/catalog', handleNetworkCatalog],
  ['GET',  '/api/listings/:id',    handleGetListing],
  ['PUT',  '/api/listings/:id',    handleUpdateListing],
  ['POST', '/api/listings/carry',  handleCarryListing],
  ['POST', '/api/profiles/:id/suggestions', handleCreateProfileSuggestion],
  ['GET',  '/api/profiles/:id/suggestions', handleListProfileSuggestions],
  ['GET',  '/api/suggestions/incoming', handleIncomingSuggestions],
  ['POST', '/api/suggestions/:id/decide', handleDecideSuggestion],

  // ── Wholesale orders (Step 4) ──
  ['POST', '/api/wholesale/orders', handleCreateWholesaleOrder],
  ['GET',  '/api/wholesale/orders', handleListWholesaleOrders],
  ['GET',  '/api/wholesale/orders/:id', handleGetWholesaleOrder],
  ['PUT',  '/api/wholesale/orders/:id', handleUpdateWholesaleOrder],
  ['POST', '/api/wholesale/orders/:id/transition', handleTransitionWholesaleOrder],
  ['POST', '/api/wholesale/orders/:id/nudge', handleNudgeWholesaleOrder],

  // ── Network adoption (Step 6) ──
  ['POST', '/api/network/profiles/:id/suggest-for-network', handleSuggestProfileForNetwork],
  ['GET',  '/api/network/adoption-queue', handleAdoptionQueue],
  ['POST', '/api/network/profiles/:id/adopt', handleAdoptProfile],

  ['GET', '/api/s/:slug', handleGetPublicAccount],
  ['GET', '/api/s/:slug/products', handleGetPublicAccountProducts],
  ['GET', '/api/s/:slug/events', handleGetPublicAccountEvents],

  // Public xref (Magazine / Learn / Consult colophons)
  // No-auth reads of article/module/project → product links, scoped to the
  // platform-owner (Bali) account and returning PUBLIC_FIELDS only.
  ['GET', '/api/public/xref/articles/:id/products', makePublicXrefHandler('article_products', 'article_id')],
  ['GET', '/api/public/xref/modules/:id/products', makePublicXrefHandler('module_products', 'module_id')],
  ['GET', '/api/public/xref/projects/:id/products', makePublicXrefHandler('project_products', 'project_id')],

  // User Management (admin/owner)
  ['GET', '/api/admin/users', handleListUsers],
  ['PUT', '/api/admin/users/:id/role', handleUpdateUserRole],
  ['DELETE', '/api/admin/users/:id', handleDeleteUser],
  ['POST', '/api/admin/reset-token', handleCreateResetToken],

  // Public — venues/spaces
  ['GET', '/api/venues/public', handleGetPublicVenues],

  // Products
  ['GET', '/api/products/public', handleGetPublicProducts],
  ['GET', '/api/products', handleGetProducts],
  ['POST', '/api/products', handleCreateProduct],
  ['POST', '/api/products/bulk', handleBulkCreateProducts],
  ['PUT', '/api/products/:id', handleUpdateProduct],
  ['DELETE', '/api/products/:id', handleDeleteProduct],
  ['POST', '/api/products/:id/featured', handleSetProductFeatured],
  ['GET', '/api/products/:id/events', handleGetProductEvents],

  // Wholesale Catalog
  ['GET', '/api/catalog', handleGetCatalog],

  // Exchange Rates
  ['GET', '/api/rates', handleGetRates],

  // Exchange Rates: Platform admin CRUD
  ['GET',    '/api/platform/exchange-rates', handlePlatformListExchangeRates],
  ['POST',   '/api/platform/exchange-rates', handlePlatformCreateExchangeRate],
  ['PUT',    '/api/platform/exchange-rates/:currency', handlePlatformUpdateExchangeRate],
  ['DELETE', '/api/platform/exchange-rates/:currency', handlePlatformDeleteExchangeRate],

  // Invoices
  ['GET', '/api/invoices', handleGetInvoices],
  ['POST', '/api/invoices', handleCreateInvoice],
  ['GET', '/api/invoices/:id/items', handleGetInvoiceItems],
  ['PUT', '/api/invoices/:id', handleUpdateInvoice],
  ['DELETE', '/api/invoices/:id', handleDeleteInvoice],

  // Analytics
  ['GET', '/api/analytics/revenue', handleGetRevenueAnalytics],
  ['GET', '/api/customers/rfm', handleGetCustomerRFM],

  // Customers
  ['GET', '/api/customers', handleGetCustomers],
  ['GET', '/api/customers/:id', handleGetCustomer],
  ['POST', '/api/customers', handleCreateCustomer],
  ['PUT', '/api/customers/:id', handleUpdateCustomer],
  ['DELETE', '/api/customers/:id', handleDeleteCustomer],
  ['GET', '/api/customers/:id/orders', handleGetCustomerOrders],
  ['GET', '/api/customers/:id/teas', handleGetCustomerTeas],
  ['GET', '/api/customers/:id/events', handleGetCustomerEvents],
  ['GET', '/api/customers/:id/products', handleGetVendorProducts],
  ['POST', '/api/customers/:id/products', handleLinkVendorProduct],
  ['DELETE', '/api/customers/:id/products/:productId', handleUnlinkVendorProduct],
  ['GET',    '/api/customers/:id/tags', handleListCustomerTags],
  ['POST',   '/api/customers/:id/tags', handleAddCustomerTag],
  ['DELETE', '/api/customers/:id/tags/:tag', handleRemoveCustomerTag],
  ['GET',    '/api/customer-tags', handleListAccountCustomerTags],
  ['GET',    '/api/customer-tags/:tag/customers', handleListCustomersByTag],
  ['PUT',    '/api/customer-tags/:tag', handleRenameOrDeleteCustomerTag],
  ['GET',    '/api/collection-publications/recent-recipients', handleRecentRecipients],

  // Collections (Phase 1: Person audience; Phase 2: Store audience; Phase 3: Shop audience)
  ['GET',    '/api/collections', handleListCollections],
  ['POST',   '/api/collections', handleCreateCollection],
  ['GET',    '/api/collections/needs-attention', handleNeedsAttention],
  ['GET',    '/api/collections/inbound', handleListInboundCollections],
  ['GET',    '/api/collections/inbound/:pubId', handleGetInboundCollection],
  ['POST',   '/api/collections/inbound/:pubId/import', handleImportInboundItems],
  // Public shop index (no auth) — must be before /:id to avoid :id matching 'shop'.
  ['GET',    '/api/collections/shop', handleGetShopCollections],
  ['GET',    '/api/collections/:id', handleGetCollection],
  ['PUT',    '/api/collections/:id', handlePatchCollection],
  ['POST',   '/api/collections/:id/items', handleAddCollectionItems],
  ['PUT',    '/api/collections/:id/items/:itemId', handlePatchCollectionItem],
  ['DELETE', '/api/collections/:id/items/:itemId', handleRemoveCollectionItem],
  ['POST',   '/api/collections/:id/publications', handlePublishCollection],
  ['DELETE', '/api/collections/:id/publications/:pubId', handleUnpublish],
  ['POST',   '/api/collections/:id/publish-shop', handlePublishToShop],
  ['POST',   '/api/collections/:id/unpublish-shop', handleUnpublishFromShop],

  // Public collection pages — no auth, link-gated by slug.
  ['GET',  '/api/public/c/:slug', handleGetPublicCollection],
  ['POST', '/api/public/c/:slug/view', handlePublicCollectionView],

  // Invoices — edit items
  ['PUT', '/api/invoices/:id/items', handleUpdateInvoiceItems],

  // RPC
  ['POST', '/api/rpc/fulfill-invoice', handleFulfillInvoice],
  ['POST', '/api/rpc/void-invoice', handleVoidInvoice],
  ['POST', '/api/rpc/split-invoice', handleSplitInvoice],
  ['POST', '/api/rpc/link-line-item', handleLinkLineItem],
  ['POST', '/api/rpc/increment-stock', handleIncrementStock],
  ['POST', '/api/rpc/truncate-all', handleTruncateAll],
  ['POST', '/api/rpc/backfill-customer-links', handleBackfillCustomerLinks],
  ['POST', '/api/rpc/auto-link-vendors', handleAutoLinkVendors],
  ['POST', '/api/rpc/reset-stock-verification', handleResetStockVerification],
  ['POST', '/api/rpc/reserve-stock', handleReserveStock],
  ['POST', '/api/rpc/release-stock', handleReleaseStock],
  ['GET', '/api/stock/available', handleGetAvailableStock],

  // Purchase Orders
  ['GET', '/api/purchase-orders', handleListPurchaseOrders],
  ['POST', '/api/purchase-orders', handleCreatePurchaseOrder],
  ['PUT', '/api/purchase-orders/:id', handleUpdatePurchaseOrder],

  // Activity Logs & Stock Ledger
  ['GET', '/api/activity-logs', handleGetActivityLogs],
  ['GET', '/api/stock-ledger', handleGetStockLedger],

  // Image Upload
  ['POST', '/api/upload-image', handleUploadImage],

  // AI
  ['POST', '/api/extract-from-image', handleExtractFromImage],
  ['POST', '/api/generate-wisdom', handleGenerateWisdom],
  ['POST', '/api/transcribe', handleTranscribe],
  ['POST', '/api/admin/migrate-tasting', handleMigrateTasting],

  // Events — Public
  ['GET', '/api/events', handleListPublicEvents],
  ['GET', '/api/events/:slug/public', handleGetEventBySlug],
  ['GET', '/api/events/:slug/recap', handleGetPublicEventRecap],
  ['POST', '/api/events/:slug/rsvp', handleRSVP],
  ['GET', '/api/events/:slug/availability', handleGetEventAvailability],
  ['POST', '/api/events/:slug/find-rsvp', handleFindRSVP],
  ['POST', '/api/events/:slug/interest', handleEventInterest],

  // Guest Invites — Public
  ['GET', '/api/guest-invite/:token', handleGetGuestInvite],
  ['POST', '/api/guest-invite/:token/claim', handleClaimGuestInvite],

  // Verification — Public
  ['POST', '/api/verify/request', handleVerifyRequest],
  ['POST', '/api/verify/confirm', handleVerifyConfirm],

  // Journey — Public
  ['GET', '/api/journey/:phone', handleGetJourney],

  // RSVP — Token-based (public)
  ['GET', '/api/rsvp/:token', handleGetRSVP],
  ['PUT', '/api/rsvp/:token', handleUpdateRSVP],
  ['POST', '/api/rsvp/:token/claim', handleClaimSpot],
  ['GET', '/api/rsvp/:token/post-session', handleGetPostSession],
  ['POST', '/api/rsvp/:token/tasting-notes', handleSubmitTastingNotes],

  // Saved Locations — Admin (legacy, kept for edit-form compat)
  ['GET', '/api/admin/locations', handleGetSavedLocations],
  ['POST', '/api/admin/locations', handleCreateSavedLocation],
  ['PUT', '/api/admin/locations/:id', handleUpdateSavedLocation],
  ['DELETE', '/api/admin/locations/:id', handleDeleteSavedLocation],

  // Venues — Admin
  ['GET',    '/api/admin/venues',                      handleGetVenues],
  ['POST',   '/api/admin/venues',                      handleCreateVenue],
  ['PUT',    '/api/admin/venues/:id',                  handleUpdateVenue],
  ['DELETE', '/api/admin/venues/:id',                  handleDeleteVenue],
  ['GET',    '/api/admin/venues/:id/events',           handleGetVenueEvents],
  ['POST',   '/api/admin/venues/:id/photos',           handleUploadVenuePhoto],
  ['POST',   '/api/admin/venues/:id/spaces',           handleCreateVenueSpace],
  ['PUT',    '/api/admin/venues/:id/spaces/:spaceId',  handleUpdateVenueSpace],
  ['DELETE', '/api/admin/venues/:id/spaces/:spaceId',  handleDeleteVenueSpace],

  // Events — Admin
  ['GET', '/api/admin/events', handleGetEvents],
  ['GET', '/api/admin/events/:id', handleGetEvent],
  ['POST', '/api/admin/events', handleCreateEvent],
  ['PUT', '/api/admin/events/:id', handleUpdateEvent],
  ['DELETE', '/api/admin/events/:id', handleDeleteEvent],
  ['GET', '/api/admin/events/:id/attendees', handleGetAttendees],
  ['GET', '/api/admin/events/:id/notifications', handleGetNotifications],
  ['POST', '/api/admin/events/:id/notifications', handleCreateNotifications],
  ['POST', '/api/admin/events/:id/post-session', handleUpsertPostSession],
  ['POST', '/api/admin/events/:id/duplicate', handleDuplicateEvent],
  ['POST', '/api/admin/events/:id/attendance', handleBatchAttendance],
  ['GET', '/api/admin/events/:id/tea-menu', handleGetTeaMenu],
  ['POST', '/api/admin/events/:id/tea-menu', handleUpsertTeaMenu],
  ['DELETE', '/api/admin/events/:id/tea-menu/:itemId', handleDeleteTeaMenuItem],
  ['GET', '/api/admin/events/:id/tasting-notes', handleGetTastingNotes],

  // Admin — Customer journey
  ['GET', '/api/admin/customers/:id/journey', handleGetCustomerJourney],

  // Admin — Attendees (direct by ID)
  ['GET', '/api/admin/pending-attendees', handleGetPendingAttendees],
  ['PUT', '/api/admin/attendees/:id', handleUpdateAttendee],
  ['PUT', '/api/admin/attendees/:id/approve', handleApproveAttendee],
  ['PUT', '/api/admin/attendees/:id/deny', handleDenyAttendee],
  ['PUT', '/api/admin/attendees/:id/waitlist', handleWaitlistAttendee],

  // Admin — Event V2: batch approve + share
  ['POST', '/api/admin/events/:id/approve-batch', handleApproveBatch],
  ['GET', '/api/admin/events/:id/share', handleGetEventShareMessages],

  // Admin — Event V3: complete, convert interest, recurring (F7, F12, F40)
  ['POST', '/api/admin/events/:id/complete', handleCompleteEvent],
  ['GET', '/api/admin/events/:id/interest', handleGetInterestSignups],
  ['POST', '/api/admin/events/:id/convert-interest', handleConvertInterest],
  ['POST', '/api/admin/events/:id/create-next', handleCreateNextEvent],

  // Media Upload
  ['POST', '/api/upload-flyer', handleUploadFlyer],

  // Newsletter
  ['POST', '/api/newsletter/subscribe', handleNewsletterSubscribe],
  ['GET', '/api/newsletter/subscribers', handleGetNewsletterSubscribers],

  // Cart Inquiries
  ['POST', '/api/inquiries', handleCreateInquiry],
  ['GET', '/api/admin/inquiries', handleGetInquiries],
  ['PATCH', '/api/admin/inquiries/:id/status', handleUpdateInquiryStatus],

  // User Favorites
  ['GET', '/api/user/favorites', handleGetUserFavorites],
  ['PUT', '/api/user/favorites', handlePutUserFavorites],

  // Teaware Collection
  ['GET', '/api/admin/teaware', handleGetTeawareCollection],
  ['GET', '/api/admin/teaware/categories', handleGetTeawareCategories],
  ['GET', '/api/admin/teaware/:id', handleGetTeawareItem],
  ['POST', '/api/admin/teaware', handleCreateTeawareItem],
  ['PUT', '/api/admin/teaware/:id', handleUpdateTeawareItem],
  ['DELETE', '/api/admin/teaware/:id', handleDeleteTeawareItem],

  // Teaware Photos
  ['POST', '/api/admin/teaware/:id/photos', handleAddTeawarePhoto],
  ['PUT', '/api/admin/teaware/:id/photos/:photoId', handleUpdateTeawarePhoto],
  ['DELETE', '/api/admin/teaware/:id/photos/:photoId', handleDeleteTeawarePhoto],

  // Tea Compass
  ['GET', '/api/compass/entries', handleGetCompassEntries],
  ['POST', '/api/compass/entries', handleCreateCompassEntry],
  ['PUT', '/api/compass/entries/:id', handleUpdateCompassEntry],
  ['DELETE', '/api/compass/entries/:id', handleDeleteCompassEntry],
  ['POST', '/api/compass/sync', handleSyncCompassEntries],

  // Notes — unified thread
  ['GET',  '/api/notes',              handleGetNotes],
  ['POST', '/api/notes/sync',         handleSyncNotes],
  ['POST', '/api/note-sessions/sync', handleSyncNoteSessions],

  // Compass Sharing
  ['POST', '/api/compass/share', handleCompassShare],
  ['GET', '/api/compass/incoming', handleCompassIncoming],
  ['POST', '/api/compass/shares/:id/accept', handleCompassAcceptShare],
  ['POST', '/api/compass/shares/:id/decline', handleCompassDeclineShare],
  ['GET', '/api/compass/invite/:token', handleCompassGetInvite],
  ['POST', '/api/compass/invite/:token/claim', handleCompassClaimInvite],

  // Samples — Public
  ['POST', '/api/samples/request', handleRequestSample],
  ['GET', '/api/samples/set/:setId', handleGetSamplesBySet],
  ['GET', '/api/samples/:id', handleGetSample],
  ['POST', '/api/samples/:id/tastings', handleAddSampleTasting],

  // Tasting Journal
  // Tea Reviews (cross-account, keyed by tea_key)
  ['GET', '/api/tea-reviews', handleGetTeaReviews],
  ['POST', '/api/tea-reviews', handleCreateTeaReview],
  ['PUT', '/api/tea-reviews/:id', handleUpdateTeaReview],
  ['DELETE', '/api/tea-reviews/:id', handleDeleteTeaReview],

  ['GET', '/api/tasting-journal', handleGetTastingJournal],
  ['POST', '/api/tasting-journal/sync', handleSyncTastingJournal],
  ['POST', '/api/tasting-journal', handleAddTastingEntry],
  ['DELETE', '/api/tasting-journal/:id', handleDeleteTastingEntry],

  // Samples — Admin
  ['GET', '/api/admin/samples', handleListSamples],
  ['POST', '/api/admin/samples', handleCreateSample],
  ['PUT', '/api/admin/samples/:id', handleUpdateSample],
  ['DELETE', '/api/admin/samples/:id', handleDeleteSample],
  ['GET', '/api/admin/sample-sets', handleListSampleSets],
  ['POST', '/api/admin/sample-sets', handleCreateSampleSet],
  ['PUT', '/api/admin/sample-sets/:id', handleUpdateSampleSet],
  ['DELETE', '/api/admin/sample-sets/:id', handleDeleteSampleSet],

  // Article ↔ Product cross-references
  ['GET', '/api/xref/articles/:id/products', articleProductXref.list],
  ['POST', '/api/xref/articles/:id/products', articleProductXref.link],
  ['DELETE', '/api/xref/articles/:id/products/:productId', articleProductXref.unlink],

  // Module ↔ Product cross-references
  ['GET', '/api/xref/modules/:id/products', moduleProductXref.list],
  ['POST', '/api/xref/modules/:id/products', moduleProductXref.link],
  ['DELETE', '/api/xref/modules/:id/products/:productId', moduleProductXref.unlink],

  // Project ↔ Product cross-references
  ['GET', '/api/xref/projects/:id/products', projectProductXref.list],
  ['POST', '/api/xref/projects/:id/products', projectProductXref.link],
  ['DELETE', '/api/xref/projects/:id/products/:productId', projectProductXref.unlink],

  // Reverse: products → linked content
  ['GET', '/api/products/:id/articles', articleProductXref.listByProduct],
  ['GET', '/api/products/:id/modules', moduleProductXref.listByProduct],
  ['GET', '/api/products/:id/projects', projectProductXref.listByProduct],

  // Me / Profile
  ['GET', '/api/me/profile', handleGetMyProfile],
  ['GET', '/api/me/queue', handleGetMyQueue],
  ['GET', '/api/me/wishlist', handleGetMyWishlist],
  ['GET', '/api/me/journey', handleGetMyJourney],
  ['GET', '/api/members/search', handleMemberSearch],

  // Co-Tasting Sessions
  ['POST', '/api/sessions', handleCreateSession],
  ['GET', '/api/sessions/:id', handleGetSession],
  ['GET', '/api/sessions/join/:token', handleGetSessionByToken],
  ['POST', '/api/sessions/:id/join', handleJoinSession],
  ['POST', '/api/sessions/:id/teas/:teaId/verdict', handleSubmitSessionVerdict],
  ['GET', '/api/sessions/:id/verdicts', handleGetSessionVerdicts],
  ['POST', '/api/sessions/:id/complete', handleCompleteSession],

  // Member Connections
  ['GET', '/api/connections', handleGetConnections],
  ['POST', '/api/connections/invite', handleInviteConnection],
  ['POST', '/api/connections/invites/:id/accept', handleAcceptConnectionInvite],

  // Compass Entry Feedback
  ['GET', '/api/compass/entries/:id/feedback', handleGetEntryFeedback],

  // Table Share (QR)
  ['POST', '/api/compass/entries/:id/table-share', handleCreateTableShare],
  ['GET', '/api/t/:token', handleGetTableCard],
  ['POST', '/api/t/:token/verdict', handleSubmitTableVerdict],

  // Gift Sample RPC
  ['POST', '/api/rpc/gift-sample', handleGiftSample],

  // Articles — Public
  ['GET', '/api/articles',       handleGetPublicArticles],
  ['GET', '/api/articles/:slug', handleGetPublicArticle],

  // Articles — Admin
  ['GET',    '/api/admin/articles',                    handleListArticles],
  ['POST',   '/api/admin/articles',                    handleCreateArticle],
  ['GET',    '/api/admin/articles/:id',                handleGetArticle],
  ['PUT',    '/api/admin/articles/:id',                handleUpdateArticle],
  ['POST',   '/api/admin/articles/:id/publish',        handlePublishArticle],
  ['POST',   '/api/admin/articles/:id/unpublish',      handleUnpublishArticle],
  ['DELETE', '/api/admin/articles/:id',                handleDeleteArticle],
];

// Simple in-memory rate limiter (per-isolate; resets on cold start — good enough for abuse deterrence)
const _rlMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = _rlMap.get(key);
  if (!entry || now > entry.resetAt) {
    _rlMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}

const ALLOWED_ORIGINS = [
  'https://teajia.com',
  'https://www.teajia.com',
  'https://teajia.pages.dev',
  'http://localhost:7777',
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    // CORS preflight — cache for 24h to eliminate redundant OPTIONS round-trips
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Teajia-Account',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin',
        },
      });
    }

    const match = matchRoute(request.method, url.pathname, routes);
    if (!match) {
      return cors(json({ error: 'Not found' }, 404), corsOrigin);
    }

    try {
      const response = await match.handler(request, env, match.params);
      return cors(response, corsOrigin);
    } catch (err: any) {
      console.error('Worker error:', err);
      return cors(json({ error: err.message || 'Internal server error' }, 500), corsOrigin);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    // Generate checkin reminder notifications for events happening tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const events = await env.DB.prepare(
      `SELECT id FROM events WHERE date(event_date) = ? AND status = 'active'`
    ).bind(tomorrowStr).all();

    for (const event of events.results) {
      const attendees = await env.DB.prepare(
        `SELECT ea.id FROM event_attendees ea
         LEFT JOIN event_notifications en ON en.attendee_id = ea.id AND en.event_id = ea.event_id AND en.type = 'checkin_reminder'
         WHERE ea.event_id = ? AND ea.status = 'confirmed' AND en.id IS NULL`
      ).bind(event.id).all();

      if (attendees.results.length > 0) {
        const stmts = attendees.results.map(a =>
          env.DB.prepare(
            `INSERT INTO event_notifications (id, event_id, attendee_id, type, message_template, status)
             VALUES (?, ?, ?, 'checkin_reminder', 'Reminder: Your tea session is tomorrow!', 'pending')`
          ).bind(crypto.randomUUID(), event.id, a.id)
        );
        await env.DB.batch(stmts);
      }
    }
  },
};
