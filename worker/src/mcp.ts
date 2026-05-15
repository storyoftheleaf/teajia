// MCP server for Teajia — voice/agent control of this account's inventory.
//
// Speaks the Model Context Protocol over plain HTTP POST + JSON-RPC 2.0 (no SSE).
// One MCP token == one (account, user) pair, with full bundle-equivalent rights
// inside that account. Tokens are minted in the admin and stored hashed.
//
// Mutating tools follow a confirm-pattern: first call returns a `preview`
// payload + `confirmation_token`; the model is expected to read the preview
// back to the user and then re-call with `confirm: <token>` to commit. The
// commit step short-circuits to a no-op if the token is unknown or expired.
//
// Stock + invoice writes reuse the existing fulfillment math (so the
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
type McpAuth = {
  accountId: string;
  userId: string;
  userEmail: string;
  tokenId: string;
  scopes: McpScope[];
};

const MCP_SCOPES = ['inventory:read', 'stock:write', 'customers:read', 'sales:write'] as const;
type McpScope = typeof MCP_SCOPES[number];
const DEFAULT_MCP_SCOPES: McpScope[] = [...MCP_SCOPES];

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
    'SELECT id, account_id, user_id, user_email, revoked_at, scopes FROM mcp_tokens WHERE token_hash = ?'
  ).bind(hash).first() as Record<string, any> | null;

  if (!row || row.revoked_at) {
    return unauthorized(request, 'Invalid or revoked token');
  }

  // Bump last_used_at on every successful auth (best-effort; non-blocking).
  env.DB.prepare("UPDATE mcp_tokens SET last_used_at = datetime('now') WHERE id = ?")
    .bind(row.id).run().catch(() => {});

  return {
    accountId: row.account_id as string,
    userId: row.user_id as string,
    userEmail: row.user_email as string,
    tokenId: row.id as string,
    scopes: parseMcpScopes(row.scopes),
  };
}

// ── confirmation token store ──
//
// Mutating tools issue a confirmation token on the first call (a preview),
// and require the model to re-call with that token to commit. Tokens are stored
// in D1 when the migration is present so preview/confirm works across
// Cloudflare isolates. The in-memory map remains a dev/fallback path.

type PendingMutation =
  | { kind: 'add_stock'; accountId: string; userEmail: string; productId: string; grams: number; note: string | null }
  | { kind: 'remove_stock'; accountId: string; userEmail: string; productId: string; grams: number; reason: string; note: string | null }
  | { kind: 'record_sale'; accountId: string; userEmail: string; lines: SaleLineInput[]; customerId: string | null; customerName: string; customerWhatsapp: string | null; notes: string | null }
  | { kind: 'create_tea'; accountId: string; userEmail: string; product: NewTeaInput }
  | { kind: 'fulfill_invoice'; accountId: string; userEmail: string; invoiceId: string; invoiceNumber: string }
  | { kind: 'mark_invoice_paid'; accountId: string; userEmail: string; invoiceId: string; invoiceNumber: string; paymentMethod: string; fulfillStock: boolean };

type PendingEntry = { mutation: PendingMutation; expiresAt: number };
const PENDING = new Map<string, PendingEntry>();
const PENDING_TTL_MS = 5 * 60 * 1000;

type SaleLineInput = {
  productId: string | null;
  customName: string | null;
  quantity: number;
  unit: 'g' | 'pcs';
  priceUsd: number;
  kind: 'tea' | 'teaware' | 'custom';
};

function issueMemoryConfirmationToken(token: string, mutation: PendingMutation, expiresAt: number): void {
  // Sweep expired entries opportunistically so the map doesn't grow unbounded
  // in a long-lived isolate.
  const now = Date.now();
  for (const [k, v] of PENDING) if (v.expiresAt < now) PENDING.delete(k);
  PENDING.set(token, { mutation, expiresAt });
}

