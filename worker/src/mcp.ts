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
// (2) at dispatch time the token's `creator_tier` column is checked — if it is
// not 'account_owner' or 'platform_owner', the call is rejected even if the
// scope appears in the token row (defense in depth against direct DB edits).
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

type Env = {
  DB: D1Database;
  JWT_SECRET: string;
  // The wider Env interface in index.ts has many more fields — only the ones
  // the MCP server actually reads are listed here so this module is portable.
};

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

  const user = await env.DB.prepare('SELECT id, email, platform_role FROM users WHERE id = ?')
    .bind(claims.sub)
    .first() as { id: string; email: string | null; platform_role: string | null } | null;
  if (!user) {
    return corsJson({ error: 'unauthenticated', error_description: 'User no longer exists' }, 401);
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
    return { userId: user.id, userEmail: user.email || claims.email, accountId };
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

  return { userId: user.id, userEmail: user.email || claims.email, accountId };
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
  'inventory:read', 'stock:write', 'customers:read', 'sales:write',
  'catalog:write', 'customers:write', 'admin:write',
] as const;
type McpScope = typeof MCP_SCOPES[number];

// Scopes that require owner-tier creator. Defense-in-depth: checked at mint
// AND at dispatch (in case someone edits the DB row directly).
const OWNER_TIER_SCOPES: ReadonlySet<McpScope> = new Set(['catalog:write', 'customers:write', 'admin:write']);

// Default set for tokens minted without explicit scope selection (legacy +
// OAuth flow). Does NOT include owner-tier scopes.
const DEFAULT_MCP_SCOPES: McpScope[] = ['inventory:read', 'stock:write', 'customers:read', 'sales:write'];

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
  return auth.scopes.includes(scope);
}