async function issueConfirmationToken(env: Env, mutation: PendingMutation): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = Date.now() + PENDING_TTL_MS;
  issueMemoryConfirmationToken(token, mutation, expiresAt);
  try {
    await env.DB.prepare(
      `INSERT INTO mcp_confirmation_tickets
         (token_hash, account_id, kind, payload_json, expires_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      await sha256Hex(token),
      mutation.accountId,
      mutation.kind,
      JSON.stringify(mutation),
      expiresAt,
    ).run();
  } catch {
    // Older local/preview databases may not have the table yet. In that case
    // the memory fallback still keeps the two-step guard working in one
    // isolate, and production D1 gets durability once migration 074 is applied.
  }
  return token;
}

async function consumeConfirmationToken(env: Env, token: string): Promise<PendingMutation | null> {
  try {
    const row = await env.DB.prepare(
      `UPDATE mcp_confirmation_tickets
          SET consumed_at = ?
        WHERE token_hash = ?
          AND consumed_at IS NULL
          AND expires_at > ?
      RETURNING payload_json`
    ).bind(Date.now(), await sha256Hex(token), Date.now()).first() as { payload_json?: string } | null;
    if (row?.payload_json) {
      PENDING.delete(token);
      return JSON.parse(row.payload_json) as PendingMutation;
    }
  } catch {
    // Fall back to the in-memory ticket below when the durable table does not
    // exist yet, such as in old dev databases.
  }

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

function normalize(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9一-鿿\s]/g, ' ').replace(/\s+/g, ' ').trim();
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
  fixedRetailPriceUsd: number | null;
  lowStockThreshold: number;
  notes: string | null;
  status: string;
};

function asciiPdfText(input: string): string {
  return input.replace(/[^\x20-\x7E]/g, '?');
}

function pdfEscape(input: string): string {
  return asciiPdfText(input).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function makeSimpleInvoicePdfBase64(args: {
  invoiceNumber: string;
  customerName: string;
  lines: Array<{ name: string; quantity: number; unit: string; priceUsd: number; totalUsd: number }>;
  totalUsd: number;
}): string {
  const textLines = [
    `Teajia Invoice ${args.invoiceNumber}`,
    `Customer: ${args.customerName}`,
    `Created: ${new Date().toISOString()}`,
    '',
    ...args.lines.map(line =>
      `${line.name} - ${line.quantity}${line.unit} x $${line.priceUsd.toFixed(2)}/${line.unit} = $${line.totalUsd.toFixed(2)}`,
    ),
    '',
    `Total USD: $${args.totalUsd.toFixed(2)}`,
  ];
  const content = [
    'BT',
    '/F1 12 Tf',
    '72 740 Td',
    ...textLines.map((line, index) =>
      `${index === 0 ? '' : '0 -18 Td\n'}(${pdfEscape(line)}) Tj`,
    ),
    'ET',
  ].join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }
  const xrefAt = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return btoa(pdf);
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

// ── tool: create_tea (preview / confirm) ──
async function toolCreateTea(env: Env, auth: McpAuth, args: any) {
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (confirm) {
    const pending = await consumeConfirmationToken(env, confirm);
    if (!pending || pending.kind !== 'create_tea') {
      return { error: 'invalid_or_expired_confirmation_token' };
    }
    return commitCreateTea(env, pending);
  }

  const productName = String(args?.product_name ?? args?.name ?? '').trim();
  if (!productName) throw new Error('product_name is required');
  const stockGrams = Math.max(0, Math.round(Number(args?.stock_grams ?? args?.grams ?? 0) || 0));
  const costAmount = Math.max(0, Number(args?.cost_amount ?? 0) || 0);
  const fixedRetailPriceUsd = args?.fixed_retail_price_usd == null
    ? null
    : Math.max(0, Number(args.fixed_retail_price_usd) || 0);
  const lowStockThreshold = Math.max(0, Math.round(Number(args?.low_stock_threshold ?? 100) || 0));

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
    costCurrency: args?.cost_currency ? String(args.cost_currency).trim().toUpperCase() : 'USD',
    fixedRetailPriceUsd,
    lowStockThreshold,
    notes: args?.notes ? String(args.notes).slice(0, 1000) : null,
    status: args?.status ? String(args.status).trim() : 'Active',
  };

  const token = await issueConfirmationToken(env, {
    kind: 'create_tea',
    accountId: auth.accountId,
    userEmail: auth.userEmail,
    product,
  });
  return {
    preview: {
      action: 'create_tea',
      product,
    },
    confirmation_token: token,
    expires_in_seconds: PENDING_TTL_MS / 1000,
  };
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
  const names = Object.keys(cols);
  await env.DB.prepare(
    `INSERT INTO products (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`
  ).bind(...names.map(name => cols[name])).run();

  if (m.product.stockGrams > 0) {
    await env.DB.prepare(
      `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, user_email, note, account_id)
       VALUES (?, ?, ?, ?, 'PURCHASE_RECEIPT', ?, ?, ?)`
    ).bind(
      crypto.randomUUID(),
      id,
      m.product.stockGrams,
      m.product.stockGrams,
      m.userEmail,
      'MCP create_tea opening stock',
      m.accountId,
    ).run();
  }

  await env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'PRODUCT_CREATED_MCP', ?, ?, 'product', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    `Product ${m.product.productName} created via MCP`,
    m.userEmail,
    id,
    m.accountId,
  ).run();

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

  const pending = await consumeConfirmationToken(env, confirm);
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
    const token = await issueConfirmationToken(env, {
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

  const pending = await consumeConfirmationToken(env, confirm);
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
// Creates an invoice in Teajia without deducting stock. The operator can later
// mark stock gone, mark payment received, or do both in one follow-up.

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
    product_id: string | null;
    custom_name: string | null;
    product_name: string;
    quantity: number;
    unit: 'g' | 'pcs';
    kind: 'tea' | 'teaware' | 'custom';
    price_usd: number;
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
    const customName = String(raw?.custom_name ?? raw?.name ?? raw?.description ?? '').trim();
    const quantity = Number(raw?.quantity ?? raw?.grams ?? raw?.pieces ?? raw?.pcs);
    const unitRaw = String(raw?.unit ?? (raw?.pcs != null || raw?.pieces != null ? 'pcs' : 'g')).toLowerCase();
    const unit: 'g' | 'pcs' = ['pcs', 'pc', 'piece', 'pieces', 'unit', 'units'].includes(unitRaw) ? 'pcs' : 'g';
    const priceUsd = Number(raw?.price_usd ?? raw?.price_per_unit_usd ?? raw?.price_at_sale ?? raw?.price_per_gram_usd);
    const kindRaw = String(raw?.kind ?? '').toLowerCase();
    const kind: 'tea' | 'teaware' | 'custom' =
      kindRaw === 'teaware' ? 'teaware' :
      productId ? 'tea' :
      'custom';
    if (!productId && !customName) throw new Error('lines[].product_id or lines[].custom_name is required');
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('lines[].quantity/grams must be > 0');
    if (!Number.isFinite(priceUsd) || priceUsd < 0) throw new Error('lines[].price_usd/price_per_gram_usd must be >= 0');

    if (!productId) {
      previewLines.push({
        product_id: null,
        custom_name: customName.slice(0, 180),
        product_name: customName.slice(0, 180),
        quantity,
        unit,
        kind,
        price_usd: priceUsd,
        line_total_usd: Math.round(quantity * priceUsd * 100) / 100,
        available_grams: 0,
        insufficient: false,
      });
      continue;
    }

    const p = await env.DB.prepare(
      'SELECT id, given_name, product_name, type, stock_grams, quantity_units FROM products WHERE id = ? AND account_id = ?'
    ).bind(productId, auth.accountId).first() as ProductRow | null;
    if (!p) return { error: 'product_not_found', product_id: productId };

    const available = Number(p.stock_grams || 0);
    const productKind = p.type === 'Teaware' ? 'teaware' : kind;
    const productUnit = p.type === 'Teaware' ? 'pcs' : unit;
    previewLines.push({
      product_id: productId,
      custom_name: null,
      product_name: p.given_name || p.product_name,
      quantity,
      unit: productUnit,
      kind: productKind,
      price_usd: priceUsd,
      line_total_usd: Math.round(quantity * priceUsd * 100) / 100,
      available_grams: available,
      insufficient: productUnit === 'g' && quantity > available,
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
    const token = await issueConfirmationToken(env, {
      kind: 'record_sale', accountId: auth.accountId, userEmail: auth.userEmail,
      lines: previewLines.map(l => ({
        productId: l.product_id,
        customName: l.custom_name,
        quantity: l.quantity,
        unit: l.unit,
        priceUsd: l.price_usd,
        kind: l.kind,
      })),
      customerId, customerName: customerNameResolved, customerWhatsapp, notes,
    });
    return {
      preview: {
        action: 'record_sale',
        customer: { id: customerId, name: customerNameResolved, whatsapp: customerWhatsapp },
        lines: previewLines.map(l => ({
          product: l.product_id ? { id: l.product_id, name: l.product_name } : null,
          custom_name: l.custom_name,
          quantity: l.quantity,
          unit: l.unit,
          kind: l.kind,
          price_usd: l.price_usd,
          line_total_usd: l.line_total_usd,
          available_grams_before: l.available_grams,
          stock_backed: Boolean(l.product_id && l.unit === 'g'),
        })),
        total_usd: Math.round(total * 100) / 100,
        notes,
      },
      confirmation_token: token,
      expires_in_seconds: PENDING_TTL_MS / 1000,
    };
  }

  const pending = await consumeConfirmationToken(env, confirm);
  if (!pending || pending.kind !== 'record_sale') {
    return { error: 'invalid_or_expired_confirmation_token' };
  }
  return commitRecordSale(env, pending);
}

async function commitRecordSale(env: Env, m: Extract<PendingMutation, { kind: 'record_sale' }>) {
  // Re-validate products at commit time. Stock may have changed since preview;
  // we keep insufficient stock as a warning because invoice creation itself
  // does not deduct inventory.
  const productCache = new Map<string, { id: string; stock_grams: number; given_name: string | null; product_name: string; status: string; low_stock_threshold: number | null; source_compass_entry_id: string | null }>();
  for (const line of m.lines) {
    if (!line.productId) continue;
    const p = await env.DB.prepare(
      'SELECT id, stock_grams, given_name, product_name, status, low_stock_threshold, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
    ).bind(line.productId, m.accountId).first() as any;
    if (!p) return { error: 'product_not_found', product_id: line.productId };
    productCache.set(line.productId, p);
  }

  // Allocate invoice number using the existing per-account sequence.
  const seqRow = await env.DB.prepare(
    'UPDATE accounts SET invoice_seq = invoice_seq + 1 WHERE id = ? RETURNING invoice_seq, invoice_prefix'
  ).bind(m.accountId).first() as { invoice_seq: number; invoice_prefix: string | null } | null;
  const seq = seqRow?.invoice_seq ?? 1;
  const pfx = seqRow?.invoice_prefix || '';
  const invoiceNumber = pfx ? `${pfx}-${seq}` : String(seq);

  const invoiceId = crypto.randomUUID();
  const stmts: D1PreparedStatement[] = [];

  // Invoice + line items only. Stock is deducted later by fulfill_invoice.
  stmts.push(env.DB.prepare(
    `INSERT INTO invoices
       (id, account_id, invoice_number, customer_name, customer_whatsapp, customer_id,
        display_currency, shipping_cost_usd, status, inventory_deducted, notes, payment_status)
     VALUES (?, ?, ?, ?, ?, ?, 'USD', 0, 'Pending', 0, ?, 'unpaid')`
  ).bind(
    invoiceId, m.accountId, invoiceNumber,
    m.customerName, m.customerWhatsapp, m.customerId, m.notes,
  ));

  for (const line of m.lines) {
    stmts.push(env.DB.prepare(
      'INSERT INTO invoice_line_items (id, account_id, invoice_id, product_id, custom_name, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      crypto.randomUUID(),
      m.accountId,
      invoiceId,
      line.productId,
      line.productId ? null : line.customName,
      line.quantity,
      line.priceUsd,
    ));
  }

  stmts.push(env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'INVOICE_CREATED_MCP', ?, ?, 'invoice', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    `Invoice ${invoiceNumber} created via MCP for ${m.customerName} (${m.lines.length} items)`,
    m.userEmail, invoiceId, m.accountId,
  ));

  await env.DB.batch(stmts);

  const invoiceLines = m.lines.map(line => {
    const p = line.productId ? productCache.get(line.productId) : null;
    const name = p ? (p.given_name || p.product_name) : (line.customName || 'Custom item');
    return {
      name,
      quantity: line.quantity,
      unit: line.unit,
      priceUsd: line.priceUsd,
      totalUsd: Math.round(line.quantity * line.priceUsd * 100) / 100,
    };
  });
  const totalUsd = Math.round(m.lines.reduce((s, l) => s + l.quantity * l.priceUsd, 0) * 100) / 100;
  const pdfBase64 = makeSimpleInvoicePdfBase64({
    invoiceNumber,
    customerName: m.customerName,
    lines: invoiceLines,
    totalUsd,
  });

  return {
    committed: true,
    action: 'record_sale',
    invoice: {
      id: invoiceId,
      invoice_number: invoiceNumber,
      status: 'Pending',
      payment_status: 'unpaid',
      inventory_deducted: false,
      customer_name: m.customerName,
      total_usd: totalUsd,
      line_count: m.lines.length,
      pdf_filename: `${invoiceNumber}.pdf`,
      pdf_base64: pdfBase64,
    },
    pdf_filename: `${invoiceNumber}.pdf`,
    pdf_base64: pdfBase64,
    next_step_hint: 'Send the returned PDF to the buyer. Later call fulfill_invoice when the stock leaves, mark_invoice_paid when payment arrives, or mark_invoice_paid with fulfill_stock=true to do both.',
  };
}

// ── tool: fulfill_invoice (stock is now gone) ──
async function toolFulfillInvoice(env: Env, auth: McpAuth, args: any) {
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (confirm) {
    const pending = await consumeConfirmationToken(env, confirm);
    if (!pending || pending.kind !== 'fulfill_invoice') {
      return { error: 'invalid_or_expired_confirmation_token' };
    }
    return commitFulfillInvoice(env, pending);
  }

  const invoiceId = args?.invoice_id ? String(args.invoice_id).trim() : '';
  const invoiceNumber = args?.invoice_number ? String(args.invoice_number).trim() : '';
  const row = await findInvoiceForFulfillment(env, auth.accountId, invoiceId, invoiceNumber);
  if (row?.__duplicate_invoice_number) return { error: 'duplicate_invoice_number', invoice_number: invoiceNumber, matches: row.matches };
  if (!row) return { error: 'invoice_not_found', invoice_id: invoiceId || null, invoice_number: invoiceNumber || null };

  const token = await issueConfirmationToken(env, {
    kind: 'fulfill_invoice',
    accountId: auth.accountId,
    userEmail: auth.userEmail,
    invoiceId: row.id,
    invoiceNumber: row.invoice_number,
  });
  return {
    preview: {
      action: 'fulfill_invoice',
      invoice: row,
      stock_effect: 'deduct invoice line items and mark invoice Filled',
    },
    confirmation_token: token,
    expires_in_seconds: PENDING_TTL_MS / 1000,
  };
}

async function commitFulfillInvoice(env: Env, m: Extract<PendingMutation, { kind: 'fulfill_invoice' }>) {
  const invoice = await env.DB.prepare(
    'SELECT id, invoice_number, inventory_deducted, status FROM invoices WHERE id = ? AND account_id = ?'
  ).bind(m.invoiceId, m.accountId).first() as { id: string; invoice_number: string; inventory_deducted: number | null; status: string | null } | null;
  if (!invoice) return { error: 'invoice_not_found', invoice_id: m.invoiceId };
  const inventoryState = Number(invoice.inventory_deducted || 0);
  if (inventoryState === -1) {
    return {
      error: 'fulfillment_in_progress',
      action: 'fulfill_invoice',
      invoice_id: m.invoiceId,
      invoice_number: invoice.invoice_number,
    };
  }
  if (inventoryState === 1) {
    return {
      committed: false,
      already_fulfilled: true,
      action: 'fulfill_invoice',
      invoice_id: m.invoiceId,
      invoice_number: invoice.invoice_number,
      inventory_deducted: true,
    };
  }

  const items = await env.DB.prepare(
    'SELECT product_id, quantity FROM invoice_line_items WHERE invoice_id = ? AND account_id = ?'
  ).bind(m.invoiceId, m.accountId).all();

  const quantitiesByProduct = new Map<string, number>();
  for (const item of items.results as Array<{ product_id?: string | null; quantity?: number | string | null }>) {
    if (!item.product_id) continue;
    const qty = Number(item.quantity) || 0;
    if (qty < 0) return { error: 'invalid_invoice_line_quantity', product_id: item.product_id, quantity: item.quantity };
    if (qty === 0) continue;
    quantitiesByProduct.set(item.product_id, (quantitiesByProduct.get(item.product_id) || 0) + qty);
  }

  const productIds = [...quantitiesByProduct.keys()];
  const products = new Map<string, any>();
  for (const pid of productIds) {
    const p = await env.DB.prepare(
      'SELECT id, stock_grams, low_stock_threshold, given_name, product_name, status, source_compass_entry_id FROM products WHERE id = ? AND account_id = ?'
    ).bind(pid, m.accountId).first();
    if (p) products.set(pid, p);
  }

  const stmts: D1PreparedStatement[] = [];
  const deducted: Array<{ product_id: string; grams: number; balance_after: number }> = [];

  for (const [productId, qty] of quantitiesByProduct) {
    const product = products.get(productId);
    if (!product) return { error: 'product_not_found', product_id: productId };

    const currentStock = Number(product.stock_grams) || 0;
    const balanceAfter = currentStock - qty;
    const threshold = Number(product.low_stock_threshold) || 0;
    if (balanceAfter < 0) {
      return {
        error: 'insufficient_stock_at_fulfillment',
        product_id: productId,
        product_name: product.given_name || product.product_name,
        requested_grams: qty,
        available_grams: currentStock,
      };
    }

    stmts.push(env.DB.prepare(
      'UPDATE products SET stock_grams = stock_grams - ? WHERE id = ? AND account_id = ?'
    ).bind(qty, productId, m.accountId));
    stmts.push(env.DB.prepare(
      'UPDATE product_listings SET stock_grams = stock_grams - ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).bind(qty, `list_${productId}`));
    stmts.push(env.DB.prepare(
      `INSERT INTO stock_ledger (id, product_id, delta, balance_after, reason, source_invoice_id, source_invoice_number, user_email, note, account_id)
       VALUES (?, ?, ?, ?, 'FULFILLMENT', ?, ?, ?, ?, ?)`
    ).bind(
      crypto.randomUUID(), productId, -qty, balanceAfter,
      m.invoiceId, invoice.invoice_number, m.userEmail, 'MCP fulfill_invoice', m.accountId,
    ));
    deducted.push({ product_id: productId, grams: qty, balance_after: balanceAfter });

    if (balanceAfter <= 0 && product.status !== 'Sold Out') {
      stmts.push(env.DB.prepare(
        "UPDATE products SET status = 'Sold Out', sold_out_at = datetime('now') WHERE id = ? AND account_id = ?"
      ).bind(productId, m.accountId));
      stmts.push(env.DB.prepare(
        "UPDATE product_listings SET status = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind('Sold Out', `list_${productId}`));
      stmts.push(env.DB.prepare(
        `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
         VALUES (?, 'PRODUCT_SOLD_OUT', ?, ?, 'product', ?, ?)`
      ).bind(
        crypto.randomUUID(),
        `${product.given_name || product.product_name} auto-archived (stock reached ${balanceAfter}g after fulfillment of ${invoice.invoice_number})`,
        m.userEmail, productId, m.accountId,
      ));
      if (product.source_compass_entry_id) {
        stmts.push(env.DB.prepare(
          "UPDATE tea_compass_entries SET status = 'depleted', updated_at = datetime('now') WHERE id = ? AND status = 'in_stock'"
        ).bind(product.source_compass_entry_id));
      }
    } else if (threshold > 0 && balanceAfter < threshold && currentStock >= threshold) {
      stmts.push(env.DB.prepare(
        `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
         VALUES (?, 'low_stock_alert', ?, ?, 'product', ?, ?)`
      ).bind(
        crypto.randomUUID(),
        JSON.stringify({ productName: product.given_name || product.product_name, stockGrams: balanceAfter, threshold }),
        m.userEmail, productId, m.accountId,
      ));
    }
  }

  const fulfillmentClaim = await env.DB.prepare(
    "UPDATE invoices SET inventory_deducted = -1 WHERE id = ? AND account_id = ? AND COALESCE(inventory_deducted, 0) = 0"
  ).bind(m.invoiceId, m.accountId).run();
  if ((fulfillmentClaim.meta?.changes ?? 0) === 0) {
    return {
      committed: false,
      already_fulfilled: true,
      action: 'fulfill_invoice',
      invoice_id: m.invoiceId,
      invoice_number: invoice.invoice_number,
      inventory_deducted: true,
    };
  }

  stmts.push(env.DB.prepare('DELETE FROM stock_holds WHERE invoice_id = ? AND account_id = ?').bind(m.invoiceId, m.accountId));
  stmts.push(env.DB.prepare(
    `INSERT INTO activity_logs (id, action, details, user_email, entity_type, entity_id, account_id)
     VALUES (?, 'FULFILLMENT_MCP', ?, ?, 'invoice', ?, ?)`
  ).bind(
    crypto.randomUUID(),
    `Invoice ${invoice.invoice_number} marked stock gone via MCP. Inventory deducted for ${deducted.length} item(s).`,
    m.userEmail, m.invoiceId, m.accountId,
  ));
  // Keep the final invoice marker last so Filled/inventory_deducted=1 is only
  // written after the stock, listing mirror, and ledger statements have
  // succeeded. The earlier -1 claim prevents two confirms from deducting the
  // same invoice at the same time.
  stmts.push(env.DB.prepare(
    "UPDATE invoices SET status = 'Filled', inventory_deducted = 1 WHERE id = ? AND account_id = ? AND inventory_deducted = -1"
  ).bind(m.invoiceId, m.accountId));

  let results: D1Result<unknown>[];
  try {
    results = await env.DB.batch(stmts) as D1Result<unknown>[];
  } catch (err) {
    await env.DB.prepare(
      "UPDATE invoices SET inventory_deducted = 0 WHERE id = ? AND account_id = ? AND inventory_deducted = -1"
    ).bind(m.invoiceId, m.accountId).run();
    throw err;
  }
  const finalClaim = results[results.length - 1] as D1Result<unknown>;
  if ((finalClaim.meta?.changes ?? 0) === 0) {
    await env.DB.prepare(
      "UPDATE invoices SET inventory_deducted = 0 WHERE id = ? AND account_id = ? AND inventory_deducted = -1"
    ).bind(m.invoiceId, m.accountId).run();
    return {
      error: 'fulfillment_claim_lost',
      action: 'fulfill_invoice',
      invoice_id: m.invoiceId,
      invoice_number: invoice.invoice_number,
    };
  }

  return {
    committed: true,
    action: 'fulfill_invoice',
    invoice_id: m.invoiceId,
    invoice_number: invoice.invoice_number,
    status: 'Filled',
    inventory_deducted: true,
    deducted,
  };
}

// ── tool: mark_invoice_paid (preview / confirm) ──
async function toolMarkInvoicePaid(env: Env, auth: McpAuth, args: any) {
  const confirm = args?.confirm ? String(args.confirm) : null;
  if (confirm) {
    const pending = await consumeConfirmationToken(env, confirm);
    if (!pending || pending.kind !== 'mark_invoice_paid') {
      return { error: 'invalid_or_expired_confirmation_token' };
    }
    return commitMarkInvoicePaid(env, pending);
  }

  const invoiceId = args?.invoice_id ? String(args.invoice_id).trim() : '';
  const invoiceNumber = args?.invoice_number ? String(args.invoice_number).trim() : '';
  const paymentMethod = args?.payment_method ? String(args.payment_method).slice(0, 80) : 'mcp';
  const fulfillStock = Boolean(args?.fulfill_stock);

  const row = await findInvoiceForPayment(env, auth.accountId, invoiceId, invoiceNumber);
  if (row?.__duplicate_invoice_number) return { error: 'duplicate_invoice_number', invoice_number: invoiceNumber, matches: row.matches };
  if (!row) return { error: 'invoice_not_found', invoice_id: invoiceId || null, invoice_number: invoiceNumber || null };

  const token = await issueConfirmationToken(env, {
    kind: 'mark_invoice_paid',
    accountId: auth.accountId,
    userEmail: auth.userEmail,
    invoiceId: row.id,
    invoiceNumber: row.invoice_number,
    paymentMethod,
    fulfillStock,
  });
  return {
    preview: {
      action: 'mark_invoice_paid',
      invoice: row,
      payment_method: paymentMethod,
      stock_effect: fulfillStock ? 'also deduct invoice line items and mark invoice Filled' : 'payment only; stock is unchanged',
    },
    confirmation_token: token,
    expires_in_seconds: PENDING_TTL_MS / 1000,
  };
}

async function findInvoiceForPayment(
  env: Env,
  accountId: string,
  invoiceId: string,
  invoiceNumber: string,
) {
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

async function findInvoiceForFulfillment(
  env: Env,
  accountId: string,
  invoiceId: string,
  invoiceNumber: string,
) {
  if (invoiceId) {
    return env.DB.prepare(
      `SELECT id, invoice_number, customer_name, status, payment_status, payment_date, inventory_deducted
         FROM invoices WHERE id = ? AND account_id = ?`
    ).bind(invoiceId, accountId).first() as Promise<any | null>;
  }
  if (invoiceNumber) {
    const rows = await env.DB.prepare(
      `SELECT id, invoice_number, customer_name, status, payment_status, payment_date, inventory_deducted
         FROM invoices WHERE invoice_number = ? AND account_id = ?`
    ).bind(invoiceNumber, accountId).all();
    const matches = (rows.results ?? []) as any[];
    if (matches.length > 1) return { __duplicate_invoice_number: true, matches: matches.slice(0, 5) };
    return matches[0] ?? null;
  }
  return env.DB.prepare(
    `SELECT id, invoice_number, customer_name, status, payment_status, payment_date, inventory_deducted
       FROM invoices
      WHERE account_id = ? AND COALESCE(inventory_deducted, 0) = 0
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
      m.userEmail,
      m.invoiceId,
      m.accountId,
    ).run();
  }

  const fulfillment = m.fulfillStock
    ? await commitFulfillInvoice(env, {
      kind: 'fulfill_invoice',
      accountId: m.accountId,
      userEmail: m.userEmail,
      invoiceId: m.invoiceId,
      invoiceNumber: m.invoiceNumber,
    })
    : null;

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
    name: 'create_tea',
    scope: 'stock:write',
    description: 'Create a new tea/product row in Teajia inventory. Two-step preview/confirm. Use this when the tea does not already exist, then use add_stock for later restocks.',
    inputSchema: {
      type: 'object',
      properties: {
        product_name: { type: 'string', description: 'Required display/product name.' },
        given_name: { type: 'string' },
        chinese_name: { type: 'string' },
        type: { type: 'string', default: 'Tea' },
        form: { type: 'string' },
        year: { type: 'string' },
        origin_country: { type: 'string' },
        origin_region: { type: 'string' },
        vendor: { type: 'string' },
        stock_grams: { type: 'number', description: 'Opening stock in grams.' },
        cost_amount: { type: 'number' },
        cost_currency: { type: 'string', default: 'USD' },
        fixed_retail_price_usd: { type: 'number' },
        low_stock_threshold: { type: 'number', default: 100 },
        notes: { type: 'string' },
        status: { type: 'string', default: 'Active' },
        confirm: { type: 'string' },
      },
      required: ['product_name'],
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
    description: 'Create a pending unpaid invoice for a multi-line tea sale. This does not deduct stock. Use fulfill_invoice later when the stock leaves, mark_invoice_paid when payment arrives, or mark_invoice_paid with fulfill_stock=true to do both. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        lines: {
          type: 'array',
          description: 'One entry per invoice line. Use product_id for stock-backed tea lines, or custom_name for teaware/custom/non-inventory lines.',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'Stock-backed Teajia product id. Omit for custom/non-inventory lines.' },
              custom_name: { type: 'string', description: 'Line name for custom, teaware, or non-inventory items.' },
              quantity: { type: 'number', description: 'Quantity in the chosen unit.' },
              grams: { type: 'number', description: 'Back-compat alias for quantity when unit is g.' },
              unit: { type: 'string', enum: ['g', 'pcs'], default: 'g' },
              kind: { type: 'string', enum: ['tea', 'teaware', 'custom'], default: 'tea' },
              price_usd: { type: 'number', description: 'Unit price in USD.' },
              price_per_unit_usd: { type: 'number', description: 'Alias for price_usd.' },
              price_per_gram_usd: { type: 'number', description: 'Back-compat alias for price_usd when unit is g.' },
            },
            required: [],
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
  {
    name: 'fulfill_invoice',
    scope: 'sales:write',
    description: 'Mark an invoice fulfilled when the stock is now gone. Deducts invoice line items, writes stock ledger rows, mirrors listing stock/status, and marks the invoice Filled. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string' },
        invoice_number: { type: 'string' },
        confirm: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'mark_invoice_paid',
    scope: 'sales:write',
    description: 'Mark an invoice paid by id, invoice number, or the most recent unpaid invoice. Set fulfill_stock=true when the same message also says the stock is gone. Two-step preview/confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        invoice_id: { type: 'string' },
        invoice_number: { type: 'string' },
        payment_method: { type: 'string', default: 'mcp' },
        fulfill_stock: { type: 'boolean', default: false },
        confirm: { type: 'string' },
      },
      required: [],
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
    .filter(tool => hasMcpScope(auth, tool.scope as McpScope))
    .map(({ scope: _scope, ...tool }) => tool);
}