// 401 with WWW-Authenticate header — required by the MCP OAuth spec so
// clients (Claude desktop/mobile) know to start the OAuth discovery flow.
// The `resource_metadata` parameter points clients at our protected-resource
// metadata document, which in turn points them at the auth server.
function unauthorized(request: Request, message: string): Response {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
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

  const hash = await sha256Hex(plaintext);
  const row = await env.DB.prepare(
    'SELECT id, account_id, user_id, user_email, revoked_at, scopes, creator_tier FROM mcp_tokens WHERE token_hash = ?'
  ).bind(hash).first() as Record<string, any> | null;

  if (!row || row.revoked_at) {
    return unauthorized(request, 'Invalid or revoked token');
  }

  // Bump last_used_at on every successful auth (best-effort; non-blocking).
  env.DB.prepare("UPDATE mcp_tokens SET last_used_at = datetime('now') WHERE id = ?")
    .bind(row.id).run().catch(() => {});

  const creatorTier: McpCreatorTier =
    (['platform_owner', 'account_owner', 'staff', 'viewer'] as McpCreatorTier[]).includes(row.creator_tier as McpCreatorTier)
      ? (row.creator_tier as McpCreatorTier)
      : 'account_owner'; // default for pre-migration rows that have no column yet

  return {
    accountId: row.account_id as string,
    userId: row.user_id as string,
    userEmail: row.user_email as string,
    tokenId: row.id as string,
    scopes: parseMcpScopes(row.scopes),
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
  | { kind: 'record_sale'; accountId: string; userEmail: string; lines: { productId: string; grams: number; pricePerGramUsd: number }[]; customerId: string | null; customerName: string; customerWhatsapp: string | null; notes: string | null }
  | { kind: 'create_customer'; accountId: string; userEmail: string; name: string; whatsapp: string | null; email: string | null; phone: string | null; notes: string | null; tags: string[] }
  | { kind: 'update_customer'; accountId: string; userEmail: string; customerId: string; fields: Record<string, string | null> }
  | { kind: 'update_tea_pricing'; accountId: string; userEmail: string; productId: string; costAmount: number | null; costCurrency: string | null; retailPriceUsd: number | null }
  | { kind: 'set_low_stock_threshold'; accountId: string; userEmail: string; productId: string; thresholdGrams: number }
  | { kind: 'update_invoice'; accountId: string; userEmail: string; invoiceId: string; fields: Record<string, string | null> }
  | { kind: 'void_invoice'; accountId: string; userEmail: string; invoiceId: string; reason: string | null }
  // ── Wave 3 ──
  | { kind: 'tag_customer'; accountId: string; userEmail: string; customerId: string; tag: string }
  | { kind: 'untag_customer'; accountId: string; userEmail: string; customerId: string; tag: string }
  | { kind: 'link_vendor'; accountId: string; userEmail: string; customerId: string; productId: string; note: string | null }
  | { kind: 'unlink_vendor'; accountId: string; userEmail: string; customerId: string; productId: string }
  | { kind: 'set_archive_status'; accountId: string; userEmail: string; productId: string; archived: boolean; reason: string | null }
  | { kind: 'fulfill_invoice'; accountId: string; userEmail: string; invoiceId: string }
  | { kind: 'update_account_settings'; accountId: string; userEmail: string; fields: Record<string, string | null> }
  | { kind: 'update_exchange_rate'; accountId: string; userEmail: string; currency: string; rateVsUsd: number; previousRate: number };

type PendingEntry = { mutation: PendingMutation; expiresAt: number };
const PENDING = new Map<string, PendingEntry>();
const PENDING_TTL_MS = 5 * 60 * 1000;

function issueConfirmationToken(mutation: PendingMutation): string {
  // Sweep expired entries opportunistically so the map doesn't grow unbounded
  // in a long-lived isolate.
  const now = Date.now();
  for (const [k, v] of PENDING) if (v.expiresAt < now) PENDING.delete(k);

  const token = crypto.randomUUID();
  PENDING.set(token, { mutation, expiresAt: now + PENDING_TTL_MS });
  return token;
}

function consumeConfirmationToken(token: string): PendingMutation | null {
  const entry = PENDING.get(token);
  if (!entry) return null;
  PENDING.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry.mutation;
}

// ── tea name search helpers ──
//
// Token-based scoring — Fuse.js doesn't run server-side here without bundling
// a dependency, but the corpus per account is in the low thousands at most,
// so a hand-rolled prefix/contains/word-overlap scorer is plenty for voice.

function normalize(s: string | null | undefined): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9一-鿿\s]/g, ' ').replace(/\s+/g, ' ').trim();
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

  return {
    matches: scored.map(s => ({
      id: s.customer.id,
      name: s.customer.name,
      company: s.customer.company,
      email: s.customer.email,
      phone: s.customer.phone,
      whatsapp: s.customer.whatsapp,
      city: s.customer.city,
      country: s.customer.country,
      preferred_currency: s.customer.preferred_currency,
      match_score: Math.round(s.score * 100) / 100,
    })),
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
    const token = issueConfirmationToken({
      kind: 'add_stock', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, grams, note,
    });
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

  const pending = consumeConfirmationToken(confirm);
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

  await env.DB.batch([
    env.DB.prepare('UPDATE products SET stock_grams = stock_grams + ? WHERE id = ? AND account_id = ?')
      .bind(m.grams, m.productId, m.accountId),
    env.DB.prepare(
      'UPDATE product_listings SET stock_grams = stock_grams + ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(m.grams, `list_${m.productId}`),
    env.DB.prepare(
      `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, user_email, note, account_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(crypto.randomUUID(), m.productId, m.grams, balanceAfter, 'PURCHASE_RECEIPT', m.userEmail, m.note ?? `MCP add_stock`, m.accountId),
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
    const token = issueConfirmationToken({
      kind: 'remove_stock', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, grams, reason, note,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
  const balanceAfter = current - m.grams;

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare('UPDATE products SET stock_grams = stock_grams - ? WHERE id = ? AND account_id = ?')
      .bind(m.grams, m.productId, m.accountId),
    env.DB.prepare(
      'UPDATE product_listings SET stock_grams = stock_grams - ?, updated_at = datetime(\'now\') WHERE id = ?'
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

    const available = Number(p.stock_grams || 0);
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

  const total = previewLines.reduce((s, l) => s + l.line_total_usd, 0);

  if (!confirm) {
    const token = issueConfirmationToken({
      kind: 'record_sale', accountId: auth.accountId, userEmail: auth.userEmail,
      lines: previewLines.map(l => ({ productId: l.product_id, grams: l.grams, pricePerGramUsd: l.price_per_gram_usd })),
      customerId, customerName: customerNameResolved, customerWhatsapp, notes,
    });
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

  const pending = consumeConfirmationToken(confirm);
  if (!pending || pending.kind !== 'record_sale') {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitRecordSale(env, pending);
}

async function commitRecordSale(env: Env, m: Extract<PendingMutation, { kind: 'record_sale' }>) {
  // Re-validate stock at commit time — the preview window is 5min and stock
  // could have changed via another channel (admin UI, another tool call).
  const productCache = new Map<string, { id: string; stock_grams: number; given_name: string | null; product_name: string; status: string; low_stock_threshold: number | null; source_compass_entry_id: string | null }>();
  for (const line of m.lines) {
    const p = await env.DB.prepare(
      'SELECT id, stock_grams, given_name, product_name, status, low_stock_threshold, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
    ).bind(line.productId, m.accountId).first() as any;
    if (!p) return { error: 'product_not_found', product_id: line.productId };
    if (Number(p.stock_grams || 0) < line.grams) {
      return {
        error: 'insufficient_stock_at_commit',
        product_id: line.productId,
        product_name: p.given_name || p.product_name,
        requested_grams: line.grams,
        available_grams: Number(p.stock_grams || 0),
      };
    }
    productCache.set(line.productId, p);
  }

  // Allocate invoice number using the existing per-account sequence.
  const seqRow = await env.DB.prepare(
    'UPDATE accounts SET invoice_seq = invoice_seq + 1 WHERE id = ? RETURNING invoice_seq, invoice_prefix'
  ).bind(m.accountId).first() as { invoice_seq: number; invoice_prefix: string | null } | null;
  const seq = seqRow?.invoice_seq ?? 1;
  const pfx = seqRow?.invoice_prefix || '';
  const invoiceNumber = pfx ? `${pfx}-${String(seq).padStart(5, '0')}` : String(seq).padStart(5, '0');

  const invoiceId = crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [];

  // Invoice + line items, written as Filled with inventory_deducted=1 in one pass.
  stmts.push(env.DB.prepare(
    `INSERT INTO invoices
       (id, account_id, invoice_number, customer_name, customer_whatsapp, customer_id,
        display_currency, shipping_cost_usd, status, inventory_deducted, notes, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, 'USD', 0, 'Filled', 1, ?, 'unpaid')`
  ).bind(
    invoiceId, m.accountId, invoiceNumber,
    m.customerName, m.customerWhatsapp, m.customerId, m.notes,
  ));

  for (const line of m.lines) {
    const p = productCache.get(line.productId)!;
    const currentStock = Number(p.stock_grams || 0);
    const balanceAfter = currentStock - line.grams;
    const threshold = Number(p.low_stock_threshold || 0);

    stmts.push(env.DB.prepare(
      'INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), m.accountId, invoiceId, line.productId, line.grams, line.pricePerGramUsd));

    stmts.push(env.DB.prepare(
      'UPDATE products SET stock_grams = stock_grams - ? WHERE id = ? AND account_id = ?'
    ).bind(line.grams, line.productId, m.accountId));

    stmts.push(env.DB.prepare(
      'UPDATE product_listings SET stock_grams = stock_grams - ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(line.grams, `list_${line.productId}`));

    stmts.push(env.DB.prepare(
      `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, source_invoice_id, source_invoice_number, user_email, note, account_id)
       VALUES (?, ?, ?, ?, 'FULFILLMENT', ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), line.productId, -line.grams, balanceAfter,
      invoiceId, invoiceNumber, m.userEmail, 'MCP record_sale', m.accountId,
    ));

    if (balanceAfter <= 0 && p.status !== 'Sold Out') {
      stmts.push(env.DB.prepare(
        "UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ? AND account_id = ?"
      ).bind(line.productId, m.accountId));
    } else if (threshold > 0 && balanceAfter < threshold && currentStock >= threshold) {
      stmts.push(env.DB.prepare(
        `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
         VALUES (?, 'low_stock_alert', ?, ?, 'product', ?, ?)`
      ).bind(
        crypto.randomUUID(),
        JSON.stringify({ productName: p.given_name || p.product_name, stockGrams: balanceAfter, threshold }),
        m.userEmail, line.productId, m.accountId,
      ));
    }
  }

  stmts.push(env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'INVOICE_CREATED_MCP', ?, ?, 'invoice', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    `Invoice ${invoiceNumber} created + filled via MCP for ${m.customerName} (${m.lines.length} items)`,
    m.userEmail, invoiceId, m.accountId,
  ));

  await env.DB.batch(stmts);

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
    const token = issueConfirmationToken({
      kind: 'create_customer', accountId: auth.accountId, userEmail: auth.userEmail,
      name, whatsapp, email, phone, notes, tags,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
    const token = issueConfirmationToken({
      kind: 'update_customer', accountId: auth.accountId, userEmail: auth.userEmail,
      customerId, fields,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
  if (!hasNewCost && !hasNewRetail) throw new Error('At least one of cost_amount, cost_currency, or retail_price_usd is required');

  const costAmount: number | null = 'cost_amount' in (args || {}) ? Number(args.cost_amount) : null;
  const costCurrency: string | null = args?.cost_currency ? String(args.cost_currency).toUpperCase().trim() : null;
  const retailPriceUsd: number | null = 'retail_price_usd' in (args || {}) ? Number(args.retail_price_usd) : null;

  if (costAmount !== null && (!Number.isFinite(costAmount) || costAmount < 0)) throw new Error('cost_amount must be a non-negative number');
  if (retailPriceUsd !== null && (!Number.isFinite(retailPriceUsd) || retailPriceUsd < 0)) throw new Error('retail_price_usd must be a non-negative number');

  const product = await env.DB.prepare(
    'SELECT id, given_name, product_name, cost_amount, cost_currency, fixed_retail_price_usd FROM products WHERE id = ? AND account_id = ?'
  ).bind(productId, auth.accountId).first() as Record<string, any> | null;
  if (!product) return { error: 'not_found' };

  if (!confirm) {
    const oldRetail = Number(product.fixed_retail_price_usd || 0);
    const newRetail = retailPriceUsd ?? oldRetail;

    // Margin warning: (retail - cost_in_usd) / retail < 30%
    // (Cost currency conversion omitted here — just use cost_amount directly for the warning)
    const newCost = costAmount ?? Number(product.cost_amount || 0);
    const marginWarning = newRetail > 0 && (newRetail - newCost) / newRetail < 0.3
      ? `Margin will be ${Math.round(((newRetail - newCost) / newRetail) * 100)}% — below the 30% floor.`
      : null;

    const token = issueConfirmationToken({
      kind: 'update_tea_pricing', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, costAmount, costCurrency, retailPriceUsd,
    });
    return {
      preview: {
        action: 'update_tea_pricing',
        product: { id: product.id, name: product.given_name || product.product_name },
        changes: {
          cost_amount: { old: product.cost_amount ?? null, new: costAmount ?? product.cost_amount },
          cost_currency: { old: product.cost_currency ?? null, new: costCurrency ?? product.cost_currency },
          retail_price_usd: { old: product.fixed_retail_price_usd ?? null, new: retailPriceUsd ?? product.fixed_retail_price_usd },
        },
        margin_warning: marginWarning,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = consumeConfirmationToken(confirm);
  if (!pending || pending.kind !== 'update_tea_pricing' || pending.productId !== productId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitUpdateTeaPricing(env, pending);
}

async function commitUpdateTeaPricing(env: Env, m: Extract<PendingMutation, { kind: 'update_tea_pricing' }>) {
  const cols: string[] = [];
  const vals: any[] = [];
  if (m.costAmount !== null) { cols.push('cost_amount'); vals.push(m.costAmount); }
  if (m.costCurrency !== null) { cols.push('cost_currency'); vals.push(m.costCurrency); }
  if (m.retailPriceUsd !== null) { cols.push('fixed_retail_price_usd'); vals.push(m.retailPriceUsd); }

  if (cols.length === 0) return { committed: true, action: 'update_tea_pricing', changes: 0 };

  const sets = cols.map(c => `${c} = ?`).join(', ');
  await env.DB.batch([
    env.DB.prepare(`UPDATE products SET ${sets}, updated_at = datetime('now') WHERE id = ? AND account_id = ?`)
      .bind(...vals, m.productId, m.accountId),
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'PRICING_UPDATED_MCP', ?, ?, 'product', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Pricing updated via MCP for product ${m.productId}: ${cols.join(', ')}`,
      m.userEmail, m.productId, m.accountId,
    ),
  ]);
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
    const token = issueConfirmationToken({
      kind: 'set_low_stock_threshold', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, thresholdGrams,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
    const token = issueConfirmationToken({
      kind: 'update_invoice', accountId: auth.accountId, userEmail: auth.userEmail,
      invoiceId, fields,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
    const token = issueConfirmationToken({
      kind: 'void_invoice', accountId: auth.accountId, userEmail: auth.userEmail,
      invoiceId, reason,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
  stmts.push(
    env.DB.prepare("UPDATE invoices SET status = 'Void', inventory_deducted = 0 WHERE id = ? AND account_id = ?")
      .bind(m.invoiceId, m.accountId)
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

  await env.DB.batch(stmts);

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
    const token = issueConfirmationToken({
      kind: 'tag_customer', accountId: auth.accountId, userEmail: auth.userEmail,
      customerId, tag,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
    const token = issueConfirmationToken({
      kind: 'untag_customer', accountId: auth.accountId, userEmail: auth.userEmail,
      customerId, tag,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
    const token = issueConfirmationToken({
      kind: 'link_vendor', accountId: auth.accountId, userEmail: auth.userEmail,
      customerId, productId, note,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
    const token = issueConfirmationToken({
      kind: 'unlink_vendor', accountId: auth.accountId, userEmail: auth.userEmail,
      customerId, productId,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
    const token = issueConfirmationToken({
      kind: 'set_archive_status', accountId: auth.accountId, userEmail: auth.userEmail,
      productId, archived, reason,
    });
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

  const pending = consumeConfirmationToken(confirm);
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

// ── tool: fulfill_invoice (preview / confirm) ──
// Deducts stock for all unfulfilled line items on a Draft invoice. Refuses
// if any line would underflow stock (negative balance).
async function toolFulfillInvoice(env: Env, auth: McpAuth, args: any) {
  const invoiceId = String(args?.invoice_id || '').trim();
  const confirm = args?.confirm ? String(args.confirm) : null;

  if (!invoiceId) throw new Error('invoice_id is required');

  const invoice = await env.DB.prepare(
    'SELECT id, invoice_number, customer_name, status, inventory_deducted FROM invoices WHERE id = ? AND account_id = ?'
  ).bind(invoiceId, auth.accountId).first() as Record<string, any> | null;
  if (!invoice) return { error: 'invoice_not_found' };
  if (invoice.status === 'Void') return { error: 'void_invoice_cannot_be_fulfilled' };
  if (invoice.inventory_deducted) return { error: 'inventory_already_deducted', invoice_status: invoice.status };

  const { results: rawItems } = await env.DB.prepare(
    `SELECT ili.product_id, ili.quantity, p.given_name, p.product_name, p.stock_grams
       FROM invoice_line_items ili
       LEFT JOIN products p ON p.id = ili.product_id AND p.account_id = ?
      WHERE ili.invoice_id = ? AND ili.account_id = ?`
  ).bind(auth.accountId, invoiceId, auth.accountId).all();

  const items = rawItems as any[];

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
    const stock = Number(item.stock_grams) || 0;
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
    const token = issueConfirmationToken({
      kind: 'fulfill_invoice', accountId: auth.accountId, userEmail: auth.userEmail,
      invoiceId,
    });
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

  const pending = consumeConfirmationToken(confirm);
  if (!pending || pending.kind !== 'fulfill_invoice' || pending.invoiceId !== invoiceId) {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitFulfillInvoice(env, pending, invoice, items);
}

async function commitFulfillInvoice(
  env: Env,
  m: Extract<PendingMutation, { kind: 'fulfill_invoice' }>,
  invoice: Record<string, any>,
  lineItems: any[],
) {
  const stmts: D1PreparedStatement[] = [];

  for (const item of lineItems) {
    if (!item.product_id) continue; // custom items have no stock

    // Re-read stock at commit time for race-condition safety.
    const product = await env.DB.prepare(
      'SELECT id, stock_grams, given_name, product_name, status, low_stock_threshold, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
    ).bind(item.product_id, m.accountId).first() as any;
    if (!product) continue;

    const currentStock = Number(product.stock_grams || 0);
    const qty = Number(item.quantity) || 0;
    if (qty > currentStock) {
      // Abort — stock changed between preview and confirm.
      return {
        error: 'stock_underflow_at_commit',
        product_id: item.product_id,
        product_name: product.given_name || product.product_name,
        requested_grams: qty,
        available_grams: currentStock,
        message: 'Stock changed between preview and commit. Re-run fulfill_invoice to get a fresh preview.',
      };
    }

    const newBalance = currentStock - qty;
    const threshold = Number(product.low_stock_threshold || 0);

    stmts.push(
      env.DB.prepare('UPDATE products SET stock_grams = stock_grams - ? WHERE id = ? AND account_id = ?')
        .bind(qty, item.product_id, m.accountId)
    );
    stmts.push(
      env.DB.prepare(
        "UPDATE product_listings SET stock_grams = stock_grams - ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(qty, `list_${item.product_id}`)
    );
    stmts.push(
      env.DB.prepare(
        `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, source_invoice_id, source_invoice_number, user_email, note, account_id)
         VALUES (?, ?, ?, ?, 'FULFILLMENT', ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), item.product_id, -qty, newBalance,
        m.invoiceId, invoice.invoice_number as string, m.userEmail,
        'MCP fulfill_invoice', m.accountId,
      )
    );

    if (newBalance <= 0 && product.status !== 'Sold Out') {
      stmts.push(
        env.DB.prepare("UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ? AND account_id = ?")
          .bind(item.product_id, m.accountId)
      );
      stmts.push(
        env.DB.prepare("UPDATE product_listings SET status = 'Sold Out', updated_at = datetime('now') WHERE id = ?")
          .bind(`list_${item.product_id}`)
      );
      if (product.source_compass_entry_id) {
        stmts.push(
          env.DB.prepare("UPDATE tea_compass_entries SET status = 'depleted', updated_at = datetime('now') WHERE id = ? AND status = 'in_stock'")
            .bind(product.source_compass_entry_id)
        );
      }
    } else if (threshold > 0 && newBalance < threshold && currentStock >= threshold) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
           VALUES (?, 'low_stock_alert', ?, ?, 'product', ?, ?)`
        ).bind(
          crypto.randomUUID(),
          JSON.stringify({ productName: product.given_name || product.product_name, stockGrams: newBalance, threshold }),
          m.userEmail, item.product_id, m.accountId,
        )
      );
    }
  }

  stmts.push(
    env.DB.prepare('DELETE FROM stock_holds WHERE invoice_id = ? AND account_id = ?')
      .bind(m.invoiceId, m.accountId)
  );
  stmts.push(
    env.DB.prepare("UPDATE invoices SET status = 'Filled', inventory_deducted = 1 WHERE id = ? AND account_id = ?")
      .bind(m.invoiceId, m.accountId)
  );
  stmts.push(
    env.DB.prepare(
      `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
       VALUES (?, 'INVOICE_FULFILLED_MCP', ?, ?, 'invoice', ?, ?)`
    ).bind(
      crypto.randomUUID(),
      `Invoice ${invoice.invoice_number as string} fulfilled via MCP for ${invoice.customer_name as string} (${lineItems.length} item(s))`,
      m.userEmail, m.invoiceId, m.accountId,
    )
  );

  await env.DB.batch(stmts);

  return {
    committed: true,
    action: 'fulfill_invoice',
    invoice_id: m.invoiceId,
    invoice_number: invoice.invoice_number,
    status: 'Filled',
    items_fulfilled: lineItems.filter(i => i.product_id).length,
  };
}

// ── tool: update_account_settings (preview / confirm) ──
// Wraps PUT /api/accounts/:id for the active account. Owner-tier only.
const ACCOUNT_SETTINGS_FIELDS = ['account_name', 'default_currency', 'contact_email', 'contact_phone'] as const;
type AccountSettingsField = typeof ACCOUNT_SETTINGS_FIELDS[number];

// Maps our MCP-friendly field names to the actual accounts table columns.
const ACCOUNT_FIELD_MAP: Record<AccountSettingsField, string> = {
  account_name: 'name',
  default_currency: 'currency_default',
  contact_email: 'contact_email',
  contact_phone: 'whatsapp_number',
};

async function toolUpdateAccountSettings(env: Env, auth: McpAuth, args: any) {
  const targetAccountId = args?.account_id ? String(args.account_id).trim() : auth.accountId;
  const confirm = args?.confirm ? String(args.confirm) : null;

  // Collect provided fields (skip undefined).
  const requestedFields: Partial<Record<AccountSettingsField, string | null>> = {};
  for (const f of ACCOUNT_SETTINGS_FIELDS) {
    if (f in (args || {})) {
      requestedFields[f] = args[f] ? String(args[f]).trim() : null;
    }
  }
  if (Object.keys(requestedFields).length === 0) {
    throw new Error('At least one setting field is required (account_name, default_currency, contact_email, contact_phone)');
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
    const token = issueConfirmationToken({
      kind: 'update_account_settings', accountId: auth.accountId, userEmail: auth.userEmail,
      fields,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
    const token = issueConfirmationToken({
      kind: 'update_exchange_rate', accountId: auth.accountId, userEmail: auth.userEmail,
      currency, rateVsUsd, previousRate,
    });
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

  const pending = consumeConfirmationToken(confirm);
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
    description: 'Fuzzy-search customers by name, company, email, phone, or WhatsApp.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
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
    scope: 'catalog:write',
    description: 'Update the cost price and/or retail price for a tea product. Two-step preview/confirm. Shows margin calculation before and after change. Warns if margin drops below 30%.',
    inputSchema: {
      type: 'object',
      properties: {
        product_id: { type: 'string', description: 'Product id from search_tea/get_tea.' },
        cost_amount: { type: 'number', description: 'Per-gram purchase cost in cost_currency.' },
        cost_currency: { type: 'string', description: '3-letter ISO currency code, e.g. CNY.' },
        retail_price_usd: { type: 'number', description: 'Fixed per-gram retail price in USD.' },
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
    name: 'update_account_settings',
    scope: 'admin:write',
    description: 'Update basic account settings (name, default currency, contact email/phone). Two-step preview/confirm. Owner-tier only. Defaults to the active account if account_id is not specified.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Account id to update. Defaults to the token\'s account if omitted.' },
        account_name: { type: 'string', description: 'Display name for the account.' },
        default_currency: { type: 'string', description: '3-letter ISO currency code, e.g. AUD.' },
        contact_email: { type: 'string', description: 'Primary contact email for the account.' },
        contact_phone: { type: 'string', description: 'WhatsApp / primary phone number for the account.' },
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
] as const;

function mcpContent(payload: unknown) {
  // MCP tool results are returned as a `content` array of typed parts. We
  // serialize the structured payload as JSON inside a text part — Claude
  // handles JSON-in-text reliably and it keeps the contract simple for any
  // future non-Claude MCP client.
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    isError: typeof payload === 'object' && payload !== null && 'error' in (payload as any),
  };
}

function toolDefFor(name: string) {
  return TOOL_DEFS.find(tool => tool.name === name);
}

function visibleToolDefs(auth: McpAuth) {
  return TOOL_DEFS
    .filter(tool => {
      const scope = tool.scope as McpScope;
      if (!hasMcpScope(auth, scope)) return false;
      // Owner-tier scoped tools are invisible to non-owner-tier token creators.
      if (OWNER_TIER_SCOPES.has(scope) && !OWNER_TIERS.has(auth.creatorTier)) return false;
      return true;
    })
    .map(({ scope: _scope, ...tool }) => tool);
}

const AUDITED_TOOLS = new Set([
  'record_sale', 'add_stock', 'remove_stock',
  'create_customer', 'update_customer',
  'update_tea_pricing', 'set_low_stock_threshold',
  'update_invoice', 'void_invoice',
  // Wave 3
  'tag_customer', 'untag_customer', 'link_vendor', 'unlink_vendor',
  'set_archive_status', 'fulfill_invoice', 'update_account_settings', 'update_exchange_rate',
]);

async function logMcpToolCall(env: Env, auth: McpAuth, toolName: string, args: any, result: unknown) {
  const shouldAudit = AUDITED_TOOLS.has(toolName) && (
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
  // if the creator is not owner-tier. Prevents a DB edit from escalating rights.
  if (OWNER_TIER_SCOPES.has(scope) && !OWNER_TIERS.has(auth.creatorTier)) {
    return mcpContent({
      error: 'owner_tier_required',
      message: 'This tool requires the token to have been minted by an account owner or platform owner.',
      tool: name,
    });
  }

  let result;
  switch (name) {
    case 'search_tea': result = mcpContent(await toolSearchTea(env, auth.accountId, args)); break;
    case 'get_tea': result = mcpContent(await toolGetTea(env, auth.accountId, args)); break;
    case 'list_low_stock': result = mcpContent(await toolListLowStock(env, auth.accountId)); break;
    case 'find_customer': result = mcpContent(await toolFindCustomer(env, auth.accountId, args)); break;
    case 'add_stock': result = mcpContent(await toolAddStock(env, auth, args)); break;
    case 'remove_stock': result = mcpContent(await toolRemoveStock(env, auth, args)); break;
    case 'record_sale': result = mcpContent(await toolRecordSale(env, auth, args)); break;
    case 'create_customer': result = mcpContent(await toolCreateCustomer(env, auth, args)); break;
    case 'update_customer': result = mcpContent(await toolUpdateCustomer(env, auth, args)); break;
    case 'update_tea_pricing': result = mcpContent(await toolUpdateTeaPricing(env, auth, args)); break;
    case 'set_low_stock_threshold': result = mcpContent(await toolSetLowStockThreshold(env, auth, args)); break;
    case 'update_invoice': result = mcpContent(await toolUpdateInvoice(env, auth, args)); break;
    case 'void_invoice': result = mcpContent(await toolVoidInvoice(env, auth, args)); break;
    // Wave 3
    case 'tag_customer': result = mcpContent(await toolTagCustomer(env, auth, args)); break;
    case 'untag_customer': result = mcpContent(await toolUntagCustomer(env, auth, args)); break;
    case 'link_vendor': result = mcpContent(await toolLinkVendor(env, auth, args)); break;
    case 'unlink_vendor': result = mcpContent(await toolUnlinkVendor(env, auth, args)); break;
    case 'set_archive_status': result = mcpContent(await toolSetArchiveStatus(env, auth, args)); break;
    case 'fulfill_invoice': result = mcpContent(await toolFulfillInvoice(env, auth, args)); break;
    case 'update_account_settings': result = mcpContent(await toolUpdateAccountSettings(env, auth, args)); break;
    case 'update_exchange_rate': result = mcpContent(await toolUpdateExchangeRate(env, auth, args)); break;
    default: throw new Error(`Unknown tool: ${name}`);
  }
  await logMcpToolCall(env, auth, name, args, result);
  return result;
}

const SERVER_INFO = {
  name: 'teajia-inventory',
  version: '0.3.0',
  description: 'Voice-controlled inventory + invoicing for Teajia. Tools cover tea search, stock adjustments, customer lookup, creating/voiding/fulfilling invoices, customer tags, vendor linking, catalog archive control, and (with owner-tier tokens) account settings and exchange rates.',
};

const PROTOCOL_VERSION = '2024-11-05';

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
      case 'initialize':
        return rpcResult(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });

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

  await env.DB.prepare(
    `INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, accountId, userId, userEmail, label.slice(0, 80), hash, prefix, JSON.stringify(scopes), tier).run();

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

function originOf(request: Request): string {
  const u = new URL(request.url);
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

// POST /oauth/register — dynamic client registration (RFC 7591). We accept
// any redirect_uri the client gives us; we don't pre-validate hostnames
// because Claude desktop, mobile, and ChatGPT all use different schemes
// (claude://oauth, https://claude.ai/api/..., etc).
export async function oauthRegister(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return corsJson({ error: 'Method not allowed' }, 405);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return corsJson({ error: 'invalid_request', error_description: 'Body must be JSON' }, 400);
  }

  const clientName = String(body?.client_name || 'Unknown Client').slice(0, 120);
  const redirectUris = Array.isArray(body?.redirect_uris) ? body.redirect_uris.filter((u: any) => typeof u === 'string') : [];
  if (redirectUris.length === 0) {
    return corsJson({ error: 'invalid_redirect_uri', error_description: 'redirect_uris required' }, 400);
  }
  const grantTypes = Array.isArray(body?.grant_types) ? body.grant_types : ['authorization_code'];
  const responseTypes = Array.isArray(body?.response_types) ? body.response_types : ['code'];

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO oauth_clients (id, client_name, redirect_uris, grant_types, response_types)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, clientName, JSON.stringify(redirectUris), JSON.stringify(grantTypes), JSON.stringify(responseTypes)).run();

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
// form), so we 302 to the Teajia frontend's /admin/oauth-consent page with
// all the OAuth parameters in the query string. That page handles login (if
// needed) and the user-facing approve/deny. On approve, the page POSTs back
// to /oauth/authorize/decision below, which mints the auth code and 302s
// back to Claude's redirect_uri.
//
// CRITICAL: this redirect must go to the FRONTEND origin, not the worker
// origin — the worker has no UI. We hard-code teajia.pages.dev because the
// worker has no other reliable way to discover the frontend URL.
const FRONTEND_ORIGIN = 'https://teajia.pages.dev';

export function oauthAuthorize(request: Request): Response {
  const url = new URL(request.url);
  const consentUrl = `${FRONTEND_ORIGIN}/admin/oauth-consent${url.search}`;
  return Response.redirect(consentUrl, 302);
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

  const { client_id, redirect_uri, code_challenge, code_challenge_method, state, account_id } = body || {};

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

  // Mint a fresh single-use auth code (5 min TTL).
  const code = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO oauth_codes
       (code, client_id, redirect_uri, user_id, user_email, account_id, code_challenge, code_challenge_method, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
  ).run();

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

  await env.DB.prepare(
    `INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes, creator_tier)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    tokenId,
    codeRow.account_id, codeRow.user_id, codeRow.user_email,
    label, tokenHash, tokenPrefix, JSON.stringify(DEFAULT_MCP_SCOPES), 'account_owner',
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
    scope: DEFAULT_MCP_SCOPES.join(' '),
    // No refresh token — clients can re-run the OAuth dance to get a new
    // access token, and the existing tokens stay valid in the meantime.
    // Most MCP clients treat the access token as long-lived by default.
  });
}