async function logMcpToolCall(env: Env, auth: McpAuth, toolName: string, args: any, result: unknown) {
  const shouldAudit =
    toolName === 'record_sale' ||
    toolName === 'fulfill_invoice' ||
    toolName === 'mark_invoice_paid' ||
    ((toolName === 'add_stock' || toolName === 'remove_stock' || toolName === 'create_tea') && typeof args?.confirm === 'string');
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
  if (!hasMcpScope(auth, tool.scope as McpScope)) {
    return mcpContent({
      error: 'insufficient_mcp_scope',
      required_scope: tool.scope,
      tool: name,
    });
  }

  let result;
  switch (name) {
    case 'search_tea': result = mcpContent(await toolSearchTea(env, auth.accountId, args)); break;
    case 'get_tea': result = mcpContent(await toolGetTea(env, auth.accountId, args)); break;
    case 'list_low_stock': result = mcpContent(await toolListLowStock(env, auth.accountId)); break;
    case 'find_customer': result = mcpContent(await toolFindCustomer(env, auth.accountId, args)); break;
    case 'create_tea': result = mcpContent(await toolCreateTea(env, auth, args)); break;
    case 'add_stock': result = mcpContent(await toolAddStock(env, auth, args)); break;
    case 'remove_stock': result = mcpContent(await toolRemoveStock(env, auth, args)); break;
    case 'record_sale': result = mcpContent(await toolRecordSale(env, auth, args)); break;
    case 'fulfill_invoice': result = mcpContent(await toolFulfillInvoice(env, auth, args)); break;
    case 'mark_invoice_paid': result = mcpContent(await toolMarkInvoicePaid(env, auth, args)); break;
    default: throw new Error(`Unknown tool: ${name}`);
  }
  await logMcpToolCall(env, auth, name, args, result);
  return result;
}

const SERVER_INFO = {
  name: 'teajia-inventory',
  version: '0.1.0',
  description: 'Voice-controlled inventory + invoicing for Teajia. Tools cover tea search, product creation, stock adjustments, customer lookup, invoice creation, fulfillment, and paid marking.',
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
): Promise<{ id: string; token: string; prefix: string }> {
  // Generate 32 bytes → 43-char base64url. That's 256 bits of entropy and
  // unambiguous when Adrian copies it.
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const b64 = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const plaintext = `tjmcp_${b64}`;
  const hash = await sha256Hex(plaintext);
  const prefix = plaintext.slice(0, 14); // "tjmcp_xxxxxxxx" — enough to distinguish, can't reconstruct
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, accountId, userId, userEmail, label.slice(0, 80), hash, prefix, JSON.stringify(DEFAULT_MCP_SCOPES)).run();

  return { id, token: plaintext, prefix };
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
    `INSERT INTO mcp_tokens (id, account_id, user_id, user_email, label, token_hash, token_prefix, scopes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    tokenId,
    codeRow.account_id, codeRow.user_id, codeRow.user_email,
    label, tokenHash, tokenPrefix, JSON.stringify(DEFAULT_MCP_SCOPES),
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
